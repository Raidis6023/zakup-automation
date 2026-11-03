/**
 * Финансовые итоги Ozon FBO/FBS.
 * Все суммы в рублях, без промежуточного округления.
 * Google Sheets и интерфейс не используются.
 */
export type OzonFinalExpenseGroup="commission"|"logistics"|"advertising"|"other";
export type OzonFinalExpense=Readonly<{
  code:string;
  label:string;
  group:OzonFinalExpenseGroup;
  amount:number;
}>;
export type OzonFinalInput=Readonly<{
  model:"FBO"|"FBS";
  sellingPriceGross:number;
  costGross:number;
  outputVat:number;
  inputVatTotal:number;
  purchaseInputVat:number;
  expenses:readonly OzonFinalExpense[];
}>;
export type OzonFinalResult=Readonly<{
  model:"FBO"|"FBS";
  netRevenue:number;
  costNetOfPurchaseVat:number;
  vatPayable:number;
  commissions:number;
  logistics:number;
  advertising:number;
  otherExpenses:number;
  otherExpensesAndTaxes:number;
  totalExpensesBeforeVat:number;
  profit:number;
  marginPercent:number|null;
  roiPercent:number|null;
  warnings:readonly string[];
}>;
const amount=(v:number,name:string)=>{
  if(!Number.isFinite(v)||v<0)throw new Error("Недопустимое значение: "+name);
  return v;
};
export function calculateOzonFinalResults(input:OzonFinalInput):OzonFinalResult{
  if(input.model!=="FBO"&&input.model!=="FBS")throw new Error("Неизвестная схема Ozon");
  const price=amount(input.sellingPriceGross,"Цена продажи");
  const cost=amount(input.costGross,"Себестоимость с НДС");
  const outputVat=amount(input.outputVat,"Исходящий НДС");
  const inputVat=amount(input.inputVatTotal,"Входящий НДС");
  const purchaseVat=amount(input.purchaseInputVat,"НДС закупки");
  if(outputVat>price)throw new Error("Исходящий НДС превышает цену");
  if(purchaseVat>cost||purchaseVat>inputVat)throw new Error("Некорректный вычет НДС закупки");
  if(!Array.isArray(input.expenses))throw new Error("Не переданы статьи расходов");
  const byGroup:Record<OzonFinalExpenseGroup,number>={commission:0,logistics:0,advertising:0,other:0};
  const codes=new Set<string>();
  for(const expense of input.expenses){
    if(!expense||typeof expense.code!=="string"||!expense.code.trim())throw new Error("Нет кода статьи расходов");
    if(codes.has(expense.code))throw new Error("Статья включена повторно: "+expense.code);
    codes.add(expense.code);
    if(!Object.prototype.hasOwnProperty.call(byGroup,expense.group))throw new Error("Неизвестная группа расходов: "+expense.group);
    byGroup[expense.group]+=amount(expense.amount,expense.code);
  }
  const vatPayable=outputVat-inputVat;
  const netRevenue=price-outputVat;
  const netCost=Math.max(0,cost-purchaseVat);
  const expensesTotal=byGroup.commission+byGroup.logistics+byGroup.advertising+byGroup.other;
  const profit=price-cost-expensesTotal-vatPayable;
  const warnings:string[]=[];
  if(netRevenue<=0)warnings.push("Нельзя вычислить маржинальность: нулевая база");
  if(netCost<=0)warnings.push("Нельзя вычислить ROI: нулевая база");
  return{
    model:input.model,
    netRevenue,
    costNetOfPurchaseVat:netCost,
    vatPayable,
    commissions:byGroup.commission,
    logistics:byGroup.logistics,
    advertising:byGroup.advertising,
    otherExpenses:byGroup.other,
    otherExpensesAndTaxes:byGroup.other+vatPayable,
    totalExpensesBeforeVat:expensesTotal,
    profit,
    marginPercent:netRevenue>0?100*profit/netRevenue:null,
    roiPercent:netCost>0?100*profit/netCost:null,
    warnings
  };
}
