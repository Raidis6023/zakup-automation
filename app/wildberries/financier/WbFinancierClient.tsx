"use client";
import FinanceDynamics from "../../components/finance/FinanceDynamics";
import CopyArticle from "../../components/finance/CopyArticle";
import OrderFulfillmentPanels from "../../components/finance/OrderFulfillmentPanels";
import {downloadFinanceWorkbook} from "../../components/finance/export-xlsx";
import { useEffect, useMemo, useState } from "react";
type Row={nm_id:string;article:string;name:string;master_code:string|null;manager:string;realization:number;to_transfer:number;delivery:number;storage_in_report:number|null;acceptance:number;penalty:number;deduction:number;rows:number;sales_units:number;return_units:number;buyouts:number;cogs:number|null;mayak_expense:number|null;preliminary_result:number|null;missing_rates:string[];cost_rub:number|null;mayak_rub:number|null;order_count:number;cancel_count:number;external_storage:number|null;operations:Record<string,{amount:number;count:number;realization:number;delivery:number;storage:number;penalty:number;deduction:number}>};
type Ad={nm_id:number;date:string;campaign_id:number;spend:number;views:number;clicks:number;orders:number;sum_price:number};
type Data={daily:Array<{day:string;rows:Array<{nm_id:string;revenue:number}>}>;ok:boolean;from:string;to:string;financial_rows:number;rows:Row[];cache?:{status:string;rowsSaved:number};ads:{items:Ad[];campaigns:number;coverage:string;warning:string|null};orders?:{rows:number;coverage:string};storage?:{rows:number;coverage:string};coverage:Record<string,string>;notice:string};
const money=(v:number|null)=>v==null?"—":v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const day=(offset:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
const reportCache=new Map<string,{at:number;data:Data}>();
export default function WbFinancierClient(){
const [from,setFrom]=useState(()=>day(-14)),[to,setTo]=useState(()=>day(-1));
const [retryAt,setRetryAt]=useState(""),[now,setNow]=useState(Date.now());
useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(id);},[]);
const blocked=Boolean(retryAt&&Date.parse(retryAt)>now);
const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[syncing,setSyncing]=useState(false),[progress,setProgress]=useState(""),[filter,setFilter]=useState(""),[selected,setSelected]=useState("");
const [validFrom,setValidFrom]=useState(()=>day(-28)),[costInput,setCostInput]=useState(""),[mayakInput,setMayakInput]=useState(""),[savingRates,setSavingRates]=useState(false);
async function load(refresh=false){if(blocked)return;setBusy(true);setError("");try{
const q=new URLSearchParams({from,to});const cached=reportCache.get(q.toString());if(!refresh&&cached&&Date.now()-cached.at<30*60*1000){setData(cached.data);setSelected('');return;}const r=await fetch("/api/agents/wb-finance?"+q,{cache:"no-store"});
const obj=await r.json();if(r.status===429&&obj.retryAt)setRetryAt(obj.retryAt);if(!r.ok||!obj.ok)throw new Error(obj.error??"Ошибка загрузки");setRetryAt("");reportCache.set(q.toString(),{at:Date.now(),data:obj});setData(obj);setSelected("");
}catch(e){setData(null);setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
async function syncAll(){setSyncing(true);setError("");setProgress("WB собирает финансы, заказы, рекламу и хранение. Это может занять несколько минут…");try{const response=await fetch("/api/agents/wb-finance-cron",{method:"POST",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error??body.finance?.error??"Не удалось запустить полную выгрузку WB");const aux=body.auxiliary??{};setProgress("Выгрузка завершена: финансы — "+String(body.finance?.status??"проверены")+", заказы — "+String(aux.orders?.rows??0)+", реклама — "+String(aux.advertising?.rows??0)+", хранение — "+String(aux.storage?.rows??aux.storage?.status??0)+".");reportCache.clear();await load(true);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSyncing(false);}}
const adsByNm=new Map<string,{spend:number;views:number;clicks:number;orders:number;sum_price:number}>();
for(const a of data?.ads.items??[]){const k=String(a.nm_id),v=adsByNm.get(k)??{spend:0,views:0,clicks:0,orders:0,sum_price:0};v.spend+=a.spend;v.views+=a.views;v.clicks+=a.clicks;v.orders+=a.orders;v.sum_price+=a.sum_price;adsByNm.set(k,v);}
const rows=(data?.rows??[]).filter(r=>(r.article+" "+r.nm_id+" "+r.name).toLowerCase().includes(filter.toLowerCase()));
const wholeSeries=useMemo(()=>(data?.daily??[]).map(d=>({day:d.day,v:{orders:null,buyouts:null,revenue:d.rows.reduce((s,r)=>s+r.revenue,0),profit:null,marketplace:null,advertising:null,inbound:null}})),[data]);
const itemSeries=useMemo(()=>(data?.daily??[]).map(d=>({day:d.day,v:{orders:null,buyouts:null,revenue:d.rows.filter(r=>r.nm_id===selected).reduce((s,r)=>s+r.revenue,0),profit:null,marketplace:null,advertising:null,inbound:null}})),[data,selected]);
const active=rows.find(r=>r.nm_id===selected);
function selectRow(r:Row){if(selected===r.nm_id){setSelected('');return;}setSelected(r.nm_id);setCostInput(r.cost_rub==null?'':String(r.cost_rub));setMayakInput(r.mayak_rub==null?'':String(r.mayak_rub));}
async function saveRates(){if(!active)return;setSavingRates(true);setError('');try{
 const response=await fetch('/api/agents/wb-finance-rates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nm_id:active.nm_id,valid_from:validFrom,cost:costInput,mayak:mayakInput})});
 const body=await response.json();if(!response.ok)throw Error(body.error??'Ошибка сохранения');
 const id=active.nm_id;reportCache.clear();await load(true);setSelected(id);
 }catch(e){setError(e instanceof Error?e.message:'Ошибка сохранения');}finally{setSavingRates(false);}}

const sum=(fn:(r:Row)=>number)=>rows.reduce((t,r)=>t+fn(r),0);
const allRatesFilled=rows.length>0&&rows.every(r=>r.preliminary_result!==null);
const missingRateArticles=rows.filter(r=>r.missing_rates.length>0).length;
const adCovered=data?.ads.coverage==="cached_complete";
const exportRows=data?.rows??[];
const missingRows=exportRows.filter(r=>r.missing_rates.length>0||!r.master_code||r.manager==="Не назначен");
function exportFinancialResult(){
 return downloadFinanceWorkbook(`WB_финрез_${from}_${to}.xlsx`,[
  {name:"Финансовый результат",rows:exportRows.map(r=>{const ad=adsByNm.get(r.nm_id)?.spend??null;return {
   "Код товара":r.master_code,"КМ":r.manager,"Артикул":r.article,"nmId":r.nm_id,"Товар":r.name,
   "Предварительный результат, ₽":r.preliminary_result,"Реализация, ₽":r.realization,"К перечислению, ₽":r.to_transfer,
   "Логистика, ₽":r.delivery,"Хранение в реализации, ₽":r.storage_in_report,"Отдельное хранение, ₽":r.external_storage,
   "Приёмка, ₽":r.acceptance,"Штрафы, ₽":r.penalty,"Удержания, ₽":r.deduction,"Реклама, ₽":ad,
   "Заказы, шт":r.order_count,"Отмены, шт":r.cancel_count,"Выкупы, шт":r.buyouts,
   "Себестоимость, ₽":r.cogs,"Себестоимость, ₽/шт":r.cost_rub,"ТК Маяк, ₽":r.mayak_expense,
   "ТК Маяк, ₽/шт":r.mayak_rub,"Чего не хватает":r.missing_rates.join("; ")};
  })},
  {name:"Итоги",rows:[{"Период с":from,"Период по":to,"Предварительный результат, ₽":exportRows.every(r=>r.preliminary_result!==null)?exportRows.reduce((sum,r)=>sum+(r.preliminary_result??0),0):null,
   "Реализация, ₽":exportRows.reduce((sum,r)=>sum+r.realization,0),"К перечислению, ₽":exportRows.reduce((sum,r)=>sum+r.to_transfer,0),"Артикулов":exportRows.length}]}
 ]);
}
function exportMissingData(){
 return downloadFinanceWorkbook(`WB_недостающие_данные_${from}_${to}.xlsx`,[
  {name:"Недостающие данные",rows:missingRows.map(r=>({"Код товара":r.master_code,"Артикул":r.article,"nmId":r.nm_id,
   "Товар":r.name,"КМ":r.manager==="Не назначен"?"":r.manager,"Себестоимость, ₽/шт":r.cost_rub,
   "ТК Маяк, ₽/шт":r.mayak_rub,"Чего не хватает":r.missing_rates.join("; "),"Период с":from,"Период по":to}))}
 ]);
}
return <div className="ozf-layout">
<section className="ozf-panel">
<div className="ozf-filters">
<label>С даты <input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
<label>По дату включительно <input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
<label>КМ <select disabled><option>Все КМ · справочник ожидается</option></select></label>
<button className="ozf-btn ozf-primary" disabled={busy||blocked} onClick={()=>void load()}>{busy?"Загружаем...":blocked?"Лимит WB · ожидание":"Сформировать"}</button>
<button className="ozf-btn" disabled={busy||blocked} onClick={()=>void load(true)}>Обновить отчёт</button>
<button className="ozf-btn" disabled={busy||syncing} onClick={()=>void syncAll()}>{syncing?"Выгружаем все данные…":"Загрузить все данные WB"}</button>
<button className="ozf-btn" disabled={!data} onClick={()=>void exportFinancialResult()}>Скачать финрез XLSX</button>
<button className="ozf-btn" disabled={!data} onClick={()=>void exportMissingData()}>Недостающие данные XLSX · {missingRows.length}</button>
<a className="ozf-btn" aria-disabled={!data} href={data?`/api/agents/wb-finance-export?from=${from}&to=${to}`:undefined}>Скачать исходные данные XLSX</a>
</div>
{error&&<p className="ozf-error" role="alert">{error}</p>}
{progress&&<p className="ozf-progress" role="status">{progress}</p>}
{blocked&&<p className="ozf-notice">Запросы временно заблокированы. Следующая попытка после {new Date(retryAt).toLocaleTimeString("ru-RU",{timeZone:"Asia/Krasnoyarsk"})} (Красноярск). Осталось {Math.ceil((Date.parse(retryAt)-now)/1000)} сек.</p>}
</section>
{busy&&<div className="bi-skeleton" role="status">Подготавливаем полный отчёт…</div>}
{data&&!busy&&<>
<section className="ozf-panel">
<h2>Результаты по артикулам</h2>
<p>Данные за {data.from} – {data.to} включительно. Нажми на артикул для расшифровки.</p>
<div className="ozf-metrics" style={{marginTop:14}}>
{[["Реализация",sum(r=>r.realization)],["К перечислению WB",sum(r=>r.to_transfer)],["Заказы",sum(r=>r.order_count)],["Логистика",sum(r=>r.delivery)],["Штрафы и удержания",sum(r=>r.penalty+r.deduction)]].map(([label,value])=><div className="ozf-panel" key={String(label)}><span>{label}</span><strong>{money(Number(value))} ₽</strong></div>)}
</div>
{data.cache?.status!=="complete"&&<p className="ozf-error" role="alert">НЕПОЛНАЯ ВЫГРУЗКА: сохранено {data.cache?.rowsSaved?.toLocaleString("ru-RU")??"?"} строк. Финансовые итоги предварительные и не пригодны для решений.</p>}
<p className="ozf-notice" style={{marginTop:16}}>Покрытие: финансы — <b>{data.coverage.finance}</b>, заказы — <b>{data.coverage.orders}</b>, реклама — <b>{data.coverage.advertising}</b>, хранение — <b>{data.coverage.paid_storage}</b>. Неполные разделы не подменяются нулями. {data.ads.warning}</p>
<p className="ozf-notice">Артикулов с недостающими ставками: <b>{missingRateArticles}</b>. {allRatesFilled?<>Предварительный итог за выбранный период: <b>{money(sum(r=>r.preliminary_result??0))} ₽</b>. Реклама и хранение ещё не подтверждены.</>:<>После заполнения ставок по всем артикулам здесь появится предварительный итог.</>}</p>
<OrderFulfillmentPanels market="wb" from={data.from} to={data.to}/>
 <FinanceDynamics marketplace="wb" from={data.from} to={data.to} provided={wholeSeries} selected="revenue"/>
<div className="ozf-toolbar" style={{marginTop:18}}><input placeholder="Поиск по артикулу, nmId или товару" value={filter} onChange={e=>setFilter(e.target.value)}/><span>Артикулов: {rows.length} · Финансовых операций: {data.financial_rows}</span></div>
<div className="ozf-financial-scroll"><table className="ozf-table ozf-financial-table" style={{minWidth:1900}}>
<thead><tr>{["Артикул","nmId","Товар","Заказы, шт","Отмены, шт","Реализация, ₽","К перечислению, ₽","Логистика, ₽","Хранение в реализации, ₽","Отдельное хранение, ₽","Приёмка, ₽","Штрафы, ₽","Удержания, ₽","Реклама, ₽","Расходы всего, ₽","Предв. результат, ₽"].map(h=><th key={h}>{h}</th>)}</tr></thead>
<tbody>{rows.map(r=>{
const ad=adsByNm.get(r.nm_id)?.spend??0;
return <tr key={r.nm_id} className={selected===r.nm_id?"ozf-row-active":""} onClick={()=>selectRow(r)}>
<td style={{color:"#98beff",whiteSpace:"nowrap"}}>▸ {r.article||"Не сопоставлен"}<CopyArticle article={r.article||r.nm_id}/></td><td>{r.nm_id}</td><td>{r.name||"—"}</td>
<td>{r.order_count}</td><td>{r.cancel_count}</td><td>{money(r.realization)}</td><td>{money(r.to_transfer)}</td><td className="ozf-negative">{money(r.delivery)}</td>
<td>{r.storage_in_report==null?"Нет данных":money(r.storage_in_report)+" (из реализации)"}</td><td>{r.external_storage==null?"Нет данных":money(r.external_storage)}</td>
<td>{money(r.acceptance)}</td><td>{money(r.penalty)}</td><td>{money(r.deduction)}</td>
<td>{adCovered?money(ad):"Нет данных"}</td><td>{r.cogs===null||r.mayak_expense===null?"Нужны ставки":money(r.cogs+r.mayak_expense)}</td><td title="Предварительная оценка, не включает неподтверждённую рекламу">{r.preliminary_result===null?"Нужны ставки":money(r.preliminary_result)+" *"}</td>
</tr>})}</tbody>
<tfoot><tr><th colSpan={3}>Итого за период · {rows.length} артикулов</th><th>{sum(r=>r.order_count)}</th><th>{sum(r=>r.cancel_count)}</th><th>{money(sum(r=>r.realization))}</th><th>{money(sum(r=>r.to_transfer))}</th><th>{money(sum(r=>r.delivery))}</th><th>{data.coverage.finance==="cached_complete"?money(sum(r=>r.storage_in_report??0)):"Неполно"}</th><th>{data.coverage.paid_storage==="cached_complete"?money(sum(r=>r.external_storage??0)):"Неполно"}</th><th>{money(sum(r=>r.acceptance))}</th><th>{money(sum(r=>r.penalty))}</th><th>{money(sum(r=>r.deduction))}</th><th>{adCovered?money([...adsByNm.values()].reduce((t,v)=>t+v.spend,0)):"Нет данных"}</th><th>{allRatesFilled?money(sum(r=>(r.cogs??0)+(r.mayak_expense??0))):"Нужны ставки"}</th><th title="Предварительно, без неподтверждённой рекламы и хранения">{allRatesFilled?money(sum(r=>r.preliminary_result??0))+" *":"Нужны ставки"}</th></tr></tfoot>
</table></div>
{active&&<div className="ozf-panel" style={{marginTop:18}}>
<h2>Детализация: {active.article||active.nm_id}<CopyArticle article={active.article||active.nm_id}/></h2>
<div className="ozf-rate-editor"><h3>Себестоимость и ТК «Маяк»</h3><div className="ozf-filters">
<label>Действуют с <input type="date" value={validFrom} onChange={e=>setValidFrom(e.target.value)}/></label>
<label>Себестоимость, ₽/шт <input inputMode="decimal" value={costInput} onChange={e=>setCostInput(e.target.value)} placeholder="Не задана"/></label>
<label>ТК «Маяк», ₽/шт <input inputMode="decimal" value={mayakInput} onChange={e=>setMayakInput(e.target.value)} placeholder="Не задана"/></label>
<button className="ozf-btn ozf-primary" disabled={savingRates||busy} onClick={()=>void saveRates()}>{savingRates?"Сохраняем…":"Сохранить и пересчитать"}</button></div>
<p>Расчёт по датам операций. Продажи {active.sales_units}, возвраты {active.return_units}, выкупы {active.buyouts}. Себестоимость: {money(active.cogs)} ₽; ТК «Маяк»: {money(active.mayak_expense)} ₽. Предварительный результат: {money(active.preliminary_result)} ₽.</p>
{active.missing_rates.length>0&&<p className="ozf-error">Не хватает: {active.missing_rates.join(', ')}</p>}
</div><FinanceDynamics marketplace="wb" from={data.from} to={data.to} provided={itemSeries} selected="revenue"/>
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
