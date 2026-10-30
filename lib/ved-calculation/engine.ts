/**
 * Preliminary management model for mixed 40HQ shipments.
 * All tariff values are supplied by the caller; no legal rates are hardcoded.
 * This is NOT a customs declaration calculator.
 */
export type DutyMode = "ad-valorem" | "specific" | "combined-max" | "combined-sum";
export type SpecificDutyUnit = "gross-kg" | "net-kg" | "item";
export type ScenarioId = "40hq" | "moq" | "one-cbm";
export type CustomsFeeMode = "schedule" | "manual";

/** Ordinary import fee brackets, RF Government Decree 1637.
 * https://www.consultant.ru/document/cons_doc_LAW_491874/
 * Upper bounds are inclusive. Special declarations/codes require manual review.
 */
export const ORDINARY_IMPORT_FEE_SCHEDULES = {
  2025: [
    [200000, 1067], [450000, 2134], [1200000, 4269],
    [2700000, 11746], [4200000, 16524], [5500000, 21344],
    [7000000, 27540], [Infinity, 30000],
  ],
  2026: [
    [200000, 1231], [450000, 2462], [1200000, 4924],
    [2700000, 13541], [4200000, 18465], [5500000, 21344],
    [10000000, 49240], [Infinity, 73860],
  ],
} as const;

export function ordinaryImportCustomsFee(customsValueRub: number, year: 2025 | 2026): number {
  if (!Number.isFinite(customsValueRub) || customsValueRub < 0) {
    throw new VedInputError(["Таможенная стоимость для сбора должна быть неотрицательной"]);
  }
  const bracket = ORDINARY_IMPORT_FEE_SCHEDULES[year].find(([limit]) => customsValueRub <= limit);
  if (!bracket) throw new VedInputError(["Не удалось определить ступень сбора"]);
  return bracket[1];
}

export interface VedCalculationInput {
  product: {
    unitPriceCny: number;
    unitsPerCarton: number;
    cartonVolumeM3: number;
    cartonGrossKg: number;
    cartonNetKg?: number;
    moqUnits: number;
    /** F14 of workbook: per-unit price surcharge in CNY. */
    markingCnyPerUnit?: number;
  };
  currency: { cnyRub: number; eurRub: number };
  container: { usableVolumeM3: number; maxPayloadKg?: number };
  expenses: {
    freightBeforeBorderRub: number;
    freightAfterBorderRub: number;
    bankCommissionRub: number;
    brokerServicesRub: number;
    customsOperationsFeeRub: number;
    otherSharedRub: number;
    otherRubPerUnit: number;
    refundableSecurityRub: number;
    /** Full one-time certification charge, on each preliminary SKU scenario. */
    certificationRub?: number;
    /** Total tooling cost allocated across MOQ, per piece in every scenario. */
    moldingRub?: number;
    /** Fixed manual amounts on every scenario, as in workbook rows 12/13. */
    indirectPaymentsRub?: number;
    additionalRub?: number;
    /** +60k to each transport leg before volume allocation, if enabled. */
    dangerousCargo?: boolean;
    dangerSurchargeBeforeRub?: number;
    dangerSurchargeAfterRub?: number;
  };
  customs: {
    dutyMode: DutyMode;
    adValoremPercent: number;
    specificEurPerUnit: number;
    specificUnit: SpecificDutyUnit;
    vatPercent: number;
    includeFreightBeforeBorderInCustomsBase: boolean;
    importVatRecoverable: boolean;
    feeMode?: CustomsFeeMode;
    /** YYYY-MM-DD for rate selection; only 2025/2026 schedules are included. */
    feeDate?: string;
  };
}

export interface VedScenarioResult {
  id: ScenarioId;
  units: number;
  theoreticalCartons: number;
  volumeM3: number;
  grossKg: number;
  containerEquivalent: number;
  goodsRub: number;
  markingRub: number;
  moldingRub: number;
  certificationRub: number;
  indirectPaymentsRub: number;
  additionalRub: number;
  freightBeforeBorderRub: number;
  freightAfterBorderRub: number;
  bankCommissionRub: number;
  brokerServicesRub: number;
  customsOperationsFeeRub: number;
  customsFeeSource: "schedule-2025" | "schedule-2026" | "manual";
  otherSharedRub: number;
  otherPerUnitRub: number;
  customsValueEstimateRub: number;
  adValoremDutyRub: number;
  specificDutyRub: number;
  dutyRub: number;
  importVatRub: number;
  totalCostIncludingVatRub: number;
  managementCostRub: number;
  managementCostPerUnitRub: number;
  cashRequirementRub: number;
  refundableSecurityRub: number;
  warnings: string[];
}

