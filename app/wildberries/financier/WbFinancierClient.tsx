"use client";
import FinanceDynamics from "../../components/finance/FinanceDynamics";
import WbAdvertisingCharts from "../../components/finance/WbAdvertisingCharts";
import CopyArticle from "../../components/finance/CopyArticle";
import OrderFulfillmentPanels from "../../components/finance/OrderFulfillmentPanels";
import AccrualBreakdownList from '../../components/finance/AccrualBreakdownList';
import {downloadFinanceWorkbook} from "../../components/finance/export-xlsx";
import { Fragment, useEffect, useMemo, useState } from "react";
type Row={nm_id:string;article:string;name:string;master_code:string|null;manager:string;realization:number;gross_retail:number;to_transfer:number;delivery:number;storage_in_report:number|null;acceptance:number;penalty:number;deduction:number;rows:number;sales_units:number;return_units:number;buyouts:number;cogs:number|null;mayak_expense:number|null;preliminary_result:number|null;allocated_ad:number|null;allocated_storage:number|null;missing_rates:string[];cost_rub:number|null;mayak_rub:number|null;order_count:number;cancel_count:number;external_storage:number|null;operations:Record<string,{amount:number;count:number;realization:number;delivery:number;storage:number;penalty:number;deduction:number}>};
type Ad={nm_id:number;date:string;campaign_id:number;spend:number;views:number;clicks:number;orders:number;sum_price:number;atbs:number};
type Data={daily:Array<{day:string;rows:Array<{nm_id:string;revenue:number;profit:number|null;orders:number;buyouts:number}>}>;ok:boolean;from:string;to:string;financial_rows:number;rows:Row[];cache?:{status:string;rowsSaved:number};ads:{items:Ad[];campaigns:number;coverage:string;warning:string|null};orders?:{rows:number;coverage:string};storage?:{rows:number;coverage:string};coverage:Record<string,string>;notice:string;promotion_actual:number;other_deductions:number;unallocated_financial:number;pending_allocation?:{advertising:number;storage:number};attributed?:{advertising:number;storage:number;storage_method:string};ad_sync?:{stage:string;last_error:string|null;processed:number;total:number;updated_at:string|null};unallocated?:Array<{name:string;amount:number;daily:Array<{date:string;amount:number;count:number}>}>};
const qty=(v:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(v);
function WbBreakdown({row}:{row:Row}){
 const items=[
 {name:'Продажи и возвраты по цене покупателя',category:'Доход',count:row.sales_units+row.return_units,amount:row.realization},
 {name:'Комиссии и корректировки WB',category:'Начисления WB',count:row.rows,amount:row.to_transfer-row.realization},
 {name:'Логистика WB',category:'Расход',count:row.rows,amount:-row.delivery},
 {name:'Платная приёмка',category:'Расход',count:row.rows,amount:-row.acceptance},
 {name:'Штрафы',category:'Расход',count:row.rows,amount:-row.penalty},
 {name:'Прочие удержания по артикулу',category:'Расход',count:row.rows,amount:-row.deduction},
 {name:'Хранение по nmId (из начислений)',category:'Расход',count:0,amount:row.allocated_storage===null?null:-row.allocated_storage},
 {name:'Продвижение по nmId (из начислений)',category:'Расход',count:0,amount:row.allocated_ad===null?null:-row.allocated_ad},
 {name:'Себестоимость товаров',category:'Внешний расход',count:row.buyouts,amount:row.cogs===null?null:-row.cogs},
 {name:'ТК Маяк',category:'Внешний расход',count:row.sales_units,amount:row.mayak_expense===null?null:-row.mayak_expense}
 ];
 return <table className="ozf-breakdown-table"><thead><tr><th>Статья доходов / расходов</th><th>Категория</th><th>Операций</th><th>Общая сумма за период, ₽</th></tr></thead><tbody>
 {items.filter(x=>x.amount===null||Math.abs(x.amount)>.005).map((x,i)=><tr key={x.name+i}><td>{x.name}</td><td>{x.category}</td><td>{x.count||'—'}</td><td className={x.amount===null?'':x.amount<0?'ozf-bad':'ozf-good'}>{x.amount===null?'Нет данных':money(x.amount)}</td></tr>)}
 <tr className="ozf-breakdown-total"><td>Операционная прибыль</td><td>Итог, предварительно</td><td>—</td><td className={row.preliminary_result!==null&&row.preliminary_result<0?'ozf-bad':'ozf-good'}>{row.preliminary_result===null?'Нужны ставки':money(row.preliminary_result)}</td></tr>
 </tbody></table>;
}
const money=(v:number|null)=>v==null?"—":v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const day=(offset:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
const reportCache=new Map<string,{at:number;data:Data}>();
export default function WbFinancierClient(){
const [from,setFrom]=useState(()=>day(-14)),[to,setTo]=useState(()=>day(-1));
const [retryAt,setRetryAt]=useState(""),[now,setNow]=useState(Date.now());
useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(id);},[]);
const blocked=Boolean(retryAt&&Date.parse(retryAt)>now);
const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[syncing,setSyncing]=useState(false),[progress,setProgress]=useState(""),[filter,setFilter]=useState(""),[selected,setSelected]=useState("");
const [sort,setSort]=useState<{key:string;dir:1|-1}>({key:"profit",dir:-1});
const [validFrom,setValidFrom]=useState(()=>day(-28)),[costInput,setCostInput]=useState(""),[mayakInput,setMayakInput]=useState(""),[savingRates,setSavingRates]=useState(false);
const [managerInput,setManagerInput]=useState(''),[managerSaving,setManagerSaving]=useState(false),[historyBusy,setHistoryBusy]=useState(false),[adsSyncing,setAdsSyncing]=useState(false);
async function load(refresh=false){if(blocked)return;setBusy(true);setError("");try{
const q=new URLSearchParams({from,to});const cached=reportCache.get(q.toString());if(!refresh&&cached&&Date.now()-cached.at<30*60*1000){setData(cached.data);setSelected('');return;}const r=await fetch("/api/agents/wb-finance?"+q,{cache:"no-store"});
const obj=await r.json();if(r.status===429&&obj.retryAt)setRetryAt(obj.retryAt);if(!r.ok||!obj.ok)throw new Error(obj.error??"Ошибка загрузки");setRetryAt("");reportCache.set(q.toString(),{at:Date.now(),data:obj});setData(obj);setSelected("");
}catch(e){setData(null);setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
async function syncAll(){setSyncing(true);setError("");setProgress("WB собирает финансы, заказы, рекламу и хранение. Это может занять несколько минут…");try{const response=await fetch("/api/agents/wb-finance-cron",{method:"POST",cache:"no-store"});const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error??body.finance?.error??"Не удалось запустить полную выгрузку WB");const aux=body.auxiliary??{};setProgress("Выгрузка завершена: финансы — "+String(body.finance?.status??"проверены")+", заказы — "+String(aux.orders?.rows??0)+", реклама — "+String(aux.advertising?.rows??0)+", хранение — "+String(aux.storage?.rows??aux.storage?.status??0)+".");reportCache.clear();await load(true);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSyncing(false);}}
async function syncAdvertising(){
 setAdsSyncing(true);setError('');setProgress('Загружаем рекламу WB отдельно от заказов и финансов; сохраняем прогресс по кампаниям…');
 try{
  const response=await fetch('/api/agents/wb-finance-aux-sync?scope=ads',{method:'POST',cache:'no-store'});
  const body=await response.json();
  const x=body.advertising??{};
  if(!response.ok||!body.ok)throw Error(x.error??body.error??'Не удалось загрузить рекламу WB');
  setProgress(x.status==='partial'?'Реклама WB: обработано '+String(x.processed??0)+' из '+String(x.total??0)+' кампаний. Нажми кнопку ещё раз для продолжения.':'Рекламные кампании WB загружены. Обновляем отчёт.');
  reportCache.clear();await load(true);
 }catch(e){setError(e instanceof Error?e.message:'Ошибка рекламной выгрузки');}finally{setAdsSyncing(false);}
}
const adsByNm=new Map<string,{spend:number;views:number;clicks:number;orders:number;sum_price:number}>();
for(const a of data?.ads.items??[]){const k=String(a.nm_id),v=adsByNm.get(k)??{spend:0,views:0,clicks:0,orders:0,sum_price:0};v.spend+=a.spend;v.views+=a.views;v.clicks+=a.clicks;v.orders+=a.orders;v.sum_price+=a.sum_price;adsByNm.set(k,v);}
const rows=(data?.rows??[]).filter(r=>r.nm_id!=='unallocated').filter(r=>(r.article+" "+r.nm_id+" "+r.name).toLowerCase().includes(filter.toLowerCase()));
const columns=[['master_code','ЕНОТ'],['manager','КМ'],['article','Артикул'],['nm_id','Артикул WB'],['profit','Операционная прибыль, ₽'],['revenue','Выручка, ₽'],['advertising','Реклама, ₽'],['drr','ДРР'],['storage','Хранение, ₽'],['orders','Заказы'],['cancels','Отмены'],['buyouts','Выкупы'],['delivery','Логистика, ₽'],['acceptance','Приёмка, ₽'],['penalty','Штрафы, ₽'],['cogs','Себестоимость, ₽'],['mayak','ТК Маяк, ₽'],['perUnit','Прибыль/ед., ₽']] as const;
type Key=typeof columns[number][0];
const value=(r:Row,k:Key):number|string|null=>{
 switch(k){case 'master_code':case 'manager':case 'article':case 'nm_id':return r[k]??'';
 case 'profit':return r.preliminary_result;case 'revenue':return r.gross_retail;case 'advertising':return r.allocated_ad;
 case 'drr':return r.allocated_ad===null||r.gross_retail<=0?null:r.allocated_ad/r.gross_retail*100;
 case 'storage':return r.allocated_storage;case 'orders':return r.order_count;case 'cancels':return r.cancel_count;
 case 'buyouts':return r.buyouts;case 'delivery':return r.delivery;case 'acceptance':return r.acceptance;
 case 'penalty':return r.penalty;case 'cogs':return r.cogs;case 'mayak':return r.mayak_expense;
 case 'perUnit':return r.preliminary_result===null||r.buyouts<=0?null:r.preliminary_result/r.buyouts;}
};
const sortedRows=[...rows].sort((a,b)=>{const x=value(a,sort.key as Key),y=value(b,sort.key as Key);
 if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;
 return (typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''),'ru',{numeric:true}))*sort.dir;});
