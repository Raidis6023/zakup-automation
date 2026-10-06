import {
  NextRequest,
  NextResponse,
} from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_DAYS = 28;

// Данные должны быть не старше 1 часа.
// Если старше, сначала автоматически обновляем.
const TARGET_FRESHNESS_HOURS = 1;

// Абсолютный аварийный предел.
// Нужен прежде всего для диагностики.
const HARD_MAX_DATA_AGE_HOURS = 24;

const SUPABASE_PAGE_SIZE = 1000;


// ============================================================
// ТИПЫ
// ============================================================

type SyncState = {

  sync_key:
    string;

  last_attempt_at:
    string | null;

  last_success_at:
    string | null;

  next_allowed_at:
    string | null;

  last_http_status:
    number | null;

  retry_after_seconds:
    number | null;

  last_message:
    string | null;

};


type WBOrder = {

  srid:
    string;

  order_date:
    string;

  nm_id:
    number;

  supplier_article:
    string | null;

  barcode:
    string | null;

  warehouse_type:
    string | null;

  is_cancel:
    boolean;

};


type WBStock = {

  snapshot_id:
    string;

  snapshot_at:
    string;

  nm_id:
    number;

  vendor_code:
    string | null;

  product_name:
    string | null;

  brand_name:
    string | null;

  stock_count:
    number;

  to_client_count:
    number;

  from_client_count:
    number;

  availability:
    string | null;

};


type NeedRule =

  | "NO_SALES"

  | "MORE_THAN_30_DAYS"

  | "LESS_THAN_10_DAYS"

  | "BETWEEN_10_AND_30_DAYS"

  | "MISSING_STOCK_DATA";


// ============================================================
// SUPABASE CONFIG
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env
      .SUPABASE_URL
    ??
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env
      .SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseKey) {

    throw new Error(
      "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY"
    );

  }


  return {

    supabaseUrl,

    supabaseKey,

  };

}


// ============================================================
// SUPABASE GET
// ============================================================

