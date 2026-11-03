/**
 * Промежуточный адаптер для сверки нового ядра с действующими таблицами.
 * Принимает значения исходной строки, ничего не запрашивает и не сохраняет.
 * Яндекс не подключён.
 */
import {calculateUnitFinancials,type UnitFinancialOutput,type UnitFinalModel,type UnitExpenseGroup} from "./financial-results";
import {calculateOzonSppPrice,calculateOzonVolume,type OzonVolumeAudit,type OzonSppResult} from "./ozon/price-and-volume";

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
 expenseColumns:{commission:[17],logistics:[23],advertising:[29],other:[18,19,25,26,27,45]}}
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
export type FinancialReferenceCheck=Readonly<{
 status:"matched"|"different"|"missing-input";
 output:UnitFinancialOutput|null;
 missingColumns:readonly number[];
 differences:Readonly<{profit:number;margin:number;roi:number}>|null;
}>;
export function recalculateFinancialReference(model:UnitFinalModel,values:ReferenceValues):FinancialReferenceCheck{
 const layout=LAYOUT[model];if(!layout)throw new Error("Модель не поддерживается");
 const need=[layout.price,layout.cost,layout.outputVat,layout.inputVat,layout.purchaseVat,
  ...Object.values(layout.expenseColumns).flat()];
 const missing=need.filter(i=>!finite(values[i]));
 if(missing.length)return{status:"missing-input",output:null,missingColumns:missing,differences:null};
 const n=(i:number)=>values[i] as number;
 const expenses=Object.entries(layout.expenseColumns).flatMap(([group,indices])=>indices.map((i)=>({
  code:model+":field:"+i,name:"Статья "+i,group:group as UnitExpenseGroup,amount:n(i)
 })));
 const output=calculateUnitFinancials({model,sellingPriceGross:n(layout.price),costGross:n(layout.cost),
  outputVat:n(layout.outputVat),inputVatTotal:n(layout.inputVat),purchaseInputVat:n(layout.purchaseVat),expenses});
 const hasSourceFinal=[layout.profit,layout.margin,layout.roi].every(i=>finite(values[i]));
 const differences=hasSourceFinal?{profit:output.netProfit-n(layout.profit),
  margin:(output.marginRatio??NaN)-n(layout.margin),
  roi:(output.roiRatio??NaN)-n(layout.roi)}:null;
 const status=!!differences&&Math.max(...Object.values(differences).map(Math.abs))<=1e-7?"matched":"different";
 return{status,output,missingColumns:[],differences};
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
