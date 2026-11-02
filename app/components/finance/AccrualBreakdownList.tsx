'use client';
import {useEffect,useState} from 'react';

export type AccrualDay={date:string;amount:number;count?:number};
export type AccrualItem={name:string;amount:number;typeId?:string;daily?:AccrualDay[]};
type Source='ozon'|'yandex'|'wb';
type Op={id:string;orderId?:string|null;article?:string|null;amount:number;type?:string};
const rubles=(value:number)=>(Math.sign(value)*Math.round(Math.abs(value))||0).toLocaleString('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:0});
function DayOperations({market,name,typeId,day,from,to,minorUnits,invert}:{market:Source;name:string;typeId?:string;day:string;from:string;to:string;minorUnits:boolean;invert:boolean}){
 const [rows,setRows]=useState<Op[]|null>(null),[error,setError]=useState(''),[more,setMore]=useState(false),[page,setPage]=useState(0),[busy,setBusy]=useState(false);
 useEffect(()=>{const abort=new AbortController();const p=new URLSearchParams({market,name,day,from,to,typeId:typeId??'',page:String(page)});
  fetch('/api/agents/finance-unallocated-operations?'+p,{signal:abort.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error??'Нет операций');return d;})
  .then(d=>{if(!abort.signal.aborted){setRows(old=>page===0?d.items??[]:[...(old??[]),...(d.items??[])]);setMore(Boolean(d.more));setBusy(false);}}).catch(e=>{if(!abort.signal.aborted){setError(e instanceof Error?e.message:'Ошибка');setBusy(false);}});
  return()=>abort.abort();},[market,name,typeId,day,from,to,page]);
 const shown=(value:number)=>rubles((invert?-value:value)/(minorUnits?100:1));
 if(error)return <p role="alert" className="ozf-error">{error}</p>;
 if(!rows)return <p>Получаем ID начислений…</p>;
 return <div className="ozf-accrual-operations"><table><thead><tr><th>ID операции / исходная строка</th><th>Заказ</th><th>Артикул / вид начисления</th><th>Сумма</th></tr></thead><tbody>
 {rows.map((r,i)=><tr key={r.id+'-'+i}><td>{r.id}</td><td>{r.orderId||'—'}</td><td>{r.article||r.type||'—'}</td><td>{shown(r.amount)}</td></tr>)}
 {!rows.length&&<tr><td colSpan={4}>Начислений за дату не найдено. Сверьте тип и исходный отчёт.</td></tr>}
 </tbody></table>{more&&<button className="ozf-btn" type="button" disabled={busy} onClick={()=>{setBusy(true);setPage(p=>p+1)}}>{busy?'Загрузка…':'Показать следующие 500 начислений'}</button>}</div>;
}
export default function AccrualBreakdownList({items,total,totalLabel,minorUnits=false,invert=false,market,from='',to=''}:{
 items:AccrualItem[];total:number;totalLabel:string;minorUnits?:boolean;invert?:boolean;market?:Source;from?:string;to?:string;
}){
 const shown=(v:number)=>rubles((invert?-v:v)/(minorUnits?100:1));
 return <div className="ozf-accrual-list">
 {items.map((item,index)=><details key={item.name+'-'+index} className="ozf-accrual-item">
  <summary><span>{item.name==='ITEM'?'Товарное начисление без привязки (ITEM)':item.name}</span><strong>{shown(item.amount)}</strong></summary>
  <div className="ozf-accrual-days">{(item.daily??[]).length?(item.daily??[]).map(day=>market?<details key={day.date}>
   <summary><time dateTime={day.date}>{day.date.split('-').reverse().join('.')}</time>{day.count!=null&&<small>{day.count.toLocaleString('ru-RU')} операций</small>}<b>{shown(day.amount)}</b></summary>
   <DayOperations market={market} name={item.name} typeId={item.typeId} day={day.date} from={from} to={to} minorUnits={minorUnits} invert={invert}/>
  </details>:<div key={day.date}><time dateTime={day.date}>{day.date.split('-').reverse().join('.')}</time>{day.count!=null&&<small>{day.count.toLocaleString('ru-RU')} операций</small>}<b>{shown(day.amount)}</b></div>):<p>Дневная детализация отсутствует.</p>}</div>
 </details>)}
 <div className="ozf-accrual-total"><span>{totalLabel}</span><strong>{shown(total)}</strong></div>
 </div>;
}
