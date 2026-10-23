/**
 * FBW Russia-wide supply planning. No warehouse allocation is performed here.
 * The output is an internal packing PLAN, not WB-created cargo places.
 */
export type FbwPlanItem = {
  sku: string;
  barcode: string;
  sales28Days: number;
  fbwStockRussia: number;
  inTransitToWb?: number;
  unitsPerBox: number | null;
  isFbs?: boolean;
  isDiscontinued?: boolean;
  boxVolumeM3?: number | null;
  boxWeightKg?: number | null;
};
export type FbwPlannedItem = {
  sku: string;
  barcode: string;
  dailySales: number;
  coverageDays: number | null;
  stock: number;
  inTransit: number;
  rawNeed: number;
  proposedUnits: number;
  boxes: number;
  unitsPerBox: number;
  boxVolumeM3: number | null;
  boxWeightKg: number | null;
};
export type FbwPackingUnit = {
  type: "box";
  sku: string;
  barcode: string;
  units: number;
  ordinal: number;
};
export type FbwPalletPlan = {
  palletNumber: number;
  skuCount: number;
  boxes: number;
  units: number;
  contents: { sku: string; boxes: number; units: number }[];
};
export type FbwPlan = {
  rows: FbwPlannedItem[];
  boxes: FbwPackingUnit[];
  suggestedPallets: FbwPalletPlan[];
  problems: { sku: string; reason: string }[];
  totals: { skus: number; units: number; boxes: number; suggestedPallets: number };
  notes: string[];
};
const validNonNegative = (n: number) => Number.isFinite(n) && n >= 0;
const validInteger = (n: number) => Number.isSafeInteger(n) && n >= 0;

/** Existing WB thresholds: <10 days -> 30 sales days, 10..30 -> 40 minus coverage. */
export function calculateFbwNeed(dailySales: number, availableStock: number): number {
  if (!validNonNegative(dailySales) || !validNonNegative(availableStock)) {
    throw new Error("Invalid sales or stock");
  }
  if (dailySales === 0) return 0;
  const coverage = availableStock / dailySales;
  if (coverage > 30) return 0;
  if (coverage < 10) return dailySales * 30;
  return Math.max(0, dailySales * 40 - availableStock);
}

/**
 * 3 distinct SKU per pallet is a business rule supplied by the operator.
 * Actual pallet physical capacity (dimensions/weight) is not known here.
 * These are logical groupings only; not a claim that WB will accept a pallet.
 */
export function planFbwRussia(items: FbwPlanItem[]): FbwPlan {
  const rows: FbwPlannedItem[] = [];
  const boxes: FbwPackingUnit[] = [];
  const problems: FbwPlan["problems"] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const sku = String(item.sku ?? "").trim();
    if (!sku) { problems.push({ sku: "", reason: "SKU отсутствует" }); continue; }
    if (seen.has(sku)) { problems.push({ sku, reason: "Повторный SKU: сверьте дубли до формирования заказа" }); continue; }
    seen.add(sku);
    if (item.isFbs || item.isDiscontinued) continue;
    if (!item.barcode?.trim()) { problems.push({ sku, reason: "Не указан баркод WB" }); continue; }
    if (!validInteger(item.sales28Days) || !validInteger(item.fbwStockRussia) ||
        !validInteger(item.inTransitToWb ?? 0)) {
      problems.push({ sku, reason: "Продажи, остатки и товары в пути должны быть целыми неотрицательными числами" });
      continue;
    }
    const dailySales = item.sales28Days / 28;
    const inTransit = item.inTransitToWb ?? 0;
    const available = item.fbwStockRussia + inTransit;
    const coverageDays = dailySales ? available / dailySales : null;
    const rawNeed = calculateFbwNeed(dailySales, available);
    if (rawNeed === 0) continue;
    if (!item.unitsPerBox || !Number.isSafeInteger(item.unitsPerBox) || item.unitsPerBox <= 0) {
      problems.push({ sku, reason: "Не заполнена положительная целая вложимость транспортировочного короба" });
      continue;
    }
    if (item.boxVolumeM3 != null && !validNonNegative(item.boxVolumeM3)) {
      problems.push({ sku, reason: "Некорректный объём транспортировочной коробки" }); continue;
    }
    if (item.boxWeightKg != null && !validNonNegative(item.boxWeightKg)) {
      problems.push({ sku, reason: "Некорректный вес транспортировочной коробки" }); continue;
    }
    const nBoxes = Math.ceil(rawNeed / item.unitsPerBox);
    const proposedUnits = nBoxes * item.unitsPerBox;
    // Keep huge/invalid input from allocating an unlimited boxes array.
    if (!Number.isSafeInteger(proposedUnits) || nBoxes > 10000) {
      problems.push({ sku, reason: "Количество коробов слишком велико: требуется ручная проверка" });
      continue;
    }
    rows.push({
      sku, barcode: item.barcode.trim(), dailySales, coverageDays,
      stock: item.fbwStockRussia, inTransit, rawNeed, proposedUnits,
      boxes: nBoxes, unitsPerBox: item.unitsPerBox,
      boxVolumeM3: item.boxVolumeM3 ?? null, boxWeightKg: item.boxWeightKg ?? null,
    });
    for (let i = 1; i <= nBoxes; i++) {
      boxes.push({ type: "box", sku, barcode: item.barcode.trim(), units: item.unitsPerBox, ordinal: i });
    }
  }
  // Logical pallet grouping. Physical pallet compatibility is NOT implied.
  const pallets: FbwPalletPlan[] = [];
  for (let i = 0; i < rows.length; i += 3) {
    const batch = rows.slice(i, i + 3);
    pallets.push({
      palletNumber: pallets.length + 1,
      skuCount: batch.length,
      boxes: batch.reduce((sum, x) => sum + x.boxes, 0),
      units: batch.reduce((sum, x) => sum + x.proposedUnits, 0),
      contents: batch.map(x => ({ sku: x.sku, boxes: x.boxes, units: x.proposedUnits })),
    });
  }
  return {
    rows, boxes, suggestedPallets: pallets, problems,
    totals: {
      skus: rows.length,
      units: rows.reduce((sum, x) => sum + x.proposedUnits, 0),
      boxes: boxes.length,
      suggestedPallets: pallets.length,
    },
    notes: [
      "Общая потребность по РФ, без кластеров и распределения по складам.",
      "Каждый транспортировочный короб содержит только один SKU.",
      "Паллеты являются предварительными группами по максимуму 3 SKU, а не зарегистрированными грузоместами WB.",
      "Перед созданием поставки необходимы проверка свежести продаж и остатков, выбор точки сдачи и подтверждение доступности приёмки.",
      "Для реальных паллет нужны параметры допустимой высоты, веса и размеров; план не проверяет физическую вместимость.",
    ],
  };
}
