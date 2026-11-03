/**
 * Промежуточный адаптер для сверки нового ядра с действующими таблицами.
 * Принимает значения исходной строки, ничего не запрашивает и не сохраняет.
 * Яндекс FBY/FBS подключены к единым итогам. Старый ROI сохраняется для сравнения.
 */
import {calculateUnitFinancials,type UnitFinancialOutput,type UnitFinalModel,type UnitExpenseGroup} from "./financial-results";
import {calculateOzonSppPrice,calculateOzonVolume,type OzonVolumeAudit,type OzonSppResult} from "./ozon/price-and-volume";
import {calculateIndividualPackageVolume,type VolumeAudit} from "./individual-package-volume";
import {calculateUnitVat,type VatResult} from "./vat";

export type ReferenceValues=readonly (number|string|null|undefined)[];
type ExpenseColumns=Readonly<Record<UnitExpenseGroup,readonly number[]>>;
type Layout=Readonly<{
 price:number;cost:number;outputVat:number;inputVat:number;purchaseVat:number;
 profit:number;margin:number;roi:number;expenseColumns:ExpenseColumns;
}>;
export const LAYOUT:Readonly<Record<UnitFinalModel,Layout>>={
 "ozon-fbo":{price:13,cost:11,outputVat:39,inputVat:40,purchaseVat:41,profit:48,margin:49,roi:50,
 expenseColumns:{commission:[17],logistics:[22,25],advertising:[36],other:[18,24,26,27,32,33,34]}},
 "ozon-fbs":{price:10,cost:8,outputVat:37,inputVat:38,purchaseVat:39,profit:45,margin:46,roi:47,
 expenseColumns:{commission:[14],logistics:[19,22],advertising:[34],other:[15,21,23,24,25,26,31,32]}},
 "wb-fbw":{price:13,cost:11,outputVat:32,inputVat:33,purchaseVat:34,profit:42,margin:43,roi:44,
 expenseColumns:{commission:[17],logistics:[23],advertising:[29],other:[18,19,25,26,27]}},
 "wb-fbs":{price:13,cost:11,outputVat:32,inputVat:33,purchaseVat:34,profit:42,margin:43,roi:44,
 expenseColumns:{commission:[17],logistics:[23],advertising:[29],other:[18,19,25,26,27,45]}},
 "ym-fby":{price:13,cost:11,outputVat:29,inputVat:30,purchaseVat:31,profit:36,margin:37,roi:38,
 expenseColumns:{commission:[16],logistics:[20,21],advertising:[26],other:[17,18,22,23,24]}},
 "ym-fbs":{price:13,cost:11,outputVat:37,inputVat:38,purchaseVat:39,profit:44,margin:45,roi:46,
 expenseColumns:{commission:[16],logistics:[20,21],advertising:[34],other:[17,18,22,23,32]}}
};
const finite=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
const readNum=(v:unknown):number|null=>{
 if(finite(v))return v;
 if(typeof v==="string"&&v.trim()){
  const parsed=Number(v.replace(/[\s\u00a0\u202f]/g,"").replace(",","."));
  return Number.isFinite(parsed)?parsed:null;
 }
 return null;
};
function readRate(v:unknown):number|null{
 if(typeof v==="number"&&Number.isFinite(v))return v;
 if(typeof v==="string"&&v.trim()){
  const pct=v.trim().endsWith("%");
  const num=Number(v.replace(/[\s\u00a0\u202f%]/g,"").replace(",","."));
  if(Number.isFinite(num))return pct?num/100:num;
 }
 return null;
}
/** Входящий НДС по идентичным правилам для Ozon, WB и Яндекс.
 * Здесь коды колонок применяются только к импортированным контрольным строкам.
 * Доли допустимого вычета соответствуют листу «НДС настройки» от 03.11.2026.
 * Справочник услуг в дальнейшем будет единственным источником ставок.
 */
