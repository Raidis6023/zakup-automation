'use client';
import {useEffect,useId,useRef,useState} from 'react';
import './bi-charts.css';
export type ChartPoint={day:string;values:Record<string,number|null>};
export type ChartSeries={key:string;label:string;color:string};
export const chartNumber=(n:number|null,unit:string,compact=false)=>n===null?'Нет данных':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:compact?1:2,...(compact?{notation:'compact' as const}:{})}).format(n)+(unit?' '+unit:'');
export function chartDomain(values:number[],zero=false){if(!values.length)return [0,1];const min=Math.min(...values),max=Math.max(...values),pad=(max-min||Math.max(Math.abs(max)*.1,1))*.16;return [zero?Math.min(0,min-pad):min>=0?Math.max(0,min-pad):min-pad,Math.max(max+pad,zero?1:-Infinity)];}
export default function BiChart({points,series,unit='₽',stacked=false,zero=false,label}:{points:ChartPoint[];series:ChartSeries[];unit?:string;stacked?:boolean;zero?:boolean;label:string}){
 const ref=useRef<HTMLDivElement>(null),[width,setWidth]=useState(900),[active,setActive]=useState<number|null>(null),id=useId().replace(/:/g,'');
 useEffect(()=>{const el=ref.current;if(!el)return;const observer=new ResizeObserver(([e])=>setWidth(e.contentRect.width));observer.observe(el);return()=>observer.disconnect()},[]);
 const w=Math.max(width,points.length*36+100,340),h=238,left=76,right=20,top=18,bottom=38,plot=w-left-right;
 const values=points.flatMap(p=>series.map(s=>p.values[s.key])).filter((n):n is number=>n!==null&&Number.isFinite(n));
 const stacks=points.map(p=>series.reduce((a,s)=>{const v=p.values[s.key]??0;return [a[0]+Math.min(0,v),a[1]+Math.max(0,v)]},[0,0]));
 const [lo,hi]=stacked?[Math.min(0,...stacks.map(s=>s[0])),Math.max(100,...stacks.map(s=>s[1]))]:chartDomain(values,zero);
 const x=(i:number)=>left+(i+.5)/Math.max(1,points.length)*plot,y=(v:number)=>h-bottom-(v-lo)/(hi-lo)*(h-top-bottom),selected=active===null?null:points[active];
 return <div className="bi-chart-viewport" ref={ref}><div className="bi-chart-canvas" style={{width:w,height:h}}>
 <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} tabIndex={0} onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setActive(i=>Math.max(0,Math.min(points.length-1,(i??0)+(e.key==='ArrowRight'?1:-1))))}if(e.key==='Escape')setActive(null)}} onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();setActive(Math.max(0,Math.min(points.length-1,Math.floor((e.clientX-r.left-left)/plot*points.length))))}} onPointerLeave={()=>setActive(null)}>
 <defs>{series.map(s=><linearGradient id={id+s.key} key={s.key} x1="0" y1="0" x2="0" y2="1"><stop stopColor={s.color} stopOpacity=".22"/><stop offset="1" stopColor={s.color} stopOpacity="0"/></linearGradient>)}</defs>
 {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={w-right} y1={y(lo+(hi-lo)*t)} y2={y(lo+(hi-lo)*t)} stroke="currentColor" opacity=".09"/><text x={left-10} y={y(lo+(hi-lo)*t)+4} textAnchor="end" className="bi-axis">{chartNumber(lo+(hi-lo)*t,unit,true)}</text></g>)}
 {stacked?points.map((p,i)=>{let positive=0,negative=0;return <g key={p.day}>{series.map(s=>{const v=p.values[s.key];if(v===null)return null;const start=v>=0?positive:negative;if(v>=0)positive+=v;else negative+=v;return <rect key={s.key} x={x(i)-plot/points.length*.34} y={y(Math.max(start,start+v))} width={plot/points.length*.68} height={Math.max(0,Math.abs(y(start)-y(start+v)))} fill={s.color} opacity={active===null||active===i?.92:.45} rx="2"/>})}</g>}):series.map(s=>{const segments:Array<Array<[number,number]>>=[];points.forEach((p,i)=>{const v=p.values[s.key];if(v===null||!Number.isFinite(v))return;if(i===0||points[i-1].values[s.key]===null)segments.push([]);if(!segments.length)segments.push([]);segments.at(-1)!.push([x(i),y(v)]);});return <g key={s.key}>{segments.map((seg,i)=>{const d=seg.map(([a,b],j)=>(j?'L':'M')+a+','+b).join(' ');return <g key={i}><path d={`${d} L${seg.at(-1)![0]},${h-bottom} L${seg[0][0]},${h-bottom} Z`} fill={`url(#${id+s.key})`}/><path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>{seg.length===1&&<circle cx={seg[0][0]} cy={seg[0][1]} r="3" fill={s.color}/>}</g>})}</g>})}
 {points.map((p,i)=><text className="bi-axis" x={x(i)} y={h-12} textAnchor="middle" key={p.day}>{p.day.slice(8)}.{p.day.slice(5,7)}</text>)}
 {selected&&active!==null&&<g><line x1={x(active)} x2={x(active)} y1={top} y2={h-bottom} stroke="#b9c9e6" opacity=".55" strokeDasharray="3 4"/>{!stacked&&series.map(s=>selected.values[s.key]===null?null:<circle key={s.key} cx={x(active)} cy={y(selected.values[s.key]!)} r="5" fill={s.color} stroke="#0d1729" strokeWidth="2"/>)}</g>}
 {!values.length&&<text x={w/2} y={h/2} textAnchor="middle" className="bi-axis">Нет подтверждённых данных за период</text>}
 </svg>
 {selected&&active!==null&&<div className="bi-tooltip" role="status" style={{left:Math.max(8,Math.min(w-235,x(active)+14)),top:12}}><time>{selected.day.split('-').reverse().join('.')}</time>{series.map(s=><div key={s.key}><span><i style={{background:s.color}}/>{s.label}</span><b>{chartNumber(selected.values[s.key],unit)}</b></div>)}</div>}
 </div></div>;
}
