/** Адаптер строк контрольной юнитки к самостоятельному движку логистики.
 * Колонки используются ТОЛЬКО для сравнения/одноразового импорта.
 * Основной расчёт работает с именованными полями LogisticsInput.
 */
import {calculateLogistics,type LogisticsModel,type LogisticsOutput,type LogisticsInput} from "./engine";
import type {ReferenceValues} from "../financial-reference";
type Comparison=Readonly<{code:string;sourceIndex:number;sourceAmount:number|null;calculatedAmount:number|null;delta:number|null;status:"match"|"different"|"source-missing"|"model-missing"}>;
export type LogisticsReferenceResult=Readonly<{
 status:"complete"|"partial"|"missing-input";
 result:LogisticsOutput|null;
 comparison:readonly Comparison[];
 requiredInputs:readonly string[];
}>;
const indexByModel:Record<LogisticsModel,Readonly<Record<string,number>>>={
 "ozon-fbo":{delivery:22,"last-mile":25,receiving:24,handling:27,mayak:26,packing:32},
 "ozon-fbs":{delivery:19,"last-mile":22,receiving:21,handling:26,"pickup-processing":23,"pickup-travel":24,mayak:25,packing:31},
 "wb-fbw":{delivery:23,storage:19,receiving:25,shipment:26},
 "wb-fbs":{delivery:23,shipment:26,"fbs-reserve":45},
 "ym-fby":{"middle-mile":20,"last-mile":21,processing:18,mayak:22,"order-acceptance":23},
 "ym-fbs":{"middle-mile":20,"last-mile":21,processing:18,mayak:22,"order-acceptance":23}
};
export const LOGISTICS_REFERENCE_COLUMNS=indexByModel;
const dataIndex={price:13,volume:9,buyout:24};
function read(v:unknown):number|null{
 if(typeof v==="number")return Number.isFinite(v)?v:null;
 if(typeof v!=="string"||!v.trim())return null;
 const n=Number(v.replace(/[ \u00a0\u202f]/g,"").replace(",","."));
 return Number.isFinite(n)?n:null;
}
export function compareLogisticsReference(
 model:LogisticsModel,
 values:ReferenceValues,
 liters:number|null,
 carton?:Readonly<{cartonVolumeM3:number|null;unitsPerCarton:number|null}>,
 sourceFormulas?:Readonly<Record<string,string>>
):LogisticsReferenceResult{
 const isOzon=model.startsWith("ozon-"),isWB=model.startsWith("wb-");
 const priceIndex=model==="ozon-fbs"?10:dataIndex.price;
 const volume=liters;
 const price=read(values[priceIndex]);
 const needed:string[]=[];
 if(price===null||price<=0)needed.push("цена");
 if(volume===null||volume<=0)needed.push("литраж ИУ");
 const buyoutIndex=model==="ozon-fbo"?23:model==="ozon-fbs"?20:24;
 const buyout=isOzon||isWB?read(values[buyoutIndex]):undefined;
 if((isOzon||isWB)&&(buyout===null||buyout===undefined||buyout<=0||buyout>1))needed.push("процент выкупа");
 if(needed.length)return{status:"missing-input",result:null,comparison:[],requiredInputs:needed};
 const input:LogisticsInput={
  model,price:price!,volumeLiters:volume!,
  buyoutRatio:buyout??undefined,
  cartonVolumeM3:carton?.cartonVolumeM3,
  unitsPerCarton:carton?.unitsPerCarton,
  // В FBO позиции рассчитываются формулами от тарифа и литража.
  // В FBS отдельные поля могут быть ручными, включая настоящий ноль.
  receivingRub:model==="ozon-fbs"
   ?(sourceFormulas?.["21"]?undefined:read(values[21]))
   :model.startsWith("ym-")?read(values[18]):undefined,
  handlingRub:model==="ozon-fbs"&&sourceFormulas?.["26"]?undefined:model==="ozon-fbs"?read(values[26]):undefined,
  packingRub:model==="ozon-fbs"?read(values[31]):undefined,
  mayakRub:model==="ozon-fbs"?read(values[25]):model.startsWith("ym-")?read(values[22]):undefined,
  pickupProcessingRub:model==="ozon-fbs"?read(values[23]):undefined,
  pickupTravelRub:model==="ozon-fbs"?read(values[24]):undefined,
  orderAcceptanceRub:model.startsWith("ym-")?read(values[23]):undefined,
  shipmentRub:model.startsWith("wb-")?read(values[26]):undefined,
  fbsReserveRub:model==="wb-fbs"?read(values[45]):undefined,
  promoPrice:model==="ym-fbs"?read(values[14]):undefined
 };
 const result=calculateLogistics(input);
 const columnMap=indexByModel[model];
 const comparison=Object.entries(columnMap).map(([code,index]):Comparison=>{
  const original=read(values[index]);
  const calculated=result.lines.find(x=>x.code===code)?.amount??null;
  return{
   code,sourceIndex:index,sourceAmount:original,calculatedAmount:calculated,
   delta:original!==null&&calculated!==null?calculated-original:null,
   status:original===null?"source-missing":calculated===null?"model-missing":
    Math.abs(calculated-original)<=1e-7?"match":"different"
  };
 });
 return{status:result.warnings.length||comparison.some(c=>c.status!=="match")?"partial":"complete",
  result,comparison,requiredInputs:[]};
}
