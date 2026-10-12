import {
  NextResponse,
} from "next/server";


// ============================================================
// OZON → SUPABASE
// ПОЛНАЯ СИНХРОНИЗАЦИЯ ОСТАТКОВ FBO
// ============================================================


// ============================================================
// ТИПЫ /v4/product/info/stocks
// ============================================================

type OzonProductStock = {
  type?: string;
  present?: number;
  reserved?: number;
  sku?: number;
  warehouse_ids?: number[];
};


type OzonProduct = {
  product_id?: number;
  offer_id?: string;
  stocks?: OzonProductStock[];
};


type OzonProductsResponse = {
  items?: OzonProduct[];
  total?: number;
  cursor?: string;
};


// ============================================================
// ТИПЫ /v1/analytics/stocks
// ============================================================

type OzonAnalyticsStockItem = {
  sku?: number | string;
  name?: string;
  offer_id?: string;
  warehouse_id?: number | string;
  warehouse_name?: string;
  cluster_id?: number | string;
  cluster_name?: string;
  available_stock_count?: number;
  valid_stock_count?: number;
  reserved_stock_count?: number;
  ads?: number;
  idc?: number | null;
  turnover_grade?: string;

  [key: string]:
    unknown;
};


type OzonAnalyticsResponse = {
  items?: OzonAnalyticsStockItem[];
};


// ============================================================
// SUPABASE
// ============================================================

type ProductForSupabase = {
  offer_id:
    string;

  ozon_product_id:
    number | null;

  name:
    string | null;
};


type ClusterStockRow = {
  offer_id:
    string;

  cluster_id:
    string;

  cluster_name:
    string | null;

  quantity:
    number;

  raw_payload: {
    source:
      "v1/analytics/stocks";

    warehouses:
      Array<{
        sku:
          string | null;

        warehouse_id:
          string | null;

        warehouse_name:
          string | null;

        available_stock_count:
          number;
      }>;
  };
};


// ============================================================
// OZON HTTP ERROR
// ============================================================

class OzonHttpError extends Error {

  status:
    number;

  retryAfterSeconds:
    number | null;

  nextAllowedAt:
    string | null;


  constructor(
    message:
      string,

    status:
      number,

    retryAfterSeconds:
      number | null,

    nextAllowedAt:
      string | null
  ) {

    super(
      message
    );


    this.name =
      "OzonHttpError";


    this.status =
      status;


    this.retryAfterSeconds =
      retryAfterSeconds;


    this.nextAllowedAt =
      nextAllowedAt;

  }

}


// ============================================================
// HEADERS OZON
// ============================================================

function getOzonHeaders() {

  const clientId =
    process.env
      .OZON_CLIENT_ID;


  const apiKey =
    process.env
      .OZON_API_KEY;


  if (!clientId) {

    throw new Error(
      "Vercel не видит OZON_CLIENT_ID"
    );

  }


  if (!apiKey) {

    throw new Error(
      "Vercel не видит OZON_API_KEY"
    );

  }


  return {
    "Client-Id":
      clientId,

    "Api-Key":
      apiKey,

    "Content-Type":
      "application/json",

    Accept:
      "application/json",
  };

}


// ============================================================
// SUPABASE CONFIG
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Vercel не видит NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Vercel не видит SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


// ============================================================
// ПАУЗА
// ============================================================

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


// ============================================================
// RETRY-AFTER
// ============================================================

function getRetryAfter(
  response:
    Response
) {

  const raw =
    response.headers.get(
      "retry-after"
    );


  if (!raw) {

    return {
      retryAfterSeconds:
        null,

      nextAllowedAt:
        null,
    };

  }


  const numeric =
    Number(
      raw
    );


  let seconds:
    number | null =
    null;


  if (
    Number.isFinite(
      numeric
    )
    &&
    numeric >=
      0
  ) {

    seconds =
      Math.ceil(
        numeric
      );

  } else {

    const date =
      new Date(
        raw
      );


    if (
      Number.isFinite(
        date.getTime()
      )
    ) {

      seconds =
        Math.max(
          0,
          Math.ceil(
            (
              date.getTime()
              -
              Date.now()
            )
            /
            1000
          )
        );

    }

  }


  if (
    seconds ===
    null
  ) {

    return {
      retryAfterSeconds:
        null,

      nextAllowedAt:
        null,
    };

  }


  return {
    retryAfterSeconds:
      seconds,

    nextAllowedAt:
      new Date(
        Date.now()
        +
        seconds
        *
        1000
      ).toISOString(),
  };

}


