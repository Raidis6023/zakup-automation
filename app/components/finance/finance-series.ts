export type FinanceMetric='orders'|'buyouts'|'revenue'|'profit';
export type Values=Record<FinanceMetric|'marketplace'|'advertising'|'inbound',number|null>;
export type Report={rows:Array<Record<string,unknown>>;totals?:Record<string,number|null>;unallocated_amount?:number;ads_covered?:boolean;advertising?:{finance_total:number;partial_performance_total?:number|null};missing_days?:string[]};
export type FinancePoint={day:string;v:Values;composition?:Values;provisional?:boolean;adUnconfirmed?:boolean};
export function amounts(d:Report,market:string,offer?:string,offers?:string[]):Values{const rows=d.rows.filter(r=>offer?(r.article??r.offer_id)===offer:offers?offers.includes(String(r.article??r.offer_id)):true),ym=market==='yandex',whole=!offer&&!offers;
 const sum=(key:string)=>rows.some(r=>r[key]==null)?null:rows.reduce((s,r)=>s+Number(r[key]),0)/(ym?100:1),qty=(key:string)=>rows.some(r=>r[key]==null)?null:rows.reduce((s,r)=>s+Number(r[key]),0);
 const revenue=sum(ym?'income':'revenue'),cogs=sum('cogs'),mayak=sum(ym?'mayak':'mayak_expense');let profit=sum(ym?'result':'estimated_result');
 if(whole)profit=ym?d.totals?.result==null?null:d.totals.result/100:profit===null?null:profit+Number(d.unallocated_amount??0);
 const ledgerAd=sum('advertising_amount');
 let advertising=ym?sum('advertising'):whole?d.advertising?.finance_total==null?null:-d.advertising.finance_total:ledgerAd===null?null:-ledgerAd;
 // This composition describes actual Seller ledger charges, not the
 // independent Performance campaign spend. A booked zero is valid here when
 // the Seller ledger day is loaded; its campaign completeness is flagged
 // separately and must never be presented as "no advertising campaigns".
 const packingKey=ym?'packing':'packing_expense';
 // Legacy reports had no packing field at all. Keep their established chart
 // semantics, but do not turn an explicitly missing new packing rate into zero.
 const pack=rows.some(r=>Object.prototype.hasOwnProperty.call(r,packingKey))?sum(packingKey):0;
 const inbound=cogs===null||mayak===null||pack===null?null:cogs+mayak+pack;
 const marketplace=revenue===null||profit===null||inbound===null||advertising===null?null:revenue-profit-inbound-advertising;
 return {orders:qty(ym?'orders':'order_count'),buyouts:qty(ym?'buyouts':'buyout_units'),revenue,profit,advertising,inbound,marketplace};}

export function percentageComposition(v:Values):Record<string,number|null>{
 const keys=['marketplace','inbound','advertising','profit'] as const;
 if(keys.some(k=>v[k]===null))return Object.fromEntries(keys.map(k=>[k,null]));
 const normalized:Record<(typeof keys)[number],number>={
  marketplace:Math.abs(v.marketplace!),
  inbound:Math.abs(v.inbound!),
  advertising:Math.abs(v.advertising!),
  profit:Math.max(0,v.profit!),
 };
 const total=keys.reduce((sum,k)=>sum+normalized[k],0);
 return Object.fromEntries(keys.map(k=>[k,total>0?normalized[k]/total*100:null]));
}
/** A partial structure is calculated only over rows with known COGS,
 * Mayak and Seller profit. Other rows are excluded, never silently assigned
 * zero costs or included in the marketplace residual. */
export function compositionAmounts(d:Report,market:string,offer?:string,offers?:string[]):{v:Values;provisional:boolean;adUnconfirmed:boolean}{
 const all=amounts(d,market,offer,offers);
 if(market!=='ozon')return {v:all,provisional:false,adUnconfirmed:false};
 const chosen=d.rows.filter(r=>offer?(r.article??r.offer_id)===offer:offers?offers.includes(String(r.article??r.offer_id)):true);
 // The graph presents spend by campaign day when it is available, even
 // if Seller booked the PPC accrual in another accounting period. Keep P&L
 // Seller-only; this figure is reference data and the residual provisional.
 const stats=(d.advertising as {partial_performance_total?:number|null}|undefined)?.partial_performance_total;
 const campaignSpend=stats!=null&&Number.isFinite(Number(stats))&&Number(stats)>0?Number(stats):null;
 const withCampaign=(v:Values):Values=>campaignSpend===null?v:{
  ...v,advertising:campaignSpend,
  marketplace:v.revenue===null||v.profit===null||v.inbound===null?null:v.revenue-v.profit-v.inbound-campaignSpend
 };
 const adUnconfirmed=d.ads_covered!==true||
   (campaignSpend!==null&&Math.abs(d.advertising?.finance_total??0)<0.005);
 const incomplete=chosen.some(r=>r.estimated_result==null||r.cogs==null||r.mayak_expense==null||r.revenue==null);
 if(!incomplete)return {v:withCampaign(all),provisional:adUnconfirmed||campaignSpend!==null,adUnconfirmed};
 const known=chosen.filter(r=>r.estimated_result!=null&&r.cogs!=null&&r.mayak_expense!=null&&r.revenue!=null);
 if(!known.length)return {v:all,provisional:true,adUnconfirmed};
 const total=(field:string)=>known.reduce((sum,r)=>sum+Number(r[field]??0),0);
 const revenue=total('revenue'),profit=total('estimated_result');
 const inbound=total('cogs')+total('mayak_expense')+total('packing_expense'),advertising=-total('advertising_amount');
 return {v:withCampaign({...all,revenue,profit,inbound,advertising,
  marketplace:revenue-profit-inbound-advertising}),provisional:true,adUnconfirmed};
}
export function dailyChanges(reports:Array<{day:string;report:Report}>,market:string,offer?:string,offers?:string[]):FinancePoint[]{
 return reports.map(({day,report})=>{
  const cur=amounts(report,market,offer,offers);
  const comp=compositionAmounts(report,market,offer,offers);
  const invalid=Boolean(report.missing_days?.length);
  const mask=(values:Values)=>Object.fromEntries(Object.keys(values).map(k=>{
   const key=k as keyof Values;return [key,invalid?null:values[key]];
  })) as Values;
  return {day,v:mask(cur),composition:mask(comp.v),
   provisional:comp.provisional||invalid,adUnconfirmed:comp.adUnconfirmed};
 });
}

