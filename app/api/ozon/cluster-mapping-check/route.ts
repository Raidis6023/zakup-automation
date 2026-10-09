export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const OZON_API_BASE =
  "https://api-seller.ozon.ru";

const TEST_PAGE_SIZE =
  100;

const MAX_TEST_PAGES =
  5;

const OZON_MAX_RETRIES =
  3;

const RETRY_DELAY_MS =
  1500;


// ============================================================
// ТИПЫ
// ============================================================

type LatestSyncRun = {
  date_from:
    string;

  date_to:
    string;

  created_at:
    string;
};


type OzonCluster = {
  id?:
    string
    | number;

  name?:
    string;
};


type ClusterListResponse = {
  clusters?:
    OzonCluster[];
};


type FboPosting = {
  posting_number?:
    string;

  status?:
    string;

  analytics_data?: {
    warehouse_id?:
      string
      | number;

    warehouse_name?:
      string;

    city?:
      string;
  } | null;

  financial_data?: {
    cluster_from?:
      string;

    cluster_to?:
      string;
  } | null;

  products?:
    Array<{
      sku?:
        string
        | number;

      offer_id?:
        string;

      quantity?:
        number;
    }>;
};


type PostingListResponse = {
  cursor?:
    string;

  has_next?:
    boolean;

  postings?:
    FboPosting[];
};


type ClusterReference = {
  id:
    string;

  name:
    string;

  type:
    "CLUSTER_TYPE_OZON"
    | "CLUSTER_TYPE_CIS";
};


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


  if (!ozonClientId) {

    throw new Error(
      "Не найдена OZON_CLIENT_ID"
    );

  }


  if (!ozonApiKey) {

    throw new Error(
      "Не найдена OZON_API_KEY"
    );

  }


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY"
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
// HELPERS
// ============================================================

function normalizeKey(
  value:
    unknown
): string {

  return String(
    value
    ??
    ""
  ).trim();

}


function normalizeClusterName(
  value:
    unknown
): string {

  return normalizeKey(
    value
  )
    .toLowerCase()
    .replace(
      /ё/g,
      "е"
    )
    .replace(
      /[^a-zа-я0-9]+/gi,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


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
// SUPABASE GET
// ============================================================

async function supabaseGet<T>(
  url:
    URL
):
Promise<T> {

  const {
    supabaseSecretKey,
  } =
    getConfig();


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
      `Supabase GET ${response.status}: ${text}`
    );

  }


  if (!text) {

    return [] as T;

  }


  return JSON.parse(
    text
  ) as T;

}


// ============================================================
// OZON POST
// ============================================================

