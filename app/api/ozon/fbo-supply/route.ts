export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  120;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const OZON_API_BASE =
  "https://api-seller.ozon.ru";

const MOSCOW_SELLER_WAREHOUSE_ID =
  "1020005014074930";

const DROP_OFF_SEARCHES =
  [
    "МО_ВНУКОВО_2_ХАБ",
    "МО ВНУКОВО",
    "Внуково",
  ];

const DRAFT_GAP_SECONDS =
  32;

const SUPPLY_GAP_SECONDS =
  32;

const MAX_PROCESS_ATTEMPTS =
  20;

const SUPABASE_PAGE_SIZE =
  1000;

const MIN_TIMESLOT_LEAD_DAYS =
  3;

const TIMESLOT_SEARCH_HORIZON_DAYS =
  30;

const PARKED_NEXT_ATTEMPT_AT =
  "9999-12-31T23:59:59.000Z";


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
  pairs_with_need: number;
  total_need_units: number;
};

type ReplenishmentItem = {
  product_id: string;
  offer_id: string | null;
  product_name: string | null;
  ozon_sku: string | number | null;
  cluster_id: string;
  cluster_name: string | null;
  calculated_need: number;
};

type ProductRow = {
  id: string;
  master_code: string | null;
  offer_id: string | null;
  name: string | null;
  units_per_carton: number | null;
};

type LatestSync = {
  id: string;
  date_from: string;
  date_to: string;
  status: string;
  created_at: string;
};

type DashboardData = {
  latest_sync: LatestSync | null;
  stock_snapshot_date: string | null;
};

type OzonCluster = {
  id?: string | number;
  name?: string;
  macrolocal_cluster_id?: string | number;
  type?: string;
};

type OzonClusterResponse = {
  clusters?: OzonCluster[];
};

type OzonMacrolocalClusterV2Response = {
  result?: Array<{
    macrolocal_cluster_id?: string | number;
    data?: {
      fulfillments?: Array<{
        name?: string;
        warehouse_id?: string | number;
      }>;
      macrolocal_cluster?: {
        name?: string;
        country?: {
          name?: string;
          uid?: string;
        };
      };
    };
  }>;
};

type SellerWarehouse = {
  seller_warehouse_id?: string | number;
  seller_warehouse_name?: string;
  name?: string;
  is_active?: boolean;
  is_pickup?: boolean;
  address?: unknown;
  [key: string]: unknown;
};

type SellerWarehouseResponse = {
  warehouses?: SellerWarehouse[];
};

type DropOffWarehouse = {
  warehouse_id?: string | number;
  warehouse_type?: string;
  name?: string;
  address?: string;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  [key: string]: unknown;
};

type DropOffResponse = {
  search?: DropOffWarehouse[];
};

type SupplyPlanItem = {
  sku: number;
  quantity: number;
};

type SupplyPlanCluster = {
  cluster_type: ClusterType;
  macrolocal_cluster_id: number;
  cluster_name: string | null;
  source_cluster_ids: string[];
  source_cluster_names: string[];
  items: SupplyPlanItem[];
};

type SupplyRunRow = {
  id: string;
  calculation_run_id: string;
  created_at: string;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  status: "running" | "success" | "partial" | "failed";
  seller_warehouse_id: string | number;
  drop_off_warehouse_id: string | number;
  drop_off_warehouse_type: string;
  drop_off_name: string | null;
  drop_off_address: string | null;
  formation_date: string;
  target_date: string;
  window_date_from: string;
  window_date_to: string;
  next_draft_allowed_at: string | null;
  next_supply_allowed_at: string | null;
  total_clusters: number;
  success_clusters: number;
  no_slot_clusters: number;
  failed_clusters: number;
  total_units: string | number;
  last_error: string | null;
};

type SupplyRequestStatus =
  | "queued"
  | "draft_created"
  | "draft_ready"
  | "slot_selected"
  | "creating"
  | "success"
  | "no_slot"
  | "failed";

type SupplyRequestRow = {
  id: string;
  supply_run_id: string;
  calculation_run_id: string;
  created_at: string;
  updated_at: string;
  macrolocal_cluster_id: string | number;
  cluster_type: string;
  cluster_name: string | null;
  source_cluster_ids: unknown;
  source_cluster_names: unknown;
  items: SupplyPlanItem[];
  sku_count: number;
  total_units: string | number;
  status: SupplyRequestStatus;
  draft_id: string | number | null;
  storage_warehouse_id: string | number | null;
  storage_warehouse_name: string | null;
  storage_warehouse_address: string | null;
  timeslot_from: string | null;
  timeslot_to: string | null;
  ozon_order_id: string | number | null;
  next_attempt_at: string | null;
  attempts: number;
  is_processing: boolean;
  processing_started_at: string | null;
  error_message: string | null;
  raw_draft: unknown;
  raw_info: unknown;
  raw_timeslots: unknown;
  raw_create: unknown;
  raw_status: unknown;
};

type DraftCreateError = {
  error_message?: string;
  error_reasons?: string[];
  items_validation?: Array<{
    rejected_items?: Array<{
      reasons?: string[];
      sku?: number;
    }>;
  }>;
  message?: string;
};

type DraftCreateResponse = {
  draft_id?: number;
  errors?: DraftCreateError[];
};

type DraftInfoWarehouse = {
  availability_status?: {
    invalid_reason?: string;
    state?: string;
  };
  bundle_id?: string;
  restricted_bundle_id?: string;
  storage_warehouse?: {
    address?: string;
    name?: string;
    warehouse_id?: number;
  };
  total_rank?: number;
  total_score?: number;
};

type DraftInfoResponse = {
  clusters?: Array<{
    cluster_name?: string;
    macrolocal_cluster_id?: number;
    supply_type?: string;
    warehouses?: DraftInfoWarehouse[];
  }>;
  errors?: DraftCreateError[];
  status?: string;
};

type BundleResponse = {
  items?: Array<{
    sku?: string | number;
    quantity?: string | number;
  }>;
  total_count?: number;
  has_next?: boolean;
  last_id?: string;
};


type TimeslotResponse = {
  error_reason?: string;
  result?: {
    drop_off_warehouse_timeslots?: {
      current_time_in_timezone?: string;
      days?: Array<{
        date_in_timezone?: string;
        timeslots?: Array<{
          from_in_timezone?: string;
          to_in_timezone?: string;
        }>;
      }>;
      warehouse_timezone?: string;
    };
    requested_date_from?: string;
    requested_date_to?: string;
  };
};

type SupplyCreateResponse = {
  draft_id?: number;
  error_reasons?: string[];
};

type SupplyCreateStatusResponse = {
  error_reasons?: string[];
  order_id?: number;
  status?: string;
};

type PreviewWarehouse = {
  warehouse_id: number;
  name: string | null;
  address: string | null;
  availability: string;
  invalid_reason: string | null;
  total_score: number | null;
  total_rank: number | null;
  full_quantity_units: number | null;
};

type PreviewCluster = {
  macrolocal_cluster_id: number;
  cluster_name: string | null;
  requested_units: number;
  draft_accepted_units: number;
  rejected_units: number;
  sku_count: number;
  rejected_skus: number[];
  draft_id: number | null;
  status: "available" | "partial" | "not_available" | "error";
  recommended_warehouse: PreviewWarehouse | null;
  warehouses: PreviewWarehouse[];
  error: string | null;
};

type PreviewPayload = {
  ok: true;
  mode: "preview_only";
  real_supply_created: false;
  calculation_run_id: string;
  formation_date: string;
  target_date: string;
  window_date_from: string;
  window_date_to: string;
  drop_off: {
    warehouse_id: number;
    warehouse_type: string;
    name: string | null;
    address: string | null;
  };
  draft_ids: number[];
  summary: {
    clusters: number;
    available_clusters: number;
    partial_clusters: number;
    blocked_clusters: number;
    requested_units: number;
    draft_accepted_units: number;
    rejected_units: number;
  };
  clusters: PreviewCluster[];
  warnings: string[];
};

type StatusPayload = {
  ok: true;
  run: SupplyRunRow | null;
  requests: Array<{
    id: string;
    macrolocal_cluster_id: string | number;
    cluster_name: string | null;
    status: SupplyRequestStatus;
    sku_count: number;
    total_units: string | number;
    draft_id: string | number | null;
    storage_warehouse_name: string | null;
    timeslot_from: string | null;
    timeslot_to: string | null;
    ozon_order_id: string | number | null;
    next_attempt_at: string | null;
    attempts: number;
    error_message: string | null;
  }>;
  progress: {
    total: number;
    success: number;
    no_slot: number;
    failed: number;
    in_progress: number;
    percent: number;
  };
  next_action_at: string | null;
};


// ============================================================
// ОШИБКА OZON API
// ============================================================

class OzonApiError extends Error {

  status:
    number | null;

  retryAfterSeconds:
    number | null;

  transient:
    boolean;


  constructor(
    message:
      string,

    options?: {
      status?:
        number | null;

      retryAfterSeconds?:
        number | null;

      transient?:
        boolean;
    }
  ) {

    super(
      message
    );

    this.name =
      "OzonApiError";

    this.status =
      options?.status
      ??
      null;

    this.retryAfterSeconds =
      options?.retryAfterSeconds
      ??
      null;

    this.transient =
      options?.transient
      ??
      false;

  }

}


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
) {

  return String(
    value
    ??
    ""
  ).trim();

}


function toOzonLocalDateTime(
  value:
    string
) {

  const normalized =
    normalizeKey(
      value
    )
      .replace(
        " ",
        "T"
      );


  const match =
    normalized.match(
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/
    );


  if (!match) {

    throw new Error(
      `Некорректный формат таймслота для Ozon: ${value}`
    );

  }


  return match[
    1
  ];

}


function normalizeSearchText(
  value:
    unknown
) {

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
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  );

}


function chunkArray<T>(
  values:
    T[],

  size:
    number
) {

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


  return Number.isSafeInteger(
    integer
  )
    ? integer
    : null;

}


function getPackRule(
  rawNeed:
    number,

  pack:
    number
) {

  if (
    rawNeed <
    pack
  ) {

    return {
      cartons:
        0,

      finalQuantity:
        0,
    };

  }


  const cartons =
    Math.round(
      rawNeed
      /
      pack
    );


  return {
    cartons,

    finalQuantity:
      cartons
      *
      pack,
  };

}