export interface VedCalculationResult {
  scenarios: Record<ScenarioId, VedScenarioResult>;
  averageCostPerUnitRub: number;
  feasibility: {
    maxWholeCartons40hq: number;
    maxWholeUnits40hq: number;
    moqRequiredWholeCartons: number;
    moqRealVolumeM3: number;
    minContainersByVolume: number | null;
    minContainersByWeight: number | null;
    estimatedMinContainers: number | null;
  };
  warnings: string[];
}

export class VedInputError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("; "));
    this.name = "VedInputError";
  }
}

const positive = (value: number): boolean => Number.isFinite(value) && value > 0;
const nonnegative = (value: number): boolean => Number.isFinite(value) && value >= 0;
const dutyModes: DutyMode[] = ["ad-valorem", "specific", "combined-max", "combined-sum"];
const specificUnits: SpecificDutyUnit[] = ["gross-kg", "net-kg", "item"];

export function validateVedInput(input: VedCalculationInput): string[] {
  const errors: string[] = [];
  const needPositive: Array<[string, number]> = [
    ["Цена товара CNY", input.product.unitPriceCny],
    ["Штук в коробке", input.product.unitsPerCarton],
    ["Объём коробки", input.product.cartonVolumeM3],
    ["Вес брутто коробки", input.product.cartonGrossKg],
    ["MOQ", input.product.moqUnits],
    ["Курс CNY", input.currency.cnyRub],
    ["Курс EUR", input.currency.eurRub],
    ["Рабочий объём контейнера", input.container.usableVolumeM3],
  ];
  for (const [label, value] of needPositive) if (!positive(value)) errors.push(label + ": требуется положительное число");
  if (input.product.unitsPerCarton % 1 !== 0) errors.push("Штук в коробке: требуется целое число");
  if (input.product.cartonNetKg !== undefined && !positive(input.product.cartonNetKg)) errors.push("Вес нетто коробки: требуется положительное число");
  if (input.container.maxPayloadKg !== undefined && !positive(input.container.maxPayloadKg)) errors.push("Грузоподъёмность контейнера: требуется положительное число");
  if (positive(input.product.cartonNetKg ?? 0) && positive(input.product.cartonGrossKg) && input.product.cartonNetKg! > input.product.cartonGrossKg) {
    errors.push("Вес нетто коробки превышает брутто");
  }
  for (const [field, value] of Object.entries(input.expenses)) {
    if (typeof value === "boolean") continue;
    if (typeof value !== "number" || !nonnegative(value)) errors.push(field + ": требуется неотрицательное число");
  }
  if (input.product.markingCnyPerUnit !== undefined && !nonnegative(input.product.markingCnyPerUnit)) {
    errors.push("Стоимость маркировки, CNY: требуется неотрицательное число");
  }
  if (input.customs.feeMode !== undefined && !["schedule", "manual"].includes(input.customs.feeMode)) {
    errors.push("Неизвестный режим таможенного сбора");
  }
  if (input.customs.feeDate !== undefined) {
    const date = input.customs.feeDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date) errors.push("Неверная дата ставки таможенного сбора");
    else if ((input.customs.feeMode ?? "schedule") === "schedule" && !["2025", "2026"].includes(date.slice(0, 4))) {
      errors.push("Для автоматической шкалы доступны 2025 и 2026 годы; для других дат выберите ручной сбор");
    }
  }
  for (const [field, value] of [
    ["Процентная пошлина", input.customs.adValoremPercent],
    ["Специфическая пошлина", input.customs.specificEurPerUnit],
    ["НДС", input.customs.vatPercent],
  ] as Array<[string, number]>) if (!nonnegative(value)) errors.push(field + ": требуется неотрицательное число");
  if (!dutyModes.includes(input.customs.dutyMode)) errors.push("Неизвестный тип пошлины");
  if (!specificUnits.includes(input.customs.specificUnit)) errors.push("Неизвестная единица специфической пошлины");
  if (input.customs.dutyMode !== "ad-valorem" && input.customs.specificUnit === "net-kg" && !positive(input.product.cartonNetKg ?? 0)) {
    errors.push("Для специфической пошлины по весу нетто требуется вес нетто коробки");
  }
  return errors;
}

