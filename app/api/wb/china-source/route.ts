import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_DAYS =
  28;

const PAGE_SIZE =
  1000;

const FBW_WAREHOUSE_TYPE =
  "Склад WB";

const MARKETPLACE =
  "wildberries";

const ACCOUNT_KEY =
  "main";


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

  stage?:
    string | null;

  external_task_id?:
    string | null;

  last_snapshot_id?:
    string | null;
};


type OrderRow = {
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


type StockRow = {
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


type MarketplaceListingRow = {
  external_id:
    string;

  seller_article:
    string | null;

  master_code:
    string;

  is_active:
    boolean;
};


type SalesAggregate = {
  nmId:
    number;

  supplierArticle:
    string | null;

  barcode:
    string | null;

  activeOrders:
    number;

  cancelledOrders:
    number;
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


// ============================================================
// SUPABASE HEADERS
// ============================================================

function getHeaders() {

  const {
    supabaseKey,
  } =
    getSupabaseConfig();


  return {
    apikey:
      supabaseKey,

    Authorization:
      `Bearer ${supabaseKey}`,

    Accept:
      "application/json",
  };

}


// ============================================================
// ЧТЕНИЕ JSON
// ============================================================

async function readJsonResponse<T>(
  response:
    Response
): Promise<T> {

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
// ПОСТРАНИЧНОЕ ЧТЕНИЕ SUPABASE
// ============================================================

async function supabaseGetAll<T>(
  basePath:
    string,

  orderBy:
    string
): Promise<{
  rows: T[];
  pages: number;
}> {

  const {
    supabaseUrl,
  } =
    getSupabaseConfig();


  const rows:
    T[] =
    [];


  let from =
    0;

  let pages =
    0;


  while (true) {

    const separator =
      basePath.includes("?")
        ?
        "&"
        :
        "?";


    const url =
      `${supabaseUrl}/rest/v1/${basePath}`
      +
      `${separator}order=${encodeURIComponent(
        orderBy
      )}`;


    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            ...getHeaders(),

            Range:
              `${from}-${from + PAGE_SIZE - 1}`,
          },

          cache:
            "no-store",
        }
      );


    const page =
      await readJsonResponse<T[]>(
        response
      );


    rows.push(
      ...page
    );


    pages +=
      1;


    if (
      page.length
      <
      PAGE_SIZE
    ) {

      break;

    }


    from +=
      PAGE_SIZE;

  }


  return {
    rows,
    pages,
  };

}


// ============================================================
// ТОЧНЫЙ COUNT SUPABASE
// ============================================================

async function supabaseExactCount(
  basePath:
    string
): Promise<number> {

  const {
    supabaseUrl,
  } =
    getSupabaseConfig();


  const separator =
    basePath.includes("?")
      ?
      "&"
      :
      "?";


  const url =
    `${supabaseUrl}/rest/v1/${basePath}`
    +
    `${separator}limit=1`;


  const response =
    await fetch(
      url,
      {
        method:
          "GET",

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
      `Не удалось получить точный count Supabase. HTTP ${response.status}: ${text}`
    );

  }


  const contentRange =
    response.headers.get(
      "content-range"
    );


  if (!contentRange) {

    throw new Error(
      "Supabase не вернул content-range для exact count"
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
// СОСТОЯНИЕ СИНХРОНИЗАЦИИ
// ============================================================

async function getSyncStates():
Promise<{
  orders: SyncState | null;
  stocks: SyncState | null;
}> {

  const {
    supabaseUrl,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/wb_sync_state`
      +
      `?sync_key=in.(orders,stocks)`
      +
      `&select=*`,
      {
        method:
          "GET",

        headers:
          getHeaders(),

        cache:
          "no-store",
      }
    );


  const rows =
    await readJsonResponse<
      SyncState[]
    >(
      response
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
// ДАТА
// ============================================================

function subtractDays(
  iso:
    string,

  days:
    number
): string {

  const date =
    new Date(
      iso
    );


  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {

    throw new Error(
      `Некорректная дата: ${iso}`
    );

  }


  return new Date(
    date.getTime()
    -
    days
    *
    24
    *
    60
    *
    60
    *
    1000
  ).toISOString();

}


// ============================================================
// ЧИСЛО
// ============================================================

function safeNonNegativeInteger(
  value:
    unknown
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


  return Math.max(
    0,
    Math.trunc(
      number
    )
  );

}


// ============================================================
// НОРМАЛИЗАЦИЯ АРТИКУЛА ДЛЯ КОНТРОЛЯ
//
// ВАЖНО:
// артикул продавца НЕ используется как основной ключ.
// Основной ключ WB = nmID / external_id.
//
// Эта функция нужна только для диагностики.
// ============================================================

function normalizeSellerArticle(
  value:
    string | null
): string {

  if (!value) {

    return "";

  }


  return value
    .trim()
    .toLowerCase()
    .replace(
      /ё/g,
      "е"
    )
    .replace(
      /\s+/g,
      " "
    );

}


// ============================================================
// GET
// ============================================================

export async function GET() {

  try {

    // ========================================================
    // 1. СОСТОЯНИЕ СИНХРОНИЗАЦИИ WB
    // ========================================================

    const states =
      await getSyncStates();


    if (
      !states.orders
        ?.last_success_at
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Нет успешной синхронизации заказов Wildberries",
        },
        {
          status:
            409,
        }
      );

    }


    if (
      !states.stocks
        ?.last_success_at
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Нет успешной синхронизации остатков Wildberries",
        },
        {
          status:
            409,
        }
      );

    }


    if (
      !states.stocks
        ?.last_snapshot_id
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "В wb_sync_state не найден последний snapshot остатков Wildberries",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 2. ФИКСИРУЕМ ПЕРИОД
    //
    // Пока конец периода = последняя успешная
    // синхронизация заказов WB.
    //
    // Когда подключим Ozon, установим один общий период
    // для обеих площадок.
    // ========================================================

    const periodEnd =
      states.orders
        .last_success_at;


    const periodStart =
      subtractDays(
        periodEnd,
        SALES_DAYS
      );


    const snapshotId =
      states.stocks
        .last_snapshot_id;


    // ========================================================
    // 3. ЗАГРУЖАЕМ СПРАВОЧНИК WB → MASTER_CODE
    // ========================================================

    const mappingsBasePath =
      "marketplace_listings"
      +
      "?select=external_id,seller_article,master_code,is_active"
      +
      `&marketplace=eq.${MARKETPLACE}`
      +
      `&account_key=eq.${ACCOUNT_KEY}`
      +
      "&is_active=eq.true";


    const exactMappingCount =
      await supabaseExactCount(
        mappingsBasePath
      );


    const mappingResult =
      await supabaseGetAll<
        MarketplaceListingRow
      >(
        mappingsBasePath,
        "external_id.asc"
      );


    if (
      mappingResult.rows.length
      !==
      exactMappingCount
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Количество загруженных связей WB → master_code не совпало с точным count Supabase",

          validation: {
            exactCount:
              exactMappingCount,

            loaded:
              mappingResult.rows.length,

            pages:
              mappingResult.pages,
          },
        },
        {
          status:
            409,
        }
      );

    }


    const listingByNmId =
      new Map<
        string,
        MarketplaceListingRow
      >();


    const duplicateMappingExternalIds:
      string[] =
      [];


    for (
      const row
      of mappingResult.rows
    ) {

      const externalId =
        String(
          row.external_id
        ).trim();


      if (
        listingByNmId.has(
          externalId
        )
      ) {

        duplicateMappingExternalIds.push(
          externalId
        );

      }


      listingByNmId.set(
        externalId,
        row
      );

    }


    if (
      duplicateMappingExternalIds.length
      >
      0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "В marketplace_listings обнаружены повторяющиеся WB external_id",

          duplicateCount:
            duplicateMappingExternalIds.length,

          sample:
            duplicateMappingExternalIds.slice(
              0,
              20
            ),
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 4. ЗАКАЗЫ FBW
    // ========================================================

    const ordersBasePath =
      "wb_orders"
      +
      "?select=srid,order_date,nm_id,supplier_article,barcode,warehouse_type,is_cancel"
      +
      `&warehouse_type=eq.${encodeURIComponent(
        FBW_WAREHOUSE_TYPE
      )}`
      +
      `&order_date=gte.${encodeURIComponent(
        periodStart
      )}`
      +
      `&order_date=lte.${encodeURIComponent(
        periodEnd
      )}`;


    const exactOrderCount =
      await supabaseExactCount(
        ordersBasePath
      );


    const orderResult =
      await supabaseGetAll<OrderRow>(
        ordersBasePath,
        "order_date.asc,srid.asc"
      );


    if (
      orderResult.rows.length
      !==
      exactOrderCount
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Количество загруженных заказов WB не совпало с точным count Supabase",

          validation: {
            exactCount:
              exactOrderCount,

            loaded:
              orderResult.rows.length,

            pages:
              orderResult.pages,
          },
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 5. ПРОВЕРЯЕМ ЗАКАЗЫ
    // ========================================================

    const duplicateSrid =
      new Set<string>();


    const seenSrid =
      new Set<string>();


    let nullCancelRows =
      0;


    for (
      const order
      of orderResult.rows
    ) {

      if (
        seenSrid.has(
          order.srid
        )
      ) {

        duplicateSrid.add(
          order.srid
        );

      }


      seenSrid.add(
        order.srid
      );


      if (
        order.is_cancel
        ===
        null
      ) {

        nullCancelRows +=
          1;

      }

    }


    if (
      duplicateSrid.size
      >
      0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "В выборке заказов WB обнаружены повторяющиеся srid",

          duplicateCount:
            duplicateSrid.size,

          sample:
            Array.from(
              duplicateSrid
            ).slice(
              0,
              20
            ),
        },
        {
          status:
            409,
        }
      );

    }


    if (
      nullCancelRows
      >
      0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "В заказах WB обнаружен неопределённый is_cancel",

          nullCancelRows,
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 6. АГРЕГИРУЕМ ПРОДАЖИ ПО NMID
    // ========================================================

    const salesByNmId =
      new Map<
        number,
        SalesAggregate
      >();


    let activeOrders =
      0;


    let cancelledOrders =
      0;


    for (
      const order
      of orderResult.rows
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


      const current =
        salesByNmId.get(
          nmId
        )
        ??
        {
          nmId,

          supplierArticle:
            order.supplier_article
            ??
            null,

          barcode:
            order.barcode
            ??
            null,

          activeOrders:
            0,

          cancelledOrders:
            0,
        };


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


      if (
        order.is_cancel
        ===
        true
      ) {

        current.cancelledOrders +=
          1;

        cancelledOrders +=
          1;

      } else {

        current.activeOrders +=
          1;

        activeOrders +=
          1;

      }


      salesByNmId.set(
        nmId,
        current
      );

    }


    // ========================================================
    // 7. ОСТАТКИ ИЗ КОНКРЕТНОГО SNAPSHOT
    // ========================================================

    const stocksBasePath =
      "wb_stock_product_snapshots"
      +
      "?select=snapshot_id,snapshot_at,nm_id,vendor_code,product_name,brand_name,stock_count,to_client_count,from_client_count,availability"
      +
      `&snapshot_id=eq.${encodeURIComponent(
        snapshotId
      )}`;


    const exactStockCount =
      await supabaseExactCount(
        stocksBasePath
      );


    const stockResult =
      await supabaseGetAll<StockRow>(
        stocksBasePath,
        "nm_id.asc"
      );


    if (
      stockResult.rows.length
      !==
      exactStockCount
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Количество строк snapshot остатков WB не совпало с точным count Supabase",

          validation: {
            exactCount:
              exactStockCount,

            loaded:
              stockResult.rows.length,

            pages:
              stockResult.pages,

            snapshotId,
          },
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 8. ПРОВЕРЯЕМ ДУБЛИ NMID В SNAPSHOT
    // ========================================================

    const stockByNmId =
      new Map<
        number,
        StockRow
      >();


    const duplicateStockNmIds:
      number[] =
      [];


    for (
      const row
      of stockResult.rows
    ) {

      const nmId =
        Number(
          row.nm_id
        );


      if (
        stockByNmId.has(
          nmId
        )
      ) {

        duplicateStockNmIds.push(
          nmId
        );

      }


      stockByNmId.set(
        nmId,
        row
      );

    }


    if (
      duplicateStockNmIds.length
      >
      0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "В snapshot остатков WB обнаружены повторяющиеся nmID",

          duplicateCount:
            duplicateStockNmIds.length,

          sample:
            duplicateStockNmIds.slice(
              0,
              20
            ),
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 9. ОБЪЕДИНЯЕМ ПРОДАЖИ И ОСТАТКИ
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


    const items =
      Array.from(
        allNmIds
      )
        .sort(
          (
            a,
            b
          ) =>
            a - b
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


            const listing =
              listingByNmId.get(
                String(
                  nmId
                )
              )
              ??
              null;


            const sales28Days =
              sales
                ?.activeOrders
              ??
              0;


            const cancelled28Days =
              sales
                ?.cancelledOrders
              ??
              0;


            const avgSalesPerDay =
              sales28Days
              /
              SALES_DAYS;


            const fbwStock =
              stock
                ?
                safeNonNegativeInteger(
                  stock.stock_count
                )
                :
                0;


            const toClient =
              stock
                ?
                safeNonNegativeInteger(
                  stock.to_client_count
                )
                :
                0;


            const fromClient =
              stock
                ?
                safeNonNegativeInteger(
                  stock.from_client_count
                )
                :
                0;


            const currentSellerArticle =
              sales
                ?.supplierArticle
              ??
              stock
                ?.vendor_code
              ??
              null;


            const mappingSellerArticle =
              listing
                ?.seller_article
              ??
              null;


            let sellerArticleCheck:
              "MATCH"
              |
              "MISMATCH"
              |
              "NO_REFERENCE"
              =
              "NO_REFERENCE";


            if (
              currentSellerArticle
              &&
              mappingSellerArticle
            ) {

              sellerArticleCheck =
                normalizeSellerArticle(
                  currentSellerArticle
                )
                ===
                normalizeSellerArticle(
                  mappingSellerArticle
                )
                  ?
                  "MATCH"
                  :
                  "MISMATCH";

            }


            return {

              // -----------------------------------------------
              // ЕДИНЫЙ ФИЗИЧЕСКИЙ ТОВАР
              // -----------------------------------------------

              masterCode:
                listing
                  ?.master_code
                ??
                null,

              mappingStatus:
                listing
                  ?
                  "MAPPED_BY_WB_NMID"
                  :
                  "UNMAPPED",

              mappingSource:
                listing
                  ?
                  "marketplace_listings"
                  :
                  null,


              // -----------------------------------------------
              // WB
              // -----------------------------------------------

              nmId,

              supplierArticle:
                currentSellerArticle,

              mappingSellerArticle,

              sellerArticleCheck,

              barcode:
                sales
                  ?.barcode
                ??
                null,

              productName:
                stock
                  ?.product_name
                ??
                null,

              brandName:
                stock
                  ?.brand_name
                ??
                null,


              // -----------------------------------------------
              // ПРОДАЖИ
              // -----------------------------------------------

              sales: {

                periodDays:
                  SALES_DAYS,

                sales28Days,

                cancelled28Days,

                avgSalesPerDay,
              },


              // -----------------------------------------------
              // ОСТАТКИ
              // -----------------------------------------------

              stock: {

                fbwStock,

                toClient,

                fromClient,

                availability:
                  stock
                    ?.availability
                  ??
                  null,

                presentInSnapshot:
                  Boolean(
                    stock
                  ),

                source:
                  stock
                    ?
                    "WB_STOCK_SNAPSHOT"
                    :
                    "ABSENT_FROM_WB_SNAPSHOT_ASSUMED_ZERO",
              },

            };

          }
        );


    // ========================================================
    // 10. ПРОВЕРЯЕМ ПОКРЫТИЕ MASTER_CODE
    // ========================================================

    const mappedItems =
      items.filter(
        (item) =>
          item.masterCode
          !==
          null
      );


    const unmappedItems =
      items.filter(
        (item) =>
          item.masterCode
          ===
          null
      );


    const sellerArticleMismatchItems =
      items.filter(
        (item) =>
          item.sellerArticleCheck
          ===
          "MISMATCH"
      );


    const uniqueMasterCodes =
      new Set(
        mappedItems.map(
          (item) =>
            item.masterCode
        )
      );


    // ========================================================
    // 11. ИТОГИ
    // ========================================================

    const totalFbwStock =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.stock.fbwStock,
        0
      );


    const totalToClient =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.stock.toClient,
        0
      );


    const totalFromClient =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.stock.fromClient,
        0
      );


    const itemsWithSales =
      items.filter(
        (item) =>
          item.sales
            .sales28Days
          >
          0
      ).length;


    const absentStockItems =
      items.filter(
        (item) =>
          !item.stock
            .presentInSnapshot
      );


    // ========================================================
    // 12. ЕСЛИ ЕСТЬ SKU БЕЗ MASTER_CODE, НЕ ПРИТВОРЯЕМСЯ,
    //     ЧТО ИСТОЧНИК ГОТОВ К ОБЩЕМУ РАСЧЁТУ КИТАЯ
    // ========================================================

    const mappingReady =
      unmappedItems.length
      ===
      0;


    const responseBody = {

      ok:
        mappingReady,

      message:
        mappingReady
          ?
          "Данные Wildberries для общего расчёта Китая подготовлены и связаны с master_code"
          :
          "Не все текущие SKU Wildberries связаны с master_code",


      purpose: {

        marketplace:
          "Wildberries",

        fulfillment:
          "FBW",

        calculation:
          "CHINA_SOURCE_ONLY",

        wbReplenishmentFormulaApplied:
          false,

        note:
          "Маршрут отдаёт исходные продажи и остатки WB. Формула поставки Wildberries 10/30/40 дней здесь не применяется.",
      },


      mapping: {

        targetKey:
          "master_code",

        source:
          "public.marketplace_listings",

        join:
          "WB nmID -> marketplace_listings.external_id",

        currentStatus:
          mappingReady
            ?
            "CONNECTED"
            :
            "INCOMPLETE",

        mappedItems:
          mappedItems.length,

        unmappedItems:
          unmappedItems.length,

        uniqueMasterCodes:
          uniqueMasterCodes.size,

        sellerArticleMismatchItems:
          sellerArticleMismatchItems.length,

        note:
          "Основной ключ сопоставления — числовой nmID Wildberries. Словесный артикул продавца используется только для дополнительного контроля.",
      },


      sourceVersions: {

        orders: {

          lastSuccessAt:
            states.orders
              .last_success_at,

          lastHttpStatus:
            states.orders
              .last_http_status,
        },


        stocks: {

          lastSuccessAt:
            states.stocks
              .last_success_at,

          lastHttpStatus:
            states.stocks
              .last_http_status,

          snapshotId,
        },


        mapping: {

          marketplace:
            MARKETPLACE,

          accountKey:
            ACCOUNT_KEY,

          rows:
            mappingResult.rows.length,
        },

      },


      period: {

        days:
          SALES_DAYS,

        start:
          periodStart,

        end:
          periodEnd,
      },


      validation: {

        mappings: {

          exactRows:
            exactMappingCount,

          loadedRows:
            mappingResult.rows.length,

          pages:
            mappingResult.pages,

          duplicateExternalId:
            duplicateMappingExternalIds.length,
        },


        orders: {

          exactRows:
            exactOrderCount,

          loadedRows:
            orderResult.rows.length,

          pages:
            orderResult.pages,

          active:
            activeOrders,

          cancelled:
            cancelledOrders,

          nullIsCancel:
            nullCancelRows,

          duplicateSrid:
            duplicateSrid.size,
        },


        stocks: {

          exactRows:
            exactStockCount,

          loadedRows:
            stockResult.rows.length,

          pages:
            stockResult.pages,

          duplicateNmId:
            duplicateStockNmIds.length,
        },

      },


      summary: {

        skuCount:
          items.length,

        skuWithSales:
          itemsWithSales,

        activeSales28Days:
          activeOrders,

        cancelled28Days:
          cancelledOrders,

        totalFbwStock,

        totalToClient,

        totalFromClient,

        absentFromStockSnapshot:
          absentStockItems.length,

        mappedToMasterCode:
          mappedItems.length,

        unmappedFromMasterCode:
          unmappedItems.length,

        uniqueMasterCodes:
          uniqueMasterCodes.size,
      },


      unmappedItems:
        unmappedItems.map(
          (item) => ({
            nmId:
              item.nmId,

            supplierArticle:
              item.supplierArticle,

            productName:
              item.productName,

            sales28Days:
              item.sales
                .sales28Days,

            fbwStock:
              item.stock
                .fbwStock,
          })
        ),


      sellerArticleMismatches:
        sellerArticleMismatchItems.map(
          (item) => ({
            nmId:
              item.nmId,

            currentSellerArticle:
              item.supplierArticle,

            mappingSellerArticle:
              item.mappingSellerArticle,

            masterCode:
              item.masterCode,
          })
        ),


      absentFromStockSnapshot:
        absentStockItems.map(
          (item) => ({
            nmId:
              item.nmId,

            supplierArticle:
              item.supplierArticle,

            masterCode:
              item.masterCode,

            sales28Days:
              item.sales
                .sales28Days,
          })
        ),


      items,

    };


    return NextResponse.json(
      responseBody,
      {
        status:
          mappingReady
            ?
            200
            :
            409,
      }
    );

  } catch (error) {

    console.error(
      "Ошибка подготовки WB China source:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не удалось подготовить данные Wildberries для расчёта Китая",

        error:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка",
      },
      {
        status:
          500,
      }
    );

  }

}
