"use client";
import { DateField } from "@/app/ui/WorkspaceDateFields";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {calculateVed,VedInputError,type VedCalculationInput,type VedCalculationResult} from "@/lib/ved-calculation/engine";
import type {TariffRow,VedTariffKey} from "@/lib/ved-calculation/tariffs";
import {VedCalculatorWorkspace} from "./VedCalculatorWorkspace";

type Quote={id:string;quote_code:string;quote_date:string;supplier_code:string;item_count:number};
type Product={id:string;source_sheet:string;source_row:number;supplier_article:string;description_original:string;
 detected_data:Record<string,string|number|null>;missing_fields:string[];warnings:string[]};
type Row={itemId:string;article:string;title:string;input:VedCalculationInput};
type Preview=Row&{result:VedCalculationResult|null;errors:string[]};
type Version={id:string;version_no:number;calculation_date:string;created_at:string;
 items_data:Array<{itemId:string;article:string;title:string;input:VedCalculationInput;
 result:VedCalculationResult|null;errors:string[]}>};
type Response={ok:boolean;error?:string};
type TariffResponse=Response&{selected?:Partial<Record<VedTariffKey,TariffRow>>;canEdit?:boolean;fxError?:string|null};
const dateMoscow=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Moscow"});
const rub=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n);
const get=(obj:Record<string,string|number|null>,key:string)=>typeof obj[key]==="number"?Number(obj[key]):0;
function inputFromQuote(item:Product,tariff:TariffResponse["selected"],asOf:string):VedCalculationInput{
 const p=item.detected_data;
 const rate=(key:VedTariffKey,defaultValue=0)=>Number(tariff?.[key]?.amount??defaultValue);
 return {
  product:{
   productName:item.description_original.split("\n")[0],tnVedCode:"",
   incoterm:String(p.incoterm||"FOB"),departurePort:String(p.departurePort||""),
   unitPriceCny:get(p,"unitPriceCny"),unitsPerCarton:get(p,"unitsPerCarton"),
   cartonVolumeM3:get(p,"cartonVolumeM3"),cartonGrossKg:get(p,"cartonGrossKg"),
   moqUnits:get(p,"moqUnits"),markingCnyPerUnit:0,
   cartonLengthCm:get(p,"cartonLengthCm")||undefined,
   cartonWidthCm:get(p,"cartonWidthCm")||undefined,
   cartonHeightCm:get(p,"cartonHeightCm")||undefined,
   individualLengthCm:get(p,"individualLengthCm")||undefined,
   individualWidthCm:get(p,"individualWidthCm")||undefined,
   individualHeightCm:get(p,"individualHeightCm")||undefined,
  },
  container:{usableVolumeM3:rate("usableVolumeM3",68),maxPayloadKg:rate("maxPayloadKg",22000)},
  currency:{cnyRub:rate("cnyRub"),eurRub:rate("eurRub")},
  expenses:{
   freightBeforeBorderRub:rate("freightBeforeBorderRub"),freightAfterBorderRub:rate("freightAfterBorderRub"),
   bankCommissionRub:rate("bankCommissionRub"),brokerServicesRub:rate("brokerServicesRub"),
   otherSharedRub:rate("otherSharedRub"),otherRubPerUnit:rate("otherRubPerUnit"),
   customsOperationsFeeRub:0,refundableSecurityRub:0,
   certificationRub:rate("certificationRub"),moldingRub:rate("moldingRub"),
   indirectPaymentsRub:rate("indirectPaymentsRub"),additionalRub:rate("additionalRub"),
   dangerousCargo:false,
   dangerSurchargeBeforeRub:rate("dangerSurchargeBeforeRub",60000),
   dangerSurchargeAfterRub:rate("dangerSurchargeAfterRub",60000),
  },
  customs:{
   dutyMode:"ad-valorem",adValoremPercent:-1,specificEurPerUnit:0,
   specificUnit:"gross-kg",vatPercent:rate("vatPercent",22),
   includeFreightBeforeBorderInCustomsBase:true,importVatRecoverable:false,
   feeMode:"schedule",feeDate:asOf,
  },
 };
}
export default function VedWholeOfferCalculator({offerId,initialItemId,initialVersionId}:{
 offerId:string;initialItemId?:string;initialVersionId?:string;
}){
 const [offer,setOffer]=useState<Quote|null>(null);
 const [quoteItems,setQuoteItems]=useState<Product[]>([]);
 const [rows,setRows]=useState<Row[]>([]);
 const [versions,setVersions]=useState<Version[]>([]);
 const [date,setDate]=useState(dateMoscow);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[canEdit,setCanEdit]=useState(false);
 const [latestId,setLatestId]=useState<string|null>(null);
 const [progress,setProgress]=useState("");
 const [selectedItem,setSelectedItem]=useState<string|null>(null);
 const lastSaved=useRef<{id:string;signature:string}|null>(null);
 const signature=()=>JSON.stringify({date,rows:rows.map(r=>({itemId:r.itemId,input:{...r.input,
  customs:{...r.input.customs,feeDate:date}}}))});
 const fetchVersions=useCallback(async():Promise<Version[]>=>{
  const res=await fetch("/api/ved-offer-calculations?offerId="+encodeURIComponent(offerId)+
   (initialVersionId?"&versionId="+encodeURIComponent(initialVersionId):""),{cache:"no-store"});
  const obj=await res.json() as Response&{versions?:Version[]};
  if(!res.ok||!obj.ok)throw Error(obj.error||"Не удалось загрузить версии КП");
  const found=obj.versions||[];
  setVersions(found);
  setLatestId(found[0]?.id||null);
  return found;
 },[offerId,initialVersionId]);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   setLoading(true);setError("");
   try{
    const [quoteRes,tariffRes]=await Promise.all([
     fetch("/api/ved-commercial-offers?offerId="+encodeURIComponent(offerId),{cache:"no-store"}),
     fetch("/api/ved-tariffs?asOf="+dateMoscow(),{cache:"no-store"}),
    ]);
    const quote=await quoteRes.json() as Response&{offer?:Quote;items?:Product[]};
    const tariffs=await tariffRes.json() as TariffResponse;
    if(!quote.ok||!quote.offer||!quote.items)throw Error(quote.error||"КП не найдено");
    if(!tariffs.ok)throw Error(tariffs.error||"Тарифы не загружены");
    if(!active)return;
    setOffer(quote.offer);setQuoteItems(quote.items);setCanEdit(Boolean(tariffs.canEdit));
    const original=quote.items.map(item=>({itemId:item.id,article:item.supplier_article,
      title:item.description_original,input:inputFromQuote(item,tariffs.selected,dateMoscow())}));
    setRows(original);setSelectedItem(original.some(r=>r.itemId===initialItemId)?initialItemId!:original[0]?.itemId||null);
    if(tariffs.fxError)setMessage("Не удалось получить курс ЦБ: "+tariffs.fxError+"; расчёт не запустится до уточнения курсов.");
    // Restore the latest COMPLETE snapshot on entry, so confirmed duties
    // aren't lost after reloading the page. Partial versions stay in history.
    try{
      const history=await fetchVersions();
      if(!active)return;
      const complete=history.find(v=>v.items_data.length===original.length&&
        v.items_data.every(entry=>Boolean(entry.result)&&original.some(row=>row.itemId===entry.itemId)));
      const requested=initialVersionId?history.find(v=>v.id===initialVersionId):null;
      const chosen=requested||complete;
      if(chosen){
        const restored=chosen.items_data.map(x=>({itemId:x.itemId,article:x.article,title:x.title,input:x.input}));
        setRows(restored);setDate(chosen.calculation_date);
        setSelectedItem(restored.some(r=>r.itemId===initialItemId)?initialItemId!:restored[0]?.itemId||null);
        lastSaved.current={id:chosen.id,signature:JSON.stringify({date:chosen.calculation_date,
          rows:restored.map(row=>({itemId:row.itemId,input:{...row.input,
           customs:{...row.input.customs,feeDate:chosen.calculation_date}}}))})};
        if(requested)
          setMessage("Открыта версия "+chosen.version_no+" из реестра. Изменения сохраняются новой версией КП.");
        else if(history[0]?.id!==chosen.id)
          setMessage("Открыта последняя полностью рассчитанная версия "+chosen.version_no+
           ". Более поздние незавершённые версии доступны в истории КП.");
      }
    }catch(e){
      if(active)setMessage("КП загружено, но историю версий не удалось получить: "+
        (e instanceof Error?e.message:"ошибка запроса"));
    }
   }catch(e){if(active)setError(e instanceof Error?e.message:"Ошибка загрузки КП");}
   finally{if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[offerId,fetchVersions,initialItemId,initialVersionId]);
 const preview=useMemo<Preview[]>(()=>rows.map(row=>{
  try{return {...row,result:calculateVed(row.input),errors:[]};}
  catch(e){return {...row,result:null,errors:e instanceof VedInputError?e.issues:["Не удалось рассчитать товар"]};}
 }),[rows]);
 const ready=preview.filter(p=>Boolean(p.result)).length;
 const selected=preview.find(p=>p.itemId===selectedItem)||preview[0]||null;
 const selectedSource=quoteItems.find(p=>p.id===selected?.itemId);
 const patchInput=(id:string,group:keyof VedCalculationInput,key:string,value:string|number|boolean|undefined)=>{
  setRows(old=>old.map(r=>{
   if(r.itemId!==id)return r;
   const groupData={...r.input[group],[key]:value};
   if(group==="product"&&["cartonLengthCm","cartonWidthCm","cartonHeightCm"].includes(key)){
    const dims=groupData as VedCalculationInput["product"];
    if(dims.cartonLengthCm&&dims.cartonWidthCm&&dims.cartonHeightCm&&
      dims.cartonLengthCm>0&&dims.cartonWidthCm>0&&dims.cartonHeightCm>0){
      dims.cartonVolumeM3=dims.cartonLengthCm*dims.cartonWidthCm*dims.cartonHeightCm/1000000;
    }
   }
   return {...r,input:{...r.input,[group]:groupData}};
  }));
 };
 const bulkDuty=(value:string)=>{
  const n=value.trim()===""?-1:Number(value);
  if(!Number.isFinite(n)||n<0){setMessage("Укажите неотрицательную ставку пошлины");return;}
  setRows(old=>old.map(r=>({...r,input:{...r.input,
    customs:{...r.input.customs,adValoremPercent:n}}})));
  setMessage("Ставка установлена на все товары. Проверьте соответствие кодов ТН ВЭД.");
 };
 const persist=async()=>{
  if(!canEdit||!offer)throw Error("Нет прав на сохранение расчёта КП");
  const res=await fetch("/api/ved-offer-calculations",{method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    offerId:offer.id,calculationDate:date,
    items:rows.map(r=>({itemId:r.itemId,input:{...r.input,
     customs:{...r.input.customs,feeDate:date}}})),
   }),
  });
  const data=await res.json() as Response&{version?:{id:string;version_no:number};
   readyCount?:number;totalCount?:number;warning?:string};
  if(!res.ok||!data.ok||!data.version)throw Error(data.error||"Не удалось сохранить общую версию КП");
  setLatestId(data.version.id);
  lastSaved.current={id:data.version.id,signature:signature()};
  // The export must proceed even if refreshing the versions list fails.
  try{await fetchVersions();}catch(err){console.warn("VED version list refresh failed",err);}
  return data;
 };
 const save=async()=>{
  if(busy)return;
  setBusy(true);setError("");setMessage("");setProgress("Сохраняем общую версию КП…");
  try{
   const data=await persist();
   setMessage("Сохранён общий расчёт КП, версия "+data.version!.version_no+
    ". Рассчитано "+data.readyCount+" из "+data.totalCount+(data.warning?". "+data.warning:""));
  }catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}
  finally{setBusy(false);setProgress("");}
 };
 const exportExcel=async(savedVersionId?:string)=>{
  if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   let versionId=savedVersionId;
   if(!versionId){
    // A previous successful save may be reused if none of its inputs changed.
    if(lastSaved.current?.signature===signature())versionId=lastSaved.current.id;
    else if(canEdit){
     setProgress("1/2. Сохраняем текущий расчёт всего КП…");
     const saved=await persist();
     versionId=saved.version!.id;
     if(saved.warning)setMessage(saved.warning);
    }else versionId=latestId||undefined;
   }
   if(!versionId)throw Error("Нет доступной сохранённой версии КП. Требуется право ВЭД для создания расчёта.");
   setProgress("2/2. Создаём Excel с формулами и фотографиями…");
   const res=await fetch("/api/ved-offer-calculations/export",{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({versionId})});
   if(!res.ok){
    let detail="Сервер не сформировал Excel (HTTP "+res.status+")";
    try{const data=await res.json() as Response;if(data.error)detail=data.error;}catch{}
    throw Error(detail);
   }
   const contentType=res.headers.get("Content-Type")||"";
   if(!contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
    throw Error("Сервер вернул не Excel, а "+contentType);
   const blob=await res.blob();
   if(blob.size<2000)throw Error("Получен пустой либо повреждённый Excel-файл");
   const url=window.URL.createObjectURL(blob);
   const link=document.createElement("a");
   link.href=url;
   link.download=(offer?.quote_code||"KP")+"-расчёт-"+date+".xlsx";
   link.style.display="none";
   document.body.appendChild(link);
   link.click();link.remove();
   window.setTimeout(()=>window.URL.revokeObjectURL(url),10000);
   setMessage("Сформирован Excel для всего КП ("+rows.length+
    " товаров). Проверьте скачанный файл: один товар на лист.");
  }catch(e){setError(e instanceof Error?e.message:"Ошибка формирования Excel");}
  finally{setBusy(false);setProgress("");}
 };
 const restore=(v:Version)=>{
  setRows(v.items_data.map(x=>({itemId:x.itemId,article:x.article,title:x.title,input:x.input})));
  setDate(v.calculation_date);setLatestId(v.id);
  lastSaved.current={id:v.id,signature:JSON.stringify({date:v.calculation_date,
   rows:v.items_data.map(x=>({itemId:x.itemId,input:x.input}))})};
  setMessage("Открыта версия "+v.version_no+". Изменения сохраняются только новой версией всего КП.");
 };
 if(loading)return <div className="ved-offer-loading">Загрузка всего КП и справочников…</div>;
 if(error&&!offer)return <p className="ved-offer-error">{error}</p>;
 return <div className="ved-whole-offer">
  <div className="ved-offer-heading">
   <div><h2>{offer?.quote_code} · общий расчёт</h2>
    <p>{offer?.supplier_code} · КП от {offer?.quote_date}. Один расчёт на всё КП, один товар на лист Excel.</p></div>
   <a href="/commercial-offers">К списку КП</a>
  </div>
  <div className="ved-offer-summary">
   <div><small>Всего товаров</small><strong>{rows.length}</strong></div>
   <div><small>Рассчитано</small><strong>{ready}</strong></div>
   <div><small>Требуют данных</small><strong>{rows.length-ready}</strong></div>
   <label>Дата тарифов и расчёта<DateField  value={date} onChange={e=>setDate(e.target.value)}/></label>
  </div>
  <p className="ved-offer-help">Выберите артикул непосредственно в калькуляторе. Все его исходные параметры, сценарии 40HQ / MOQ / 1 м³ и правки сохраняются в одном общем расчёте КП.</p>
  <div className="ved-offer-bulk">
   <label>Применить одну ставку пошлины ко всем товарам, % <input id="ved-bulk-duty" type="number" min="0" step="any" placeholder="Например, 10"/></label>
   <button type="button" onClick={()=>{
    const element=document.getElementById("ved-bulk-duty") as HTMLInputElement|null;
    bulkDuty(element?.value||"");
   }}>Применить ко всем</button>
  </div>
  {message&&<p role="status" className="ved-offer-help">{message}</p>}
  {error&&<p role="alert" className="ved-offer-error">{error}</p>}
  {selected&&<section className="ved-calc ved-offer-classic-calculator" aria-label="Калькулятор выбранного товара">
   <div className="ved-calc-persistence ved-offer-article-picker">
    <div className="ved-calc-persist-bar">
     <label className="ved-calc-field ved-offer-article-field">
      <span>Выбрать артикул КП</span>
      <select value={selected.itemId} onChange={event=>setSelectedItem(event.target.value)}>
       {preview.map((item,i)=><option key={item.itemId} value={item.itemId}>
        {i+1}. {item.article} · {item.title.split("\n")[0].slice(0,95)}
        {item.result?" · "+rub(item.result.averageCostPerUnitRub)+" ₽/шт.":" · требуется уточнить"}
       </option>)}
      </select>
     </label>
     <div className="ved-offer-selected-info">
      <strong>{selected.article}</strong>
      <span>{selected.result?rub(selected.result.averageCostPerUnitRub)+" ₽/шт. (40HQ + MOQ)":
       "Есть недостающие параметры"}</span>
      <small>Товар {preview.findIndex(p=>p.itemId===selected.itemId)+1} из {preview.length}</small>
     </div>
    </div>
    {selectedSource&&<p className="ved-calc-hint">Источник: лист «{selectedSource.source_sheet}», строка {selectedSource.source_row}. Упаковка: {String(selectedSource.detected_data.packaging||"не указана")}.</p>}
   </div>
   <VedCalculatorWorkspace
    input={selected.input}
    onChange={(group,key,value)=>patchInput(selected.itemId,group,key,value)}
   />
  </section>}
  <div className="ved-offer-actions">
   <button type="button" disabled={!canEdit||busy||!rows.length} onClick={()=>void save()}>
    {busy?"Обрабатываем…":"Сохранить новую версию всего КП"}</button>
   <button type="button" disabled={busy||!rows.length||(!canEdit&&!latestId)}
    onClick={()=>void exportExcel()} title="Сохраняет текущий расчёт и сразу скачивает Excel">
    {busy?"Готовим файл…":"Скачать всё КП в Excel"}
   </button>
  </div>
  {progress&&<p role="status" className="ved-offer-progress">{progress}</p>}
  {error&&<p role="alert" className="ved-offer-error">{error}</p>}
  {message&&<p role="status" className="ved-offer-help">{message}</p>}
  {versions.length>0&&<details className="ved-offer-versions">
   <summary>История общего расчёта КП ({versions.length} версий)</summary>
   {versions.map(v=><div className="ved-offer-version" key={v.id}>
    <span>Версия {v.version_no} · {v.calculation_date} · {v.items_data.length} товаров</span>
    <button type="button" onClick={()=>restore(v)} disabled={busy}>Открыть</button>
    <button type="button" onClick={()=>void exportExcel(v.id)} disabled={busy}>Excel</button>
   </div>)}
  </details>}
  {!canEdit&&<p className="ved-offer-help">Для сохранения расчётов требуется роль ВЭД или администратора.</p>}
 </div>;
}
