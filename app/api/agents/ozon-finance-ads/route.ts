import {NextRequest,NextResponse} from 'next/server';
import {runHistoricalAdvertising} from './worker';
import {financeAccess} from '../../../../lib/yandex/finance-access';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
/** Account-level serialized Ozon ads report request and delayed poll. */
export async function GET(request:NextRequest){
 const started=Date.now();let processed=0,last:Record<string,unknown>={phase:'idle'},status=200;
 for(let i=0;i<18&&Date.now()-started<235000;i++){
  const response=await runHistoricalAdvertising(request),result=await response.json() as Record<string,unknown>;
  last=result;status=response.status;
  if(result.phase==='report_saved')processed+=Number(result.batch_size??1);
  if(!response.ok||['idle','lease_or_cooldown','report_processing','sync_error','ozon_global_quota'].includes(String(result.phase)))break;
  if(result.phase==='report_requested'){
   if(235000-(Date.now()-started)<130000)break;
   await new Promise(resolve=>setTimeout(resolve,125000));
  }
 }
 return NextResponse.json({...last,reports_processed:processed},{status,headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:NextRequest){try{await financeAccess();const secret=process.env.CRON_SECRET;if(!secret)return NextResponse.json({error:'Не настроен CRON_SECRET'},{status:503});return GET(new NextRequest(request.url,{headers:{authorization:'Bearer '+secret}}));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Нет доступа'},{status:403});}}
