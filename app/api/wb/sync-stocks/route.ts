import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// НАСТРОЙКИ
// ============================================================

const SYNC_KEY = "stocks";

const REPEAT_GUARD_HOURS = 3;

const SUPABASE_BATCH_SIZE = 1000;


// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}


function splitIntoBatches<T>(
  items: T[],
  size: number
): T[][] {
  const batches: T[][] = [];

  for (
    let i = 0;
    i < items.length;
    i += size
  ) {
    batches.push(
      items.slice(i, i + size)
    );
  }

  return batches;
}


function classifyWarehouse(
  warehouseName: string
):
  | "physical"
  | "wbRussiaAggregate"
  | "total"
  | "toClient"
  | "returning" {

  if (
    warehouseName ===
    "Всего находится на складах"
  ) {
    return "total";
  }

  if (
    warehouseName ===
    "В пути до получателей"
  ) {
    return "toClient";
  }

  if (
    warehouseName ===
    "В пути возвраты на склад WB"
  ) {
    return "returning";
  }

  if (
    warehouseName ===
    "Склад WB РФ"
  ) {
    return "wbRussiaAggregate";
  }

  return "physical";
}


function getRateLimit(
  response: Response
) {
  return {
    retryAfterSeconds:
      response.headers.get(
        "x-ratelimit-retry"
      ),

    resetAfterSeconds:
      response.headers.get(
        "x-ratelimit-reset"
      ),

    limit:
      response.headers.get(
        "x-ratelimit-limit"
      ),

    remaining:
      response.headers.get(
        "x-ratelimit-remaining"
      ),
  };
}


function getRetrySeconds(
  response: Response
): number | null {
  const value =
    response.headers.get(
      "x-ratelimit-retry"
    ) ??
    response.headers.get(
      "x-ratelimit-reset"
    );

  if (!value) {
    return null;
  }

  const seconds =
    Number(value);

  if (
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return null;
  }

  return seconds;
}


// ============================================================
// ОСНОВНОЙ МАРШРУТ
// ============================================================

