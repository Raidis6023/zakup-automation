import {
  NextResponse,
} from "next/server";


// ============================================================
// OZON → SUPABASE
// ПОЛНАЯ СИНХРОНИЗАЦИЯ ПРОДАЖ FBO
//
// ПРАВИЛА:
//
// 1. Берём последние 28 ЗАВЕРШЁННЫХ дней.
// 2. Часовой пояс расчёта — Москва UTC+3.
// 3. Все статусы, кроме cancelled, считаются продажами.
// 4. cancelled храним отдельно.
// 5. Группируем:
//      дата + offer_id + кластер.
// 6. Если хотя бы один склад не удалось
//    сопоставить с кластером — ничего не сохраняем.
// 7. Только после полной загрузки вызываем Supabase.
// 8. /v3/posting/fbo/list запрашиваем максимум
//    по 100 отправлений за страницу.
// ============================================================


// ============================================================
// OZON CLUSTERS
// ============================================================

type OzonWarehouse = {
  warehouse_id?: number | string;
  name?: string;
};


type OzonLogisticCluster = {
  warehouses?: OzonWarehouse[];
};


type OzonCluster = {
  id?: number | string;
  name?: string;

  logistic_clusters?:
    OzonLogisticCluster[];
};


type OzonClusterResponse = {
  clusters?: OzonCluster[];
};


// ============================================================
// OZON FBO POSTINGS
// ============================================================

type OzonPostingProduct = {
  sku?: number | string;

  name?: string;

  quantity?: number;

  offer_id?: string;
};


type OzonPostingAnalytics = {
  warehouse_id?:
    number | string;

  warehouse_name?:
    string;

  city?: string;
};


type OzonFboPosting = {
  posting_number?: string;

  order_number?: string;

  status?: string;

  created_at?: string;

  analytics_data?:
    OzonPostingAnalytics;

  products?:
    OzonPostingProduct[];
};


type OzonFboResponse = {
  postings?:
    OzonFboPosting[];

  cursor?: string;

  has_next?: boolean;
};


// ============================================================
// ВНУТРЕННИЕ ТИПЫ
// ============================================================

type WarehouseClusterInfo = {
  cluster_id: string;

  cluster_name: string;

  warehouse_name:
    string | null;
};


type ProductForSupabase = {
  offer_id: string;

  name:
    string | null;
};


type SalesAggregate = {
  offer_id: string;

  sale_date: string;

  cluster_id: string;

  cluster_name: string;

  sales_quantity: number;

  cancelled_quantity: number;

  posting_count: number;

  cancelled_posting_count: number;

  warehouse_ids:
    Set<string>;
};


// ============================================================
// OZON HEADERS
// ============================================================

function getOzonHeaders() {

  const clientId =
    process.env.OZON_CLIENT_ID;

  const apiKey =
    process.env.OZON_API_KEY;


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
// OZON POST С ПОВТОРНЫМИ ПОПЫТКАМИ
// ============================================================

async function ozonPost<T>(
  endpoint: string,

  body:
    Record<string, unknown>
):
  Promise<T> {

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
            method: "POST",

            headers:
              getOzonHeaders(),

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
        attempt === maxAttempts
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
        1000 * attempt
      );

      continue;

    }


    const text =
      await response.text();


    if (response.ok) {

      try {

        return JSON.parse(
          text
        ) as T;

      } catch {

        throw new Error(
          `Ozon ${endpoint} вернул некорректный JSON`
        );

      }

    }


    // ========================================================
    // 429 И 5xx СЧИТАЕМ ВРЕМЕННЫМИ ОШИБКАМИ
    // ========================================================

    const shouldRetry =
      response.status === 429
      ||
      response.status >= 500;


    if (
      shouldRetry
      &&
      attempt < maxAttempts
    ) {

      await sleep(
        1000 * attempt
      );

      continue;

    }


    throw new Error(
      `Ошибка Ozon ${endpoint}. HTTP ${response.status}. ${text}`
    );

  }


  throw new Error(
    `Не удалось выполнить Ozon ${endpoint}`
  );
}


// ============================================================
// SUPABASE RPC
// ============================================================

