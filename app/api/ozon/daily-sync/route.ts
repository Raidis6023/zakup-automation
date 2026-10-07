export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_WINDOW_DAYS =
  28;

const OZON_MAX_RETRIES =
  5;

const RETRY_BASE_MS =
  1500;

const MAX_FBO_POSTING_PAGES =
  1000;

const MAX_STOCK_PAGES =
  100;

const STOCK_OFFER_BATCH_SIZE =
  900;

const PRODUCT_INFO_BATCH_SIZE =
  900;


// ============================================================
// ТИПЫ
// ============================================================

type ProductRow = {
  id: string;

  offer_id: string;

  ozon_product_id:
    | number
    | string
    | null;

  name:
    | string
    | null;

  master_code:
    | string
    | null;

  is_active: boolean;
};


type OzonClusterWarehouse = {
  warehouse_id?:
    | number
    | string;

  name?: string;
};


type OzonLogisticCluster = {
  warehouses?:
    OzonClusterWarehouse[];
};


type OzonCluster = {
  id?:
    | number
    | string;

  name?: string;

  logistic_clusters?:
    OzonLogisticCluster[];
};


type OzonClusterResponse = {
  clusters?:
    OzonCluster[];
};


type FboPostingProduct = {
  sku?:
    | number
    | string;

  offer_id?: string;

  name?: string;

  quantity?: number;
};


type FboPostingAnalytics = {
  warehouse_id?:
    | number
    | string;

  warehouse_name?: string;
};


type FboPosting = {
  posting_number?: string;

  order_number?: string;

  status?: string;

  created_at?: string;

  products?:
    FboPostingProduct[];

  analytics_data?:
    | FboPostingAnalytics
    | null;
};


type FboPostingResponse = {
  postings?:
    FboPosting[];

  cursor?: string;

  has_next?: boolean;
};


type FboWarehouseStock = {
  sku?:
    | number
    | string;

  offer_id?: string;

  product_id?:
    | number
    | string;

  warehouse_id?:
    | number
    | string;

  warehouse_name?: string;

  present?: number;

  reserved?: number;

  [key: string]:
    unknown;
};


type FboWarehouseStocksResponse = {
  products?:
    FboWarehouseStock[];

  cursor?: string;

  has_next?: boolean;

  result?: {
    products?:
      FboWarehouseStock[];

    cursor?: string;

    has_next?: boolean;
  };

  [key: string]:
    unknown;
};


type OzonProductInfoItem = {
  id?:
    | number
    | string;

  offer_id?: string;

  sku?:
    | number
    | string;

  name?: string;

  [key: string]:
    unknown;
};


type OzonProductInfoListResponse = {
  items?:
    OzonProductInfoItem[];
};


type WarehouseCluster = {
  clusterId: string;

  clusterName: string;

  warehouseName: string;
};


type SkuResolution = {
  sku: string;

  ozonProductId:
    | string
    | null;

  ozonOfferId:
    | string
    | null;

  ozonName:
    | string
    | null;

  product:
    | ProductRow
    | null;

  resolutionReason:
    string;
};


type SalesWriteRow = {
  product_id: string;

  cluster_id: string;

  cluster_name:
    | string
    | null;

  sale_date: string;

  sales_quantity: number;

  cancelled_quantity: number;

  raw_payload:
    Record<
      string,
      unknown
    >;
};


type StockWriteRow = {
  product_id: string;

  cluster_id: string;

  cluster_name:
    | string
    | null;

  quantity: number;

  raw_payload:
    Record<
      string,
      unknown
    >;
};


type ApplySyncResult = {
  ok: boolean;

  sales_sync_run_id: string;

  date_from: string;

  date_to: string;

  completed_days: number;

  sales_rows_saved: number;

  snapshot_date: string;

  stock_rows_saved: number;

  postings_received: number;

  cancelled_postings: number;
};


// ============================================================
// ОБЩИЕ HELPERS
// ============================================================

function normalizeKey(
  value: unknown
): string {

  return String(
    value ?? ""
  ).trim();
}


function toSafeInteger(
  value: unknown
): number {

  const parsed =
    Number(
      value ?? 0
    );


  if (
    !Number.isFinite(
      parsed
    )
  ) {

    return 0;

  }


  return Math.max(
    0,
    Math.trunc(
      parsed
    )
  );
}


function sleep(
  milliseconds: number
) {

  return new Promise<void>(
    resolve => {

      setTimeout(
        resolve,
        milliseconds
      );

    }
  );
}


function chunkArray<T>(
  rows: T[],
  size: number
): T[][] {

  const result:
    T[][] = [];


  for (
    let index = 0;
    index < rows.length;
    index += size
  ) {

    result.push(
      rows.slice(
        index,
        index + size
      )
    );

  }


  return result;
}


// ============================================================
// ДАТЫ МОСКВЫ
// ============================================================

function getMoscowTodayDate():
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
      part =>
        part.type === "year"
    )?.value;


  const month =
    parts.find(
      part =>
        part.type === "month"
    )?.value;


  const day =
    parts.find(
      part =>
        part.type === "day"
    )?.value;


  if (
    !year
    ||
    !month
    ||
    !day
  ) {

    throw new Error(
      "Не удалось определить текущую дату по Москве"
    );

  }


  return [
    year,
    month,
    day,
  ].join(
    "-"
  );
}


function addDays(
  date: string,
  delta: number
): string {

  const parsed =
    new Date(
      `${date}T00:00:00Z`
    );


  parsed.setUTCDate(
    parsed.getUTCDate()
    +
    delta
  );


  return parsed
    .toISOString()
    .slice(
      0,
      10
    );
}


function isoToMoscowDate(
  value:
    string
    | undefined
): string | null {

  if (!value) {

    return null;

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


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
      date
    );


  const year =
    parts.find(
      part =>
        part.type === "year"
    )?.value;


  const month =
    parts.find(
      part =>
        part.type === "month"
    )?.value;


  const day =
    parts.find(
      part =>
        part.type === "day"
    )?.value;


  if (
    !year
    ||
    !month
    ||
    !day
  ) {

    return null;

  }


  return [
    year,
    month,
    day,
  ].join(
    "-"
  );
}


