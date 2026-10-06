import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const WB_URL =
  "https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/products";

const SYNC_KEY =
  "stocks";

const PAGE_LIMIT =
  1000;

const REPEAT_GUARD_HOURS =
  1;

const SUPABASE_BATCH_SIZE =
  1000;


// ============================================================
// ТИПЫ
// ============================================================

type WBMetrics = {
  stockCount?: number | null;

  toClientCount?: number | null;

  fromClientCount?: number | null;

  availability?: string | null;
};


type WBProduct = {
  nmID?: number | null;

  isDeleted?: boolean | null;

  subjectName?: string | null;

  name?: string | null;

  vendorCode?: string | null;

  brandName?: string | null;

  mainPhoto?: string | null;

  hasSizes?: boolean | null;

  metrics?: WBMetrics | null;
};


type WBResponse = {
  data?: {
    items?: WBProduct[];
    currency?: string | null;
  };
};


type SyncState = {
  sync_key?: string;

  last_attempt_at?: string | null;

  last_success_at?: string | null;

  next_allowed_at?: string | null;

  last_http_status?: number | null;

  retry_after_seconds?: number | null;

  last_message?: string | null;
};


// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function parseJson(
  text: string
): unknown {

  try {

    return JSON.parse(
      text
    );

  } catch {

    return text;

  }

}


// ============================================================
// MOSCOW DATE
// ============================================================

function getMoscowDate():
  string {

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Europe/Moscow",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    );


  const parts =
    formatter.formatToParts(
      new Date()
    );


  const year =
    parts.find(
      (part) =>
        part.type ===
        "year"
    )?.value;


  const month =
    parts.find(
      (part) =>
        part.type ===
        "month"
    )?.value;


  const day =
    parts.find(
      (part) =>
        part.type ===
        "day"
    )?.value;


  if (
    !year ||
    !month ||
    !day
  ) {

    throw new Error(
      "Не удалось определить текущую дату Москвы"
    );

  }


  return (
    `${year}-${month}-${day}`
  );

}


// ============================================================
// ПАУЗА
// ============================================================

function sleep(
  ms: number
) {

  return new Promise<void>(
    (resolve) => {

      setTimeout(
        resolve,
        ms
      );

    }
  );

}


// ============================================================
// BATCH
// ============================================================

