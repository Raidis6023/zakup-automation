'use client';
import {useMemo,useState} from 'react';
import BiChart from './BiChart';
export type WbAdRow={nm_id:number;date:string;campaign_id:number;spend:number;views:number;clicks:number;orders:number;sum_price:number;atbs:number};
type Metric='spend'|'views'|'clicks'|'carts'|'orders'|'orderRevenue'|'ctr'|'cartCR'|'cr'|'cpc'|'cpo'|'drr';
const options:Record<Metric,{label:string;unit:string}>={spend:{label:'Расходы',unit:'₽'},views:{label:'Показы',unit:'шт.'},clicks:{label:'Клики',unit:'шт.'},carts:{label:'Корзины',unit:'шт.'},orders:{label:'Заказы с рекламы',unit:'шт.'},orderRevenue:{label:'Стоимость заказов с рекламы',unit:'₽'},ctr:{label:'CTR',unit:'%'},cartCR:{label:'Клики → корзина',unit:'%'},cr:{label:'Клики → заказ',unit:'%'},cpc:{label:'CPC',unit:'₽'},cpo:{label:'CPO',unit:'₽'},drr:{label:'ДРР',unit:'%'}};
const money=(n:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
export default function WbAdvertisingCharts({rows,from,to,complete=false,nmId,revenues}:{rows:WbAdRow[];from:string;to:string;complete?:boolean;nmId?:string;revenues?:Record<string,number>}){
 const [metric,setMetric]=useState<Metric>('spend');
 const filtered=useMemo(()=>nmId?rows.filter(r=>String(r.nm_id)===nmId):rows,[rows,nmId]);
 const daily=useMemo(()=>{
  const result=new Map<string,{spend:number;views:number;clicks:number;carts:number;orders:number;orderRevenue:number}>();
  for(const row of filtered){const v=result.get(row.date)??{spend:0,views:0,clicks:0,carts:0,orders:0,orderRevenue:0};
   v.spend+=Number(row.spend);v.views+=Number(row.views);v.clicks+=Number(row.clicks);v.carts+=Number(row.atbs);v.orders+=Number(row.orders);v.orderRevenue+=Number(row.sum_price);result.set(row.date,v);}
  const count=Math.min(91,Math.max(0,Math.round((Date.parse(to)-Date.parse(from))/86400000)+1));
  return Array.from({length:count},(_,i)=>{const day=new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10),v=result.get(day)??{spend:0,views:0,clicks:0,carts:0,orders:0,orderRevenue:0};
   const ratio=(a:number,b:number)=>b>0?a/b*100:null;
   return {day,values:{...v,ctr:ratio(v.clicks,v.views),cartCR:ratio(v.carts,v.clicks),cr:ratio(v.orders,v.clicks),cpc:v.clicks>0?v.spend/v.clicks:null,cpo:v.orders>0?v.spend/v.orders:null,drr:ratio(v.spend,revenues?.[day]??0)}};
  });
 },[filtered,from,to,revenues]);
 const totals=filtered.reduce((a,x)=>({spend:a.spend+x.spend,views:a.views+x.views,clicks:a.clicks+x.clicks,carts:a.carts+x.atbs,orders:a.orders+x.orders}),{spend:0,views:0,clicks:0,carts:0,orders:0});
 const unavailable=['ctr','cartCR','cr','cpc','cpo','drr'].includes(metric)&&daily.every(x=>x.values[metric]===null);
 return <section className="ozf-panel" style={{marginTop:16,padding:16}}>
  <h3 style={{marginBottom:12}}>Реклама WB · {nmId?'по выбранному товару':'по всем артикулам'}</h3>
  {!complete&&<p className="ozf-error" role="status">Рекламная статистика ещё не завершена. Частичные данные не считаются полным финансовым итогом.</p>}
  {!filtered.length?<p className="ozf-notice">Нет подтверждённых строк рекламной статистики. Запусти выгрузку рекламных кампаний. Нули здесь не означают отсутствие расходов.</p>:<>
   <div className="ozf-metrics">{[['Расход',money(totals.spend)+' ₽'],['Показы',money(totals.views)],['Клики',money(totals.clicks)],['Корзины',money(totals.carts)],['Заказы с рекламы',money(totals.orders)]].map(([label,value])=><div key={label} className="ozf-panel"><span>{label}</span><strong>{value}</strong></div>)}</div>
   <div className="bi-switches" style={{marginTop:14,flexWrap:'wrap'}}>{(Object.keys(options) as Metric[]).map(k=><button key={k} aria-pressed={metric===k} onClick={()=>setMetric(k)}>{options[k].label}</button>)}</div>
   {unavailable?<p className="ozf-notice">Для этой метрики нет знаменателя или исходных данных. Подставлять ноль неправильно.</p>:<BiChart key={metric} points={daily.map(p=>({day:p.day,values:{[metric]:p.values[metric]}}))} series={[{key:metric,label:options[metric].label,color:'#5de0bd'}]} unit={options[metric].unit} label={options[metric].label}/>}
   <p className="ozf-footnote">Графики показывают аналитические расходы кампаний, а не дополнительное списание из прибыли. ДРР рассчитан по обороту WB за день; без оборота значение не определяется.</p>
  </>}
 </section>;
}
