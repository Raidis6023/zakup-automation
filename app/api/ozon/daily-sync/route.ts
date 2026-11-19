export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_WINDOW_DAYS =
  28;

const OZON_MAX_RETRIES =
  5;

const RETRY_BASE_MS =
  1500;

const OZON_MIN_REQUEST_INTERVAL_MS =
  125;

const ANALYTICS_STOCK_REQUEST_INTERVAL_MS =
  1250;

const OZON_429_FALLBACK_DELAY_MS =
  5000;

const MAX_FBO_POSTING_PAGES =
  1000;

const MAX_PRODUCT_LIST_PAGES =
  100;

const PRODUCT_INFO_BATCH_SIZE =
  900;

const ANALYTICS_STOCK_BATCH_SIZE =
  100;


// ============================================================
// RATE LIMIT STATE
// ============================================================

let lastOzonRequestStartedAt =
  0;


// ============================================================
// ТИПЫ
// ============================================================

type ProductRow = {
  id:
    string;

  offer_id:
    string;

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

  is_active:
    boolean;
};


type WarehouseCluster = {
  clusterId:
    string;

  clusterName:
    string;

  warehouseName:
    string;
};


type ClusterReference = {
  clusterId:
    string;

  clusterName:
    string;

  clusterType:
    string;
};


type OzonCluster = {
  id?:
    | number
    | string;

  name?:
    string;

  type?:
    string;

  logistic_clusters?:
    Array<{
      warehouses?:
        Array<{
          warehouse_id?:
            | number
            | string;

          name?:
            string;
        }>;
    }>;
};


type FboPosting = {
  posting_number?:
    string;

  status?:
    string;

  created_at?:
    string;

  products?:
    Array<{
      sku?:
        | number
        | string;

      offer_id?:
        string;

      quantity?:
        number;
    }>;

  analytics_data?: {
    warehouse_id?:
      | number
      | string;

    warehouse_name?:
      string;

    city?:
      string;
  } | null;

  financial_data?: {
    cluster_from?:
      string;

    cluster_to?:
      string;
  } | null;
};


type OzonProductInfoItem = {
  id?:
    | number
    | string;

  offer_id?:
    string;

  sku?:
    | number
    | string;

  name?:
    string;

  [key: string]:
    unknown;
};


type OzonCatalogItem = {
  product_id?:
    | number
    | string;

  offer_id?:
    string;

  [key: string]:
    unknown;
};


type AnalyticsStock = {
  sku?:
    | number
    | string;

  offer_id?:
    string;

  warehouse_id?:
    | number
    | string;

  warehouse_name?:
    | string
    | null;

  cluster_id?:
    | number
    | string;

  cluster_name?:
    | string
    | null;

  available_stock_count?:
    number;

  [key: string]:
    unknown;
};


type OzonUnlinkedWriteRow = {
  offer_id:
    string;

  ozon_product_id:
    | string
    | null;

  ozon_sku:
    | string
    | null;

  name:
    | string
    | null;

  raw_payload:
    Record<
      string,
      unknown
    >;
};


type SkuResolution = {
  sku:
    string;

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
  product_id:
    string;

  cluster_id:
    string;

  cluster_name:
    | string
    | null;

  sale_date:
    string;

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
  product_id:
    string;

  cluster_id:
    string;

  cluster_name:
    | string
    | null;

  quantity:
    number;

  raw_payload:
    Record<
      string,
      unknown
    >;
};


type ApplySyncResult = {
  ok:
    boolean;

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
  value:
    unknown
): string {

  return String(
    value
    ??
    ""
  ).trim();

}


