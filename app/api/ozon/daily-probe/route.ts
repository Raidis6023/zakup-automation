export const runtime = "nodejs";
export const dynamic = "force-dynamic";


// ============================================================
// НАСТРОЙКИ
// ============================================================

const OZON_MAX_RETRIES =
  4;


const RETRY_BASE_MS =
  1500;


const MAX_FBO_POSTING_PAGES =
  500;


const MAX_STOCK_PAGES =
  100;


// ============================================================
// ТИПЫ
// ============================================================

type ProductRow = {
  id: string;

  offer_id: string;

  ozon_product_id:
    number
    | string
    | null;

  name:
    string
    | null;
};


type OzonClusterWarehouse = {
  warehouse_id?:
    number
    | string;

  name?:
    string;
};


type OzonLogisticCluster = {
  warehouses?:
    OzonClusterWarehouse[];
};


type OzonCluster = {
  id?:
    number
    | string;

  name?:
    string;

  logistic_clusters?:
    OzonLogisticCluster[];
};


type OzonClusterResponse = {
  clusters?:
    OzonCluster[];
};


type FboPostingProduct = {
  sku?:
    number
    | string;

  offer_id?:
    string;

  name?:
    string;

  quantity?:
    number;
};


type FboPostingAnalytics = {
  warehouse_id?:
    number
    | string;

  warehouse_name?:
    string;
};


type FboPosting = {
  posting_number?:
    string;

  order_number?:
    string;

  status?:
    string;

  created_at?:
    string;

  products?:
    FboPostingProduct[];

  analytics_data?:
    FboPostingAnalytics
    | null;
};


type FboPostingResponse = {
  postings?:
    FboPosting[];

  cursor?:
    string;

  has_next?:
    boolean;
};


type FboWarehouseStock = {
  sku?:
    number
    | string;

  offer_id?:
    string;

  product_id?:
    number
    | string;

  warehouse_id?:
    number
    | string;

  warehouse_name?:
    string;

  present?:
    number;

  reserved?:
    number;

  [key: string]:
    unknown;
};


type FboWarehouseStocksResponse = {
  products?:
    FboWarehouseStock[];

  cursor?:
    string;

  has_next?:
    boolean;

  result?: {
    products?:
      FboWarehouseStock[];

    cursor?:
      string;

    has_next?:
      boolean;
  };

  [key: string]:
    unknown;
};


type SalesPreviewRow = {
  product_id:
    string;

  offer_id:
    string;

  ozon_sku:
    string;

  cluster_id:
    string;

  cluster_name:
    string;

  warehouse_id:
    string | null;

  warehouse_name:
    string | null;

  sales_quantity:
    number;

  cancelled_quantity:
    number;
};


type StockPreviewRow = {
  product_id:
    string;

  offer_id:
    string;

  ozon_product_id:
    string | null;

  ozon_sku:
    string | null;

  warehouse_id:
    string;

  warehouse_name:
    string;

  cluster_id:
    string;

  cluster_name:
    string;

  present:
    number;

  reserved:
    number;

  available:
    number;
};


type UnmatchedPostingProduct = {
  posting_number:
    string | null;

  status:
    string | null;

  offer_id:
    string | null;

  sku:
    string | null;

  quantity:
    number;

  warehouse_id:
    string | null;

  warehouse_name:
    string | null;
};


type UnmatchedStock = {
  offer_id:
    string | null;

  product_id:
    string | null;

  sku:
    string | null;

  warehouse_id:
    string | null;

  warehouse_name:
    string | null;

  present:
    number;

  reserved:
    number;
};


// ============================================================
// ОБЫЧНАЯ ПАУЗА
// ============================================================

function sleep(
  milliseconds: number
) {

  return new Promise<void>(
    (
      resolve
    ) => {

      setTimeout(
        resolve,
        milliseconds
      );

    }
  );
}


