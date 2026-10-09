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


const OZON_MAX_RETRIES =
  5;


const OZON_TIMEOUT_MS =
  30000;


const SUPABASE_PAGE_SIZE =
  1000;


// ============================================================
// ТИПЫ
// ============================================================

type ReplenishmentRun = {
  id:
    string;

  created_at:
    string;

  status:
    string;

  calculation_version:
    string;

  sales_date_from:
    string;

  sales_date_to:
    string;

  stock_snapshot_date:
    string;

  total_product_cluster_pairs:
    number;

  pairs_with_need:
    number;

  total_need_units:
    number;
};


type ReplenishmentItem = {
  product_id:
    string;

  offer_id:
    | string
    | null;

  product_name:
    | string
    | null;

  ozon_sku:
    | string
    | number
    | null;

  cluster_id:
    string;

  cluster_name:
    | string
    | null;

  calculated_need:
    number;
};


type OzonCluster = {
  id?:
    | string
    | number;

  name?:
    string;

  macrolocal_cluster_id?:
    | string
    | number;

  type?:
    string;

  logistic_clusters?:
    Array<{
      warehouses?:
        Array<{
          warehouse_id?:
            | string
            | number;

          name?:
            string;

          type?:
            string;
        }>;
    }>;
};


type OzonClusterResponse = {
  clusters?:
    OzonCluster[];
};


type SellerWarehouse = {
  seller_warehouse_id?:
    | string
    | number;

  name?:
    string;

  is_active?:
    boolean;

  is_pickup?:
    boolean;

  courier_comment?:
    string;

  address?:
    unknown;

  contacts?:
    unknown;

  [key: string]:
    unknown;
};


type SellerWarehouseResponse = {
  warehouses?:
    SellerWarehouse[];
};


type PreparedItem = {
  sku:
    number;

  quantity:
    number;
};


type PreparedCluster = {
  macrolocal_cluster_id:
    number;

  source_cluster_ids:
    string[];

  source_cluster_names:
    string[];

  items:
    PreparedItem[];
};


type UnresolvedRow = {
  product_id:
    string;

  offer_id:
    string
    | null;

  ozon_sku:
    string
    | number
    | null;

  cluster_id:
    string;

  cluster_name:
    string
    | null;

  calculated_need:
    number;

  reason:
    string;
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


function toPositiveInteger(
  value:
    unknown
):
number | null {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
    ||
    number <= 0
  ) {

    return null;

  }


  const integer =
    Math.ceil(
      number
    );


  if (
    !Number.isSafeInteger(
      integer
    )
  ) {

    return null;

  }


  return integer;

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

    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () => {

          controller.abort();

        },
        OZON_TIMEOUT_MS
      );


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

            signal:
              controller.signal,
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

          const retryAfter =
            Number(
              response.headers.get(
                "retry-after"
              )
            );


          const delay =
            Number.isFinite(
              retryAfter
            )
            &&
            retryAfter > 0

              ? retryAfter *
                1000

              : 1500 *
                attempt;


          await sleep(
            delay
          );


          continue;

        }

      }


      if (!response.ok) {

        throw new Error(
          `Ozon ${path}: HTTP ${response.status}: ${text}`
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
        1500 *
        attempt
      );

    } finally {

      clearTimeout(
        timeout
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
            "Неизвестная ошибка Ozon API"
          )
        )
  );

}


// ============================================================
// ПОСЛЕДНИЙ РАСЧЁТ ПОТРЕБНОСТИ
// ============================================================

async function getLatestReplenishmentRun():
Promise<
  ReplenishmentRun
  | null
