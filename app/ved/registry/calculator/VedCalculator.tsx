"use client";

import { useMemo, useState } from "react";
import {
  calculateVed,
  type VedCalculationInput,
  type VedScenarioResult,
  type DutyMode,
  type SpecificDutyUnit,
  VedInputError,
} from "@/lib/ved-calculation/engine";

const initial: VedCalculationInput = {
  product: { unitPriceCny: 4.77, unitsPerCarton: 100, cartonVolumeM3: 0.1031745, cartonGrossKg: 16.8, moqUnits: 2000 },
  currency: { cnyRub: 13.5, eurRub: 95 },
  container: { usableVolumeM3: 68, maxPayloadKg: 26000 },
  expenses: {
    freightBeforeBorderRub: 500000, freightAfterBorderRub: 500000,
    bankCommissionRub: 10000, brokerServicesRub: 15000,
    customsOperationsFeeRub: 0, otherSharedRub: 0,
    otherRubPerUnit: 0, refundableSecurityRub: 0,
  },
  customs: {
    dutyMode: "ad-valorem", adValoremPercent: 10,
    specificEurPerUnit: 0, specificUnit: "gross-kg",
    vatPercent: 22, includeFreightBeforeBorderInCustomsBase: true,
    importVatRecoverable: false,
  },
};

const money = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
const number = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(n);

function NumberField({ title, value, change }: { title: string; value?: number; change: (next: number | undefined) => void }) {
  return <label className="ved-calc-field">
    <span>{title}</span>
    <input type="number" inputMode="decimal" step="any" min="0" value={value === undefined || !Number.isFinite(value) ? "" : value}
      onChange={event => change(event.target.value === "" ? undefined : Number(event.target.value))} />
  </label>;
}

function Result({ title, result }: { title: string; result: VedScenarioResult }) {
  return <div className="ved-calc-result">
    <div className="ved-calc-result-top">
      <strong>{title}</strong>
      <span>{number(result.units)} шт. · {number(result.volumeM3)} м³</span>
    </div>
    <div className="ved-calc-cost">{money(result.managementCostPerUnitRub)} ₽ <small>/ шт.</small></div>
    <div className="ved-calc-mini">
      <span>Товар: {money(result.goodsRub)} ₽</span>
      <span>Логистика: {money(result.freightBeforeBorderRub + result.freightAfterBorderRub)} ₽</span>
      <span>Пошлина: {money(result.dutyRub)} ₽</span>
      <span>НДС при ввозе: {money(result.importVatRub)} ₽</span>
      <span>Сбор: {money(result.customsOperationsFeeRub)} ₽</span>
      <span>Денежная потребность: {money(result.cashRequirementRub)} ₽</span>
    </div>
    {result.warnings.map(message => <p className="ved-calc-warning" key={message}>{message}</p>)}
  </div>;
}

