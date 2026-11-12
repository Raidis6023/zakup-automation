"use client";

import { DateField } from "@/app/ui/WorkspaceDateFields";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {VedCalculatorWorkspace} from "./VedCalculatorWorkspace";
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
  offer_item_id?: string | null;
  input_data: VedCalculationInput;
};
type TariffResponse = {ok:boolean;error?:string;selected?:Partial<Record<VedTariffKey,TariffRow>>;canEdit?:boolean};
type SavedResponse = {ok:boolean;error?:string;items?:StoredCalculation[]};
const money = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
const number = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(n);

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
  const [offerItemId,setOfferItemId]=useState<string|null>(null);
  const [offerSource,setOfferSource]=useState("");
  const [history, setHistory] = useState<StoredCalculation[]>([]);
  const openedDeepLink=useRef(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const loadSaved = useCallback(async () => {
    try {
      const snapshotId=new URLSearchParams(window.location.search).get("snapshotId");
      const response = await fetch("/api/ved-calculations"+
        (snapshotId?"?snapshotId="+encodeURIComponent(snapshotId):""), {cache:"no-store"});
      const json = await response.json() as SavedResponse;
      if(!response.ok || !json.ok) throw Error(json.error || "Не удалось получить версии");
      setHistory(json.items || []);
      if(!openedDeepLink.current){
        openedDeepLink.current=true;
        const id=new URLSearchParams(window.location.search).get("snapshotId");
        if(id){
          const saved=(json.items||[]).find(x=>x.id===id);
          if(saved){
            setInput(saved.input_data);setTitle(saved.title);setArticle(saved.article);
            setCalculationId(saved.calculation_id);setTariffDate(saved.calculation_date);
            setOfferItemId(saved.offer_item_id||null);
            setOfferSource(saved.offer_item_id?"Открыт сохранённый расчёт товара из КП":"");
            setSaveMessage("Открыта сохранённая версия "+saved.version_no+" из реестра. Новые изменения сохраняются отдельной версией.");
          }else setSaveMessage("Версия расчёта не найдена среди последних сохранений.");
        }
      }
    }catch(e){setSaveMessage(e instanceof Error ? e.message : "Ошибка получения версий");}
  },[]);
  useEffect(()=>{void loadSaved();},[loadSaved]);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.has("snapshotId"))return;
    const itemId=params.get("offerItem");
    if(!itemId)return;
    let active=true;
    (async()=>{
      try{
        const res=await fetch("/api/ved-commercial-offers?item="+encodeURIComponent(itemId),{cache:"no-store"});
        const json=await res.json() as {
          ok:boolean;error?:string;
          item?:{id:string;supplier_article:string;description_original:string;detected_data:Record<string,string|number|null>;missing_fields:string[]};
          offer?:{quote_code:string;quote_date:string;supplier_code:string};
        };
        if(!res.ok||!json.ok||!json.item||!json.offer)throw Error(json.error||"Товар из КП не найден");
        if(!active)return;
        const info=json.item.detected_data;
        const numeric=(name:string)=>{
          const value=info[name];return typeof value==="number"&&Number.isFinite(value)?value:Number.NaN;
        };
        setOfferItemId(json.item.id);
        setOfferSource(json.offer.quote_code+" · "+json.offer.supplier_code+
          (json.item.missing_fields.length?" · недостаёт: "+json.item.missing_fields.join(", "):""));
        setTitle("Расчёт "+json.item.supplier_article+" ("+json.offer.quote_code+")");
        setArticle(json.item.supplier_article);
        setTariffDate(json.offer.quote_date);
        setCalculationId(null);
        setInput(prev=>({...prev,
          product:{...prev.product,
            productName:json.item!.description_original.split("\n")[0].slice(0,160),
            incoterm:String(info.incoterm||"FOB"),
            departurePort:String(info.departurePort||""),
            unitPriceCny:numeric("unitPriceCny"),
            unitsPerCarton:numeric("unitsPerCarton"),
            cartonGrossKg:numeric("cartonGrossKg"),
            cartonVolumeM3:numeric("cartonVolumeM3"),
            moqUnits:numeric("moqUnits"),
            cartonLengthCm:typeof info.cartonLengthCm==="number"?info.cartonLengthCm:undefined,
            cartonWidthCm:typeof info.cartonWidthCm==="number"?info.cartonWidthCm:undefined,
            cartonHeightCm:typeof info.cartonHeightCm==="number"?info.cartonHeightCm:undefined,
            individualLengthCm:typeof info.individualLengthCm==="number"?info.individualLengthCm:undefined,
            individualWidthCm:typeof info.individualWidthCm==="number"?info.individualWidthCm:undefined,
            individualHeightCm:typeof info.individualHeightCm==="number"?info.individualHeightCm:undefined,
          },
          customs:{...prev.customs,adValoremPercent:Number.NaN,feeDate:json.offer!.quote_date},
        }));
        setSaveMessage("Данные КП перенесены. Проверьте тариф пошлины и код ТН ВЭД перед сохранением.");
      }catch(error){
        if(active)setSaveMessage(error instanceof Error?error.message:"Не удалось открыть товар КП");
      }
    })();
    return ()=>{active=false;};
  },[]);
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
        body:JSON.stringify({title,article,calculationDate:tariffDate,calculationId,sourceOfferItemId:offerItemId,input}),
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
    setOfferItemId(saved.offer_item_id||null);setOfferSource(saved.offer_item_id?"Открыта связанная версия КП":"");
    setSaveMessage("Открыта сохранённая версия "+saved.version_no+". Новый расчёт сохранится следующей версией.");
  };
  const startNew=()=>{
    setInput(applyTariffValues(initial,resolved));setTitle("Первоначальный расчёт товара");setArticle("");
    setCalculationId(null);setOfferItemId(null);setOfferSource("");
    setSaveMessage("Новый расчёт: предыдущие записи сохранены.");
  };
  const update = (group: keyof VedCalculationInput, field: string, value: number | boolean | string | undefined) => {
    setInput(previous => {
      const groupData={...previous[group],[field]:value};
      if(group==="product"&&["cartonLengthCm","cartonWidthCm","cartonHeightCm"].includes(field)){
        const p=groupData as VedCalculationInput["product"];
        if(p.cartonLengthCm&&p.cartonWidthCm&&p.cartonHeightCm&&
          p.cartonLengthCm>0&&p.cartonWidthCm>0&&p.cartonHeightCm>0)
          p.cartonVolumeM3=p.cartonLengthCm*p.cartonWidthCm*p.cartonHeightCm/1000000;
      }
      return {...previous,[group]:groupData};
    });
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
  return <div className="ved-calc">
    {offerSource&&<div className="ved-calc-note"><strong>Источник: {offerSource}</strong>
      <p>Товар импортирован из Excel поставщика. Отсутствующие поля оставлены пустыми. Ставка пошлины не подставляется наугад: укажите её после проверки ТН ВЭД.</p></div>}
    <div className="ved-calc-note">
      <strong>Калькулятор ВЭД · сохранение и выгрузка Excel</strong>
      <p>При новом расчёте подставляются значения из справочника ВЭД на выбранную дату. Данные демонстрационного товара необходимо заменить своими. Каждая сохранённая версия остаётся неизменной; Excel берёт из неё точные суммы и оформление утверждённого шаблона.</p>
    </div>
    <div className="ved-calc-persistence">
      <div className="ved-calc-persist-bar">
        <label className="ved-calc-field">
          <span>Дата для справочников / сохранения</span>
          <DateField  value={tariffDate} onChange={e=>setTariffDate(e.target.value)}/>
        </label>
        <button type="button" className="ved-calc-reset" onClick={applyRates}>Применить тарифы на дату</button>
        <a className="ved-calc-reset" href="/references">Открыть справочники</a>
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
    <VedCalculatorWorkspace input={input} onChange={update} onReset={()=>setInput(initial)}/>
  </div>;
}