async function ozonPost<T>(
  path:
    string,

  body:
    unknown
):
Promise<T> {

  const {
    ozonClientId,
    ozonApiKey,
  } =
    getConfig();


  let lastError:
    unknown =
    null;


  for (
    let attempt = 1;
    attempt <= OZON_MAX_RETRIES;
    attempt += 1
  ) {

    try {

      const response =
        await fetch(
          `${OZON_API_BASE}${path}`,
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


      if (
        (
          response.status ===
            429
          ||
          response.status >=
            500
        )
        &&
        attempt <
          OZON_MAX_RETRIES
      ) {

        await sleep(
          RETRY_DELAY_MS
          *
          attempt
        );


        continue;

      }


      if (!response.ok) {

        throw new Error(
          `Ozon ${path} HTTP ${response.status}: ${text}`
        );

      }


      if (!text) {

        return {} as T;

      }


      return JSON.parse(
        text
      ) as T;

    } catch (error) {

      lastError =
        error;


      if (
        attempt >=
        OZON_MAX_RETRIES
      ) {

        break;

      }


      await sleep(
        RETRY_DELAY_MS
        *
        attempt
      );

    }

  }


  throw (
    lastError instanceof Error

      ? lastError

      : new Error(
          String(
            lastError
            ??
            "Ошибка Ozon API"
          )
        )
  );

}


// ============================================================
// ПОСЛЕДНЯЯ УСПЕШНАЯ СИНХРОНИЗАЦИЯ
// ============================================================

async function getLatestSyncRun():
Promise<
  LatestSyncRun
  | null
> {

  const {
    supabaseUrl,
  } =
    getConfig();


  const url =
    new URL(
      `${supabaseUrl}/rest/v1/ozon_sales_sync_runs`
    );


  url.searchParams.set(
    "select",
    "date_from,date_to,created_at"
  );


  url.searchParams.set(
    "status",
    "eq.success"
  );


  url.searchParams.set(
    "completed_days",
    "eq.28"
  );


  url.searchParams.set(
    "order",
    "created_at.desc"
  );


  url.searchParams.set(
    "limit",
    "1"
  );


  const rows =
    await supabaseGet<
      LatestSyncRun[]
    >(
      url
    );


  return (
    rows[
      0
    ]
    ??
    null
  );

}


// ============================================================
// КЛАСТЕРЫ РФ + СНГ
// ============================================================

async function getAllClusters():
Promise<ClusterReference[]> {

  const [
    ozonResponse,
    cisResponse,
  ] =
    await Promise.all(
      [
        ozonPost<
          ClusterListResponse
        >(
          "/v1/cluster/list",
          {
            cluster_type:
              "CLUSTER_TYPE_OZON",
          }
        ),

        ozonPost<
          ClusterListResponse
        >(
          "/v1/cluster/list",
          {
            cluster_type:
              "CLUSTER_TYPE_CIS",
          }
        ),
      ]
    );


  const result:
    ClusterReference[] =
    [];


  for (
    const cluster
    of ozonResponse.clusters
    ??
    []
  ) {

    const id =
      normalizeKey(
        cluster.id
      );


    const name =
      normalizeKey(
        cluster.name
      );


    if (
      !id
      ||
      !name
    ) {

      continue;

    }


    result.push(
      {
        id,

        name,

        type:
          "CLUSTER_TYPE_OZON",
      }
    );

  }


  for (
    const cluster
    of cisResponse.clusters
    ??
    []
  ) {

    const id =
      normalizeKey(
        cluster.id
      );


    const name =
      normalizeKey(
        cluster.name
      );


    if (
      !id
      ||
      !name
    ) {

      continue;

    }


    result.push(
      {
        id,

        name,

        type:
          "CLUSTER_TYPE_CIS",
      }
    );

  }


  return result;

}


// ============================================================
// БЫСТРАЯ ВЫБОРКА FBO
//
// Только один день.
// Максимум 5 × 100 = 500 postings.
// ============================================================

async function getPostingSample(
  date:
    string
) {

  const postings:
    FboPosting[] =
    [];


  let cursor =
    "";


  let requestsMade =
    0;


  let hasMore =
    false;


  for (
    let page = 1;
    page <= MAX_TEST_PAGES;
    page += 1
  ) {

    const response =
      await ozonPost<
        PostingListResponse
      >(
        "/v3/posting/fbo/list",
        {
          cursor,

          filter: {
            since:
              `${date}T00:00:00+03:00`,

            to:
              `${date}T23:59:59+03:00`,
          },

          limit:
            TEST_PAGE_SIZE,

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
      );


    requestsMade +=
      1;


    postings.push(
      ...(
        response.postings
        ??
        []
      )
    );


    hasMore =
      Boolean(
        response.has_next
      );


    if (!hasMore) {

      break;

    }


    const nextCursor =
      normalizeKey(
        response.cursor
      );


    if (
      !nextCursor
      ||
      nextCursor ===
        cursor
    ) {

      throw new Error(
        "Ozon вернул has_next=true без нового cursor"
      );

    }


    cursor =
      nextCursor;

  }


  return {
    postings,
    requestsMade,
    hasMore,
  };

}


// ============================================================
// GET
// ============================================================

export async function GET() {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // 1. ПОСЛЕДНИЙ SYNC
    // ========================================================

    const latestSync =
      await getLatestSyncRun();


    if (!latestSync) {

      return Response.json(
        {
          ok:
            false,

          error:
            "Не найдена последняя успешная синхронизация Ozon",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 2. СПРАВОЧНИК
    // ========================================================

    const clusters =
      await getAllClusters();


    const clustersByName =
      new Map<
        string,
        ClusterReference[]
      >();


    for (
      const cluster
      of clusters
    ) {

      const key =
        normalizeClusterName(
          cluster.name
        );


      if (!key) {

        continue;

      }


      const current =
        clustersByName.get(
          key
        )
        ??
        [];


      current.push(
        cluster
      );


      clustersByName.set(
        key,
        current
      );

    }


    // ========================================================
    // 3. БЕРЁМ ТОЛЬКО ПОСЛЕДНИЙ ДЕНЬ
    // ========================================================

    const sample =
      await getPostingSample(
        latestSync.date_to
      );


    // ========================================================
    // 4. АНАЛИЗ
    // ========================================================

    let withClusterTo =
      0;


    let withoutClusterTo =
      0;


    let matched =
      0;


    let unmatched =
      0;


    let ambiguous =
      0;


    const clusterStats =
      new Map<
        string,
        {
          cluster_to:
            string;

          postings:
            number;

          matches:
            ClusterReference[];
        }
      >();


    const missingSample:
      Array<
        Record<
          string,
          unknown
        >
      > =
      [];


    for (
      const posting
      of sample.postings
    ) {

      const clusterTo =
        normalizeKey(
          posting
            .financial_data
            ?.cluster_to
        );


      if (!clusterTo) {

        withoutClusterTo +=
          1;


        if (
          missingSample.length <
          30
        ) {

          missingSample.push(
            {
              posting_number:
                posting.posting_number
                ??
                null,

              status:
                posting.status
                ??
                null,

              warehouse_id:
                posting.analytics_data
                  ?.warehouse_id
                ??
                null,

              warehouse_name:
                posting.analytics_data
                  ?.warehouse_name
                ??
                null,
            }
          );

        }


        continue;

      }


      withClusterTo +=
        1;


      const normalized =
        normalizeClusterName(
          clusterTo
        );


      const matches =
        clustersByName.get(
          normalized
        )
        ??
        [];


      if (
        matches.length ===
        1
      ) {

        matched +=
          1;

      } else if (
        matches.length >
        1
      ) {

        ambiguous +=
          1;

      } else {

        unmatched +=
          1;

      }


      let stats =
        clusterStats.get(
          normalized
        );


      if (!stats) {

        stats = {
          cluster_to:
            clusterTo,

          postings:
            0,

          matches,
        };


        clusterStats.set(
          normalized,
          stats
        );

      }


      stats.postings +=
        1;

    }


    const uniqueClusters =
      Array.from(
        clusterStats.values()
      );


    const matchedClusters =
      uniqueClusters.filter(
        row =>
          row.matches.length ===
          1
      );


    const unmatchedClusters =
      uniqueClusters.filter(
        row =>
          row.matches.length ===
          0
      );


    const ambiguousClusters =
      uniqueClusters.filter(
        row =>
          row.matches.length >
          1
      );


    const ready =
      sample.postings.length >
        0
      &&
      withoutClusterTo ===
        0
      &&
      unmatched ===
        0
      &&
      ambiguous ===
        0;


    // ========================================================
    // 5. RESPONSE
    // ========================================================

    return Response.json(
      {
        ok:
          true,

        mode:
          "fast_cluster_to_sample",

        writes_to_database:
          false,

        writes_to_ozon:
          false,


        sample: {
          date:
            latestSync.date_to,

          max_pages:
            MAX_TEST_PAGES,

          page_size:
            TEST_PAGE_SIZE,

          requests_made:
            sample.requestsMade,

          postings_loaded:
            sample.postings.length,

          ozon_has_more:
            sample.hasMore,
        },


        cluster_to: {
          with_cluster_to:
            withClusterTo,

          without_cluster_to:
            withoutClusterTo,

          coverage_percent:
            sample.postings.length >
            0

              ? Number(
                  (
                    (
                      withClusterTo
                      /
                      sample.postings.length
                    )
                    *
                    100
                  ).toFixed(
                    2
                  )
                )

              : 0,
        },


        reference_match: {
          matched_postings:
            matched,

          unmatched_postings:
            unmatched,

          ambiguous_postings:
            ambiguous,

          unique_cluster_to:
            uniqueClusters.length,

          unique_matched:
            matchedClusters.length,

          unique_unmatched:
            unmatchedClusters.length,

          unique_ambiguous:
            ambiguousClusters.length,
        },


        matched_clusters:
          matchedClusters.map(
            row => ({
              cluster_to:
                row.cluster_to,

              postings:
                row.postings,

              cluster:
                row.matches[
                  0
                ],
            })
          ),


        unmatched_clusters:
          unmatchedClusters.map(
            row => ({
              cluster_to:
                row.cluster_to,

              postings:
                row.postings,
            })
          ),


        ambiguous_clusters:
          ambiguousClusters.map(
            row => ({
              cluster_to:
                row.cluster_to,

              postings:
                row.postings,

              matches:
                row.matches,
            })
          ),


        missing_cluster_to_sample:
          missingSample,


        ready_for_cluster_to_mapping:
          ready,


        conclusion:
          ready

            ? "На тестовой выборке cluster_to заполнен у всех отправлений и однозначно сопоставляется со справочником Ozon."

            : "Тестовая выборка показала ограничения cluster_to. Смотрим coverage и unmatched/missing.",


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
      "OZON FAST CLUSTER_TO CHECK ERROR",
      error
    );


    return Response.json(
      {
        ok:
          false,

        mode:
          "fast_cluster_to_sample",

        writes_to_database:
          false,

        writes_to_ozon:
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
