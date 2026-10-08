export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_WINDOW_DAYS = 28;
const OZON_MAX_RETRIES = 5;
const RETRY_BASE_MS = 1500;

// Не даём всей синхронизации долбить Ozon слишком быстро.
// Максимум примерно 8 запросов/сек из этого процесса.
const OZON_MIN_REQUEST_INTERVAL_MS = 125;

// /v1/analytics/stocks дополнительно притормаживаем.
// Метод вызывается пачками по 100 SKU.
const ANALYTICS_STOCK_REQUEST_INTERVAL_MS = 1250;

// Если Ozon всё-таки дал 429 и не указал Retry-After,
// отходим заметно дальше, а не продолжаем бодаться.
const OZON_429_FALLBACK_DELAY_MS = 5000;

const MAX_FBO_POSTING_PAGES = 1000;
const MAX_PRODUCT_LIST_PAGES = 100;
const PRODUCT_INFO_BATCH_SIZE = 900;
const ANALYTICS_STOCK_BATCH_SIZE = 100;

// ============================================================
// ГЛОБАЛЬНЫЙ THROTTLE OZON
// ============================================================

let lastOzonRequestStartedAt = 0;

// ============================================================
// ТИПЫ
// ============================================================

type ProductRow = {
  id: string;
  offer_id: string;
  ozon_product_id: number | string | null;
  name: string | null;
  master_code: string | null;
  is_active: boolean;
};

type WarehouseCluster = {
  clusterId: string;
  clusterName: string;
  warehouseName: string;
};

type ClusterReference = {
  clusterId: string;
  clusterName: string;
};

type OzonCluster = {
  id?: number | string;
  name?: string;

  logistic_clusters?: Array<{
    warehouses?: Array<{
      warehouse_id?: number | string;
      name?: string;
    }>;
  }>;
};

type FboPosting = {
  posting_number?: string;
  status?: string;
  created_at?: string;

  products?: Array<{
    sku?: number | string;
    offer_id?: string;
    quantity?: number;
  }>;

  analytics_data?: {
    warehouse_id?: number | string;
    warehouse_name?: string;
  } | null;

  financial_data?: {
    cluster_from?: string | null;
    cluster_to?: string | null;

    [key: string]:
      unknown;
  } | null;
};

type OzonProductInfoItem = {
  id?: number | string;
  offer_id?: string;
  sku?: number | string;
  name?: string;

  [key: string]:
    unknown;
};

type OzonCatalogItem = {
  product_id?: number | string;
  offer_id?: string;

  [key: string]:
    unknown;
};

type AnalyticsStock = {
  sku?: number | string;
  offer_id?: string;

  warehouse_id?: number | string;

  warehouse_name?:
    | string
    | null;

  cluster_id?: number | string;

  cluster_name?:
    | string
    | null;

  available_stock_count?:
    number;

  [key: string]:
    unknown;
};

type SkuResolution = {
  sku: string;

  ozonProductId:
    | string
    | null;

  ozonOfferId:
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

  sales_quantity:
    number;

  cancelled_quantity:
    number;

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

  sales_sync_run_id:
    string;

  date_from:
    string;

  date_to:
    string;

  completed_days:
    number;

  sales_rows_saved:
    number;

  snapshot_date:
    string;

  stock_rows_saved:
    number;

  postings_received:
    number;

  cancelled_postings:
    number;
};

// ============================================================
// HELPERS
// ============================================================

function normalizeKey(
  value: unknown
):
string {

  return String(
    value ?? ""
  ).trim();
}

function normalizeClusterNameKey(
  value: unknown
):
string {

  return normalizeKey(
    value
  )
    .replace(
      /\s+/g,
      " "
    )
    .toLocaleLowerCase(
      "ru-RU"
    );
}

function toSafeInteger(
  value: unknown
):
number {

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
):
T[][] {

  const result:
    T[][] =
    [];

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
// OZON REQUEST THROTTLE
// ============================================================

async function waitForOzonRequestSlot() {

  const now =
    Date.now();

  const earliestNextRequest =
    lastOzonRequestStartedAt
    +
    OZON_MIN_REQUEST_INTERVAL_MS;

  const waitMs =
    earliestNextRequest
    -
    now;

  if (
    waitMs > 0
  ) {

    await sleep(
      waitMs
    );
  }

  lastOzonRequestStartedAt =
    Date.now();
}

// ============================================================
// ДАТЫ
// ============================================================

function getMoscowDate(
  date:
    Date = new Date()
):
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
      date
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
      "Не удалось определить дату по Москве"
    );
  }

  return `${year}-${month}-${day}`;
}

