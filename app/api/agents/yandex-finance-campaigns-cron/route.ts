import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {advancePromotion} from '../yandex-finance-campaigns/worker';
import {financeAccess} from '../../../../lib/yandex/finance-access';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const shift=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export async function GET(req:NextRequest){
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 try{
  const db=createAdminClient(),today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  const yesterday=shift(today,-1),selectedFrom=req.nextUrl.searchParams.get('from'),selectedTo=req.nextUrl.searchParams.get('to');
  if((selectedFrom&&!selectedTo)||(!selectedFrom&&selectedTo))return NextResponse.json({ok:false,error:'Укажите обе даты периода'},{status:400});
  const scoped=!!selectedFrom&&!!selectedTo,to=selectedTo??yesterday,from=selectedFrom??shift(to,-27);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||new Date(from).toISOString().slice(0,10)!==from||new Date(to).toISOString().slice(0,10)!==to||from>to||to>yesterday||Date.parse(to)-Date.parse(from)>90*86400000)return NextResponse.json({ok:false,error:'Выберите период до 91 дня без будущих дат'},{status:400});
  const days=Array.from({length:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1},(_,i)=>shift(from,i));
  const tasks=days.flatMap(day=>(['sales','shows'] as const).map(kind=>({day,kind})));
  const seeded=await db.from('yandex_promotion_jobs').upsert(tasks,{onConflict:'day,kind',ignoreDuplicates:true});
  if(seeded.error)throw seeded.error;
  const deadline=Date.now()+250000;
  let result=await advancePromotion(scoped?{from,to}:undefined),steps=1,finished=Number(result.phase==='saved');
  // A single daily invocation must clear more than one step of the
  // two-report-per-day queue. Retain the provider's 125-second quota gap.
  while(result.ok&&Date.now()<deadline-15000&&steps<7){
   const phase=String(result.phase);
   if(['busy','finance_loading','idle','waiting'].includes(phase))break;
   if(phase==='requested'||phase==='cooldown'){
    if(deadline-Date.now()<137000)break;
    await new Promise(resolve=>setTimeout(resolve,129000));
   }
   result=await advancePromotion(scoped?{from,to}:undefined);steps++;
   if(result.phase==='saved')finished++;
  }
  return NextResponse.json({...result,steps,finished,window_from:from,window_to:to},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Ошибка выгрузки рекламы ЯМ'},{status:503});}
}

export async function POST(req:NextRequest){try{
 await financeAccess();const secret=process.env.CRON_SECRET;
 if(!secret)return NextResponse.json({error:'Не настроен CRON_SECRET'},{status:503});
 const body=await req.json() as {from?:string;to?:string};
 const url=new URL(req.url);
 if(body.from)url.searchParams.set('from',body.from);
 if(body.to)url.searchParams.set('to',body.to);
 return GET(new NextRequest(url,{headers:{authorization:'Bearer '+secret}}));
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Нет доступа'},{status:403});}}
