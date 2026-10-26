import ExcelJS from "exceljs";
import {
  eligibleOnCluster, eligibilityIsStale,
  type EligibilitySnapshot
} from "@/lib/yandex-fby-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// В шаблоне мультипоставки ЯМ нет полей для назначения кластера:
// ЯМ распределяет общее количество между регионами после загрузки файла.
type YandexProduct = {
  offer_id: string;
  master_code: string | null;
  is_active: boolean;
  raw_data: {
    offer?: { name?: string; barcodes?: string[] };
    mapping?: { marketSkuName?: string };
  } | null;
};
type OzonProduct = {
  master_code: string | null;
  units_per_carton: number | null;
  is_discontinued: boolean | null;
};
type SalesRow = {
  shop_sku: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
  sales_quantity: number | null; // Уже исключены отмены и невыкупы
};
type StockRow = {
  offer_id: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
  available: number | null;
};
type SalesRun = { id: string; date_from: string; date_to: string; created_at: string };
type StockRun = { id: string; snapshot_date: string; created_at: string };
type OfferMetrics = { sale: number; stock: number };
type NeedRow = {
  offerId: string;
  name: string;
  masterCode: string | null;
  barcode: string;
  pack: number | null;
  rawNeed: number;
  quantity: number;
  cartonCount: number;
  sales28: number;
  stock: number;
  errors: string[];
};
type WarehouseSummary = {
  id: number; name: string; rawNeed: number; articles: number; sales28: number;
};
type ClusterAllocation = {
  cluster: string; offerId: string; name: string; masterCode: string | null;
  sales28: number; stock: number; rawNeed: number; pack: number | null;
  cartons: number; quantity: number; errors: string[];
};
type ClusterSummary = {
  name: string; rawNeed: number; proposedUnits: number; cartons: number;
  articles: number; sales28: number; stock: number; warehouseIds: number[];
};
type PlanResult = {
  calculatedAt: string;
  salesPeriod: string;
  stockDate: string;
  stale: boolean;
  staleReasons: string[];
  warehouses: WarehouseSummary[];
  clusters: ClusterSummary[];
  allocations: ClusterAllocation[];
  selectedClusters: string[];
  unmappedWarehouses: string[];
  items: NeedRow[];
  blocked: NeedRow[];
  totals: { articles: number; blocked: number; units: number; cartons: number; rawNeed: number };
  notice: string;
  eligibility: { source: string; checkedAt: string; excludedCount: number; unknownCount: number; stale: boolean };
  excluded: Array<{ offerId: string; cluster: string; reason: string; rawNeed: number; sales28: number; stock: number }>;
};

function config() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Не настроено подключение Supabase");
  return { url, key };
}

