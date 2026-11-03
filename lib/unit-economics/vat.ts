/** Единый расчёт НДС по реальным ставкам и долям допустимых вычетов.
 * В прогнозе ставки/доли передаются извне, здесь нет хардкода налоговых
 * льгот для конкретного маркетплейса.
 */
export type VatExpense=Readonly<{code:string;amountGross:number;vatRate:number;deductibleShare:number}>;
export type VatInput=Readonly<{
 sellingPriceGross:number; salesVatRate:number; purchaseInputVat:number;
 expenses:readonly VatExpense[];
 noDeductions?:boolean;
}>;
export type VatResult=Readonly<{
 outputVat:number;purchaseInputVat:number;serviceInputVat:number;
 inputVatTotal:number;vatPayable:number;
 byExpense:readonly Readonly<{code:string;deductibleVat:number}>[];
}>;
function validate(v:number,label:string,min=0,max=Infinity){
 if(!Number.isFinite(v)||v<min||v>max)throw Error("Некорректный параметр НДС "+label+": "+v);
 return v;
}
export function calculateUnitVat(input:VatInput):VatResult{
 const price=validate(input.sellingPriceGross,"Цена продажи");
 const rate=validate(input.salesVatRate,"Ставка НДС реализации",0,1);
 const purchaseVat=validate(input.purchaseInputVat,"Вычет НДС закупки");
 const noDeductions=input.noDeductions===true||Math.abs(rate-.05)<1e-9||Math.abs(rate-.07)<1e-9;
 if(!Array.isArray(input.expenses))throw Error("НДС: расходы не переданы");
 const codes=new Set<string>();
 const byExpense=input.expenses.map(e=>{
  if(!e.code?.trim()||codes.has(e.code))throw Error("НДС: пустой или повторный код расхода: "+e.code);
  codes.add(e.code);
  const gross=validate(e.amountGross,e.code);
  const vatRate=validate(e.vatRate,"Ставка НДС "+e.code,0,1);
  const share=validate(e.deductibleShare,"Доля вычета "+e.code,0,1);
  return {code:e.code,deductibleVat:noDeductions?0:gross*vatRate/(1+vatRate)*share};
 });
 const outputVat=price*rate/(1+rate);
 const serviceInputVat=byExpense.reduce((a,e)=>a+e.deductibleVat,0);
 const purchaseInputVat=noDeductions?0:purchaseVat;
 const inputVatTotal=purchaseInputVat+serviceInputVat;
 return {outputVat,purchaseInputVat,serviceInputVat,inputVatTotal,
  vatPayable:outputVat-inputVatTotal,byExpense};
}
