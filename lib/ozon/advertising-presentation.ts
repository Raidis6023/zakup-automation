/** Presentation only: never use Performance spending for Seller P&L. */
export type DisplayKind='seller'|'performance_partial'|'performance_complete'|'unknown'|'confirmed_zero';
export function advertisingDisplay(
 sellerAccrual:number|null,
 skuPerformance:number|null,
 complete:boolean
):{amount:number|null;kind:DisplayKind}{
 const seller=sellerAccrual==null||!Number.isFinite(sellerAccrual)?null:sellerAccrual;
 const performance=skuPerformance==null||!Number.isFinite(skuPerformance)?null:Math.abs(skuPerformance);
 // The campaign KPI is spending by campaign day, not the accounting
 // posting date. Prefer confirmed Performance statistics, never the Seller
 // ledger sum for this card. Seller remains the P&L source separately.
 if(performance!==null&&performance>=0.005)
  return {amount:-performance,kind:complete?'performance_complete':'performance_partial'};
 // Once every campaign/day is covered, absence of spend is a *known* zero.
 if(complete)return {amount:0,kind:'confirmed_zero'};
 // Seller postings only provide an explicitly provisional fallback.
 if(seller!==null&&Math.abs(seller)>=0.005)
  return {amount:seller,kind:'seller'};
 return {amount:null,kind:'unknown'};
}
