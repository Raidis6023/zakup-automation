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

const OZON_MULTI_CLUSTER_LIMIT =
  20;


// ============================================================
// ТИПЫ
// ============================================================

type ClusterType =
  | "CLUSTER_TYPE_OZON"
  | "CLUSTER_TYPE_CIS";


type ReplenishmentRun = {
  id: string;

  created_at: string;

  status: string;

  calculation_version: string;

  sales_date_from: string;

  sales_date_to: string;

  stock_snapshot_date: string;

  total_product_cluster_pairs: number;

  pairs_with_need: number;

  total_need_units: number;
};


type ReplenishmentItem = {
  product_id: string;

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

  cluster_id: string;

  cluster_name:
    | string
    | null;

  calculated_need: number;
};


type LatestSync = {
  id: string;

  date_from: string;

  date_to: string;

  status: string;

  created_at: string;
};


type DashboardData = {
  latest_sync:
    | LatestSync
    | null;

  stock_snapshot_date:
    | string
    | null;
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
  sku: number;

  quantity: number;
};


type PreparedCluster = {
  cluster_type:
    ClusterType;

  macrolocal_cluster_id:
    number;

  source_cluster_ids:
    string[];

  source_cluster_names:
    string[];

  items:
    PreparedItem[];
};


type DraftBatch = {
  batch_index:
    number;

  cluster_type:
    ClusterType;

  macrolocal_clusters_count:
    number;

  total_units:
    number;

  clusters:
    PreparedCluster[];
};


type UnresolvedRow = {
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

  reason:
    string;
};


type ExcludedRow = {
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

  reason:
    "cis_not_belarus";
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
  value: unknown
): string {

  return String(
    value
    ??
    ""
  ).trim();

}


function normalizeLower(
  value: unknown
): string {

  return normalizeKey(
    value
  ).toLowerCase();

}


function isBelarusCluster(
  cluster: OzonCluster
): boolean {

  const name =
    normalizeLower(
      cluster.name
    );


  return (
    name ===
      "беларусь"
    ||
    name ===
      "belarus"
  );

}


