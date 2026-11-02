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
 const q=req.nextUrl.searchParams,market=q.get('market')??'',name=q.get('name')??'',day=q.get('day')??'',typeId=q.get('typeId')??'',from=q.get('from')??'',to=q.get('to')??'';
 if(!['ozon','yandex','wb'].includes(market)||!validDate(day)||!validDate(from)||!validDate(to)||day<from||day>to||!name||name.length>255)return NextResponse.json({error:'Неверные параметры детализации'},{status:400});
 const db=createAdminClient();let rows:Event[]=[];
 if(market==='ozon'){
  if(!typeId||typeId.length>30)return NextResponse.json({error:'Не указан код начисления Ozon'},{status:400});
  const r=await db.from('ozon_finance_accruals').select('raw,sku,amount,type_id,accrued_category,unit_number')
   .eq('account_key','main').eq('day',day).eq('accrued_category','NON_ITEM').eq('type_id',typeId).order('row_index').limit(limit+1);
  if(r.error)throw r.error;
  rows=(r.data??[]).map(x=>({id:String(x.raw?.accrual_id??x.unit_number??''),orderId:x.unit_number??null,article:x.sku??null,amount:money(x.amount),type:String(x.type_id??'')}));
 }else if(market==='yandex'){
  // Daily history stores original sheet/row IDs. These IDs are not marketplace transaction IDs.
  const snapshots=await db.from('yandex_finance_daily_snapshots').select('snapshot_day').eq('snapshot_day',day).limit(1);
  if(snapshots.error)throw snapshots.error;
  const data=snapshots.data?.length
   ?await db.from('yandex_finance_daily_lines').select('payload,source_report_id').eq('snapshot_day',day).order('line_index').limit(20000)
   :await db.from('yandex_finance_lines').select('payload,report_id').eq('report_id',(await db.from('yandex_finance_reports').select('id').eq('status','ready').lte('date_from',from).gte('date_to',to).order('created_at',{ascending:false}).limit(1).maybeSingle()).data?.id??'').order('line_index').limit(20000);
  if(data.error)throw data.error;
  rows=(data.data??[]).map(r=>r.payload).filter(p=>p?.source==='expense'&&p.sheet===name&&p.serviceDate===day&&(p.allocation==='common'||p.allocation==='subscription'||!p.article))
   .map(p=>({id:p.sheet+' · строка '+p.row,orderId:p.orderId||null,article:p.article||null,amount:money(p.amount),type:p.allocation}));
 }else{
  const r=await db.from('wb_finance_daily_lines').select('payload').eq('snapshot_day',day).order('line_index').limit(20000);
  if(r.error)throw r.error;
  rows=(r.data??[]).map(x=>x.payload).filter(p=>Number(p.nmId??0)===0&&String(p.sellerOperName??p.docTypeName??'Неизвестная операция')===name)
   .map(p=>({id:String(p.rrdId??p.reportId??''),orderId:p.srid?String(p.srid):null,article:null,amount:money(p.forPay)-money(p.deliveryAmount)-money(p.paidStorage)-money(p.paidAcceptance)-money(p.penalty)-money(p.deduction),type:String(p.sellerOperName??'')}));
 }
 return NextResponse.json({ok:true,items:rows.slice(0,limit),more:rows.length>limit},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){const msg=e instanceof Error?e.message:'Ошибка начислений';return NextResponse.json({error:msg},{status:msg==='Требуется авторизация'?401:msg.startsWith('Недостаточно прав')?403:500});}}
