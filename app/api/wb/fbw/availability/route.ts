import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";

type Item={barcode:string;quantity:number};
type AnyRow=Record<string,unknown>;
type WbWarehouse={ID?:number;id?:number;name?:string;warehouseName?:string;address?:string;isActive?:boolean;isTransitActive?:boolean;warehouseType?:string};
type OptionRow={barcode?:string;isError?:boolean;warehouses?:Array<{warehouseID?:number;canBox?:boolean;canMonopallet?:boolean;isBoxOnPallet?:boolean}>};
type RateRow={date?:string;coefficient?:number;warehouseID?:number;warehouseName?:string;allowUnload?:boolean;boxTypeID?:number;boxTypeName?:string;deliveryCoef?:string|number;storageCoef?:string|number};
const BASE="https://supplies-api.wildberries.ru", RATE_BASE="https://common-api.wildberries.ru";
const resp=(data:object,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
function array(value:unknown):AnyRow[]{if(Array.isArray(value))return value as AnyRow[];if(value&&typeof value==="object"){const obj=value as AnyRow;for(const key of ["data","result","warehouses","items"]){if(Array.isArray(obj[key]))return obj[key] as AnyRow[];}}return [];}
async function wb(path:string, method:"GET"|"POST"="GET",body?:unknown,rate=false):Promise<unknown>{
 const token=(process.env.WB_SUPPLIES_API_TOKEN||process.env.WB_READ_TOKEN||"").trim();
 if(!token)throw new Error("Добавьте WB_SUPPLIES_API_TOKEN в Production Environment Variables Vercel");
 const response=await fetch((rate?RATE_BASE:BASE)+path,{
   method,headers:{Authorization:token,Accept:"application/json",...(body!==undefined?{"Content-Type":"application/json"}:{})},
   ...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:AbortSignal.timeout(15000),
 });
 if(!response.ok){
   const retry=response.headers.get("X-RateLimit-Retry")||response.headers.get("Retry-After");
   throw new Error("WB HTTP "+response.status+(retry?" (повторить через "+retry+")":""));
 }
 return response.json();
}
const cache=new Map<string,{time:number;data:object}>();
export async function POST(request:NextRequest){
 const auth=await createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user)return resp({ok:false,error:"Войдите на сайт"},401);
 let body:{items?:Item[];type?:"box"|"mono"};
 try{body=await request.json();}catch{return resp({ok:false,error:"Неверный JSON"},400);}
 const items=body.items;
 if(!Array.isArray(items)||items.length<1||items.length>300||!["box","mono"].includes(body.type??""))
 return resp({ok:false,error:"Требуется состав 1–300 баркодов и тип поставки"},400);
 const unique=new Set<string>();
 for(const item of items) {
   if(typeof item.barcode!=="string"||!/^\d{5,20}$/.test(item.barcode)||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>999999||unique.has(item.barcode))
   return resp({ok:false,error:"Неверный или повторяющийся баркод/количество"},400);
   unique.add(item.barcode);
 }
 if(body.type==="mono"&&items.length>3)return resp({ok:false,error:"Монопаллета: максимум три разных баркода"},400);
 const key=JSON.stringify([body.type,items.slice().sort((a,b)=>a.barcode.localeCompare(b.barcode))]);
 const saved=cache.get(key);
 if(saved&&Date.now()-saved.time<180000)return resp({...saved.data,cache:true});
 try{
   const [warehousesResult,optionsResult,ratesResult]=await Promise.allSettled([
     wb("/api/v1/warehouses"),
     wb("/api/v1/acceptance/options","POST",items.map(x=>({barcode:x.barcode,quantity:x.quantity}))),
     wb("/api/tariffs/v1/acceptance/coefficients","GET",undefined,true),
   ]);
   const errors:string[]=[];
   if(warehousesResult.status==="rejected")errors.push("Справочник точек WB недоступен: "+String(warehousesResult.reason));
   if(optionsResult.status==="rejected")errors.push("WB не подтвердил совместимость выбранных баркодов: "+String(optionsResult.reason));
   if(ratesResult.status==="rejected")errors.push("Календарь тарифов WB недоступен: "+String(ratesResult.reason));
   const wareRaw=warehousesResult.status==="fulfilled"?array(warehousesResult.value):[];
   const optionsVerified=optionsResult.status==="fulfilled";
   const rates= ratesResult.status==="fulfilled" ? array(ratesResult.value) as RateRow[]:[];
   const options=optionsVerified?array(optionsResult.value) as OptionRow[]:[];
   const byWarehouse=new Map<number,Map<string,{warehouseID?:number;canBox?:boolean;canMonopallet?:boolean;isBoxOnPallet?:boolean}>>();
   for(const option of options){
     for(const w of option.warehouses??[]){
       const warehouse=Number(w.warehouseID);
       if(!Number.isFinite(warehouse))continue;
       const map=byWarehouse.get(warehouse)??new Map();
       map.set(String(option.barcode??""),w);byWarehouse.set(warehouse,map);
     }
   }
   const known=new Map<number,WbWarehouse>();
   for(const raw of wareRaw){
     const w=raw as WbWarehouse, id=Number(w.ID??w.id);
     if(Number.isSafeInteger(id)&&id>0)known.set(id,w);
   }
   for(const rate of rates){
     const id=Number(rate.warehouseID);
     if(Number.isSafeInteger(id)&&id>0&&!known.has(id))known.set(id,{ID:id,name:String(rate.warehouseName??"Склад "+id)});
   }
   const order=(s:string)=>s==="confirmed"?0:s==="unverified"?1:2;
   const points=[...known.entries()].map(([id,w])=>{
     const barcodeMap=byWarehouse.get(id);
     const eligible=optionsVerified && items.every(item=>{
       const opt=barcodeMap?.get(item.barcode);
       return body.type==="mono"?opt?.canMonopallet===true:opt?.canBox===true;
     });
     const rejected=optionsVerified && !eligible;
     const count=optionsVerified?items.filter(item=>{const opt=barcodeMap?.get(item.barcode);return body.type==="mono"?opt?.canMonopallet===true:opt?.canBox===true;}).length:null;
     return {
       id,name:String(w.name??w.warehouseName??"Склад №"+id),address:String(w.address??""),
       type:String(w.warehouseType??""),isActive:w.isActive!==false,
       status:eligible?"confirmed":rejected?"not_compatible":"unverified",
       acceptedCount:count, totalCount:items.length,
     };
   }).filter(p=>p.isActive).sort((a,b)=>(order(a.status)-order(b.status))||a.name.localeCompare(b.name,"ru"));
   const dates=rates.filter(row=>{
     if(!row.date||!Number.isFinite(Number(row.warehouseID)))return false;
     const type=Number(row.boxTypeID);
     return type===(body.type==="mono"?5:2) ||
       (!Number.isFinite(type) && String(row.boxTypeName??"").toLowerCase().includes(body.type==="mono"?"паллет":"короб"));
   }).map(row=>({
     warehouseId:Number(row.warehouseID),date:String(row.date).slice(0,10),
     coefficient:row.coefficient===null||row.coefficient===undefined?null:Number(row.coefficient),
     available:row.allowUnload===true && row.coefficient!==undefined && Number(row.coefficient)!==-1,
     deliveryCoef:row.deliveryCoef??null,storageCoef:row.storageCoef??null
   }));
   const data={ok:true,points,dates,optionsVerified,ratesVerified:ratesResult.status==="fulfilled",errors,
     fetchedAt:new Date().toISOString(),note:"Свободный слот не забронирован. Совместимость состава подтверждается только методом options."};
   cache.set(key,{time:Date.now(),data});if(cache.size>25)cache.delete(cache.keys().next().value??"");
   return resp(data);
 }catch(error){
   return resp({ok:false,error:error instanceof Error?error.message:"Сбой WB"},502);
 }
}
