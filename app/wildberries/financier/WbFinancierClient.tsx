"use client";
import FinanceDynamics from "../../components/finance/FinanceDynamics";
import CopyArticle from "../../components/finance/CopyArticle";
import OrderFulfillmentPanels from "../../components/finance/OrderFulfillmentPanels";
import AccrualBreakdownList from '../../components/finance/AccrualBreakdownList';
import {downloadFinanceWorkbook} from "../../components/finance/export-xlsx";
import { Fragment, useEffect, useMemo, useState } from "react";
type Row={nm_id:string;article:string;name:string;master_code:string|null;manager:string;realization:number;gross_retail:number;to_transfer:number;delivery:number;storage_in_report:number|null;acceptance:number;penalty:number;deduction:number;rows:number;sales_units:number;return_units:number;buyouts:number;cogs:number|null;mayak_expense:number|null;preliminary_result:number|null;missing_rates:string[];cost_rub:number|null;mayak_rub:number|null;order_count:number;cancel_count:number;external_storage:number|null;operations:Record<string,{amount:number;count:number;realization:number;delivery:number;storage:number;penalty:number;deduction:number}>};
type Ad={nm_id:number;date:string;campaign_id:number;spend:number;views:number;clicks:number;orders:number;sum_price:number};
type Data={daily:Array<{day:string;rows:Array<{nm_id:string;revenue:number;profit:number|null;orders:number;buyouts:number}>}>;ok:boolean;from:string;to:string;financial_rows:number;rows:Row[];cache?:{status:string;rowsSaved:number};ads:{items:Ad[];campaigns:number;coverage:string;warning:string|null};orders?:{rows:number;coverage:string};storage?:{rows:number;coverage:string};coverage:Record<string,string>;notice:string;promotion_actual:number;other_deductions:number;unallocated?:Array<{name:string;amount:number;daily:Array<{date:string;amount:number;count:number}>}>};
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
const [managerInput,setManagerInput]=useState(''),[managerSaving,setManagerSaving]=useState(false),[historyBusy,setHistoryBusy]=useState(false);
async function load(refresh=false){if(blocked)return;setBusy(true);setError("");try{
const q=new URLSearchParams({from,to});const cached=reportCache.get(q.toString());if(!refresh&&cached&&Date.now()-cached.at<30*60*1000){setData(cached.data);setSelected('');return;}const r=await fetch("/api/agents/wb-finance?"+q,{cache:"no-store"});
const obj=await r.json();if(r.status===429&&obj.retryAt)setRetryAt(obj.retryAt);if(!r.ok||!obj.ok)throw new Error(obj.error??"Ошибка загрузки");setRetryAt("");reportCache.set(q.toString(),{at:Date.now(),data:obj});setData(obj);setSelected("");
}catch(e){setData(null);setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
async function syncAll(){setSyncing(true);setError("");setProgress("WB собирает финансы, заказы, рекламу и хранение. Это может занять несколько минут…");try{const response=await fetch("/api/agents/wb-finance-cron",{method:"POST",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error??body.finance?.error??"Не удалось запустить полную выгрузку WB");const aux=body.auxiliary??{};setProgress("Выгрузка завершена: финансы — "+String(body.finance?.status??"проверены")+", заказы — "+String(aux.orders?.rows??0)+", реклама — "+String(aux.advertising?.rows??0)+", хранение — "+String(aux.storage?.rows??aux.storage?.status??0)+".");reportCache.clear();await load(true);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSyncing(false);}}
const adsByNm=new Map<string,{spend:number;views:number;clicks:number;orders:number;sum_price:number}>();
for(const a of data?.ads.items??[]){const k=String(a.nm_id),v=adsByNm.get(k)??{spend:0,views:0,clicks:0,orders:0,sum_price:0};v.spend+=a.spend;v.views+=a.views;v.clicks+=a.clicks;v.orders+=a.orders;v.sum_price+=a.sum_price;adsByNm.set(k,v);}
const rows=(data?.rows??[]).filter(r=>(r.article+" "+r.nm_id+" "+r.name).toLowerCase().includes(filter.toLowerCase()));
const wholeSeries=useMemo(()=>(data?.daily??[]).map(d=>({day:d.day,v:{orders:null,buyouts:null,revenue:d.rows.reduce((s,r)=>s+r.revenue,0),profit:d.rows.some(r=>r.profit===null)?null:d.rows.reduce((s,r)=>s+Number(r.profit),0),marketplace:null,advertising:null,inbound:null}})),[data]);
const itemSeries=useMemo(()=>(data?.daily??[]).map(d=>({day:d.day,v:{orders:null,buyouts:null,revenue:d.rows.filter(r=>r.nm_id===selected).reduce((s,r)=>s+r.revenue,0),profit:d.rows.filter(r=>r.nm_id===selected).some(r=>r.profit===null)?null:d.rows.filter(r=>r.nm_id===selected).reduce((s,r)=>s+Number(r.profit),0),marketplace:null,advertising:null,inbound:null}})),[data,selected]);
const active=rows.find(r=>r.nm_id===selected);
function selectRow(r:Row){if(selected===r.nm_id){setSelected('');return;}setSelected(r.nm_id);setCostInput(r.cost_rub==null?'':String(r.cost_rub));setMayakInput(r.mayak_rub==null?'':String(r.mayak_rub));setManagerInput(r.manager==='Не назначен'?'':r.manager);}
async function saveRates(){if(!active)return;setSavingRates(true);setError('');try{
 const response=await fetch('/api/agents/wb-finance-rates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nm_id:active.nm_id,valid_from:validFrom,cost:costInput,mayak:mayakInput})});
 const body=await response.json();if(!response.ok)throw Error(body.error??'Ошибка сохранения');
 const id=active.nm_id;reportCache.clear();await load(true);setSelected(id);
 }catch(e){setError(e instanceof Error?e.message:'Ошибка сохранения');}finally{setSavingRates(false);}}

async function saveManager(){
 if(!active?.master_code)return;setManagerSaving(true);setError('');
 try{
  const res=await fetch('/api/agents/wb-finance-manager',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nm_id:active.nm_id,master_code:active.master_code,manager_name:managerInput})});
  const body=await res.json();if(!res.ok)throw Error(body.error??'Ошибка назначения КМ');
  const article=active.nm_id;reportCache.clear();await load(true);setSelected(article);
 }catch(e){setError(e instanceof Error?e.message:'Ошибка сохранения КМ');}finally{setManagerSaving(false);}
}
async function restoreOctober(){
 setHistoryBusy(true);setProgress('Проверяем выгрузку WB за 1–2 октября и лимит запросов…');
 try{
  const res=await fetch('/api/agents/wb-finance-history-cron',{method:'POST'}),body=await res.json();
  if(!res.ok)throw Error(body.error??'Ошибка восстановления WB');
  setProgress('История 1–2 октября: '+String(body.status??'обработка')+(body.retryAt?' · следующая попытка '+body.retryAt:''));
  reportCache.clear();if(body.status==='complete')await load(true);
 }catch(e){setError(e instanceof Error?e.message:'Ошибка восстановления WB');}finally{setHistoryBusy(false);}
}
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
   "Предварительный результат, ₽":r.preliminary_result,"Розничный оборот, ₽":r.gross_retail,"Реализация покупателя, ₽":r.realization,"К перечислению, ₽":r.to_transfer,
   "Логистика, ₽":r.delivery,"Отдельное хранение, ₽":r.external_storage,
   "Приёмка, ₽":r.acceptance,"Штрафы, ₽":r.penalty,"Продвижение/удержания, ₽":r.deduction,"Реклама по артикулам (справочно), ₽":ad,
   "Заказы, шт":r.order_count,"Отмены, шт":r.cancel_count,"Выкупы, шт":r.buyouts,
   "Себестоимость, ₽":r.cogs,"Себестоимость, ₽/шт":r.cost_rub,"ТК Маяк, ₽":r.mayak_expense,
   "ТК Маяк, ₽/шт":r.mayak_rub,"Чего не хватает":r.missing_rates.join("; ")};
  })},
  {name:"Итоги",rows:[{"Период с":from,"Период по":to,"Предварительный результат, ₽":exportRows.every(r=>r.preliminary_result!==null)?exportRows.reduce((sum,r)=>sum+(r.preliminary_result??0),0):null,
   "Розничный оборот, ₽":exportRows.reduce((sum,r)=>sum+r.gross_retail,0),"Реализация, ₽":exportRows.reduce((sum,r)=>sum+r.realization,0),"Продвижение по актам, ₽":data?.promotion_actual??null,"К перечислению, ₽":exportRows.reduce((sum,r)=>sum+r.to_transfer,0),"Артикулов":exportRows.length}]}
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
<button className="ozf-btn" disabled={historyBusy} onClick={()=>void restoreOctober()}>{historyBusy?'Восстанавливаем…':'Восстановить 1–2 октября'}</button>
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
<h2 id="wb-finance-main">Результаты по артикулам</h2>
<p>Данные за {data.from} – {data.to} включительно. Нажми на артикул для расшифровки.</p>
<div className="ozf-metrics" style={{marginTop:14}}>
{[["Оборот розничный",sum(r=>r.gross_retail)],["Реализация покупателя",sum(r=>r.realization)],["К перечислению WB",sum(r=>r.to_transfer)],["Продвижение (уже списано)",data.promotion_actual],["Заказы",sum(r=>r.order_count)],["Логистика",sum(r=>r.delivery)],["Штрафы/прочее",sum(r=>r.penalty)+data.other_deductions]].map(([label,value])=><div className="ozf-panel" key={String(label)}><span>{label}</span><strong>{money(Number(value))} ₽</strong></div>)}
</div>
{data.cache?.status!=="complete"&&<p className="ozf-error" role="alert">НЕПОЛНАЯ ВЫГРУЗКА: сохранено {data.cache?.rowsSaved?.toLocaleString("ru-RU")??"?"} строк. Финансовые итоги предварительные и не пригодны для решений.</p>}
<p className="ozf-notice" style={{marginTop:16}}>Покрытие: финансы — <b>{data.coverage.finance}</b>, заказы — <b>{data.coverage.orders}</b>, реклама — <b>{data.coverage.advertising}</b>, хранение — <b>{data.coverage.paid_storage}</b>. Неполные разделы не подменяются нулями. {data.ads.warning}</p>
<p className="ozf-notice">Разницу между оборотом по розничной цене и реализацией формируют скидки WB и состав операций. Удержания за продвижение уже входят в финансовый результат, рекламная статистика не списывается поверх них.</p>
<p className="ozf-notice">Артикулов с недостающими ставками: <b>{missingRateArticles}</b>. {allRatesFilled?<>Предварительный итог за выбранный период: <b>{money(sum(r=>r.preliminary_result??0))} ₽</b>. Реклама и хранение ещё не подтверждены.</>:<>После заполнения ставок по всем артикулам здесь появится предварительный итог.</>}</p>
<OrderFulfillmentPanels market="wb" from={data.from} to={data.to}/>
 <FinanceDynamics marketplace="wb" from={data.from} to={data.to} provided={wholeSeries} selected="revenue" expectedProfit={allRatesFilled?sum(r=>r.preliminary_result??0):null}/>
 {Boolean(data.unallocated?.length)&&<details className="ozf-panel ozf-collapsible-register" style={{marginTop:14}}><summary>Нераспределённые расходы WB · детализация по датам и ID</summary><AccrualBreakdownList market="wb" from={data.from} to={data.to} items={data.unallocated??[]} total={(data.unallocated??[]).reduce((s,x)=>s+x.amount,0)} totalLabel="Итого нераспределённые операции"/></details>}
