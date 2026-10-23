import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET as getFbwProcurement } from "@/app/api/wb/procurement-real/route";

type NeedRow = {
  nmId: number;
  supplierArticle: string;
  vendorCode: string | null;
  productName: string | null;
  barcode: string;
  barcodeVariantCount?: number;
  sales: { ordersCount: number; dailySales: number };
  stock: { stockCount: number };
  calculation: { needRaw: number; needRoundedUp: number; daysOfStock: number | null };
};

export type FbwPlanItem = {
  nmId: number;
  article: string;
  name: string;
  masterCode: string | null;
  sku: string;
  stock: number;
  sales28: number;
  rawNeed: number;
  pack: number | null;
  cartons: number;
  quantity: number;
  cartonSizeMm: [number, number, number] | null;
  cartonWeightKg: number | null;
  blockingReason: string | null;
  warnings: string[];
};

export type FbwPlan = {
  ok: true;
  scope: "WB FBW / вся Россия";
  calculatedAt: string;
  period: { start: string; end: string; days: number };
  stockSnapshotId: string | null;
  fingerprint: string;
  items: FbwPlanItem[];
  summary: {
    demandedSku: number;
    eligibleSku: number;
    eligibleUnits: number;
    transportCartons: number;
    blockedSku: number;
    zeroAfterPackSku: number;
    missingPackagingSku: number;
  };
  packRule: string;
  limitations: string[];
};

type Listing = {
  external_id: string;
  master_code: string | null;
  is_active: boolean;
};
type Pack = {
  master_code: string | null;
  units_per_carton: number | null;
  carton_length_mm: number | null;
  carton_width_mm: number | null;
  carton_height_mm: number | null;
  carton_weight_kg: number | null;
  is_active: boolean;
  is_discontinued: boolean;
};

export function cartonQuantity(rawNeed: number, pack: number): number {
  if (!Number.isFinite(rawNeed) || rawNeed < pack || !Number.isSafeInteger(pack) || pack <= 0) return 0;
  // Same full-carton rule as Ozon: less than one carton = 0,
  // otherwise mathematically round the number of cartons.
  return Math.max(1, Math.round(rawNeed / pack)) * pack;
}

