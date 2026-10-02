import {
  NextResponse,
} from "next/server";


// ============================================================
// OZON → SUPABASE
// ПОЛНАЯ СИНХРОНИЗАЦИЯ ПРОДАЖ FBO
//
// ПРАВИЛА:
//
// 1. Последние 28 ЗАВЕРШЁННЫХ дней.
// 2. Часовой пояс расчёта — Москва UTC+3.
// 3. cancelled НЕ входит в продажи.
// 4. cancelled_quantity храним отдельно.
// 5. Кластер берём непосредственно из:
//      financial_data.cluster_from
// 6. Группируем:
//      дата + offer_id + cluster_from
// 7. Проходим ВСЕ страницы Ozon.
// 8. Никаких warehouse_id → cluster сопоставлений.
// 9. Если хоть у одного товарного отправления
//    нет cluster_from — ничего не сохраняем.
// 10. Только после полной проверки
//     вызываем Supabase.
// ============================================================


// ============================================================
// ТИПЫ OZON
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


type OzonPostingFinancialData = {
  cluster_from?:
    string;

  cluster_to?:
    string;

  products?:
    unknown[];
};


type OzonFboPosting = {
  posting_number?:
    string;

  order_number?:
    string;

  status?:
    string;

  created_at?:
    string;

  analytics_data?:
    OzonPostingAnalytics;

  financial_data?:
    OzonPostingFinancialData;

  products?:
    OzonPostingProduct[];
};


type OzonFboResponse = {
  postings?:
    OzonFboPosting[];

  cursor?:
    string;

  has_next?:
    boolean;
};


// ============================================================
// ВНУТРЕННИЕ ТИПЫ
// ============================================================

type ProductForSupabase = {
  offer_id:
    string;

  name:
    string | null;
};


