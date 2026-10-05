import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// НАСТРОЙКИ
// ============================================================

const DAYS_TO_LOAD = 28;

// Защита от случайного повторного запуска.
// Если в БД есть запись, синхронизированная менее 3 часов назад,
// новый запрос к WB не делаем.
const REPEAT_GUARD_HOURS = 3;

// Сколько строк одним запросом отправляем в Supabase.
const SUPABASE_BATCH_SIZE = 1000;


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

function normalizeCancelDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }

  if (value.startsWith("0001-01-01")) {
    return null;
  }

  return value;
}

function splitIntoBatches<T>(
  items: T[],
  size: number
): T[][] {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }

  return batches;
}


// ============================================================
// ОСНОВНОЙ МАРШРУТ
// ============================================================

export async function GET() {
  const wbToken = process.env.WB_READ_TOKEN;

  const supabaseUrlRaw =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKeyRaw =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  // ==========================================================
  // ПРОВЕРЯЕМ ПЕРЕМЕННЫЕ
  // ==========================================================

  if (!wbToken) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не найден WB_READ_TOKEN в Vercel",
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

  const supabaseUrl: string = supabaseUrlRaw;
  const supabaseKey: string = supabaseKeyRaw;


  try {
    // ========================================================
    // 1. ЗАЩИТА ОТ СЛУЧАЙНОГО ПОВТОРНОГО ЗАПУСКА
    // ========================================================

    const latestSyncUrl =
      `${supabaseUrl}/rest/v1/wb_orders` +
      "?select=synced_at" +
      "&order=synced_at.desc" +
      "&limit=1";

    const latestSyncResponse = await fetch(
      latestSyncUrl,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!latestSyncResponse.ok) {
      const text = await latestSyncResponse.text();

      return NextResponse.json(
        {
          ok: false,
          message:
            "Не удалось проверить последнюю синхронизацию в Supabase",
          supabaseStatus:
            latestSyncResponse.status,
          supabaseResponse:
            parseJson(text),
        },
        { status: 500 }
      );
    }

    const latestRows =
      await latestSyncResponse.json();

    if (
      Array.isArray(latestRows) &&
      latestRows.length > 0 &&
      latestRows[0]?.synced_at
    ) {
      const latestSyncTime = new Date(
        latestRows[0].synced_at
      ).getTime();

      const hoursSinceLastSync =
        (Date.now() - latestSyncTime) /
        (1000 * 60 * 60);

      if (
        Number.isFinite(hoursSinceLastSync) &&
        hoursSinceLastSync <
          REPEAT_GUARD_HOURS
      ) {
        return NextResponse.json({
          ok: true,
          skipped: true,

          message:
            "Запрос к WB не выполнен: недавняя синхронизация уже есть",

          latestSyncedAt:
            latestRows[0].synced_at,

          hoursSinceLastSync:
            Number(
              hoursSinceLastSync.toFixed(2)
            ),

          repeatGuardHours:
            REPEAT_GUARD_HOURS,
        });
      }
    }


    // ========================================================
    // 2. ДАТА НАЧАЛА
    // ========================================================

    const dateFrom = new Date(
      Date.now() -
        DAYS_TO_LOAD *
          24 *
          60 *
          60 *
          1000
    ).toISOString();


    // ========================================================
    // 3. ОДИН ЗАПРОС К WILDBERRIES
    // ========================================================

    const wbUrl = new URL(
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

    const wbResponse = await fetch(
      wbUrl.toString(),
      {
        method: "GET",

        headers: {
          Authorization: wbToken,
          Accept: "application/json",
        },

        cache: "no-store",
      }
    );

    const wbText =
      await wbResponse.text();

    const wbData: any =
      parseJson(wbText);

    const rateLimit = {
      retryAfterSeconds:
        wbResponse.headers.get(
          "x-ratelimit-retry"
        ),

      resetAfterSeconds:
        wbResponse.headers.get(
          "x-ratelimit-reset"
        ),

      limit:
        wbResponse.headers.get(
          "x-ratelimit-limit"
        ),

      remaining:
        wbResponse.headers.get(
          "x-ratelimit-remaining"
        ),
    };

    if (!wbResponse.ok) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Wildberries вернул ошибку при загрузке заказов",

          wbStatus:
            wbResponse.status,

          dateFrom,

          rateLimit,

          wbResponse:
            wbData,
        },
        {
          status: wbResponse.status,
        }
      );
    }

    if (!Array.isArray(wbData)) {
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
    // 4. ПОДГОТОВКА ЗАПИСЕЙ
    // ========================================================

    const syncedAt =
      new Date().toISOString();

    const rows = wbData
      .filter(
        (order: any) =>
          typeof order?.srid ===
            "string" &&
          order.srid.trim() !== ""
      )
      .map((order: any) => ({
        srid: order.srid,

        order_date:
          order.date,

        last_change_date:
          order.lastChangeDate ??
          null,

        nm_id:
          Number(order.nmId),

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
          order.isCancel === true,

        cancel_date:
          normalizeCancelDate(
            order.cancelDate
          ),

        income_id:
          typeof order.incomeID ===
          "number"
            ? order.incomeID
            : null,

        raw:
          order,

        synced_at:
          syncedAt,
      }));


    // ========================================================
    // 5. УБИРАЕМ ДУБЛИКАТЫ SRID ВНУТРИ ОТВЕТА
    // ========================================================

    const uniqueBySrid =
      new Map<string, any>();

    for (const row of rows) {
      uniqueBySrid.set(
        row.srid,
        row
      );
    }

    const uniqueRows =
      Array.from(
        uniqueBySrid.values()
      );

    const skippedWithoutSrid =
      wbData.length -
      rows.length;

    const duplicatesInsideResponse =
      rows.length -
      uniqueRows.length;


    // ========================================================
    // 6. ЗАПИСЫВАЕМ В SUPABASE ЧАСТЯМИ
    // ========================================================

    const batches =
      splitIntoBatches(
        uniqueRows,
        SUPABASE_BATCH_SIZE
      );

    let savedRows = 0;

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
              JSON.stringify(
                batch
              ),

            cache:
              "no-store",
          }
        );

      if (!upsertResponse.ok) {
        const text =
          await upsertResponse.text();

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
              parseJson(text),

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
    // 7. КОНТРОЛЬНЫЕ ЦИФРЫ
    // ========================================================

    const fbwOrders =
      uniqueRows.filter(
        (row: any) =>
          row.warehouse_type ===
          "Склад WB"
      );

    const sellerOrders =
      uniqueRows.filter(
        (row: any) =>
          row.warehouse_type ===
          "Склад продавца"
      );

    const cancelledOrders =
      uniqueRows.filter(
        (row: any) =>
          row.is_cancel === true
      );

    const activeFbwOrders =
      uniqueRows.filter(
        (row: any) =>
          row.warehouse_type ===
            "Склад WB" &&
          row.is_cancel === false
      );


    // ========================================================
    // 8. РЕЗУЛЬТАТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "Заказы Wildberries успешно сохранены в Supabase",

      period: {
        daysRequested:
          DAYS_TO_LOAD,

        dateFrom,
      },

      wildberries: {
        status:
          wbResponse.status,

        received:
          wbData.length,

        rateLimit,
      },

      processing: {
        validRows:
          rows.length,

        uniqueRows:
          uniqueRows.length,

        skippedWithoutSrid,

        duplicatesInsideResponse,

        batches:
          batches.length,
      },

      saved: {
        rows:
          savedRows,

        syncedAt,
      },

      statistics: {
        fbwOrders:
          fbwOrders.length,

        sellerWarehouseOrders:
          sellerOrders.length,

        cancelledOrders:
          cancelledOrders.length,

        activeFbwOrders:
          activeFbwOrders.length,
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