// ============================================================
// SYNC STATE
// ============================================================

async function updateSyncState(
  values:
    Record<string, unknown>
) {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/ozon_sync_state?sync_key=eq.stocks`,
      {
        method:
          "PATCH",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          "Content-Type":
            "application/json",

          Prefer:
            "return=minimal",
        },

        body:
          JSON.stringify(
            {
              ...values,

              updated_at:
                new Date()
                  .toISOString(),
            }
          ),

        cache:
          "no-store",
      }
    );


  if (!response.ok) {

    const text =
      await response.text();


    throw new Error(
      `Не удалось обновить ozon_sync_state stocks. HTTP ${response.status}: ${text}`
    );

  }

}


async function tryUpdateSyncState(
  values:
    Record<string, unknown>
) {

  try {

    await updateSyncState(
      values
    );

  } catch (error) {

    console.error(
      "Ozon stocks sync-state error:",
      error
    );

  }

}


// ============================================================
// OZON POST
// ============================================================

async function ozonPost<T>(
  endpoint:
    string,

  body:
    Record<string, unknown>
):
Promise<T> {

  const headers =
    getOzonHeaders();


  const maxAttempts =
    3;


  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {

    let response:
      Response;


    try {

      response =
        await fetch(
          `https://api-seller.ozon.ru${endpoint}`,
          {
            method:
              "POST",

            headers,

            body:
              JSON.stringify(
                body
              ),

            cache:
              "no-store",
          }
        );

    } catch (error) {

      if (
        attempt ===
        maxAttempts
      ) {

        throw new Error(
          `Сетевая ошибка Ozon ${endpoint}: ${
            error instanceof Error
              ? error.message
              : "неизвестная ошибка"
          }`
        );

      }


      await sleep(
        1000
        *
        attempt
      );


      continue;

    }


    const responseText =
      await response.text();


    if (response.ok) {

      try {

        return JSON.parse(
          responseText
        ) as T;

      } catch {

        throw new Error(
          `Ozon ${endpoint} вернул некорректный JSON`
        );

      }

    }


    // ========================================================
    // 429
    // ========================================================

    if (
      response.status ===
      429
    ) {

      const {
        retryAfterSeconds,
        nextAllowedAt,
      } =
        getRetryAfter(
          response
        );


      // Если Ozon просит подождать буквально
      // несколько секунд, маршрут может сам повторить запрос.
      if (
        attempt <
          maxAttempts
        &&
        retryAfterSeconds !==
          null
        &&
        retryAfterSeconds <=
          5
      ) {

        await sleep(
          Math.max(
            1000,
            retryAfterSeconds
            *
            1000
          )
        );


        continue;

      }


      throw new OzonHttpError(
        `Ozon временно ограничил запрос ${endpoint}`,
        429,
        retryAfterSeconds,
        nextAllowedAt
      );

    }


    // ========================================================
    // 5xx
    // ========================================================

    if (
      response.status >=
        500
      &&
      attempt <
        maxAttempts
    ) {

      await sleep(
        1000
        *
        attempt
      );


      continue;

    }


    throw new OzonHttpError(
      `Ошибка Ozon ${endpoint}. HTTP ${response.status}. ${responseText}`,
      response.status,
      null,
      null
    );

  }


  throw new Error(
    `Не удалось выполнить запрос Ozon ${endpoint}`
  );

}


// ============================================================
// RPC SUPABASE
// ============================================================

