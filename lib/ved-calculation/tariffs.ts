import type { VedCalculationInput } from "./engine";

export type VedTariffKey =
  | "cnyRub" | "eurRub" | "usableVolumeM3" | "maxPayloadKg"
  | "freightBeforeBorderRub" | "freightAfterBorderRub" | "bankCommissionRub"
  | "brokerServicesRub" | "certificationRub" | "moldingRub"
  | "indirectPaymentsRub" | "additionalRub" | "otherSharedRub"
  | "otherRubPerUnit" | "dangerSurchargeBeforeRub" | "dangerSurchargeAfterRub"
  | "vatPercent" | "adValoremPercent" | "specificEurPerUnit"
  | "markingCnyPerUnit";

export type TariffRow = {
  id: number;
  tariff_key: VedTariffKey;
  effective_from: string;
  amount: number;
  reason: string;
  created_at: string;
};

export type TariffDefinition = {
  key: VedTariffKey;
  title: string;
  unit: string;
  section: "Курсы" | "Контейнер" | "Логистика" | "Разовые расходы" | "Налоги";
  group: "currency" | "container" | "expenses" | "customs" | "product";
};

/** Shared list: one source for server validation, reference editor and calculator mapping. */
export const VED_TARIFFS: readonly TariffDefinition[] = [
  {key:"cnyRub", title:"Курс CNY к RUB", unit:"₽/CNY",section:"Курсы",group:"currency"},
  {key:"eurRub", title:"Курс EUR к RUB", unit:"₽/EUR",section:"Курсы",group:"currency"},
  {key:"usableVolumeM3", title:"Рабочий объём 40HQ",unit:"м³",section:"Контейнер",group:"container"},
  {key:"maxPayloadKg",title:"Допустимая масса контейнера",unit:"кг",section:"Контейнер",group:"container"},
  {key:"freightBeforeBorderRub",title:"Перевозка до границы",unit:"₽/40HQ",section:"Логистика",group:"expenses"},
  {key:"freightAfterBorderRub",title:"Перевозка после границы",unit:"₽/40HQ",section:"Логистика",group:"expenses"},
  {key:"bankCommissionRub",title:"Банковские расходы",unit:"₽/40HQ",section:"Логистика",group:"expenses"},
  {key:"otherSharedRub",title:"Прочие общие расходы",unit:"₽/40HQ",section:"Логистика",group:"expenses"},
  {key:"dangerSurchargeBeforeRub",title:"Опасный груз: до границы",unit:"₽/40HQ",section:"Логистика",group:"expenses"},
  {key:"dangerSurchargeAfterRub",title:"Опасный груз: после границы",unit:"₽/40HQ",section:"Логистика",group:"expenses"},
  {key:"brokerServicesRub",title:"Оформление брокера",unit:"₽/сценарий",section:"Разовые расходы",group:"expenses"},
  {key:"certificationRub",title:"Сертификация",unit:"₽/артикул",section:"Разовые расходы",group:"expenses"},
  {key:"moldingRub",title:"Стоимость молдинга на MOQ",unit:"₽/MOQ",section:"Разовые расходы",group:"expenses"},
  {key:"indirectPaymentsRub",title:"Косвенные платежи",unit:"₽/сценарий",section:"Разовые расходы",group:"expenses"},
  {key:"additionalRub",title:"Дополнительные расходы",unit:"₽/сценарий",section:"Разовые расходы",group:"expenses"},
  {key:"otherRubPerUnit",title:"Прочие на единицу",unit:"₽/шт.",section:"Разовые расходы",group:"expenses"},
  {key:"vatPercent",title:"НДС при ввозе",unit:"%",section:"Налоги",group:"customs"},
  {key:"adValoremPercent",title:"Пошлина адвалорная",unit:"%",section:"Налоги",group:"customs"},
  {key:"specificEurPerUnit",title:"Пошлина специфическая",unit:"EUR/ед.",section:"Налоги",group:"customs"},
  {key:"markingCnyPerUnit",title:"Маркировка (F14)",unit:"CNY/шт.",section:"Разовые расходы",group:"product"},
] as const;

export const VED_TARIFF_KEYS = new Set<string>(VED_TARIFFS.map(t => t.key));

export function isValidTariffDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
}
export function resolveTariffs(rows: readonly TariffRow[], asOf: string): Partial<Record<VedTariffKey, TariffRow>> {
  const result: Partial<Record<VedTariffKey, TariffRow>> = {};
  for (const row of [...rows].sort((a,b) =>
    b.effective_from.localeCompare(a.effective_from) ||
    b.id - a.id)) {
    if (row.effective_from <= asOf && VED_TARIFF_KEYS.has(row.tariff_key) && !result[row.tariff_key]) {
      result[row.tariff_key] = row;
    }
  }
  return result;
}
export function applyTariffValues(
  source: VedCalculationInput,
  resolved: Partial<Record<VedTariffKey, TariffRow>>,
): VedCalculationInput {
  const next: VedCalculationInput = {
    product: {...source.product}, currency:{...source.currency},
    container:{...source.container}, expenses:{...source.expenses}, customs:{...source.customs},
  };
  for (const item of VED_TARIFFS) {
    const row = resolved[item.key];
    if (row) {
      const group = next[item.group] as unknown as Record<string, number | string | boolean | undefined>;
      group[item.key] = Number(row.amount);
    }
  }
  return next;
}
