'use client';
import {useEffect,useMemo,useState} from 'react';
import BiChart from '../../components/finance/BiChart';
import {campaignMetrics,sumCampaignMetrics,observedCampaignMetrics} from '../../../lib/ozon/campaign-metrics';
type Point={day:string;expense:number;views:number|null;clicks:number|null;carts:number|null;orders:number|null;revenue:number|null;drr:number|null;ctr:number|null;cpm:number|null;cpc:number|null;available:boolean;complete:boolean};
type ResponseData={campaigns:Array<{id:string;days:Point[]}>;coverage:Array<{day:string;complete:boolean}>;complete:boolean;loading:boolean;hasMapping:boolean;warning?:string|null};
const metrics=[{key:'drr',name:'ДРР',unit:'%',color:'#A99BFF'},{key:'ctr',name:'CTR',unit:'%',color:'#55DCC2'},{key:'cpm',name:'CPM',unit:'₽',color:'#5EB5FF'},{key:'cpc',name:'CPC',unit:'₽',color:'#F6B76A'},{key:'views',name:'Показы',unit:'шт.',color:'#8CA8FF'},{key:'clicks',name:'Клики',unit:'шт.',color:'#55CFEA'},{key:'carts',name:'Корзина',unit:'шт.',color:'#E999CD'},{key:'orders',name:'Заказы',unit:'шт.',color:'#83DFA6'}] as const;
type Metric=typeof metrics[number];
const format=(v:number|null,unit:string)=>v===null?'—':(unit==='%'?v*100:v).toLocaleString('ru-RU',{maximumFractionDigits:unit==='%'?2:0})+(unit==='шт.'?'':` ${unit}`);
export function dailyAverage(points:Point[], key:Metric["key"]){const known=points.filter(p=>p.available&&p[key]!==null&&Number.isFinite(p[key]));return known.length?known.reduce((a,p)=>a+(p[key]??0),0)/known.length:null;}
export function Trend({metric,points,total}:{metric:Metric;points:Point[];total:number|null}){
 const [zero,setZero]=useState(false);
 return <article className="ozf-trend-card"><div className="ozf-trend-heading"><h4>{metric.name} <small>{metric.unit}{['views','clicks','carts','orders'].includes(metric.key)?' / день':''}</small></h4><b>{metric.unit==='шт.'&&total!==null?total.toLocaleString('ru-RU',{maximumFractionDigits:2}):format(total,metric.unit)}</b><button className="ozf-scale" title="Переключить масштаб оси Y" aria-pressed={!zero} onClick={()=>setZero(v=>!v)}>{zero?'От нуля':'Автомасштаб'}</button></div><BiChart points={points.map(p=>({day:p.day,values:{[metric.key]:p.available&&p[metric.key]!==null?p[metric.key]!*(metric.unit==='%'?100:1):null}}))} series={[{key:metric.key,label:metric.name,color:metric.color}]} unit={metric.unit} zero={zero} label={metric.name}/></article>;
}
const campaignCache=new Map<string,{at:number;data:ResponseData}>();
export default function CampaignCharts({offer,from,to,marketplace='ozon'}:{offer:string;from:string;to:string;marketplace?:'ozon'|'yandex'}){
 const endpoint=`/api/agents/${marketplace}-finance-campaigns`;
 const [data,setData]=useState<ResponseData|null>(null),[campaign,setCampaign]=useState(marketplace==='yandex'?'sales':'all'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0),[poll,setPoll]=useState(false);
 useEffect(()=>{setData(null);setCampaign(marketplace==='yandex'?'sales':'all');setPoll(false)},[offer,from,to,marketplace]);
 useEffect(()=>{const controller=new AbortController();let live=true;setError('');const key=`${endpoint}?offer_id=${encodeURIComponent(offer)}&from=${from}&to=${to}`;const cached=campaignCache.get(key);if(reload===0&&cached&&Date.now()-cached.at<2*60*1000){setData(cached.data);setPoll(false);return;}fetch(key,{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error??'Ошибка РК');if(!live)return;setData(d);if(d.complete)campaignCache.set(key,{at:Date.now(),data:d});setPoll(!d.complete);}).catch(e=>{if(e.name!=='AbortError'&&live)setError(e.message)});return()=>{live=false;controller.abort()};},[offer,from,to,reload,endpoint]);
 useEffect(()=>{if(!poll)return;const timer=setTimeout(()=>setReload(n=>n+1),45000);return()=>clearTimeout(timer)},[poll,reload]);
 const points=useMemo(()=>{if(!data)return [];const selected=data.campaigns.filter(c=>campaign==='all'||c.id===campaign);return data.coverage.map(d=>{const found=selected.flatMap(c=>c.days.filter(x=>x.day===d.day));const hasData=found.length>0&&found.some(x=>x.available);
 const confirmed=campaign==='all'?d.complete:found.some(x=>x.complete);
 // Retain observed metrics from finished campaigns, even if a *different*
 // campaign is still pending. Mark these dates partial, never as final totals.
 const available=hasData;
 return {day:d.day,...campaignMetrics(sumCampaignMetrics(found.filter(x=>x.available))),available,complete:confirmed,partial:hasData&&!confirmed};});},[data,campaign]);
 const totals=useMemo(()=>campaignMetrics(sumCampaignMetrics(points.filter(x=>x.available))),[points]);
 async function queue(){setBusy(true);setError('');try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error);setPoll(true);setReload(x=>x+1);}catch(e){setError(e instanceof Error?e.message:'Ошибка загрузки');}finally{setBusy(false);}}
 return <section className="ozf-campaigns"><div className="ozf-campaign-toolbar"><div><h3>{marketplace==='yandex'?'Продвижение Яндекс Маркета':'Рекламные кампании'}</h3><span>{from} — {to}</span></div><div><select aria-label="Выбрать рекламную кампанию" value={campaign} onChange={e=>setCampaign(e.target.value)}>{marketplace==='ozon'&&<option value="all">Все РК</option>}{data?.campaigns.map(c=><option value={c.id} key={c.id}>{c.id==='sales'?'Буст продаж · все РК':c.id==='shows'?'Буст показов · все РК':`РК № ${c.id}`} </option>)}</select><button className="ozf-btn" disabled={busy} onClick={()=>void queue()}>{busy?'Запускаем…':'Загрузить РК за период'}</button><button className="ozf-btn" onClick={()=>setReload(x=>x+1)}>Обновить</button></div></div>
 {error&&<p role="alert" className="ozf-error">{error}</p>}{!data&&!error&&<p role="status">Загружаем статистику РК…</p>}
 {data?.warning&&<p className="ozf-error" role="alert">{data.warning}</p>}
 {data&&!data.complete&&<p className="ozf-progress" role="status">
  Полностью загружено дней: {data.coverage.filter(d=>d.complete).length} из {data.coverage.length}.
  {data.coverage.filter(d=>!d.complete).length>0&&<> Недостающие даты: {data.coverage.filter(d=>!d.complete).slice(0,10).map(d=>d.day.split('-').reverse().join('.')).join(', ')}{data.coverage.filter(d=>!d.complete).length>10?' и другие':''}.</>}
  {' '}Доступные значения на неполных днях отображаются справочно; отсутствующие отчёты не считаются нулём.
  {poll?' Проверяем новые выгрузки автоматически.':''}
 </p>}
 {data&&!data.hasMapping&&<p>Для артикула пока нет сопоставления с рекламным SKU.</p>}
 {data&&data.campaigns.length>0&&<div className="ozf-table-scroll"><table className="ozf-breakdown-table"><thead><tr><th>РК</th><th>Расход, ₽</th>{metrics.map(m=><th key={m.key}>{m.name}, {m.unit}</th>)}</tr></thead><tbody>{data.campaigns.map(c=>{const values=observedCampaignMetrics(c.days);return <tr key={c.id} className={campaign===c.id?"ozf-campaign-selected":""}><td><button className="ozf-article-btn" aria-pressed={campaign===c.id} onClick={()=>setCampaign(c.id)}>{c.id==='sales'?'Буст продаж · все РК':c.id==='shows'?'Буст показов · все РК':`РК № ${c.id}`} </button></td><td>{format(c.days.some(d=>d.available)?values.expense:null,'₽')}</td>{metrics.map(m=><td key={m.key}>{format(values[m.key],m.unit)}</td>)}</tr>})}</tbody></table></div>}
 {data&&points.some(p=>p.partial)&&<p className="ozf-notice" style={{marginTop:6}}>Пунктирных или выдуманных значений нет: графики показывают только наблюдения из готовых отчётов, неполные даты отмечены в статусе выше.</p>}
  {data&&points.some(p=>p.available)&&<div className="ozf-trend-grid">{metrics.map(m=><Trend key={m.key} metric={m} points={points} total={['views','clicks','carts','orders'].includes(m.key)?dailyAverage(points,m.key):totals[m.key]}/>)}</div>}
 {data&&<details className="ozf-campaign-data"><summary>Данные по дням</summary><div className="ozf-table-scroll"><table className="ozf-breakdown-table"><thead><tr><th>Дата</th>{metrics.map(m=><th key={m.key}>{m.name}, {m.unit}</th>)}</tr></thead><tbody>{points.map(p=><tr key={p.day}><td>{p.day}</td>{metrics.map(m=><td key={m.key}>{format(p.available?p[m.key]:null,m.unit)}</td>)}</tr>)}</tbody></table></div></details>}
 </section>;
}