function isBelarusCluster(
  cluster:
    OzonCluster
) {

  const name =
    normalizeSearchText(
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


function getMoscowDate() {

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Europe/Moscow",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    );


  const parts =
    formatter.formatToParts(
      new Date()
    );


  const values =
    Object.fromEntries(
      parts.map(
        part => [
          part.type,
          part.value,
        ]
      )
    );


  return [
    values.year,
    values.month,
    values.day,
  ].join(
    "-"
  );

}


function addDays(
  yyyyMmDd:
    string,

  days:
    number
) {

  const date =
    new Date(
      `${yyyyMmDd}T00:00:00Z`
    );


  date.setUTCDate(
    date.getUTCDate()
    +
    days
  );


  return date
    .toISOString()
    .slice(
      0,
      10
    );

}


function laterIso(
  seconds:
    number
) {

  return new Date(
    Date.now()
    +
    seconds
    *
    1000
  ).toISOString();

}


function asTimestamp(
  value:
    string | null | undefined
) {

  if (!value) {

    return null;

  }


  const timestamp =
    Date.parse(
      value
    );


  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;

}


function meaningfulErrors(
  errors:
    DraftCreateError[]
    | undefined
) {

  return (
    errors
    ??
    []
  ).filter(
    error => {

      const message =
        normalizeKey(
          error.error_message
        );

      const reasons =
        error.error_reasons
        ??
        [];

      const rejected =
        (
          error.items_validation
          ??
          []
        ).some(
          item =>
            (
              item.rejected_items
              ??
              []
            ).length >
            0
        );


      return (
        (
          message
          &&
          message !==
            "UNSPECIFIED"
        )
        ||
        reasons.some(
          reason =>
            reason !==
            "UNSPECIFIED"
        )
        ||
        rejected
      );

    }
  );

}


function formatErrors(
  errors:
    DraftCreateError[]
) {

  return errors
    .map(
      error => {

        const parts =
          [
            error.error_message,
            ...(
              error.error_reasons
              ??
              []
            ),
            error.message,
          ]
            .map(
              normalizeKey
            )
            .filter(
              value =>
                value
                &&
                value !==
                  "UNSPECIFIED"
            );


        return parts.join(
          ": "
        );

      }
    )
    .filter(
      Boolean
    )
    .join(
      "; "
    );

}


function mapDropOffWarehouseType(
  value:
    unknown
) {

  const raw =
    normalizeKey(
      value
    )
      .toUpperCase()
      .replace(
        /^WAREHOUSE_TYPE_/,
        ""
      );


  const allowed =
    new Set(
      [
        "DELIVERY_POINT",
        "SORTING_CENTER",
        "CROSS_DOCK",
        "ORDERS_RECEIVING_POINT",
        "FULL_FILLMENT",
      ]
    );


  return allowed.has(
    raw
  )
    ? raw
    : null;

}


// ============================================================
// SUPABASE
// ============================================================

async function supabaseRequest<T>(
  path:
    string,

  init:
    RequestInit
):
Promise<T> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
      {
        ...init,

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          Accept:
            "application/json",

          ...(
            init.headers
            ??
            {}
          ),
        },

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Supabase ${response.status}: ${text}`
    );

  }


  if (!text) {

    return undefined as T;

  }


  return JSON.parse(
    text
  ) as T;

}


async function supabaseGet<T>(
  path:
    string
) {

  return supabaseRequest<T>(
    path,
    {
      method:
        "GET",
    }
  );

}


async function supabasePatch(
  path:
    string,

  body:
    Record<string, unknown>
) {

  await supabaseRequest<void>(
    path,
    {
      method:
        "PATCH",

      headers: {
        "Content-Type":
          "application/json",

        Prefer:
          "return=minimal",
      },

      body:
        JSON.stringify(
          body
        ),
    }
  );

}


async function supabaseRpc<T>(
  name:
    string,

  body:
    Record<string, unknown>
) {

  return supabaseRequest<T>(
    `rpc/${name}`,
    {
      method:
        "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(
          body
        ),
    }
  );

}


// ============================================================
// OZON
// ============================================================

function parseRetryAfter(
  response:
    Response
) {

  const raw =
    response.headers.get(
      "retry-after"
    );


  if (!raw) {

    return null;

  }


  const seconds =
    Number(
      raw
    );


  if (
    Number.isFinite(
      seconds
    )
    &&
    seconds >= 0
  ) {

    return Math.max(
      1,
      Math.ceil(
        seconds
      )
    );

  }


  const date =
    Date.parse(
      raw
    );


  if (
    Number.isFinite(
      date
    )
  ) {

    return Math.max(
      1,
      Math.ceil(
        (
          date
          -
          Date.now()
        )
        /
        1000
      )
    );

  }


  return null;

}


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
    attempt <= 3;
    attempt++
  ) {

    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        30000
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
      ) {

        throw new OzonApiError(
          `Ozon ограничил запрос ${path}`,
          {
            status:
              429,

            retryAfterSeconds:
              parseRetryAfter(
                response
              )
              ??
              35,

            transient:
              true,
          }
        );

      }


      if (
        response.status >=
          500
        &&
        attempt <
          3
      ) {

        await sleep(
          1200
          *
          attempt
        );


        continue;

      }


      if (!response.ok) {

        throw new OzonApiError(
          `Ozon ${path}: HTTP ${response.status}: ${text}`,
          {
            status:
              response.status,

            transient:
              response.status >=
                500,
          }
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
        error instanceof
          OzonApiError
      ) {

        throw error;

      }


      if (
        attempt >=
        3
      ) {

        break;

      }


      await sleep(
        1200
        *
        attempt
      );

    } finally {

      clearTimeout(
        timeout
      );

    }

  }


  throw new OzonApiError(
    lastError
      instanceof Error
      ? lastError.message
      : "Неизвестная сетевая ошибка Ozon",
    {
      transient:
        true,
    }
  );

}


// ============================================================
// ИСХОДНЫЙ РАСЧЁТ
// ============================================================

async function getDashboard() {

  return supabaseRpc<
    DashboardData
  >(
    "get_ozon_sync_dashboard",
    {}
  );

}


async function getLatestReplenishmentRun() {

  const rows =
    await supabaseGet<
      ReplenishmentRun[]
    >(
      [
        "ozon_fbo_replenishment_runs",
        "?select=id,created_at,status,calculation_version,sales_date_from,sales_date_to,stock_snapshot_date,pairs_with_need,total_need_units",
        "&status=eq.success",
        "&order=created_at.desc",
        "&limit=1",
      ].join(
        ""
      )
    );


  return rows[
    0
  ]
  ??
  null;

}


async function getReplenishmentItems(
  runId:
    string
) {

  const result:
    ReplenishmentItem[] =
    [];


  for (
    let offset = 0;
    offset < 100000;
    offset += SUPABASE_PAGE_SIZE
  ) {

    const page =
      await supabaseGet<
        ReplenishmentItem[]
      >(
        [
          "ozon_fbo_replenishment_items",
          "?select=product_id,offer_id,product_name,ozon_sku,cluster_id,cluster_name,calculated_need",
          `&calculation_run_id=eq.${encodeURIComponent(
            runId
          )}`,
          "&calculated_need=gt.0",
          "&order=calculated_need.desc",
          `&limit=${SUPABASE_PAGE_SIZE}`,
          `&offset=${offset}`,
        ].join(
          ""
        )
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


async function getProducts() {

  const result:
    ProductRow[] =
    [];


  for (
    let offset = 0;
    offset < 10000;
    offset += SUPABASE_PAGE_SIZE
  ) {

    const page =
      await supabaseGet<
        ProductRow[]
      >(
        [
          "products",
          "?select=id,master_code,offer_id,name,units_per_carton",
          "&order=created_at.asc",
          `&limit=${SUPABASE_PAGE_SIZE}`,
          `&offset=${offset}`,
        ].join(
          ""
        )
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
// КЛАСТЕРЫ И МАРШРУТ
// ============================================================

async function getClusters(
  clusterType:
    ClusterType
) {

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


async function getMacrolocalClustersV2() {

  const response =
    await ozonPost<
      OzonMacrolocalClusterV2Response
    >(
      "/v2/cluster/list",
      {}
    );


  return response.result
  ??
  [];

}


async function getSellerWarehouses() {

  const response =
    await ozonPost<
      SellerWarehouseResponse
    >(
      "/v1/warehouse/fbo/seller/list",
      {}
    );


  return response.warehouses
  ??
  [];

}


async function searchDropOff(
  search:
    string
) {

  const response =
    await ozonPost<
      DropOffResponse
    >(
      "/v1/warehouse/fbo/list",
      {
        filter_by_supply_type: [
          "CREATE_TYPE_CROSSDOCK",
        ],
        search,
      }
    );


  return response.search
  ??
  [];

}


async function resolveDropOff() {

  const all:
    DropOffWarehouse[] =
    [];


  for (
    const search
    of DROP_OFF_SEARCHES
  ) {

    const rows =
      await searchDropOff(
        search
      );


    all.push(
      ...rows
    );

  }


  const unique =
    new Map<
      string,
      DropOffWarehouse
    >();


  for (
    const row
    of all
  ) {

    const id =
      normalizeKey(
        row.warehouse_id
      );


    if (id) {

      unique.set(
        id,
        row
      );

    }

  }


  const rows =
    Array.from(
      unique.values()
    );


  const addressMatches =
    rows.filter(
      row => {

        const address =
          normalizeSearchText(
            row.address
          );


        return (
          address.includes(
            "шарапов"
          )
          &&
          address.includes(
            "придорож"
          )
          &&
          (
            address.includes(
              "к5"
            )
            ||
            address.includes(
              "к 5"
            )
            ||
            address.includes(
              "корп 5"
            )
          )
        );

      }
    );


  const pool =
    addressMatches.length >
      0
      ? addressMatches
      : rows.filter(
          row => {

            const name =
              normalizeSearchText(
                row.name
              );


            return (
              name.includes(
                "внуково"
              )
              &&
              name.includes(
                "хаб"
              )
            );

          }
        );


  if (
    pool.length ===
    0
  ) {

    throw new Error(
      "Ozon не вернул cross-dock точку Внуково по адресу Шарапово, Придорожная улица, к5"
    );

  }


  const sorted =
    [
      ...pool,
    ].sort(
      (
        left,
        right
      ) => {

        const leftName =
          normalizeSearchText(
            left.name
          );

        const rightName =
          normalizeSearchText(
            right.name
          );


        const leftScore =
          leftName.includes(
            "2"
          )
            ? 1
            : 0;

        const rightScore =
          rightName.includes(
            "2"
          )
            ? 1
            : 0;


        return rightScore
        -
        leftScore;

      }
    );


  const selected =
    sorted[
      0
    ];


  const warehouseId =
    toPositiveInteger(
      selected.warehouse_id
    );


  const warehouseType =
    mapDropOffWarehouseType(
      selected.warehouse_type
    );


  if (
    warehouseId ===
      null
    ||
    !warehouseType
  ) {

    throw new Error(
      "У найденной точки Внуково Ozon не вернул корректные warehouse_id / warehouse_type"
    );

  }


  return {
    ...selected,
    resolved_warehouse_id:
      warehouseId,
    resolved_warehouse_type:
      warehouseType,
  };

}


// ============================================================
// ПЛАН ПО МАКРОКЛАСТЕРАМ
// ============================================================

function buildSupplyPlan(
  rows:
    ReplenishmentItem[],

  products:
    ProductRow[],

  allowedClusters:
    OzonCluster[],

  excludedCisClusterIds:
    Set<string>
) {

  const productById =
    new Map(
      products.map(
        product => [
          product.id,
          product,
        ]
      )
    );


  const packValuesByEnot =
    new Map<
      string,
      Set<number>
    >();


  for (
    const product
    of products
  ) {

    const enot =
      normalizeKey(
        product.master_code
      );

    const pack =
      toPositiveInteger(
        product.units_per_carton
      );


    if (
      !enot
      ||
      pack ===
        null
    ) {

      continue;

    }


    let values =
      packValuesByEnot.get(
        enot
      );


    if (!values) {

      values =
        new Set<number>();

      packValuesByEnot.set(
        enot,
        values
      );

    }


    values.add(
      pack
    );

  }


  const clusterMap =
    new Map<
      string,
      {
        clusterType:
          ClusterType;

        macrolocalClusterId:
          number;

        clusterName:
          string;
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

    const macrolocal =
      toPositiveInteger(
        cluster.macrolocal_cluster_id
      );

    const type =
      normalizeKey(
        cluster.type
      ) as
        ClusterType;


    if (
      !clusterId
      ||
      macrolocal ===
        null
      ||
      (
        type !==
          "CLUSTER_TYPE_OZON"
        &&
        type !==
          "CLUSTER_TYPE_CIS"
      )
    ) {

      continue;

    }


    clusterMap.set(
      clusterId,
      {
        clusterType:
          type,

        macrolocalClusterId:
          macrolocal,

        clusterName:
          normalizeKey(
            cluster.name
          ),
      }
    );

  }


  type Aggregate = {
    clusterType:
      ClusterType;

    macrolocalClusterId:
      number;

    clusterName:
      string;

    sourceClusterIds:
      Set<string>;

    sourceClusterNames:
      Set<string>;

    masterCode:
      string | null;

    offerId:
      string | null;

    sku:
      number;

    rawNeed:
      number;
  };


  const aggregates =
    new Map<
      string,
      Aggregate
    >();


  const unresolved:
    Array<{
      cluster_id:
        string;

      offer_id:
        string | null;

      reason:
        string;
    }> =
    [];


  const skipped:
    Array<{
      cluster_id:
        string;

      offer_id:
        string | null;

      master_code:
        string | null;

      sku:
        number | null;

      raw_need:
        number;

      reason:
        string;
    }> =
    [];


  let excludedUnits =
    0;


  for (
    const row
    of rows
  ) {

    const rawNeed =
      toPositiveInteger(
        row.calculated_need
      );

    const clusterId =
      normalizeKey(
        row.cluster_id
      );


    if (
      rawNeed ===
      null
    ) {

      unresolved.push({
        cluster_id:
          clusterId,

        offer_id:
          row.offer_id,

        reason:
          "invalid_calculated_need",
      });


      continue;

    }


    if (
      excludedCisClusterIds.has(
        clusterId
      )
    ) {

      excludedUnits +=
        rawNeed;


      continue;

    }


    if (
      clusterId.startsWith(
        "warehouse:"
      )
    ) {

      unresolved.push({
        cluster_id:
          clusterId,

        offer_id:
          row.offer_id,

        reason:
          "synthetic_warehouse_cluster",
      });


      continue;

    }


    const cluster =
      clusterMap.get(
        clusterId
      );


    if (!cluster) {

      unresolved.push({
        cluster_id:
          clusterId,

        offer_id:
          row.offer_id,

        reason:
          "cluster_not_found",
      });


      continue;

    }


    const sku =
      toPositiveInteger(
        row.ozon_sku
      );


    if (
      sku ===
      null
    ) {

      unresolved.push({
        cluster_id:
          clusterId,

        offer_id:
          row.offer_id,

        reason:
          "missing_or_invalid_sku",
      });


      continue;

    }


    const product =
      productById.get(
        row.product_id
      );


    const masterCode =
      normalizeKey(
        product?.master_code
      )
      ||
      null;


    const key =
      [
        cluster.clusterType,
        cluster.macrolocalClusterId,
        masterCode
        ??
        row.product_id,
        sku,
      ].join(
        ":"
      );


    let aggregate =
      aggregates.get(
        key
      );


    if (!aggregate) {

      aggregate = {
        clusterType:
          cluster.clusterType,

        macrolocalClusterId:
          cluster.macrolocalClusterId,

        clusterName:
          cluster.clusterName,

        sourceClusterIds:
          new Set<string>(),

        sourceClusterNames:
          new Set<string>(),

        masterCode,

        offerId:
          row.offer_id
          ??
          product?.offer_id
          ??
          null,

        sku,

        rawNeed:
          0,
      };


      aggregates.set(
        key,
        aggregate
      );

    }


    aggregate.rawNeed +=
      rawNeed;


    aggregate
      .sourceClusterIds
      .add(
        clusterId
      );


    const sourceName =
      normalizeKey(
        row.cluster_name
      );


    if (sourceName) {

      aggregate
        .sourceClusterNames
        .add(
          sourceName
        );

    }

  }


  const macroMap =
    new Map<
      string,
      {
        cluster_type:
          ClusterType;

        macrolocal_cluster_id:
          number;

        cluster_names:
          Set<string>;

        source_cluster_ids:
          Set<string>;

        source_cluster_names:
          Set<string>;

        items:
          Map<number, number>;
      }
    >();


  for (
    const aggregate
    of aggregates.values()
  ) {

    const packValues =
      aggregate.masterCode
        ? packValuesByEnot.get(
            aggregate.masterCode
          )
        : undefined;


    if (
      !aggregate.masterCode
    ) {

      skipped.push({
        cluster_id:
          Array.from(
            aggregate.sourceClusterIds
          )[0]
          ??
          "",

        offer_id:
          aggregate.offerId,

        master_code:
          null,

        sku:
          aggregate.sku,

        raw_need:
          aggregate.rawNeed,

        reason:
          "missing_enot",
      });


      continue;

    }


    if (
      !packValues
      ||
      packValues.size ===
        0
    ) {

      skipped.push({
        cluster_id:
          Array.from(
            aggregate.sourceClusterIds
          )[0]
          ??
          "",

        offer_id:
          aggregate.offerId,

        master_code:
          aggregate.masterCode,

        sku:
          aggregate.sku,

        raw_need:
          aggregate.rawNeed,

        reason:
          "missing_pack",
      });


      continue;

    }


    if (
      packValues.size >
      1
    ) {

      skipped.push({
        cluster_id:
          Array.from(
            aggregate.sourceClusterIds
          )[0]
          ??
          "",

        offer_id:
          aggregate.offerId,

        master_code:
          aggregate.masterCode,

        sku:
          aggregate.sku,

        raw_need:
          aggregate.rawNeed,

        reason:
          "pack_conflict",
      });


      continue;

    }


    const pack =
      Array.from(
        packValues
      )[
        0
      ];


    const rounded =
      getPackRule(
        aggregate.rawNeed,
        pack
      );


    if (
      rounded.finalQuantity <=
      0
    ) {

      skipped.push({
        cluster_id:
          Array.from(
            aggregate.sourceClusterIds
          )[0]
          ??
          "",

        offer_id:
          aggregate.offerId,

        master_code:
          aggregate.masterCode,

        sku:
          aggregate.sku,

        raw_need:
          aggregate.rawNeed,

        reason:
          "less_than_one_carton",
      });


      continue;

    }


    const macroKey =
      `${aggregate.clusterType}:${aggregate.macrolocalClusterId}`;


    let macro =
      macroMap.get(
        macroKey
      );


    if (!macro) {

      macro = {
        cluster_type:
          aggregate.clusterType,

        macrolocal_cluster_id:
          aggregate.macrolocalClusterId,

        cluster_names:
          new Set<string>(),

        source_cluster_ids:
          new Set<string>(),

        source_cluster_names:
          new Set<string>(),

        items:
          new Map<number, number>(),
      };


      macroMap.set(
        macroKey,
        macro
      );

    }


    if (
      aggregate.clusterName
    ) {

      macro
        .cluster_names
        .add(
          aggregate.clusterName
        );

    }


    for (
      const id
      of aggregate.sourceClusterIds
    ) {

      macro
        .source_cluster_ids
        .add(
          id
        );

    }


    for (
      const name
      of aggregate.sourceClusterNames
    ) {

      macro
        .source_cluster_names
        .add(
          name
        );

    }


    macro.items.set(
      aggregate.sku,
      (
        macro.items.get(
          aggregate.sku
        )
        ??
        0
      )
      +
      rounded.finalQuantity
    );

  }


  const clusters:
    SupplyPlanCluster[] =
    Array.from(
      macroMap.values()
    )
      .map(
        macro => {

          const items =
            Array.from(
              macro.items.entries()
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
                  right.quantity
                  -
                  left.quantity
              );


          return {
            cluster_type:
              macro.cluster_type,

            macrolocal_cluster_id:
              macro.macrolocal_cluster_id,

            cluster_name:
              Array.from(
                macro.cluster_names
              ).join(
                ", "
              )
              ||
              null,

            source_cluster_ids:
              Array.from(
                macro.source_cluster_ids
              ),

            source_cluster_names:
              Array.from(
                macro.source_cluster_names
              ),

            items,
          };

        }
      )
      .filter(
        cluster =>
          cluster.items.length >
          0
      )
      .sort(
        (
          left,
          right
        ) =>
          left.macrolocal_cluster_id
          -
          right.macrolocal_cluster_id
      );


  return {
    clusters,
    unresolved,
    skipped,
    excludedUnits,
  };

}


function isTerminalRequestStatus(
  status:
    SupplyRequestStatus
) {

  return (
    status ===
      "success"
    ||
    status ===
      "no_slot"
    ||
    status ===
      "failed"
  );

}


async function parkSupplyRequests(
  runId:
    string
) {

  await supabasePatch(
    [
      "ozon_fbo_supply_requests",
      `?supply_run_id=eq.${encodeURIComponent(
        runId
      )}`,
      "&status=eq.queued",
    ].join(
      ""
    ),
    {
      next_attempt_at:
        PARKED_NEXT_ATTEMPT_AT,
    }
  );

}


async function activateSupplyRequests(
  runId:
    string,

  clusterIds:
    number[]
    |
    null
) {

  const requests =
    await getSupplyRequests(
      runId
    );


  const requested =
    clusterIds
    &&
    clusterIds.length >
      0
      ? new Set(
          clusterIds
        )
      : null;


  if (requested) {

    const existingIds =
      new Set(
        requests.map(
          row =>
            Number(
              row.macrolocal_cluster_id
            )
        )
      );


    const missing =
      Array.from(
        requested
      ).filter(
        clusterId =>
          !existingIds.has(
            clusterId
          )
      );


    if (
      missing.length >
      0
    ) {

      throw new Error(
        `Не найдены кластеры для запуска: ${missing.join(
          ", "
        )}`
      );

    }

  }


  const now =
    new Date()
      .toISOString();


  let activated =
    0;


  for (
    const row
    of requests
  ) {

    const clusterId =
      Number(
        row.macrolocal_cluster_id
      );


    if (
      requested
      &&
      !requested.has(
        clusterId
      )
    ) {

      continue;

    }


    if (
      row.status ===
        "success"
    ) {

      continue;

    }


    const shouldReset =
      row.status ===
        "failed"
      ||
      row.status ===
        "no_slot";


    await supabasePatch(
      `ozon_fbo_supply_requests?id=eq.${encodeURIComponent(
        row.id
      )}`,
      {
        ...(
          shouldReset
            ? {
                status:
                  "queued",

                draft_id:
                  null,

                storage_warehouse_id:
                  null,

                storage_warehouse_name:
                  null,

                storage_warehouse_address:
                  null,

                timeslot_from:
                  null,

                timeslot_to:
                  null,

                ozon_order_id:
                  null,

                is_processing:
                  false,

                processing_started_at:
                  null,

                raw_draft:
                  null,

                raw_info:
                  null,

                raw_timeslots:
                  null,

                raw_create:
                  null,

                raw_status:
                  null,
              }
            : {}
        ),

        next_attempt_at:
          now,

        error_message:
          null,
      }
    );


    activated++;

  }


  return activated;

}


// ============================================================
// RUN STATUS
// ============================================================

async function getSupplyRun(
  runId?:
    string | null
) {

  const filter =
    runId
      ? `&id=eq.${encodeURIComponent(
          runId
        )}`
      : "";


  const rows =
    await supabaseGet<
      SupplyRunRow[]
    >(
      [
        "ozon_fbo_supply_runs",
        "?select=*",
        filter,
        "&order=created_at.desc",
        "&limit=1",
      ].join(
        ""
      )
    );


  return rows[
    0
  ]
  ??
  null;

}


async function getSupplyRequests(
  runId:
    string
) {

  return supabaseGet<
    SupplyRequestRow[]
  >(
    [
      "ozon_fbo_supply_requests",
      "?select=*",
      `&supply_run_id=eq.${encodeURIComponent(
        runId
      )}`,
      "&order=macrolocal_cluster_id.asc",
    ].join(
      ""
    )
  );

}


async function refreshAndSerializeRun(
  runId:
    string
):
Promise<StatusPayload> {

  let run =
    await getSupplyRun(
      runId
    );


  if (!run) {

    throw new Error(
      "Supply run не найден"
    );

  }


  const requests =
    await getSupplyRequests(
      runId
    );


  const success =
    requests.filter(
      row =>
        row.status ===
        "success"
    ).length;

  const noSlot =
    requests.filter(
      row =>
        row.status ===
        "no_slot"
    ).length;

  const failed =
    requests.filter(
      row =>
        row.status ===
        "failed"
    ).length;

  const terminal =
    success
    +
    noSlot
    +
    failed;

  const total =
    requests.length;

  const inProgress =
    Math.max(
      0,
      total
      -
      terminal
    );


  let status:
    SupplyRunRow[
      "status"
    ] =
      "running";


  if (
    total >
      0
    &&
    inProgress ===
      0
  ) {

    if (
      success ===
        total
    ) {

      status =
        "success";

    } else if (
      success >
        0
      ||
      noSlot >
        0
    ) {

      status =
        "partial";

    } else {

      status =
        "failed";

    }

  }


  const shouldFinish =
    status !==
    "running";


  const updates:
    Record<string, unknown> =
    {
      status,

      success_clusters:
        success,

      no_slot_clusters:
        noSlot,

      failed_clusters:
        failed,

      updated_at:
        new Date()
          .toISOString(),
    };


  if (
    shouldFinish
    &&
    !run.finished_at
  ) {

    updates.finished_at =
      new Date()
        .toISOString();

  }


  await supabasePatch(
    `ozon_fbo_supply_runs?id=eq.${encodeURIComponent(
      runId
    )}`,
    updates
  );


  run = {
    ...run,
    ...updates,
  } as SupplyRunRow;


  const candidateDates =
    requests
      .filter(
        row =>
          ![
            "success",
            "no_slot",
            "failed",
          ].includes(
            row.status
          )
      )
      .map(
        row =>
          row.next_attempt_at
      )
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            value
          )
      )
      .sort();


  const nextActionAt =
    candidateDates[
      0
    ]
    ??
    (
      inProgress >
        0
        ? new Date()
            .toISOString()
        : null
    );


  return {
    ok:
      true,

    run,

    requests:
      requests.map(
        row => ({
          id:
            row.id,

          macrolocal_cluster_id:
            row.macrolocal_cluster_id,

          cluster_name:
            row.cluster_name,

          status:
            row.status,

          sku_count:
            row.sku_count,

          total_units:
            row.total_units,

          draft_id:
            row.draft_id,

          storage_warehouse_name:
            row.storage_warehouse_name,

          timeslot_from:
            row.timeslot_from,

          timeslot_to:
            row.timeslot_to,

          ozon_order_id:
            row.ozon_order_id,

          next_attempt_at:
            row.next_attempt_at,

          attempts:
            row.attempts,

          error_message:
            row.error_message,
        })
      ),

    progress: {
      total,

      success,

      no_slot:
        noSlot,

      failed,

      in_progress:
        inProgress,

      percent:
        total >
          0
          ? Math.round(
              terminal
              /
              total
              *
              100
            )
          : 0,
    },

    next_action_at:
      nextActionAt,
  };

}


// ============================================================
// START
// ============================================================

async function startSupplyRun(
  clusterIds:
    number[]
    |
    null
) {

  const run =
    await getLatestReplenishmentRun();


  if (!run) {

    return Response.json(
      {
        ok:
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


  const existing =
    await supabaseGet<
      SupplyRunRow[]
    >(
      [
        "ozon_fbo_supply_runs",
        "?select=*",
        `&calculation_run_id=eq.${encodeURIComponent(
          run.id
        )}`,
        "&limit=1",
      ].join(
        ""
      )
    );


  if (
    existing[
      0
    ]
  ) {

    const existingRun =
      existing[
        0
      ];


    if (
      existingRun.status !==
        "success"
    ) {

      await updateRun(
        existingRun.id,
        {
          status:
            "running",

          finished_at:
            null,

          last_error:
            null,

          target_date:
            addDays(
              existingRun.formation_date,
              MIN_TIMESLOT_LEAD_DAYS
            ),

          window_date_from:
            addDays(
              existingRun.formation_date,
              MIN_TIMESLOT_LEAD_DAYS
            ),

          window_date_to:
            addDays(
              existingRun.formation_date,
              TIMESLOT_SEARCH_HORIZON_DAYS
            ),
        }
      );


      await activateSupplyRequests(
        existingRun.id,
        clusterIds
      );

    }


    return Response.json(
      await refreshAndSerializeRun(
        existingRun.id
      )
    );

  }


  const dashboard =
    await getDashboard();


  const latestSync =
    dashboard.latest_sync;


  const fresh =
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


  if (!fresh) {

    return Response.json(
      {
        ok:
          false,

        error:
          "Расчёт потребности не соответствует последней успешной синхронизации Ozon. Сначала обновите данные.",
      },
      {
        status:
          409,
      }
    );

  }


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

        error:
          "В свежем расчёте нет положительной потребности",
      },
      {
        status:
          409,
      }
    );

  }


  const [
    russianClusters,
    cisClusters,
    sellerWarehouses,
    dropOff,
    products,
  ] =
    await Promise.all([
      getClusters(
        "CLUSTER_TYPE_OZON"
      ),
      getClusters(
        "CLUSTER_TYPE_CIS"
      ),
      getSellerWarehouses(),
      resolveDropOff(),
      getProducts(),
    ]);


  const belarusClusters =
    cisClusters.filter(
      isBelarusCluster
    );


  if (
    belarusClusters.length ===
    0
  ) {

    return Response.json(
      {
        ok:
          false,

        error:
          "Ozon не вернул кластер Беларусь. Создание заявок остановлено.",
      },
      {
        status:
          409,
      }
    );

  }


  const excludedCisClusterIds =
    new Set(
      cisClusters
        .filter(
          cluster =>
            !isBelarusCluster(
              cluster
            )
        )
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


  const plan =
    buildSupplyPlan(
      replenishmentItems,
      products,
      [
        ...russianClusters,
        ...belarusClusters,
      ],
      excludedCisClusterIds
    );


  if (
    plan.unresolved.length >
    0
  ) {

    return Response.json(
      {
        ok:
          false,

        error:
          "Есть строки потребности, которые нельзя безопасно сопоставить с кластером или Ozon SKU. Заявки не создавались.",

        unresolved_count:
          plan.unresolved.length,

        sample:
          plan.unresolved.slice(
            0,
            50
          ),
      },
      {
        status:
          409,
      }
    );

  }


  if (
    plan.clusters.length ===
    0
  ) {

    return Response.json(
      {
        ok:
          false,

        error:
          "После применения географии Россия + Беларусь не осталось кластеров для поставки",
      },
      {
        status:
          409,
      }
    );

  }


  if (
    clusterIds
    &&
    clusterIds.length >
      0
  ) {

    const plannedClusterIds =
      new Set(
        plan.clusters.map(
          cluster =>
            cluster.macrolocal_cluster_id
        )
      );


    const missingClusterIds =
      clusterIds.filter(
        clusterId =>
          !plannedClusterIds.has(
            clusterId
          )
      );


    if (
      missingClusterIds.length >
      0
    ) {

      return Response.json(
        {
          ok:
            false,

          error:
            `Выбранные кластеры отсутствуют в текущем расчёте: ${missingClusterIds.join(
              ", "
            )}`,
        },
        {
          status:
            409,
        }
      );

    }

  }


  const tooLarge =
    plan.clusters.find(
      cluster =>
        cluster.items.length >
        5000
    );


  if (tooLarge) {

    return Response.json(
      {
        ok:
          false,

        error:
          `В макрокластере ${tooLarge.macrolocal_cluster_id} больше 5000 SKU. Ozon не примет такой черновик.`,
      },
      {
        status:
          409,
      }
    );

  }


  const sellerWarehouse =
    sellerWarehouses.find(
      warehouse =>
        normalizeKey(
          warehouse.seller_warehouse_id
        ) ===
          MOSCOW_SELLER_WAREHOUSE_ID
        &&
        warehouse.is_active !==
          false
    );


  if (!sellerWarehouse) {

    return Response.json(
      {
        ok:
          false,

        error:
          "Не найден активный склад МСК ФБС с seller_warehouse_id 1020005014074930",
      },
      {
        status:
          409,
      }
    );

  }


  const formationDate =
    getMoscowDate();

  const targetDate =
    addDays(
      formationDate,
      MIN_TIMESLOT_LEAD_DAYS
    );

  const windowDateFrom =
    addDays(
      formationDate,
      MIN_TIMESLOT_LEAD_DAYS
    );

  const windowDateTo =
    addDays(
      formationDate,
      TIMESLOT_SEARCH_HORIZON_DAYS
    );


  const supplyRunId =
    await supabaseRpc<
      string
    >(
      "create_ozon_fbo_supply_run",
      {
        p_calculation_run_id:
          run.id,

        p_seller_warehouse_id:
          Number(
            MOSCOW_SELLER_WAREHOUSE_ID
          ),

        p_drop_off_warehouse_id:
          dropOff.resolved_warehouse_id,

        p_drop_off_warehouse_type:
          dropOff.resolved_warehouse_type,

        p_drop_off_name:
          normalizeKey(
            dropOff.name
          )
          ||
          null,

        p_drop_off_address:
          normalizeKey(
            dropOff.address
          )
          ||
          null,

        p_formation_date:
          formationDate,

        p_target_date:
          targetDate,

        p_window_date_from:
          windowDateFrom,

        p_window_date_to:
          windowDateTo,

        p_clusters:
          plan.clusters,
      }
    );


  await parkSupplyRequests(
    supplyRunId
  );


  await activateSupplyRequests(
    supplyRunId,
    clusterIds
  );


  return Response.json(
    await refreshAndSerializeRun(
      supplyRunId
    )
  );

}



// ============================================================
// TEST / DRY-RUN
//
// ВАЖНО:
// - создаёт только временные draft_id в Ozon;
// - НЕ вызывает /v2/draft/supply/create;
// - НЕ создаёт реальную заявку;
// - НЕ пишет очередь реальных поставок в Supabase.
// ============================================================

function rejectedSkusForCluster(
  errors:
    DraftCreateError[]
    | undefined,

  macrolocalClusterId:
    number
) {

  const rejected =
    new Set<number>();


  for (
    const error
    of errors
    ??
    []
  ) {

    for (
      const validation
      of error.items_validation
      ??
      []
    ) {

      const validationClusterId =
        Number(
          (
            validation as {
              macrolocal_cluster_id?:
                number;
            }
          ).macrolocal_cluster_id
        );


      if (
        Number.isFinite(
          validationClusterId
        )
        &&
        validationClusterId !==
          macrolocalClusterId
      ) {

        continue;

      }


      for (
        const item
        of validation.rejected_items
        ??
        []
      ) {

        const sku =
          toPositiveInteger(
            item.sku
          );


        if (
          sku !==
          null
        ) {

          rejected.add(
            sku
          );

        }

      }

    }

  }


  return Array.from(
    rejected
  );

}


async function waitForDraftInfo(
  draftId:
    number
) {

  let last:
    DraftInfoResponse =
    {};


  for (
    let attempt = 0;
    attempt < 20;
    attempt++
  ) {

    last =
      await ozonPost<
        DraftInfoResponse
      >(
        "/v2/draft/create/info",
        {
          draft_id:
            draftId,
        }
      );


    if (
      last.status ===
        "SUCCESS"
      ||
      last.status ===
        "FAILED"
    ) {

      return last;

    }


    await sleep(
      2500
    );

  }


  return last;

}


function mapPreviewWarehouse(
  warehouse:
    DraftInfoWarehouse,

  fullUnits:
    number
) {

  const warehouseId =
    toPositiveInteger(
      warehouse
        .storage_warehouse
        ?.warehouse_id
    );


  if (
    warehouseId ===
    null
  ) {

    return null;

  }


  const availability =
    normalizeKey(
      warehouse
        .availability_status
        ?.state
    )
    ||
    "UNSPECIFIED";


  return {
    warehouse_id:
      warehouseId,

    name:
      normalizeKey(
        warehouse
          .storage_warehouse
          ?.name
      )
      ||
      null,

    address:
      normalizeKey(
        warehouse
          .storage_warehouse
          ?.address
      )
      ||
      null,

    availability,

    invalid_reason:
      normalizeKey(
        warehouse
          .availability_status
          ?.invalid_reason
      )
      ||
      null,

    total_score:
      Number.isFinite(
        Number(
          warehouse.total_score
        )
      )
        ? Number(
            warehouse.total_score
          )
        : null,

    total_rank:
      Number.isFinite(
        Number(
          warehouse.total_rank
        )
      )
        ? Number(
            warehouse.total_rank
          )
        : null,

    full_quantity_units:
      availability ===
        "FULL_AVAILABLE"
        ? fullUnits
        : null,
  } satisfies PreviewWarehouse;

}


async function previewSupplyPlan() {

  const run =
    await getLatestReplenishmentRun();


  if (!run) {

    return Response.json(
      {
        ok:
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


  const dashboard =
    await getDashboard();


  const latestSync =
    dashboard.latest_sync;


  const fresh =
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


  if (!fresh) {

    return Response.json(
      {
        ok:
          false,

        error:
          "Расчёт потребности не соответствует последней успешной синхронизации Ozon. Тест не запускался.",
      },
      {
        status:
          409,
      }
    );

  }


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

        error:
          "В свежем расчёте нет положительной потребности",
      },
      {
        status:
          409,
      }
    );

  }


  const [
    russianClusters,
    cisClusters,
    sellerWarehouses,
    dropOff,
    products,
  ] =
    await Promise.all([
      getClusters(
        "CLUSTER_TYPE_OZON"
      ),

      getClusters(
        "CLUSTER_TYPE_CIS"
      ),

      getSellerWarehouses(),

      resolveDropOff(),
      getProducts(),
    ]);


  const belarusClusters =
    cisClusters.filter(
      isBelarusCluster
    );


  const excludedCisClusterIds =
    new Set(
      cisClusters
        .filter(
          cluster =>
            !isBelarusCluster(
              cluster
            )
        )
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


  const plan =
    buildSupplyPlan(
      replenishmentItems,
      products,
      [
        ...russianClusters,
        ...belarusClusters,
      ],
      excludedCisClusterIds
    );


  if (
    plan.unresolved.length >
    0
  ) {

    return Response.json(
      {
        ok:
          false,

        error:
          "Есть строки потребности, которые нельзя безопасно сопоставить с кластером или Ozon SKU. Даже тестовый draft не создавался.",

        unresolved_count:
          plan.unresolved.length,

        sample:
          plan.unresolved.slice(
            0,
            50
          ),
      },
      {
        status:
          409,
      }
    );

  }


  if (
    plan.clusters.length ===
    0
  ) {

    return Response.json(
      {
        ok:
          false,

        error:
          "После применения географии Россия + Беларусь не осталось кластеров для проверки",
      },
      {
        status:
          409,
      }
    );

  }


  const sellerWarehouse =
    sellerWarehouses.find(
      warehouse =>
        normalizeKey(
          warehouse.seller_warehouse_id
        ) ===
          MOSCOW_SELLER_WAREHOUSE_ID
        &&
        warehouse.is_active !==
          false
    );


  if (!sellerWarehouse) {

    return Response.json(
      {
        ok:
          false,

        error:
          "Не найден активный склад МСК ФБС с seller_warehouse_id 1020005014074930",
      },
      {
        status:
          409,
      }
    );

  }


  const formationDate =
    getMoscowDate();

  const targetDate =
    addDays(
      formationDate,
      MIN_TIMESLOT_LEAD_DAYS
    );

  const windowDateFrom =
    addDays(
      formationDate,
      MIN_TIMESLOT_LEAD_DAYS
    );

  const windowDateTo =
    addDays(
      formationDate,
      TIMESLOT_SEARCH_HORIZON_DAYS
    );


  const batches =
    chunkArray(
      plan.clusters,
      20
    );


  const previewClusters:
    PreviewCluster[] =
    [];

  const draftIds:
    number[] =
    [];


  let lastDraftCreatedAt =
    0;


  for (
    let batchIndex = 0;
    batchIndex < batches.length;
    batchIndex++
  ) {

    const batch =
      batches[
        batchIndex
      ];


    if (
      batchIndex >
      0
    ) {

      const elapsed =
        Date.now()
        -
        lastDraftCreatedAt;

      const waitMs =
        Math.max(
          0,
          DRAFT_GAP_SECONDS
          *
          1000
          -
          elapsed
        );


      if (
        waitMs >
        0
      ) {

        await sleep(
          waitMs
        );

      }

    }


    lastDraftCreatedAt =
      Date.now();


    let draft:
      DraftCreateResponse;


    try {

      draft =
        await ozonPost<
          DraftCreateResponse
        >(
          "/v1/draft/multi-cluster/create",
          {
            clusters_info:
              batch.map(
                cluster => ({
                  macrolocal_cluster_id:
                    cluster.macrolocal_cluster_id,

                  items:
                    cluster.items,
                })
              ),

            deletion_sku_mode:
              "PARTIAL",

            delivery_info: {
              type:
                "DROPOFF",

              drop_off_warehouse: {
                warehouse_id:
                  dropOff.resolved_warehouse_id,

                warehouse_type:
                  dropOff.resolved_warehouse_type,
              },

              seller_warehouse_id:
                Number(
                  MOSCOW_SELLER_WAREHOUSE_ID
                ),
            },
          }
        );

    } catch (error) {

      const message =
        error instanceof Error
          ? error.message
          : String(
              error
            );


      for (
        const cluster
        of batch
      ) {

        const requestedUnits =
          cluster.items.reduce(
            (
              total,
              item
            ) =>
              total
              +
              item.quantity,
            0
          );


        previewClusters.push({
          macrolocal_cluster_id:
            cluster.macrolocal_cluster_id,

          cluster_name:
            cluster.cluster_name,

          requested_units:
            requestedUnits,

          draft_accepted_units:
            0,

          rejected_units:
            requestedUnits,

          sku_count:
            cluster.items.length,

          rejected_skus:
            [],

          draft_id:
            null,

          status:
            "error",

          recommended_warehouse:
            null,

          warehouses:
            [],

          error:
            message,
        });

      }


      continue;

    }


    const draftId =
      toPositiveInteger(
        draft.draft_id
      );


    const createErrors =
      meaningfulErrors(
        draft.errors
      );


    if (
      draftId ===
        null
    ) {

      const message =
        createErrors.length >
          0
          ? formatErrors(
              createErrors
            )
          : "Ozon не вернул draft_id";


      for (
        const cluster
        of batch
      ) {

        const requestedUnits =
          cluster.items.reduce(
            (
              total,
              item
            ) =>
              total
              +
              item.quantity,
            0
          );


        previewClusters.push({
          macrolocal_cluster_id:
            cluster.macrolocal_cluster_id,

          cluster_name:
            cluster.cluster_name,

          requested_units:
            requestedUnits,

          draft_accepted_units:
            0,

          rejected_units:
            requestedUnits,

          sku_count:
            cluster.items.length,

          rejected_skus:
            [],

          draft_id:
            null,

          status:
            "error",

          recommended_warehouse:
            null,

          warehouses:
            [],

          error:
            message,
        });

      }


      continue;

    }


    draftIds.push(
      draftId
    );


    const info =
      await waitForDraftInfo(
        draftId
      );


    if (
      info.status !==
      "SUCCESS"
    ) {

      const infoErrors =
        meaningfulErrors(
          info.errors
        );

      const message =
        infoErrors.length >
          0
          ? formatErrors(
              infoErrors
            )
          : `Ozon вернул статус черновика ${normalizeKey(
              info.status
            )
            ||
            "UNKNOWN"}`;


      for (
        const cluster
        of batch
      ) {

        const requestedUnits =
          cluster.items.reduce(
            (
              total,
              item
            ) =>
              total
              +
              item.quantity,
            0
          );


        previewClusters.push({
          macrolocal_cluster_id:
            cluster.macrolocal_cluster_id,

          cluster_name:
            cluster.cluster_name,

          requested_units:
            requestedUnits,

          draft_accepted_units:
            0,

          rejected_units:
            requestedUnits,

          sku_count:
            cluster.items.length,

          rejected_skus:
            [],

          draft_id:
            draftId,

          status:
            "error",

          recommended_warehouse:
            null,

          warehouses:
            [],

          error:
            message,
        });

      }


      continue;

    }


    for (
      const cluster
      of batch
    ) {

      const requestedUnits =
        cluster.items.reduce(
          (
            total,
            item
          ) =>
            total
            +
            item.quantity,
          0
        );


      const rejectedSkus =
        rejectedSkusForCluster(
          [
            ...(
              draft.errors
              ??
              []
            ),
            ...(
              info.errors
              ??
              []
            ),
          ],
          cluster.macrolocal_cluster_id
        );


      const rejectedSkuSet =
        new Set(
          rejectedSkus
        );


      const rejectedUnits =
        cluster.items.reduce(
          (
            total,
            item
          ) =>
            total
            +
            (
              rejectedSkuSet.has(
                item.sku
              )
                ? item.quantity
                : 0
            ),
          0
        );


      const draftAcceptedUnits =
        Math.max(
          0,
          requestedUnits
          -
          rejectedUnits
        );


      const infoCluster =
        (
          info.clusters
          ??
          []
        ).find(
          item =>
            Number(
              item.macrolocal_cluster_id
            ) ===
            cluster.macrolocal_cluster_id
        );


      const availableWarehouses =
        (
          infoCluster
            ?.warehouses
          ??
          []
        )
          .map(
            warehouse =>
              mapPreviewWarehouse(
                warehouse,
                draftAcceptedUnits
              )
          )
          .filter(
            (
              warehouse
            ): warehouse is PreviewWarehouse =>
              warehouse !==
                null
              &&
              (
                warehouse.availability ===
                  "FULL_AVAILABLE"
                ||
                warehouse.availability ===
                  "PARTIAL_AVAILABLE"
              )
          )
          .sort(
            (
              left,
              right
            ) => {

              if (
                left.availability !==
                right.availability
              ) {

                if (
                  left.availability ===
                  "FULL_AVAILABLE"
                ) {

                  return -1;

                }


                if (
                  right.availability ===
                  "FULL_AVAILABLE"
                ) {

                  return 1;

                }

              }


              return (
                (
                  right.total_score
                  ??
                  0
                )
                -
                (
                  left.total_score
                  ??
                  0
                )
              );

            }
          );


      const recommendedRaw =
        chooseStorageWarehouse(
          info,
          cluster.macrolocal_cluster_id
        );


      const recommended =
        recommendedRaw
          ? mapPreviewWarehouse(
              recommendedRaw,
              draftAcceptedUnits
            )
          : null;


      const hasFull =
        availableWarehouses.some(
          warehouse =>
            warehouse.availability ===
            "FULL_AVAILABLE"
        );


      const hasPartial =
        availableWarehouses.some(
          warehouse =>
            warehouse.availability ===
            "PARTIAL_AVAILABLE"
        );


      previewClusters.push({
        macrolocal_cluster_id:
          cluster.macrolocal_cluster_id,

        cluster_name:
          cluster.cluster_name,

        requested_units:
          requestedUnits,

        draft_accepted_units:
          draftAcceptedUnits,

        rejected_units:
          rejectedUnits,

        sku_count:
          cluster.items.length,

        rejected_skus:
          rejectedSkus,

        draft_id:
          draftId,

        status:
          hasFull
            ? "available"
            : hasPartial
              ? "partial"
              : "not_available",

        recommended_warehouse:
          recommended,

        warehouses:
          availableWarehouses,

        error:
          availableWarehouses.length >
            0
            ? null
            : "Ozon не предложил доступный склад размещения для этого состава.",
      });

    }

  }


  previewClusters.sort(
    (
      left,
      right
    ) =>
      left.macrolocal_cluster_id
      -
      right.macrolocal_cluster_id
  );


  const availableClusters =
    previewClusters.filter(
      cluster =>
        cluster.status ===
        "available"
    ).length;

  const partialClusters =
    previewClusters.filter(
      cluster =>
        cluster.status ===
        "partial"
    ).length;

  const blockedClusters =
    previewClusters.filter(
      cluster =>
        cluster.status ===
          "not_available"
        ||
        cluster.status ===
          "error"
    ).length;

  const requestedUnits =
    previewClusters.reduce(
      (
        total,
        cluster
      ) =>
        total
        +
        cluster.requested_units,
      0
    );

  const acceptedUnits =
    previewClusters.reduce(
      (
        total,
        cluster
      ) =>
        total
        +
        cluster.draft_accepted_units,
      0
    );

  const rejectedUnits =
    previewClusters.reduce(
      (
        total,
        cluster
      ) =>
        total
        +
        cluster.rejected_units,
      0
    );


  const payload:
    PreviewPayload =
    {
      ok:
        true,

      mode:
        "preview_only",

      real_supply_created:
        false,

      calculation_run_id:
        run.id,

      formation_date:
        formationDate,

      target_date:
        targetDate,

      window_date_from:
        windowDateFrom,

      window_date_to:
        windowDateTo,

      drop_off: {
        warehouse_id:
          dropOff.resolved_warehouse_id,

        warehouse_type:
          dropOff.resolved_warehouse_type,

        name:
          normalizeKey(
            dropOff.name
          )
          ||
          null,

        address:
          normalizeKey(
            dropOff.address
          )
          ||
          null,
      },

      draft_ids:
        draftIds,

      summary: {
        clusters:
          previewClusters.length,

        available_clusters:
          availableClusters,

        partial_clusters:
          partialClusters,

        blocked_clusters:
          blockedClusters,

        requested_units:
          requestedUnits,

        draft_accepted_units:
          acceptedUnits,

        rejected_units:
          rejectedUnits,
      },

      clusters:
        previewClusters,

      warnings: [
        "Реальные заявки Ozon не создавались.",

        "Для проверки доступности Ozon создаёт только технические черновики draft_id.",

        "FULL_AVAILABLE означает, что Ozon принимает полный состав после SKU-валидации.",

        "PARTIAL_AVAILABLE означает, что склад доступен только частично; точное количество по конкретному складу этот ответ Ozon не сообщает.",
      ],
    };


  return Response.json(
    payload
  );

}


// ============================================================
// ROW UPDATES
// ============================================================

async function updateRequest(
  id:
    string,

  values:
    Record<string, unknown>
) {

  await supabasePatch(
    `ozon_fbo_supply_requests?id=eq.${encodeURIComponent(
      id
    )}`,
    {
      ...values,

      updated_at:
        new Date()
          .toISOString(),
    }
  );

}


async function releaseRequest(
  row:
    SupplyRequestRow,

  values:
    Record<string, unknown>
) {

  await updateRequest(
    row.id,
    {
      ...values,

      is_processing:
        false,

      processing_started_at:
        null,
    }
  );

}


async function updateRun(
  runId:
    string,

  values:
    Record<string, unknown>
) {

  await supabasePatch(
    `ozon_fbo_supply_runs?id=eq.${encodeURIComponent(
      runId
    )}`,
    {
      ...values,

      updated_at:
        new Date()
          .toISOString(),
    }
  );

}


async function getBundleSkuSet(
  bundleId:
    string
) {

  const result =
    new Set<number>();


  let lastId =
    "";


  for (
    let page = 0;
    page < 50;
    page++
  ) {

    const response =
      await ozonPost<
        BundleResponse
      >(
        "/v1/supply-order/bundle",
        {
          bundle_ids: [
            bundleId,
          ],

          is_asc:
            true,

          limit:
            100,

          sort_field:
            "SKU",

          ...(
            lastId
              ? {
                  last_id:
                    lastId,
                }
              : {}
          ),
        }
      );


    for (
      const item
      of response.items
      ??
      []
    ) {

      const sku =
        toPositiveInteger(
          item.sku
        );


      if (
        sku !==
        null
      ) {

        result.add(
          sku
        );

      }

    }


    if (
      !response.has_next
    ) {

      break;

    }


    const nextLastId =
      normalizeKey(
        response.last_id
      );


    if (
      !nextLastId
      ||
      nextLastId ===
        lastId
    ) {

      break;

    }


    lastId =
      nextLastId;

  }


  return result;

}


function choosePartialMatrixBundle(
  info:
    DraftInfoResponse,

  macrolocalClusterId:
    number
) {

  const cluster =
    (
      info.clusters
      ??
      []
    ).find(
      item =>
        Number(
          item.macrolocal_cluster_id
        ) ===
        macrolocalClusterId
    );


  if (!cluster) {

    return null;

  }


  return (
    cluster.warehouses
    ??
    []
  )
    .filter(
      warehouse => {

        const state =
          normalizeKey(
            warehouse
              .availability_status
              ?.state
          );

        const reason =
          normalizeKey(
            warehouse
              .availability_status
              ?.invalid_reason
          );

        const bundleId =
          normalizeKey(
            warehouse
              .bundle_id
          );


        return (
          state ===
            "PARTIAL_AVAILABLE"
          &&
          reason ===
            "PARTIAL_MATRIX_AVAILABLE"
          &&
          Boolean(
            bundleId
          )
        );

      }
    )
    .sort(
      (
        left,
        right
      ) => {

        const scoreDiff =
          Number(
            right.total_score
            ??
            0
          )
          -
          Number(
            left.total_score
            ??
            0
          );


        if (
          scoreDiff !==
          0
        ) {

          return scoreDiff;

        }


        return (
          Number(
            left.total_rank
            ??
            Number.MAX_SAFE_INTEGER
          )
          -
          Number(
            right.total_rank
            ??
            Number.MAX_SAFE_INTEGER
          )
        );

      }
    )[
      0
    ]
    ??
    null;

}


type StorageWarehouseCandidate = {
  warehouse_id:
    number;

  name:
    string | null;
};


async function storageWarehouseCandidates(
  macrolocalClusterId:
    number
) {

  const clusters =
    await getMacrolocalClustersV2();


  const cluster =
    clusters.find(
      item =>
        toPositiveInteger(
          item.macrolocal_cluster_id
        ) ===
        macrolocalClusterId
    );


  const candidates =
    (
      cluster
        ?.data
        ?.fulfillments
      ??
      []
    )
      .map(
        fulfillment => {

          const warehouseId =
            toPositiveInteger(
              fulfillment.warehouse_id
            );


          if (
            warehouseId ===
              null
          ) {

            return null;

          }


          return {
            warehouse_id:
              warehouseId,

            name:
              normalizeKey(
                fulfillment.name
              )
              ||
              null,
          } satisfies
            StorageWarehouseCandidate;

        }
      )
      .filter(
        (
          candidate
        ): candidate is StorageWarehouseCandidate =>
          candidate !==
            null
      );


  const unique =
    new Map<
      number,
      StorageWarehouseCandidate
    >();


  for (
    const candidate
    of candidates
  ) {

    unique.set(
      candidate.warehouse_id,
      candidate
    );

  }


  return Array.from(
    unique.values()
  );

}


async function findStorageWarehouseByTimeslot(
  row:
    SupplyRequestRow,

  run:
    SupplyRunRow,

  draftId:
    number,

  macrolocalClusterId:
    number
) {

  const candidates =
    await storageWarehouseCandidates(
      macrolocalClusterId
    );


  let firstAccepted:
    {
      warehouse:
        StorageWarehouseCandidate;

      timeslots:
        TimeslotResponse;

      slot:
        ReturnType<
          typeof chooseTimeslot
        >;
    }
    |
    null =
    null;


  const diagnostics:
    Array<{
      warehouse_id:
        number | null;

      name:
        string | null;

      result:
        string;
    }> =
    [];


  for (
    const candidate
    of candidates
  ) {

    const warehouseId =
      candidate.warehouse_id;


    try {

      const timeslots =
        await ozonPost<
          TimeslotResponse
        >(
          "/v2/draft/timeslot/info",
          {
            date_from:
              run.window_date_from,

            date_to:
              run.window_date_to,

            draft_id:
              draftId,

            supply_type:
              "CROSSDOCK",

            selected_cluster_warehouses: [
              {
                macrolocal_cluster_id:
                  macrolocalClusterId,

                storage_warehouse_id:
                  warehouseId,
              },
            ],
          }
        );


      const errorReason =
        normalizeKey(
          timeslots.error_reason
        );


      if (
        errorReason
        &&
        errorReason !==
          "UNSPECIFIED"
      ) {

        diagnostics.push({
          warehouse_id:
            warehouseId,

          name:
            candidate.name,

          result:
            errorReason,
        });


        await sleep(
          650
        );


        continue;

      }


      const slot =
        chooseTimeslot(
          timeslots,
          run.formation_date
        );


      const accepted = {
        warehouse:
          candidate,

        timeslots,

        slot,
      };


      diagnostics.push({
        warehouse_id:
          warehouseId,

        name:
          candidate.name,

        result:
          slot
            ? "accepted_with_slot"
            : "accepted_without_slot",
      });


      if (
        slot
      ) {

        return {
          ...accepted,

          diagnostics,
        };

      }


      if (
        !firstAccepted
      ) {

        firstAccepted =
          accepted;

      }

    } catch (
      error
    ) {

      if (
        error instanceof
          OzonApiError
        &&
        error.transient
      ) {

        throw error;

      }


      diagnostics.push({
        warehouse_id:
          warehouseId,

        name:
          candidate.name,

        result:
          error instanceof
            Error
            ? error.message
            : String(
                error
              ),
      });

    }


    await sleep(
      650
    );

  }


  return firstAccepted
    ? {
        ...firstAccepted,

        diagnostics,
      }
    : {
        warehouse:
          null,

        timeslots:
          null,

        slot:
          null,

        diagnostics,
      };

}


// ============================================================
// ВЫБОР СКЛАДА РАЗМЕЩЕНИЯ
// ============================================================

function chooseStorageWarehouse(
  info:
    DraftInfoResponse,

  macrolocalClusterId:
    number
) {

  const cluster =
    (
      info.clusters
      ??
      []
    ).find(
      item =>
        Number(
          item.macrolocal_cluster_id
        ) ===
        macrolocalClusterId
    );


  if (!cluster) {

    return null;

  }


  const candidates =
    (
      cluster.warehouses
      ??
      []
    )
      .filter(
        warehouse => {

          const state =
            normalizeKey(
              warehouse
                .availability_status
                ?.state
            );


          return (
            (
              state ===
                "FULL_AVAILABLE"
              ||
              state ===
                "PARTIAL_AVAILABLE"
            )
            &&
            toPositiveInteger(
              warehouse
                .storage_warehouse
                ?.warehouse_id
            ) !==
              null
          );

        }
      )
      .sort(
        (
          left,
          right
        ) => {

          const leftState =
            normalizeKey(
              left
                .availability_status
                ?.state
            );

          const rightState =
            normalizeKey(
              right
                .availability_status
                ?.state
            );


          if (
            leftState !==
            rightState
          ) {

            if (
              leftState ===
              "FULL_AVAILABLE"
            ) {

              return -1;

            }


            if (
              rightState ===
              "FULL_AVAILABLE"
            ) {

              return 1;

            }

          }


          const scoreDiff =
            Number(
              right.total_score
              ??
              0
            )
            -
            Number(
              left.total_score
              ??
              0
            );


          if (
            scoreDiff !==
            0
          ) {

            return scoreDiff;

          }


          return (
            Number(
              left.total_rank
              ??
              Number.MAX_SAFE_INTEGER
            )
            -
            Number(
              right.total_rank
              ??
              Number.MAX_SAFE_INTEGER
            )
          );

        }
      );


  return candidates[
    0
  ]
  ??
  null;

}


// ============================================================
// ВЫБОР ТАЙМСЛОТА: +7, +6, +8, +5, +9
// ============================================================

function chooseTimeslot(
  response:
    TimeslotResponse,

  formationDate:
    string
) {

  const minimumDate =
    addDays(
      formationDate,
      MIN_TIMESLOT_LEAD_DAYS
    );


  const days =
    [
      ...(
        response
          .result
          ?.drop_off_warehouse_timeslots
          ?.days
        ??
        []
      ),
    ]
      .filter(
        day => {

          const date =
            normalizeKey(
              day.date_in_timezone
            ).slice(
              0,
              10
            );


          return Boolean(
            date
            &&
            date >=
              minimumDate
          );

        }
      )
      .sort(
        (
          left,
          right
        ) =>
          normalizeKey(
            left.date_in_timezone
          ).localeCompare(
            normalizeKey(
              right.date_in_timezone
            )
          )
      );


  for (
    const day
    of days
  ) {

    const date =
      normalizeKey(
        day.date_in_timezone
      ).slice(
        0,
        10
      );


    const slots =
      [
        ...(
          day.timeslots
          ??
          []
        ),
      ]
        .filter(
          slot =>
            Boolean(
              slot.from_in_timezone
              &&
              slot.to_in_timezone
            )
        )
        .sort(
          (
            left,
            right
          ) => {

            const leftTime =
              Date.parse(
                left.from_in_timezone
                ??
                ""
              );

            const rightTime =
              Date.parse(
                right.from_in_timezone
                ??
                ""
              );


            if (
              Number.isFinite(
                leftTime
              )
              &&
              Number.isFinite(
                rightTime
              )
            ) {

              return leftTime
              -
              rightTime;

            }


            return normalizeKey(
              left.from_in_timezone
            ).localeCompare(
              normalizeKey(
                right.from_in_timezone
              )
            );

          }
        );


    const firstSlot =
      slots[
        0
      ];


    if (
      firstSlot
      &&
      firstSlot.from_in_timezone
      &&
      firstSlot.to_in_timezone
    ) {

      return {
        date,

        from:
          firstSlot.from_in_timezone,

        to:
          firstSlot.to_in_timezone,
      };

    }

  }


  return null;

}


// ============================================================
// PROCESS ONE STEP
// ============================================================

async function processOne(
  runId:
    string
) {

  const run =
    await getSupplyRun(
      runId
    );


  if (!run) {

    return Response.json(
      {
        ok:
          false,

        error:
          "Supply run не найден",
      },
      {
        status:
          404,
      }
    );

  }


  if (
    run.status !==
    "running"
  ) {

    return Response.json(
      await refreshAndSerializeRun(
        runId
      )
    );

  }


  const claimed =
    await supabaseRpc<
      SupplyRequestRow[]
    >(
      "claim_next_ozon_fbo_supply_request",
      {
        p_run_id:
          runId,
      }
    );


  const row =
    claimed[
      0
    ];


  if (!row) {

    const payload =
      await refreshAndSerializeRun(
        runId
      );


    return Response.json(
      payload
    );

  }


  if (
    row.attempts >
    MAX_PROCESS_ATTEMPTS
  ) {

    await releaseRequest(
      row,
      {
        status:
          "failed",

        error_message:
          "Превышено защитное число попыток обработки кластера",
      }
    );


    return Response.json(
      await refreshAndSerializeRun(
        runId
      )
    );

  }


  const macrolocalClusterId =
    toPositiveInteger(
      row.macrolocal_cluster_id
    );


  if (
    macrolocalClusterId ===
    null
  ) {

    await releaseRequest(
      row,
      {
        status:
          "failed",

        error_message:
          "Некорректный macrolocal_cluster_id",
      }
    );


    return Response.json(
      await refreshAndSerializeRun(
        runId
      )
    );

  }


  try {

    // ========================================================
    // 1. СОЗДАНИЕ CROSS-DOCK DRAFT
    // ========================================================

    if (
      row.status ===
      "queued"
    ) {

      const allowedAt =
        asTimestamp(
          run.next_draft_allowed_at
        );


      if (
        allowedAt !==
          null
        &&
        allowedAt >
          Date.now()
      ) {

        await releaseRequest(
          row,
          {
            next_attempt_at:
              new Date(
                allowedAt
              ).toISOString(),

            error_message:
              null,
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      await updateRun(
        runId,
        {
          next_draft_allowed_at:
            laterIso(
              DRAFT_GAP_SECONDS
            ),
        }
      );


      const draft =
        await ozonPost<
          DraftCreateResponse
        >(
          "/v1/draft/crossdock/create",
          {
            cluster_info: {
              items:
                row.items.map(
                  item => ({
                    sku:
                      Number(
                        item.sku
                      ),

                    quantity:
                      Number(
                        item.quantity
                      ),
                  })
                ),

              macrolocal_cluster_id:
                macrolocalClusterId,
            },

            deletion_sku_mode:
              "PARTIAL",

            delivery_info: {
              type:
                "DROPOFF",

              drop_off_warehouse: {
                warehouse_id:
                  Number(
                    run.drop_off_warehouse_id
                  ),

                warehouse_type:
                  run.drop_off_warehouse_type,
              },

              seller_warehouse_id:
                Number(
                  run.seller_warehouse_id
                ),
            },
          }
        );


      const errors =
        meaningfulErrors(
          draft.errors
        );


      if (
        errors.length >
        0
      ) {

        await releaseRequest(
          row,
          {
            status:
              "failed",

            raw_draft:
              draft,

            error_message:
              `Ozon отклонил черновик: ${formatErrors(
                errors
              )}`,
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      const draftId =
        toPositiveInteger(
          draft.draft_id
        );


      if (
        draftId ===
        null
      ) {

        throw new Error(
          "Ozon не вернул draft_id"
        );

      }


      await releaseRequest(
        row,
        {
          status:
            "draft_created",

          draft_id:
            draftId,

          raw_draft:
            draft,

          next_attempt_at:
            laterIso(
              3
            ),

          error_message:
            null,
        }
      );


      return Response.json(
        await refreshAndSerializeRun(
          runId
        )
      );

    }


    // ========================================================
    // 2. INFO ПО DRAFT И ВЫБОР СКЛАДА РАЗМЕЩЕНИЯ
    // ========================================================

    if (
      row.status ===
      "draft_created"
    ) {

      const draftId =
        toPositiveInteger(
          row.draft_id
        );


      if (
        draftId ===
        null
      ) {

        throw new Error(
          "У очереди отсутствует draft_id"
        );

      }


      const info =
        await ozonPost<
          DraftInfoResponse
        >(
          "/v2/draft/create/info",
          {
            draft_id:
              draftId,
          }
        );


      if (
        info.status ===
        "IN_PROGRESS"
        ||
        info.status ===
        "UNSPECIFIED"
      ) {

        await releaseRequest(
          row,
          {
            raw_info:
              info,

            next_attempt_at:
              laterIso(
                31
              ),

            error_message:
              null,
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      if (
        info.status !==
        "SUCCESS"
      ) {

        const errors =
          meaningfulErrors(
            info.errors
          );


        await releaseRequest(
          row,
          {
            status:
              "failed",

            raw_info:
              info,

            error_message:
              errors.length >
                0
                ? `Ozon не сформировал черновик: ${formatErrors(
                    errors
                  )}`
                : `Ozon вернул статус черновика ${normalizeKey(
                    info.status
                  )
                  ||
                  "UNKNOWN"}`,
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      const warehouse =
        chooseStorageWarehouse(
          info,
          macrolocalClusterId
        );


      const storageId =
        toPositiveInteger(
          warehouse
            ?.storage_warehouse
            ?.warehouse_id
        );


      if (
        !warehouse
        ||
        storageId ===
          null
      ) {

        const partialMatrix =
          choosePartialMatrixBundle(
            info,
            macrolocalClusterId
          );


        const bundleId =
          normalizeKey(
            partialMatrix
              ?.bundle_id
          );


        if (bundleId) {

          const acceptedSkus =
            await getBundleSkuSet(
              bundleId
            );


          const filteredItems =
            row.items.filter(
              item => {

                const sku =
                  toPositiveInteger(
                    item.sku
                  );


                return (
                  sku !==
                    null
                  &&
                  acceptedSkus.has(
                    sku
                  )
                );

              }
            );


          const sameComposition =
            filteredItems.length ===
              row.items.length
            &&
            row.items.every(
              item => {

                const sku =
                  toPositiveInteger(
                    item.sku
                  );


                return (
                  sku !==
                    null
                  &&
                  acceptedSkus.has(
                    sku
                  )
                );

              }
            );


          if (
            filteredItems.length >
              0
            &&
            !sameComposition
          ) {

            const totalUnits =
              filteredItems.reduce(
                (
                  sum,
                  item
                ) =>
                  sum
                  +
                  Number(
                    item.quantity
                  ),
                0
              );


            await releaseRequest(
              row,
              {
                status:
                  "queued",

                items:
                  filteredItems,

                sku_count:
                  filteredItems.length,

                total_units:
                  totalUnits,

                draft_id:
                  null,

                storage_warehouse_id:
                  null,

                storage_warehouse_name:
                  null,

                storage_warehouse_address:
                  null,

                timeslot_from:
                  null,

                timeslot_to:
                  null,

                raw_info:
                  info,

                next_attempt_at:
                  new Date()
                    .toISOString(),

                error_message:
                  `Ozon вернул PARTIAL_MATRIX_AVAILABLE. Состав автоматически сужен с ${row.items.length} до ${filteredItems.length} SKU по bundle_id и будет пересоздан.`,
              }
            );


            return Response.json(
              await refreshAndSerializeRun(
                runId
              )
            );

          }

        }


        // С апреля 2026 для CROSSDOCK Ozon работает
        // на уровне кластера и сам распределяет товар по складам
        // хранения внутри него. В таком сценарии
        // storage_warehouse может быть null даже при FULL_AVAILABLE.
        // Это не ошибка: дальше передаём только macrolocal_cluster_id.
        await releaseRequest(
          row,
          {
            status:
              "draft_ready",

            storage_warehouse_id:
              null,

            storage_warehouse_name:
              null,

            storage_warehouse_address:
              null,

            raw_info:
              info,

            next_attempt_at:
              new Date()
                .toISOString(),

            error_message:
              null,
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      await releaseRequest(
        row,
        {
          status:
            "draft_ready",

          storage_warehouse_id:
            storageId,

          storage_warehouse_name:
            normalizeKey(
              warehouse
                .storage_warehouse
                ?.name
            )
            ||
            null,

          storage_warehouse_address:
            normalizeKey(
              warehouse
                .storage_warehouse
                ?.address
            )
            ||
            null,

          raw_info:
            info,

          next_attempt_at:
            new Date()
              .toISOString(),

          error_message:
            null,
        }
      );


      return Response.json(
        await refreshAndSerializeRun(
          runId
        )
      );

    }


    // ========================================================
    // 3. ТАЙМСЛОТ: НЕ РАНЬШЕ +3 СУТОК, ДАЛЬШЕ БЛИЖАЙШИЙ
    // ========================================================

    if (
      row.status ===
      "draft_ready"
    ) {

      const draftId =
        toPositiveInteger(
          row.draft_id
        );

      const storageId =
        toPositiveInteger(
          row.storage_warehouse_id
        );


      if (
        draftId ===
          null
      ) {

        throw new Error(
          "Для поиска таймслота отсутствует draft_id"
        );

      }


      const timeslots =
        await ozonPost<
          TimeslotResponse
        >(
          "/v2/draft/timeslot/info",
          {
            date_from:
              run.window_date_from,

            date_to:
              run.window_date_to,

            draft_id:
              draftId,

            supply_type:
              "CROSSDOCK",

            selected_cluster_warehouses: [
              {
                macrolocal_cluster_id:
                  macrolocalClusterId,

                ...(
                  storageId !==
                    null
                    ? {
                        storage_warehouse_id:
                          storageId,
                      }
                    : {}
                ),
              },
            ],
          }
        );


      const errorReason =
        normalizeKey(
          timeslots.error_reason
        );


      if (
        errorReason
        &&
        errorReason !==
          "UNSPECIFIED"
      ) {

        await releaseRequest(
          row,
          {
            status:
              "failed",

            raw_timeslots:
              timeslots,

            error_message:
              `Ozon не вернул таймслоты: ${errorReason}`,
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      const slot =
        chooseTimeslot(
          timeslots,
          run.formation_date
        );


      if (!slot) {

        await releaseRequest(
          row,
          {
            status:
              "no_slot",

            raw_timeslots:
              timeslots,

            error_message:
              `Нет доступного таймслота начиная с ${run.window_date_from} в текущем горизонте поиска до ${run.window_date_to}`,
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      await releaseRequest(
        row,
        {
          status:
            "slot_selected",

          timeslot_from:
            slot.from,

          timeslot_to:
            slot.to,

          raw_timeslots:
            timeslots,

          next_attempt_at:
            new Date()
              .toISOString(),

          error_message:
            null,
        }
      );


      return Response.json(
        await refreshAndSerializeRun(
          runId
        )
      );

    }


    // ========================================================
    // 4. СОЗДАНИЕ РЕАЛЬНОЙ ЗАЯВКИ
    // ========================================================

    if (
      row.status ===
      "slot_selected"
    ) {

      const allowedAt =
        asTimestamp(
          run.next_supply_allowed_at
        );


      if (
        allowedAt !==
          null
        &&
        allowedAt >
          Date.now()
      ) {

        await releaseRequest(
          row,
          {
            next_attempt_at:
              new Date(
                allowedAt
              ).toISOString(),
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      const draftId =
        toPositiveInteger(
          row.draft_id
        );

      const storageId =
        toPositiveInteger(
          row.storage_warehouse_id
        );


      if (
        draftId ===
          null
        ||
        !row.timeslot_from
        ||
        !row.timeslot_to
      ) {

        throw new Error(
          "Для создания заявки не хватает draft / timeslot"
        );

      }


      await updateRun(
        runId,
        {
          next_supply_allowed_at:
            laterIso(
              SUPPLY_GAP_SECONDS
            ),
        }
      );


      // До сетевого вызова переводим строку в creating.
      // Если соединение оборвётся после отправки запроса,
      // следующий проход будет проверять статус, а не создавать дубль.
      await updateRequest(
        row.id,
        {
          status:
            "creating",

          next_attempt_at:
            laterIso(
              8
            ),

          error_message:
            null,
        }
      );


      let created:
        SupplyCreateResponse;


      try {

        created =
          await ozonPost<
            SupplyCreateResponse
          >(
            "/v2/draft/supply/create",
            {
              draft_id:
                draftId,

              selected_cluster_warehouses: [
                {
                  macrolocal_cluster_id:
                    macrolocalClusterId,

                  ...(
                    storageId !==
                      null
                      ? {
                          storage_warehouse_id:
                            storageId,
                        }
                      : {}
                  ),
                },
              ],

              timeslot: {
                from_in_timezone:
                  toOzonLocalDateTime(
                    row.timeslot_from
                  ),

                to_in_timezone:
                  toOzonLocalDateTime(
                    row.timeslot_to
                  ),
              },

              supply_type:
                "CROSSDOCK",
            }
          );

      } catch (error) {

        if (
          error instanceof
            OzonApiError
        ) {

          if (
            error.status ===
              429
            ||
            error.transient
          ) {

            await releaseRequest(
              {
                ...row,
                status:
                  "creating",
              },
              {
                status:
                  "slot_selected",

                next_attempt_at:
                  laterIso(
                    error.retryAfterSeconds
                    ??
                    30
                  ),

                error_message:
                  `Ozon временно не принял создание заявки: ${error.message}. Повторим /v2/draft/supply/create.`,
              }
            );

          } else {

            await releaseRequest(
              {
                ...row,
                status:
                  "creating",
              },
              {
                status:
                  "failed",

                next_attempt_at:
                  null,

                error_message:
                  `Ozon отклонил /v2/draft/supply/create: ${error.message}`,
              }
            );

          }


          return Response.json(
            await refreshAndSerializeRun(
              runId
            )
          );

        }


        await releaseRequest(
          {
            ...row,
            status:
              "creating",
          },
          {
            status:
              "creating",

            next_attempt_at:
              laterIso(
                15
              ),

            error_message:
              "Соединение оборвалось во время /v2/draft/supply/create. Результат неоднозначен, проверяем статус по draft_id.",
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      const reasons =
        (
          created.error_reasons
          ??
          []
        ).filter(
          reason =>
            reason !==
            "UNSPECIFIED"
        );


      const onlyAmbiguous =
        reasons.length >
          0
        &&
        reasons.every(
          reason =>
            reason ===
              "ORDER_CREATION_IN_PROGRESS"
            ||
            reason ===
              "ORDER_ALREADY_CREATED"
        );


      if (
        reasons.length >
          0
        &&
        !onlyAmbiguous
      ) {

        await releaseRequest(
          {
            ...row,
            status:
              "creating",
          },
          {
            status:
              "failed",

            raw_create:
              created,

            error_message:
              `Ozon отклонил создание заявки: ${reasons.join(
                ", "
              )}`,
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      await releaseRequest(
        {
          ...row,
          status:
            "creating",
        },
        {
          status:
            "creating",

          raw_create:
            created,

          next_attempt_at:
            laterIso(
              8
            ),

          error_message:
            null,
        }
      );


      return Response.json(
        await refreshAndSerializeRun(
          runId
        )
      );

    }


    // ========================================================
    // 5. ПРОВЕРКА СОЗДАНИЯ
    // ========================================================

    if (
      row.status ===
      "creating"
    ) {

      const draftId =
        toPositiveInteger(
          row.draft_id
        );


      if (
        draftId ===
        null
      ) {

        throw new Error(
          "Для проверки создания отсутствует draft_id"
        );

      }


      const status =
        await ozonPost<
          SupplyCreateStatusResponse
        >(
          "/v2/draft/supply/create/status",
          {
            draft_id:
              draftId,
          }
        );


      if (
        status.status ===
        "SUCCESS"
      ) {

        const orderId =
          toPositiveInteger(
            status.order_id
          );


        if (
          orderId ===
          null
        ) {

          await releaseRequest(
            row,
            {
              status:
                "creating",

              raw_status:
                status,

              next_attempt_at:
                laterIso(
                  10
                ),

              error_message:
                "Ozon сообщил SUCCESS, но пока не вернул order_id",
            }
          );

        } else {

          await releaseRequest(
            row,
            {
              status:
                "success",

              ozon_order_id:
                orderId,

              raw_status:
                status,

              next_attempt_at:
                null,

              error_message:
                null,
            }
          );

        }


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      if (
        status.status ===
          "IN_PROGRESS"
        ||
        status.status ===
          "UNSPECIFIED"
        ||
        !status.status
      ) {

        await releaseRequest(
          row,
          {
            status:
              "creating",

            raw_status:
              status,

            next_attempt_at:
              laterIso(
                10
              ),

            error_message:
              null,
          }
        );


        return Response.json(
          await refreshAndSerializeRun(
            runId
          )
        );

      }


      const reasons =
        (
          status.error_reasons
          ??
          []
        ).filter(
          reason =>
            reason !==
            "UNSPECIFIED"
        );


      await releaseRequest(
        row,
        {
          status:
            "failed",

          raw_status:
            status,

          error_message:
            reasons.length >
              0
              ? `Создание заявки завершилось ошибкой: ${reasons.join(
                  ", "
                )}`
              : `Создание заявки завершилось статусом ${normalizeKey(
                  status.status
                )
                ||
                "FAILED"}`,
        }
      );


      return Response.json(
        await refreshAndSerializeRun(
          runId
        )
      );

    }


    await releaseRequest(
      row,
      {
        status:
          "failed",

        error_message:
          `Неизвестное состояние очереди: ${row.status}`,
      }
    );


    return Response.json(
      await refreshAndSerializeRun(
        runId
      )
    );

  } catch (error) {

    const noActiveCreationProcess =
      row.status ===
        "creating"
      &&
      error instanceof
        OzonApiError
      &&
      error.status ===
        404
      &&
      error.message.includes(
        "no active order creation process"
      );


    if (
      noActiveCreationProcess
    ) {

      await releaseRequest(
        row,
        {
          status:
            "slot_selected",

          next_attempt_at:
            laterIso(
              5
            ),

          error_message:
            "Ozon не нашёл активный процесс создания по draft_id. Возвращаемся к /v2/draft/supply/create и повторяем создание.",
        }
      );


      return Response.json(
        await refreshAndSerializeRun(
          runId
        )
      );

    }


    const transient =
      error instanceof
      OzonApiError
      &&
      error.transient;


    if (transient) {

      await releaseRequest(
        row,
        {
          status:
            row.status,

          next_attempt_at:
            laterIso(
              error.retryAfterSeconds
              ??
              45
            ),

          error_message:
            error.message,
        }
      );

    } else {

      await releaseRequest(
        row,
        {
          status:
            "failed",

          error_message:
            error instanceof Error
              ? error.message
              : String(
                  error
                ),
        }
      );

    }


    return Response.json(
      await refreshAndSerializeRun(
        runId
      )
    );

  }

}


// ============================================================
// GET / POST
// ============================================================

export async function GET(
  request:
    Request
) {

  try {

    const url =
      new URL(
        request.url
      );

    const runId =
      url.searchParams.get(
        "run_id"
      );


    const run =
      await getSupplyRun(
        runId
      );


    if (!run) {

      return Response.json(
        {
          ok:
            true,

          run:
            null,

          requests:
            [],

          progress: {
            total:
              0,

            success:
              0,

            no_slot:
              0,

            failed:
              0,

            in_progress:
              0,

            percent:
              0,
          },

          next_action_at:
            null,
        }
      );

    }


    return Response.json(
      await refreshAndSerializeRun(
        run.id
      )
    );

  } catch (error) {

    return Response.json(
      {
        ok:
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


export async function POST(
  request:
    Request
) {

  try {

    const body =
      await request
        .json()
        .catch(
          () => ({})
        ) as {
          action?:
            string;

          run_id?:
            string;

          cluster_ids?:
            unknown;
        };


    if (
      body.action ===
      "preview"
    ) {

      return previewSupplyPlan();

    }


    if (
      body.action ===
      "start"
    ) {

      const rawClusterIds =
        body.cluster_ids;


      let clusterIds:
        number[]
        |
        null =
        null;


      if (
        rawClusterIds !==
          undefined
      ) {

        if (
          !Array.isArray(
            rawClusterIds
          )
          ||
          rawClusterIds.length ===
            0
        ) {

          return Response.json(
            {
              ok:
                false,

              error:
                "cluster_ids должен быть непустым массивом",
            },
            {
              status:
                400,
            }
          );

        }


        const parsed =
          rawClusterIds.map(
            value =>
              toPositiveInteger(
                value
              )
          );


        if (
          parsed.some(
            value =>
              value ===
              null
          )
        ) {

          return Response.json(
            {
              ok:
                false,

              error:
                "cluster_ids содержит некорректный идентификатор кластера",
            },
            {
              status:
                400,
            }
          );

        }


        clusterIds =
          Array.from(
            new Set(
              parsed as
                number[]
            )
          );

      }


      return startSupplyRun(
        clusterIds
      );

    }


    if (
      body.action ===
      "process_next"
    ) {

      const runId =
        normalizeKey(
          body.run_id
        );


      if (!runId) {

        return Response.json(
          {
            ok:
              false,

            error:
              "Не передан run_id",
          },
          {
            status:
              400,
          }
        );

      }


      return processOne(
        runId
      );

    }


    return Response.json(
      {
        ok:
          false,

        error:
          "Неизвестное action",
      },
      {
        status:
          400,
      }
    );

  } catch (error) {

    return Response.json(
      {
        ok:
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
