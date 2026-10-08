import { NextResponse } from "next/server";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_DAYS = 28;
const PAGE_SIZE = 1000;

const OZON_MARKETPLACE = "ozon";
const WB_MARKETPLACE = "wildberries";
const ACCOUNT_KEY = "main";

const WB_FBW_WAREHOUSE_TYPE = "Склад WB";


// ============================================================
// ТИПЫ
// ============================================================

type OzonSalesSyncRun = {
  id: string;
  date_from: string;
  date_to: string;
  completed_days: number;
  status: string;
  postings_received: number;
  cancelled_postings: number;
  aggregated_rows_saved: number;
  created_at: string;
};


type ProductRow = {
  id: string;
  offer_id: string | null;
  master_code: string | null;
  is_active: boolean;
  supply_origin: string | null;
};


type MarketplaceListingRow = {
  marketplace: string;
  account_key: string;
  external_id: string;
  seller_article: string | null;
  master_code: string;
  is_active: boolean;
  china_procurement_enabled: boolean;
};


type OzonSalesRow = {
  product_id: string;
  cluster_id: string;
  sale_date: string;
  sales_quantity: number;
  cancelled_quantity: number;
};


type OzonStockRow = {
  product_id: string;
  cluster_id: string;
  quantity: number;
  snapshot_date: string;
};


type WbSyncState = {
  sync_key: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  next_allowed_at: string | null;
  last_http_status: number | null;
  retry_after_seconds: number | null;
  last_message: string | null;
  stage?: string | null;
  external_task_id?: string | null;
  last_snapshot_id?: string | null;
};


type WbOrderRow = {
  srid: string;
  order_date: string;
  nm_id: number;
  supplier_article: string | null;
  barcode: string | null;
  warehouse_type: string | null;
  is_cancel: boolean | null;
};


type WbStockRow = {
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
};


type OwnStockRow = {
  product_id: string;
  quantity: number;
  snapshot_date: string;
  imported_at: string | null;
};


type ResponsibleStorageRow = {
  product_id: string;
  quantity: number;
  snapshot_date: string;
};


type VedOrderRow = {
  id: string;
  workflow_status: string;
  arrival_confirmed_at: string | null;
  actual_arrival_date: string | null;
};


type VedOrderItemRow = {
  id: string;
  ved_order_id: string;
  product_id: string | null;
  quantity: number;
};


type OzonAggregate = {
  productIds: Set<string>;
  offerIds: Set<string>;
  sales28Days: number;
  cancelled28Days: number;
  stock: number;
};


type WbAggregate = {
  nmIds: Set<number>;
  sellerArticles: Set<string>;
  sales28Days: number;
  cancelled28Days: number;
  fbwStock: number;
  toClient: number;
  fromClient: number;
};


type InternalAggregate = {
  productIds: Set<string>;
  quantity: number;
};


type VedAggregate = {
  productIds: Set<string>;
  orderIds: Set<string>;
  quantity: number;
};


// ============================================================
// SUPABASE
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


function getHeaders() {
  const {
    supabaseKey,
  } = getSupabaseConfig();

  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: "application/json",
  };
}


// ============================================================
// JSON
// ============================================================

async function readJsonResponse<T>(
  response: Response
): Promise<T> {
  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase HTTP ${response.status}: ${text}`
    );
  }

  return JSON.parse(text) as T;
}


// ============================================================
// PAGINATION
// ============================================================

async function supabaseGetAll<T>(
  basePath: string,
  orderBy: string
): Promise<{
  rows: T[];
  pages: number;
}> {
  const {
    supabaseUrl,
  } = getSupabaseConfig();

  const rows: T[] = [];

  let from = 0;
  let pages = 0;

  while (true) {
    const separator =
      basePath.includes("?")
        ? "&"
        : "?";

    const url =
      `${supabaseUrl}/rest/v1/${basePath}`
      +
      `${separator}order=${encodeURIComponent(orderBy)}`;

    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            ...getHeaders(),

            Range:
              `${from}-${from + PAGE_SIZE - 1}`,
          },

          cache: "no-store",
        }
      );

    const page =
      await readJsonResponse<T[]>(
        response
      );

    rows.push(
      ...page
    );

    pages += 1;

    if (
      page.length
      <
      PAGE_SIZE
    ) {
      break;
    }

    from += PAGE_SIZE;
  }

  return {
    rows,
    pages,
  };
}


// ============================================================
// EXACT COUNT
// ============================================================

async function supabaseExactCount(
  basePath: string
): Promise<number> {
  const {
    supabaseUrl,
  } = getSupabaseConfig();

  const separator =
    basePath.includes("?")
      ? "&"
      : "?";

  const url =
    `${supabaseUrl}/rest/v1/${basePath}`
    +
    `${separator}limit=1`;

  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {
          ...getHeaders(),

          Prefer: "count=exact",

          Range: "0-0",
        },

        cache: "no-store",
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Не удалось получить exact count. HTTP ${response.status}: ${text}`
    );
  }

  const contentRange =
    response.headers.get(
      "content-range"
    );

  if (!contentRange) {
    throw new Error(
      "Supabase не вернул content-range"
    );
  }

  const match =
    contentRange.match(
      /\/(\d+)$/
    );

  if (!match) {
    throw new Error(
      `Не удалось разобрать content-range: ${contentRange}`
    );
  }

  return Number(
    match[1]
  );
}


// ============================================================
// SINGLE QUERY
// ============================================================

async function supabaseGetRows<T>(
  path: string
): Promise<T[]> {
  const {
    supabaseUrl,
  } = getSupabaseConfig();

  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
      {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      }
    );

  return readJsonResponse<T[]>(
    response
  );
}


// ============================================================
// ДАТЫ
// ============================================================

function addDaysToDate(
  dateString: string,
  days: number
): string {
  const date =
    new Date(
      `${dateString}T00:00:00Z`
    );

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    throw new Error(
      `Некорректная дата: ${dateString}`
    );
  }

  date.setUTCDate(
    date.getUTCDate()
    +
    days
  );

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}


function inclusiveDays(
  dateFrom: string,
  dateTo: string
): number {
  const from =
    new Date(
      `${dateFrom}T00:00:00Z`
    );

  const to =
    new Date(
      `${dateTo}T00:00:00Z`
    );

  return (
    Math.round(
      (
        to.getTime()
        -
        from.getTime()
      )
      /
      (
        24
        *
        60
        *
        60
        *
        1000
      )
    )
    +
    1
  );
}


function moscowDayStartIso(
  dateString: string
): string {
  return new Date(
    `${dateString}T00:00:00+03:00`
  ).toISOString();
}


