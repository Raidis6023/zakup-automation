/**
 * Preliminary management model for mixed 40HQ shipments.
 * All tariff values are supplied by the caller; no legal rates are hardcoded.
 * This is NOT a customs declaration calculator.
 */
export type DutyMode = "ad-valorem" | "specific" | "combined-max" | "combined-sum";
export type SpecificDutyUnit = "gross-kg" | "net-kg" | "item";
export type ScenarioId = "40hq" | "moq" | "one-cbm";

export interface VedCalculationInput {
  product: {
    unitPriceCny: number;
    unitsPerCarton: number;
    cartonVolumeM3: number;
    cartonGrossKg: number;
    cartonNetKg?: number;
    moqUnits: number;
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
  };
  customs: {
    dutyMode: DutyMode;
    adValoremPercent: number;
    specificEurPerUnit: number;
    specificUnit: SpecificDutyUnit;
    vatPercent: number;
    includeFreightBeforeBorderInCustomsBase: boolean;
    importVatRecoverable: boolean;
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
  freightBeforeBorderRub: number;
  freightAfterBorderRub: number;
  bankCommissionRub: number;
  brokerServicesRub: number;
  customsOperationsFeeRub: number;
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
  const expensePairs = Object.entries(input.expenses) as Array<[string, number]>;
  for (const [field, value] of expensePairs) if (!nonnegative(value)) errors.push(field + ": требуется неотрицательное число");
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
  const goodsRub = units * p.unitPriceCny * rates.cnyRub;
  const freightBeforeBorderRub = e.freightBeforeBorderRub * ratio;
  const freightAfterBorderRub = e.freightAfterBorderRub * ratio;
  const bankCommissionRub = e.bankCommissionRub * ratio;
  const brokerServicesRub = e.brokerServicesRub * ratio;
  // The supplied fee is the estimated fee of a *whole mixed declaration*.
  // Never apply the legal per-declaration bracket to each SKU or to 1 m3.
  const customsOperationsFeeRub = e.customsOperationsFeeRub * ratio;
  const otherSharedRub = e.otherSharedRub * ratio;
  const otherPerUnitRub = e.otherRubPerUnit * units;
  const customsValueEstimateRub = goodsRub + (t.includeFreightBeforeBorderInCustomsBase ? freightBeforeBorderRub : 0);
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
    otherSharedRub + otherPerUnitRub + dutyRub + importVatRub;
  const refundableSecurityRub = e.refundableSecurityRub * ratio;
  const managementCostRub = totalCostIncludingVatRub - (t.importVatRecoverable ? importVatRub : 0);
  const warnings: string[] = [];
  if (id === "moq" && volumeM3 > c.usableVolumeM3) warnings.push("MOQ превышает рабочий объём одного 40HQ: расчёт отражает эквивалент нескольких контейнеров.");
  if (c.maxPayloadKg !== undefined && grossKg > c.maxPayloadKg) warnings.push("Масса партии превышает разрешённую грузоподъёмность одного 40HQ.");
  if (id === "40hq" && theoreticalCartons < 1) warnings.push("Одна коробка превышает расчётный объём 40HQ: сценарий теоретический, физическая погрузка невозможна.");
  return {
    id, units, theoreticalCartons, volumeM3, grossKg, containerEquivalent: ratio,
    goodsRub, freightBeforeBorderRub, freightAfterBorderRub,
    bankCommissionRub, brokerServicesRub, customsOperationsFeeRub,
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
 * excise, permits and documentary verification. Rounding to whole boxes is
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
