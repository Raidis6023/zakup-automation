/**
 * Самостоятельный расчёт финальных значений всех маркетплейсов (Ozon, WB, Яндекс Маркет).
 * Для всех МП применяется единая база ROI: себестоимость за вычетом НДС закупки.
 * Суммы в рублях; промежуточного округления нет.
 */
export type UnitFinalModel="ozon-fbo"|"ozon-fbs"|"wb-fbw"|"wb-fbs"|"ym-fby"|"ym-fbs";
export type UnitExpenseGroup="commission"|"logistics"|"advertising"|"other";
export type UnitExpense=Readonly<{code:string;name:string;group:UnitExpenseGroup;amount:number}>;
export type UnitFinancialInput=Readonly<{
 model:UnitFinalModel;
 sellingPriceGross:number;
 costGross:number;
 outputVat:number;
 inputVatTotal:number;
 purchaseInputVat:number;
 expenses:readonly UnitExpense[];
}>;
export type UnitFinancialOutput=Readonly<{
 model:UnitFinalModel;
 priceGross:number;
 revenueNetVat:number;
 costGross:number;
 costNetVat:number;
 outputVat:number;
 inputVatTotal:number;
 purchaseInputVat:number;
 vatPayable:number;
 expenseItems:readonly UnitExpense[];
 expenseTotals:Readonly<Record<UnitExpenseGroup,number>>;
 totalExpenses:number;
 otherExpensesAndTaxes:number;
 netProfit:number;
 marginRatio:number|null;
 roiRatio:number|null;
 warnings:readonly string[];
}>;
const finiteNonnegative=(value:number,label:string)=>{
 if(!Number.isFinite(value)||value<0)throw new Error("Недопустимое значение: "+label);
 return value;
};
const allowedModels:ReadonlySet<string>=new Set(["ozon-fbo","ozon-fbs","wb-fbw","wb-fbs","ym-fby","ym-fbs"]);
export function calculateUnitFinancials(input:UnitFinancialInput):UnitFinancialOutput{
 if(!allowedModels.has(input.model))throw new Error("Неизвестная модель расчёта");
 const price=finiteNonnegative(input.sellingPriceGross,"Цена продажи");
 const cost=finiteNonnegative(input.costGross,"Себестоимость с НДС");
 const outVat=finiteNonnegative(input.outputVat,"Исходящий НДС");
 const inVat=finiteNonnegative(input.inputVatTotal,"Входящий НДС");
 const purchaseVat=finiteNonnegative(input.purchaseInputVat,"Входящий НДС закупки");
 if(outVat>price)throw new Error("Исходящий НДС выше цены продажи");
 if(purchaseVat>cost||purchaseVat>inVat)throw new Error("Вычет НДС закупки выше себестоимости или общего входящего НДС");
 if(!Array.isArray(input.expenses))throw new Error("Не переданы статьи расходов");
 const expenseTotals:Record<UnitExpenseGroup,number>={commission:0,logistics:0,advertising:0,other:0};
 const known=new Set<string>();
 for(const expense of input.expenses){
  if(!expense||typeof expense.code!=="string"||!expense.code.trim())throw new Error("У статьи расходов отсутствует код");
  if(known.has(expense.code))throw new Error("Повторно включён расход: "+expense.code);
  known.add(expense.code);
  if(!Object.prototype.hasOwnProperty.call(expenseTotals,expense.group))throw new Error("Неизвестная группа расходов: "+expense.group);
  expenseTotals[expense.group]+=finiteNonnegative(expense.amount,expense.code);
 }
 const totalExpenses=expenseTotals.commission+expenseTotals.logistics+expenseTotals.advertising+expenseTotals.other;
 const vatPayable=outVat-inVat;
 const revenueNetVat=price-outVat;
 const costNetVat=Math.max(0,cost-purchaseVat);
 const netProfit=price-cost-totalExpenses-vatPayable;
 const warnings:string[]=[];
 if(revenueNetVat<=0)warnings.push("Маржинальность не определена: выручка без НДС равна нулю");
 if(costNetVat<=0)warnings.push("ROI не определён: себестоимость без НДС равна нулю");
 return{
  model:input.model,priceGross:price,revenueNetVat,costGross:cost,costNetVat,
  outputVat:outVat,inputVatTotal:inVat,purchaseInputVat:purchaseVat,vatPayable,
  expenseItems:input.expenses.slice(),expenseTotals,totalExpenses,
  otherExpensesAndTaxes:expenseTotals.other+vatPayable,netProfit,
  marginRatio:revenueNetVat>0?netProfit/revenueNetVat:null,
  roiRatio:costNetVat>0?netProfit/costNetVat:null,warnings
 };
}

/**
 * Формат для сводки: стандартное округление до целого.
 * Если округление дало 0, увеличиваем число дробных знаков,
 * пока ненулевая величина не станет видимой.
 * Для денег и процентов суффикс указывает вызывающий код.
 */
export function formatUnitNumber(value:number,suffix=""):string{
 if(!Number.isFinite(value))throw new Error("Нельзя отобразить нечисловое значение");
 if(value===0)return "0"+(suffix?" "+suffix:"");
 const magnitude=Math.abs(value);
 for(let digits=0;digits<=15;digits++){
  const scale=10**digits;
  // Math.round на положительном модуле обеспечивает half-away-from-zero.
  const rounded=Math.round((magnitude+Number.EPSILON*magnitude)*scale)/scale;
  if(rounded!==0){
   const valueText=new Intl.NumberFormat("ru-RU",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(rounded);
   return (value<0?"−":"")+valueText+(suffix?" "+suffix:"");
  }
 }
 const textValue=magnitude.toExponential(8);
 return (value<0?"−":"")+textValue+(suffix?" "+suffix:"");
}
export function formatUnitPercent(ratio:number):string{return formatUnitNumber(ratio*100,"%")}
