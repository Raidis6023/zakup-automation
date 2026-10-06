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
const PAGE_SIZE = 1000;
const FLOAT_TOLERANCE = 0.000000001;


// ============================================================
// ТИПЫ
// ============================================================

type AuditStatus =
  | "PASS"
  | "FAIL"
  | "WARN";


type AuditCheck = {
  code: string;
  name: string;
  status: AuditStatus;
  message: string;
  details?: unknown;
};


type WBOrder = {
  srid: string;
  order_date: string;
  last_change_date: string | null;
  nm_id: number;
  supplier_article: string | null;
  barcode: string | null;
  warehouse_name: string | null;
  warehouse_type: string | null;
  is_cancel: boolean | null;
  cancel_date: string | null;
  income_id: number | null;
  raw: unknown;
  synced_at: string | null;
};


type WBStock = {
  snapshot_id: string;
  snapshot_at: string;
  nm_id: number;
  vendor_code: string | null;
  product_name: string | null;
  brand_name: string | null;
  stock_count: number;
  to_client_count: number;
  from_client_count: number;
  availability: string | null;
  raw: unknown;
};


type NeedRule =
  | "NO_SALES"
  | "MORE_THAN_30_DAYS"
  | "LESS_THAN_10_DAYS"
  | "BETWEEN_10_AND_30_DAYS";


type AuditSkuResult = {
  nmId: number;

  sales: {
    ordersCount: number;
    dailySales: number;
  };

  stock: {
    source:
      | "WB_SNAPSHOT"
      | "ABSENT_FROM_WB_SNAPSHOT_ASSUMED_ZERO";

    stockCount: number;
    toClient: number;
    fromClient: number;
  };

  calculation: {
    daysOfStock: number | null;
    needRaw: number;
    needRoundedUp: number;
    rule: NeedRule;
  };
};


type ProductionAssumedZeroRow = {
  nmId?: number | string;
};


type FormulaTest = {
  name: string;
  stock: number;
  dailySales: number;
  expectedDays: number | null;
  expectedRaw: number;
  expectedRounded: number;
  expectedRule: NeedRule;
};


// ============================================================
// JSON
// ============================================================

function parseJson(
  text: string
): unknown {

  try {

    return JSON.parse(
      text
    );

  } catch {

    return {
      rawText:
        text,
    };

  }

}


// ============================================================
// ЧИСЛА
// ============================================================

function safeNumber(
  value: unknown
): number {

  const result =
    Number(
      value
    );


  if (
    !Number.isFinite(
      result
    )
  ) {

    return 0;

  }


  return result;

}


// ============================================================
// СРАВНЕНИЕ FLOAT
// ============================================================

function approximatelyEqual(
  a: number | null | undefined,
  b: number | null | undefined,
  tolerance =
    FLOAT_TOLERANCE
): boolean {

  if (
    a === null
    ||
    a === undefined
  ) {

    return (
      b === null
      ||
      b === undefined
    );

  }


  if (
    b === null
    ||
    b === undefined
  ) {

    return false;

  }


  return (
    Math.abs(
      a - b
    )
    <=
    tolerance
  );

}


// ============================================================
// ЧТЕНИЕ RAW JSON
// ============================================================

function getNested(
  object: unknown,
  path: string[]
): unknown {

  let current:
    unknown =
    object;


  for (
    const key
    of path
  ) {

    if (
      current === null
      ||
      current === undefined
      ||
      typeof current !== "object"
    ) {

      return undefined;

    }


    const record =
      current as Record<
        string,
        unknown
      >;


    if (
      !Object.prototype.hasOwnProperty.call(
        record,
        key
      )
    ) {

      return undefined;

    }


    current =
      record[key];

  }


  return current;

}


function firstDefined(
  object: unknown,
  paths: string[][]
): unknown {

  for (
    const path
    of paths
  ) {

    const value =
      getNested(
        object,
        path
      );


    if (
      value !== undefined
    ) {

      return value;

    }

  }


  return undefined;

}


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
      `Supabase HTTP ${response.status}: ${text}`
    );

  }


  return JSON.parse(
    text
  ) as T;

}


// ============================================================
// ТОЧНЫЙ COUNT SUPABASE
// ============================================================

