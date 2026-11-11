'use client';
import { DateField } from "@/app/ui/WorkspaceDateFields";
import {useEffect,useRef,useState} from 'react';
import {rules} from '../../../lib/yandex/finance';
import type {readFinance} from '../../../lib/yandex/finance-cache';
import YandexFinanceTable,{type RateInput} from './YandexFinanceTable';
import AccrualBreakdownList from '../../components/finance/AccrualBreakdownList';
import {downloadFinanceWorkbook} from '../../components/finance/export-xlsx';
import {clearFinanceSeries} from '../../components/finance/finance-series-cache';
import OrderFulfillmentPanels from '../../components/finance/OrderFulfillmentPanels';
type Data=NonNullable<Awaited<ReturnType<typeof readFinance>>>&{partial_coverage?:boolean;requested_from?:string;requested_to?:string;coverage_warning?:string};
const money=(n:number)=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.sign(n)*Math.round(Math.abs(n)/100)||0)+' ₽';
const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Krasnoyarsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift=(day:string,delta:number)=>new Date(Date.parse(day+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10);
export default function YandexFinancierClient({initial,initialError}:{initial:Data|null;initialError:string}){
 const defaultTo=shift(localDay(),-1),defaultFrom=shift(defaultTo,-27);
 const [from,setFrom]=useState(initial?.from??defaultFrom),[to,setTo]=useState(initial?.to??defaultTo);
 const [adBusy,setAdBusy]=useState(false),[adStatus,setAdStatus]=useState('');
 const [rateRevision,setRateRevision]=useState(0);
  const [data,setData]=useState(initial),[error,setError]=useState(initialError),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[savingRate,setSavingRate]=useState(false),[statusSaving,setStatusSaving]=useState(false);
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 async function request(url:string,body?:unknown){const r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error??'Ошибка запроса');return d;}
 async function load(){setError('');setBusy(true);try{const d=await request(`/api/agents/yandex-finance?from=${from}&to=${to}`);if(alive.current){setData(d);setProgress(d.coverage_warning??'');}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Ошибка');}finally{if(alive.current)setBusy(false);}}
 // A failed report cached by SSR must not keep covering newly published
 // daily finance snapshots until the user presses Generate. Query current
 // confirmed history once on mount and preserve any incomplete-period warning.
 const initialReloaded=useRef(false);
 useEffect(()=>{
  if(initialError&&!initialReloaded.current){
   initialReloaded.current=true;
   void load();
  }
 },[initialError]);
 async function sync(){setBusy(true);setError('');try{
  if(to>shift(localDay(),-1))throw new Error('Нельзя выгружать будущие даты. Последний полный календарный день: '+shift(localDay(),-1)+'.');
  let job=await request('/api/agents/yandex-finance-sync',{action:'start',from,to});
  const phases:Record<string,string>={services_request:'Запрос отчёта услуг',services_poll:'ЯМ формирует отчёт услуг',orders_request:'Ожидание лимита перед запросом заказов',orders_poll:'ЯМ формирует отчёт заказов',order_units_pull:'Загрузка количества заказанных единиц',done:'Готово'};
  while(alive.current&&job.status==='loading'){
   setProgress(`${phases[job.phase]??job.phase} · ${job.date_from} — ${job.date_to}`);
   job=await request('/api/agents/yandex-finance-sync',{action:'advance',id:job.id});
   if(job.status==='loading')await new Promise(resolve=>setTimeout(resolve,job.phase==='order_units_pull'?500:8000));
  }
  if(job.status==='failed')throw new Error(job.error??'Не удалось загрузить отчёты');
  if(alive.current){setProgress(job.error?'Отчёты загружены. '+job.error:'Отчёты загружены');setData(await request(`/api/agents/yandex-finance?from=${from}&to=${to}`));}
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Ошибка');}finally{if(alive.current)setBusy(false);}}
 async function saveRate(value:RateInput){setSavingRate(true);setBusy(true);setError('');try{
  await request('/api/agents/yandex-finance-rates',value);
  clearFinanceSeries();
  setRateRevision(n=>n+1);
  if(data&&alive.current){
   const fresh:Data=await request(`/api/agents/yandex-finance?from=${data.from}&to=${data.to}`);
   setData(fresh);
   const target=fresh.rows.find(r=>r.article===value.article);
   const stillMissing=target?.result===null&&target.dataGaps.length>0;
   setProgress(value.valid_from>data.to?'Тариф сохранён с '+value.valid_from+'. Он не меняет выбранный период.':
    stillMissing?'Тариф сохранён. Прибыль пока не полная: '+target.dataGaps.join('; '):
    'Тариф сохранён. Финансовый расчёт и графики обновлены.');
  }
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Ошибка сохранения');}
 finally{if(alive.current){setSavingRate(false);setBusy(false);}}}
 async function toggleStatus(master:string,checked:boolean){setStatusSaving(true);setError('');try{await request('/api/agents/yandex-finance-status',{master_code:master,discontinued:checked});if(alive.current)setData(current=>current?{...current,rows:current.rows.map(r=>r.master_code===master?{...r,discontinued:checked}:r)}:current);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Не удалось сохранить статус');}finally{if(alive.current)setStatusSaving(false);}}
 async function saveManager(article:string,manager:string){await request('/api/agents/yandex-finance-manager',{article,manager});if(data)setData(await request(`/api/agents/yandex-finance?from=${data.from}&to=${data.to}`));}
 function exportFinancialResult(){
  if(!data)return Promise.resolve();
  const rows=data.rows.map(r=>({"Код товара":r.master_code,"КМ":r.manager,"Артикул":r.article,"Товар":r.name,
   "Операционная прибыль, ₽":r.result===null?null:r.result/100,"Выручка, ₽":r.income/100,
   "Реклама, ₽":-r.advertising/100,"ДРР, %":r.drr===null?null:r.drr*100,"Хранение, ₽":-r.storage/100,
   "Заказы, шт":r.orders,"Отмены, шт":r.cancelledTotal,"Выкупы, шт":r.buyouts,
   "Себестоимость, ₽":r.cogs===null?null:-r.cogs/100,"Себестоимость, ₽/шт":r.unitCost===null?null:r.unitCost/100,
   "ТК Маяк, ₽":r.mayak===null?null:-r.mayak/100,"ТК Маяк, ₽/шт":r.mayakUnit===null?null:r.mayakUnit/100,
   "Чего не хватает":r.dataGaps.join("; "),...Object.fromEntries(rules.map(([name])=>[name+", ₽",-(r.expenses[name]??0)/100]))}));
  return downloadFinanceWorkbook(`ЯМ_финрез_${data.from}_${data.to}.xlsx`,[
   {name:"Финансовый результат",rows},
   {name:"Итоги",rows:[{"Период с":data.from,"Период по":data.to,"Операционная прибыль, ₽":data.totals.result===null?null:data.totals.result/100,
    "Выручка, ₽":data.totals.income/100,"Реклама, ₽":-data.totals.advertising/100,"Хранение, ₽":-data.totals.storage/100,
    "Заказы, шт":data.totals.orders,"Выкупы, шт":data.totals.buyouts,"Артикулов":data.rows.length}]}
  ]);
 }
 function exportMissingData(){
  if(!data)return Promise.resolve();
  const missing=data.rows.filter(r=>r.dataGaps.length>0||!r.master_code||r.manager==="Не назначен");
  return downloadFinanceWorkbook(`ЯМ_недостающие_данные_${data.from}_${data.to}.xlsx`,[
   {name:"Недостающие данные",rows:missing.map(r=>({"Код товара":r.master_code,"Артикул":r.article,"Товар":r.name,
    "КМ":r.manager==="Не назначен"?"":r.manager,"Себестоимость, ₽/шт":r.unitCost===null?null:r.unitCost/100,
    "ТК Маяк, ₽/шт":r.mayakUnit===null?null:r.mayakUnit/100,"Чего не хватает":r.dataGaps.join("; "),
    "Период с":data.from,"Период по":data.to}))}
  ]);
 }
 return <>
 <section className="ozf-panel ozf-filters"><label>С даты<DateField value={from} onChange={e=>setFrom(e.target.value)} max={shift(localDay(),-1)} disabled={busy}/></label><label>По дату (включительно)<DateField value={to} onChange={e=>setTo(e.target.value>shift(localDay(),-1)?shift(localDay(),-1):e.target.value)} max={shift(localDay(),-1)} disabled={busy}/></label><button className="ozf-btn ozf-primary" onClick={load} disabled={busy}>Сформировать</button><button className="ozf-btn" onClick={sync} disabled={busy}>Загрузить / продолжить из ЯМ</button><button className="ozf-btn" disabled={adBusy} onClick={async()=>{setAdBusy(true);setAdStatus('Загружаем рекламные отчёты…');try{const r=await fetch('/api/agents/yandex-finance-campaigns-cron',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to})}),j=await r.json();setAdStatus(r.ok?'Реклама ЯМ '+from+' — '+to+': '+String(j.phase??'обработка')+'; готово за запуск: '+String(j.finished??0):'Ошибка рекламы: '+String(j.error??r.status));}catch(e){setAdStatus(String(e))}finally{setAdBusy(false)}}}>{adBusy?'Выгружаем рекламу…':'Продолжить рекламу ЯМ'}</button><span role="status">{adStatus}</span><span role="status">{busy?'Загрузка… ':''}{progress}</span></section>
 {error&&<p role="alert" className="ymf-warning">{error}</p>}
 {data&&<>
 {data.coverage_warning&&<p className="ymf-warning" role="alert">{data.coverage_warning}</p>}
 {data.report.error&&<p className="ymf-warning" role="status">{data.report.error}</p>}
 {data.sourceAudit.some(x=>x.status!=='present')&&<p className="ymf-warning" role="status">
  Источники требуют сверки: {data.sourceAudit.filter(x=>x.status!=='present').map(x=>x.name).join('; ')}.
  Отсутствующие статьи доходов/расходов не подтверждены нулём. Подробности в «Проверка всех источников».
 </p>}
 <p>Показан период: <b>{data.from} — {data.to}</b> включительно. Кэш: {data.report.completed_at?new Date(data.report.completed_at).toLocaleString('ru-RU',{timeZone:'Asia/Krasnoyarsk'}):'—'} (Красноярск).</p>

 <div className="ozf-toolbar"><button className="ozf-btn" onClick={()=>void exportFinancialResult()}>Скачать финрез XLSX</button><button className="ozf-btn" onClick={()=>void exportMissingData()}>Недостающие данные XLSX · {data.rows.filter(r=>r.dataGaps.length>0||!r.master_code||r.manager==="Не назначен").length}</button></div>
 <details className="ozf-panel" style={{marginTop:10,marginBottom:10}}>
  <summary style={{cursor:'pointer',fontWeight:600}}>Проверка всех источников доходов и расходов ЯМ · {data.sourceAudit.filter(x=>x.status==='present').length}/{data.sourceAudit.length} с операциями</summary>
  <p className="ymf-warning">Отсутствующий лист или статья не считаются подтверждённым нулём. ЯМ может не формировать пустые листы; для недостающих сумм нужна сверка с кабинетом.</p>
  <div className="ozf-scroll"><table className="ozf-table"><thead><tr><th>Статья</th><th>Источник</th><th>Строк</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>
   {data.sourceAudit.map(x=><tr key={x.name}><td>{x.name}</td><td>{x.kind==='income'?'Доход':'Расход'}</td><td>{x.rows||'—'}</td>
    <td>{x.amount===null?'Не подтверждено':money(x.amount)}</td>
    <td>{x.status==='present'?'Есть операции':x.status==='preserved'?'Сохранено из предыдущего подтверждённого отчёта':'Нет листа/операций в отчёте'}</td></tr>)}
  </tbody></table></div>
 </details>
 <OrderFulfillmentPanels market="yandex" from={data.from} to={data.to}/>
 <YandexFinanceTable data={data} onSave={saveRate} saving={savingRate} onToggle={toggleStatus} statusSaving={statusSaving} onManager={saveManager} rateRevision={rateRevision}/>
 <section className="ozf-panel" id="ymf-unallocated"><h2>Нераспределённые расходы</h2><AccrualBreakdownList
   items={Object.entries(data.common).map(([name,amount])=>({name,amount,daily:data.commonDetails?.[name]??[]}))} market="yandex" from={data.from} to={data.to}
   total={data.totals.common} totalLabel="Итого" minorUnits invert/></section>

 </>}
 </>;
}
