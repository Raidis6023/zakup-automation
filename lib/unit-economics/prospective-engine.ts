/**
 * Новый товар: самостоятельная расчётная юнит-экономика от сохранённого ВЭД.
 * Источник: immutable VedCalculationInput + VedCalculationResult.
 * ЕНОТ не создаётся: связь по нормализованному артикулу нового товара.
 * Цены, категории и доли выкупа не угадываем.
 */
import type {VedCalculationInput,VedCalculationResult} from "@/lib/ved-calculation/engine";
import {calculateIndividualPackageVolume} from "./individual-package-volume";
import {calculateUnitWeight} from "./unit-weight";
import {calculateLogistics,type LogisticsModel,type LogisticsOutput} from "./logistics/engine";
import {calculateUnitVat} from "./vat";
import {calculateUnitFinancials,type UnitFinalModel,type UnitExpenseGroup} from "./financial-results";
import {calculateOzonSppPrice} from "./ozon/price-and-volume";

export const PRELIMINARY_MODELS=[
 "ozon-fbo","ozon-fbs","wb-fbw","wb-fbs","ym-fby","ym-fbs"
] as const satisfies readonly UnitFinalModel[];
export type PreliminaryModel=typeof PRELIMINARY_MODELS[number];
/** 15% надбавка к каждому сценарию ВЭД применяется только в юнит-экономике. */
export const UNIT_COST_UPLIFT_RATE=0.15;
export const UNIT_COST_POLICY_VERSION=2;
export type PreliminarySettings={
 priceRub?:number|null;
 categoryId?:string|null;
 categoryCommissionRate?:number|null;
 ozonCommissionRates?:{upTo100:number;upTo300:number;above300:number}|null;
 commissionSurchargeRate?:number|null;
 buyoutRate?:number|null;
 wbSppRate?:number|null;
 advertisingRate?:number|null;
 saleVatRate?:number|null;
 importVatCreditRub?:number|null;
 mayakRub?:number|null;
 insuranceFactor?:number|null;
 ozonInsuranceFactors?:{upTo300:number;above300:number}|null;
 extraBuyerDiscountRate?:number|null;
 promoPriceRub?:number|null;
 fbsPickupRub?:number|null;
 fbsTravelRub?:number|null;
 fbsPackingRub?:number|null;
 handlingRub?:number|null;
 extraRub?:number|null;
};
export type PreliminarySource={
 article:string;name:string;
 input:VedCalculationInput;
 result:VedCalculationResult|null;
 costGrossOverrideRub?:number;
};
export type PreliminaryDetail={
 code:string;label:string;group:UnitExpenseGroup;
 amount:number;formula:string;vatShare:number;
};
export type PreliminaryCalculation={
 model:PreliminaryModel;article:string;name:string;costPolicyVersion:number;
 status:"calculated"|"estimated"|"needs_input"|"invalid_ved";
 missing:string[];assumptions:string[];
 costGrossRub:number|null;purchaseVatCreditRub:number|null;
 costNetRub:number|null;volumeLiters:number|null;
 unitWeightKg:number|null;
 unitWeightFormula:string|null;
 unitWeightSource:"carton-gross"|null;
 unitWeightWarning:string|null;
 volumeSource:string|null;volumeFormula:string|null;
 sourceCost: string;priceRub:number|null;priceAfterSppRub:number|null;
 commissionRate:number|null;logistics:LogisticsOutput|null;
 expenses:PreliminaryDetail[];outputVatRub:number|null;
 inputVatRub:number|null;profitRub:number|null;roi:number|null;margin:number|null;
 targetPriceRub:number|null;tariffSnapshotDate:string;
};
const valid=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
const nonnegative=(v:unknown):v is number=>valid(v)&&v>=0;
const positive=(v:unknown):v is number=>valid(v)&&v>0;
const rates={ozon:{acquiring:.015,advertising:.1,defect:.025},
 wb:{acquiring:.025,advertising:.15,defect:.02},
 ym:{acquiring:.016,advertising:.1,defect:.01}};