function normalizeClusterName(
  value:
    unknown
): string {

  return normalizeKey(
    value
  )
    .toLowerCase()
    .replace(
      /ё/g,
      "е"
    )
    .replace(
      /[^a-zа-я0-9]+/gi,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function toSafeInteger(
  value:
    unknown
): number {

  const parsed =
    Number(
      value
      ??
      0
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
  milliseconds:
    number
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
  rows:
    T[],

  size:
    number
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
    waitMs >
    0
  ) {

    await sleep(
      waitMs
    );

  }


  lastOzonRequestStartedAt =
    Date.now();

}


function getMoscowDate(
  date:
    Date = new Date()
): string {

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
  date:
    string,

  delta:
    number
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
    (process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);


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
// NETWORK RETRIES
// ============================================================

const RETRYABLE_OZON_NETWORK_CODES =
  new Set<string>(
    [
      "UND_ERR_SOCKET",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_BODY_TIMEOUT",
      "UND_ERR_ABORTED",
      "ECONNRESET",
      "ECONNREFUSED",
      "ECONNABORTED",
      "ETIMEDOUT",
      "EPIPE",
      "EAI_AGAIN",
      "ENETUNREACH",
      "EHOSTUNREACH",
    ]
  );


function getNetworkErrorCode(
  error:
    unknown
):
string | null {

  if (
    !error
    ||
    typeof error !==
      "object"
  ) {

    return null;

  }


  const directCode =
    (
      error as {
        code?:
          unknown;
      }
    ).code;


  if (
    typeof directCode ===
      "string"
  ) {

    return directCode;

  }


  const cause =
    (
      error as {
        cause?:
          unknown;
      }
    ).cause;


  if (
    cause
    &&
    typeof cause ===
      "object"
  ) {

    const causeCode =
      (
        cause as {
          code?:
            unknown;
        }
      ).code;


    if (
      typeof causeCode ===
        "string"
    ) {

      return causeCode;

    }

  }


  return null;

}


function getNetworkErrorMessage(
  error:
    unknown
): string {

  if (
    error instanceof Error
  ) {

    return error.message;

  }


  return String(
    error
  );

}


function isRetryableOzonNetworkError(
  error:
    unknown
): boolean {

  if (
    error instanceof Error
    &&
    error.name ===
      "AbortError"
  ) {

    return true;

  }


  const code =
    getNetworkErrorCode(
      error
    );


  if (
    code
    &&
    RETRYABLE_OZON_NETWORK_CODES
      .has(
        code
      )
  ) {

    return true;

  }


  if (
    error instanceof TypeError
    &&
    error.message
      .toLowerCase()
      .includes(
        "fetch failed"
      )
  ) {

    return true;

  }


  return false;

}


// ============================================================
// OZON POST
// ============================================================

async function ozonPost<T>(
  path:
    string,

  body:
    unknown
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


      const responseText =
        await response.text();


      let parsed:
        unknown =
        null;


      if (responseText) {

        try {

          parsed =
            JSON.parse(
              responseText
            );

        } catch {

          parsed = {
            raw:
              responseText,
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
              `после ${attempt} попыток`,
              JSON.stringify(
                parsed
              ),
            ].join(
              ": "
            )
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
          retryAfterSeconds >
            0

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


        console.warn(
          [
            "OZON RETRY",
            path,
            "HTTP 429",
            `попытка ${attempt}/${OZON_MAX_RETRIES}`,
            `пауза ${retryAfterMs} мс`,
          ].join(
            " | "
          )
        );


        await sleep(
          retryAfterMs
        );


        continue;

      }


      if (
        response.status >=
          500
        &&
        response.status <=
          599
      ) {

        if (
          attempt <
          OZON_MAX_RETRIES
        ) {

          const retryAfterMs =
            RETRY_BASE_MS
            *
            attempt;


          console.warn(
            [
              "OZON RETRY",
              path,
              `HTTP ${response.status}`,
              `попытка ${attempt}/${OZON_MAX_RETRIES}`,
              `пауза ${retryAfterMs} мс`,
            ].join(
              " | "
          ));


          await sleep(
            retryAfterMs
          );


          continue;

        }

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
        isRetryableOzonNetworkError(
          error
        )
      ) {

        const errorCode =
          getNetworkErrorCode(
            error
          );


        const errorMessage =
          getNetworkErrorMessage(
            error
          );


        if (
          attempt <
          OZON_MAX_RETRIES
        ) {

          const retryAfterMs =
            RETRY_BASE_MS
            *
            attempt;


          console.warn(
            [
              "OZON NETWORK RETRY",
              path,
              errorCode
                ? `code=${errorCode}`
                : "code=unknown",
              `message=${errorMessage}`,
              `попытка ${attempt}/${OZON_MAX_RETRIES}`,
              `пауза ${retryAfterMs} мс`,
            ].join(
              " | "
          ));


          await sleep(
            retryAfterMs
          );


          continue;

        }


        throw new Error(
          [
            `Ozon API ${path}`,
            "сетевой сбой",
            errorCode
              ? `code=${errorCode}`
              : "code=unknown",
            `message=${errorMessage}`,
            `исчерпаны ${OZON_MAX_RETRIES} попыток`,
          ].join(
            ": "
          )
        );

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
// UNLINKED PRODUCTS
// ============================================================

function buildOzonUnlinkedProducts(
  catalogItems:
    OzonCatalogItem[],

  productInfoItems:
    OzonProductInfoItem[],

  products:
    ProductRow[]
):
OzonUnlinkedWriteRow[] {

  const productByOffer =
    new Map<
      string,
      ProductRow
    >();


  const productByOzonId =
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

      productByOffer.set(
        offerId,
        product
      );

    }


    if (ozonProductId) {

      productByOzonId.set(
        ozonProductId,
        product
      );

    }

  }


  const infoByOffer =
    new Map<
      string,
      OzonProductInfoItem
    >();


  const infoByOzonId =
    new Map<
      string,
      OzonProductInfoItem
    >();


  for (
    const item
    of productInfoItems
  ) {

    const offerId =
      normalizeKey(
        item.offer_id
      );


    const ozonProductId =
      normalizeKey(
        item.id
      );


    if (offerId) {

      infoByOffer.set(
        offerId,
        item
      );

    }


    if (ozonProductId) {

      infoByOzonId.set(
        ozonProductId,
        item
      );

    }

  }


  const rows:
    OzonUnlinkedWriteRow[] =
    [];


  const seenOffers =
    new Set<string>();


  for (
    const catalogItem
    of catalogItems
  ) {

    const offerId =
      normalizeKey(
        catalogItem.offer_id
      );


    if (
      !offerId
      ||
      seenOffers.has(
        offerId
      )
    ) {

      continue;

    }


    seenOffers.add(
      offerId
    );


    const catalogOzonProductId =
      normalizeKey(
        catalogItem.product_id
      );


    const existingProduct =
      productByOffer.get(
        offerId
      )
      ??
      (
        catalogOzonProductId
          ? productByOzonId.get(
              catalogOzonProductId
            )
          : undefined
      );


    if (
      existingProduct
      &&
      normalizeKey(
        existingProduct.master_code
      )
    ) {

      continue;

    }


    const info =
      infoByOffer.get(
        offerId
      )
      ??
      (
        catalogOzonProductId
          ? infoByOzonId.get(
              catalogOzonProductId
            )
          : undefined
      );


    const resolvedOzonProductId =
      normalizeKey(
        info?.id
      )
      ||
      catalogOzonProductId;


    const sku =
      normalizeKey(
        info?.sku
      );


    const name =
      normalizeKey(
        info?.name
      )
      ||
      normalizeKey(
        existingProduct
          ?.name
      );


    rows.push(
      {
        offer_id:
          offerId,

        ozon_product_id:
          resolvedOzonProductId
          ||
          null,

        ozon_sku:
          sku
          ||
          null,

        name:
          name
          ||
          null,

        raw_payload: {
          source:
            "ozon_daily_sync",

          existing_product_id:
            existingProduct
              ?.id
            ??
            null,

          existing_product_master_code:
            existingProduct
              ?.master_code
            ??
            null,
        },
      }
    );

  }


  return rows;

}


async function upsertOzonUnlinkedProducts(
  rows:
    OzonUnlinkedWriteRow[]
) {

  if (
    rows.length ===
    0
  ) {

    return {
      saved:
        0,
    };

  }


  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  const now =
    new Date()
      .toISOString();


  const existingUrl =
    new URL(
      `${supabaseUrl}/rest/v1/ozon_unlinked_products`
    );


  existingUrl.searchParams.set(
    "select",
    "offer_id,first_seen_at"
  );


  existingUrl.searchParams.set(
    "limit",
    "5000"
  );


  const existingResponse =
    await fetch(
      existingUrl.toString(),
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


  const existingText =
    await existingResponse.text();


  if (!existingResponse.ok) {

    throw new Error(
      `Supabase ozon_unlinked_products read: HTTP ${existingResponse.status}: ${existingText}`
    );

  }


  const existingRows =
    JSON.parse(
      existingText
    ) as Array<{
      offer_id:
        string;

      first_seen_at:
        string;
    }>;


  const firstSeenByOffer =
    new Map(
      existingRows.map(
        row => [
          row.offer_id,
          row.first_seen_at,
        ]
      )
    );


  const payload =
    rows.map(
      row => ({
        ...row,

        status:
          "pending",

        assigned_master_code:
          null,

        resolved_product_id:
          null,

        resolved_at:
          null,

        first_seen_at:
          firstSeenByOffer.get(
            row.offer_id
          )
          ??
          now,

        last_seen_at:
          now,
      })
    );


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/ozon_unlinked_products?on_conflict=offer_id`,
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

          Prefer:
            "resolution=merge-duplicates,return=minimal",
        },

        body:
          JSON.stringify(
            payload
          ),

        cache:
          "no-store",
      }
    );


  const responseText =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Supabase ozon_unlinked_products: HTTP ${response.status}: ${responseText}`
    );

  }


  return {
    saved:
      rows.length,
  };

}


// ============================================================
// CLUSTERS
// ============================================================

async function getOzonClusters() {

  const [
    ozonResponse,
    cisResponse,
  ] =
    await Promise.all(
      [
        ozonPost<{
          clusters?:
            OzonCluster[];
        }>(
          "/v1/cluster/list",
          {
            cluster_type:
              "CLUSTER_TYPE_OZON",
          }
        ),

        ozonPost<{
          clusters?:
            OzonCluster[];
        }>(
          "/v1/cluster/list",
          {
            cluster_type:
              "CLUSTER_TYPE_CIS",
          }
        ),
      ]
    );


  const ozonClusters =
    (
      ozonResponse.clusters
      ??
      []
    ).map(
      cluster => ({
        ...cluster,

        type:
          "CLUSTER_TYPE_OZON",
      })
    );


  const cisClusters =
    (
      cisResponse.clusters
      ??
      []
    ).map(
      cluster => ({
        ...cluster,

        type:
          "CLUSTER_TYPE_CIS",
      })
    );


  const clusters =
    [
      ...ozonClusters,
      ...cisClusters,
    ];


  const warehouseToCluster =
    new Map<
      string,
      WarehouseCluster
    >();


  const clusterByNormalizedName =
    new Map<
      string,
      ClusterReference[]
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


    const clusterType =
      normalizeKey(
        cluster.type
      );


    if (
      clusterId
      &&
      clusterName
    ) {

      const normalizedName =
        normalizeClusterName(
          clusterName
        );


      const existing =
        clusterByNormalizedName.get(
          normalizedName
        )
        ??
        [];


      existing.push(
        {
          clusterId,
          clusterName,
          clusterType,
        }
      );


      clusterByNormalizedName.set(
        normalizedName,
        existing
      );

    }


    for (
      const logisticCluster
      of cluster.logistic_clusters
      ??
      []
    ) {

      for (
        const warehouse
        of logisticCluster.warehouses
        ??
        []
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
    ozonClusters,
    cisClusters,
    warehouseToCluster,
    clusterByNormalizedName,
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
        ??
        []
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
        ??
        []
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
        ??
        []
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
// SKU RESOLUTION
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
          ||
          null,

        ozonOfferId:
          ozonOfferId
          ||
          null,

        product:
          product
          ??
          null,

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
// UNRESOLVED SALES SKU
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
      ??
      []
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

  warehouseToCluster:
    Map<
      string,
      WarehouseCluster
    >,

  clusterByNormalizedName:
    Map<
      string,
      ClusterReference[]
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

    clusterSources:
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


  const unresolvedClusters:
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


  let matchedByOffer =
    0;


  let matchedBySku =
    0;


  let clusterMatchedByClusterTo =
    0;


  let clusterMatchedByWarehouseFallback =
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
        ??
        []
      ) {

        unmatched.push(
          {
            reason:
              "invalid_created_at",

            posting_number:
              posting.posting_number
              ??
              null,

            offer_id:
              normalizeKey(
                item.offer_id
              )
              ||
              null,

            sku:
              normalizeKey(
                item.sku
              )
              ||
              null,

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
        ??
        []
      ) {

        if (
          ignoredOutOfRange.length <
          100
        ) {

          ignoredOutOfRange.push(
            {
              posting_number:
                posting.posting_number
                ??
                null,

              sale_date:
                saleDate,

              offer_id:
                normalizeKey(
                  item.offer_id
                )
                ||
                null,

              sku:
                normalizeKey(
                  item.sku
                )
                ||
                null,

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
        posting
          .analytics_data
          ?.warehouse_id
      );


    const warehouseName =
      normalizeKey(
        posting
          .analytics_data
          ?.warehouse_name
      );


    const clusterTo =
      normalizeKey(
        posting
          .financial_data
          ?.cluster_to
      );


    let clusterId =
      "";


    let clusterName =
      "";


    let clusterSource =
      "";


    if (clusterTo) {

      const normalizedClusterTo =
        normalizeClusterName(
          clusterTo
        );


      const matches =
        clusterByNormalizedName.get(
          normalizedClusterTo
        )
        ??
        [];


      if (
        matches.length ===
        1
      ) {

        clusterId =
          matches[
            0
          ].clusterId;


        clusterName =
          matches[
            0
          ].clusterName;


        clusterSource =
          "financial_data.cluster_to";


        clusterMatchedByClusterTo +=
          1;

      } else if (
        matches.length >
        1
      ) {

        unresolvedClusters.push(
          {
            reason:
              "cluster_to_ambiguous",

            posting_number:
              posting.posting_number
              ??
              null,

            cluster_to:
              clusterTo,

            matches:
              matches.map(
                match => ({
                  cluster_id:
                    match.clusterId,

                  cluster_name:
                    match.clusterName,

                  cluster_type:
                    match.clusterType,
                })
              ),

            warehouse_id:
              warehouseId
              ||
              null,

            warehouse_name:
              warehouseName
              ||
              null,
          }
        );


        continue;

      }

    }


    if (!clusterId) {

      const warehouseCluster =
        warehouseId
          ? warehouseToCluster.get(
              warehouseId
            )
          : undefined;


      if (warehouseCluster) {

        clusterId =
          warehouseCluster.clusterId;


        clusterName =
          warehouseCluster.clusterName;


        clusterSource =
          "analytics_data.warehouse_id_fallback";


        clusterMatchedByWarehouseFallback +=
          1;

      }

    }


    if (!clusterId) {

      unresolvedClusters.push(
        {
          reason:
            clusterTo
              ? "cluster_to_not_found_in_reference"
              : "cluster_to_missing_and_warehouse_unmapped",

          posting_number:
            posting.posting_number
            ??
            null,

          cluster_to:
            clusterTo
            ||
            null,

          warehouse_id:
            warehouseId
            ||
            null,

          warehouse_name:
            warehouseName
            ||
            null,

          status:
            posting.status
            ??
            null,
        }
      );


      continue;

    }


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
      ??
      []
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
          ??
          undefined;


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
              ??
              null,

            sale_date:
              saleDate,

            offer_id:
              offerId
              ||
              null,

            sku:
              sku
              ||
              null,

            quantity,

            cluster_id:
              clusterId,

            cluster_name:
              clusterName,
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
                ||
                null,

              sku:
                sku
                ||
                null,

              quantity,

              master_code:
                product.master_code,
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

          clusterSources:
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


      if (clusterSource) {

        current.clusterSources.add(
          clusterSource
        );

      }


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

            cluster_resolution:
              "financial_data.cluster_to",

            master_code:
              current.product.master_code,

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

            cluster_sources:
              Array.from(
                current.clusterSources
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
      ??
      {
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
    unresolvedClusters,
    ignoredInactive,
    ignoredOutOfRange,
    matchedByOffer,
    matchedBySku,
    clusterMatchedByClusterTo,
    clusterMatchedByWarehouseFallback,
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
      ??
      [];


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
// STOCK RESPONSE
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


// ============================================================
// ANALYTICS STOCKS
// ============================================================

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
      index >
      0
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
// ACTIVE CATALOG PRODUCTS
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
      ??
      null;


    if (!product) {

      if (
        available >
        0
      ) {

        if (
          unknownPositiveRows.length <
          100
        ) {

          unknownPositiveRows.push(
            {
              sku:
                sku
                ||
                null,

              offer_id:
                resolution
                  ?.ozonOfferId
                ??
                null,

              ozon_product_id:
                resolution
                  ?.ozonProductId
                ??
                null,

              warehouse_id:
                warehouseId
                ||
                null,

              warehouse_name:
                warehouseName
                ||
                null,

              cluster_name:
                analyticsClusterName
                ||
                null,

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
          ||
          null,

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
          ||
          null,

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


  let replenishmentAttempted =
    false;


  let replenishmentSucceeded =
    false;


  let replenishmentRunId:
    string
    | null =
    null;


  let replenishmentError:
    string
    | null =
    null;


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


    const linkedProducts =
      products.filter(
        product =>
          Boolean(
            normalizeKey(
              product.master_code
            )
          )
      );


    const linkedActiveProducts =
      linkedProducts.filter(
        product =>
          product.is_active
      );


    // ========================================================
    // 4. CLUSTERS
    // ========================================================

    const clusterResult =
      await getOzonClusters();


    if (
      clusterResult
        .clusters
        .length ===
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
        .length ===
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
    // 6. SALES SKU FALLBACK
    // ========================================================

    const unresolvedSalesSkus =
      getUnresolvedSalesSkus(
        salesResult.postings,
        linkedProducts,
        salesDateFrom,
        salesDateTo
      );


    const salesProductInfo =
      unresolvedSalesSkus.length >
      0

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
        linkedProducts
      );


    if (
      salesResolutionResult
        .conflicts
        .length >
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


    // ========================================================
    // 7. BUILD SALES
    // ========================================================

    const salesData =
      buildSalesData(
        salesResult.postings,
        linkedProducts,
        salesResolutionResult
          .resolutions,
        clusterResult
          .warehouseToCluster,
        clusterResult
          .clusterByNormalizedName,
        salesDateFrom,
        salesDateTo
      );


    if (
      salesData
        .unresolvedClusters
        .length >
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
            "sales_cluster_validation",

          error:
            "Не удалось однозначно определить кластер части FBO-продаж. Запись отменена.",

          count:
            salesData
              .unresolvedClusters
              .length,

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


    // ========================================================
    // 8. CATALOG
    // ========================================================

    const ozonCatalog =
      await getOzonProductCatalog();


    if (
      ozonCatalog
        .items
        .length ===
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
    // 9. PRODUCT INFO
    // ========================================================

    const stockProductInfo =
      await getProductInfoByOfferIds(
        catalogOfferIds
      );


    if (
      stockProductInfo
        .items
        .length ===
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


    // ========================================================
    // 10. UNLINKED QUEUE
    // ========================================================

    const unlinkedProducts =
      buildOzonUnlinkedProducts(
        ozonCatalog.items,
        stockProductInfo.items,
        products
      );


    let unlinkedQueueSaved =
      0;


    let unlinkedQueueError:
      string
      | null =
      null;


    try {

      const unlinkedQueueResult =
        await upsertOzonUnlinkedProducts(
          unlinkedProducts
        );


      unlinkedQueueSaved =
        unlinkedQueueResult.saved;

    } catch (error) {

      unlinkedQueueError =
        error instanceof Error
          ? error.message
          : String(
              error
            );


      console.error(
        "OZON UNLINKED QUEUE ERROR",
        error
      );

    }


    // ========================================================
    // 11. STOCK SKU RESOLUTION
    // ========================================================

    const stockResolutionResult =
      buildSkuResolutions(
        stockProductInfo.items,
        linkedProducts
      );


    if (
      stockResolutionResult
        .conflicts
        .length >
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


    // ========================================================
    // 12. STOCK SKU LIST
    // ========================================================

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
    // 13. ACTIVE PRODUCTS WITH SKU
    // ========================================================

    const activeCatalogProducts =
      getActiveCatalogProducts(
        ozonCatalog.items,
        linkedActiveProducts
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
    // 14. STOCKS
    // ========================================================

    const stockResult =
      await getAnalyticsStocks(
        stockSkus
      );


    if (
      stockResult
        .stocks
        .length ===
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
    // 15. POSTING STATS
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
    // 16. ATOMIC DATABASE WRITE
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
    // 17. АВТОМАТИЧЕСКИЙ РАСЧЁТ ПОТРЕБНОСТИ FBO
    //
    // ВАЖНО:
    //
    // Это отдельная транзакция.
    //
    // Если расчёт потребности упадёт,
    // уже успешно записанные продажи и остатки НЕ теряем.
    // ========================================================

    replenishmentAttempted =
      true;


    try {

      const rpcResult =
        await supabaseRpc<
          string
        >(
          "run_ozon_fbo_replenishment",
          {}
        );


      const resolvedRunId =
        normalizeKey(
          rpcResult
        );


      if (!resolvedRunId) {

        throw new Error(
          "run_ozon_fbo_replenishment не вернул run_id"
        );

      }


      replenishmentRunId =
        resolvedRunId;


      replenishmentSucceeded =
        true;

    } catch (error) {

      replenishmentError =
        error instanceof Error
          ? error.message
          : String(
              error
            );


      console.error(
        "OZON FBO REPLENISHMENT ERROR",
        error
      );

    }


    // ========================================================
    // 18. SUCCESS
    // ========================================================

    return Response.json(
      {
        ok:
          true,

        mode:
          "write_sync",

        writes_to_database:
          true,

        attention_required:
          !replenishmentSucceeded,


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

          linked:
            linkedProducts.length,

          active_without_master_code:
            activeWithoutMasterCode.length,

          live_active_in_ozon_catalog:
            activeCatalogProducts.length,
        },


        clusters: {
          total_clusters:
            clusterResult
              .clusters
              .length,

          ozon_clusters:
            clusterResult
              .ozonClusters
              .length,

          cis_clusters:
            clusterResult
              .cisClusters
              .length,

          mapped_warehouses:
            clusterResult
              .warehouseToCluster
              .size,

          normalized_cluster_names:
            clusterResult
              .clusterByNormalizedName
              .size,
        },


        sales_fbo: {
          cluster_source:
            "financial_data.cluster_to",

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

          clusters_matched_by_cluster_to:
            salesData
              .clusterMatchedByClusterTo,

          clusters_matched_by_warehouse_fallback:
            salesData
              .clusterMatchedByWarehouseFallback,

          unresolved_clusters:
            salesData
              .unresolvedClusters
              .length,

          ignored_inactive_sample:
            salesData
              .ignoredInactive,

          ignored_out_of_range_sample:
            salesData
              .ignoredOutOfRange,

          unlinked_items_ignored:
            salesData
              .unmatched
              .length,

          unlinked_items_sample:
            salesData
              .unmatched
              .slice(
                0,
                100
              ),

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
            catalogOfferIds.length,

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

          unknown_positive_rows_ignored:
            stockData
              .unknownPositiveRows
              .length,

          unknown_positive_rows_sample:
            stockData
              .unknownPositiveRows
              .slice(
                0,
                100
              ),

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


        unlinked_products: {
          detected:
            unlinkedProducts.length,

          saved_to_queue:
            unlinkedQueueSaved,

          queue_error:
            unlinkedQueueError,
        },


        database: {
          atomic_rpc:
            "apply_ozon_daily_sync",

          result:
            writeResult,
        },


        replenishment: {
          automatically_started:
            true,

          attempted:
            replenishmentAttempted,

          succeeded:
            replenishmentSucceeded,

          run_id:
            replenishmentRunId,

          error:
            replenishmentError,

          calculation_function:
            "run_ozon_fbo_replenishment",

          ready_for_step_3_1:
            replenishmentSucceeded,
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

        replenishment_attempted:
          replenishmentAttempted,

        replenishment_succeeded:
          replenishmentSucceeded,

        replenishment_run_id:
          replenishmentRunId,

        replenishment_error:
          replenishmentError,

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

            ? "Ошибка произошла во время основной записи. apply_ozon_daily_sync откатывает свою транзакцию целиком."

            : writeSucceeded

              ? "Основная синхронизация уже успешно записана. Ошибка после этого этапа не отменяет свежие продажи и остатки."

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
// ROUTES
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
