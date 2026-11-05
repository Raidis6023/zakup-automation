"use client";
import {useEffect,useState,type FormEvent} from "react";

type Model="ozon-fbo"|"ozon-fbs"|"wb-fbw"|"wb-fbs"|"ym-fby"|"ym-fbs";
type Expense={code:string;label:string;amount:number;formula:string;group:string};
type Scheme={
 model:Model;status:string;missing:string[];assumptions:string[];
 costGrossRub:number|null;costNetRub:number|null;purchaseVatCreditRub:number|null;
 volumeLiters:number|null;volumeFormula:string|null;volumeSource:string|null;
 unitWeightKg:number|null;unitWeightFormula:string|null;unitWeightWarning:string|null;
 priceRub:number|null;priceAfterSppRub:number|null;targetPriceRub:number|null;
 profitRub:number|null;roi:number|null;margin:number|null;outputVatRub:number|null;
 inputVatRub:number|null;commissionRate:number|null;
 expenses:Expense[];
 logistics:{lines:{code:string;label:string;amount:number;formula:string}[];
  warnings:string[];totals:{overall:number}}|null;
 settings:Record<string,unknown>;computedAt:string;
};
type Product={
 id:string;article:string;name:string;ved_created_at:string;edit_revision:number;
 overrides?:{name?:string;productType?:string;costGrossRub?:number;product?:Record<string,number>};
 input_data?:{product?:Record<string,string|number|null|undefined>};
 cost_gross_rub:number|null;volume_liters:number|null;unit_weight_kg:number|null;
 schemes:Record<string,Scheme>;
};
type WbCategory={name:string;group:string;fbw:number;fbs:number};
type MpstatsCategory={scope:"category"|"subject";path:string;label:string};
const MODELS:Record<"ozon"|"wb"|"ym",readonly Model[]>={
 ozon:["ozon-fbo","ozon-fbs"],wb:["wb-fbw","wb-fbs"],ym:["ym-fby","ym-fbs"]
};
const MARKETS:ReadonlyArray<readonly["ozon"|"wb"|"ym",string]>=
 [["ozon","Ozon"],["wb","Wildberries"],["ym","Яндекс Маркет"]];
const LABELS:Record<Model,string>={"ozon-fbo":"FBO","ozon-fbs":"FBS","wb-fbw":"FBW","wb-fbs":"FBS","ym-fby":"FBY","ym-fbs":"FBS"};
const INPUTS=[
 {key:"individualLengthCm",label:"Длина индивидуальной упаковки, см",integer:false},
 {key:"individualWidthCm",label:"Ширина индивидуальной упаковки, см",integer:false},
 {key:"individualHeightCm",label:"Высота индивидуальной упаковки, см",integer:false},
 {key:"cartonGrossKg",label:"Вес транспортировочной коробки брутто, кг",integer:false},
 {key:"cartonVolumeM3",label:"Объём транспортировочной коробки, м³",integer:false},
 {key:"unitsPerCarton",label:"Количество штук в коробке",integer:true},
 {key:"moqUnits",label:"MOQ, шт.",integer:true}
] as const;
function fmt(n:number|null|undefined,suffix=""){
 if(n===null||n===undefined||!Number.isFinite(n))return "—";
 if(n===0)return "0"+suffix;
 for(let d=0;d<=12;d++){
  const factor=10**d;
  const rounded=Math.round((Math.abs(n)+Number.EPSILON*Math.abs(n))*factor)/factor;
  if(rounded!==0)return(n<0?"−":"")+new Intl.NumberFormat("ru-RU",{
   minimumFractionDigits:d,maximumFractionDigits:d}).format(rounded)+suffix;
 }
 return String(n)+suffix;
}
const money=(v:number|null|undefined)=>fmt(v," ₽");
const percent=(v:number|null|undefined)=>fmt(v===null||v===undefined?null:v*100,"%");
const rateValue=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;
const groupName=(m:Model)=>m.startsWith("ozon")?"ozon":m.startsWith("wb")?"wb":"ym";

