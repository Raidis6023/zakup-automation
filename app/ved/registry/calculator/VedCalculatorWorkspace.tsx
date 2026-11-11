"use client";

import { DateField } from "@/app/ui/WorkspaceDateFields";
import {useMemo} from "react";
import {
  calculateVed, VedInputError,
  type VedCalculationInput,type VedScenarioResult,
  type DutyMode,type SpecificDutyUnit,
} from "@/lib/ved-calculation/engine";

const money=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n);
const number=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:3}).format(n);

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
      <span>Товар с маркировкой: {money(result.goodsRub)} ₽</span>
      <span>Логистика: {money(result.freightBeforeBorderRub + result.freightAfterBorderRub)} ₽</span>
      <span>Пошлина: {money(result.dutyRub)} ₽</span>
      <span>НДС при ввозе: {money(result.importVatRub)} ₽</span>
      <span>Сбор ({result.customsFeeSource === "manual" ? "вручную" : result.customsFeeSource.slice(-4)}): {money(result.customsOperationsFeeRub)} ₽</span>
      <span>Оформление брокера: {money(result.brokerServicesRub)} ₽</span>
      <span>Сертификация: {money(result.certificationRub)} ₽</span>
      <span>Молдинг: {money(result.moldingRub)} ₽</span>
      <span>Косвенные: {money(result.indirectPaymentsRub)} ₽</span>
      <span>Дополнительные: {money(result.additionalRub)} ₽</span>
      <span>Денежная потребность: {money(result.cashRequirementRub)} ₽</span>
    </div>
    {result.warnings.map(message => <p className="ved-calc-warning" key={message}>{message}</p>)}
  </div>;
}