export function calculateMarketplaceReferenceVat(model:UnitFinalModel,values:ReferenceValues):VatResult{
 const n=(i:number)=>readNum(values[i])??NaN;
 const vatColumns:Record<UnitFinalModel,{salesRate:number;purchaseVat:number;items:readonly(readonly[number,string,number])[]}>={
  "ozon-fbo":{salesRate:37,purchaseVat:41,items:[
   [17,"commission",1],[18,"acquiring",0],[22,"delivery",1],[24,"receiving",1],
   [25,"last-mile",1],[26,"mayak",0],[27,"handling",1],[32,"packing",0],[36,"ads",1]]},
  "ozon-fbs":{salesRate:35,purchaseVat:39,items:[
   [14,"commission",1],[15,"acquiring",0],[19,"delivery",1],[21,"receiving",1],
   [22,"last-mile",1],[23,"processing-fbs",1],[24,"shipment",0],
   [25,"mayak",0],[31,"packing",0],[34,"ads",1]]},
  "wb-fbw":{salesRate:30,purchaseVat:34,items:[
   [17,"commission",1],[18,"acquiring",0],[19,"storage",1],[23,"delivery",1],
   [25,"receiving",1],[26,"shipment",0],[29,"ads",1]]},
  "wb-fbs":{salesRate:30,purchaseVat:34,items:[
   [17,"commission",1],[18,"acquiring",0],[19,"storage",1],[23,"delivery",1],
   [25,"receiving",1],[26,"shipment",0],[29,"ads",1]]},
  "ym-fby":{salesRate:27,purchaseVat:31,items:[
   [16,"commission",1],[17,"acquiring",0],[18,"processing",1],[20,"middle-mile",1],
   [21,"last-mile",1],[22,"mayak",0],[23,"order-acceptance",1],[26,"ads",1]]},
  "ym-fbs":{salesRate:35,purchaseVat:39,items:[
   [16,"commission",1],[17,"acquiring",0],[18,"processing",1],[20,"middle-mile",1],
   [21,"last-mile",1],[22,"mayak",0],[23,"order-acceptance",1],[34,"ads",1]]}
 };
 const cfg=vatColumns[model];
 if(!cfg)throw Error("Неизвестная схема");
 const rate=readRate(values[cfg.salesRate]);
 if(rate===null)throw Error("Не указана ставка НДС реализации: "+model);
 return calculateUnitVat({
  sellingPriceGross:n(LAYOUT[model].price),
  salesVatRate:rate,
  purchaseInputVat:n(cfg.purchaseVat),
  expenses:cfg.items.map(([index,code,share])=>({
   code,amountGross:n(index),vatRate:.22,deductibleShare:share
  }))
 });
}
export function calculateYandexReferenceVat(model:"ym-fby"|"ym-fbs",values:ReferenceValues):VatResult{
 return calculateMarketplaceReferenceVat(model,values);
}
export type FinancialReferenceCheck=Readonly<{
 status:"matched"|"roi-method-changed"|"different"|"missing-input";
 output:UnitFinancialOutput|null;
 missingColumns:readonly number[];
 differences:Readonly<{profit:number;margin:number;roi:number}>|null;
 previousRoiRatio:number|null;
 previousRoiInvestedBase:number|null;
 vatAudit:Readonly<{calculated:VatResult;sourceOutputVat:number;sourceInputVat:number;maxDifference:number}>|null;
}>;
export function recalculateFinancialReference(model:UnitFinalModel,values:ReferenceValues):FinancialReferenceCheck{
 const layout=LAYOUT[model];if(!layout)throw new Error("Модель не поддерживается");
 const need=[layout.price,layout.cost,layout.outputVat,layout.inputVat,layout.purchaseVat,
  ...Object.values(layout.expenseColumns).flat()];
 const missing=need.filter(i=>!finite(values[i]));
 if(missing.length)return{status:"missing-input",output:null,missingColumns:missing,differences:null,previousRoiRatio:null,previousRoiInvestedBase:null,vatAudit:null};
 const n=(i:number)=>values[i] as number;
 const expenses=Object.entries(layout.expenseColumns).flatMap(([group,indices])=>indices.map((i)=>({
  code:model+":field:"+i,name:"Статья "+i,group:group as UnitExpenseGroup,amount:n(i)
 })));
 const isYandex=model==="ym-fby"||model==="ym-fbs";
 const vat=calculateMarketplaceReferenceVat(model,values);
 const vatAudit=vat?{
  calculated:vat,sourceOutputVat:n(layout.outputVat),sourceInputVat:n(layout.inputVat),
  maxDifference:Math.max(Math.abs(vat.outputVat-n(layout.outputVat)),Math.abs(vat.inputVatTotal-n(layout.inputVat)))
 }:null;
 const output=calculateUnitFinancials({model,sellingPriceGross:n(layout.price),costGross:n(layout.cost),
  outputVat:vat?.outputVat??n(layout.outputVat),inputVatTotal:vat?.inputVatTotal??n(layout.inputVat),
  purchaseInputVat:vat?.purchaseInputVat??n(layout.purchaseVat),expenses});
 const hasSourceFinal=[layout.profit,layout.margin,layout.roi].every(i=>finite(values[i]));
 const oldInvestedBase=isYandex?n(layout.cost)+n(18)+n(22):null;
 const oldRoi=isYandex&&oldInvestedBase!==null&&oldInvestedBase>0?output.netProfit/oldInvestedBase:null;
 const differences=hasSourceFinal?{profit:output.netProfit-n(layout.profit),
  margin:(output.marginRatio??NaN)-n(layout.margin),
  roi:(output.roiRatio??NaN)-n(layout.roi)}:null;
 const profitMatches=!!differences&&Math.abs(differences.profit)<=1e-7;
 const marginMatches=!!differences&&Math.abs(differences.margin)<=1e-7;
 const oldYandexRoiMatches=!isYandex||(
  oldRoi!==null&&hasSourceFinal&&Math.abs(oldRoi-n(layout.roi))<=1e-7
 );
 const status=profitMatches&&marginMatches&&oldYandexRoiMatches&&(!vatAudit||vatAudit.maxDifference<=1e-7)
  ?(isYandex&&differences&&Math.abs(differences.roi)>1e-7?"roi-method-changed":"matched")
  :"different";
 return{status,output,missingColumns:[],differences,previousRoiRatio:oldRoi,previousRoiInvestedBase:oldInvestedBase,vatAudit};
}
export type OzonAdditionalCheck=Readonly<{volume:OzonVolumeAudit;spp:OzonSppResult}>;
/**
 * Ozon FBS использует ту же ИУ и коробку товара, что и FBO.
 * При поступлении данных ВЭД сюда передаётся карточка товара с размерами,
 * а не готовые числовые результаты Google Таблицы.
 */
