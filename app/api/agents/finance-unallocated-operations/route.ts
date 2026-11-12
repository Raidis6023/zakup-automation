import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {validDate} from '../../../../lib/yandex/finance';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Event={id:string;orderId:string|null;article:string|null;amount:number;type:string};
const limit=500;
const money=(n:unknown)=>{const v=Number(n??0);return Number.isFinite(v)?v:0};
export async function GET(req:NextRequest){try{
 await financeAccess();
 const q=req.nextUrl.searchParams,market=q.get('market')??'',name=q.get('name')??'',day=q.get('day')??'',typeId=q.get('typeId')??'',category=q.get('category')??'NON_ITEM',from=q.get('from')??'',to=q.get('to')??'';
 if(!['ozon','yandex','wb'].includes(market)||!validDate(day)||!validDate(from)||!validDate(to)||day<from||day>to||!name||name.length>255)return NextResponse.json({error:'Неверные параметры детализации'},{status:400});
 const db=createAdminClient();const page=Math.max(0,Math.min(10000,Math.floor(Number(q.get('page')??0)||0)));let rows:Event[]=[];
 if(market==='ozon'){
  if(!typeId||typeId.length>30)return NextResponse.json({error:'Не указан код начисления Ozon'},{status:400});
  if(!['NON_ITEM','ITEM','POSTING','CONTAINER'].includes(category))
   return NextResponse.json({error:'Неизвестная категория начисления'},{status:400});
  // Do not mix previous runs of the same day with the active financial ledger.
  const active=await db.from('ozon_finance_sync_days').select('active_run_id')
   .eq('account_key','main').eq('day',day).maybeSingle();
  if(active.error)throw active.error;
  if(!active.data?.active_run_id)
   return NextResponse.json({ok:true,items:[],more:false,note:'Нет подтверждённого финансового снимка за дату'},{headers:{'Cache-Control':'private,no-store'}});
  let source=db.from('ozon_finance_accruals')
   .select('row_index,raw,sku,amount,type_id,accrued_category,unit_number')
   .eq('account_key','main').eq('run_id',active.data.active_run_id)
   .eq('day',day).eq('accrued_category',category);
  if(typeId==='UNSPECIFIED'||typeId==='ITEM_UNCLASSIFIED'||typeId==='ITEM_REMAINDER'){
   // The aggregate uses a synthetic type for source rows without a fee type.
   source=source.is('type_id',null).is('sku',null);
  }else if(category==='NON_ITEM'){
   source=source.eq('raw->non_item_fee->>type_id',typeId).is('sku',null);
  }else{
   source=source.eq('type_id',typeId).is('sku',null);
  }
  const r=await source.order('row_index').range(page*limit,page*limit+limit);
  if(r.error)throw r.error;
  rows=(r.data??[]).map(x=>({id:String(x.raw?.accrual_id??x.row_index??x.unit_number??''),
   orderId:x.unit_number??null,article:x.sku??null,amount:money(x.amount),
   type:String(x.type_id??x.raw?.non_item_fee?.type_id??x.accrued_category??'')}));
 }else if(market==='yandex'){
  // Daily history stores original sheet/row IDs. These IDs are not marketplace transaction IDs.
  const snapshots=await db.from('yandex_finance_daily_snapshots').select('snapshot_day').eq('snapshot_day',day).limit(1);
  if(snapshots.error)throw snapshots.error;
  const reportId=snapshots.data?.length?null:(await db.from('yandex_finance_reports').select('id').eq('status','ready').lte('date_from',from).gte('date_to',to).order('created_at',{ascending:false}).limit(1).maybeSingle()).data?.id??null;
  const raw:Array<{payload:Record<string,unknown>}>=[];
  for(let offset=0;;offset+=1000){
   const r=reportId
    ?await db.from('yandex_finance_lines').select('payload').eq('report_id',reportId).order('line_index').range(offset,offset+999)
    :await db.from('yandex_finance_daily_lines').select('payload').eq('snapshot_day',day).order('line_index').range(offset,offset+999);
   if(r.error)throw r.error;
   raw.push(...(r.data??[]) as Array<{payload:Record<string,unknown>}>);
   if((r.data?.length??0)<1000)break;
  }
  rows=raw.map(x=>x.payload).filter(p=>p?.source==='expense'&&p.sheet===name&&p.serviceDate===day&&(p.allocation==='common'||p.allocation==='subscription'||!p.article))
   .map(p=>({id:String(p.sheet??'')+' · строка '+String(p.row??''),orderId:p.orderId?String(p.orderId):null,article:p.article?String(p.article):null,amount:money(p.amount),type:String(p.allocation??'')}));
 }else{
  const raw:Array<{payload:Record<string,unknown>}>=[];
  for(let offset=0;;offset+=1000){
   const r=await db.from('wb_finance_daily_lines').select('payload').eq('snapshot_day',day).order('line_index').range(offset,offset+999);
   if(r.error)throw r.error;raw.push(...(r.data??[]) as Array<{payload:Record<string,unknown>}>);
   if((r.data?.length??0)<1000)break;
  }
  rows=raw.map(x=>x.payload).filter(p=>Number(p.nmId??0)===0&&String(p.sellerOperName??p.docTypeName??'Неизвестная операция')===name)
   .map(p=>({id:String(p.rrdId??p.reportId??''),orderId:p.srid?String(p.srid):null,article:null,amount:money(p.forPay)-money(p.deliveryAmount)-money(p.paidStorage)-money(p.paidAcceptance)-money(p.penalty)-money(p.deduction),type:String(p.sellerOperName??'')}));
 }
 return NextResponse.json({ok:true,items:market==='ozon'?rows:rows.slice(page*limit,(page+1)*limit),more:market==='ozon'?rows.length===limit:rows.length>(page+1)*limit},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){const msg=e instanceof Error?e.message:'Ошибка начислений';return NextResponse.json({error:msg},{status:msg==='Требуется авторизация'?401:msg.startsWith('Недостаточно прав')?403:500});}}
