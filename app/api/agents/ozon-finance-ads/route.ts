import {NextRequest,NextResponse} from 'next/server';
import {runHistoricalAdvertising} from './worker';
import {runDailySkuAdvertising} from '../ozon-finance-ads-daily/worker';
import {financeAccess} from '../../../../lib/yandex/finance-access';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const valid=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
async function advance(request:NextRequest,manual=false){
 const started=Date.now();
 // Current CPC SKU endpoint only supports today and yesterday.
 // Historical campaign reports are handled separately below.
 const daily=manual?null:await runDailySkuAdvertising();
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
 return NextResponse.json({...last,reports_processed:processed,
  ...(daily?{daily_sku:daily}:{}),
  ...(manual?{historical_period:request.nextUrl.searchParams.get('from')+' — '+request.nextUrl.searchParams.get('to')}:{})},
  {status,headers:{'Cache-Control':'no-store'}});
}
/** Automatic daily CPC and serialized historical campaign report processing. */
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)
  return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
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
