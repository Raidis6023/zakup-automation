"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {calculateVed,VedInputError,type VedCalculationInput,type VedCalculationResult} from "@/lib/ved-calculation/engine";
import type {TariffRow,VedTariffKey} from "@/lib/ved-calculation/tariffs";

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
const numberField=(value:number)=>Number.isFinite(value)&&value>=0?String(value):"";
export default function VedWholeOfferCalculator({offerId}:{offerId:string}){
 const [offer,setOffer]=useState<Quote|null>(null);
 const [quoteItems,setQuoteItems]=useState<Product[]>([]);
 const [rows,setRows]=useState<Row[]>([]);
 const [versions,setVersions]=useState<Version[]>([]);
 const [date,setDate]=useState(dateMoscow);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[canEdit,setCanEdit]=useState(false);
 const [latestId,setLatestId]=useState<string|null>(null);
 const [selectedItem,setSelectedItem]=useState<string|null>(null);
 const fetchVersions=useCallback(async()=>{
  const res=await fetch("/api/ved-offer-calculations?offerId="+encodeURIComponent(offerId),{cache:"no-store"});
  const obj=await res.json() as Response&{versions?:Version[]};
  if(!res.ok||!obj.ok)throw Error(obj.error||"Не удалось загрузить версии КП");
  setVersions(obj.versions||[]);
  setLatestId(obj.versions?.[0]?.id||null);
 },[offerId]);
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
    setRows(quote.items.map(item=>({itemId:item.id,article:item.supplier_article,
      title:item.description_original,input:inputFromQuote(item,tariffs.selected,dateMoscow())})));
    if(tariffs.fxError)setMessage("Не удалось получить курс ЦБ: "+tariffs.fxError+"; расчёт не запустится до уточнения курсов.");
    await fetchVersions();
   }catch(e){if(active)setError(e instanceof Error?e.message:"Ошибка загрузки КП");}
   finally{if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[offerId,fetchVersions]);
 const preview=useMemo<Preview[]>(()=>rows.map(row=>{
  try{return {...row,result:calculateVed(row.input),errors:[]};}
  catch(e){return {...row,result:null,errors:e instanceof VedInputError?e.issues:["Не удалось рассчитать товар"]};}
 }),[rows]);
 const ready=preview.filter(p=>Boolean(p.result)).length;
 const patchProduct=(id:string,key:keyof VedCalculationInput["product"],value:string|number)=>{
  setRows(old=>old.map(r=>r.itemId!==id?r:{...r,input:{...r.input,
    product:{...r.input.product,[key]:value}}}));
 };
 const patchDuty=(id:string,value:number)=>{
  setRows(old=>old.map(r=>r.itemId!==id?r:{...r,input:{...r.input,
    customs:{...r.input.customs,adValoremPercent:value}}}));
 };
 const bulkDuty=(value:string)=>{
  const n=value.trim()===""?-1:Number(value);
  if(!Number.isFinite(n)||n<0){setMessage("Укажите неотрицательную ставку пошлины");return;}
  setRows(old=>old.map(r=>({...r,input:{...r.input,
    customs:{...r.input.customs,adValoremPercent:n}}})));
  setMessage("Ставка установлена на все товары. Проверьте соответствие кодов ТН ВЭД.");
 };
 const save=async()=>{
  if(!canEdit||!offer)return;
  setBusy(true);setError("");setMessage("");
  try{
   const res=await fetch("/api/ved-offer-calculations",{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({offerId:offer.id,calculationDate:date,
      items:rows.map(r=>({itemId:r.itemId,input:{...r.input,
        customs:{...r.input.customs,feeDate:date}}}))}),
   });
   const data=await res.json() as Response&{version?:{id:string;version_no:number};
    readyCount?:number;totalCount?:number;warning?:string};
   if(!res.ok||!data.ok||!data.version)throw Error(data.error||"Ошибка сохранения КП");
   setLatestId(data.version.id);
   setMessage("Сохранён общий расчёт КП, версия "+data.version.version_no+". Рассчитано "+data.readyCount+" из "+data.totalCount+
    (data.warning?". "+data.warning:""));
   await fetchVersions();
  }catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}
  finally{setBusy(false);}
 };
 const exportExcel=async(versionId:string)=>{
  setBusy(true);setError("");setMessage("");
  try{
   const res=await fetch("/api/ved-offer-calculations/export",{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({versionId})});
   if(!res.ok){const data=await res.json() as Response;throw Error(data.error||"Не удалось скачать Excel");}
   const blob=await res.blob();
   const url=URL.createObjectURL(blob),link=document.createElement("a");
   link.href=url;link.download=(offer?.quote_code||"KP")+"-расчёт.xlsx";
   document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),3000);
   setMessage("Excel сформирован: каждый товар на отдельном листе, фотографии из оригинала, редактируемые формулы.");
  }catch(e){setError(e instanceof Error?e.message:"Ошибка экспорта");}
  finally{setBusy(false);}
 };
 const restore=(v:Version)=>{
  setRows(v.items_data.map(x=>({itemId:x.itemId,article:x.article,title:x.title,input:x.input})));
  setDate(v.calculation_date);setLatestId(v.id);
  setMessage("Открыта версия "+v.version_no+". Изменения сохраняются только новой версией всего КП.");
 };
 const field=(r:Row,key:keyof VedCalculationInput["product"],label:string)=>
  <label className="ved-offer-input" key={String(key)}>
   <span>{label}</span>
   <input type="number" min="0" step="any"
    value={numberField(Number(r.input.product[key]??0))}
    onChange={e=>patchProduct(r.itemId,key,e.target.value===""?0:Number(e.target.value))}/>
  </label>;
 if(loading)return <div className="ved-offer-loading">Загрузка всего КП и справочников…</div>;
 if(error&&!offer)return <p className="ved-offer-error">{error}</p>;
 return <div className="ved-whole-offer">
  <div className="ved-offer-heading">
   <div><h2>{offer?.quote_code} · общий расчёт</h2>
    <p>{offer?.supplier_code} · КП от {offer?.quote_date}. Один расчёт на всё КП, один товар на лист Excel.</p></div>
   <a href="/ved/commercial-offers">К списку КП</a>
  </div>
  <div className="ved-offer-summary">
   <div><small>Всего товаров</small><strong>{rows.length}</strong></div>
   <div><small>Рассчитано</small><strong>{ready}</strong></div>
   <div><small>Требуют данных</small><strong>{rows.length-ready}</strong></div>
   <label>Дата тарифов и расчёта<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
  </div>
  <p className="ved-offer-help">Пошлина не берётся из воздуха. Укажите подтверждённую ставку по конкретному ТН ВЭД. Все общие расходы и курсы загружены из справочника на дату открытия расчёта.</p>
  <div className="ved-offer-bulk">
   <label>Применить одну ставку пошлины ко всем товарам, % <input id="ved-bulk-duty" type="number" min="0" step="any" placeholder="Например, 10"/></label>
   <button type="button" onClick={()=>{
    const element=document.getElementById("ved-bulk-duty") as HTMLInputElement|null;
    bulkDuty(element?.value||"");
   }}>Применить ко всем</button>
  </div>
  {message&&<p role="status" className="ved-offer-help">{message}</p>}
  {error&&<p role="alert" className="ved-offer-error">{error}</p>}
  <div className="ved-offer-list">
   {preview.map((row,i)=>{
    const isSelected=selectedItem===row.itemId;
    const source=quoteItems.find(x=>x.id===row.itemId);
    return <section key={row.itemId} className="ved-offer-product">
     <div className="ved-offer-product-head">
      <button type="button" onClick={()=>setSelectedItem(isSelected?null:row.itemId)}>
       <strong>{i+1}. {row.article}</strong><span>{row.title.split("\n")[0]}</span>
      </button>
      <div className="ved-offer-product-cost">
       {row.result?<strong>{rub(row.result.averageCostPerUnitRub)} ₽/шт.</strong>:
        <span className="ved-offer-pending">Нужно уточнить</span>}
       <small>{row.result?"Среднее 40HQ и MOQ":row.errors.slice(0,2).join("; ")}</small>
      </div>
     </div>
     {isSelected&&<div className="ved-offer-product-editor">
      <div className="ved-offer-product-fields">
       <label className="ved-offer-input"><span>Наименование</span>
        <input value={row.input.product.productName||""} onChange={e=>patchProduct(row.itemId,"productName",e.target.value)}/></label>
       <label className="ved-offer-input"><span>ТН ВЭД (подтверждённый)</span>
        <input maxLength={10} value={row.input.product.tnVedCode||""} onChange={e=>patchProduct(row.itemId,"tnVedCode",e.target.value)}/></label>
       {field(row,"unitPriceCny","Цена, CNY/шт.")}
       {field(row,"unitsPerCarton","Штук в коробке")}
       {field(row,"moqUnits","MOQ, шт.")}
       {field(row,"cartonVolumeM3","Объём короба, м³")}
       {field(row,"cartonGrossKg","Брутто короба, кг")}
       <label className="ved-offer-input"><span>Пошлина адвалорная, %</span>
        <input type="number" min="0" step="any" value={numberField(row.input.customs.adValoremPercent)}
          onChange={e=>patchDuty(row.itemId,e.target.value===""?-1:Number(e.target.value))}/></label>
      </div>
      {source&&<p className="ved-offer-help">Источник: лист «{source.source_sheet}», строка {source.source_row}.
       Упаковка: {String(source.detected_data.packaging||"не указана")}.
       Фотографии и текст упаковки будут взяты непосредственно из оригинального Excel.</p>}
      {row.result?<div className="ved-offer-scenarios">
       <span>40HQ: <b>{rub(row.result.scenarios["40hq"].managementCostPerUnitRub)} ₽</b></span>
       <span>MOQ: <b>{rub(row.result.scenarios.moq.managementCostPerUnitRub)} ₽</b></span>
       <span>1 м³: <b>{rub(row.result.scenarios["one-cbm"].managementCostPerUnitRub)} ₽</b></span>
      </div>:<p className="ved-offer-error">{row.errors.join("; ")}</p>}
     </div>}
    </section>;
   })}
  </div>
  <div className="ved-offer-actions">
   <button type="button" disabled={!canEdit||busy||!rows.length} onClick={()=>void save()}>
    {busy?"Обрабатываем…":"Сохранить новую версию всего КП"}</button>
   <button type="button" disabled={!latestId||busy} onClick={()=>latestId&&void exportExcel(latestId)}>
    Выгрузить всё КП в Excel
   </button>
  </div>
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