export function VedCalculatorWorkspace({
 input,onChange,onReset,
}:{
 input:VedCalculationInput;
 onChange:(group:keyof VedCalculationInput,key:string,value:number|boolean|string|undefined)=>void;
 onReset?:()=>void;
}){
 const update=onChange;
 const updateCartonDimension=(field:"cartonLengthCm"|"cartonWidthCm"|"cartonHeightCm",value?:number)=>{
   update("product",field,value);
 };
 const preview=useMemo(()=>{
  try{return {data:calculateVed(input),errors:[] as string[]};}
  catch(e){return {data:null,errors:e instanceof VedInputError?e.issues:["Ошибка расчёта, проверьте параметры"]};}
 },[input]);
 const p=input.product,c=input.container,r=input.currency,e=input.expenses,t=input.customs;
 const nf=(group:keyof VedCalculationInput,key:string,title:string,value?:number)=>
   <NumberField key={group+key} title={title} value={value} change={v=>update(group,key,v)}/>;
 const tf=(field:keyof VedCalculationInput["product"],label:string,value?:string,maxLength=160)=>
   <label className="ved-calc-field" key={field}><span>{label}</span>
     <input type="text" maxLength={maxLength} value={value||""}
       onChange={event=>update("product",field,event.target.value)}/>
   </label>;
 return (
    <div className="ved-calc-layout">
      <section className="ved-calc-editor" aria-label="Исходные данные">
        <details className="ved-calc-section">
          <summary>Товар, упаковка и MOQ</summary>
          <div className="ved-calc-fields">
            {tf("productName","Наименование товара для Excel",p.productName)}
            {tf("tnVedCode","Код ТН ВЭД",p.tnVedCode,10)}
            {tf("incoterm","Условие поставки (FOB / FCA / другое)",p.incoterm,24)}
            {tf("departurePort","Порт / место отправления",p.departurePort,120)}
            {nf("product", "unitPriceCny", "Цена за штуку, CNY", p.unitPriceCny)}
            {nf("product", "unitsPerCarton", "Штук в коробке", p.unitsPerCarton)}
            {nf("product", "cartonVolumeM3", "Объём коробки, м³", p.cartonVolumeM3)}
            {(["cartonLengthCm","cartonWidthCm","cartonHeightCm"] as const).map((field,i)=>
              <NumberField key={field} title={["Длина короба, см","Ширина короба, см","Высота короба, см"][i]}
                value={p[field]} change={v=>updateCartonDimension(field,v)}/>
            )}
            <p className="ved-calc-hint ved-calc-fields-hint">Если указать все три габарита коробки, объём рассчитается автоматически. При наличии только объёма габариты в Excel остаются пустыми.</p>
            {nf("product","individualLengthCm","Длина индивидуальной упаковки, см",p.individualLengthCm)}
            {nf("product","individualWidthCm","Ширина индивидуальной упаковки, см",p.individualWidthCm)}
            {nf("product","individualHeightCm","Высота индивидуальной упаковки, см",p.individualHeightCm)}
            {nf("product", "cartonGrossKg", "Вес брутто коробки, кг", p.cartonGrossKg)}
            {nf("product", "cartonNetKg", "Вес нетто коробки, кг (если есть)", p.cartonNetKg)}
            {nf("product", "moqUnits", "MOQ, штук", p.moqUnits)}
            {nf("product", "markingCnyPerUnit", "Маркировка на 1 шт. (F14), CNY", p.markingCnyPerUnit)}
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
          <summary>Логистика и расходы, распределяемые по объёму</summary>
          <div className="ved-calc-fields">
            {nf("expenses", "freightBeforeBorderRub", "Перевозка до границы, ₽", e.freightBeforeBorderRub)}
            {nf("expenses", "freightAfterBorderRub", "Перевозка после границы, ₽", e.freightAfterBorderRub)}
            {nf("expenses", "bankCommissionRub", "Банковские расходы, ₽", e.bankCommissionRub)}
            {nf("expenses", "otherSharedRub", "Общие расходы на контейнер, ₽", e.otherSharedRub)}

          </div>
        </details>
        <details className="ved-calc-section">
          <summary>Разовые и дополнительные расходы</summary>
          <div className="ved-calc-fields">
            {nf("expenses", "brokerServicesRub", "Брокер: полная сумма на сценарий, ₽", e.brokerServicesRub)}
            {nf("expenses", "certificationRub", "Сертификация: полная сумма, ₽", e.certificationRub)}
            {nf("expenses", "moldingRub", "Молдинг: сумма на весь MOQ, ₽", e.moldingRub)}
            {nf("expenses", "indirectPaymentsRub", "Косвенные платежи: фиксированно, ₽", e.indirectPaymentsRub)}
            {nf("expenses", "additionalRub", "Дополнительные (вкл. обеспечение), ₽", e.additionalRub)}
            {nf("expenses", "otherRubPerUnit", "Прочие затраты на 1 шт., ₽", e.otherRubPerUnit)}
          </div>
          <label className="ved-calc-check">
            <input type="checkbox" checked={Boolean(e.dangerousCargo)}
              onChange={event => update("expenses", "dangerousCargo", event.target.checked)} />
            <span>Опасный груз: добавить отдельные надбавки до и после границы</span>
          </label>
          {e.dangerousCargo && <div className="ved-calc-fields">
            {nf("expenses", "dangerSurchargeBeforeRub", "Надбавка до границы, ₽", e.dangerSurchargeBeforeRub)}
            {nf("expenses", "dangerSurchargeAfterRub", "Надбавка после границы, ₽", e.dangerSurchargeAfterRub)}
          </div>}
          <p className="ved-calc-hint">Разовые суммы не распределяются по объёму в первоначальном расчёте. Молдинг распределяется на MOQ. Обеспечение, внесённое в дополнительные расходы, не дублируйте.</p>
        </details>
        <details className="ved-calc-section">
          <summary>Таможенные параметры и сбор</summary>
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
            <label className="ved-calc-field">
              <span>Режим таможенного сбора</span>
              <select value={t.feeMode ?? "schedule"} onChange={event => update("customs", "feeMode", event.target.value)}>
                <option value="schedule">Обычная ступенчатая шкала</option>
                <option value="manual">Сумма вручную (особые случаи)</option>
              </select>
            </label>
            <label className="ved-calc-field">
              <span>Дата ставки сбора</span>
              <DateField  value={t.feeDate ?? "2026-10-30"}
                onChange={event => update("customs", "feeDate", event.target.value)} />
            </label>
            {t.feeMode === "manual" && nf("expenses", "customsOperationsFeeRub", "Ручной сбор на каждый сценарий, ₽", e.customsOperationsFeeRub)}
          </div>
          <label className="ved-calc-check"><input type="checkbox" checked={t.includeFreightBeforeBorderInCustomsBase} onChange={event => update("customs", "includeFreightBeforeBorderInCustomsBase", event.target.checked)} /><span>Включать оценочную перевозку до границы в базу для пошлины (проверить по условиям поставки)</span></label>
          <label className="ved-calc-check"><input type="checkbox" checked={t.importVatRecoverable} onChange={event => update("customs", "importVatRecoverable", event.target.checked)} /><span>Показывать управленческую себестоимость без потенциально возмещаемого НДС</span></label>
        </details>
{onReset&&<button className="ved-calc-reset" type="button" onClick={onReset}>Восстановить демонстрационные числа</button>}
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
 );
}
