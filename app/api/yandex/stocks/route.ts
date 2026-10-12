import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


// ============================================================
// TYPES
// ============================================================

type YandexStock = {
  type?: string;
  count?: number;
};


type YandexTurnoverSummary = {
  turnover?: string;
  turnoverDays?: number;
};


type YandexOfferStock = {
  offerId?: string;

  stocks?: YandexStock[];

  turnoverSummary?:
    YandexTurnoverSummary;

  updatedAt?: string;
};


type YandexWarehouseStock = {
  warehouseId?: number;

  offers?: YandexOfferStock[];
};


type YandexStocksResponse = {
  status?: string;

  result?: {
    paging?: {
      nextPageToken?: string;
    };

    warehouses?:
      YandexWarehouseStock[];
  };

  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};


type YandexWarehouseInfo = {
  id?: number;
  name?: string;
};


type YandexWarehousesResponse = {
  status?: string;

  result?: {
    warehouses?:
      YandexWarehouseInfo[];
  };
};


type YandexProductRow = {
  id: number;

  offer_id: string;

  master_code:
    string | null;
};


type ProductRow = {
  id: string;

  offer_id: string;

  master_code:
    string | null;
};


type StockRow = {
  warehouse_id: number;

  offer_id: string;

  available: number;

  fit: number;

  frozen: number;

  quarantine: number;

  defect: number;

  expired: number;

  utilization: number;

  turnover:
    string | null;

  turnover_days:
    number | null;

  source_updated_at:
    string | null;

  raw_payload:
    Record<string, unknown>;
};


type SnapshotInsertRow = {
  sync_run_id: string;

  yandex_product_id: number;

  product_id:
    string | null;

  offer_id: string;

  master_code:
    string | null;

  warehouse_id: number;

  warehouse_name:
    string | null;

  available: number;

  fit: number;

  frozen: number;

  quarantine: number;

  defect: number;

  expired: number;

  utilization: number;

  turnover:
    string | null;

  turnover_days:
    number | null;

  source_updated_at:
    string | null;

  snapshot_date: string;

  raw_payload:
    Record<string, unknown>;
};


type SyncRunInsertResponse = {
  id: string;
};


// ============================================================
// CONFIG
// ============================================================

function getConfig() {
  const yandexApiKey =
    process.env
      .YANDEX_API_KEY
      ?.trim();


  const campaignId =
    process.env
      .YANDEX_CAMPAIGN_ID
      ?.trim();


  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim()
    ||
    process.env
      .SUPABASE_URL
      ?.trim();


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY
      ?.trim()
    ||
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
      ?.trim();


  if (!yandexApiKey) {
    throw new Error(
      "Не найдена YANDEX_API_KEY"
    );
  }


  if (!campaignId) {
    throw new Error(
      "Не найдена YANDEX_CAMPAIGN_ID"
    );
  }


  if (
    !/^\d+$/.test(
      campaignId
    )
  ) {
    throw new Error(
      "YANDEX_CAMPAIGN_ID должен быть числом"
    );
  }


  if (!supabaseUrl) {
    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL или SUPABASE_URL"
    );
  }


  if (!supabaseSecretKey) {
    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY"
    );
  }


  return {
    yandexApiKey,
    campaignId,
    supabaseUrl,
    supabaseSecretKey,
  };
}


// ============================================================
// DATE
// Красноярское время
// ============================================================

function getKrasnoyarskDate():
string {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Krasnoyarsk",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );


  const year =
    parts.find(
      part =>
        part.type ===
        "year"
    )?.value;


  const month =
    parts.find(
      part =>
        part.type ===
        "month"
    )?.value;


  const day =
    parts.find(
      part =>
        part.type ===
        "day"
    )?.value;


  if (
    !year
    ||
    !month
    ||
    !day
  ) {
    throw new Error(
      "Не удалось определить дату по Красноярску"
    );
  }


  return `${year}-${month}-${day}`;
}


// ============================================================
// STOCK COUNT
// ============================================================