export async function buildFbwPlan(request: NextRequest): Promise<FbwPlan> {
  // Reuse validated FBW source: excludes FBS and cancellations,
  // requires fresh 28-day orders and whole-Russia WB stock.
  const sourceResponse = await getFbwProcurement(request);
  const source = await sourceResponse.json() as {
    ok: boolean; message?: string;
    period?: {start: string; end: string; days: number};
    freshness?: {allSourcesFresh: boolean; stocks?: {snapshotId?: string}};
    allNeed?: NeedRow[];
  };
  if (!sourceResponse.ok || !source.ok || !source.freshness?.allSourcesFresh || !Array.isArray(source.allNeed)) {
    throw new Error(source.message || "Данные FBW неактуальны или расчёт потребности не прошёл проверку");
  }
  if (!source.period || source.period.days !== 28) throw new Error("Неверное 28-дневное окно WB");

  const db = createAdminClient();
  const [listingsResult, productsResult] = await Promise.all([
    db.from("marketplace_listings").select("external_id,master_code,is_active")
      .eq("marketplace","wildberries").eq("account_key","main").eq("is_active",true)
      .limit(10000),
    db.from("products").select("master_code,units_per_carton,carton_length_mm,carton_width_mm,carton_height_mm,carton_weight_kg,is_active,is_discontinued")
      .eq("is_active",true).limit(10000),
  ]);
  if (listingsResult.error) throw new Error("Сопоставление WB: " + listingsResult.error.message);
  if (productsResult.error) throw new Error("Вложимости: " + productsResult.error.message);

  const listingMap = new Map<string, Listing[]>();
  for (const x of (listingsResult.data || []) as Listing[]) {
    const key = String(x.external_id);
    listingMap.set(key, [...(listingMap.get(key) || []), x]);
  }
  const packMap = new Map<string, Pack[]>();
  for (const x of (productsResult.data || []) as Pack[]) {
    if (!x.master_code) continue;
    packMap.set(x.master_code, [...(packMap.get(x.master_code) || []), x]);
  }

  const items: FbwPlanItem[] = source.allNeed.map(n => {
    const mappings = listingMap.get(String(n.nmId)) || [];
    const distinctMaster = [...new Set(mappings.map(m => m.master_code?.trim() || "").filter(Boolean))];
    const masterCode = distinctMaster.length === 1 ? distinctMaster[0] : null;
    const products = masterCode ? packMap.get(masterCode) || [] : [];
    const active = products.filter(p => !p.is_discontinued);
    const packs = [...new Set(active.map(p => Number(p.units_per_carton)).filter(p => Number.isSafeInteger(p) && p > 0))];
    const pack = packs.length === 1 ? packs[0] : null;
    const warnings: string[] = [];
    let blockingReason: string | null = null;
    const sku = String(n.barcode || "").trim();
    if (!mappings.length) blockingReason = "Нет связи артикула WB с ЕНОТ";
    else if (distinctMaster.length !== 1) blockingReason = "Конфликт или отсутствие ЕНОТ";
    else if (!products.length || !active.length) blockingReason = "Товар ЕНОТ не найден или выведен из продажи";
    else if (!pack) blockingReason = packs.length > 1 ? "Конфликт вложимостей у ЕНОТ" : "Не заполнена вложимость транспортировочной коробки";
    else if ((n.barcodeVariantCount || 0) > 1) blockingReason = "Один nmId имеет несколько баркодов; общий FBW-остаток нельзя распределить по вариантам";
    else if (!sku) blockingReason = "Нет баркода WB (sku), номер nmId не подходит";

    const representative = active.find(x => Number(x.units_per_carton) === pack);
    const dims = representative ? [representative.carton_length_mm,representative.carton_width_mm,representative.carton_height_mm] : [];
    const size: [number,number,number] | null =
      dims.length === 3 && dims.every(x => Number.isFinite(Number(x)) && Number(x) > 0)
        ? [Number(dims[0]),Number(dims[1]),Number(dims[2])] : null;
    const weight = Number(representative?.carton_weight_kg);
    const cartonWeightKg = Number.isFinite(weight) && weight > 0 ? weight : null;
    if (!size) warnings.push("Нет всех размеров транспортировочной коробки");
    if (!cartonWeightKg) warnings.push("Нет веса транспортировочной коробки");
    const rawNeed = Math.max(0, Number(n.calculation.needRaw) || 0);
    const quantity = !blockingReason && pack ? cartonQuantity(rawNeed,pack) : 0;
    if (!blockingReason && quantity === 0) warnings.push("Потребность меньше одного полного короба");
    return {
      nmId: n.nmId, article: n.supplierArticle || n.vendorCode || String(n.nmId),
      name: n.productName || n.supplierArticle || String(n.nmId), masterCode, sku,
      stock: Math.max(0, Number(n.stock.stockCount) || 0),
      sales28: Math.max(0, Number(n.sales.ordersCount) || 0), rawNeed,
      pack, cartons: pack ? quantity / pack : 0, quantity,
      cartonSizeMm:size,cartonWeightKg,blockingReason,warnings,
    };
  });
  const eligible = items.filter(x => x.quantity > 0 && !x.blockingReason);
  return {
    ok:true,scope:"WB FBW / вся Россия",calculatedAt:new Date().toISOString(),
    period:source.period,
    stockSnapshotId:source.freshness.stocks?.snapshotId || null,
    fingerprint: createHash("sha256").update(JSON.stringify({
      periodEnd:source.period.end,
      stockSnapshotId:source.freshness.stocks?.snapshotId || null,
      goods:eligible.map(x=>[x.sku,x.quantity]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
    })).digest("hex"),
    items,
    summary:{
      demandedSku:items.length,eligibleSku:eligible.length,
      eligibleUnits:eligible.reduce((s,x)=>s+x.quantity,0),
      transportCartons:eligible.reduce((s,x)=>s+x.cartons,0),
      blockedSku:items.filter(x=>x.blockingReason).length,
      zeroAfterPackSku:items.filter(x=>!x.blockingReason && x.quantity===0).length,
      missingPackagingSku:eligible.filter(x=>x.warnings.some(w=>w.startsWith("Нет"))).length,
    },
    packRule:"Если потребность меньше одной полной коробки, к отгрузке 0; иначе математическое округление количества полных коробок.",
    limitations:[
      "WB FBW API позволяет создать и заполнить черновик, но не предоставляет запись грузомест и бронирование таймслота.",
      "Грузоместа считаются как отдельные транспортировочные короба: один баркод в одном коробе.",
      "При типах поставок с паллетами не допускайте более 3 разных баркодов на одну паллету.",
      "Для сдачи через СЦ конечный склад хранения выбирает WB; в расчёте не используется распределение по складам.",
    ],
  };
}
