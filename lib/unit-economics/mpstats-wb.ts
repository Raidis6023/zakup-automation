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
 scope:"subject"|"category";
 categoryPath:string|null;
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


export type MpstatsSelection=Readonly<{
 scope:"subject"|"category";
 path:string;label:string;
}>;
type TaxonomyCache={expires:number;categories:MpstatsSelection[];subjects:MpstatsSelection[]};
let taxonomyCache:TaxonomyCache|null=null;
function namePath(obj:Record<string,unknown>):string{
 const path=typeof obj.path==="string"?obj.path.trim():"";
 const name=typeof obj.name==="string"?obj.name.trim():"";
 return path||name;
}
async function getTaxonomy(token:string):Promise<TaxonomyCache>{
 if(taxonomyCache&&taxonomyCache.expires>Date.now())return taxonomyCache;
 const range=dates(30);
 const categoryURL=new URL("https://mpstats.io/api/analytics/v1/wb/category/list");
 const subjectURL=new URL("https://mpstats.io/api/analytics/v1/wb/subject/list");
 subjectURL.searchParams.set("date",range.to);
 const [rawCategories,rawSubjects]=await Promise.all([
  provider(categoryURL,token,"POST",{}),provider(subjectURL,token)
 ]);
 const categoryMap=new Map<string,MpstatsSelection>();
 for(const obj of arrayFrom(rawCategories)){
  const path=namePath(obj);
  if(!path)continue;
  categoryMap.set(path,{scope:"category",path,label:path});
 }
 const subjectMap=new Map<string,MpstatsSelection>();
 for(const obj of arrayFrom(rawSubjects)){
  const item=readSubject(obj);
  if(!item.id||!item.name)continue;
  subjectMap.set(item.id,{scope:"subject",path:item.id,
   label:item.group?item.name+" / "+item.group:item.name});
 }
 taxonomyCache={expires:Date.now()+15*60*1000,
  categories:[...categoryMap.values()],subjects:[...subjectMap.values()]};
 return taxonomyCache;
}
function terms(s:string):string[]{
 return norm(s).replace(/[^а-яa-z0-9]+/g," ").split(" ")
  .filter(x=>x.length>2).map(x=>x.slice(0,Math.min(x.length,5)));
}
export async function searchMpstatsTaxonomy(token:string,query:string,group?:string,
 limit=40):Promise<{items:MpstatsSelection[];total:number;matched:number}>{
 const taxonomy=await getTaxonomy(token);
 const all=[...taxonomy.subjects,...taxonomy.categories];
 const needle=norm(query),stem=terms(query);
 const parent=group?norm(group):"";
 const scored=all.map(item=>{
  const full=norm(item.label),leaf=norm(item.label.split("/").at(-1)||"");
  const hits=stem.filter(w=>terms(full).some(t=>t.startsWith(w)||w.startsWith(t))).length;
  const exact=full===needle||leaf===needle;
  const inGroup=parent&&full.includes(parent);
  const score=(exact?100:0)+(full.includes(needle)&&needle.length>2?38:0)+hits*13+
   (inGroup?9:0)+(item.scope==="subject"?2:0);
  return{item,score};
 }).filter(x=>x.score>0)
  .sort((a,b)=>b.score-a.score||a.item.label.localeCompare(b.item.label,"ru"));
 const matched=scored.length;
 // Even when subject-name variants differ, expose nearby taxonomy entries
 // from the same broad group for human confirmation; do not auto-select them.
 if(!matched&&parent){
  const byGroup=all.filter(item=>norm(item.label).includes(parent));
  return{items:byGroup.slice(0,limit),total:all.length,matched:0};
 }
 return{items:scored.slice(0,limit).map(x=>x.item),total:all.length,matched};
}
export async function validateMpstatsSelection(
 token:string,selection:{scope:string;path:string}
):Promise<MpstatsSelection|null>{
 const list=await getTaxonomy(token);
 return [...list.subjects,...list.categories].find(
  x=>x.scope===selection.scope&&x.path===selection.path
 )||null;
}