async function dbRows<T>(table: string, select: string, filters: Record<string, string> = {}): Promise<T[]> {
  const { url, key } = config();
  const all: T[] = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const target = new URL(url + "/rest/v1/" + table);
    target.searchParams.set("select", select);
    target.searchParams.set("limit", "1000");
    target.searchParams.set("offset", String(offset));
    for (const [k, v] of Object.entries(filters)) target.searchParams.set(k, v);
    const response = await fetch(target, {
      headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Supabase " + table + ": HTTP " + response.status);
    const chunk = await response.json() as T[];
    all.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return all;
}

function normal(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function int(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}
function coverageNeed(sales28: number, stock: number): number {
  // Одна и та же формула, что в run_ozon_fbo_replenishment():
  // > 30 дней = 0; < 10 дней = 30 средних продаж;
  // 10..30 дней = доведение до 40 дней.
  const daily = sales28 / 28;
  if (daily <= 0) return 0;
  const days = stock / daily;
  if (days > 30) return 0;
  return Math.ceil(days < 10 ? daily * 30 : (40 - days) * daily);
}

function validBarcodes(product: YandexProduct): string {
  const values = product.raw_data?.offer?.barcodes || [];
  return [...new Set(values.map(normal).filter(v => v && !/[\s_;]/.test(v)))].join(", ");
}

const CLUSTER_BY_WAREHOUSE: Record<number, string | null> = {
  172: "Москва", 304: "Москва", 308: "Москва",
  313: "Санкт-Петербург", 301: "Санкт-Петербург",
  314: "Казань", 305: "Ростов-на-Дону", 147: "Ростов-на-Дону",
  300: "Екатеринбург", 302: "Самара",
  501: null // возвратный склад, не склад FBY для новой поставки
};
// Сопоставление известных складов по текущей базе. Названия/ID не считаем
// универсальным справочником Маркета: новые ID должны пройти проверку.
async function buildPlan(clusterNames: string[] | null): Promise<PlanResult> {
  const [eligRows, salesRuns, stockRuns, products, packing] = await Promise.all([
    dbRows<EligibilitySnapshot>("yandex_fby_eligibility_snapshots", "id,created_at,source_file,offers_count,warehouse_count,mapping,headers,unknown_offers", { order: "created_at.desc", limit: "1" }),
    dbRows<SalesRun>("yandex_sales_sync_runs", "id,date_from,date_to,created_at", { status: "eq.success", order: "created_at.desc", limit: "1" }),
    dbRows<StockRun>("yandex_stock_sync_runs", "id,snapshot_date,created_at", { status: "eq.success", order: "created_at.desc", limit: "1" }),
    dbRows<YandexProduct>("yandex_products", "offer_id,master_code,is_active,raw_data"),
    dbRows<OzonProduct>("products", "master_code,units_per_carton,is_discontinued")
  ]);
  const sellerEligibility = eligRows[0];
  if (!sellerEligibility) throw new Error("Сначала загрузите проверочную матрицу Яндекс Маркета с колонками «да/нет» по складам. Проверять возможность поставки по остаткам нельзя.");
  // Допускается файл ЯМ только с кандидатами на поставку.
  // Если для товара с реальной потребностью нет ответа ЯМ, это НЕ «нет»:
  // он попадёт в список непроверенных и не сможет попасть в загрузочный Excel.
  const salesRun = salesRuns[0], stockRun = stockRuns[0];
  if (!salesRun || !stockRun) throw new Error("Нет успешной синхронизации продаж или остатков ЯМ");

  const duration = (Date.parse(salesRun.date_to + "T00:00:00Z") - Date.parse(salesRun.date_from + "T00:00:00Z")) / 86400000 + 1;
  if (duration !== 28) throw new Error("Последняя выгрузка продаж ЯМ не охватывает 28 дней");

  const [sales, stocks] = await Promise.all([
    dbRows<SalesRow>("yandex_sales_daily", "shop_sku,warehouse_id,warehouse_name,sales_quantity", { last_sync_run_id: "eq." + salesRun.id }),
    dbRows<StockRow>("yandex_stock_snapshots", "offer_id,warehouse_id,warehouse_name,available", { sync_run_id: "eq." + stockRun.id })
  ]);

  if (sales.some(row => row.warehouse_id === null && int(row.sales_quantity) > 0)
    || stocks.some(row => row.warehouse_id === null && int(row.available) > 0)) {
    throw new Error("Есть продажи или остатки ЯМ без идентификатора склада. Экспорт заблокирован во избежание потерь потребности.");
  }

  const staleReasons: string[] = [];
  if (eligibilityIsStale(sellerEligibility)) staleReasons.push("Матрица доступности SKU по складам ЯМ старше 48 часов");
  if (Date.now() - Date.parse(salesRun.created_at) > 48 * 3600000) staleReasons.push("Продажи синхронизированы более 48 часов назад");
  if (Date.now() - Date.parse(stockRun.created_at) > 48 * 3600000) staleReasons.push("Остатки синхронизированы более 48 часов назад");
  if (Date.now() - Date.parse(salesRun.date_to + "T23:59:59Z") > 72 * 3600000) staleReasons.push("Последний день продаж старше трёх суток");
  if (Date.now() - Date.parse(stockRun.snapshot_date + "T23:59:59Z") > 72 * 3600000) staleReasons.push("Дата снимка остатков старше трёх суток");
  if (stockRun.snapshot_date < salesRun.date_to) staleReasons.push("Снимок остатков старше периода продаж");

  const packByMaster = new Map<string, { packs: Set<number>; discontinued: boolean }>();
  for (const p of packing) {
    const code = normal(p.master_code);
    if (!code) continue;
    let current = packByMaster.get(code);
    if (!current) {
      current = { packs: new Set<number>(), discontinued: false };
      packByMaster.set(code, current);
    }
    if (int(p.units_per_carton) > 0) current.packs.add(int(p.units_per_carton));
    if (p.is_discontinued === true) current.discontinued = true;
  }

  const metrics = new Map<string, OfferMetrics>();
  const warehouseData = new Map<number, WarehouseSummary>();
  const unmappedWarehouses = new Set<string>();
  function accumulate(offer: string, warehouseId: number | null, warehouseName: string | null, kind: "sale" | "stock", amount: number) {
    if (warehouseId === null || !Number.isSafeInteger(warehouseId) || warehouseId <= 0) return;
    if (!warehouseData.has(warehouseId)) warehouseData.set(warehouseId, { id: warehouseId, name: normal(warehouseName) || "Склад " + warehouseId, rawNeed: 0, articles: 0, sales28: 0 });
    if (kind === "sale") warehouseData.get(warehouseId)!.sales28 += amount;
    const key = offer + "\u0000" + warehouseId;
    const current = metrics.get(key) || { sale: 0, stock: 0 };
    current[kind] += amount;
    metrics.set(key, current);
  }
  for (const row of sales) accumulate(row.shop_sku, row.warehouse_id, row.warehouse_name, "sale", int(row.sales_quantity));
  for (const row of stocks) accumulate(row.offer_id, row.warehouse_id, row.warehouse_name, "stock", int(row.available));

  // Сначала суммируем остатки/продажи складов ОДНОГО кластера.
  // Затем вычисляем потребность и округляем коробки на уровне кластера.
  // Сложение отдельных складских потребностей давало неверный результат.
  const clusterMetrics = new Map<string, { offerId: string; cluster: string; sale: number; stock: number }>();
  const allClusterNames = new Set<string>();
  const clusterToWarehouses = new Map<string, Set<number>>();
  for (const [key, m] of metrics.entries()) {
    const at = key.lastIndexOf("\u0000");
    const offerId = key.slice(0, at);
    const whId = Number(key.slice(at + 1));
    const wh = warehouseData.get(whId)!;
    wh.rawNeed += coverageNeed(m.sale, m.stock);
    if (coverageNeed(m.sale, m.stock) > 0) wh.articles += 1;
    if (!(whId in CLUSTER_BY_WAREHOUSE)) {
      if (m.sale > 0 || m.stock > 0) unmappedWarehouses.add(wh.name + " (#" + whId + ")");
      continue;
    }
    const cluster = CLUSTER_BY_WAREHOUSE[whId];
    if (!cluster) continue;
    allClusterNames.add(cluster);
    if (!clusterToWarehouses.has(cluster)) clusterToWarehouses.set(cluster, new Set());
    clusterToWarehouses.get(cluster)!.add(whId);
    const k = offerId + "\u0000" + cluster;
    const existing = clusterMetrics.get(k) || { offerId, cluster, sale: 0, stock: 0 };
    existing.sale += m.sale;
    existing.stock += m.stock;
    clusterMetrics.set(k, existing);
  }
  const selectedSet = clusterNames === null ? allClusterNames : new Set(clusterNames);
  if (clusterNames?.some(name => !allClusterNames.has(name))) throw new Error("Выбран неизвестный кластер ЯМ");
  const allOffers = new Map(products.map(p => [p.offer_id, p]));
  const clusterTotals = new Map<string, ClusterSummary>();
  for (const cluster of allClusterNames) {
    clusterTotals.set(cluster, {
      name: cluster, rawNeed: 0, proposedUnits: 0, cartons: 0,
      articles: 0, sales28: 0, stock: 0,
      warehouseIds: [...(clusterToWarehouses.get(cluster) || [])].sort((a, b) => a - b)
    });
  }

  const allocations: ClusterAllocation[] = [];
  const excluded: Array<{ offerId: string; cluster: string; reason: string; rawNeed: number; sales28: number; stock: number }> = [];
  let unknownCount = 0;
  const blockedMap = new Map<string, NeedRow>();
  const itemMap = new Map<string, NeedRow>();
  let rawNeedAll = 0;
  for (const m of clusterMetrics.values()) {
    const product = allOffers.get(m.offerId);
    const masterCode = normal(product?.master_code) || null;
    const packInfo = masterCode ? packByMaster.get(masterCode) : undefined;
    if (packInfo?.discontinued || product?.is_active === false) continue;
    if (!selectedSet.has(m.cluster)) continue;
    const rawNeed = coverageNeed(m.sale, m.stock);
    if (rawNeed <= 0) continue;
    const check = eligibleOnCluster(sellerEligibility, m.offerId, m.cluster);
    if (check === "no") {
      excluded.push({
        offerId: m.offerId, cluster: m.cluster,
        reason: "Яндекс Маркет: нет допуска на проверенные склады этого кластера",
        rawNeed, sales28: m.sale, stock: m.stock
      });
      continue;
    }
    const cluster = clusterTotals.get(m.cluster)!;
    cluster.sales28 += m.sale;
    cluster.stock += m.stock;
    cluster.rawNeed += rawNeed;
    cluster.articles++;

    rawNeedAll += rawNeed;

    const errors: string[] = [];
    if (check === "unknown") {
      errors.push("Нет подтверждения допуска ЯМ для складов этого кластера");
      unknownCount++;
    }
    if (!product) errors.push("Нет товара в справочнике ЯМ");
    if (!masterCode) errors.push("Не задан ЕНОТ / master_code");
    if (!packInfo || packInfo.packs.size === 0) errors.push("Не задана вложимость короба");
    if (packInfo && packInfo.packs.size > 1) errors.push("Противоречивая вложимость для ЕНОТ");
    const pack = packInfo?.packs.size === 1 ? [...packInfo.packs][0] : null;
    const barcode = product ? validBarcodes(product) : "";
    if (!barcode) errors.push("Нет штрихкода");
    const name = normal(product?.raw_data?.offer?.name) || normal(product?.raw_data?.mapping?.marketSkuName);
    if (!name) errors.push("Нет наименования");
    if (m.offerId.length > 80) errors.push("Артикул длиннее 80 символов");

    // Не округляем суммарную потребность РФ: иначе теряется география.
    const cartons = pack && rawNeed > pack * 0.5 ? Math.round(rawNeed / pack) : 0;
    const quantity = errors.length ? 0 : cartons * (pack || 0);
    allocations.push({
      cluster: m.cluster, offerId: m.offerId, name, masterCode,
      sales28: m.sale, stock: m.stock, rawNeed, pack: pack || null,
      cartons: errors.length ? 0 : cartons, quantity, errors
    });
    if (errors.length > 0) {
      const existing = blockedMap.get(m.offerId) || {
        offerId: m.offerId, name, masterCode, barcode,
        pack: pack || null, rawNeed: 0, quantity: 0, cartonCount: 0,
        sales28: 0, stock: 0, errors
      };
      existing.rawNeed += rawNeed;
      existing.sales28 += m.sale;
      existing.stock += m.stock;
      blockedMap.set(m.offerId, existing);
      continue;
    }
    cluster.proposedUnits += quantity;
    cluster.cartons += cartons;
    if (quantity === 0) continue;
    const existing = itemMap.get(m.offerId) || {
      offerId: m.offerId, name, masterCode, barcode,
      pack: pack || null, rawNeed: 0, quantity: 0, cartonCount: 0,
      sales28: 0, stock: 0, errors: []
    };
    existing.rawNeed += rawNeed;
    existing.quantity += quantity;
    existing.cartonCount += cartons;
    existing.sales28 += m.sale;
    existing.stock += m.stock;
    itemMap.set(m.offerId, existing);
  }
  const items = [...itemMap.values()].sort((a, b) => b.quantity - a.quantity || a.offerId.localeCompare(b.offerId));
  const blocked = [...blockedMap.values()].sort((a, b) => b.rawNeed - a.rawNeed);
  const clusters = [...clusterTotals.values()].sort((a, b) => b.rawNeed - a.rawNeed || a.name.localeCompare(b.name));
  allocations.sort((a, b) => a.cluster.localeCompare(b.cluster, "ru") || b.rawNeed - a.rawNeed);
  const warehouses = [...warehouseData.values()].sort((a, b) => b.rawNeed - a.rawNeed);
  if (unmappedWarehouses.size) staleReasons.push("Найдены склады без подтверждённой привязки к кластеру");
  return {
    calculatedAt: new Date().toISOString(),
    salesPeriod: salesRun.date_from + " — " + salesRun.date_to,
    stockDate: stockRun.snapshot_date,
    stale: staleReasons.length > 0,
    staleReasons, warehouses, clusters, allocations,
    selectedClusters: [...selectedSet],
    unmappedWarehouses: [...unmappedWarehouses],
    items, blocked,
    totals: {
      articles: items.length, blocked: blocked.length,
      units: items.reduce((n, p) => n + p.quantity, 0),
      cartons: items.reduce((n, p) => n + p.cartonCount, 0),
      rawNeed: rawNeedAll
    },
    eligibility: {
      source: sellerEligibility.source_file,
      checkedAt: sellerEligibility.created_at,
      excludedCount: excluded.length,
      unknownCount,
      stale: eligibilityIsStale(sellerEligibility)
    },
    excluded,
    notice: "Сверка файла ЯМ с потребностью по кластерам: «да» включены, «нет» исключены, отсутствующие ответы выделены как непроверенные. Плановый Excel включает все проблемы, а загрузочный содержит только подтверждённые позиции. Распределение по кластерам ЯМ потребуется сверить после импорта."
  };
}

function parseClusters(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > 50 || value.some(x => typeof x !== "string" || !x.trim() || x.length > 100)) {
    throw new Error("Неверный список кластеров");
  }
  return [...new Set((value as string[]).map(x => x.trim()))];
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const clusters = params.has("clusters") ? parseClusters(params.get("clusters")?.split(",").filter(Boolean)) : null;
    return Response.json({ ok: true, plan: await buildPlan(clusters) });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка расчёта" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { clusterNames?: string[]; allowPartial?: boolean; allowStale?: boolean; mode?: "plan" | "upload" };
    const plan = await buildPlan(parseClusters(input.clusterNames));
    if (plan.unmappedWarehouses.length > 0) {
      return Response.json({ ok: false, error: "Есть склады ЯМ без проверенного кластера. Экспорт заблокирован, пока не настроено сопоставление: " + plan.unmappedWarehouses.join(", ") }, { status: 409 });
    }
    if (plan.stale && input.allowStale !== true) {
      return Response.json({ ok: false, error: "Данные устарели. Сначала обновите продажи и остатки ЯМ или подтвердите тестовый экспорт." }, { status: 409 });
    }
    if (plan.blocked.length > 0 && input.allowPartial !== true) {
      return Response.json({ ok: false, error: "В плане есть позиции без штрихкода/вложимости/наименования. Исправьте данные или явно разрешите частичный экспорт." }, { status: 409 });
    }
    if (!plan.items.length) return Response.json({ ok: false, error: "Нет корректных товаров для экспорта" }, { status: 409 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Поставка");
    sheet.columns = [
      { header: "Ваш SKU", key: "sku", width: 28 },
      { header: "Наименование", key: "name", width: 57 },
      { header: "Штрихкод", key: "barcode", width: 29 },
      { header: "Общее кол-во для поставки", key: "amount", width: 31 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: "FF252525" } };
    sheet.getRow(1).height = 25;
    sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(1).eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCEBFA" } }; });
    for (const item of plan.items) {
      const row = sheet.addRow({ sku: item.offerId, name: item.name, barcode: item.barcode, amount: item.quantity });
      row.getCell(1).numFmt = "@";
      row.getCell(3).numFmt = "@";
      row.getCell(4).numFmt = "0";
    }
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const description = workbook.addWorksheet("Описание полей");
    description.columns = [{ width: 30 }, { width: 56 }, { width: 53 }, { width: 44 }, { width: 22 }];
    description.mergeCells("A1:E1");
    description.getCell("A1").value = "Описание полей";
    description.getCell("A1").font = { bold: true, size: 15 };
    description.addRow(["Поле", "Описание", "Требования к значению", "Пример", "Обязательность поля"]);
    description.addRow(["Ваш SKU", "Ваш идентификатор товара", "До 80 символов. Берётся из offer_id Яндекс Маркета.", "4600728005002", "Обязательное"]);
    description.addRow(["Наименование", "Название товара", "Должно совпадать с вашим товаром в каталоге Маркета.", "Товар, модель", "Обязательное"]);
    description.addRow(["Штрихкод", "Штрихкод товара или упаковки. Несколько значений через запятую.", "EAN-13, EAN-8, UPC, Code 128.", "4600728005003", "Обязательное"]);
    description.addRow(["Общее кол-во для поставки", "Общее количество для мультипоставки", "Положительное целое число единиц товара.", "3", "Обязательное"]);
    description.getRow(2).font = { bold: true };
    for (let i = 2; i <= 6; i++) description.getRow(i).alignment = { wrapText: true, vertical: "top" };
    // Плановый Excel включает распределение; файл для импорта содержит
    // только два листа исходного шаблона (Яндекс не импортирует кластеры).
    if (input.mode !== "upload") {
      const clusterNames = plan.clusters
        .filter(c => plan.selectedClusters.includes(c.name))
        .map(c => c.name);
      const matrix = workbook.addWorksheet("По кластерам");
      const baseHeaders = ["Ваш SKU", "Наименование", "ЕНОТ", "Вложимость", "Нужно без округления"];
      const header = [...baseHeaders, ...clusterNames.flatMap(c => [c + " — нужно", c + " — к поставке"]), "ИТОГО к поставке"];
      matrix.addRow(header);
      const bg = { type: "pattern", pattern: "solid", fgColor: { argb: "FF204966" } } as const;
      matrix.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      matrix.getRow(1).eachCell(cell => { cell.fill = bg; cell.alignment = { wrapText: true, vertical: "middle" }; });
      matrix.getRow(1).height = 38;
      matrix.getColumn(1).width = 34;
      matrix.getColumn(2).width = 60;
      matrix.getColumn(3).width = 19;
      matrix.getColumn(4).width = 17;
      matrix.getColumn(5).width = 22;
      for (let i = 6; i <= header.length; i++) matrix.getColumn(i).width = 20;
      const allocationByOffer = new Map<string, Map<string, ClusterAllocation>>();
      for (const allocation of plan.allocations) {
        if (!allocationByOffer.has(allocation.offerId)) allocationByOffer.set(allocation.offerId, new Map());
        allocationByOffer.get(allocation.offerId)!.set(allocation.cluster, allocation);
      }
      const groupedOffers = new Map<string, ClusterAllocation[]>();
      for (const allocation of plan.allocations) {
        if (!groupedOffers.has(allocation.offerId)) groupedOffers.set(allocation.offerId, []);
        groupedOffers.get(allocation.offerId)!.push(allocation);
      }
      for (const [offerId, entries] of [...groupedOffers.entries()].sort((a, b) => b[1].reduce((n, x) => n + x.rawNeed, 0) - a[1].reduce((n, x) => n + x.rawNeed, 0))) {
        const sample = entries[0];
        const byCluster = allocationByOffer.get(offerId);
        const quantity = entries.reduce((n, x) => n + x.quantity, 0);
        const rawNeed = entries.reduce((n, x) => n + x.rawNeed, 0);
        const excelRow = matrix.addRow([
          offerId, sample.name, sample.masterCode, sample.pack, rawNeed,
          ...clusterNames.flatMap(cluster => [
            byCluster?.get(cluster)?.rawNeed || 0,
            byCluster?.get(cluster)?.quantity || 0
          ]),
          quantity
        ]);
        excelRow.getCell(header.length).font = { bold: true };
        excelRow.getCell(1).numFmt = "@";
        if (entries.some(x => x.errors.length > 0)) {
          excelRow.eachCell(cell => cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE5DA" } });
        }
      }
      matrix.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
      matrix.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
      const total = matrix.addRow([
        "ИТОГО", "", "", "", plan.totals.rawNeed,
        ...clusterNames.flatMap(cluster => {
          const c = plan.clusters.find(x => x.name === cluster);
          return [c?.rawNeed || 0, c?.proposedUnits || 0];
        }),
        plan.totals.units
      ]);
      total.eachCell(cell => { cell.font = { bold: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAF5" } }; });
      // Проверяем итоги при построении, чтобы количество в шаблоне и по кластерам совпадало.
      const control = clusterNames.reduce((sum, cluster) =>
        sum + (plan.clusters.find(c => c.name === cluster)?.proposedUnits || 0), 0);
      if (control !== plan.totals.units || plan.items.reduce((sum, x) => sum + x.quantity, 0) !== control) {
        throw new Error("Ошибка согласования: сумма по кластерам не совпадает с общим количеством");
      }
      const detail = workbook.addWorksheet("Расчёт по кластерам");
      detail.columns = [
        { header: "Кластер", key: "cluster", width: 23 },
        { header: "Ваш SKU", key: "sku", width: 32 },
        { header: "Товар", key: "product", width: 52 },
        { header: "ЕНОТ", key: "master", width: 18 },
        { header: "Продано за 28 дней", key: "sold", width: 24 },
        { header: "Остаток", key: "stock", width: 18 },
        { header: "Дней запаса", key: "days", width: 18 },
        { header: "Потребность", key: "need", width: 19 },
        { header: "Вложимость", key: "pack", width: 19 },
        { header: "Коробов", key: "cartons", width: 17 },
        { header: "К поставке", key: "qty", width: 18 },
        { header: "Проблема", key: "error", width: 52 }
      ];
      detail.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      detail.getRow(1).eachCell(cell => { cell.fill = bg; cell.alignment = { wrapText: true }; });
      detail.getRow(1).height = 30;
      for (const x of plan.allocations) {
        detail.addRow({
          cluster: x.cluster, sku: x.offerId, product: x.name, master: x.masterCode,
          sold: x.sales28, stock: x.stock,
          days: x.sales28 > 0 ? +(x.stock / (x.sales28 / 28)).toFixed(2) : null,
          need: x.rawNeed, pack: x.pack,
          cartons: x.cartons, qty: x.quantity, error: x.errors.join("; ")
        });
      }
      detail.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 12 } };
      detail.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
      const summary = workbook.addWorksheet("Итоги кластеров");
      summary.columns = [
        { header: "Кластер", key: "cluster", width: 27 },
        { header: "Продажи за 28 дней", key: "sales", width: 27 },
        { header: "Остаток", key: "stock", width: 17 },
        { header: "Нужно", key: "need", width: 19 },
        { header: "К поставке", key: "qty", width: 20 },
        { header: "Коробов", key: "cartons", width: 17 },
        { header: "Позиций с потребностью", key: "articles", width: 28 },
        { header: "Склады в кластере (ID)", key: "warehouses", width: 33 }
      ];
      summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      summary.getRow(1).eachCell(cell => { cell.fill = bg; cell.alignment = { wrapText: true }; });
      summary.getRow(1).height = 32;
      for (const c of plan.clusters.filter(x => plan.selectedClusters.includes(x.name))) {
        summary.addRow({
          cluster: c.name, sales: c.sales28, stock: c.stock, need: c.rawNeed,
          qty: c.proposedUnits, cartons: c.cartons, articles: c.articles,
          warehouses: c.warehouseIds.join(", ")
        });
      }
      summary.addRow({ cluster: "ИТОГО", qty: control, cartons: plan.totals.cartons, need: plan.totals.rawNeed });
      summary.getRow(summary.rowCount).font = { bold: true };
      const rejections = workbook.addWorksheet("Недоступно на складах");
      rejections.columns = [
        { header: "Кластер", key: "cluster", width: 24 },
        { header: "Ваш SKU", key: "sku", width: 45 },
        { header: "Нужно", key: "need", width: 18 },
        { header: "Продано за 28 дней", key: "sales", width: 24 },
        { header: "Остаток", key: "stock", width: 17 },
        { header: "Причина", key: "reason", width: 75 }
      ];
      rejections.getRow(1).font = { bold: true };
      for (const x of plan.excluded) rejections.addRow({ cluster: x.cluster, sku: x.offerId, need: x.rawNeed, sales: x.sales28, stock: x.stock, reason: x.reason });
      const unconfirmed = workbook.addWorksheet("Не прошли проверку");
      unconfirmed.columns = [
        { header: "Кластер", key: "cluster", width: 24 },
        { header: "Ваш SKU", key: "sku", width: 45 },
        { header: "Нужно", key: "need", width: 18 },
        { header: "Причины", key: "errors", width: 88 }
      ];
      unconfirmed.getRow(1).font = { bold: true };
      for (const x of plan.allocations.filter(x => x.errors.length > 0)) {
        unconfirmed.addRow({ cluster: x.cluster, sku: x.offerId, need: x.rawNeed, errors: x.errors.join("; ") });
      }
      const note = workbook.addWorksheet("Как использовать");
      note.getColumn(1).width = 115;
      [
        "ПЛАНОВЫЙ ФАЙЛ, НЕ ПРЕДНАЗНАЧЕН ДЛЯ ЗАГРУЗКИ В ЯНДЕКС МАРКЕТ.",
        "«Поставка» содержит общую сумму товаров из всех выбранных кластеров.",
        "«По кластерам» показывает количество каждого товара по конкретным кластерам.",
        "«Расчёт по кластерам» показывает продажи за 28 дней, остатки, покрытие и округление до коробов.",
        "Для загрузки в кабинет ЯМ скачайте отдельный «Excel для загрузки» из сайта.",
        "Официальный шаблон ЯМ не умеет принимать заданные количества по кластерам: Яндекс пересчитает распределение.",
        "После загрузки сравните распределение Яндекса с нашим планом и исправьте его вручную.",
        "Кластеры определены по складам отгрузки, а не по регионам покупателей; для точной географии нужна отдельная выгрузка ЯМ.",
        "Лист «Недоступно на складах»: спрос есть, но Яндекс подтвердил запрет на проверенные склады.",
        "Лист «Не прошли проверку»: спрос есть, но нет полного подтверждения допуска/реквизитов.",
        "Доступность в проверочном файле может отличаться от фактической приёмки при другом количестве или дате. Перепроверьте после загрузки реальной поставки."
      ].forEach((value, idx) => note.getCell(idx + 1, 1).value = value);
      note.getRow(1).font = { bold: true, color: { argb: "FFD8463D" } };
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buffer) as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="yandex-' + (input.mode === "upload" ? "upload" : "cluster-plan") + "-" + date + '.xlsx"',
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка экспорта" }, { status: 500 });
  }
}
