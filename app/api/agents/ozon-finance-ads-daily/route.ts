import {NextRequest,NextResponse} from 'next/server';
import {runDailySkuAdvertising} from './worker';
import {financeAccess} from '../../../../lib/yandex/finance-access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=100;
export async function GET(request:NextRequest){
 if(!process.env.CRON_SECRET||request.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)
  return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 const result=await runDailySkuAdvertising();
 return NextResponse.json(result,{status:result.ok?200:503,headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:NextRequest){
 try{await financeAccess();return GET(new NextRequest(request.url,{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}));}
 catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Нет доступа'},{status:403});}
}
