import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// НАСТРОЙКИ
// ============================================================

const DAYS_TO_LOAD = 28;
const REPEAT_GUARD_HOURS = 3;
const SUPABASE_BATCH_SIZE = 1000;
const SYNC_KEY = "orders";

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Statistics API Wildberries отдаёт даты вида:
 *
 * 2026-10-05T07:42:48
 *
 * без явного часового пояса.
 *
 * Для этих методов время WB трактуем как московское UTC+3.
 *
 * В Supabase сохраняем уже нормальный UTC ISO:
 *
 * 2026-10-05T07:42:48 Москва
 * ->
 * 2026-10-05T04:42:48.000Z
 *
 * Если WB когда-нибудь начнёт присылать явный Z или offset,
 * второй раз часовой пояс не добавляем.
 */
function normalizeWbDate(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  if (
    trimmed.startsWith(
      "0001-01-01"
    )
  ) {
    return null;
  }

  const hasExplicitTimezone =
    /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(
      trimmed
    );

  const valueWithTimezone =
    hasExplicitTimezone
      ? trimmed
      : `${trimmed}+03:00`;

  const date =
    new Date(
      valueWithTimezone
    );

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function normalizeCancelDate(
  value: unknown
): string | null {
  return normalizeWbDate(value);
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
      items.slice(
        i,
        i + size
      )
    );
  }

  return batches;
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
  // СОХРАНЕНИЕ СОСТОЯНИЯ СИНХРОНИЗАЦИИ
  // ==========================================================

  async function saveSyncState(data: {
    lastAttemptAt?: string | null;
    lastSuccessAt?: string | null;
    nextAllowedAt?: string | null;
    lastHttpStatus?: number | null;
    retryAfterSeconds?: number | null;
    lastMessage?: string | null;
  }) {
    const body = {
      sync_key:
        SYNC_KEY,

      last_attempt_at:
        data.lastAttemptAt ??
        null,

      last_success_at:
        data.lastSuccessAt ??
        null,

      next_allowed_at:
        data.nextAllowedAt ??
        null,

      last_http_status:
        data.lastHttpStatus ??
        null,

      retry_after_seconds:
        data.retryAfterSeconds ??
        null,

      last_message:
        data.lastMessage ??
        null,

      updated_at:
        new Date().toISOString(),
    };

    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_sync_state?on_conflict=sync_key`,
        {
          method:
            "POST",

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
            JSON.stringify(
              body
            ),

          cache:
            "no-store",
        }
      );

    if (!response.ok) {
      const text =
        await response.text();

      throw new Error(
        `Не удалось сохранить wb_sync_state: ${text}`
      );
    }
  }

  try {
    // ========================================================
    // 1. ЧИТАЕМ СОСТОЯНИЕ
    // ========================================================

    const stateUrl =
      `${supabaseUrl}/rest/v1/wb_sync_state` +
      `?sync_key=eq.${SYNC_KEY}` +
      `&select=*` +
      `&limit=1`;

    const stateResponse =
      await fetch(
        stateUrl,
        {
          method:
            "GET",

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

    if (!stateResponse.ok) {
      const text =
        await stateResponse.text();

      return NextResponse.json(
        {
          ok: false,

          message:
            "Не удалось прочитать состояние синхронизации WB",

          supabaseStatus:
            stateResponse.status,

          supabaseResponse:
            parseJson(text),
        },
        { status: 500 }
      );
    }

    const stateRows: any[] =
      await stateResponse.json();

    const state =
      stateRows[0] ??
      null;

    // ========================================================
    // 2. БЛОКИРОВКА ПО 429
    // ========================================================

    if (
      state?.next_allowed_at
    ) {
      const nextAllowed =
        new Date(
          state.next_allowed_at
        );

      const now =
        new Date();

      if (
        Number.isFinite(
          nextAllowed.getTime()
        ) &&
        nextAllowed.getTime() >
          now.getTime()
      ) {
        const secondsRemaining =
          Math.ceil(
            (
              nextAllowed.getTime() -
              now.getTime()
            ) / 1000
          );

        return NextResponse.json({
          ok: true,

          skipped: true,

          blockedByRateLimit:
            true,

          message:
            "Запрос к Wildberries не выполнен: лимит ещё не восстановился",

          lastHttpStatus:
            state.last_http_status,

          retryAfterSecondsOriginally:
            state.retry_after_seconds,

          secondsRemaining,

          nextAllowedAt:
            state.next_allowed_at,

          lastAttemptAt:
            state.last_attempt_at,

          wildberriesRequestSent:
            false,
        });
      }
    }

    // ========================================================
    // 3. ЗАЩИТА ПО УСПЕШНОЙ СИНХРОНИЗАЦИИ
    // ========================================================

    const latestSyncUrl =
      `${supabaseUrl}/rest/v1/wb_orders` +
      "?select=synced_at" +
      "&order=synced_at.desc" +
      "&limit=1";

    const latestSyncResponse =
      await fetch(
        latestSyncUrl,
        {
          method:
            "GET",

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

    if (!latestSyncResponse.ok) {
      const text =
        await latestSyncResponse.text();

      return NextResponse.json(
        {
          ok: false,

          message:
            "Не удалось проверить последнюю успешную синхронизацию",

          supabaseStatus:
            latestSyncResponse.status,

          supabaseResponse:
            parseJson(text),
        },
        { status: 500 }
      );
    }

    const latestRows: any[] =
      await latestSyncResponse.json();

    if (
      latestRows.length > 0 &&
      latestRows[0]?.synced_at
    ) {
      const latestSyncTime =
        new Date(
          latestRows[0]
            .synced_at
        ).getTime();

      const hoursSinceLastSync =
        (
          Date.now() -
          latestSyncTime
        ) /
        (
          1000 *
          60 *
          60
        );

      if (
        Number.isFinite(
          hoursSinceLastSync
        ) &&
        hoursSinceLastSync <
          REPEAT_GUARD_HOURS
      ) {
        return NextResponse.json({
          ok: true,

          skipped: true,

          blockedByRateLimit:
            false,

          message:
            "Запрос к WB не выполнен: недавняя успешная синхронизация уже есть",

          latestSyncedAt:
            latestRows[0]
              .synced_at,

          hoursSinceLastSync:
            Number(
              hoursSinceLastSync.toFixed(
                2
              )
            ),

          repeatGuardHours:
            REPEAT_GUARD_HOURS,

          wildberriesRequestSent:
            false,
        });
      }
    }

    // ========================================================
    // 4. ФИКСИРУЕМ ПОПЫТКУ
    // ========================================================

    const attemptAt =
      new Date().toISOString();

    await saveSyncState({
      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        state?.last_success_at ??
        null,

      nextAllowedAt:
        null,

      lastHttpStatus:
        null,

      retryAfterSeconds:
        null,

      lastMessage:
        "Начало синхронизации заказов WB",
    });

    // ========================================================
    // 5. ДАТА НАЧАЛА ЗАПРОСА
    //
    // ВАЖНО:
    // flag=0 позволяет WB вернуть в том числе старые заказы,
    // если их lastChangeDate попал в этот период.
    //
    // Поэтому этот dateFrom используется для синхронизации,
    // а не как окончательный фильтр продаж.
    // ========================================================

    const dateFrom =
      new Date(
        Date.now() -
          DAYS_TO_LOAD *
            24 *
            60 *
            60 *
            1000
      ).toISOString();

    // ========================================================
    // 6. ЗАПРОС К WB
    // ========================================================

    const wbUrl =
      new URL(
        "https://statistics-api.wildberries.ru/api/v1/supplier/orders"
      );

    wbUrl.searchParams.set(
      "dateFrom",
      dateFrom
    );

    wbUrl.searchParams.set(
      "flag",
      "0"
    );

    const wbResponse =
      await fetch(
        wbUrl.toString(),
        {
          method:
            "GET",

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

    const wbText =
      await wbResponse.text();

    const wbData: any =
      parseJson(
        wbText
      );

    const retryHeader =
      wbResponse.headers.get(
        "x-ratelimit-retry"
      );

    const resetHeader =
      wbResponse.headers.get(
        "x-ratelimit-reset"
      );

    const rateLimit = {
      retryAfterSeconds:
        retryHeader,

      resetAfterSeconds:
        resetHeader,

      limit:
        wbResponse.headers.get(
          "x-ratelimit-limit"
        ),

      remaining:
        wbResponse.headers.get(
          "x-ratelimit-remaining"
        ),
    };

    // ========================================================
    // 7. 429
    // ========================================================

    if (
      wbResponse.status ===
      429
    ) {
      const retrySecondsRaw =
        retryHeader ??
        resetHeader;

      const retrySeconds =
        retrySecondsRaw
          ? Number(
              retrySecondsRaw
            )
          : null;

      let nextAllowedAt:
        string | null =
        null;

      if (
        retrySeconds !== null &&
        Number.isFinite(
          retrySeconds
        ) &&
        retrySeconds > 0
      ) {
        nextAllowedAt =
          new Date(
            Date.now() +
              retrySeconds *
                1000
          ).toISOString();
      }

      await saveSyncState({
        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at ??
          null,

        nextAllowedAt,

        lastHttpStatus:
          429,

        retryAfterSeconds:
          retrySeconds,

        lastMessage:
          "Too Many Requests от Wildberries",
      });

      return NextResponse.json(
        {
          ok: false,

          message:
            "Wildberries ограничил запрос. Время следующей попытки сохранено в Supabase.",

          wbStatus:
            429,

          dateFrom,

          rateLimit,

          nextAllowedAt,

          wildberriesRequestSent:
            true,

          wbResponse:
            wbData,
        },
        { status: 429 }
      );
    }

    // ========================================================
    // 8. ДРУГАЯ ОШИБКА WB
    // ========================================================

    if (
      !wbResponse.ok
    ) {
      await saveSyncState({
        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at ??
          null,

        nextAllowedAt:
          null,

        lastHttpStatus:
          wbResponse.status,

        retryAfterSeconds:
          null,

        lastMessage:
          `Ошибка WB HTTP ${wbResponse.status}`,
      });

      return NextResponse.json(
        {
          ok: false,

          message:
            "Wildberries вернул ошибку при загрузке заказов",

          wbStatus:
            wbResponse.status,

          dateFrom,

          rateLimit,

          wildberriesRequestSent:
            true,

          wbResponse:
            wbData,
        },
        {
          status:
            wbResponse.status,
        }
      );
    }

    // ========================================================
    // 9. ПРОВЕРЯЕМ ФОРМАТ
    // ========================================================

    if (
      !Array.isArray(
        wbData
      )
    ) {
      await saveSyncState({
        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at ??
          null,

        nextAllowedAt:
          null,

        lastHttpStatus:
          wbResponse.status,

        retryAfterSeconds:
          null,

        lastMessage:
          "WB вернул неожиданный формат заказов",
      });

      return NextResponse.json(
        {
          ok: false,

          message:
            "WB вернул неожиданный формат заказов",

          dateFrom,

          wbResponse:
            wbData,
        },
        { status: 500 }
      );
    }

    // ========================================================
    // 10. ПОДГОТОВКА ДАННЫХ
    //
    // Здесь исправляем главный найденный баг:
    // даты WB без timezone считаем московскими UTC+3
    // и только после этого сохраняем в timestamptz.
    // ========================================================

    const syncedAt =
      new Date().toISOString();

    const validSridOrders =
      wbData.filter(
        (order: any) =>
          typeof order?.srid ===
            "string" &&
          order.srid.trim() !==
            ""
      );

    const rows =
      validSridOrders
        .map(
          (order: any) => {
            const orderDate =
              normalizeWbDate(
                order.date
              );

            if (!orderDate) {
              return null;
            }

            return {
              srid:
                order.srid,

              order_date:
                orderDate,

              last_change_date:
                normalizeWbDate(
                  order.lastChangeDate
                ),

              nm_id:
                Number(
                  order.nmId
                ),

              supplier_article:
                order.supplierArticle ??
                null,

              barcode:
                order.barcode ??
                null,

              warehouse_name:
                order.warehouseName ??
                null,

              warehouse_type:
                order.warehouseType ??
                null,

              is_cancel:
                order.isCancel ===
                true,

              cancel_date:
                normalizeCancelDate(
                  order.cancelDate
                ),

              income_id:
                typeof order.incomeID ===
                  "number"
                  ? order.incomeID
                  : null,

              // Исходную запись WB обязательно сохраняем.
              // Это позволяет позже перепроверять парсинг.
              raw:
                order,

              synced_at:
                syncedAt,
            };
          }
        )
        .filter(
          (
            row
          ): row is NonNullable<
            typeof row
          > =>
            row !== null
        );

    const skippedWithoutSrid =
      wbData.length -
      validSridOrders.length;

    const skippedInvalidOrderDate =
      validSridOrders.length -
      rows.length;

    // ========================================================
    // 11. УБИРАЕМ ДУБЛИКАТЫ ПО srid
    // ========================================================

    const uniqueBySrid =
      new Map<
        string,
        any
      >();

    for (
      const row of rows
    ) {
      uniqueBySrid.set(
        row.srid,
        row
      );
    }

    const uniqueRows =
      Array.from(
        uniqueBySrid.values()
      );

    const duplicatesInsideResponse =
      rows.length -
      uniqueRows.length;

    // ========================================================
    // 12. ЗАПИСЬ В SUPABASE
    // ========================================================

    const batches =
      splitIntoBatches(
        uniqueRows,
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

      const upsertUrl =
        `${supabaseUrl}` +
        `/rest/v1/wb_orders` +
        `?on_conflict=srid`;

      const upsertResponse =
        await fetch(
          upsertUrl,
          {
            method:
              "POST",

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
              JSON.stringify(
                batch
              ),

            cache:
              "no-store",
          }
        );

      if (
        !upsertResponse.ok
      ) {
        const text =
          await upsertResponse.text();

        await saveSyncState({
          lastAttemptAt:
            attemptAt,

          lastSuccessAt:
            state?.last_success_at ??
            null,

          nextAllowedAt:
            null,

          lastHttpStatus:
            wbResponse.status,

          retryAfterSeconds:
            null,

          lastMessage:
            "WB ответил успешно, но произошла ошибка записи в Supabase",
        });

        return NextResponse.json(
          {
            ok: false,

            message:
              "Ошибка записи заказов в Supabase",

            failedBatch:
              i + 1,

            batchesCount:
              batches.length,

            savedBeforeFailure:
              savedRows,

            supabaseStatus:
              upsertResponse.status,

            supabaseResponse:
              parseJson(
                text
              ),

            wbOrdersReceived:
              wbData.length,

            rateLimit,
          },
          { status: 500 }
        );
      }

      savedRows +=
        batch.length;
    }

    // ========================================================
    // 13. СТАТИСТИКА ВСЕГО ОТВЕТА WB
    //
    // Эта статистика НЕ является продажами ровно за 28 дней,
    // потому что flag=0 ориентируется на lastChangeDate.
    // ========================================================

    const allFbwOrders =
      uniqueRows.filter(
        (row: any) =>
          row.warehouse_type ===
          "Склад WB"
      );

    const allSellerOrders =
      uniqueRows.filter(
        (row: any) =>
          row.warehouse_type ===
          "Склад продавца"
      );

    const allCancelledOrders =
      uniqueRows.filter(
        (row: any) =>
          row.is_cancel ===
          true
      );

    const allActiveFbwOrders =
      uniqueRows.filter(
        (row: any) =>
          row.warehouse_type ===
            "Склад WB" &&
          row.is_cancel ===
            false
      );

    // ========================================================
    // 14. СТАТИСТИКА ИМЕННО ДЛЯ РАСЧЁТНЫХ 28 ДНЕЙ
    //
    // Фильтруем уже по order_date.
    // Это логика, которая соответствует расчёту Ozon.
    // ========================================================

    const periodEnd =
      new Date(
        attemptAt
      );

    const periodStart =
      new Date(
        periodEnd.getTime() -
          DAYS_TO_LOAD *
            24 *
            60 *
            60 *
            1000
      );

    const calculationRows =
      uniqueRows.filter(
        (row: any) => {
          const orderTime =
            new Date(
              row.order_date
            ).getTime();

          return (
            Number.isFinite(
              orderTime
            ) &&
            orderTime >=
              periodStart.getTime() &&
            orderTime <=
              periodEnd.getTime()
          );
        }
      );

    const calculationFbwOrders =
      calculationRows.filter(
        (row: any) =>
          row.warehouse_type ===
          "Склад WB"
      );

    const calculationActiveFbwOrders =
      calculationFbwOrders.filter(
        (row: any) =>
          row.is_cancel ===
          false
      );

    const calculationCancelledFbwOrders =
      calculationFbwOrders.filter(
        (row: any) =>
          row.is_cancel ===
          true
      );

    const calculationSellerOrders =
      calculationRows.filter(
        (row: any) =>
          row.warehouse_type ===
          "Склад продавца"
      );

    const calculationSku =
      new Set<number>();

    for (
      const row of
      calculationActiveFbwOrders
    ) {
      const nmId =
        Number(
          row.nm_id
        );

      if (
        Number.isFinite(
          nmId
        )
      ) {
        calculationSku.add(
          nmId
        );
      }
    }

    // ========================================================
    // 15. УСПЕШНОЕ СОСТОЯНИЕ
    // ========================================================

    await saveSyncState({
      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        syncedAt,

      nextAllowedAt:
        null,

      lastHttpStatus:
        wbResponse.status,

      retryAfterSeconds:
        null,

      lastMessage:
        "Заказы WB успешно синхронизированы",
    });

    // ========================================================
    // 16. ОТВЕТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "Заказы Wildberries успешно сохранены в Supabase",

      period: {
        daysRequested:
          DAYS_TO_LOAD,

        dateFrom,

        calculationStart:
          periodStart.toISOString(),

        calculationEnd:
          periodEnd.toISOString(),

        note:
          "dateFrom используется для синхронизации по изменениям WB; расчётные 28 дней дополнительно фильтруются по order_date",
      },

      wildberries: {
        status:
          wbResponse.status,

        received:
          wbData.length,

        rateLimit,
      },

      processing: {
        validSridRows:
          validSridOrders.length,

        validRows:
          rows.length,

        uniqueRows:
          uniqueRows.length,

        skippedWithoutSrid,

        skippedInvalidOrderDate,

        duplicatesInsideResponse,

        batches:
          batches.length,
      },

      saved: {
        rows:
          savedRows,

        syncedAt,
      },

      responseStatistics: {
        note:
          "Статистика всего ответа WB. Может включать старые заказы с недавним lastChangeDate.",

        fbwOrders:
          allFbwOrders.length,

        sellerWarehouseOrders:
          allSellerOrders.length,

        cancelledOrders:
          allCancelledOrders.length,

        activeFbwOrders:
          allActiveFbwOrders.length,
      },

      calculationStatistics28Days: {
        note:
          "Эти показатели уже отфильтрованы по order_date и подходят для расчёта средних продаж.",

        allOrders:
          calculationRows.length,

        fbwOrders:
          calculationFbwOrders.length,

        activeFbwOrders:
          calculationActiveFbwOrders.length,

        cancelledFbwOrders:
          calculationCancelledFbwOrders.length,

        sellerWarehouseOrders:
          calculationSellerOrders.length,

        activeFbwSkuCount:
          calculationSku.size,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка синхронизации заказов Wildberries",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