// ============================================================
// ENV
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
// RETRY DELAY
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
        seconds
        *
        1000
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


      // ======================================================
      // 429
      // ======================================================

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


        const waitMs =
          getRetryDelayMs(
            response,
            attempt
          );


        console.warn(
          [
            "OZON 429",
            path,
            `попытка ${attempt}`,
            `пауза ${waitMs} мс`,
          ].join(
            " | "
          )
        );


        await sleep(
          waitMs
        );


        continue;

      }


      // ======================================================
      // ВРЕМЕННАЯ 5XX
      // ======================================================

      if (
        response.status >= 500
        &&
        response.status <= 599
      ) {

        if (
          attempt <
          OZON_MAX_RETRIES
        ) {

          const waitMs =
            RETRY_BASE_MS
            *
            attempt;


          console.warn(
            [
              "OZON 5XX",
              path,
              `HTTP ${response.status}`,
              `попытка ${attempt}`,
              `пауза ${waitMs} мс`,
            ].join(
              " | "
            )
          );


          await sleep(
            waitMs
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
        error instanceof Error
        &&
        error.name ===
          "AbortError"
      ) {

        if (
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


        throw new Error(
          `Ozon API ${path}: превышено время ожидания`
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
    `Ozon API ${path}: все попытки завершились ошибкой`
  );
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
    ].join(
      ","
    )
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


  return JSON.parse(
    text
  ) as ProductRow[];
}


// ============================================================
// ВЧЕРАШНИЙ ДЕНЬ ПО МОСКВЕ
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
        (
          part
        ) =>
          part.type ===
          "year"
      )?.value
    );


  const month =
    Number(
      parts.find(
        (
          part
        ) =>
          part.type ===
          "month"
      )?.value
    );


  const day =
    Number(
      parts.find(
        (
          part
        ) =>
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
    -
    1
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


  const clusters =
    response.clusters
    ?? [];


  const warehouseToCluster =
    new Map<
      string,
      {
        clusterId:
          string;

        clusterName:
          string;

        warehouseName:
          string;
      }
    >();


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
    clusters,
    warehouseToCluster,
  };
}


// ============================================================
// ПРОДАЖИ FBO ЗА ОДИН ДЕНЬ
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


    const postings =
      response.postings
      ?? [];


    allPostings.push(
      ...postings
    );


    if (
      !response.has_next
    ) {

      return allPostings;

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
        "Ozon вернул has_next=true, но не вернул новый cursor"
      );

    }


    cursor =
      nextCursor;

  }


  throw new Error(
    "Превышен защитный лимит страниц FBO"
  );
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
// НОВЫЙ МЕТОД:
// FBO ОСТАТКИ ПО СКЛАДАМ
//
// Используем offer_id из нашей базы.
// Никакой путаницы product_id / SKU.
// ============================================================