function sleep(
  milliseconds: number
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
  value: unknown
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


function chunkArray<T>(
  values: T[],
  size: number
):
T[][] {

  const result:
    T[][] =
    [];


  for (
    let index = 0;
    index < values.length;
    index += size
  ) {

    result.push(
      values.slice(
        index,
        index + size
      )
    );

  }


  return result;

}


// ============================================================
// SUPABASE GET
// ============================================================

async function supabaseGet<T>(
  url: URL
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
// SUPABASE RPC
// ============================================================

async function supabaseRpc<T>(
  functionName: string,
  body: unknown
):
Promise<T> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


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


  if (!response.ok) {

    throw new Error(
      `Supabase RPC ${functionName} ${response.status}: ${text}`
    );

  }


  if (!text) {

    return {} as T;

  }


  return JSON.parse(
    text
  ) as T;

}


// ============================================================
// OZON POST
// ============================================================

async function ozonPost<T>(
  path: string,
  body: unknown
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
// DASHBOARD OZON
// ============================================================

async function getOzonDashboard():
Promise<DashboardData> {

  return supabaseRpc<
    DashboardData
  >(
    "get_ozon_sync_dashboard",
    {}
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
  calculationRunId: string
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
// КЛАСТЕРЫ
// ============================================================

async function getOzonClustersByType(
  clusterType: ClusterType
):
Promise<OzonCluster[]> {

  const response =
    await ozonPost<
      OzonClusterResponse
    >(
      "/v1/cluster/list",
      {
        cluster_type:
          clusterType,
      }
    );


  return (
    response.clusters
    ??
    []
  ).map(
    cluster => ({
      ...cluster,

      type:
        clusterType,
    })
  );

}


// ============================================================
// СКЛАДЫ ПРОДАВЦА
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

  allowedClusters:
    OzonCluster[],

  excludedCisClusterIds:
    Set<string>
) {

  const clusterMap =
    new Map<
      string,
      {
        clusterId:
          string;

        clusterName:
          string;

        clusterType:
          ClusterType;

        macrolocalClusterId:
          number;
      }
    >();


  for (
    const cluster
    of allowedClusters
  ) {

    const clusterId =
      normalizeKey(
        cluster.id
      );


    const macrolocalClusterId =
      toPositiveInteger(
        cluster.macrolocal_cluster_id
      );


    const rawClusterType =
      normalizeKey(
        cluster.type
      );


    const clusterType:
      ClusterType
      | null =

      rawClusterType ===
        "CLUSTER_TYPE_OZON"

        ? "CLUSTER_TYPE_OZON"

        : rawClusterType ===
            "CLUSTER_TYPE_CIS"

          ? "CLUSTER_TYPE_CIS"

          : null;


    if (
      !clusterId
      ||
      macrolocalClusterId ===
        null
      ||
      clusterType ===
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

        clusterType,

        macrolocalClusterId,
      }
    );

  }


  const unresolvedRows:
    UnresolvedRow[] =
    [];


  const excludedRows:
    ExcludedRow[] =
    [];


  const macroMap =
    new Map<
      string,
      {
        clusterType:
          ClusterType;

        macrolocalClusterId:
          number;

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

  let excludedRowsCount =
    0;

  let excludedUnits =
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


    // ========================================================
    // СНГ, КРОМЕ БЕЛАРУСИ
    //
    // Это не ошибка.
    // Такие строки сознательно исключаем
    // из FBO-поставки.
    // ========================================================

    if (
      excludedCisClusterIds.has(
        clusterId
      )
    ) {

      excludedRows.push(
        {
          ...row,

          reason:
            "cis_not_belarus",
        }
      );


      excludedRowsCount +=
        1;


      excludedUnits +=
        quantity;


      continue;

    }


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
            "cluster_not_found_in_allowed_cluster_list",
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


    const macroKey =
      `${cluster.clusterType}:${cluster.macrolocalClusterId}`;


    let macro =
      macroMap.get(
        macroKey
      );


    if (!macro) {

      macro = {
        clusterType:
          cluster.clusterType,

        macrolocalClusterId:
          cluster.macrolocalClusterId,

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
        macroKey,
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
      macroMap.values()
    )
      .map(
        value => {

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
            cluster_type:
              value.clusterType,

            macrolocal_cluster_id:
              value.macrolocalClusterId,

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
      );


  return {
    preparedClusters,

    unresolvedRows,

    excludedRows,

    mappedRows,

    mappedUnits,

    excludedRowsCount,

    excludedUnits,

    totalInputUnits,
  };

}


// ============================================================
// РАЗБИЕНИЕ НА ПАРТИИ
// ============================================================

function buildDraftBatches(
  preparedClusters:
    PreparedCluster[]
):
DraftBatch[] {

  const result:
    DraftBatch[] =
    [];


  let batchIndex =
    1;


  const clusterTypes:
    ClusterType[] =
    [
      "CLUSTER_TYPE_OZON",
      "CLUSTER_TYPE_CIS",
    ];


  for (
    const clusterType
    of clusterTypes
  ) {

    const clustersOfType =
      preparedClusters.filter(
        cluster =>
          cluster.cluster_type ===
          clusterType
      );


    const chunks =
      chunkArray(
        clustersOfType,
        OZON_MULTI_CLUSTER_LIMIT
      );


    for (
      const clusters
      of chunks
    ) {

      if (
        clusters.length ===
        0
      ) {

        continue;

      }


      const totalUnits =
        clusters.reduce(
          (
            clusterTotal,
            cluster
          ) =>

            clusterTotal
            +
            cluster.items.reduce(
              (
                itemTotal,
                item
              ) =>
                itemTotal +
                item.quantity,

              0
            ),

          0
        );


      result.push(
        {
          batch_index:
            batchIndex,

          cluster_type:
            clusterType,

          macrolocal_clusters_count:
            clusters.length,

          total_units:
            totalUnits,

          clusters,
        }
      );


      batchIndex +=
        1;

    }

  }


  return result;

}


// ============================================================
// GET
// ============================================================

export async function GET() {

  const startedAt =
    Date.now();


  try {

    // ========================================================
    // 1. ПОСЛЕДНЯЯ СИНХРОНИЗАЦИЯ
    // ========================================================

    const dashboard =
      await getOzonDashboard();


    // ========================================================
    // 2. ПОСЛЕДНИЙ РАСЧЁТ FBO
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


    const latestSync =
      dashboard.latest_sync;


    const calculationIsFresh =
      Boolean(
        latestSync
        &&
        latestSync.status ===
          "success"
        &&
        latestSync.date_from ===
          run.sales_date_from
        &&
        latestSync.date_to ===
          run.sales_date_to
        &&
        dashboard.stock_snapshot_date ===
          run.stock_snapshot_date
      );


    // ========================================================
    // 3. ПОТРЕБНОСТЬ
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
    // 4. КЛАСТЕРЫ
    //
    // РФ берём полностью.
    // Из СНГ разрешаем только Беларусь.
    // Остальное СНГ исключаем осознанно.
    // ========================================================

    const [
      ozonClusters,
      cisClusters,
    ] =
      await Promise.all(
        [
          getOzonClustersByType(
            "CLUSTER_TYPE_OZON"
          ),

          getOzonClustersByType(
            "CLUSTER_TYPE_CIS"
          ),
        ]
      );


    const belarusClusters =
      cisClusters.filter(
        isBelarusCluster
      );


    const excludedCisClusters =
      cisClusters.filter(
        cluster =>
          !isBelarusCluster(
            cluster
          )
      );


    const excludedCisClusterIds =
      new Set<string>(
        excludedCisClusters
          .map(
            cluster =>
              normalizeKey(
                cluster.id
              )
          )
          .filter(
            Boolean
          )
      );


    const allowedClusters =
      [
        ...ozonClusters,
        ...belarusClusters,
      ];


    if (
      allowedClusters.length ===
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
            "Ozon не вернул разрешённые кластеры",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 5. MACROLOCAL
    // ========================================================

    const prepared =
      prepareMultiClusterData(
        replenishmentItems,
        allowedClusters,
        excludedCisClusterIds
      );


    const draftBatches =
      buildDraftBatches(
        prepared.preparedClusters
      );


    // ========================================================
    // 6. СКЛАДЫ ПРОДАВЦА
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
    // 7. БЛОКИРОВКИ
    // ========================================================

    const blockingReasons:
      string[] =
      [];


    if (
      !calculationIsFresh
    ) {

      blockingReasons.push(
        "Последний расчёт потребности FBO не соответствует последней успешной синхронизации Ozon"
      );

    }


    if (
      prepared
        .unresolvedRows
        .length >
      0
    ) {

      blockingReasons.push(
        "Есть строки разрешённой географии, которые нельзя безопасно сопоставить с кластером или SKU"
      );

    }


    if (
      belarusClusters.length ===
      0
    ) {

      blockingReasons.push(
        "В CLUSTER_TYPE_CIS не найден кластер Беларусь"
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
      "Ещё не выбран seller_warehouse_id для этой поставки"
    );


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


        geography_policy: {
          russia:
            true,

          belarus:
            true,

          other_cis:
            false,
        },


        calculation_freshness: {
          is_fresh:
            calculationIsFresh,

          latest_sync:
            latestSync,

          latest_stock_snapshot_date:
            dashboard
              .stock_snapshot_date,

          replenishment_run: {
            id:
              run.id,

            created_at:
              run.created_at,

            sales_date_from:
              run.sales_date_from,

            sales_date_to:
              run.sales_date_to,

            stock_snapshot_date:
              run.stock_snapshot_date,
          },
        },


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

          mapped_rows:
            prepared.mappedRows,

          mapped_units:
            prepared.mappedUnits,

          excluded_non_belarus_cis_rows:
            prepared.excludedRowsCount,

          excluded_non_belarus_cis_units:
            prepared.excludedUnits,
        },


        clusters: {
          russia_received:
            ozonClusters.length,

          cis_received:
            cisClusters.length,

          belarus_received:
            belarusClusters.length,

          excluded_cis_received:
            excludedCisClusters.length,

          excluded_cis_clusters:
            excludedCisClusters.map(
              cluster => ({
                cluster_id:
                  cluster.id
                  ??
                  null,

                name:
                  cluster.name
                  ??
                  null,

                macrolocal_cluster_id:
                  cluster.macrolocal_cluster_id
                  ??
                  null,
              })
            ),
        },


        mapping: {
          mapped_rows:
            prepared.mappedRows,

          mapped_units:
            prepared.mappedUnits,

          unresolved_rows:
            prepared
              .unresolvedRows
              .length,

          unresolved_units:
            prepared.totalInputUnits
            -
            prepared.mappedUnits
            -
            prepared.excludedUnits,

          unresolved_sample:
            prepared
              .unresolvedRows
              .slice(
                0,
                100
              ),
        },


        excluded_by_policy: {
          reason:
            "СНГ кроме Беларуси не участвует в поставках",

          rows:
            prepared.excludedRowsCount,

          units:
            prepared.excludedUnits,

          sample:
            prepared
              .excludedRows
              .slice(
                0,
                100
              ),
        },


        multi_cluster: {
          total_macrolocal_clusters_count:
            prepared
              .preparedClusters
              .length,

          ozon_limit_per_draft:
            OZON_MULTI_CLUSTER_LIMIT,

          clusters:
            prepared
              .preparedClusters
              .map(
                cluster => ({
                  cluster_type:
                    cluster.cluster_type,

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
              ),
        },


        draft_batches: {
          count:
            draftBatches.length,

          batches:
            draftBatches.map(
              batch => ({
                batch_index:
                  batch.batch_index,

                cluster_type:
                  batch.cluster_type,

                macrolocal_clusters_count:
                  batch.macrolocal_clusters_count,

                total_units:
                  batch.total_units,

                macrolocal_cluster_ids:
                  batch
                    .clusters
                    .map(
                      cluster =>
                        cluster
                          .macrolocal_cluster_id
                    ),
              })
            ),
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
            blockingReasons.length ===
            0,

          blocking_reasons:
            blockingReasons,
        },


        next_step:
          "Используем Россию и Беларусь. Остальное СНГ исключено по бизнес-правилу и не блокирует поставку. После проверки свежести расчёта выбираем seller_warehouse_id и cross-dock точку.",


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
