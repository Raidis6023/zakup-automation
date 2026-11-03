/** Единый алгоритм литража ИУ для Ozon, Wildberries и Яндекс Маркета. */
export type PackageDimensions=Readonly<{length:number;width:number;height:number;unit:"cm"|"mm"}>;
export type CartonVolume=Readonly<{volume:number;unit:"l"|"m3";unitsPerCarton:number}>;
export type IndividualVolumeInput=Readonly<{
 individualDimensions?:PackageDimensions|null;
 individualVolumeLiters?:number|null;
 carton?:CartonVolume|null;
}>;
export type VolumeSource="dimensions"|"individual-liters"|"transport-carton";
export type VolumeCandidate=Readonly<{source:VolumeSource;liters:number;formula:string}>;
export type VolumeAudit=Readonly<{
 liters:number|null;
 roundedTariffLiters:number|null;
 source:VolumeSource|null;
 formula:string|null;
 candidates:readonly VolumeCandidate[];
 comparisons:readonly Readonly<{otherSource:VolumeSource;differenceLiters:number;differencePercent:number}>[];
 warnings:readonly string[];
}>;
const check=(value:number,label:string)=>{
 if(!Number.isFinite(value)||value<0)throw new Error("Недопустимое значение "+label);
 return value;
};
const positive=(value:number|undefined|null)=>typeof value==="number"&&Number.isFinite(value)&&value>0;
export function calculateIndividualPackageVolume(input:IndividualVolumeInput):VolumeAudit{
 const warnings:string[]=[];
 const candidates:VolumeCandidate[]=[];
 const dims=input.individualDimensions;
 if(dims){
  if(dims.unit!=="cm"&&dims.unit!=="mm")throw new Error("Единица габаритов ИУ должна быть cm или mm");
  const parts=[check(dims.length,"Длина ИУ"),check(dims.width,"Ширина ИУ"),check(dims.height,"Высота ИУ")];
  if(parts.every(x=>x>0)){
   const divisor=dims.unit==="cm"?1000:1000000;
   const liters=parts[0]*parts[1]*parts[2]/divisor;
   if(!Number.isFinite(liters))throw new Error("Переполнение объёма ИУ");
   candidates.push({source:"dimensions",liters,formula:`${parts[0]} × ${parts[1]} × ${parts[2]} / ${divisor} = ${liters} л`});
  }else if(parts.some(x=>x>0))warnings.push("Не все габариты ИУ заполнены: пропущен расчёт по размерам");
 }
 const individual=input.individualVolumeLiters;
 if(individual!==undefined&&individual!==null){
  check(individual,"Литраж ИУ");
  if(positive(individual))candidates.push({source:"individual-liters",liters:individual,formula:`Готовый литраж индивидуальной упаковки: ${individual} л`});
 }
 const box=input.carton;
 if(box){
  if(box.unit!=="m3"&&box.unit!=="l")throw new Error("Единица объёма транспортировочной коробки должна быть l или m3");
  check(box.volume,"Объём транспортировочной коробки");
  check(box.unitsPerCarton,"Вложимость транспортировочной коробки");
  if(positive(box.volume)&&positive(box.unitsPerCarton)){
   const multiplier=box.unit==="m3"?1000:1;
   const liters=box.volume*multiplier/box.unitsPerCarton;
   if(!Number.isFinite(liters))throw new Error("Переполнение литража коробки");
   candidates.push({source:"transport-carton",liters,formula:`(${box.volume} ${box.unit} × ${multiplier}) / ${box.unitsPerCarton} шт. = ${liters} л/шт.`});
  }else if(positive(box.volume)&&!positive(box.unitsPerCarton))warnings.push("Нельзя получить литраж из коробки без положительной вложимости");
 }
 const order:VolumeSource[]=["dimensions","individual-liters","transport-carton"];
 const preferred=order.map(s=>candidates.find(c=>c.source===s)).find(Boolean);
 if(!preferred){
  warnings.push("Литраж ИУ не определён: нет полных габаритов, готового литража и данных о коробке");
  return {liters:null,roundedTariffLiters:null,source:null,formula:null,candidates,comparisons:[],warnings};
 }
 const comparisons=candidates.filter(c=>c.source!==preferred.source).map(c=>({
  otherSource:c.source,
  differenceLiters:c.liters-preferred.liters,
  differencePercent:preferred.liters>0?(c.liters/preferred.liters-1)*100:0
 }));
 return {liters:preferred.liters,roundedTariffLiters:Math.ceil(preferred.liters),source:preferred.source,formula:preferred.formula,candidates,comparisons,warnings};
}