> {

  const {
    supabaseUrl,
  } =
    getConfig();


  const url =
    new URL(
      `${supabaseUrl}/rest/v1/ozon_fbo_replenishment_runs`
    );


  url.searchParams.set(
    "select",
    [
      "id",
      "created_at",
      "status",
      "calculation_version",
      "sales_date_from",
      "sales_date_to",
      "stock_snapshot_date",
      "total_product_cluster_pairs",
      "pairs_with_need",
      "total_need_units",
    ].join(
      ","
    )
  );


  url.searchParams.set(
    "status",
    "eq.success"
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
      ReplenishmentRun[]
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
// СТРОКИ С ПОТРЕБНОСТЬЮ
// ============================================================

async function getReplenishmentItems(
  calculationRunId:
    string
):
Promise<ReplenishmentItem[]> {

  const {
    supabaseUrl,
  } =
    getConfig();


  const result:
    ReplenishmentItem[] =
    [];


  for (
    let offset = 0;
    offset < 100000;
    offset += SUPABASE_PAGE_SIZE
  ) {

    const url =
      new URL(
        `${supabaseUrl}/rest/v1/ozon_fbo_replenishment_items`
      );


    url.searchParams.set(
      "select",
      [
        "product_id",
        "offer_id",
        "product_name",
        "ozon_sku",
        "cluster_id",
        "cluster_name",
        "calculated_need",
      ].join(
        ","
      )
    );


    url.searchParams.set(
      "calculation_run_id",
      `eq.${calculationRunId}`
    );


    url.searchParams.set(
      "calculated_need",
      "gt.0"
    );


    url.searchParams.set(
      "order",
      "calculated_need.desc"
    );


    url.searchParams.set(
      "limit",
      String(
        SUPABASE_PAGE_SIZE
      )
    );


    url.searchParams.set(
      "offset",
      String(
        offset
      )
    );


    const page =
      await supabaseGet<
        ReplenishmentItem[]
      >(
        url
      );


    result.push(
      ...page
    );


    if (
      page.length <
      SUPABASE_PAGE_SIZE
    ) {

      break;

    }

  }


  return result;

}


// ============================================================
// КЛАСТЕРЫ OZON
// ============================================================

async function getOzonClusters():
Promise<OzonCluster[]> {

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


  return (
    response.clusters
    ??
    []
  );

}


// ============================================================
// СКЛАДЫ ПРОДАВЦА ДЛЯ FBO
// ============================================================

async function getSellerWarehouses():
Promise<SellerWarehouse[]> {

  const response =
    await ozonPost<
      SellerWarehouseResponse
    >(
      "/v1/warehouse/fbo/seller/list",
      {}
    );


  return (
    response.warehouses
    ??
    []
  );

}


// ============================================================
// ПОДГОТОВКА MULTI-CLUSTER
// ============================================================

function prepareMultiClusterData(
  rows:
    ReplenishmentItem[],

  clusters:
    OzonCluster[]
) {

  const clusterMap =
    new Map<
      string,
      {
        clusterId:
          string;

        clusterName:
          string;

        macrolocalClusterId:
          number;
      }
    >();


  for (
    const cluster
    of clusters
  ) {

    const clusterId =
      normalizeKey(
        cluster.id
      );


    const macrolocalClusterId =
      toPositiveInteger(
        cluster.macrolocal_cluster_id
      );


    if (
      !clusterId
      ||
      macrolocalClusterId ===
        null
    ) {

      continue;

    }


    clusterMap.set(
      clusterId,
      {
        clusterId,

        clusterName:
          normalizeKey(
            cluster.name
          ),

        macrolocalClusterId,
      }
    );

  }


  const unresolvedRows:
    UnresolvedRow[] =
    [];


  const macroMap =
    new Map<
      number,
      {
        sourceClusterIds:
          Set<string>;

        sourceClusterNames:
          Set<string>;

        items:
          Map<
            number,
            number
          >;
      }
    >();


  let totalInputUnits =
    0;


  let mappedRows =
    0;


  let mappedUnits =
    0;


  for (
    const row
    of rows
  ) {

    const quantity =
      toPositiveInteger(
        row.calculated_need
      );


    if (
      quantity ===
      null
    ) {

      unresolvedRows.push(
        {
          ...row,

          reason:
            "invalid_calculated_need",
        }
      );


      continue;

    }


    totalInputUnits +=
      quantity;


    const clusterId =
      normalizeKey(
        row.cluster_id
      );


    if (
      clusterId.startsWith(
        "warehouse:"
      )
    ) {

      unresolvedRows.push(
        {
          ...row,

          reason:
            "synthetic_warehouse_cluster",
        }
      );


      continue;

    }


    const cluster =
      clusterMap.get(
        clusterId
      );


    if (!cluster) {

      unresolvedRows.push(
        {
          ...row,

          reason:
            "cluster_not_found_in_ozon_cluster_list",
        }
      );


      continue;

    }


    const skuText =
      normalizeKey(
        row.ozon_sku
      );


    if (
      !skuText
      ||
      !/^\d+$/.test(
        skuText
      )
    ) {

      unresolvedRows.push(
        {
          ...row,

          reason:
            "missing_or_invalid_ozon_sku",
        }
      );


      continue;

    }


    const sku =
      Number(
        skuText
      );


    if (
      !Number.isSafeInteger(
        sku
      )
      ||
      sku <= 0
    ) {

      unresolvedRows.push(
        {
          ...row,

          reason:
            "ozon_sku_out_of_range",
        }
      );


      continue;

    }


    let macro =
      macroMap.get(
        cluster.macrolocalClusterId
      );


    if (!macro) {

      macro = {
        sourceClusterIds:
          new Set<string>(),

        sourceClusterNames:
          new Set<string>(),

        items:
          new Map<
            number,
            number
          >(),
      };


      macroMap.set(
        cluster.macrolocalClusterId,
        macro
      );

    }


    macro
      .sourceClusterIds
      .add(
        cluster.clusterId
      );


    macro
      .sourceClusterNames
      .add(
        cluster.clusterName
        ||
        normalizeKey(
          row.cluster_name
        )
      );


    const previousQuantity =
      macro.items.get(
        sku
      )
      ??
      0;


    macro.items.set(
      sku,
      previousQuantity +
      quantity
    );


    mappedRows +=
      1;


    mappedUnits +=
      quantity;

  }


  const preparedClusters:
    PreparedCluster[] =
    Array.from(
      macroMap.entries()
    )
      .map(
        (
          [
            macrolocalClusterId,
            value,
          ]
        ) => {

          const items =
            Array.from(
              value.items.entries()
            )
              .map(
                (
                  [
                    sku,
                    quantity,
                  ]
                ) => ({
                  sku,
                  quantity,
                })
              )
              .sort(
                (
                  left,
                  right
                ) =>
                  right.quantity -
                  left.quantity
              );


          return {
            macrolocal_cluster_id:
              macrolocalClusterId,

            source_cluster_ids:
              Array.from(
                value.sourceClusterIds
              ),

            source_cluster_names:
              Array.from(
                value.sourceClusterNames
              ),

            items,
          };

        }
      )
      .sort(
        (
          left,
          right
        ) =>
          left.macrolocal_cluster_id -
          right.macrolocal_cluster_id
      );


  return {
    preparedClusters,

    unresolvedRows,

    mappedRows,

    mappedUnits,

    totalInputUnits,
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
    // 1. ПОСЛЕДНИЙ РАСЧЁТ
    // ========================================================

    const run =
      await getLatestReplenishmentRun();


    if (!run) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "read_only_preflight_3_1",

          writes_to_ozon:
            false,

          writes_to_database:
            false,

          error:
            "Нет успешного расчёта потребности FBO",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 2. ПОТРЕБНОСТЬ
    // ========================================================

    const replenishmentItems =
      await getReplenishmentItems(
        run.id
      );


    if (
      replenishmentItems.length ===
      0
    ) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "read_only_preflight_3_1",

          writes_to_ozon:
            false,

          writes_to_database:
            false,

          run,

          error:
            "В последнем расчёте нет положительной потребности",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 3. КЛАСТЕРЫ OZON
    // ========================================================

    const clusters =
      await getOzonClusters();


    if (
      clusters.length ===
      0
    ) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "read_only_preflight_3_1",

          writes_to_ozon:
            false,

          writes_to_database:
            false,

          run,

          error:
            "Ozon не вернул список кластеров",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 4. МАППИНГ НА MACROLOCAL
    // ========================================================

    const prepared =
      prepareMultiClusterData(
        replenishmentItems,
        clusters
      );


    // ========================================================
    // 5. СКЛАДЫ ПРОДАВЦА
    // ========================================================

    let sellerWarehouses:
      SellerWarehouse[] =
      [];


    let sellerWarehousesError:
      string
      | null =
      null;


    try {

      sellerWarehouses =
        await getSellerWarehouses();

    } catch (error) {

      sellerWarehousesError =
        error instanceof Error
          ? error.message
          : String(
              error
            );

    }


    const activeSellerWarehouses =
      sellerWarehouses.filter(
        warehouse =>
          warehouse.is_active !==
          false
      );


    // ========================================================
    // 6. SUMMARY ПО MACRO CLUSTERS
    // ========================================================

    const clusterSummary =
      prepared
        .preparedClusters
        .map(
          cluster => ({
            macrolocal_cluster_id:
              cluster.macrolocal_cluster_id,

            source_cluster_ids:
              cluster.source_cluster_ids,

            source_cluster_names:
              cluster.source_cluster_names,

            sku_count:
              cluster.items.length,

            total_units:
              cluster.items.reduce(
                (
                  total,
                  item
                ) =>
                  total +
                  item.quantity,
                0
              ),

            items_sample:
              cluster.items.slice(
                0,
                10
              ),
          })
        );


    // ========================================================
    // 7. БЛОКИРОВКИ
    // ========================================================

    const blockingReasons:
      string[] =
      [];


    if (
      prepared
        .preparedClusters
        .length >
      20
    ) {

      blockingReasons.push(
        "После объединения получилось больше 20 macrolocal_cluster_id"
      );

    }


    if (
      prepared
        .unresolvedRows
        .length >
      0
    ) {

      blockingReasons.push(
        "Есть строки потребности, которые нельзя безопасно сопоставить с macrolocal_cluster_id или SKU"
      );

    }


    if (
      activeSellerWarehouses.length ===
      0
    ) {

      blockingReasons.push(
        "Не найден активный seller_warehouse_id"
      );

    }


    blockingReasons.push(
      "Ещё не выбрана точка отгрузки drop_off_warehouse"
    );


    // ========================================================
    // 8. RESPONSE
    // ========================================================

    return Response.json(
      {
        ok:
          true,

        mode:
          "read_only_preflight_3_1",

        writes_to_ozon:
          false,

        writes_to_database:
          false,

        run: {
          id:
            run.id,

          created_at:
            run.created_at,

          calculation_version:
            run.calculation_version,

          sales_date_from:
            run.sales_date_from,

          sales_date_to:
            run.sales_date_to,

          stock_snapshot_date:
            run.stock_snapshot_date,

          pairs_with_need:
            run.pairs_with_need,

          total_need_units:
            run.total_need_units,
        },

        source_need: {
          rows_loaded:
            replenishmentItems.length,

          units_loaded:
            prepared.totalInputUnits,
        },

        mapping: {
          ozon_clusters_received:
            clusters.length,

          mapped_rows:
            prepared.mappedRows,

          mapped_units:
            prepared.mappedUnits,

          unresolved_rows:
            prepared.unresolvedRows.length,

          unresolved_units:
            prepared.totalInputUnits -
            prepared.mappedUnits,

          unresolved_sample:
            prepared
              .unresolvedRows
              .slice(
                0,
                100
              ),
        },

        multi_cluster: {
          macrolocal_clusters_count:
            prepared
              .preparedClusters
              .length,

          ozon_limit:
            20,

          clusters:
            clusterSummary,
        },

        seller_warehouses: {
          received:
            sellerWarehouses.length,

          active:
            activeSellerWarehouses.length,

          error:
            sellerWarehousesError,

          warehouses:
            sellerWarehouses.map(
              warehouse => ({
                seller_warehouse_id:
                  warehouse.seller_warehouse_id
                  ??
                  null,

                name:
                  warehouse.name
                  ??
                  null,

                is_active:
                  warehouse.is_active
                  ??
                  null,

                is_pickup:
                  warehouse.is_pickup
                  ??
                  null,

                address:
                  warehouse.address
                  ??
                  null,
              })
            ),
        },

        draft: {
          method:
            "/v1/draft/multi-cluster/create",

          deletion_sku_mode:
            "PARTIAL",

          delivery_info:
            null,

          actually_created:
            false,

          ready_for_real_creation:
            false,

          blocking_reasons:
            blockingReasons,
        },

        next_step:
          "Определить seller_warehouse_id и точку drop-off, после чего собрать точный delivery_info. Черновик Ozon этим endpoint не создаётся.",

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
      "OZON FBO DRAFT PREFLIGHT ERROR",
      error
    );


    return Response.json(
      {
        ok:
          false,

        mode:
          "read_only_preflight_3_1",

        writes_to_ozon:
          false,

        writes_to_database:
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
