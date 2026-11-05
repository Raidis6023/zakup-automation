/**
 * MPStats: subject-based WB comparison.
 * Client-side tokens are prohibited. No fabricated buyout or SPP.
 * Official analytics paths from MPStats documentation; return null if the
 * provider's response doesn't carry an explicitly identified metric.
 */
export type WbMpStatsMetrics=Readonly<{
 subject:string;
 source:"mpstats";
 subjectId:string;
 sampledProducts:number;
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
 if(Array.isArray(value))return value.filter(x=>x&&typeof x==="object"&&!Array.isArray(x));
 if(!value||typeof value!=="object")return [];
 const obj=value as Record<string,unknown>;
 for(const key of ["data","items","rows","result","results"]){
  if(Array.isArray(obj[key]))return arrayFrom(obj[key]);
  if(obj[key]&&typeof obj[key]==="object"){
   const nested=arrayFrom(obj[key]);
   if(nested.length)return nested;
  }
 }
 return [];
}
/** Only explicit *buyout* fields can represent buyout. `purchase` is add-to-cart. */
export function readSubjectBuyout(raw:unknown):{ratio:number|null;field:string|null}{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return{ratio:null,field:null};
 const value=raw as Record<string,unknown>;
 for(const key of ["buyout_percent","buyoutPercent","subject_buyout_percent","subjectBuyoutPercent"]){
  const ratio=asPercent(value[key]);
  if(ratio!==null)return{ratio,field:key};
 }
 for(const key of ["buyout_rate","buyoutRatio"]){
  const r=value[key];
  if(typeof r==="number"&&Number.isFinite(r)&&r>=0&&r<=1)return{ratio:r,field:key};
 }
 for(const key of ["data","result","stats","metrics"]){
  if(value[key]&&typeof value[key]==="object"){
   const nested=readSubjectBuyout(value[key]);
   if(nested.field)return{ratio:nested.ratio,field:key+"."+nested.field};
  }
 }
 return{ratio:null,field:null};
}
/** MPStats `client_sale`: buyer discount in percent units [0,100]. */
export function averageSubjectSpp(rows:readonly Record<string,unknown>[]):{rate:number|null;sampled:number}{
 let weighted=0,totalSales=0,count=0;
 for(const row of rows){
  const sale=asPercent(row.client_sale);
  const sales=row.sales;
  if(sale===null||typeof sales!=="number"||!Number.isFinite(sales)||sales<=0)continue;
  weighted+=sale*sales;totalSales+=sales;count++;
 }
 return{rate:totalSales>0?weighted/totalSales:null,sampled:count};
}
function readSubject(value:Record<string,unknown>){
 const id=value.id??value.subject_id??value.subjectId;
 const name=value.name??value.subject_name??value.subjectName??value.subject??value.title;
 const group=value.subject_group??value.subjectGroup??value.group??value.category;
 return {id:typeof id==="number"||typeof id==="string"?String(id):"",
  name:typeof name==="string"?name:"",
  group:typeof group==="string"?group:""};
}
/**
 * Called only after WB category is explicitly confirmed in our unit calculator.
 * Buyout must be a documented percent field, NOT `purchase` (which can be
 * counts/add-to-cart) and NOT `purchase_after_return` without a verified unit.
 */
export async function getWbSubjectMpstats(subject:string,fbs:boolean,token:string,subjectGroup?:string):Promise<WbMpStatsMetrics>{
 if(!token?.trim())throw new MpStatsError("unconfigured","Ключ MPStats не настроен. Добавьте его в разделе «Администрирование → API».");
 const range=dates(30);
 const listUrl=new URL("https://mpstats.io/api/analytics/v1/wb/subject/list");
 listUrl.searchParams.set("date",range.to);
 const subjects=arrayFrom(await provider(listUrl,token));
 const named=subjects.map(readSubject).filter(x=>x.id&&norm(x.name)===norm(subject));
 const grouped=named.filter(x=>subjectGroup&&x.group&&norm(x.group)===norm(subjectGroup));
 const matches=grouped.length===1?grouped:named;
 if(matches.length!==1)throw new MpStatsError("data-missing",
  "Не удалось однозначно сопоставить предмет MPStats: "+subject+
  (subjectGroup?" / "+subjectGroup:"")+". Совпадений: "+matches.length);
 const infoUrl=new URL("https://mpstats.io/api/analytics/v1/wb/subject/"+encodeURIComponent(matches[0].id));
 const info=await provider(infoUrl,token,"GET") as Record<string,unknown>;
 const comments:string[]=[];
 const buyout=readSubjectBuyout(info);
 const buyoutRate=buyout.ratio;
 const buyoutOrigin=buyout.field?"MPStats subject/"+matches[0].id+" / "+buyout.field:null;
 if(buyoutRate===null)comments.push("MPStats не вернул однозначно обозначенный процент выкупа предмета; неподтверждённые показатели не используются");
 // SPP = current average client discount (client_sale) of sampled products.
 // This is a *sample estimate*, not MPStats unit-calculator's seven-day average.
 const seven=dates(7);
 const url=new URL("https://mpstats.io/api/analytics/v1/wb/subject/items");
 for(const [k,v] of Object.entries({d1:seven.from,d2:seven.to,path:matches[0].id,fbs:fbs?"1":"0"}))url.searchParams.set(k,v);
 const rows=arrayFrom(await provider(url,token,"POST",{startRow:0,endRow:500,filterModel:{},sortModel:[{colId:"sales",sort:"desc"}]}));
 const {rate:spp,sampled}=averageSubjectSpp(rows);
 if(spp===null)comments.push("MPStats не вернул достоверных данных о СПП; значение не подставлялось");
 else comments.push("СПП предварительная: взвешенная по продажам оценка по "+sampled+" товарам предмета за 7 завершённых дней. Не официальный средний СПП калькулятора");
 return{subject,subjectId:matches[0].id,sampledProducts:sampled,source:"mpstats",sampledAt:new Date().toISOString(),range,
  buyoutRate,wbSppRate:spp,buyoutOrigin,
  sppOrigin:spp===null?null:"MPStats subject/items, client_sale, 7 completed days, sales-weighted",
  comments};
}