const wholeSeries=useMemo(()=>(data?.daily??[]).map(d=>({day:d.day,v:{orders:d.rows.reduce((s,r)=>s+r.orders,0),buyouts:d.rows.reduce((s,r)=>s+r.buyouts,0),revenue:d.rows.reduce((s,r)=>s+r.revenue,0),profit:d.rows.some(r=>r.profit===null)?null:d.rows.reduce((s,r)=>s+Number(r.profit),0),marketplace:null,advertising:null,inbound:null}})),[data]);

const display=(r:Row,k:Key)=>{
 const v=value(r,k);
 if(k==='master_code'||k==='manager'||k==='nm_id')return String(v||'—');
 if(k==='orders'||k==='cancels'||k==='buyouts')return qty(Number(v??0));
 if(k==='drr')return typeof v==='number'?v.toLocaleString('ru-RU',{maximumFractionDigits:2})+' %':'—';
 if(k==='article')return r.article||r.nm_id;
 if(v===null)return k==='profit'||k==='cogs'||k==='mayak'?'Нужны ставки':'Нет данных';
 if(typeof v!=='number')return String(v);
 return money(['advertising','storage','delivery','acceptance','penalty','cogs','mayak'].includes(k)?-v:v);
};
const totalFor=(k:Key):number|null=>{
 if(k==='profit')return allRatesFilled?profitTotal:null;
 if(k==='advertising')return data?.ads.coverage==='cached_complete'?data.attributed?.advertising??0:null;
 if(k==='storage')return data?.storage?.coverage==='cached_complete'?data.attributed?.storage??0:null;
 if(k==='drr'){const revenue=sum(r=>r.gross_retail),ad=data?.attributed?.advertising;return data?.ads.coverage==='cached_complete'&&ad!==undefined&&revenue>0?100*ad/revenue:null;}
 if(k==='perUnit'){const u=sum(r=>r.buyouts);return allRatesFilled&&u>0?profitTotal/u:null;}
 if(['master_code','manager','article','nm_id'].includes(k))return null;
 if(k==='cogs'||k==='mayak')return allRatesFilled?sum(r=>Number(value(r,k)??0)):null;
 return sum(r=>Number(value(r,k)??0));
};
const itemSeries=useMemo(()=>(data?.daily??[]).map(d=>({day:d.day,v:{orders:d.rows.filter(r=>r.nm_id===selected).reduce((s,r)=>s+r.orders,0),buyouts:d.rows.filter(r=>r.nm_id===selected).reduce((s,r)=>s+r.buyouts,0),revenue:d.rows.filter(r=>r.nm_id===selected).reduce((s,r)=>s+r.revenue,0),profit:d.rows.filter(r=>r.nm_id===selected).some(r=>r.profit===null)?null:d.rows.filter(r=>r.nm_id===selected).reduce((s,r)=>s+Number(r.profit),0),marketplace:null,advertising:null,inbound:null}})),[data,selected]);
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
const profitTotal=sum(r=>r.preliminary_result??0)+(data?.unallocated_financial??0);
const totalAdRevenueByDay=Object.fromEntries((data?.daily??[]).map(d=>[d.day,d.rows.reduce((total,r)=>total+r.revenue,0)]));
const missingRateArticles=rows.filter(r=>r.missing_rates.length>0).length;
const adCovered=data?.ads.coverage==="cached_complete";
const exportRows=data?.rows??[];
const missingRows=exportRows.filter(r=>r.missing_rates.length>0||!r.master_code||r.manager==="Не назначен");
function exportFinancialResult(){
 return downloadFinanceWorkbook(`WB_финрез_${from}_${to}.xlsx`,[
  {name:"Финансовый результат",rows:exportRows.map(r=>{const ad=adsByNm.get(r.nm_id)?.spend??null;return {
   "Код товара":r.master_code,"КМ":r.manager,"Артикул":r.article,"nmId":r.nm_id,"Товар":r.name,
   "Операционная прибыль, ₽":r.preliminary_result,"Выручка, ₽":r.gross_retail,"Реклама, ₽":r.allocated_ad,"Хранение, ₽":r.allocated_storage,
   "Логистика, ₽":r.delivery,
   "Приёмка, ₽":r.acceptance,"Штрафы, ₽":r.penalty,"Продвижение/удержания, ₽":r.deduction,"Реклама по артикулам (справочно), ₽":ad,
   "Заказы, шт":r.order_count,"Отмены, шт":r.cancel_count,"Выкупы, шт":r.buyouts,
   "Себестоимость, ₽":r.cogs,"Себестоимость, ₽/шт":r.cost_rub,"ТК Маяк, ₽":r.mayak_expense,
   "ТК Маяк, ₽/шт":r.mayak_rub,"Чего не хватает":r.missing_rates.join("; ")};
  })},
  {name:"Итоги",rows:[{"Период с":from,"Период по":to,"Предварительный результат, ₽":exportRows.every(r=>r.preliminary_result!==null)?exportRows.reduce((sum,r)=>sum+(r.preliminary_result??0),0):null,
   "Выручка, ₽":exportRows.filter(r=>r.nm_id!=="unallocated").reduce((sum,r)=>sum+r.gross_retail,0),"Реклама распределена, ₽":data?.attributed?.advertising??null,"Реклама ожидает распределения, ₽":data?.pending_allocation?.advertising??null,"Хранение распределено, ₽":data?.attributed?.storage??null,"Артикулов":exportRows.length}]}
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
<button className="ozf-btn" disabled={adsSyncing} onClick={()=>void syncAdvertising()}>{adsSyncing?'Загружаем рекламу…':'Загрузить рекламу WB'}</button>
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
{[{label:'Операционная прибыль',value:allRatesFilled?profitTotal:null,unit:'₽'},{label:'Выручка',value:sum(r=>r.gross_retail),unit:'₽'},{label:'Реклама',value:data.attributed?.advertising??null,unit:'₽'},{label:'Хранение',value:data.attributed?.storage??null,unit:'₽'},{label:'Заказы',value:sum(r=>r.order_count),unit:'шт.'},{label:'Выкупы',value:sum(r=>r.buyouts),unit:'шт.'}].map(item=><div className="ozf-panel" key={item.label}><span>{item.label}</span><strong>{item.value===null?'Нет данных':item.unit==='шт.'?qty(item.value):money(item.value)} {item.unit}</strong></div>)}
</div>
{data.cache?.status!=="complete"&&<p className="ozf-error" role="alert">НЕПОЛНАЯ ВЫГРУЗКА: сохранено {data.cache?.rowsSaved?.toLocaleString("ru-RU")??"?"} строк. Финансовые итоги предварительные и не пригодны для решений.</p>}
<p className="ozf-notice" style={{marginTop:16}}>Покрытие: финансы — <b>{data.coverage.finance}</b>, заказы — <b>{data.coverage.orders}</b>, реклама — <b>{data.coverage.advertising}</b>, хранение — <b>{data.coverage.paid_storage}</b>. Неполные разделы не подменяются нулями. {data.ads.warning}</p>
<p className="ozf-notice">Все расходы WB учитываются в финансовом результате один раз. Хранение и продвижение распределяются по артикулам при наличии подтверждённой детализации.</p>
 {(Boolean(data.pending_allocation?.advertising)||Boolean(data.pending_allocation?.storage))&&<p className="ozf-error">Уже включены в общий финансовый результат, но ожидают распределения по артикулам: реклама {money(data.pending_allocation?.advertising??0)} ₽, хранение {money(data.pending_allocation?.storage??0)} ₽.</p>}
<p className="ozf-notice">Артикулов с недостающими ставками: <b>{missingRateArticles}</b>. {allRatesFilled?<>Предварительный итог за выбранный период (с нераспределёнными расходами): <b>{money(profitTotal)} ₽</b>. Реклама и хранение ещё не подтверждены.</>:<>После заполнения ставок по всем артикулам здесь появится предварительный итог.</>}</p>
<OrderFulfillmentPanels market="wb" from={data.from} to={data.to}/>
 <FinanceDynamics marketplace="wb" from={data.from} to={data.to} provided={wholeSeries} selected="revenue" expectedProfit={allRatesFilled?profitTotal:null}/>
 <WbAdvertisingCharts rows={data.ads.items} from={data.from} to={data.to} complete={data.ads.coverage==='cached_complete'} revenues={totalAdRevenueByDay}/>
 <p className="ozf-notice">Статус рекламной выгрузки: <b>{data.ad_sync?.stage??'не запускалась'}</b>{data.ad_sync?.last_error?' · '+data.ad_sync.last_error:''}. В столбце рекламы не показываем ноль, пока нет подтверждённых данных WB.</p>

<div className="ozf-toolbar" style={{marginTop:18}}><input placeholder="Поиск по артикулу, nmId или товару" value={filter} onChange={e=>setFilter(e.target.value)}/><span>Артикулов: {rows.length} · Финансовых операций: {data.financial_rows}</span></div>
<div className="ozf-financial-scroll" role="region" aria-label="Финансовый результат WB">
<table className="ozf-table ozf-financial-table" style={{minWidth:1950}}>
<thead><tr>{columns.map(([k,label])=><th key={k}><button type="button" className="ozf-sort-control" onClick={()=>setSort(old=>({key:k,dir:old.key===k&&old.dir===-1?1:-1}))}>{label}{sort.key===k?(sort.dir===-1?' ↓':' ↑'):' ↕'}</button></th>)}</tr></thead>
<tbody>{sortedRows.map(r=><Fragment key={r.nm_id}><tr className={selected===r.nm_id?'ozf-row-active':''}>
{columns.map(([k])=><td key={k} className={['advertising','storage','delivery','acceptance','penalty','cogs','mayak'].includes(k)?'ozf-bad':k==='profit'&&r.preliminary_result!==null?(r.preliminary_result<0?'ozf-bad':'ozf-good'):''}>
{k==='article'?<><button className="ozf-article-btn" aria-expanded={selected===r.nm_id} onClick={()=>selectRow(r)}>{selected===r.nm_id?'▾':'▸'} {r.article||r.nm_id}</button><CopyArticle article={r.article||r.nm_id}/></>:display(r,k)}
</td>)}</tr>
{selected===r.nm_id&&active&&<tr className="ozf-expanded-row"><td colSpan={columns.length} onClick={e=>e.stopPropagation()}><div className="ozf-expanded-content">
<div className="ozf-pinned-article"><strong>{active.article||active.nm_id} · WB {active.nm_id}</strong><CopyArticle article={active.article||active.nm_id}/><a className="ozf-btn" href={'/finance/keywords?market=wb&article='+encodeURIComponent(active.nm_id)+'&from='+data.from+'&to='+data.to} onClick={e=>e.stopPropagation()}>Ключевые слова товара</a></div>
<p>{active.name||"Товар WB"} · {active.rows} строк финансового отчёта · {data.from} — {data.to}</p><WbBreakdown row={active}/><details className="ymf-rate-edit"><summary>Изменить КМ, себестоимость и ТК «Маяк»</summary><div className="ozf-rate-editor"><h3>Тарифы и коммерческий менеджер</h3><div className="ozf-filters"><label>КМ <input value={managerInput} onChange={e=>setManagerInput(e.target.value)} disabled={!active.master_code} placeholder="Не назначен"/></label><button className="ozf-btn" onClick={()=>void saveManager()} disabled={!active.master_code||managerSaving}>{managerSaving?'Сохраняем…':'Сохранить КМ'}</button></div>{!active.master_code&&<p className="ozf-error">Для назначения КМ требуется подтверждённый ЕНОТ.</p>}<div className="ozf-filters">
<label>Действуют с <input type="date" value={validFrom} onChange={e=>setValidFrom(e.target.value)}/></label>
<label>Себестоимость, ₽/шт <input inputMode="decimal" value={costInput} onChange={e=>setCostInput(e.target.value)} placeholder="Не задана"/></label>
<label>ТК «Маяк», ₽/шт <input inputMode="decimal" value={mayakInput} onChange={e=>setMayakInput(e.target.value)} placeholder="Не задана"/></label>
<button className="ozf-btn ozf-primary" disabled={savingRates||busy} onClick={()=>void saveRates()}>{savingRates?"Сохраняем…":"Сохранить и пересчитать"}</button></div>
<p>Расчёт по датам операций. Продажи {active.sales_units}, возвраты {active.return_units}, выкупы {active.buyouts}. Себестоимость: {money(active.cogs)} ₽; ТК «Маяк»: {money(active.mayak_expense)} ₽. Предварительный результат: {money(active.preliminary_result)} ₽.</p>
{active.missing_rates.length>0&&<p className="ozf-error">Не хватает: {active.missing_rates.join(', ')}</p>}
</div></details><FinanceDynamics marketplace="wb" from={data.from} to={data.to} provided={itemSeries} selected="revenue"/>
<WbAdvertisingCharts rows={data.ads.items} from={data.from} to={data.to} complete={data.ads.coverage==='cached_complete'} nmId={active.nm_id} revenues={totalAdRevenueByDay}/>


</div></td></tr>}</Fragment>)}</tbody>
<tfoot><tr><th colSpan={4}>Итого · {rows.length} артикулов</th>
{columns.slice(4).map(([k])=><th key={k} className={['advertising','storage','delivery','acceptance','penalty','cogs','mayak'].includes(k)?'ozf-bad':''}>
{totalFor(k)===null?'Нет данных':k==='drr'?totalFor(k)!.toLocaleString('ru-RU',{maximumFractionDigits:2})+' %':k==='orders'||k==='cancels'||k==='buyouts'?qty(totalFor(k)!):money(['advertising','storage','delivery','acceptance','penalty','cogs','mayak'].includes(k)?-totalFor(k)!:totalFor(k)!)}
</th>)}</tr></tfoot>
</table></div>
 {Boolean(data.unallocated?.length)&&<details className="ozf-panel ozf-collapsible-register" style={{marginTop:14}}><summary>Нераспределённые прочие расходы WB · детализация по датам и ID</summary><AccrualBreakdownList market="wb" from={data.from} to={data.to} items={data.unallocated??[]} total={(data.unallocated??[]).reduce((s,x)=>s+x.amount,0)} totalLabel="Итого нераспределённые операции"/></details>}
</section>
</>}
</div>;
}
