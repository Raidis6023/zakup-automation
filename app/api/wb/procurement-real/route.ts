import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_DAYS = 28;

const MAX_DATA_AGE_HOURS = 24;

const SUPABASE_PAGE_SIZE = 1000;


// ============================================================
// ТИПЫ
// ============================================================

type SyncState = {
  sync_key: string;

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
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env.SUPABASE_URL
    ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;


  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env.SUPABASE_SECRET_KEY;


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
      await supabaseGet<T[]>(
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
// ФОРМУЛА ПОТРЕБНОСТИ
// ============================================================

function calculateNeed(
  stock:
    number,

  dailySales:
    number
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


  const daysOfStock =
    safeStock
    /
    safeDailySales;


  let needRaw =
    0;


  let rule:
    NeedRule;


  if (
    daysOfStock
    >
    30
  ) {

    needRaw =
      0;

    rule =
      "MORE_THAN_30_DAYS";

  } else if (
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

  } else {

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

export async function GET() {

  try {

    // ========================================================
    // 1. СОСТОЯНИЕ СИНХРОНИЗАЦИЙ
    // ========================================================

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


    const ordersState =
      syncStates.find(
        (row) =>
          row.sync_key
          ===
          "orders"
      )
      ??
      null;


    const stocksState =
      syncStates.find(
        (row) =>
          row.sync_key
          ===
          "stocks"
      )
      ??
      null;


    if (
      !ordersState
      ||
      !ordersState
        .last_success_at
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Нет успешной синхронизации заказов WB",
        },
        {
          status:
            409,
        }
      );

    }


    if (
      !stocksState
      ||
      !stocksState
        .last_success_at
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Нет успешной синхронизации остатков WB",
        },
        {
          status:
            409,
        }
      );

    }


    const ordersAgeHours =
      getAgeHours(
        ordersState
          .last_success_at
      );


    const stocksAgeHours =
      getAgeHours(
        stocksState
          .last_success_at
      );


    const ordersFresh =
      ordersAgeHours
      !==
      null
      &&
      ordersAgeHours
      <=
      MAX_DATA_AGE_HOURS;


    const stocksFresh =
      stocksAgeHours
      !==
      null
      &&
      stocksAgeHours
      <=
      MAX_DATA_AGE_HOURS;


    if (
      !ordersFresh
      ||
      !stocksFresh
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Расчёт заблокирован: данные WB устарели",

          freshness: {
            maxAgeHours:
              MAX_DATA_AGE_HOURS,

            orders: {
              lastSuccessAt:
                ordersState
                  .last_success_at,

              ageHours:
                ordersAgeHours,

              fresh:
                ordersFresh,
            },

            stocks: {
              lastSuccessAt:
                stocksState
                  .last_success_at,

              ageHours:
                stocksAgeHours,

              fresh:
                stocksFresh,
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
    // 2. РАСЧЁТНЫЙ ПЕРИОД
    // ========================================================

    const periodEnd =
      new Date(
        ordersState
          .last_success_at
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
    // 3. ПОСЛЕДНИЙ SNAPSHOT ОСТАТКОВ
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
    // 4. ОСТАТКИ
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
      stockResult.rows;


    // ========================================================
    // 5. ЗАКАЗЫ FBW ЗА 28 ДНЕЙ
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
      ordersResult.rows;


    const activeOrders =
      fbwOrders.filter(
        (order) =>
          order.is_cancel
          !==
          true
      );


    const cancelledOrders =
      fbwOrders.filter(
        (order) =>
          order.is_cancel
          ===
          true
      );


    // ========================================================
    // 6. ПРОДАЖИ ПО NM ID
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
          order.nm_id
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


      current.ordersCount +=
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
    // 7. ОСТАТКИ ПО NM ID
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
          stock.nm_id
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
    // 8. ВСЕ SKU
    // ========================================================

    const allNmIds =
      new Set<
        number
      >();


    for (
      const nmId
      of salesByNmId.keys()
    ) {

      allNmIds.add(
        nmId
      );

    }


    for (
      const nmId
      of stockByNmId.keys()
    ) {

      allNmIds.add(
        nmId
      );

    }


    // ========================================================
    // 9. РАСЧЁТ ПОТРЕБНОСТИ
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


          // Если SKU продавался,
          // но его вообще нет в полном
          // stock snapshot, НЕ притворяемся,
          // что остаток равен нулю.
          //
          // Это потенциальная проблема данных.
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
    // 10. СОРТИРОВКА
    // ========================================================

    result.sort(
      (
        a,
        b
      ) => {

        const aNeed =
          a.calculation
            .needRoundedUp
          ??
          -1;


        const bNeed =
          b.calculation
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
          b.sales
            .ordersCount
          -
          a.sales
            .ordersCount
        );

      }
    );


    // ========================================================
    // 11. SUMMARY
    // ========================================================

    const calculatedRows =
      result.filter(
        (row) =>
          row.calculation
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
          row.calculation
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
        missingStockRows.length,

    };


    // ========================================================
    // 12. TOTAL STOCK
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
              row.stock_count
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
              row.to_client_count
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
              row.from_client_count
            )
            ||
            0
          ),

        0
      );


    // ========================================================
    // 13. ОТВЕТ
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      message:
        "Потребность WB рассчитана по полным поартикульным остаткам",

      wildberriesRequestSent:
        false,


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

        maxAgeHours:
          MAX_DATA_AGE_HOURS,

        allSourcesFresh:
          ordersFresh
          &&
          stocksFresh,

        orders: {

          lastSuccessAt:
            ordersState
              .last_success_at,

          ageHours:
            ordersAgeHours,

          fresh:
            ordersFresh,

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
            stocksFresh,

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
          fbwOrders.length,

        activeFbwOrders:
          activeOrders.length,

        cancelledFbwOrders:
          cancelledOrders.length,

        orderPagesRead:
          ordersResult.pages,

        stockSnapshotRows:
          stockRows.length,

        stockPagesRead:
          stockResult.pages,

      },


      stocks: {

        skuCount:
          stockRows.length,

        totalCurrentStock,

        totalToClient,

        totalFromClient,

      },


      summary: {

        skuCount:
          result.length,

        skuWithActiveSales:
          result.filter(
            (row) =>
              row.sales
                .ordersCount
              >
              0
          ).length,

        skuWithNeed:
          skuWithNeed.length,

        skuWithMissingStockData:
          missingStockRows.length,

        totalNeedRaw,

        totalNeedRoundedUp,

        rules,

      },


      dataQuality: {

        snapshotSkuCount:
          stockRows.length,

        zeroStockSkuCount:
          stockRows.filter(
            (row) =>
              Number(
                row.stock_count
              )
              ===
              0
          ).length,

        salesSkuAbsentFromSnapshot:
          missingStockRows.length,

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
      "Ошибка procurement-summary WB:",
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
