'use client';
import { DateField } from "@/app/ui/WorkspaceDateFields";
import {useEffect,useState} from 'react';
type Market='wb'|'ozon'|'yandex';
type Item={query:string;values:Record<string,number|null>;raw:Record<string,unknown>};
type Report={ok:boolean;items:Item[];source:string;note:string;coverage:string;limitations:string[];error?:string};
const labels:Record<string,string>={frequency:'Запросов',openCard:'Открытий карточки',addToCart:'Корзины',openToCart:'Конверсия в корзину',orders:'Заказов',cartToOrder:'Корзина → заказ',avgPosition:'Позиция',searches:'Уникальных поисков',views:'Просмотров товара',viewConversion:'Конверсия в просмотр',revenue:'GMV, ₽',position:'Позиция',queryIndex:'Индекс запроса'};
const wbColumns=[['frequency','Количество запросов','шт.'],['views','Показы карточки','шт.'],['openCard','Переходы в карточку','шт.'],['ctr','Конверсия в клик','%'],['addToCart','В корзину','шт.'],['cartCR','Клик → корзина','%'],['orders','Заказы','шт.'],['orderCR','Корзина → заказ','%'],['clickToOrder','Клик → заказ','%'],['buyouts','Выкупы','шт.'],['spend','Стоимость запроса','₽'],['cpc','Цена клика','₽']] as const;
const ozonColumns=[['searches','Частота запросов','шт.'],['views','Просмотры','шт.'],['viewConversion','Конверсия просмотра','%'],['orders','Заказы','шт.'],['revenue','GMV','₽']] as const;
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
 const fields=selectedMarket==='wb'?wbColumns:selectedMarket==='ozon'?ozonColumns:[];
 const fmt=(n:number|null|undefined,unit:string)=>n==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:unit==='шт.'?0:2}).format(n)+(unit==='₽'?' ₽':unit==='%'?' %':'');
 return <main className="ozf-layout"><section className="ozf-panel" style={{padding:20}}>
  <a className="ozf-btn" href={selectedMarket==='wb'?'/wildberries/financier':selectedMarket==='ozon'?'/ozon/financier':'/yandex-market/financier'}>К финансисту</a>
  <h1>Поисковые запросы по товару</h1>
  <p className="ozf-notice">Частота запросов, просмотры, переходы, корзины, заказы, конверсии и стоимость. Пустое значение означает, что площадка не отдала показатель. Выкупы по тексту запроса WB не выдаёт.</p>
  <div className="ozf-filters">
   <label>Маркетплейс <select value={selectedMarket} onChange={e=>setSelectedMarket(e.target.value as Market)}><option value="wb">Wildberries</option><option value="ozon">Ozon</option><option value="yandex">Яндекс Маркет</option></select></label>
   <label>Артикул <input value={product} onChange={e=>setProduct(e.target.value)} placeholder="nmId WB или артикул Ozon"/></label>
   <label>С даты <DateField  value={first} onChange={e=>setFirst(e.target.value)}/></label>
   <label>По дату <DateField  value={last} onChange={e=>setLast(e.target.value)}/></label>
   <button className="ozf-btn ozf-primary" disabled={busy||!product||!valid(first)||!valid(last)} onClick={()=>setCounter(x=>x+1)}>{busy?'Получаем данные…':'Сформировать'}</button>
  </div>
  {error&&<p role="alert" className="ozf-error">{error}</p>}
  {busy&&<p role="status">Запрашиваем аналитику у маркетплейса. Платные показатели требуют соответствующей подписки и прав токена.</p>}
  {report&&<><p className="ozf-notice">{report.note}</p><p>Источник: <strong>{report.source}</strong> · Запросов в ответе: {report.items.length}</p>
  <div className="ozf-financial-scroll" style={{overflowX:'auto',maxWidth:'100%'}}>
    <table className="ozf-table ozf-financial-table" style={{minWidth:selectedMarket==='wb'?1750:950,width:'100%'}}>
      <thead><tr><th style={{minWidth:280,textAlign:'left'}}>Поисковый запрос</th>
      {fields.map(([key,name])=><th key={key} style={{minWidth:108,textAlign:'right'}}>{name}</th>)}</tr></thead>
      <tbody>{report.items.map((item,i)=><tr key={item.query+'-'+i}>
        <td style={{minWidth:280,textAlign:'left',fontWeight:600}}>{item.query||'—'}</td>
        {fields.map(([key,,unit])=><td key={key} style={{textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{fmt(item.values[key],unit)}</td>)}
      </tr>)}
      {!report.items.length&&<tr><td colSpan={fields.length+1}>У площадки нет подтверждённых данных по запросам для этого периода.</td></tr>}
      </tbody>
    </table>
  </div></>}
 </section></main>;
}
