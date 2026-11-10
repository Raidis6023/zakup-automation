import {NextRequest,NextResponse} from 'next/server';
import {runHistoricalAdvertising} from './worker';
import {runDailySkuAdvertising} from '../ozon-finance-ads-daily/worker';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {createAdminClient} from '../../../../lib/supabase/admin';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const shift=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const validDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&
 Number.isFinite(Date.parse(day))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
async function missingSkuDay(from:string,to:string):Promise<string|null>{
 const db=createAdminClient();
 const {data,error}=await db.from('ozon_finance_ad_sku_sync_status')
  .select('day,status').eq('account_key','main').eq('source','cpc_sku_current')
  .gte('day',from).lte('day',to);
 if(error)throw error;
 const known=new Map((data??[]).map(r=>[r.day,r.status]));
 for(let d=to;d>=from;d=shift(d,-1)){
  if(!['complete','empty'].includes(known.get(d)??''))return d;
 }
 return null;
}
async function history(request:NextRequest,started:number){
 let processed=0,last:Record<string,unknown>={phase:'idle'},status=200;
 for(let i=0;i<18&&Date.now()-started<240000;i++){
  const response=await runHistoricalAdvertising(request),result=await response.json() as Record<string,unknown>;
  last=result;status=response.status;
  if(result.phase==='report_saved')processed+=Number(result.batch_size??1);
  if(!response.ok||['idle','lease_or_cooldown','report_processing','sync_error','ozon_global_quota'].includes(String(result.phase)))break;
  if(result.phase==='report_requested'){
   if(240000-(Date.now()-started)<130000)break;
   await new Promise(resolve=>setTimeout(resolve,125000));
  }
 }
 return {last,processed,status};
}
/** Daily CPC + one historic gap. This never counts Performance as a second expense. */
export async function GET(request:NextRequest){
 const cronSecret=process.env.CRON_SECRET;
 if(!cronSecret||request.headers.get('authorization')!=='Bearer '+cronSecret)
  return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 const started=Date.now(),today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const yesterday=shift(today,-1);
 const pending=await missingSkuDay(shift(yesterday,-12),yesterday);
 // If the latest day was successfully covered, prioritize older broken days.
 const latest=await missingSkuDay(yesterday,yesterday);
 const currentDay=latest??pending;
 const daily=currentDay?await runDailySkuAdvertising(currentDay):{ok:true,day:yesterday,rows_saved:0,state:'cached'};
 let additional:Awaited<ReturnType<typeof runDailySkuAdvertising>>|null=null;
 if(currentDay===yesterday&&daily.ok&&Date.now()-started<45000){
  const backfill=await missingSkuDay(shift(yesterday,-12),shift(yesterday,-1));
  if(backfill)additional=await runDailySkuAdvertising(backfill);
 }
 const {last,processed,status}=await history(request,started);
 return NextResponse.json({...last,reports_processed:processed,daily_sku:daily,
  ...(additional?{daily_backfill:additional}:{})},{status,
  headers:{'Cache-Control':'no-store'}});
}
/** Manual backfill is tied to the selected finance period, not today's clock. */
export async function POST(request:NextRequest){
 try{
  await financeAccess();
  const secret=process.env.CRON_SECRET;
  if(!secret)return NextResponse.json({error:'Не настроен CRON_SECRET'},{status:503});
  const body=await request.json().catch(()=>({})) as {from?:string;to?:string};
  if(!body.from&&!body.to)
   return GET(new NextRequest(request.url,{headers:{authorization:'Bearer '+secret}}));
  const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10),yesterday=shift(today,-1);
  if(!body.from||!body.to||!validDay(body.from)||!validDay(body.to)||
    body.from>body.to||body.to>yesterday||body.from<shift(today,-31))
   return NextResponse.json({error:'Период восстановления рекламы: последние 31 сутки до вчера включительно'},{status:400});
  const day=await missingSkuDay(body.from,body.to);
  const daily=day?await runDailySkuAdvertising(day):{ok:true,day:body.to,state:'cached',rows_saved:0};
  // Run one independent CSV worker step if enough time remains.
  const job=await runHistoricalAdvertising(new NextRequest(request.url,{headers:{authorization:'Bearer '+secret}}));
  const output=await job.json() as Record<string,unknown>;
  return NextResponse.json({...output,daily_sku:daily,requested_backfill_day:day,
   reports_processed:output.phase==='report_saved'?Number(output.batch_size??1):0},
   {headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Нет доступа'},{status:403});}
}
