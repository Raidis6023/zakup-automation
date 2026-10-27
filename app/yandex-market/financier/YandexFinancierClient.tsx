'use client';
import {useEffect,useRef,useState} from 'react';
import {rules} from '../../../lib/yandex/finance';
import type {readFinance} from '../../../lib/yandex/finance-cache';
import YandexFinanceTable,{type RateInput} from './YandexFinanceTable';
type Data=NonNullable<Awaited<ReturnType<typeof readFinance>>>;
const money=(n:number)=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.sign(n)*Math.round(Math.abs(n)/100)||0)+' ₽';
function csv(name:string,records:Record<string,unknown>[]){
 if(!records.length)return;const keys=Object.keys(records[0]);const cell=(v:unknown)=>'"'+(typeof v==='number'?String(Number.isInteger(v)?v:Number(v.toFixed(8))).replace('.',','):String(v??'').replace(/^[=+@]/,"'$&")).replace(/"/g,'""')+'"';
 const text='\ufeff'+[keys,...records.map(r=>keys.map(k=>r[k]))].map(row=>row.map(cell).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export default function YandexFinancierClient({initial,initialError}:{initial:Data|null;initialError:string}){
 const [from,setFrom]=useState(initial?.from??'2026-10-01'),[to,setTo]=useState(initial?.to??'2026-10-26');
 const [data,setData]=useState(initial),[error,setError]=useState(initialError),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[savingRate,setSavingRate]=useState(false),[statusSaving,setStatusSaving]=useState(false);
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 async function request(url:string,body?:unknown){const r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error??'Ошибка запроса');return d;}
 async function load(){setError('');setBusy(true);try{const d=await request(`/api/agents/yandex-finance?from=${from}&to=${to}`);if(alive.current)setData(d);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Ошибка');}finally{if(alive.current)setBusy(false);}}
 async function sync(){setBusy(true);setError('');try{
  let job=await request('/api/agents/yandex-finance-sync',{action:'start',from,to});
  const phases:Record<string,string>={services_request:'Запрос отчёта услуг',services_poll:'ЯМ формирует отчёт услуг',orders_request:'Ожидание лимита перед запросом заказов',orders_poll:'ЯМ формирует отчёт заказов',order_units_pull:'Загрузка количества заказанных единиц',done:'Готово'};
  while(alive.current&&job.status==='loading'){
   setProgress(`${phases[job.phase]??job.phase} · ${job.date_from} — ${job.date_to}`);
   job=await request('/api/agents/yandex-finance-sync',{action:'advance',id:job.id});
   if(job.status==='loading')await new Promise(resolve=>setTimeout(resolve,job.phase==='order_units_pull'?500:8000));
  }
  if(job.status==='failed')throw new Error(job.error??'Не удалось загрузить отчёты');
  if(alive.current){setProgress('Отчёты загружены');setData(await request(`/api/agents/yandex-finance?from=${from}&to=${to}`));}
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Ошибка');}finally{if(alive.current)setBusy(false);}}
 async function saveRate(value:RateInput){setSavingRate(true);setBusy(true);setError('');try{await request('/api/agents/yandex-finance-rates',value);if(data&&alive.current){setData(await request(`/api/agents/yandex-finance?from=${data.from}&to=${data.to}`));setProgress(value.valid_from>data.to?'Тариф сохранён с '+value.valid_from+'. Он не меняет выбранный период.':'Тариф сохранён. Расчёт обновлён.');}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Ошибка сохранения');}finally{if(alive.current){setSavingRate(false);setBusy(false);}}}
 async function toggleStatus(master:string,checked:boolean){setStatusSaving(true);setError('');try{await request('/api/agents/yandex-finance-status',{master_code:master,discontinued:checked});if(alive.current)setData(current=>current?{...current,rows:current.rows.map(r=>r.master_code===master?{...r,discontinued:checked}:r)}:current);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Не удалось сохранить статус');}finally{if(alive.current)setStatusSaving(false);}}
 async function saveManager(article:string,manager:string){await request('/api/agents/yandex-finance-manager',{article,manager});if(data)setData(await request(`/api/agents/yandex-finance?from=${data.from}&to=${data.to}`));}
 return <>
 <section className="ozf-panel ozf-filters"><label>С даты<input type="date" value={from} onChange={e=>setFrom(e.target.value)} disabled={busy}/></label><label>По дату (включительно)<input type="date" value={to} onChange={e=>setTo(e.target.value)} disabled={busy}/></label><button className="ozf-btn ozf-primary" onClick={load} disabled={busy}>Сформировать</button><button className="ozf-btn" onClick={sync} disabled={busy}>Загрузить / продолжить из ЯМ</button><span role="status">{busy?'Загрузка… ':''}{progress}</span></section>
 {error&&<p role="alert" className="ymf-warning">{error}</p>}
 {data&&<>
 <p>Показан период: <b>{data.from} — {data.to}</b> включительно. Кэш: {data.report.completed_at?new Date(data.report.completed_at).toLocaleString('ru-RU',{timeZone:'Asia/Krasnoyarsk'}):'—'} (Красноярск).</p>

 <button className="ozf-btn" onClick={()=>csv('Yandex_расчёт.csv',data.rows.map(r=>({'Код товара':r.master_code,Артикул:r.article,КМ:r.manager,Товар:r.name,'Операционная прибыль':r.result===null?null:Math.round(r.result/100),Выручка:Math.round(r.income/100),'Реклама, ₽':-Math.round(r.advertising/100),'ДРР, %':r.drr===null?null:r.drr*100,'Хранение, ₽':-Math.round(r.storage/100),Заказы:r.orders,Отмены:r.cancelledTotal,Выкупы:r.buyouts,'ROAS, %':r.roas===null?null:r.roas*100,'Товары в пути':r.inTransit,'Выручка с товарами в пути':r.transitRevenue===null?null:Math.round(r.transitRevenue/100),'ДРР с товарами в пути, %':r.transitDrr===null?null:r.transitDrr*100,'Цена закупа, руб':r.unitCost===null?null:Math.round(r.unitCost/100),'Себестоимость, ₽':r.cogs===null?null:-Math.round(r.cogs/100),'ТК Маяк, ₽/шт':r.mayakUnit===null?null:Math.round(r.mayakUnit/100),'ТК Маяк, ₽':r.mayak===null?null:-Math.round(r.mayak/100),...Object.fromEntries(rules.map(([name])=>[name,-Math.round((r.expenses[name]??0)/100)]))})))}>Скачать расчёт CSV за период</button>
 <YandexFinanceTable data={data} onSave={saveRate} saving={savingRate} onToggle={toggleStatus} statusSaving={statusSaving} onManager={saveManager}/>
 <section className="ozf-panel" id="ymf-unallocated"><h2>Нераспределённые расходы</h2><table className="ozf-table"><tbody>{Object.entries(data.common).map(([name,n])=><tr key={name}><th>{name}</th><td>{money(-n)}</td></tr>)}</tbody><tfoot><tr><th scope="row">Итого</th><td>{money(-data.totals.common)}</td></tr></tfoot></table></section>

 </>}
 </>;
}
