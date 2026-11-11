import {createAdminClient} from '../supabase/admin';
import {rules,type Line,type ConfirmedReturn} from './finance';
import {financialReport,type Rate,type Listing,type OrderQuantity} from './finance-profit';
export async function readFinance(from:string,to:string,scheme?:'fbo'|'fbs'){
 const db=createAdminClient();
 let {data:report,error}=await db.from('yandex_finance_reports').select('id,date_from,date_to,status,line_count,completed_at,order_units_complete,error')
  .eq('status','ready').lte('date_from',from).gte('date_to',to).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error)throw error;
 const warningFromReady=report?.error??null;
 // When Yandex omits entire expense sheets, the raw new report cannot
 // represent preserved older confirmed rows for those sources. Prefer the
 // complete published day snapshots if they exist, retaining source lineage.
 if(report&&warningFromReady?.includes('ЯМ не включил листы услуг')){
  const expectedDays=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
  const history=await db.from('yandex_finance_daily_snapshots').select('snapshot_day')
   .gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day');
  if(history.error)throw history.error;
  if((history.data??[]).length===expectedDays&&history.data?.every((x,i)=>
   x.snapshot_day===new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10)))
   report=null;
 }
 const lines:Line[]=[],orders:OrderQuantity[]=[];
 if(report){
  for(let offset=0;offset<report.line_count;offset+=1000){
   const {data,error}=await db.from('yandex_finance_lines').select('payload').eq('report_id',report.id).order('line_index').range(offset,offset+999);
   if(error)throw error;lines.push(...(data??[]).map(x=>x.payload as Line));
  }
  if(lines.length!==report.line_count)throw new Error('Кэш финансов ЯМ неполный');
  if(report.order_units_complete)for(let offset=0;;offset+=1000){
   const {data,error}=await db.from('yandex_finance_order_quantities').select('order_id,item_id,article,name,order_date,quantity,status,in_transit_quantity,realization_total_cents')
   .eq('report_id',report.id).order('order_id').order('item_id').range(offset,offset+999);
   if(error)throw error;orders.push(...data as OrderQuantity[]);if(data.length<1000)break;
  }
 }else{
  const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
  if(days<1||days>366)return null;
  const {data:snapshots,error:snapshotError}=await db.from('yandex_finance_daily_snapshots')
   .select('snapshot_day,line_count,order_count,captured_at,source_report_id')
   .gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day');
  if(snapshotError)throw snapshotError;
  if((snapshots??[]).length!==days)return null;
  for(let i=0;i<days;i++){
   const day=new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10);
   const snapshot=snapshots![i];if(snapshot.snapshot_day!==day)return null;
   const lengthBefore=lines.length,ordersBefore=orders.length;
   for(let offset=0;offset<snapshot.line_count;offset+=1000){
    const {data,error}=await db.from('yandex_finance_daily_lines').select('payload,source_report_id')
     .eq('snapshot_day',day).order('line_index').range(offset,offset+999);
    if(error)throw error;lines.push(...(data??[]).map(x=>({
      ...x.payload,__carriedForward:x.source_report_id!==snapshot.source_report_id
     } as Line)));
   }
   if(lines.length-lengthBefore!==snapshot.line_count)throw Error('Неполные дневные строки ЯМ '+day);
   for(let offset=0;offset<snapshot.order_count;offset+=1000){
    const {data,error}=await db.from('yandex_finance_daily_orders')
    .select('order_id,item_id,article,name,quantity,status,in_transit_quantity,realization_total_cents')
    .eq('snapshot_day',day).order('order_id').order('item_id').range(offset,offset+999);
    if(error)throw error;orders.push(...(data??[]).map(x=>({...x,order_date:day} as OrderQuantity)));
   }
   if(orders.length-ordersBefore!==snapshot.order_count)throw Error('Неполные дневные заказы ЯМ '+day);
  }
  report={id:'daily-history',date_from:from,date_to:to,status:'ready',line_count:lines.length,completed_at:snapshots![snapshots!.length-1].captured_at,order_units_complete:true,error:warningFromReady};
 }
 if(!report)return null;
 if(scheme){
  const ids=[...new Set([...orders.map(o=>o.order_id),...lines.filter(l=>l.orderId).map(l=>l.orderId)])];
  const matching=new Set<string>();
  for(let i=0;i<ids.length;i+=150){
   const r=await db.from('yandex_order_items').select('order_id,warehouse_name').in('order_id',ids.slice(i,i+150));
   if(r.error)throw r.error;
   for(const x of r.data??[]){
    const kind=/яндекс.?маркет/i.test(x.warehouse_name??'')?'fbo':/продавц/i.test(x.warehouse_name??'')?'fbs':null;
    if(kind===scheme)matching.add(String(x.order_id));
   }
  }
  const selected=lines.filter(l=>l.orderId&&matching.has(l.orderId));lines.length=0;lines.push(...selected);
  const own=orders.filter(o=>matching.has(o.order_id));orders.length=0;orders.push(...own);
 }
 const rates:Rate[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db.from('yandex_finance_rates').select('master_code,valid_from,cost_cents,mayak_cents,version').order('master_code').order('valid_from').range(offset,offset+999);if(error)throw error;rates.push(...data as Rate[]);if(data.length<1000)break;}
 for(let offset=0;;offset+=1000){const {data,error}=await db.from('yandex_finance_article_rates').select('article,valid_from,cost_cents,mayak_cents,version').order('article').order('valid_from').range(offset,offset+999);if(error)throw error;rates.push(...data.map(r=>({...r,master_code:null})));if(data.length<1000)break;}
 const listings:Listing[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db.from('yandex_products').select('offer_id,master_code,raw_data').order('id').range(offset,offset+999);if(error)throw error;listings.push(...data.map(x=>({offer_id:x.offer_id,master_code:x.master_code,name:x.raw_data?.offer?.name??null})));if(data.length<1000)break;}
 const managers=await db.from('yandex_finance_managers').select('master_key,manager_name');if(managers.error)throw managers.error;const managerByKey=new Map(managers.data.map(x=>[x.master_key,x.manager_name]));

 // Only confirmed money refunds for returned merchandise. Each must match
 // an existing delivered order/article before the financial result changes.
 const refunds=await db.from('yandex_returns').select('return_id').eq('return_type','RETURN').eq('refund_status','REFUNDED');
 if(refunds.error)throw refunds.error;
 const verifiedReturns:ConfirmedReturn[]=[];
 const ids=(refunds.data??[]).map(x=>x.return_id);
 for(let start=0;start<ids.length;start+=150){
  const found=await db.from('yandex_return_items').select('return_id,order_id,shop_sku,quantity').in('return_id',ids.slice(start,start+150));
  if(found.error)throw found.error;
  for(const r of found.data??[])verifiedReturns.push({return_id:r.return_id,order_id:r.order_id,article:r.shop_sku,quantity:r.quantity});
 }
 const fulfillmentByOrder=new Map<string,'fby'|'fbs'|'unknown'>();
 const orderIds=[...new Set(orders.map(o=>o.order_id))];
 for(let i=0;i<orderIds.length;i+=150){
  const r=await db.from('yandex_order_items').select('order_id,warehouse_name').in('order_id',orderIds.slice(i,i+150));
  if(r.error)throw r.error;
  for(const item of r.data??[]){
   const wh=String(item.warehouse_name??''),mode=/яндекс.?маркет/i.test(wh)?'fby':/продавц/i.test(wh)?'fbs':'unknown';
   const old=fulfillmentByOrder.get(String(item.order_id));
   fulfillmentByOrder.set(String(item.order_id),old&&old!==mode?'unknown':mode);
  }
 }
 for(const o of orders)o.fulfillment=fulfillmentByOrder.get(o.order_id)??'unknown';
 const result=financialReport(lines,from,to,rates,listings,orders,report.order_units_complete,verifiedReturns);
 const daily=Array.from({length:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1},(_,index)=>{
  const day=new Date(Date.parse(from)+index*86400000).toISOString().slice(0,10);
  // Daily totals must use the same selected source rows as the whole-period calculation.
  // Order-linked service expenses can be billed on a later day. Reassign those
  // rows to the order day ONLY for the daily attribution, never in the source ledger.
  const dayLines=lines.filter(l=>{
    if(l.source==='income')return l.orderDate===day;
    if(l.serviceDate<from||l.serviceDate>to)return false;
    if(l.orderId&&(!l.orderDate||l.orderDate<from||l.orderDate>to))return false;
    return (l.orderId?l.orderDate:l.serviceDate)===day;
  }).map(l=>l.source==='expense'?{...l,serviceDate:day}:l);
  const item=financialReport(dayLines,day,day,rates,listings,orders,report.order_units_complete,verifiedReturns);
  // A full-day report includes common marketplace charges. If some SKUs lack
  // cost/transport, construct a separately labeled provisional structure
  // from only fully costed SKUs. Never attribute unknown costs to the MP.
  const included=item.rows.filter(r=>r.result!==null&&r.cogs!==null&&r.mayak!==null);
  const totals=(key:'income'|'result'|'cogs'|'mayak'|'advertising')=>
   included.reduce((sum,r)=>sum+Number(r[key]??0),0);
  const complete=item.totals.result!==null;
  const structureIncome=complete?item.totals.income:totals('income');
  const structureProfit=complete?Number(item.totals.result):totals('result');
  const structureInbound=complete?item.totals.cogs+item.totals.mayak:totals('cogs')+totals('mayak');
  const structureAd=complete?item.totals.advertising:totals('advertising');
  const hasKnownStructure=complete||included.length>0;
  const structure=hasKnownStructure?{
   income:structureIncome,profit:structureProfit,inbound:structureInbound,
   advertising:structureAd,marketplace:structureIncome-structureProfit-structureInbound-structureAd
  }:null;
  return {day,orders:item.totals.orders,buyouts:item.totals.buyouts,
   income:item.totals.income,result:item.totals.result,
   composition:structure,compositionPartial:!complete};
 });
 const dailyResult=daily.every(x=>x.result!==null)?daily.reduce((sum,x)=>sum+Number(x.result),0):null;
 const dailyReconciled=result.totals.result!==null&&dailyResult!==null&&dailyResult===result.totals.result;
 const [stockRun,ownStocks,products,statuses,vedOrders,vedItems]=await Promise.all([
  db.from('yandex_stock_sync_runs').select('id,snapshot_date').eq('status','success').order('created_at',{ascending:false}).limit(1).maybeSingle(),
  db.rpc('ozon_finance_stock_summary'),db.from('products').select('id,master_code').limit(10000),
  db.from('product_article_statuses').select('master_code,status').limit(10000),
  db.from('ved_orders').select('id,workflow_status,status').limit(10000),db.from('ved_order_items').select('product_id,ved_order_id,status,order_quantity,quantity').limit(10000)
 ]);
 const marketplaceStock=new Map<string,number>();let stockAvailable=false;
 if(stockRun.data&&!stockRun.error){for(let offset=0;;offset+=1000){const {data,error}=await db.from('yandex_stock_snapshots').select('offer_id,available').eq('sync_run_id',stockRun.data.id).order('id').range(offset,offset+999);if(error){marketplaceStock.clear();break;}for(const x of data??[])marketplaceStock.set(x.offer_id,(marketplaceStock.get(x.offer_id)??0)+Number(x.available??0));if(data.length<1000){stockAvailable=true;break;}}}
 const productCodes=new Map((products.data??[]).map(p=>[String(p.id),String(p.master_code??'')]));
 const ownByMaster=new Map<string,{main:number|null;ox:number|null}>();
 if(!ownStocks.error&&!products.error)for(const s of ownStocks.data??[]){const code=productCodes.get(String(s.product_id));if(!code)continue;const prev=ownByMaster.get(code);const max=(a:number|null,b:unknown)=>b==null?a:a==null?Number(b):Math.max(a,Number(b));ownByMaster.set(code,{main:max(prev?.main??null,s.main_stock),ox:max(prev?.ox??null,s.ox_stock)});}
 const statusByMaster=new Map((statuses.data??[]).map(x=>[x.master_code,x.status]));
 const vedStates=new Map((vedOrders.data??[]).map(x=>[x.id,x.workflow_status||x.status||'draft']));
 const chinaByMaster=new Map<string,number>();const chinaReady=!products.error&&!vedOrders.error&&!vedItems.error&&[...vedStates.values()].some(v=>['in_transit','dispatched','shipping','on_the_way'].includes(v));
 if(chinaReady)for(const x of vedItems.data??[]){if(!['in_transit','dispatched','shipping','on_the_way'].includes(vedStates.get(x.ved_order_id)??'')||['cancelled','received','rejected'].includes(x.status))continue;const code=productCodes.get(String(x.product_id));if(code)chinaByMaster.set(code,(chinaByMaster.get(code)??0)+Number(x.order_quantity??x.quantity??0));}
 const rows=result.rows.map(p=>{const own=p.master_code?ownByMaster.get(p.master_code):null;const manager=managerByKey.get(p.master_code??'article:'+p.article);return {...p,manager:manager??'Не назначен',dataGaps:manager?p.dataGaps:[...p.dataGaps,'Нет КМ'],marketplaceStock:stockAvailable?marketplaceStock.get(p.article)??0:null,mainStock:own?.main??null,oxStock:own?.ox??null,inChina:chinaReady&&p.master_code?chinaByMaster.get(p.master_code)??0:null,inCrossdock:null as number|null,discontinued:!!(p.master_code&&/выведен|выводится/i.test(statusByMaster.get(p.master_code)??''))};});
 // Per-source coverage audit. A sheet omitted by Yandex is UNKNOWN,
 // not an implicit zero-cost service; every source and income is visible.
 const audit=new Map<string,{rows:number;amount:number;preserved:boolean}>();
 for(const line of lines){
  const day=line.source==='income'?line.orderDate:line.serviceDate;
  if(day<from||day>to)continue;
  const source=line.source==='income'?'Транзакции по заказам и товарам':line.sheet;
  const old=audit.get(source)??{rows:0,amount:0,preserved:false};
  const carried=Boolean((line as Line&{__carriedForward?:boolean}).__carriedForward);
  audit.set(source,{rows:old.rows+1,amount:old.amount+line.amount,preserved:old.preserved||carried});
 }
 const expectedSources=['Транзакции по заказам и товарам',...rules.map(([name])=>name),'Реклама на Маркете'];
 const sourceAudit=expectedSources.map(name=>({
  name,kind:name==='Транзакции по заказам и товарам'?'income':'expense',
  rows:audit.get(name)?.rows??0,amount:audit.get(name)?.amount??null,
  status:!audit.has(name)?'not_provided':audit.get(name)?.preserved?'preserved':'present'
 }));
 return {...result,rows,report,daily,dailyReconciled,sourceAudit,
  scheme:scheme??null,stockDate:stockAvailable?stockRun.data?.snapshot_date??null:null};
}
