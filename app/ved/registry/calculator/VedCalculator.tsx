"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { applyTariffValues, VED_TARIFFS, type TariffRow, type VedTariffKey } from "@/lib/ved-calculation/tariffs";
import {
  calculateVed,
  type VedCalculationInput,
  type VedScenarioResult,
  type DutyMode,
  type SpecificDutyUnit,
  VedInputError,
} from "@/lib/ved-calculation/engine";

const initial: VedCalculationInput = {
  product: { productName:"",tnVedCode:"",incoterm:"FOB",departurePort:"",unitPriceCny: 4.77, unitsPerCarton: 100, cartonVolumeM3: 0.1031745, cartonGrossKg: 16.8, moqUnits: 2000, markingCnyPerUnit: 0 },
  currency: { cnyRub: 13.5, eurRub: 95 },
  container: { usableVolumeM3: 68, maxPayloadKg: 22000 },
  expenses: {
    freightBeforeBorderRub: 500000, freightAfterBorderRub: 500000,
    bankCommissionRub: 10000, brokerServicesRub: 15000,
    customsOperationsFeeRub: 0, otherSharedRub: 0,
    otherRubPerUnit: 0, refundableSecurityRub: 0,
    certificationRub: 0, moldingRub: 0, indirectPaymentsRub: 0, additionalRub: 0,
    dangerousCargo: false, dangerSurchargeBeforeRub: 60000, dangerSurchargeAfterRub: 60000,
  },
  customs: {
    dutyMode: "ad-valorem", adValoremPercent: 10,
    specificEurPerUnit: 0, specificUnit: "gross-kg",
    vatPercent: 22, includeFreightBeforeBorderInCustomsBase: true,
    importVatRecoverable: false, feeMode: "schedule", feeDate: "2026-10-30",
  },
};

type StoredCalculation = {
  id: string; calculation_id: string; title: string; article: string;
  version_no: number; calculation_date: string; created_at: string;
  input_data: VedCalculationInput;
};
type TariffResponse = {ok:boolean;error?:string;selected?:Partial<Record<VedTariffKey,TariffRow>>;canEdit?:boolean};
type SavedResponse = {ok:boolean;error?:string;items?:StoredCalculation[]};
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

