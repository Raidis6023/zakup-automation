/** Presentation only: never use Performance spending for Seller P&L. */
export type DisplayKind='seller'|'performance_partial'|'unknown'|'confirmed_zero';
export function advertisingDisplay(
 sellerAccrual:number|null,
 skuPerformance:number|null,
 complete:boolean
):{amount:number|null;kind:DisplayKind}{
 const seller=sellerAccrual==null||!Number.isFinite(sellerAccrual)?null:sellerAccrual;
 const performance=skuPerformance==null||!Number.isFinite(skuPerformance)?null:Math.abs(skuPerformance);
 // Financial entries are authoritative when they exist.
 if(seller!==null&&Math.abs(seller)>=0.005)
  return {amount:seller,kind:'seller'};
 // The performance report is useful evidence that advertising was nonzero,
 // but may cover only a subset of SKUs/dates and must be labeled accordingly.
 if(performance!==null&&performance>=0.005)
  return {amount:-performance,kind:'performance_partial'};
 if(!complete)return {amount:null,kind:'unknown'};
 return {amount:seller??0,kind:'confirmed_zero'};
}
