import {NextRequest,NextResponse} from 'next/server';
import {runHistoricalAdvertising} from './worker';
import {runDailySkuAdvertising} from '../ozon-finance-ads-daily/worker';
import {financeAccess} from '../../../../lib/yandex/finance-access';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
/** Account-level serialized Ozon ads report request and delayed poll. */
export async function GET(request:NextRequest){
 const cronSecret=process.env.CRON_SECRET;
 if(!cronSecret||request.headers.get('authorization')!=='Bearer '+cronSecret)
  return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 const started=Date.now();
 const recent=await runDailySkuAdvertising();
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
 return NextResponse.json({...last,reports_processed:processed,daily_sku:recent},{status,headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:NextRequest){try{await financeAccess();const secret=process.env.CRON_SECRET;if(!secret)return NextResponse.json({error:'Не настроен CRON_SECRET'},{status:503});return GET(new NextRequest(request.url,{headers:{authorization:'Bearer '+secret}}));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Нет доступа'},{status:403});}}