function datePartFromTimestamp(
  timestamp: string
): string {
  return timestamp.slice(
    0,
    10
  );
}


// ============================================================
// SAFE NUMBER
// ============================================================

function safeInteger(
  value: unknown
): number {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.trunc(
    number
  );
}


function safeNonNegativeInteger(
  value: unknown
): number {
  return Math.max(
    0,
    safeInteger(
      value
    )
  );
}


// ============================================================
// LATEST OZON SALES RUN
// ============================================================

async function getLatestOzonSalesRun():
Promise<OzonSalesSyncRun | null> {
  const rows =
    await supabaseGetRows<
      OzonSalesSyncRun
    >(
      "ozon_sales_sync_runs"
      +
      "?select=id,date_from,date_to,completed_days,status,postings_received,cancelled_postings,aggregated_rows_saved,created_at"
      +
      "&status=eq.success"
      +
      "&order=date_to.desc,created_at.desc"
      +
      "&limit=1"
    );

  return (
    rows[0]
    ??
    null
  );
}


// ============================================================
// LATEST SNAPSHOT DATE
// ============================================================

async function getLatestSnapshotDate(
  tableName: string
): Promise<string | null> {
  const rows =
    await supabaseGetRows<{
      snapshot_date: string;
    }>(
      `${tableName}`
      +
      "?select=snapshot_date"
      +
      "&order=snapshot_date.desc"
      +
      "&limit=1"
    );

  return (
    rows[0]
      ?.snapshot_date
    ??
    null
  );
}


// ============================================================
// WB SYNC STATES
// ============================================================

async function getWbSyncStates():
Promise<{
  orders: WbSyncState | null;
  stocks: WbSyncState | null;
}> {
  const rows =
    await supabaseGetRows<
      WbSyncState
    >(
      "wb_sync_state"
      +
      "?select=*"
      +
      "&sync_key=in.(orders,stocks)"
    );

  return {
    orders:
      rows.find(
        (row) =>
          row.sync_key
          ===
          "orders"
      )
      ??
      null,

    stocks:
      rows.find(
        (row) =>
          row.sync_key
          ===
          "stocks"
      )
      ??
      null,
  };
}


// ============================================================
// STOCK BRIDGE ДЛЯ ARRIVED ВЭД
// ============================================================

async function hasOwnStockSnapshotAfterArrival(
  arrivalConfirmedAt: string,
  actualArrivalDate: string | null
): Promise<boolean> {
  const arrivalDate =
    actualArrivalDate
    ??
    datePartFromTimestamp(
      arrivalConfirmedAt
    );

  const rows =
    await supabaseGetRows<{
      product_id: string;
    }>(
      "own_stock_snapshots"
      +
      "?select=product_id"
      +
      `&imported_at=gt.${encodeURIComponent(
        arrivalConfirmedAt
      )}`
      +
      `&snapshot_date=gte.${encodeURIComponent(
        arrivalDate
      )}`
      +
      "&limit=1"
    );

  return (
    rows.length
    >
    0
  );
}


// ============================================================
// EMPTY AGGREGATES
// ============================================================

function createOzonAggregate():
OzonAggregate {
  return {
    productIds:
      new Set<string>(),

    offerIds:
      new Set<string>(),

    sales28Days:
      0,

    cancelled28Days:
      0,

    stock:
      0,
  };
}


function createWbAggregate():
WbAggregate {
  return {
    nmIds:
      new Set<number>(),

    sellerArticles:
      new Set<string>(),

    sales28Days:
      0,

    cancelled28Days:
      0,

    fbwStock:
      0,

    toClient:
      0,

    fromClient:
      0,
  };
}


function createInternalAggregate():
InternalAggregate {
  return {
    productIds:
      new Set<string>(),

    quantity:
      0,
  };
}


function createVedAggregate():
VedAggregate {
  return {
    productIds:
      new Set<string>(),

    orderIds:
      new Set<string>(),

    quantity:
      0,
  };
}


// ============================================================
// GET
// ============================================================