async function getExactCount(
  table: string,
  selectColumn: string,
  query: string
): Promise<number> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=${selectColumn}&${query}`,
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
      `Ошибка count ${table} HTTP ${response.status}: ${text}`
    );

  }


  const contentRange =
    response.headers.get(
      "content-range"
    );


  if (!contentRange) {

    throw new Error(
      `Supabase не вернул Content-Range для ${table}`
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
      `Не удалось разобрать Content-Range: ${contentRange}`
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
        `&limit=${PAGE_SIZE}`
        +
        `&offset=${offset}`
      );


    allRows.push(
      ...pageRows
    );


    if (
      pageRows.length
      <
      PAGE_SIZE
    ) {

      break;

    }


    offset +=
      PAGE_SIZE;

  }


  return {
    rows:
      allRows,

    pages,
  };

}


// ============================================================
// PRODUCTION PROCUREMENT
// ============================================================

async function getProductionCalculation(
  origin: string
): Promise<{
  httpStatus: number;
  responseOk: boolean;
  ok: boolean;
  data: Record<string, any>;
}> {

  const response =
    await fetch(
      `${origin}/api/wb/procurement-real`,
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


  const parsed =
    parseJson(
      text
    );


  const data =
    (
      parsed
      &&
      typeof parsed === "object"
    )
      ?
      parsed as Record<
        string,
        any
      >
      :
      {};


  return {
    httpStatus:
      response.status,

    responseOk:
      response.ok,

    ok:
      response.ok
      &&
      data.ok === true,

    data,
  };

}


// ============================================================
// ЭТАЛОННАЯ ФОРМУЛА
// ============================================================

function referenceNeed(
  stock: number,
  dailySales: number
) {

  const safeStock =
    Math.max(
      0,
      safeNumber(
        stock
      )
    );


  const safeDailySales =
    Math.max(
      0,
      safeNumber(
        dailySales
      )
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
    needRaw > 0
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
// ТЕСТЫ ФОРМУЛЫ
// ============================================================

function runFormulaTests() {

  const cases:
    FormulaTest[] =
    [

      {
        name:
          "Нет продаж",

        stock:
          100,

        dailySales:
          0,

        expectedDays:
          null,

        expectedRaw:
          0,

        expectedRounded:
          0,

        expectedRule:
          "NO_SALES",
      },


      {
        name:
          "5 дней запаса",

        stock:
          50,

        dailySales:
          10,

        expectedDays:
          5,

        expectedRaw:
          300,

        expectedRounded:
          300,

        expectedRule:
          "LESS_THAN_10_DAYS",
      },


      {
        name:
          "Ровно 10 дней",

        stock:
          100,

        dailySales:
          10,

        expectedDays:
          10,

        expectedRaw:
          300,

        expectedRounded:
          300,

        expectedRule:
          "BETWEEN_10_AND_30_DAYS",
      },


      {
        name:
          "20 дней",

        stock:
          200,

        dailySales:
          10,

        expectedDays:
          20,

        expectedRaw:
          200,

        expectedRounded:
          200,

        expectedRule:
          "BETWEEN_10_AND_30_DAYS",
      },


      {
        name:
          "Ровно 30 дней",

        stock:
          300,

        dailySales:
          10,

        expectedDays:
          30,

        expectedRaw:
          100,

        expectedRounded:
          100,

        expectedRule:
          "BETWEEN_10_AND_30_DAYS",
      },


      {
        name:
          "Чуть больше 30 дней",

        stock:
          301,

        dailySales:
          10,

        expectedDays:
          30.1,

        expectedRaw:
          0,

        expectedRounded:
          0,

        expectedRule:
          "MORE_THAN_30_DAYS",
      },


      {
        name:
          "Одна продажа за 28 дней при нулевом остатке",

        stock:
          0,

        dailySales:
          1 / 28,

        expectedDays:
          0,

        expectedRaw:
          30 / 28,

        expectedRounded:
          2,

        expectedRule:
          "LESS_THAN_10_DAYS",
      },


      {
        name:
          "Одна продажа за 28 дней и одна штука остатка",

        stock:
          1,

        dailySales:
          1 / 28,

        expectedDays:
          28,

        expectedRaw:
          12 / 28,

        expectedRounded:
          1,

        expectedRule:
          "BETWEEN_10_AND_30_DAYS",
      },

    ];


  return cases.map(
    (test) => {

      const actual =
        referenceNeed(
          test.stock,
          test.dailySales
        );


      const passed =
        approximatelyEqual(
          actual.daysOfStock,
          test.expectedDays
        )
        &&
        approximatelyEqual(
          actual.needRaw,
          test.expectedRaw
        )
        &&
        actual.needRoundedUp
        ===
        test.expectedRounded
        &&
        actual.rule
        ===
        test.expectedRule;


      return {
        ...test,

        actual,

        passed,
      };

    }
  );

}


// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest
) {

  const checks:
    AuditCheck[] =
    [];


  try {

    // ========================================================
    // 1. PRODUCTION
    // ========================================================

    const origin =
      request
        .nextUrl
        .origin;


    const production =
      await getProductionCalculation(
        origin
      );


    if (!production.ok) {

      return NextResponse.json(
        {
          ok:
            false,

          auditResult:
            "FAIL",

          message:
            "Полный аудит остановлен: рабочий procurement-real не смог выполнить расчёт",

          production: {
            httpStatus:
              production.httpStatus,

            data:
              production.data,
          },
        },
        {
          status:
            409,
        }
      );

    }


    checks.push({
      code:
        "PRODUCTION_ENDPOINT",

      name:
        "Рабочий расчёт procurement-real",

      status:
        "PASS",

      message:
        "Рабочий расчёт успешно выполнен.",
    });


    const productionData =
      production.data;


    // ========================================================
    // 2. ТОТ ЖЕ ПЕРИОД И SNAPSHOT
    // ========================================================

    const periodStart =
      String(
        productionData
          ?.period
          ?.start
        ??
        ""
      );


    const periodEnd =
      String(
        productionData
          ?.period
          ?.end
        ??
        ""
      );


    const snapshotId =
      String(
        productionData
          ?.freshness
          ?.stocks
          ?.snapshotId
        ??
        ""
      );


    if (
      !periodStart
      ||
      !periodEnd
      ||
      !snapshotId
    ) {

      throw new Error(
        "procurement-real не вернул period или snapshotId"
      );

    }


    // ========================================================
    // 3. ФИЛЬТР ЗАКАЗОВ
    // ========================================================

    const ordersFilter =
      `order_date=gte.${encodeURIComponent(
        periodStart
      )}`
      +
      `&order_date=lte.${encodeURIComponent(
        periodEnd
      )}`
      +
      `&warehouse_type=eq.${encodeURIComponent(
        "Склад WB"
      )}`;


    // ========================================================
    // 4. ТОЧНЫЕ COUNTS
    // ========================================================

    const [
      exactTotalOrders,
      exactActiveOrders,
      exactCancelledOrders,
      exactNullCancel,
    ] =
      await Promise.all([

        getExactCount(
          "wb_orders",
          "srid",
          ordersFilter
        ),

        getExactCount(
          "wb_orders",
          "srid",
          ordersFilter
          +
          "&is_cancel=eq.false"
        ),

        getExactCount(
          "wb_orders",
          "srid",
          ordersFilter
          +
          "&is_cancel=eq.true"
        ),

        getExactCount(
          "wb_orders",
          "srid",
          ordersFilter
          +
          "&is_cancel=is.null"
        ),

      ]);


    // ========================================================
    // 5. ЗАГРУЖАЕМ ЗАКАЗЫ
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
          "last_change_date",
          "nm_id",
          "supplier_article",
          "barcode",
          "warehouse_name",
          "warehouse_type",
          "is_cancel",
          "cancel_date",
          "income_id",
          "raw",
          "synced_at",
        ].join(","),

        "order_date.asc,srid.asc"
      );


    const orders =
      ordersResult.rows;


    const activeOrders =
      orders.filter(
        (row) =>
          row.is_cancel
          ===
          false
      );


    const cancelledOrders =
      orders.filter(
        (row) =>
          row.is_cancel
          ===
          true
      );


    const nullCancelOrders =
      orders.filter(
        (row) =>
          row.is_cancel
          ===
          null
      );


    // ========================================================
    // 6. PAGINATION
    // ========================================================

    const orderCountsMatch =
      orders.length
      ===
      exactTotalOrders
      &&
      activeOrders.length
      ===
      exactActiveOrders
      &&
      cancelledOrders.length
      ===
      exactCancelledOrders
      &&
      nullCancelOrders.length
      ===
      exactNullCancel;


    checks.push({
      code:
        "ORDER_PAGINATION",

      name:
        "Полнота загрузки заказов",

      status:
        orderCountsMatch
          ?
          "PASS"
          :
          "FAIL",

      message:
        orderCountsMatch
          ?
          "Постраничная загрузка полностью совпала с точными count Supabase."
          :
          "Количество загруженных заказов не совпало с точными count Supabase.",

      details: {
        server: {
          total:
            exactTotalOrders,

          active:
            exactActiveOrders,

          cancelled:
            exactCancelledOrders,

          nullIsCancel:
            exactNullCancel,
        },

        loaded: {
          total:
            orders.length,

          active:
            activeOrders.length,

          cancelled:
            cancelledOrders.length,

          nullIsCancel:
            nullCancelOrders.length,

          pages:
            ordersResult.pages,
        },
      },
    });


    // ========================================================
    // 7. ДУБЛИ ЗАКАЗОВ
    // ========================================================

    const sridCounts =
      new Map<
        string,
        number
      >();


    for (
      const order
      of orders
    ) {

      sridCounts.set(
        order.srid,
        (
          sridCounts.get(
            order.srid
          )
          ??
          0
        )
        +
        1
      );

    }


    const duplicateSrids =
      Array.from(
        sridCounts.entries()
      )
      .filter(
        (
          [, count]
        ) =>
          count > 1
      );


    checks.push({
      code:
        "ORDER_DUPLICATES",

      name:
        "Дубли заказов",

      status:
        duplicateSrids.length === 0
          ?
          "PASS"
          :
          "FAIL",

      message:
        duplicateSrids.length === 0
          ?
          "Повторяющихся srid нет."
          :
          `Найдено ${duplicateSrids.length} повторяющихся srid.`,

      details: {
        duplicateSridCount:
          duplicateSrids.length,

        sample:
          duplicateSrids
            .slice(
              0,
              20
            )
            .map(
              (
                [srid, count]
              ) => ({
                srid,
                count,
              })
            ),
      },
    });


    // ========================================================
    // 8. FBW/FBS
    // ========================================================

    const nonFbwRows =
      orders.filter(
        (row) =>
          row.warehouse_type
          !==
          "Склад WB"
      );


    checks.push({
      code:
        "FBW_FILTER",

      name:
        "Разделение FBW / FBS",

      status:
        nonFbwRows.length === 0
          ?
          "PASS"
          :
          "FAIL",

      message:
        nonFbwRows.length === 0
          ?
          "В расчётной выборке присутствуют только заказы типа «Склад WB»."
          :
          "В FBW-выборку попали заказы другого типа склада.",

      details: {
        invalidRows:
          nonFbwRows.length,
      },
    });


    // ========================================================
    // 9. RAW ЗАКАЗЫ
    // ========================================================

    let orderRawFieldsChecked =
      0;


    let orderRawMissing =
      0;


    const orderRawMismatches:
      Record<
        string,
        unknown
      >[] =
      [];


    for (
      const row
      of orders
    ) {

      if (
        row.raw === null
        ||
        row.raw === undefined
      ) {

        orderRawMissing +=
          1;

        continue;

      }


      const rawNmId =
        firstDefined(
          row.raw,
          [
            ["nmId"],
            ["nmID"],
          ]
        );


      if (
        rawNmId !== undefined
      ) {

        orderRawFieldsChecked +=
          1;


        if (
          Number(
            rawNmId
          )
          !==
          Number(
            row.nm_id
          )
        ) {

          orderRawMismatches.push({
            srid:
              row.srid,

            field:
              "nm_id",

            normalized:
              row.nm_id,

            raw:
              rawNmId,
          });

        }

      }


      const rawWarehouseType =
        firstDefined(
          row.raw,
          [
            ["warehouseType"],
            ["warehouse_type"],
          ]
        );


      if (
        rawWarehouseType !== undefined
      ) {

        orderRawFieldsChecked +=
          1;


        if (
          String(
            rawWarehouseType
          )
          !==
          String(
            row.warehouse_type
          )
        ) {

          orderRawMismatches.push({
            srid:
              row.srid,

            field:
              "warehouse_type",

            normalized:
              row.warehouse_type,

            raw:
              rawWarehouseType,
          });

        }

      }


      const rawIsCancel =
        firstDefined(
          row.raw,
          [
            ["isCancel"],
            ["is_cancel"],
          ]
        );


      if (
        typeof rawIsCancel
        ===
        "boolean"
      ) {

        orderRawFieldsChecked +=
          1;


        if (
          rawIsCancel
          !==
          row.is_cancel
        ) {

          orderRawMismatches.push({
            srid:
              row.srid,

            field:
              "is_cancel",

            normalized:
              row.is_cancel,

            raw:
              rawIsCancel,
          });

        }

      }

    }


    checks.push({
      code:
        "ORDER_RAW_MAPPING",

      name:
        "Перенос данных заказов из raw",

      status:
        orderRawMismatches.length === 0
          ?
          (
            orderRawMissing === 0
              ?
              "PASS"
              :
              "WARN"
          )
          :
          "FAIL",

      message:
        orderRawMismatches.length === 0
          ?
          "Проверенные нормализованные поля заказов совпадают с сохранённым raw-ответом WB."
          :
          "Есть расхождения между raw-ответом WB и нормализованными полями заказов.",

      details: {
        rawFieldsChecked:
          orderRawFieldsChecked,

        rowsWithoutRaw:
          orderRawMissing,

        mismatchCount:
          orderRawMismatches.length,

        mismatchSample:
          orderRawMismatches.slice(
            0,
            30
          ),
      },
    });


    // ========================================================
    // 10. SNAPSHOT ОСТАТКОВ
    // ========================================================

    const stockFilter =
      `snapshot_id=eq.${encodeURIComponent(
        snapshotId
      )}`;


    const exactStockRows =
      await getExactCount(
        "wb_stock_product_snapshots",
        "nm_id",
        stockFilter
      );


    const stockResult =
      await supabaseGetAll<
        WBStock
      >(
        "wb_stock_product_snapshots"
        +
        "?"
        +
        stockFilter
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
          "raw",
        ].join(","),

        "nm_id.asc"
      );


    const stockRows =
      stockResult.rows;


    checks.push({
      code:
        "STOCK_PAGINATION",

      name:
        "Полнота snapshot остатков",

      status:
        stockRows.length
        ===
        exactStockRows
          ?
          "PASS"
          :
          "FAIL",

      message:
        stockRows.length
        ===
        exactStockRows
          ?
          "Все строки выбранного snapshot остатков прочитаны."
          :
          "Количество загруженных остатков не совпало с count Supabase.",

      details: {
        snapshotId,

        serverRows:
          exactStockRows,

        loadedRows:
          stockRows.length,

        pages:
          stockResult.pages,
      },
    });


    // ========================================================
    // 11. ДУБЛИ NMID В SNAPSHOT
    // ========================================================

    const stockNmCounts =
      new Map<
        number,
        number
      >();


    for (
      const row
      of stockRows
    ) {

      const nmId =
        Number(
          row.nm_id
        );


      stockNmCounts.set(
        nmId,
        (
          stockNmCounts.get(
            nmId
          )
          ??
          0
        )
        +
        1
      );

    }


    const duplicateStockNmIds =
      Array.from(
        stockNmCounts.entries()
      )
      .filter(
        (
          [, count]
        ) =>
          count > 1
      );


    checks.push({
      code:
        "STOCK_DUPLICATES",

      name:
        "Дубли SKU в snapshot",

      status:
        duplicateStockNmIds.length === 0
          ?
          "PASS"
          :
          "FAIL",

      message:
        duplicateStockNmIds.length === 0
          ?
          "Каждый nmID встречается в snapshot один раз."
          :
          "В snapshot обнаружены повторяющиеся nmID.",

      details: {
        duplicateNmIdCount:
          duplicateStockNmIds.length,

        sample:
          duplicateStockNmIds.slice(
            0,
            20
          ),
      },
    });


    // ========================================================
    // 12. ВАЛИДНОСТЬ ОСТАТКОВ
    // ========================================================

    const invalidStockRows =
      stockRows.filter(
        (row) => {

          const stock =
            Number(
              row.stock_count
            );


          const toClient =
            Number(
              row.to_client_count
            );


          const fromClient =
            Number(
              row.from_client_count
            );


          return (
            !Number.isFinite(
              stock
            )
            ||
            !Number.isFinite(
              toClient
            )
            ||
            !Number.isFinite(
              fromClient
            )
            ||
            stock < 0
            ||
            toClient < 0
            ||
            fromClient < 0
            ||
            !Number.isInteger(
              stock
            )
            ||
            !Number.isInteger(
              toClient
            )
            ||
            !Number.isInteger(
              fromClient
            )
          );

        }
      );


    checks.push({
      code:
        "STOCK_VALUES",

      name:
        "Корректность значений остатков",

      status:
        invalidStockRows.length === 0
          ?
          "PASS"
          :
          "FAIL",

      message:
        invalidStockRows.length === 0
          ?
          "stockCount, toClient и fromClient неотрицательные целые числа."
          :
          "Обнаружены некорректные значения остатков.",

      details: {
        invalidRowCount:
          invalidStockRows.length,

        sample:
          invalidStockRows
            .slice(
              0,
              20
            )
            .map(
              (row) => ({
                nmId:
                  row.nm_id,

                stockCount:
                  row.stock_count,

                toClient:
                  row.to_client_count,

                fromClient:
                  row.from_client_count,
              })
            ),
      },
    });


    // ========================================================
    // 13. RAW ОСТАТКИ
    // ========================================================

    let stockRawFieldsChecked =
      0;


    let stockRawMissing =
      0;


    const stockRawMismatches:
      Record<
        string,
        unknown
      >[] =
      [];


    for (
      const row
      of stockRows
    ) {

      if (
        row.raw === null
        ||
        row.raw === undefined
      ) {

        stockRawMissing +=
          1;

        continue;

      }


      const rawNmId =
        firstDefined(
          row.raw,
          [
            ["nmID"],
            ["nmId"],
          ]
        );


      if (
        rawNmId !== undefined
      ) {

        stockRawFieldsChecked +=
          1;


        if (
          Number(
            rawNmId
          )
          !==
          Number(
            row.nm_id
          )
        ) {

          stockRawMismatches.push({
            nmId:
              row.nm_id,

            field:
              "nm_id",

            normalized:
              row.nm_id,

            raw:
              rawNmId,
          });

        }

      }


      const rawStockCount =
        firstDefined(
          row.raw,
          [
            ["metrics", "stockCount"],
            ["stockCount"],
          ]
        );


      if (
        rawStockCount !== undefined
      ) {

        stockRawFieldsChecked +=
          1;


        if (
          Number(
            rawStockCount
          )
          !==
          Number(
            row.stock_count
          )
        ) {

          stockRawMismatches.push({
            nmId:
              row.nm_id,

            field:
              "stock_count",

            normalized:
              row.stock_count,

            raw:
              rawStockCount,
          });

        }

      }


      const rawToClient =
        firstDefined(
          row.raw,
          [
            ["metrics", "toClientCount"],
            ["toClientCount"],
          ]
        );


      if (
        rawToClient !== undefined
      ) {

        stockRawFieldsChecked +=
          1;


        if (
          Number(
            rawToClient
          )
          !==
          Number(
            row.to_client_count
          )
        ) {

          stockRawMismatches.push({
            nmId:
              row.nm_id,

            field:
              "to_client_count",

            normalized:
              row.to_client_count,

            raw:
              rawToClient,
          });

        }

      }


      const rawFromClient =
        firstDefined(
          row.raw,
          [
            ["metrics", "fromClientCount"],
            ["fromClientCount"],
          ]
        );


      if (
        rawFromClient !== undefined
      ) {

        stockRawFieldsChecked +=
          1;


        if (
          Number(
            rawFromClient
          )
          !==
          Number(
            row.from_client_count
          )
        ) {

          stockRawMismatches.push({
            nmId:
              row.nm_id,

            field:
              "from_client_count",

            normalized:
              row.from_client_count,

            raw:
              rawFromClient,
          });

        }

      }

    }


    checks.push({
      code:
        "STOCK_RAW_MAPPING",

      name:
        "Перенос остатков из raw",

      status:
        stockRawMismatches.length === 0
          ?
          (
            stockRawMissing === 0
              ?
              "PASS"
              :
              "WARN"
          )
          :
          "FAIL",

      message:
        stockRawMismatches.length === 0
          ?
          "Проверенные поля snapshot совпадают с сохранённым raw-ответом WB."
          :
          "Найдены расхождения между raw-ответом WB и сохранёнными остатками.",

      details: {
        rawFieldsChecked:
          stockRawFieldsChecked,

        rowsWithoutRaw:
          stockRawMissing,

        mismatchCount:
          stockRawMismatches.length,

        mismatchSample:
          stockRawMismatches.slice(
            0,
            30
          ),
      },
    });


    // ========================================================
    // 14. UNIT-ТЕСТЫ ФОРМУЛЫ
    // ========================================================

    const formulaTests =
      runFormulaTests();


    const failedFormulaTests =
      formulaTests.filter(
        (test) =>
          !test.passed
      );


    checks.push({
      code:
        "FORMULA_TESTS",

      name:
        "Исходная формула потребности",

      status:
        failedFormulaTests.length === 0
          ?
          "PASS"
          :
          "FAIL",

      message:
        failedFormulaTests.length === 0
          ?
          "Все контрольные случаи формулы, включая границы 10 и 30 дней и округление, прошли."
          :
          "Один или несколько контрольных случаев формулы не прошли.",

      details: {
        tests:
          formulaTests,
      },
    });


    // ========================================================
    // 15. ПРОДАЖИ ПО NMID
    // ========================================================

    const salesByNmId =
      new Map<
        number,
        number
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
        nmId <= 0
      ) {

        continue;

      }


      salesByNmId.set(
        nmId,
        (
          salesByNmId.get(
            nmId
          )
          ??
          0
        )
        +
        1
      );

    }


    // ========================================================
    // 16. ОСТАТКИ ПО NMID
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
        nmId <= 0
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
    // 18. НЕЗАВИСИМЫЙ РАСЧЁТ
    // ========================================================

    const auditRows:
      AuditSkuResult[] =
      [];


    for (
      const nmId
      of allNmIds
    ) {

      const ordersCount =
        salesByNmId.get(
          nmId
        )
        ??
        0;


      const dailySales =
        ordersCount
        /
        SALES_DAYS;


      const stock =
        stockByNmId.get(
          nmId
        );


      const stockCount =
        stock
          ?
          Math.max(
            0,
            Number(
              stock.stock_count
            )
          )
          :
          0;


      const calculation =
        referenceNeed(
          stockCount,
          dailySales
        );


      auditRows.push({
        nmId,

        sales: {
          ordersCount,
          dailySales,
        },

        stock: {
          source:
            stock
              ?
              "WB_SNAPSHOT"
              :
              "ABSENT_FROM_WB_SNAPSHOT_ASSUMED_ZERO",

          stockCount,

          toClient:
            stock
              ?
              Number(
                stock.to_client_count
              )
              :
              0,

          fromClient:
            stock
              ?
              Number(
                stock.from_client_count
              )
              :
              0,
        },

        calculation,
      });

    }


    auditRows.sort(
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
    // 19. СВОДКА
    // ========================================================

    const auditNeedRows =
      auditRows.filter(
        (row) =>
          row.calculation.needRoundedUp
          >
          0
      );


    const auditAssumedZeroRows =
      auditRows.filter(
        (row) =>
          row.stock.source
          ===
          "ABSENT_FROM_WB_SNAPSHOT_ASSUMED_ZERO"
      );


    const auditTotalNeedRaw =
      auditRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.calculation.needRaw,
        0
      );


    const auditTotalNeedRounded =
      auditRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.calculation.needRoundedUp,
        0
      );


    const auditTotalStock =
      stockRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          Number(
            row.stock_count
          ),
        0
      );


    const auditTotalToClient =
      stockRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          Number(
            row.to_client_count
          ),
        0
      );


    const auditTotalFromClient =
      stockRows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          Number(
            row.from_client_count
          ),
        0
      );


    const auditSummary = {

      skuCount:
        auditRows.length,

      skuWithActiveSales:
        auditRows.filter(
          (row) =>
            row.sales.ordersCount
            >
            0
        ).length,

      skuWithNeed:
        auditNeedRows.length,

      skuAssumedZeroFromAbsentSnapshot:
        auditAssumedZeroRows.length,

      totalNeedRaw:
        auditTotalNeedRaw,

      totalNeedRoundedUp:
        auditTotalNeedRounded,

      rules: {

        noSales:
          auditRows.filter(
            (row) =>
              row.calculation.rule
              ===
              "NO_SALES"
          ).length,

        moreThan30Days:
          auditRows.filter(
            (row) =>
              row.calculation.rule
              ===
              "MORE_THAN_30_DAYS"
          ).length,

        lessThan10Days:
          auditRows.filter(
            (row) =>
              row.calculation.rule
              ===
              "LESS_THAN_10_DAYS"
          ).length,

        between10And30Days:
          auditRows.filter(
            (row) =>
              row.calculation.rule
              ===
              "BETWEEN_10_AND_30_DAYS"
          ).length,
      },

    };


    // ========================================================
    // 20. СРАВНЕНИЕ SUMMARY
    // ========================================================

    const productionSummary =
      productionData.summary
      ??
      {};


    const summaryMismatches:
      Record<
        string,
        unknown
      >[] =
      [];


    function compareExact(
      field: string,
      expected: unknown,
      actual: unknown
    ) {

      if (
        expected !== actual
      ) {

        summaryMismatches.push({
          field,

          audit:
            expected,

          production:
            actual,
        });

      }

    }


    function compareFloat(
      field: string,
      expected: number,
      actual: unknown
    ) {

      const actualNumber =
        Number(
          actual
        );


      if (
        !Number.isFinite(
          actualNumber
        )
        ||
        !approximatelyEqual(
          expected,
          actualNumber
        )
      ) {

        summaryMismatches.push({
          field,

          audit:
            expected,

          production:
            actual,
        });

      }

    }


    compareExact(
      "skuCount",
      auditSummary.skuCount,
      productionSummary.skuCount
    );


    compareExact(
      "skuWithActiveSales",
      auditSummary.skuWithActiveSales,
      productionSummary.skuWithActiveSales
    );


    compareExact(
      "skuWithNeed",
      auditSummary.skuWithNeed,
      productionSummary.skuWithNeed
    );


    compareExact(
      "skuAssumedZeroFromAbsentSnapshot",
      auditSummary.skuAssumedZeroFromAbsentSnapshot,
      productionSummary.skuAssumedZeroFromAbsentSnapshot
    );


    compareFloat(
      "totalNeedRaw",
      auditSummary.totalNeedRaw,
      productionSummary.totalNeedRaw
    );


    compareExact(
      "totalNeedRoundedUp",
      auditSummary.totalNeedRoundedUp,
      productionSummary.totalNeedRoundedUp
    );


    compareExact(
      "rules.noSales",
      auditSummary.rules.noSales,
      productionSummary
        ?.rules
        ?.noSales
    );


    compareExact(
      "rules.moreThan30Days",
      auditSummary.rules.moreThan30Days,
      productionSummary
        ?.rules
        ?.moreThan30Days
    );


    compareExact(
      "rules.lessThan10Days",
      auditSummary.rules.lessThan10Days,
      productionSummary
        ?.rules
        ?.lessThan10Days
    );


    compareExact(
      "rules.between10And30Days",
      auditSummary.rules.between10And30Days,
      productionSummary
        ?.rules
        ?.between10And30Days
    );


    checks.push({
      code:
        "SUMMARY_COMPARISON",

      name:
        "Сравнение итогов с procurement-real",

      status:
        summaryMismatches.length === 0
          ?
          "PASS"
          :
          "FAIL",

      message:
        summaryMismatches.length === 0
          ?
          "Независимый расчёт полностью совпал с итоговой сводкой procurement-real."
          :
          "Независимый расчёт не совпал с procurement-real.",

      details: {
        auditSummary,

        productionSummary,

        mismatches:
          summaryMismatches,
      },
    });


    // ========================================================
    // 21. ОБЩИЕ ОСТАТКИ
    // ========================================================

    const productionStocks =
      productionData.stocks
      ??
      {};


    const stockTotalsMatch =
      productionStocks.skuInSnapshot
      ===
      stockRows.length
      &&
      productionStocks.totalCurrentStock
      ===
      auditTotalStock
      &&
      productionStocks.totalToClient
      ===
      auditTotalToClient
      &&
      productionStocks.totalFromClient
      ===
      auditTotalFromClient;


    checks.push({
      code:
        "STOCK_TOTALS_COMPARISON",

      name:
        "Остатки в procurement-real",

      status:
        stockTotalsMatch
          ?
          "PASS"
          :
          "FAIL",

      message:
        stockTotalsMatch
          ?
          "Общие остатки procurement-real совпали с независимым подсчётом snapshot."
          :
          "Общие остатки procurement-real отличаются от независимого подсчёта.",

      details: {
        audit: {
          skuInSnapshot:
            stockRows.length,

          totalCurrentStock:
            auditTotalStock,

          totalToClient:
            auditTotalToClient,

          totalFromClient:
            auditTotalFromClient,
        },

        production: {
          skuInSnapshot:
            productionStocks.skuInSnapshot,

          totalCurrentStock:
            productionStocks.totalCurrentStock,

          totalToClient:
            productionStocks.totalToClient,

          totalFromClient:
            productionStocks.totalFromClient,
        },
      },
    });


    // ========================================================
    // 22. СРАВНЕНИЕ ПО SKU
    // ========================================================

    const productionTopNeed:
      Record<
        string,
        any
      >[] =
      Array.isArray(
        productionData.topNeed
      )
        ?
        productionData.topNeed
        :
        [];


    const productionNeedMap =
      new Map<
        number,
        Record<
          string,
          any
        >
      >();


    for (
      const row
      of productionTopNeed
    ) {

      const nmId =
        Number(
          row.nmId
        );


      if (
        Number.isFinite(
          nmId
        )
      ) {

        productionNeedMap.set(
          nmId,
          row
        );

      }

    }


    const rowsToCompare =
      auditNeedRows.slice(
        0,
        100
      );


    const skuMismatches:
      Record<
        string,
        unknown
      >[] =
      [];


    for (
      const auditRow
      of rowsToCompare
    ) {

      const productionRow =
        productionNeedMap.get(
          auditRow.nmId
        );


      if (!productionRow) {

        skuMismatches.push({
          nmId:
            auditRow.nmId,

          issue:
            "SKU отсутствует в production topNeed",
        });

        continue;

      }


      const mismatchedFields:
        string[] =
        [];


      if (
        auditRow.sales.ordersCount
        !==
        Number(
          productionRow
            ?.sales
            ?.ordersCount
        )
      ) {

        mismatchedFields.push(
          "sales.ordersCount"
        );

      }


      if (
        !approximatelyEqual(
          auditRow.sales.dailySales,
          Number(
            productionRow
              ?.sales
              ?.dailySales
          )
        )
      ) {

        mismatchedFields.push(
          "sales.dailySales"
        );

      }


      if (
        auditRow.stock.stockCount
        !==
        Number(
          productionRow
            ?.stock
            ?.stockCount
        )
      ) {

        mismatchedFields.push(
          "stock.stockCount"
        );

      }


      if (
        auditRow.stock.source
        !==
        productionRow
          ?.stock
          ?.source
      ) {

        mismatchedFields.push(
          "stock.source"
        );

      }


      const productionDays =
        productionRow
          ?.calculation
          ?.daysOfStock;


      const normalizedProductionDays =
        productionDays === null
        ||
        productionDays === undefined
          ?
          null
          :
          Number(
            productionDays
          );


      if (
        !approximatelyEqual(
          auditRow.calculation.daysOfStock,
          normalizedProductionDays
        )
      ) {

        mismatchedFields.push(
          "calculation.daysOfStock"
        );

      }


      if (
        !approximatelyEqual(
          auditRow.calculation.needRaw,
          Number(
            productionRow
              ?.calculation
              ?.needRaw
          )
        )
      ) {

        mismatchedFields.push(
          "calculation.needRaw"
        );

      }


      if (
        auditRow.calculation.needRoundedUp
        !==
        Number(
          productionRow
            ?.calculation
            ?.needRoundedUp
        )
      ) {

        mismatchedFields.push(
          "calculation.needRoundedUp"
        );

      }


      if (
        auditRow.calculation.rule
        !==
        productionRow
          ?.calculation
          ?.rule
      ) {

        mismatchedFields.push(
          "calculation.rule"
        );

      }


      if (
        mismatchedFields.length
        >
        0
      ) {

        skuMismatches.push({
          nmId:
            auditRow.nmId,

          fields:
            mismatchedFields,

          audit:
            auditRow,

          production:
            productionRow,
        });

      }

    }


    const fullPositiveCoverage =
      auditNeedRows.length
      <=
      100;


    const productionNeedCountCorrect =
      productionTopNeed.length
      ===
      Math.min(
        auditNeedRows.length,
        100
      );


    const skuComparisonPassed =
      skuMismatches.length
      ===
      0
      &&
      productionNeedCountCorrect;


    checks.push({
      code:
        "SKU_CALCULATION_COMPARISON",

      name:
        "Расчёт по каждому SKU",

      status:
        skuComparisonPassed
          ?
          (
            fullPositiveCoverage
              ?
              "PASS"
              :
              "WARN"
          )
          :
          "FAIL",

      message:
        skuComparisonPassed
          ?
          (
            fullPositiveCoverage
              ?
              "Все SKU с положительной потребностью полностью совпали с независимым расчётом."
              :
              "Первые 100 SKU совпали, но production ограничивает topNeed сотней строк."
          )
          :
          "Есть расхождения между независимым расчётом SKU и procurement-real.",

      details: {
        auditNeedSkuCount:
          auditNeedRows.length,

        productionTopNeedCount:
          productionTopNeed.length,

        comparedSku:
          rowsToCompare.length,

        fullPositiveCoverage,

        mismatchCount:
          skuMismatches.length,

        mismatchSample:
          skuMismatches.slice(
            0,
            30
          ),
      },
    });


    // ========================================================
    // 23. ABSENT FROM SNAPSHOT -> ZERO
    //
    // Здесь были проблемы типизации.
    // Теперь Set явно имеет тип number.
    // ========================================================

    const auditAssumedSet:
      Set<number> =
      new Set<number>(
        auditAssumedZeroRows.map(
          (row) =>
            Number(
              row.nmId
            )
        )
      );


    const productionAssumedRows:
      ProductionAssumedZeroRow[] =
      Array.isArray(
        productionData.assumedZeroFromAbsentSnapshot
      )
        ?
        productionData.assumedZeroFromAbsentSnapshot as ProductionAssumedZeroRow[]
        :
        [];


    const productionAssumedNmIds:
      number[] =
      productionAssumedRows
        .map(
          (row) =>
            Number(
              row.nmId
            )
        )
        .filter(
          (nmId) =>
            Number.isFinite(
              nmId
            )
        );


    const productionAssumedSet:
      Set<number> =
      new Set<number>(
        productionAssumedNmIds
      );


    const missingInProduction:
      number[] =
      Array.from(
        auditAssumedSet
      )
      .filter(
        (nmId: number) =>
          !productionAssumedSet.has(
            nmId
          )
      );


    const extraInProduction:
      number[] =
      Array.from(
        productionAssumedSet
      )
      .filter(
        (nmId: number) =>
          !auditAssumedSet.has(
            nmId
          )
      );


    const assumedZeroMatches =
      missingInProduction.length
      ===
      0
      &&
      extraInProduction.length
      ===
      0;


    const auditNmIdsSorted:
      number[] =
      Array.from(
        auditAssumedSet
      )
      .sort(
        (
          a: number,
          b: number
        ) =>
          a - b
      );


    const productionNmIdsSorted:
      number[] =
      Array.from(
        productionAssumedSet
      )
      .sort(
        (
          a: number,
          b: number
        ) =>
          a - b
      );


    checks.push({
      code:
        "ABSENT_STOCK_ZERO",

      name:
        "SKU вне FBW snapshot",

      status:
        assumedZeroMatches
          ?
          "PASS"
          :
          "FAIL",

      message:
        assumedZeroMatches
          ?
          "Набор SKU, которым присвоен FBW-остаток 0 из-за отсутствия в snapshot, совпадает полностью."
          :
          "Набор assumed-zero SKU отличается между аудитом и production.",

      details: {
        auditNmIds:
          auditNmIdsSorted,

        productionNmIds:
          productionNmIdsSorted,

        missingInProduction,

        extraInProduction,
      },
    });


    // ========================================================
    // 24. SOURCE ROWS
    // ========================================================

    const sourceRows =
      productionData.sourceRows
      ??
      {};


    const sourceRowsMatch =
      sourceRows.fbwOrdersInsidePeriod
      ===
      orders.length
      &&
      sourceRows.activeFbwOrders
      ===
      activeOrders.length
      &&
      sourceRows.cancelledFbwOrders
      ===
      cancelledOrders.length
      &&
      sourceRows.nullCancelFbwOrders
      ===
      nullCancelOrders.length
      &&
      sourceRows.stockSnapshotRows
      ===
      stockRows.length;


    checks.push({
      code:
        "SOURCE_ROWS_COMPARISON",

      name:
        "Исходные строки procurement-real",

      status:
        sourceRowsMatch
          ?
          "PASS"
          :
          "FAIL",

      message:
        sourceRowsMatch
          ?
          "Количество исходных строк production совпало с независимой загрузкой."
          :
          "Количество исходных строк production отличается от независимой загрузки.",

      details: {
        audit: {
          fbwOrdersInsidePeriod:
            orders.length,

          activeFbwOrders:
            activeOrders.length,

          cancelledFbwOrders:
            cancelledOrders.length,

          nullCancelFbwOrders:
            nullCancelOrders.length,

          stockSnapshotRows:
            stockRows.length,
        },

        production:
          sourceRows,
      },
    });


    // ========================================================
    // 25. ИТОГ
    // ========================================================

    const failedChecks =
      checks.filter(
        (check) =>
          check.status
          ===
          "FAIL"
      );


    const warningChecks =
      checks.filter(
        (check) =>
          check.status
          ===
          "WARN"
      );


    const passedChecks =
      checks.filter(
        (check) =>
          check.status
          ===
          "PASS"
      );


    const auditResult:
      "PASS" | "FAIL" =
      failedChecks.length
      ===
      0
        ?
        "PASS"
        :
        "FAIL";


    return NextResponse.json({

      ok:
        auditResult
        ===
        "PASS",


      auditResult,


      message:
        auditResult
        ===
        "PASS"
          ?
          "Полный аудит Wildberries пройден"
          :
          "Полный аудит Wildberries обнаружил ошибки",


      auditScope: {

        marketplace:
          "Wildberries",

        fulfillment:
          "FBW",

        salesDays:
          SALES_DAYS,

        period: {
          start:
            periodStart,

          end:
            periodEnd,
        },

        snapshotId,

        wildberriesExtraRequestSent:
          false,

        note:
          "Аудит проверяет рабочий procurement-real, исходные таблицы Supabase и сохранённые raw-ответы WB.",
      },


      resultSummary: {

        totalChecks:
          checks.length,

        passed:
          passedChecks.length,

        warnings:
          warningChecks.length,

        failed:
          failedChecks.length,

      },


      independentCalculation: {

        orders: {

          totalFbw:
            orders.length,

          active:
            activeOrders.length,

          cancelled:
            cancelledOrders.length,

          nullIsCancel:
            nullCancelOrders.length,

          pages:
            ordersResult.pages,
        },


        stocks: {

          skuInSnapshot:
            stockRows.length,

          totalCurrentStock:
            auditTotalStock,

          totalToClient:
            auditTotalToClient,

          totalFromClient:
            auditTotalFromClient,

          assumedZeroSku:
            auditAssumedZeroRows.length,

          pages:
            stockResult.pages,
        },


        summary:
          auditSummary,
      },


      productionCalculation: {

        sourceRows:
          productionData.sourceRows,

        stocks:
          productionData.stocks,

        summary:
          productionData.summary,

        orderDataValidation:
          productionData.orderDataValidation,
      },


      failedChecks:
        failedChecks.map(
          (check) => ({
            code:
              check.code,

            name:
              check.name,

            message:
              check.message,

            details:
              check.details,
          })
        ),


      warningChecks:
        warningChecks.map(
          (check) => ({
            code:
              check.code,

            name:
              check.name,

            message:
              check.message,

            details:
              check.details,
          })
        ),


      checks,

    });

  } catch (error) {

    console.error(
      "Ошибка WB full-audit:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        auditResult:
          "FAIL",

        message:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка полного аудита WB",

        checks,
      },
      {
        status:
          500,
      }
    );

  }

}