// ============================================================
// CONFIG
// ============================================================

function getConfig() {

  const ozonClientId =
    process.env
      .OZON_CLIENT_ID;


  const ozonApiKey =
    process.env
      .OZON_API_KEY;


  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  const cronSecret =
    process.env
      .CRON_SECRET;


  if (!ozonClientId) {

    throw new Error(
      "Не найдена переменная OZON_CLIENT_ID"
    );

  }


  if (!ozonApiKey) {

    throw new Error(
      "Не найдена переменная OZON_API_KEY"
    );

  }


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена переменная NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена переменная SUPABASE_SECRET_KEY"
    );

  }


  if (!cronSecret) {

    throw new Error(
      "Не найдена переменная CRON_SECRET"
    );

  }


  return {
    ozonClientId,
    ozonApiKey,
    supabaseUrl,
    supabaseSecretKey,
    cronSecret,
  };
}


// ============================================================
// АВТОРИЗАЦИЯ
// ============================================================

function isAuthorized(
  request: Request
): boolean {

  const {
    cronSecret,
  } =
    getConfig();


  return (
    request.headers.get(
      "authorization"
    )
    ===
    `Bearer ${cronSecret}`
  );
}


// ============================================================
// OZON RETRY
// ============================================================

function getRetryDelayMs(
  response: Response,
  attempt: number
) {

  const retryAfter =
    response.headers.get(
      "retry-after"
    );


  if (retryAfter) {

    const seconds =
      Number(
        retryAfter
      );


    if (
      Number.isFinite(
        seconds
      )
      &&
      seconds > 0
    ) {

      return Math.ceil(
        seconds * 1000
      );

    }

  }


  return (
    RETRY_BASE_MS
    *
    attempt
  );
}


// ============================================================
// OZON POST
// ============================================================

async function ozonPost<T>(
  path: string,
  body: unknown
):
Promise<T> {

  const {
    ozonClientId,
    ozonApiKey,
  } =
    getConfig();


  for (
    let attempt = 1;
    attempt <= OZON_MAX_RETRIES;
    attempt += 1
  ) {

    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () => {

          controller.abort();

        },
        30000
      );


    try {

      const response =
        await fetch(
          `https://api-seller.ozon.ru${path}`,
          {
            method:
              "POST",

            headers: {
              "Client-Id":
                ozonClientId,

              "Api-Key":
                ozonApiKey,

              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify(
                body
              ),

            cache:
              "no-store",

            signal:
              controller.signal,
          }
        );


      const text =
        await response.text();


      let parsed:
        unknown = null;


      if (text) {

        try {

          parsed =
            JSON.parse(
              text
            );

        } catch {

          parsed = {
            raw:
              text,
          };

        }

      }


      if (
        response.status ===
        429
      ) {

        if (
          attempt ===
          OZON_MAX_RETRIES
        ) {

          throw new Error(
            [
              `Ozon API ${path}`,
              "HTTP 429",
              JSON.stringify(
                parsed
              ),
            ].join(
              ": "
            )
          );

        }


        await sleep(
          getRetryDelayMs(
            response,
            attempt
          )
        );


        continue;

      }


      if (
        response.status >= 500
        &&
        response.status <= 599
        &&
        attempt < OZON_MAX_RETRIES
      ) {

        await sleep(
          RETRY_BASE_MS
          *
          attempt
        );


        continue;

      }


      if (!response.ok) {

        throw new Error(
          [
            `Ozon API ${path}`,
            `HTTP ${response.status}`,
            JSON.stringify(
              parsed
            ),
          ].join(
            ": "
          )
        );

      }


      return parsed as T;

    } catch (error) {

      if (
        error instanceof Error
        &&
        error.name ===
          "AbortError"
        &&
        attempt <
          OZON_MAX_RETRIES
      ) {

        await sleep(
          RETRY_BASE_MS
          *
          attempt
        );


        continue;

      }


      throw error;

    } finally {

      clearTimeout(
        timeout
      );

    }

  }


  throw new Error(
    `Ozon API ${path}: исчерпаны все попытки`
  );
}


// ============================================================
// SUPABASE RPC
// ============================================================

