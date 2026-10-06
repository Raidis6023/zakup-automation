export const runtime = "nodejs";
export const dynamic = "force-dynamic";


// ============================================================
// ТИПЫ
// ============================================================

type ProductRow = {
  id: string;
  offer_id: string;
  ozon_product_id: number | string | null;
  name: string | null;
};


type OzonClusterWarehouse = {
  warehouse_id?: number | string;
  name?: string;
};


type OzonLogisticCluster = {
  warehouses?: OzonClusterWarehouse[];
};


type OzonCluster = {
  id?: number | string;
  name?: string;
  logistic_clusters?: OzonLogisticCluster[];
};


type OzonClusterResponse = {
  clusters?: OzonCluster[];
};


type FboPostingProduct = {
  sku?: number | string;
  offer_id?: string;
  name?: string;
  quantity?: number;
};


type FboPostingAnalytics = {
  warehouse_id?: number | string;
  warehouse_name?: string;
};


type FboPosting = {
  posting_number?: string;
  order_number?: string;
  status?: string;
  created_at?: string;
  products?: FboPostingProduct[];
  analytics_data?: FboPostingAnalytics | null;
};


type FboPostingResponse = {
  postings?: FboPosting[];
  cursor?: string;
  has_next?: boolean;
};


type OzonStockItem = {
  sku?: number | string;

  name?: string;

  warehouse_id?: number | string;
  warehouse_name?: string;

  cluster_id?: number | string;
  cluster_name?: string;

  available_stock_count?: number;

  [key: string]: unknown;
};


type OzonStocksResponse = {
  items?: OzonStockItem[];

  [key: string]: unknown;
};


type SalesPreviewRow = {
  product_id: string;

  offer_id: string;

  ozon_sku: string;

  cluster_id: string;

  cluster_name: string;

  warehouse_id: string | null;

  warehouse_name: string | null;

  sales_quantity: number;

  cancelled_quantity: number;
};


type UnmatchedPostingProduct = {
  posting_number: string | null;

  status: string | null;

  offer_id: string | null;

  sku: string | null;

  quantity: number;

  warehouse_id: string | null;

  warehouse_name: string | null;
};


// ============================================================
// ENV
// ============================================================

function getConfig() {

  const ozonClientId =
    process.env.OZON_CLIENT_ID;


  const ozonApiKey =
    process.env.OZON_API_KEY;


  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;


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


  return {
    ozonClientId,
    ozonApiKey,
    supabaseUrl,
    supabaseSecretKey,
  };
}


// ============================================================
// OZON REQUEST
// ============================================================

async function ozonPost<T>(
  path: string,
  body: unknown
): Promise<T> {

  const {
    ozonClientId,
    ozonApiKey,
  } =
    getConfig();


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


    let json:
      unknown = null;


    if (text) {

      try {

        json =
          JSON.parse(
            text
          );

      } catch {

        json = {
          raw:
            text,
        };

      }

    }


    if (!response.ok) {

      throw new Error(
        [
          `Ozon API ${path}`,
          `HTTP ${response.status}`,
          JSON.stringify(json),
        ].join(": ")
      );

    }


    return json as T;

  } finally {

    clearTimeout(
      timeout
    );

  }
}


// ============================================================
// SUPABASE PRODUCTS
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
    ].join(",")
  );


  url.searchParams.set(
    "is_active",
    "eq.true"
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
      `Не удалось получить products: ${response.status} ${text}`
    );

  }


  const rows =
    JSON.parse(
      text
    ) as ProductRow[];


  return rows;
}


// ============================================================
// ДАТА ВЧЕРА ПО МОСКВЕ
// ============================================================

