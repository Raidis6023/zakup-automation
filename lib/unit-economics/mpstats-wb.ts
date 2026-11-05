/**
 * MPStats: subject-based WB comparison.
 * Client-side tokens are prohibited. No fabricated buyout or SPP.
 * Official analytics paths from MPStats documentation; return null if the
 * provider's response doesn't carry an explicitly identified metric.
 */
export type WbMpStatsMetrics=Readonly<{
 subject:string;
 source:"mpstats";
 sampledAt:string;
 range:{from:string;to:string};
 buyoutRate:number|null;
 wbSppRate:number|null;
 buyoutOrigin:string|null;
 sppOrigin:string|null;
 comments:string[];
}>;
export class MpStatsError extends Error{
 constructor(public kind:"unconfigured"|"invalid"|"unavailable"|"rate-limited"|"data-missing",message:string){
  super(message);this.name="MpStatsError";
 }
}
const norm=(v:string)=>v.toLowerCase().replace(/ё/g,"е").trim();
function asPercent(v:unknown):number|null{
 if(typeof v!=="number"||!Number.isFinite(v)||v<0||v>100)return null;
 return v/100;
}
function dateISO(d:Date){return d.toISOString().slice(0,10)}
function dates(days:number){const b=new Date(),end=new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth(),b.getUTCDate()-1)),start=new Date(end.getTime()-(days-1)*86400000);return{from:dateISO(start),to:dateISO(end)}}
async function provider(url:URL,token:string,method:"POST"|"GET"="POST",body?:object):Promise<unknown>{
 const response=await fetch(url,{method,headers:{"X-Mpstats-TOKEN":token,"Content-Type":"application/json"},
  ...(method==="POST"?{body:JSON.stringify(body||{})}:{}),
  cache:"no-store",signal:AbortSignal.timeout(15000)});
 if(response.status===401)throw new MpStatsError("invalid","MPStats отклонил токен (401)");
 if(response.status===429)throw new MpStatsError("rate-limited","Превышен лимит MPStats; повторите после окончания ограничения");
 if(response.status===202)throw new MpStatsError("unavailable","MPStats ещё формирует отчёт");
 if(!response.ok)throw new MpStatsError("unavailable","MPStats вернул ошибку "+response.status);
 return response.json();
}
function arrayFrom(value:unknown):Record<string,unknown>[]{
 if(Array.isArray(value))return value.filter(x=>x&&typeof x==="object");
 if(!value||typeof value!=="object")return [];
 const obj=value as Record<string,unknown>;
 return Array.isArray(obj.data)?obj.data.filter(x=>x&&typeof x==="object"):[];
}
function readSubject(value:Record<string,unknown>){
 const id=value.id??value.subject_id??value.subjectId;
 const name=value.name??value.subject??value.title;
 return {id:typeof id==="number"||typeof id==="string"?String(id):"",
  name:typeof name==="string"?name:""};
}
/**
 * Called only after WB category is explicitly confirmed in our unit calculator.
 * Buyout must be a documented percent field, NOT `purchase` (which can be
 * counts/add-to-cart) and NOT `purchase_after_return` without a verified unit.
 */
export async function getWbSubjectMpstats(subject:string,fbs:boolean,token:string):Promise<WbMpStatsMetrics>{
 if(!token?.trim())throw new MpStatsError("unconfigured","Ключ MPStats не настроен. Добавьте его в разделе «Администрирование → API».");
 const range=dates(30);
 const listUrl=new URL("https://mpstats.io/api/analytics/v1/wb/subject/list");
 listUrl.searchParams.set("date",range.to);
 const subjects=arrayFrom(await provider(listUrl,token));
 const matches=subjects.map(readSubject).filter(x=>x.id&&norm(x.name)===norm(subject));
 if(matches.length!==1)throw new MpStatsError("data-missing","Не удалось однозначно сопоставить предмет MPStats: "+subject);
 const infoUrl=new URL("https://mpstats.io/api/analytics/v1/wb/subject/"+encodeURIComponent(matches[0].id));
 const info=await provider(infoUrl,token,"GET") as Record<string,unknown>;
 const infoObject=info&&typeof info==="object"?info:{};
 const comments:string[]=[];
 // Explicit percent metrics only. The current public contract does not
 // guarantee these fields, so the safe fallback is null.
 let buyoutRate:number|null=null;
 let buyoutOrigin:string|null=null;
 for(const field of ["buyout_percent","buyout_after_return_percent","purchase_percent"]){
  const n=asPercent(infoObject[field]);
  if(n!==null){buyoutRate=n;buyoutOrigin="MPStats subject/"+matches[0].id+" / "+field;break;}
 }
 if(buyoutRate===null)comments.push("В ответе MPStats не найден подтверждённый процент выкупа по предмету; значение не подставлялось");
 // SPP = current average client discount (client_sale) of sampled products.
 // This is a *sample estimate*, not MPStats unit-calculator's seven-day average.
 const seven=dates(7);
 const url=new URL("https://mpstats.io/api/analytics/v1/wb/subject/items");
 for(const [k,v] of Object.entries({d1:seven.from,d2:seven.to,path:matches[0].id,fbs:fbs?"1":"0"}))url.searchParams.set(k,v);
 const rows=arrayFrom(await provider(url,token,"POST",{startRow:0,endRow:500,filterModel:{},sortModel:[{colId:"sales",sort:"desc"}]}));
 let numerator=0,denominator=0;
 for(const row of rows){
  const sale=asPercent(row.client_sale);
  if(sale===null)continue;
  const weight=typeof row.sales==="number"&&Number.isFinite(row.sales)&&row.sales>0?row.sales:1;
  numerator+=sale*weight;denominator+=weight;
 }
 const spp=denominator>0?numerator/denominator:null;
 if(spp===null)comments.push("MPStats не вернул достоверных данных о СПП; значение не подставлялось");
 else comments.push("СПП оценена по выборке максимум 500 товаров предмета за 7 дней, взвешена по продажам. Не официальный средний СПП калькулятора");
 return{subject,source:"mpstats",sampledAt:new Date().toISOString(),range,
  buyoutRate,wbSppRate:spp,buyoutOrigin,
  sppOrigin:spp===null?null:"MPStats subject/items, client_sale, 7 completed days, sales-weighted",
  comments};
}
