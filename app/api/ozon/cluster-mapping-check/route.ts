export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const OZON_API_BASE =
  "https://api-seller.ozon.ru";

const OZON_MAX_RETRIES =
  5;

const OZON_REQUEST_INTERVAL_MS =
  125;

const OZON_RETRY_BASE_MS =
  1500;

const MAX_POSTING_PAGES =
  1000;


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

  type?:
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

  created_at?:
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
    string;
};


// ============================================================
// СОСТОЯНИЕ RATE LIMIT
// ============================================================

let lastOzonRequestAt =
  0;


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


async function waitForOzonSlot() {

  const now =
    Date.now();


  const nextAllowed =
    lastOzonRequestAt
    +
    OZON_REQUEST_INTERVAL_MS;


  if (
    nextAllowed >
    now
  ) {

    await sleep(
      nextAllowed
      -
      now
    );

  }


  lastOzonRequestAt =
    Date.now();

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

    await waitForOzonSlot();


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
        response.status ===
          429
        ||
        response.status >=
          500
      ) {

        if (
          attempt <
          OZON_MAX_RETRIES
        ) {

          await sleep(
            OZON_RETRY_BASE_MS
            *
            attempt
          );


          continue;

        }

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
        OZON_RETRY_BASE_MS
        *
        attempt
      );

    }

  }


  throw (
    lastError
    instanceof Error

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
// FBO POSTINGS С FINANCIAL_DATA
// ============================================================

async function getFboPostings(
  dateFrom:
    string,

  dateTo:
    string
) {

  const postings:
    FboPosting[] =
    [];


  let cursor =
    "";


  let requestsMade =
    0;


  for (
    let page = 1;
    page <= MAX_POSTING_PAGES;
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


    if (
      !response.has_next
    ) {

      return {
        postings,

        requestsMade,
      };

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


  throw new Error(
    "Превышен лимит страниц FBO postings"
  );

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
    // 2. СПРАВОЧНИК КЛАСТЕРОВ
    // ========================================================

    const clusters =
      await getAllClusters();


    const clustersByNormalizedName =
      new Map<
        string,
        ClusterReference[]
      >();


    for (
      const cluster
      of clusters
    ) {

      const normalized =
        normalizeClusterName(
          cluster.name
        );


      if (!normalized) {

        continue;

      }


      const current =
        clustersByNormalizedName.get(
          normalized
        )
        ??
        [];


      current.push(
        cluster
      );


      clustersByNormalizedName.set(
        normalized,
        current
      );

    }


    // ========================================================
    // 3. POSTINGS С CLUSTER_TO
    // ========================================================

    const postingResult =
      await getFboPostings(
        latestSync.date_from,
        latestSync.date_to
      );


    const postings =
      postingResult.postings;


    // ========================================================
    // 4. АНАЛИЗ CLUSTER_TO
    // ========================================================

    let postingsWithClusterTo =
      0;


    let postingsWithoutClusterTo =
      0;


    let postingsMatchedToCluster =
      0;


    let postingsAmbiguousCluster =
      0;


    let postingsUnmatchedCluster =
      0;


    const clusterToStats =
      new Map<
        string,
        {
          raw_name:
            string;

          postings:
            number;

          products:
            number;

          units:
            number;

          matches:
            ClusterReference[];
        }
      >();


    const missingByStatus =
      new Map<
        string,
        number
      >();


    const warehouseClusterToMap =
      new Map<
        string,
        {
          warehouse_name:
            string
            | null;

          cluster_to_values:
            Set<string>;

          postings:
            number;
        }
      >();


    for (
      const posting
      of postings
    ) {

      const clusterTo =
        normalizeKey(
          posting
            .financial_data
            ?.cluster_to
        );


      const status =
        normalizeKey(
          posting.status
        )
        ||
        "unknown";


      const products =
        posting.products
        ??
        [];


      const productRows =
        products.length;


      const units =
        products.reduce(
          (
            total,
            product
          ) =>
            total
            +
            Math.max(
              0,
              Number(
                product.quantity
                ??
                0
              )
              ||
              0
            ),

          0
        );


      // ======================================================
      // WAREHOUSE -> CLUSTER_TO ДЛЯ ДИАГНОСТИКИ
      // ======================================================

      const warehouseId =
        normalizeKey(
          posting
            .analytics_data
            ?.warehouse_id
        );


      if (warehouseId) {

        let warehouse =
          warehouseClusterToMap.get(
            warehouseId
          );


        if (!warehouse) {

          warehouse = {
            warehouse_name:
              normalizeKey(
                posting
                  .analytics_data
                  ?.warehouse_name
              )
              ||
              null,

            cluster_to_values:
              new Set<string>(),

            postings:
              0,
          };


          warehouseClusterToMap.set(
            warehouseId,
            warehouse
          );

        }


        warehouse.postings +=
          1;


        if (clusterTo) {

          warehouse
            .cluster_to_values
            .add(
              clusterTo
            );

        }

      }


      // ======================================================
      // НЕТ CLUSTER_TO
      // ======================================================

      if (!clusterTo) {

        postingsWithoutClusterTo +=
          1;


        missingByStatus.set(
          status,
          (
            missingByStatus.get(
              status
            )
            ??
            0
          )
          +
          1
        );


        continue;

      }


      postingsWithClusterTo +=
        1;


      const normalized =
        normalizeClusterName(
          clusterTo
        );


      const matches =
        clustersByNormalizedName.get(
          normalized
        )
        ??
        [];


      if (
        matches.length ===
        1
      ) {

        postingsMatchedToCluster +=
          1;

      } else if (
        matches.length >
        1
      ) {

        postingsAmbiguousCluster +=
          1;

      } else {

        postingsUnmatchedCluster +=
          1;

      }


      let current =
        clusterToStats.get(
          normalized
        );


      if (!current) {

        current = {
          raw_name:
            clusterTo,

          postings:
            0,

          products:
            0,

          units:
            0,

          matches,
        };


        clusterToStats.set(
          normalized,
          current
        );

      }


      current.postings +=
        1;


      current.products +=
        productRows;


      current.units +=
        units;

    }


    // ========================================================
    // 5. УНИКАЛЬНЫЕ CLUSTER_TO
    // ========================================================

    const uniqueClusterTo =
      Array.from(
        clusterToStats.values()
      );


    const matchedClusterTo =
      uniqueClusterTo.filter(
        row =>
          row.matches.length ===
          1
      );


    const ambiguousClusterTo =
      uniqueClusterTo.filter(
        row =>
          row.matches.length >
          1
      );


    const unmatchedClusterTo =
      uniqueClusterTo.filter(
        row =>
          row.matches.length ===
          0
      );


    // ========================================================
    // 6. МОЖНО ЛИ МАППИТЬ САМ WAREHOUSE_ID
    // ========================================================

    let warehousesWithOneClusterTo =
      0;


    let warehousesWithMultipleClusterTo =
      0;


    let warehousesWithoutClusterTo =
      0;


    const multipleWarehouseSample:
      Array<
        Record<
          string,
          unknown
        >
      > =
      [];


    for (
      const [
        warehouseId,
        warehouse,
      ]
      of warehouseClusterToMap
    ) {

      const size =
        warehouse
          .cluster_to_values
          .size;


      if (
        size ===
        0
      ) {

        warehousesWithoutClusterTo +=
          1;

      } else if (
        size ===
        1
      ) {

        warehousesWithOneClusterTo +=
          1;

      } else {

        warehousesWithMultipleClusterTo +=
          1;


        if (
          multipleWarehouseSample.length <
          100
        ) {

          multipleWarehouseSample.push(
            {
              warehouse_id:
                warehouseId,

              warehouse_name:
                warehouse.warehouse_name,

              postings:
                warehouse.postings,

              cluster_to_values:
                Array.from(
                  warehouse
                    .cluster_to_values
                ),
            }
          );

        }

      }

    }


    // ========================================================
    // 7. ИТОГ
    // ========================================================

    const clusterToCoveragePercent =
      postings.length >
      0

        ? Number(
            (
              (
                postingsWithClusterTo
                /
                postings.length
              )
              *
              100
            ).toFixed(
              2
            )
          )

        : 100;


    const referenceMatchPercent =
      postingsWithClusterTo >
      0

        ? Number(
            (
              (
                postingsMatchedToCluster
                /
                postingsWithClusterTo
              )
              *
              100
            ).toFixed(
              2
            )
          )

        : 100;


    const readyForDirectClusterTo =
      postingsWithoutClusterTo ===
        0
      &&
      postingsUnmatchedCluster ===
        0
      &&
      postingsAmbiguousCluster ===
        0;


    return Response.json(
      {
        ok:
          true,

        mode:
          "read_only_cluster_to_check",

        writes_to_database:
          false,

        writes_to_ozon:
          false,


        latest_sync: {
          date_from:
            latestSync.date_from,

          date_to:
            latestSync.date_to,

          created_at:
            latestSync.created_at,
        },


        ozon: {
          posting_requests:
            postingResult.requestsMade,

          postings_received:
            postings.length,

          reference_clusters:
            clusters.length,
        },


        cluster_to_coverage: {
          postings_with_cluster_to:
            postingsWithClusterTo,

          postings_without_cluster_to:
            postingsWithoutClusterTo,

          coverage_percent:
            clusterToCoveragePercent,

          missing_by_status:
            Object.fromEntries(
              missingByStatus
            ),
        },


        cluster_to_reference_match: {
          postings_matched:
            postingsMatchedToCluster,

          postings_unmatched:
            postingsUnmatchedCluster,

          postings_ambiguous:
            postingsAmbiguousCluster,

          match_percent:
            referenceMatchPercent,

          unique_cluster_to:
            uniqueClusterTo.length,

          unique_matched:
            matchedClusterTo.length,

          unique_unmatched:
            unmatchedClusterTo.length,

          unique_ambiguous:
            ambiguousClusterTo.length,
        },


        matched_clusters:
          matchedClusterTo.map(
            row => ({
              cluster_to:
                row.raw_name,

              postings:
                row.postings,

              products:
                row.products,

              units:
                row.units,

              cluster:
                row.matches[
                  0
                ],
            })
          ),


        unmatched_clusters:
          unmatchedClusterTo.map(
            row => ({
              cluster_to:
                row.raw_name,

              postings:
                row.postings,

              products:
                row.products,

              units:
                row.units,
            })
          ),


        ambiguous_clusters:
          ambiguousClusterTo.map(
            row => ({
              cluster_to:
                row.raw_name,

              postings:
                row.postings,

              products:
                row.products,

              units:
                row.units,

              matches:
                row.matches,
            })
          ),


        warehouse_diagnostic: {
          unique_warehouse_ids:
            warehouseClusterToMap.size,

          warehouses_with_one_cluster_to:
            warehousesWithOneClusterTo,

          warehouses_with_multiple_cluster_to:
            warehousesWithMultipleClusterTo,

          warehouses_without_cluster_to:
            warehousesWithoutClusterTo,

          multiple_cluster_to_sample:
            multipleWarehouseSample,
        },


        ready_for_direct_cluster_to_mapping:
          readyForDirectClusterTo,


        conclusion:
          readyForDirectClusterTo

            ? "financial_data.cluster_to покрывает все FBO postings и однозначно совпадает со справочником /v1/cluster/list. Можно использовать cluster_to как источник кластера продаж."

            : "cluster_to помогает, но покрытие или соответствие справочнику ещё не 100%. Смотрим unmatched_clusters, ambiguous_clusters и missing_by_status.",


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
      "OZON CLUSTER_TO CHECK ERROR",
      error
    );


    return Response.json(
      {
        ok:
          false,

        mode:
          "read_only_cluster_to_check",

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
