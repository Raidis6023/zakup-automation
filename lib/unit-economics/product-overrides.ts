/** Пользовательские уточнения нового товара, не изменяющие оригинал ВЭД. */
import type {PreliminarySource} from "./prospective-engine";
import {displayNewProductName} from "@/lib/products/new-product-identity";

export const UNIT_EDITABLE_PRODUCT_FIELDS=[
  "individualLengthCm","individualWidthCm","individualHeightCm",
  "cartonGrossKg","cartonVolumeM3","unitsPerCarton","moqUnits"
] as const;
export type EditableUnitProductField=typeof UNIT_EDITABLE_PRODUCT_FIELDS[number];
export type ProductOverrides={
 name?:string;fullName?:string;productType?:string;costGrossRub?:number;
 product?:Partial<Record<EditableUnitProductField,number>>;
};
const fields=new Set<string>(UNIT_EDITABLE_PRODUCT_FIELDS);
const own=(o:Record<string,unknown>,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const validNumber=(v:unknown,key:string)=>{
 if(typeof v!=="number"||!Number.isFinite(v)||v<=0||v>1000000000)throw Error("Некорректное значение "+key);
 if((key==="unitsPerCarton"||key==="moqUnits")&&!Number.isSafeInteger(v))throw Error("Значение "+key+" должно быть целым");
 return v;
};
export function mergeProductOverrides(original:ProductOverrides|undefined,patch:Record<string,unknown>):ProductOverrides{
 if(!patch||typeof patch!=="object"||Array.isArray(patch))throw Error("Изменения товара должны быть объектом");
 const next:ProductOverrides={...original,product:{...(original?.product||{})}};
 for(const [key,value] of Object.entries(patch)){
  if(key==="name"||key==="fullName"||key==="productType"){
   if(value===null){delete next[key];continue}
   if(typeof value!=="string"||!value.trim()||value.trim().length>(key==="name"?300:key==="fullName"?10000:150))
    throw Error("Недопустимое поле "+key);
   next[key]=value.trim();continue;
  }
  if(key==="costGrossRub"){
   if(value===null){delete next.costGrossRub;continue;}
   next.costGrossRub=validNumber(value,key);continue;
  }
  if(fields.has(key)){
   if(value===null){delete next.product![key as EditableUnitProductField];continue;}
   next.product![key as EditableUnitProductField]=validNumber(value,key);continue;
  }
  throw Error("Поле не допускает редактирование: "+key);
 }
 if(!Object.keys(next.product||{}).length)delete next.product;
 return next;
}
/** Общие характеристики редактируются один раз на товар, итог виден во всех МП. */
export function applyProductOverrides(source:PreliminarySource,overrides:ProductOverrides|undefined):PreliminarySource{
 if(!overrides)return source;
 const result:PreliminarySource={
  ...source,
  name:overrides.name?displayNewProductName(overrides.name,source.article):source.name,
  input:{...source.input,product:{...source.input.product,...(overrides.product||{})}},
 };
 if(typeof overrides.costGrossRub==="number")result.costGrossOverrideRub=overrides.costGrossRub;
 return result;
}