const vatShares:Readonly<Record<string,number>>={
 commission:1,delivery:1,"last-mile":1,"middle-mile":1,receiving:1,
 storage:1,processing:1,handling:1,"pickup-processing":1,"order-acceptance":1,
 advertising:1,acquiring:0,shipment:0,packing:0,mayak:0,
 "pickup-travel":0,"fbs-reserve":0,defects:0,insurance:0,"own-extra":0
};
function goodsCost(source:PreliminarySource){
 const r=source.result;
 if(!r)return null;
 const group=[r.scenarios?.["40hq"],r.scenarios?.moq];
 if(group.some(x=>!x||!positive(x.units)||!nonnegative(x.totalCostIncludingVatRub)||!nonnegative(x.importVatRub)))return null;
 // Увеличиваем валовую себестоимость каждого сценария, затем усредняем.
 // Только из исходного ВЭД: повторная синхронизация не начислит 15% второй раз.
 const [container,moq]=group.map(x=>x!.totalCostIncludingVatRub/x!.units*(1+UNIT_COST_UPLIFT_RATE));
 const costGross=(container+moq)/2;
 const importVat=group.reduce((a,x)=>a+x!.importVatRub/x!.units,0)/2;
 // ВЭД managementCostPerUnitRub может уже исключать возмещаемый НДС.
 // НЕ вычитаем его из валовой стоимости дважды.
 const purchaseVat=source.input.customs.importVatRecoverable?importVat:0;
 const gross=source.costGrossOverrideRub??costGross;
 if(!Number.isFinite(gross)||gross<=0||gross<purchaseVat)throw Error("Себестоимость с НДС не может быть ниже входящего НДС закупки");
 return{gross,vat:purchaseVat,net:gross-purchaseVat};
}
export function calculatePreliminary(source:PreliminarySource,model:PreliminaryModel,settings:PreliminarySettings={}):PreliminaryCalculation{
 const missing:string[]=[],assumptions:string[]=[];
 const group=model.startsWith("ozon")?"ozon":model.startsWith("wb")?"wb":"ym";
 const defaults=rates[group];
 const base=goodsCost(source),p=source.input.product;
 const unitWeight=calculateUnitWeight(p.cartonGrossKg,p.unitsPerCarton);
 const vol=calculateIndividualPackageVolume({
  individualDimensions:[p.individualLengthCm,p.individualWidthCm,p.individualHeightCm].every(positive)
   ?{length:p.individualLengthCm!,width:p.individualWidthCm!,height:p.individualHeightCm!,unit:"cm"}:undefined,
  individualVolumeLiters:(p as typeof p&{individualVolumeLiters?:number}).individualVolumeLiters,
  carton:{volume:p.cartonVolumeM3,unit:"m3",unitsPerCarton:p.unitsPerCarton}
 });
 if(!base)missing.push("Расчёт себестоимости ВЭД");
 if(vol.liters===null)missing.push("Литраж индивидуальной упаковки");
 const price=positive(settings.priceRub)?settings.priceRub:null;
 if(price===null)missing.push("Цена продажи или рассчитанная целевая цена");
 if(!settings.categoryId?.trim())missing.push("Категория "+group.toUpperCase());
 const catRate=settings.categoryCommissionRate;
 const ozonTierRates=settings.ozonCommissionRates;
 const resolvedCategoryRate=group==="ozon"&&price!==null&&ozonTierRates?
  (price<=100?ozonTierRates.upTo100:price<=300?ozonTierRates.upTo300:ozonTierRates.above300):
  catRate;
 if(!nonnegative(resolvedCategoryRate)||resolvedCategoryRate>1)
  missing.push("Комиссия категории "+group.toUpperCase());
 const buyout=positive(settings.buyoutRate)&&settings.buyoutRate<=1?settings.buyoutRate:null;
 if(group!=="ym"&&buyout===null)missing.push("Процент выкупа "+group.toUpperCase());
 const wbSpp=nonnegative(settings.wbSppRate)&&settings.wbSppRate<=1?settings.wbSppRate:null;
 if(group==="wb"&&wbSpp===null)missing.push("Процент СПП WB");
 const resolvedInsuranceFactor=price!==null&&settings.ozonInsuranceFactors?
  (price<300?settings.ozonInsuranceFactors.upTo300:settings.ozonInsuranceFactors.above300):
  settings.insuranceFactor;
 if(model==="ozon-fbo"&&!nonnegative(resolvedInsuranceFactor))
  missing.push("Коэффициент страхования Ozon по категории");
 const rate=nonnegative(settings.advertisingRate)&&settings.advertisingRate<=1
  ?settings.advertisingRate:defaults.advertising;
 if(settings.advertisingRate===undefined)assumptions.push("ДРР "+(rate*100)+"%: норматив исходной юнитки, требует подтверждения");
 const vatRate=nonnegative(settings.saleVatRate)?settings.saleVatRate:source.input.customs.vatPercent/100;
 if(!nonnegative(settings.saleVatRate))assumptions.push("Ставка НДС реализации предварительно взята из ВЭД; проверить после выбора категории");
 const result:PreliminaryCalculation={
  model,article:source.article,name:source.name,costPolicyVersion:UNIT_COST_POLICY_VERSION,
  status:source.result?"needs_input":"invalid_ved",missing,assumptions,
  costGrossRub:base?.gross??null,purchaseVatCreditRub:base?.vat??null,costNetRub:base?.net??null,
  volumeLiters:vol.liters,volumeSource:vol.source,volumeFormula:vol.formula,
  unitWeightKg:unitWeight.kilograms,unitWeightFormula:unitWeight.formula,
  unitWeightSource:unitWeight.source,unitWeightWarning:unitWeight.warning,
  sourceCost:"Среднее валовой себестоимости (40HQ × 1,15 и MOQ × 1,15); входящий импортный НДС без надбавки, только при возмещаемости",
  priceRub:price,priceAfterSppRub:null,commissionRate:null,
  logistics:null,expenses:[],outputVatRub:null,inputVatRub:null,profitRub:null,roi:null,margin:null,
  targetPriceRub:null,tariffSnapshotDate:"2026-11-03"
 };
 if(!source.result||!base||!vol.liters||price===null)return result;
 // Даже при отсутствии категории показываем известные затраты, но не финальную прибыль.
 const logistic=calculateLogistics({
  model: model as LogisticsModel,price,volumeLiters:vol.liters,
  buyoutRatio:buyout??undefined,
  cartonVolumeM3:p.cartonVolumeM3,unitsPerCarton:p.unitsPerCarton,
  mayakRub:settings.mayakRub,
  pickupProcessingRub:settings.fbsPickupRub??(model==="ozon-fbs"?0:undefined),
  pickupTravelRub:settings.fbsTravelRub??(model==="ozon-fbs"?0:undefined),
  packingRub:settings.fbsPackingRub??(model==="ozon-fbs"?0:undefined),
  handlingRub:settings.handlingRub,
  promoPrice:settings.promoPriceRub,
 });
 result.logistics=logistic;
 const items:PreliminaryDetail[]=[];
 const add=(code:string,label:string,amount:number,formula:string,group:UnitExpenseGroup,share:number)=>{
  if(!nonnegative(amount))throw Error("Некорректный расход "+code);
  if(items.some(x=>x.code===code))throw Error("Дублирование расхода "+code);
  items.push({code,label,amount,formula,group,vatShare:share});
 };
 for(const l of logistic.lines){
  const grouping=l.code==="delivery"||l.code==="last-mile"||l.code==="middle-mile"?"logistics":"other";
  add(l.code,l.label,l.amount,l.formula,grouping,vatShares[l.code]??0);
 }
 if(logistic.warnings.length)missing.push(...logistic.warnings);
 const acquiring=price*defaults.acquiring;
 add("acquiring","Эквайринг",acquiring,"Цена × "+defaults.acquiring,"other",0);
 const advertising=price*rate;
 add("advertising","Реклама",advertising,"Цена × ДРР "+rate,"advertising",1);
 const defects=base.net*defaults.defect;
 const defectAmount=model==="ozon-fbs"?base.gross*defaults.defect:defects;
 add("defects","Брак",defectAmount,"Себестоимость × "+defaults.defect,"other",0);
 if(model==="ozon-fbo"&&nonnegative(resolvedInsuranceFactor)){
  const factor=resolvedInsuranceFactor;
  add("insurance","Страхование",price*.000838*28*factor/1.22,
   "Цена × 0,0838% × 28 × коэффициент категории / 1,22","other",0);
 }
 if(nonnegative(settings.extraRub)&&settings.extraRub>0)
  add("own-extra","Прочие расходы",settings.extraRub,"Ручное значение на единицу товара","other",0);
 const effectiveRate=group==="wb"&&nonnegative(resolvedCategoryRate)&&wbSpp!==null?
  Math.max(.01,resolvedCategoryRate+(settings.commissionSurchargeRate??0)-wbSpp):
  group==="ym"&&price<=300&&vol.liters<=5?.42:resolvedCategoryRate;
 if(nonnegative(effectiveRate)&&effectiveRate<=1){
  add("commission","Комиссия "+group.toUpperCase(),price*effectiveRate,
   group==="wb"?"Цена × max(1%; ставка категории + надбавка − СПП)":group==="ym"&&price<=300&&vol.liters<=5?
   "Цена × 42% по специальному тарифу":"Цена × ставку комиссии категории","commission",1);
  result.commissionRate=effectiveRate;
 }
 result.expenses=items;
 const extraDiscount=settings.extraBuyerDiscountRate??0;
 if(!nonnegative(extraDiscount)||extraDiscount>1)missing.push("Дополнительная скидка покупателя");
 else{
  if(group==="ozon")result.priceAfterSppRub=calculateOzonSppPrice({
   priceGross:price,additionalDiscountRate:extraDiscount
  }).priceAfterSpp;
  if(group==="wb"&&wbSpp!==null)result.priceAfterSppRub=price*(1-wbSpp)*(1-extraDiscount);
 }
 // Если нет доли выкупа / комиссии / классификации, нельзя рисовать произвольную прибыль.
 if(missing.length)return result;
 const tax=calculateUnitVat({
  sellingPriceGross:price,salesVatRate:vatRate,purchaseInputVat:base.vat,
  expenses:items.map(x=>({code:x.code,amountGross:x.amount,vatRate:x.code==="insurance"||x.code==="fbs-reserve"?0:.22,
   deductibleShare:x.vatShare}))
 });
 const finance=calculateUnitFinancials({
  model,sellingPriceGross:price,costGross:base.gross,
  outputVat:tax.outputVat,inputVatTotal:tax.inputVatTotal,purchaseInputVat:tax.purchaseInputVat,
  expenses:items.map(x=>({code:x.code,name:x.label,group:x.group,amount:x.amount}))
 });
 result.outputVatRub=tax.outputVat;result.inputVatRub=tax.inputVatTotal;
 result.profitRub=finance.netProfit;result.roi=finance.roiRatio;result.margin=finance.marginRatio;
 result.status=assumptions.length?"estimated":"calculated";
 return result;
}

