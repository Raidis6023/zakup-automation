export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  60;


// ============================================================
// ТИПЫ
// ============================================================

type FboPostingProduct = {
  sku?:
    | string
    | number;

  offer_id?:
    | string;

  name?:
    | string;

  quantity?:
    | number;
};


type FboPostingAnalytics = {
  warehouse_id?:
    | string
    | number;

  warehouse_name?:
    | string;

  city?:
    | string;

  delivery_type?:
    | string;

  [key: string]:
    unknown;
};


type FboPostingFinancialData = {
  cluster_from?:
    | string
    | null;

  cluster_to?:
    | string
    | null;

  products?:
    unknown[];

  [key: string]:
    unknown;
};


type FboPosting = {
  posting_number?:
    | string;

  order_number?:
    | string;

  status?:
    | string;

  created_at?:
    | string;

  analytics_data?:
    | FboPostingAnalytics
    | null;

  financial_data?:
    | FboPostingFinancialData
    | null;

  products?:
    FboPostingProduct[];

  [key: string]:
    unknown;
};


type FboPostingResponse = {
  postings?:
    FboPosting[];

  cursor?:
    string;

  has_next?:
    boolean;
};


// ============================================================
// КОНФИГ
// ============================================================

function getConfig() {

  const ozonClientId =
    process.env
      .OZON_CLIENT_ID;


  const ozonApiKey =
    process.env
      .OZON_API_KEY;


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


  if (!cronSecret) {

    throw new Error(
      "Не найдена переменная CRON_SECRET"
    );

  }


  return {
    ozonClientId,
    ozonApiKey,
    cronSecret,
  };
}


// ============================================================
// АВТОРИЗАЦИЯ
// ============================================================

function isAuthorized(
  request:
    Request
) {

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
// НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeText(
  value:
    unknown
):
string {

  return String(
    value
    ?? ""
  ).trim();
}


// ============================================================
// OZON
// ============================================================

async function loadFboPostings() {

  const {
    ozonClientId,
    ozonApiKey,
  } =
    getConfig();


  const now =
    new Date();


  const since =
    new Date(
      now.getTime()
      -
      (
        24
        *
        60
        *
        60
        *
        1000
      )
    );


  const body = {
    cursor:
      "",

    filter: {
      since:
        since.toISOString(),

      to:
        now.toISOString(),
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
  };


  const response =
    await fetch(
      "https://api-seller.ozon.ru/v3/posting/fbo/list",
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
      }
    );


  const text =
    await response.text();


  let parsed:
    unknown;


  try {

    parsed =
      JSON.parse(
        text
      );

  } catch {

    parsed =
      text;

  }


  if (!response.ok) {

    throw new Error(
      `Ozon HTTP ${response.status}: ${text}`
    );

  }


  return {
    since:
      since.toISOString(),

    to:
      now.toISOString(),

    response:
      parsed as FboPostingResponse,
  };
}


// ============================================================
// GET
// ============================================================

export async function GET(
  request:
    Request
) {

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


    const result =
      await loadFboPostings();


    const postings =
      result
        .response
        .postings
      ?? [];


    const clusterFromCounts =
      new Map<
        string,
        number
      >();


    const clusterToCounts =
      new Map<
        string,
        number
      >();


    let withFinancialData =
      0;


    let withoutFinancialData =
      0;


    let withClusterFrom =
      0;


    let withoutClusterFrom =
      0;


    for (
      const posting
      of postings
    ) {

      const financialData =
        posting
          .financial_data
        ?? null;


      if (financialData) {

        withFinancialData +=
          1;

      } else {

        withoutFinancialData +=
          1;

      }


      const clusterFrom =
        normalizeText(
          financialData
            ?.cluster_from
        );


      const clusterTo =
        normalizeText(
          financialData
            ?.cluster_to
        );


      if (clusterFrom) {

        withClusterFrom +=
          1;


        clusterFromCounts.set(
          clusterFrom,
          (
            clusterFromCounts.get(
              clusterFrom
            )
            ?? 0
          )
          +
          1
        );

      } else {

        withoutClusterFrom +=
          1;

      }


      if (clusterTo) {

        clusterToCounts.set(
          clusterTo,
          (
            clusterToCounts.get(
              clusterTo
            )
            ?? 0
          )
          +
          1
        );

      }

    }


    const clusterFrom =
      Array.from(
        clusterFromCounts
          .entries()
      )
        .map(
          (
            [
              cluster,
              postingsCount,
            ]
          ) => ({
            cluster,
            postings_count:
              postingsCount,
          })
        )
        .sort(
          (
            left,
            right
          ) =>
            right.postings_count
            -
            left.postings_count
        );


    const clusterTo =
      Array.from(
        clusterToCounts
          .entries()
      )
        .map(
          (
            [
              cluster,
              postingsCount,
            ]
          ) => ({
            cluster,
            postings_count:
              postingsCount,
          })
        )
        .sort(
          (
            left,
            right
          ) =>
            right.postings_count
            -
            left.postings_count
        );


    const samples =
      postings
        .slice(
          0,
          30
        )
        .map(
          posting => ({
            posting_number:
              posting
                .posting_number
              ?? null,

            status:
              posting
                .status
              ?? null,

            created_at:
              posting
                .created_at
              ?? null,

            warehouse_id:
              posting
                .analytics_data
                ?.warehouse_id
              ?? null,

            warehouse_name:
              posting
                .analytics_data
                ?.warehouse_name
              ?? null,

            cluster_from:
              posting
                .financial_data
                ?.cluster_from
              ?? null,

            cluster_to:
              posting
                .financial_data
                ?.cluster_to
              ?? null,

            products:
              (
                posting.products
                ?? []
              ).map(
                product => ({
                  offer_id:
                    product
                      .offer_id
                    ?? null,

                  sku:
                    product
                      .sku
                    ?? null,

                  quantity:
                    product
                      .quantity
                    ?? 0,
                })
              ),
          })
        );


    return Response.json(
      {
        ok:
          true,

        mode:
          "read_only_debug",

        writes_to_database:
          false,

        period: {
          since:
            result.since,

          to:
            result.to,
        },

        pagination: {
          postings_received:
            postings.length,

          has_next:
            result
              .response
              .has_next
            ?? false,

          cursor_present:
            Boolean(
              result
                .response
                .cursor
            ),
        },

        financial_data: {
          with_financial_data:
            withFinancialData,

          without_financial_data:
            withoutFinancialData,

          with_cluster_from:
            withClusterFrom,

          without_cluster_from:
            withoutClusterFrom,
        },

        cluster_from:
          clusterFrom,

        cluster_to:
          clusterTo,

        samples,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    return Response.json(
      {
        ok:
          false,

        mode:
          "read_only_debug",

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


// ============================================================
// POST
//
// Делаем то же самое, чтобы при необходимости можно было
// вызвать endpoint POST-запросом.
// ============================================================

export async function POST(
  request:
    Request
) {

  return GET(
    request
  );
}