async function getFboWarehouseStocks(
  offerIds: string[]
) {

  const uniqueOfferIds =
    Array.from(
      new Set(
        offerIds
          .map(
            (
              value
            ) =>
              value.trim()
          )
          .filter(
            Boolean
          )
      )
    );


  // Ozon допускает до 1000.
  // Берём 900 с запасом.
  const batches =
    chunkArray(
      uniqueOfferIds,
      900
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


      // Некоторые версии ответа могут иметь
      // products на верхнем уровне,
      // некоторые клиенты допускают result.products.
      const products =
        response.products
        ??
        response.result
          ?.products
        ??
        [];


      allStocks.push(
        ...products
      );


      const nextCursor =
        String(
          response.cursor
          ??
          response.result
            ?.cursor
          ??
          ""
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
        nextCursor ===
        cursor
      ) {

        throw new Error(
          "Ozon вернул тот же cursor для FBO-остатков"
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
// АГРЕГАЦИЯ ПРОДАЖ
// ============================================================

function buildSalesPreview(
  postings:
    FboPosting[],

  products:
    ProductRow[],

  warehouseToCluster:
    Map<
      string,
      {
        clusterId:
          string;

        clusterName:
          string;

        warehouseName:
          string;
      }
    >
) {

  const productByOffer =
    new Map<
      string,
      ProductRow
    >();


  const productByOzonProductId =
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
      product.ozon_product_id
      != null
    ) {

      productByOzonProductId.set(
        String(
          product.ozon_product_id
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
      status
        .toLowerCase()
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

        ? warehouseToCluster.get(
            warehouseId
          )

        : undefined;


    const clusterId =
      cluster?.clusterId
      ??
      (
        warehouseId
          ? `warehouse:${warehouseId}`
          : "unknown"
      );


    const clusterName =
      cluster?.clusterName
      ??
      warehouseName
      ??
      "Не определён";


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


      // Для продаж сначала связываем по нашему offer_id.
      // SKU оставляем как данные Ozon.
      const product =
        offerId

          ? productByOffer.get(
              offerId
            )

          : undefined;


      if (!product) {

        unmatched.push(
          {
            posting_number:
              posting.posting_number
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


  return {
    rows:
      Array.from(
        aggregated.values()
      ),

    unmatched,
  };
}


// ============================================================
// НОРМАЛИЗАЦИЯ ОСТАТКОВ
// ============================================================

function buildStockPreview(
  stocks:
    FboWarehouseStock[],

  products:
    ProductRow[],

  warehouseToCluster:
    Map<
      string,
      {
        clusterId:
          string;

        clusterName:
          string;

        warehouseName:
          string;
      }
    >
) {

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

    productByOffer.set(
      product.offer_id,
      product
    );


    if (
      product.ozon_product_id
      != null
    ) {

      productByOzonId.set(
        String(
          product.ozon_product_id
        ),
        product
      );

    }

  }


  const rows:
    StockPreviewRow[] =
    [];


  const unmatched:
    UnmatchedStock[] =
    [];


  for (
    const stock
    of stocks
  ) {

    const offerId =
      String(
        stock.offer_id
        ?? ""
      );


    const ozonProductId =
      stock.product_id
      != null

        ? String(
            stock.product_id
          )

        : null;


    const sku =
      stock.sku
      != null

        ? String(
            stock.sku
          )

        : null;


    const warehouseId =
      stock.warehouse_id
      != null

        ? String(
            stock.warehouse_id
          )

        : "";


    const warehouseName =
      String(
        stock.warehouse_name
        ?? ""
      );


    const present =
      Math.max(
        0,
        Number(
          stock.present
          ?? 0
        )
      );


    const reserved =
      Math.max(
        0,
        Number(
          stock.reserved
          ?? 0
        )
      );


    const product =
      (
        offerId
          ? productByOffer.get(
              offerId
            )
          : undefined
      )
      ??
      (
        ozonProductId
          ? productByOzonId.get(
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

          product_id:
            ozonProductId,

          sku,

          warehouse_id:
            warehouseId
            || null,

          warehouse_name:
            warehouseName
            || null,

          present,

          reserved,
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


    rows.push(
      {
        product_id:
          product.id,

        offer_id:
          product.offer_id,

        ozon_product_id:
          product.ozon_product_id
          != null

            ? String(
                product.ozon_product_id
              )

            : null,

        ozon_sku:
          sku,

        warehouse_id:
          warehouseId,

        warehouse_name:
          warehouseName
          ||
          cluster?.warehouseName
          ||
          "Не определён",

        cluster_id:
          cluster?.clusterId
          ??
          (
            warehouseId
              ? `warehouse:${warehouseId}`
              : "unknown"
          ),

        cluster_name:
          cluster?.clusterName
          ??
          "Не определён",

        present,

        reserved,

        // Пока просто показываем.
        // В БД ещё НЕ записываем.
        available:
          Math.max(
            present
            -
            reserved,
            0
          ),
      }
    );

  }


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


    // ========================================================
    // 1. НАШИ ТОВАРЫ
    // ========================================================

    const products =
      await getProducts();


    const offerIds =
      products
        .map(
          (
            product
          ) =>
            product.offer_id
        )
        .filter(
          Boolean
        );


    // ========================================================
    // 2. КЛАСТЕРЫ OZON
    // ========================================================

    const clusterResult =
      await getOzonClusters();


    // ========================================================
    // 3. ПРОДАЖИ FBO ЗА ВЧЕРА
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
    // 4. ОСТАТКИ FBO ПО СКЛАДАМ
    //
    // БОЛЬШЕ НЕ ИСПОЛЬЗУЕМ /v1/analytics/stocks.
    // ========================================================

    const stockResult =
      await getFboWarehouseStocks(
        offerIds
      );


    const stockPreview =
      buildStockPreview(
        stockResult.stocks,
        products,
        clusterResult
          .warehouseToCluster
      );


    // ========================================================
    // 5. СТАТИСТИКА ОТПРАВЛЕНИЙ
    // ========================================================

    const cancelledPostings =
      postings.filter(
        (
          posting
        ) =>
          String(
            posting.status
            ?? ""
          )
            .toLowerCase()
          ===
          "cancelled"
      );


    const activePostings =
      postings.filter(
        (
          posting
        ) =>
          String(
            posting.status
            ?? ""
          )
            .toLowerCase()
          !==
          "cancelled"
      );


    // ========================================================
    // 6. RESPONSE
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


        stock_method:
          "/v1/product/info/stocks-by-warehouse/fbo",


        products: {
          total_active:
            products.length,

          offer_ids_sent_to_ozon:
            offerIds.length,

          with_ozon_product_id:
            products.filter(
              (
                product
              ) =>
                product.ozon_product_id
                != null
            ).length,

          without_ozon_product_id:
            products.filter(
              (
                product
              ) =>
                product.ozon_product_id
                == null
            ).length,

          without_ozon_product_id_sample:
            products
              .filter(
                (
                  product
                ) =>
                  product.ozon_product_id
                  == null
              )
              .map(
                (
                  product
                ) => ({
                  id:
                    product.id,

                  offer_id:
                    product.offer_id,

                  name:
                    product.name,
                })
              )
              .slice(
                0,
                300
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
                (
                  cluster
                ) => ({
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
              ),
        },


        stocks_fbo: {
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

          matched_rows:
            stockPreview
              .rows
              .length,

          unmatched_rows:
            stockPreview
              .unmatched
              .length,

          rows_sample:
            stockPreview
              .rows
              .slice(
                0,
                50
              ),

          unmatched_sample:
            stockPreview
              .unmatched
              .slice(
                0,
                50
              ),

          raw_sample:
            stockResult
              .stocks
              .slice(
                0,
                20
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
