"use client";
import {useEffect,useMemo,useRef,useState,type MouseEvent} from "react";
import Image from "next/image";
import Link from "next/link";
import {WORKBOOK_URL,type Marketplace,type ModelKey} from "@/lib/unit-economics/model-config";
import pilot from "@/data/unit-economics-pilot.json";
import {calculatePilotFbs,pilotFbsMinPrice} from "@/lib/unit-economics/pilot-fbs";
import {displayNewProductName} from "@/lib/products/new-product-identity";
import {formatUnitNumber,formatUnitPercent} from "@/lib/unit-economics/financial-results";
import {recalculateFinancialReference,recalculateOzonReferenceInputs,recalculateMarketplaceVolume,LAYOUT} from "@/lib/unit-economics/financial-reference";
import {compareLogisticsReference} from "@/lib/unit-economics/logistics/reference";
import VedUnitEconomicsLive from "./VedUnitEconomicsLive";
import type {UnitFinalModel} from "@/lib/unit-economics/financial-results";

type Entry={tab:string;row:number;values:(string|number|null)[];display:string[];formulas:Record<string,string>;calculated?:boolean;notes?:string[];auditStatus?:string;
  engineFormulas?:Record<string,string>;
  oldYandexRoi?:number|null;
  vatAudit?:{outputVat:number;inputVat:number;comparison:number;netVat:number};
  logisticsAudit?:{status:string;warnings:string[];changes:{name:string;was:number|null;now:number;delta:number|null;formula:string}[];total:number|null};
  volumeAudit?:{volumeFormula:string;volumeSource:string;volumeNotes:string;exactVolume:number|null;previousSheetLiters:number|null;alternatives:string};
  ozonSppFormula?:string;
};
type Product={sku:string;name:string;models:Record<string,Entry>};
type VedScheme={
 status:"calculated"|"estimated"|"needs_input"|"invalid_ved";
 missing:string[];costGrossRub:number|null;volumeLiters:number|null;
 costPolicyVersion?:number;pricePolicyVersion?:number;
 unitWeightKg:number|null;priceRub:number|null;priceAfterSppRub:number|null;
 profitRub:number|null;roi:number|null;margin:number|null;
};
type VedProduct={
 id:string;article:string;name:string;ved_created_at:string;
 source_item_id:string|null;source_offer_id:string|null;
 source_type:"whole"|"single";source_version_id:string;
 cost_gross_rub:number|null;volume_liters:number|null;unit_weight_kg:number|null;
 schemes:Record<string,VedScheme>;
};
type Cols={roi:number;margin:number;profit:number;cost:number;volume:number;price:number;buyer:number|null;category:number;vat:number;output:number;input:number};
const DATA=pilot.products as Product[];
const PHOTOS:Record<string,string>={
 "RCAB-AVD26721-1":"/unit-pilot-photos/RCAB-AVD26721-1.png",
 "RCAB-AVD26708-2":"/unit-pilot-photos/RCAB-AVD26708-2.png",
 "RCAB-AVD26803-28":"/unit-pilot-photos/RCAB-AVD26803-28.png",
 "RCAB-AVD26923-1":"/unit-pilot-photos/RCAB-AVD26923-1.png"
};
type PhotoPreview={src:string;alt:string;left:number;top:number;anchorLeft:number;anchorRight:number;anchorTop:number};
const HEADERS=pilot.headers as Record<string,string[]>;
const MARKET_NAMES:Record<Marketplace,string>={ozon:"Ozon",wb:"Wildberries",ym:"Яндекс Маркет"};
const TABS:Record<Marketplace,ModelKey[]>={ozon:["ozon-fbo","ozon-fbs"],wb:["wb-fbw","wb-fbs"],ym:["ym-fby","ym-fbs"]};
const LABEL:Record<ModelKey,string>={"ozon-fbo":"FBO","ozon-fbs":"FBS","wb-fbw":"FBW","wb-fbs":"FBS","ym-fby":"FBY","ym-fbs":"FBS"};
const COLS:Record<string,Cols>={
 "ozon-fbo":{roi:50,margin:49,profit:48,cost:11,volume:9,price:13,buyer:15,category:5,vat:38,output:39,input:40},
 "wb-fbw":{roi:44,margin:43,profit:42,cost:11,volume:9,price:13,buyer:15,category:5,vat:31,output:32,input:33},
 "wb-fbs":{roi:44,margin:43,profit:42,cost:11,volume:9,price:13,buyer:15,category:5,vat:31,output:32,input:33},
 "ym-fby":{roi:38,margin:37,profit:36,cost:11,volume:9,price:13,buyer:null,category:5,vat:28,output:29,input:30},
 "ozon-fbs":{roi:47,margin:46,profit:45,cost:8,volume:6,price:10,buyer:12,category:2,vat:36,output:37,input:38},
 "ym-fbs":{roi:46,margin:45,profit:44,cost:11,volume:9,price:13,buyer:null,category:3,vat:36,output:37,input:38}
};
const GROUPS:Record<string,{name:string;cells:number[]}[]>={
 "ozon-fbo":[
  {name:"Цена и СПП",cells:[13,14,15]},
  {name:"Комиссия маркетплейса",cells:[16,17,18]},
  {name:"Логистика с учётом возвратов",cells:[6,7,8,9,10,19,20,21,22,23,24,25,26,27,28,29,30,31,32]},
  {name:"НДС и налоговые вычеты",cells:[37,38,39,40,41,42,43,44,45,46,47]},
  {name:"Реклама и другие затраты",cells:[11,12,33,34,35,36]},
  {name:"Чистая прибыль и ROI",cells:[48,49,50]}
 ],
 "wb-fbw":[
  {name:"Цена и СПП",cells:[13,14,15]},
  {name:"Комиссия маркетплейса",cells:[16,17,18]},
  {name:"Логистика с учётом возвратов",cells:[6,7,8,9,10,19,20,21,22,23,24,25,26,27]},
  {name:"НДС и налоговые вычеты",cells:[30,31,32,33,34,35,36,37,38,39,40]},
  {name:"Реклама и другие затраты",cells:[11,12,28,29]},
  {name:"Чистая прибыль и ROI",cells:[41,42,43,44]}
 ],
 "wb-fbs":[
  {name:"Цена и СПП",cells:[13,14,15]},
  {name:"Комиссия маркетплейса",cells:[16,17,18,46]},
  {name:"Логистика с учётом возвратов",cells:[6,7,8,9,10,19,20,21,22,23,24,25,26,27]},
  {name:"НДС и налоговые вычеты",cells:[30,31,32,33,34,35,36,37,38,39,40]},
  {name:"Реклама и другие затраты",cells:[11,12,28,29,45]},
  {name:"Чистая прибыль и ROI",cells:[41,42,43,44]}
 ],
 "ozon-fbs":[
  {name:"Цена и СПП",cells:[10,11,12]},
  {name:"Комиссия маркетплейса",cells:[13,14,15]},
  {name:"Логистика с учётом возвратов",cells:[3,4,5,6,7,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]},
  {name:"НДС и налоговые вычеты",cells:[35,36,37,38,39,40,41,42,43,44]},
  {name:"Реклама и другие затраты",cells:[8,9,32,33,34]},
  {name:"Чистая прибыль и ROI",cells:[45,46,47]}
 ],
 "ym-fbs":[
  {name:"Цена и СПП",cells:[13,14]},
  {name:"Комиссия маркетплейса",cells:[15,16,17]},
  {name:"Логистика с учётом возвратов",cells:[6,7,8,9,10,18,19,20,21,22,23]},
  {name:"НДС и налоговые вычеты",cells:[35,36,37,38,39,40,41,42,43]},
  {name:"Реклама и другие затраты",cells:[11,12,32,33,34]},
  {name:"Чистая прибыль и ROI",cells:[44,45,46]}
 ],
 "ym-fby":[
  {name:"Цена и СПП",cells:[13,14]},
  {name:"Комиссия маркетплейса",cells:[15,16,17]},
  {name:"Логистика с учётом возвратов",cells:[6,7,8,9,10,18,19,20,21,22,23,24]},
  {name:"НДС и налоговые вычеты",cells:[27,28,29,30,31,32,33,34,35]},
  {name:"Реклама и другие затраты",cells:[11,12,25,26]},
  {name:"Чистая прибыль и ROI",cells:[36,37,38]}
 ]
};
const FINANCE:Record<string,{commission:number;logistics:number[];ads:number}>={"ozon-fbo":{commission:17,logistics:[22,25],ads:36},"ozon-fbs":{commission:14,logistics:[19,22,25],ads:34},"wb-fbw":{commission:17,logistics:[23],ads:29},"wb-fbs":{commission:17,logistics:[23],ads:29},"ym-fby":{commission:16,logistics:[20,21],ads:26},"ym-fbs":{commission:16,logistics:[20,21],ads:34}};
const rub=(n:number)=>Number.isFinite(n)?new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n)+" ₽":"—";
const GIDS:Record<string,string>={"ozon-fbo":"261268990","wb-fbw":"524833130","wb-fbs":"806114489","ym-fby":"395305505"};
function entryFor(p:Product,m:ModelKey,price?:number):Entry|undefined{
 const current=(m==="ozon-fbs"||m==="ym-fbs")?calculatePilotFbs(p,m,price):p.models[m];
 if(!current)return current;
 const layout=LAYOUT[m as UnitFinalModel];
 if(!layout)return current;
 const values=current.values.slice(),display=current.display.slice();
 const engineFormulas:Record<string,string>={};
 let auditStatus="";
 let volumeAudit:Entry["volumeAudit"];
 let ozonSppFormula:string|undefined;
 let logisticsAudit:Entry["logisticsAudit"];
 const box=p.models["ozon-fbo"]?.values;
 const parse=(v:unknown)=>typeof v==="number"?v:typeof v==="string"?Number(v.replace(/[\\s\\u00a0\\u202f]/g,"").replace(",",".")):NaN;
 try{
  const check=recalculateMarketplaceVolume(m as UnitFinalModel,current.values,box);
  const volume=check.audit;
  const volumeIndex=m==="ozon-fbs"?6:9;
  if(volume.liters!==null){
   values[volumeIndex]=volume.liters;
   display[volumeIndex]=formatUnitNumber(volume.liters);
   engineFormulas[String(volumeIndex)]=volume.formula??"Не определён";
   if(m==="ozon-fbo"||m==="ozon-fbs"){
    const extraIndex=m==="ozon-fbo"?10:7;
    values[extraIndex]=volume.roundedTariffLiters??"";
    display[extraIndex]=volume.roundedTariffLiters===null?"—":formatUnitNumber(volume.roundedTariffLiters);
    engineFormulas[String(extraIndex)]="ceil(точный литраж ИУ)";
   }
   if(m==="wb-fbw"||m==="wb-fbs"){
    values[10]=Math.max(0,volume.liters-1);
    display[10]=formatUnitNumber(Math.max(0,volume.liters-1));
    engineFormulas["10"]="max(0; точный литраж ИУ − 1)";
   }
  }else{values[volumeIndex]="";display[volumeIndex]="—";}
  volumeAudit={
   volumeFormula:volume.formula??"Нет исходных данных",
   volumeSource:volume.source??"отсутствует",
   volumeNotes:volume.warnings.join("; "),
   exactVolume:volume.liters,
   previousSheetLiters:check.originalSheetLiters,
   alternatives:volume.comparisons.map(x=>x.otherSource+": "+formatUnitNumber(x.differenceLiters,"л")).join("; ")
  };
  if(volume.liters!==null){
   const cartonVolume=box?parse(box[28]):NaN;
   const units=box?parse(box[29]):NaN;
   const logistics=compareLogisticsReference(
    m as UnitFinalModel,current.values,volume.liters,
    Number.isFinite(cartonVolume)&&Number.isFinite(units)?
     {cartonVolumeM3:cartonVolume,unitsPerCarton:units}:undefined,
    current.formulas
   );
   if(logistics.result){
    const changes=logistics.comparison.map(x=>{
     const line=logistics.result!.lines.find(e=>e.code===x.code);
     if(!line)return null;
     const index=x.sourceIndex;
     values[index]=line.amount;
     display[index]=formatUnitNumber(line.amount,"₽");
     engineFormulas[String(index)]=line.formula;
     return{name:line.label,was:x.sourceAmount,now:line.amount,delta:x.delta,formula:line.formula};
    }).filter((v):v is NonNullable<typeof v>=>v!==null);
    logisticsAudit={status:logistics.status,warnings:[...logistics.result.warnings],changes,total:logistics.result.totals.overall};
   }else logisticsAudit={status:logistics.status,warnings:["Недостающие входные данные: "+logistics.requiredInputs.join(", ")],changes:[],total:null};
  }
  if(m==="ozon-fbo"||m==="ozon-fbs"){
   if(box){
    const spp=recalculateOzonReferenceInputs(m,current.values,box).spp;
    const s=m==="ozon-fbo"?14:11,w=m==="ozon-fbo"?15:12;
    values[s]=spp.sppRate;display[s]=formatUnitPercent(spp.sppRate);
    values[w]=spp.priceAfterSpp;display[w]=formatUnitNumber(spp.priceAfterSpp,"₽");
    engineFormulas[String(s)]="СПП по ценовому диапазону Ozon";
    engineFormulas[String(w)]=spp.formula;
    ozonSppFormula=spp.formula;
   }
  }
 }catch(error){auditStatus="Ошибка расчёта логистики/литража: "+(error instanceof Error?error.message:String(error))}
 let oldYandexRoi:number|null=null;
 let vatAudit:Entry["vatAudit"];
 try{
  // Все статьи логистики в массиве values теперь пересчитаны самостоятельно.
  // НДС исчисляется по обновлённым расходам через общий модуль; это не
  // чтение итоговых сумм из Google.
  const check=recalculateFinancialReference(m as UnitFinalModel,values);
  vatAudit=check.vatAudit?{
   outputVat:check.vatAudit.calculated.outputVat,
   inputVat:check.vatAudit.calculated.inputVatTotal,
   comparison:check.vatAudit.maxDifference,
   netVat:check.vatAudit.calculated.vatPayable
  }:undefined;
  if(check.output){
   const result=check.output;
   values[layout.outputVat]=result.outputVat;
   values[layout.inputVat]=result.inputVatTotal;
   display[layout.outputVat]=formatUnitNumber(result.outputVat,"₽");
   display[layout.inputVat]=formatUnitNumber(result.inputVatTotal,"₽");
   engineFormulas[String(layout.outputVat)]="Ставка НДС реализации × цена / (1 + ставка)";
   engineFormulas[String(layout.inputVat)]="НДС закупки + разрешённые вычеты по статьям расходов";
   values[layout.profit]=result.netProfit;
   values[layout.margin]=result.marginRatio??"";
   values[layout.roi]=result.roiRatio??"";
   display[layout.profit]=formatUnitNumber(result.netProfit,"₽");
   display[layout.margin]=result.marginRatio===null?"—":formatUnitPercent(result.marginRatio);
   display[layout.roi]=result.roiRatio===null?"—":formatUnitPercent(result.roiRatio);
   engineFormulas[String(layout.profit)]="Цена − себестоимость с НДС − все уникальные расходы − (исходящий НДС − входящий НДС)";
   engineFormulas[String(layout.margin)]="Чистая прибыль / (цена − исходящий НДС)";
   engineFormulas[String(layout.roi)]="Чистая прибыль / (себестоимость с НДС − входящий НДС закупки)";
   oldYandexRoi=check.previousRoiRatio;
   if(m==="ym-fby"){
    values[1]=result.roiRatio??"";
    display[1]=result.roiRatio===null?"—":formatUnitPercent(result.roiRatio);
    engineFormulas["1"]=engineFormulas[String(layout.roi)];
   }
   const changed=logisticsAudit?.changes.some(x=>x.delta!==null&&Math.abs(x.delta)>1e-7);
   const origin=current.calculated?"ранее рассчитанной FBS-моделью":"исходной Google-юниткой";
   if(changed) auditStatus+="; Логистика пересчитана: финрезультат может отличаться от "+origin;
   else auditStatus+="; Логистика и финансовые показатели сопоставлены с "+origin+
    (check.status==="roi-method-changed"?"; ROI Яндекса стандартизирован":check.status==="matched"?" без расхождений":"; обнаружены расхождения");
  }else auditStatus+="; Недостаточно исходных данных для финрезультата: "+check.missingColumns.join(", ");
 }catch(error){auditStatus+="; Ошибка финансового расчёта: "+(error instanceof Error?error.message:String(error))}
 return {...current,values,display,engineFormulas,auditStatus,oldYandexRoi,volumeAudit,ozonSppFormula,vatAudit,logisticsAudit};
}
const fmt=(r:Entry|undefined,i:number|null)=>r&&i!==null&&r.display[i]?r.display[i]:"—";
const numeric=(r:Entry|undefined,i:number)=>typeof r?.values[i]==="number"?r.values[i] as number:Number(String(r?.values[i]??"0").replace(",",".").replace(/[^0-9.-]/g,""));
function columnName(i:number){let s="";for(let n=i+1;n>0;){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s;}
function Field({row,model,index}:{row:Entry;model:string;index:number}){
 const value=fmt(row,index),formula=row.formulas[String(index)],engineFormula=row.engineFormulas?.[String(index)],header=HEADERS[model]?.[index]||"Исходное поле";
 if(value==="—"&&!formula&&!engineFormula)return null;
 return <details className="unit-pilot-field"><summary><span>{header} <small>{columnName(index)}{row.row}</small></span><b>{value}</b></summary><div>{engineFormula&&<><span>Расчёт новой системы</span><code>{engineFormula}</code></>}{formula?<><span>{row.calculated?"Формула пилотного FBS":"Формула исходной Google-таблицы"}</span><code>{formula}</code></>:!engineFormula?<span>Исходное значение без формулы</span>:null}<small>{row.tab}!{columnName(index)}{row.row}</small></div></details>;
}
export default function UnitEconomicsPilotClient(){
 const [market,setMarket]=useState<Marketplace>("ozon");
 const [selected,setSelected]=useState<Record<Marketplace,ModelKey>>({ozon:"ozon-fbo",wb:"wb-fbw",ym:"ym-fby"});
 const [search,setSearch]=useState("");
 const [photoPreview,setPhotoPreview]=useState<PhotoPreview|null>(null);
 const [sku,setSku]=useState<string|null>(null);
 const [view,setView]=useState<"summary"|"details">("summary");
 const [overrides,setOverrides]=useState<Record<string,string>>({});
 const [vedProducts,setVedProducts]=useState<VedProduct[]>([]);
 const [vedPhotoUrls,setVedPhotoUrls]=useState<Record<string,string>>({});
 const [vedPhotoError,setVedPhotoError]=useState("");
 const attemptedPhotoOffers=useRef(new Set<string>());
 const attemptedCostSources=useRef(new Set<string>());
 const [costUpdating,setCostUpdating]=useState(false);
 const [costUpdateError,setCostUpdateError]=useState("");
 const [vedLoading,setVedLoading]=useState(true);
 const [vedError,setVedError]=useState("");
 const [vedRevision,setVedRevision]=useState(0);
 const [vedBusy,setVedBusy]=useState(false);
 const [vedSelected,setVedSelected]=useState<string|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/unit-economics/prospective?limit=150",{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const body=await response.json() as {ok?:boolean;products?:VedProduct[];error?:string};
    if(!response.ok||!body.ok)throw Error(body.error||"Не удалось прочитать расчёты ВЭД");
    if(!controller.signal.aborted){setVedProducts(body.products||[]);setVedError("");}
   })
   .catch(error=>{if(!controller.signal.aborted)setVedError(error instanceof Error?error.message:String(error))})
   .finally(()=>{if(!controller.signal.aborted)setVedLoading(false)});
  return ()=>controller.abort();
 },[vedRevision]);
 // Backfill already imported items once per saved VED version.
 // The server replays original 40HQ/MOQ costs, so the +15% is never compounded.
 useEffect(()=>{
  const pending=new Map<string,{sourceType:"whole"|"single";sourceVersionId:string}>();
  for(const item of vedProducts){
   if(!item.source_version_id||!["whole","single"].includes(item.source_type))continue;
   if(Object.values(item.schemes).every(c=>c.costPolicyVersion===2&&c.pricePolicyVersion===2))continue;
   const key=item.source_type+":"+item.source_version_id;
   if(attemptedCostSources.current.has(key))continue;
   pending.set(key,{sourceType:item.source_type,sourceVersionId:item.source_version_id});
  }
  if(!pending.size)return;
  for(const key of pending.keys())attemptedCostSources.current.add(key);
  let cancelled=false;
  void(async()=>{
   setCostUpdating(true);
   setCostUpdateError("");
   try{
    for(const source of pending.values()){
     const response=await fetch("/api/unit-economics/prospective",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"recalculate-cost-policy",...source})
     });
     const data=await response.json() as {ok:boolean;error?:string};
     if(!response.ok||!data.ok)throw Error(data.error||"Не удалось пересчитать себестоимость");
    }
    if(!cancelled){setVedLoading(true);setVedRevision(n=>n+1);}
   }catch(error){
    if(!cancelled)setCostUpdateError(error instanceof Error?error.message:String(error));
   }finally{
    if(!cancelled)setCostUpdating(false);
   }
  })();
  return()=>{cancelled=true};
 },[vedProducts]);
 // Resolve signed URLs for all listed source-KP offers in one request.
 // For missing offers, extract thumbnails once per entire Excel, not once per SKU.
 const photoOfferKey=[...new Set(vedProducts.map(p=>p.source_offer_id).filter(
  (x):x is string=>typeof x==="string"&&x.length>0))].sort().slice(0,35).join(",");
 useEffect(()=>{
  if(!photoOfferKey)return;
  const controller=new AbortController();
  const refresh=async()=>{
   const res=await fetch("/api/unit-economics/photos?offers="+
    encodeURIComponent(photoOfferKey),{cache:"no-store",signal:controller.signal});
   const body=await res.json() as {ok?:boolean;photos?:Record<string,string>;
    missingOfferIds?:string[];error?:string};
   if(!res.ok||!body.ok)throw Error(body.error||"Не удалось получить фотографии КП");
   if(!controller.signal.aborted)setVedPhotoUrls(body.photos||{});
   return body;
  };
  void (async()=>{
   try{
    const result=await refresh();
    for(const offerId of result.missingOfferIds||[]){
     if(controller.signal.aborted)return;
     if(attemptedPhotoOffers.current.has(offerId))continue;
     attemptedPhotoOffers.current.add(offerId);
     try{
      const res=await fetch("/api/unit-economics/photos",{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({offerId}),signal:controller.signal
      });
      const body=await res.json() as {ok?:boolean;error?:string};
      if(!res.ok||!body.ok)throw Error(body.error||"Не удалось извлечь фото из КП");
      await refresh();
      if(!controller.signal.aborted)setVedPhotoError("");
     }catch(error){
      if(!controller.signal.aborted)setVedPhotoError(
       error instanceof Error?error.message:String(error));
     }
    }
   }catch(error){
    if(!controller.signal.aborted)setVedPhotoError(
     error instanceof Error?error.message:String(error));
   }
  })();
  // Signed URLs last 60 minutes, refresh them while the page stays open.
  const timer=window.setInterval(()=>{void refresh().catch(error=>{
   if(!controller.signal.aborted)setVedPhotoError(
    error instanceof Error?error.message:String(error));
  })},30*60*1000);
  return ()=>{controller.abort();window.clearInterval(timer)};
 },[photoOfferKey]);
 // Background revalidation while the new unit-economics page is open.
 // A VED save creates a server-side version; on returning to this page the
 // new products appear without clicking "Загрузить ожидающие ВЭД".
 useEffect(()=>{
  // Do not interrupt an open calculation modal with polling or focus refresh.
  if(vedSelected)return;
  const refresh=()=>{if(document.visibilityState==="visible")setVedRevision(x=>x+1)};
  const poll=window.setInterval(refresh,30000);
  window.addEventListener("focus",refresh);
  return()=>{window.clearInterval(poll);window.removeEventListener("focus",refresh)};
 },[vedSelected]);
 async function reloadPendingVed(){
  setVedBusy(true);
  try{
   const response=await fetch("/api/unit-economics/prospective",{
    method:"POST",headers:{"Content-Type":"application/json"},
    credentials:"same-origin",body:JSON.stringify({action:"retry-pending"})
   });
   const body=await response.json() as {ok?:boolean;failures?:string[];error?:string};
   if(!response.ok||!body.ok)throw Error(body.error||"Не удалось обработать версии ВЭД");
   if(body.failures?.length)throw Error(body.failures.join("; "));
   setVedError("");setVedLoading(true);setVedRevision(x=>x+1);
  }catch(error){setVedError(error instanceof Error?error.message:String(error))}
  finally{setVedBusy(false)}
 }
 const vedWeights:Record<string,{kilograms:number;formula:string|null}>={};
 for(const p of vedProducts){
  const weight=p.unit_weight_kg;
  if(weight!==null&&Number.isFinite(weight)&&weight>0)
   vedWeights[p.article]={kilograms:weight,formula:"Вес коробки брутто / вложимость"};
 }
 const model=selected[market],c=COLS[model];
 const normalizedSearch=search.toLowerCase().trim();
 const vedList=useMemo(()=>vedProducts.filter(x=>(x.name+" "+x.article).toLowerCase().includes(normalizedSearch)),[vedProducts,normalizedSearch]);
 const knownArticles=new Set(vedProducts.map(x=>x.article));
 const list=DATA.filter(x=>!knownArticles.has(x.sku)&&(x.name+" "+x.sku).toLowerCase().includes(normalizedSearch));
 const item=DATA.find(p=>p.sku===sku);
 const selectedWeight=sku?vedWeights[sku]:undefined;
 const overrideKey=(sku||"")+"@"+model;
 const override=overrides[overrideKey];
 const overrideValue=override!==undefined&&override.trim()!==""&&Number(override)>0?Number(override):undefined;
 const row=item?entryFor(item,model,overrideValue):undefined;
 const baseModel=model==="ozon-fbs"?"ozon-fbo":model==="ym-fbs"?"ym-fby":model;
 const sourceRow=item?.models[baseModel]?.row;
 const sourceUrl=sourceRow?WORKBOOK_URL+"?gid="+GIDS[baseModel]+"#range=A"+sourceRow:WORKBOOK_URL;
 const fees=FINANCE[model];
 const logistics=row?fees.logistics.reduce((sum,i)=>sum+numeric(row,i),0):0;
 const other=row?numeric(row,c.price)-numeric(row,c.cost)-numeric(row,fees.commission)-logistics-numeric(row,fees.ads)-numeric(row,c.profit):0;
 const recommended=item&&(model==="ozon-fbs"||model==="ym-fbs")?pilotFbsMinPrice(item,model):null;
 const activeVed=vedSelected?vedProducts.find(p=>p.id===vedSelected):null;
 const activeVedPhoto=activeVed?.source_item_id?vedPhotoUrls[activeVed.source_item_id]||null:null;
 function openImagePreview(e:MouseEvent<HTMLDivElement>,src:string,alt:string){
  if(!src)return;
  const rect=e.currentTarget.getBoundingClientRect();
  const maxWidth=Math.min(374,window.innerWidth-24);
  const maxHeight=Math.min(374,window.innerHeight-24);
  const left=rect.right+12+maxWidth<=window.innerWidth-8?
   rect.right+12:Math.max(8,rect.left-maxWidth-12);
  const top=Math.max(8,Math.min(window.innerHeight-maxHeight-8,rect.top-8));
  setPhotoPreview({src,alt,left,top,anchorLeft:rect.left,anchorRight:rect.right,anchorTop:rect.top});
 }
 function fitImagePreview(image:HTMLImageElement){
  const bounds=image.parentElement?.getBoundingClientRect();
  if(!bounds)return;
  setPhotoPreview(prev=>{
   if(!prev||prev.src!==image.getAttribute("src"))return prev;
   const left=prev.anchorRight+12+bounds.width<=window.innerWidth-8?
    prev.anchorRight+12:Math.max(8,prev.anchorLeft-bounds.width-12);
   const top=Math.max(8,Math.min(window.innerHeight-bounds.height-8,prev.anchorTop-8));
   return prev.left===left&&prev.top===top?prev:{...prev,left,top};
  });
 }
 function openPhoto(e:MouseEvent<HTMLDivElement>,p:Product){
  const src=PHOTOS[p.sku];if(src)openImagePreview(e,src,displayNewProductName(p.name,p.sku));
 }
 function changeModel(k:ModelKey){setSelected(x=>({...x,[market]:k}));setView("summary");}
 function changeMarket(k:Marketplace){setMarket(k);setView("summary");}
 useEffect(()=>{if(!sku)return;const handler=(e:KeyboardEvent)=>{if(e.key==="Escape")setSku(null)};document.addEventListener("keydown",handler);return()=>document.removeEventListener("keydown",handler)},[sku]);
 useEffect(()=>{if(!sku)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous}},[sku]);
 const tabs=<><div className="unit-market-tabs" role="tablist">{(["ozon","wb","ym"] as const).map(k=><button key={k} role="tab" aria-selected={k===market} className={k===market?"active":""} onClick={()=>changeMarket(k)}>{MARKET_NAMES[k]}</button>)}</div><div className="unit-model-tabs" role="tablist">{TABS[market].map(k=><button key={k} role="tab" aria-selected={k===model} className={k===model?"active":""} onClick={()=>changeModel(k)}>{LABEL[k]}</button>)}</div></>;
 return <section className="unit-pilot">
  <div className="unit-pilot-top">
   <div className="unit-pilot-title-group"><strong>Новая юнит-экономика</strong><span>Все товары в одной таблице</span></div>
   <div className="unit-pilot-top-actions">
    <button type="button" disabled={vedLoading||vedBusy} onClick={()=>{setVedLoading(true);setVedRevision(x=>x+1)}}>Обновить</button>
    <button type="button" disabled={vedBusy} onClick={()=>void reloadPendingVed()}>
     {vedBusy?"Синхронизация…":"Загрузить ожидающие ВЭД"}
    </button>
    <Link href={WORKBOOK_URL} target="_blank">Контрольная книга ↗</Link>
   </div>
  </div>
  <div className="unit-pilot-tabs">{tabs}</div>
  <details className="unit-pilot-help"><summary>Источники и правила расчётов</summary>
   <p>Новые товары подгружаются из сохранённых расчётов ВЭД. Пять контрольных товаров из Google Таблиц сохраняются для сравнения.
   Чистая прибыль, НДС и ROI вычисляются новым движком. Отсутствующие категории, выкупы и СПП WB не заменяются нулями.
   Исходный реестр ВЭД и старая версия юнитки не изменяются.</p>
  </details>
  {vedError&&<p className="unit-pilot-error" role="alert"><strong>Синхронизация ВЭД:</strong> {vedError}</p>}
  {costUpdating&&<p className="unit-pilot-notice" role="status">Пересчитываем себестоимость и подбор цен по тарифным ступеням…</p>}
  {costUpdateError&&<p className="unit-pilot-error" role="alert"><strong>Пересчёт себестоимости:</strong> {costUpdateError}</p>}
  {vedPhotoError&&<p className="unit-pilot-error" role="status"><strong>Фото КП:</strong> {vedPhotoError}</p>}
  <div className="unit-table-toolbar"><div className="unit-table-title">Товары <span>{list.length+vedList.length}{vedLoading?" · обновление…":""}</span></div><div className="unit-toolbar-right"><input aria-label="Поиск пилотных товаров" placeholder="Поиск товара, артикула..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
  <div className="unit-pilot-scroller"><table className="unit-pilot-table"><thead><tr>{["Фото","Наименование","Рентабельность","Маржинальность","Чистая прибыль","Себестоимость","Литраж","Цена продажи","Цена с СПП",...(model==="ozon-fbo"?["Зона размещения"]:[])].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{list.map(p=>{const r=entryFor(p,model);return <tr key={p.sku} className={r?"clickable":""} tabIndex={r?0:-1} onClick={()=>r&&setSku(p.sku)} onKeyDown={e=>{if(r&&e.key==="Enter")setSku(p.sku)}}>
   <td><div className="unit-pilot-thumb" onMouseEnter={e=>openPhoto(e,p)} onMouseLeave={()=>setPhotoPreview(null)}>{PHOTOS[p.sku]?<Image src={PHOTOS[p.sku]} width={46} height={46} alt={displayNewProductName(p.name,p.sku)} unoptimized/>:<span>Нет фото</span>}</div></td><td className="unit-pilot-name">{displayNewProductName(p.name,p.sku)}<small>{p.sku}</small></td><td className={r&&numeric(r,c.roi)<0?"unit-pilot-red":"unit-pilot-green"}>{fmt(r,c.roi)}</td><td>{fmt(r,c.margin)}</td><td className={r&&numeric(r,c.profit)<0?"unit-pilot-red":""}>{fmt(r,c.profit)}</td><td>{fmt(r,c.cost)}</td><td>{fmt(r,c.volume)}</td><td>{fmt(r,c.price)}</td><td>{fmt(r,c.buyer)}</td>{model==="ozon-fbo"&&<td>Не определена</td>}
  </tr>})}
  {vedList.map(p=>{
   const calc=p.schemes[model];
   const photoSrc=p.source_item_id?vedPhotoUrls[p.source_item_id]:undefined;
   const money=(x:number|null|undefined)=>x===null||x===undefined?"—":formatUnitNumber(x,"₽");
   const ratio=(x:number|null|undefined)=>x===null||x===undefined?"—":formatUnitPercent(x);
   const status=calc?.status==="calculated"?"Рассчитано":
    calc?.status==="estimated"?"Предварительно":
    calc?.status==="invalid_ved"?"Ошибка ВЭД":"Нужны исходные данные";
   return <tr key={"ved:"+p.id} className="clickable" tabIndex={0}
     title={calc?.missing?.join("; ")||"Открыть карточку товара из ВЭД"}
     onClick={()=>{setSku(null);setVedSelected(p.id);}}
     onKeyDown={e=>{if(e.key==="Enter")setVedSelected(p.id)}}>
     <td><div className="unit-pilot-thumb"
      onMouseEnter={e=>{if(photoSrc)openImagePreview(e,photoSrc,displayNewProductName(p.name,p.article))}}
      onMouseLeave={()=>setPhotoPreview(null)}>
      {photoSrc?<Image src={photoSrc} width={46} height={46}
       alt={displayNewProductName(p.name,p.article)} unoptimized/>:<span>Нет фото</span>}
     </div></td>
     <td className="unit-pilot-name">{displayNewProductName(p.name,p.article)}
      <small>{p.article} <span className="unit-pilot-status">· {status}</span></small>
     </td>
     <td className={calc?.roi!==null&&calc?.roi!==undefined&&calc.roi<0?"unit-pilot-red":"unit-pilot-green"}>{ratio(calc?.roi)}</td>
     <td>{ratio(calc?.margin)}</td>
     <td className={calc?.profitRub!==null&&calc?.profitRub!==undefined&&calc.profitRub<0?"unit-pilot-red":""}>{money(calc?.profitRub)}</td>
     <td>{money(calc?.costGrossRub??p.cost_gross_rub)}</td>
     <td>{calc?.volumeLiters===null||calc?.volumeLiters===undefined?"—":formatUnitNumber(calc.volumeLiters)}</td>
     <td>{money(calc?.priceRub)}</td>
     <td>{money(calc?.priceAfterSppRub)}</td>
     {model==="ozon-fbo"&&<td>Требует уточнения</td>}
    </tr>;
  })}
  </tbody></table></div>
  {list.length===0&&vedList.length===0&&!vedLoading&&<p className="unit-pilot-no-data">Товаров пока нет. Проверьте сохранённые версии ВЭД или измените поисковый запрос.</p>}

  {vedSelected&&<VedUnitEconomicsLive key={vedSelected} modalProductId={vedSelected} activeModel={model} photoUrl={activeVedPhoto}
    onClose={()=>setVedSelected(null)}
    onPriceUpdated={(productId,changedModel,updatedScheme)=>{
     // PATCH already returned all financials: update only the affected row.
     setVedProducts(current=>current.map(p=>p.id===productId?{
      ...p,schemes:{...p.schemes,[changedModel]:updatedScheme}
     }:p));
    }}
    onSaved={()=>setVedRevision(x=>x+1)}/>}
  {photoPreview&&<div className="unit-pilot-photo-popover" style={{left:photoPreview.left,top:photoPreview.top}} role="presentation"><Image src={photoPreview.src} alt={photoPreview.alt} width={360} height={360} unoptimized onLoad={e=>fitImagePreview(e.currentTarget)}/></div>}
  {item&&<div className="unit-pilot-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSku(null)}}><div className="unit-pilot-modal" role="dialog" aria-modal="true" aria-labelledby="unit-pilot-modal-title">
   <header className="unit-pilot-modal-head"><div className="unit-pilot-heading"><div className="unit-pilot-thumb">{PHOTOS[item.sku]?<Image src={PHOTOS[item.sku]} width={59} height={59} alt={displayNewProductName(item.name,item.sku)} unoptimized/>:<span>Нет фото</span>}</div><div><h2 id="unit-pilot-modal-title">{displayNewProductName(item.name,item.sku)}</h2><p>Артикул: {item.sku}</p></div></div><button onClick={()=>setSku(null)} aria-label="Закрыть модалку">×</button></header>
   <div className="unit-pilot-modal-tabs">{tabs}<div className="unit-pilot-views"><button className={view==="summary"?"active":""} onClick={()=>setView("summary")}>Сводка</button><button className={view==="details"?"active":""} onClick={()=>setView("details")}>Все расчёты</button></div></div>
   {row?<div className="unit-pilot-modal-body" key={sku+model+view}>{row.calculated&&<div className="unit-pilot-notice"><strong>Пробный расчёт FBS.</strong> {row.notes?.join(". ")}.</div>}
    {row.auditStatus&&<div className="unit-pilot-notice"><strong>Проверка финальных показателей:</strong> {row.auditStatus}</div>}
    {row.logisticsAudit&&<details className="unit-pilot-group"><summary><strong>Логистика: самостоятельный расчёт и сверка</strong><span>Раскрыть</span></summary><div style={{padding:"12px",fontSize:"12px"}}>
   <div>Состояние: {row.logisticsAudit.status}. Общая сумма рассчитанных статей: {row.logisticsAudit.total===null?"Недостаточно данных":formatUnitNumber(row.logisticsAudit.total,"₽")}</div>
   {row.logisticsAudit.changes.map((line,i)=><div key={i} style={{marginTop:"8px"}}>
     <strong>{line.name}: {formatUnitNumber(line.now,"₽")}</strong>
     <div>Формула: {line.formula}</div>
     <div>Ранее: {line.was===null?"Нет значения":formatUnitNumber(line.was,"₽")}; изменение: {line.delta===null?"Не сравнить":formatUnitNumber(line.delta,"₽")}</div>
   </div>)}
   {row.logisticsAudit.warnings.map((msg,i)=><div key={i} style={{marginTop:"8px"}}>Требуется уточнение: {msg}</div>)}
  </div></details>}
  {row.vatAudit&&<details className="unit-pilot-group"><summary><strong>Унифицированный НДС: сверка и детализация</strong><span>Раскрыть</span></summary>
      <div style={{padding:"12px",fontSize:"12px"}}>
      <div>Исходящий НДС: {formatUnitNumber(row.vatAudit.outputVat,"₽")}</div>
      <div>Входящий НДС: {formatUnitNumber(row.vatAudit.inputVat,"₽")}</div>
      <div>Расчётная налоговая разница: {formatUnitNumber(row.vatAudit.netVat,"₽")}</div>
      <div>Расхождение с прежним расчётом: {row.vatAudit.comparison} ₽</div>
      <div>Отрицательная разница не обнуляется автоматически и не означает немедленного поступления возмещения.</div>
      </div>
     </details>}
    {row.volumeAudit&&<details className="unit-pilot-group"><summary><strong>Литраж индивидуальной упаковки: формула и источники</strong><span>Раскрыть</span></summary><div style={{padding:"12px",fontSize:"12px"}}>
      <div>Приоритет: габариты ИУ → готовый литраж ИУ → транспортировочная коробка / вложимость</div>
      <div style={{marginTop:"8px"}}>Сработал источник: <strong>{row.volumeAudit.volumeSource}</strong></div>
      <div>Формула: {row.volumeAudit.volumeFormula}</div>
      <div>Точный объём: {row.volumeAudit.exactVolume??"Не определён"} л</div>
      <div>Предыдущий объём таблицы: {row.volumeAudit.previousSheetLiters??"Не указан"} л</div>
      {row.volumeAudit.alternatives&&<div>Сравнение альтернатив: {row.volumeAudit.alternatives}</div>}
      {row.volumeAudit.volumeNotes&&<div>Замечания: {row.volumeAudit.volumeNotes}</div>}
      <div style={{marginTop:"8px"}}>Логистические статьи пока взяты из действующей модели; влияние нового объёма на их тарифы пересчитаем в следующем блоке.</div>
      {row.ozonSppFormula&&<div style={{marginTop:"8px"}}>Ozon СПП и цена с СПП: {row.ozonSppFormula}</div>}
    </div></details>}
    {(model==="ym-fby"||model==="ym-fbs")&&row.oldYandexRoi!==null&&row.oldYandexRoi!==undefined&&
      <div className="unit-pilot-notice"><strong>ROI Яндекс по прежней методике: {formatUnitPercent(row.oldYandexRoi)}</strong>. Основной ROI рассчитан по единой базе себестоимости без НДС закупки.</div>}{view==="summary"?<>
    <div className="unit-pilot-metrics"><div>ROI <strong className={numeric(row,c.roi)<0?"unit-pilot-red":"unit-pilot-green"}>{fmt(row,c.roi)}</strong></div><div>Чистая прибыль<strong>{fmt(row,c.profit)}</strong></div><div>Маржинальность<strong>{fmt(row,c.margin)}</strong></div></div>
    <div className="unit-pilot-columns"><section className="unit-pilot-panel"><h3>Исходные данные</h3>{[["Категория",c.category],["Себестоимость, ₽",c.cost],["Цена продажи, ₽",c.price],["Объём, л",c.volume],["Цена с СПП",c.buyer]].map(([label,i])=><label key={String(label)}>{label}{label==="Цена продажи, ₽"&&row.calculated?<input className="unit-pilot-price-input" type="number" min="0.01" step="0.01" value={override??String(numeric(row,c.price))} onChange={e=>setOverrides(old=>({...old,[overrideKey]:e.target.value}))}/>:<output>{fmt(row,i as number|null)}</output>}</label>)}<label title={selectedWeight?.formula||"Вес транспортировочной коробки брутто / количество штук в коробке. Подтягивается из реестра ВЭД."}>
    Вес товара, кг (расчётный, только чтение)
    <output aria-label="Расчётный вес товара из ВЭД">{selectedWeight?formatUnitNumber(selectedWeight.kilograms):"Нет данных ВЭД"}</output>
   </label>{model==="ozon-fbo"&&<label>Зона размещения<output>Не указана в строке</output></label>}</section>
    <section className="unit-pilot-panel"><h3>Финансовый результат</h3><div>Цена продажи <b>{fmt(row,c.price)}</b></div><div>Себестоимость <b>{fmt(row,c.cost)}</b></div><div>Комиссия маркетплейса <b>{fmt(row,fees.commission)}</b></div><div>Логистика <b>{rub(logistics)}</b></div><div>Реклама <b>{fmt(row,fees.ads)}</b></div><div>Прочие расходы и налоги <b>{rub(other)}</b></div><details className="unit-pilot-vat-mini"><summary>НДС к уплате: {fmt(row,c.vat)}</summary><p>Исходящий НДС: {fmt(row,c.output)} · Входящий НДС: {fmt(row,c.input)}</p></details><div className="unit-pilot-total">Чистая прибыль <b>{fmt(row,c.profit)}</b></div></section></div>
    <section className="unit-pilot-panel"><h3>Подбор цены по ROI <small>Цель 15,001%</small></h3><div className="unit-pilot-price"><span>Текущая цена <b>{fmt(row,c.price)}</b></span><span>Рекомендуемая цена <b>{recommended===null?"Ожидает независимого расчёта":rub(recommended)}</b></span></div></section>
   </>:<><p className="unit-pilot-note">Разделы содержат исходные значения и полные формулы каждой ячейки Google Sheets.</p>{(GROUPS[model]||[]).map(g=><details key={g.name} className="unit-pilot-group"><summary><strong>{g.name}</strong><span>Раскрыть</span></summary><div>{g.cells.map(i=><Field key={i} row={row} model={model} index={i}/>)}</div></details>)}<details className="unit-pilot-group"><summary><strong>Все остальные поля исходного расчёта</strong><span>Раскрыть</span></summary><div>{row.values.map((_,i)=><Field key={i} row={row} model={model} index={i}/>)}</div></details></>}</div>:<div className="unit-pilot-no-data">Для этого товара нет расчёта по выбранной схеме продаж в исходной книге.</div>}
   <footer className="unit-pilot-modal-foot"><span>Пилот: 02.11.2026 · исходная книга не изменяется</span><div><Link href={sourceUrl} target="_blank" rel="noreferrer">Открыть строку в Google Sheets ↗</Link><button onClick={()=>setSku(null)}>Закрыть</button></div></footer>
  </div></div>}
 </section>;
}
