/** Логистика расчётной юнит-экономики всех маркетплейсов.
 * Только арифметика и нормализованные входные данные, никаких Google-запросов.
 * Шесть схем используют одну функцию и версионируемый снимок тарифов.
 */
import {logisticsTariffSnapshot as tariff} from "./tariff-snapshot";
export type LogisticsModel="ozon-fbo"|"ozon-fbs"|"wb-fbw"|"wb-fbs"|"ym-fby"|"ym-fbs";
export type LogisticsEntry=Readonly<{
 code:string;label:string;amount:number;formula:string;source:"formula"|"manual";
}>;
export type LogisticsInput=Readonly<{
 model:LogisticsModel;
 price:number;
 volumeLiters:number;
 buyoutRatio?:number;
 cartonVolumeM3?:number|null;
 unitsPerCarton?:number|null;
 mayakRub?:number|null;
 receivingRub?:number|null;
 handlingRub?:number|null;
 packingRub?:number|null;
 shipmentRub?:number|null;
 pickupProcessingRub?:number|null;
 pickupTravelRub?:number|null;
 orderAcceptanceRub?:number|null;
 fbsReserveRub?:number|null;
 promoPrice?:number|null;
}>;
export type LogisticsOutput=Readonly<{
 model:LogisticsModel;
 volumeLiters:number;
 deliveryToBuyer:number|null;
 deliveryOnReturn:number|null;
 expectedDeliveryPerBuyout:number|null;
 lines:readonly LogisticsEntry[];
 totals:Readonly<{delivery:number;otherServices:number;overall:number}>;
 alternativePromo:Readonly<{price:number;middleMile:number;lastMile:number}>|null;
 warnings:readonly string[];
}>;
function number(v:number,label:string,strict=false){
 if(!Number.isFinite(v)||v<0||(strict&&v===0))throw Error("Недопустимое значение "+label+": "+v);
 return v;
}
function optional(v:number|null|undefined,label:string){
 if(v===null||v===undefined)return null;
 return number(v,label);
}
function lastTier(tiers:ReadonlyArray<readonly [number,number]>,volume:number):number{
 let found=tiers[0][1];
 // Google VLOOKUP(...,TRUE): максимальный левый ключ, не превышающий объём.
 for(const [threshold,rub] of tiers){
  if(volume>=threshold)found=rub;else break;
 }
 return found;
}
export function calculateLogistics(input:LogisticsInput):LogisticsOutput{
 const volume=number(input.volumeLiters,"Литраж ИУ",true);
 const price=number(input.price,"Цена продажи",true);
 const warnings:string[]=[];
 const lines:LogisticsEntry[]=[];
 const used=new Set<string>();
 const add=(code:string,label:string,amount:number,formula:string,source:"manual"|"formula"="formula")=>{
  number(amount,code);
  if(used.has(code))throw Error("Повторное включение логистики "+code);
  used.add(code);lines.push({code,label,amount,formula,source});
 };
 const manual=(code:string,label:string,value:number|null|undefined,description:string)=>{
  const n=optional(value,label);
  if(n===null){warnings.push("Нет данных: "+label+" ("+code+")");return;}
  add(code,label,n,description,"manual");
 };
 let deliveryToBuyer:number|null=null,deliveryOnReturn:number|null=null,expectedDeliveryPerBuyout:number|null=null;
 let alternativePromo:LogisticsOutput["alternativePromo"]=null;
 if(input.model==="ozon-fbo"||input.model==="ozon-fbs"){
  const t=tariff.ozon;
  const forward=lastTier(price>300?t.shippingHigh:t.shippingLow,volume);
  deliveryToBuyer=forward;
  const buyout=optional(input.buyoutRatio,"Доля выкупа");
  if(buyout!==null&&buyout>0&&buyout<=1){
   const returnWeighted=(forward+t.returnsExtraRub)*(1-buyout);
   const delivery=(buyout*forward+(forward+returnWeighted)*(1-buyout))/buyout;
   deliveryOnReturn=returnWeighted;expectedDeliveryPerBuyout=delivery;
   add("delivery","Логистика с учётом возвратов",delivery,
    "(Выкуп × прямой тариф + (прямой тариф + (прямой тариф + 15,25) × (1 − выкуп)) × (1 − выкуп)) / выкуп");
  }else warnings.push("Логистика с возвратами не рассчитана: требуется процент выкупа от 0 до 100% (исключая 0)");
  const last=Math.min(price*t.lastMileRate,t.lastMileMax);
  add("last-mile","Последняя миля",last,"min(25; цена × 1,5%)");
  const receiving=optional(input.receivingRub,"Приёмка Ozon");
  add("receiving","Приёмка на Ozon",receiving??t.receivingPerLiter*volume,
   receiving===null?"(N38 + P38) × литраж":"Пользовательский тариф приёмки","formula");
  if(receiving!==null){const item=lines[lines.length-1];lines[lines.length-1]={...item,source:"manual"};}
  const volumeUp=Math.ceil(volume);
  const handlingDefault=Math.min(t.handlingMaxRub,t.handlingFirstLiterRub+Math.max(0,volumeUp-1)*t.handlingExtraLiterRub);
  const handling=optional(input.handlingRub,"Обработка товара");
  add("handling","Обработка товара в грузоместе",handling??handlingDefault,
   handling===null?"min(60; 5 + max(0; ceil(литры) − 1))":"Ручное значение обработки",handling===null?"formula":"manual");
  if(input.model==="ozon-fbo"){
   const carton=optional(input.cartonVolumeM3,"М³ транспортировочной коробки");
   const units=optional(input.unitsPerCarton,"Вложимость коробки");
   if(carton&&units){
    const palletUnits=t.palletVolumeM3/carton*t.palletFillRatio*units;
    const mayak=t.palletTransportRub/palletUnits;
    add("mayak","Доставка ТК Маяк на единицу",mayak,"Транспорт за паллету / ((объём паллеты / объём коробки) × 80% × вложимость)");
    add("packing","Упаковка и маркировка на единицу",t.labelingPerPalletRub/palletUnits,"Расходы на упаковку паллеты / количество единиц на паллете");
   }else{
    manual("mayak","ТК Маяк",input.mayakRub,"Ручной тариф на единицу до заполнения данных коробки");
    manual("packing","Упаковка и маркировка",input.packingRub,"Ручной тариф на единицу до заполнения данных коробки");
   }
  }else{
   manual("pickup-processing","Обработка отправления FBS",input.pickupProcessingRub,"Норматив или фактический расход Ozon FBS");
   manual("pickup-travel","Доставка до пункта отгрузки FBS",input.pickupTravelRub,"ГСМ и упаковка Ozon FBS");
   // FBS товары отправляются со своего склада: входящий ТК Маяк не обязателен.
   // Если расходы заданы вручную, сохраняем их в расчёте.
   if(input.mayakRub!==undefined&&input.mayakRub!==null)
    manual("mayak","ТК Маяк FBS",input.mayakRub,"Подтверждённый ручной тариф FBS");
   manual("packing","Упаковка и стикеровка FBS",input.packingRub,"Из строки FBS");
  }
 }else if(input.model==="wb-fbw"||input.model==="wb-fbs"){
  const t=tariff.wb;
  const extra=Math.max(0,volume-t.storageBaseLiters);
  const base=volume<=1? t.shippingTierRates.find(([max])=>volume<=max)?.[1]??t.shippingTierRates[t.shippingTierRates.length-1][1]:t.shippingAboveOneLiterBase;
  const shippingBase=base+t.shippingExtraLiterRub*extra;
  const forward=shippingBase*t.warehouseCoefficient*t.localizationCoefficient+price*t.revenuePercentage;
  const reverse=shippingBase;
  deliveryToBuyer=forward;deliveryOnReturn=reverse;
  const buyout=optional(input.buyoutRatio,"Доля выкупа WB");
  if(buyout!==null&&buyout>0&&buyout<=1){
   const full=(buyout*forward+(forward+reverse)*(1-buyout))/buyout;
   expectedDeliveryPerBuyout=full;
   add("delivery","Логистика с учётом выкупов и возвратов WB",full,"(Выкуп × доставка к клиенту + (доставка к клиенту + возврат) × (1 − выкуп)) / выкуп");
  }else warnings.push("Нет корректного процента выкупа WB");
  if(input.model==="wb-fbw"){
   add("storage","Хранение FBW",(t.storageFirstLiterRub+extra*t.storageExtraLiterRub)*t.warehouseCoefficient*t.storageAverageDays,
    "(Тариф 1 л + доп. литры × тариф) × коэффициент склада × дни");
   add("receiving","Приёмка FBW",volume*t.receiptPerLiterRub*t.receiptCoefficient,
    "Литраж × тариф приёмки × коэффициент приёмки");
  }
  add("shipment","Отгрузка на WB",optional(input.shipmentRub,"Отгрузка WB")??t.shipmentToMarketPerUnitRub,
   input.shipmentRub===undefined||input.shipmentRub===null?"Норматив из WB юнитки":"Ручное значение",input.shipmentRub===undefined||input.shipmentRub===null?"formula":"manual");
  if(input.model==="wb-fbs"){
   add("fbs-reserve","Упаковка и резерв FBS",optional(input.fbsReserveRub,"Резерв WB FBS")??t.fbsReserveRub,
    input.fbsReserveRub===undefined||input.fbsReserveRub===null?"Норматив WB FBS":"Ручное значение",
    input.fbsReserveRub===undefined||input.fbsReserveRub===null?"formula":"manual");
  }
 }else if(input.model==="ym-fby"||input.model==="ym-fbs"){
  const t=tariff.ym;
  const calc=(p:number)=>{
   const special=p<=t.lowPriceThreshold&&volume>0&&volume<=t.lowPriceMaxLiters;
   const rounded=Math.ceil(volume);
   const middle=special?0:Math.min(t.middleMileMaxRub,t.middleMileBaseRub+
    t.middleMileExtraThrough200Rub*Math.max(0,Math.min(rounded,200)-1)+
    t.middleMileExtraOver200Rub*Math.max(0,rounded-200));
   const last=special?0:Math.min(t.lastMileMaxRub,p*t.lastMileRate);
   return {middle,last};
  };
  const {middle,last}=calc(price);
  deliveryToBuyer=middle;expectedDeliveryPerBuyout=middle+last;
  add("middle-mile","Средняя миля Яндекс",middle,"Если цена ≤300 и литраж ≤5: 0; иначе min(5500; 92 + 8 × доп. литры до 200 + 5 × сверх 200)");
  add("last-mile","Последняя миля Яндекс",last,"Если цена ≤300 и литраж ≤5: 0; иначе min(1000; 5% × цена)");
  const processingDefault=input.model==="ym-fbs"?t.processingFbsRub:t.fulfillmentFbyRub;
  add("processing","Обработка заказа",optional(input.receivingRub,"Обработка Яндекс")??processingDefault,
   "Обработка заказа FBY/FBS",input.receivingRub===undefined||input.receivingRub===null?"formula":"manual");
  if(input.mayakRub!==undefined&&input.mayakRub!==null){
   manual("mayak","ТК Маяк",input.mayakRub,"Заданный тариф из юнитки или расчёта");
  }else if(input.model==="ym-fby"){
   add("mayak","ТК Маяк",t.mayakDefaultFbyRub,
    "Норматив FBY из ЯМ Юнитки: 15 ₽ на товар");
  }
  // Для Яндекс FBS без заданных расходов на ТК Маяк нет обязательного поля.
  add("order-acceptance","Приём заказа от покупателя",
   optional(input.orderAcceptanceRub,"Приём заказа")??t.orderAcceptanceRub,"Норматив Яндекс 0,12 ₽",
   input.orderAcceptanceRub===undefined||input.orderAcceptanceRub===null?"formula":"manual");
  if(input.model==="ym-fbs"&&input.promoPrice!==undefined&&input.promoPrice!==null){
   const p=number(input.promoPrice,"Цена акции",true);
   const alt=calc(p);alternativePromo={price:p,middleMile:alt.middle,lastMile:alt.last};
  }
 }
 const deliveryCodes=new Set(["delivery","last-mile","middle-mile"]);
 const delivery=lines.filter(x=>deliveryCodes.has(x.code)).reduce((a,b)=>a+b.amount,0);
 const otherServices=lines.filter(x=>!deliveryCodes.has(x.code)).reduce((a,b)=>a+b.amount,0);
 return{model:input.model,volumeLiters:volume,deliveryToBuyer,deliveryOnReturn,expectedDeliveryPerBuyout,
  lines,totals:{delivery,otherServices,overall:delivery+otherServices},alternativePromo,warnings};
}
