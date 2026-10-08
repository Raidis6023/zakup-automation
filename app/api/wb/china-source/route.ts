import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SALES_DAYS = 28;
const PAGE_SIZE = 1000;
const WB_MARKETPLACE = "wildberries";
const ACCOUNT_KEY = "main";
const WB_FBW_WAREHOUSE_TYPE = "Склад WB";

type OzonSalesSyncRun = {
  id: string;
  date_from: string;
  date_to: string;
  completed_days: number;
  status: string;
  created_at: string;
};

type WbSyncState = {
  sync_key: string;
  last_success_at: string | null;
  last_http_status: number | null;
  last_snapshot_id?: string | null;
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

type WbOrderRow = {
  srid: string;
  order_date: string;
  nm_id: number;
  supplier_article: string | null;
  barcode: string | null;
  warehouse_type: string | null;
  is_cancel: boolean | null;
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
    Authorization: `Bearer ${supabaseKey}`,
    Accept: "application/json",
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

function safeNumber(
  value: unknown
): number {
  const result =
    Number(value);

  if (
    !Number.isFinite(result)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(result)
  );
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
    // 1. ОБЩИЙ ПЕРИОД
    //
    // WB использует ровно тот же период,
    // что последний успешный 28-дневный sync Ozon.
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

    const days =
      inclusiveDays(
        ozonSalesRun.date_from,
        ozonSalesRun.date_to
      );

    if (
      days !== SALES_DAYS
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
            days,
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
    // 2. СОСТОЯНИЕ WB
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

    const requiredCoverageTime =
      new Date(
        wbPeriodToExclusive
      ).getTime();

    if (
      !Number.isFinite(
        wbOrdersSyncTime
      ) ||
      wbOrdersSyncTime <
        requiredCoverageTime
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
              wbStates.orders.last_success_at,
            requiredThrough:
              wbPeriodToExclusive,
          },
        },
        {
          status: 409,
        }
      );
    }

    const snapshotId =
      wbStates.stocks
        .last_snapshot_id;

    // ========================================================
    // 3. ВСЕ WB MAPPING
    //
    // china_procurement_enabled читаем только
    // для информации. НИЧЕГО им не фильтруем.
    // ========================================================

    const mappingsPath =
      "marketplace_listings" +
      "?select=marketplace,account_key,external_id,seller_article,master_code,is_active,china_procurement_enabled" +
      `&marketplace=eq.${WB_MARKETPLACE}` +
      `&account_key=eq.${ACCOUNT_KEY}` +
      "&is_active=eq.true";

    const mappingsExact =
      await supabaseExactCount(
        mappingsPath
      );

    const mappingsResult =
      await supabaseGetAll<
        MarketplaceListingRow
      >(
        mappingsPath,
        "external_id.asc"
      );

    if (
      mappingsResult.rows.length !==
      mappingsExact
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все WB mappings были загружены",
          exactRows:
            mappingsExact,
          loadedRows:
            mappingsResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }

    const mappingByNmId =
      new Map<
        string,
        MarketplaceListingRow
      >();

    const duplicateMappingIds =
      new Set<string>();

    for (
      const mapping
      of mappingsResult.rows
    ) {
      const key =
        mapping.external_id.trim();

      if (
        mappingByNmId.has(key)
      ) {
        duplicateMappingIds.add(
          key
        );
      }

      mappingByNmId.set(
        key,
        mapping
      );
    }

    if (
      duplicateMappingIds.size > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "В WB mapping есть дубли external_id",
          duplicates:
            Array.from(
              duplicateMappingIds
            ),
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 4. ТЕКУЩИЙ SNAPSHOT WB
    // ========================================================

    const stockPath =
      "wb_stock_product_snapshots" +
      "?select=snapshot_id,snapshot_at,nm_id,vendor_code,product_name,brand_name,stock_count,to_client_count,from_client_count,availability" +
      `&snapshot_id=eq.${encodeURIComponent(
        snapshotId
      )}`;

    const stockExact =
      await supabaseExactCount(
        stockPath
      );

    const stockResult =
      await supabaseGetAll<
        WbStockRow
      >(
        stockPath,
        "nm_id.asc"
      );

    if (
      stockResult.rows.length !==
      stockExact
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все строки WB snapshot были загружены",
          exactRows:
            stockExact,
          loadedRows:
            stockResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }

    const currentNmIds =
      new Set<number>();

    const duplicateNmIds =
      new Set<number>();

    const unmappedItems: Array<{
      nmId: number;
      vendorCode: string | null;
      productName: string | null;
    }> = [];

    for (
      const stock
      of stockResult.rows
    ) {
      const nmId =
        Number(stock.nm_id);

      if (
        currentNmIds.has(nmId)
      ) {
        duplicateNmIds.add(
          nmId
        );
      }

      currentNmIds.add(
        nmId
      );

      if (
        !mappingByNmId.has(
          String(nmId)
        )
      ) {
        unmappedItems.push(
          {
            nmId,
            vendorCode:
              stock.vendor_code,
            productName:
              stock.product_name,
          }
        );
      }
    }

    if (
      duplicateNmIds.size > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "В текущем WB snapshot есть дубли nmID",
          duplicateNmIds:
            Array.from(
              duplicateNmIds
            ),
        },
        {
          status: 409,
        }
      );
    }

    if (
      unmappedItems.length > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все текущие WB карточки имеют master_code",
          unmappedItems,
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 5. ЗАКАЗЫ WB ЗА ТОТ ЖЕ ПЕРИОД
    //
    // Только FBW.
    // FBS не входит.
    // ========================================================

    const ordersPath =
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

    const ordersExact =
      await supabaseExactCount(
        ordersPath
      );

    const ordersResult =
      await supabaseGetAll<
        WbOrderRow
      >(
        ordersPath,
        "order_date.asc,srid.asc"
      );

    if (
      ordersResult.rows.length !==
      ordersExact
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не все WB orders были загружены",
          exactRows:
            ordersExact,
          loadedRows:
            ordersResult.rows.length,
        },
        {
          status: 409,
        }
      );
    }

    const seenSrids =
      new Set<string>();

    const duplicateSrids =
      new Set<string>();

    let nullIsCancel =
      0;

    let ordersOutsideCurrentSnapshot =
      0;

    const salesByNmId =
      new Map<
        number,
        {
          active: number;
          cancelled: number;
        }
      >();

    for (
      const order
      of ordersResult.rows
    ) {
      if (
        seenSrids.has(
          order.srid
        )
      ) {
        duplicateSrids.add(
          order.srid
        );
      }

      seenSrids.add(
        order.srid
      );

      if (
        order.is_cancel === null
      ) {
        nullIsCancel += 1;
        continue;
      }

      const nmId =
        Number(order.nm_id);

      if (
        !currentNmIds.has(nmId)
      ) {
        ordersOutsideCurrentSnapshot +=
          1;

        continue;
      }

      const current =
        salesByNmId.get(
          nmId
        ) ?? {
          active: 0,
          cancelled: 0,
        };

      if (
        order.is_cancel === true
      ) {
        current.cancelled += 1;
      } else {
        current.active += 1;
      }

      salesByNmId.set(
        nmId,
        current
      );
    }

    if (
      duplicateSrids.size > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "В WB orders найдены дубли srid",
          duplicateCount:
            duplicateSrids.size,
          sample:
            Array.from(
              duplicateSrids
            ).slice(0, 20),
        },
        {
          status: 409,
        }
      );
    }

    if (
      nullIsCancel > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "В WB orders найден is_cancel = null",
          rows:
            nullIsCancel,
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 6. ITEMS
    //
    // ВСЕ карточки текущего WB snapshot.
    // Флаг china_procurement_enabled НЕ фильтрует.
    // ========================================================

    const sellerArticleMismatches:
      Array<{
        nmId: number;
        currentSellerArticle: string | null;
        mappingSellerArticle: string | null;
        masterCode: string;
      }> = [];

    const items =
      stockResult.rows
        .map(
          stock => {
            const nmId =
              Number(stock.nm_id);

            const mapping =
              mappingByNmId.get(
                String(nmId)
              )!;

            const sales =
              salesByNmId.get(
                nmId
              ) ?? {
                active: 0,
                cancelled: 0,
              };

            const currentSellerArticle =
              stock.vendor_code
                ?.trim() ||
              null;

            const mappingSellerArticle =
              mapping.seller_article
                ?.trim() ||
              null;

            if (
              currentSellerArticle &&
              mappingSellerArticle &&
              currentSellerArticle
                .toLowerCase() !==
              mappingSellerArticle
                .toLowerCase()
            ) {
              sellerArticleMismatches.push(
                {
                  nmId,
                  currentSellerArticle,
                  mappingSellerArticle,
                  masterCode:
                    mapping.master_code,
                }
              );
            }

            return {
              masterCode:
                mapping.master_code,

              mappingStatus:
                "MAPPED_BY_WB_NMID",

              mappingSource:
                "marketplace_listings",

              nmId,

              supplierArticle:
                stock.vendor_code,

              mappingSellerArticle:
                mapping.seller_article,

              productName:
                stock.product_name,

              brandName:
                stock.brand_name,

              chinaProcurementEnabledFlag:
                mapping
                  .china_procurement_enabled,

              chinaProcurementFlagApplied:
                false,

              sales: {
                sales28Days:
                  sales.active,

                cancelled28Days:
                  sales.cancelled,

                avgSalesPerDay:
                  sales.active /
                  SALES_DAYS,
              },

              stock: {
                fbwStock:
                  safeNumber(
                    stock.stock_count
                  ),

                toClient:
                  safeNumber(
                    stock.to_client_count
                  ),

                fromClient:
                  safeNumber(
                    stock.from_client_count
                  ),
              },
            };
          }
        )
        .sort(
          (left, right) =>
            left.masterCode.localeCompare(
              right.masterCode
            ) ||
            left.nmId - right.nmId
        );

    // ========================================================
    // 7. SUMMARY
    // ========================================================

    const uniqueMasterCodes =
      new Set(
        items.map(
          item =>
            item.masterCode
        )
      );

    const activeSales28Days =
      items.reduce(
        (sum, item) =>
          sum +
          item.sales.sales28Days,
        0
      );

    const cancelled28Days =
      items.reduce(
        (sum, item) =>
          sum +
          item.sales.cancelled28Days,
        0
      );

    const totalFbwStock =
      items.reduce(
        (sum, item) =>
          sum +
          item.stock.fbwStock,
        0
      );

    const totalToClient =
      items.reduce(
        (sum, item) =>
          sum +
          item.stock.toClient,
        0
      );

    const totalFromClient =
      items.reduce(
        (sum, item) =>
          sum +
          item.stock.fromClient,
        0
      );

    const informationalDisabledFlags =
      items.filter(
        item =>
          item
            .chinaProcurementEnabledFlag ===
          false
      ).length;

    return NextResponse.json(
      {
        ok: true,

        message:
          "Все текущие карточки Wildberries подготовлены для общего расчёта по master_code",

        purpose: {
          marketplace:
            "Wildberries",

          fulfillment:
            "FBW",

          calculation:
            "MARKETPLACE_SOURCE",

          wbReplenishmentFormulaApplied:
            false,

          fbsSalesIncluded:
            false,

          chinaProcurementFlagApplied:
            false,

          note:
            "Учитываются все текущие карточки WB. china_procurement_enabled пока не используется как фильтр. Продажи только FBW.",
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
            wbPeriodFrom,

          wbTimestampToExclusive:
            wbPeriodToExclusive,
        },

        sourceVersions: {
          orders: {
            lastSuccessAt:
              wbStates.orders
                .last_success_at,

            lastHttpStatus:
              wbStates.orders
                .last_http_status,
          },

          stocks: {
            lastSuccessAt:
              wbStates.stocks
                .last_success_at,

            lastHttpStatus:
              wbStates.stocks
                .last_http_status,

            snapshotId,
          },

          mapping: {
            marketplace:
              WB_MARKETPLACE,

            accountKey:
              ACCOUNT_KEY,

            rows:
              mappingsResult.rows.length,
          },
        },

        validation: {
          mappings: {
            exactRows:
              mappingsExact,

            loadedRows:
              mappingsResult.rows.length,

            pages:
              mappingsResult.pages,

            duplicateExternalId:
              duplicateMappingIds.size,
          },

          orders: {
            exactRows:
              ordersExact,

            loadedRows:
              ordersResult.rows.length,

            pages:
              ordersResult.pages,

            duplicateSrid:
              duplicateSrids.size,

            nullIsCancel,

            warehouseType:
              WB_FBW_WAREHOUSE_TYPE,

            rowsOutsideCurrentSnapshot:
              ordersOutsideCurrentSnapshot,
          },

          stocks: {
            exactRows:
              stockExact,

            loadedRows:
              stockResult.rows.length,

            pages:
              stockResult.pages,

            duplicateNmId:
              duplicateNmIds.size,
          },

          mappingCurrentSnapshot: {
            mappedItems:
              items.length,

            unmappedItems:
              unmappedItems.length,

            sellerArticleMismatchItems:
              sellerArticleMismatches.length,
          },
        },

        summary: {
          skuCount:
            items.length,

          uniqueMasterCodes:
            uniqueMasterCodes.size,

          skuWithSales:
            items.filter(
              item =>
                item.sales
                  .sales28Days > 0
            ).length,

          activeSales28Days,

          cancelled28Days,

          totalFbwStock,

          totalToClient,

          totalFromClient,

          informationalDisabledFlags,

          allCurrentCardsIncluded:
            true,
        },

        sellerArticleMismatches,

        items,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "WB MARKETPLACE SOURCE ERROR",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "Не удалось собрать источник Wildberries",

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