export function recalculateOzonReferenceInputs(
 model:"ozon-fbo"|"ozon-fbs",values:ReferenceValues,individualSource:ReferenceValues
):OzonAdditionalCheck{
 const priceIndex=model==="ozon-fbo"?13:10;
 const price=readNum(values[priceIndex]);
 if(price===null||price<=0)throw new Error("Неизвестна цена для СПП");
 const dimensions=[6,7,8].map(i=>readNum(individualSource[i]));
 const volume=calculateOzonVolume({
  individualDimensions:dimensions.every(x=>x!==null)?{
    length:dimensions[0]!,width:dimensions[1]!,height:dimensions[2]!,unit:"cm"
  }:undefined,
  individualVolumeLiters:readNum(individualSource[9]),
  carton:{
   volume:readNum(individualSource[28])??0,
   unit:"m3",
   unitsPerCarton:readNum(individualSource[29])??0
  }
 });
 const spp=calculateOzonSppPrice({priceGross:price});
 return{volume,spp};
}

/** Адаптация контрольных строк таблицы к единому алгоритму литража ИУ.
 * В производстве individualVolumeLiters, габариты и коробка поступают из карточки ВЭД.
 * Здесь допущено чтение готового J и коробки Ozon того же артикула,
 * поскольку в пилотных строках WB/ЯМ нет отдельных полей коробки.
 */
export type MarketplaceVolumeCheck=Readonly<{
 audit:VolumeAudit;
 originalSheetLiters:number|null;
 differenceLiters:number|null;
 fallbackCartonFromOzon:boolean;
}>;
export function recalculateMarketplaceVolume(
 model:UnitFinalModel,
 marketplaceValues:ReferenceValues,
 transportBoxReference?:ReferenceValues
):MarketplaceVolumeCheck{
 const source=model==="ozon-fbs"&&transportBoxReference?transportBoxReference:marketplaceValues;
 const dimsIndices=model==="ozon-fbs"&&transportBoxReference?[6,7,8]:[6,7,8];
 const dims=dimsIndices.map(i=>readNum(source[i]));
 const existingVolumeIndex=model==="ozon-fbs"?6:9;
 const rawVolume=model==="ozon-fbs"&&transportBoxReference?readNum(source[9]):readNum(marketplaceValues[existingVolumeIndex]);
 const cartonSource=transportBoxReference??(model==="ozon-fbo"?marketplaceValues:undefined);
 const cartonVolume=cartonSource?readNum(cartonSource[28]):null;
 const unitsPerCarton=cartonSource?readNum(cartonSource[29]):null;
 const audit=calculateIndividualPackageVolume({
  individualDimensions:dims.every(x=>x!==null)?{
   length:dims[0]!,width:dims[1]!,height:dims[2]!,unit:"cm"
  }:undefined,
  individualVolumeLiters:rawVolume,
  carton:cartonVolume!==null&&unitsPerCarton!==null?{
   volume:cartonVolume,unit:"m3",unitsPerCarton
  }:undefined
 });
 const originalSheetLiters=readNum(marketplaceValues[existingVolumeIndex]);
 return{
  audit,
  originalSheetLiters,
  differenceLiters:originalSheetLiters!==null&&audit.liters!==null?audit.liters-originalSheetLiters:null,
  fallbackCartonFromOzon:!!transportBoxReference&&!model.startsWith("ozon")
 };
}