function getStockCount(
  stocks:
    YandexStock[]
    | undefined,

  type:
    string
): number {
  if (!stocks) {
    return 0;
  }


  const row =
    stocks.find(
      item =>
        item.type ===
        type
    );


  const count =
    Number(
      row?.count
      ??
      0
    );


  if (
    !Number.isFinite(
      count
    )
    ||
    count <
      0
  ) {
    return 0;
  }


  return count;
}


// ============================================================
// YANDEX: FETCH STOCKS
// ============================================================

async function fetchYandexStocks(
  apiKey: string,
  campaignId: string
) {
  const rows:
    StockRow[] =
    [];


  let pageToken:
    string | null =
    null;


  let pages =
    0;


  const MAX_PAGES =
    100;


  while (
    pages <
    MAX_PAGES
  ) {
    pages +=
      1;


    const url =
      new URL(
        `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/offers/stocks`
      );


    url.searchParams.set(
      "limit",
      "100"
    );


    if (pageToken) {
      url.searchParams.set(
        "pageToken",
        pageToken
      );
    }


    const response =
      await fetch(
        url.toString(),
        {
          method:
            "POST",

          headers: {
            "Api-Key":
              apiKey,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify(
              {
                withTurnover:
                  true,
              }
            ),

          cache:
            "no-store",
        }
      );


    const responseText =
      await response.text();


    let data:
      YandexStocksResponse;


    try {
      data =
        JSON.parse(
          responseText
        ) as YandexStocksResponse;

    } catch {
      throw new Error(
        `Яндекс вернул некорректный JSON на странице ${pages}: ${responseText}`
      );
    }


    if (!response.ok) {
      throw new Error(
        `Яндекс stocks: HTTP ${response.status}: ${responseText}`
      );
    }


    const warehouses =
      data.result
        ?.warehouses
      ??
      [];


    for (
      const warehouse
      of warehouses
    ) {
      const warehouseId =
        Number(
          warehouse
            .warehouseId
        );


      if (
        !Number.isInteger(
          warehouseId
        )
        ||
        warehouseId <=
          0
      ) {
        continue;
      }


      for (
        const offer
        of warehouse.offers
        ??
        []
      ) {
        const offerId =
          String(
            offer.offerId
            ??
            ""
          )
            .trim();


        if (!offerId) {
          continue;
        }


        rows.push(
          {
            warehouse_id:
              warehouseId,

            offer_id:
              offerId,

            available:
              getStockCount(
                offer.stocks,
                "AVAILABLE"
              ),

            fit:
              getStockCount(
                offer.stocks,
                "FIT"
              ),

            frozen:
              getStockCount(
                offer.stocks,
                "FREEZE"
              ),

            quarantine:
              getStockCount(
                offer.stocks,
                "QUARANTINE"
              ),

            defect:
              getStockCount(
                offer.stocks,
                "DEFECT"
              ),

            expired:
              getStockCount(
                offer.stocks,
                "EXPIRED"
              ),

            utilization:
              getStockCount(
                offer.stocks,
                "UTILIZATION"
              ),

            turnover:
              offer
                .turnoverSummary
                ?.turnover
              ??
              null,

            turnover_days:
              typeof offer
                .turnoverSummary
                ?.turnoverDays ===
                "number"

                ? offer
                    .turnoverSummary
                    .turnoverDays

                : null,

            source_updated_at:
              offer.updatedAt
              ??
              null,

            raw_payload: {
              warehouseId,
              offer,
            },
          }
        );
      }
    }


    const nextPageToken =
      data.result
        ?.paging
        ?.nextPageToken
        ?.trim()
      ??
      "";


    if (!nextPageToken) {
      pageToken =
        null;

      break;
    }


    if (
      nextPageToken ===
      pageToken
    ) {
      throw new Error(
        "Яндекс повторно вернул тот же nextPageToken"
      );
    }


    pageToken =
      nextPageToken;
  }


  if (
    pages >=
      MAX_PAGES
    &&
    pageToken
  ) {
    throw new Error(
      "Достигнут защитный лимит страниц Яндекс Маркета"
    );
  }


  return {
    pages,
    rows,
  };
}


// ============================================================
// YANDEX: FETCH WAREHOUSES
// ============================================================

async function fetchWarehouseNames(
  apiKey: string,
  campaignId: string
) {
  const url =
    new URL(
      "https://api.partner.market.yandex.ru/v2/warehouses"
    );


  url.searchParams.set(
    "campaignId",
    campaignId
  );


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",

        headers: {
          "Api-Key":
            apiKey,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  const responseText =
    await response.text();


  let data:
    YandexWarehousesResponse;


  try {
    data =
      JSON.parse(
        responseText
      ) as YandexWarehousesResponse;

  } catch {
    throw new Error(
      `Не удалось разобрать список складов Яндекса: ${responseText}`
    );
  }


  if (!response.ok) {
    throw new Error(
      `Яндекс warehouses: HTTP ${response.status}: ${responseText}`
    );
  }


  const map =
    new Map<
      number,
      string
    >();


  for (
    const warehouse
    of data.result
      ?.warehouses
    ??
    []
  ) {
    const id =
      Number(
        warehouse.id
      );


    if (
      Number.isInteger(
        id
      )
      &&
      id >
        0
      &&
      warehouse.name
    ) {
      map.set(
        id,
        warehouse.name
      );
    }
  }


  return map;
}


// ============================================================
// SUPABASE HEADERS
// ============================================================

function getSupabaseHeaders(
  secretKey: string
) {
  return {
    apikey:
      secretKey,

    Authorization:
      `Bearer ${secretKey}`,

    "Content-Type":
      "application/json",

    Accept:
      "application/json",
  };
}


// ============================================================
// SUPABASE: READ ALL
// ============================================================

async function fetchAllSupabaseRows<T>(
  baseUrl: string,
  secretKey: string,
  table: string,
  select: string
): Promise<T[]> {
  const result:
    T[] =
    [];


  const pageSize =
    1000;


  let offset =
    0;


  while (true) {
    const url =
      new URL(
        `${baseUrl}/rest/v1/${table}`
      );


    url.searchParams.set(
      "select",
      select
    );


    url.searchParams.set(
      "limit",
      String(
        pageSize
      )
    );


    url.searchParams.set(
      "offset",
      String(
        offset
      )
    );


    const response =
      await fetch(
        url.toString(),
        {
          method:
            "GET",

          headers:
            getSupabaseHeaders(
              secretKey
            ),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    if (!response.ok) {
      throw new Error(
        `Supabase ${table}: HTTP ${response.status}: ${text}`
      );
    }


    const rows =
      JSON.parse(
        text
      ) as T[];


    result.push(
      ...rows
    );


    if (
      rows.length <
      pageSize
    ) {
      break;
    }


    offset +=
      pageSize;
  }


  return result;
}


// ============================================================
// SUPABASE: CREATE SYNC RUN
// ============================================================

async function createSyncRun(
  supabaseUrl: string,
  secretKey: string,
  snapshotDate: string,
  rowsReceived: number,
  uniqueOffersReceived: number,
  warehousesReceived: number
): Promise<string> {
  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_stock_sync_runs`
    );


  url.searchParams.set(
    "select",
    "id"
  );


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "POST",

        headers: {
          ...getSupabaseHeaders(
            secretKey
          ),

          Prefer:
            "return=representation",
        },

        body:
          JSON.stringify(
            {
              snapshot_date:
                snapshotDate,

              status:
                "success",

              rows_received:
                rowsReceived,

              unique_offers_received:
                uniqueOffersReceived,

              warehouses_received:
                warehousesReceived,

              rows_saved:
                0,

              linked_rows_saved:
                0,

              unlinked_rows_saved:
                0,
            }
          ),
      }
    );


  const text =
    await response.text();


  if (!response.ok) {
    throw new Error(
      `Не удалось создать yandex_stock_sync_runs: HTTP ${response.status}: ${text}`
    );
  }


  const rows =
    JSON.parse(
      text
    ) as SyncRunInsertResponse[];


  const id =
    rows[0]
      ?.id;


  if (!id) {
    throw new Error(
      "Supabase не вернул id запуска синхронизации"
    );
  }


  return id;
}


// ============================================================
// SUPABASE: UPSERT SNAPSHOTS
// ============================================================

async function upsertSnapshots(
  supabaseUrl: string,
  secretKey: string,
  rows: SnapshotInsertRow[]
) {
  const batchSize =
    200;


  let saved =
    0;


  for (
    let index =
      0;

    index <
      rows.length;

    index +=
      batchSize
  ) {
    const batch =
      rows.slice(
        index,
        index +
          batchSize
      );


    const url =
      new URL(
        `${supabaseUrl}/rest/v1/yandex_stock_snapshots`
      );


    url.searchParams.set(
      "on_conflict",
      "offer_id,warehouse_id,snapshot_date"
    );


    const response =
      await fetch(
        url.toString(),
        {
          method:
            "POST",

          headers: {
            ...getSupabaseHeaders(
              secretKey
            ),

            Prefer:
              "resolution=merge-duplicates,return=minimal",
          },

          body:
            JSON.stringify(
              batch
            ),
        }
      );


    const text =
      await response.text();


    if (!response.ok) {
      throw new Error(
        `Не удалось сохранить yandex_stock_snapshots: HTTP ${response.status}: ${text}`
      );
    }


    saved +=
      batch.length;
  }


  return saved;
}


// ============================================================
// SUPABASE: FINISH SYNC RUN
// ============================================================

async function finishSyncRun(
  supabaseUrl: string,
  secretKey: string,
  syncRunId: string,
  rowsSaved: number,
  linkedRowsSaved: number,
  unlinkedRowsSaved: number
) {
  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_stock_sync_runs`
    );


  url.searchParams.set(
    "id",
    `eq.${syncRunId}`
  );


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "PATCH",

        headers: {
          ...getSupabaseHeaders(
            secretKey
          ),

          Prefer:
            "return=minimal",
        },

        body:
          JSON.stringify(
            {
              rows_saved:
                rowsSaved,

              linked_rows_saved:
                linkedRowsSaved,

              unlinked_rows_saved:
                unlinkedRowsSaved,
            }
          ),
      }
    );


  const text =
    await response.text();


  if (!response.ok) {
    throw new Error(
      `Не удалось завершить yandex_stock_sync_runs: HTTP ${response.status}: ${text}`
    );
  }
}


// ============================================================
// SUPABASE: CLEANUP FAILED RUN
// ============================================================

async function deleteSyncRun(
  supabaseUrl: string,
  secretKey: string,
  syncRunId: string
) {
  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_stock_sync_runs`
    );


  url.searchParams.set(
    "id",
    `eq.${syncRunId}`
  );


  await fetch(
    url.toString(),
    {
      method:
        "DELETE",

      headers: {
        ...getSupabaseHeaders(
          secretKey
        ),

        Prefer:
          "return=minimal",
      },
    }
  );
}


// ============================================================
// PREPARE DATA
// ============================================================

async function prepareStockData() {
  const {
    yandexApiKey,
    campaignId,
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  const [
    stockResult,
    warehouseNames,
    yandexProducts,
    products,
  ] =
    await Promise.all(
      [
        fetchYandexStocks(
          yandexApiKey,
          campaignId
        ),

        fetchWarehouseNames(
          yandexApiKey,
          campaignId
        ),

        fetchAllSupabaseRows<
          YandexProductRow
        >(
          supabaseUrl,
          supabaseSecretKey,
          "yandex_products",
          "id,offer_id,master_code"
        ),

        fetchAllSupabaseRows<
          ProductRow
        >(
          supabaseUrl,
          supabaseSecretKey,
          "products",
          "id,offer_id,master_code"
        ),
      ]
    );


  const yandexProductByOffer =
    new Map<
      string,
      YandexProductRow
    >();


  for (
    const row
    of yandexProducts
  ) {
    yandexProductByOffer.set(
      row.offer_id,
      row
    );
  }


  const productByOffer =
    new Map<
      string,
      ProductRow
    >();


  for (
    const row
    of products
  ) {
    productByOffer.set(
      row.offer_id,
      row
    );
  }


  const missingOfferIds =
    Array.from(
      new Set(
        stockResult.rows
          .filter(
            row =>
              !yandexProductByOffer.has(
                row.offer_id
              )
          )
          .map(
            row =>
              row.offer_id
          )
      )
    )
      .sort();


  const uniqueOffers =
    new Set(
      stockResult.rows.map(
        row =>
          row.offer_id
      )
    );


  const warehouseIds =
    new Set(
      stockResult.rows.map(
        row =>
          row.warehouse_id
      )
    );


  return {
    campaignId,
    supabaseUrl,
    supabaseSecretKey,
    stockResult,
    warehouseNames,
    yandexProductByOffer,
    productByOffer,
    missingOfferIds,
    uniqueOffers,
    warehouseIds,
  };
}


// ============================================================
// GET
//
// ДИАГНОСТИКА.
// НИЧЕГО НЕ ПИШЕТ.
// ============================================================

export async function GET() {
  try {
    const prepared =
      await prepareStockData();


    const totals =
      prepared.stockResult.rows
        .reduce(
          (
            acc,
            row
          ) => {
            acc.available +=
              row.available;

            acc.fit +=
              row.fit;

            acc.frozen +=
              row.frozen;

            acc.quarantine +=
              row.quarantine;

            acc.defect +=
              row.defect;

            acc.expired +=
              row.expired;

            acc.utilization +=
              row.utilization;

            return acc;
          },
          {
            available:
              0,

            fit:
              0,

            frozen:
              0,

            quarantine:
              0,

            defect:
              0,

            expired:
              0,

            utilization:
              0,
          }
        );


    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "read_only_yandex_fby_stocks",

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        campaign_id:
          prepared.campaignId,

        pages:
          prepared.stockResult.pages,

        rows:
          prepared.stockResult.rows.length,

        unique_offers:
          prepared.uniqueOffers.size,

        warehouses:
          Array.from(
            prepared.warehouseIds
          ).sort(
            (
              a,
              b
            ) =>
              a - b
          ),

        warehouse_count:
          prepared.warehouseIds.size,

        missing_yandex_products:
          prepared.missingOfferIds,

        missing_yandex_products_count:
          prepared.missingOfferIds.length,

        totals,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX STOCKS GET ERROR:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status:
          500,
      }
    );
  }
}


// ============================================================
// POST
//
// РЕАЛЬНАЯ СИНХРОНИЗАЦИЯ ОСТАТКОВ.
// ============================================================

export async function POST() {
  let createdSyncRunId:
    string | null =
    null;


  try {
    const prepared =
      await prepareStockData();


    // ========================================================
    // Все offer_id из stocks обязаны существовать
    // в yandex_products.
    // ========================================================

    if (
      prepared
        .missingOfferIds
        .length >
      0
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          writes_to_yandex:
            false,

          writes_to_database:
            false,

          error:
            "В остатках Яндекса найдены offer_id, которых нет в yandex_products",

          missing_offer_ids:
            prepared.missingOfferIds,

          missing_offer_ids_count:
            prepared
              .missingOfferIds
              .length,
        },
        {
          status:
            409,
        }
      );
    }


    const snapshotDate =
      getKrasnoyarskDate();


    // ========================================================
    // Создаём запуск
    // ========================================================

    createdSyncRunId =
      await createSyncRun(
        prepared.supabaseUrl,
        prepared.supabaseSecretKey,
        snapshotDate,
        prepared.stockResult.rows.length,
        prepared.uniqueOffers.size,
        prepared.warehouseIds.size
      );


    // ========================================================
    // Готовим строки снимков
    // ========================================================

    const snapshots:
      SnapshotInsertRow[] =
      [];


    let linkedRows =
      0;


    let unlinkedRows =
      0;


    let resolvedProductIds =
      0;


    for (
      const stockRow
      of prepared
        .stockResult
        .rows
    ) {
      const yandexProduct =
        prepared
          .yandexProductByOffer
          .get(
            stockRow.offer_id
          );


      if (!yandexProduct) {
        throw new Error(
          `Не найден yandex_product для ${stockRow.offer_id}`
        );
      }


      const product =
        prepared
          .productByOffer
          .get(
            stockRow.offer_id
          )
        ??
        null;


      const masterCode =
        yandexProduct
          .master_code
          ?.trim()
        ||
        null;


      if (masterCode) {
        linkedRows +=
          1;

      } else {
        unlinkedRows +=
          1;
      }


      if (product) {
        resolvedProductIds +=
          1;
      }


      snapshots.push(
        {
          sync_run_id:
            createdSyncRunId,

          yandex_product_id:
            yandexProduct.id,

          product_id:
            product?.id
            ??
            null,

          offer_id:
            stockRow.offer_id,

          master_code:
            masterCode,

          warehouse_id:
            stockRow
              .warehouse_id,

          warehouse_name:
            prepared
              .warehouseNames
              .get(
                stockRow
                  .warehouse_id
              )
            ??
            null,

          available:
            stockRow.available,

          fit:
            stockRow.fit,

          frozen:
            stockRow.frozen,

          quarantine:
            stockRow.quarantine,

          defect:
            stockRow.defect,

          expired:
            stockRow.expired,

          utilization:
            stockRow.utilization,

          turnover:
            stockRow.turnover,

          turnover_days:
            stockRow
              .turnover_days,

          source_updated_at:
            stockRow
              .source_updated_at,

          snapshot_date:
            snapshotDate,

          raw_payload:
            stockRow
              .raw_payload,
        }
      );
    }


    // ========================================================
    // Сохраняем
    // ========================================================

    const rowsSaved =
      await upsertSnapshots(
        prepared.supabaseUrl,
        prepared.supabaseSecretKey,
        snapshots
      );


    // ========================================================
    // Завершаем запуск
    // ========================================================

    await finishSyncRun(
      prepared.supabaseUrl,
      prepared.supabaseSecretKey,
      createdSyncRunId,
      rowsSaved,
      linkedRows,
      unlinkedRows
    );


    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        ok:
          true,

        writes_to_yandex:
          false,

        writes_to_database:
          true,

        campaign_id:
          prepared.campaignId,

        sync_run_id:
          createdSyncRunId,

        snapshot_date:
          snapshotDate,

        pages_received:
          prepared.stockResult.pages,

        rows_received:
          prepared.stockResult.rows.length,

        unique_offers_received:
          prepared.uniqueOffers.size,

        warehouses_received:
          prepared.warehouseIds.size,

        rows_saved:
          rowsSaved,

        linked_rows_saved:
          linkedRows,

        unlinked_rows_saved:
          unlinkedRows,

        product_ids_resolved:
          resolvedProductIds,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX STOCKS POST ERROR:",
      error
    );


    // ========================================================
    // Если запуск уже создали, но дальше что-то упало,
    // удаляем его.
    // Снимки удалятся CASCADE.
    // ========================================================

    if (createdSyncRunId) {
      try {
        const {
          supabaseUrl,
          supabaseSecretKey,
        } =
          getConfig();


        await deleteSyncRun(
          supabaseUrl,
          supabaseSecretKey,
          createdSyncRunId
        );

      } catch (
        cleanupError
      ) {
        console.error(
          "YANDEX STOCKS CLEANUP ERROR:",
          cleanupError
        );
      }
    }


    return NextResponse.json(
      {
        ok:
          false,

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status:
          500,
      }
    );
  }
}
