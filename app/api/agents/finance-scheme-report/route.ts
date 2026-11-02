import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {validDate} from '../../../../lib/yandex/finance';
import {readFinance} from '../../../../lib/yandex/finance-cache';
import {GET as wbFinance} from '../wb-finance/route';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
type Row={article:string;name:string;master_code:string|null;manager:string;orders:number|null;cancelled:number|null;buyouts:number|null;revenue:number|null;charges:number|null;cogs:number|null;mayak:number|null;advertising:number|null;storage:number|null;profit:number|null;note:string};
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
  const rows:Row[]=d.rows.map(r=>({article:r.article,name:r.name,master_code:r.master_code,manager:r.manager,orders:r.orders,cancelled:r.cancelledTotal,buyouts:r.buyouts,revenue:cents(r.income),charges:cents(r.expense),cogs:cents(r.cogs),mayak:cents(r.mayak),advertising:cents(r.advertising),storage:cents(r.storage),profit:cents(r.result),note:r.dataGaps.join('; ')}));
  return NextResponse.json({ok:true,source:'yandex_finance_lines по ID заказа',rows,note:'Та же формула финансового результата ЯМ, но только исходные операции заказов выбранной схемы. Общие расходы без ID заказа остаются в основном финансовом результате и здесь не распределены.'},{headers:{'Cache-Control':'private,no-store'}});
 }
 if(market==='wb'){
  const url=new URL(req.url);url.pathname='/api/agents/wb-finance';url.searchParams.delete('market');url.searchParams.set('scheme',scheme);
  const r=await wbFinance(new NextRequest(url.toString(),{headers:req.headers})),d=await r.json();
  if(!r.ok)return NextResponse.json({error:d.error??'Нет данных WB'},{status:r.status});
  const rows:Row[]=(d.rows as Array<Record<string,unknown>>).map(x=>({article:String(x.article??''),name:String(x.name??''),master_code:x.master_code==null?null:String(x.master_code),manager:String(x.manager??'Не назначен'),orders:num(x.order_count),cancelled:num(x.cancel_count),buyouts:num(x.buyouts),revenue:num(x.realization),charges:num(x.delivery)+num(x.acceptance)+num(x.penalty)+num(x.deduction),cogs:x.cogs==null?null:num(x.cogs),mayak:x.mayak_expense==null?null:num(x.mayak_expense),advertising:null,storage:x.storage_in_report==null?null:num(x.storage_in_report),profit:x.preliminary_result==null?null:num(x.preliminary_result),note:Array.isArray(x.missing_rates)?x.missing_rates.join('; '):''}));
  return NextResponse.json({ok:true,source:'wb_finance_daily_lines, srid и officeName',rows,note:'Исходные финансовые операции WB нужной схемы. Реклама, общее хранение и расходы без подтверждённой связи с SRID остаются вне этой таблицы. Прибыль предварительная без них.'},{headers:{'Cache-Control':'private,no-store'}});
 }
 // Ozon: preserve the actual finance ledger; filter its POSTING accruals by delivery_schema.
 // No unit counts or monetary values are inferred from marketplace-wide aggregates.
 const db=createAdminClient(),kind=scheme==='fbo'?'fbo':'fbs';
 type Acc={sku:string;day:string;unit_number:string;amount:number;raw:{posting?:{delivery_schema?:string;products?:Array<{sku:number;quantity:number}>}}};
 const entries=await pages<Acc>(async(a,b)=>{const r=await db.from('ozon_finance_accruals').select('sku,day,unit_number,amount,raw').eq('account_key','main').eq('accrued_category','POSTING').gte('day',from).lte('day',to).order('day').order('row_index').range(a,b);return r;});
 const [mapping,costs,mayak,managers]=await Promise.all([
  pages<{sku:string;offer_id:string;master_code:string|null}>(async(a,b)=>{const r=await db.from('ozon_finance_sku_map').select('sku,offer_id,master_code').eq('account_key','main').order('sku').range(a,b);return r;}),
  pages<{master_code:string;valid_from:string;unit_cost_rub:number}>(async(a,b)=>{const r=await db.from('ozon_finance_costs').select('master_code,valid_from,unit_cost_rub').order('master_code').range(a,b);return r;}),
  pages<{master_code:string;valid_from:string;unit_cost_rub:number}>(async(a,b)=>{const r=await db.from('ozon_finance_mayak').select('master_code,valid_from,unit_cost_rub').order('master_code').range(a,b);return r;}),
  pages<{master_code:string;manager_name:string}>(async(a,b)=>{const r=await db.from('ozon_finance_managers').select('master_code,manager_name').order('master_code').range(a,b);return r;})
 ]);
 const bySku=new Map(mapping.map(x=>[String(x.sku),x])),byManager=new Map(managers.map(x=>[x.master_code,x.manager_name]));
 const costBy=new Map<string,typeof costs>(),mayakBy=new Map<string,typeof mayak>();
 for(const x of costs){const a=costBy.get(x.master_code)??[];a.push(x);costBy.set(x.master_code,a);}
 for(const x of mayak){const a=mayakBy.get(x.master_code)??[];a.push(x);mayakBy.set(x.master_code,a);}
 const rate=(arr:typeof costs,day:string)=>arr.filter(x=>x.valid_from<=day).sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0]?.unit_cost_rub??null;
 type Accum={income:number;expense:number;units:number;posted:Set<string>;cogs:number;mayak:number;missing:boolean};
 const grouped=new Map<string,Accum>();
 for(const x of entries){
  if(String(x.raw?.posting?.delivery_schema??'').toLowerCase()!==kind)continue;
  const sku=String(x.sku),v=grouped.get(sku)??{income:0,expense:0,units:0,posted:new Set<string>(),cogs:0,mayak:0,missing:false};
  const amount=num(x.amount);if(amount>=0)v.income+=amount;else v.expense+=amount;
  const unit=String(x.unit_number??''),master=bySku.get(sku)?.master_code;
  if(unit&&!v.posted.has(unit)){
   v.posted.add(unit);const quantity=Math.max(0,num(x.raw?.posting?.products?.find(p=>String(p.sku)===sku)?.quantity??1));v.units+=quantity;
   const cost=master?rate(costBy.get(master)??[],x.day):null,trans=master?rate(mayakBy.get(master)??[],x.day):null;
   if(cost===null||trans===null)v.missing=true;
   if(cost!==null)v.cogs+=quantity*num(cost);if(trans!==null)v.mayak+=quantity*num(trans);
  }
  grouped.set(sku,v);
 }
 const rows:Row[]=[...grouped].map(([sku,v])=>{
  const mapping=bySku.get(sku),master=mapping?.master_code??null;
  return {article:mapping?.offer_id??'SKU:'+sku,name:'',master_code:master,manager:master?byManager.get(master)??'Не назначен':'Не назначен',orders:v.units,cancelled:null,buyouts:null,revenue:v.income,charges:v.expense,cogs:v.missing?null:v.cogs,mayak:v.missing?null:v.mayak,advertising:null,storage:null,profit:v.missing?null:v.income+v.expense-v.cogs-v.mayak,note:'Оценка по уникальным отправлениям, не по подтверждённым выкупам'};
 }).sort((a,b)=>num(b.revenue)-num(a.revenue));
 return NextResponse.json({ok:true,source:'ozon_finance_accruals POSTING / delivery_schema',rows,note:'Ozon: начисления по отправлениям выбранной схемы из финансового реестра. Себестоимость и ТК Маяк оценены по уникальным отправлениям, без подтверждения выкупов. Общие ITEM/NON_ITEM, реклама и хранение не распределены, поэтому операционная прибыль является предварительной оценкой.'},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){const error=e instanceof Error?e.message:'Ошибка финансового отчёта';return NextResponse.json({error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:500});}}