export async function GET() {
  try {

    // ========================================================
    // 1. ЕДИНЫЙ 28-ДНЕВНЫЙ ПЕРИОД
    // ========================================================

    const ozonSalesRun =
      await getLatestOzonSalesRun();

    if (!ozonSalesRun) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не найден успешный 28-дневный sync продаж Ozon",
        },
        {
          status: 409,
        }
      );
    }


    const actualPeriodDays =
      inclusiveDays(
        ozonSalesRun.date_from,
        ozonSalesRun.date_to
      );


    if (
      ozonSalesRun.completed_days
      !==
      SALES_DAYS
      ||
      actualPeriodDays
      !==
      SALES_DAYS
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Последний успешный период Ozon не равен 28 календарным дням",

          period: {
            dateFrom:
              ozonSalesRun.date_from,

            dateTo:
              ozonSalesRun.date_to,

            completedDays:
              ozonSalesRun.completed_days,

            actualCalendarDays:
              actualPeriodDays,
          },
        },
        {
          status: 409,
        }
      );
    }


    const periodDateFrom =
      ozonSalesRun.date_from;

    const periodDateTo =
      ozonSalesRun.date_to;


    const wbPeriodStartIso =
      moscowDayStartIso(
        periodDateFrom
      );


    const wbEndExclusiveDate =
      addDaysToDate(
        periodDateTo,
        1
      );


    const wbPeriodEndExclusiveIso =
      moscowDayStartIso(
        wbEndExclusiveDate
      );


    // ========================================================
    // 2. WB SYNC STATE
    // ========================================================

    const wbStates =
      await getWbSyncStates();


    if (
      !wbStates.orders
        ?.last_success_at
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Нет успешной синхронизации заказов Wildberries",
        },
        {
          status: 409,
        }
      );
    }


    if (
      !wbStates.stocks
        ?.last_success_at
      ||
      !wbStates.stocks
        ?.last_snapshot_id
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Нет успешного актуального snapshot остатков Wildberries",
        },
        {
          status: 409,
        }
      );
    }


    const wbOrdersSyncTime =
      new Date(
        wbStates.orders
          .last_success_at
      ).getTime();


    const requiredWbCoverageTime =
      new Date(
        wbPeriodEndExclusiveIso
      ).getTime();


    if (
      !Number.isFinite(
        wbOrdersSyncTime
      )
      ||
      wbOrdersSyncTime
      <
      requiredWbCoverageTime
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Заказы Wildberries не синхронизированы до конца общего 28-дневного периода",

          wildberries: {
            ordersLastSuccessAt:
              wbStates.orders
                .last_success_at,

            requiredThrough:
              wbPeriodEndExclusiveIso,
          },
        },
        {
          status: 409,
        }
      );
    }


    const wbSnapshotId =
      wbStates.stocks
        .last_snapshot_id;


    // ========================================================
    // 3. ДАТЫ ОСТАТКОВ
    // ========================================================

    const [
      ozonStockDate,
      ownStockDate,
      responsibleStorageDate,
    ] =
      await Promise.all([
        getLatestSnapshotDate(
          "ozon_stock_snapshots"
        ),

        getLatestSnapshotDate(
          "own_stock_snapshots"
        ),

        getLatestSnapshotDate(
          "responsible_storage_stock_snapshots"
        ),
      ]);


    if (!ozonStockDate) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не найден snapshot остатков Ozon",
        },
        {
          status: 409,
        }
      );
    }


    if (!ownStockDate) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не найден snapshot основного склада",
        },
        {
          status: 409,
        }
      );
    }


    if (!responsibleStorageDate) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не найден snapshot ответственного хранения",
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // 4. ВСЕ PRODUCTS
    //
    // Нужны:
    // - product_id → master_code
    // - active Ozon catalog
    // - active own_import product
    // ========================================================

    const productsPath =
      "products"
      +
      "?select=id,offer_id,master_code,is_active,supply_origin";


    const productsExactCount =
      await supabaseExactCount(
        productsPath
      );


    const productsResult =
      await supabaseGetAll<
        ProductRow
      >(
        productsPath,
        "id.asc"
      );


    if (
      productsResult.rows.length
      !==
      productsExactCount
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не все строки products были загружены",

          exactCount:
            productsExactCount,

          loaded:
            productsResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }


    const productIdToMasterCode =
      new Map<
        string,
        string
      >();


    const activeProducts:
      ProductRow[] =
      [];


    const procurementProductsByMasterCode =
      new Map<
        string,
        ProductRow[]
      >();


    for (
      const product
      of productsResult.rows
    ) {
      const masterCode =
        product.master_code
          ?.trim()
        ??
        "";


      if (masterCode) {
        productIdToMasterCode.set(
          product.id,
          masterCode
        );
      }


      if (
        product.is_active
        ===
        true
      ) {
        activeProducts.push(
          product
        );
      }


      if (
        product.is_active
        ===
        true
        &&
        product.supply_origin
        ===
        "own_import"
        &&
        masterCode
      ) {
        const current =
          procurementProductsByMasterCode.get(
            masterCode
          )
          ??
          [];

        current.push(
          product
        );

        procurementProductsByMasterCode.set(
          masterCode,
          current
        );
      }
    }


    const duplicateProcurementMasterCodes =
      Array.from(
        procurementProductsByMasterCode.entries()
      )
        .filter(
          (
            [
              ,
              rows,
            ]
          ) =>
            rows.length
            >
            1
        )
        .map(
          (
            [
              masterCode,
              rows,
            ]
          ) => ({
            masterCode,

            productIds:
              rows.map(
                (row) =>
                  row.id
              ),

            offerIds:
              rows.map(
                (row) =>
                  row.offer_id
              ),
          })
        );


    if (
      duplicateProcurementMasterCodes.length
      >
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Для одного master_code найдено несколько активных own_import товаров",

          duplicates:
            duplicateProcurementMasterCodes,
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // 5. OZON MARKETPLACE LISTINGS
    // ========================================================

    const ozonListingsPath =
      "marketplace_listings"
      +
      "?select=marketplace,account_key,external_id,seller_article,master_code,is_active,china_procurement_enabled"
      +
      `&marketplace=eq.${OZON_MARKETPLACE}`
      +
      `&account_key=eq.${ACCOUNT_KEY}`
      +
      "&is_active=eq.true";


    const ozonListingsExactCount =
      await supabaseExactCount(
        ozonListingsPath
      );


    const ozonListingsResult =
      await supabaseGetAll<
        MarketplaceListingRow
      >(
        ozonListingsPath,
        "external_id.asc"
      );


    if (
      ozonListingsResult.rows.length
      !==
      ozonListingsExactCount
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не все Ozon marketplace_listings были загружены",

          exactCount:
            ozonListingsExactCount,

          loaded:
            ozonListingsResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }


    const ozonListingByOfferId =
      new Map<
        string,
        MarketplaceListingRow
      >();


    for (
      const listing
      of ozonListingsResult.rows
    ) {
      ozonListingByOfferId.set(
        listing.external_id.trim(),
        listing
      );
    }


    // ========================================================
    // 6. OZON PRODUCT → MASTER_CODE
    // ========================================================

    const ozonMissingMappings: Array<{
      productId: string;
      offerId: string | null;
      masterCode: string | null;
    }> = [];


    const ozonMasterCodeMismatches: Array<{
      productId: string;
      offerId: string;
      productMasterCode: string;
      listingMasterCode: string;
    }> = [];


    const ozonProductIdToMasterCode =
      new Map<
        string,
        string
      >();


    const ozonByMasterCode =
      new Map<
        string,
        OzonAggregate
      >();


    let ozonChinaDisabledProducts =
      0;


    for (
      const product
      of activeProducts
    ) {
      const offerId =
        product.offer_id
          ?.trim()
        ??
        "";


      const productMasterCode =
        product.master_code
          ?.trim()
        ??
        "";


      if (
        !offerId
        ||
        !productMasterCode
      ) {
        ozonMissingMappings.push(
          {
            productId:
              product.id,

            offerId:
              product.offer_id,

            masterCode:
              product.master_code,
          }
        );

        continue;
      }


      const listing =
        ozonListingByOfferId.get(
          offerId
        );


      if (!listing) {
        ozonMissingMappings.push(
          {
            productId:
              product.id,

            offerId:
              product.offer_id,

            masterCode:
              product.master_code,
          }
        );

        continue;
      }


      if (
        listing.master_code.trim()
        !==
        productMasterCode
      ) {
        ozonMasterCodeMismatches.push(
          {
            productId:
              product.id,

            offerId,

            productMasterCode,

            listingMasterCode:
              listing.master_code,
          }
        );

        continue;
      }


      if (
        listing.china_procurement_enabled
        !==
        true
      ) {
        ozonChinaDisabledProducts +=
          1;

        continue;
      }


      ozonProductIdToMasterCode.set(
        product.id,
        listing.master_code
      );


      const current =
        ozonByMasterCode.get(
          listing.master_code
        )
        ??
        createOzonAggregate();


      current.productIds.add(
        product.id
      );


      current.offerIds.add(
        offerId
      );


      ozonByMasterCode.set(
        listing.master_code,
        current
      );
    }


    if (
      ozonMissingMappings.length
      >
      0
      ||
      ozonMasterCodeMismatches.length
      >
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Обнаружена проблема в Ozon → master_code mapping",

          missingMappings:
            ozonMissingMappings,

          masterCodeMismatches:
            ozonMasterCodeMismatches,
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // 7. OZON SALES
    // ========================================================

    const ozonSalesPath =
      "ozon_sales_daily"
      +
      "?select=product_id,cluster_id,sale_date,sales_quantity,cancelled_quantity"
      +
      `&sale_date=gte.${periodDateFrom}`
      +
      `&sale_date=lte.${periodDateTo}`;


    const ozonSalesExactCount =
      await supabaseExactCount(
        ozonSalesPath
      );


    const ozonSalesResult =
      await supabaseGetAll<
        OzonSalesRow
      >(
        ozonSalesPath,
        "sale_date.asc,product_id.asc,cluster_id.asc"
      );


    if (
      ozonSalesResult.rows.length
      !==
      ozonSalesExactCount
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не все строки продаж Ozon были загружены",

          exactCount:
            ozonSalesExactCount,

          loaded:
            ozonSalesResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }


    let ozonUnmappedSalesRows =
      0;


    for (
      const row
      of ozonSalesResult.rows
    ) {
      const masterCode =
        ozonProductIdToMasterCode.get(
          row.product_id
        );


      if (!masterCode) {
        ozonUnmappedSalesRows +=
          1;

        continue;
      }


      const current =
        ozonByMasterCode.get(
          masterCode
        )
        ??
        createOzonAggregate();


      current.sales28Days +=
        safeNonNegativeInteger(
          row.sales_quantity
        );


      current.cancelled28Days +=
        safeNonNegativeInteger(
          row.cancelled_quantity
        );


      ozonByMasterCode.set(
        masterCode,
        current
      );
    }


    // ========================================================
    // 8. OZON STOCK
    // ========================================================

    const ozonStockPath =
      "ozon_stock_snapshots"
      +
      "?select=product_id,cluster_id,quantity,snapshot_date"
      +
      `&snapshot_date=eq.${ozonStockDate}`;


    const ozonStockExactCount =
      await supabaseExactCount(
        ozonStockPath
      );


    const ozonStockResult =
      await supabaseGetAll<
        OzonStockRow
      >(
        ozonStockPath,
        "product_id.asc,cluster_id.asc"
      );


    if (
      ozonStockResult.rows.length
      !==
      ozonStockExactCount
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не все строки остатков Ozon были загружены",

          exactCount:
            ozonStockExactCount,

          loaded:
            ozonStockResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }


    let ozonUnmappedStockRows =
      0;


    for (
      const row
      of ozonStockResult.rows
    ) {
      const masterCode =
        ozonProductIdToMasterCode.get(
          row.product_id
        );


      if (!masterCode) {
        ozonUnmappedStockRows +=
          1;

        continue;
      }


      const current =
        ozonByMasterCode.get(
          masterCode
        )
        ??
        createOzonAggregate();


      current.stock +=
        safeNonNegativeInteger(
          row.quantity
        );


      ozonByMasterCode.set(
        masterCode,
        current
      );
    }


    // ========================================================
    // 9. WB LISTINGS
    // ========================================================

    const wbListingsPath =
      "marketplace_listings"
      +
      "?select=marketplace,account_key,external_id,seller_article,master_code,is_active,china_procurement_enabled"
      +
      `&marketplace=eq.${WB_MARKETPLACE}`
      +
      `&account_key=eq.${ACCOUNT_KEY}`
      +
      "&is_active=eq.true";


    const wbListingsResult =
      await supabaseGetAll<
        MarketplaceListingRow
      >(
        wbListingsPath,
        "external_id.asc"
      );


    const wbListingByNmId =
      new Map<
        string,
        MarketplaceListingRow
      >();


    for (
      const listing
      of wbListingsResult.rows
    ) {
      wbListingByNmId.set(
        listing.external_id.trim(),
        listing
      );
    }


    // ========================================================
    // 10. CURRENT WB STOCK SNAPSHOT
    // ========================================================

    const wbStockPath =
      "wb_stock_product_snapshots"
      +
      "?select=snapshot_id,snapshot_at,nm_id,vendor_code,product_name,brand_name,stock_count,to_client_count,from_client_count,availability"
      +
      `&snapshot_id=eq.${encodeURIComponent(
        wbSnapshotId
      )}`;


    const wbStockExactCount =
      await supabaseExactCount(
        wbStockPath
      );


    const wbStockResult =
      await supabaseGetAll<
        WbStockRow
      >(
        wbStockPath,
        "nm_id.asc"
      );


    if (
      wbStockResult.rows.length
      !==
      wbStockExactCount
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не все строки текущего WB snapshot были загружены",

          exactCount:
            wbStockExactCount,

          loaded:
            wbStockResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }


    const wbCurrentSeenNmIds =
      new Set<number>();


    const wbDuplicateCurrentNmIds:
      number[] =
      [];


    const wbCurrentUnmapped: Array<{
      nmId: number;
      vendorCode: string | null;
    }> = [];


    const wbChinaDisabled: Array<{
      nmId: number;
      masterCode: string;
      sellerArticle: string | null;
    }> = [];


    const wbNmIdToMasterCode =
      new Map<
        number,
        string
      >();


    const wbByMasterCode =
      new Map<
        string,
        WbAggregate
      >();


    for (
      const stock
      of wbStockResult.rows
    ) {
      const nmId =
        Number(
          stock.nm_id
        );


      if (
        wbCurrentSeenNmIds.has(
          nmId
        )
      ) {
        wbDuplicateCurrentNmIds.push(
          nmId
        );
      }


      wbCurrentSeenNmIds.add(
        nmId
      );


      const listing =
        wbListingByNmId.get(
          String(
            nmId
          )
        );


      if (!listing) {
        wbCurrentUnmapped.push(
          {
            nmId,

            vendorCode:
              stock.vendor_code,
          }
        );

        continue;
      }


      if (
        listing.china_procurement_enabled
        !==
        true
      ) {
        wbChinaDisabled.push(
          {
            nmId,

            masterCode:
              listing.master_code,

            sellerArticle:
              listing.seller_article,
          }
        );

        continue;
      }


      wbNmIdToMasterCode.set(
        nmId,
        listing.master_code
      );


      const current =
        wbByMasterCode.get(
          listing.master_code
        )
        ??
        createWbAggregate();


      current.nmIds.add(
        nmId
      );


      if (
        listing.seller_article
      ) {
        current.sellerArticles.add(
          listing.seller_article
        );
      }


      current.fbwStock +=
        safeNonNegativeInteger(
          stock.stock_count
        );


      current.toClient +=
        safeNonNegativeInteger(
          stock.to_client_count
        );


      current.fromClient +=
        safeNonNegativeInteger(
          stock.from_client_count
        );


      wbByMasterCode.set(
        listing.master_code,
        current
      );
    }


    if (
      wbDuplicateCurrentNmIds.length
      >
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "В текущем WB snapshot есть повторяющиеся nmID",

          duplicateNmIds:
            wbDuplicateCurrentNmIds,
        },
        {
          status: 409,
        }
      );
    }


    if (
      wbCurrentUnmapped.length
      >
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не все текущие WB SKU связаны с master_code",

          unmapped:
            wbCurrentUnmapped,
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // 11. WB ORDERS
    // ========================================================

    const wbOrdersPath =
      "wb_orders"
      +
      "?select=srid,order_date,nm_id,supplier_article,barcode,warehouse_type,is_cancel"
      +
      `&warehouse_type=eq.${encodeURIComponent(
        WB_FBW_WAREHOUSE_TYPE
      )}`
      +
      `&order_date=gte.${encodeURIComponent(
        wbPeriodStartIso
      )}`
      +
      `&order_date=lt.${encodeURIComponent(
        wbPeriodEndExclusiveIso
      )}`;


    const wbOrdersExactCount =
      await supabaseExactCount(
        wbOrdersPath
      );


    const wbOrdersResult =
      await supabaseGetAll<
        WbOrderRow
      >(
        wbOrdersPath,
        "order_date.asc,srid.asc"
      );


    if (
      wbOrdersResult.rows.length
      !==
      wbOrdersExactCount
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не все WB заказы общего периода были загружены",

          exactCount:
            wbOrdersExactCount,

          loaded:
            wbOrdersResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }


    const wbSeenSrids =
      new Set<string>();


    const wbDuplicateSrids =
      new Set<string>();


    let wbNullIsCancel =
      0;


    let wbOrdersExcludedByChinaFlag =
      0;


    let wbOrdersOutsideCurrentCatalog =
      0;


    for (
      const order
      of wbOrdersResult.rows
    ) {
      if (
        wbSeenSrids.has(
          order.srid
        )
      ) {
        wbDuplicateSrids.add(
          order.srid
        );
      }


      wbSeenSrids.add(
        order.srid
      );


      if (
        order.is_cancel
        ===
        null
      ) {
        wbNullIsCancel +=
          1;

        continue;
      }


      const nmId =
        Number(
          order.nm_id
        );


      const masterCode =
        wbNmIdToMasterCode.get(
          nmId
        );


      if (!masterCode) {
        const listing =
          wbListingByNmId.get(
            String(
              nmId
            )
          );


        if (
          listing
          &&
          listing.china_procurement_enabled
          ===
          false
        ) {
          wbOrdersExcludedByChinaFlag +=
            1;
        } else {
          wbOrdersOutsideCurrentCatalog +=
            1;
        }

        continue;
      }


      const current =
        wbByMasterCode.get(
          masterCode
        )
        ??
        createWbAggregate();


      if (
        order.is_cancel
        ===
        true
      ) {
        current.cancelled28Days +=
          1;
      } else {
        current.sales28Days +=
          1;
      }


      wbByMasterCode.set(
        masterCode,
        current
      );
    }


    if (
      wbDuplicateSrids.size
      >
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "В WB orders обнаружены повторяющиеся srid",

          duplicateCount:
            wbDuplicateSrids.size,

          sample:
            Array.from(
              wbDuplicateSrids
            ).slice(
              0,
              20
            ),
        },
        {
          status: 409,
        }
      );
    }


    if (
      wbNullIsCancel
      >
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "В WB orders обнаружен is_cancel = null",

          rows:
            wbNullIsCancel,
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // 12. ОСНОВНОЙ СКЛАД
    // ========================================================

    const ownStockPath =
      "own_stock_snapshots"
      +
      "?select=product_id,quantity,snapshot_date,imported_at"
      +
      `&snapshot_date=eq.${ownStockDate}`;


    const ownStockExactCount =
      await supabaseExactCount(
        ownStockPath
      );


    const ownStockResult =
      await supabaseGetAll<
        OwnStockRow
      >(
        ownStockPath,
        "product_id.asc"
      );


    if (
      ownStockResult.rows.length
      !==
      ownStockExactCount
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не все строки основного склада были загружены",

          exactCount:
            ownStockExactCount,

          loaded:
            ownStockResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }


    const ownStockByMasterCode =
      new Map<
        string,
        InternalAggregate
      >();


    let ownStockRowsWithoutMasterCode =
      0;


    for (
      const row
      of ownStockResult.rows
    ) {
      const masterCode =
        productIdToMasterCode.get(
          row.product_id
        );


      if (!masterCode) {
        ownStockRowsWithoutMasterCode +=
          1;

        continue;
      }


      const current =
        ownStockByMasterCode.get(
          masterCode
        )
        ??
        createInternalAggregate();


      current.productIds.add(
        row.product_id
      );


      current.quantity +=
        safeNonNegativeInteger(
          row.quantity
        );


      ownStockByMasterCode.set(
        masterCode,
        current
      );
    }


    // ========================================================
    // 13. ОТВЕТСТВЕННОЕ ХРАНЕНИЕ
    // ========================================================

    const responsibleStoragePath =
      "responsible_storage_stock_snapshots"
      +
      "?select=product_id,quantity,snapshot_date"
      +
      `&snapshot_date=eq.${responsibleStorageDate}`;


    const responsibleStorageExactCount =
      await supabaseExactCount(
        responsibleStoragePath
      );


    const responsibleStorageResult =
      await supabaseGetAll<
        ResponsibleStorageRow
      >(
        responsibleStoragePath,
        "product_id.asc"
      );


    if (
      responsibleStorageResult.rows.length
      !==
      responsibleStorageExactCount
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не все строки ответственного хранения были загружены",

          exactCount:
            responsibleStorageExactCount,

          loaded:
            responsibleStorageResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }


    const responsibleStorageByMasterCode =
      new Map<
        string,
        InternalAggregate
      >();


    let responsibleStorageRowsWithoutMasterCode =
      0;


    for (
      const row
      of responsibleStorageResult.rows
    ) {
      const masterCode =
        productIdToMasterCode.get(
          row.product_id
        );


      if (!masterCode) {
        responsibleStorageRowsWithoutMasterCode +=
          1;

        continue;
      }


      const current =
        responsibleStorageByMasterCode.get(
          masterCode
        )
        ??
        createInternalAggregate();


      current.productIds.add(
        row.product_id
      );


      current.quantity +=
        safeNonNegativeInteger(
          row.quantity
        );


      responsibleStorageByMasterCode.set(
        masterCode,
        current
      );
    }


    // ========================================================
    // 14. ВЭД: ЗАКАЗЫ
    // ========================================================

    const vedOrdersPath =
      "ved_orders"
      +
      "?select=id,workflow_status,arrival_confirmed_at,actual_arrival_date"
      +
      "&workflow_status=in.(production_confirmed,in_transit,arrived)";


    const vedOrdersResult =
      await supabaseGetAll<
        VedOrderRow
      >(
        vedOrdersPath,
        "id.asc"
      );


    const activeVedOrderIds =
      new Set<string>();


    let productionConfirmedOrders =
      0;


    let inTransitOrders =
      0;


    let arrivedBridgeActiveOrders =
      0;


    let arrivedBridgeCompletedOrders =
      0;


    for (
      const order
      of vedOrdersResult.rows
    ) {
      if (
        order.workflow_status
        ===
        "production_confirmed"
      ) {
        productionConfirmedOrders +=
          1;

        activeVedOrderIds.add(
          order.id
        );

        continue;
      }


      if (
        order.workflow_status
        ===
        "in_transit"
      ) {
        inTransitOrders +=
          1;

        activeVedOrderIds.add(
          order.id
        );

        continue;
      }


      if (
        order.workflow_status
        ===
        "arrived"
      ) {
        if (
          !order.arrival_confirmed_at
        ) {
          arrivedBridgeCompletedOrders +=
            1;

          continue;
        }


        const bridgeCompleted =
          await hasOwnStockSnapshotAfterArrival(
            order.arrival_confirmed_at,
            order.actual_arrival_date
          );


        if (bridgeCompleted) {
          arrivedBridgeCompletedOrders +=
            1;
        } else {
          arrivedBridgeActiveOrders +=
            1;

          activeVedOrderIds.add(
            order.id
          );
        }
      }
    }


    // ========================================================
    // 15. ВЭД: ПОЗИЦИИ
    // ========================================================

    const vedItemsPath =
      "ved_order_items"
      +
      "?select=id,ved_order_id,product_id,quantity"
      +
      "&quantity=gt.0";


    const vedItemsResult =
      await supabaseGetAll<
        VedOrderItemRow
      >(
        vedItemsPath,
        "id.asc"
      );


    const activeVedByMasterCode =
      new Map<
        string,
        VedAggregate
      >();


    let activeVedItemsWithoutProductId =
      0;


    let activeVedItemsWithoutMasterCode =
      0;


    let activeVedItemsIncluded =
      0;


    for (
      const item
      of vedItemsResult.rows
    ) {
      if (
        !activeVedOrderIds.has(
          item.ved_order_id
        )
      ) {
        continue;
      }


      if (!item.product_id) {
        activeVedItemsWithoutProductId +=
          1;

        continue;
      }


      const masterCode =
        productIdToMasterCode.get(
          item.product_id
        );


      if (!masterCode) {
        activeVedItemsWithoutMasterCode +=
          1;

        continue;
      }


      const current =
        activeVedByMasterCode.get(
          masterCode
        )
        ??
        createVedAggregate();


      current.productIds.add(
        item.product_id
      );


      current.orderIds.add(
        item.ved_order_id
      );


      current.quantity +=
        safeNonNegativeInteger(
          item.quantity
        );


      activeVedByMasterCode.set(
        masterCode,
        current
      );


      activeVedItemsIncluded +=
        1;
    }


    // ========================================================
    // 16. MARKETPLACE MASTER CODES
    //
    // Пока каталог общего источника оставляем тем же:
    // Ozon + текущий China-enabled WB.
    //
    // Внутренние остатки и ВЭД добавляются к этим master_code.
    // ========================================================

    const allMasterCodes =
      new Set<string>();


    for (
      const masterCode
      of ozonByMasterCode.keys()
    ) {
      allMasterCodes.add(
        masterCode
      );
    }


    for (
      const masterCode
      of wbByMasterCode.keys()
    ) {
      allMasterCodes.add(
        masterCode
      );
    }


    // ========================================================
    // 17. ДИАГНОСТИКА ВНУТРЕННИХ MASTER_CODE
    //     ВНЕ ТЕКУЩЕГО MARKETPLACE-КАТАЛОГА
    // ========================================================

    const ownStockOutsideMarketplaceCatalog =
      Array.from(
        ownStockByMasterCode.keys()
      )
        .filter(
          (masterCode) =>
            !allMasterCodes.has(
              masterCode
            )
        );


    const responsibleStorageOutsideMarketplaceCatalog =
      Array.from(
        responsibleStorageByMasterCode.keys()
      )
        .filter(
          (masterCode) =>
            !allMasterCodes.has(
              masterCode
            )
        );


    const activeVedOutsideMarketplaceCatalog =
      Array.from(
        activeVedByMasterCode.keys()
      )
        .filter(
          (masterCode) =>
            !allMasterCodes.has(
              masterCode
            )
        );


    // ========================================================
    // 18. ITEMS
    // ========================================================

    const items =
      Array.from(
        allMasterCodes
      )
        .sort(
          (
            left,
            right
          ) =>
            left.localeCompare(
              right
            )
        )
        .map(
          (masterCode) => {
            const ozon =
              ozonByMasterCode.get(
                masterCode
              )
              ??
              createOzonAggregate();


            const wb =
              wbByMasterCode.get(
                masterCode
              )
              ??
              createWbAggregate();


            const own =
              ownStockByMasterCode.get(
                masterCode
              )
              ??
              createInternalAggregate();


            const responsible =
              responsibleStorageByMasterCode.get(
                masterCode
              )
              ??
              createInternalAggregate();


            const ved =
              activeVedByMasterCode.get(
                masterCode
              )
              ??
              createVedAggregate();


            const procurementProducts =
              procurementProductsByMasterCode.get(
                masterCode
              )
              ??
              [];


            const ozonSales28Days =
              ozon.sales28Days;


            const wbSales28Days =
              wb.sales28Days;


            const totalSales28Days =
              ozonSales28Days
              +
              wbSales28Days;


            const totalCancelled28Days =
              ozon.cancelled28Days
              +
              wb.cancelled28Days;


            const marketplaceStock =
              ozon.stock
              +
              wb.fbwStock;


            const internalStock =
              own.quantity
              +
              responsible.quantity;


            const physicalStock =
              marketplaceStock
              +
              internalStock;


            const effectiveStock =
              physicalStock
              +
              ved.quantity;


            return {
              masterCode,


              procurement: {
                hasActiveOwnImportProduct:
                  procurementProducts.length
                  >
                  0,

                productIds:
                  procurementProducts.map(
                    (row) =>
                      row.id
                  ),

                offerIds:
                  procurementProducts
                    .map(
                      (row) =>
                        row.offer_id
                    )
                    .filter(
                      (
                        value
                      ): value is string =>
                        Boolean(
                          value
                        )
                    ),
              },


              sales: {
                periodDays:
                  SALES_DAYS,

                ozon:
                  ozonSales28Days,

                wildberries:
                  wbSales28Days,

                total:
                  totalSales28Days,

                avgPerDay:
                  totalSales28Days
                  /
                  SALES_DAYS,

                cancelled: {
                  ozon:
                    ozon.cancelled28Days,

                  wildberries:
                    wb.cancelled28Days,

                  total:
                    totalCancelled28Days,
                },
              },


              stock: {
                marketplaces: {
                  ozon:
                    ozon.stock,

                  wildberriesFbw:
                    wb.fbwStock,

                  total:
                    marketplaceStock,
                },

                internal: {
                  ownWarehouse:
                    own.quantity,

                  responsibleStorage:
                    responsible.quantity,

                  total:
                    internalStock,
                },

                physicalTotal:
                  physicalStock,
              },


              ved: {
                activeQuantity:
                  ved.quantity,

                productIds:
                  Array.from(
                    ved.productIds
                  ).sort(),

                orderIds:
                  Array.from(
                    ved.orderIds
                  ).sort(),
              },


              effectiveStock,


              marketplaces: {
                ozon: {
                  present:
                    ozon.productIds.size
                    >
                    0,

                  listingsCount:
                    ozon.offerIds.size,

                  productIds:
                    Array.from(
                      ozon.productIds
                    ).sort(),

                  offerIds:
                    Array.from(
                      ozon.offerIds
                    ).sort(),

                  sales28Days:
                    ozonSales28Days,

                  cancelled28Days:
                    ozon.cancelled28Days,

                  avgSalesPerDay:
                    ozonSales28Days
                    /
                    SALES_DAYS,

                  stock:
                    ozon.stock,
                },


                wildberries: {
                  present:
                    wb.nmIds.size
                    >
                    0,

                  listingsCount:
                    wb.nmIds.size,

                  nmIds:
                    Array.from(
                      wb.nmIds
                    ).sort(
                      (
                        left,
                        right
                      ) =>
                        left
                        -
                        right
                    ),

                  sellerArticles:
                    Array.from(
                      wb.sellerArticles
                    ).sort(),

                  sales28Days:
                    wbSales28Days,

                  cancelled28Days:
                    wb.cancelled28Days,

                  avgSalesPerDay:
                    wbSales28Days
                    /
                    SALES_DAYS,

                  fbwStock:
                    wb.fbwStock,

                  toClient:
                    wb.toClient,

                  fromClient:
                    wb.fromClient,
                },
              },
            };
          }
        );


    // ========================================================
    // 19. CATALOG STATS
    // ========================================================

    const ozonMasterCodes =
      new Set(
        Array.from(
          ozonByMasterCode.keys()
        )
      );


    const wbMasterCodes =
      new Set(
        Array.from(
          wbByMasterCode.keys()
        )
      );


    let ozonAndWb =
      0;


    let onlyOzon =
      0;


    let onlyWb =
      0;


    for (
      const masterCode
      of allMasterCodes
    ) {
      const inOzon =
        ozonMasterCodes.has(
          masterCode
        );


      const inWb =
        wbMasterCodes.has(
          masterCode
        );


      if (
        inOzon
        &&
        inWb
      ) {
        ozonAndWb +=
          1;
      } else if (
        inOzon
      ) {
        onlyOzon +=
          1;
      } else if (
        inWb
      ) {
        onlyWb +=
          1;
      }
    }


    // ========================================================
    // 20. SUMMARY
    // ========================================================

    const totalOzonSales28Days =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.sales.ozon,
        0
      );


    const totalWbSales28Days =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.sales.wildberries,
        0
      );


    const totalOzonCancelled28Days =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.sales
            .cancelled
            .ozon,
        0
      );


    const totalWbCancelled28Days =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.sales
            .cancelled
            .wildberries,
        0
      );


    const totalOzonStock =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.stock
            .marketplaces
            .ozon,
        0
      );


    const totalWbFbwStock =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.stock
            .marketplaces
            .wildberriesFbw,
        0
      );


    const totalOwnStock =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.stock
            .internal
            .ownWarehouse,
        0
      );


    const totalResponsibleStorage =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.stock
            .internal
            .responsibleStorage,
        0
      );


    const totalPhysicalStock =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.stock
            .physicalTotal,
        0
      );


    const totalActiveVed =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.ved
            .activeQuantity,
        0
      );


    const totalEffectiveStock =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.effectiveStock,
        0
      );


    const masterCodesWithActiveOwnImport =
      items.filter(
        (item) =>
          item.procurement
            .hasActiveOwnImportProduct
      ).length;


    // ========================================================
    // 21. RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        message:
          "Общий источник Китая собран по master_code: Ozon + WB + основной склад + ответственное хранение + активный ВЭД",


        purpose: {
          calculation:
            "CHINA_FULL_SOURCE_ONLY",

          formulaApplied:
            false,

          ownWarehouseIncluded:
            true,

          responsibleStorageIncluded:
            true,

          activeVedIncluded:
            true,

          wbToClientIncludedInPhysicalStock:
            false,

          wbFromClientIncludedInPhysicalStock:
            false,

          note:
            "Формула заказа Китая пока не применяется. Этот endpoint только собирает и проверяет исходные данные.",
        },


        period: {
          days:
            SALES_DAYS,

          source:
            "latest_successful_ozon_sales_sync_run",

          dateFrom:
            periodDateFrom,

          dateTo:
            periodDateTo,

          wbTimestampFrom:
            wbPeriodStartIso,

          wbTimestampToExclusive:
            wbPeriodEndExclusiveIso,
        },


        sourceVersions: {
          ozon: {
            salesSyncRunId:
              ozonSalesRun.id,

            salesSyncCreatedAt:
              ozonSalesRun.created_at,

            stockSnapshotDate:
              ozonStockDate,
          },


          wildberries: {
            ordersLastSuccessAt:
              wbStates.orders
                ?.last_success_at
              ??
              null,

            stocksLastSuccessAt:
              wbStates.stocks
                ?.last_success_at
              ??
              null,

            stockSnapshotId:
              wbSnapshotId,
          },


          internalStock: {
            ownWarehouseSnapshotDate:
              ownStockDate,

            responsibleStorageSnapshotDate:
              responsibleStorageDate,
          },
        },


        catalog: {
          ozon: {
            activeProducts:
              activeProducts.length,

            activeMarketplaceListings:
              ozonProductIdToMasterCode.size,

            uniqueMasterCodes:
              ozonMasterCodes.size,

            chinaDisabledProducts:
              ozonChinaDisabledProducts,
          },


          wildberries: {
            currentSku:
              wbStockResult.rows.length,

            chinaEnabledSku:
              wbNmIdToMasterCode.size,

            chinaDisabledSku:
              wbChinaDisabled.length,

            uniqueChinaMasterCodes:
              wbMasterCodes.size,
          },


          combined: {
            ozonAndWb,

            onlyOzon,

            onlyWb,

            totalMasterCodes:
              allMasterCodes.size,
          },


          procurement: {
            masterCodesWithActiveOwnImport,

            masterCodesWithoutActiveOwnImport:
              items.length
              -
              masterCodesWithActiveOwnImport,

            note:
              "Это пока диагностика. На следующем этапе перед включением формулы отдельно проверим, какие master_code действительно должны участвовать в закупке Китая.",
          },
        },


        validation: {
          products: {
            exactRows:
              productsExactCount,

            loadedRows:
              productsResult.rows.length,

            duplicateActiveOwnImportMasterCodes:
              duplicateProcurementMasterCodes.length,
          },


          ozonMapping: {
            missingMappings:
              ozonMissingMappings.length,

            masterCodeMismatches:
              ozonMasterCodeMismatches.length,
          },


          ozonSales: {
            exactRows:
              ozonSalesExactCount,

            loadedRows:
              ozonSalesResult.rows.length,

            pages:
              ozonSalesResult.pages,

            rowsOutsideCurrentChinaCatalog:
              ozonUnmappedSalesRows,
          },


          ozonStocks: {
            exactRows:
              ozonStockExactCount,

            loadedRows:
              ozonStockResult.rows.length,

            pages:
              ozonStockResult.pages,

            rowsOutsideCurrentChinaCatalog:
              ozonUnmappedStockRows,
          },


          wbMapping: {
            currentSku:
              wbStockResult.rows.length,

            currentUnmapped:
              wbCurrentUnmapped.length,

            chinaDisabled:
              wbChinaDisabled.length,

            chinaEnabled:
              wbNmIdToMasterCode.size,
          },


          wbOrders: {
            exactRows:
              wbOrdersExactCount,

            loadedRows:
              wbOrdersResult.rows.length,

            pages:
              wbOrdersResult.pages,

            duplicateSrid:
              wbDuplicateSrids.size,

            nullIsCancel:
              wbNullIsCancel,

            excludedByChinaProcurementFlag:
              wbOrdersExcludedByChinaFlag,

            trulyOutsideCurrentCatalog:
              wbOrdersOutsideCurrentCatalog,

            warehouseType:
              WB_FBW_WAREHOUSE_TYPE,
          },


          wbStocks: {
            exactRows:
              wbStockExactCount,

            loadedRows:
              wbStockResult.rows.length,

            pages:
              wbStockResult.pages,

            duplicateNmId:
              wbDuplicateCurrentNmIds.length,
          },


          ownWarehouse: {
            exactRows:
              ownStockExactCount,

            loadedRows:
              ownStockResult.rows.length,

            pages:
              ownStockResult.pages,

            rowsWithoutMasterCode:
              ownStockRowsWithoutMasterCode,

            masterCodesOutsideMarketplaceCatalog:
              ownStockOutsideMarketplaceCatalog.length,

            outsideMarketplaceCatalog:
              ownStockOutsideMarketplaceCatalog,
          },


          responsibleStorage: {
            exactRows:
              responsibleStorageExactCount,

            loadedRows:
              responsibleStorageResult.rows.length,

            pages:
              responsibleStorageResult.pages,

            rowsWithoutMasterCode:
              responsibleStorageRowsWithoutMasterCode,

            masterCodesOutsideMarketplaceCatalog:
              responsibleStorageOutsideMarketplaceCatalog.length,

            outsideMarketplaceCatalog:
              responsibleStorageOutsideMarketplaceCatalog,
          },


          activeVed: {
            relevantOrders:
              vedOrdersResult.rows.length,

            productionConfirmedOrders,

            inTransitOrders,

            arrivedBridgeActiveOrders,

            arrivedBridgeCompletedOrders,

            activeOrderIds:
              activeVedOrderIds.size,

            includedItems:
              activeVedItemsIncluded,

            activeItemsWithoutProductId:
              activeVedItemsWithoutProductId,

            activeItemsWithoutMasterCode:
              activeVedItemsWithoutMasterCode,

            masterCodesOutsideMarketplaceCatalog:
              activeVedOutsideMarketplaceCatalog.length,

            outsideMarketplaceCatalog:
              activeVedOutsideMarketplaceCatalog,
          },
        },


        summary: {
          masterCodes:
            items.length,


          sales28Days: {
            ozon:
              totalOzonSales28Days,

            wildberries:
              totalWbSales28Days,

            total:
              totalOzonSales28Days
              +
              totalWbSales28Days,
          },


          cancelled28Days: {
            ozon:
              totalOzonCancelled28Days,

            wildberries:
              totalWbCancelled28Days,

            total:
              totalOzonCancelled28Days
              +
              totalWbCancelled28Days,
          },


          marketplaceStock: {
            ozon:
              totalOzonStock,

            wildberries:
              totalWbFbwStock,

            total:
              totalOzonStock
              +
              totalWbFbwStock,
          },


          internalStock: {
            ownWarehouse:
              totalOwnStock,

            responsibleStorage:
              totalResponsibleStorage,

            total:
              totalOwnStock
              +
              totalResponsibleStorage,
          },


          physicalStock:
            totalPhysicalStock,


          activeVed:
            totalActiveVed,


          effectiveStock:
            totalEffectiveStock,
        },


        excludedWildberriesListings:
          wbChinaDisabled,


        items,
      },
      {
        status: 200,
      }
    );

  } catch (error) {
    console.error(
      "Ошибка общего China source:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "Не удалось собрать полный источник данных для расчёта Китая",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      {
        status: 500,
      }
    );
  }
}
