import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SALES_DAYS = 28;
const PAGE_SIZE = 1000;

const OZON_MARKETPLACE = "ozon";
const WB_MARKETPLACE = "wildberries";
const ACCOUNT_KEY = "main";

const WB_FBW_WAREHOUSE_TYPE =
  "Склад WB";

type OzonSalesSyncRun = {
  id: string;
  date_from: string;
  date_to: string;
  completed_days: number;
  status: string;
  created_at: string;
};

type ProductRow = {
  id: string;
  offer_id: string | null;
  master_code: string | null;
  is_active: boolean;
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
  last_success_at: string | null;
  last_http_status: number | null;
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
  disabledFlagListings: number;
};

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
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
  const { supabaseKey } =
    getSupabaseConfig();

  return {
    apikey: supabaseKey,
    Authorization:
      `Bearer ${supabaseKey}`,
    Accept:
      "application/json",
  };
}

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

async function supabaseGetRows<T>(
  path: string
): Promise<T[]> {
  const { supabaseUrl } =
    getSupabaseConfig();

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

async function supabaseGetAll<T>(
  basePath: string,
  orderBy: string
): Promise<{
  rows: T[];
  pages: number;
}> {
  const { supabaseUrl } =
    getSupabaseConfig();

  const rows: T[] = [];

  let from = 0;
  let pages = 0;

  while (true) {
    const separator =
      basePath.includes("?")
        ? "&"
        : "?";

    const url =
      `${supabaseUrl}/rest/v1/${basePath}` +
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

    rows.push(...page);

    pages += 1;

    if (
      page.length <
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

async function supabaseExactCount(
  basePath: string
): Promise<number> {
  const { supabaseUrl } =
    getSupabaseConfig();

  const separator =
    basePath.includes("?")
      ? "&"
      : "?";

  const url =
    `${supabaseUrl}/rest/v1/${basePath}` +
    `${separator}limit=1`;

  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {
          ...getHeaders(),
          Prefer:
            "count=exact",
          Range:
            "0-0",
        },

        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Exact count HTTP ${response.status}: ${text}`
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

function safeNumber(
  value: unknown
): number {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(number)
  );
}

function addDays(
  dateString: string,
  days: number
): string {
  const date =
    new Date(
      `${dateString}T00:00:00Z`
    );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function inclusiveDays(
  from: string,
  to: string
): number {
  const fromDate =
    new Date(
      `${from}T00:00:00Z`
    );

  const toDate =
    new Date(
      `${to}T00:00:00Z`
    );

  return (
    Math.round(
      (
        toDate.getTime() -
        fromDate.getTime()
      ) /
      86400000
    ) + 1
  );
}

function moscowDayStartIso(
  dateString: string
): string {
  return new Date(
    `${dateString}T00:00:00+03:00`
  ).toISOString();
}

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

    disabledFlagListings:
      0,
  };
}

async function getLatestOzonSalesRun():
Promise<OzonSalesSyncRun | null> {
  const rows =
    await supabaseGetRows<
      OzonSalesSyncRun
    >(
      "ozon_sales_sync_runs" +
      "?select=id,date_from,date_to,completed_days,status,created_at" +
      "&status=eq.success" +
      "&completed_days=eq.28" +
      "&order=date_to.desc,created_at.desc" +
      "&limit=1"
    );

  return rows[0] ?? null;
}

async function getLatestOzonStockDate():
Promise<string | null> {
  const rows =
    await supabaseGetRows<{
      snapshot_date: string;
    }>(
      "ozon_stock_snapshots" +
      "?select=snapshot_date" +
      "&order=snapshot_date.desc" +
      "&limit=1"
    );

  return (
    rows[0]
      ?.snapshot_date ??
    null
  );
}

async function getWbSyncStates():
Promise<{
  orders: WbSyncState | null;
  stocks: WbSyncState | null;
}> {
  const rows =
    await supabaseGetRows<
      WbSyncState
    >(
      "wb_sync_state" +
      "?select=*" +
      "&sync_key=in.(orders,stocks)"
    );

  return {
    orders:
      rows.find(
        row =>
          row.sync_key ===
          "orders"
      ) ?? null,

    stocks:
      rows.find(
        row =>
          row.sync_key ===
          "stocks"
      ) ?? null,
  };
}

export async function GET() {
  try {
    // ========================================================
    // 1. ЕДИНЫЙ ПЕРИОД OZON + WB
    // ========================================================

    const ozonSalesRun =
      await getLatestOzonSalesRun();

    if (!ozonSalesRun) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не найден успешный 28-дневный период продаж Ozon",
        },
        {
          status: 409,
        }
      );
    }

    const periodDays =
      inclusiveDays(
        ozonSalesRun.date_from,
        ozonSalesRun.date_to
      );

    if (
      periodDays !== SALES_DAYS
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Период Ozon не равен 28 календарным дням",

          period: {
            dateFrom:
              ozonSalesRun.date_from,

            dateTo:
              ozonSalesRun.date_to,

            days:
              periodDays,
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

    const wbPeriodFrom =
      moscowDayStartIso(
        periodDateFrom
      );

    const wbPeriodToExclusive =
      moscowDayStartIso(
        addDays(
          periodDateTo,
          1
        )
      );

    // ========================================================
    // 2. OZON PRODUCTS
    // ========================================================

    const productsPath =
      "products" +
      "?select=id,offer_id,master_code,is_active" +
      "&is_active=eq.true";

    const productsExact =
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
      productsResult.rows.length !==
      productsExact
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все активные products были загружены",
          exactRows:
            productsExact,
          loadedRows:
            productsResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 3. OZON LISTINGS
    //
    // Все активные.
    // china_procurement_enabled НЕ фильтрует.
    // ========================================================

    const ozonListingsPath =
      "marketplace_listings" +
      "?select=marketplace,account_key,external_id,seller_article,master_code,is_active,china_procurement_enabled" +
      `&marketplace=eq.${OZON_MARKETPLACE}` +
      `&account_key=eq.${ACCOUNT_KEY}` +
      "&is_active=eq.true";

    const ozonListingsExact =
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
      ozonListingsResult.rows.length !==
      ozonListingsExact
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все Ozon listings были загружены",
          exactRows:
            ozonListingsExact,
          loadedRows:
            ozonListingsResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }

    const ozonListingByOffer =
      new Map<
        string,
        MarketplaceListingRow
      >();

    for (
      const listing
      of ozonListingsResult.rows
    ) {
      ozonListingByOffer.set(
        listing.external_id.trim(),
        listing
      );
    }

    const ozonProductToMaster =
      new Map<string, string>();

    const ozonByMaster =
      new Map<
        string,
        OzonAggregate
      >();

    const ozonMappingErrors:
      Array<{
        productId: string;
        offerId: string | null;
        productMasterCode: string | null;
        listingMasterCode?: string | null;
        reason: string;
      }> = [];

    for (
      const product
      of productsResult.rows
    ) {
      const offerId =
        product.offer_id
          ?.trim() ?? "";

      const productMasterCode =
        product.master_code
          ?.trim() ?? "";

      if (
        !offerId ||
        !productMasterCode
      ) {
        ozonMappingErrors.push(
          {
            productId:
              product.id,

            offerId:
              product.offer_id,

            productMasterCode:
              product.master_code,

            reason:
              "PRODUCT_WITHOUT_OFFER_OR_MASTER_CODE",
          }
        );

        continue;
      }

      const listing =
        ozonListingByOffer.get(
          offerId
        );

      if (!listing) {
        ozonMappingErrors.push(
          {
            productId:
              product.id,

            offerId,

            productMasterCode,

            reason:
              "LISTING_NOT_FOUND",
          }
        );

        continue;
      }

      if (
        listing.master_code.trim() !==
        productMasterCode
      ) {
        ozonMappingErrors.push(
          {
            productId:
              product.id,

            offerId,

            productMasterCode,

            listingMasterCode:
              listing.master_code,

            reason:
              "MASTER_CODE_MISMATCH",
          }
        );

        continue;
      }

      ozonProductToMaster.set(
        product.id,
        productMasterCode
      );

      const aggregate =
        ozonByMaster.get(
          productMasterCode
        ) ??
        createOzonAggregate();

      aggregate.productIds.add(
        product.id
      );

      aggregate.offerIds.add(
        offerId
      );

      ozonByMaster.set(
        productMasterCode,
        aggregate
      );
    }

    if (
      ozonMappingErrors.length > 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Ошибка Ozon → master_code mapping",

          errors:
            ozonMappingErrors,
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 4. OZON SALES
    // ========================================================

    const ozonSalesPath =
      "ozon_sales_daily" +
      "?select=product_id,cluster_id,sale_date,sales_quantity,cancelled_quantity" +
      `&sale_date=gte.${periodDateFrom}` +
      `&sale_date=lte.${periodDateTo}`;

    const ozonSalesExact =
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
      ozonSalesResult.rows.length !==
      ozonSalesExact
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все строки Ozon sales были загружены",
          exactRows:
            ozonSalesExact,
          loadedRows:
            ozonSalesResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }

    let ozonSalesRowsOutsideCurrentCatalog =
      0;

    for (
      const row
      of ozonSalesResult.rows
    ) {
      const masterCode =
        ozonProductToMaster.get(
          row.product_id
        );

      if (!masterCode) {
        ozonSalesRowsOutsideCurrentCatalog +=
          1;

        continue;
      }

      const aggregate =
        ozonByMaster.get(
          masterCode
        ) ??
        createOzonAggregate();

      aggregate.sales28Days +=
        safeNumber(
          row.sales_quantity
        );

      aggregate.cancelled28Days +=
        safeNumber(
          row.cancelled_quantity
        );

      ozonByMaster.set(
        masterCode,
        aggregate
      );
    }

    // ========================================================
    // 5. OZON STOCK
    // ========================================================

    const ozonStockDate =
      await getLatestOzonStockDate();

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

    const ozonStockPath =
      "ozon_stock_snapshots" +
      "?select=product_id,cluster_id,quantity,snapshot_date" +
      `&snapshot_date=eq.${ozonStockDate}`;

    const ozonStockExact =
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
      ozonStockResult.rows.length !==
      ozonStockExact
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все строки Ozon stock были загружены",
          exactRows:
            ozonStockExact,
          loadedRows:
            ozonStockResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }

    let ozonStockRowsOutsideCurrentCatalog =
      0;

    for (
      const row
      of ozonStockResult.rows
    ) {
      const masterCode =
        ozonProductToMaster.get(
          row.product_id
        );

      if (!masterCode) {
        ozonStockRowsOutsideCurrentCatalog +=
          1;

        continue;
      }

      const aggregate =
        ozonByMaster.get(
          masterCode
        ) ??
        createOzonAggregate();

      aggregate.stock +=
        safeNumber(
          row.quantity
        );

      ozonByMaster.set(
        masterCode,
        aggregate
      );
    }

    // ========================================================
    // 6. WB SYNC STATE
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
            "Нет успешной синхронизации заказов WB",
        },
        {
          status: 409,
        }
      );
    }

    if (
      !wbStates.stocks
        ?.last_success_at ||
      !wbStates.stocks
        ?.last_snapshot_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Нет успешного snapshot остатков WB",
        },
        {
          status: 409,
        }
      );
    }

    const wbOrdersSyncTime =
      new Date(
        wbStates.orders.last_success_at
      ).getTime();

    const requiredWbCoverage =
      new Date(
        wbPeriodToExclusive
      ).getTime();

    if (
      !Number.isFinite(
        wbOrdersSyncTime
      ) ||
      wbOrdersSyncTime <
        requiredWbCoverage
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "WB не синхронизирован до конца общего периода",

          period: {
            dateFrom:
              periodDateFrom,
            dateTo:
              periodDateTo,
          },

          wildberries: {
            ordersLastSuccessAt:
              wbStates.orders
                .last_success_at,

            requiredThrough:
              wbPeriodToExclusive,
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
    // 7. WB LISTINGS
    //
    // Все active mappings.
    // china_procurement_enabled НЕ фильтрует.
    // ========================================================

    const wbListingsPath =
      "marketplace_listings" +
      "?select=marketplace,account_key,external_id,seller_article,master_code,is_active,china_procurement_enabled" +
      `&marketplace=eq.${WB_MARKETPLACE}` +
      `&account_key=eq.${ACCOUNT_KEY}` +
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
    // 8. CURRENT WB SNAPSHOT
    // ========================================================

    const wbStockPath =
      "wb_stock_product_snapshots" +
      "?select=snapshot_id,snapshot_at,nm_id,vendor_code,product_name,brand_name,stock_count,to_client_count,from_client_count,availability" +
      `&snapshot_id=eq.${encodeURIComponent(
        wbSnapshotId
      )}`;

    const wbStockExact =
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
      wbStockResult.rows.length !==
      wbStockExact
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все строки WB stock были загружены",
          exactRows:
            wbStockExact,
          loadedRows:
            wbStockResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }

    const wbCurrentNmIds =
      new Set<number>();

    const wbDuplicateNmIds =
      new Set<number>();

    const wbUnmapped:
      Array<{
        nmId: number;
        vendorCode: string | null;
        productName: string | null;
      }> = [];

    const wbNmIdToMaster =
      new Map<number, string>();

    const wbByMaster =
      new Map<
        string,
        WbAggregate
      >();

    for (
      const stock
      of wbStockResult.rows
    ) {
      const nmId =
        Number(stock.nm_id);

      if (
        wbCurrentNmIds.has(nmId)
      ) {
        wbDuplicateNmIds.add(
          nmId
        );
      }

      wbCurrentNmIds.add(
        nmId
      );

      const listing =
        wbListingByNmId.get(
          String(nmId)
        );

      if (!listing) {
        wbUnmapped.push(
          {
            nmId,
            vendorCode:
              stock.vendor_code,
            productName:
              stock.product_name,
          }
        );

        continue;
      }

      const masterCode =
        listing.master_code;

      wbNmIdToMaster.set(
        nmId,
        masterCode
      );

      const aggregate =
        wbByMaster.get(
          masterCode
        ) ??
        createWbAggregate();

      aggregate.nmIds.add(
        nmId
      );

      if (
        listing.seller_article
      ) {
        aggregate
          .sellerArticles
          .add(
            listing.seller_article
          );
      }

      aggregate.fbwStock +=
        safeNumber(
          stock.stock_count
        );

      aggregate.toClient +=
        safeNumber(
          stock.to_client_count
        );

      aggregate.fromClient +=
        safeNumber(
          stock.from_client_count
        );

      if (
        listing
          .china_procurement_enabled ===
        false
      ) {
        aggregate.disabledFlagListings +=
          1;
      }

      wbByMaster.set(
        masterCode,
        aggregate
      );
    }

    if (
      wbDuplicateNmIds.size > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "В текущем WB snapshot есть дубли nmID",
          duplicateNmIds:
            Array.from(
              wbDuplicateNmIds
            ),
        },
        {
          status: 409,
        }
      );
    }

    if (
      wbUnmapped.length > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все текущие WB карточки имеют master_code",
          unmapped:
            wbUnmapped,
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 9. WB SALES ЗА ТОТ ЖЕ ПЕРИОД
    //
    // Только FBW.
    // Все текущие карточки.
    // ========================================================

    const wbOrdersPath =
      "wb_orders" +
      "?select=srid,order_date,nm_id,supplier_article,barcode,warehouse_type,is_cancel" +
      `&warehouse_type=eq.${encodeURIComponent(
        WB_FBW_WAREHOUSE_TYPE
      )}` +
      `&order_date=gte.${encodeURIComponent(
        wbPeriodFrom
      )}` +
      `&order_date=lt.${encodeURIComponent(
        wbPeriodToExclusive
      )}`;

    const wbOrdersExact =
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
      wbOrdersResult.rows.length !==
      wbOrdersExact
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все строки WB orders были загружены",
          exactRows:
            wbOrdersExact,
          loadedRows:
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

    let wbOrdersOutsideCurrentSnapshot =
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
        order.is_cancel === null
      ) {
        wbNullIsCancel += 1;
        continue;
      }

      const nmId =
        Number(order.nm_id);

      const masterCode =
        wbNmIdToMaster.get(
          nmId
        );

      if (!masterCode) {
        wbOrdersOutsideCurrentSnapshot +=
          1;

        continue;
      }

      const aggregate =
        wbByMaster.get(
          masterCode
        ) ??
        createWbAggregate();

      if (
        order.is_cancel === true
      ) {
        aggregate.cancelled28Days +=
          1;
      } else {
        aggregate.sales28Days +=
          1;
      }

      wbByMaster.set(
        masterCode,
        aggregate
      );
    }

    if (
      wbDuplicateSrids.size > 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "В WB orders найдены дубли srid",

          duplicateCount:
            wbDuplicateSrids.size,

          sample:
            Array.from(
              wbDuplicateSrids
            ).slice(0, 20),
        },
        {
          status: 409,
        }
      );
    }

    if (
      wbNullIsCancel > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "В WB orders найден is_cancel = null",
          rows:
            wbNullIsCancel,
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 10. UNION ПО MASTER_CODE
    // ========================================================

    const allMasterCodes =
      new Set<string>();

    for (
      const masterCode
      of ozonByMaster.keys()
    ) {
      allMasterCodes.add(
        masterCode
      );
    }

    for (
      const masterCode
      of wbByMaster.keys()
    ) {
      allMasterCodes.add(
        masterCode
      );
    }

    // ========================================================
    // 11. ОБЩИЕ ITEMS
    // ========================================================

    const items =
      Array.from(
        allMasterCodes
      )
        .sort()
        .map(
          masterCode => {
            const ozon =
              ozonByMaster.get(
                masterCode
              ) ??
              createOzonAggregate();

            const wb =
              wbByMaster.get(
                masterCode
              ) ??
              createWbAggregate();

            const totalSales28Days =
              ozon.sales28Days +
              wb.sales28Days;

            const totalCancelled28Days =
              ozon.cancelled28Days +
              wb.cancelled28Days;

            const marketplaceStock =
              ozon.stock +
              wb.fbwStock;

            return {
              masterCode,

              sales: {
                periodDays:
                  SALES_DAYS,

                ozon:
                  ozon.sales28Days,

                wildberries:
                  wb.sales28Days,

                total:
                  totalSales28Days,

                avgPerDay:
                  totalSales28Days /
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
                ozon:
                  ozon.stock,

                wildberriesFbw:
                  wb.fbwStock,

                marketplaceTotal:
                  marketplaceStock,
              },

              ozon: {
                present:
                  ozon.productIds.size > 0,

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
              },

              wildberries: {
                present:
                  wb.nmIds.size > 0,

                listingsCount:
                  wb.nmIds.size,

                nmIds:
                  Array.from(
                    wb.nmIds
                  ).sort(
                    (a, b) =>
                      a - b
                  ),

                sellerArticles:
                  Array.from(
                    wb.sellerArticles
                  ).sort(),

                toClientInfo:
                  wb.toClient,

                fromClientInfo:
                  wb.fromClient,

                chinaProcurementDisabledFlagListings:
                  wb.disabledFlagListings,

                chinaProcurementFlagApplied:
                  false,
              },
            };
          }
        );

    // ========================================================
    // 12. КАТАЛОЖНАЯ СТАТИСТИКА
    // ========================================================

    const ozonMasterCodes =
      new Set(
        ozonByMaster.keys()
      );

    const wbMasterCodes =
      new Set(
        wbByMaster.keys()
      );

    let ozonAndWb = 0;
    let onlyOzon = 0;
    let onlyWb = 0;

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
        inOzon &&
        inWb
      ) {
        ozonAndWb += 1;
      } else if (inOzon) {
        onlyOzon += 1;
      } else if (inWb) {
        onlyWb += 1;
      }
    }

    // ========================================================
    // 13. SUMMARY
    // ========================================================

    const totalOzonSales =
      items.reduce(
        (sum, item) =>
          sum +
          item.sales.ozon,
        0
      );

    const totalWbSales =
      items.reduce(
        (sum, item) =>
          sum +
          item.sales.wildberries,
        0
      );

    const totalOzonCancelled =
      items.reduce(
        (sum, item) =>
          sum +
          item.sales
            .cancelled
            .ozon,
        0
      );

    const totalWbCancelled =
      items.reduce(
        (sum, item) =>
          sum +
          item.sales
            .cancelled
            .wildberries,
        0
      );

    const totalOzonStock =
      items.reduce(
        (sum, item) =>
          sum +
          item.stock.ozon,
        0
      );

    const totalWbStock =
      items.reduce(
        (sum, item) =>
          sum +
          item.stock
            .wildberriesFbw,
        0
      );

    const wbDisabledFlagsIncluded =
      wbStockResult.rows.filter(
        stock => {
          const listing =
            wbListingByNmId.get(
              String(stock.nm_id)
            );

          return (
            listing
              ?.china_procurement_enabled ===
            false
          );
        }
      ).length;

    // ========================================================
    // 14. RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        message:
          "Продажи и остатки Ozon + Wildberries объединены по master_code на одном 28-дневном периоде",

        purpose: {
          calculation:
            "OZON_WB_COMBINED_SOURCE",

          chinaOrderFormulaApplied:
            false,

          allCurrentMarketplaceCardsIncluded:
            true,

          chinaProcurementFlagApplied:
            false,

          supplyOriginFilterApplied:
            false,

          wildberriesFbsIncluded:
            false,

          wildberriesToClientIncludedInStock:
            false,

          wildberriesFromClientIncludedInStock:
            false,

          note:
            "Сейчас учитываются все активные карточки Ozon и все карточки текущего WB snapshot. Ограничение по необходимости закупки в Китай будет добавлено позже на уровне общего справочника master_code.",
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

          wildberriesTimestampFrom:
            wbPeriodFrom,

          wildberriesTimestampToExclusive:
            wbPeriodToExclusive,

          samePeriodForBothMarketplaces:
            true,
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
                .last_success_at,

            stocksLastSuccessAt:
              wbStates.stocks
                .last_success_at,

            stockSnapshotId:
              wbSnapshotId,
          },
        },

        catalog: {
          ozon: {
            activeListings:
              productsResult.rows.length,

            uniqueMasterCodes:
              ozonMasterCodes.size,
          },

          wildberries: {
            currentListings:
              wbStockResult.rows.length,

            uniqueMasterCodes:
              wbMasterCodes.size,

            informationalDisabledFlagsIncluded:
              wbDisabledFlagsIncluded,
          },

          combined: {
            ozonAndWb,

            onlyOzon,

            onlyWb,

            totalMasterCodes:
              allMasterCodes.size,
          },
        },

        validation: {
          ozonMapping: {
            errors:
              ozonMappingErrors.length,
          },

          ozonSales: {
            exactRows:
              ozonSalesExact,

            loadedRows:
              ozonSalesResult.rows.length,

            pages:
              ozonSalesResult.pages,

            rowsOutsideCurrentCatalog:
              ozonSalesRowsOutsideCurrentCatalog,
          },

          ozonStocks: {
            exactRows:
              ozonStockExact,

            loadedRows:
              ozonStockResult.rows.length,

            pages:
              ozonStockResult.pages,

            rowsOutsideCurrentCatalog:
              ozonStockRowsOutsideCurrentCatalog,
          },

          wildberriesMapping: {
            currentListings:
              wbStockResult.rows.length,

            unmapped:
              wbUnmapped.length,
          },

          wildberriesOrders: {
            exactRows:
              wbOrdersExact,

            loadedRows:
              wbOrdersResult.rows.length,

            pages:
              wbOrdersResult.pages,

            duplicateSrid:
              wbDuplicateSrids.size,

            nullIsCancel:
              wbNullIsCancel,

            rowsOutsideCurrentSnapshot:
              wbOrdersOutsideCurrentSnapshot,

            warehouseType:
              WB_FBW_WAREHOUSE_TYPE,
          },

          wildberriesStocks: {
            exactRows:
              wbStockExact,

            loadedRows:
              wbStockResult.rows.length,

            pages:
              wbStockResult.pages,

            duplicateNmId:
              wbDuplicateNmIds.size,
          },
        },

        summary: {
          masterCodes:
            items.length,

          sales28Days: {
            ozon:
              totalOzonSales,

            wildberries:
              totalWbSales,

            total:
              totalOzonSales +
              totalWbSales,
          },

          cancelled28Days: {
            ozon:
              totalOzonCancelled,

            wildberries:
              totalWbCancelled,

            total:
              totalOzonCancelled +
              totalWbCancelled,
          },

          marketplaceStock: {
            ozon:
              totalOzonStock,

            wildberriesFbw:
              totalWbStock,

            total:
              totalOzonStock +
              totalWbStock,
          },
        },

        items,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "OZON + WB SOURCE ERROR",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "Не удалось собрать общий источник Ozon + Wildberries",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