function scenario(input: VedCalculationInput, id: ScenarioId, units: number): VedScenarioResult {
  const { product: p, currency: rates, container: c, expenses: e, customs: t } = input;
  const theoreticalCartons = units / p.unitsPerCarton;
  const volumeM3 = theoreticalCartons * p.cartonVolumeM3;
  const grossKg = theoreticalCartons * p.cartonGrossKg;
  const ratio = volumeM3 / c.usableVolumeM3;
  const markingRub = units * (p.markingCnyPerUnit ?? 0) * rates.cnyRub;
  const goodsRub = units * p.unitPriceCny * rates.cnyRub + markingRub;
  const moldingRub = (e.moldingRub ?? 0) / p.moqUnits * units;
  const certificationRub = e.certificationRub ?? 0;
  const indirectPaymentsRub = e.indirectPaymentsRub ?? 0;
  const additionalRub = e.additionalRub ?? 0;
  const dangerBefore = e.dangerousCargo ? e.dangerSurchargeBeforeRub ?? 60000 : 0;
  const dangerAfter = e.dangerousCargo ? e.dangerSurchargeAfterRub ?? 60000 : 0;
  const freightBeforeBorderRub = (e.freightBeforeBorderRub + dangerBefore) * ratio;
  const freightAfterBorderRub = (e.freightAfterBorderRub + dangerAfter) * ratio;
  const bankCommissionRub = e.bankCommissionRub * ratio;
  // B8/C8/D8 of workbook: the same fixed broker amount on EACH scenario.
  const brokerServicesRub = e.brokerServicesRub;
  const otherSharedRub = e.otherSharedRub * ratio;
  const otherPerUnitRub = e.otherRubPerUnit * units;
  const customsValueEstimateRub = goodsRub + (t.includeFreightBeforeBorderInCustomsBase ? freightBeforeBorderRub : 0);
  const feeMode = t.feeMode ?? "schedule";
  const feeYear = Number((t.feeDate ?? "2026-10-30").slice(0, 4)) as 2025 | 2026;
  const customsOperationsFeeRub = feeMode === "manual"
    ? e.customsOperationsFeeRub
    : ordinaryImportCustomsFee(customsValueEstimateRub, feeYear);
  const customsFeeSource: VedScenarioResult["customsFeeSource"] = feeMode === "manual"
    ? "manual" : feeYear === 2025 ? "schedule-2025" : "schedule-2026";
  const adValoremDutyRub = customsValueEstimateRub * t.adValoremPercent / 100;
  const specificBase = t.specificUnit === "item"
    ? units
    : t.specificUnit === "net-kg"
      ? theoreticalCartons * (p.cartonNetKg ?? 0)
      : grossKg;
  const specificDutyRub = specificBase * t.specificEurPerUnit * rates.eurRub;
  const dutyRub = t.dutyMode === "ad-valorem" ? adValoremDutyRub
    : t.dutyMode === "specific" ? specificDutyRub
      : t.dutyMode === "combined-max" ? Math.max(adValoremDutyRub, specificDutyRub)
        : adValoremDutyRub + specificDutyRub;
  const importVatRub = (customsValueEstimateRub + dutyRub) * t.vatPercent / 100;
  const totalCostIncludingVatRub =
    goodsRub + freightBeforeBorderRub + freightAfterBorderRub +
    bankCommissionRub + brokerServicesRub + customsOperationsFeeRub +
    otherSharedRub + otherPerUnitRub + dutyRub + importVatRub +
    moldingRub + certificationRub + indirectPaymentsRub + additionalRub;
  const refundableSecurityRub = e.refundableSecurityRub * ratio;
  const managementCostRub = totalCostIncludingVatRub - (t.importVatRecoverable ? importVatRub : 0);
  const warnings: string[] = [];
  if (id === "moq" && volumeM3 > c.usableVolumeM3) warnings.push("MOQ превышает рабочий объём одного 40HQ: расчёт отражает эквивалент нескольких контейнеров.");
  if (c.maxPayloadKg !== undefined && grossKg > c.maxPayloadKg) warnings.push("Масса партии превышает разрешённую грузоподъёмность одного 40HQ.");
  if (id === "40hq" && theoreticalCartons < 1) warnings.push("Одна коробка превышает расчётный объём 40HQ: сценарий теоретический, физическая погрузка невозможна.");
  return {
    id, units, theoreticalCartons, volumeM3, grossKg, containerEquivalent: ratio,
    goodsRub, markingRub, moldingRub, certificationRub, indirectPaymentsRub, additionalRub,
    freightBeforeBorderRub, freightAfterBorderRub,
    bankCommissionRub, brokerServicesRub, customsOperationsFeeRub, customsFeeSource,
    otherSharedRub, otherPerUnitRub, customsValueEstimateRub,
    adValoremDutyRub, specificDutyRub, dutyRub, importVatRub,
    totalCostIncludingVatRub, managementCostRub,
    managementCostPerUnitRub: managementCostRub / units,
    cashRequirementRub: totalCostIncludingVatRub + refundableSecurityRub,
    refundableSecurityRub, warnings,
  };
}

