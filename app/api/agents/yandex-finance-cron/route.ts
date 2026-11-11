import {NextRequest,NextResponse} from 'next/server';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {POST as handleFinanceSync} from '../yandex-finance-sync/route';
import {advancePromotion} from '../yandex-finance-campaigns/worker';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
type Job={id:string;status:string;phase:string;date_from:string;date_to:string;next_request_at?:string|null;waiting_for?:string;busy?:boolean;error?:string};
const shift=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function step(req:NextRequest,body:object):Promise<Job>{
 const request=new NextRequest(new URL('/api/agents/yandex-finance-sync',req.url),{method:'POST',
 headers:{authorization:req.headers.get('authorization')??'','content-type':'application/json'},body:JSON.stringify(body)});
 const response=await handleFinanceSync(request),data=await response.json();
 if(!response.ok)throw Error(String(data.error??'Ошибка финансовой выгрузки ЯМ'));
 return data as Job;
}
export async function GET(req:NextRequest){
 const auth=req.headers.get('authorization');
 if(!auth||!((process.env.CRON_SECRET&&auth==='Bearer '+process.env.CRON_SECRET)||
   (process.env.YANDEX_FINANCE_CRON_SECRET&&auth==='Bearer '+process.env.YANDEX_FINANCE_CRON_SECRET)))
  return reply({ok:false,error:'Unauthorized'},401);
 const db=createAdminClient();
 try{
  const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  const from=shift(today,-28),to=shift(today,-1);
  const active=await db.from('yandex_finance_reports').select('id,status,phase,date_from,date_to,next_request_at')
   .eq('status','loading').order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(active.error)throw active.error;
  let job:Job;
  if(active.data)job=active.data as Job;
  else{
   const ready=await db.from('yandex_finance_reports').select('id,date_from,date_to,status,phase').eq('status','ready')
    .lte('date_from',from).gte('date_to',to).order('created_at',{ascending:false}).limit(1).maybeSingle();
   if(ready.error)throw ready.error;
   if(ready.data){
    const snapshot=await db.from('yandex_finance_daily_snapshots').select('source_report_id').eq('snapshot_day',to).maybeSingle();
    if(snapshot.error)throw snapshot.error;
    if(snapshot.data?.source_report_id!==ready.data.id){
     const published=await db.rpc('finance_publish_yandex_daily',{p_report_id:ready.data.id});
     if(published.error)throw published.error;
    }
    return reply({ok:true,phase:'cached',from,to,report_id:ready.data.id});
   }
   job=await step(req,{action:'start',from,to});
  }
  const until=Date.now()+245000;let steps=0,promotionPolled=false;
  while(job.status==='loading'&&steps<60&&Date.now()<until){
   if(job.busy)break;
   if(job.waiting_for){
    // A previously generated promotion report blocks finance generation at
    // provider level. Poll that specific UUID once, but NEVER generate a new
    // promotion while finance is pending. Prevents indefinite finance starvation.
    if(job.waiting_for==='promotion_report'&&!promotionPolled){
     promotionPolled=true;
     const existing=await db.from('yandex_promotion_jobs').select('day')
      .eq('status','requested').limit(1).maybeSingle();
     if(existing.error)throw existing.error;
     if(existing.data){
      const result=await advancePromotion();
      if(result.ok&&result.phase==='saved'){
       // Respect the account's shared report-generation cooldown before
       // advancing finance. The next scheduler tick will resume.
       const ctl=await db.from('yandex_promotion_control').select('next_request_at').eq('id',1).maybeSingle();
       if(ctl.error)throw ctl.error;
       if(ctl.data?.next_request_at&&Date.parse(ctl.data.next_request_at)>Date.now())break;
       job={...job,waiting_for:undefined};
       continue;
      }
     }
    }
    break;
   }
   const retry=job.next_request_at?Date.parse(job.next_request_at):0;
   if(retry>Date.now()){
    const delay=Math.min(10000,retry-Date.now(),until-Date.now()-10000);
    if(delay<=0)break;
    await new Promise(resolve=>setTimeout(resolve,delay));
    continue;
   }
   const phase=job.phase;job=await step(req,{action:'advance',id:job.id});steps++;
   if(job.status==='loading'&&job.phase===phase&&!job.busy){
    // A generation phase with no state change is usually rate-limited by a
    // DIFFERENT report. Release the function slot instead of spinning 4 min.
    if(['services_request','orders_request'].includes(phase))break;
    await new Promise(resolve=>setTimeout(resolve,Math.min(3000,Math.max(0,until-Date.now()-10000))));
   }
  }
  if(job.status==='ready'){
   const published=await db.rpc('finance_publish_yandex_daily',{p_report_id:job.id});
   if(published.error)throw published.error;
  }
  return reply({ok:job.status!=='failed',phase:job.phase,status:job.status,report_id:job.id,steps,from:job.date_from,to:job.date_to});
 }catch(error){return reply({ok:false,error:error instanceof Error?error.message:'Ошибка автозагрузки ЯМ'},503)}
}
