export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SALES_WINDOW_DAYS = 28;
const OZON_MAX_RETRIES = 5;
const RETRY_BASE_MS = 1500;
const MAX_FBO_POSTING_PAGES = 1000;
const MAX_PRODUCT_LIST_PAGES = 100;
const PRODUCT_INFO_BATCH_SIZE = 900;
const ANALYTICS_STOCK_BATCH_SIZE = 100;

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
};

type OzonProductInfoItem = {
  id?: number | string;
  offer_id?: string;
  sku?: number | string;
  name?: string;
};

type SkuResolution = {
  sku: string;
  ozonProductId: string | null;
  ozonOfferId: string | null;
  product: ProductRow | null;
  reason: string;
};

type AnalyticsStock = {
  sku?: number | string;
  offer_id?: string;
  warehouse_id?: number | string;
  warehouse_name?: string | null;
  cluster_id?: number | string;
  cluster_name?: string | null;
  available_stock_count?: number;
  [key: string]: unknown;
};

type SalesWriteRow = {
  product_id: string;
  cluster_id: string;
  cluster_name: string | null;
  sale_date: string;
  sales_quantity: number;
  cancelled_quantity: number;
  raw_payload: Record<string, unknown>;
};

type StockWriteRow = {
  product_id: string;
  cluster_id: string;
  cluster_name: string | null;
  quantity: number;
  raw_payload: Record<string, unknown>;
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

function key(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

function int(
  value: unknown
): number {
  const number =
    Number(
      value ?? 0
    );

  return Number.isFinite(
    number
  )
    ? Math.max(
        0,
        Math.trunc(
          number
        )
      )
    : 0;
}

function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

function chunks<T>(
  rows: T[],
  size: number
): T[][] {
  const result: T[][] = [];

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

function moscowDate(
  date = new Date()
): string {
  const parts =
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
    ).formatToParts(
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
  value?: string
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

  return moscowDate(
    date
  );
}

function config() {
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

function isAuthorized(
  request: Request
): boolean {
  return (
    request.headers.get(
      "authorization"
    )
    ===
    `Bearer ${config().cronSecret}`
  );
}

async function ozonPost<T>(
  path: string,
  body: unknown
): Promise<T> {
  const {
    ozonClientId,
    ozonApiKey,
  } =
    config();

  for (
    let attempt = 1;
    attempt <= OZON_MAX_RETRIES;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
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

      try {
        parsed =
          text
            ? JSON.parse(
                text
              )
            : null;
      } catch {
        parsed = {
          raw:
            text,
        };
      }

      if (
        response.status ===
          429
        &&
        attempt <
          OZON_MAX_RETRIES
      ) {
        const retryAfter =
          Number(
            response.headers.get(
              "retry-after"
            )
          );

        await sleep(
          Number.isFinite(
            retryAfter
          )
          &&
          retryAfter > 0
            ? Math.ceil(
                retryAfter
                *
                1000
              )
            : RETRY_BASE_MS
              *
              attempt
        );

        continue;
      }

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

      if (
        !response.ok
      ) {
        throw new Error(
          `Ozon API ${path}: HTTP ${response.status}: ${JSON.stringify(parsed)}`
        );
      }

      return parsed as T;

    } catch (
      error
    ) {
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

async function supabaseRpc<T>(
  functionName: string,
  body:
    Record<
      string,
      unknown
    >
): Promise<T> {
  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    config();

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

  if (
    !response.ok
  ) {
    throw new Error(
      `Supabase RPC ${functionName}: HTTP ${response.status}: ${text}`
    );
  }

  if (
    !text
  ) {
    throw new Error(
      `Supabase RPC ${functionName} вернул пустой ответ`
    );
  }

  return JSON.parse(
    text
  ) as T;
}

async function getProducts():
Promise<ProductRow[]> {
  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    config();

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

  if (
    !response.ok
  ) {
    throw new Error(
      `Supabase products: HTTP ${response.status}: ${text}`
    );
  }

  return JSON.parse(
    text
  ) as ProductRow[];
}

function productIndexes(
  products:
    ProductRow[]
) {
  const byOffer =
    new Map<
      string,
      ProductRow
    >();

  const byOzonId =
    new Map<
      string,
      ProductRow
    >();

  for (
    const product
    of products
  ) {
    const offerId =
      key(
        product.offer_id
      );

    const ozonProductId =
      key(
        product.ozon_product_id
      );

    if (
      offerId
    ) {
      byOffer.set(
        offerId,
        product
      );
    }

    if (
      ozonProductId
    ) {
      byOzonId.set(
        ozonProductId,
        product
      );
    }
  }

  return {
    byOffer,
    byOzonId,
  };
}

async function getClusters() {
  const response =
    await ozonPost<{
      clusters?:
        OzonCluster[];
    }>(
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
      key(
        cluster.id
      );

    const clusterName =
      key(
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
          key(
            warehouse.warehouse_id
          );

        if (
          !warehouseId
        ) {
          continue;
        }

        warehouseToCluster.set(
          warehouseId,
          {
            clusterId,

            clusterName,

            warehouseName:
              key(
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

async function getFboPostings(
  dateFrom: string,
  dateTo: string
) {
  const postings:
    FboPosting[] = [];

  let cursor =
    "";

  let requestsMade =
    0;

  for (
    let page = 1;
    page <=
      MAX_FBO_POSTING_PAGES;
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
              false,

            legal_info:
              false,
          },
        }
      );

    requestsMade +=
      1;

    postings.push(
      ...(
        response.postings
        ?? []
      )
    );

    if (
      !response.has_next
    ) {
      return {
        postings,
        requestsMade,
      };
    }

    const nextCursor =
      key(
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

async function getProductInfoBySkus(
  skus:
    string[]
) {
  const uniqueSkus =
    Array.from(
      new Set(
        skus
          .map(
            key
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
    of chunks(
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

function buildSkuResolutions(
  infoItems:
    OzonProductInfoItem[],

  products:
    ProductRow[]
) {
  const {
    byOffer,
    byOzonId,
  } =
    productIndexes(
      products
    );

  const result =
    new Map<
      string,
      SkuResolution
    >();

  for (
    const item
    of infoItems
  ) {
    const sku =
      key(
        item.sku
      );

    if (
      !sku
    ) {
      continue;
    }

    const ozonProductId =
      key(
        item.id
      );

    const ozonOfferId =
      key(
        item.offer_id
      );

    let product:
      ProductRow
      | undefined;

    let reason =
      "unresolved";

    if (
      ozonProductId
    ) {
      product =
        byOzonId.get(
          ozonProductId
        );

      if (
        product
      ) {
        reason =
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

      if (
        product
      ) {
        reason =
          "matched_by_returned_offer_id";
      }
    }

    result.set(
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

        reason,
      }
    );
  }

  return result;
}

function unresolvedSalesSkus(
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
    productIndexes(
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
        key(
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
        key(
          item.sku
        );

      if (
        sku
      ) {
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
    productIndexes(
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

    sales:
      number;

    cancelled:
      number;

    offers:
      Set<string>;

    skus:
      Set<string>;

    warehouses:
      Set<string>;
  };

  const aggregated =
    new Map<
      string,
      SalesAggregate
    >();

  const unmatched:
    Record<
      string,
      unknown
    >[] = [];

  const ignoredInactive:
    Record<
      string,
      unknown
    >[] = [];

  const ignoredOutOfRange:
    Record<
      string,
      unknown
    >[] = [];

  let matchedByOffer =
    0;

  let matchedBySku =
    0;

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
    ) {
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
              key(
                item.offer_id
              )
              || null,

            sku:
              key(
                item.sku
              )
              || null,

            quantity:
              int(
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
                key(
                  item.offer_id
                )
                || null,

              sku:
                key(
                  item.sku
                )
                || null,

              quantity:
                int(
                  item.quantity
                ),
            }
          );
        }
      }

      continue;
    }

    const warehouseId =
      key(
        posting.analytics_data
          ?.warehouse_id
      );

    const warehouseName =
      key(
        posting.analytics_data
          ?.warehouse_name
      );

    const cluster =
      warehouseId
        ? warehouseToCluster.get(
            warehouseId
          )
        : undefined;

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
      key(
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
      const offerId =
        key(
          item.offer_id
        );

      const sku =
        key(
          item.sku
        );

      const quantity =
        int(
          item.quantity
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

      if (
        !product
      ) {
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

              offer_id:
                offerId
                || null,

              sku:
                sku
                || null,

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
        `${saleDate}::${product.id}::${clusterId}`;

      let current =
        aggregated.get(
          aggregateKey
        );

      if (
        !current
      ) {
        current = {
          saleDate,

          product,

          clusterId,

          clusterName,

          sales:
            0,

          cancelled:
            0,

          offers:
            new Set<string>(),

          skus:
            new Set<string>(),

          warehouses:
            new Set<string>(),
        };

        aggregated.set(
          aggregateKey,
          current
        );
      }

      if (
        offerId
      ) {
        current.offers.add(
          offerId
        );
      }

      if (
        sku
      ) {
        current.skus.add(
          sku
        );
      }

      if (
        warehouseId
      ) {
        current.warehouses.add(
          warehouseId
        );
      }

      if (
        isCancelled
      ) {
        current.cancelled +=
          quantity;
      } else {
        current.sales +=
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
            current.sales,

          cancelled_quantity:
            current.cancelled,

          raw_payload: {
            source:
              "v3/posting/fbo/list",

            master_code:
              current.product.master_code,

            source_offer_ids:
              Array.from(
                current.offers
              ),

            ozon_skus:
              Array.from(
                current.skus
              ),

            warehouse_ids:
              Array.from(
                current.warehouses
              ),
          },
        })
      );

  rows.sort(
    (
      left,
      right
    ) =>
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
        ([
          sale_date,
          values,
        ]) => ({
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
    perDay,
    matchedByOffer,
    matchedBySku,
  };
}

async function getOzonProductCatalog() {
  const items:
    Array<{
      product_id?:
        number
        | string;

      offer_id?:
        string;
    }> = [];

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
    page <=
      MAX_PRODUCT_LIST_PAGES;
    page += 1
  ) {
    const response =
      await ozonPost<{
        result?: {
          items?:
            Array<{
              product_id?:
                number
                | string;

              offer_id?:
                string;
            }>;

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
      key(
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

function extractStockRows(
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
): AnalyticsStock[] {
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
            key
          )
          .filter(
            Boolean
          )
      )
    );

  const stocks:
    AnalyticsStock[] =
    [];

  let requestsMade =
    0;

  const batches =
    chunks(
      uniqueSkus,
      ANALYTICS_STOCK_BATCH_SIZE
    );

  for (
    const batch
    of batches
  ) {
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
      ...extractStockRows(
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

function unresolvedStockSkus(
  stocks:
    AnalyticsStock[],

  products:
    ProductRow[]
) {
  const {
    byOffer,
  } =
    productIndexes(
      products
    );

  const result =
    new Set<string>();

  for (
    const stock
    of stocks
  ) {
    const offerId =
      key(
        stock.offer_id
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
      key(
        stock.sku
      );

    if (
      sku
    ) {
      result.add(
        sku
      );
    }
  }

  return Array.from(
    result
  );
}

function buildStockData(
  stocks:
    AnalyticsStock[],

  products:
    ProductRow[],

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
  const {
    byOffer,
  } =
    productIndexes(
      products
    );

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
      key(
        cluster.id
      );

    const clusterName =
      key(
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

  const ignoredUnknown:
    Record<
      string,
      unknown
    >[] = [];

  const ignoredInactive:
    Record<
      string,
      unknown
    >[] = [];

  let ignoredUnknownCount =
    0;

  let ignoredInactiveCount =
    0;

  let totalAvailable =
    0;

  for (
    const stock
    of stocks
  ) {
    const offerId =
      key(
        stock.offer_id
      );

    const sku =
      key(
        stock.sku
      );

    const warehouseId =
      key(
        stock.warehouse_id
      );

    const warehouseName =
      key(
        stock.warehouse_name
      );

    const analyticsClusterId =
      key(
        stock.cluster_id
      );

    const analyticsClusterName =
      key(
        stock.cluster_name
      );

    const available =
      int(
        stock.available_stock_count
      );

    let product =
      offerId
        ? byOffer.get(
            offerId
          )
        : undefined;

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
    }

    if (
      !product
    ) {
      ignoredUnknownCount +=
        1;

      if (
        ignoredUnknown.length <
        100
      ) {
        ignoredUnknown.push(
          {
            offer_id:
              offerId
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

            cluster_name:
              analyticsClusterName
              || null,

            available_stock_count:
              available,
          }
        );
      }

      continue;
    }

    if (
      !product.is_active
    ) {
      ignoredInactiveCount +=
        1;

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

            master_code:
              product.master_code,

            available_stock_count:
              available,
          }
        );
      }

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
      `${product.id}::${clusterId}`;

    let current =
      aggregated.get(
        aggregateKey
      );

    if (
      !current
    ) {
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
          offerId
          ||
          product.offer_id
          ||
          null,

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
    ) =>
      left.product_id.localeCompare(
        right.product_id
      )
      ||
      left.cluster_id.localeCompare(
        right.cluster_id
      )
  );

  return {
    rows,
    totalAvailable,
    ignoredUnknown,
    ignoredUnknownCount,
    ignoredInactive,
    ignoredInactiveCount,
  };
}

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

    const todayMoscow =
      moscowDate();

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
          !key(
            product.master_code
          )
      );

    if (
      activeWithoutMasterCode.length
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
            activeWithoutMasterCode.slice(
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

    const clusterResult =
      await getClusters();

    if (
      !clusterResult.clusters.length
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

    const salesResult =
      await getFboPostings(
        salesDateFrom,
        salesDateTo
      );

    if (
      !salesResult.postings.length
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

    const salesFallbackSkus =
      unresolvedSalesSkus(
        salesResult.postings,
        products,
        salesDateFrom,
        salesDateTo
      );

    const salesProductInfo =
      salesFallbackSkus.length

        ? await getProductInfoBySkus(
            salesFallbackSkus
          )

        : {
            requestedSkus:
              0,

            requestsMade:
              0,

            items:
              [] as OzonProductInfoItem[],
          };

    const salesSkuResolutions =
      buildSkuResolutions(
        salesProductInfo.items,
        products
      );

    const salesData =
      buildSalesData(
        salesResult.postings,
        products,
        salesSkuResolutions,
        clusterResult
          .warehouseToCluster,
        salesDateFrom,
        salesDateTo
      );

    if (
      salesData.unmatched.length
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
        },
        {
          status:
            409,
        }
      );
    }

    // ========================================================
    // ОСТАТКИ.
    //
    // Повторяем рабочую схему Excel-макроса:
    //
    // /v3/product/list
    //        ↓
    // product_id
    //        ↓
    // /v1/analytics/stocks
    //        ↓
    // available_stock_count
    //
    // Никакого present - reserved.
    // ========================================================

    const ozonCatalog =
      await getOzonProductCatalog();

    const stockQueryIds =
      Array.from(
        new Set(
          ozonCatalog
            .items
            .map(
              item =>
                key(
                  item.product_id
                )
            )
            .filter(
              Boolean
            )
        )
      );

    if (
      !stockQueryIds.length
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
            "Ozon /v3/product/list не вернул product_id для запроса остатков. Запись отменена.",
        },
        {
          status:
            409,
        }
      );
    }

    const stockResult =
      await getAnalyticsStocks(
        stockQueryIds
      );

    if (
      !stockResult.stocks.length
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

    const stockFallbackSkus =
      unresolvedStockSkus(
        stockResult.stocks,
        products
      );

    const stockProductInfo =
      stockFallbackSkus.length

        ? await getProductInfoBySkus(
            stockFallbackSkus
          )

        : {
            requestedSkus:
              0,

            requestsMade:
              0,

            items:
              [] as OzonProductInfoItem[],
          };

    const stockSkuResolutions =
      buildSkuResolutions(
        stockProductInfo.items,
        products
      );

    const stockData =
      buildStockData(
        stockResult.stocks,
        products,
        stockSkuResolutions,
        clusterResult.clusters,
        clusterResult
          .warehouseToCluster
      );

    const postingsInWindow =
      salesResult.postings
        .filter(
          posting => {
            const date =
              isoToMoscowDate(
                posting.created_at
              );

            return Boolean(
              date
              &&
              date >=
                salesDateFrom
              &&
              date <=
                salesDateTo
            );
          }
        );

    const cancelledPostings =
      postingsInWindow
        .filter(
          posting =>
            key(
              posting.status
            )
              .toLowerCase()
            ===
            "cancelled"
        )
        .length;

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
      writeResult.sales_rows_saved
      !==
      salesData.rows.length
    ) {
      throw new Error(
        `Количество записанных строк продаж не совпало: ожидали ${salesData.rows.length}, получили ${writeResult.sales_rows_saved}`
      );
    }

    if (
      writeResult.stock_rows_saved
      !==
      stockData.rows.length
    ) {
      throw new Error(
        `Количество записанных строк остатков не совпало: ожидали ${stockData.rows.length}, получили ${writeResult.stock_rows_saved}`
      );
    }

    writeSucceeded =
      true;

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
        },

        sales_fbo: {
          ozon_requests:
            salesResult.requestsMade,

          postings_total_returned_by_ozon:
            salesResult.postings.length,

          postings_in_window:
            postingsInWindow.length,

          postings_cancelled:
            cancelledPostings,

          rows_sent_to_database:
            salesData.rows.length,

          matched_by_offer_id:
            salesData.matchedByOffer,

          matched_by_sku_fallback:
            salesData.matchedBySku,

          ignored_inactive_sample:
            salesData.ignoredInactive,

          ignored_out_of_range_sample:
            salesData.ignoredOutOfRange,

          per_day:
            salesData.perDay,
        },

        stocks_fbo: {
          method:
            "/v1/analytics/stocks",

          catalog_method:
            "/v3/product/list",

          catalog_requests:
            ozonCatalog.requestsMade,

          catalog_items_received:
            ozonCatalog.items.length,

          catalog_total_declared:
            ozonCatalog.declaredTotal,

          requested_skus:
            stockResult.requestedSkus,

          batches:
            stockResult.batches,

          ozon_requests:
            stockResult.requestsMade,

          raw_rows_received:
            stockResult.stocks.length,

          fallback_skus_requested:
            stockProductInfo.requestedSkus,

          fallback_product_info_requests:
            stockProductInfo.requestsMade,

          rows_sent_to_database:
            stockData.rows.length,

          ignored_unknown_rows:
            stockData.ignoredUnknownCount,

          ignored_unknown_sample:
            stockData.ignoredUnknown,

          ignored_inactive_rows:
            stockData.ignoredInactiveCount,

          ignored_inactive_sample:
            stockData.ignoredInactive,

          totals: {
            available_stock_count:
              stockData.totalAvailable,
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

  } catch (
    error
  ) {
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