function addDays(
  date: string,
  delta: number
):
string {

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
    | string
    | undefined
):
string | null {

  if (!value) {

    return null;
  }

  const parsed =
    new Date(
      value
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {

    return null;
  }

  return getMoscowDate(
    parsed
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
// AUTH
// ============================================================

function isAuthorized(
  request:
    Request
):
boolean {

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

    await waitForOzonRequestSlot();

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
        unknown =
        null;

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

      // ========================================================
      // 429
      // ========================================================

      if (
        response.status ===
        429
      ) {

        if (
          attempt ===
          OZON_MAX_RETRIES
        ) {

          throw new Error(
            `Ozon API ${path}: HTTP 429: ${JSON.stringify(parsed)}`
          );
        }

        const retryAfterHeader =
          response.headers.get(
            "retry-after"
          );

        const retryAfterSeconds =
          retryAfterHeader

            ? Number(
                retryAfterHeader
              )

            : NaN;

        const retryAfterMs =
          Number.isFinite(
            retryAfterSeconds
          )
          &&
          retryAfterSeconds > 0

            ? Math.max(
                Math.ceil(
                  retryAfterSeconds
                  *
                  1000
                ),
                2000
              )

            : OZON_429_FALLBACK_DELAY_MS
              *
              attempt;

        await sleep(
          retryAfterMs
        );

        continue;
      }

      // ========================================================
      // 5XX
      // ========================================================

      if (
        response.status >=
        500
        &&
        response.status <=
        599
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

      if (!response.ok) {

        throw new Error(
          `Ozon API ${path}: HTTP ${response.status}: ${JSON.stringify(parsed)}`
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
  functionName:
    string,

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
      `Supabase RPC ${functionName}: HTTP ${response.status}: ${text}`
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
    "id,offer_id,ozon_product_id,name,master_code,is_active"
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
// PRODUCT INDEXES
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

    const ozonProductId =
      normalizeKey(
        product.ozon_product_id
      );

    if (offerId) {

      byOffer.set(
        offerId,
        product
      );
    }

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

  const clusterTypes =
    [
      "CLUSTER_TYPE_OZON",
      "CLUSTER_TYPE_CIS",
    ];

  const clusters:
    OzonCluster[] =
    [];

  let requestsMade =
    0;

  // ==========================================================
  // 1. РОССИЯ + СНГ
  // ==========================================================

  for (
    const clusterType
    of clusterTypes
  ) {

    const response =
      await ozonPost<{
        clusters?:
          OzonCluster[];
      }>(
        "/v1/cluster/list",
        {
          cluster_type:
            clusterType,
        }
      );

    requestsMade +=
      1;

    clusters.push(
      ...(
        response.clusters
        ?? []
      )
    );
  }

  // ==========================================================
  // 2. WAREHOUSE ID → CLUSTER
  // ==========================================================

  const warehouseToCluster =
    new Map<
      string,
      WarehouseCluster
    >();

  // ==========================================================
  // 3. CLUSTER NAME → CLUSTER ID
  // ==========================================================

  const clusterNameToCluster =
    new Map<
      string,
      ClusterReference
    >();

  const ambiguousClusterNameKeys =
    new Set<string>();

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

    const clusterNameKey =
      normalizeClusterNameKey(
        clusterName
      );

    if (
      clusterId
      &&
      clusterNameKey
    ) {

      const existing =
        clusterNameToCluster.get(
          clusterNameKey
        );

      if (
        existing
        &&
        existing.clusterId !==
        clusterId
      ) {

        ambiguousClusterNameKeys.add(
          clusterNameKey
        );

        clusterNameToCluster.delete(
          clusterNameKey
        );

      } else if (
        !ambiguousClusterNameKeys.has(
          clusterNameKey
        )
      ) {

        clusterNameToCluster.set(
          clusterNameKey,
          {
            clusterId,
            clusterName,
          }
        );
      }
    }

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

        const existingWarehouse =
          warehouseToCluster.get(
            warehouseId
          );

        if (
          existingWarehouse
          &&
          existingWarehouse.clusterId !==
          clusterId
        ) {

          throw new Error(
            [
              "Ozon вернул warehouse_id в нескольких кластерах",
              `warehouse_id=${warehouseId}`,
              `cluster_1=${existingWarehouse.clusterId}`,
              `cluster_2=${clusterId}`,
            ].join(
              ", "
            )
          );
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

    clusterTypes,

    requestsMade,

    warehouseToCluster,

    clusterNameToCluster,

    ambiguousClusterNameKeys:
      Array.from(
        ambiguousClusterNameKeys
      ),
  };
}

// ============================================================
// FBO POSTINGS
// ============================================================

async function getFboPostingsForRange(
  dateFrom:
    string,

  dateTo:
    string
) {

  const allPostings:
    FboPosting[] =
    [];

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
      await ozonPost<{
        postings?:
          FboPosting[];

        cursor?:
          string;

        has_next?:
          boolean;
      }>(
        "/v3/posting/fbo/list",
        {
          cursor,

          filter: {
            since:
              `${dateFrom}T00:00:00+03:00`,

            to:
              `${dateTo}T23:59:59+03:00`,
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
              true,

            legal_info:
              false,
          },
        }
      );

    requestsMade +=
      1;

    allPostings.push(
      ...(
        response.postings
        ?? []
      )
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
      nextCursor ===
      cursor
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
// PRODUCT INFO BY SKU
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

  const items:
    OzonProductInfoItem[] =
    [];

  let requestsMade =
    0;

  for (
    const batch
    of chunkArray(
      uniqueSkus,
      PRODUCT_INFO_BATCH_SIZE
    )
  ) {

    const response =
      await ozonPost<{
        items?:
          OzonProductInfoItem[];
      }>(
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
// PRODUCT INFO BY OFFER ID
// ============================================================

async function getProductInfoByOfferIds(
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

  const items:
    OzonProductInfoItem[] =
    [];

  let requestsMade =
    0;

  for (
    const batch
    of chunkArray(
      uniqueOfferIds,
      PRODUCT_INFO_BATCH_SIZE
    )
  ) {

    const response =
      await ozonPost<{
        items?:
          OzonProductInfoItem[];
      }>(
        "/v3/product/info/list",
        {
          offer_id:
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
    requestedOfferIds:
      uniqueOfferIds.length,

    requestsMade,

    items,
  };
}

// ============================================================
// SKU RESOLUTIONS
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

  const conflicts:
    Array<
      Record<
        string,
        unknown
      >
    > =
    [];

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

    const existing =
      resolutions.get(
        sku
      );

    if (
      existing?.product
      &&
      product
      &&
      existing.product.id !==
      product.id
    ) {

      conflicts.push(
        {
          sku,

          first_product_id:
            existing.product.id,

          first_offer_id:
            existing.product.offer_id,

          second_product_id:
            product.id,

          second_offer_id:
            product.offer_id,
        }
      );

      continue;
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

        product:
          product
          ?? null,

        resolutionReason,
      }
    );
  }

  return {
    resolutions,

    conflicts,
  };
}

// ============================================================
// SALES SKU FALLBACK
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
      saleDate <
      dateFrom
      ||
      saleDate >
      dateTo
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

  clusterNameToCluster:
    Map<
      string,
      ClusterReference
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
    saleDate:
      string;

    product:
      ProductRow;

    clusterId:
      string;

    clusterName:
      string;

    salesQuantity:
      number;

    cancelledQuantity:
      number;

    offerIds:
      Set<string>;

    skus:
      Set<string>;

    warehouseIds:
      Set<string>;

    warehouseNames:
      Set<string>;

    clusterFromNames:
      Set<string>;

    clusterToNames:
      Set<string>;

    clusterResolutionSources:
      Set<string>;
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
    > =
    [];

  const ignoredInactive:
    Array<
      Record<
        string,
        unknown
      >
    > =
    [];

  const ignoredOutOfRange:
    Array<
      Record<
        string,
        unknown
      >
    > =
    [];

  const unresolvedClusters:
    Array<
      Record<
        string,
        unknown
      >
    > =
    [];

  let matchedByOffer =
    0;

  let matchedBySku =
    0;

  let postingsClusteredByFinancialData =
    0;

  let postingsClusteredByWarehouseFallback =
    0;

  let postingsWithoutResolvedCluster =
    0;

  for (
    const posting
    of postings
  ) {

    const saleDate =
      isoToMoscowDate(
        posting.created_at
      );

    if (!saleDate) {

      for (
        const item
        of posting.products
        ?? []
      ) {

        unmatched.push(
          {
            reason:
              "invalid_created_at",

            posting_number:
              posting.posting_number
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

            quantity:
              toSafeInteger(
                item.quantity
              ),
          }
        );
      }

      continue;
    }

    if (
      saleDate <
      dateFrom
      ||
      saleDate >
      dateTo
    ) {

      for (
        const item
        of posting.products
        ?? []
      ) {

        if (
          ignoredOutOfRange.length <
          100
        ) {

          ignoredOutOfRange.push(
            {
              posting_number:
                posting.posting_number
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

              quantity:
                toSafeInteger(
                  item.quantity
                ),
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

    const clusterFrom =
      normalizeKey(
        posting.financial_data
          ?.cluster_from
      );

    const clusterTo =
      normalizeKey(
        posting.financial_data
          ?.cluster_to
      );

    const clusterFromKey =
      normalizeClusterNameKey(
        clusterFrom
      );

    const financialCluster =
      clusterFromKey

        ? clusterNameToCluster.get(
            clusterFromKey
          )

        : undefined;

    const warehouseCluster =
      warehouseId

        ? warehouseToCluster.get(
            warehouseId
          )

        : undefined;

    const resolvedCluster =
      financialCluster
      ??
      warehouseCluster;

    const clusterResolutionSource =
      financialCluster

        ? "financial_data.cluster_from"

        : warehouseCluster

          ? "analytics_data.warehouse_id"

          : "unresolved";

    if (!resolvedCluster) {

      postingsWithoutResolvedCluster +=
        1;

      if (
        unresolvedClusters.length <
        200
      ) {

        unresolvedClusters.push(
          {
            reason:
              clusterFrom
                ? "cluster_from_not_found"
                : "cluster_from_missing",

            posting_number:
              posting.posting_number
              ?? null,

            sale_date:
              saleDate,

            warehouse_id:
              warehouseId
              || null,

            warehouse_name:
              warehouseName
              || null,

            cluster_from:
              clusterFrom
              || null,

            cluster_to:
              clusterTo
              || null,
          }
        );
      }

      continue;
    }

    if (financialCluster) {

      postingsClusteredByFinancialData +=
        1;

    } else {

      postingsClusteredByWarehouseFallback +=
        1;
    }

    const clusterId =
      resolvedCluster.clusterId;

    const clusterName =
      resolvedCluster.clusterName;

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

      const offerId =
        normalizeKey(
          item.offer_id
        );

      const sku =
        normalizeKey(
          item.sku
        );

      let product =
        offerId

          ? byOffer.get(
              offerId
            )

          : undefined;

      let matchMethod =
        "offer_id";

      if (
        !product
        &&
        sku
      ) {

        product =
          skuResolutions.get(
            sku
          )?.product
          ?? undefined;

        matchMethod =
          "sku_product_info";
      }

      if (!product) {

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
              offerId
              || null,

            sku:
              sku
              || null,

            quantity,

            cluster_id:
              clusterId,

            cluster_name:
              clusterName,

            cluster_from:
              clusterFrom
              || null,
          }
        );

        continue;
      }

      if (
        !product.is_active
      ) {

        if (
          ignoredInactive.length <
          100
        ) {

          ignoredInactive.push(
            {
              product_id:
                product.id,

              product_offer_id:
                product.offer_id,

              offer_id:
                offerId
                || null,

              sku:
                sku
                || null,

              quantity,

              master_code:
                product.master_code,

              cluster_id:
                clusterId,

              cluster_name:
                clusterName,

              cluster_from:
                clusterFrom
                || null,
            }
          );
        }

        continue;
      }

      if (
        matchMethod ===
        "offer_id"
      ) {

        matchedByOffer +=
          1;

      } else {

        matchedBySku +=
          1;
      }

      const aggregateKey =
        [
          saleDate,
          product.id,
          clusterId,
        ].join(
          "::"
        );

      let current =
        aggregated.get(
          aggregateKey
        );

      if (!current) {

        current = {
          saleDate,

          product,

          clusterId,

          clusterName,

          salesQuantity:
            0,

          cancelledQuantity:
            0,

          offerIds:
            new Set<string>(),

          skus:
            new Set<string>(),

          warehouseIds:
            new Set<string>(),

          warehouseNames:
            new Set<string>(),

          clusterFromNames:
            new Set<string>(),

          clusterToNames:
            new Set<string>(),

          clusterResolutionSources:
            new Set<string>(),
        };

        aggregated.set(
          aggregateKey,
          current
        );
      }

      if (offerId) {

        current.offerIds.add(
          offerId
        );
      }

      if (sku) {

        current.skus.add(
          sku
        );
      }

      if (warehouseId) {

        current.warehouseIds.add(
          warehouseId
        );
      }

      if (warehouseName) {

        current.warehouseNames.add(
          warehouseName
        );
      }

      if (clusterFrom) {

        current.clusterFromNames.add(
          clusterFrom
        );
      }

      if (clusterTo) {

        current.clusterToNames.add(
          clusterTo
        );
      }

      current
        .clusterResolutionSources
        .add(
          clusterResolutionSource
        );

      if (isCancelled) {

        current.cancelledQuantity +=
          quantity;

      } else {

        current.salesQuantity +=
          quantity;
      }
    }
  }

  const rows:
    SalesWriteRow[] =
    Array.from(
      aggregated.values()
    )
      .map(
        current => ({
          product_id:
            current.product.id,

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
              current.product.master_code,

            cluster_resolution_sources:
              Array.from(
                current
                  .clusterResolutionSources
              ),

            cluster_from_names:
              Array.from(
                current.clusterFromNames
              ),

            cluster_to_names:
              Array.from(
                current.clusterToNames
              ),

            source_offer_ids:
              Array.from(
                current.offerIds
              ),

            ozon_skus:
              Array.from(
                current.skus
              ),

            warehouse_ids:
              Array.from(
                current.warehouseIds
              ),

            warehouse_names:
              Array.from(
                current.warehouseNames
              ),
          },
        })
      );

  rows.sort(
    (
      left,
      right
    ) => {

      return (
        left.sale_date.localeCompare(
          right.sale_date
        )
        ||
        left.product_id.localeCompare(
          right.product_id
        )
        ||
        left.cluster_id.localeCompare(
          right.cluster_id
        )
      );
    }
  );

  const perDayMap =
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
      perDayMap.get(
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

    perDayMap.set(
      row.sale_date,
      current
    );
  }

  const perDay =
    Array.from(
      perDayMap.entries()
    )
      .map(
        (
          [
            sale_date,
            values,
          ]
        ) => ({
          sale_date,

          ...values,
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          left.sale_date.localeCompare(
            right.sale_date
          )
      );

  return {
    rows,

    unmatched,

    ignoredInactive,

    ignoredOutOfRange,

    unresolvedClusters,

    matchedByOffer,

    matchedBySku,

    postingsClusteredByFinancialData,

    postingsClusteredByWarehouseFallback,

    postingsWithoutResolvedCluster,

    perDay,
  };
}

// ============================================================
// OZON PRODUCT CATALOG
// ============================================================

async function getOzonProductCatalog() {

  const items:
    OzonCatalogItem[] =
    [];

  let lastId =
    "";

  let requestsMade =
    0;

  let declaredTotal:
    number
    | null =
    null;

  for (
    let page = 1;
    page <= MAX_PRODUCT_LIST_PAGES;
    page += 1
  ) {

    const response =
      await ozonPost<{
        result?: {
          items?:
            OzonCatalogItem[];

          last_id?:
            string;

          total?:
            number;
        };
      }>(
        "/v3/product/list",
        {
          filter: {
            visibility:
              "ALL",
          },

          last_id:
            lastId,

          limit:
            1000,
        }
      );

    requestsMade +=
      1;

    const pageItems =
      response.result
        ?.items
      ?? [];

    items.push(
      ...pageItems
    );

    const total =
      Number(
        response.result
          ?.total
      );

    if (
      Number.isFinite(
        total
      )
    ) {

      declaredTotal =
        total;
    }

    if (
      declaredTotal !==
      null
      &&
      items.length >=
      declaredTotal
    ) {

      break;
    }

    if (
      pageItems.length ===
      0
    ) {

      break;
    }

    const nextLastId =
      normalizeKey(
        response.result
          ?.last_id
      );

    if (
      !nextLastId
      ||
      nextLastId ===
      lastId
    ) {

      break;
    }

    lastId =
      nextLastId;
  }

  if (
    declaredTotal !==
    null
    &&
    items.length <
    declaredTotal
  ) {

    throw new Error(
      `Не удалось получить полный каталог Ozon: получено ${items.length}, ожидалось ${declaredTotal}`
    );
  }

  return {
    items,
    requestsMade,
    declaredTotal,
  };
}

// ============================================================
// ANALYTICS STOCKS
// ============================================================

function extractAnalyticsStockRows(
  response: {
    items?:
      AnalyticsStock[];

    stocks?:
      AnalyticsStock[];

    result?: {
      items?:
        AnalyticsStock[];

      stocks?:
        AnalyticsStock[];
    };
  }
):
AnalyticsStock[] {

  return (
    response.items
    ??
    response.stocks
    ??
    response.result
      ?.items
    ??
    response.result
      ?.stocks
    ??
    []
  );
}

async function getAnalyticsStocks(
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
      ANALYTICS_STOCK_BATCH_SIZE
    );

  const stocks:
    AnalyticsStock[] =
    [];

  let requestsMade =
    0;

  for (
    let index = 0;
    index < batches.length;
    index += 1
  ) {

    if (
      index > 0
    ) {

      await sleep(
        ANALYTICS_STOCK_REQUEST_INTERVAL_MS
      );
    }

    const batch =
      batches[
        index
      ];

    const response =
      await ozonPost<{
        items?:
          AnalyticsStock[];

        stocks?:
          AnalyticsStock[];

        result?: {
          items?:
            AnalyticsStock[];

          stocks?:
            AnalyticsStock[];
        };
      }>(
        "/v1/analytics/stocks",
        {
          skus:
            batch,
        }
      );

    requestsMade +=
      1;

    stocks.push(
      ...extractAnalyticsStockRows(
        response
      )
    );
  }

  return {
    requestedSkus:
      uniqueSkus.length,

    batches:
      batches.length,

    requestsMade,

    stocks,
  };
}

// ============================================================
// ПРОВЕРКА ЖИВЫХ ACTIVE LISTINGS
// ============================================================

function getActiveCatalogProducts(
  catalogItems:
    OzonCatalogItem[],

  activeProducts:
    ProductRow[]
) {

  const {
    byOffer,
    byOzonProductId,
  } =
    buildProductIndexes(
      activeProducts
    );

  const matchedProducts =
    new Map<
      string,
      ProductRow
    >();

  for (
    const item
    of catalogItems
  ) {

    const offerId =
      normalizeKey(
        item.offer_id
      );

    const ozonProductId =
      normalizeKey(
        item.product_id
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

    if (product) {

      matchedProducts.set(
        product.id,
        product
      );
    }
  }

  return Array.from(
    matchedProducts.values()
  );
}

// ============================================================
// STOCK DATA
// ============================================================

function buildStockData(
  stocks:
    AnalyticsStock[],

  skuResolutions:
    Map<
      string,
      SkuResolution
    >,

  clusters:
    OzonCluster[],

  warehouseToCluster:
    Map<
      string,
      WarehouseCluster
    >
) {

  const clusterByName =
    new Map<
      string,
      {
        id:
          string;

        name:
          string;
      }
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

    if (
      clusterId
      &&
      clusterName
    ) {

      clusterByName.set(
        clusterName,
        {
          id:
            clusterId,

          name:
            clusterName,
        }
      );
    }
  }

  type StockAggregate = {
    product:
      ProductRow;

    clusterId:
      string;

    clusterName:
      string;

    quantity:
      number;

    warehouses:
      Array<
        Record<
          string,
          unknown
        >
      >;
  };

  const aggregated =
    new Map<
      string,
      StockAggregate
    >();

  const unknownPositiveRows:
    Array<
      Record<
        string,
        unknown
      >
    > =
    [];

  let unknownZeroRows =
    0;

  let ignoredInactiveRows =
    0;

  let totalAvailable =
    0;

  for (
    const stock
    of stocks
  ) {

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

    const analyticsClusterId =
      normalizeKey(
        stock.cluster_id
      );

    const analyticsClusterName =
      normalizeKey(
        stock.cluster_name
      );

    const available =
      toSafeInteger(
        stock.available_stock_count
      );

    const resolution =
      sku

        ? skuResolutions.get(
            sku
          )

        : undefined;

    const product =
      resolution?.product
      ?? null;

    if (!product) {

      if (
        available > 0
      ) {

        if (
          unknownPositiveRows.length <
          100
        ) {

          unknownPositiveRows.push(
            {
              sku:
                sku
                || null,

              offer_id:
                resolution
                  ?.ozonOfferId
                ?? null,

              ozon_product_id:
                resolution
                  ?.ozonProductId
                ?? null,

              warehouse_id:
                warehouseId
                || null,

              warehouse_name:
                warehouseName
                || null,

              cluster_name:
                analyticsClusterName
                || null,

              available_stock_count:
                available,
            }
          );
        }

      } else {

        unknownZeroRows +=
          1;
      }

      continue;
    }

    if (
      !product.is_active
    ) {

      ignoredInactiveRows +=
        1;

      continue;
    }

    const warehouseCluster =
      warehouseId

        ? warehouseToCluster.get(
            warehouseId
          )

        : undefined;

    const namedCluster =
      analyticsClusterName

        ? clusterByName.get(
            analyticsClusterName
          )

        : undefined;

    const clusterId =
      warehouseCluster
        ?.clusterId
      ||
      namedCluster
        ?.id
      ||
      analyticsClusterId
      ||
      (
        analyticsClusterName

          ? `name:${analyticsClusterName}`

          : warehouseId

            ? `warehouse:${warehouseId}`

            : "unknown"
      );

    const clusterName =
      analyticsClusterName
      ||
      warehouseCluster
        ?.clusterName
      ||
      namedCluster
        ?.name
      ||
      warehouseName
      ||
      "Не определён";

    const aggregateKey =
      [
        product.id,
        clusterId,
      ].join(
        "::"
      );

    let current =
      aggregated.get(
        aggregateKey
      );

    if (!current) {

      current = {
        product,

        clusterId,

        clusterName,

        quantity:
          0,

        warehouses:
          [],
      };

      aggregated.set(
        aggregateKey,
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

        offer_id:
          resolution
            ?.ozonOfferId
          ??
          product.offer_id,

        ozon_product_id:
          resolution
            ?.ozonProductId
          ??
          product.ozon_product_id,

        warehouse_id:
          warehouseId
          || null,

        warehouse_name:
          warehouseName
          ||
          warehouseCluster
            ?.warehouseName
          ||
          null,

        cluster_name:
          analyticsClusterName
          ||
          clusterName,

        available_stock_count:
          available,
      }
    );

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
            current.product.id,

          cluster_id:
            current.clusterId,

          cluster_name:
            current.clusterName,

          quantity:
            current.quantity,

          raw_payload: {
            source:
              "v1/analytics/stocks",

            master_code:
              current.product.master_code,

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

      return (
        left.product_id.localeCompare(
          right.product_id
        )
        ||
        left.cluster_id.localeCompare(
          right.cluster_id
        )
      );
    }
  );

  return {
    rows,

    unknownPositiveRows,

    unknownZeroRows,

    ignoredInactiveRows,

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
    // 2. DATES
    // ========================================================

    const todayMoscow =
      getMoscowDate();

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

    if (
      clusterResult
        .ambiguousClusterNameKeys
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
            "cluster_name_validation",

          error:
            "В /v1/cluster/list найдены неоднозначные названия кластеров.",

          count:
            clusterResult
              .ambiguousClusterNameKeys
              .length,

          sample:
            clusterResult
              .ambiguousClusterNameKeys
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

    const unresolvedSalesSkus =
      getUnresolvedSalesSkus(
        salesResult.postings,
        products,
        salesDateFrom,
        salesDateTo
      );

    const salesProductInfo =
      unresolvedSalesSkus.length > 0

        ? await getProductInfoBySkus(
            unresolvedSalesSkus
          )

        : {
            requestedSkus:
              0,

            requestsMade:
              0,

            items:
              [] as OzonProductInfoItem[],
          };

    const salesResolutionResult =
      buildSkuResolutions(
        salesProductInfo.items,
        products
      );

    if (
      salesResolutionResult
        .conflicts
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
            "sales_sku_conflict",

          error:
            "Один SKU продаж сопоставился с несколькими products.",

          sample:
            salesResolutionResult
              .conflicts
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

    const salesData =
      buildSalesData(
        salesResult.postings,
        products,
        salesResolutionResult
          .resolutions,
        clusterResult
          .clusterNameToCluster,
        clusterResult
          .warehouseToCluster,
        salesDateFrom,
        salesDateTo
      );

    if (
      salesData
        .unresolvedClusters
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
            "sales_cluster_validation",

          error:
            "Есть FBO-отправления, для которых не удалось определить кластер продаж. Запись отменена.",

          count:
            salesData
              .postingsWithoutResolvedCluster,

          sample:
            salesData
              .unresolvedClusters
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

    if (
      salesData
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
            "sales_final_validation",

          error:
            "Есть неразрешённые товары в продажах. Запись отменена.",

          count:
            salesData
              .unmatched
              .length,

          sample:
            salesData
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
    // 6. STOCK CATALOG
    // ========================================================

    const ozonCatalog =
      await getOzonProductCatalog();

    if (
      ozonCatalog
        .items
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
            "stock_catalog_validation",

          error:
            "Ozon /v3/product/list вернул пустой каталог.",
        },
        {
          status:
            409,
        }
      );
    }

    const catalogOfferIds =
      Array.from(
        new Set(
          ozonCatalog
            .items
            .map(
              item =>
                normalizeKey(
                  item.offer_id
                )
            )
            .filter(
              Boolean
            )
        )
      );

    if (
      catalogOfferIds.length ===
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
            "stock_catalog_validation",

          error:
            "Каталог Ozon не содержит offer_id.",
        },
        {
          status:
            409,
        }
      );
    }

    // ========================================================
    // 7. OFFER ID → SKU
    // ========================================================

    const stockProductInfo =
      await getProductInfoByOfferIds(
        catalogOfferIds
      );

    if (
      stockProductInfo
        .items
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
            "stock_product_info_validation",

          error:
            "Ozon /v3/product/info/list не вернул товары каталога.",
        },
        {
          status:
            409,
        }
      );
    }

    const stockResolutionResult =
      buildSkuResolutions(
        stockProductInfo.items,
        products
      );

    if (
      stockResolutionResult
        .conflicts
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
            "stock_sku_conflict",

          error:
            "Один Ozon SKU сопоставился с несколькими products.",

          count:
            stockResolutionResult
              .conflicts
              .length,

          sample:
            stockResolutionResult
              .conflicts
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

    const stockSkus =
      Array.from(
        new Set(
          stockProductInfo
            .items
            .map(
              item =>
                normalizeKey(
                  item.sku
                )
            )
            .filter(
              Boolean
            )
        )
      );

    if (
      stockSkus.length ===
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
            "stock_sku_validation",

          error:
            "Не удалось получить реальные SKU товаров Ozon.",
        },
        {
          status:
            409,
        }
      );
    }

    // ========================================================
    // 8. ЖИВЫЕ ACTIVE PRODUCTS ДОЛЖНЫ ИМЕТЬ SKU
    // ========================================================

    const activeCatalogProducts =
      getActiveCatalogProducts(
        ozonCatalog.items,
        activeProducts
      );

    const activeProductsWithSku =
      new Set<string>();

    for (
      const resolution
      of stockResolutionResult
        .resolutions
        .values()
    ) {

      if (
        resolution.product
          ?.is_active
      ) {

        activeProductsWithSku.add(
          resolution.product.id
        );
      }
    }

    const liveActiveWithoutSku =
      activeCatalogProducts.filter(
        product =>
          !activeProductsWithSku.has(
            product.id
          )
      );

    if (
      liveActiveWithoutSku.length >
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
            "stock_live_sku_validation",

          error:
            "Для живых активных карточек Ozon не удалось получить SKU. Запись отменена.",

          count:
            liveActiveWithoutSku.length,

          sample:
            liveActiveWithoutSku
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
    // 9. ANALYTICS STOCKS
    // ========================================================

    const stockResult =
      await getAnalyticsStocks(
        stockSkus
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
            "Ozon /v1/analytics/stocks вернул 0 строк. Запись отменена.",
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
        stockResolutionResult
          .resolutions,
        clusterResult
          .clusters,
        clusterResult
          .warehouseToCluster
      );

    // ========================================================
    // 10. НЕИЗВЕСТНЫЙ ТОВАР С ПОЛОЖИТЕЛЬНЫМ ОСТАТКОМ
    // ========================================================

    if (
      stockData
        .unknownPositiveRows
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
            "stock_unknown_positive_validation",

          error:
            "Ozon вернул положительный остаток для товаров, которых нет в нашей номенклатуре. Запись отменена.",

          count:
            stockData
              .unknownPositiveRows
              .length,

          sample:
            stockData
              .unknownPositiveRows,
        },
        {
          status:
            409,
        }
      );
    }

    // ========================================================
    // 11. POSTINGS COUNTERS
    // ========================================================

    const postingsInWindow =
      salesResult
        .postings
        .filter(
          posting => {

            const saleDate =
              isoToMoscowDate(
                posting.created_at
              );

            return Boolean(
              saleDate
              &&
              saleDate >=
              salesDateFrom
              &&
              saleDate <=
              salesDateTo
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
    // 12. ATOMIC WRITE
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
      writeResult.ok !==
      true
    ) {

      throw new Error(
        "apply_ozon_daily_sync не подтвердил успешную запись"
      );
    }

    if (
      writeResult
        .sales_rows_saved
      !==
      salesData
        .rows
        .length
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
      writeResult
        .stock_rows_saved
      !==
      stockData
        .rows
        .length
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
    // 13. SUCCESS
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

          live_active_in_ozon_catalog:
            activeCatalogProducts.length,
        },

        clusters: {
          methods:
            clusterResult
              .clusterTypes,

          ozon_requests:
            clusterResult
              .requestsMade,

          total_clusters:
            clusterResult
              .clusters
              .length,

          mapped_cluster_names:
            clusterResult
              .clusterNameToCluster
              .size,

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

          matched_by_offer_id:
            salesData
              .matchedByOffer,

          matched_by_sku_fallback:
            salesData
              .matchedBySku,

          cluster_resolution: {
            primary_source:
              "financial_data.cluster_from",

            postings_by_financial_cluster:
              salesData
                .postingsClusteredByFinancialData,

            postings_by_warehouse_fallback:
              salesData
                .postingsClusteredByWarehouseFallback,

            postings_without_resolved_cluster:
              salesData
                .postingsWithoutResolvedCluster,
          },

          ignored_inactive_sample:
            salesData
              .ignoredInactive,

          ignored_out_of_range_sample:
            salesData
              .ignoredOutOfRange,

          per_day:
            salesData
              .perDay,
        },

        stocks_fbo: {
          method:
            "/v1/analytics/stocks",

          catalog_method:
            "/v3/product/list",

          sku_method:
            "/v3/product/info/list",

          catalog_requests:
            ozonCatalog
              .requestsMade,

          catalog_items_received:
            ozonCatalog
              .items
              .length,

          catalog_total_declared:
            ozonCatalog
              .declaredTotal,

          catalog_offer_ids:
            catalogOfferIds
              .length,

          product_info_requests:
            stockProductInfo
              .requestsMade,

          product_info_items_received:
            stockProductInfo
              .items
              .length,

          requested_skus:
            stockResult
              .requestedSkus,

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

          unknown_zero_rows_ignored:
            stockData
              .unknownZeroRows,

          inactive_rows_ignored:
            stockData
              .ignoredInactiveRows,

          totals: {
            available_stock_count:
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
  request:
    Request
) {

  return runDailySync(
    request
  );
}

export async function POST(
  request:
    Request
) {

  return runDailySync(
    request
  );
}
