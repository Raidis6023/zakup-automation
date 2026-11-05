import { getIntegrationSecret } from "@/lib/integrations/secrets";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import directory from "../../../../../lib/wb/public-warehouses-directory.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = { barcode: string; quantity: number };
type WbWarehouse = { ID?: number; id?: number; name?: string; warehouseName?: string; address?: string; isActive?: boolean; warehouseType?: string };
type WbOptionWarehouse = { warehouseID?: number; canBox?: boolean; canMonopallet?: boolean };
type WbOption = { barcode?: string; isError?: boolean; warehouses?: WbOptionWarehouse[] };
type WbRate = { date?: string; warehouseID?: number; warehouseName?: string; boxTypeID?: number; boxTypeName?: string; coefficient?: number; allowUnload?: boolean; deliveryCoef?: string|number; storageCoef?: string|number };
type SourcePoint = { id: number; ids: number[]; name: string; address: string; type: string; city: string; region: string; hours: string; lat: number|null; lon: number|null; origin: "directory"|"wb"; hasLiveId: boolean; enabled: boolean; url: string };
const WB_BASE = "https://supplies-api.wildberries.ru";
const RATE_BASE = "https://common-api.wildberries.ru";

const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});

function asArray(v:unknown):Record<string,unknown>[] {
  if(Array.isArray(v))return v.filter(x=>x&&typeof x==="object");
  if(v&&typeof v==="object")for(const key of ["data","result","warehouses","items"]){
    const part=(v as Record<string,unknown>)[key];
    if(Array.isArray(part))return part.filter(x=>x&&typeof x==="object");
  }
  return [];
}
function errorText(e:unknown):string{
  const s=e instanceof Error?e.message:String(e);
  if(s.includes("HTTP 404"))return "WB временно не предоставляет метод (404)";
  if(s.includes("HTTP 429"))return "Превышен лимит WB (429), используются сохранённые данные";
  if(s.includes("HTTP 401")||s.includes("HTTP 403"))return "Нет доступа к API WB (проверьте категорию токена)";
  return s.slice(0,180);
}
async function wb(path:string,category:"fbw"|"rates",method:"GET"|"POST"="GET",body?:unknown):Promise<unknown> {
  // Supply token is needed for FBW. Tariff token accepts any category, but a
  // valid integration token must be configured; never expose it client-side.
  const readToken=await getIntegrationSecret("wb_read_token");
  const suppliesToken=await getIntegrationSecret("wb_supplies_api_token");
  const token=(category==="rates"?(readToken||suppliesToken):(suppliesToken||readToken))?.trim();
  if(!token)throw new Error("Не настроен токен WB в Vercel");
  const http=await fetch((category==="fbw"?WB_BASE:RATE_BASE)+path,{
    method,headers:{Authorization:token,Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    cache:"no-store",signal:AbortSignal.timeout(15000),
  });
  if(!http.ok){
    const retry=http.headers.get("X-RateLimit-Retry")||http.headers.get("Retry-After");
    throw new Error("WB HTTP "+http.status+(retry?", повтор через "+retry:""));
  }
  return http.json();
}

// Negative cache is important: WB temporarily disabled FBW GET warehouses/options
// and repeated clicks must not spam WB's 6/minute quota.
const requestCache=new Map<string,{until:number;value?:unknown;error?:string}>();
async function cached<T>(key:string,ttl:number,run:()=>Promise<T>):Promise<T>{
  const cachedEntry=requestCache.get(key);
  if(cachedEntry&&cachedEntry.until>Date.now()){
    if(cachedEntry.error)throw new Error(cachedEntry.error);
    return cachedEntry.value as T;
  }
  try{
    const value=await run();
    requestCache.set(key,{until:Date.now()+ttl,value});
    return value;
  }catch(e){
    const message=errorText(e);
    requestCache.set(key,{until:Date.now()+Math.min(ttl,30*60000),error:message});
    throw new Error(message);
  }
}

function offlinePoints():SourcePoint[]{
  return directory.rows.map((x,index)=>{
    const ids=[...new Set(String(x.wb_ids).split(/\s+/).filter(v=>/^\d+$/.test(v)).map(Number).filter(n=>Number.isSafeInteger(n)&&n>0))];
    return {
      id:ids[0]??(-index-1),ids,name:x.name,address:x.address,city:x.city,region:x.region,
      type:x.type,hours:x.work_time,lat:x.lat,lon:x.lon,url:x.url,
      enabled:true,origin:"directory" as const,hasLiveId:ids.length>0,
    };
  });
}

export async function POST(request:NextRequest){
  const auth=await createClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user)return reply({ok:false,error:"Необходим вход на сайт"},401);
  let body:{items?:Item[];type?:"box"|"mono"|"piece"};
  try{body=await request.json();}catch{return reply({ok:false,error:"Некорректный JSON"},400);}
  const items=body.items;
  if(!Array.isArray(items)||items.length===0||items.length>300||!(body.type==="box"||body.type==="mono"||body.type==="piece"))
    return reply({ok:false,error:"Выберите товары и тип поставки"},400);
  const barcodes=new Set<string>();
  for(const item of items){
    if(typeof item.barcode!=="string"||!/^[0-9]{5,20}$/.test(item.barcode)
      ||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>999999||barcodes.has(item.barcode))
      return reply({ok:false,error:"Некорректный/дублирующийся баркод или количество"},400);
    barcodes.add(item.barcode);
  }
  if(body.type==="mono"&&items.length>3)return reply({ok:false,error:"Монопаллета не допускает более 3 разных баркодов"},400);
  const signature=JSON.stringify([body.type,...items.slice().sort((a,b)=>a.barcode.localeCompare(b.barcode))]);
  const [warehouseResult,optionsResult,tariffResult]=await Promise.allSettled([
    cached("fbw-warehouses",12*3600000,()=>wb("/api/v1/warehouses","fbw")),
    cached("fbw-options:"+signature,20*60000,()=>wb("/api/v1/acceptance/options","fbw","POST",items)),
    cached("fbw-coefficients",60*60000,()=>wb("/api/tariffs/v1/acceptance/coefficients","rates")),
  ]);
  const warnings:string[]=[];
  if(warehouseResult.status==="rejected")warnings.push("Официальный список складов: "+errorText(warehouseResult.reason));
  if(optionsResult.status==="rejected")warnings.push("Проверка совместимости товаров: "+errorText(optionsResult.reason));
  if(tariffResult.status==="rejected")warnings.push("Календарь приёмки: "+errorText(tariffResult.reason));

  const points=offlinePoints();
  const pointByID=new Map<number,SourcePoint>();
  for(const p of points)for(const id of p.ids)if(!pointByID.has(id))pointByID.set(id,p);

  const warehouses=warehouseResult.status==="fulfilled"?asArray(warehouseResult.value) as WbWarehouse[]:[];
  const extra:SourcePoint[]=[];
  for(const row of warehouses){
    const id=Number(row.ID??row.id);
    if(!Number.isSafeInteger(id)||id<=0)continue;
    const existing=pointByID.get(id);
    if(existing){
      // Official WB may provide a newer address and warehouse activity flag.
      if(row.address)existing.address=row.address;
      if(!existing.name&&(row.name||row.warehouseName))existing.name=String(row.name??row.warehouseName);
      existing.enabled=row.isActive!==false;
      continue;
    }
    const point:SourcePoint={id,ids:[id],name:String(row.name??row.warehouseName??"Склад №"+id),
      address:row.address??"",type:row.warehouseType??"Склад",city:"",region:"",hours:"",
      lat:null,lon:null,url:"",enabled:row.isActive!==false,hasLiveId:true,origin:"wb"};
    extra.push(point);pointByID.set(id,point);
  }

  const optionsVerified=optionsResult.status==="fulfilled";
  const optionRows=optionsVerified?asArray(optionsResult.value) as WbOption[]:[];
  // Keep track of explicit WB results, not merely the existence of an HTTP 200.
  const optionsById=new Map<number,Map<string,boolean>>();
  for(const option of optionRows){
    const barcode=String(option.barcode??"");
    for(const wh of option.warehouses??[]){
      const id=Number(wh.warehouseID);
      if(!Number.isSafeInteger(id)||id<=0)continue;
      const map=optionsById.get(id)??new Map<string,boolean>();
      const value=body.type==="mono"?wh.canMonopallet:wh.canBox;
      if(typeof value==="boolean")map.set(barcode,value);
      optionsById.set(id,map);
    }
  }
  const status=(p:SourcePoint)=>{
    if(!optionsVerified)return "unverified" as const;
    // If none of this warehouse's IDs has a matching explicit WB response,
    // its availability is unknown rather than falsely negative.
    let observed=0, accepted=0;
    for(const item of items){
      let result: boolean|undefined;
      for(const id of p.ids){const v=optionsById.get(id)?.get(item.barcode);if(v!==undefined){result=v;break;}}
      if(result!==undefined){observed++;if(result)accepted++;}
    }
    if(observed===0)return "unverified" as const;
    if(observed!==items.length)return "unverified" as const;
    return accepted===items.length?"confirmed" as const:"not_compatible" as const;
  };
  const resultPoints=[...points,...extra].filter(p=>p.enabled).map(p=>({
    ...p,status:status(p),source:p.origin==="wb"?"wb":"public",
    acceptedCount:null as number|null,totalCount:items.length,
  })).sort((a,b)=>{
    const rank=(s:string)=>s==="confirmed"?0:s==="unverified"?1:2;
    return rank(a.status)-rank(b.status)||a.name.localeCompare(b.name,"ru");
  });

  const rates=tariffResult.status==="fulfilled"?asArray(tariffResult.value) as WbRate[]:[];
  const dates=rates.filter(row=>{
    if(!row.date||!Number.isSafeInteger(Number(row.warehouseID)))return false;
    const id=Number(row.boxTypeID);
    if(Number.isFinite(id))return id===(body.type==="mono"?5:2);
    return String(row.boxTypeName??"").toLowerCase().includes(body.type==="mono"?"паллет":"короб");
  }).map(row=>({
    warehouseId:Number(row.warehouseID),
    date:String(row.date).slice(0,10),
    coefficient:typeof row.coefficient==="number"?row.coefficient:null,
    available:row.allowUnload===true&&typeof row.coefficient==="number"&&row.coefficient!==-1,
    deliveryCoef:row.deliveryCoef??null,storageCoef:row.storageCoef??null,
  }));

  return reply({
    ok:true,points:resultPoints,dates,
    optionsVerified,ratesVerified:tariffResult.status==="fulfilled",
    errors:warnings,fetchedAt:new Date().toISOString(),
    fallback:{used:warehouseResult.status!=="fulfilled",source:directory.source,updated:directory.updated,total:directory.rows.length,
      note:"Открытый справочник, не живые свободные слоты WB. Содержит склады и СЦ, но не полный список ПВЗ."},
    note:"Сначала выбирается точка прямой сдачи, затем дата. Опции приёмки и доступность даты требуют подтверждения API WB.",
  });
}
