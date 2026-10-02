import {
  NextResponse,
} from "next/server";


// ============================================================
// ТЕСТ КЛАСТЕРОВ ПРОДАЖ OZON
//
// НИЧЕГО НЕ ЗАПИСЫВАЕТ В SUPABASE.
//
// ЦЕЛЬ:
// проверить financial_data.cluster_from
// на ВСЕХ FBO-отправлениях за 28 завершённых дней.
// ============================================================


// ============================================================
// ТИПЫ
// ============================================================

type OzonPostingProduct = {
  sku?: number | string;

  name?: string;

  quantity?: number;

  offer_id?: string;
};


type OzonPostingAnalytics = {
  warehouse_id?: number | string;

  warehouse_name?: string;

  city?: string;
};


type OzonPostingFinancialData = {
  cluster_from?: string;

  cluster_to?: string;

  products?: unknown[];
};


type OzonFboPosting = {
  posting_number?: string;

  order_number?: string;

  status?: string;

  created_at?: string;

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

  cursor?: string;

  has_next?: boolean;
};


// ============================================================
// HEADERS OZON
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
// POST В OZON
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
// 28 ЗАВЕРШЁННЫХ ДНЕЙ ПО МОСКВЕ
// ============================================================

function getCompletedMoscowRange(
  numberOfDays: number
) {

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


  const endDate =
    new Date(
      todayMoscow.getTime()
    );


  endDate.setUTCDate(
    endDate.getUTCDate() - 1
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
// GET — ТЕСТ ВСЕХ 28 ДНЕЙ
// ============================================================

export async function GET() {

  try {

    const range =
      getCompletedMoscowRange(
        28
      );


    // ========================================================
    // 1. ПОЛУЧАЕМ ВСЕ СТРАНИЦЫ
    // ========================================================

    const allPostings:
      OzonFboPosting[] = [];


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

            limit:
              100,

            sort_dir:
              "asc",

            translit:
              false,

            with: {

              analytics_data:
                true,

              // =================================
              // ВАЖНО:
              // включаем financial_data,
              // чтобы получить cluster_from.
              // =================================

              financial_data:
                true,

              legal_info:
                false,

            },
          }
        );


      pagesLoaded++;


      const postings =
        Array.isArray(
          response.postings
        )
          ? response.postings
          : [];


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
        )
          .trim();


      if (!nextCursor) {

        throw new Error(
          "Ozon сообщил has_next=true, но cursor пуст"
        );

      }


      if (
        seenCursors.has(
          nextCursor
        )
      ) {

        throw new Error(
          "Ozon вернул повторяющийся cursor"
        );

      }


      seenCursors.add(
        nextCursor
      );


      cursor =
        nextCursor;


      await sleep(
        100
      );

    }


    // ========================================================
    // 2. ДЕДУПЛИЦИРУЕМ
    // ========================================================

    const postingsByNumber =
      new Map<
        string,
        OzonFboPosting
      >();


    allPostings.forEach(
      (
        posting,
        index
      ) => {

        const postingNumber =
          String(
            posting.posting_number
            ?? ""
          )
            .trim();


        postingsByNumber.set(
          postingNumber
          ||
          `NO_NUMBER_${index}`,
          posting
        );

      }
    );


    const postings =
      Array.from(
        postingsByNumber.values()
      );


    // ========================================================
    // 3. ПРОВЕРЯЕМ CLUSTER_FROM
    // ========================================================

    let withClusterFrom =
      0;


    let withoutClusterFrom =
      0;


    const missingExamples:
      Array<{
        posting_number:
          string | null;

        warehouse_id:
          string | null;

        warehouse_name:
          string | null;

        status:
          string | null;
      }> = [];


    const clusterCounts =
      new Map<
        string,
        number
      >();


    for (
      const posting
      of postings
    ) {

      const clusterFrom =
        String(
          posting
            .financial_data
            ?.cluster_from
          ?? ""
        )
          .trim();


      if (clusterFrom) {

        withClusterFrom++;


        clusterCounts.set(

          clusterFrom,

          (
            clusterCounts.get(
              clusterFrom
            )
            ?? 0
          )
          + 1

        );

      } else {

        withoutClusterFrom++;


        if (
          missingExamples.length <
          20
        ) {

          missingExamples.push(
            {
              posting_number:
                posting
                  .posting_number
                ?? null,

              warehouse_id:
                posting
                  .analytics_data
                  ?.warehouse_id
                !== undefined
                  ? String(
                      posting
                        .analytics_data
                        ?.warehouse_id
                    )
                  : null,

              warehouse_name:
                posting
                  .analytics_data
                  ?.warehouse_name
                ?? null,

              status:
                posting.status
                ?? null,
            }
          );

        }

      }

    }


    // ========================================================
    // 4. СТАТУСЫ
    // ========================================================

    const statusCounts:
      Record<
        string,
        number
      > = {};


    for (
      const posting
      of postings
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

    }


    // ========================================================
    // 5. СПИСОК КЛАСТЕРОВ
    // ========================================================

    const clusters =
      Array.from(
        clusterCounts.entries()
      )
        .map(
          (
            [
              cluster,
              postingsCount,
            ]
          ) => ({
            cluster,
            postingsCount,
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            b.postingsCount
            -
            a.postingsCount
        );


    // ========================================================
    // 6. РЕЗУЛЬТАТ
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        message:
          "Проверка cluster_from завершена",

        writesData:
          false,

        period: {

          completedDays:
            28,

          dateFrom:
            range.dateFrom,

          dateTo:
            range.dateTo,

          timezone:
            "Europe/Moscow",

        },

        pagesLoaded,

        postings: {

          received:
            allPostings.length,

          unique:
            postings.length,

          withClusterFrom,

          withoutClusterFrom,

        },

        statusCounts,

        uniqueClusterFromValues:
          clusters.length,

        clusters,

        missingClusterFromExamples:
          missingExamples,

      },
      {
        status: 200,
      }
    );


  } catch (error) {

    return NextResponse.json(
      {
        ok: false,

        writesData:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка проверки cluster_from",
      },
      {
        status: 500,
      }
    );

  }

}