function splitIntoBatches<T>(
  items: T[],
  size: number
): T[][] {

  const batches:
    T[][] =
    [];


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
// ОСНОВНОЙ ROUTE
// ============================================================

export async function GET() {

  // ==========================================================
  // 1. ENV
  // ==========================================================

  const wbTokenRaw =
    process.env
      .WB_READ_TOKEN;


  const supabaseUrlRaw =
    process.env
      .SUPABASE_URL
    ??
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseKeyRaw =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env
      .SUPABASE_SECRET_KEY;


  if (!wbTokenRaw) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найден WB_READ_TOKEN в Vercel",
      },
      {
        status:
          500,
      }
    );

  }


  if (!supabaseUrlRaw) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL",
      },
      {
        status:
          500,
      }
    );

  }


  if (!supabaseKeyRaw) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY",
      },
      {
        status:
          500,
      }
    );

  }


  const wbToken:
    string =
    wbTokenRaw;


  const supabaseUrl:
    string =
    supabaseUrlRaw;


  const supabaseKey:
    string =
    supabaseKeyRaw;


  // ==========================================================
  // SUPABASE HEADERS
  // ==========================================================

  const supabaseHeaders = {

    apikey:
      supabaseKey,

    Authorization:
      `Bearer ${supabaseKey}`,

    Accept:
      "application/json",

    "Content-Type":
      "application/json",

  };


  // ==========================================================
  // SAVE SYNC STATE
  // ==========================================================

  async function saveSyncState(
    data: {
      lastAttemptAt?:
        string | null;

      lastSuccessAt?:
        string | null;

      nextAllowedAt?:
        string | null;

      lastHttpStatus?:
        number | null;

      retryAfterSeconds?:
        number | null;

      lastMessage?:
        string | null;
    }
  ) {

    const body = {

      sync_key:
        SYNC_KEY,

      last_attempt_at:
        data.lastAttemptAt
        ?? null,

      last_success_at:
        data.lastSuccessAt
        ?? null,

      next_allowed_at:
        data.nextAllowedAt
        ?? null,

      last_http_status:
        data.lastHttpStatus
        ?? null,

      retry_after_seconds:
        data.retryAfterSeconds
        ?? null,

      last_message:
        data.lastMessage
        ?? null,

      updated_at:
        new Date()
          .toISOString(),

    };


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_sync_state?on_conflict=sync_key`,
        {
          method:
            "POST",

          headers: {
            ...supabaseHeaders,

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
    // 2. СОСТОЯНИЕ СИНХРОНИЗАЦИИ
    // ========================================================

    const stateResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_sync_state`
        +
        `?sync_key=eq.${SYNC_KEY}`
        +
        `&select=*`
        +
        `&limit=1`,
        {
          method:
            "GET",

          headers:
            supabaseHeaders,

          cache:
            "no-store",
        }
      );


    if (!stateResponse.ok) {

      const text =
        await stateResponse.text();


      throw new Error(
        `Не удалось прочитать wb_sync_state: ${text}`
      );

    }


    const stateRows:
      SyncState[] =
      await stateResponse.json();


    const state =
      stateRows[0]
      ?? null;


    // ========================================================
    // 3. БЛОКИРОВКА ПО 429
    // ========================================================

    if (
      state?.next_allowed_at
    ) {

      const nextAllowed =
        new Date(
          state
            .next_allowed_at
        );


      if (
        Number.isFinite(
          nextAllowed
            .getTime()
        )
        &&
        nextAllowed
          .getTime()
        >
        Date.now()
      ) {

        return NextResponse.json({
          ok:
            true,

          skipped:
            true,

          blockedByRateLimit:
            true,

          message:
            "Синхронизация остатков пока заблокирована лимитом WB",

          nextAllowedAt:
            state
              .next_allowed_at,

          wildberriesRequestSent:
            false,
        });

      }

    }


    // ========================================================
    // 4. ЗАЩИТА ОТ ЛИШНИХ ЗАПРОСОВ
    // ========================================================

    if (
      state?.last_success_at
    ) {

      const lastSuccess =
        new Date(
          state
            .last_success_at
        );


      const hoursPassed =
        (
          Date.now()
          -
          lastSuccess
            .getTime()
        )
        /
        (
          1000
          *
          60
          *
          60
        );


      if (
        Number.isFinite(
          hoursPassed
        )
        &&
        hoursPassed
        <
        REPEAT_GUARD_HOURS
      ) {

        return NextResponse.json({
          ok:
            true,

          skipped:
            true,

          message:
            "Свежий снимок остатков WB уже существует",

          latestSyncedAt:
            state
              .last_success_at,

          hoursSinceLastSync:
            Number(
              hoursPassed
                .toFixed(
                  2
                )
            ),

          wildberriesRequestSent:
            false,
        });

      }

    }


    // ========================================================
    // 5. НАЧАЛО ПОПЫТКИ
    // ========================================================

    const attemptAt =
      new Date()
        .toISOString();


    await saveSyncState({
      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        state
          ?.last_success_at
        ?? null,

      nextAllowedAt:
        null,

      lastHttpStatus:
        null,

      retryAfterSeconds:
        null,

      lastMessage:
        "Начало синхронизации поартикульных остатков WB",
    });


    // ========================================================
    // 6. ДАТА ОТЧЁТА
    // ========================================================

    const reportDate =
      getMoscowDate();


    // ========================================================
    // 7. ПОЛУЧАЕМ ВСЕ ТОВАРЫ WB
    // ========================================================

    const allProducts:
      WBProduct[] =
      [];


    let offset =
      0;


    let page =
      0;


    let lastWBStatus:
      number | null =
      null;


    while (true) {

      page +=
        1;


      const requestBody = {

        currentPeriod: {
          start:
            reportDate,

          end:
            reportDate,
        },


        // Только склады Wildberries = FBW
        stockType:
          "wb",


        // НЕ пропускаем удалённые карточки.
        // Если на удалённой карточке остался товар,
        // он нам всё равно нужен в остатках.
        skipDeletedNm:
          false,


        // Берём вообще все категории доступности.
        availabilityFilters: [
          "deficient",
          "actual",
          "balanced",
          "nonActual",
          "nonLiquid",
          "invalidData",
        ],


        // Сортировка для нас не важна,
        // но WB требует orderBy.
        orderBy: {
          field:
            "avgOrders",

          mode:
            "desc",
        },


        limit:
          PAGE_LIMIT,

        offset,

      };


      const wbResponse =
        await fetch(
          WB_URL,
          {
            method:
              "POST",

            headers: {
              Authorization:
                wbToken,

              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                requestBody
              ),

            cache:
              "no-store",
          }
        );


      lastWBStatus =
        wbResponse.status;


      const wbText =
        await wbResponse.text();


      const wbData =
        parseJson(
          wbText
        );


      // ======================================================
      // 429
      // ======================================================

      if (
        wbResponse.status
        ===
        429
      ) {

        const retryAfterHeader =
          wbResponse
            .headers
            .get(
              "retry-after"
            );


        const retryAfterSeconds =
          Math.max(
            60,
            Number(
              retryAfterHeader
            )
            || 60
          );


        const nextAllowedAt =
          new Date(
            Date.now()
            +
            retryAfterSeconds
              *
              1000
          ).toISOString();


        await saveSyncState({
          lastAttemptAt:
            attemptAt,

          lastSuccessAt:
            state
              ?.last_success_at
            ?? null,

          nextAllowedAt,

          lastHttpStatus:
            429,

          retryAfterSeconds,

          lastMessage:
            "WB ограничил запрос остатков",
        });


        return NextResponse.json(
          {
            ok:
              false,

            message:
              "Wildberries ограничил запрос остатков",

            wbStatus:
              429,

            retryAfterSeconds,

            nextAllowedAt,

            page,

            offset,

            wildberriesRequestSent:
              true,

            wbResponse:
              wbData,
          },
          {
            status:
              429,
          }
        );

      }


      // ======================================================
      // ДРУГАЯ ОШИБКА
      // ======================================================

      if (!wbResponse.ok) {

        await saveSyncState({
          lastAttemptAt:
            attemptAt,

          lastSuccessAt:
            state
              ?.last_success_at
            ?? null,

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
            ok:
              false,

            message:
              "Wildberries вернул ошибку при загрузке остатков",

            wbStatus:
              wbResponse.status,

            reportDate,

            page,

            offset,

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


      // ======================================================
      // ФОРМАТ ОТВЕТА
      // ======================================================

      const typed =
        wbData as WBResponse;


      const items =
        typed
          ?.data
          ?.items;


      if (
        !Array.isArray(
          items
        )
      ) {

        await saveSyncState({
          lastAttemptAt:
            attemptAt,

          lastSuccessAt:
            state
              ?.last_success_at
            ?? null,

          nextAllowedAt:
            null,

          lastHttpStatus:
            wbResponse.status,

          retryAfterSeconds:
            null,

          lastMessage:
            "WB вернул неожиданный формат отчёта остатков",
        });


        return NextResponse.json(
          {
            ok:
              false,

            message:
              "WB вернул неожиданный формат отчёта остатков",

            wbStatus:
              wbResponse.status,

            reportDate,

            wbResponse:
              wbData,
          },
          {
            status:
              500,
          }
        );

      }


      allProducts.push(
        ...items
      );


      // Последняя страница
      if (
        items.length
        <
        PAGE_LIMIT
      ) {

        break;

      }


      offset +=
        PAGE_LIMIT;


      // WB разрешает 3 запроса в минуту.
      // Без этой паузы можно довольно бодро
      // прилететь в 429.
      await sleep(
        21_000
      );

    }


    // ========================================================
    // 8. ПРОВЕРЯЕМ NM ID
    // ========================================================

    const validProducts =
      allProducts.filter(
        (
          product
        ): product is WBProduct & {
          nmID: number;
        } => {

          return (
            typeof product.nmID
            ===
            "number"
            &&
            Number.isFinite(
              product.nmID
            )
            &&
            product.nmID
            >
            0
          );

        }
      );


    // ========================================================
    // 9. УБИРАЕМ ДУБЛИКАТЫ
    // ========================================================

    const uniqueByNmId =
      new Map<
        number,
        WBProduct & {
          nmID: number;
        }
      >();


    for (
      const product
      of validProducts
    ) {

      uniqueByNmId.set(
        product.nmID,
        product
      );

    }


    const products =
      Array.from(
        uniqueByNmId
          .values()
      );


    // ========================================================
    // 10. SNAPSHOT
    // ========================================================

    const snapshotId =
      randomUUID();


    const snapshotAt =
      new Date()
        .toISOString();


    // ========================================================
    // 11. СОБИРАЕМ СТРОКИ
    // ========================================================

    const rows =
      products.map(
        (product) => {

          const metrics =
            product.metrics
            ?? {};


          const stockCount =
            Math.max(
              0,
              Number(
                metrics
                  .stockCount
              )
              || 0
            );


          const toClientCount =
            Math.max(
              0,
              Number(
                metrics
                  .toClientCount
              )
              || 0
            );


          const fromClientCount =
            Math.max(
              0,
              Number(
                metrics
                  .fromClientCount
              )
              || 0
            );


          return {

            snapshot_id:
              snapshotId,

            snapshot_at:
              snapshotAt,

            nm_id:
              product.nmID,

            vendor_code:
              product.vendorCode
              ?? null,

            product_name:
              product.name
              ?? null,

            brand_name:
              product.brandName
              ?? null,


            // ВОТ ЭТОТ ОСТАТОК
            // ИДЁТ В ФОРМУЛУ ПОТРЕБНОСТИ
            stock_count:
              stockCount,


            // Сохраняем отдельно.
            // В stock_count их НЕ прибавляем.
            to_client_count:
              toClientCount,

            from_client_count:
              fromClientCount,

            availability:
              metrics
                .availability
              ?? null,

            raw:
              product,

          };

        }
      );


    // ========================================================
    // 12. ЗАПИСЬ В SUPABASE
    // ========================================================

    const batches =
      splitIntoBatches(
        rows,
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


      const insertResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/wb_stock_product_snapshots`,
          {
            method:
              "POST",

            headers: {
              ...supabaseHeaders,

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


      if (
        !insertResponse.ok
      ) {

        const text =
          await insertResponse.text();


        await saveSyncState({
          lastAttemptAt:
            attemptAt,

          lastSuccessAt:
            state
              ?.last_success_at
            ?? null,

          nextAllowedAt:
            null,

          lastHttpStatus:
            lastWBStatus,

          retryAfterSeconds:
            null,

          lastMessage:
            "WB ответил успешно, но снимок остатков не записался в Supabase",
        });


        return NextResponse.json(
          {
            ok:
              false,

            message:
              "Ошибка записи поартикульных остатков WB в Supabase",

            snapshotId,

            failedBatch:
              i + 1,

            batchesCount:
              batches.length,

            savedBeforeFailure:
              savedRows,

            supabaseStatus:
              insertResponse
                .status,

            supabaseResponse:
              parseJson(
                text
              ),
          },
          {
            status:
              500,
          }
        );

      }


      savedRows +=
        batch.length;

    }


    // ========================================================
    // 13. УСПЕШНОЕ СОСТОЯНИЕ
    // ========================================================

    await saveSyncState({
      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        snapshotAt,

      nextAllowedAt:
        null,

      lastHttpStatus:
        lastWBStatus,

      retryAfterSeconds:
        null,

      lastMessage:
        `Успешно загружены поартикульные остатки WB: ${savedRows} SKU`,
    });


    // ========================================================
    // 14. КОНТРОЛЬНЫЕ ПОКАЗАТЕЛИ
    // ========================================================

    const totalStock =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.stock_count,

        0
      );


    const totalToClient =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.to_client_count,

        0
      );


    const totalFromClient =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.from_client_count,

        0
      );


    const zeroStockCount =
      rows.filter(
        (row) =>
          row.stock_count
          ===
          0
      ).length;


    // ========================================================
    // 15. ОТВЕТ
    // ========================================================

    return NextResponse.json({
      ok:
        true,

      message:
        "Полные поартикульные остатки FBW Wildberries успешно загружены",

      wildberriesRequestSent:
        true,

      source: {
        endpoint:
          WB_URL,

        stockType:
          "wb",

        reportDate,

        pages:
          page,

        rawProductsReceived:
          allProducts.length,

        uniqueSkuReceived:
          products.length,
      },

      snapshot: {
        snapshotId,

        snapshotAt,

        rowsSaved:
          savedRows,
      },

      totals: {
        stockCount:
          totalStock,

        toClientCount:
          totalToClient,

        fromClientCount:
          totalFromClient,

        zeroStockSkuCount:
          zeroStockCount,
      },

      important: {
        stockUsedForProcurement:
          "metrics.stockCount",

        toClientIncludedInStock:
          false,

        fromClientIncludedInStock:
          false,

        fbsIncluded:
          false,

        warehouseNamesUsed:
          false,
      },


      // Чтобы глазами сразу проверить,
      // что WB нам реально вернул.
      sample:
        rows
          .slice(
            0,
            20
          )
          .map(
            (row) => ({
              nmId:
                row.nm_id,

              vendorCode:
                row.vendor_code,

              productName:
                row.product_name,

              stockCount:
                row.stock_count,

              toClient:
                row.to_client_count,

              fromClient:
                row.from_client_count,

              availability:
                row.availability,
            })
          ),
    });


  } catch (error) {

    console.error(
      "Ошибка sync-stocks WB:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка синхронизации остатков WB",
      },
      {
        status:
          500,
      }
    );

  }

}
