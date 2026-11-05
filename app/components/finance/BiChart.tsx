'use client';
import {useEffect,useId,useRef,useState} from 'react';
import './bi-charts.css';
export type ChartPoint={day:string;values:Record<string,number|null>};
export type ChartSeries={key:string;label:string;color:string;negativeColor?:string};
export const chartNumber=(n:number|null,unit:string,compact=false)=>n===null?'Нет данных':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:compact?1:2,...(compact?{notation:'compact' as const}:{})}).format(n)+(unit?' '+unit:'');
export function chartDomain(values:number[],zero=false){if(!values.length)return [0,1];const min=Math.min(...values),max=Math.max(...values),pad=(max-min||Math.max(Math.abs(max)*.1,1))*.16;return [zero?Math.min(0,min-pad):min>=0?Math.max(0,min-pad):min-pad,Math.max(max+pad,zero?1:-Infinity)];}
export default function BiChart({points,series,unit='₽',stacked=false,zero=false,label}:{points:ChartPoint[];series:ChartSeries[];unit?:string;stacked?:boolean;zero?:boolean;label:string}){
 const ref=useRef<HTMLDivElement>(null),[width,setWidth]=useState(900),[active,setActive]=useState<number|null>(null),id=useId().replace(/:/g,'');
 useEffect(()=>{const el=ref.current;if(!el)return;const observer=new ResizeObserver(([e])=>setWidth(e.contentRect.width));observer.observe(el);return()=>observer.disconnect()},[]);
 const w=Math.max(width,points.length*36+100,340),h=476,left=76,right=20,top=22,bottom=48,plot=w-left-right;
 const values=points.flatMap(p=>series.map(s=>p.values[s.key]).filter((v):v is number=>v!==null&&v!==undefined&&Number.isFinite(v)));
 const [lo,hi]=stacked?[0,100]:chartDomain(values,zero||values.some(v=>v<0));
 const x=(i:number)=>left+(i+.5)/Math.max(1,points.length)*plot;
 const y=(v:number)=>h-bottom-(v-lo)/(hi-lo)*(h-top-bottom);
 const selected=active===null?null:points[active],barWidth=plot/Math.max(1,points.length);
 const missing=points.some(p=>series.some(s=>p.values[s.key]===null||p.values[s.key]===undefined));
 const flowLabels=selected&&stacked?series.map((s,i)=>{
  const start=series.slice(0,i).reduce((sum,v)=>sum+Math.max(0,selected.values[v.key]??0),0);
  const value=Math.max(0,selected.values[s.key]??0),side=i%2===0?'left':'right';
  const tipY=[108,142,314,348][i]??(88+i*43);
  return {series:s,value,sourceY:y(Math.min(100,start+value/2)),side,tipY};
 }):[];
 return <div className="bi-chart-viewport" ref={ref}><div className="bi-chart-canvas" style={{width:w,height:h}}>
 <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} tabIndex={0}
  onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setActive(i=>Math.max(0,Math.min(points.length-1,(i??0)+(e.key==='ArrowRight'?1:-1))))}if(e.key==='Escape')setActive(null)}}
  onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();setActive(Math.max(0,Math.min(points.length-1,Math.floor((e.clientX-r.left-left)/plot*points.length))))}}
  onPointerLeave={()=>setActive(null)}>
 <defs>{series.flatMap(s=>[
  <linearGradient id={id+s.key} key={s.key} x1="0" y1="0" x2="0" y2="1"><stop stopColor={s.color} stopOpacity=".22"/><stop offset="1" stopColor={s.color} stopOpacity="0"/></linearGradient>,
  <linearGradient id={id+s.key+'negative'} key={s.key+'negative'} x1="0" y1="0" x2="0" y2="1"><stop stopColor={s.negativeColor??'#ef4444'} stopOpacity=".08"/><stop offset="1" stopColor={s.negativeColor??'#ef4444'} stopOpacity=".42"/></linearGradient>,
  <clipPath id={id+s.key+'positive'} key={s.key+'positive'}><rect x={left} y={top} width={plot} height={Math.max(0,Math.min(h-bottom,y(0))-top)}/></clipPath>,
  <clipPath id={id+s.key+'negative-clip'} key={s.key+'negative-clip'}><rect x={left} y={Math.max(top,Math.min(h-bottom,y(0)))} width={plot} height={Math.max(0,h-bottom-Math.max(top,Math.min(h-bottom,y(0))))}/></clipPath>
 ])}</defs>
 {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={w-right} y1={y(lo+(hi-lo)*t)} y2={y(lo+(hi-lo)*t)} stroke="currentColor" opacity=".09"/><text x={left-10} y={y(lo+(hi-lo)*t)+4} textAnchor="end" className="bi-axis">{chartNumber(lo+(hi-lo)*t,unit,true)}</text></g>)}
 {stacked?points.map((p,i)=>{let level=0,cell=barWidth,barX=left+i*cell;
  const unavailable=series.some(s=>p.values[s.key]===null||p.values[s.key]===undefined);
  return <g key={p.day}>{unavailable?<rect x={barX+1} y={top} width={Math.max(0,cell-2)} height={h-bottom-top} fill="#475569" opacity=".07" stroke="#64748b" strokeDasharray="4 5"/>:series.map(s=>{const v=Math.max(0,p.values[s.key]??0),start=level;level+=v;return <rect key={s.key} x={barX} y={y(level)} width={cell} height={Math.max(0,y(start)-y(level))} fill={s.color} stroke="#64748b" strokeOpacity=".34" strokeWidth=".35" opacity=".97"/>})}
  {!unavailable&&<rect x={barX+.5} y={y(100)+.5} width={Math.max(0,cell-1)} height={Math.max(0,y(0)-y(100)-1)} fill="none" stroke="#91a4c5" strokeOpacity=".42"/>}</g>;
 }):series.map(s=>{
  const segments:Array<Array<[number,number]>>=[];let current:Array<[number,number]>=[];
  for(let i=0;i<points.length;i++){const value=points[i].values[s.key];if(value===null||value===undefined){if(current.length)segments.push(current);current=[];continue;}current.push([x(i),y(value)]);}
  if(current.length)segments.push(current);
  return <g key={s.key}>{segments.map((seg,j)=>{const d=seg.map(([a,b],k)=>(k?'L':'M')+a+','+b).join(' ');
   const baseline=Math.max(top,Math.min(h-bottom,y(0))),area=`${d} L${seg.at(-1)![0]},${baseline} L${seg[0][0]},${baseline} Z`;
   return <g key={j}><path d={area} fill={`url(#${id+s.key})`} clipPath={`url(#${id+s.key+'positive'})`}/>
   <path d={area} fill={`url(#${id+s.key+'negative'})`} clipPath={`url(#${id+s.key+'negative-clip'})`}/>
   <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
   <path d={d} fill="none" stroke={s.negativeColor??'#ef4444'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${id+s.key+'negative-clip'})`}/>
   </g>})}</g>;
 })}
 {points.map((p,i)=><text className="bi-axis" x={x(i)} y={h-12} textAnchor="middle" key={p.day}>{p.day.slice(8)}.{p.day.slice(5,7)}</text>)}
 {selected&&active!==null&&<g pointerEvents="none">
  {stacked&&<>
   <rect x={left} y={top} width={Math.max(0,x(active)-barWidth/2-left)} height={h-bottom-top} fill="#02050b" opacity=".69"/>
   <rect x={x(active)+barWidth/2} y={top} width={Math.max(0,w-right-x(active)-barWidth/2)} height={h-bottom-top} fill="#02050b" opacity=".69"/>
   <rect x={x(active)-barWidth/2} y={top} width={barWidth} height={h-bottom-top} fill="none" stroke="#d8e5fa" strokeWidth="1.2" strokeOpacity=".85"/>
   {flowLabels.map(({series:s,value,sourceY,side,tipY})=>{
    const sign=side==='left'?-1:1,sourceX=x(active)+sign*barWidth/2;
    const endX=Math.max(125,Math.min(w-125,x(active)+sign*205));
    const elbowX=x(active)+sign*65;
    return <g key={s.key}>
     <polyline points={`${sourceX},${sourceY} ${elbowX},${tipY} ${endX},${tipY}`} fill="none" stroke={s.color} strokeWidth="1.8"/>
     <circle cx={sourceX} cy={sourceY} r="3.2" fill={s.color}/>
     <text x={endX+sign*7} y={tipY-7} fill="#e5edfb" textAnchor={side==='left'?'end':'start'} fontSize="13" fontWeight="650">{Math.round(value*100)/100}% {s.label}</text>
    </g>;
   })}
   <rect x={x(active)-61} y={217} width="122" height="42" rx="10" fill="#081321" stroke="#a6bfd7" strokeOpacity=".8"/>
   <text x={x(active)} y={243} fill="#fff" textAnchor="middle" fontSize="14" fontWeight="700">{selected.day.split('-').reverse().join('.')}</text>
  </>}
  {!stacked&&<><line x1={x(active)} x2={x(active)} y1={top} y2={h-bottom} stroke="#b9c9e6" opacity=".55" strokeDasharray="3 4"/>
   {series.map(s=>selected.values[s.key]===null||selected.values[s.key]===undefined?null:<circle key={s.key} cx={x(active)} cy={y(selected.values[s.key]!)} r="5" fill={s.color} stroke="#0d1729" strokeWidth="2"/>)}</>}
 </g>}
 {!points.length&&<text x={w/2} y={h/2} textAnchor="middle" className="bi-axis">Нет подтверждённых данных</text>}
 </svg>
 {!stacked&&selected&&active!==null&&<div className="bi-tooltip" role="status" style={{left:Math.max(8,Math.min(w-235,x(active)+14)),top:12}}>
 <time>{selected.day.split('-').reverse().join('.')}</time>
 {series.map(s=><div key={s.key}><span><i style={{background:s.color}}/>{s.label}</span><b>{chartNumber(selected.values[s.key]??null,unit)}</b></div>)}</div>}
 {missing&&<span className="bi-screenreader">Некоторые дни ещё не получены из источника, пропуски не заменены нулями.</span>}
 </div></div>;
}