export default function VedCalculator() {
  const [input, setInput] = useState<VedCalculationInput>(initial);
  const update = (group: keyof VedCalculationInput, field: string, value: number | boolean | string | undefined) => {
    setInput(previous => ({ ...previous, [group]: { ...previous[group], [field]: value } }));
  };
  const preview = useMemo(() => {
    try {
      return { data: calculateVed(input), errors: [] as string[] };
    } catch (error) {
      return {
        data: null,
        errors: error instanceof VedInputError ? error.issues : ["Не удалось выполнить расчёт. Проверьте введённые значения."],
      };
    }
  }, [input]);
  const p = input.product, c = input.container, r = input.currency, e = input.expenses, t = input.customs;
  const nf = (group: keyof VedCalculationInput, key: string, title: string, value?: number) =>
    <NumberField key={group + key} title={title} value={value} change={v => update(group, key, v)} />;

  return <div className="ved-calc">
    <div className="ved-calc-note">
      <strong>Черновой калькулятор, без сохранения</strong>
      <p>Загружен только пример параметров старого держателя телефона. Курсы, ставки и расходы ниже взяты как демонстрационные значения из прежних расчётов, а не как подтверждённые актуальные тарифы. Изменения не сохраняются в базе.</p>
    </div>
    <div className="ved-calc-layout">
      <section className="ved-calc-editor" aria-label="Исходные данные">
        <details className="ved-calc-section">
          <summary>Товар и MOQ</summary>
          <div className="ved-calc-fields">
            {nf("product", "unitPriceCny", "Цена за штуку, CNY", p.unitPriceCny)}
            {nf("product", "unitsPerCarton", "Штук в коробке", p.unitsPerCarton)}
            {nf("product", "cartonVolumeM3", "Объём коробки, м³", p.cartonVolumeM3)}
            {nf("product", "cartonGrossKg", "Вес брутто коробки, кг", p.cartonGrossKg)}
            {nf("product", "cartonNetKg", "Вес нетто коробки, кг (если есть)", p.cartonNetKg)}
            {nf("product", "moqUnits", "MOQ, штук", p.moqUnits)}
          </div>
        </details>
        <details className="ved-calc-section">
          <summary>Контейнер и валюты</summary>
          <div className="ved-calc-fields">
            {nf("container", "usableVolumeM3", "Рабочий объём 40HQ, м³", c.usableVolumeM3)}
            {nf("container", "maxPayloadKg", "Ограничение массы, кг (если есть)", c.maxPayloadKg)}
            {nf("currency", "cnyRub", "Курс CNY/RUB", r.cnyRub)}
            {nf("currency", "eurRub", "Курс EUR/RUB", r.eurRub)}
          </div>
        </details>
        <details className="ved-calc-section">
          <summary>Общие расходы на условный 40HQ</summary>
          <div className="ved-calc-fields">
            {nf("expenses", "freightBeforeBorderRub", "Перевозка до границы, ₽", e.freightBeforeBorderRub)}
            {nf("expenses", "freightAfterBorderRub", "Перевозка после границы, ₽", e.freightAfterBorderRub)}
            {nf("expenses", "bankCommissionRub", "Банковские расходы, ₽", e.bankCommissionRub)}
            {nf("expenses", "brokerServicesRub", "Услуги брокера, ₽", e.brokerServicesRub)}
            {nf("expenses", "customsOperationsFeeRub", "Общий сбор типовой декларации, ₽", e.customsOperationsFeeRub)}
            {nf("expenses", "otherSharedRub", "Прочие общие расходы, ₽", e.otherSharedRub)}
            {nf("expenses", "otherRubPerUnit", "Расходы на единицу товара, ₽", e.otherRubPerUnit)}
            {nf("expenses", "refundableSecurityRub", "Возвратное обеспечение, ₽", e.refundableSecurityRub)}
          </div>
        </details>
        <details className="ved-calc-section">
          <summary>Таможенные параметры (задать вручную)</summary>
          <div className="ved-calc-fields">
            <label className="ved-calc-field">
              <span>Тип ставки пошлины</span>
              <select value={t.dutyMode} onChange={event => update("customs", "dutyMode", event.target.value as DutyMode)}>
                <option value="ad-valorem">Процентная</option>
                <option value="specific">Специфическая</option>
                <option value="combined-max">Комбинированная: максимум</option>
                <option value="combined-sum">Комбинированная: сумма</option>
              </select>
            </label>
            {nf("customs", "adValoremPercent", "Пошлина, %", t.adValoremPercent)}
            {nf("customs", "specificEurPerUnit", "Специфическая ставка, EUR", t.specificEurPerUnit)}
            <label className="ved-calc-field">
              <span>Единица специфической ставки</span>
              <select value={t.specificUnit} onChange={event => update("customs", "specificUnit", event.target.value as SpecificDutyUnit)}>
                <option value="gross-kg">Килограмм брутто</option>
                <option value="net-kg">Килограмм нетто</option>
                <option value="item">Штука</option>
              </select>
            </label>
            {nf("customs", "vatPercent", "НДС при ввозе, %", t.vatPercent)}
          </div>
          <label className="ved-calc-check"><input type="checkbox" checked={t.includeFreightBeforeBorderInCustomsBase} onChange={event => update("customs", "includeFreightBeforeBorderInCustomsBase", event.target.checked)} /><span>Включать оценочную перевозку до границы в базу для пошлины (проверить по условиям поставки)</span></label>
          <label className="ved-calc-check"><input type="checkbox" checked={t.importVatRecoverable} onChange={event => update("customs", "importVatRecoverable", event.target.checked)} /><span>Показывать управленческую себестоимость без потенциально возмещаемого НДС</span></label>
        </details>
        <button className="ved-calc-reset" type="button" onClick={() => setInput(initial)}>Восстановить пример</button>
      </section>
      <section className="ved-calc-output" aria-live="polite" aria-label="Результат расчёта">
        {preview.data ? <>
          <div className="ved-calc-average">
            <span>Средняя себестоимость 40HQ и MOQ</span>
            <strong>{money(preview.data.averageCostPerUnitRub)} ₽/шт.</strong>
            <small>1 м³ в среднее не входит</small>
          </div>
          <div className="ved-calc-results">
            <Result title="Контейнер 40HQ · теоретический" result={preview.data.scenarios["40hq"]} />
            <Result title="Минимальная партия MOQ" result={preview.data.scenarios.moq} />
            <Result title="Справочный сценарий 1 м³" result={preview.data.scenarios["one-cbm"]} />
          </div>
          <div className="ved-calc-feasibility">
            <strong>Проверка целых коробок</strong>
            <p>40HQ: до {number(preview.data.feasibility.maxWholeCartons40hq)} целых коробок по объёму и указанному ограничению массы. MOQ: потребуется {number(preview.data.feasibility.moqRequiredWholeCartons)} коробок.</p>
            <p>Нижняя оценка числа контейнеров для MOQ: {preview.data.feasibility.estimatedMinContainers ?? "Невозможно определить: одна коробка не помещается"}.</p>
          </div>
          {preview.data.warnings.map(message => <p key={message} className="ved-calc-warning">{message}</p>)}
        </> : <div className="ved-calc-errors"><strong>Расчёт приостановлен</strong>{preview.errors.map(err => <p key={err}>{err}</p>)}</div>}
      </section>
    </div>
  </div>;
}
