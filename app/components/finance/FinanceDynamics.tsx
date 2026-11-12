'use client';
import {useEffect,useMemo,useState} from 'react';
import BiChart from './BiChart';
import {dailyChanges,percentageComposition,type FinanceMetric,type FinancePoint} from './finance-series';
import {prepareFinanceSeries} from './finance-series-cache';
export {amounts} from './finance-series';
export type {FinanceMetric} from './finance-series';
const names={orders:'Заказы',buyouts:'Выкупы',revenue:'Выручка',profit:'Операционная прибыль',marketplace:'Затраты МП',advertising:'Реклама',inbound:'Логистика вход'};
const colors={revenue:'#5de0bd',marketplace:'#729bff',advertising:'#ffb66e',inbound:'#b49aff',profit:'#5de0bd',orders:'#729bff',buyouts:'#b49aff'};
const flowColors:Record<string,string>={profit:'#e5484d',advertising:'#f5c542',inbound:'#f5f7fb',marketplace:'#05070b'};
export default function FinanceDynamics({marketplace,from,to,offer,offers,selected='orders',revision='',provided,expectedProfit=null}:{marketplace:'ozon'|'yandex'|'wb';from:string;to:string;offer?:string;offers?:string[];selected?:FinanceMetric;revision?:string;provided?:FinancePoint[];expectedProfit?:number|null}){
 const [metric,setMetric]=useState<FinanceMetric>(selected),[points,setPoints]=useState<FinancePoint[]|null>(provided??null),[error,setError]=useState(''),[flow,setFlow]=useState(false),[zero,setZero]=useState(false);
 const offerKey=offers?.slice().sort().join('\0');useEffect(()=>{setMetric(selected);setFlow(false)},[selected]);
 useEffect(()=>{if(provided){setPoints(provided);return;}let live=true;setPoints(null);setError('');if(!from||!to)return;prepareFinanceSeries(marketplace,from,to,revision).then(bundle=>{if(live)setPoints(dailyChanges(bundle,marketplace,offer,offerKey?.split('\0')))}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[marketplace,from,to,offer,offerKey,revision,provided]);
 const keys=flow?(['profit','advertising','inbound','marketplace'] as const):[metric];
 // Exclude days with no financial operations in an article-scoped chart.
 // A booking without any charge is not evidence of revenue/profit.
 const plottedPoints=useMemo(()=>offer||offers?.length
  ?(points??[]).filter(p=>[p.v.revenue,p.v.profit,p.v.advertising].some(v=>typeof v==='number'&&Math.abs(v)>0.005))
  :(points??[]),[points,offer,offerKey]);
 const plot=useMemo(()=>plottedPoints.map(p=>({day:p.day,values:flow?percentageComposition(p.composition??p.v):p.v})),[plottedPoints,flow]);
 const incomplete=Boolean(points&&points.some(p=>p.v.profit===null));
 const actual=points?.reduce((s,p)=>s+(p.v.profit??0),0)??null;
 const mismatch=!incomplete&&expectedProfit!==null&&actual!==null&&Math.abs(actual-expectedProfit)>Math.max(.03,Math.abs(expectedProfit)*.000001);
 const hasValue=Boolean(plot.some(p=>flow?keys.some(k=>p.values[k]!==null):p.values[metric]!==null));
 const hasGaps=Boolean(plot.some(p=>flow?keys.some(k=>p.values[k]===null):p.values[metric]===null));
 const provisionalFlow=Boolean(flow&&points?.some(p=>p.provisional));
 const incompletePerformance=Boolean(flow&&marketplace==='ozon'&&points?.some(p=>p.adUnconfirmed));
 const unavailable=Boolean(points&&!hasValue);
 return <section className="ozf-dynamics"><div className="bi-switches">{(['orders','buyouts','revenue','profit'] as const).map(k=><button aria-pressed={!flow&&metric===k} onClick={()=>{setMetric(k);setFlow(false)}} key={k}>{names[k]}</button>)}<button aria-pressed={flow} onClick={()=>setFlow(true)}>Структура, %</button></div>
 <div className="bi-title"><h3>{flow?'Структура затрат и результата':marketplace==='ozon'&&metric==='revenue'?'Выручка по начислениям':marketplace==='wb'&&metric==='revenue'?'Оборот WB по полной цене':names[metric]}</h3>{!flow&&<button className="ozf-btn" style={{minHeight:28,padding:'4px 8px',fontSize:10}} onClick={()=>setZero(v=>!v)}>{zero?'Шкала от нуля':'Автомасштаб'}</button>}</div>
 {error?<p className="ozf-error" role="alert">{error}</p>:!points?<div className="bi-skeleton" role="status">Подготавливаем весь период…</div>:unavailable?<p className="ozf-error" role="alert">Для выбранного графика пока нет подтверждённых данных.</p>:<>
  {mismatch&&<p className="ozf-notice" role="status">Дневная прибыль пока не сверена с итогом периода: сумма по дням {new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(actual!)} ₽, итог {new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(expectedProfit!)} ₽, расхождение {new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(actual!-expectedProfit!)} ₽. График доступен для анализа, но суммы пока нельзя считать сверенными.</p>}
  {hasGaps&&<p className="bi-note">Часть дней не содержит достаточных данных для выбранной метрики. Пропуски не заменены нулём.</p>}
 {provisionalFlow&&<p className="bi-note">Структура предварительная: доли рассчитаны только из известных величин. Отсутствующие статьи не заменены нулями; 100% здесь не означает полный финансовый результат.</p>}
 {marketplace==='ozon'&&flow&&<p className="bi-note">Реклама в структуре: фактические доступные расходы кампаний по дате показов, при отсутствии истории показываются начисления Seller. Эти суммы справочные и не вычитаются повторно из прибыли. Остальные доли предварительные до сверки бухгалтерских дат.{incompletePerformance?' История кампаний ещё неполная.':''}</p>}
 <BiChart points={plot} series={keys.map(key=>({key,label:names[key],color:flow?flowColors[key]:colors[key],negativeColor:key==='profit'?'#ef4444':undefined}))} unit={flow?'%':['orders','buyouts'].includes(metric)?'шт.':'₽'} stacked={flow} zero={zero} label={flow?'Доли затрат и прибыли по дням':names[metric]}/>{flow&&<div className="bi-legend">{keys.map(k=><span key={k}><i style={{background:flowColors[k]}}/>{names[k]}</span>)}</div>}</>}
 </section>;
}
