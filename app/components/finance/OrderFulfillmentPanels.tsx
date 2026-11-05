'use client';
import {useEffect,useState} from 'react';
import {downloadFinanceWorkbook} from './export-xlsx';
import './order-fulfillment.css';
type Item={article:string;orders:number;cancelled:number|null;amount:number|null};
type Group={orders:number;cancelled:number|null;amount:number|null;knownAmount:number;articles:Item[]};
type Payload={ok:boolean;note:string;schemes:{fbo?:Group;fbw?:Group;fbs?:Group};error?:string};
type Market='ozon'|'wb'|'yandex';
type Row={article:string;name:string;master_code:string|null;manager:string;orders:number|null;cancelled:number|null;buyouts:number|null;revenue:number|null;charges:number|null;cogs:number|null;mayak:number|null;advertising:number|null;storage:number|null;profit:number|null;note:string};
type Sheet={ok:boolean;source:string;note:string;rows:Row[];error?:string};
const fmt=(n:number|null,unit='')=>n===null?'Нет данных':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n)+(unit?' '+unit:'');
function SchemeTable({market,scheme,from,to}:{market:Market;scheme:string;from:string;to:string}){
 const [sheet,setSheet]=useState<Sheet|null>(null),[error,setError]=useState(''),[sort,setSort]=useState<keyof Row>('profit'),[desc,setDesc]=useState(true);
 useEffect(()=>{const ac=new AbortController();setSheet(null);setError('');fetch('/api/agents/finance-scheme-report?'+new URLSearchParams({market,scheme,from,to}),{cache:'no-store',signal:ac.signal}).then(async r=>{const d=await r.json() as Sheet;if(!r.ok)throw Error(d.error??'Ошибка данных');return d;}).then(d=>{if(!ac.signal.aborted)setSheet(d)}).catch(e=>{if(!ac.signal.aborted)setError(e instanceof Error?e.message:'Ошибка формирования');});return()=>ac.abort()},[market,scheme,from,to]);
 const fields:[keyof Row,string][]=[['article','Артикул'],['name','Товар'],['master_code','ЕНОТ'],['manager','КМ'],['orders','Заказы'],['cancelled','Отмены'],['buyouts','Выкупы'],['revenue','Выручка'],['charges','Начисления/удержания'],['advertising','Реклама'],['storage','Хранение'],['cogs','Себестоимость'],['mayak','ТК Маяк'],['profit','Опер. прибыль']];
 const rows=(sheet?.rows??[]).slice().sort((a,b)=>{const x=a[sort],y=b[sort];if(x===null)return y===null?0:1;if(y===null)return -1;const n=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'ru');return desc?-n:n;});
 const total=(key:keyof Row):number|null=>!rows.length||rows.some(r=>r[key]===null)||typeof rows[0][key]!=='number'?null:rows.reduce((v,r)=>v+Number(r[key]),0);
 const value=(r:Row,k:keyof Row)=>typeof r[k]==='number'?fmt(r[k] as number,['orders','cancelled','buyouts'].includes(k)?'':'₽'):String(r[k]??'—');
 const exportBook=()=>downloadFinanceWorkbook(market.toUpperCase()+'_'+scheme+'_финрез_'+from+'_'+to+'.xlsx',[{name:'Финансовый результат',rows:rows.map(r=>Object.fromEntries(fields.map(([key,label])=>[label,r[key]])) as Record<string,string|number|null>)},{name:'Контроль',rows:[{Источник:sheet?.source??'',Примечание:sheet?.note??'',Период:from+' — '+to}]}]);
 if(error)return <p role="alert" className="ozf-error">{error}</p>;
 if(!sheet)return <p>Формируем финансовый отчёт по исходным операциям…</p>;
 return <div style={{marginTop:12}}><p className="ozf-notice">{sheet.note}</p><div className="ozf-toolbar"><strong>{rows.length} артикулов</strong><button className="ozf-btn" type="button" onClick={()=>void exportBook()}>Скачать финрез XLSX</button></div>
 <div className="ozf-financial-scroll"><table className="ozf-table ozf-financial-table" style={{minWidth:1550}}>
 <thead><tr>{fields.map(([key,label])=><th key={key}><button className="ozf-sort-control" type="button" onClick={()=>{setDesc(sort===key?!desc:true);setSort(key)}}>{label}{sort===key?(desc?' ↓':' ↑'):''}</button></th>)}</tr></thead>
 <tbody>{rows.map((r,i)=><tr key={r.article+'-'+i}>{fields.map(([key])=><td key={key} className={key==='profit'&&typeof r.profit==='number'?(r.profit<0?'ozf-bad':'ozf-good'):['cogs','mayak','storage'].includes(key)&&typeof r[key]==='number'?'ozf-bad':''} title={r.note}>{value(r,key)}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={fields.length}>Нет финансовых операций выбранной схемы</td></tr>}</tbody>
 <tfoot><tr>{fields.map(([key],i)=><td key={key}>{i===0?'Итого':typeof rows[0]?.[key]==='number'?fmt(total(key),['orders','cancelled','buyouts'].includes(key)?'':'₽'):'—'}</td>)}</tr></tfoot>
 </table></div></div>;
}
function SchemePanel({market,scheme,label,from,to,group,note,error}:{market:Market;scheme:string;label:string;from:string;to:string;group?:Group;note:string;error:string}){
 const [open,setOpen]=useState(false);
 const [title,description='Склад продавца']=label.split(' · ');
 return <details className="ozf-scheme-panel" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary className="ozf-scheme-summary" aria-label={title+' — '+description+'. '+(open?'Свернуть':'Раскрыть')+' финансовый отчёт'}>
   <div className="ozf-scheme-identity">
    <span className="ozf-scheme-icon" aria-hidden="true">{scheme==='fbs'?'▤':'▦'}</span>
    <span><strong>{title}</strong><small>{description}</small></span>
   </div>
   <div className="ozf-scheme-stats">
    <span><small>Заказы</small><strong>{group?fmt(group.orders):'—'}</strong></span>
    <span><small>Отмены</small><strong>{group?fmt(group.cancelled):'—'}</strong></span>
    <span><small>Сумма заказов</small><strong>{group?fmt(group.amount,'₽'):'—'}</strong></span>
   </div>
   <span className="ozf-scheme-action">{open?'Свернуть':'Финансовый отчёт'} <span aria-hidden="true">{open?'⌃':'⌄'}</span></span>
  </summary>
  {open&&<div className="ozf-scheme-content">
   {error?<p className="ozf-error" role="alert">{error}</p>:!group?<p className="ozf-notice">Загружаем данные о заказах…</p>:<>
    <div className="ozf-scheme-detail-head">
     <div><h3>{title}: отчёт по финансовым показателям</h3><p>Только операции схемы {title} за {from} — {to}</p></div>
     <a className="ozf-btn" href={market==='ozon'?'#ozf-items':market==='yandex'?'#ymf-results':'#wb-finance-main'}>К общему финрезу ↑</a>
    </div>
    <p className="ozf-notice">{note}</p>
    <SchemeTable market={market} scheme={scheme} from={from} to={to}/>
   </>}
  </div>}
 </details>;
}
export default function OrderFulfillmentPanels({market,from,to}:{market:Market;from:string;to:string}){
 const [data,setData]=useState<Payload|null>(null),[error,setError]=useState('');
 useEffect(()=>{const ac=new AbortController();setData(null);setError('');fetch('/api/agents/finance-order-schemes?'+new URLSearchParams({market,from,to}),{cache:'no-store',signal:ac.signal}).then(async r=>{const d=await r.json() as Payload;if(!r.ok)throw Error(d.error??'Ошибка заказов');return d;}).then(d=>{if(!ac.signal.aborted)setData(d)}).catch(e=>{if(!ac.signal.aborted)setError(e instanceof Error?e.message:'Ошибка');});return()=>ac.abort()},[market,from,to]);
 const first=market==='wb'?'fbw':'fbo';
 return <section className="ozf-scheme-panels" aria-label="Финансовые отчёты по схемам отгрузки">
 <SchemePanel market={market} scheme={first} label={market==='wb'?'FBW · склад Wildberries':market==='yandex'?'FBY · склад Яндекс Маркета':'FBO · склад Ozon'} from={from} to={to} group={data?.schemes[first]} note={data?.note??''} error={error}/>
 <SchemePanel market={market} scheme="fbs" label="FBS · склад продавца" from={from} to={to} group={data?.schemes.fbs} note={data?.note??''} error={error}/>
 </section>;
}
