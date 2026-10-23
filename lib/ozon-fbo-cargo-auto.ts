import {
  MAX_BOXES_PER_REQUEST,
  MAX_PALLETS_PER_REQUEST,
  type CartonUnit,
  type PlannedCargo,
  planCargoesForZone,
  thresholdForCluster,
} from "./ozon-fbo-cargo-rules";


const OZON_API_BASE =
  "https://api-seller.ozon.ru";

const SUPABASE_PAGE_SIZE =
  1000;


type ProductRow = {
  id: string;
  master_code: string | null;
  offer_id: string | null;
  units_per_carton: number | null;
  carton_length_mm: number | null;
  carton_width_mm: number | null;
  carton_height_mm: number | null;
  transport_carton_volume_m3: number | null;
};

type ReplenishmentItemRow = {
  product_id: string;
  ozon_sku: string | number | null;
};

type OzonOrder = {
  order_id?: string | number;
  supplies?: Array<{
    supply_id?: string | number;
    bundle_id?: string;
    state?: string;
  }>;
};

type BundleItem = {
  sku?: string | number;
  offer_id?: string;
  barcode?: string;
  quantity?: string | number;
  quant?: string | number;
  volume_in_litres?: string | number;
  total_volume_in_litres?: string | number;
};

type PlacementZoneResponse = {
  products_placement?: Array<{
    sku?: string | number;
    placement_zone?: string;
  }>;
};

type CargoCreateResponse = {
  operation_id?: string;
  errors?: {
    error_reasons?: string[];
    items_validation?: unknown[];
  };
};

type CargoCreateInfoResponse = {
  status?: string;
  errors?: unknown;
};

type CargoRulesResponse = {
  supply_check_lists?: Array<Record<string, unknown>>;
};


function normalizeKey(value: unknown) {
  return String(value ?? "").trim();
}


function toPositiveInteger(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const integer = Math.floor(number);
  return Number.isSafeInteger(integer) ? integer : null;
}


function toPositiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}


function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}


function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}


function getConfig() {
  const ozonClientId = process.env.OZON_CLIENT_ID?.trim();
  const ozonApiKey = process.env.OZON_API_KEY?.trim();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!ozonClientId || !ozonApiKey || !supabaseUrl || !supabaseSecretKey) {
    throw new Error("Не найдены настройки Ozon / Supabase");
  }

  return {
    ozonClientId,
    ozonApiKey,
    supabaseUrl,
    supabaseSecretKey,
  };
}


async function supabaseGet<T>(path: string): Promise<T> {
  const { supabaseUrl, supabaseSecretKey } = getConfig();

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${path}`,
    {
      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Supabase GET ${path}: HTTP ${response.status}: ${text}`,
    );
  }

  return (text ? JSON.parse(text) : []) as T;
}


