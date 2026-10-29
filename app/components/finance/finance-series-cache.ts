import type {Report} from './finance-series';
type Bundle=Array<{day:string;report:Report}>;
const pending=new Map<string,Promise<Bundle>>(),ready=new Map<string,{at:number;data:Bundle}>();
const ttl=30*60*1000,prefix='finance-series-v4-daily:';
const fields=['article','offer_id','income','revenue','cogs','mayak','mayak_expense','result','estimated_result','advertising','advertising_amount','orders','order_count','buyouts','buyout_units'];
let generation=0;let running=0;const waiting:Array<()=>void>=[];
async function report(url:string):Promise<Report>{if(running>=2)await new Promise<void>(r=>waiting.push(r));else running++;try{const r=await fetch(url,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error??'Не удалось загрузить динамику');return {...d,rows:d.rows.map((row:Record<string,unknown>)=>Object.fromEntries(fields.map(k=>[k,row[k]])))};}finally{const next=waiting.shift();if(next)next();else running--;}}
export function clearFinanceSeries(){generation++;ready.clear();pending.clear();try{for(const key of Object.keys(sessionStorage))if(key.startsWith(prefix))sessionStorage.removeItem(key)}catch{}}
export function prepareFinanceSeries(market:string,from:string,to:string,revision=''):Promise<Bundle>{
 const key=prefix+[market,from,to,revision].join(':');
 const cached=ready.get(key);if(cached&&Date.now()-cached.at<ttl)return Promise.resolve(cached.data);
 if(pending.has(key))return pending.get(key)!;
 try{const raw=sessionStorage.getItem(key);if(raw){const item=JSON.parse(raw);if(Date.now()-item.at<ttl){ready.set(key,item);return Promise.resolve(item.data)}}}catch{}
 const epoch=generation;const job=(async()=>{const start=Date.parse(from),end=Date.parse(to);if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||end-start>90*86400000)throw Error('Проверьте период графика');
 const days=Array.from({length:Math.round((end-start)/86400000)+1},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
 // Fetch independent daily snapshots. The previous implementation requested
 // cumulative windows (from..day) and subtracted neighbouring reports. If a
 // marketplace cache was refreshed while those requests were running, two
 // neighbouring snapshots could belong to different revisions and produce a
 // fake one-day spike. A single-day report is both faster and arithmetically
 // stable: no subtraction of independently rebuilt cumulative reports.
 const data=await Promise.all(days.map(async day=>({day,report:await report(`/api/agents/${market}-finance?from=${day}&to=${day}&compact=1`)})));
 const item={at:Date.now(),data};if(epoch!==generation)return data;ready.set(key,item);if(ready.size>6)ready.delete(ready.keys().next().value!);
 try{const keys=Object.keys(sessionStorage).filter(k=>k.startsWith(prefix));while(keys.length>=2)sessionStorage.removeItem(keys.shift()!);sessionStorage.setItem(key,JSON.stringify(item))}catch{}
 return data;})();pending.set(key,job);job.finally(()=>{if(pending.get(key)===job)pending.delete(key)}).catch(()=>{});return job;
}
