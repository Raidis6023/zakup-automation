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
  100;

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
// PRODUCTS ИЗ SUPABASE
//
// Здесь читаем ВСЕ товары.
//
// Активные нужны для будущей записи.
// Неактивные нужны, чтобы отличать:
// "старый известный товар" от реально неизвестного товара.
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
//
// Берём весь диапазон одним курсором.
// Ничего не записываем.
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
            1000,

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
// НЕРАЗРЕШЁННЫЕ SKU ПРОДАЖ
//
// exact offer_id имеет приоритет.
// Если offer_id уже известен даже как НЕАКТИВНЫЙ,
// SKU дополнительно разрешать не нужно.
// ============================================================

function getUnresolvedSalesSkus(
  postings:
    FboPosting[],

  products:
    ProductRow[]
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
// SKU → НАШ PRODUCT
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
// SALES PREFLIGHT
// ============================================================

function buildSalesPreflight(
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


      if (
        !saleDate
        ||
        saleDate < dateFrom
        ||
        saleDate > dateTo
      ) {

        unmatchedQuantity +=
          quantity;


        unmatched.push(
          {
            reason:
              "invalid_or_out_of_range_created_at",

            posting_number:
              posting.posting_number
              ?? null,

            created_at:
              posting.created_at
              ?? null,

            calculated_sale_date:
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
        };


        aggregated.set(
          key,
          current
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
    of aggregated.values()
  ) {

    const current =
      perDay.get(
        row.saleDate
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
      row.salesQuantity;


    current.cancelled_quantity +=
      row.cancelledQuantity;


    perDay.set(
      row.saleDate,
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
          left.sale_date.localeCompare(
            right.sale_date
          )
      );


  return {
    aggregatedRows:
      aggregated.size,

    perDay:
      perDayRows,

    unmatched,

    ignoredInactive,

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

      unmatched_items:
        unmatched.length,

      unmatched_quantity:
        unmatchedQuantity,
    },
  };
}


// ============================================================
// FBO STOCKS
//
// Остатки запрашиваем только для активных товаров.
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


      const rows =
        response.products
        ??
        response.result
          ?.products
        ??
        [];


      allStocks.push(
        ...rows
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
// STOCK PREFLIGHT
//
// quantity будущей записи:
// SUM(present - reserved)
//
// Это уже проверено против старых 5165 строк.
// ============================================================

function buildStockPreflight(
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


  type StockAggregate = {
    productId: string;

    clusterId: string;

    clusterName: string;

    quantity: number;

    warehouseRows: number;
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

        clusterId,

        clusterName,

        quantity:
          0,

        warehouseRows:
          0,
      };


      aggregated.set(
        key,
        current
      );

    }


    current.quantity +=
      available;


    current.warehouseRows +=
      1;


    totalPresent +=
      present;


    totalReserved +=
      reserved;


    totalAvailable +=
      available;

  }


  const sample =
    Array.from(
      aggregated.values()
    )
      .slice(
        0,
        30
      )
      .map(
        row => ({
          product_id:
            row.productId,

          cluster_id:
            row.clusterId,

          cluster_name:
            row.clusterName,

          quantity:
            row.quantity,

          warehouse_rows:
            row.warehouseRows,
        })
      );


  return {
    aggregatedRows:
      aggregated.size,

    unmatched,

    unmappedWarehouseIds:
      Array.from(
        unmappedWarehouseIds
      ),

    totalPresent,

    totalReserved,

    totalAvailable,

    sample,
  };
}


// ============================================================
// PREFLIGHT
// ============================================================

async function runPreflight(
  request:
    Request
) {

  const startedAt =
    Date.now();


  try {

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
    // 1. ДАТЫ
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
    // 2. PRODUCTS
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
            "preflight_28_days",

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
    // 3. CLUSTERS
    // ========================================================

    const clusterResult =
      await getOzonClusters();


    // ========================================================
    // 4. SALES 28 DAYS
    // ========================================================

    const salesResult =
      await getFboPostingsForRange(
        salesDateFrom,
        salesDateTo
      );


    // ========================================================
    // 5. SKU FALLBACK
    // ========================================================

    const unresolvedSkus =
      getUnresolvedSalesSkus(
        salesResult.postings,
        products
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


    const salesPreflight =
      buildSalesPreflight(
        salesResult.postings,
        products,
        skuResolutions,
        clusterResult
          .warehouseToCluster,
        salesDateFrom,
        salesDateTo
      );


    // ========================================================
    // 6. STOCKS
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


    const stockPreflight =
      buildStockPreflight(
        stockResult.stocks,
        activeProducts,
        clusterResult
          .warehouseToCluster
      );


    // ========================================================
    // 7. POSTING COUNTS
    // ========================================================

    const cancelledPostings =
      salesResult.postings
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


    const notCancelledPostings =
      salesResult.postings.length
      -
      cancelledPostings;


    // ========================================================
    // 8. SKU RESOLUTION SUMMARY
    // ========================================================

    const skuResolutionRows =
      Array.from(
        skuResolutions.values()
      );


    const resolvedSkuRows =
      skuResolutionRows.filter(
        row =>
          row.product
          != null
      );


    const unresolvedSkuRows =
      skuResolutionRows.filter(
        row =>
          row.product
          == null
      );


    // ========================================================
    // 9. RESULT
    // ========================================================

    return Response.json(
      {
        ok:
          (
            salesPreflight
              .unmatched
              .length === 0
            &&
            stockPreflight
              .unmatched
              .length === 0
          ),

        mode:
          "preflight_28_days",

        writes_to_database:
          false,


        dates: {
          today_moscow:
            todayMoscow,

          sales_date_from:
            salesDateFrom,

          sales_date_to:
            salesDateTo,

          sales_window_days:
            SALES_WINDOW_DAYS,

          future_stock_snapshot_date:
            todayMoscow,
        },


        products: {
          total:
            products.length,

          active:
            activeProducts.length,

          inactive:
            inactiveProducts.length,

          active_with_master_code:
            activeProducts.length
            -
            activeWithoutMasterCode.length,

          active_without_master_code:
            activeWithoutMasterCode.length,

          active_offer_ids_sent_to_stock_api:
            activeOfferIds.length,
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

          postings_total:
            salesResult
              .postings
              .length,

          postings_not_cancelled:
            notCancelledPostings,

          postings_cancelled:
            cancelledPostings,

          aggregated_rows_for_active_products:
            salesPreflight
              .aggregatedRows,

          matching:
            salesPreflight
              .matchingStats,

          per_day:
            salesPreflight
              .perDay,

          unmatched_products:
            salesPreflight
              .unmatched
              .length,

          unmatched_sample:
            salesPreflight
              .unmatched
              .slice(
                0,
                50
              ),

          ignored_inactive_sample:
            salesPreflight
              .ignoredInactive,

          unmapped_warehouse_ids_count:
            salesPreflight
              .unmatchedWarehouseIds
              .length,

          unmapped_warehouse_ids_sample:
            salesPreflight
              .unmatchedWarehouseIds
              .slice(
                0,
                50
              ),
        },


        sku_resolution: {
          unresolved_sales_skus_requested:
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
            resolvedSkuRows
              .length,

          unresolved_to_products:
            unresolvedSkuRows
              .length,

          resolution_sample:
            skuResolutionRows
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

                          ozon_product_id:
                            row.product.ozon_product_id,

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

          aggregated_rows_for_database:
            stockPreflight
              .aggregatedRows,

          unmatched_rows:
            stockPreflight
              .unmatched
              .length,

          unmatched_sample:
            stockPreflight
              .unmatched
              .slice(
                0,
                50
              ),

          unmapped_warehouse_ids_count:
            stockPreflight
              .unmappedWarehouseIds
              .length,

          unmapped_warehouse_ids_sample:
            stockPreflight
              .unmappedWarehouseIds
              .slice(
                0,
                50
              ),

          totals: {
            present:
              stockPreflight
                .totalPresent,

            reserved:
              stockPreflight
                .totalReserved,

            available:
              stockPreflight
                .totalAvailable,
          },

          aggregated_sample:
            stockPreflight
              .sample,
        },


        ready_for_write:
          (
            activeWithoutMasterCode
              .length === 0
            &&
            salesPreflight
              .unmatched
              .length === 0
            &&
            stockPreflight
              .unmatched
              .length === 0
          ),


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
      "OZON DAILY SYNC PREFLIGHT ERROR",
      error
    );


    return Response.json(
      {
        ok:
          false,

        mode:
          "preflight_28_days",

        writes_to_database:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),

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

  return runPreflight(
    request
  );

}


export async function POST(
  request: Request
) {

  return runPreflight(
    request
  );

}
