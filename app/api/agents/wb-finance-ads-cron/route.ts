import {NextRequest,NextResponse} from 'next/server';
import {runAuxiliarySync} from '../wb-finance-aux-sync/route';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)
  return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const result=await runAuxiliarySync('ads');return NextResponse.json(result,{status:result.ok?200:503});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'WB ads sync failed'},{status:503});}
}