export default function VedCalculator() {
  const [input, setInput] = useState<VedCalculationInput>(initial);
  const [tariffDate, setTariffDate] = useState("2026-10-30");
  useEffect(()=>{setTariffDate(new Date().toLocaleDateString("sv-SE"));},[]);
  const [resolved, setResolved] = useState<Partial<Record<VedTariffKey,TariffRow>>>({});
  const [ratesStatus, setRatesStatus] = useState("Тарифы не загружены");
  const [canEdit, setCanEdit] = useState(false);
  const [title, setTitle] = useState("Первоначальный расчёт товара");
  const [article, setArticle] = useState("");
  const [calculationId, setCalculationId] = useState<string | null>(null);
  const [history, setHistory] = useState<StoredCalculation[]>([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const loadSaved = useCallback(async () => {
    try {
      const response = await fetch("/api/ved-calculations", {cache:"no-store"});
      const json = await response.json() as SavedResponse;
      if(!response.ok || !json.ok) throw Error(json.error || "Не удалось получить версии");
      setHistory(json.items || []);
    }catch(e){setSaveMessage(e instanceof Error ? e.message : "Ошибка получения версий");}
  },[]);
  useEffect(()=>{void loadSaved();},[loadSaved]);
  useEffect(()=>{
    let active=true;
    setRatesStatus("Загрузка тарифов…");
    void (async()=>{
      try{
        const res=await fetch("/api/ved-tariffs?asOf="+encodeURIComponent(tariffDate),{cache:"no-store"});
        const json=await res.json() as TariffResponse;
        if(!res.ok||!json.ok)throw Error(json.error||"Не удалось получить справочники");
        if(!active)return;
        setResolved(json.selected || {});
        // Fresh calculations get live CBR currencies and confirmed container constants.
        // Saved snapshots must retain their own historical input values.
        if(!calculationId){
          setInput(previous=>applyTariffValues(previous,json.selected||{}));
        }
        setCanEdit(Boolean(json.canEdit));
        const count=Object.keys(json.selected||{}).length;
        setRatesStatus(count?("Подтверждено параметров на дату: "+count+" из "+VED_TARIFFS.length):
          "На выбранную дату тарифы пока не заведены. Используются демонстрационные значения.");
      }catch(e){if(active){setResolved({});setCanEdit(false);setRatesStatus(e instanceof Error?e.message:"Ошибка загрузки тарифов");}}
    })();
    return ()=>{active=false;};
  },[tariffDate,calculationId]);
  const applyRates = () => {
    setInput(previous=>applyTariffValues({
      ...previous,customs:{...previous.customs,feeDate:tariffDate},
    },resolved));
    setSaveMessage("Тарифы применены. Параметры без утверждённых ставок оставлены без изменений.");
  };
  const saveSnapshot = async()=>{
    if(!canEdit){setSaveMessage("Недостаточно прав для сохранения");return;}
    setSaving(true);setSaveMessage("");
    try{
      const response=await fetch("/api/ved-calculations",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({title,article,calculationDate:tariffDate,calculationId,input}),
      });
      const json=await response.json() as {ok:boolean;error?:string;snapshot?:{calculation_id:string;version_no:number}};
      if(!response.ok||!json.ok||!json.snapshot)throw Error(json.error||"Сохранение не выполнено");
      setCalculationId(json.snapshot.calculation_id);
      setSaveMessage("Версия "+json.snapshot.version_no+" сохранена. Предыдущие версии не изменены.");
      await loadSaved();
    }catch(e){setSaveMessage(e instanceof Error?e.message:"Ошибка сохранения");}
    finally{setSaving(false);}
  };
  const exportExcel=async(ids:string[])=>{
    if(!ids.length){setSaveMessage("Нет сохранённых расчётов для экспорта");return;}
    setExporting(true);setSaveMessage("");
    try{
      const response=await fetch("/api/ved-calculations/export",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids}),
      });
      if(!response.ok){
        const json=await response.json() as {error?:string};
        throw Error(json.error||"Не удалось сформировать Excel");
      }
      const blob=await response.blob();
      const url=window.URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download="ВЭД-расчёты-"+new Date().toLocaleDateString("sv-SE")+".xlsx";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>window.URL.revokeObjectURL(url),3000);
      setSaveMessage("Excel сформирован из сохранённых версий. Один товар = один лист.");
    }catch(e){setSaveMessage(e instanceof Error?e.message:"Ошибка экспорта Excel");}
    finally{setExporting(false);}
  };
  const exportLatest=()=>{
    const seen=new Set<string>();
    const ids=history.filter(saved=>{
      if(seen.has(saved.calculation_id))return false;
      seen.add(saved.calculation_id);
      return true;
    }).slice(0,30).map(saved=>saved.id);
    void exportExcel(ids);
  };
  const openSnapshot=(saved:StoredCalculation)=>{
    setInput(saved.input_data);setTitle(saved.title);setArticle(saved.article);
    setCalculationId(saved.calculation_id);setTariffDate(saved.calculation_date);
    setSaveMessage("Открыта сохранённая версия "+saved.version_no+". Новый расчёт сохранится следующей версией.");
  };
  const startNew=()=>{
    setInput(applyTariffValues(initial,resolved));setTitle("Первоначальный расчёт товара");setArticle("");
    setCalculationId(null);setSaveMessage("Новый расчёт: предыдущие записи сохранены.");
  };
  const update = (group: keyof VedCalculationInput, field: string, value: number | boolean | string | undefined) => {
    setInput(previous => ({ ...previous, [group]: { ...previous[group], [field]: value } }));
  };
  const updateCartonDimension=(field:"cartonLengthCm"|"cartonWidthCm"|"cartonHeightCm",value?:number)=>{
    setInput(previous=>{
      const product={...previous.product,[field]:value};
      const {cartonLengthCm:l,cartonWidthCm:w,cartonHeightCm:h}=product;
      if(l&&w&&h&&l>0&&w>0&&h>0)product.cartonVolumeM3=l*w*h/1000000;
      return {...previous,product};
    });
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
  const tf=(field:keyof VedCalculationInput["product"],label:string,value?:string,maxLength=160)=>
    <label className="ved-calc-field" key={field}>
      <span>{label}</span>
      <input type="text" maxLength={maxLength} value={value||""}
        onChange={event=>update("product",field,event.target.value)}/>
    </label>;

  return <div className="ved-calc">
    <div className="ved-calc-note">
      <strong>Калькулятор ВЭД · сохранение и выгрузка Excel</strong>
      <p>При новом расчёте подставляются значения из справочника ВЭД на выбранную дату. Данные демонстрационного товара необходимо заменить своими. Каждая сохранённая версия остаётся неизменной; Excel берёт из неё точные суммы и оформление утверждённого шаблона.</p>
    </div>
    <div className="ved-calc-persistence">
      <div className="ved-calc-persist-bar">
        <label className="ved-calc-field">
          <span>Дата для справочников / сохранения</span>
          <input type="date" value={tariffDate} onChange={e=>setTariffDate(e.target.value)}/>
        </label>
        <button type="button" className="ved-calc-reset" onClick={applyRates}>Применить тарифы на дату</button>
        <a className="ved-calc-reset" href="/ved/references">Открыть справочники</a>
      </div>
      <p className="ved-calc-hint">{ratesStatus}</p>
      <div className="ved-calc-persist-bar">
        <label className="ved-calc-field"><span>Название расчёта</span><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180}/></label>
        <label className="ved-calc-field"><span>Артикул (необязательно)</span><input value={article} onChange={e=>setArticle(e.target.value)} maxLength={120}/></label>
        <button type="button" className="ved-calc-reset" disabled={saving||!canEdit||!preview.data} onClick={()=>void saveSnapshot()}>
          {saving?"Сохраняем…":calculationId?"Сохранить новую версию":"Сохранить расчёт"}
        </button>
        <button type="button" className="ved-calc-reset" onClick={startNew}>Новый расчёт</button>
      </div>
      {saveMessage&&<p className="ved-calc-hint" role="status">{saveMessage}</p>}
      <details className="ved-calc-section">
        <summary>Сохранённые расчёты, версии и Excel ({history.length} последних)</summary>
        <div className="ved-calc-snapshots">
          {history.length>0&&<button className="ved-calc-export-all" type="button" disabled={exporting}
            onClick={exportLatest}>{exporting?"Формируем Excel…":"Скачать последние версии всех товаров в один Excel (до 30 листов)"}</button>}
          {history.length?history.map(saved=><div className="ved-calc-snapshot-row" key={saved.id}>
            <button className="ved-calc-snapshot-open" type="button" onClick={()=>openSnapshot(saved)}>
              <strong>{saved.title}</strong> {saved.article&&<span>· {saved.article}</span>}
              <small>версия {saved.version_no} · дата тарифа {saved.calculation_date}</small>
            </button>
            <button className="ved-calc-snapshot-export" type="button" disabled={exporting}
              onClick={()=>void exportExcel([saved.id])} aria-label={"Скачать Excel для "+saved.title}>
              Скачать Excel
            </button>
          </div>):<p>Пока нет сохранённых расчётов или отсутствует доступ к истории.</p>}
        </div>
      </details>
    </div>
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
              <input type="date" value={t.feeDate ?? "2026-10-30"}
                onChange={event => update("customs", "feeDate", event.target.value)} />
            </label>
            {t.feeMode === "manual" && nf("expenses", "customsOperationsFeeRub", "Ручной сбор на каждый сценарий, ₽", e.customsOperationsFeeRub)}
          </div>
          <label className="ved-calc-check"><input type="checkbox" checked={t.includeFreightBeforeBorderInCustomsBase} onChange={event => update("customs", "includeFreightBeforeBorderInCustomsBase", event.target.checked)} /><span>Включать оценочную перевозку до границы в базу для пошлины (проверить по условиям поставки)</span></label>
          <label className="ved-calc-check"><input type="checkbox" checked={t.importVatRecoverable} onChange={event => update("customs", "importVatRecoverable", event.target.checked)} /><span>Показывать управленческую себестоимость без потенциально возмещаемого НДС</span></label>
        </details>
        <button className="ved-calc-reset" type="button" onClick={() => setInput(initial)}>Восстановить демонстрационные числа</button>
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
