import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {advancePromotion} from '../yandex-finance-campaigns/worker';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const shift=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export async function GET(req:NextRequest){
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 try{
  const db=createAdminClient(),today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  const to=shift(today,-1),from=shift(to,-27),days=Array.from({length:28},(_,i)=>shift(from,i));
  const tasks=days.flatMap(day=>(['sales','shows'] as const).map(kind=>({day,kind})));
  const seeded=await db.from('yandex_promotion_jobs').upsert(tasks,{onConflict:'day,kind',ignoreDuplicates:true});
  if(seeded.error)throw seeded.error;
  const result=await advancePromotion();
  return NextResponse.json({...result,window_from:from,window_to:to},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Ошибка выгрузки рекламы ЯМ'},{status:503});}
}