async function ozonPost<T>(path: string, body: unknown): Promise<T> {
  const { ozonClientId, ozonApiKey } = getConfig();

  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(
      `${OZON_API_BASE}${path}`,
      {
        method: "POST",
        headers: {
          "Client-Id": ozonClientId,
          "Api-Key": ozonApiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    const text = await response.text();
    if (response.ok) {
      return (text ? JSON.parse(text) : {}) as T;
    }

    if (
      (response.status === 429 || response.status >= 500) &&
      attempt < 4
    ) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(
        Number.isFinite(retryAfter)
          ? Math.max(1200, Math.min(retryAfter * 1000, 10000))
          : attempt * 1500,
      );
      continue;
    }

    throw new Error(
      `Ozon ${path}: HTTP ${response.status}: ${text}`,
    );
  }

  throw new Error(`Ozon ${path}: исчерпаны попытки`);
}


async function getProducts() {
  const result: ProductRow[] = [];

  for (
    let offset = 0;
    offset < 10000;
    offset += SUPABASE_PAGE_SIZE
  ) {
    const page = await supabaseGet<ProductRow[]>(
      [
        "products",
        "?select=id,master_code,offer_id,units_per_carton,carton_length_mm,carton_width_mm,carton_height_mm,transport_carton_volume_m3",
        "&order=created_at.asc",
        `&limit=${SUPABASE_PAGE_SIZE}`,
        `&offset=${offset}`,
      ].join(""),
    );

    result.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return result;
}


async function getCalculationItems(calculationRunId: string) {
  const result: ReplenishmentItemRow[] = [];

  for (
    let offset = 0;
    offset < 20000;
    offset += SUPABASE_PAGE_SIZE
  ) {
    const page = await supabaseGet<ReplenishmentItemRow[]>(
      [
        "ozon_fbo_replenishment_items",
        "?select=product_id,ozon_sku",
        `&calculation_run_id=eq.${encodeURIComponent(calculationRunId)}`,
        `&limit=${SUPABASE_PAGE_SIZE}`,
        `&offset=${offset}`,
      ].join(""),
    );

    result.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return result;
}


async function getOrder(orderId: number) {
  const response = await ozonPost<{ orders?: OzonOrder[] }>(
    "/v3/supply-order/get",
    { order_ids: [String(orderId)] },
  );

  return (
    response.orders?.find((row) => Number(row.order_id) === orderId) ??
    response.orders?.[0] ??
    null
  );
}


async function getBundleItems(bundleId: string) {
  const items: BundleItem[] = [];
  let lastId = "";

  for (let page = 0; page < 100; page++) {
    const response = await ozonPost<{
      items?: BundleItem[];
      has_next?: boolean;
      last_id?: string;
    }>(
      "/v1/supply-order/bundle",
      {
        bundle_ids: [bundleId],
        is_asc: true,
        limit: 100,
        sort_field: "SKU",
        ...(lastId ? { last_id: lastId } : {}),
      },
    );

    items.push(...(response.items ?? []));
    if (!response.has_next) break;

    const next = normalizeKey(response.last_id);
    if (!next || next === lastId) break;
    lastId = next;
  }

  return items;
}


async function getPlacementZones(skus: number[]) {
  const result = new Map<number, string>();

  for (const part of chunk(Array.from(new Set(skus)), 150)) {
    const response = await ozonPost<PlacementZoneResponse>(
      "/v1/product/placement-zone/info",
      { skus: part.map(String) },
    );

    for (const row of response.products_placement ?? []) {
      const sku = toPositiveInteger(row.sku);
      const zone = normalizeKey(row.placement_zone).toUpperCase();
      if (sku !== null && zone) result.set(sku, zone);
    }
  }

  return result;
}


async function getExistingCargoCount(supplyId: number) {
  const response = await ozonPost<{
    supplies_cargoes?: Array<{
      supply_id?: string | number;
      cargoes_without_transport_cargoes?: unknown[];
      transport_cargoes?: Array<{ cargoes?: unknown[] }>;
    }>;
  }>(
    "/v1/cargoes/supplies/get",
    { supply_ids: [String(supplyId)] },
  );

  const row = response.supplies_cargoes?.find(
    (item) => Number(item.supply_id) === supplyId,
  );
  if (!row) return 0;

  return (
    (row.cargoes_without_transport_cargoes?.length ?? 0) +
    (row.transport_cargoes ?? []).reduce(
      (sum, transport) => sum + (transport.cargoes?.length ?? 0),
      0,
    )
  );
}


async function waitCargoOperation(operationId: string) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const response = await ozonPost<CargoCreateInfoResponse>(
      "/v2/cargoes/create/info",
      { operation_id: operationId },
    );

    const status = normalizeKey(response.status);
    if (status === "SUCCESS") return;
    if (status === "FAILED") {
      throw new Error(
        `Ozon не создал грузоместа: ${JSON.stringify(response.errors ?? {})}`,
      );
    }

    await sleep(1250);
  }

  throw new Error(
    `Ozon не завершил создание грузомест operation_id=${operationId}`,
  );
}


function usefulErrorReasons(values: string[] | undefined) {
  return (values ?? []).filter(
    (value) =>
      value &&
      value !== "UNSPECIFIED" &&
      value !== "ERROR_REASON_UNSPECIFIED",
  );
}


function validateRules(response: CargoRulesResponse) {
  const issues: string[] = [];

  for (const checklist of response.supply_check_lists ?? []) {
    const supplyId = normalizeKey(checklist.supply_id) || "?";

    for (const ruleName of [
      "cargoes_presents_rule",
      "is_valid_distribution_rule",
      "package_units_with_distribution_rule",
      "placement_zones_rule",
    ]) {
      const rule = checklist[ruleName] as
        | Record<string, unknown>
        | undefined;

      if (rule?.satisfied === false) {
        issues.push(`supply ${supplyId}: ${ruleName}`);
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(
      `Ozon cargoes/rules/get не подтвердил распределение: ${issues.join(", ")}`,
    );
  }
}


async function buildCargoPlan(
  calculationRunId: string,
  orderId: number,
  clusterName: string,
) {
  const thresholdLitres = thresholdForCluster(clusterName);

  const [order, products, calculationItems] = await Promise.all([
    getOrder(orderId),
    getProducts(),
    getCalculationItems(calculationRunId),
  ]);

  if (!order) {
    return {
      ready: false as const,
      reason:
        "Ozon пока не вернул созданную заявку через /v3/supply-order/get",
    };
  }

  const supplies = (order.supplies ?? [])
    .map((supply) => ({
      supply_id: toPositiveInteger(supply.supply_id),
      bundle_id: normalizeKey(supply.bundle_id),
      state: normalizeKey(supply.state),
    }))
    .filter(
      (
        supply,
      ): supply is {
        supply_id: number;
        bundle_id: string;
        state: string;
      } =>
        supply.supply_id !== null &&
        Boolean(supply.bundle_id),
    );

  if (supplies.length === 0) {
    return {
      ready: false as const,
      reason:
        "Ozon пока не вернул supply_id / bundle_id для созданной заявки",
    };
  }

  const productById = new Map(
    products.map((product) => [product.id, product]),
  );
  const productBySku = new Map<number, ProductRow>();

  for (const row of calculationItems) {
    const sku = toPositiveInteger(row.ozon_sku);
    const product = productById.get(row.product_id);
    if (sku !== null && product) productBySku.set(sku, product);
  }

  // Вложимость и габариты считаем по master_code: у дубля могут быть
  // заполнены данные, даже если у конкретного offer_id они пустые.
  const packByMaster = new Map<string, Set<number>>();
  const dimensionsByMaster = new Map<
    string,
    Map<string, [number, number, number]>
  >();
  const volumeByMaster = new Map<string, Set<number>>();

  for (const product of products) {
    const master = normalizeKey(product.master_code);
    if (!master) continue;

    const pack = toPositiveInteger(product.units_per_carton);
    if (pack !== null) {
      const values = packByMaster.get(master) ?? new Set<number>();
      values.add(pack);
      packByMaster.set(master, values);
    }

    const dimensions: [number, number, number] = [
      Number(product.carton_length_mm),
      Number(product.carton_width_mm),
      Number(product.carton_height_mm),
    ];

    if (
      dimensions.every(
        (value) => Number.isFinite(value) && value > 0,
      )
    ) {
      const key = [...dimensions].sort((a, b) => a - b).join("x");
      const values =
        dimensionsByMaster.get(master) ??
        new Map<string, [number, number, number]>();
      values.set(key, dimensions);
      dimensionsByMaster.set(master, values);
    }

    const volume = toPositiveNumber(product.transport_carton_volume_m3);
    if (volume !== null) {
      const values = volumeByMaster.get(master) ?? new Set<number>();
      values.add(volume);
      volumeByMaster.set(master, values);
    }
  }

  const supplyPlans: Array<{
    supply_id: number;
    state: string;
    cargoes: PlannedCargo[];
    expected_cargoes: number;
    pallet_count: number;
    box_count: number;
  }> = [];

  for (const supply of supplies) {
    const bundleItems = await getBundleItems(supply.bundle_id);
    const skus = bundleItems
      .map((item) => toPositiveInteger(item.sku))
      .filter((sku): sku is number => sku !== null);

    // Зона размещения всегда свежая, не хранится навечно в карточке товара.
    const placementZones = await getPlacementZones(skus);
    const cartons: CartonUnit[] = [];

    for (const item of bundleItems) {
      const sku = toPositiveInteger(item.sku);
      const quantity = toPositiveInteger(item.quantity);
      if (sku === null || quantity === null) continue;

      const product = productBySku.get(sku);
      if (!product) {
        throw new Error(
          `SKU ${sku}: не найден товар из расчёта потребности`,
        );
      }

      const master = normalizeKey(product.master_code);
      const packs = master ? packByMaster.get(master) : undefined;
      if (!packs || packs.size === 0) {
        throw new Error(
          `SKU ${sku}: нет вложимости транспортного короба`,
        );
      }
      if (packs.size > 1) {
        throw new Error(
          `SKU ${sku}: конфликт вложимости по master_code ${master}`,
        );
      }

      const pack = Array.from(packs)[0];
      if (quantity % pack !== 0) {
        throw new Error(
          `SKU ${sku}: Ozon распределил ${quantity} шт., вложимость ${pack}; остаток ${quantity % pack} шт. ГМ автоматически не создаём.`,
        );
      }

      const offerId =
        normalizeKey(item.offer_id) ||
        normalizeKey(product.offer_id);
      if (!offerId) {
        throw new Error(`SKU ${sku}: отсутствует offer_id`);
      }

      const boxCount = quantity / pack;
      const totalLitres =
        toPositiveNumber(item.total_volume_in_litres) ??
        (
          toPositiveNumber(item.volume_in_litres) !== null
            ? (toPositiveNumber(item.volume_in_litres) as number) *
              quantity
            : null
        ) ??
        (() => {
          const volumes = master ? volumeByMaster.get(master) : undefined;
          if (!volumes || volumes.size !== 1) return null;
          return Array.from(volumes)[0] * 1000 * boxCount;
        })();

      if (totalLitres === null) {
        throw new Error(
          `SKU ${sku}: нет литража Ozon и объёма транспортного короба`,
        );
      }

      const dimensionVariants =
        master ? dimensionsByMaster.get(master) : undefined;
      const dimensions =
        dimensionVariants?.size === 1
          ? Array.from(dimensionVariants.values())[0]
          : null;

      const zone =
        placementZones.get(sku) ??
        "UNRESOLVED";

      const barcode = normalizeKey(item.barcode) || null;
      const quant = toPositiveInteger(item.quant) ?? 1;
      const perCartonLitres = totalLitres / boxCount;

      for (let index = 0; index < boxCount; index++) {
        cartons.push({
          sku,
          offer_id: offerId,
          barcode,
          quantity: pack,
          quant,
          placement_zone: zone,
          volume_litres: perCartonLitres,
          dimensions,
        });
      }
    }

    const byZone = new Map<string, CartonUnit[]>();
    for (const carton of cartons) {
      const rows = byZone.get(carton.placement_zone) ?? [];
      rows.push(carton);
      byZone.set(carton.placement_zone, rows);
    }

    const cargoes: PlannedCargo[] = [];
    for (const zoneCartons of byZone.values()) {
      cargoes.push(
        ...planCargoesForZone({
          cartons: zoneCartons,
          thresholdLitres,
          orderId,
          supplyId: supply.supply_id,
        }),
      );
    }

    cargoes.sort((left, right) =>
      left.type === right.type
        ? left.key.localeCompare(right.key)
        : left.type === "PALLET"
          ? -1
          : 1,
    );

    supplyPlans.push({
      supply_id: supply.supply_id,
      state: supply.state,
      cargoes,
      expected_cargoes: cargoes.length,
      pallet_count: cargoes.filter(
        (cargo) => cargo.type === "PALLET",
      ).length,
      box_count: cargoes.filter(
        (cargo) => cargo.type === "BOX",
      ).length,
    });
  }

  return {
    ready: true as const,
    threshold_litres: thresholdLitres,
    supplies: supplyPlans,
    expected_cargoes: supplyPlans.reduce(
      (sum, supply) => sum + supply.expected_cargoes,
      0,
    ),
    pallet_count: supplyPlans.reduce(
      (sum, supply) => sum + supply.pallet_count,
      0,
    ),
    box_count: supplyPlans.reduce(
      (sum, supply) => sum + supply.box_count,
      0,
    ),
  };
}


export async function createNextAutomaticCargoBatch({
  calculationRunId,
  orderId,
  clusterName,
  continueExisting,
}: {
  calculationRunId: string;
  orderId: number;
  clusterName: string;
  continueExisting: boolean;
}) {
  const plan = await buildCargoPlan(
    calculationRunId,
    orderId,
    clusterName,
  );

  if (!plan.ready) {
    return {
      done: false,
      pending: true,
      created_cargoes: 0,
      expected_cargoes: 0,
      pallet_count: 0,
      box_count: 0,
      message: plan.reason,
    };
  }

  const existingBySupply = new Map<number, number>();

  for (const supply of plan.supplies) {
    const existing = await getExistingCargoCount(supply.supply_id);
    existingBySupply.set(supply.supply_id, existing);

    if (existing > supply.expected_cargoes) {
      throw new Error(
        `Поставка ${supply.supply_id}: в Ozon уже ${existing} ГМ, а по новому расчёту должно быть ${supply.expected_cargoes}. Автоматически не меняем.`,
      );
    }

    if (
      existing > 0 &&
      existing < supply.expected_cargoes &&
      !continueExisting
    ) {
      throw new Error(
        `Поставка ${supply.supply_id}: уже есть ${existing} из ${supply.expected_cargoes} ГМ. Существующее распределение автоматически не перезаписываем.`,
      );
    }
  }

  const totalExisting = Array.from(existingBySupply.values()).reduce(
    (sum, value) => sum + value,
    0,
  );

  for (const supply of plan.supplies) {
    const existing = existingBySupply.get(supply.supply_id) ?? 0;
    if (existing >= supply.expected_cargoes) continue;

    const remaining = supply.cargoes.slice(existing);
    const firstType = remaining[0]?.type;
    if (!firstType) continue;

    const limit =
      firstType === "PALLET"
        ? MAX_PALLETS_PER_REQUEST
        : MAX_BOXES_PER_REQUEST;

    const batch = remaining
      .filter((cargo) => cargo.type === firstType)
      .slice(0, limit);

    const response = await ozonPost<CargoCreateResponse>(
      "/v1/cargoes/create",
      {
        supply_id: supply.supply_id,
        delete_current_version: existing === 0,
        cargoes: batch.map((cargo) => ({
          key: cargo.key,
          value: {
            type: cargo.type,
            items: cargo.items.map((item) => ({
              offer_id: item.offer_id,
              quantity: item.quantity,
              quant: item.quant,
              ...(item.barcode ? { barcode: item.barcode } : {}),
            })),
          },
        })),
      },
    );

    const reasons = usefulErrorReasons(
      response.errors?.error_reasons,
    );
    if (
      reasons.length > 0 ||
      (response.errors?.items_validation?.length ?? 0) > 0
    ) {
      throw new Error(
        `Ozon не создал грузоместа (${firstType}, ${batch.length} шт.): ${JSON.stringify(response.errors)}`,
      );
    }

    const operationId = normalizeKey(response.operation_id);
    if (!operationId) {
      throw new Error(
        `Поставка ${supply.supply_id}: Ozon не вернул operation_id создания грузомест`,
      );
    }

    await waitCargoOperation(operationId);

    const createdCargoes = totalExisting + batch.length;
    return {
      // Даже последнюю пачку подтверждаем ещё одним проходом:
      // сначала перечитываем фактические ГМ Ozon и проверяем cargoes/rules/get.
      done: false,
      pending: false,
      created_cargoes: createdCargoes,
      expected_cargoes: plan.expected_cargoes,
      pallet_count: plan.pallet_count,
      box_count: plan.box_count,
      message:
        `AUTO_GM: создано ${createdCargoes}/${plan.expected_cargoes} ГМ; ` +
        `план ${plan.pallet_count} PALLET + ${plan.box_count} BOX; ` +
        `порог ${Math.round(plan.threshold_litres)} л.`,
    };
  }

  const rules = await ozonPost<CargoRulesResponse>(
    "/v1/cargoes/rules/get",
    {
      supply_ids: plan.supplies.map((supply) => supply.supply_id),
    },
  );
  validateRules(rules);

  return {
    done: true,
    pending: false,
    created_cargoes: totalExisting,
    expected_cargoes: plan.expected_cargoes,
    pallet_count: plan.pallet_count,
    box_count: plan.box_count,
    message:
      `AUTO_GM: готово ${totalExisting}/${plan.expected_cargoes} ГМ; ` +
      `${plan.pallet_count} PALLET + ${plan.box_count} BOX.`,
  };
}