export async function GET() {
  const wbTokenRaw =
    process.env.WB_READ_TOKEN;

  const supabaseUrlRaw =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKeyRaw =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;


  // ==========================================================
  // ПРОВЕРКА ПЕРЕМЕННЫХ
  // ==========================================================

  if (!wbTokenRaw) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не найден WB_READ_TOKEN в Vercel",
      },
      { status: 500 }
    );
  }

  if (!supabaseUrlRaw) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL",
      },
      { status: 500 }
    );
  }

  if (!supabaseKeyRaw) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY",
      },
      { status: 500 }
    );
  }

  const wbToken: string =
    wbTokenRaw;

  const supabaseUrl: string =
    supabaseUrlRaw;

  const supabaseKey: string =
    supabaseKeyRaw;


  // ==========================================================
  // ЧИТАЕМ СОСТОЯНИЕ
  // ==========================================================

  async function readState() {
    const url =
      `${supabaseUrl}/rest/v1/wb_sync_state` +
      `?sync_key=eq.${SYNC_KEY}` +
      `&select=*` +
      `&limit=1`;

    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            apikey:
              supabaseKey,

            Authorization:
              `Bearer ${supabaseKey}`,

            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );

    const text =
      await response.text();

    if (!response.ok) {
      throw new Error(
        `Не удалось прочитать wb_sync_state: ${text}`
      );
    }

    const data =
      parseJson(text);

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      return data[0];
    }

    return null;
  }


  // ==========================================================
  // ОБНОВЛЯЕМ СОСТОЯНИЕ
  // ==========================================================

  async function updateState(
    patch: Record<string, unknown>
  ) {
    const body = {
      sync_key:
        SYNC_KEY,

      ...patch,

      updated_at:
        new Date().toISOString(),
    };

    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_sync_state?on_conflict=sync_key`,
        {
          method: "POST",

          headers: {
            apikey:
              supabaseKey,

            Authorization:
              `Bearer ${supabaseKey}`,

            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            Prefer:
              "resolution=merge-duplicates,return=minimal",
          },

          body:
            JSON.stringify(body),

          cache:
            "no-store",
        }
      );

    if (!response.ok) {
      const text =
        await response.text();

      throw new Error(
        `Не удалось обновить wb_sync_state: ${text}`
      );
    }
  }


  // ==========================================================
  // СОХРАНЯЕМ 429
  // ==========================================================

  async function saveRateLimit(
    response: Response,
    stage: string | null,
    taskId: string | null
  ) {
    const retrySeconds =
      getRetrySeconds(
        response
      );

    const nextAllowedAt =
      retrySeconds
        ? new Date(
            Date.now() +
              retrySeconds * 1000
          ).toISOString()
        : null;

    await updateState({
      stage,

      external_task_id:
        taskId,

      last_attempt_at:
        new Date().toISOString(),

      next_allowed_at:
        nextAllowedAt,

      last_http_status:
        429,

      retry_after_seconds:
        retrySeconds,

      last_message:
        "Too Many Requests от Wildberries",
    });

    return {
      retrySeconds,
      nextAllowedAt,
    };
  }


  try {
    let state =
      await readState();

    // ========================================================
    // 1. ПРОВЕРЯЕМ БЛОКИРОВКУ
    // ========================================================

    if (
      state?.next_allowed_at
    ) {
      const nextAllowed =
        new Date(
          state.next_allowed_at
        );

      if (
        Number.isFinite(
          nextAllowed.getTime()
        ) &&
        nextAllowed.getTime() >
          Date.now()
      ) {
        const secondsRemaining =
          Math.ceil(
            (
              nextAllowed.getTime() -
              Date.now()
            ) / 1000
          );

        return NextResponse.json({
          ok: true,

          skipped: true,

          blockedByRateLimit:
            true,

          syncKey:
            SYNC_KEY,

          stage:
            state.stage ?? null,

          externalTaskId:
            state.external_task_id ??
            null,

          secondsRemaining,

          nextAllowedAt:
            state.next_allowed_at,

          wildberriesRequestSent:
            false,

          message:
            "Запрос к WB не выполнен: действует сохранённое ограничение API",
        });
      }
    }


    // ========================================================
    // 2. НЕ ДЕЛАЕМ НОВЫЙ СНИМОК СЛИШКОМ ЧАСТО
    // ========================================================

    if (
      state?.stage ===
        "completed" &&
      state?.last_success_at
    ) {
      const lastSuccess =
        new Date(
          state.last_success_at
        ).getTime();

      const hoursSinceSuccess =
        (
          Date.now() -
          lastSuccess
        ) /
        (
          1000 *
          60 *
          60
        );

      if (
        Number.isFinite(
          hoursSinceSuccess
        ) &&
        hoursSinceSuccess <
          REPEAT_GUARD_HOURS
      ) {
        return NextResponse.json({
          ok: true,

          skipped: true,

          stage:
            "completed",

          blockedByRateLimit:
            false,

          wildberriesRequestSent:
            false,

          lastSuccessAt:
            state.last_success_at,

          lastSnapshotId:
            state.last_snapshot_id ??
            null,

          hoursSinceSuccess:
            Number(
              hoursSinceSuccess.toFixed(
                2
              )
            ),

          repeatGuardHours:
            REPEAT_GUARD_HOURS,

          message:
            "Недавний снимок остатков уже существует",
        });
      }
    }


    // ========================================================
    // 3. ОПРЕДЕЛЯЕМ ТЕКУЩИЙ ЭТАП
    // ========================================================

    let stage: string =
      state?.stage ??
      "idle";

    let taskId: string | null =
      state?.external_task_id ??
      null;


    // ========================================================
    // 4. ЕСЛИ ЗАДАЧИ НЕТ — СОЗДАЁМ ОТЧЁТ
    // ========================================================

    if (
      !taskId ||
      (
        stage !==
          "report_created" &&
        stage !==
          "report_ready"
      )
    ) {
      const createUrl =
        new URL(
          "https://seller-analytics-api.wildberries.ru/api/v1/warehouse_remains"
        );

      createUrl.searchParams.set(
        "locale",
        "ru"
      );

      createUrl.searchParams.set(
        "groupBySa",
        "true"
      );

      createUrl.searchParams.set(
        "groupByNm",
        "true"
      );

      createUrl.searchParams.set(
        "groupByBarcode",
        "true"
      );

      createUrl.searchParams.set(
        "groupBySize",
        "true"
      );

      const attemptAt =
        new Date().toISOString();

      const createResponse =
        await fetch(
          createUrl.toString(),
          {
            method: "GET",

            headers: {
              Authorization:
                wbToken,

              Accept:
                "application/json",
            },

            cache:
              "no-store",
          }
        );

      const createText =
        await createResponse.text();

      const createData =
        parseJson(
          createText
        );

      const rateLimit =
        getRateLimit(
          createResponse
        );


      // ======================================================
      // 429 ПРИ СОЗДАНИИ
      // ======================================================

      if (
        createResponse.status ===
        429
      ) {
        const lock =
          await saveRateLimit(
            createResponse,
            "idle",
            null
          );

        return NextResponse.json(
          {
            ok: false,

            stage:
              "idle",

            message:
              "WB пока не разрешает создать отчёт остатков",

            wbStatus:
              429,

            rateLimit,

            nextAllowedAt:
              lock.nextAllowedAt,

            wildberriesRequestSent:
              true,

            wbResponse:
              createData,
          },
          { status: 429 }
        );
      }


      if (!createResponse.ok) {
        await updateState({
          stage:
            "idle",

          external_task_id:
            null,

          last_attempt_at:
            attemptAt,

          next_allowed_at:
            null,

          last_http_status:
            createResponse.status,

          retry_after_seconds:
            null,

          last_message:
            `Ошибка создания отчёта WB HTTP ${createResponse.status}`,
        });

        return NextResponse.json(
          {
            ok: false,

            message:
              "Wildberries вернул ошибку при создании отчёта остатков",

            wbStatus:
              createResponse.status,

            rateLimit,

            wbResponse:
              createData,
          },
          {
            status:
              createResponse.status,
          }
        );
      }


      const newTaskId =
        createData?.data
          ?.taskId;

      if (
        typeof newTaskId !==
          "string" ||
        !newTaskId
      ) {
        return NextResponse.json(
          {
            ok: false,

            message:
              "WB создал отчёт, но taskId не найден в ответе",

            wbResponse:
              createData,
          },
          { status: 500 }
        );
      }


      taskId =
        newTaskId;

      stage =
        "report_created";


      await updateState({
        stage,

        external_task_id:
          taskId,

        last_attempt_at:
          attemptAt,

        next_allowed_at:
          null,

        last_http_status:
          createResponse.status,

        retry_after_seconds:
          null,

        last_message:
          "Отчёт остатков WB создан, ожидаем готовность",
      });


      return NextResponse.json({
        ok: true,

        stage,

        message:
          "Задача отчёта остатков Wildberries успешно создана",

        taskId,

        wbStatus:
          createResponse.status,

        rateLimit,

        wildberriesRequestSent:
          true,

        nextAction:
          "Через некоторое время открой этот же адрес ещё один раз. Будет проверен статус отчёта.",
      });
    }


    // ========================================================
    // 5. ЕСЛИ ОТЧЁТ СОЗДАН — ПРОВЕРЯЕМ СТАТУС
    // ========================================================

    if (
      stage ===
      "report_created"
    ) {
      const statusUrl =
        `https://seller-analytics-api.wildberries.ru` +
        `/api/v1/warehouse_remains/tasks/${taskId}/status`;

      const statusResponse =
        await fetch(
          statusUrl,
          {
            method: "GET",

            headers: {
              Authorization:
                wbToken,

              Accept:
                "application/json",
            },

            cache:
              "no-store",
          }
        );

      const statusText =
        await statusResponse.text();

      const statusData =
        parseJson(
          statusText
        );

      const rateLimit =
        getRateLimit(
          statusResponse
        );


      // ======================================================
      // 429 ПРИ ПРОВЕРКЕ СТАТУСА
      // ======================================================

      if (
        statusResponse.status ===
        429
      ) {
        const lock =
          await saveRateLimit(
            statusResponse,
            "report_created",
            taskId
          );

        return NextResponse.json(
          {
            ok: false,

            stage:
              "report_created",

            message:
              "WB ограничил проверку статуса отчёта",

            taskId,

            wbStatus:
              429,

            rateLimit,

            nextAllowedAt:
              lock.nextAllowedAt,

            wildberriesRequestSent:
              true,
          },
          { status: 429 }
        );
      }


      if (!statusResponse.ok) {
        await updateState({
          stage:
            "report_created",

          external_task_id:
            taskId,

          last_attempt_at:
            new Date().toISOString(),

          last_http_status:
            statusResponse.status,

          last_message:
            `Ошибка проверки статуса WB HTTP ${statusResponse.status}`,
        });

        return NextResponse.json(
          {
            ok: false,

            message:
              "Ошибка проверки готовности отчёта WB",

            taskId,

            wbStatus:
              statusResponse.status,

            wbResponse:
              statusData,
          },
          {
            status:
              statusResponse.status,
          }
        );
      }


      const reportStatus =
        statusData?.data
          ?.status;


      if (
        reportStatus !==
        "done"
      ) {
        await updateState({
          stage:
            "report_created",

          external_task_id:
            taskId,

          last_attempt_at:
            new Date().toISOString(),

          last_http_status:
            statusResponse.status,

          last_message:
            `Отчёт ещё не готов. Статус: ${String(reportStatus)}`,
        });

        return NextResponse.json({
          ok: true,

          stage:
            "report_created",

          taskId,

          reportStatus,

          message:
            "Отчёт Wildberries ещё формируется",

          rateLimit,

          wildberriesRequestSent:
            true,
        });
      }


      stage =
        "report_ready";


      await updateState({
        stage,

        external_task_id:
          taskId,

        next_allowed_at:
          null,

        last_http_status:
          statusResponse.status,

        retry_after_seconds:
          null,

        last_message:
          "Отчёт остатков WB готов к скачиванию",
      });
    }


    // ========================================================
    // 6. СКАЧИВАЕМ ГОТОВЫЙ ОТЧЁТ
    // ========================================================

    const downloadUrl =
      `https://seller-analytics-api.wildberries.ru` +
      `/api/v1/warehouse_remains/tasks/${taskId}/download`;

    const downloadResponse =
      await fetch(
        downloadUrl,
        {
          method: "GET",

          headers: {
            Authorization:
              wbToken,

            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );

    const rateLimit =
      getRateLimit(
        downloadResponse
      );


    // ========================================================
    // 7. 429 ПРИ СКАЧИВАНИИ
    // ========================================================

    if (
      downloadResponse.status ===
      429
    ) {
      const lock =
        await saveRateLimit(
          downloadResponse,
          "report_ready",
          taskId
        );

      return NextResponse.json(
        {
          ok: false,

          stage:
            "report_ready",

          message:
            "WB ограничил скачивание готового отчёта",

          taskId,

          wbStatus:
            429,

          rateLimit,

          nextAllowedAt:
            lock.nextAllowedAt,

          wildberriesRequestSent:
            true,
        },
        { status: 429 }
      );
    }


    // ========================================================
    // 8. ПУСТОЙ ОТЧЁТ
    // ========================================================

    if (
      downloadResponse.status ===
      204
    ) {
      const completedAt =
        new Date().toISOString();

      await updateState({
        stage:
          "completed",

        external_task_id:
          null,

        last_snapshot_id:
          null,

        last_success_at:
          completedAt,

        last_attempt_at:
          completedAt,

        next_allowed_at:
          null,

        last_http_status:
          204,

        retry_after_seconds:
          null,

        last_message:
          "Отчёт остатков WB пуст",
      });

      return NextResponse.json({
        ok: true,

        stage:
          "completed",

        message:
          "WB вернул пустой отчёт остатков",

        taskId,

        itemsCount:
          0,

        rowsSaved:
          0,

        wildberriesRequestSent:
          true,
      });
    }


    const downloadText =
      await downloadResponse.text();

    const reportData =
      parseJson(
        downloadText
      );


    if (!downloadResponse.ok) {
      await updateState({
        stage:
          "report_ready",

        external_task_id:
          taskId,

        last_attempt_at:
          new Date().toISOString(),

        last_http_status:
          downloadResponse.status,

        last_message:
          `Ошибка скачивания отчёта WB HTTP ${downloadResponse.status}`,
      });

      return NextResponse.json(
        {
          ok: false,

          message:
            "Ошибка скачивания отчёта остатков WB",

          taskId,

          wbStatus:
            downloadResponse.status,

          rateLimit,

          wbResponse:
            reportData,
        },
        {
          status:
            downloadResponse.status,
        }
      );
    }


    if (
      !Array.isArray(
        reportData
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "WB вернул неожиданный формат отчёта остатков",

          taskId,

          wbResponse:
            reportData,
        },
        { status: 500 }
      );
    }


    // ========================================================
    // 9. РАЗВОРАЧИВАЕМ SKU × СКЛАД
    // ========================================================

    const capturedAt =
      new Date().toISOString();

    /*
      taskId уже является UUID.

      Используем его же как snapshot_id.

      Это специально:
      если сохранение оборвётся и мы повторим скачивание,
      мы не создадим второй отдельный снимок.
    */
    const snapshotId =
      taskId;


    const stockRows: any[] =
      [];


    for (
      const item of reportData
    ) {
      const nmId =
        Number(
          item?.nmId
        );

      if (
        !Number.isFinite(
          nmId
        )
      ) {
        continue;
      }


      const warehouses =
        Array.isArray(
          item?.warehouses
        )
          ? item.warehouses
          : [];


      for (
        const warehouse of warehouses
      ) {
        const warehouseName =
          typeof warehouse
            ?.warehouseName ===
            "string"
            ? warehouse
                .warehouseName
            : "";


        if (!warehouseName) {
          continue;
        }


        const quantity =
          Number(
            warehouse?.quantity ??
              0
          );


        stockRows.push({
          snapshot_id:
            snapshotId,

          task_id:
            taskId,

          captured_at:
            capturedAt,

          nm_id:
            nmId,

          vendor_code:
            item?.vendorCode ??
            null,

          barcode:
            item?.barcode ??
            null,

          tech_size:
            item?.techSize ??
            null,

          volume:
            typeof item?.volume ===
            "number"
              ? item.volume
              : null,

          warehouse_name:
            warehouseName,

          quantity:
            Number.isFinite(
              quantity
            )
              ? Math.trunc(
                  quantity
                )
              : 0,

          warehouse_type:
            classifyWarehouse(
              warehouseName
            ),
        });
      }
    }


    // ========================================================
    // 10. УДАЛЯЕМ ВОЗМОЖНЫЙ НЕПОЛНЫЙ СНИМОК
    // ========================================================

    const deleteResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_stock_snapshots?snapshot_id=eq.${snapshotId}`,
        {
          method: "DELETE",

          headers: {
            apikey:
              supabaseKey,

            Authorization:
              `Bearer ${supabaseKey}`,

            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );


    if (!deleteResponse.ok) {
      const text =
        await deleteResponse.text();

      return NextResponse.json(
        {
          ok: false,

          message:
            "Не удалось подготовить Supabase для сохранения снимка",

          snapshotId,

          supabaseStatus:
            deleteResponse.status,

          supabaseResponse:
            parseJson(text),
        },
        { status: 500 }
      );
    }


    // ========================================================
    // 11. СОХРАНЯЕМ СНИМОК ПАЧКАМИ
    // ========================================================

    const batches =
      splitIntoBatches(
        stockRows,
        SUPABASE_BATCH_SIZE
      );

    let savedRows =
      0;


    for (
      let i = 0;
      i < batches.length;
      i++
    ) {
      const batch =
        batches[i];

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/wb_stock_snapshots`,
          {
            method: "POST",

            headers: {
              apikey:
                supabaseKey,

              Authorization:
                `Bearer ${supabaseKey}`,

              Accept:
                "application/json",

              "Content-Type":
                "application/json",

              Prefer:
                "return=minimal",
            },

            body:
              JSON.stringify(
                batch
              ),

            cache:
              "no-store",
          }
        );


      if (!response.ok) {
        const text =
          await response.text();

        await updateState({
          stage:
            "report_ready",

          external_task_id:
            taskId,

          last_http_status:
            downloadResponse.status,

          last_message:
            "Отчёт скачан, но произошла ошибка записи снимка в Supabase",
        });

        return NextResponse.json(
          {
            ok: false,

            message:
              "Ошибка записи остатков в Supabase",

            snapshotId,

            failedBatch:
              i + 1,

            batchesCount:
              batches.length,

            savedBeforeFailure:
              savedRows,

            supabaseStatus:
              response.status,

            supabaseResponse:
              parseJson(text),
          },
          { status: 500 }
        );
      }


      savedRows +=
        batch.length;
    }


    // ========================================================
    // 12. КОНТРОЛЬНАЯ СТАТИСТИКА
    // ========================================================

    const physicalRows =
      stockRows.filter(
        (row) =>
          row.warehouse_type ===
          "physical"
      ).length;

    const totalRows =
      stockRows.filter(
        (row) =>
          row.warehouse_type ===
          "total"
      ).length;

    const aggregateRows =
      stockRows.filter(
        (row) =>
          row.warehouse_type ===
          "wbRussiaAggregate"
      ).length;

    const toClientRows =
      stockRows.filter(
        (row) =>
          row.warehouse_type ===
          "toClient"
      ).length;

    const returningRows =
      stockRows.filter(
        (row) =>
          row.warehouse_type ===
          "returning"
      ).length;


    // ========================================================
    // 13. ФИКСИРУЕМ УСПЕХ
    // ========================================================

    await updateState({
      stage:
        "completed",

      external_task_id:
        null,

      last_snapshot_id:
        snapshotId,

      last_success_at:
        capturedAt,

      last_attempt_at:
        capturedAt,

      next_allowed_at:
        null,

      last_http_status:
        downloadResponse.status,

      retry_after_seconds:
        null,

      last_message:
        "Остатки WB успешно сохранены в Supabase",
    });


    // ========================================================
    // 14. ОТВЕТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      stage:
        "completed",

      message:
        "Остатки Wildberries успешно сохранены в Supabase",

      taskId,

      snapshotId,

      capturedAt,

      wildberries: {
        status:
          downloadResponse.status,

        itemsReceived:
          reportData.length,

        rateLimit,
      },

      saved: {
        rows:
          savedRows,

        batches:
          batches.length,
      },

      stockTypes: {
        physical:
          physicalRows,

        total:
          totalRows,

        wbRussiaAggregate:
          aggregateRows,

        toClient:
          toClientRows,

        returning:
          returningRows,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка синхронизации остатков Wildberries",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