type CategoryRef={name:string;path:string};
export function matchMpstatsCategory(raw:unknown,subject:string,group?:string):CategoryRef|null{
 const target=norm(subject),parent=group?norm(group):"";
 const categories=arrayFrom(raw).map(x=>{
  const name=typeof x.name==="string"?x.name:"";
  const path=namePath(x);
  return{name,path};
 }).filter(x=>x.path&&(
  norm(x.name)===target||
  norm(x.path.split("/").filter(Boolean).at(-1)||"")===target
 ));
 const inGroup=parent?categories.filter(x=>x.path.split("/").some(segment=>norm(segment)===parent)):[];
 // Never select a different root department merely to obtain a numeric result.
 if(parent){
  if(inGroup.length===1)return inGroup[0];
  if(inGroup.length>1)return null;
  if(categories.length===1&&norm(categories[0].path).startsWith(parent+"/"))return categories[0];
  return null;
 }
 return categories.length===1?categories[0]:null;
}
export function matchMpstatsCategoryRoot(raw:unknown,group:string):CategoryRef|null{
 const target=norm(group);
 const options=arrayFrom(raw).map(x=>({
  name:typeof x.name==="string"?x.name:"",
  path:namePath(x)
 })).filter(x=>x.path&&norm(x.path.split("/").filter(Boolean).at(-1)||"")===target);
 if(!options.length)return null;
 const minDepth=Math.min(...options.map(x=>x.path.split("/").length));
 const nearest=options.filter(x=>x.path.split("/").length===minDepth);
 return nearest.length===1?nearest[0]:null;
}
export function uniqueSubjectIdFromCategoryItems(rows:readonly Record<string,unknown>[],name:string):string|null{
 // The MPStats WB category/products response includes subject_id and subject.
 const values=new Set<string>();
 for(const row of rows){
  const subject=typeof row.subject==="string"?row.subject:
   typeof row.subject_name==="string"?row.subject_name:"";
  const id=row.subject_id??row.subjectId;
  if(!subject||norm(subject)!==norm(name)||!(typeof id==="string"||typeof id==="number"))continue;
  values.add(String(id));
 }
 return values.size===1?[...values][0]:null;
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
export async function getWbSubjectMpstats(subject:string,fbs:boolean,token:string,subjectGroup?:string,confirmed?:MpstatsSelection):Promise<WbMpStatsMetrics>{
 if(!token?.trim())throw new MpStatsError("unconfigured","Ключ MPStats не настроен. Добавьте его в разделе «Администрирование → API».");
 const range=dates(30);
 const listUrl=new URL("https://mpstats.io/api/analytics/v1/wb/subject/list");
 listUrl.searchParams.set("date",range.to);
 const subjects=confirmed?[]:arrayFrom(await provider(listUrl,token));
 const named=subjects.map(readSubject).filter(x=>x.id&&norm(x.name)===norm(subject));
 const grouped=named.filter(x=>subjectGroup&&x.group&&norm(x.group)===norm(subjectGroup));
 const matches=grouped.length===1?grouped:named;
 let scope:"category"|"subject"="subject";
 let subjectId:string;
 let categoryPath:string|null=null;
 let categoryRows:Record<string,unknown>[]|null=null;
 if(confirmed){
  scope=confirmed.scope;
  subjectId=confirmed.path;
  categoryPath=confirmed.scope==="category"?confirmed.path:null;
 }else if(matches.length===1){
  subjectId=matches[0].id;
 }else{
  // WB commission "subject" and MPStats niche "subject" aren't identical
  // taxonomies. Resolve using the documented WB category tree instead.
  const categoryListUrl=new URL("https://mpstats.io/api/analytics/v1/wb/category/list");
  const rawCategories=await provider(categoryListUrl,token,"POST",{});
  const category=matchMpstatsCategory(rawCategories,subject,subjectGroup);
  if(category){
   scope="category";
   categoryPath=category.path;
   subjectId=category.path;
  }else{
   // Some WB objects are subjects below a broad category, not individual
   // category tree leaves. Query that category's subject breakdown by ID.
   const root=subjectGroup?matchMpstatsCategoryRoot(rawCategories,subjectGroup):null;
   let found:string|null=null;
   if(root){
    const url=new URL("https://mpstats.io/api/analytics/v1/wb/category/subjects");
    for(const [key,value] of Object.entries({d1:range.from,d2:range.to,path:root.path})){
     url.searchParams.set(key,value);
    }
    const siblings=arrayFrom(await provider(url,token,"POST",{})).map(readSubject)
     .filter(x=>x.id&&norm(x.name)===norm(subject));
    if(siblings.length===1)found=siblings[0].id;
   }
   if(!found)throw new MpStatsError("data-missing",
    "Не удалось найти предмет «"+subject+"» в MPStats по группе «"+
    (subjectGroup||"неизвестна")+"»: нет точного соответствия ни в нишах, ни "+
    "в категориях, ни в списке предметов категории. Данные не подменены. "+
    "Нужна ручная привязка к категории MPStats.");
   scope="subject";
   subjectId=found;
  }
 }
 const seven=dates(7);
 const comments:string[]=[];
 async function items(source:"category"|"subject",path:string){
  const url=new URL("https://mpstats.io/api/analytics/v1/wb/"+source+"/items");
  for(const [key,value] of Object.entries({
   d1:seven.from,d2:seven.to,path,fbs:fbs?"1":"0"
  }))url.searchParams.set(key,value);
  return arrayFrom(await provider(url,token,"POST",{
   startRow:0,endRow:500,filterModel:{},
   sortModel:[{colId:"sales",sort:"desc"}]
  }));
 }
 const rows=await items(scope,subjectId);
 categoryRows=scope==="category"?rows:null;
 // A WB category with a single matching subject_id can be upgraded to a
 // native subject endpoint; never infer IDs from similarly named products.
 const inferred=categoryRows?uniqueSubjectIdFromCategoryItems(categoryRows,subject):null;
 let info:unknown=null;
 let metricScope=scope;
 let metricPath=subjectId;
 if(scope==="subject"||inferred){
  metricScope="subject";
  metricPath=inferred||subjectId;
  const infoUrl=new URL("https://mpstats.io/api/analytics/v1/wb/subject/"+encodeURIComponent(metricPath));
  try{info=await provider(infoUrl,token,"GET")}
  catch(error){
   if(error instanceof MpStatsError&&["rate-limited","invalid"].includes(error.kind))throw error;
   comments.push("Информация о выкупе предмета MPStats недоступна, СПП рассчитана отдельно");
  }
 }
 let buyout=readSubjectBuyout(info);
 if(buyout.ratio===null&&rows.length){
  // Only explicitly named percentage fields are valid.
  let sum=0,weight=0;
  for(const row of rows){
   const current=readSubjectBuyout(row);
   const sales=row.sales;
   if(current.ratio===null||typeof sales!=="number"||!Number.isFinite(sales)||sales<=0)continue;
   sum+=current.ratio*sales;weight+=sales;
  }
  if(weight>0)buyout={ratio:sum/weight,field:"items.explicit-buyout-percent-sales-weighted"};
 }
 const buyoutRate=buyout.ratio;
 const buyoutOrigin=buyout.field?"MPStats "+metricScope+"/"+metricPath+" / "+buyout.field:null;
 if(buyoutRate===null)comments.push("В ответе MPStats нет явно обозначенного процента выкупа. Поле оставлено пустым; Ozon не получает вымышленное значение.");
 const {rate:spp,sampled}=averageSubjectSpp(rows);
 if(spp===null)comments.push("MPStats не вернул достоверных данных о СПП по выбранной категории; значение не подставлялось");
 else comments.push("СПП предварительная: взвешенная по продажам оценка по "+sampled+" товарам за 7 завершённых дней. Не официальный средний СПП калькулятора");
 if(scope==="category")comments.push("Категория сопоставлена через дерево MPStats: "+categoryPath);
 return{subject,subjectId:metricPath,scope,categoryPath,
  sampledProducts:sampled,source:"mpstats",sampledAt:new Date().toISOString(),range,
  buyoutRate,wbSppRate:spp,buyoutOrigin,
  sppOrigin:spp===null?null:"MPStats "+scope+"/items, client_sale, 7 completed days, sales-weighted",
  comments};
}