type SalesAggregate = {
  offer_id:
    string;

  sale_date:
    string;

  cluster_id:
    string;

  cluster_name:
    string;

  sales_quantity:
    number;

  cancelled_quantity:
    number;

  posting_count:
    number;

  cancelled_posting_count:
    number;

  warehouse_ids:
    Set<string>;

  warehouse_names:
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
// НОРМАЛИЗАЦИЯ ТЕКСТА
// ============================================================

function normalizeText(
  value: unknown
) {

  return String(
    value ?? ""
  )
    .replace(
      /\u00A0/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


// ============================================================
// OZON POST С RETRY
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
            method:
              "POST",

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
    // 429 И 5xx МОГУТ БЫТЬ ВРЕМЕННЫМИ
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
    )
      .padStart(
        2,
        "0"
      );


  const day =
    String(
      date.getUTCDate()
    )
      .padStart(
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

  // Москва UTC+3
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
  // Берём вчера.
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
// НИЧЕГО НЕ ПИШЕМ.
// ============================================================

export async function GET() {

  const range =
    getCompletedMoscowRange(
      28
    );


  return NextResponse.json(
    {
      ok:
        true,

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

      clusterSource:
        "financial_data.cluster_from",
    }
  );
}


// ============================================================
// POST
//
// РЕАЛЬНАЯ СИНХРОНИЗАЦИЯ
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
    // 2. ПОЛУЧАЕМ ВСЕ FBO-ОТПРАВЛЕНИЯ
    // ========================================================

    const allPostings:
      OzonFboPosting[] =
        [];


    let cursor =
      "";


    const seenCursors =
      new Set<string>();


    let pagesLoaded =
      0;


    const maxPages =
      5000;


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

            // Максимум,
            // подтверждённый самим Ozon.
            limit:
              100,

            sort_dir:
              "asc",

            translit:
              false,

            with: {

              analytics_data:
                true,

              // ОБЯЗАТЕЛЬНО:
              // отсюда берём cluster_from.
              financial_data:
                true,

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


      if (
        !response.has_next
      ) {

        break;

      }


      const nextCursor =
        normalizeText(
          response.cursor
        );


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


      // Небольшая пауза.
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
    // 3. ПРОВЕРЯЕМ, ЧТО ДАННЫЕ ЕСТЬ
    // ========================================================

    if (
      allPostings.length === 0
    ) {

      throw new Error(
        "За 28 завершённых дней Ozon не вернул ни одного FBO-отправления"
      );

    }


    // ========================================================
    // 4. ДЕДУПЛИКАЦИЯ POSTING_NUMBER
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
        normalizeText(
          posting.posting_number
        );


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
    // 5. ПРОВЕРЯЕМ CLUSTER_FROM
    //
    // Мы уже проверили первые 100.
    // Теперь проверяем ВСЕ отправления.
    //
    // Если хоть где-нибудь отсутствует —
    // НЕ ПИШЕМ В SUPABASE.
    // ========================================================

    const postingsWithoutCluster:
      Array<{
        posting_number:
          string;

        warehouse_id:
          string;

        warehouse_name:
          string;
      }> =
        [];


    for (
      const posting
      of uniquePostings
    ) {

      // Если в отправлении вообще
      // нет товаров, оно нам не влияет
      // на товарные продажи.
      if (
        !Array.isArray(
          posting.products
        )
        ||
        posting.products.length ===
          0
      ) {
        continue;
      }


      const clusterFrom =
        normalizeText(
          posting
            .financial_data
            ?.cluster_from
        );


      if (!clusterFrom) {

        postingsWithoutCluster.push(
          {
            posting_number:
              normalizeText(
                posting
                  .posting_number
              )
              ||
              "без номера",

            warehouse_id:
              normalizeText(
                posting
                  .analytics_data
                  ?.warehouse_id
              )
              ||
              "—",

            warehouse_name:
              normalizeText(
                posting
                  .analytics_data
                  ?.warehouse_name
              )
              ||
              "—",
          }
        );

      }

    }


    if (
      postingsWithoutCluster.length >
      0
    ) {

      const examples =
        postingsWithoutCluster
          .slice(
            0,
            10
          )
          .map(
            (
              item
            ) =>
              `${item.posting_number}: ${item.warehouse_name}`
          )
          .join(
            "; "
          );


      throw new Error(
        `У ${postingsWithoutCluster.length} отправлений отсутствует financial_data.cluster_from. Примеры: ${examples}`
      );

    }


    // ========================================================
    // 6. СТАТУСЫ
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
        normalizeText(
          posting.status
        )
          .toLowerCase()
        ||
        "unknown";


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
    // 7. СОБИРАЕМ PRODUCTS
    // ========================================================

    const productsByOffer =
      new Map<
        string,
        ProductForSupabase
      >();


    // ========================================================
    // 8. АГРЕГАЦИЯ
    //
    // КЛЮЧ:
    //
    // sale_date
    // +
    // offer_id
    // +
    // cluster_from
    //
    // ВАЖНО:
    // cluster_from — строковый идентификатор
    // нашего кластера продаж.
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

      const products =
        Array.isArray(
          posting.products
        )
          ? posting.products
          : [];


      if (
        products.length === 0
      ) {
        continue;
      }


      const status =
        normalizeText(
          posting.status
        )
          .toLowerCase();


      const isCancelled =
        status ===
        "cancelled";


      // ======================================================
      // ДАТА
      // ======================================================

      const createdAt =
        normalizeText(
          posting.created_at
        );


      if (!createdAt) {

        throw new Error(
          `У отправления ${
            normalizeText(
              posting.posting_number
            )
            ||
            "без номера"
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
            normalizeText(
              posting.posting_number
            )
            ||
            "без номера"
          } попало за пределы периода: ${saleDate}`
        );

      }


      // ======================================================
      // КЛАСТЕР
      // ======================================================

      const clusterFrom =
        normalizeText(
          posting
            .financial_data
            ?.cluster_from
        );


      if (!clusterFrom) {

        // До сюда уже не должны дойти,
        // потому что проверили выше.
        throw new Error(
          `Отсутствует cluster_from у отправления ${
            normalizeText(
              posting.posting_number
            )
          }`
        );

      }


      // ======================================================
      // СКЛАД
      // ======================================================

      const warehouseId =
        normalizeText(
          posting
            .analytics_data
            ?.warehouse_id
        );


      const warehouseName =
        normalizeText(
          posting
            .analytics_data
            ?.warehouse_name
        );


      // ======================================================
      // ТОВАРЫ
      // ======================================================

      for (
        const product
        of products
      ) {

        const offerId =
          normalizeText(
            product.offer_id
          );


        if (!offerId) {

          throw new Error(
            `В отправлении ${
              normalizeText(
                posting.posting_number
              )
              ||
              "без номера"
            } найден товар без offer_id`
          );

        }


        const productName =
          normalizeText(
            product.name
          );


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


        // ====================================================
        // QUANTITY
        // ====================================================

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
            `Некорректное количество по артикулу ${offerId}`
          );

        }


        const quantity =
          Math.round(
            rawQuantity
          );


        // ====================================================
        // ВАЖНО:
        //
        // Для продаж cluster_id пока используем
        // само нормализованное название cluster_from.
        //
        // Это стабильный ключ именно исторической
        // записи отправления.
        //
        // cluster_name = такое же значение.
        //
        // Позже, когда будем делать распределение
        // поставок Ozon по кластерам, создадим
        // отдельный единый справочник кластеров
        // и свяжем его и с остатками, и с продажами.
        // ====================================================

        const clusterKey =
          clusterFrom;


        const key =
          [
            saleDate,
            offerId,
            clusterKey,
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
              clusterKey,

            cluster_name:
              clusterFrom,

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

            warehouse_names:
              new Set<string>(),
          };


        if (isCancelled) {

          existing
            .cancelled_quantity
            += quantity;


          existing
            .cancelled_posting_count++;

        } else {

          // Пользовательское правило:
          // всё, кроме cancelled,
          // считается продажами.
          existing
            .sales_quantity
            += quantity;


          existing
            .posting_count++;

        }


        if (warehouseId) {

          existing
            .warehouse_ids
            .add(
              warehouseId
            );

        }


        if (warehouseName) {

          existing
            .warehouse_names
            .add(
              warehouseName
            );

        }


        aggregate.set(
          key,
          existing
        );

      }

    }


    // ========================================================
    // 9. ГОТОВИМ СТРОКИ SUPABASE
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

              cluster_source:
                "financial_data.cluster_from",

              posting_count:
                row.posting_count,

              cancelled_posting_count:
                row.cancelled_posting_count,

              warehouse_ids:
                Array.from(
                  row.warehouse_ids
                ),

              warehouse_names:
                Array.from(
                  row.warehouse_names
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
        productsByOffer.values()
      );


    // ========================================================
    // 10. ИТОГОВЫЕ ПОКАЗАТЕЛИ
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


    const uniqueClusters =
      new Set(
        salesRows.map(
          (
            row
          ) =>
            row.cluster_name
        )
      );


    // ========================================================
    // 11. ТОЛЬКО ТЕПЕРЬ ПИШЕМ В SUPABASE
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
    // 12. УСПЕХ
    // ========================================================

    return NextResponse.json(
      {
        ok:
          true,

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
            uniqueClusters.size,

          aggregatedRows:
            salesRows.length,

          salesQuantityExcludingCancelled:
            totalSalesQuantity,

          cancelledQuantity:
            totalCancelledQuantity,

          clusterSource:
            "financial_data.cluster_from",

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
      "Ozon sales sync error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Продажи Ozon не обновлены",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка синхронизации продаж Ozon",
      },
      {
        status:
          500,
      }
    );

  }

}
