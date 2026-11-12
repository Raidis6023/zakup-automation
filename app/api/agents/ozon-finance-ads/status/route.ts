import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../../lib/yandex/finance-access';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const valid=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&
 Number.isFinite(Date.parse(day))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;

/** Read-only, admin-only progress endpoint. Never initiates provider reports,
 * changes campaign accounting, or exposes Ozon credentials. */
export async function GET(request:NextRequest){
 try{
  const db=await financeAccess();
  const from=request.nextUrl.searchParams.get('from')??'';
  const to=request.nextUrl.searchParams.get('to')??'';
  const span=Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z');
  if(!valid(from)||!valid(to)||span<0||span>30*86400000)
   return NextResponse.json({ok:false,error:'Неверный период (максимум 31 день)'},{status:400,headers});
  const [latest,covered,jobs,control]=await Promise.all([
   db.from('ozon_finance_ad_sku_daily').select('synced_at')
    .eq('account_key','main').gte('day',from).lte('day',to)
    .order('synced_at',{ascending:false}).limit(1).maybeSingle(),
   db.from('ozon_finance_ad_coverage').select('day')
    .eq('account_key','main').gte('day',from).lte('day',to),
   db.from('ozon_finance_ad_sync_jobs').select('id,status,date_from,date_to')
    .eq('account_key','main').lte('date_from',to).gte('date_to',from)
    .order('date_to',{ascending:false}).limit(250),
   db.from('ozon_finance_ad_worker_control')
    .select('last_phase,last_error,retry_after,updated_at')
    .eq('account_key','main').maybeSingle(),
  ]);
  if(latest.error)throw latest.error;
  if(covered.error)throw covered.error;
  if(jobs.error)throw jobs.error;
  if(control.error)throw control.error;
  const ids=(jobs.data??[]).map(j=>j.id);
  const stats=ids.length?await db.from('ozon_finance_ad_campaign_tasks')
   .select('job_id,status,metrics_ready').in('job_id',ids).lte('day',to).gte('date_to',from).limit(5000):
   {data:[],error:null};
  if(stats.error)throw stats.error;
  const tasks=stats.data??[];
  const loaded=tasks.filter(t=>t.status==='complete'&&t.metrics_ready).length;
  const total=tasks.length;
  const pendingDays=(jobs.data??[]).filter(j=>j.status!=='complete'&&
   !tasks.some(t=>t.job_id===j.id)).length;
  return NextResponse.json({ok:true,from,to,latest_sku_update:latest.data?.synced_at??null,
   campaigns_total:total,campaigns_confirmed:loaded,
   campaigns_pending:total-loaded,unstarted_job_windows:pendingDays,
   complete_days:(covered.data??[]).length,
   expected_days:Math.round(span/86400000)+1,
   worker_phase:control.data?.last_phase??null,
   worker_retry_after:control.data?.retry_after??null,
  },{headers});
 }catch(e){
  return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Не удалось проверить рекламную очередь'},
   {status:403,headers});
 }
}
