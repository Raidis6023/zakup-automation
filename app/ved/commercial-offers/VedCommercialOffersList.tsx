"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import "./ved-commercial-offers-list.css";
type Offer={id:string;quote_code:string;supplier_code:string;quote_date:string;original_file_name:string;
 file_size_bytes:number;status:string;item_count:number;import_notes:string;created_at:string};
type Item={id:string;offer_id:string;source_sheet:string;source_row:number;supplier_article:string;
 description_original:string;detected_data:Record<string,string|number|null>;
 missing_fields:string[];warnings:string[]};
type Response={ok:boolean;error?:string;offers?:Offer[];items?:Item[]};
const rub=(v:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(v);
export default function VedCommercialOffersList(){
 const [data,setData]=useState<Response|null>(null);
 const [open,setOpen]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  setBusy(true);
  try{
   const response=await fetch("/api/ved-commercial-offers",{cache:"no-store"});
   const result=await response.json() as Response;
   if(!response.ok||!result.ok)throw Error(result.error||"Не удалось получить КП");
   setData(result);
  }catch(e){setData({ok:false,error:e instanceof Error?e.message:"Ошибка загрузки"});}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{
  void load();
  window.addEventListener("ved-offers-updated",load);
  return ()=>window.removeEventListener("ved-offers-updated",load);
 },[load]);
 const openSource=async(id:string)=>{
  try{
   const response=await fetch("/api/ved-commercial-offers?download="+encodeURIComponent(id));
   const json=await response.json() as {ok:boolean;url?:string;error?:string};
   if(!response.ok||!json.ok||!json.url)throw Error(json.error||"Не удалось получить файл");
   window.open(json.url,"_blank","noopener,noreferrer");
  }catch(e){alert(e instanceof Error?e.message:"Не удалось открыть исходный файл");}
 };
 return <article className="ved-module-panel ved-quote-list">
  <div className="ved-quote-list-heading">
   <div><h2>Архив коммерческих предложений</h2>
    <p>Оригиналы Excel, распознанные товары и переход к первому расчёту. Даты и версии сохраняются.</p></div>
   <button type="button" onClick={()=>void load()} disabled={busy}>{busy?"Загрузка…":"Обновить"}</button>
  </div>
  {data?.error&&<p className="ved-quote-error">{data.error}</p>}
  {!busy&&data?.offers?.length===0&&<p className="ved-quote-muted">КП пока не загружены. Нажмите «Загрузить КП» сверху.</p>}
  <div className="ved-quote-entries">
   {(data?.offers||[]).map(offer=>{
    const rows=(data?.items||[]).filter(x=>x.offer_id===offer.id);
    const expanded=open===offer.id;
    return <section className="ved-quote-entry" key={offer.id}>
     <div className="ved-quote-entry-head">
      <button type="button" onClick={()=>setOpen(expanded?null:offer.id)} className="ved-quote-entry-toggle">
       <strong>{offer.quote_code}</strong>
       <span>{offer.supplier_code} · {offer.quote_date} · {offer.item_count} товаров</span>
       <small>{offer.original_file_name}</small>
      </button>
      <button type="button" className="ved-quote-original" onClick={()=>void openSource(offer.id)}>Исходный Excel</button>
     </div>
     <span className="ved-quote-status">{offer.status==="imported"?"Распознано":offer.status==="needs_review"?"Нужна проверка формата":offer.status==="uploading"?"Загрузка":"Ошибка"}</span>
     {offer.import_notes&&<p className="ved-quote-muted">{offer.import_notes}</p>}
     {expanded&&<div className="ved-quote-table-scroll">
      <table className="ved-quote-table"><thead><tr><th>Артикул</th><th>Наименование</th><th>Цена CNY</th><th>MOQ</th><th>Упаковка</th><th>Проверка</th><th>Действие</th></tr></thead>
       <tbody>{rows.map(item=>{
        const p=item.detected_data;
        return <tr key={item.id}>
         <td><strong>{item.supplier_article||"—"}</strong><small>{item.source_sheet}:{item.source_row}</small></td>
         <td title={item.description_original}>{item.description_original.split("\n")[0]?.slice(0,120)||"—"}</td>
         <td>{typeof p.unitPriceCny==="number"?rub(p.unitPriceCny):"—"}</td>
         <td>{typeof p.moqUnits==="number"?rub(p.moqUnits):"Не задано"}</td>
         <td>{typeof p.unitsPerCarton==="number"?p.unitsPerCarton+" шт/кор.":"—"}</td>
         <td>{item.missing_fields.length?
          <span title={item.missing_fields.join(", ")} className="ved-quote-warning">Уточнить: {item.missing_fields.length}</span>:
          <span className="ved-quote-ready">Данные КП заполнены</span>}
          {item.warnings.length>0&&<small title={item.warnings.join("; ")}>Требует проверки</small>}
         </td>
         <td><Link className="ved-quote-action" href={"/ved/registry/calculator?offerItem="+encodeURIComponent(item.id)}>Рассчитать</Link></td>
        </tr>;
       })}</tbody></table>
       {!rows.length&&<p className="ved-quote-muted">На выбранном КП нет распознанных товаров.</p>}
     </div>}
    </section>;
   })}
  </div>
 </article>;
}
