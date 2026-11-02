'use client';
import {useEffect,useState} from 'react';
type Item={article:string;orders:number;cancelled:number|null;amount:number|null};
type Group={orders:number;cancelled:number|null;amount:number|null;knownAmount:number;articles:Item[]};
type Payload={ok:boolean;source:string;note:string;schemes:{fbo?:Group;fbw?:Group;fbs?:Group};error?:string};
type Market='ozon'|'wb'|'yandex';
const fmt=(n:number|null)=>n===null?'Нет данных':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);
export default function OrderFulfillmentPanels({market,from,to}:{market:Market;from:string;to:string}){
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setData(null);setError('');
  fetch('/api/agents/finance-order-schemes?'+new URLSearchParams({market,from,to}),{signal:controller.signal,cache:'no-store'})
   .then(async r=>{const result=await r.json() as Payload;if(!r.ok)throw Error(result.error??'Не удалось загрузить заказы');return result;})
   .then(v=>{if(!controller.signal.aborted)setData(v)})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Ошибка загрузки заказов');});
  return ()=>controller.abort();
 },[market,from,to]);
 const groups:[keyof Payload['schemes'],string][]= [
  [market==='wb'?'fbw':'fbo',market==='wb'?'FBW · склад Wildberries':market==='yandex'?'FBY · склад Яндекс Маркета':'FBO · склад Ozon'],
  ['fbs','FBS · склад продавца']
 ];
 return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:12,margin:'12px 0'}}>
 {groups.map(([key,label])=>{const group=data?.schemes[key];return <details className="ozf-panel ozf-collapsible-register" style={{padding:14}} key={market+key+from+to}>
  <summary style={{cursor:'pointer'}}><strong>{label}</strong><span style={{marginLeft:10}}>{error?'Ошибка':!data?'Загрузка…':group?fmt(group.orders)+(market==='ozon'?' отправлений':' ед. заказа'):'Нет данных'}</span></summary>
  {error?<p role="alert" className="ozf-error">{error}</p>:!data?<p>Загрузка статистики заказов…</p>:!group?<p>Нет сведений по схеме доставки.</p>:<>
   <div className="ozf-metrics" style={{marginTop:12}}>
    <div><span>{market==='ozon'?'Отправлений':'Заказано единиц'}</span><strong>{fmt(group.orders)}</strong></div>
    <div><span>Отмен</span><strong>{fmt(group.cancelled)}</strong></div>
    <div><span>{market==='ozon'?'POSTING-начисления':'Оценка стоимости заказов'}</span><strong>{fmt(group.amount)} ₽</strong></div>
   </div>
   <p className="ozf-notice">{data.note} Эти показатели справочные и не влияют на финансовые итоги.</p>
   <div className="ozf-table-scroll"><table className="ozf-table">
    <thead><tr><th>Артикул</th><th>{market==='ozon'?'Отправлений':'Единиц'}</th><th>Отмен</th><th>Сумма, ₽</th></tr></thead>
    <tbody>{group.articles.map((a,i)=><tr key={a.article+'-'+i}><td>{a.article}</td><td>{fmt(a.orders)}</td><td>{fmt(a.cancelled)}</td><td>{fmt(a.amount)}</td></tr>)}
    {!group.articles.length&&<tr><td colSpan={4}>Записей за период не найдено</td></tr>}</tbody>
   </table></div>
  </>}
 </details>})}
 </div>;
}
