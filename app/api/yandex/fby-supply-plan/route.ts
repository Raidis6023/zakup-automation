import ExcelJS from "exceljs";

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
type PlanResult = {
  calculatedAt: string;
  salesPeriod: string;
  stockDate: string;
  stale: boolean;
  staleReasons: string[];
  warehouses: WarehouseSummary[];
  selectedWarehouseIds: number[];
  items: NeedRow[];
  blocked: NeedRow[];
  totals: { articles: number; blocked: number; units: number; cartons: number; rawNeed: number };
  notice: string;
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

async function buildPlan(ids: number[] | null): Promise<PlanResult> {
  const [salesRuns, stockRuns, products, packing] = await Promise.all([
    dbRows<SalesRun>("yandex_sales_sync_runs", "id,date_from,date_to,created_at", { status: "eq.success", order: "created_at.desc", limit: "1" }),
    dbRows<StockRun>("yandex_stock_sync_runs", "id,snapshot_date,created_at", { status: "eq.success", order: "created_at.desc", limit: "1" }),
    dbRows<YandexProduct>("yandex_products", "offer_id,master_code,is_active,raw_data"),
    dbRows<OzonProduct>("products", "master_code,units_per_carton,is_discontinued")
  ]);
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
  const validIds = ids ? new Set(ids) : null;
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

  // Отдельный сырой план каждого склада нужен только как вход в мультипоставку.
  // Кратность коробам применяем ПОСЛЕ суммирования потребности всех складов.
  const aggregated = new Map<string, { rawNeed: number; sales28: number; stock: number }>();
  for (const [key, m] of metrics.entries()) {
    const delimiter = key.lastIndexOf("\u0000");
    const offerId = key.slice(0, delimiter);
    const warehouseId = Number(key.slice(delimiter + 1));
    const need = coverageNeed(m.sale, m.stock);
    const wh = warehouseData.get(warehouseId)!;
    wh.rawNeed += need;
    if (need > 0) wh.articles++;
    // Сводку показываем по всем складам, но итоговый Excel строим
    // только по выбранным в интерфейсе.
    if (validIds && !validIds.has(warehouseId)) continue;
    const current = aggregated.get(offerId) || { rawNeed: 0, sales28: 0, stock: 0 };
    current.rawNeed += need;
    current.sales28 += m.sale;
    current.stock += m.stock;
    aggregated.set(offerId, current);
  }

  const allOffers = new Map(products.map(p => [p.offer_id, p]));
  const items: NeedRow[] = [];
  const blocked: NeedRow[] = [];
  let rawNeedAll = 0;
  for (const [offerId, data] of aggregated) {
    if (data.rawNeed <= 0) continue;
    const product = allOffers.get(offerId);
    const masterCode = normal(product?.master_code) || null;
    const packInfo = masterCode ? packByMaster.get(masterCode) : undefined;
    if (packInfo?.discontinued || product?.is_active === false) continue;
    rawNeedAll += data.rawNeed;
    const errors: string[] = [];
    if (!product) errors.push("Нет товара в справочнике ЯМ");
    if (!masterCode) errors.push("Не задан ЕНОТ / master_code");
    if (!packInfo || packInfo.packs.size === 0) errors.push("Не задана вложимость короба");
    if (packInfo && packInfo.packs.size > 1) errors.push("Противоречивая вложимость для ЕНОТ");
    const pack = packInfo?.packs.size === 1 ? [...packInfo.packs][0] : null;
    const barcode = product ? validBarcodes(product) : "";
    if (!barcode) errors.push("Нет штрихкода");
    const name = normal(product?.raw_data?.offer?.name) || normal(product?.raw_data?.mapping?.marketSkuName);
    if (!name) errors.push("Нет наименования");
    if (offerId.length > 80) errors.push("Артикул длиннее 80 символов");
    // В точности как в текущем Ozon: половина короба или меньше = 0.
    const cartons = pack && data.rawNeed > pack / 2 ? Math.round(data.rawNeed / pack) : 0;
    const row: NeedRow = {
      offerId, name, masterCode, barcode, pack: pack || null,
      rawNeed: data.rawNeed, quantity: cartons * (pack || 0),
      cartonCount: cartons, sales28: data.sales28, stock: data.stock, errors
    };
    if (errors.length) blocked.push(row);
    else if (row.quantity > 0) items.push(row);
  }
  items.sort((a, b) => b.quantity - a.quantity || a.offerId.localeCompare(b.offerId));
  blocked.sort((a, b) => b.rawNeed - a.rawNeed);
  const warehouses = [...warehouseData.values()].sort((a, b) => b.rawNeed - a.rawNeed);
  const selectedWarehouseIds = validIds ? [...validIds] : warehouses.map(w => w.id);
  return {
    calculatedAt: new Date().toISOString(),
    salesPeriod: salesRun.date_from + " — " + salesRun.date_to,
    stockDate: stockRun.snapshot_date,
    stale: staleReasons.length > 0,
    staleReasons, warehouses, selectedWarehouseIds,
    items, blocked,
    totals: {
      articles: items.length, blocked: blocked.length,
      units: items.reduce((n, p) => n + p.quantity, 0),
      cartons: items.reduce((n, p) => n + p.cartonCount, 0),
      rawNeed: rawNeedAll
    },
    notice: "Excel содержит ОБЩЕЕ количество по выбранным складам. Яндекс распределит его по кластерам после загрузки. Настройте кластеры в кабинете Маркета и проверьте незавершённые поставки."
  };
}

function parseIds(value: unknown): number[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > 200 || value.some(x => !Number.isSafeInteger(x) || x <= 0)) throw new Error("Неверный список складов");
  return [...new Set(value as number[])];
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const ids = params.has("warehouses") ? parseIds(params.get("warehouses")?.split(",").filter(Boolean).map(Number)) : null;
    return Response.json({ ok: true, plan: await buildPlan(ids) });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка расчёта" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { warehouseIds?: number[]; allowPartial?: boolean; allowStale?: boolean };
    const plan = await buildPlan(parseIds(input.warehouseIds));
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
    // Отдельный лист с региональным планом не добавляем: Маркет принимает стандартный шаблон.
    const buffer = await workbook.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buffer) as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="yandex-multisupply-' + date + '.xlsx"',
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Ошибка экспорта" }, { status: 500 });
  }
}