async function supabaseRpc<T>(
  functionName: string,
  body:
    Record<
      string,
      unknown
    >
):
Promise<T> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/${functionName}`,
      {
        method:
          "POST",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            body
          ),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      [
        `Supabase RPC ${functionName}`,
        `HTTP ${response.status}`,
        text,
      ].join(
        ": "
      )
    );

  }


  if (!text) {

    throw new Error(
      `Supabase RPC ${functionName} вернул пустой ответ`
    );

  }


  return JSON.parse(
    text
  ) as T;
}


// ============================================================
// PRODUCTS
// ============================================================

async function getProducts():
Promise<ProductRow[]> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  const url =
    new URL(
      `${supabaseUrl}/rest/v1/products`
    );


  url.searchParams.set(
    "select",
    [
      "id",
      "offer_id",
      "ozon_product_id",
      "name",
      "master_code",
      "is_active",
    ].join(
      ","
    )
  );


  url.searchParams.set(
    "limit",
    "5000"
  );


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

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
      `Supabase products: HTTP ${response.status}: ${text}`
    );

  }


  return JSON.parse(
    text
  ) as ProductRow[];
}


// ============================================================
// ИНДЕКСЫ PRODUCTS
// ============================================================

function buildProductIndexes(
  products:
    ProductRow[]
) {

  const byOffer =
    new Map<
      string,
      ProductRow
    >();


  const byOzonProductId =
    new Map<
      string,
      ProductRow
    >();


  for (
    const product
    of products
  ) {

    const offerId =
      normalizeKey(
        product.offer_id
      );


    if (offerId) {

      byOffer.set(
        offerId,
        product
      );

    }


    const ozonProductId =
      normalizeKey(
        product.ozon_product_id
      );


    if (ozonProductId) {

      byOzonProductId.set(
        ozonProductId,
        product
      );

    }

  }


  return {
    byOffer,
    byOzonProductId,
  };
}


// ============================================================
// CLUSTERS
// ============================================================

async function getOzonClusters() {

  const response =
    await ozonPost<
      OzonClusterResponse
    >(
      "/v1/cluster/list",
      {
        cluster_type:
          "CLUSTER_TYPE_OZON",
      }
    );


  const clusters =
    response.clusters
    ?? [];


  const warehouseToCluster =
    new Map<
      string,
      WarehouseCluster
    >();


  for (
    const cluster
    of clusters
  ) {

    const clusterId =
      normalizeKey(
        cluster.id
      );


    const clusterName =
      normalizeKey(
        cluster.name
      );


    for (
      const logisticCluster
      of cluster.logistic_clusters
        ?? []
    ) {

      for (
        const warehouse
        of logisticCluster.warehouses
          ?? []
      ) {

        const warehouseId =
          normalizeKey(
            warehouse.warehouse_id
          );


        if (!warehouseId) {

          continue;

        }


        warehouseToCluster.set(
          warehouseId,
          {
            clusterId,

            clusterName,

            warehouseName:
              normalizeKey(
                warehouse.name
              ),
          }
        );

      }

    }

  }


  return {
    clusters,
    warehouseToCluster,
  };
}


// ============================================================
// 28 ДНЕЙ FBO POSTINGS
// ============================================================

async function getFboPostingsForRange(
  dateFrom: string,
  dateTo: string
) {

  const since =
    `${dateFrom}T00:00:00+03:00`;


  const to =
    `${dateTo}T23:59:59+03:00`;


  const allPostings:
    FboPosting[] = [];


  let cursor =
    "";


  let requestsMade =
    0;


  for (
    let page = 1;
    page <= MAX_FBO_POSTING_PAGES;
    page += 1
  ) {

    const response =
      await ozonPost<
        FboPostingResponse
      >(
        "/v3/posting/fbo/list",
        {
          cursor,

          filter: {
            since,
            to,
          },

          limit:
            100,

          sort_dir:
            "asc",

          translit:
            false,

          with: {
            analytics_data:
              true,

            financial_data:
              false,

            legal_info:
              false,
          },
        }
      );


    requestsMade +=
      1;


    const postings =
      response.postings
      ?? [];


    allPostings.push(
      ...postings
    );


    if (
      !response.has_next
    ) {

      return {
        postings:
          allPostings,

        requestsMade,
      };

    }


    const nextCursor =
      normalizeKey(
        response.cursor
      );


    if (
      !nextCursor
      ||
      nextCursor === cursor
    ) {

      throw new Error(
        "Ozon вернул has_next=true, но не вернул новый cursor для FBO postings"
      );

    }


    cursor =
      nextCursor;

  }


  throw new Error(
    "Превышен защитный лимит страниц FBO postings"
  );
}


// ============================================================
// НЕРАЗРЕШЁННЫЕ SKU
// ============================================================

function getUnresolvedSalesSkus(
  postings:
    FboPosting[],

  products:
    ProductRow[],

  dateFrom:
    string,

  dateTo:
    string
) {

  const {
    byOffer,
  } =
    buildProductIndexes(
      products
    );


  const result =
    new Set<string>();


  for (
    const posting
    of postings
  ) {

    const saleDate =
      isoToMoscowDate(
        posting.created_at
      );


    if (
      !saleDate
      ||
      saleDate < dateFrom
      ||
      saleDate > dateTo
    ) {

      continue;

    }


    for (
      const item
      of posting.products
      ?? []
    ) {

      const offerId =
        normalizeKey(
          item.offer_id
        );


      if (
        offerId
        &&
        byOffer.has(
          offerId
        )
      ) {

        continue;

      }


      const sku =
        normalizeKey(
          item.sku
        );


      if (sku) {

        result.add(
          sku
        );

      }

    }

  }


  return Array.from(
    result
  );
}


// ============================================================
// PRODUCT INFO ПО SKU
// ============================================================

async function getProductInfoBySkus(
  skus:
    string[]
) {

  const uniqueSkus =
    Array.from(
      new Set(
        skus
          .map(
            normalizeKey
          )
          .filter(
            Boolean
          )
      )
    );


  const batches =
    chunkArray(
      uniqueSkus,
      PRODUCT_INFO_BATCH_SIZE
    );


  const items:
    OzonProductInfoItem[] = [];


  let requestsMade =
    0;


  for (
    const batch
    of batches
  ) {

    const response =
      await ozonPost<
        OzonProductInfoListResponse
      >(
        "/v3/product/info/list",
        {
          sku:
            batch,
        }
      );


    requestsMade +=
      1;


    items.push(
      ...(
        response.items
        ?? []
      )
    );

  }


  return {
    requestedSkus:
      uniqueSkus.length,

    requestsMade,

    items,
  };
}


// ============================================================
// SKU → PRODUCT
// ============================================================

function buildSkuResolutions(
  infoItems:
    OzonProductInfoItem[],

  products:
    ProductRow[]
) {

  const {
    byOffer,
    byOzonProductId,
  } =
    buildProductIndexes(
      products
    );


  const resolutions =
    new Map<
      string,
      SkuResolution
    >();


  for (
    const item
    of infoItems
  ) {

    const sku =
      normalizeKey(
        item.sku
      );


    if (!sku) {

      continue;

    }


    const ozonProductId =
      normalizeKey(
        item.id
      );


    const ozonOfferId =
      normalizeKey(
        item.offer_id
      );


    const ozonName =
      normalizeKey(
        item.name
      );


    let product:
      ProductRow
      | undefined;


    let resolutionReason =
      "unresolved";


    if (ozonProductId) {

      product =
        byOzonProductId.get(
          ozonProductId
        );


      if (product) {

        resolutionReason =
          "matched_by_ozon_product_id";

      }

    }


    if (
      !product
      &&
      ozonOfferId
    ) {

      product =
        byOffer.get(
          ozonOfferId
        );


      if (product) {

        resolutionReason =
          "matched_by_returned_offer_id";

      }

    }


    resolutions.set(
      sku,
      {
        sku,

        ozonProductId:
          ozonProductId
          || null,

        ozonOfferId:
          ozonOfferId
          || null,

        ozonName:
          ozonName
          || null,

        product:
          product
          ?? null,

        resolutionReason,
      }
    );

  }


  return resolutions;
}


// ============================================================
// SALES DATA
// ============================================================

function buildSalesData(
  postings:
    FboPosting[],

  products:
    ProductRow[],

  skuResolutions:
    Map<
      string,
      SkuResolution
    >,

  warehouseToCluster:
    Map<
      string,
      WarehouseCluster
    >,

  dateFrom:
    string,

  dateTo:
    string
) {

  const {
    byOffer,
  } =
    buildProductIndexes(
      products
    );


  type SalesAggregate = {
    saleDate: string;

    productId: string;

    masterCode:
      | string
      | null;

    clusterId: string;

    clusterName: string;

    salesQuantity: number;

    cancelledQuantity: number;

    sourceOfferIds:
      Set<string>;

    skus:
      Set<string>;

    matchMethods:
      Set<string>;

    warehouseIds:
      Set<string>;

    warehouseNames:
      Set<string>;

    postingItemLines: number;
  };


  const aggregated =
    new Map<
      string,
      SalesAggregate
    >();


  const unmatched:
    Array<
      Record<
        string,
        unknown
      >
    > = [];


  const ignoredInactive:
    Array<
      Record<
        string,
        unknown
      >
    > = [];


  const ignoredOutOfRange:
    Array<
      Record<
        string,
        unknown
      >
    > = [];


  const unmappedWarehouseIds =
    new Set<string>();


  let matchedItemsByOfferId =
    0;


  let matchedItemsBySkuProductInfo =
    0;


  let matchedQuantityByOfferId =
    0;


  let matchedQuantityBySkuProductInfo =
    0;


  let ignoredInactiveItems =
    0;


  let ignoredInactiveQuantity =
    0;


  let ignoredOutOfRangeItems =
    0;


  let ignoredOutOfRangeQuantity =
    0;


  let unmatchedQuantity =
    0;


  for (
    const posting
    of postings
  ) {

    const saleDate =
      isoToMoscowDate(
        posting.created_at
      );


    // ========================================================
    // НЕВАЛИДНЫЙ created_at
    // ========================================================

    if (!saleDate) {

      for (
        const item
        of posting.products
        ?? []
      ) {

        const quantity =
          toSafeInteger(
            item.quantity
          );


        unmatchedQuantity +=
          quantity;


        unmatched.push(
          {
            reason:
              "invalid_created_at",

            posting_number:
              posting.posting_number
              ?? null,

            created_at:
              posting.created_at
              ?? null,

            offer_id:
              normalizeKey(
                item.offer_id
              )
              || null,

            sku:
              normalizeKey(
                item.sku
              )
              || null,

            quantity,
          }
        );

      }


      continue;

    }


    // ========================================================
    // Ozon иногда возвращает старые строки вне диапазона.
    // Их просто игнорируем.
    // ========================================================

    if (
      saleDate < dateFrom
      ||
      saleDate > dateTo
    ) {

      for (
        const item
        of posting.products
        ?? []
      ) {

        const quantity =
          toSafeInteger(
            item.quantity
          );


        ignoredOutOfRangeItems +=
          1;


        ignoredOutOfRangeQuantity +=
          quantity;


        if (
          ignoredOutOfRange.length <
          100
        ) {

          ignoredOutOfRange.push(
            {
              posting_number:
                posting.posting_number
                ?? null,

              created_at:
                posting.created_at
                ?? null,

              sale_date:
                saleDate,

              offer_id:
                normalizeKey(
                  item.offer_id
                )
                || null,

              sku:
                normalizeKey(
                  item.sku
                )
                || null,

              quantity,
            }
          );

        }

      }


      continue;

    }


    const warehouseId =
      normalizeKey(
        posting.analytics_data
          ?.warehouse_id
      );


    const warehouseName =
      normalizeKey(
        posting.analytics_data
          ?.warehouse_name
      );


    const cluster =
      warehouseId
        ? warehouseToCluster.get(
            warehouseId
          )
        : undefined;


    if (
      warehouseId
      &&
      !cluster
    ) {

      unmappedWarehouseIds.add(
        warehouseId
      );

    }


    const clusterId =
      cluster?.clusterId
      ||
      (
        warehouseId
          ? `warehouse:${warehouseId}`
          : "unknown"
      );


    const clusterName =
      cluster?.clusterName
      ||
      warehouseName
      ||
      "Не определён";


    const isCancelled =
      normalizeKey(
        posting.status
      )
        .toLowerCase()
      ===
      "cancelled";


    for (
      const item
      of posting.products
      ?? []
    ) {

      const quantity =
        toSafeInteger(
          item.quantity
        );


      const sourceOfferId =
        normalizeKey(
          item.offer_id
        );


      const sku =
        normalizeKey(
          item.sku
        );


      let product:
        ProductRow
        | undefined;


      let matchMethod:
        | "offer_id"
        | "sku_product_info"
        | null =
        null;


      if (sourceOfferId) {

        product =
          byOffer.get(
            sourceOfferId
          );


        if (product) {

          matchMethod =
            "offer_id";

        }

      }


      if (
        !product
        &&
        sku
      ) {

        const resolution =
          skuResolutions.get(
            sku
          );


        if (
          resolution?.product
        ) {

          product =
            resolution.product;

          matchMethod =
            "sku_product_info";

        }

      }


      if (
        !product
        ||
        !matchMethod
      ) {

        unmatchedQuantity +=
          quantity;


        unmatched.push(
          {
            reason:
              "product_not_resolved",

            posting_number:
              posting.posting_number
              ?? null,

            sale_date:
              saleDate,

            offer_id:
              sourceOfferId
              || null,

            sku:
              sku
              || null,

            quantity,
          }
        );


        continue;

      }


      // ======================================================
      // НЕАКТИВНЫЕ ТОВАРЫ
      //
      // Исторические строки в БД не удаляем.
      // В новую активную выборку не включаем.
      // ======================================================

      if (
        !product.is_active
      ) {

        ignoredInactiveItems +=
          1;


        ignoredInactiveQuantity +=
          quantity;


        if (
          ignoredInactive.length <
          100
        ) {

          ignoredInactive.push(
            {
              posting_number:
                posting.posting_number
                ?? null,

              sale_date:
                saleDate,

              offer_id:
                sourceOfferId
                || null,

              sku:
                sku
                || null,

              quantity,

              product_id:
                product.id,

              product_offer_id:
                product.offer_id,

              master_code:
                product.master_code,

              match_method:
                matchMethod,
            }
          );

        }


        continue;

      }


      if (
        matchMethod ===
        "offer_id"
      ) {

        matchedItemsByOfferId +=
          1;


        matchedQuantityByOfferId +=
          quantity;

      } else {

        matchedItemsBySkuProductInfo +=
          1;


        matchedQuantityBySkuProductInfo +=
          quantity;

      }


      const key =
        [
          saleDate,
          product.id,
          clusterId,
        ].join(
          "::"
        );


      let current =
        aggregated.get(
          key
        );


      if (!current) {

        current = {
          saleDate,

          productId:
            product.id,

          masterCode:
            product.master_code,

          clusterId,

          clusterName,

          salesQuantity:
            0,

          cancelledQuantity:
            0,

          sourceOfferIds:
            new Set<string>(),

          skus:
            new Set<string>(),

          matchMethods:
            new Set<string>(),

          warehouseIds:
            new Set<string>(),

          warehouseNames:
            new Set<string>(),

          postingItemLines:
            0,
        };


        aggregated.set(
          key,
          current
        );

      }


      if (sourceOfferId) {

        current
          .sourceOfferIds
          .add(
            sourceOfferId
          );

      }


      if (sku) {

        current
          .skus
          .add(
            sku
          );

      }


      if (warehouseId) {

        current
          .warehouseIds
          .add(
            warehouseId
          );

      }


      if (warehouseName) {

        current
          .warehouseNames
          .add(
            warehouseName
          );

      }


      current
        .matchMethods
        .add(
          matchMethod
        );


      current.postingItemLines +=
        1;


      if (isCancelled) {

        current.cancelledQuantity +=
          quantity;

      } else {

        current.salesQuantity +=
          quantity;

      }

    }

  }


  // ==========================================================
  // ГОТОВЫЕ СТРОКИ ДЛЯ БД
  // ==========================================================

  const rows:
    SalesWriteRow[] =
    Array.from(
      aggregated.values()
    )
      .map(
        current => ({
          product_id:
            current.productId,

          cluster_id:
            current.clusterId,

          cluster_name:
            current.clusterName,

          sale_date:
            current.saleDate,

          sales_quantity:
            current.salesQuantity,

          cancelled_quantity:
            current.cancelledQuantity,

          raw_payload: {
            source:
              "v3/posting/fbo/list",

            master_code:
              current.masterCode,

            source_offer_ids:
              Array.from(
                current.sourceOfferIds
              ),

            ozon_skus:
              Array.from(
                current.skus
              ),

            match_methods:
              Array.from(
                current.matchMethods
              ),

            warehouse_ids:
              Array.from(
                current.warehouseIds
              ),

            warehouse_names:
              Array.from(
                current.warehouseNames
              ),

            posting_item_lines:
              current.postingItemLines,
          },
        })
      );


  rows.sort(
    (
      left,
      right
    ) => {

      const dateCompare =
        left.sale_date
          .localeCompare(
            right.sale_date
          );


      if (
        dateCompare !== 0
      ) {

        return dateCompare;

      }


      const productCompare =
        left.product_id
          .localeCompare(
            right.product_id
          );


      if (
        productCompare !== 0
      ) {

        return productCompare;

      }


      return left.cluster_id
        .localeCompare(
          right.cluster_id
        );

    }
  );


  // ==========================================================
  // СТАТИСТИКА ПО ДНЯМ
  // ==========================================================

  const perDay =
    new Map<
      string,
      {
        aggregated_rows:
          number;

        sales_quantity:
          number;

        cancelled_quantity:
          number;
      }
    >();


  for (
    const row
    of rows
  ) {

    const current =
      perDay.get(
        row.sale_date
      )
      ?? {
        aggregated_rows:
          0,

        sales_quantity:
          0,

        cancelled_quantity:
          0,
      };


    current.aggregated_rows +=
      1;


    current.sales_quantity +=
      row.sales_quantity;


    current.cancelled_quantity +=
      row.cancelled_quantity;


    perDay.set(
      row.sale_date,
      current
    );

  }


  const perDayRows =
    Array.from(
      perDay.entries()
    )
      .map(
        (
          [
            saleDate,
            values,
          ]
        ) => ({
          sale_date:
            saleDate,

          ...values,
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          left.sale_date
            .localeCompare(
              right.sale_date
            )
      );


  return {
    rows,

    perDay:
      perDayRows,

    unmatched,

    ignoredInactive,

    ignoredOutOfRange,

    unmatchedWarehouseIds:
      Array.from(
        unmappedWarehouseIds
      ),

    matchingStats: {
      matched_items_by_offer_id:
        matchedItemsByOfferId,

      matched_items_by_sku_product_info:
        matchedItemsBySkuProductInfo,

      matched_quantity_by_offer_id:
        matchedQuantityByOfferId,

      matched_quantity_by_sku_product_info:
        matchedQuantityBySkuProductInfo,

      ignored_inactive_items:
        ignoredInactiveItems,

      ignored_inactive_quantity:
        ignoredInactiveQuantity,

      ignored_out_of_range_items:
        ignoredOutOfRangeItems,

      ignored_out_of_range_quantity:
        ignoredOutOfRangeQuantity,

      unmatched_items:
        unmatched.length,

      unmatched_quantity:
        unmatchedQuantity,
    },
  };
}


// ============================================================
// FBO STOCKS
// ============================================================

async function getFboWarehouseStocks(
  offerIds:
    string[]
) {

  const uniqueOfferIds =
    Array.from(
      new Set(
        offerIds
          .map(
            normalizeKey
          )
          .filter(
            Boolean
          )
      )
    );


  const batches =
    chunkArray(
      uniqueOfferIds,
      STOCK_OFFER_BATCH_SIZE
    );


  const allStocks:
    FboWarehouseStock[] = [];


  let requestsMade =
    0;


  for (
    const batch
    of batches
  ) {

    let cursor =
      "";


    for (
      let page = 1;
      page <= MAX_STOCK_PAGES;
      page += 1
    ) {

      const body:
        Record<
          string,
          unknown
        > = {
          limit:
            1000,

          offer_ids:
            batch,
        };


      if (cursor) {

        body.cursor =
          cursor;

      }


      const response =
        await ozonPost<
          FboWarehouseStocksResponse
        >(
          "/v1/product/info/stocks-by-warehouse/fbo",
          body
        );


      requestsMade +=
        1;


      const stockRows =
        response.products
        ??
        response.result
          ?.products
        ??
        [];


      allStocks.push(
        ...stockRows
      );


      const nextCursor =
        normalizeKey(
          response.cursor
          ??
          response.result
            ?.cursor
      );


      const hasNext =
        response.has_next
        ??
        response.result
          ?.has_next
        ??
        Boolean(
          nextCursor
        );


      if (
        !hasNext
        ||
        !nextCursor
      ) {

        break;

      }


      if (
        nextCursor === cursor
      ) {

        throw new Error(
          "Ozon вернул тот же cursor для FBO stocks"
        );

      }


      cursor =
        nextCursor;

    }

  }


  return {
    requestedOfferIds:
      uniqueOfferIds.length,

    batches:
      batches.length,

    requestsMade,

    stocks:
      allStocks,
  };
}


// ============================================================
// STOCK DATA
// ============================================================

function buildStockData(
  stocks:
    FboWarehouseStock[],

  activeProducts:
    ProductRow[],

  warehouseToCluster:
    Map<
      string,
      WarehouseCluster
    >
) {

  const {
    byOffer,
    byOzonProductId,
  } =
    buildProductIndexes(
      activeProducts
    );


  type StockWarehousePayload = {
    sku:
      string
      | null;

    warehouse_id:
      string
      | null;

    warehouse_name:
      string
      | null;

    offer_id:
      string
      | null;

    ozon_product_id:
      string
      | null;

    present: number;

    reserved: number;

    available_stock_count:
      number;
  };


  type StockAggregate = {
    productId: string;

    masterCode:
      | string
      | null;

    clusterId: string;

    clusterName: string;

    quantity: number;

    warehouses:
      StockWarehousePayload[];
  };


  const aggregated =
    new Map<
      string,
      StockAggregate
    >();


  const unmatched:
    Array<
      Record<
        string,
        unknown
      >
    > = [];


  const unmappedWarehouseIds =
    new Set<string>();


  let totalPresent =
    0;


  let totalReserved =
    0;


  let totalAvailable =
    0;


  for (
    const stock
    of stocks
  ) {

    const offerId =
      normalizeKey(
        stock.offer_id
      );


    const ozonProductId =
      normalizeKey(
        stock.product_id
      );


    const sku =
      normalizeKey(
        stock.sku
      );


    const warehouseId =
      normalizeKey(
        stock.warehouse_id
      );


    const warehouseName =
      normalizeKey(
        stock.warehouse_name
      );


    const present =
      toSafeInteger(
        stock.present
      );


    const reserved =
      toSafeInteger(
        stock.reserved
      );


    const available =
      Math.max(
        present
        -
        reserved,
        0
      );


    const product =
      (
        offerId
          ? byOffer.get(
              offerId
            )
          : undefined
      )
      ??
      (
        ozonProductId
          ? byOzonProductId.get(
              ozonProductId
            )
          : undefined
      );


    if (!product) {

      unmatched.push(
        {
          offer_id:
            offerId
            || null,

          ozon_product_id:
            ozonProductId
            || null,

          sku:
            sku
            || null,

          warehouse_id:
            warehouseId
            || null,

          warehouse_name:
            warehouseName
            || null,

          present,

          reserved,

          available,
        }
      );


      continue;

    }


    const cluster =
      warehouseId
        ? warehouseToCluster.get(
            warehouseId
          )
        : undefined;


    if (
      warehouseId
      &&
      !cluster
    ) {

      unmappedWarehouseIds.add(
        warehouseId
      );

    }


    const clusterId =
      cluster?.clusterId
      ||
      (
        warehouseId
          ? `warehouse:${warehouseId}`
          : "unknown"
      );


    const clusterName =
      cluster?.clusterName
      ||
      warehouseName
      ||
      "Не определён";


    const key =
      [
        product.id,
        clusterId,
      ].join(
        "::"
      );


    let current =
      aggregated.get(
        key
      );


    if (!current) {

      current = {
        productId:
          product.id,

        masterCode:
          product.master_code,

        clusterId,

        clusterName,

        quantity:
          0,

        warehouses:
          [],
      };


      aggregated.set(
        key,
        current
      );

    }


    current.quantity +=
      available;


    current.warehouses.push(
      {
        sku:
          sku
          || null,

        warehouse_id:
          warehouseId
          || null,

        warehouse_name:
          warehouseName
          ||
          cluster?.warehouseName
          ||
          null,

        offer_id:
          offerId
          || null,

        ozon_product_id:
          ozonProductId
          || null,

        present,

        reserved,

        available_stock_count:
          available,
      }
    );


    totalPresent +=
      present;


    totalReserved +=
      reserved;


    totalAvailable +=
      available;

  }


  const rows:
    StockWriteRow[] =
    Array.from(
      aggregated.values()
    )
      .map(
        current => ({
          product_id:
            current.productId,

          cluster_id:
            current.clusterId,

          cluster_name:
            current.clusterName,

          quantity:
            current.quantity,

          raw_payload: {
            source:
              "v1/product/info/stocks-by-warehouse/fbo",

            master_code:
              current.masterCode,

            warehouses:
              current.warehouses,
          },
        })
      );


  rows.sort(
    (
      left,
      right
    ) => {

      const productCompare =
        left.product_id
          .localeCompare(
            right.product_id
          );


      if (
        productCompare !== 0
      ) {

        return productCompare;

      }


      return left.cluster_id
        .localeCompare(
          right.cluster_id
        );

    }
  );


  return {
    rows,

    unmatched,

    unmappedWarehouseIds:
      Array.from(
        unmappedWarehouseIds
      ),

    totalPresent,

    totalReserved,

    totalAvailable,
  };
}


// ============================================================
// DAILY SYNC
// ============================================================

async function runDailySync(
  request:
    Request
) {

  const startedAt =
    Date.now();


  let writeAttempted =
    false;


  let writeSucceeded =
    false;


  try {

    // ========================================================
    // 1. AUTH
    // ========================================================

    if (
      !isAuthorized(
        request
      )
    ) {

      return Response.json(
        {
          ok:
            false,

          error:
            "Unauthorized",
        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // 2. ДАТЫ
    // ========================================================

    const todayMoscow =
      getMoscowTodayDate();


    const salesDateTo =
      addDays(
        todayMoscow,
        -1
      );


    const salesDateFrom =
      addDays(
        salesDateTo,
        -(
          SALES_WINDOW_DAYS
          -
          1
        )
      );


    // ========================================================
    // 3. PRODUCTS
    // ========================================================

    const products =
      await getProducts();


    const activeProducts =
      products.filter(
        product =>
          product.is_active
      );


    const inactiveProducts =
      products.filter(
        product =>
          !product.is_active
      );


    const activeWithoutMasterCode =
      activeProducts.filter(
        product =>
          !normalizeKey(
            product.master_code
          )
      );


    if (
      activeWithoutMasterCode.length >
      0
    ) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "write_sync",

          writes_to_database:
            false,

          stage:
            "products_validation",

          error:
            "Есть активные products без master_code",

          count:
            activeWithoutMasterCode.length,

          sample:
            activeWithoutMasterCode
              .slice(
                0,
                50
              ),
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 4. CLUSTERS
    // ========================================================

    const clusterResult =
      await getOzonClusters();


    if (
      clusterResult
        .clusters
        .length === 0
    ) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "write_sync",

          writes_to_database:
            false,

          stage:
            "cluster_validation",

          error:
            "Ozon не вернул список кластеров",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 5. SALES
    // ========================================================

    const salesResult =
      await getFboPostingsForRange(
        salesDateFrom,
        salesDateTo
      );


    if (
      salesResult
        .postings
        .length === 0
    ) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "write_sync",

          writes_to_database:
            false,

          stage:
            "sales_validation",

          error:
            "Ozon вернул 0 FBO postings. Запись отменена.",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 6. SKU FALLBACK
    // ========================================================

    const unresolvedSkus =
      getUnresolvedSalesSkus(
        salesResult.postings,
        products,
        salesDateFrom,
        salesDateTo
      );


    const productInfoResult =
      unresolvedSkus.length > 0

        ? await getProductInfoBySkus(
            unresolvedSkus
          )

        : {
            requestedSkus:
              0,

            requestsMade:
              0,

            items:
              [] as OzonProductInfoItem[],
          };


    const skuResolutions =
      buildSkuResolutions(
        productInfoResult.items,
        products
      );


    const salesData =
      buildSalesData(
        salesResult.postings,
        products,
        skuResolutions,
        clusterResult
          .warehouseToCluster,
        salesDateFrom,
        salesDateTo
      );


    // ========================================================
    // 7. STOCKS
    // ========================================================

    const activeOfferIds =
      activeProducts
        .map(
          product =>
            normalizeKey(
              product.offer_id
            )
        )
        .filter(
          Boolean
        );


    const stockResult =
      await getFboWarehouseStocks(
        activeOfferIds
      );


    if (
      stockResult
        .stocks
        .length === 0
    ) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "write_sync",

          writes_to_database:
            false,

          stage:
            "stock_validation",

          error:
            "Ozon вернул 0 строк FBO stock. Запись отменена.",
        },
        {
          status:
            409,
        }
      );

    }


    const stockData =
      buildStockData(
        stockResult.stocks,
        activeProducts,
        clusterResult
          .warehouseToCluster
      );


    // ========================================================
    // 8. ФИНАЛЬНАЯ ПРОВЕРКА
    //
    // НИКАКОЙ ЗАПИСИ ДО ЭТОЙ ТОЧКИ.
    // ========================================================

    if (
      salesData
        .unmatched
        .length > 0
      ||
      stockData
        .unmatched
        .length > 0
    ) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "write_sync",

          writes_to_database:
            false,

          stage:
            "final_validation",

          sales_unmatched:
            salesData
              .unmatched
              .length,

          sales_unmatched_sample:
            salesData
              .unmatched
              .slice(
                0,
                100
              ),

          stock_unmatched:
            stockData
              .unmatched
              .length,

          stock_unmatched_sample:
            stockData
              .unmatched
              .slice(
                0,
                100
              ),
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 9. СЧЁТЧИКИ POSTINGS ТОЛЬКО ВНУТРИ 28 ДНЕЙ
    // ========================================================

    const postingsInWindow =
      salesResult.postings
        .filter(
          posting => {

            const saleDate =
              isoToMoscowDate(
                posting.created_at
              );


            return Boolean(
              saleDate
              &&
              saleDate >= salesDateFrom
              &&
              saleDate <= salesDateTo
            );

          }
        );


    const postingsOutsideWindow =
      salesResult
        .postings
        .length
      -
      postingsInWindow
        .length;


    const cancelledPostings =
      postingsInWindow
        .filter(
          posting =>
            normalizeKey(
              posting.status
            )
              .toLowerCase()
            ===
            "cancelled"
        )
        .length;


    // ========================================================
    // 10. ЕДИНСТВЕННАЯ БОЕВАЯ ЗАПИСЬ
    //
    // PostgreSQL выполняет:
    // - замену 28 дней продаж;
    // - замену снимка остатков;
    // - создание sales_sync_run;
    //
    // всё в ОДНОЙ транзакции.
    // ========================================================

    writeAttempted =
      true;


    const writeResult =
      await supabaseRpc<
        ApplySyncResult
      >(
        "apply_ozon_daily_sync",
        {
          p_date_from:
            salesDateFrom,

          p_date_to:
            salesDateTo,

          p_sales_rows:
            salesData.rows,

          p_snapshot_date:
            todayMoscow,

          p_stock_rows:
            stockData.rows,

          p_postings_received:
            postingsInWindow.length,

          p_cancelled_postings:
            cancelledPostings,
        }
      );


    if (
      !writeResult
      ||
      writeResult.ok !== true
    ) {

      throw new Error(
        "apply_ozon_daily_sync не подтвердил успешную запись"
      );

    }


    if (
      writeResult.sales_rows_saved
      !==
      salesData.rows.length
    ) {

      throw new Error(
        [
          "Количество записанных строк продаж не совпало",
          `ожидали ${salesData.rows.length}`,
          `получили ${writeResult.sales_rows_saved}`,
        ].join(
          ": "
        )
      );

    }


    if (
      writeResult.stock_rows_saved
      !==
      stockData.rows.length
    ) {

      throw new Error(
        [
          "Количество записанных строк остатков не совпало",
          `ожидали ${stockData.rows.length}`,
          `получили ${writeResult.stock_rows_saved}`,
        ].join(
          ": "
        )
      );

    }


    writeSucceeded =
      true;


    // ========================================================
    // 11. SUCCESS
    // ========================================================

    return Response.json(
      {
        ok:
          true,

        mode:
          "write_sync",

        writes_to_database:
          true,


        dates: {
          sales_date_from:
            salesDateFrom,

          sales_date_to:
            salesDateTo,

          sales_window_days:
            SALES_WINDOW_DAYS,

          stock_snapshot_date:
            todayMoscow,
        },


        products: {
          total:
            products.length,

          active:
            activeProducts.length,

          inactive:
            inactiveProducts.length,

          active_without_master_code:
            activeWithoutMasterCode.length,
        },


        clusters: {
          total_clusters:
            clusterResult
              .clusters
              .length,

          mapped_warehouses:
            clusterResult
              .warehouseToCluster
              .size,
        },


        sales_fbo: {
          ozon_requests:
            salesResult
              .requestsMade,

          postings_total_returned_by_ozon:
            salesResult
              .postings
              .length,

          postings_in_window:
            postingsInWindow.length,

          postings_outside_window:
            postingsOutsideWindow,

          postings_cancelled:
            cancelledPostings,

          rows_sent_to_database:
            salesData
              .rows
              .length,

          matching:
            salesData
              .matchingStats,

          unmatched_products:
            salesData
              .unmatched
              .length,

          ignored_out_of_range_sample:
            salesData
              .ignoredOutOfRange,

          ignored_inactive_sample:
            salesData
              .ignoredInactive,

          unmapped_warehouse_ids_count:
            salesData
              .unmatchedWarehouseIds
              .length,

          per_day:
            salesData
              .perDay,
        },


        sku_resolution: {
          skus_requested:
            productInfoResult
              .requestedSkus,

          ozon_requests:
            productInfoResult
              .requestsMade,

          ozon_items_received:
            productInfoResult
              .items
              .length,

          resolved_to_products:
            Array.from(
              skuResolutions.values()
            )
              .filter(
                row =>
                  row.product
                  != null
              )
              .length,

          unresolved_to_products:
            Array.from(
              skuResolutions.values()
            )
              .filter(
                row =>
                  row.product
                  == null
              )
              .length,

          resolution_sample:
            Array.from(
              skuResolutions.values()
            )
              .slice(
                0,
                50
              )
              .map(
                row => ({
                  sku:
                    row.sku,

                  ozon_product_id:
                    row.ozonProductId,

                  ozon_offer_id:
                    row.ozonOfferId,

                  ozon_name:
                    row.ozonName,

                  resolution_reason:
                    row.resolutionReason,

                  product:
                    row.product
                      ? {
                          id:
                            row.product.id,

                          offer_id:
                            row.product.offer_id,

                          master_code:
                            row.product.master_code,

                          is_active:
                            row.product.is_active,
                        }
                      : null,
                })
              ),
        },


        stocks_fbo: {
          method:
            "/v1/product/info/stocks-by-warehouse/fbo",

          requested_offer_ids:
            stockResult
              .requestedOfferIds,

          batches:
            stockResult
              .batches,

          ozon_requests:
            stockResult
              .requestsMade,

          raw_rows_received:
            stockResult
              .stocks
              .length,

          rows_sent_to_database:
            stockData
              .rows
              .length,

          unmatched_rows:
            stockData
              .unmatched
              .length,

          unmapped_warehouse_ids_count:
            stockData
              .unmappedWarehouseIds
              .length,

          totals: {
            present:
              stockData
                .totalPresent,

            reserved:
              stockData
                .totalReserved,

            available:
              stockData
                .totalAvailable,
          },
        },


        database: {
          atomic_rpc:
            "apply_ozon_daily_sync",

          result:
            writeResult,
        },


        duration_ms:
          Date.now()
          -
          startedAt,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "OZON DAILY SYNC ERROR",
      error
    );


    return Response.json(
      {
        ok:
          false,

        mode:
          "write_sync",

        write_attempted:
          writeAttempted,

        write_succeeded:
          writeSucceeded,

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),

        note:
          writeAttempted
          &&
          !writeSucceeded

            ? "Если ошибка пришла от apply_ozon_daily_sync, транзакция PostgreSQL откатывается целиком."

            : "До боевой записи дело не дошло.",

        duration_ms:
          Date.now()
          -
          startedAt,
      },
      {
        status:
          500,
      }
    );

  }
}


// ============================================================
// GET / POST
// ============================================================

export async function GET(
  request: Request
) {

  return runDailySync(
    request
  );

}


export async function POST(
  request: Request
) {

  return runDailySync(
    request
  );

}