function getYesterdayMoscowDate():
string {

  const now =
    new Date();


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
      now
    );


  const year =
    Number(
      parts.find(
        (part) =>
          part.type ===
          "year"
      )?.value
    );


  const month =
    Number(
      parts.find(
        (part) =>
          part.type ===
          "month"
      )?.value
    );


  const day =
    Number(
      parts.find(
        (part) =>
          part.type ===
          "day"
      )?.value
    );


  const utcDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );


  utcDate.setUTCDate(
    utcDate.getUTCDate()
    - 1
  );


  return utcDate
    .toISOString()
    .slice(
      0,
      10
    );
}


// ============================================================
// КЛАСТЕРЫ OZON
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


  const warehouseToCluster =
    new Map<
      string,
      {
        clusterId: string;
        clusterName: string;
        warehouseName: string;
      }
    >();


  const clusters =
    response.clusters
    ?? [];


  for (
    const cluster
    of clusters
  ) {

    const clusterId =
      String(
        cluster.id
        ?? ""
      );


    const clusterName =
      String(
        cluster.name
        ?? ""
      );


    for (
      const logisticCluster
      of cluster
        .logistic_clusters
        ?? []
    ) {

      for (
        const warehouse
        of logisticCluster
          .warehouses
          ?? []
      ) {

        if (
          warehouse
            .warehouse_id
          == null
        ) {

          continue;

        }


        warehouseToCluster.set(
          String(
            warehouse
              .warehouse_id
          ),
          {
            clusterId,

            clusterName,

            warehouseName:
              String(
                warehouse.name
                ?? ""
              ),
          }
        );

      }

    }

  }


  return {
    response,
    clusters,
    warehouseToCluster,
  };
}


// ============================================================
// FBO POSTINGS ЗА СУТКИ
// ============================================================

async function getFboPostingsForDay(
  date: string
):
Promise<FboPosting[]> {

  const since =
    `${date}T00:00:00+03:00`;


  const to =
    `${date}T23:59:59+03:00`;


  const allPostings:
    FboPosting[] = [];


  let cursor =
    "";


  let page =
    0;


  while (true) {

    page +=
      1;


    if (
      page > 100
    ) {

      throw new Error(
        "Превышен защитный лимит пагинации FBO"
      );

    }


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


    const postings =
      response.postings
      ?? [];


    allPostings.push(
      ...postings
    );


    if (
      !response.has_next
    ) {

      break;

    }


    const nextCursor =
      String(
        response.cursor
        ?? ""
      );


    if (
      !nextCursor
      ||
      nextCursor ===
        cursor
    ) {

      throw new Error(
        "Ozon сообщил о следующей странице FBO, но не вернул новый cursor"
      );

    }


    cursor =
      nextCursor;

  }


  return allPostings;
}


// ============================================================
// CHUNK
// ============================================================