async function supabaseGet<T>(
  path: string
): Promise<T> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
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


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Ошибка Supabase HTTP ${response.status}: ${text}`
    );

  }


  return JSON.parse(
    text
  ) as T;

}


// ============================================================
// ПАГИНАЦИЯ SUPABASE
// ============================================================

async function supabaseGetAll<T>(
  basePath: string
): Promise<{
  rows: T[];
  pages: number;
}> {

  const allRows:
    T[] =
    [];


  let offset =
    0;


  let pages =
    0;


  while (true) {

    pages +=
      1;


    const separator =
      basePath.includes("?")
        ?
        "&"
        :
        "?";


    const pageRows =
      await supabaseGet<
        T[]
      >(
        basePath
        +
        separator
        +
        `limit=${SUPABASE_PAGE_SIZE}`
        +
        `&offset=${offset}`
      );


    allRows.push(
      ...pageRows
    );


    if (
      pageRows.length
      <
      SUPABASE_PAGE_SIZE
    ) {

      break;

    }


    offset +=
      SUPABASE_PAGE_SIZE;

  }


  return {

    rows:
      allRows,

    pages,

  };

}


// ============================================================
// ВОЗРАСТ ДАННЫХ
// ============================================================

function getAgeHours(
  value:
    string | null | undefined
): number | null {

  if (!value) {

    return null;

  }


  const timestamp =
    new Date(
      value
    ).getTime();


  if (
    !Number.isFinite(
      timestamp
    )
  ) {

    return null;

  }


  return (
    Date.now()
    -
    timestamp
  )
  /
  (
    1000
    *
    60
    *
    60
  );

}


// ============================================================
// ЧИТАЕМ СОСТОЯНИЕ СИНХРОНИЗАЦИЙ
// ============================================================

async function getWBSyncStates() {

  const syncStates =
    await supabaseGet<
      SyncState[]
    >(
      "wb_sync_state"
      +
      "?sync_key=in.(orders,stocks)"
      +
      "&select=*"
    );


  const orders =
    syncStates.find(
      (row) =>
        row.sync_key
        ===
        "orders"
    )
    ??
    null;


  const stocks =
    syncStates.find(
      (row) =>
        row.sync_key
        ===
        "stocks"
    )
    ??
    null;


  return {

    orders,

    stocks,

  };

}


// ============================================================
// ВНУТРЕННИЙ ЗАПУСК СИНХРОНИЗАЦИИ
// ============================================================

async function runInternalSync(
  origin: string,
  path: string
) {

  try {

    const response =
      await fetch(
        `${origin}${path}`,
        {
          method:
            "GET",

          headers: {

            Accept:
              "application/json",

          },

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    let data:
      any;


    try {

      data =
        JSON.parse(
          text
        );

    } catch {

      data = {

        raw:
          text,

      };

    }


    return {

      success:
        response.ok
        &&
        data
          ?.ok
        ===
        true
        &&
        data
          ?.blockedByRateLimit
        !==
        true,

      httpStatus:
        response.status,

      data,

    };

  } catch (error) {

    return {

      success:
        false,

      httpStatus:
        null,

      data: {

        message:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка внутренней синхронизации",

      },

    };

  }

}


// ============================================================
// ФОРМУЛА ПОТРЕБНОСТИ
// ============================================================

function calculateNeed(
  stock: number,
  dailySales: number
) {

  const safeStock =
    Math.max(
      0,
      Number(
        stock
      )
      ||
      0
    );


  const safeDailySales =
    Math.max(
      0,
      Number(
        dailySales
      )
      ||
      0
    );


  // ----------------------------------------------------------
  // НЕТ ПРОДАЖ
  // ----------------------------------------------------------

  if (
    safeDailySales
    <=
    0
  ) {

    return {

      daysOfStock:
        null,

      needRaw:
        0,

      needRoundedUp:
        0,

      rule:
        "NO_SALES" as NeedRule,

    };

  }


  // ----------------------------------------------------------
  // ДНИ ЗАПАСА
  // ----------------------------------------------------------

  const daysOfStock =
    safeStock
    /
    safeDailySales;


  let needRaw =
    0;


  let rule:
    NeedRule;


  // ----------------------------------------------------------
  // БОЛЬШЕ 30 ДНЕЙ
  // ----------------------------------------------------------

  if (
    daysOfStock
    >
    30
  ) {

    needRaw =
      0;

    rule =
      "MORE_THAN_30_DAYS";

  }


  // ----------------------------------------------------------
  // МЕНЬШЕ 10 ДНЕЙ
  // ----------------------------------------------------------

  else if (
    daysOfStock
    <
    10
  ) {

    needRaw =
      safeDailySales
      *
      30;

    rule =
      "LESS_THAN_10_DAYS";

  }


  // ----------------------------------------------------------
  // ОТ 10 ДО 30 ДНЕЙ
  // ----------------------------------------------------------

  else {

    needRaw =
      (
        40
        -
        daysOfStock
      )
      *
      safeDailySales;

    rule =
      "BETWEEN_10_AND_30_DAYS";

  }


  needRaw =
    Math.max(
      0,
      needRaw
    );


  const needRoundedUp =
    needRaw
    >
    0
      ?
      Math.ceil(
        needRaw
        -
        1e-9
      )
      :
      0;


  return {

    daysOfStock,

    needRaw,

    needRoundedUp,

    rule,

  };

}


// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    // ========================================================
    // 1. ЧИТАЕМ ТЕКУЩУЮ СВЕЖЕСТЬ
    // ========================================================

    let syncStates =
      await getWBSyncStates();


    const ordersAgeBefore =
      getAgeHours(
        syncStates
          .orders
          ?.last_success_at
      );


    const stocksAgeBefore =
      getAgeHours(
        syncStates
          .stocks
          ?.last_success_at
      );


    // ========================================================
    // 2. РЕШАЕМ, ЧТО НУЖНО ОБНОВИТЬ
    // ========================================================

    const needOrdersRefresh =
      ordersAgeBefore
      ===
      null
      ||
      ordersAgeBefore
      >
      TARGET_FRESHNESS_HOURS;


    const needStocksRefresh =
      stocksAgeBefore
      ===
      null
      ||
      stocksAgeBefore
      >
      TARGET_FRESHNESS_HOURS;


    // ========================================================
    // 3. АВТООБНОВЛЕНИЕ
    // ========================================================

    const origin =
      request
        .nextUrl
        .origin;


    let ordersRefresh:
      any =
      null;


    let stocksRefresh:
      any =
      null;


    // --------------------------------------------------------
    // Сначала заказы
    // --------------------------------------------------------

    if (
      needOrdersRefresh
    ) {

      ordersRefresh =
        await runInternalSync(
          origin,
          "/api/wb/sync-orders"
        );

    }


    // --------------------------------------------------------
    // Потом остатки
    // --------------------------------------------------------

    if (
      needStocksRefresh
    ) {

      stocksRefresh =
        await runInternalSync(
          origin,
          "/api/wb/sync-stocks"
        );

    }


    // ========================================================
    // 4. ПОВТОРНО ЧИТАЕМ СОСТОЯНИЕ
    // ========================================================

    if (
      needOrdersRefresh
      ||
      needStocksRefresh
    ) {

      syncStates =
        await getWBSyncStates();

    }


    const ordersState =
      syncStates
        .orders;


    const stocksState =
      syncStates
        .stocks;


    const ordersAgeHours =
      getAgeHours(
        ordersState
          ?.last_success_at
      );


    const stocksAgeHours =
      getAgeHours(
        stocksState
          ?.last_success_at
      );


    // ========================================================
    // 5. ОЦЕНИВАЕМ СВЕЖЕСТЬ ПОСЛЕ АВТООБНОВЛЕНИЯ
    // ========================================================

    const ordersFresh =
      ordersAgeHours
      !==
      null
      &&
      ordersAgeHours
      <=
      TARGET_FRESHNESS_HOURS;


    const stocksFresh =
      stocksAgeHours
      !==
      null
      &&
      stocksAgeHours
      <=
      TARGET_FRESHNESS_HOURS;


    const ordersHardExpired =
      ordersAgeHours
      ===
      null
      ||
      ordersAgeHours
      >
      HARD_MAX_DATA_AGE_HOURS;


    const stocksHardExpired =
      stocksAgeHours
      ===
      null
      ||
      stocksAgeHours
      >
      HARD_MAX_DATA_AGE_HOURS;


    // ========================================================
    // 6. ЕСЛИ НЕ СВЕЖИЕ — НЕ СЧИТАЕМ
    // ========================================================

    if (
      !ordersState
      ||
      !stocksState
      ||
      !ordersFresh
      ||
      !stocksFresh
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          message:
            ordersHardExpired
            ||
            stocksHardExpired
              ?
              "Расчёт заблокирован: данные WB критически устарели и обновить их не удалось"
              :
              "Расчёт заблокирован: не удалось получить достаточно свежие данные WB",

          freshnessPolicy: {

            targetFreshnessHours:
              TARGET_FRESHNESS_HOURS,

            hardMaxAgeHours:
              HARD_MAX_DATA_AGE_HOURS,

            mode:
              "strict",

          },

          freshness: {

            orders: {

              lastSuccessAt:
                ordersState
                  ?.last_success_at
                ??
                null,

              ageHours:
                ordersAgeHours,

              fresh:
                ordersFresh,

              hardExpired:
                ordersHardExpired,

              refreshRequired:
                needOrdersRefresh,

              refreshResult:
                ordersRefresh,

            },

            stocks: {

              lastSuccessAt:
                stocksState
                  ?.last_success_at
                ??
                null,

              ageHours:
                stocksAgeHours,

              fresh:
                stocksFresh,

              hardExpired:
                stocksHardExpired,

              refreshRequired:
                needStocksRefresh,

              refreshResult:
                stocksRefresh,

            },

          },

        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 7. РАСЧЁТНЫЙ ПЕРИОД
    // ========================================================

    const periodEnd =
      new Date(
        ordersState
          .last_success_at!
      );


    const periodStart =
      new Date(
        periodEnd
          .getTime()
        -
        SALES_DAYS
        *
        24
        *
        60
        *
        60
        *
        1000
      );


    const periodStartIso =
      periodStart
        .toISOString();


    const periodEndIso =
      periodEnd
        .toISOString();


    // ========================================================
    // 8. ПОСЛЕДНИЙ SNAPSHOT ОСТАТКОВ
    // ========================================================

    const latestSnapshotRows =
      await supabaseGet<
        {
          snapshot_id:
            string;

          snapshot_at:
            string;
        }[]
      >(
        "wb_stock_product_snapshots"
        +
        "?select=snapshot_id,snapshot_at"
        +
        "&order=snapshot_at.desc"
        +
        "&limit=1"
      );


    if (
      latestSnapshotRows.length
      ===
      0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "В wb_stock_product_snapshots нет снимков остатков",
        },
        {
          status:
            409,
        }
      );

    }


    const latestSnapshot =
      latestSnapshotRows[0];


    // ========================================================
    // 9. ЧИТАЕМ ОСТАТКИ
    // ========================================================

    const stockResult =
      await supabaseGetAll<
        WBStock
      >(
        "wb_stock_product_snapshots"
        +
        `?snapshot_id=eq.${encodeURIComponent(
          latestSnapshot
            .snapshot_id
        )}`
        +
        "&select="
        +
        [
          "snapshot_id",
          "snapshot_at",
          "nm_id",
          "vendor_code",
          "product_name",
          "brand_name",
          "stock_count",
          "to_client_count",
          "from_client_count",
          "availability",
        ].join(",")
      );


    const stockRows =
      stockResult
        .rows;


    // ========================================================
    // 10. ЧИТАЕМ FBW ЗАКАЗЫ ЗА 28 ДНЕЙ
    // ========================================================

    const ordersResult =
      await supabaseGetAll<
        WBOrder
      >(
        "wb_orders"
        +
        `?order_date=gte.${encodeURIComponent(
          periodStartIso
        )}`
        +
        `&order_date=lte.${encodeURIComponent(
          periodEndIso
        )}`
        +
        "&warehouse_type=eq."
        +
        encodeURIComponent(
          "Склад WB"
        )
        +
        "&select="
        +
        [
          "srid",
          "order_date",
          "nm_id",
          "supplier_article",
          "barcode",
          "warehouse_type",
          "is_cancel",
        ].join(",")
      );


    const fbwOrders =
      ordersResult
        .rows;


    const activeOrders =
      fbwOrders.filter(
        (order) =>
          order
            .is_cancel
          !==
          true
      );


    const cancelledOrders =
      fbwOrders.filter(
        (order) =>
          order
            .is_cancel
          ===
          true
      );


    // ========================================================
    // 11. ПРОДАЖИ ПО NM ID
    // ========================================================

    const salesByNmId =
      new Map<
        number,
        {
          ordersCount:
            number;

          supplierArticle:
            string;

          barcode:
            string;
        }
      >();


    for (
      const order
      of activeOrders
    ) {

      const nmId =
        Number(
          order
            .nm_id
        );


      if (
        !Number.isFinite(
          nmId
        )
        ||
        nmId
        <=
        0
      ) {

        continue;

      }


      const current =
        salesByNmId.get(
          nmId
        )
        ??
        {

          ordersCount:
            0,

          supplierArticle:
            "",

          barcode:
            "",

        };


      current
        .ordersCount
      +=
        1;


      if (
        !current
          .supplierArticle
        &&
        order
          .supplier_article
      ) {

        current
          .supplierArticle =
          order
            .supplier_article;

      }


      if (
        !current
          .barcode
        &&
        order
          .barcode
      ) {

        current
          .barcode =
          order
            .barcode;

      }


      salesByNmId.set(
        nmId,
        current
      );

    }


    // ========================================================
    // 12. ОСТАТКИ ПО NM ID
    // ========================================================

    const stockByNmId =
      new Map<
        number,
        WBStock
      >();


    for (
      const stock
      of stockRows
    ) {

      const nmId =
        Number(
          stock
            .nm_id
        );


      if (
        !Number.isFinite(
          nmId
        )
        ||
        nmId
        <=
        0
      ) {

        continue;

      }


      stockByNmId.set(
        nmId,
        stock
      );

    }


    // ========================================================
    // 13. СОБИРАЕМ ВСЕ SKU
    // ========================================================

    const allNmIds =
      new Set<
        number
      >();


    for (
      const nmId
      of salesByNmId
        .keys()
    ) {

      allNmIds.add(
        nmId
      );

    }


    for (
      const nmId
      of stockByNmId
        .keys()
    ) {

      allNmIds.add(
        nmId
      );

    }


    // ========================================================
    // 14. РАСЧЁТ ПОТРЕБНОСТИ
    // ========================================================

    const result =
      Array.from(
        allNmIds
      )
      .map(
        (nmId) => {

          const sales =
            salesByNmId.get(
              nmId
            );


          const stock =
            stockByNmId.get(
              nmId
            );


          const ordersCount =
            sales
              ?.ordersCount
            ??
            0;


          const dailySales =
            ordersCount
            /
            SALES_DAYS;


          // --------------------------------------------------
          // Есть продажи, но SKU отсутствует в полном снимке
          // --------------------------------------------------

          if (
            !stock
            &&
            ordersCount
            >
            0
          ) {

            return {

              nmId,

              supplierArticle:
                sales
                  ?.supplierArticle
                ??
                "",

              vendorCode:
                null,

              productName:
                null,

              barcode:
                sales
                  ?.barcode
                ??
                "",


              sales: {

                periodDays:
                  SALES_DAYS,

                ordersCount,

                dailySales,

              },


              stock: {

                dataAvailable:
                  false,

                stockCount:
                  null,

                toClient:
                  null,

                fromClient:
                  null,

                availability:
                  null,

              },


              calculation: {

                daysOfStock:
                  null,

                needRaw:
                  null,

                needRoundedUp:
                  null,

                rule:
                  "MISSING_STOCK_DATA" as NeedRule,

              },

            };

          }


          // --------------------------------------------------
          // Нормальный SKU
          // --------------------------------------------------

          const stockCount =
            Math.max(
              0,
              Number(
                stock
                  ?.stock_count
              )
              ||
              0
            );


          const calculation =
            calculateNeed(
              stockCount,
              dailySales
            );


          return {

            nmId,


            supplierArticle:
              sales
                ?.supplierArticle
              ??
              stock
                ?.vendor_code
              ??
              "",


            vendorCode:
              stock
                ?.vendor_code
              ??
              null,


            productName:
              stock
                ?.product_name
              ??
              null,


            barcode:
              sales
                ?.barcode
              ??
              "",


            sales: {

              periodDays:
                SALES_DAYS,

              ordersCount,

              dailySales,

            },


            stock: {

              dataAvailable:
                true,

              stockCount,

              toClient:
                Math.max(
                  0,
                  Number(
                    stock
                      ?.to_client_count
                  )
                  ||
                  0
                ),

              fromClient:
                Math.max(
                  0,
                  Number(
                    stock
                      ?.from_client_count
                  )
                  ||
                  0
                ),

              availability:
                stock
                  ?.availability
                ??
                null,

            },


            calculation: {

              daysOfStock:
                calculation
                  .daysOfStock,

              needRaw:
                calculation
                  .needRaw,

              needRoundedUp:
                calculation
                  .needRoundedUp,

              rule:
                calculation
                  .rule,

            },

          };

        }
      );


    // ========================================================
    // 15. СОРТИРОВКА
    // ========================================================

    result.sort(
      (
        a,
        b
      ) => {

        const aNeed =
          a
            .calculation
            .needRoundedUp
          ??
          -1;


        const bNeed =
          b
            .calculation
            .needRoundedUp
          ??
          -1;


        if (
          bNeed
          !==
          aNeed
        ) {

          return (
            bNeed
            -
            aNeed
          );

        }


        return (
          b
            .sales
            .ordersCount
          -
          a
            .sales
            .ordersCount
        );

      }
    );


    // ========================================================
    // 16. SUMMARY
    // ========================================================

    const calculatedRows =
      result.filter(
        (row) =>
          row
            .calculation
            .needRoundedUp
          !==
          null
      );


    const skuWithNeed =
      calculatedRows.filter(
        (row) =>
          (
            row
              .calculation
              .needRoundedUp
            ??
            0
          )
          >
          0
      );


    const missingStockRows =
      result.filter(
        (row) =>
          row
            .calculation
            .rule
          ===
          "MISSING_STOCK_DATA"
      );


    const totalNeedRaw =
      calculatedRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          (
            row
              .calculation
              .needRaw
            ??
            0
          ),
        0
      );


    const totalNeedRoundedUp =
      calculatedRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          (
            row
              .calculation
              .needRoundedUp
            ??
            0
          ),
        0
      );


    const rules = {

      noSales:
        result.filter(
          (row) =>
            row
              .calculation
              .rule
            ===
            "NO_SALES"
        ).length,


      moreThan30Days:
        result.filter(
          (row) =>
            row
              .calculation
              .rule
            ===
            "MORE_THAN_30_DAYS"
        ).length,


      lessThan10Days:
        result.filter(
          (row) =>
            row
              .calculation
              .rule
            ===
            "LESS_THAN_10_DAYS"
        ).length,


      between10And30Days:
        result.filter(
          (row) =>
            row
              .calculation
              .rule
            ===
            "BETWEEN_10_AND_30_DAYS"
        ).length,


      missingStockData:
        missingStockRows
          .length,

    };


    // ========================================================
    // 17. ОБЩИЕ ОСТАТКИ
    // ========================================================

    const totalCurrentStock =
      stockRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          Math.max(
            0,
            Number(
              row
                .stock_count
            )
            ||
            0
          ),
        0
      );


    const totalToClient =
      stockRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          Math.max(
            0,
            Number(
              row
                .to_client_count
            )
            ||
            0
          ),
        0
      );


    const totalFromClient =
      stockRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          Math.max(
            0,
            Number(
              row
                .from_client_count
            )
            ||
            0
          ),
        0
      );


    // ========================================================
    // 18. ОТВЕТ
    // ========================================================

    return NextResponse.json({

      ok:
        true,


      message:
        "Потребность WB рассчитана по полным поартикульным остаткам",


      wildberriesRequestSent:
        needOrdersRefresh
        ||
        needStocksRefresh,


      autoRefresh: {

        orders: {

          requested:
            needOrdersRefresh,

          result:
            ordersRefresh,

        },


        stocks: {

          requested:
            needStocksRefresh,

          result:
            stocksRefresh,

        },

      },


      calculationScope: {

        marketplace:
          "Wildberries",

        fulfillment:
          "FBW",

        granularity:
          "SKU × весь Wildberries",

        clusterCalculation:
          false,

        warehouseCalculation:
          false,

        fbsIncluded:
          false,

      },


      formula: {

        salesDays:
          SALES_DAYS,

        cancelledOrdersExcluded:
          true,

        sellerWarehouseExcluded:
          true,

        stockUsed:
          "wb_stock_product_snapshots.stock_count",

        toClientIncludedInStock:
          false,

        fromClientIncludedInStock:
          false,


        rules: {

          moreThan30Days:
            "need = 0",

          lessThan10Days:
            "need = dailySales × 30",

          between10And30Days:
            "need = (40 - daysOfStock) × dailySales",

        },


        rounding:
          "Каждая положительная потребность округляется вверх до целого количества единиц.",

      },


      freshness: {

        targetFreshnessHours:
          TARGET_FRESHNESS_HOURS,

        hardMaxAgeHours:
          HARD_MAX_DATA_AGE_HOURS,

        allSourcesFresh:
          true,


        orders: {

          lastSuccessAt:
            ordersState
              .last_success_at,

          ageHours:
            ordersAgeHours,

          fresh:
            true,

          lastHttpStatus:
            ordersState
              .last_http_status,

        },


        stocks: {

          lastSuccessAt:
            stocksState
              .last_success_at,

          ageHours:
            stocksAgeHours,

          fresh:
            true,

          lastHttpStatus:
            stocksState
              .last_http_status,

          snapshotId:
            latestSnapshot
              .snapshot_id,

          snapshotAt:
            latestSnapshot
              .snapshot_at,

        },

      },


      period: {

        days:
          SALES_DAYS,

        start:
          periodStartIso,

        end:
          periodEndIso,

      },


      sourceRows: {

        fbwOrdersInsidePeriod:
          fbwOrders
            .length,

        activeFbwOrders:
          activeOrders
            .length,

        cancelledFbwOrders:
          cancelledOrders
            .length,

        orderPagesRead:
          ordersResult
            .pages,

        stockSnapshotRows:
          stockRows
            .length,

        stockPagesRead:
          stockResult
            .pages,

      },


      stocks: {

        skuCount:
          stockRows
            .length,

        totalCurrentStock,

        totalToClient,

        totalFromClient,

      },


      summary: {

        skuCount:
          result
            .length,

        skuWithActiveSales:
          result.filter(
            (row) =>
              row
                .sales
                .ordersCount
              >
              0
          ).length,

        skuWithNeed:
          skuWithNeed
            .length,

        skuWithMissingStockData:
          missingStockRows
            .length,

        totalNeedRaw,

        totalNeedRoundedUp,

        rules,

      },


      dataQuality: {

        snapshotSkuCount:
          stockRows
            .length,

        zeroStockSkuCount:
          stockRows.filter(
            (row) =>
              Number(
                row
                  .stock_count
              )
              ===
              0
          ).length,

        salesSkuAbsentFromSnapshot:
          missingStockRows
            .length,

        note:
          "SKU с продажами, отсутствующий в полном снимке остатков, не считается автоматически нулевым. Он попадает в MISSING_STOCK_DATA.",

      },


      topNeed:
        skuWithNeed
          .slice(
            0,
            100
          ),


      missingStockData:
        missingStockRows
          .slice(
            0,
            100
          ),

    });

  } catch (error) {

    console.error(
      "Ошибка procurement-real WB:",
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
            "Неизвестная ошибка расчёта потребности WB",

      },
      {
        status:
          500,
      }
    );

  }

}