export default function VedUnitEconomicsLive({modalProductId,activeModel,onClose,onSaved}:{
 modalProductId:string|null;activeModel?:string;onClose:()=>void;onSaved?:()=>void;
}){
 const [product,setProduct]=useState<Product|null>(null);
 const [model,setModel]=useState<Model>((activeModel as Model)||"ozon-fbo");
 const [view,setView]=useState<"summary"|"details"|"inputs">("summary");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [dirty,setDirty]=useState<string[]>([]);
 const [revision,setRevision]=useState(0);
 const [categoryQuery,setCategoryQuery]=useState("");
 const [categoryMatches,setCategoryMatches]=useState<WbCategory[]>([]);
 const [categorySelected,setCategorySelected]=useState<WbCategory|null>(null);
 const [categoryBusy,setCategoryBusy]=useState(false);
 const [providerStatus,setProviderStatus]=useState<"checking"|"connected"|"missing">("checking");
 const [providerMessage,setProviderMessage]=useState("");
 const [mpstatsBusy,setMpstatsBusy]=useState(false);
 const [mappingOpen,setMappingOpen]=useState(false);
 const [mpstatsQuery,setMpstatsQuery]=useState("");
 const [mpstatsOptions,setMpstatsOptions]=useState<MpstatsCategory[]>([]);
 const [mpstatsSelected,setMpstatsSelected]=useState<MpstatsCategory|null>(null);
 const [mpstatsSearchError,setMpstatsSearchError]=useState("");
 const [mpstatsSearching,setMpstatsSearching]=useState(false);
 const [mpstatsMatches,setMpstatsMatches]=useState(0);
 const [actionMessage,setActionMessage]=useState("");
 const calc=product?.schemes[model];
 const market=groupName(model);
 const viewEntries:[typeof view,string][]=[["summary","Сводка"],["details","Все расчёты"],["inputs","Исходные данные"]];
 function editValues(p:Product,m:Model){
  const obj:Record<string,string>={
   name:p.overrides?.name??p.name,productType:p.overrides?.productType||"",
   costGrossRub:p.overrides?.costGrossRub!==undefined?String(p.overrides.costGrossRub):
     p.cost_gross_rub===null?"":String(p.cost_gross_rub),
   priceRub:p.schemes[m]?.priceRub===null||p.schemes[m]?.priceRub===undefined?"":String(p.schemes[m]?.priceRub)
  };
  for(const f of INPUTS){
   const value=p.overrides?.product?.[f.key]??p.input_data?.product?.[f.key];
   obj[f.key]=value===null||value===undefined?"":String(value);
  }
  setDraft(obj);setDirty([]);
 }
 function changeValue(field:string,value:string){
  setDraft(d=>({...d,[field]:value}));
  setDirty(d=>d.includes(field)?d:[...d,field]);
  setActionMessage("");
 }
 function selectModel(next:Model){
  if(dirty.length&&view==="inputs"){
   setActionMessage("Есть несохранённые изменения. Сначала сохраните их или отмените редактирование.");
   return;
  }
  setModel(next);
  if(product)editValues(product,next);
  setActionMessage("");
 }
 useEffect(()=>{
  const controller=new AbortController();
  if(!modalProductId)return;
  setLoading(true);
  fetch("/api/unit-economics/prospective?productId="+encodeURIComponent(modalProductId),
   {cache:"no-store",signal:controller.signal})
   .then(async r=>{const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||"Не удалось получить товар");
    return j.products as Product[];})
   .then(items=>{if(!controller.signal.aborted){
     if(!items.length)throw Error("Товар отсутствует в реестре расчётов");
     setProduct(items[0]);setError("");
   }})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e))})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[modalProductId,revision]);
 useEffect(()=>{
  if(product&&Object.keys(draft).length===0)editValues(product,model);
 // Intentional initialization after a new product loads.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[product]);
 useEffect(()=>{
  fetch("/api/unit-economics/mpstats-wb",{cache:"no-store"})
   .then(r=>r.json()).then(x=>setProviderStatus(x.configured?"connected":"missing"))
   .catch(()=>setProviderStatus("missing"));
 },[]);
 useEffect(()=>{
  if(!categoryQuery.trim()||categoryQuery.trim().length<2){setCategoryMatches([]);return;}
  const controller=new AbortController();
  const t=setTimeout(()=>{
   fetch("/api/unit-economics/wb-categories?q="+encodeURIComponent(categoryQuery),{signal:controller.signal})
    .then(r=>r.json()).then(r=>{if(!controller.signal.aborted)setCategoryMatches(r.items||[])})
    .catch(()=>{if(!controller.signal.aborted)setCategoryMatches([])});
  },200);
  return()=>{controller.abort();clearTimeout(t)};
 },[categoryQuery]);
 useEffect(()=>{
  if(!mappingOpen||mpstatsQuery.trim().length<2){setMpstatsOptions([]);return}
  const controller=new AbortController();
  const timer=window.setTimeout(()=>{
   setMpstatsSearching(true);setMpstatsSearchError("");
   const wbSettings=product?.schemes["wb-fbw"]?.settings||{};
   const group=typeof wbSettings.categoryGroup==="string"?wbSettings.categoryGroup:"";
   fetch("/api/unit-economics/mpstats-wb/categories?q="+encodeURIComponent(mpstatsQuery.trim())+
    "&group="+encodeURIComponent(group),{cache:"no-store",signal:controller.signal})
    .then(async response=>{
     const result=await response.json();
     if(!response.ok||!result.ok)throw Error(result.error||"Не удалось получить справочник MPStats");
     return result as {items:MpstatsCategory[];matched:number};
    })
    .then(result=>{if(!controller.signal.aborted){
     setMpstatsOptions(result.items||[]);
     setMpstatsMatches(result.matched||0);
    }})
    .catch(e=>{if(!controller.signal.aborted)setMpstatsSearchError(e instanceof Error?e.message:String(e))})
    .finally(()=>{if(!controller.signal.aborted)setMpstatsSearching(false)});
  },300);
  return()=>{controller.abort();window.clearTimeout(timer)};
 },[mappingOpen,mpstatsQuery,product]);
 useEffect(()=>{
  const handler=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!saving)onClose()};
  document.addEventListener("keydown",handler);
  const before=document.body.style.overflow;
  document.body.style.overflow="hidden";
  return()=>{document.removeEventListener("keydown",handler);document.body.style.overflow=before};
 },[onClose,saving]);
 async function refreshMpstats(p:Product,selection?:MpstatsCategory){
  // Проверка по фактическому защищённому хранилищу выполняется сервером при
  // каждом запросе. Не блокируем загрузку по устаревшему статусу UI.
  setMpstatsBusy(true);
  setProviderMessage("Получаем выкуп и среднюю СПП категории из MPStats…");
  try{
   const response=await fetch("/api/unit-economics/mpstats-wb",{
    method:"POST",headers:{"Content-Type":"application/json"},
    cache:"no-store",body:JSON.stringify({productId:p.id,...(selection?{mpstatsSelection:selection}:{})})
   });
   const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.error||"MPStats недоступен");
   if(!result.saved){
    setProviderMessage("MPStats: "+(result.error||"Подтверждённые показатели отсутствуют.")+
     " Существующие значения не заменены нулями.");
    return;
   }
   setProviderStatus("connected");
   setMappingOpen(false);setMpstatsSelected(null);
   setProviderMessage("MPStats: выкуп предмета WB "+percent(result.buyoutRate)+
    " (прогноз для Ozon FBO/FBS), средняя СПП WB "+percent(result.fbwSpp)+
    ". В расчётах сохранены WB FBW/FBS и Ozon FBO/FBS. "+
    (result.partial?"Часть данных не получена и осталась незаполненной.":"")+
    (result.sampledProducts?" Выборка СПП: "+result.sampledProducts+" товаров.":""));
   setRevision(n=>n+1);onSaved?.();
  }catch(e){
   const message=e instanceof Error?e.message:String(e);
   setProviderMessage("Не удалось загрузить MPStats: "+message);
   if(/соответств|предмет|категори|привязк/i.test(message)){
    setMappingOpen(true);
    const wb= p.schemes["wb-fbw"]?.settings||{};
    if(!mpstatsQuery)setMpstatsQuery(
     typeof wb.categoryId==="string"?wb.categoryId:"Ватные палочки"
    );
   }
  }finally{setMpstatsBusy(false)}
 }
 async function confirmWbCategory(){
  if(!product||!categorySelected)return;
  setCategoryBusy(true);setActionMessage("");setProviderMessage("");
  try{
   const response=await fetch("/api/unit-economics/prospective",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({productId:product.id,wbCategory:categorySelected})
   });
   const data=await response.json();
   if(!response.ok||!data.saved)throw Error(data.error||"Не удалось подтвердить предмет");
   setCategoryQuery(categorySelected.name);setCategoryMatches([]);
   setActionMessage("Категория WB подтверждена, комиссии FBW/FBS сохранены.");
   setRevision(n=>n+1);onSaved?.();
   await refreshMpstats(product);
  }catch(e){setActionMessage(e instanceof Error?e.message:String(e))}
  finally{setCategoryBusy(false)}
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!product||!dirty.length)return;
  const patch:Record<string,unknown>={},fields=new Set<string>(["name","productType","costGrossRub",...INPUTS.map(x=>x.key)]);
  for(const key of dirty){
   if(!fields.has(key))continue;
   const value=(draft[key]||"").trim().replace(",",".");
   patch[key]=key==="name"||key==="productType"?(value||null):value===""?null:Number(value);
  }
  const body:Record<string,unknown>={productId:product.id,model,productPatch:patch};
  if(dirty.includes("priceRub")){
   const value=(draft.priceRub||"").trim().replace(",",".");
   body.priceRub=value===""?null:Number(value);
  }
  setSaving(true);setActionMessage("");
  try{
   const response=await fetch("/api/unit-economics/prospective",{
    method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
   });
   const result=await response.json();
   if(!response.ok||!result.saved)throw Error(result.error||"Не удалось сохранить исходные данные");
   setDirty([]);setDraft({});setView("summary");setRevision(n=>n+1);onSaved?.();
   setActionMessage(result.warning||"Данные сохранены, расчёты обновлены.");
  }catch(e){setActionMessage(e instanceof Error?e.message:String(e))}
  finally{setSaving(false)}
 }
 if(!modalProductId)return null;
 const settings=calc?.settings||{};
 const category=typeof settings.categoryId==="string"?settings.categoryId:null;
 const commission=rateValue(settings.categoryCommissionRate);
 const buyout=rateValue(settings.buyoutRate);
 const spp=rateValue(settings.wbSppRate);
 return <div className="unit-pilot-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target&&!saving)onClose()}}>
  <div className="unit-pilot-modal" role="dialog" aria-modal="true" aria-labelledby="unit-ved-modal-title">
   <header className="unit-pilot-modal-head">
    <div className="unit-pilot-heading">
     <div className="unit-pilot-thumb" aria-hidden="true">Нет фото</div>
     <div>
      <h2 id="unit-ved-modal-title">{product?.name||"Расчёт товара из ВЭД"}</h2>
      <p>Артикул: {product?.article||"..."}</p>
     </div>
    </div>
    <button type="button" onClick={onClose} aria-label="Закрыть" disabled={saving}>×</button>
   </header>
   <div className="unit-pilot-modal-tabs">
    <div className="unit-market-tabs" role="tablist" aria-label="Маркетплейс">
     {MARKETS.map(([m,label])=><button type="button" role="tab" key={m} aria-selected={market===m}
      className={market===m?"active":""} onClick={()=>selectModel(MODELS[m][0])}>{label}</button>)}
    </div>
    <div className="unit-model-tabs" role="tablist" aria-label="Схема продаж">
     {MODELS[market].map(m=><button type="button" role="tab" key={m} aria-selected={m===model}
      className={m===model?"active":""} onClick={()=>selectModel(m)}>{LABELS[m]}</button>)}
    </div>
    <div className="unit-pilot-views">
     {viewEntries.map(([v,label])=><button type="button" key={v}
      className={view===v?"active":""} onClick={()=>setView(v)}>{label}</button>)}
    </div>
   </div>
   <div className="unit-pilot-modal-body">
    {loading&&<p className="unit-pilot-notice">Загрузка расчёта...</p>}
    {error&&<p className="unit-pilot-error" role="alert">{error}</p>}
    {actionMessage&&<p className="unit-pilot-notice" role="status">{actionMessage}</p>}
    {!loading&&product&&<>
     {view==="summary"&&<>
      <div className="unit-pilot-metrics">
       <div>ROI<strong className={calc?.roi!==null&&calc?.roi!==undefined&&calc.roi<0?"unit-pilot-red":"unit-pilot-green"}>{percent(calc?.roi)}</strong></div>
       <div>Чистая прибыль<strong>{money(calc?.profitRub)}</strong></div>
       <div>Маржинальность<strong>{percent(calc?.margin)}</strong></div>
      </div>
      <div className="unit-pilot-columns">
       <section className="unit-pilot-panel"><h3>Исходные данные</h3>
        <div className="unit-ved-facts">
         <div><span>Тип товара</span><strong>{product.overrides?.productType||"Не указан"}</strong></div>
         <div><span>Категория {market==="wb"?"WB":market==="ozon"?"Ozon":"Яндекс"}</span><strong>{category||"Требует подтверждения"}</strong></div>
         <div><span>Себестоимость с НДС</span><strong>{money(calc?.costGrossRub)}</strong></div>
         <div><span>Цена продажи</span><strong>{money(calc?.priceRub)}</strong></div>
         <div><span>Литраж ИУ</span><strong>{fmt(calc?.volumeLiters," л")}</strong></div>
         <div><span>Вес единицы (расчётный)</span><strong>{fmt(calc?.unitWeightKg," кг")}</strong></div>
         {market==="wb"&&<>
          <div><span>Выкуп WB по предмету</span><strong>{percent(buyout)}</strong></div>
          <div><span>СПП WB</span><strong>{percent(spp)}</strong></div>
         </>}
         {market==="ozon"&&<div><span>Прогноз выкупа из WB</span><strong>{percent(buyout)}</strong></div>}
        </div>
        <button className="unit-ved-edit-link" type="button" onClick={()=>setView("inputs")}>Изменить исходные данные</button>
       </section>
       <section className="unit-pilot-panel"><h3>Финансовый результат</h3>
        <div className="unit-ved-facts">
         <div><span>Цена продажи</span><strong>{money(calc?.priceRub)}</strong></div>
         <div><span>Себестоимость</span><strong>{money(calc?.costGrossRub)}</strong></div>
         <div><span>Комиссия маркетплейса</span><strong>{money(calc?.expenses?.find(x=>x.code==="commission")?.amount)}</strong></div>
         <div><span>Логистика и обработка</span><strong>{money(calc?.logistics?.totals.overall)}</strong></div>
         <div><span>Реклама</span><strong>{money(calc?.expenses?.find(x=>x.code==="advertising")?.amount)}</strong></div>
         <div><span>Исходящий НДС</span><strong>{money(calc?.outputVatRub)}</strong></div>
         <div><span>Входящий НДС</span><strong>{money(calc?.inputVatRub)}</strong></div>
         <div className="unit-ved-total"><span>Чистая прибыль</span><strong>{money(calc?.profitRub)}</strong></div>
        </div>
       </section>
      </div>
      {calc?.missing?.length?<div className="unit-pilot-notice"><strong>Для полного расчёта не хватает:</strong> {calc.missing.join("; ")}</div>:
       <p className="unit-pilot-note">Расчёт сформирован по сохранённым исходным данным. Результат: {calc?.status==="estimated"?"предварительный":"рассчитан"}.</p>}
      <div className="unit-pilot-panel unit-ved-target"><h3>Подбор цены по ROI <small>Цель 15,001%</small></h3>
       <div className="unit-ved-facts"><div><span>Текущая цена</span><strong>{money(calc?.priceRub)}</strong></div>
        <div><span>Рекомендуемая цена</span><strong>{money(calc?.targetPriceRub)}</strong></div></div>
      </div>
     </>}
     {view==="details"&&<>
      <section className="unit-pilot-panel"><h3>Все расчёты · {LABELS[model]}</h3>
       <p className="unit-pilot-note">Каждый расход сохраняется отдельно. Нерассчитанные показатели не заменяются нулями.</p>
       <div className="unit-ved-facts">
        <div><span>Себестоимость с НДС</span><strong>{money(calc?.costGrossRub)}</strong></div>
        <div><span>Себестоимость без входящего НДС</span><strong>{money(calc?.costNetRub)}</strong></div>
        <div><span>Входящий НДС закупки</span><strong>{money(calc?.purchaseVatCreditRub)}</strong></div>
        <div><span>Объём ИУ и источник</span><strong>{fmt(calc?.volumeLiters," л")} · {calc?.volumeSource||"нет источника"}</strong></div>
        <div><span>Формула литража</span><strong>{calc?.volumeFormula||"Не определена"}</strong></div>
        <div><span>Вес единицы</span><strong>{calc?.unitWeightFormula||calc?.unitWeightWarning||"Не рассчитан"}</strong></div>
        <div><span>Ставка комиссии</span><strong>{percent(calc?.commissionRate)}</strong></div>
       </div>
      </section>
      <section className="unit-pilot-panel"><h3>Постатейная детализация расходов</h3>
       {calc?.expenses?.length?calc.expenses.map(x=><details key={x.code} className="unit-pilot-field">
        <summary><span>{x.label}</span><strong>{money(x.amount)}</strong></summary>
        <p className="unit-pilot-note">Формула: {x.formula}</p>
       </details>):<p className="unit-pilot-notice">Расходы появятся после заполнения недостающих исходных параметров.</p>}
      </section>
      <section className="unit-pilot-panel"><h3>Логистика</h3>
       {calc?.logistics?.lines?.length?calc.logistics.lines.map(x=><div className="unit-ved-line" key={x.code}>
        <span>{x.label}<small>{x.formula}</small></span><strong>{money(x.amount)}</strong>
       </div>):<p className="unit-pilot-notice">Не рассчитана: требуется цена продажи и корректный литраж.</p>}
      </section>
      <section className="unit-pilot-panel"><h3>НДС и итог</h3><div className="unit-ved-facts">
       <div><span>Исходящий НДС</span><strong>{money(calc?.outputVatRub)}</strong></div>
       <div><span>Входящий НДС</span><strong>{money(calc?.inputVatRub)}</strong></div>
       <div><span>Чистая прибыль</span><strong>{money(calc?.profitRub)}</strong></div>
       <div><span>Маржинальность</span><strong>{percent(calc?.margin)}</strong></div>
       <div><span>ROI</span><strong>{percent(calc?.roi)}</strong></div>
      </div></section>
      {!!calc?.assumptions?.length&&<div className="unit-pilot-notice">Допущения: {calc.assumptions.join("; ")}</div>}
      {!!calc?.missing?.length&&<div className="unit-pilot-notice">Не хватает: {calc.missing.join("; ")}</div>}
     </>}
     {view==="inputs"&&<form className="unit-ved-editor" onSubmit={save}>
      <div className="unit-pilot-notice">Поля автоматически заполняются из последнего сохранённого расчёта ВЭД.
       Ручные изменения хранятся отдельно и не переписывают исходник. Вес товара вычисляется, редактировать его нельзя.</div>
      <label className="unit-ved-name-label">Название товара
       <input className="unit-pilot-price-input" required maxLength={300} value={draft.name||""} onChange={e=>changeValue("name",e.target.value)}/>
      </label>
      <p className="unit-pilot-note">Артикул: {product.article} (общий идентификатор, не редактируется)</p>
      <div className="unit-ved-input-grid">
       <label>Тип товара (заполняем вручную)
        <input className="unit-pilot-price-input" value={draft.productType||""} maxLength={150}
         onChange={e=>changeValue("productType",e.target.value)}/>
       </label>
       <label>Себестоимость с НДС, ₽
        <input className="unit-pilot-price-input" type="number" min="0.000001" step="any"
         value={draft.costGrossRub||""} onChange={e=>changeValue("costGrossRub",e.target.value)}/>
       </label>
       {INPUTS.map(f=><label key={f.key}>{f.label}
        <input className="unit-pilot-price-input" type="number"
         min={f.integer?"1":"0.000001"} step={f.integer?"1":"any"} inputMode={f.integer?"numeric":"decimal"}
         value={draft[f.key]||""} onChange={e=>changeValue(f.key,e.target.value)}/>
       </label>)}
       <label>Цена продажи, ₽ · {LABELS[model]}
        <input className="unit-pilot-price-input" type="number" min="0.01" step="any"
         value={draft.priceRub||""} onChange={e=>changeValue("priceRub",e.target.value)}/>
       </label>
       <label>Вес товара, кг · нередактируемое поле
        <output className="unit-ved-derived">
         {Number(draft.cartonGrossKg)>0&&Number.isSafeInteger(Number(draft.unitsPerCarton))&&Number(draft.unitsPerCarton)>0?
          fmt(Number(draft.cartonGrossKg)/Number(draft.unitsPerCarton)," кг"):"Нет данных"}
        </output>
       </label>
      </div>
      <div className="unit-ved-save-actions">
       <button type="button" onClick={()=>{editValues(product,model);setActionMessage("");}}>Отменить изменения</button>
       <button type="submit" className="unit-ved-primary" disabled={saving||dirty.length===0}>
        {saving?"Сохранение…":"Сохранить и пересчитать"}
       </button>
      </div>
      {market==="wb"&&<section className="unit-pilot-panel unit-ved-category-panel">
       <h3>Подтверждение категории Wildberries</h3>
       <p className="unit-pilot-note">Выбирайте предмет из реального справочника комиссий WB.
        После подтверждения комиссия подставится отдельно для FBW и FBS; затем запрашиваются показатели MPStats.</p>
       <label>Поиск категории WB
        <input className="unit-pilot-price-input" value={categoryQuery}
         onChange={e=>{setCategoryQuery(e.target.value);setCategorySelected(null)}} placeholder="Например, Ватные палочки"/>
       </label>
       {!!categoryMatches.length&&<div className="unit-ved-category-list">
        {categoryMatches.map((c,i)=><button type="button" key={c.name+":"+c.group+":"+i}
         onClick={()=>{setCategorySelected(c);setCategoryQuery(c.name);setCategoryMatches([])}}>
         <span>{c.name}<small>{c.group}</small></span><small>FBW {percent(c.fbw)} · FBS {percent(c.fbs)}</small>
        </button>)}
       </div>}
       <p className="unit-pilot-note">Текущая подтверждённая категория: <strong>
        {typeof settings.categoryId==="string"?settings.categoryId:"не выбрана"}</strong></p>
       {categorySelected&&<div className="unit-ved-category-choice">
        Выбрано: <strong>{categorySelected.name}</strong> ({categorySelected.group}),
        комиссия FBW {percent(categorySelected.fbw)}, FBS {percent(categorySelected.fbs)}.
       </div>}
       <button type="button" className="unit-ved-primary" disabled={!categorySelected||categoryBusy||mpstatsBusy}
        onClick={()=>void confirmWbCategory()}>
        {categoryBusy||mpstatsBusy?"Загрузка и пересчёт…":"Подтвердить категорию и получить MPStats"}
       </button>
       <p className="unit-pilot-note">MPStats: {providerStatus==="checking"?"проверка подключения":
        providerStatus==="connected"?"подключён":"нет серверного токена"}</p>
       {providerMessage&&<p role="status" className="unit-pilot-notice">{providerMessage}</p>}
       {typeof settings.categoryId==="string"&&<button type="button"
        className="unit-ved-edit-link" onClick={()=>{
         setMappingOpen(v=>!v);
         if(!mpstatsQuery)setMpstatsQuery(settings.categoryId as string);
        }}>
         {mappingOpen?"Скрыть выбор категории MPStats":"Выбрать категорию MPStats вручную"}
       </button>}
       {mappingOpen&&<div className="unit-ved-category-panel" style={{display:"flex",flexDirection:"column",gap:12,padding:14,border:"1px solid var(--ws-border)",borderRadius:10}}>
        <strong>Привязка категории WB к справочнику MPStats</strong>
        <p className="unit-pilot-note">
         Поиск идёт по реальным категориям и предметам MPStats. Выбранное соответствие
         сохранится для всех новых товаров этой категории WB.
        </p>
        <label>Название или часть пути категории MPStats
         <input className="unit-pilot-price-input" value={mpstatsQuery}
          onChange={e=>{setMpstatsQuery(e.target.value);setMpstatsSelected(null)}} 
          placeholder="Попробуйте: ватные, палочки, красота, гигиена"/>
        </label>
        {mpstatsSearching&&<p className="unit-pilot-note">Поиск в справочнике MPStats…</p>}
        {mpstatsSearchError&&<p role="alert" className="unit-pilot-error">{mpstatsSearchError}</p>}
        {!mpstatsSearching&&!mpstatsSearchError&&mpstatsQuery.length>1&&
         <p className="unit-pilot-note">{mpstatsMatches?"Найдено вариантов: "+mpstatsMatches:
          "Точного совпадения нет. Показаны доступные варианты из той же группы, если они есть."}</p>}
        {!!mpstatsOptions.length&&<div className="unit-ved-category-list">
         {mpstatsOptions.map(c=><button type="button" key={c.scope+":"+c.path}
          onClick={()=>{setMpstatsSelected(c);setMpstatsOptions([])}}>
          <span>{c.label}<small>{c.scope==="category"?"Категория MPStats":"Предмет MPStats"}</small></span>
         </button>)}
        </div>}
        {mpstatsSelected&&<div className="unit-ved-category-choice">
         Выбран источник MPStats: <strong>{mpstatsSelected.label}</strong>
         <small style={{display:"block"}}>Проверьте соответствие вашему товару перед сохранением.</small>
        </div>}
        <button type="button" className="unit-ved-primary"
         disabled={!mpstatsSelected||mpstatsBusy}
         onClick={()=>{if(mpstatsSelected)void refreshMpstats(product,mpstatsSelected)}}>
         {mpstatsBusy?"Загрузка…":"Привязать категорию и получить показатели"}
        </button>
       </div>}
       {typeof settings.categoryId==="string"&&<button type="button" disabled={mpstatsBusy} onClick={()=>void refreshMpstats(product)}>
        Обновить показатели MPStats
       </button>}
      </section>}
     </form>}
    </>}
   </div>
   <footer className="unit-pilot-modal-foot">
    <span>Источник: расчёт ВЭД от {product?new Date(product.ved_created_at).toLocaleDateString("ru-RU"):"…"} · оригинал не изменяется</span>
    <button type="button" onClick={onClose}>Закрыть</button>
   </footer>
  </div>
 </div>;
}
