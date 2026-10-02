import {
  NextResponse,
} from "next/server";


// ============================================================
// БЫСТРЫЙ ТЕСТ CLUSTER_FROM OZON
//
// НИЧЕГО НЕ ПИШЕТ В SUPABASE.
// Берёт максимум 100 FBO-отправлений.
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
};


type OzonPostingFinancialData = {
  cluster_from?: string;
  cluster_to?: string;
};


type OzonFboPosting = {
  posting_number?: string;

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
  postings?: OzonFboPosting[];

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
// ДАТЫ
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
        moscowNow.getUTCFullYear(),
        moscowNow.getUTCMonth(),
        moscowNow.getUTCDate()
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
    (numberOfDays - 1)
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
// GET
// ============================================================

export async function GET() {

  try {

    const range =
      getCompletedMoscowRange(
        28
      );


    const response =
      await fetch(
        "https://api-seller.ozon.ru/v3/posting/fbo/list",
        {
          method:
            "POST",

          headers:
            getOzonHeaders(),

          body:
            JSON.stringify(
              {
                cursor:
                  "",

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

                  financial_data:
                    true,

                  legal_info:
                    false,
                },
              }
            ),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      return NextResponse.json(
        {
          ok:
            false,

          ozonStatus:
            response.status,

          ozonResponse:
            text,
        },
        {
          status:
            response.status,
        }
      );

    }


    const data =
      JSON.parse(
        text
      ) as OzonFboResponse;


    const postings =
      Array.isArray(
        data.postings
      )
        ? data.postings
        : [];


    let withClusterFrom =
      0;


    let withoutClusterFrom =
      0;


    const clusters =
      new Map<
        string,
        number
      >();


    const examples:
      Array<{
        posting_number:
          string | null;

        status:
          string | null;

        warehouse_id:
          string | null;

        warehouse_name:
          string | null;

        cluster_from:
          string | null;

        cluster_to:
          string | null;
      }> = [];


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
        ).trim();


      if (clusterFrom) {

        withClusterFrom++;


        clusters.set(
          clusterFrom,

          (
            clusters.get(
              clusterFrom
            )
            ?? 0
          )
          + 1
        );

      } else {

        withoutClusterFrom++;

      }


      if (
        examples.length < 20
      ) {

        examples.push(
          {
            posting_number:
              posting
                .posting_number
              ?? null,

            status:
              posting.status
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

            cluster_from:
              clusterFrom
              || null,

            cluster_to:
              String(
                posting
                  .financial_data
                  ?.cluster_to
                ?? ""
              ).trim()
              || null,
          }
        );

      }

    }


    return NextResponse.json(
      {
        ok:
          true,

        message:
          "Быстрый тест cluster_from завершён",

        writesData:
          false,

        period: {
          completedDays:
            28,

          dateFrom:
            range.dateFrom,

          dateTo:
            range.dateTo,
        },

        receivedPostings:
          postings.length,

        hasNext:
          Boolean(
            data.has_next
          ),

        withClusterFrom,

        withoutClusterFrom,

        uniqueClusters:
          clusters.size,

        clusters:
          Array.from(
            clusters.entries()
          )
            .map(
              (
                [
                  cluster,
                  count,
                ]
              ) => ({
                cluster,
                count,
              })
            ),

        examples,
      },
      {
        status:
          200,
      }
    );


  } catch (error) {

    return NextResponse.json(
      {
        ok:
          false,

        writesData:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      {
        status:
          500,
      }
    );

  }

}
