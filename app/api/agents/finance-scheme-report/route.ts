import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {validDate} from '../../../../lib/yandex/finance';
import {readFinance} from '../../../../lib/yandex/finance-cache';
import {GET as wbFinance} from '../wb-finance/route';
import {readOzonFbsOrders} from '../../../../lib/ozon/finance-fbs-orders';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
type Detail={name:string;category:string;count:number|null;amount:number};
type Row={article:string;name:string;master_code:string|null;manager:string;orders:number|null;cancelled:number|null;buyouts:number|null;revenue:number|null;charges:number|null;cogs:number|null;mayak:number|null;advertising:number|null;storage:number|null;packing:number|null;shipped_units?:number|null;details?:Detail[];profit:number|null;note:string};
const num=(x:unknown)=>{const v=Number(x??0);return Number.isFinite(v)?v:0;};
const cents=(x:unknown)=>x==null?null:num(x)/100;
async function pages<T>(load:(start:number,end:number)=>Promise<{data:T[]|null;error:unknown}>):Promise<T[]>{
 const all:T[]=[];for(let start=0;;start+=1000){const r=await load(start,start+999);if(r.error)throw r.error;all.push(...r.data??[]);if((r.data?.length??0)<1000)break;}return all;
}
export async function GET(req:NextRequest){try{
 await financeAccess();
 const q=req.nextUrl.searchParams,market=q.get('market')??'',scheme=q.get('scheme')??'',from=q.get('from')??'',to=q.get('to')??'';
 if(!['ozon','yandex','wb'].includes(market)||!['fbo','fbs','fbw'].includes(scheme)||!validDate(from)||!validDate(to)||from>to||Date.parse(to)-Date.parse(from)>90*86400000||scheme==='fbw'&&market!=='wb'||scheme==='fbo'&&market==='wb')
  return NextResponse.json({error:'Проверьте МП, схему и период'},{status:400});
 if(market==='yandex'){
  const d=await readFinance(from,to,scheme as 'fbo'|'fbs');
  if(!d)return NextResponse.json({error:'Нет сохранённых финансов ЯМ за период'},{status:404});
  const rows:Row[]=d.rows.map(r=>({article:r.article,name:r.name,master_code:r.master_code,manager:r.manager,orders:r.orders,cancelled:r.cancelledTotal,buyouts:r.buyouts,revenue:cents(r.income),charges:cents(r.expense),cogs:cents(r.cogs),mayak:cents(r.mayak),advertising:cents(r.advertising),storage:cents(r.storage),packing:cents(r.packing),profit:cents(r.result),details:r.details.filter(d=>d.amount!==null).map(d=>({name:d.name,category:d.category,count:d.count,amount:cents(d.amount)??0})),note:r.dataGaps.join('; ')}));
  return NextResponse.json({ok:true,source:'yandex_finance_lines по ID заказа',rows,note:'Та же формула финансового результата ЯМ, но только исходные операции заказов выбранной схемы. Общие расходы без ID заказа остаются в основном финансовом результате и здесь не распределены.'},{headers:{'Cache-Control':'private,no-store'}});
 }
 if(market==='wb'){
  const url=new URL(req.url);url.pathname='/api/agents/wb-finance';url.searchParams.delete('market');url.searchParams.set('scheme',scheme);
  const r=await wbFinance(new NextRequest(url.toString(),{headers:req.headers})),d=await r.json();
  if(!r.ok)return NextResponse.json({error:d.error??'Нет данных WB'},{status:r.status});
  const rows:Row[]=(d.rows as Array<Record<string,unknown>>).map(x=>({article:String(x.article??''),name:String(x.name??''),master_code:x.master_code==null?null:String(x.master_code),manager:String(x.manager??'Не назначен'),orders:num(x.order_count),cancelled:num(x.cancel_count),buyouts:num(x.buyouts),revenue:num(x.realization),charges:num(x.delivery)+num(x.acceptance)+num(x.penalty)+num(x.deduction),cogs:x.cogs==null?null:num(x.cogs),mayak:x.mayak_expense==null?null:num(x.mayak_expense),advertising:null,storage:x.storage_in_report==null?null:num(x.storage_in_report),packing:null,profit:x.preliminary_result==null?null:num(x.preliminary_result),note:Array.isArray(x.missing_rates)?x.missing_rates.join('; '):''}));
  return NextResponse.json({ok:true,source:'wb_finance_daily_lines, srid и officeName',rows,note:'Исходные финансовые операции WB нужной схемы. Реклама, общее хранение и расходы без подтверждённой связи с SRID остаются вне этой таблицы. Прибыль предварительная без них.'},{headers:{'Cache-Control':'private,no-store'}});
 }
 // Ozon: the statement is anchored in the active financial accrual run.
 // An accrual is NOT a new order. Preserve its real posting day and never
 // invent cancellations from a fee ledger.
 const db=createAdminClient(),kind=scheme==='fbo'?'fbo':'fbs';
 type ProductFee={
  sku?:number|string;quantity?:number;
  commission?:{sale_price?:{amount?:string};bonus?:{amount?:string};commission?:{amount?:string}};
  delivery?:{services?:Array<{type_id?:number|string;accrued?:{amount?:string}}>}
 };
 type Acc={sku:string|null;day:string;run_id:string;unit_number:string|null;amount:number;type_id:string|null;
  raw:{accrual_id?:number|string;posting?:{delivery_schema?:string;products?:ProductFee[]};
   item_fees?:{fees?:Array<{sku?:number|string;fees?:Array<{type_id?:number|string;accrued?:{amount?:string}}>}>}}};
 const [entries,mapping,costs,mayak,managers,products,types,packing,dayRuns]=await Promise.all([
  pages<Acc>(async(a,b)=>{const r=await db.from('ozon_finance_accruals')
   .select('sku,day,run_id,unit_number,amount,type_id,raw').eq('account_key','main')
   .eq('accrued_category','POSTING').gte('day',from).lte('day',to)
   .order('day').order('row_index').range(a,b);return r;}),
  pages<{sku:string;offer_id:string;master_code:string|null}>(async(a,b)=>{const r=await db.from('ozon_finance_sku_map')
   .select('sku,offer_id,master_code').eq('account_key','main').order('sku').range(a,b);return r;}),
  pages<{master_code:string;valid_from:string;unit_cost_rub:number}>(async(a,b)=>{const r=await db.from('ozon_finance_costs')
   .select('master_code,valid_from,unit_cost_rub').order('master_code').range(a,b);return r;}),
  pages<{master_code:string;valid_from:string;unit_cost_rub:number}>(async(a,b)=>{const r=await db.from('ozon_finance_mayak')
   .select('master_code,valid_from,unit_cost_rub').order('master_code').range(a,b);return r;}),
  pages<{master_code:string;manager_name:string}>(async(a,b)=>{const r=await db.from('ozon_finance_managers')
   .select('master_code,manager_name').order('master_code').range(a,b);return r;}),
  pages<{offer_id:string;name:string|null}>(async(a,b)=>{const r=await db.from('products')
   .select('offer_id,name').not('offer_id','is',null).order('offer_id').range(a,b);return r;}),
  pages<{type_id:string;name:string;description:string}>(async(a,b)=>{const r=await db.from('ozon_finance_types')
   .select('type_id,name,description').order('type_id').range(a,b);return r;}),
  db.rpc('ozon_finance_fbs_packing_v1',{p_from:from,p_to:to,p_account:'main'}),
  db.from('ozon_finance_sync_days').select('day,active_run_id').eq('account_key','main').gte('day',from).lte('day',to)
 ]);
 if(packing.error)throw packing.error;if(dayRuns.error)throw dayRuns.error;
 const activeRuns=new Map((dayRuns.data??[]).map(x=>[x.day,x.active_run_id]));
 const bySku=new Map(mapping.map(x=>[String(x.sku),x]));
 const byManager=new Map(managers.map(x=>[x.master_code,x.manager_name]));
 const names=new Map(products.map(x=>[x.offer_id,x.name??'']));
 const typeNames=new Map(types.map(x=>[x.type_id,x.description||x.name||'Статья Ozon №'+x.type_id]));
 const costBy=new Map<string,typeof costs>(),mayakBy=new Map<string,typeof mayak>();
 for(const x of costs){const a=costBy.get(x.master_code)??[];a.push(x);costBy.set(x.master_code,a);}
 for(const x of mayak){const a=mayakBy.get(x.master_code)??[];a.push(x);mayakBy.set(x.master_code,a);}
 const rate=(history:typeof costs,day:string)=>history.filter(x=>x.valid_from<=day)
  .sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0]?.unit_cost_rub??null;
 type PostedUnit={quantity:number;day:string;shipped:boolean};
 type Accum={income:number;expense:number;units:Map<string,PostedUnit>;details:Map<string,Detail>;
  cogs:number;mayak:number;packing:number;packedUnits:number;missing:boolean};
 const grouped=new Map<string,Accum>(),unitSkus=new Map<string,string>();
 const getGroup=(sku:string):Accum=>{
  let v=grouped.get(sku);if(!v){v={income:0,expense:0,units:new Map(),details:new Map(),cogs:0,mayak:0,packing:0,packedUnits:0,missing:false};grouped.set(sku,v);}return v;
 };
 const detail=(v:Accum,name:string,category:string,amount:number)=>{
  if(!Number.isFinite(amount)||Math.abs(amount)<.005)return;
  const key=category+'|'+name,previous=v.details.get(key);
  v.details.set(key,{name,category,count:(previous?.count??0)+1,amount:Math.round(((previous?.amount??0)+amount)*100)/100});
 };
 let noSku=0;
 for(const x of entries){
  if(activeRuns.get(x.day)!==x.run_id)continue;
  if(String(x.raw?.posting?.delivery_schema??'').toLowerCase()!==kind)continue;
  if(x.sku==null||!String(x.sku).trim()||String(x.sku)==='null'){noSku++;continue;}
  const sku=String(x.sku),v=getGroup(sku),prod=x.raw?.posting?.products?.find(p=>String(p.sku)===sku);
  const quantity=Math.max(0,num(prod?.quantity??1));
  const unit=String(x.unit_number??'');
  if(unit){unitSkus.set(unit,sku);
   const prev=v.units.get(unit);
   const shipped=!!prod?.commission;
   v.units.set(unit,{quantity:Math.max(prev?.quantity??0,quantity),day:shipped?x.day:prev?.day??x.day,shipped:shipped||!!prev?.shipped});
  }
  const amount=num(x.amount);let classified=0;
  const parts:Array<{name:string;category:string;value:number}>=[];
  const take=(name:string,category:string,money?:{amount?:string}|null)=>{
   if(money?.amount===undefined)return;
   const value=Number(money.amount);if(!Number.isFinite(value)||Math.abs(value)<.005)return;
   classified+=value;parts.push({name,category,value});
  };
  take('Цена реализации','Доход',prod?.commission?.sale_price);
  take('Баллы и компенсации скидок','Доход',prod?.commission?.bonus);
  take('Комиссия за продажу','Комиссия',prod?.commission?.commission);
  for(const fee of prod?.delivery?.services??[])
   take(typeNames.get(String(fee.type_id))??'Услуга Ozon №'+fee.type_id,'Услуга Ozon',fee.accrued);
  const difference=Math.round((amount-classified)*100)/100;
  if(Math.abs(difference)>.005)parts.push({name:'Прочие начисления по отправлению',category:'Начисление Ozon',value:difference});
  for(const p of parts){if(p.value>0)v.income+=p.value;else v.expense+=p.value;detail(v,p.name,p.category,p.value);}
 }
 // Scheme-specific item fees can be matched only by a known shipment and SKU.
 const units=[...unitSkus.keys()];
 for(let i=0;i<units.length;i+=125){
  const matches=await pages<Acc>(async(a,b)=>{const r=await db.from('ozon_finance_accruals')
   .select('sku,day,run_id,unit_number,amount,type_id,raw').eq('account_key','main')
   .eq('accrued_category','ITEM').gte('day',from).lte('day',to)
   .in('unit_number',units.slice(i,i+125)).order('day').order('row_index').range(a,b);return r;});
  for(const fee of matches){
   if(activeRuns.get(fee.day)!==fee.run_id||!fee.unit_number||!fee.sku)continue;
   if(unitSkus.get(fee.unit_number)!==String(fee.sku))continue;
   const v=grouped.get(String(fee.sku));if(!v)continue;
   const amount=num(fee.amount),name=typeNames.get(String(fee.type_id))??'Удержание Ozon';
   if(amount>0)v.income+=amount;else v.expense+=amount;
   detail(v,name,'Услуга Ozon · ITEM',amount);
  }
 }
 const packedBySku=new Map<string,{units:number;amount:number}>(((packing.data??[]) as Array<{sku:string;units:number;amount:number}>).map(x=>[String(x.sku),{units:num(x.units),amount:num(x.amount)}]));
 const rows:Row[]=[];
 for(const [sku,v] of grouped){
  const link=bySku.get(sku),master=link?.master_code??null,article=link?.offer_id??'SKU:'+sku;
  let count=0,packed=packedBySku.get(sku);
  v.packedUnits=kind==='fbs'?(packed?.units??0):0;
  v.packing=kind==='fbs'?(packed?.amount??0):0;
  for(const posted of v.units.values()){
   count+=posted.quantity;
   if(!posted.shipped)continue;
   const c=master?rate(costBy.get(master)??[],posted.day):null;
   const may=master?rate(mayakBy.get(master)??[],posted.day):null;
   if(c===null||(kind==='fbo'&&may===null))v.missing=true;
   if(c!==null)v.cogs+=posted.quantity*num(c);
   if(kind==='fbo'&&may!==null)v.mayak+=posted.quantity*num(may);
  }
  v.income=Math.round(v.income*100)/100;v.expense=Math.round(v.expense*100)/100;
  const details=[...v.details.values()];
  if(!v.missing&&v.cogs>0)details.push({name:'Себестоимость отгруженных единиц',category:'Цена закупа',count:count,amount:-v.cogs});
  if(kind==='fbo'&&!v.missing&&v.mayak>0)details.push({name:'ТК Маяк',category:'Внешний расход',count:count,amount:-v.mayak});
  if(kind==='fbs'&&v.packing>0)details.push({name:'Упаковка на складе · 20 ₽ за единицу',category:'Внешний расход',count:v.packedUnits,amount:-v.packing});
  rows.push({article,name:names.get(article)??'',master_code:master,manager:master?byManager.get(master)??'Не назначен':'Не назначен',
   orders:count,cancelled:null,buyouts:null,revenue:v.income,charges:v.expense,
   cogs:v.missing?null:Math.round(v.cogs*100)/100,mayak:kind==='fbs'?0:v.missing?null:Math.round(v.mayak*100)/100,
   advertising:null,storage:kind==='fbs'?0:null,packing:kind==='fbs'?v.packing:0,shipped_units:v.packedUnits,
   profit:v.missing?null:Math.round((v.income+v.expense-v.cogs-v.mayak-v.packing)*100)/100,
   details,note:'Отправления из финансового реестра, не дата исходного заказа. Отмены и выкупы этим источником не подтверждены.'
  });
 }
 let orderSourceError='';
 if(kind==='fbs'){
  try{
   const orderUnits=await readOzonFbsOrders(from,to);
   const countBySku=new Map<string,{orders:number;cancelled:number}>();
   for(const item of orderUnits){
    const key=item.sku||[...bySku].find(([,link])=>link.offer_id===item.article)?.[0]||'';
    if(!key)continue;
    const prev=countBySku.get(key)??{orders:0,cancelled:0};
    prev.orders+=item.quantity;if(item.cancelled)prev.cancelled+=item.quantity;
    countBySku.set(key,prev);
   }
   for(const [sku,count] of countBySku){
    const match=rows.find(r=>r.article===(bySku.get(sku)?.offer_id??'SKU:'+sku));
    if(match){match.orders=count.orders;match.cancelled=count.cancelled;}
    else {
     const linked=bySku.get(sku),article=linked?.offer_id??'SKU:'+sku,master=linked?.master_code??null;
     rows.push({article,name:names.get(article)??'',master_code:master,
      manager:master?byManager.get(master)??'Не назначен':'Не назначен',
      orders:count.orders,cancelled:count.cancelled,buyouts:null,revenue:null,charges:null,
      cogs:null,mayak:0,advertising:null,storage:0,packing:0,
      shipped_units:0,profit:null,details:[],
      note:'Созданные FBS заказы есть, но финансовые начисления за выбранную дату пока отсутствуют.'});
    }
   }
   // A SKU with bookings outside the request's ORDER dates is not a zero-order SKU.
   for(const row of rows)if(!countBySku.has(
    [...bySku].find(([,link])=>link.offer_id===row.article)?.[0]??row.article.slice(4)
   )){row.orders=0;row.cancelled=0;}
  }catch(e){
   orderSourceError=e instanceof Error?e.message:'Недоступна история заказов FBS';
   for(const row of rows){row.orders=null;row.cancelled=null;}
  }
 }
 rows.sort((a,b)=>num(b.revenue)-num(a.revenue));
 const note='Ozon: только подтверждённые операции схемы '+kind.toUpperCase()+
  ' (POSTING и сопоставимые ITEM). Для FBO в столбце отправлений указаны финансовые отправления. Для FBS заказы и отмены берутся из отдельного списка Ozon v4 по дате заказа, а финансовые суммы из начислений по дате проводки. Упаковка FBS: 20 ₽ на подтверждённую отгруженную единицу. Реклама и общие NON_ITEM не распределены, прибыль предварительная.'+
  (orderSourceError?' Ошибка загрузки FBS заказов: '+orderSourceError+'.':'')+
  (noSku?' Не распределено отправлений без подтверждённого SKU: '+noSku+'.':'');
 return NextResponse.json({ok:true,source:'ozon_finance_accruals · active POSTING + linked ITEM',rows,note},
  {headers:{'Cache-Control':'private,no-store'}});
 }catch(e){const error=e instanceof Error?e.message:'Ошибка финансового отчёта';return NextResponse.json({error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:500});}}