/** Подбор целевой цены с ROI >= 15,001%. Включает тарифные ступени Ozon/Яндекс.
 * Не возвращаем цену, если неизвестна категория, выкупы или WB СПП.
 * Цена проверяется уже тем же движком, не упрощённой формулой.
 */
export function suggestPreliminaryTargetPrice(
 source:PreliminarySource,model:PreliminaryModel,settings:PreliminarySettings,
 targetRoi=.15001
):{priceRub:number|null;missing:string[]}{
 if(!valid(targetRoi)||targetRoi<0||targetRoi>10)throw Error("Некорректная целевая рентабельность");
 const evaluate=(price:number)=>{
  const calc=calculatePreliminary(source,model,{...settings,priceRub:price});
  return calc.roi===null?{ok:false,roi:null,missing:calc.missing}:
   {ok:true,roi:calc.roi,missing:[] as string[]};
 };
 const first=evaluate(Math.max(1,source.result?.averageCostPerUnitRub??1));
 if(!first.ok)return{priceRub:null,missing:first.missing.filter(x=>!x.startsWith("Цена продажи"))};
 const limits=[.01,100,300,1000,10000,100000,1000000,10000000];
 for(let i=0;i<limits.length-1;i++){
  const a=limits[i],b=limits[i+1];
  const low=evaluate(a),high=evaluate(b);
  if(!low.ok||!high.ok)return{priceRub:null,missing:low.missing.length?low.missing:high.missing};
  if((low.roi??-Infinity)>=targetRoi)return{priceRub:Math.ceil(a*100)/100,missing:[]};
  if((high.roi??-Infinity)<targetRoi)continue;
  let left=a,right=b;
  for(let iter=0;iter<52;iter++){
   const mid=(left+right)/2,calc=evaluate(mid);
   if((calc.roi??-Infinity)>=targetRoi)right=mid;else left=mid;
  }
  // Округляем цену вверх до копейки и проверяем фактический ROI ещё раз.
  let rounded=Math.ceil((right-1e-9)*100)/100;
  for(let k=0;k<10;k++,rounded+=.01){
   if((evaluate(rounded).roi??-Infinity)>=targetRoi)
    return{priceRub:Math.round(rounded*100)/100,missing:[]};
  }
  return{priceRub:null,missing:["Не удалось подобрать цену с подтверждённым ROI"]};
 }
 return{priceRub:null,missing:["Целевая ROI не достигается в допустимом диапазоне цен"]};
}
