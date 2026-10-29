export type FinanceMetric='orders'|'buyouts'|'revenue'|'profit';
export type Values=Record<FinanceMetric|'marketplace'|'advertising'|'inbound',number|null>;
export type Report={rows:Array<Record<string,unknown>>;totals?:Record<string,number|null>;unallocated_amount?:number;advertising?:{finance_total:number};missing_days?:string[]};
export type FinancePoint={day:string;v:Values};
export function amounts(d:Report,market:string,offer?:string,offers?:string[]):Values{const rows=d.rows.filter(r=>offer?(r.article??r.offer_id)===offer:offers?offers.includes(String(r.article??r.offer_id)):true),ym=market==='yandex',whole=!offer&&!offers;
 const sum=(key:string)=>rows.some(r=>r[key]==null)?null:rows.reduce((s,r)=>s+Number(r[key]),0)/(ym?100:1),qty=(key:string)=>rows.some(r=>r[key]==null)?null:rows.reduce((s,r)=>s+Number(r[key]),0);
 const revenue=sum(ym?'income':'revenue'),cogs=sum('cogs'),mayak=sum(ym?'mayak':'mayak_expense');let profit=sum(ym?'result':'estimated_result');
 if(whole)profit=ym?d.totals?.result==null?null:d.totals.result/100:profit===null?null:profit+Number(d.unallocated_amount??0);
 const ledgerAd=sum('advertising_amount');const advertising=ym?sum('advertising'):whole?d.advertising?.finance_total==null?null:-d.advertising.finance_total:ledgerAd===null?null:-ledgerAd;
 const inbound=cogs===null||mayak===null?null:cogs+mayak;
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
export function dailyChanges(reports:Array<{day:string;report:Report}>,market:string,offer?:string,offers?:string[]):FinancePoint[]{
 return reports.map(({day,report})=>{
  const cur=amounts(report,market,offer,offers);
  const v=Object.fromEntries(Object.keys(cur).map(k=>{
   const key=k as keyof Values;
   return [key,report.missing_days?.length||cur[key]===null?null:cur[key]];
  })) as Values;
  return {day,v};
 });
}
