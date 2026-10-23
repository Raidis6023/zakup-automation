export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OZON_API_BASE = "https://api-seller.ozon.ru";
const MOSCOW_SELLER_WAREHOUSE_ID = "1020005014074930";
const DRAFT_GAP_SECONDS = 32;
const MAX_DRAFT_UNITS = 4500;
const MAX_CLUSTERS_PER_DRAFT = 20;
const SUPABASE_PAGE_SIZE = 1000;

const DROP_OFF_SEARCHES = [
  "МО_ВНУКОВО_2_ХАБ",
  "МО ВНУКОВО",
  "Внуково",
];

type ClusterType = "CLUSTER_TYPE_OZON" | "CLUSTER_TYPE_CIS";

type ReplenishmentRun = {
  id: string;
  created_at: string;
  status: string;
  sales_date_from: string;
  sales_date_to: string;
  stock_snapshot_date: string;
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
  carton_length_mm: number | null;
  carton_width_mm: number | null;
  carton_height_mm: number | null;
  carton_weight_kg: number | null;
};

type LatestSync = {
  date_from: string;
  date_to: string;
  status: string;
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

type SellerWarehouse = {
  seller_warehouse_id?: string | number;
  is_active?: boolean;
};

type SellerWarehouseResponse = {
  warehouses?: SellerWarehouse[];
};

type DropOffWarehouse = {
  warehouse_id?: string | number;
  warehouse_type?: string;
  name?: string;
  address?: string;
};

type DropOffResponse = {
  search?: DropOffWarehouse[];
};

type DraftCreateError = {
  error_message?: string;
  error_reasons?: string[];
  items_validation?: Array<{
    macrolocal_cluster_id?: number;
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

type TimeslotResponse = {
  error_reason?: string;
  result?: {
    drop_off_warehouse_timeslots?: {
      days?: Array<{
        date_in_timezone?: string;
        timeslots?: Array<{
          from_in_timezone?: string;
          to_in_timezone?: string;
        }>;
      }>;
    };
  };
};

type PreviewArticle = {
  master_code: string | null;
  offer_id: string | null;
  product_name: string | null;
  sku: number | null;
  raw_need: number;
  units_per_carton: number | null;
  cartons: number;
  final_quantity: number;
  rule:
    | "full_cartons_rounded"
    | "zero_less_than_one_carton"
    | "missing_pack"
    | "pack_conflict"
    | "missing_enot"
    | "invalid_sku";
  ozon_rejected: boolean;
  ozon_rejection_reasons: string[];
  missing_packaging_fields: string[];
};

type PreviewWarehouse = {
  warehouse_id: number;
  name: string | null;
  address: string | null;
  availability: string;
  total_score: number | null;
  total_rank: number | null;
};

type PreviewSlot = {
  date: string;
  from: string;
  to: string;
};

type PreviewCluster = {
  macrolocal_cluster_id: number;
  cluster_name: string | null;
  raw_need_units: number;
  proposed_units: number;
  ozon_accepted_units: number;
  cartons: number;
  article_count: number;
  articles_to_supply: number;
  missing_pack_count: number;
  zero_after_rounding_count: number;
  draft_id: number | null;
  status: "available" | "partial" | "not_available" | "no_supply" | "error";
  recommended_warehouse: PreviewWarehouse | null;
  warehouses: PreviewWarehouse[];
  timeslots: PreviewSlot[];
  supports_common_timeslot: boolean;
  error: string | null;
  articles: PreviewArticle[];
};

type PlanArticle = PreviewArticle & {
  cluster_type: ClusterType;
  macrolocal_cluster_id: number;
  cluster_name: string | null;
  source_cluster_id: string;
};

type PlanCluster = {
  cluster_type: ClusterType;
  macrolocal_cluster_id: number;
  cluster_name: string | null;
  articles: PlanArticle[];
  draft_items: Array<{ sku: number; quantity: number }>;
  raw_need_units: number;
  proposed_units: number;
  cartons: number;
};

class OzonApiError extends Error {
  status: number | null;
  retryAfterSeconds: number | null;

  constructor(
    message: string,
    options?: { status?: number | null; retryAfterSeconds?: number | null }
  ) {
    super(message);
    this.name = "OzonApiError";
    this.status = options?.status ?? null;
    this.retryAfterSeconds = options?.retryAfterSeconds ?? null;
  }
}

function getConfig() {
  const ozonClientId = process.env.OZON_CLIENT_ID?.trim();
  const ozonApiKey = process.env.OZON_API_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!ozonClientId) throw new Error("Не найдена OZON_CLIENT_ID");
  if (!ozonApiKey) throw new Error("Не найдена OZON_API_KEY");
  if (!supabaseUrl) throw new Error("Не найдена NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseSecretKey) throw new Error("Не найдена SUPABASE_SECRET_KEY");

  return { ozonClientId, ozonApiKey, supabaseUrl, supabaseSecretKey };
}

function normalizeKey(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeSearchText(value: unknown) {
  return normalizeKey(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPositiveInteger(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const integer = Math.ceil(number);
  return Number.isSafeInteger(integer) ? integer : null;
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function getMoscowDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map(part => [part.type, part.value])
  );
  return [parts.year, parts.month, parts.day].join("-");
}

function addDays(yyyyMmDd: string, days: number) {
  const date = new Date(`${yyyyMmDd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isBelarusCluster(cluster: OzonCluster) {
  const name = normalizeSearchText(cluster.name);
  return name === "беларусь" || name === "belarus";
}

function mapDropOffWarehouseType(value: unknown) {
  const raw = normalizeKey(value)
    .toUpperCase()
    .replace(/^WAREHOUSE_TYPE_/, "");

  const allowed = new Set([
    "DELIVERY_POINT",
    "SORTING_CENTER",
    "CROSS_DOCK",
    "ORDERS_RECEIVING_POINT",
    "FULL_FILLMENT",
  ]);

  return allowed.has(raw) ? raw : null;
}

function parseRetryAfter(response: Response) {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1, Math.ceil(seconds));
  }

  const date = Date.parse(raw);
  if (Number.isFinite(date)) {
    return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }

  return null;
}

async function supabaseRequest<T>(path: string, init: RequestInit): Promise<T> {
  const { supabaseUrl, supabaseSecretKey } = getConfig();

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function supabaseGet<T>(path: string) {
  return supabaseRequest<T>(path, { method: "GET" });
}

async function supabaseRpc<T>(name: string, body: Record<string, unknown>) {
  return supabaseRequest<T>(`rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function ozonPost<T>(path: string, body: unknown): Promise<T> {
  const { ozonClientId, ozonApiKey } = getConfig();

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${OZON_API_BASE}${path}`, {
        method: "POST",
        headers: {
          "Client-Id": ozonClientId,
          "Api-Key": ozonApiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });

      const text = await response.text();

      if (response.status === 429) {
        const retryAfter = parseRetryAfter(response) ?? 35;
        if (attempt < 3 && retryAfter <= 40) {
          await sleep(retryAfter * 1000);
          continue;
        }
        throw new OzonApiError(
          `Ozon ограничил запрос ${path}`,
          { status: 429, retryAfterSeconds: retryAfter }
        );
      }

      if (response.status >= 500 && attempt < 3) {
        await sleep(1200 * attempt);
        continue;
      }

      if (!response.ok) {
        throw new OzonApiError(
          `Ozon ${path}: HTTP ${response.status}: ${text}`,
          { status: response.status }
        );
      }

      return text ? (JSON.parse(text) as T) : ({} as T);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Ozon ${path}: исчерпаны попытки запроса`);
}

async function getLatestReplenishmentRun() {
  const rows = await supabaseGet<ReplenishmentRun[]>(
    [
      "ozon_fbo_replenishment_runs",
      "?select=id,created_at,status,sales_date_from,sales_date_to,stock_snapshot_date",
      "&status=eq.success",
      "&order=created_at.desc",
      "&limit=1",
    ].join("")
  );
  return rows[0] ?? null;
}

async function getDashboard() {
  return supabaseRpc<DashboardData>("get_ozon_sync_dashboard", {});
}

async function getReplenishmentItems(runId: string) {
  const result: ReplenishmentItem[] = [];

  for (let offset = 0; offset < 100000; offset += SUPABASE_PAGE_SIZE) {
    const page = await supabaseGet<ReplenishmentItem[]>(
      [
        "ozon_fbo_replenishment_items",
        "?select=product_id,offer_id,product_name,ozon_sku,cluster_id,cluster_name,calculated_need",
        `&calculation_run_id=eq.${encodeURIComponent(runId)}`,
        "&calculated_need=gt.0",
        "&order=calculated_need.desc",
        `&limit=${SUPABASE_PAGE_SIZE}`,
        `&offset=${offset}`,
      ].join("")
    );

    result.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return result;
}

async function getProducts() {
  const result: ProductRow[] = [];

  for (let offset = 0; offset < 10000; offset += SUPABASE_PAGE_SIZE) {
    const page = await supabaseGet<ProductRow[]>(
      [
        "products",
        "?select=id,master_code,offer_id,name,units_per_carton,carton_length_mm,carton_width_mm,carton_height_mm,carton_weight_kg",
        "&order=created_at.asc",
        `&limit=${SUPABASE_PAGE_SIZE}`,
        `&offset=${offset}`,
      ].join("")
    );
    result.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return result;
}

async function getClusters(clusterType: ClusterType) {
  const response = await ozonPost<OzonClusterResponse>(
    "/v1/cluster/list",
    { cluster_type: clusterType }
  );

  return (response.clusters ?? []).map(cluster => ({
    ...cluster,
    type: clusterType,
  }));
}

async function getSellerWarehouses() {
  const response = await ozonPost<SellerWarehouseResponse>(
    "/v1/warehouse/fbo/seller/list",
    {}
  );
  return response.warehouses ?? [];
}

async function searchDropOff(search: string) {
  const response = await ozonPost<DropOffResponse>(
    "/v1/warehouse/fbo/list",
    {
      filter_by_supply_type: ["CREATE_TYPE_CROSSDOCK"],
      search,
    }
  );
  return response.search ?? [];
}

async function resolveDropOff() {
  const all: DropOffWarehouse[] = [];

  for (const search of DROP_OFF_SEARCHES) {
    all.push(...(await searchDropOff(search)));
  }

  const unique = new Map<string, DropOffWarehouse>();
  for (const row of all) {
    const id = normalizeKey(row.warehouse_id);
    if (id) unique.set(id, row);
  }

  const rows = Array.from(unique.values());

  const addressMatches = rows.filter(row => {
    const address = normalizeSearchText(row.address);
    return (
      address.includes("шарапов") &&
      address.includes("придорож") &&
      (address.includes("к5") ||
        address.includes("к 5") ||
        address.includes("корп 5"))
    );
  });

  const pool =
    addressMatches.length > 0
      ? addressMatches
      : rows.filter(row => {
          const name = normalizeSearchText(row.name);
          return name.includes("внуково") && name.includes("хаб");
        });

  if (pool.length === 0) {
    throw new Error(
      "Ozon не вернул cross-dock точку Внуково по адресу Шарапово, Придорожная улица, к5"
    );
  }

  const selected = [...pool].sort((left, right) => {
    const leftName = normalizeSearchText(left.name);
    const rightName = normalizeSearchText(right.name);
    return Number(rightName.includes("2")) - Number(leftName.includes("2"));
  })[0];

  const warehouseId = toPositiveInteger(selected.warehouse_id);
  const warehouseType = mapDropOffWarehouseType(selected.warehouse_type);

  if (warehouseId === null || !warehouseType) {
    throw new Error(
      "У найденной точки Внуково Ozon не вернул корректные warehouse_id / warehouse_type"
    );
  }

  return {
    warehouse_id: warehouseId,
    warehouse_type: warehouseType,
    name: normalizeKey(selected.name) || null,
    address: normalizeKey(selected.address) || null,
  };
}

function getPackRule(rawNeed: number, pack: number | null) {
  if (pack === null) {
    return {
      cartons: 0,
      finalQuantity: 0,
      rule: "missing_pack" as const,
    };
  }

  if (rawNeed < pack) {
    return {
      cartons: 0,
      finalQuantity: 0,
      rule: "zero_less_than_one_carton" as const,
    };
  }

  const cartons = Math.round(rawNeed / pack);

  return {
    cartons,
    finalQuantity: cartons * pack,
    rule: "full_cartons_rounded" as const,
  };
}

function meaningfulErrors(errors: DraftCreateError[] | undefined) {
  return (errors ?? []).filter(error => {
    const message = normalizeKey(error.error_message);
    const reasons = error.error_reasons ?? [];
    const rejected = (error.items_validation ?? []).some(
      validation => (validation.rejected_items ?? []).length > 0
    );

    return (
      (message && message !== "UNSPECIFIED") ||
      reasons.some(reason => reason !== "UNSPECIFIED") ||
      rejected
    );
  });
}

function formatDraftErrors(errors: DraftCreateError[]) {
  return errors
    .map(error =>
      [
        error.error_message,
        ...(error.error_reasons ?? []),
        error.message,
      ]
        .filter(Boolean)
        .join(" · ")
    )
    .filter(Boolean)
    .join("; ");
}

function rejectedSkuMap(errors: DraftCreateError[] | undefined) {
  const result = new Map<
    number,
    { clusterIds: Set<number>; reasons: Set<string> }
  >();

  for (const error of errors ?? []) {
    for (const validation of error.items_validation ?? []) {
      const clusterId = toPositiveInteger(validation.macrolocal_cluster_id);

      for (const rejected of validation.rejected_items ?? []) {
        const sku = toPositiveInteger(rejected.sku);
        if (sku === null) continue;

        let row = result.get(sku);
        if (!row) {
          row = { clusterIds: new Set<number>(), reasons: new Set<string>() };
          result.set(sku, row);
        }

        if (clusterId !== null) row.clusterIds.add(clusterId);
        for (const reason of rejected.reasons ?? []) {
          if (reason && reason !== "UNSPECIFIED") row.reasons.add(reason);
        }
      }
    }
  }

  return result;
}

function chooseWarehouse(
  info: DraftInfoResponse,
  macrolocalClusterId: number
) {
  const cluster = (info.clusters ?? []).find(
    row => Number(row.macrolocal_cluster_id) === macrolocalClusterId
  );

  const candidates = (cluster?.warehouses ?? [])
    .filter(warehouse => {
      const state = normalizeKey(warehouse.availability_status?.state);
      return (
        (state === "FULL_AVAILABLE" || state === "PARTIAL_AVAILABLE") &&
        toPositiveInteger(warehouse.storage_warehouse?.warehouse_id) !== null
      );
    })
    .sort((left, right) => {
      const leftState = normalizeKey(left.availability_status?.state);
      const rightState = normalizeKey(right.availability_status?.state);

      if (leftState !== rightState) {
        if (leftState === "FULL_AVAILABLE") return -1;
        if (rightState === "FULL_AVAILABLE") return 1;
      }

      const scoreDiff =
        Number(right.total_score ?? 0) - Number(left.total_score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;

      return (
        Number(left.total_rank ?? Number.MAX_SAFE_INTEGER) -
        Number(right.total_rank ?? Number.MAX_SAFE_INTEGER)
      );
    });

  return { cluster, candidates, recommended: candidates[0] ?? null };
}

function mapWarehouse(row: DraftInfoWarehouse): PreviewWarehouse | null {
  const warehouseId = toPositiveInteger(row.storage_warehouse?.warehouse_id);
  if (warehouseId === null) return null;

  return {
    warehouse_id: warehouseId,
    name: normalizeKey(row.storage_warehouse?.name) || null,
    address: normalizeKey(row.storage_warehouse?.address) || null,
    availability:
      normalizeKey(row.availability_status?.state) || "UNSPECIFIED",
    total_score: Number.isFinite(Number(row.total_score))
      ? Number(row.total_score)
      : null,
    total_rank: Number.isFinite(Number(row.total_rank))
      ? Number(row.total_rank)
      : null,
  };
}

async function waitForDraftInfo(draftId: number) {
  let last: DraftInfoResponse = {};

  for (let attempt = 0; attempt < 24; attempt++) {
    last = await ozonPost<DraftInfoResponse>(
      "/v2/draft/create/info",
      { draft_id: draftId }
    );

    if (last.status === "SUCCESS" || last.status === "FAILED") return last;
    await sleep(2500);
  }

  return last;
}

function collectTimeslots(response: TimeslotResponse): PreviewSlot[] {
  const result: PreviewSlot[] = [];

  for (const day of
    response.result?.drop_off_warehouse_timeslots?.days ?? []) {
    const date = normalizeKey(day.date_in_timezone).slice(0, 10);
    if (!date) continue;

    for (const slot of day.timeslots ?? []) {
      const from = normalizeKey(slot.from_in_timezone);
      const to = normalizeKey(slot.to_in_timezone);
      if (!from || !to) continue;
      result.push({ date, from, to });
    }
  }

  return result;
}

function buildPlan(
  rows: ReplenishmentItem[],
  products: ProductRow[],
  allowedClusters: OzonCluster[],
  excludedCisClusterIds: Set<string>
) {
  const productById = new Map(products.map(row => [row.id, row]));

  const packValuesByEnot = new Map<string, Set<number>>();
  const packagingPresenceByEnot = new Map<
    string,
    {
      length: boolean;
      width: boolean;
      height: boolean;
      weight: boolean;
    }
  >();

  for (const product of products) {
    const enot = normalizeKey(product.master_code);
    if (!enot) continue;

    const pack = toPositiveInteger(product.units_per_carton);
    if (pack !== null) {
      let values = packValuesByEnot.get(enot);
      if (!values) {
        values = new Set<number>();
        packValuesByEnot.set(enot, values);
      }
      values.add(pack);
    }

    const current =
      packagingPresenceByEnot.get(enot) ?? {
        length: false,
        width: false,
        height: false,
        weight: false,
      };

    current.length =
      current.length ||
      (Number.isFinite(Number(product.carton_length_mm)) &&
        Number(product.carton_length_mm) > 0);

    current.width =
      current.width ||
      (Number.isFinite(Number(product.carton_width_mm)) &&
        Number(product.carton_width_mm) > 0);

    current.height =
      current.height ||
      (Number.isFinite(Number(product.carton_height_mm)) &&
        Number(product.carton_height_mm) > 0);

    current.weight =
      current.weight ||
      (Number.isFinite(Number(product.carton_weight_kg)) &&
        Number(product.carton_weight_kg) > 0);

    packagingPresenceByEnot.set(enot, current);
  }

  const clusterMap = new Map<
    string,
    {
      cluster_type: ClusterType;
      macrolocal_cluster_id: number;
      cluster_name: string | null;
    }
  >();

  for (const cluster of allowedClusters) {
    const clusterId = normalizeKey(cluster.id);
    const macroId = toPositiveInteger(cluster.macrolocal_cluster_id);
    const type = normalizeKey(cluster.type) as ClusterType;

    if (
      !clusterId ||
      macroId === null ||
      (type !== "CLUSTER_TYPE_OZON" && type !== "CLUSTER_TYPE_CIS")
    ) {
      continue;
    }

    clusterMap.set(clusterId, {
      cluster_type: type,
      macrolocal_cluster_id: macroId,
      cluster_name: normalizeKey(cluster.name) || null,
    });
  }

  type Aggregate = {
    cluster_type: ClusterType;
    macrolocal_cluster_id: number;
    cluster_name: string | null;
    source_cluster_id: string;
    product_id: string;
    master_code: string | null;
    offer_id: string | null;
    product_name: string | null;
    sku: number | null;
    raw_need: number;
  };

  const aggregates = new Map<string, Aggregate>();
  const issues: string[] = [];
  let excludedCisUnits = 0;

  for (const row of rows) {
    const rawNeed = toPositiveInteger(row.calculated_need);
    if (rawNeed === null) continue;

    const sourceClusterId = normalizeKey(row.cluster_id);
    if (excludedCisClusterIds.has(sourceClusterId)) {
      excludedCisUnits += rawNeed;
      continue;
    }

    const cluster = clusterMap.get(sourceClusterId);
    if (!cluster) {
      issues.push(
        `Не найден кластер для ${row.offer_id ?? row.product_id}: ${sourceClusterId}`
      );
      continue;
    }

    const product = productById.get(row.product_id);
    const enot = normalizeKey(product?.master_code) || null;
    const sku = toPositiveInteger(row.ozon_sku);

    const key = [
      cluster.cluster_type,
      cluster.macrolocal_cluster_id,
      enot ?? row.product_id,
      sku ?? "no-sku",
    ].join(":");

    const existing = aggregates.get(key);
    if (existing) {
      existing.raw_need += rawNeed;
    } else {
      aggregates.set(key, {
        cluster_type: cluster.cluster_type,
        macrolocal_cluster_id: cluster.macrolocal_cluster_id,
        cluster_name: cluster.cluster_name,
        source_cluster_id: sourceClusterId,
        product_id: row.product_id,
        master_code: enot,
        offer_id: row.offer_id ?? product?.offer_id ?? null,
        product_name: row.product_name ?? product?.name ?? null,
        sku,
        raw_need: rawNeed,
      });
    }
  }

  const clusterGroups = new Map<string, PlanCluster>();
  let missingPackItems = 0;
  let conflictingPackItems = 0;
  let missingEnotItems = 0;
  let invalidSkuItems = 0;
  let zeroHalfOrLessItems = 0;

  for (const aggregate of aggregates.values()) {
    const enot = aggregate.master_code;
    const packValues = enot ? packValuesByEnot.get(enot) : undefined;

    let pack: number | null = null;
    let forcedRule:
      | "missing_pack"
      | "pack_conflict"
      | "missing_enot"
      | "invalid_sku"
      | null = null;

    if (!enot) {
      forcedRule = "missing_enot";
      missingEnotItems++;
    } else if (!packValues || packValues.size === 0) {
      forcedRule = "missing_pack";
      missingPackItems++;
    } else if (packValues.size > 1) {
      forcedRule = "pack_conflict";
      conflictingPackItems++;
    } else {
      pack = Array.from(packValues)[0] ?? null;
    }

    if (aggregate.sku === null) {
      forcedRule = "invalid_sku";
      invalidSkuItems++;
    }

    const rounded = forcedRule
      ? { cartons: 0, finalQuantity: 0, rule: forcedRule }
      : getPackRule(aggregate.raw_need, pack);

    if (rounded.rule === "zero_less_than_one_carton") zeroHalfOrLessItems++;

    const packagingPresence =
      enot
        ? packagingPresenceByEnot.get(enot)
        : undefined;

    const missingPackagingFields = [
      !packagingPresence?.length ? "длина" : "",
      !packagingPresence?.width ? "ширина" : "",
      !packagingPresence?.height ? "высота" : "",
      !packagingPresence?.weight ? "вес" : "",
    ].filter(Boolean);

    const article: PlanArticle = {
      cluster_type: aggregate.cluster_type,
      macrolocal_cluster_id: aggregate.macrolocal_cluster_id,
      cluster_name: aggregate.cluster_name,
      source_cluster_id: aggregate.source_cluster_id,
      master_code: aggregate.master_code,
      offer_id: aggregate.offer_id,
      product_name: aggregate.product_name,
      sku: aggregate.sku,
      raw_need: aggregate.raw_need,
      units_per_carton: pack,
      cartons: rounded.cartons,
      final_quantity: rounded.finalQuantity,
      rule: rounded.rule,
      ozon_rejected: false,
      ozon_rejection_reasons: [],
      missing_packaging_fields: missingPackagingFields,
    };

    const clusterKey = `${aggregate.cluster_type}:${aggregate.macrolocal_cluster_id}`;
    let cluster = clusterGroups.get(clusterKey);

    if (!cluster) {
      cluster = {
        cluster_type: aggregate.cluster_type,
        macrolocal_cluster_id: aggregate.macrolocal_cluster_id,
        cluster_name: aggregate.cluster_name,
        articles: [],
        draft_items: [],
        raw_need_units: 0,
        proposed_units: 0,
        cartons: 0,
      };
      clusterGroups.set(clusterKey, cluster);
    }

    cluster.articles.push(article);
    cluster.raw_need_units += aggregate.raw_need;
    cluster.proposed_units += rounded.finalQuantity;
    cluster.cartons += rounded.cartons;
  }

  for (const cluster of clusterGroups.values()) {
    const bySku = new Map<number, number>();

    for (const article of cluster.articles) {
      if (article.final_quantity <= 0 || article.sku === null) continue;
      bySku.set(
        article.sku,
        (bySku.get(article.sku) ?? 0) + article.final_quantity
      );
    }

    cluster.draft_items = Array.from(bySku.entries())
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((left, right) => right.quantity - left.quantity);

    cluster.articles.sort((left, right) => {
      if (right.final_quantity !== left.final_quantity) {
        return right.final_quantity - left.final_quantity;
      }
      return right.raw_need - left.raw_need;
    });
  }

  const clusters = Array.from(clusterGroups.values()).sort(
    (left, right) =>
      left.macrolocal_cluster_id - right.macrolocal_cluster_id
  );

  return {
    clusters,
    issues,
    excludedCisUnits,
    packaging: {
      missing_pack_items: missingPackItems,
      conflicting_pack_items: conflictingPackItems,
      missing_enot_items: missingEnotItems,
      invalid_sku_items: invalidSkuItems,
      zero_half_or_less_items: zeroHalfOrLessItems,
    },
  };
}

function makeDraftBatches(clusters: PlanCluster[]) {
  const result: PlanCluster[][] = [];
  let current: PlanCluster[] = [];
  let currentUnits = 0;

  for (const cluster of clusters.filter(row => row.proposed_units > 0)) {
    const nextWouldOverflow =
      current.length > 0 &&
      (current.length >= MAX_CLUSTERS_PER_DRAFT ||
        currentUnits + cluster.proposed_units > MAX_DRAFT_UNITS);

    if (nextWouldOverflow) {
      result.push(current);
      current = [];
      currentUnits = 0;
    }

    current.push(cluster);
    currentUnits += cluster.proposed_units;
  }

  if (current.length > 0) result.push(current);
  return result;
}

function errorHasCountLimit(errors: DraftCreateError[] | undefined) {
  return (errors ?? []).some(error =>
    normalizeKey(error.error_message) === "ITEMS_COUNT_MORE_THAN_MAX"
  );
}

function slotKey(slot: PreviewSlot) {
  return `${slot.from}|${slot.to}`;
}

function slotPriority(date: string, formationDate: string) {
  const preferred = [7, 6, 8, 5, 9].map(days => addDays(formationDate, days));
  const index = preferred.indexOf(date);
  return index >= 0 ? index : 999;
}

async function POSTImpl() {
  const run = await getLatestReplenishmentRun();
  if (!run) {
    return Response.json(
      { ok: false, error: "Нет успешного расчёта потребности FBO" },
      { status: 409 }
    );
  }

  const dashboard = await getDashboard();
  const sync = dashboard.latest_sync;

  const fresh = Boolean(
    sync &&
      sync.status === "success" &&
      sync.date_from === run.sales_date_from &&
      sync.date_to === run.sales_date_to &&
      dashboard.stock_snapshot_date === run.stock_snapshot_date
  );

  if (!fresh) {
    return Response.json(
      {
        ok: false,
        error:
          "Расчёт потребности не соответствует последней успешной синхронизации Ozon. Сначала обновите данные.",
      },
      { status: 409 }
    );
  }

  const [
    replenishmentItems,
    products,
    russianClusters,
    cisClusters,
    sellerWarehouses,
    dropOff,
  ] = await Promise.all([
    getReplenishmentItems(run.id),
    getProducts(),
    getClusters("CLUSTER_TYPE_OZON"),
    getClusters("CLUSTER_TYPE_CIS"),
    getSellerWarehouses(),
    resolveDropOff(),
  ]);

  const sellerWarehouse = sellerWarehouses.find(
    warehouse =>
      normalizeKey(warehouse.seller_warehouse_id) ===
        MOSCOW_SELLER_WAREHOUSE_ID && warehouse.is_active !== false
  );

  if (!sellerWarehouse) {
    return Response.json(
      {
        ok: false,
        error:
          "Не найден активный склад МСК ФБС с seller_warehouse_id 1020005014074930",
      },
      { status: 409 }
    );
  }

  const belarusClusters = cisClusters.filter(isBelarusCluster);
  const excludedCisClusterIds = new Set(
    cisClusters
      .filter(cluster => !isBelarusCluster(cluster))
      .map(cluster => normalizeKey(cluster.id))
      .filter(Boolean)
  );

  const plan = buildPlan(
    replenishmentItems,
    products,
    [...russianClusters, ...belarusClusters],
    excludedCisClusterIds
  );

  if (plan.clusters.length === 0) {
    return Response.json(
      { ok: false, error: "Нет кластеров для тестового расчёта поставки" },
      { status: 409 }
    );
  }

  const formationDate = getMoscowDate();
  const targetDate = addDays(formationDate, 7);
  const windowDateFrom = addDays(formationDate, 5);
  const windowDateTo = addDays(formationDate, 9);

  const clusterResults = new Map<number, PreviewCluster>();

  for (const cluster of plan.clusters) {
    const missingPackCount = cluster.articles.filter(
      article =>
        article.rule === "missing_pack" ||
        article.rule === "pack_conflict" ||
        article.rule === "missing_enot"
    ).length;

    clusterResults.set(cluster.macrolocal_cluster_id, {
      macrolocal_cluster_id: cluster.macrolocal_cluster_id,
      cluster_name: cluster.cluster_name,
      raw_need_units: cluster.raw_need_units,
      proposed_units: cluster.proposed_units,
      ozon_accepted_units: cluster.proposed_units,
      cartons: cluster.cartons,
      article_count: cluster.articles.length,
      articles_to_supply: cluster.articles.filter(
        article => article.final_quantity > 0
      ).length,
      missing_pack_count: missingPackCount,
      zero_after_rounding_count: cluster.articles.filter(
        article => article.rule === "zero_less_than_one_carton"
      ).length,
      draft_id: null,
      status: cluster.proposed_units > 0 ? "not_available" : "no_supply",
      recommended_warehouse: null,
      warehouses: [],
      timeslots: [],
      supports_common_timeslot: false,
      error: cluster.proposed_units > 0 ? null : "После округления до коробов поставка не требуется.",
      articles: cluster.articles.map(article => ({ ...article })),
    });
  }

  const initialBatches = makeDraftBatches(plan.clusters);
  const queue = [...initialBatches];
  const draftIds: number[] = [];
  const slotCoverage = new Map<
    string,
    { slot: PreviewSlot; clusters: Set<number> }
  >();

  let lastDraftCreatedAt = 0;

  while (queue.length > 0) {
    const batch = queue.shift();
    if (!batch || batch.length === 0) continue;

    if (lastDraftCreatedAt > 0) {
      const waitMs = Math.max(
        0,
        DRAFT_GAP_SECONDS * 1000 - (Date.now() - lastDraftCreatedAt)
      );
      if (waitMs > 0) await sleep(waitMs);
    }

    lastDraftCreatedAt = Date.now();

    let draft: DraftCreateResponse;
    try {
      draft = await ozonPost<DraftCreateResponse>(
        "/v1/draft/multi-cluster/create",
        {
          clusters_info: batch.map(cluster => ({
            macrolocal_cluster_id: cluster.macrolocal_cluster_id,
            items: cluster.draft_items,
          })),
          deletion_sku_mode: "PARTIAL",
          delivery_info: {
            type: "DROPOFF",
            drop_off_warehouse: {
              warehouse_id: dropOff.warehouse_id,
              warehouse_type: dropOff.warehouse_type,
            },
            seller_warehouse_id: Number(MOSCOW_SELLER_WAREHOUSE_ID),
          },
        }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      for (const cluster of batch) {
        const result = clusterResults.get(cluster.macrolocal_cluster_id);
        if (!result) continue;
        result.status = "error";
        result.error = message;
      }
      continue;
    }

    const createErrors = meaningfulErrors(draft.errors);
    const draftId = toPositiveInteger(draft.draft_id);

    if (
      draftId === null &&
      errorHasCountLimit(draft.errors) &&
      batch.length > 1
    ) {
      const middle = Math.ceil(batch.length / 2);
      queue.unshift(batch.slice(middle));
      queue.unshift(batch.slice(0, middle));
      continue;
    }

    if (draftId === null) {
      const message =
        createErrors.length > 0
          ? formatDraftErrors(createErrors)
          : "Ozon не вернул draft_id";

      for (const cluster of batch) {
        const result = clusterResults.get(cluster.macrolocal_cluster_id);
        if (!result) continue;
        result.status = "error";
        result.error = message;
      }
      continue;
    }

    draftIds.push(draftId);

    const info = await waitForDraftInfo(draftId);
    const infoErrors = meaningfulErrors(info.errors);

    if (info.status !== "SUCCESS") {
      const message =
        infoErrors.length > 0
          ? formatDraftErrors(infoErrors)
          : `Ozon вернул статус черновика ${normalizeKey(info.status) || "UNKNOWN"}`;

      for (const cluster of batch) {
        const result = clusterResults.get(cluster.macrolocal_cluster_id);
        if (!result) continue;
        result.draft_id = draftId;
        result.status = "error";
        result.error = message;
      }
      continue;
    }

    const rejected = rejectedSkuMap([
      ...(draft.errors ?? []),
      ...(info.errors ?? []),
    ]);

    const selectedClusterWarehouses: Array<{
      macrolocal_cluster_id: number;
      storage_warehouse_id: number;
    }> = [];

    const selectedClusterIds: number[] = [];

    for (const cluster of batch) {
      const result = clusterResults.get(cluster.macrolocal_cluster_id);
      if (!result) continue;

      result.draft_id = draftId;

      for (const article of result.articles) {
        if (article.sku === null || article.final_quantity <= 0) continue;
        const rejection = rejected.get(article.sku);
        if (
          rejection &&
          (rejection.clusterIds.size === 0 ||
            rejection.clusterIds.has(cluster.macrolocal_cluster_id))
        ) {
          article.ozon_rejected = true;
          article.ozon_rejection_reasons = Array.from(rejection.reasons);
        }
      }

      result.ozon_accepted_units = result.articles.reduce(
        (sum, article) =>
          sum +
          (article.final_quantity > 0 && !article.ozon_rejected
            ? article.final_quantity
            : 0),
        0
      );

      const selection = chooseWarehouse(
        info,
        cluster.macrolocal_cluster_id
      );

      result.warehouses = selection.candidates
        .map(mapWarehouse)
        .filter((row): row is PreviewWarehouse => row !== null);

      result.recommended_warehouse = selection.recommended
        ? mapWarehouse(selection.recommended)
        : null;

      const hasFull = result.warehouses.some(
        warehouse => warehouse.availability === "FULL_AVAILABLE"
      );
      const hasPartial = result.warehouses.some(
        warehouse => warehouse.availability === "PARTIAL_AVAILABLE"
      );

      result.status = hasFull
        ? result.ozon_accepted_units < result.proposed_units
          ? "partial"
          : "available"
        : hasPartial
          ? "partial"
          : "not_available";

      if (!result.recommended_warehouse) {
        result.error =
          "Ozon не предложил доступный склад размещения для этого состава.";
        continue;
      }

      if (result.ozon_accepted_units <= 0) {
        result.error = "Ozon отклонил весь товарный состав кластера.";
        continue;
      }

      selectedClusterWarehouses.push({
        macrolocal_cluster_id: cluster.macrolocal_cluster_id,
        storage_warehouse_id: result.recommended_warehouse.warehouse_id,
      });
      selectedClusterIds.push(cluster.macrolocal_cluster_id);
    }

    if (selectedClusterWarehouses.length === 0) continue;

    let timeslots: TimeslotResponse;
    try {
      timeslots = await ozonPost<TimeslotResponse>(
        "/v2/draft/timeslot/info",
        {
          date_from: windowDateFrom,
          date_to: windowDateTo,
          draft_id: draftId,
          supply_type: "MULTI_CLUSTER",
          selected_cluster_warehouses: selectedClusterWarehouses,
        }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      for (const clusterId of selectedClusterIds) {
        const result = clusterResults.get(clusterId);
        if (result) {
          result.error =
            result.error ??
            `Склады доступны, но таймслоты не удалось получить: ${message}`;
        }
      }
      continue;
    }

    const errorReason = normalizeKey(timeslots.error_reason);
    if (errorReason && errorReason !== "UNSPECIFIED") {
      for (const clusterId of selectedClusterIds) {
        const result = clusterResults.get(clusterId);
        if (result) {
          result.error =
            result.error ??
            `Ozon не вернул таймслоты: ${errorReason}`;
        }
      }
      continue;
    }

    const slots = collectTimeslots(timeslots);

    for (const clusterId of selectedClusterIds) {
      const result = clusterResults.get(clusterId);
      if (result) result.timeslots = slots;
    }

    for (const slot of slots) {
      const key = slotKey(slot);
      let coverage = slotCoverage.get(key);

      if (!coverage) {
        coverage = { slot, clusters: new Set<number>() };
        slotCoverage.set(key, coverage);
      }

      for (const clusterId of selectedClusterIds) {
        coverage.clusters.add(clusterId);
      }
    }
  }

  const activeClusters = Array.from(clusterResults.values()).filter(
    cluster =>
      cluster.proposed_units > 0 &&
      cluster.recommended_warehouse !== null
  );

  const timeslotCandidates = Array.from(slotCoverage.values())
    .map(row => ({
      ...row.slot,
      cluster_count: row.clusters.size,
      cluster_ids: Array.from(row.clusters).sort((a, b) => a - b),
      coverage_percent:
        activeClusters.length > 0
          ? Math.round((row.clusters.size / activeClusters.length) * 100)
          : 0,
    }))
    .sort((left, right) => {
      if (right.cluster_count !== left.cluster_count) {
        return right.cluster_count - left.cluster_count;
      }

      const dateDiff =
        slotPriority(left.date, formationDate) -
        slotPriority(right.date, formationDate);

      if (dateDiff !== 0) return dateDiff;
      return Date.parse(left.from) - Date.parse(right.from);
    });

  const recommendedTimeslot = timeslotCandidates[0] ?? null;

  if (recommendedTimeslot) {
    const covered = new Set(recommendedTimeslot.cluster_ids);
    for (const cluster of clusterResults.values()) {
      cluster.supports_common_timeslot = covered.has(
        cluster.macrolocal_cluster_id
      );
    }
  }

  const clusters = Array.from(clusterResults.values()).sort(
    (left, right) =>
      left.macrolocal_cluster_id - right.macrolocal_cluster_id
  );

  const totalRawNeed = clusters.reduce(
    (sum, cluster) => sum + cluster.raw_need_units,
    0
  );
  const totalProposed = clusters.reduce(
    (sum, cluster) => sum + cluster.proposed_units,
    0
  );
  const totalAccepted = clusters.reduce(
    (sum, cluster) => sum + cluster.ozon_accepted_units,
    0
  );
  const totalCartons = clusters.reduce(
    (sum, cluster) => sum + cluster.cartons,
    0
  );

  const packagingAttentionMap = new Map<
    string,
    {
      master_code: string | null;
      offer_id: string | null;
      product_name: string | null;
      sku: number | null;
      raw_need: number;
      final_quantity: number;
      missing_fields: Set<string>;
      clusters: Set<string>;
      missing_pack: boolean;
      pack_conflict: boolean;
      missing_enot: boolean;
    }
  >();

  for (const cluster of clusters) {
    for (const article of cluster.articles) {
      const hasPackagingGap =
        article.missing_packaging_fields.length > 0 ||
        article.rule === "missing_pack" ||
        article.rule === "pack_conflict" ||
        article.rule === "missing_enot";

      if (!hasPackagingGap) continue;

      const key =
        article.master_code ??
        String(article.sku ?? article.offer_id ?? article.product_name ?? "unknown");

      let row = packagingAttentionMap.get(key);

      if (!row) {
        row = {
          master_code: article.master_code,
          offer_id: article.offer_id,
          product_name: article.product_name,
          sku: article.sku,
          raw_need: 0,
          final_quantity: 0,
          missing_fields: new Set<string>(),
          clusters: new Set<string>(),
          missing_pack: false,
          pack_conflict: false,
          missing_enot: false,
        };
        packagingAttentionMap.set(key, row);
      }

      row.raw_need += article.raw_need;
      row.final_quantity += article.final_quantity;

      for (const field of article.missing_packaging_fields) {
        row.missing_fields.add(field);
      }

      row.clusters.add(
        cluster.cluster_name ??
          `Кластер ${cluster.macrolocal_cluster_id}`
      );

      if (article.rule === "missing_pack") row.missing_pack = true;
      if (article.rule === "pack_conflict") row.pack_conflict = true;
      if (article.rule === "missing_enot") row.missing_enot = true;
    }
  }

  const packagingAttention = Array.from(packagingAttentionMap.values())
    .map(row => ({
      master_code: row.master_code,
      offer_id: row.offer_id,
      product_name: row.product_name,
      sku: row.sku,
      raw_need: row.raw_need,
      final_quantity: row.final_quantity,
      missing_fields: Array.from(row.missing_fields),
      clusters: Array.from(row.clusters).sort(),
      missing_pack: row.missing_pack,
      pack_conflict: row.pack_conflict,
      missing_enot: row.missing_enot,
      included_in_request:
        row.final_quantity > 0 &&
        !row.missing_pack &&
        !row.pack_conflict &&
        !row.missing_enot,
    }))
    .sort((left, right) => {
      const leftBlocked = left.included_in_request ? 0 : 1;
      const rightBlocked = right.included_in_request ? 0 : 1;

      if (rightBlocked !== leftBlocked) {
        return rightBlocked - leftBlocked;
      }

      return right.raw_need - left.raw_need;
    });

  const packagingBlockers =
    plan.packaging.missing_pack_items +
    plan.packaging.conflicting_pack_items +
    plan.packaging.missing_enot_items;

  const technicalErrors = clusters.filter(
    cluster => cluster.status === "error"
  ).length;

  return Response.json({
    ok: true,
    mode: "preview_only",
    real_supply_created: false,
    calculation_run_id: run.id,
    formation_date: formationDate,
    target_date: targetDate,
    window_date_from: windowDateFrom,
    window_date_to: windowDateTo,
    rounding_rule:
      "Если потребность меньше 1 полного короба — 0. Начиная с 1 короба, количество коробов округляется математически до ближайшего целого.",
    drop_off: dropOff,
    summary: {
      clusters: clusters.length,
      clusters_with_supply: clusters.filter(
        cluster => cluster.proposed_units > 0
      ).length,
      raw_need_units: totalRawNeed,
      proposed_units: totalProposed,
      ozon_accepted_units: totalAccepted,
      cartons: totalCartons,
      missing_pack_items: plan.packaging.missing_pack_items,
      conflicting_pack_items: plan.packaging.conflicting_pack_items,
      missing_enot_items: plan.packaging.missing_enot_items,
      invalid_sku_items: plan.packaging.invalid_sku_items,
      zero_half_or_less_items: plan.packaging.zero_half_or_less_items,
      technical_errors: technicalErrors,
      packaging_attention_items: packagingAttention.length,
    },
    packaging_attention: packagingAttention,
    recommended_timeslot: recommendedTimeslot,
    timeslot_candidates: timeslotCandidates.slice(0, 12),
    can_create_real:
      totalProposed > 0 &&
      plan.packaging.invalid_sku_items === 0 &&
      technicalErrors === 0,
    draft_ids: draftIds,
    clusters,
    warnings: [
      "Реальные заявки Ozon не создавались.",
      "Тест создаёт только технические draft_id, необходимые Ozon для проверки складов и таймслотов.",
      packagingBlockers > 0
        ? `Есть позиции без корректной вложимости/ЕНОТ: ${packagingBlockers}. Они не включены в текущий состав, но не блокируют создание остальных заявок.`
        : "",
      packagingAttention.some(row => row.missing_fields.length > 0)
        ? `Есть позиции с потребностью без полного размера/веса: ${packagingAttention.filter(row => row.missing_fields.length > 0).length}. Они могут быть включены в заявку, если вложимость известна; данные нужно дозаполнить до этапа грузомест.`
        : "",
      plan.issues.length > 0
        ? `Есть несопоставленные строки: ${plan.issues.length}.`
        : "",
      plan.excludedCisUnits > 0
        ? `Исключено СНГ вне Беларуси: ${plan.excludedCisUnits} шт. исходной потребности.`
        : "",
    ].filter(Boolean),
  });
}

export async function POST() {
  try {
    return await POSTImpl();
  } catch (error) {
    console.error("Ozon FBO preview error:", error);

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    mode: "preview_only",
    message:
      "POST запускает безопасный тест складов, коробной кратности и таймслотов без создания реальных поставок.",
  });
}
