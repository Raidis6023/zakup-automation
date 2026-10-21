"use client";
import { useEffect, useState } from "react";
type Row={nm_id:string;article:string;name:string;realization:number;to_transfer:number;delivery:number;storage_in_report:number|null;acceptance:number;penalty:number;deduction:number;rows:number;operations:Record<string,{amount:number;count:number;realization:number;delivery:number;storage:number;penalty:number;deduction:number}>};
type Ad={nm_id:number;date:string;campaign_id:number;spend:number;views:number;clicks:number;orders:number;sum_price:number};
type Data={ok:boolean;from:string;to:string;financial_rows:number;rows:Row[];ads:{items:Ad[];campaigns:number;coverage:string;warning:string|null};coverage:Record<string,string>;notice:string};
const money=(v:number|null)=>v==null?"—":v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const day=(offset:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
export default function WbFinancierClient(){
const [from,setFrom]=useState(()=>day(-14)),[to,setTo]=useState(()=>day(-1));
const [retryAt,setRetryAt]=useState(""),[now,setNow]=useState(Date.now());
useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(id);},[]);
const blocked=Boolean(retryAt&&Date.parse(retryAt)>now);
const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[filter,setFilter]=useState(""),[selected,setSelected]=useState("");
async function load(){if(blocked)return;setBusy(true);setError("");try{
const q=new URLSearchParams({from,to});const r=await fetch("/api/agents/wb-finance?"+q,{cache:"no-store"});
const obj=await r.json();if(r.status===429&&obj.retryAt)setRetryAt(obj.retryAt);if(!r.ok||!obj.ok)throw new Error(obj.error??"Ошибка загрузки");setRetryAt("");setData(obj);
}catch(e){setData(null);setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
const adsByNm=new Map<string,{spend:number;views:number;clicks:number;orders:number;sum_price:number}>();
for(const a of data?.ads.items??[]){const k=String(a.nm_id),v=adsByNm.get(k)??{spend:0,views:0,clicks:0,orders:0,sum_price:0};v.spend+=a.spend;v.views+=a.views;v.clicks+=a.clicks;v.orders+=a.orders;v.sum_price+=a.sum_price;adsByNm.set(k,v);}
const rows=(data?.rows??[]).filter(r=>(r.article+" "+r.nm_id+" "+r.name).toLowerCase().includes(filter.toLowerCase()));
const active=rows.find(r=>r.nm_id===selected);
const sum=(fn:(r:Row)=>number)=>rows.reduce((t,r)=>t+fn(r),0);
const adCovered=data?.ads.coverage==="stats_only";
return <div className="ozf-layout">
<section className="ozf-panel">
<div className="ozf-filters">
<label>С даты <input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
<label>По дату включительно <input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
<label>КМ <select disabled><option>Все КМ · справочник ожидается</option></select></label>
<button className="ozf-btn ozf-primary" disabled={busy||blocked} onClick={load}>{busy?"Загружаем...":blocked?"Лимит WB · ожидание":"Сформировать"}</button>
<button className="ozf-btn" disabled={busy||blocked} onClick={load}>Обновить отчёт</button>
</div>
{error&&<p className="ozf-error" role="alert">{error}</p>}
{blocked&&<p className="ozf-notice">Запросы временно заблокированы. Следующая попытка после {new Date(retryAt).toLocaleTimeString("ru-RU",{timeZone:"Asia/Krasnoyarsk"})} (Красноярск). Осталось {Math.ceil((Date.parse(retryAt)-now)/1000)} сек.</p>}
</section>
{data&&<>
<section className="ozf-panel">
<h2>Результаты по артикулам</h2>
<p>Данные за {data.from} – {data.to} включительно. Нажми на артикул для расшифровки.</p>
<div className="ozf-metrics" style={{marginTop:14}}>
{[["Реализация",sum(r=>r.realization)],["К перечислению WB",sum(r=>r.to_transfer)],["Логистика",sum(r=>r.delivery)],["Штрафы и удержания",sum(r=>r.penalty+r.deduction)]].map(([label,value])=><div className="ozf-panel" key={String(label)}><span>{label}</span><strong>{money(Number(value))} ₽</strong></div>)}
</div>
<p className="ozf-notice" style={{marginTop:16}}>Не рассчитана прибыль: нет себестоимости и ТК «Маяк». Платное хранение не загружено отдельным отчётом. {data.ads.warning}</p>
<div className="ozf-toolbar" style={{marginTop:18}}><input placeholder="Поиск по артикулу, nmId или товару" value={filter} onChange={e=>setFilter(e.target.value)}/><span>Артикулов: {rows.length} · Финансовых операций: {data.financial_rows}</span></div>
<div className="ozf-financial-scroll"><table className="ozf-table ozf-financial-table" style={{minWidth:1900}}>
<thead><tr>{["Артикул","nmId","Товар","Реализация, ₽","К перечислению, ₽","Логистика, ₽","Хранение, ₽","Приёмка, ₽","Штрафы, ₽","Удержания, ₽","Реклама, ₽","Расходы всего, ₽","Финрезультат, ₽"].map(h=><th key={h}>{h}</th>)}</tr></thead>
<tbody>{rows.map(r=>{
const ad=adsByNm.get(r.nm_id)?.spend??0;
return <tr key={r.nm_id} className={selected===r.nm_id?"ozf-row-active":""} onClick={()=>setSelected(selected===r.nm_id?"":r.nm_id)}>
<td style={{color:"#98beff"}}>▸ {r.article||"Не сопоставлен"}</td><td>{r.nm_id}</td><td>{r.name||"—"}</td>
<td>{money(r.realization)}</td><td>{money(r.to_transfer)}</td><td className="ozf-negative">{money(r.delivery)}</td>
<td>{r.storage_in_report==null?"Нет данных":money(r.storage_in_report)+" (из реализации)"}</td>
<td>{money(r.acceptance)}</td><td>{money(r.penalty)}</td><td>{money(r.deduction)}</td>
<td>{adCovered?money(ad):"Нет данных"}</td><td>Нет полных данных</td><td>Не рассчитан</td>
</tr>})}</tbody>
<tfoot><tr><th colSpan={3}>Итого за период · {rows.length} артикулов</th><th>{money(sum(r=>r.realization))}</th><th>{money(sum(r=>r.to_transfer))}</th><th>{money(sum(r=>r.delivery))}</th><th>Нет данных</th><th>{money(sum(r=>r.acceptance))}</th><th>{money(sum(r=>r.penalty))}</th><th>{money(sum(r=>r.deduction))}</th><th>{adCovered?money([...adsByNm.values()].reduce((t,v)=>t+v.spend,0)):"Нет данных"}</th><th>—</th><th>—</th></tr></tfoot>
</table></div>
{active&&<div className="ozf-panel" style={{marginTop:18}}>
<h2>Детализация: {active.article||active.nm_id}</h2>
<p>{active.name||""} · nmId {active.nm_id} · {active.rows} строк реализации</p>
<div className="ozf-table-scroll"><table className="ozf-table"><thead><tr>{["Операция","Строк","К перечислению, ₽","Реализация, ₽","Логистика, ₽","Хранение, ₽","Штраф, ₽","Удержание, ₽"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>
{Object.entries(active.operations).sort((a,b)=>a[0].localeCompare(b[0],"ru")).map(([name,v])=><tr key={name}><td>{name}</td><td>{v.count}</td><td>{money(v.amount)}</td><td>{money(v.realization)}</td><td>{money(v.delivery)}</td><td>{money(v.storage)}</td><td>{money(v.penalty)}</td><td>{money(v.deduction)}</td></tr>)}
</tbody></table></div>
<p className="ozf-footnote">Суммы показаны по полям отчёта реализации, не как рассчитанная прибыль. Рекламная статистика учтётся после сверки фактических списаний WB.</p>
</div>}
</section>
</>}
</div>;
}
