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


// Заказы WB допускаем возрастом до 3 часов.
// Это соответствует фактическому лимиту текущего API/токена.
const ORDERS_TARGET_FRESHNESS_HOURS = 3;


// Остатки должны быть свежее.
// Для них оставляем максимум 1 час.
const STOCKS_TARGET_FRESHNESS_HOURS = 1;


// Аварийный предел.
// Если данные старше 24 часов,
// считаем ситуацию критической.
const HARD_MAX_DATA_AGE_HOURS = 24;


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
    boolean | null;
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
  | "BETWEEN_10_AND_30_DAYS";


type StockSource =
  | "WB_SNAPSHOT"
  | "ABSENT_FROM_WB_SNAPSHOT_ASSUMED_ZERO";


// ============================================================
// SUPABASE CONFIG
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
// ТОЧНЫЙ COUNT SUPABASE
// ============================================================

async function getExactOrderCount(
  query: string
): Promise<number> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/wb_orders?select=srid&${query}`,
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

          Prefer:
            "count=exact",

          Range:
            "0-0",
        },

        cache:
          "no-store",
      }
    );


  if (!response.ok) {

    const text =
      await response.text();


    throw new Error(
      `Ошибка точного подсчёта wb_orders HTTP ${response.status}: ${text}`
    );

  }


  const contentRange =
    response.headers.get(
      "content-range"
    );


  if (!contentRange) {

    throw new Error(
      "Supabase не вернул Content-Range при проверке wb_orders"
    );

  }


  const totalRaw =
    contentRange
      .split("/")[1];


  const total =
    Number(
      totalRaw
    );


  if (
    !Number.isFinite(
      total
    )
  ) {

    throw new Error(
      `Не удалось определить точное количество wb_orders: ${contentRange}`
    );

  }


  return total;

}


// ============================================================
// ПАГИНАЦИЯ SUPABASE
// ============================================================

async function supabaseGetAll<T>(
  basePath: string,
  orderBy: string
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
        `order=${encodeURIComponent(
          orderBy
        )}`
        +
        `&limit=${SUPABASE_PAGE_SIZE}`
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
// СОСТОЯНИЕ СИНХРОНИЗАЦИЙ
// ============================================================

async function getWBSyncStates() {

  const rows =
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
    rows.find(
      (row) =>
        row.sync_key
        ===
        "orders"
    )
    ??
    null;


  const stocks =
    rows.find(
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
// ВНУТРЕННЯЯ СИНХРОНИЗАЦИЯ
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
        data?.ok
        ===
        true
        &&
        data?.blockedByRateLimit
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

  }

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
    // 1. ЧИТАЕМ СОСТОЯНИЕ
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
    // 2. ОПРЕДЕЛЯЕМ, ЧТО НУЖНО ОБНОВИТЬ
    // ========================================================

    const needOrdersRefresh =
      ordersAgeBefore
      ===
      null
      ||
      ordersAgeBefore
      >
      ORDERS_TARGET_FRESHNESS_HOURS;


    const needStocksRefresh =
      stocksAgeBefore
      ===
      null
      ||
      stocksAgeBefore
      >
      STOCKS_TARGET_FRESHNESS_HOURS;


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


    if (
      needOrdersRefresh
    ) {

      ordersRefresh =
        await runInternalSync(
          origin,
          "/api/wb/sync-orders"
        );

    }


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
      syncStates.orders;


    const stocksState =
      syncStates.stocks;


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
    // 5. СВЕЖЕСТЬ
    // ========================================================

    const ordersFresh =
      ordersAgeHours
      !==
      null
      &&
      ordersAgeHours
      <=
      ORDERS_TARGET_FRESHNESS_HOURS;


    const stocksFresh =
      stocksAgeHours
      !==
      null
      &&
      stocksAgeHours
      <=
      STOCKS_TARGET_FRESHNESS_HOURS;


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

            ordersTargetFreshnessHours:
              ORDERS_TARGET_FRESHNESS_HOURS,

            stocksTargetFreshnessHours:
              STOCKS_TARGET_FRESHNESS_HOURS,

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
    // 6. ПЕРИОД
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
    // 7. ПОСЛЕДНИЙ SNAPSHOT ОСТАТКОВ
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
            "Нет успешного снимка остатков WB",
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
    // 8. ОСТАТКИ
    // ========================================================

    const stockResult =
      await supabaseGetAll<
        WBStock
      >(
        "wb_stock_product_snapshots"
        +
        `?snapshot_id=eq.${encodeURIComponent(
          latestSnapshot.snapshot_id
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
        ].join(","),

        "nm_id.asc"
      );


    const stockRows =
      stockResult.rows;


    // ========================================================
    // 9. ФИЛЬТР ЗАКАЗОВ
    // ========================================================

    const ordersFilter =
      `order_date=gte.${encodeURIComponent(
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
      );


    // ========================================================
    // 10. ЭТАЛОННЫЕ COUNTS SUPABASE
    // ========================================================

    const [
      exactTotalFbw,
      exactActiveFbw,
      exactCancelledFbw,
      exactNullCancelFbw,
    ] =
      await Promise.all([

        getExactOrderCount(
          ordersFilter
        ),

        getExactOrderCount(
          ordersFilter
          +
          "&is_cancel=eq.false"
        ),

        getExactOrderCount(
          ordersFilter
          +
          "&is_cancel=eq.true"
        ),

        getExactOrderCount(
          ordersFilter
          +
          "&is_cancel=is.null"
        ),

      ]);


    // ========================================================
    // 11. ЧИТАЕМ ЗАКАЗЫ
    // ========================================================

    const ordersResult =
      await supabaseGetAll<
        WBOrder
      >(
        "wb_orders"
        +
        "?"
        +
        ordersFilter
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
        ].join(","),

        "order_date.asc,srid.asc"
      );


    const fbwOrders =
      ordersResult.rows;


    // ========================================================
    // 12. ПРОВЕРКА ДУБЛИКАТОВ
    // ========================================================

    const uniqueSrids =
      new Set(
        fbwOrders.map(
          (row) =>
            row.srid
        )
      );


    const duplicateSridCount =
      fbwOrders.length
      -
      uniqueSrids.size;


    if (
      duplicateSridCount
      >
      0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Расчёт заблокирован: обнаружены дубли srid в wb_orders",

          dataQuality: {

            rows:
              fbwOrders.length,

            uniqueSrid:
              uniqueSrids.size,

            duplicateSridCount,
          },
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 13. АКТИВНЫЕ / ОТМЕНЁННЫЕ
    // ========================================================

    const activeOrders =
      fbwOrders.filter(
        (order) =>
          order.is_cancel
          ===
          false
      );


    const cancelledOrders =
      fbwOrders.filter(
        (order) =>
          order.is_cancel
          ===
          true
      );


    const nullCancelOrders =
      fbwOrders.filter(
        (order) =>
          order.is_cancel
          ===
          null
      );


    // ========================================================
    // 14. ПРОВЕРКА PAGINATION COUNTS
    // ========================================================

    const paginationCountsMatch =
      fbwOrders.length
      ===
      exactTotalFbw
      &&
      activeOrders.length
      ===
      exactActiveFbw
      &&
      cancelledOrders.length
      ===
      exactCancelledFbw
      &&
      nullCancelOrders.length
      ===
      exactNullCancelFbw;


    if (
      !paginationCountsMatch
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Расчёт заблокирован: постраничная загрузка wb_orders не совпала с точными count Supabase",

          serverCounts: {

            totalFbw:
              exactTotalFbw,

            active:
              exactActiveFbw,

            cancelled:
              exactCancelledFbw,

            nullIsCancel:
              exactNullCancelFbw,
          },


          loadedCounts: {

            totalFbw:
              fbwOrders.length,

            active:
              activeOrders.length,

            cancelled:
              cancelledOrders.length,

            nullIsCancel:
              nullCancelOrders.length,
          },
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 15. ПРОДАЖИ ПО NM ID
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

          barcodes:
            Set<string>;
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

          barcodes:
            new Set<string>(),
        };


      current.ordersCount +=
        1;

      if (order.barcode?.trim()) {
        current.barcodes.add(order.barcode.trim());
      }


      if (
        !current.supplierArticle
        &&
        order.supplier_article
      ) {

        current.supplierArticle =
          order.supplier_article;

      }


      if (
        !current.barcode
        &&
        order.barcode
      ) {

        current.barcode =
          order.barcode;

      }


      salesByNmId.set(
        nmId,
        current
      );

    }


    // ========================================================
    // 16. ОСТАТКИ ПО NM ID
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
    // 17. ВСЕ SKU
    // ========================================================

    const allNmIds =
      new Set<number>();


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
    // 18. РАСЧЁТ
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
            sales?.ordersCount
            ??
            0;


          const dailySales =
            ordersCount
            /
            SALES_DAYS;


          // ==================================================
          // SKU отсутствует в успешном полном snapshot
          // stockType = wb
          //
          // → FBW остаток = 0
          //
          // "Свой склад" / FBS не учитывается.
          // ==================================================

          const stockSource:
            StockSource =
            stock
              ?
              "WB_SNAPSHOT"
              :
              "ABSENT_FROM_WB_SNAPSHOT_ASSUMED_ZERO";


          const stockCount =
            stock
              ?
              Math.max(
                0,
                Number(
                  stock.stock_count
                )
                ||
                0
              )
              :
              0;


          const calculation =
            calculateNeed(
              stockCount,
              dailySales
            );


          return {
            nmId,


            supplierArticle:
              sales?.supplierArticle
              ??
              stock?.vendor_code
              ??
              "",


            vendorCode:
              stock?.vendor_code
              ??
              null,


            productName:
              stock?.product_name
              ??
              null,


            barcode:
              sales?.barcode
              ??
              "",

            barcodeVariantCount:
              sales?.barcodes.size
              ??
              0,


            sales: {

              periodDays:
                SALES_DAYS,

              ordersCount,

              dailySales,
            },


            stock: {

              dataAvailable:
                true,

              source:
                stockSource,

              assumedZeroBecauseAbsentFromSnapshot:
                !stock,

              stockCount,

              toClient:
                stock
                  ?
                  Math.max(
                    0,
                    Number(
                      stock.to_client_count
                    )
                    ||
                    0
                  )
                  :
                  0,

              fromClient:
                stock
                  ?
                  Math.max(
                    0,
                    Number(
                      stock.from_client_count
                    )
                    ||
                    0
                  )
                  :
                  0,

              availability:
                stock?.availability
                ??
                null,
            },


            calculation: {

              daysOfStock:
                calculation.daysOfStock,

              needRaw:
                calculation.needRaw,

              needRoundedUp:
                calculation.needRoundedUp,

              rule:
                calculation.rule,
            },

          };

        }
      );


    // ========================================================
    // 19. СОРТИРОВКА ПО ПОТРЕБНОСТИ
    // ========================================================

    result.sort(
      (
        a,
        b
      ) => {

        if (
          b.calculation.needRoundedUp
          !==
          a.calculation.needRoundedUp
        ) {

          return (
            b.calculation.needRoundedUp
            -
            a.calculation.needRoundedUp
          );

        }


        return (
          b.sales.ordersCount
          -
          a.sales.ordersCount
        );

      }
    );


    // ========================================================
    // 20. СВОДНЫЕ ГРУППЫ
    // ========================================================

    const assumedZeroRows =
      result.filter(
        (row) =>
          row.stock.source
          ===
          "ABSENT_FROM_WB_SNAPSHOT_ASSUMED_ZERO"
      );


    const skuWithNeed =
      result.filter(
        (row) =>
          row.calculation.needRoundedUp
          >
          0
      );


    // ========================================================
    // 21. ОБЩАЯ ПОТРЕБНОСТЬ
    // ========================================================

    const totalNeedRaw =
      result.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.calculation.needRaw,
        0
      );


    const totalNeedRoundedUp =
      result.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.calculation.needRoundedUp,
        0
      );


    // ========================================================
    // 22. ПРАВИЛА
    // ========================================================

    const rules = {

      noSales:
        result.filter(
          (row) =>
            row.calculation.rule
            ===
            "NO_SALES"
        ).length,


      moreThan30Days:
        result.filter(
          (row) =>
            row.calculation.rule
            ===
            "MORE_THAN_30_DAYS"
        ).length,


      lessThan10Days:
        result.filter(
          (row) =>
            row.calculation.rule
            ===
            "LESS_THAN_10_DAYS"
        ).length,


      between10And30Days:
        result.filter(
          (row) =>
            row.calculation.rule
            ===
            "BETWEEN_10_AND_30_DAYS"
        ).length,

    };


    // ========================================================
    // 23. ОБЩИЕ ОСТАТКИ
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
    // 24. ОТВЕТ
    // ========================================================

    return NextResponse.json({

      ok:
        true,


      message:
        "Потребность WB рассчитана по проверенным FBW-заказам и полным FBW-остаткам",


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

        absentFromSuccessfulFbwSnapshotMeansZero:
          true,

        toClientIncludedInStock:
          false,

        fromClientIncludedInStock:
          false,

        fbsStockIncluded:
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


      freshnessPolicy: {

        ordersTargetFreshnessHours:
          ORDERS_TARGET_FRESHNESS_HOURS,

        stocksTargetFreshnessHours:
          STOCKS_TARGET_FRESHNESS_HOURS,

        hardMaxAgeHours:
          HARD_MAX_DATA_AGE_HOURS,

        mode:
          "strict",
      },


      freshness: {

        allSourcesFresh:
          true,


        orders: {

          lastSuccessAt:
            ordersState.last_success_at,

          ageHours:
            ordersAgeHours,

          targetFreshnessHours:
            ORDERS_TARGET_FRESHNESS_HOURS,

          fresh:
            true,

          lastHttpStatus:
            ordersState.last_http_status,
        },


        stocks: {

          lastSuccessAt:
            stocksState.last_success_at,

          ageHours:
            stocksAgeHours,

          targetFreshnessHours:
            STOCKS_TARGET_FRESHNESS_HOURS,

          fresh:
            true,

          lastHttpStatus:
            stocksState.last_http_status,

          snapshotId:
            latestSnapshot.snapshot_id,

          snapshotAt:
            latestSnapshot.snapshot_at,
        },

      },


      orderDataValidation: {

        deterministicPagination:
          true,

        orderBy:
          "order_date.asc,srid.asc",

        exactCountsChecked:
          true,

        countsMatch:
          true,

        duplicateSridCount,


        serverCounts: {

          totalFbw:
            exactTotalFbw,

          active:
            exactActiveFbw,

          cancelled:
            exactCancelledFbw,

          nullIsCancel:
            exactNullCancelFbw,
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

        nullCancelFbwOrders:
          nullCancelOrders.length,

        orderPagesRead:
          ordersResult.pages,

        stockSnapshotRows:
          stockRows.length,

        stockPagesRead:
          stockResult.pages,
      },


      stocks: {

        skuInSnapshot:
          stockRows.length,

        skuAssumedZeroBecauseAbsent:
          assumedZeroRows.length,

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
              row.sales.ordersCount
              >
              0
          ).length,

        skuWithNeed:
          skuWithNeed.length,

        skuAssumedZeroFromAbsentSnapshot:
          assumedZeroRows.length,

        totalNeedRaw,

        totalNeedRoundedUp,

        rules,
      },


      dataQuality: {

        snapshotSkuCount:
          stockRows.length,

        zeroStockSkuInsideSnapshot:
          stockRows.filter(
            (row) =>
              Number(
                row.stock_count
              )
              ===
              0
          ).length,

        absentFromSnapshotAssumedZero:
          assumedZeroRows.length,

        orderPaginationValidated:
          true,

        note:
          "Заказы WB допускаются возрастом до 3 часов, остатки до 1 часа. Заказы читаются с фиксированной сортировкой order_date + srid и сверяются с точными count Supabase. SKU вне полного stockType=wb snapshot считается с FBW-остатком 0. FBS / «Свой склад» не участвует.",

      },


      allNeed:
        skuWithNeed,


      topNeed:
        skuWithNeed.slice(
          0,
          100
        ),


      assumedZeroFromAbsentSnapshot:
        assumedZeroRows.map(
          (row) => ({

            nmId:
              row.nmId,

            supplierArticle:
              row.supplierArticle,

            barcode:
              row.barcode,

            sales:
              row.sales,

            stock:
              row.stock,

            calculation:
              row.calculation,
          })
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
