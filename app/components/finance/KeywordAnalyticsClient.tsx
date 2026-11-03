'use client';
import {useEffect,useState} from 'react';
type Market='wb'|'ozon'|'yandex';
type Item={query:string;values:Record<string,number|null>;raw:Record<string,unknown>};
type Report={ok:boolean;items:Item[];source:string;note:string;coverage:string;limitations:string[];error?:string};
const labels:Record<string,string>={frequency:'Запросов',openCard:'Открытий карточки',addToCart:'Корзины',openToCart:'Конверсия в корзину',orders:'Заказов',cartToOrder:'Корзина → заказ',avgPosition:'Позиция',searches:'Уникальных поисков',views:'Просмотров товара',viewConversion:'Конверсия в просмотр',revenue:'GMV, ₽',position:'Позиция',queryIndex:'Индекс запроса'};
function valid(x:string){return /^\d{4}-\d{2}-\d{2}$/.test(x)}
export default function KeywordAnalyticsClient({market,article,from,to}:{market:string;article:string;from:string;to:string}){
 const [selectedMarket,setSelectedMarket]=useState<Market>(market==='ozon'?'ozon':market==='yandex'?'yandex':'wb');
 const [product,setProduct]=useState(article),[first,setFirst]=useState(from),[last,setLast]=useState(to);
 const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [counter,setCounter]=useState(0);
 useEffect(()=>{
  if(!product||!valid(first)||!valid(last))return;
  const ac=new AbortController();setBusy(true);setError('');setReport(null);
  const q=new URLSearchParams({market:selectedMarket,article:product,from:first,to:last});
  fetch('/api/agents/finance-keywords?'+q,{cache:'no-store',signal:ac.signal}).then(async r=>{const d=await r.json() as Report;if(!r.ok)throw Error(d.error??'Ошибка поисковой аналитики');return d}).then(d=>{if(!ac.signal.aborted)setReport(d)}).catch(e=>{if(!ac.signal.aborted)setError(e instanceof Error?e.message:'Ошибка выгрузки')}).finally(()=>{if(!ac.signal.aborted)setBusy(false)});
  return()=>ac.abort();
 },[counter]);
 const fields=[...new Set((report?.items??[]).flatMap(x=>Object.keys(x.values)).filter(k=>(report?.items??[]).some(x=>x.values[k]!==null)))];
 const fmt=(n:number|null|undefined)=>n==null?'Нет данных':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
 return <main className="ozf-layout"><section className="ozf-panel" style={{padding:20}}>
  <a className="ozf-btn" href={selectedMarket==='wb'?'/wildberries/financier':selectedMarket==='ozon'?'/ozon/financier':'/yandex-market/financier'}>К финансисту</a>
  <h1>Поисковые запросы по товару</h1>
  <p className="ozf-notice">По каждой фразе отображаются реальные метрики площадки. Недоступные показатели не заменяются нулями или расчётными оценками.</p>
  <div className="ozf-filters">
   <label>Маркетплейс <select value={selectedMarket} onChange={e=>setSelectedMarket(e.target.value as Market)}><option value="wb">Wildberries</option><option value="ozon">Ozon</option><option value="yandex">Яндекс Маркет</option></select></label>
   <label>Артикул <input value={product} onChange={e=>setProduct(e.target.value)} placeholder="nmId WB или артикул Ozon"/></label>
   <label>С даты <input type="date" value={first} onChange={e=>setFirst(e.target.value)}/></label>
   <label>По дату <input type="date" value={last} onChange={e=>setLast(e.target.value)}/></label>
   <button className="ozf-btn ozf-primary" disabled={busy||!product||!valid(first)||!valid(last)} onClick={()=>setCounter(x=>x+1)}>{busy?'Получаем данные…':'Сформировать'}</button>
  </div>
  {error&&<p role="alert" className="ozf-error">{error}</p>}
  {busy&&<p role="status">Запрашиваем аналитику у маркетплейса. Платные показатели требуют соответствующей подписки и прав токена.</p>}
  {report&&<><p className="ozf-notice">{report.note}</p><p>Источник: <strong>{report.source}</strong> · Запросов в ответе: {report.items.length}</p>
  <div className="ozf-financial-scroll"><table className="ozf-table" style={{minWidth:Math.max(740,160+fields.length*125)}}>
  <thead><tr><th>Поисковый запрос</th>{fields.map(k=><th key={k}>{labels[k]??k}</th>)}<th>Оригинальные данные</th></tr></thead>
  <tbody>{report.items.map((x,i)=><tr key={x.query+'-'+i}><td>{x.query||'—'}</td>{fields.map(k=><td key={k}>{fmt(x.values[k])}</td>)}<td><details><summary>Все поля</summary><pre style={{whiteSpace:'pre-wrap',maxWidth:430}}>{JSON.stringify(x.raw,null,2)}</pre></details></td></tr>)}{!report.items.length&&<tr><td colSpan={fields.length+2}>Площадка не вернула запросов или не предоставляет детализацию для этого товара/тарифа.</td></tr>}</tbody>
  </table></div></>}
 </section></main>;
}