<div className="ozf-toolbar" style={{marginTop:18}}><input placeholder="Поиск по артикулу, nmId или товару" value={filter} onChange={e=>setFilter(e.target.value)}/><span>Артикулов: {rows.length} · Финансовых операций: {data.financial_rows}</span></div>
<div className="ozf-financial-scroll"><table className="ozf-table ozf-financial-table" style={{minWidth:1980}}>
<thead><tr>{["Артикул","Артикул WB","Товар","Заказы","Отмены","Оборот розничный, ₽","Реализация, ₽","К перечислению, ₽","Логистика, ₽","Отдельное хранение, ₽","Приёмка, ₽","Штрафы, ₽","Продвижение/удержания, ₽","Реклама по артикулам, ₽","Себес + ТК Маяк, ₽","Предв. результат, ₽"].map(h=><th key={h}>{h}</th>)}</tr></thead>
<tbody>{rows.map(r=>{const ad=adsByNm.get(r.nm_id)?.spend??0;return <Fragment key={r.nm_id}><tr className={selected===r.nm_id?"ozf-row-active":""} onClick={()=>selectRow(r)}>
<td style={{color:'#98beff',whiteSpace:'nowrap'}}>▸ {r.article||'Не сопоставлен'} <CopyArticle article={r.article||r.nm_id}/></td><td>{r.nm_id}</td><td>{r.name||'—'}</td>
<td>{r.order_count}</td><td>{r.cancel_count}</td><td>{money(r.gross_retail)}</td><td>{money(r.realization)}</td><td>{money(r.to_transfer)}</td>
<td>{money(r.delivery)}</td><td>{r.external_storage==null?'Нет данных':money(r.external_storage)}</td><td>{money(r.acceptance)}</td><td>{money(r.penalty)}</td>
<td>{money(r.deduction)}</td><td>{adCovered?money(ad):'Нет данных'}</td>
<td>{r.cogs===null||r.mayak_expense===null?'Нужны ставки':money(r.cogs+r.mayak_expense)}</td>
<td title="Предварительно; необъективные расходы рекламы по SKU не выдуманы">{r.preliminary_result===null?'Нужны ставки':money(r.preliminary_result)+' *'}</td>
</tr>{selected===r.nm_id&&active&&<tr className="ozf-expanded-row"><td colSpan={16} onClick={e=>e.stopPropagation()}><div className="ozf-panel" style={{marginTop:18}}>
<div className="ozf-pinned-article"><strong>Детализация · {active.article||active.nm_id} · WB {active.nm_id}</strong><CopyArticle article={active.article||active.nm_id}/><a className="ozf-btn" href={'/finance/keywords?market=wb&article='+encodeURIComponent(active.nm_id)+'&from='+data.from+'&to='+data.to} onClick={e=>e.stopPropagation()}>Ключевые слова товара</a></div>
<div className="ozf-rate-editor"><h3>Себестоимость, ТК «Маяк» и КМ</h3><div className="ozf-filters"><label>КМ <input value={managerInput} onChange={e=>setManagerInput(e.target.value)} disabled={!active.master_code} placeholder="Не назначен"/></label><button className="ozf-btn" onClick={()=>void saveManager()} disabled={!active.master_code||managerSaving}>{managerSaving?'Сохраняем…':'Сохранить КМ'}</button></div>{!active.master_code&&<p className="ozf-error">Для назначения КМ требуется подтверждённый ЕНОТ.</p>}<div className="ozf-filters">
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
</div></td></tr>}</Fragment>})}</tbody>
<tfoot><tr><th colSpan={3}>Итого · {rows.length} артикулов</th><th>{sum(r=>r.order_count)}</th><th>{sum(r=>r.cancel_count)}</th>
<th>{money(sum(r=>r.gross_retail))}</th><th>{money(sum(r=>r.realization))}</th><th>{money(sum(r=>r.to_transfer))}</th>
<th>{money(sum(r=>r.delivery))}</th><th>{data.coverage.paid_storage==='cached_complete'?money(sum(r=>r.external_storage??0)):'Неполно'}</th>
<th>{money(sum(r=>r.acceptance))}</th><th>{money(sum(r=>r.penalty))}</th><th>{money(data.promotion_actual)}</th>
<th>{adCovered?money([...adsByNm.values()].reduce((t,v)=>t+v.spend,0)):'Нет данных'}</th>
<th>{allRatesFilled?money(sum(r=>(r.cogs??0)+(r.mayak_expense??0))):'Нужны ставки'}</th>
<th>{allRatesFilled?money(sum(r=>r.preliminary_result??0))+' *':'Нужны ставки'}</th></tr></tfoot></table></div>

</section>
</>}
</div>;
}