/**
 * For forecasting only: excludes real-world packing geometry, tariff brackets,
 * excise, special fee rules, permits and documentary verification. Rounding to whole boxes is
 * kept separate from the theoretical management economics.
 */
export function calculateVed(input: VedCalculationInput): VedCalculationResult {
  const issues = validateVedInput(input);
  if (issues.length) throw new VedInputError(issues);
  const { product: p, container: c } = input;
  const full = scenario(input, "40hq", c.usableVolumeM3 / p.cartonVolumeM3 * p.unitsPerCarton);
  const moq = scenario(input, "moq", p.moqUnits);
  const one = scenario(input, "one-cbm", 1 / p.cartonVolumeM3 * p.unitsPerCarton);
  const volumeLimit = c.usableVolumeM3 / p.cartonVolumeM3;
  const weightLimit = c.maxPayloadKg === undefined ? Infinity : c.maxPayloadKg / p.cartonGrossKg;
  const maxWholeCartons40hq = Math.max(0, Math.floor(Math.min(volumeLimit, weightLimit)));
  const moqRequiredWholeCartons = Math.ceil(p.moqUnits / p.unitsPerCarton);
  const moqRealVolumeM3 = moqRequiredWholeCartons * p.cartonVolumeM3;
  const fitsCarton = p.cartonVolumeM3 <= c.usableVolumeM3 &&
    (c.maxPayloadKg === undefined || p.cartonGrossKg <= c.maxPayloadKg);
  const minContainersByVolume = fitsCarton ? Math.ceil(moqRealVolumeM3 / c.usableVolumeM3) : null;
  const minContainersByWeight = !fitsCarton || c.maxPayloadKg === undefined
    ? null : Math.ceil(moqRequiredWholeCartons * p.cartonGrossKg / c.maxPayloadKg);
  // Lower bound only: does not solve 3D packing or mixed-container arrangement.
  const estimatedMinContainers = !fitsCarton ? null : Math.max(minContainersByVolume!, minContainersByWeight ?? 1);
  const warnings: string[] = [
    "Предварительный управленческий расчёт. Тарифы, таможенная стоимость и код ТН ВЭД требуют подтверждения.",
    "Проверка целых коробок не гарантирует фактическую геометрическую загрузку контейнера.",
    "Таможенный сбор: оценочная ступень отдельного сценария, а не сбор по неизвестной смешанной декларации.",
    "Особые ставки таможенного сбора, коды ТН ВЭД и таможенная стоимость требуют проверки ВЭД.",
  ];
  if (!fitsCarton) warnings.push("Одна транспортная коробка не помещается в 40HQ по объёму или весу. Требуется уточнение упаковки или способа перевозки.");
  if (moqRequiredWholeCartons * p.unitsPerCarton !== p.moqUnits) warnings.push("MOQ не кратен количеству штук в коробке: для физического заказа потребуется округление.");
  if (p.cartonNetKg === undefined) warnings.push("Вес нетто не указан: для ряда кодов ТН ВЭД он может быть обязательным.");
  if (!Number.isFinite(full.managementCostPerUnitRub) || !Number.isFinite(moq.managementCostPerUnitRub) || !Number.isFinite(one.managementCostPerUnitRub)) {
    throw new VedInputError(["Слишком большие исходные числа: результат расчёта не является конечным числом"]);
  }
  return {
    scenarios: { "40hq": full, moq, "one-cbm": one },
    averageCostPerUnitRub: (full.managementCostPerUnitRub + moq.managementCostPerUnitRub) / 2,
    feasibility: {
      maxWholeCartons40hq,
      maxWholeUnits40hq: maxWholeCartons40hq * p.unitsPerCarton,
      moqRequiredWholeCartons, moqRealVolumeM3,
      minContainersByVolume, minContainersByWeight, estimatedMinContainers,
    },
    warnings,
  };
}
