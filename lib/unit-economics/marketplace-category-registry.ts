import {getTariffData,getOzonCompensationData} from "./source";

export type CategoryMarket="ozon"|"ym";
export type MarketplaceCategory={
 key:string;market:CategoryMarket;name:string;category:string;group:string;path:string;
 rates:{fbo?:[number,number,number];fbs?:[number,number,number];fby?:number;ymFbs?:number};
 insuranceFactors?:{upTo300:number;above300:number};live:boolean;asOf:string;
};
const norm=(s:unknown)=>String(s??"").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").replace(/\s+/g," ").trim();
const key=(...parts:string[])=>parts.map(norm).join(" | ");
function percent(v:unknown):number|null{
 const s=String(v??"").replace(/\s/g,"").replace(",",".");
 if(!s)return null;
 const x=Number(s.replace("%",""));
 if(!Number.isFinite(x)||x<0)return null;
 const result=s.includes("%")||x>1?x/100:x;
 return result>=0&&result<=1?result:null;
}
function tiers(r:(string|null)[]):[number,number,number]|null{
 const a=percent(r[3]),b=percent(r[4]),c=percent(r[5]);
 return a===null||b===null||c===null?null:[a,b,c];
}
const cache=new Map<CategoryMarket,{expires:number,promise:Promise<MarketplaceCategory[]>}>();
async function load(market:CategoryMarket){
 if(market==="ozon"){
  const [fbo,fbs,insurance]=await Promise.all([
   getTariffData("ozon-fbo"),getTariffData("ozon-fbs"),getOzonCompensationData()
  ]);
  if(!fbo||!fbs)throw Error("Справочник комиссий Ozon недоступен");
  const live=fbo.live&&fbs.live&&insurance!==null;
  const fbsRates=new Map<string,[number,number,number]>();
  for(const r of fbs.data.rows.slice(2)){
   const a=String(r[0]??""),b=String(r[1]??""),c=String(r[2]??"");
   const rate=tiers(r);if(a&&b&&c&&rate)fbsRates.set(key(a,b,c),rate);
  }
  const insuranceRates=new Map<string,{upTo300:number;above300:number}>();
  for(const r of insurance||[]){
   const low=percent(r[2]),high=percent(r[3]);
   if(r[0]&&r[1]&&low!==null&&high!==null)
    insuranceRates.set(key(String(r[1]),String(r[0])),{upTo300:low,above300:high});
  }
  const rows=new Map<string,MarketplaceCategory>();
  for(const r of fbo.data.rows.slice(2)){
   const name=String(r[0]??"").trim(),category=String(r[1]??"").trim(),group=String(r[2]??"").trim();
   if(!name||!category||!group||[name,category,group].some(x=>norm(x).includes("ozon fresh")))continue;
   const id=key(name,category,group),fboRate=tiers(r),fbsRate=fbsRates.get(id);
   if(!fboRate||!fbsRate)continue;
   const factor=insuranceRates.get(key(name,category));
   rows.set(id,{key:id,market:"ozon",name,category,group,path:group+" / "+category+" / "+name,
    rates:{fbo:fboRate,fbs:fbsRate},...(factor?{insuranceFactors:factor}:{}),
    live,asOf:live?new Date().toISOString():String(fbo.asOf||"")});
  }
  return [...rows.values()];
 }
 const [fby,fbs]=await Promise.all([getTariffData("ym-fby"),getTariffData("ym-fbs")]);
 if(!fby||!fbs)throw Error("Справочники комиссий Яндекс Маркета недоступны");
 const live=fby.live&&fbs.live;
 const fbsRates=new Map<string,number>();
 for(const r of fbs.data.rows.slice(1)){
  const path=r.slice(0,8).filter(Boolean).join(" / "),rate=percent(r[10]);
  if(path&&rate!==null)fbsRates.set(key(path),rate);
 }
 const rows=new Map<string,MarketplaceCategory>();
 for(const r of fby.data.rows.slice(1)){
  const name=String(r[0]??"").trim(),hierarchy=r.slice(1,9).filter(Boolean).map(v=>String(v).trim());
  const path=hierarchy.join(" / "),fbyRate=percent(r[9]),fbsRate=fbsRates.get(key(path));
  if(!name||!path||fbyRate===null||fbsRate===undefined)continue;
  const id=key(name,path);
  rows.set(id,{key:id,market:"ym",name,category:name,group:hierarchy[0]||"",path,
   rates:{fby:fbyRate,ymFbs:fbsRate},live,asOf:live?new Date().toISOString():String(fby.asOf||"")});
 }
 return [...rows.values()];
}
export async function marketplaceCategories(market:CategoryMarket):Promise<MarketplaceCategory[]>{
 const old=cache.get(market),now=Date.now();
 if(old&&old.expires>now)return old.promise;
 const promise=load(market).catch(e=>{cache.delete(market);throw e});
 cache.set(market,{expires:now+300000,promise});return promise;
}
export async function searchMarketplaceCategories(market:CategoryMarket,query:string){
 const q=norm(query);
 if(q.length<2)return {items:[] as MarketplaceCategory[],total:0};
 const matches=(await marketplaceCategories(market)).filter(c=>[c.name,c.category,c.path].some(v=>norm(v).includes(q)));
 matches.sort((a,b)=>{
  const rank=(c:MarketplaceCategory)=>norm(c.name)===q?0:norm(c.name).startsWith(q)?1:norm(c.name).includes(q)?2:3;
  return rank(a)-rank(b)||a.path.localeCompare(b.path,"ru");
 });
 return {items:matches.slice(0,35),total:matches.length};
}
export async function findMarketplaceCategory(market:CategoryMarket,id:string){
 return (await marketplaceCategories(market)).find(c=>c.key===id)||null;
}
