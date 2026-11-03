"use client";
import {useEffect,useState} from "react";
type Scheme={
 model:string;status:string;missing:string[];
 costGrossRub:number|null;volumeLiters:number|null;
 priceRub:number|null;priceAfterSppRub:number|null;targetPriceRub:number|null;
 profitRub:number|null;roi:number|null;margin:number|null;computedAt:string;
};
type Product={
 id:string;article:string;name:string;ved_created_at:string;
 cost_gross_rub:number|null;volume_liters:number|null;
 volume_source:string|null;source_type:string;source_version_id:string;
 schemes:Record<string,Scheme>;
};
const MODELS=[
 ["ozon-fbo","Ozon FBO"],["ozon-fbs","Ozon FBS"],
 ["wb-fbw","WB FBW"],["wb-fbs","WB FBS"],
 ["ym-fby","Яндекс FBY"],["ym-fbs","Яндекс FBS"]
] as const;
function formatNumber(n:number|null,percent=false){
 if(n===null||!Number.isFinite(n))return "—";
 const value=percent?n*100:n;
 if(value===0)return "0";
 const magnitude=Math.abs(value);
 for(let digits=0;digits<14;digits++){
  const unit=10**digits;
  const rounded=Math.round((magnitude+Number.EPSILON*magnitude)*unit)/unit;
  if(rounded!==0)return(value<0?"−":"")+new Intl.NumberFormat("ru-RU",{
   minimumFractionDigits:digits,maximumFractionDigits:digits
  }).format(rounded)+(percent?"%":"");
 }
 return String(value);
}
export default function VedUnitEconomicsLive(){
 const [products,setProducts]=useState<Product[]>([]);
 const [model,setModel]=useState<string>("ozon-fbo");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [revision,setRevision]=useState(0);
 const [retrying,setRetrying]=useState(false);
 async function retryQueue(){
  setRetrying(true);
  try{
   const response=await fetch("/api/unit-economics/prospective",{
    method:"POST",headers:{"Content-Type":"application/json"},
    credentials:"same-origin",body:JSON.stringify({action:"retry-pending"})
   });
   const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.error||"Не удалось обработать очередь");
   if(result.failures?.length)setError("Часть версий ожидает повторной обработки: "+result.failures.join("; "));
   setRevision(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setRetrying(false)}
 }
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/unit-economics/prospective",{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const body=await response.json();
    if(!response.ok||!body.ok)throw Error(body.error||"Не удалось прочитать новые товары");
    if(!controller.signal.aborted){setProducts(body.products||[]);setError("");}
   }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e))})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return ()=>controller.abort();
 },[revision]);
 return <section className="unit-pilot" style={{marginBottom:20}}>
  <div className="unit-pilot-top">
   <strong>Товары из реестра ВЭД · автоматическая юнит-экономика</strong>
   <div style={{display:"flex",gap:8}}>
    <button type="button" onClick={()=>{setLoading(true);setRevision(x=>x+1)}}>Обновить данные</button>
    <button type="button" disabled={retrying} onClick={()=>void retryQueue()}>
     {retrying?"Пересчёт…":"Обработать ожидающие версии"}
    </button>
   </div>
  </div>
  <p className="unit-pilot-notice">После сохранения версии ВЭД подтягиваются себестоимость, габариты и упаковка.
   При отсутствии категории, процента выкупа или WB СПП расчёт остаётся незавершённым.
   ЕНОТ новым товарам не присваивается.</p>
  <div className="unit-pilot-tabs" role="tablist" aria-label="Схема продаж">
   {MODELS.map(([key,label])=><button key={key} type="button" role="tab"
    aria-selected={model===key} className={model===key?"active":""}
    onClick={()=>setModel(key)}>{label}</button>)}
  </div>
  {loading?<p className="unit-pilot-notice">Загрузка записей ВЭД…</p>:
   error?<p className="unit-pilot-notice" role="alert">Невозможно прочитать автоматические расчёты: {error}</p>:
   !products.length?<p className="unit-pilot-notice">Пока нет рассчитанных товаров из сохранённых версий ВЭД.</p>:
   <div className="unit-pilot-scroller"><table className="unit-pilot-table">
    <thead><tr><th>Название / артикул</th><th>Себестоимость, ₽</th><th>Литраж ИУ</th>
     <th>Цена продажи, ₽</th><th>Чистая прибыль, ₽</th><th>ROI</th><th>Статус</th></tr></thead>
    <tbody>{products.map(p=>{
     const s=p.schemes[model];
     return <tr key={p.id}>
      <td className="unit-pilot-name">{p.name}<small>{p.article}</small></td>
      <td>{formatNumber(s?.costGrossRub??p.cost_gross_rub)}</td>
      <td>{formatNumber(s?.volumeLiters??p.volume_liters)}</td>
      <td>{formatNumber(s?.priceRub??null)}</td>
      <td>{formatNumber(s?.profitRub??null)}</td>
      <td>{formatNumber(s?.roi??null,true)}</td>
      <td title={(s?.missing||[]).join("; ")}>{s?.status==="calculated"?"Рассчитано":
       s?.status==="estimated"?"Предварительно":
       s?.status==="invalid_ved"?"Ошибка ВЭД":
       (s?.missing?.length?"Не хватает: "+s.missing.join(", "):"Ожидает данных")}</td>
     </tr>;
    })}</tbody>
   </table></div>}
 </section>;
}