async function supabaseRpc<T>(
  functionName: string,

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
        method: "POST",

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


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Ошибка Supabase ${functionName}. HTTP ${response.status}. ${text}`
    );

  }


  try {

    return JSON.parse(
      text
    ) as T;

  } catch {

    throw new Error(
      `Supabase ${functionName} вернул некорректный JSON`
    );

  }
}


// ============================================================
// YYYY-MM-DD
// ============================================================

function formatDateUtc(
  date: Date
) {

  const year =
    date.getUTCFullYear();


  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


// ============================================================
// 28 ЗАВЕРШЁННЫХ МОСКОВСКИХ ДНЕЙ
// ============================================================

function getCompletedMoscowRange(
  numberOfDays: number
) {

  // Москва — UTC+3.
  const moscowNow =
    new Date(
      Date.now()
      +
      3 * 60 * 60 * 1000
    );


  const todayMoscow =
    new Date(
      Date.UTC(
        moscowNow
          .getUTCFullYear(),

        moscowNow
          .getUTCMonth(),

        moscowNow
          .getUTCDate()
      )
    );


  // Сегодня ещё не завершён.
  const endDate =
    new Date(
      todayMoscow
        .getTime()
    );


  endDate.setUTCDate(
    endDate.getUTCDate()
    - 1
  );


  const startDate =
    new Date(
      endDate.getTime()
    );


  startDate.setUTCDate(
    startDate.getUTCDate()
    -
    (
      numberOfDays - 1
    )
  );


  const dateFrom =
    formatDateUtc(
      startDate
    );


  const dateTo =
    formatDateUtc(
      endDate
    );


  return {

    dateFrom,

    dateTo,

    since:
      `${dateFrom}T00:00:00+03:00`,

    to:
      `${dateTo}T23:59:59.999+03:00`,

  };
}


// ============================================================
// CREATED_AT → МОСКОВСКАЯ ДАТА
// ============================================================

function getMoscowDateFromTimestamp(
  timestamp: string
):
  string {

  const date =
    new Date(
      timestamp
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    throw new Error(
      `Некорректная дата отправления Ozon: ${timestamp}`
    );

  }


  const moscow =
    new Date(
      date.getTime()
      +
      3 * 60 * 60 * 1000
    );


  return formatDateUtc(
    moscow
  );
}


// ============================================================
// GET
//
// ТОЛЬКО ПРОВЕРКА.
// НИЧЕГО НЕ ЗАПИСЫВАЕТ.
// ============================================================

export async function GET() {

  const range =
    getCompletedMoscowRange(
      28
    );


  return NextResponse.json(
    {
      ok: true,

      message:
        "Маршрут синхронизации продаж Ozon готов",

      syncMethod:
        "POST",

      writesData:
        false,

      completedDays:
        28,

      dateFrom:
        range.dateFrom,

      dateTo:
        range.dateTo,

      timezone:
        "Europe/Moscow",

      pageLimit:
        100,
    }
  );
}


// ============================================================
// POST
//
// РЕАЛЬНАЯ СИНХРОНИЗАЦИЯ 28 ДНЕЙ
// ============================================================

export async function POST() {

  try {

    // ========================================================
    // 1. ДИАПАЗОН
    // ========================================================

    const range =
      getCompletedMoscowRange(
        28
      );


    // ========================================================
    // 2. ПОЛУЧАЕМ КЛАСТЕРЫ
    // ========================================================

    const clusterResponse =
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
      Array.isArray(
        clusterResponse.clusters
      )
        ? clusterResponse.clusters
        : [];


    if (
      clusters.length === 0
    ) {

      throw new Error(
        "Ozon не вернул список кластеров"
      );

    }


    // ========================================================
    // 3. СТРОИМ:
    //
    // WAREHOUSE_ID → CLUSTER
    // ========================================================

    const warehouseMap =
      new Map<
        string,
        WarehouseClusterInfo
      >();


    for (
      const cluster
      of clusters
    ) {

      const clusterId =
        String(
          cluster.id
          ?? ""
        )
          .trim();


      const clusterName =
        String(
          cluster.name
          ?? ""
        )
          .trim();


      if (!clusterId) {
        continue;
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
            String(
              warehouse.warehouse_id
              ?? ""
            )
              .trim();


          if (!warehouseId) {
            continue;
          }


          warehouseMap.set(
            warehouseId,
            {
              cluster_id:
                clusterId,

              cluster_name:
                clusterName
                ||
                `Кластер ${clusterId}`,

              warehouse_name:
                String(
                  warehouse.name
                  ?? ""
                )
                  .trim()
                || null,
            }
          );

        }

      }

    }


    if (
      warehouseMap.size === 0
    ) {

      throw new Error(
        "Не удалось построить карту складов Ozon"
      );

    }


    // ========================================================
    // 4. ПОЛУЧАЕМ ВСЕ FBO-ОТПРАВЛЕНИЯ
    //
    // ВАЖНО:
    // Ozon разрешает максимум 100 за запрос.
    // ========================================================

    const allPostings:
      OzonFboPosting[] = [];


    let cursor =
      "";


    const seenCursors =
      new Set<string>();


    const maxPages =
      5000;


    let pagesLoaded =
      0;


    for (
      let page = 1;
      page <= maxPages;
      page++
    ) {

      const response =
        await ozonPost<
          OzonFboResponse
        >(
          "/v3/posting/fbo/list",
          {
            cursor,

            filter: {

              since:
                range.since,

              to:
                range.to,

            },

            // =================================
            // МАКСИМУМ ДЛЯ ЭТОГО OZON-МЕТОДА
            // =================================

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


      pagesLoaded++;


      const pagePostings =
        Array.isArray(
          response.postings
        )
          ? response.postings
          : [];


      allPostings.push(
        ...pagePostings
      );


      const hasNext =
        Boolean(
          response.has_next
        );


      if (!hasNext) {

        break;

      }


      const nextCursor =
        String(
          response.cursor
          ?? ""
        )
          .trim();


      if (!nextCursor) {

        throw new Error(
          "Ozon сообщил has_next=true, но не вернул cursor"
        );

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


      // Небольшая пауза,
      // чтобы не долбить API десятками
      // запросов подряд.
      await sleep(
        100
      );


      if (
        page === maxPages
      ) {

        throw new Error(
          `Достигнут защитный лимит ${maxPages} страниц Ozon`
        );

      }

    }


    // ========================================================
    // 5. ПРОВЕРКА
    // ========================================================

    if (
      allPostings.length === 0
    ) {

      throw new Error(
        "За 28 завершённых дней Ozon не вернул ни одного FBO-отправления"
      );

    }


    // ========================================================
    // 6. ДЕДУПЛИКАЦИЯ POSTING_NUMBER
    // ========================================================

    const postingsByNumber =
      new Map<
        string,
        OzonFboPosting
      >();


    for (
      let index = 0;
      index < allPostings.length;
      index++
    ) {

      const posting =
        allPostings[
          index
        ];


      const postingNumber =
        String(
          posting.posting_number
          ??
          ""
        )
          .trim();


      const key =
        postingNumber
        ||
        `NO_NUMBER_${index}`;


      postingsByNumber.set(
        key,
        posting
      );

    }


    const uniquePostings =
      Array.from(
        postingsByNumber
          .values()
      );


    // ========================================================
    // 7. ПРОВЕРЯЕМ ВСЕ СКЛАДЫ
    //
    // ЕСЛИ ХОТЬ ОДИН НЕ СОПОСТАВИЛСЯ —
    // НЕ ПИШЕМ НИЧЕГО.
    // ========================================================

    const unmappedWarehouses =
      new Map<
        string,
        string
      >();


    const postingsWithoutWarehouse:
      string[] = [];


    for (
      const posting
      of uniquePostings
    ) {

      const warehouseId =
        String(
          posting
            .analytics_data
            ?.warehouse_id
          ?? ""
        )
          .trim();


      if (!warehouseId) {

        postingsWithoutWarehouse.push(
          String(
            posting.posting_number
            ?? "без номера"
          )
        );

        continue;

      }


      if (
        !warehouseMap.has(
          warehouseId
        )
      ) {

        unmappedWarehouses.set(

          warehouseId,

          String(
            posting
              .analytics_data
              ?.warehouse_name
            ?? "Без названия"
          )

        );

      }

    }


    if (
      postingsWithoutWarehouse.length > 0
    ) {

      throw new Error(
        `У ${postingsWithoutWarehouse.length} FBO-отправлений отсутствует warehouse_id. Пример: ${postingsWithoutWarehouse.slice(0, 5).join(", ")}`
      );

    }


    if (
      unmappedWarehouses.size > 0
    ) {

      const example =
        Array.from(
          unmappedWarehouses
            .entries()
        )
          .slice(
            0,
            10
          )
          .map(
            (
              [
                id,
                name,
              ]
            ) =>
              `${id} (${name})`
          )
          .join(
            ", "
          );


      throw new Error(
        `Найдены склады Ozon без кластера: ${unmappedWarehouses.size}. Пример: ${example}`
      );

    }


    // ========================================================
    // 8. СЧЁТЧИКИ СТАТУСОВ
    // ========================================================

    const statusCounts:
      Record<
        string,
        number
      > = {};


    let cancelledPostings =
      0;


    for (
      const posting
      of uniquePostings
    ) {

      const status =
        String(
          posting.status
          ?? "unknown"
        )
          .toLowerCase();


      statusCounts[
        status
      ] =
        (
          statusCounts[
            status
          ]
          ?? 0
        )
        + 1;


      if (
        status ===
          "cancelled"
      ) {

        cancelledPostings++;

      }

    }


    // ========================================================
    // 9. ТОВАРЫ ДЛЯ PRODUCTS
    // ========================================================

    const productsByOffer =
      new Map<
        string,
        ProductForSupabase
      >();


    // ========================================================
    // 10. АГРЕГАЦИЯ
    //
    // ДАТА + OFFER_ID + CLUSTER_ID
    // ========================================================

    const aggregate =
      new Map<
        string,
        SalesAggregate
      >();


    for (
      const posting
      of uniquePostings
    ) {

      const status =
        String(
          posting.status
          ?? ""
        )
          .toLowerCase();


      const isCancelled =
        status ===
          "cancelled";


      const createdAt =
        String(
          posting.created_at
          ?? ""
        )
          .trim();


      if (!createdAt) {

        throw new Error(
          `У отправления ${
            posting.posting_number
            ?? "без номера"
          } отсутствует created_at`
        );

      }


      const saleDate =
        getMoscowDateFromTimestamp(
          createdAt
        );


      if (
        saleDate <
          range.dateFrom
        ||
        saleDate >
          range.dateTo
      ) {

        throw new Error(
          `Отправление ${
            posting.posting_number
            ?? "без номера"
          } попало за пределы периода: ${saleDate}`
        );

      }


      const warehouseId =
        String(
          posting
            .analytics_data
            ?.warehouse_id
          ?? ""
        )
          .trim();


      const clusterInfo =
        warehouseMap.get(
          warehouseId
        );


      if (!clusterInfo) {

        throw new Error(
          `Не найден кластер для склада ${warehouseId}`
        );

      }


      for (
        const product
        of posting.products
          ?? []
      ) {

        const offerId =
          String(
            product.offer_id
            ?? ""
          )
            .trim();


        if (!offerId) {

          throw new Error(
            `В отправлении ${
              posting.posting_number
              ?? "без номера"
            } найден товар без offer_id`
          );

        }


        const productName =
          String(
            product.name
            ?? ""
          )
            .trim();


        if (
          !productsByOffer.has(
            offerId
          )
        ) {

          productsByOffer.set(
            offerId,
            {
              offer_id:
                offerId,

              name:
                productName
                || null,
            }
          );

        }


        const rawQuantity =
          Number(
            product.quantity
            ?? 0
          );


        if (
          !Number.isFinite(
            rawQuantity
          )
          ||
          rawQuantity < 0
        ) {

          throw new Error(
            `Некорректное количество по ${offerId}`
          );

        }


        const quantity =
          Math.round(
            rawQuantity
          );


        const key =
          [
            saleDate,
            offerId,
            clusterInfo.cluster_id,
          ]
            .join(
              "::"
            );


        const existing =
          aggregate.get(
            key
          )
          ??
          {
            offer_id:
              offerId,

            sale_date:
              saleDate,

            cluster_id:
              clusterInfo
                .cluster_id,

            cluster_name:
              clusterInfo
                .cluster_name,

            sales_quantity:
              0,

            cancelled_quantity:
              0,

            posting_count:
              0,

            cancelled_posting_count:
              0,

            warehouse_ids:
              new Set<string>(),
          };


        if (isCancelled) {

          existing
            .cancelled_quantity
            += quantity;


          existing
            .cancelled_posting_count++;

        } else {

          existing
            .sales_quantity
            += quantity;


          existing
            .posting_count++;

        }


        existing
          .warehouse_ids
          .add(
            warehouseId
          );


        aggregate.set(
          key,
          existing
        );

      }

    }


    // ========================================================
    // 11. ГОТОВИМ СТРОКИ ДЛЯ SUPABASE
    // ========================================================

    const salesRows =
      Array.from(
        aggregate.values()
      )
        .map(
          (
            row
          ) => ({
            offer_id:
              row.offer_id,

            sale_date:
              row.sale_date,

            cluster_id:
              row.cluster_id,

            cluster_name:
              row.cluster_name,

            sales_quantity:
              row.sales_quantity,

            cancelled_quantity:
              row.cancelled_quantity,

            raw_payload: {

              source:
                "v3/posting/fbo/list",

              posting_count:
                row.posting_count,

              cancelled_posting_count:
                row.cancelled_posting_count,

              warehouse_ids:
                Array.from(
                  row.warehouse_ids
                ),

            },
          })
        );


    if (
      salesRows.length === 0
    ) {

      throw new Error(
        "После обработки не сформировано ни одной строки продаж"
      );

    }


    const products =
      Array.from(
        productsByOffer
          .values()
      );


    // ========================================================
    // 12. ИТОГОВЫЕ СЧЁТЧИКИ
    // ========================================================

    let totalSalesQuantity =
      0;


    let totalCancelledQuantity =
      0;


    for (
      const row
      of salesRows
    ) {

      totalSalesQuantity +=
        row.sales_quantity;


      totalCancelledQuantity +=
        row.cancelled_quantity;

    }


    const uniqueClusterIds =
      new Set(
        salesRows.map(
          (
            row
          ) =>
            row.cluster_id
        )
      );


    // ========================================================
    // 13. ТОЛЬКО ТЕПЕРЬ ПИШЕМ В SUPABASE
    // ========================================================

    const saveResult =
      await supabaseRpc<
        Record<
          string,
          unknown
        >
      >(
        "save_ozon_sales_snapshot",
        {

          p_date_from:
            range.dateFrom,

          p_date_to:
            range.dateTo,

          p_products:
            products,

          p_rows:
            salesRows,

          p_postings_received:
            uniquePostings.length,

          p_cancelled_postings:
            cancelledPostings,

        }
      );


    // ========================================================
    // 14. УСПЕХ
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        message:
          "Продажи Ozon успешно синхронизированы",

        period: {

          completedDays:
            28,

          timezone:
            "Europe/Moscow",

          dateFrom:
            range.dateFrom,

          dateTo:
            range.dateTo,

        },

        ozon: {

          pagesLoaded,

          postingsReceived:
            allPostings.length,

          uniquePostings:
            uniquePostings.length,

          cancelledPostings,

          statusCounts,

          uniqueProducts:
            products.length,

          uniqueClusters:
            uniqueClusterIds.size,

          aggregatedRows:
            salesRows.length,

          salesQuantityExcludingCancelled:
            totalSalesQuantity,

          cancelledQuantity:
            totalCancelledQuantity,

        },

        supabase:
          saveResult,

      },
      {
        status: 200,
      }
    );


  } catch (error) {

    console.error(
      "Ozon sales sync error:",
      error
    );


    return NextResponse.json(
      {
        ok: false,

        message:
          "Продажи Ozon не обновлены",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка синхронизации продаж Ozon",
      },
      {
        status: 500,
      }
    );

  }

}
