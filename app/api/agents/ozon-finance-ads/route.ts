import {NextRequest,NextResponse} from 'next/server';
import {runHistoricalAdvertising} from './worker';
import {runDailySkuAdvertising} from '../ozon-finance-ads-daily/worker';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {createAdminClient} from '../../../../lib/supabase/admin';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const valid=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
async function advance(request:NextRequest,manual=false){
 const started=Date.now();
 // Current CPC SKU endpoint only supports today and yesterday.
 // Historical campaign reports are handled separately below.
 // Do not spend every backlog tick redownloading yesterday's already
 // completed CPC report: the previous design blocked historical recovery.
 const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 let daily:Awaited<ReturnType<typeof runDailySkuAdvertising>>|{ok:boolean;day:string;rows_saved:number;state:string}|null=null;
 if(!manual){
  const db=createAdminClient();
  const {data:state,error}=await db.from('ozon_finance_ad_sku_sync_status')
   .select('status,rows_saved,checked_at').eq('account_key','main')
   .eq('source','cpc_sku_current').eq('day',yesterday).maybeSingle();
  if(error)throw error;
  const checked=state?.checked_at?Date.parse(state.checked_at):0;
  if(state&&['complete','empty'].includes(state.status))
   daily={ok:true,day:yesterday,rows_saved:state.rows_saved??0,state:'cached'};
  else if(state?.status==='failed'&&Date.now()-checked<2*3600000)
   daily={ok:false,day:yesterday,rows_saved:state.rows_saved??0,state:'retry_cooldown'};
  else daily=await runDailySkuAdvertising();
 }
 let processed=0,last:Record<string,unknown>={phase:'idle'},status=200;
 for(let i=0;i<18&&Date.now()-started<240000;i++){
  const response=await runHistoricalAdvertising(request),result=await response.json() as Record<string,unknown>;
  last=result;status=response.status;
  if(result.phase==='report_saved')processed+=Number(result.batch_size??1);
  if(!response.ok||['idle','lease_or_cooldown','report_processing','sync_error','ozon_global_quota'].includes(String(result.phase)))break;
  // The protected database scheduler runs frequently. Never park a
  // Vercel function for 125s waiting for Ozon to generate a CSV. Poll the
  // UUID on the next scheduled invocation after provider cooldown instead.
  if(result.phase==='report_requested')break;
 }
 return NextResponse.json({...last,reports_processed:processed,
  ...(daily?{daily_sku:daily}:{}),
  ...(manual?{historical_period:request.nextUrl.searchParams.get('from')+' — '+request.nextUrl.searchParams.get('to')}:{})},
  {status,headers:{'Cache-Control':'no-store'}});
}
/** Automatic daily CPC and serialized historical campaign report processing. */
export async function GET(request:NextRequest){
 const supplied=request.headers.get('authorization');
 const authorized=Boolean(supplied&&(
  (process.env.CRON_SECRET&&supplied==='Bearer '+process.env.CRON_SECRET)||
  (process.env.OZON_AD_CRON_SECRET&&supplied==='Bearer '+process.env.OZON_AD_CRON_SECRET)));
 if(!authorized)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 return advance(request);
}
/** Load exactly the historical campaign period the user selected, not yesterday. */
export async function POST(request:NextRequest){
 try{
  await financeAccess();
  const secret=process.env.CRON_SECRET;
  if(!secret)return NextResponse.json({error:'Не настроен CRON_SECRET'},{status:503});
  const body=await request.json().catch(()=>({})) as {from?:string;to?:string};
  const url=new URL(request.url);
  if(body.from||body.to){
   const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
   if(!body.from||!body.to||!valid(body.from)||!valid(body.to)||
      body.from>body.to||body.to>=today||
      Date.parse(body.to)-Date.parse(body.from)>30*86400000)
    return NextResponse.json({error:'Неверный период исторической рекламы: до 31 дня, без будущих дат'},{status:400});
   url.searchParams.set('from',body.from);url.searchParams.set('to',body.to);
  }
  const authRequest=new NextRequest(url,{headers:{authorization:'Bearer '+secret}});
  return advance(authRequest,!!(body.from&&body.to));
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Нет доступа'},{status:403});}
}