function chunkArray<T>(
  rows: T[],
  size: number
):
T[][] {

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
// ОСТАТКИ OZON
// ============================================================

async function getOzonStocks(
  skus: string[]
) {

  const uniqueSkus =
    Array.from(
      new Set(
        skus.filter(
          Boolean
        )
      )
    );


  const batches =
    chunkArray(
      uniqueSkus,
      100
    );


  const allItems:
    OzonStockItem[] = [];


  const rawResponses:
    OzonStocksResponse[] = [];


  for (
    const batch
    of batches
  ) {

    const response =
      await ozonPost<
        OzonStocksResponse
      >(
        "/v1/analytics/stocks",
        {
          skus:
            batch,
        }
      );


    rawResponses.push(
      response
    );


    const items =
      response.items
      ?? [];


    allItems.push(
      ...items
    );

  }


  return {
    batches:
      batches.length,

    items:
      allItems,

    rawResponses,
  };
}


// ============================================================
// АГРЕГАЦИЯ ПРОДАЖ ДЛЯ PREVIEW
// ============================================================

function buildSalesPreview(
  postings: FboPosting[],
  products: ProductRow[],
  warehouseToCluster:
    Map<
      string,
      {
        clusterId: string;
        clusterName: string;
        warehouseName: string;
      }
    >
) {

  const productByOffer =
    new Map<
      string,
      ProductRow
    >();


  const productByOzonSku =
    new Map<
      string,
      ProductRow
    >();


  for (
    const product
    of products
  ) {

    productByOffer.set(
      product.offer_id,
      product
    );


    if (
      product
        .ozon_product_id
      != null
    ) {

      productByOzonSku.set(
        String(
          product
            .ozon_product_id
        ),
        product
      );

    }

  }


  const aggregated =
    new Map<
      string,
      SalesPreviewRow
    >();


  const unmatched:
    UnmatchedPostingProduct[] =
    [];


  for (
    const posting
    of postings
  ) {

    const status =
      String(
        posting.status
        ?? ""
      );


    const isCancelled =
      status.toLowerCase()
      ===
      "cancelled";


    const warehouseId =
      posting
        .analytics_data
        ?.warehouse_id
      != null

        ? String(
            posting
              .analytics_data
              ?.warehouse_id
          )

        : null;


    const warehouseName =
      posting
        .analytics_data
        ?.warehouse_name
      ?? null;


    const cluster =
      warehouseId

        ? warehouseToCluster
            .get(
              warehouseId
            )

        : undefined;


    const clusterId =
      cluster
        ?.clusterId
      ?? (
        warehouseId
          ? `warehouse:${warehouseId}`
          : "unknown"
      );


    const clusterName =
      cluster
        ?.clusterName
      ?? warehouseName
      ?? "Не определён";


    for (
      const item
      of posting.products
      ?? []
    ) {

      const offerId =
        String(
          item.offer_id
          ?? ""
        );


      const sku =
        String(
          item.sku
          ?? ""
        );


      const quantity =
        Math.max(
          0,
          Number(
            item.quantity
            ?? 0
          )
        );


      const product =
        (
          offerId
            ? productByOffer
                .get(
                  offerId
                )
            : undefined
        )
        ??
        (
          sku
            ? productByOzonSku
                .get(
                  sku
                )
            : undefined
        );


      if (!product) {

        unmatched.push(
          {
            posting_number:
              posting
                .posting_number
              ?? null,

            status:
              posting.status
              ?? null,

            offer_id:
              offerId
              || null,

            sku:
              sku
              || null,

            quantity,

            warehouse_id:
              warehouseId,

            warehouse_name:
              warehouseName,
          }
        );


        continue;

      }


      const key =
        [
          product.id,
          clusterId,
        ].join(
          "::"
        );


      const current =
        aggregated.get(
          key
        )
        ?? {
          product_id:
            product.id,

          offer_id:
            product.offer_id,

          ozon_sku:
            sku,

          cluster_id:
            clusterId,

          cluster_name:
            clusterName,

          warehouse_id:
            warehouseId,

          warehouse_name:
            warehouseName,

          sales_quantity:
            0,

          cancelled_quantity:
            0,
        };


      if (
        isCancelled
      ) {

        current
          .cancelled_quantity +=
          quantity;

      } else {

        current
          .sales_quantity +=
          quantity;

      }


      aggregated.set(
        key,
        current
      );

    }

  }


  const rows =
    Array.from(
      aggregated.values()
    );


  rows.sort(
    (
      left,
      right
    ) => {

      if (
        left.cluster_name
        !==
        right.cluster_name
      ) {

        return left
          .cluster_name
          .localeCompare(
            right.cluster_name,
            "ru"
          );

      }


      return left
        .offer_id
        .localeCompare(
          right.offer_id,
          "ru"
        );

    }
  );


  return {
    rows,
    unmatched,
  };
}


// ============================================================
// GET
// ============================================================

export async function GET() {

  try {

    const date =
      getYesterdayMoscowDate();


    const products =
      await getProducts();


    const productsWithOzonId =
      products.filter(
        (product) =>
          product
            .ozon_product_id
          != null
      );


    const productsWithoutOzonId =
      products.filter(
        (product) =>
          product
            .ozon_product_id
          == null
      );


    // ========================================================
    // 1. КЛАСТЕРЫ
    // ========================================================

    const clusterResult =
      await getOzonClusters();


    // ========================================================
    // 2. ПРОДАЖИ FBO ЗА ВЧЕРА
    // ========================================================

    const postings =
      await getFboPostingsForDay(
        date
      );


    const salesPreview =
      buildSalesPreview(
        postings,
        products,
        clusterResult
          .warehouseToCluster
      );


    // ========================================================
    // 3. ОСТАТКИ OZON
    // ========================================================

    const skus =
      productsWithOzonId.map(
        (product) =>
          String(
            product
              .ozon_product_id
          )
      );


    const stocks =
      await getOzonStocks(
        skus
      );


    // ========================================================
    // 4. СТАТИСТИКА POSTINGS
    // ========================================================

    const cancelledPostings =
      postings.filter(
        (posting) =>
          String(
            posting.status
            ?? ""
          ).toLowerCase()
          ===
          "cancelled"
      );


    const activePostings =
      postings.filter(
        (posting) =>
          String(
            posting.status
            ?? ""
          ).toLowerCase()
          !==
          "cancelled"
      );


    // ========================================================
    // 5. RESPONSE
    // ========================================================

    return Response.json(
      {
        ok:
          true,

        mode:
          "read_only_probe",

        writes_to_database:
          false,


        date_moscow:
          date,


        products: {
          total_active:
            products.length,

          with_ozon_product_id:
            productsWithOzonId
              .length,

          without_ozon_product_id:
            productsWithoutOzonId
              .length,

          without_ozon_product_id_sample:
            productsWithoutOzonId
              .slice(
                0,
                20
              )
              .map(
                (product) => ({
                  id:
                    product.id,

                  offer_id:
                    product.offer_id,

                  name:
                    product.name,
                })
              ),
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

          sample:
            clusterResult
              .clusters
              .slice(
                0,
                10
              )
              .map(
                (cluster) => ({
                  id:
                    cluster.id,

                  name:
                    cluster.name,

                  warehouses:
                    (
                      cluster
                        .logistic_clusters
                      ?? []
                    )
                    .flatMap(
                      (
                        logisticCluster
                      ) =>
                        logisticCluster
                          .warehouses
                        ?? []
                    )
                    .slice(
                      0,
                      10
                    ),
                })
              ),
        },


        sales_fbo: {
          postings_total:
            postings.length,

          postings_not_cancelled:
            activePostings.length,

          postings_cancelled:
            cancelledPostings.length,

          aggregated_rows:
            salesPreview
              .rows
              .length,

          unmatched_products:
            salesPreview
              .unmatched
              .length,

          rows_sample:
            salesPreview
              .rows
              .slice(
                0,
                50
              ),

          unmatched_sample:
            salesPreview
              .unmatched
              .slice(
                0,
                50
              ),

          postings_sample:
            postings
              .slice(
                0,
                10
              )
              .map(
                (posting) => ({
                  posting_number:
                    posting
                      .posting_number,

                  status:
                    posting.status,

                  created_at:
                    posting
                      .created_at,

                  warehouse_id:
                    posting
                      .analytics_data
                      ?.warehouse_id,

                  warehouse_name:
                    posting
                      .analytics_data
                      ?.warehouse_name,

                  products:
                    posting.products,
                })
              ),
        },


        stocks_fbo: {
          requested_skus:
            skus.length,

          request_batches:
            stocks.batches,

          items_received:
            stocks
              .items
              .length,

          items_sample:
            stocks
              .items
              .slice(
                0,
                50
              ),
        },
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "OZON DAILY PROBE ERROR",
      error
    );


    return Response.json(
      {
        ok:
          false,

        mode:
          "read_only_probe",

        writes_to_database:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status:
          500,
      }
    );

  }
}