async function supabaseRpc<T>(
  functionName:
    string,

  body:
    Record<string, unknown>
):
Promise<T> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


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
        },

        body:
          JSON.stringify(
            body
          ),

        cache:
          "no-store",
      }
    );


  const responseText =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Ошибка Supabase ${functionName}. HTTP ${response.status}. ${responseText}`
    );

  }


  try {

    return JSON.parse(
      responseText
    ) as T;

  } catch {

    throw new Error(
      `Supabase ${functionName} вернул некорректный JSON`
    );

  }

}


// ============================================================
// CHUNKS
// ============================================================

function chunkArray<T>(
  items:
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
    index < items.length;
    index += size
  ) {

    result.push(
      items.slice(
        index,
        index + size
      )
    );

  }


  return result;

}


// ============================================================
// SNAPSHOT DATE
// ============================================================

function getSnapshotDate() {

  return new Date()
    .toISOString()
    .slice(
      0,
      10
    );

}


// ============================================================
// GET
// ============================================================

export async function GET() {

  return NextResponse.json(
    {
      ok:
        true,

      message:
        "Маршрут синхронизации Ozon готов",

      syncMethod:
        "POST",

      writesData:
        false,
    }
  );

}


// ============================================================
// POST
// ============================================================

export async function POST() {

  const attemptAt =
    new Date()
      .toISOString();


  await tryUpdateSyncState({
    last_attempt_at:
      attemptAt,

    last_message:
      "Запущено обновление остатков Ozon",
  });


  try {

    // ========================================================
    // 1. ВСЕ ТОВАРЫ
    // ========================================================

    const allProducts:
      OzonProduct[] =
      [];


    let cursor =
      "";


    let expectedTotal:
      number | null =
      null;


    const seenCursors =
      new Set<string>();


    const maxPages =
      100;


    for (
      let page = 1;
      page <= maxPages;
      page++
    ) {

      const productsPage =
        await ozonPost<
          OzonProductsResponse
        >(
          "/v4/product/info/stocks",
          {
            cursor,

            filter: {
              visibility:
                "ALL",
            },

            limit:
              1000,
          }
        );


      const pageItems =
        Array.isArray(
          productsPage.items
        )
          ? productsPage.items
          : [];


      if (
        expectedTotal ===
          null
        &&
        typeof productsPage.total ===
          "number"
      ) {

        expectedTotal =
          productsPage.total;

      }


      allProducts.push(
        ...pageItems
      );


      if (
        expectedTotal !==
          null
        &&
        allProducts.length >=
          expectedTotal
      ) {

        break;

      }


      if (
        pageItems.length ===
        0
      ) {

        break;

      }


      const nextCursor =
        typeof productsPage.cursor ===
          "string"
          ? productsPage.cursor
          : "";


      if (!nextCursor) {

        break;

      }


      if (
        seenCursors.has(
          nextCursor
        )
      ) {

        throw new Error(
          "Ozon вернул повторяющийся cursor. Синхронизация остановлена."
        );

      }


      seenCursors.add(
        nextCursor
      );


      cursor =
        nextCursor;

    }


    // ========================================================
    // 2. VALIDATION
    // ========================================================

    if (
      allProducts.length ===
      0
    ) {

      throw new Error(
        "Ozon не вернул ни одного товара"
      );

    }


    if (
      expectedTotal !==
        null
      &&
      allProducts.length <
        expectedTotal
    ) {

      throw new Error(
        `Получена неполная выгрузка товаров Ozon: ${allProducts.length} из ${expectedTotal}`
      );

    }


    // ========================================================
    // 3. DEDUP
    // ========================================================

    const productsByOffer =
      new Map<
        string,
        OzonProduct
      >();


    for (
      const product
      of allProducts
    ) {

      const offerId =
        String(
          product.offer_id
          ??
          ""
        )
          .trim();


      if (!offerId) {

        continue;

      }


      productsByOffer.set(
        offerId,
        product
      );

    }


    const uniqueProducts =
      Array.from(
        productsByOffer.values()
      );


    if (
      uniqueProducts.length ===
      0
    ) {

      throw new Error(
        "Ozon вернул товары без offer_id"
      );

    }


    // ========================================================
    // 4. FBO SKU
    // ========================================================

    const fboSkuSet =
      new Set<string>();


    for (
      const product
      of uniqueProducts
    ) {

      for (
        const stock
        of product.stocks
        ??
        []
      ) {

        if (
          String(
            stock.type
            ??
            ""
          ).toLowerCase() !==
            "fbo"
        ) {

          continue;

        }


        const sku =
          String(
            stock.sku
            ??
            ""
          )
            .trim();


        if (
          !sku
          ||
          sku ===
            "0"
        ) {

          continue;

        }


        fboSkuSet.add(
          sku
        );

      }

    }


    const fboSkus =
      Array.from(
        fboSkuSet
      );


    if (
      fboSkus.length ===
      0
    ) {

      throw new Error(
        "В кабинете Ozon не найдено ни одного FBO SKU"
      );

    }


    // ========================================================
    // 5. ANALYTICS
    // ========================================================

    const skuChunks =
      chunkArray(
        fboSkus,
        100
      );


    const analyticsRows:
      OzonAnalyticsStockItem[] =
      [];


    for (
      let chunkIndex = 0;
      chunkIndex <
        skuChunks.length;
      chunkIndex++
    ) {

      const skuChunk =
        skuChunks[
          chunkIndex
        ];


      const analyticsResponse =
        await ozonPost<
          OzonAnalyticsResponse
        >(
          "/v1/analytics/stocks",
          {
            skus:
              skuChunk,
          }
        );


      if (
        !Array.isArray(
          analyticsResponse.items
        )
      ) {

        throw new Error(
          `Ozon /v1/analytics/stocks не вернул items для пачки ${chunkIndex + 1}`
        );

      }


      analyticsRows.push(
        ...analyticsResponse.items
      );


      if (
        chunkIndex <
          skuChunks.length -
          1
      ) {

        await sleep(
          150
        );

      }

    }


    if (
      analyticsRows.length ===
      0
    ) {

      throw new Error(
        "Ozon analytics/stocks вернул пустой список"
      );

    }


    // ========================================================
    // 6. PRODUCT NAMES
    // ========================================================

    const productNamesByOffer =
      new Map<
        string,
        string
      >();


    for (
      const row
      of analyticsRows
    ) {

      const offerId =
        String(
          row.offer_id
          ??
          ""
        )
          .trim();


      const name =
        String(
          row.name
          ??
          ""
        )
          .trim();


      if (
        offerId
        &&
        name
        &&
        !productNamesByOffer.has(
          offerId
        )
      ) {

        productNamesByOffer.set(
          offerId,
          name
        );

      }

    }


    // ========================================================
    // 7. PRODUCTS FOR DB
    // ========================================================

    const productsForSupabase:
      ProductForSupabase[] =
      [];


    for (
      const product
      of uniqueProducts
    ) {

      const offerId =
        String(
          product.offer_id
          ??
          ""
        )
          .trim();


      if (!offerId) {

        continue;

      }


      const productId =
        typeof product.product_id ===
          "number"
          ? product.product_id
          : Number(
              product.product_id
            );


      productsForSupabase.push({
        offer_id:
          offerId,

        ozon_product_id:
          Number.isFinite(
            productId
          )
            ? productId
            : null,

        name:
          productNamesByOffer.get(
            offerId
          )
          ??
          null,
      });

    }


    // ========================================================
    // 8. AGGREGATE
    // ========================================================

    type AggregateValue = {
      offer_id:
        string;

      cluster_id:
        string;

      cluster_name:
        string | null;

      quantity:
        number;

      warehouses:
        Array<{
          sku:
            string | null;

          warehouse_id:
            string | null;

          warehouse_name:
            string | null;

          available_stock_count:
            number;
        }>;
    };


    const aggregated =
      new Map<
        string,
        AggregateValue
      >();


    for (
      const row
      of analyticsRows
    ) {

      const offerId =
        String(
          row.offer_id
          ??
          ""
        )
          .trim();


      const clusterId =
        String(
          row.cluster_id
          ??
          ""
        )
          .trim();


      if (
        !offerId
        ||
        !clusterId
      ) {

        continue;

      }


      const clusterNameRaw =
        String(
          row.cluster_name
          ??
          ""
        )
          .trim();


      const warehouseIdRaw =
        String(
          row.warehouse_id
          ??
          ""
        )
          .trim();


      const warehouseNameRaw =
        String(
          row.warehouse_name
          ??
          ""
        )
          .trim();


      const skuRaw =
        String(
          row.sku
          ??
          ""
        )
          .trim();


      const quantityRaw =
        Number(
          row.available_stock_count
          ??
          0
        );


      const quantity =
        Number.isFinite(
          quantityRaw
        )
          ? Math.max(
              0,
              Math.round(
                quantityRaw
              )
            )
          : 0;


      const key =
        `${offerId}::${clusterId}`;


      const existing =
        aggregated.get(
          key
        );


      if (existing) {

        existing.quantity +=
          quantity;


        existing.warehouses.push({
          sku:
            skuRaw
            ||
            null,

          warehouse_id:
            warehouseIdRaw
            ||
            null,

          warehouse_name:
            warehouseNameRaw
            ||
            null,

          available_stock_count:
            quantity,
        });

      } else {

        aggregated.set(
          key,
          {
            offer_id:
              offerId,

            cluster_id:
              clusterId,

            cluster_name:
              clusterNameRaw
              ||
              null,

            quantity,

            warehouses: [
              {
                sku:
                  skuRaw
                  ||
                  null,

                warehouse_id:
                  warehouseIdRaw
                  ||
                  null,

                warehouse_name:
                  warehouseNameRaw
                  ||
                  null,

                available_stock_count:
                  quantity,
              },
            ],
          }
        );

      }

    }


    // ========================================================
    // 9. DB ROWS
    // ========================================================

    const clusterRows:
      ClusterStockRow[] =
      Array.from(
        aggregated.values()
      )
        .map(
          item => ({
            offer_id:
              item.offer_id,

            cluster_id:
              item.cluster_id,

            cluster_name:
              item.cluster_name,

            quantity:
              item.quantity,

            raw_payload: {
              source:
                "v1/analytics/stocks",

              warehouses:
                item.warehouses,
            },
          })
        );


    if (
      clusterRows.length ===
      0
    ) {

      throw new Error(
        "После обработки Ozon не осталось строк остатков по кластерам"
      );

    }


    const uniqueClusterIds =
      new Set(
        clusterRows.map(
          row =>
            row.cluster_id
        )
      );


    const snapshotDate =
      getSnapshotDate();


    // ========================================================
    // 10. SAVE
    // ========================================================

    const saveResult =
      await supabaseRpc<
        Record<string, unknown>
      >(
        "save_ozon_stock_snapshot",
        {
          p_snapshot_date:
            snapshotDate,

          p_products:
            productsForSupabase,

          p_rows:
            clusterRows,

          p_fbo_skus_count:
            fboSkus.length,

          p_analytics_rows_count:
            analyticsRows.length,
        }
      );


    // ========================================================
    // 11. SUCCESS STATE
    // ========================================================

    const successAt =
      new Date()
        .toISOString();


    await tryUpdateSyncState({
      last_attempt_at:
        attemptAt,

      last_success_at:
        successAt,

      next_allowed_at:
        null,

      last_http_status:
        200,

      retry_after_seconds:
        null,

      last_message:
        "Остатки Ozon успешно синхронизированы",
    });


    return NextResponse.json(
      {
        ok:
          true,

        message:
          "Остатки Ozon успешно синхронизированы",

        snapshotDate,

        lastHttpStatus:
          200,

        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          successAt,

        nextAllowedAt:
          null,

        retryAfterSeconds:
          null,

        ozon: {
          reportedTotalProducts:
            expectedTotal,

          productsReceived:
            allProducts.length,

          uniqueOffers:
            uniqueProducts.length,

          fboSkuCount:
            fboSkus.length,

          analyticsRequests:
            skuChunks.length,

          analyticsRows:
            analyticsRows.length,

          uniqueClusters:
            uniqueClusterIds.size,

          clusterRowsPrepared:
            clusterRows.length,
        },

        supabase:
          saveResult,
      },
      {
        status:
          200,
      }
    );


  } catch (error) {

    console.error(
      "Ozon stock sync error:",
      error
    );


    // ========================================================
    // RATE LIMIT
    // ========================================================

    if (
      error instanceof
      OzonHttpError
      &&
      error.status ===
        429
    ) {

      await tryUpdateSyncState({
        last_attempt_at:
          attemptAt,

        next_allowed_at:
          error.nextAllowedAt,

        last_http_status:
          429,

        retry_after_seconds:
          error.retryAfterSeconds,

        last_message:
          error.nextAllowedAt
            ? "Ozon временно ограничил обновление остатков"
            : "Ozon ограничил обновление остатков, но не сообщил точное время сброса",
      });


      return NextResponse.json(
        {
          ok:
            false,

          blockedByRateLimit:
            true,

          message:
            error.nextAllowedAt
              ? "Ozon временно ограничил обновление остатков"
              : "Ozon ограничил обновление остатков, но не сообщил точное время сброса",

          error:
            error.message,

          lastHttpStatus:
            429,

          lastAttemptAt:
            attemptAt,

          nextAllowedAt:
            error.nextAllowedAt,

          retryAfterSeconds:
            error.retryAfterSeconds,
        },
        {
          status:
            429,
        }
      );

    }


    const status =
      error instanceof
        OzonHttpError
        ? error.status
        : null;


    await tryUpdateSyncState({
      last_attempt_at:
        attemptAt,

      last_http_status:
        status,

      last_message:
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка синхронизации Ozon",
    });


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка синхронизации Ozon",

        lastHttpStatus:
          status,

        lastAttemptAt:
          attemptAt,
      },
      {
        status:
          500,
      }
    );

  }

}
