export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;


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


type SalesRow = {
  product_id:
    string;

  cluster_id:
    string;

  cluster_name:
    | string
    | null;
};


type MacroClusterResponse = {
  result?:
    Array<{
      macrolocal_cluster_id?:
        string
        | number;

      data?: {
        fulfillments?:
          Array<{
            warehouse_id?:
              string
              | number;

            name?:
              string;
          }>;

        macrolocal_cluster?: {
          name?:
            string;

          country?: {
            name?:
              string;

            uid?:
              string;
          };
        };
      };
    }>;
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


function isFallbackClusterId(
  clusterId:
    string
): boolean {

  return (
    clusterId.startsWith(
      "warehouse:"
    )
    ||
    clusterId.startsWith(
      "name:"
    )
    ||
    clusterId ===
      "unknown"
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
// ВСЕ ПРОДАЖИ ЗА ПЕРИОД
//
// Не используем PostgREST or-фильтр.
// Он здесь нам уже один раз устроил цирк.
// ============================================================

async function getSalesRows(
  dateFrom:
    string,

  dateTo:
    string
):
Promise<
  SalesRow[]
> {

  const {
    supabaseUrl,
  } =
    getConfig();


  const result:
    SalesRow[] =
    [];


  const pageSize =
    1000;


  for (
    let offset = 0;
    offset < 100000;
    offset += pageSize
  ) {

    const url =
      new URL(
        `${supabaseUrl}/rest/v1/ozon_sales_daily`
      );


    url.searchParams.set(
      "select",
      [
        "product_id",
        "cluster_id",
        "cluster_name",
      ].join(
        ","
      )
    );


    url.searchParams.set(
      "sale_date",
      `gte.${dateFrom}`
    );


    url.searchParams.append(
      "sale_date",
      `lte.${dateTo}`
    );


    url.searchParams.set(
      "order",
      "sale_date.asc,product_id.asc"
    );


    url.searchParams.set(
      "limit",
      String(
        pageSize
      )
    );


    url.searchParams.set(
      "offset",
      String(
        offset
      )
    );


    const rows =
      await supabaseGet<
        SalesRow[]
      >(
        url
      );


    result.push(
      ...rows
    );


    if (
      rows.length <
      pageSize
    ) {

      break;

    }

  }


  return result;

}


// ============================================================
// OZON /v2/cluster/list
// ============================================================

async function getMacroClusters():
Promise<MacroClusterResponse> {

  const {
    ozonClientId,
    ozonApiKey,
  } =
    getConfig();


  const response =
    await fetch(
      "https://api-seller.ozon.ru/v2/cluster/list",
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
            {}
          ),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Ozon /v2/cluster/list HTTP ${response.status}: ${text}`
    );

  }


  if (!text) {

    throw new Error(
      "Ozon /v2/cluster/list вернул пустой ответ"
    );

  }


  return JSON.parse(
    text
  ) as MacroClusterResponse;

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

          mode:
            "read_only_cluster_mapping_check",

          writes_to_database:
            false,

          writes_to_ozon:
            false,

          error:
            "Не найдена успешная синхронизация Ozon",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 2. ПРОДАЖИ ЗА 28 ДНЕЙ
    // ========================================================

    const allSalesRows =
      await getSalesRows(
        latestSync.date_from,
        latestSync.date_to
      );


    // ========================================================
    // 3. ОСТАВЛЯЕМ ТОЛЬКО FALLBACK-КЛАСТЕРЫ
    // ========================================================

    const badRows =
      allSalesRows.filter(
        row =>
          isFallbackClusterId(
            normalizeKey(
              row.cluster_id
            )
          )
      );


    // ========================================================
    // 4. УНИКАЛЬНЫЕ WAREHOUSE ID
    // ========================================================

    const uniqueWarehouseIds =
      new Set<string>();


    const rowsByWarehouse =
      new Map<
        string,
        {
          cluster_name:
            string
            | null;

          product_ids:
            Set<string>;
        }
      >();


    let nameFallbackRows =
      0;


    let unknownFallbackRows =
      0;


    for (
      const row
      of badRows
    ) {

      const clusterId =
        normalizeKey(
          row.cluster_id
        );


      if (
        clusterId.startsWith(
          "name:"
        )
      ) {

        nameFallbackRows +=
          1;


        continue;

      }


      if (
        clusterId ===
        "unknown"
      ) {

        unknownFallbackRows +=
          1;


        continue;

      }


      if (
        !clusterId.startsWith(
          "warehouse:"
        )
      ) {

        continue;

      }


      const warehouseId =
        clusterId.slice(
          "warehouse:".length
        );


      if (!warehouseId) {

        continue;

      }


      uniqueWarehouseIds.add(
        warehouseId
      );


      let current =
        rowsByWarehouse.get(
          warehouseId
        );


      if (!current) {

        current = {
          cluster_name:
            row.cluster_name,

          product_ids:
            new Set<string>(),
        };


        rowsByWarehouse.set(
          warehouseId,
          current
        );

      }


      current
        .product_ids
        .add(
          row.product_id
        );

    }


    // ========================================================
    // 5. OZON V2 CLUSTERS
    // ========================================================

    const macroResponse =
      await getMacroClusters();


    const macroClusters =
      macroResponse.result
      ??
      [];


    const warehouseToMacro =
      new Map<
        string,
        {
          macrolocal_cluster_id:
            string;

          macrolocal_cluster_name:
            string
            | null;

          country:
            string
            | null;

          fulfillment_name:
            string
            | null;
        }
      >();


    let fulfillmentRows =
      0;


    for (
      const macro
      of macroClusters
    ) {

      const macroId =
        normalizeKey(
          macro.macrolocal_cluster_id
        );


      if (!macroId) {

        continue;

      }


      const macroName =
        normalizeKey(
          macro.data
            ?.macrolocal_cluster
            ?.name
        )
        ||
        null;


      const country =
        normalizeKey(
          macro.data
            ?.macrolocal_cluster
            ?.country
            ?.name
        )
        ||
        null;


      for (
        const fulfillment
        of macro.data
          ?.fulfillments
        ??
        []
      ) {

        const warehouseId =
          normalizeKey(
            fulfillment.warehouse_id
          );


        if (!warehouseId) {

          continue;

        }


        fulfillmentRows +=
          1;


        warehouseToMacro.set(
          warehouseId,
          {
            macrolocal_cluster_id:
              macroId,

            macrolocal_cluster_name:
              macroName,

            country,

            fulfillment_name:
              normalizeKey(
                fulfillment.name
              )
              ||
              null,
          }
        );

      }

    }


    // ========================================================
    // 6. COVERAGE
    // ========================================================

    let matchedWarehouseIds =
      0;


    let unmatchedWarehouseIds =
      0;


    let matchedPairs =
      0;


    let unmatchedPairs =
      0;


    const matchedSample:
      Array<
        Record<
          string,
          unknown
        >
      > =
      [];


    const unmatchedSample:
      Array<
        Record<
          string,
          unknown
        >
      > =
      [];


    for (
      const warehouseId
      of uniqueWarehouseIds
    ) {

      const source =
        rowsByWarehouse.get(
          warehouseId
        );


      const pairCount =
        source
          ?.product_ids
          .size
        ??
        0;


      const macro =
        warehouseToMacro.get(
          warehouseId
        );


      if (macro) {

        matchedWarehouseIds +=
          1;


        matchedPairs +=
          pairCount;


        if (
          matchedSample.length <
          100
        ) {

          matchedSample.push(
            {
              warehouse_id:
                warehouseId,

              source_warehouse_name:
                source
                  ?.cluster_name
                ??
                null,

              product_cluster_pairs:
                pairCount,

              ...macro,
            }
          );

        }

      } else {

        unmatchedWarehouseIds +=
          1;


        unmatchedPairs +=
          pairCount;


        if (
          unmatchedSample.length <
          100
        ) {

          unmatchedSample.push(
            {
              warehouse_id:
                warehouseId,

              source_warehouse_name:
                source
                  ?.cluster_name
                ??
                null,

              product_cluster_pairs:
                pairCount,
            }
          );

        }

      }

    }


    // ========================================================
    // 7. RESULT
    // ========================================================

    return Response.json(
      {
        ok:
          true,

        mode:
          "read_only_cluster_mapping_check",

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


        sales: {
          total_rows_loaded:
            allSalesRows.length,

          fallback_rows:
            badRows.length,

          warehouse_fallback_rows:
            badRows.length
            -
            nameFallbackRows
            -
            unknownFallbackRows,

          name_fallback_rows:
            nameFallbackRows,

          unknown_fallback_rows:
            unknownFallbackRows,

          unique_warehouse_ids:
            uniqueWarehouseIds.size,
        },


        ozon_v2_cluster_list: {
          macrolocal_clusters:
            macroClusters.length,

          fulfillment_rows:
            fulfillmentRows,

          unique_fulfillment_warehouse_ids:
            warehouseToMacro.size,
        },


        coverage: {
          matched_warehouse_ids:
            matchedWarehouseIds,

          unmatched_warehouse_ids:
            unmatchedWarehouseIds,

          matched_product_cluster_pairs:
            matchedPairs,

          unmatched_product_cluster_pairs:
            unmatchedPairs,

          total_product_cluster_pairs:
            matchedPairs
            +
            unmatchedPairs,

          coverage_percent:
            matchedPairs
            +
            unmatchedPairs >
            0

              ? Number(
                  (
                    (
                      matchedPairs
                      /
                      (
                        matchedPairs
                        +
                        unmatchedPairs
                      )
                    )
                    *
                    100
                  ).toFixed(
                    2
                  )
                )

              : 100,
        },


        matched_sample:
          matchedSample,


        unmatched_sample:
          unmatchedSample,


        conclusion:
          (
            unmatchedPairs ===
            0
            &&
            nameFallbackRows ===
            0
            &&
            unknownFallbackRows ===
            0
          )

            ? "Все fallback warehouse_id из продаж сопоставились через /v2/cluster/list."

            : "Часть fallback-кластеров ещё не сопоставлена. Смотрим coverage и samples.",


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
      "OZON CLUSTER MAPPING CHECK ERROR",
      error
    );


    return Response.json(
      {
        ok:
          false,

        mode:
          "read_only_cluster_mapping_check",

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
