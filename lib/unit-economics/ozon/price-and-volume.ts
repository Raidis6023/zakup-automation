/** Формулы СПП и цены покупателя Ozon. Литраж реализован общим модулем. */
export {calculateIndividualPackageVolume as calculateOzonVolume} from "../individual-package-volume";
export type {
 PackageDimensions as OzonPackageDimensions,
 CartonVolume as OzonCartonVolume,
 IndividualVolumeInput as OzonVolumeInput,
 VolumeSource as OzonVolumeSource,
 VolumeCandidate as OzonVolumeCandidate,
 VolumeAudit as OzonVolumeAudit
} from "../individual-package-volume";
const check=(value:number,label:string)=>{
 if(!Number.isFinite(value)||value<0)throw new Error("Недопустимое значение "+label);
 return value;
};
export type OzonSppInput=Readonly<{priceGross:number;additionalDiscountRate?:number}>;
export type OzonSppResult=Readonly<{
 sppRate:number;
 additionalDiscountRate:number;
 priceGross:number;
 priceAfterSpp:number;
 formula:string;
}>;
export function calculateOzonSppPrice(input:OzonSppInput):OzonSppResult{
 const price=check(input.priceGross,"Цена продажи");
 if(price<=0)throw new Error("Цена продажи должна быть больше нуля");
 const additional=input.additionalDiscountRate??0;
 check(additional,"Дополнительная скидка");
 if(additional>1)throw new Error("Дополнительная скидка должна быть в долях от 0 до 1");
 const spp=price<=100?.18:price<=300?.25:price<=1000?.42:.46;
 const customerPrice=price*(1-spp)*(1-additional);
 return {sppRate:spp,additionalDiscountRate:additional,priceGross:price,priceAfterSpp:customerPrice,
  formula:`${price} × (1 − ${spp}) × (1 − ${additional}) = ${customerPrice} ₽`};
}
