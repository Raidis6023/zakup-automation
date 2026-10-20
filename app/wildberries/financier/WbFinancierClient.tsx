"use client";
import { useState } from "react";
type Row={nm_id:string;article:string;name:string;realization:number;to_transfer:number;delivery:number;storage_in_report:number;acceptance:number;penalty:number;deduction:number;rows:number;operations:Record<string,number>};
type Ad={nm_id:number;date:string;campaign_id:number;spend:number;views:number;clicks:number;orders:number;sum_price:number};
type Data={ok:boolean;from:string;to:string;financial_rows:number;rows:Row[];ads:{items:Ad[];campaigns:number;coverage:string;warning:string|null};coverage:Record<string,string>;notice:string};
const money=(v:number)=>v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const day=(offset:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
export default function WbFinancierClient(){
const [from,setFrom]=useState(()=>day(-14)),[to,setTo]=useState(()=>day(-1));
const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[filter,setFilter]=useState(""),[selected,setSelected]=useState("");
async function load(){setBusy(true);setError("");try{
const q=new URLSearchParams({from,to});const r=await fetch("/api/agents/wb-finance?"+q,{cache:"no-store"});
const obj=await r.json();if(!r.ok||!obj.ok)throw new Error(obj.error??"Ошибка загрузки");setData(obj);
}catch(e){setData(null);setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
const adsByNm=new Map<string,{spend:number;views:number;clicks:number;orders:number;sum_price:number}>();
for(const a of data?.ads.items??[]){const k=String(a.nm_id),v=adsByNm.get(k)??{spend:0,views:0,clicks:0,orders:0,sum_price:0};v.spend+=a.spend;v.views+=a.views;v.clicks+=a.clicks;v.orders+=a.orders;v.sum_price+=a.sum_price;adsByNm.set(k,v);}
const rows=(data?.rows??[]).filter(r=>(r.article+" "+r.nm_id+" "+r.name).toLowerCase().includes(filter.toLowerCase()));
const active=rows.find(r=>r.nm_id===selected);
return <section style={{padding:24,display:"grid",gap:18}}>
<div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
<label>С даты <input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
<label>По дату <input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
<button type="button" disabled={busy} onClick={load}>{busy?"Выгружаем...":"Получить детализацию WB"}</button>
<input placeholder="Артикул / nmId / название" value={filter} onChange={e=>setFilter(e.target.value)}/>
</div>
{error&&<p role="alert" style={{color:"#e57373"}}>{error}</p>}
{data&&<>
<p><strong>Получено финансовых строк: {data.financial_rows.toLocaleString("ru-RU")}</strong>. Кампаний рекламы: {data.ads.campaigns}. Статус рекламы: {data.ads.coverage}.</p>
<p role="status" style={{color:"#d9a441"}}>{data.notice} {data.ads.warning}</p>
<div style={{overflowX:"auto"}}>
<table style={{width:"100%",borderCollapse:"collapse",whiteSpace:"nowrap"}}>
<thead><tr>{["Артикул","nmId","Реализация, ₽","К перечислению, ₽","Логистика, ₽","Хранение в отчёте, ₽","Приёмка, ₽","Штрафы, ₽","Удержания, ₽","Реклама (статистика), ₽","Операции"].map(h=><th key={h} style={{padding:10,textAlign:"left",borderBottom:"1px solid #8885"}}>{h}</th>)}</tr></thead>
<tbody>{rows.map(r=><tr key={r.nm_id} onClick={()=>setSelected(r.nm_id)} style={{cursor:"pointer",background:selected===r.nm_id?"#7772":"transparent"}}>
<td style={{padding:8}}>{r.article||"Не сопоставлен"}</td><td>{r.nm_id}</td>
{[r.realization,r.to_transfer,r.delivery,r.storage_in_report,r.acceptance,r.penalty,r.deduction].map((v,i)=><td key={i} style={{padding:8,textAlign:"right"}}>{money(v)}</td>)}
<td style={{padding:8,textAlign:"right"}}>{data.ads.coverage==="stats_only"?money(adsByNm.get(r.nm_id)?.spend??0):"Нет данных"}</td>
<td style={{padding:8}}>{r.rows}</td></tr>)}</tbody></table></div>
{active&&<article style={{padding:16,border:"1px solid #8885",borderRadius:12}}>
<h3>Операции: {active.article||active.nm_id}</h3>
{Object.entries(active.operations).sort((a,b)=>a[0].localeCompare(b[0],"ru")).map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:12,padding:4}}><span>{k}</span><strong>{money(v)} ₽</strong></div>)}
</article>}
<h3>Подробная статистика рекламы</h3>
<div style={{overflowX:"auto"}}><table style={{width:"100%"}}><thead><tr>{["Дата","Кампания","nmId","Расход, ₽","Показы","Клики","Заказы","Продажи РК, ₽"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>
{data.ads.items.filter(x=>!filter||String(x.nm_id).includes(filter)).map((a,i)=><tr key={a.campaign_id+"-"+a.date+"-"+a.nm_id+"-"+i}><td>{a.date}</td><td>{a.campaign_id}</td><td>{a.nm_id}</td><td>{money(a.spend)}</td><td>{a.views}</td><td>{a.clicks}</td><td>{a.orders}</td><td>{money(a.sum_price)}</td></tr>)}
</tbody></table></div>
</>}
</section>;
}
