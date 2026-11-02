import {createAdminClient} from '../supabase/admin';
import type {Line} from './finance';
import {financialReport,type Rate,type Listing,type OrderQuantity} from './finance-profit';
export async function readFinance(from:string,to:string){
 const db=createAdminClient();
 let {data:report,error}=await db.from('yandex_finance_reports').select('id,date_from,date_to,status,line_count,completed_at,order_units_complete')
  .eq('status','ready').lte('date_from',from).gte('date_to',to).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error)throw error;
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
  if(days<1||days>91)return null;
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
    const {data,error}=await db.from('yandex_finance_daily_lines').select('payload')
     .eq('snapshot_day',day).order('line_index').range(offset,offset+999);
    if(error)throw error;lines.push(...(data??[]).map(x=>x.payload as Line));
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
  report={id:'daily-history',date_from:from,date_to:to,status:'ready',line_count:lines.length,completed_at:snapshots![snapshots!.length-1].captured_at,order_units_complete:true};
 }
 if(!report)return null;
 const rates:Rate[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db.from('yandex_finance_rates').select('master_code,valid_from,cost_cents,mayak_cents,version').order('master_code').order('valid_from').range(offset,offset+999);if(error)throw error;rates.push(...data as Rate[]);if(data.length<1000)break;}
 for(let offset=0;;offset+=1000){const {data,error}=await db.from('yandex_finance_article_rates').select('article,valid_from,cost_cents,mayak_cents,version').order('article').order('valid_from').range(offset,offset+999);if(error)throw error;rates.push(...data.map(r=>({...r,master_code:null})));if(data.length<1000)break;}
 const listings:Listing[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db.from('yandex_products').select('offer_id,master_code,raw_data').order('id').range(offset,offset+999);if(error)throw error;listings.push(...data.map(x=>({offer_id:x.offer_id,master_code:x.master_code,name:x.raw_data?.offer?.name??null})));if(data.length<1000)break;}
 const managers=await db.from('yandex_finance_managers').select('master_key,manager_name');if(managers.error)throw managers.error;const managerByKey=new Map(managers.data.map(x=>[x.master_key,x.manager_name]));
 const result=financialReport(lines,from,to,rates,listings,orders,report.order_units_complete);
 const daily=Array.from({length:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1},(_,index)=>{
  const day=new Date(Date.parse(from)+index*86400000).toISOString().slice(0,10);
  const item=financialReport(lines,day,day,rates,listings,orders,report.order_units_complete);
  return {day,orders:item.totals.orders,buyouts:item.totals.buyouts,income:item.totals.income,result:item.totals.result};
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
 return {...result,rows,report,daily,dailyReconciled,stockDate:stockAvailable?stockRun.data?.snapshot_date??null:null};
}
