import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { createClient } from "../../../../lib/supabase/server";
import { runAuxiliarySync } from "../wb-finance-aux-sync/route";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
const PAGE_SIZE=100000;
const BATCH=200;
type Job={run_day:string;date_from:string;date_to:string;status:string;next_offset:number;rows_saved:number;retry_at:string|null;updated_at:string};
const date=(v:Date)=>v.toISOString().slice(0,10);
const shift=(d:string,delta:number)=>date(new Date(Date.parse(d+"T00:00:00Z")+delta*86400000));
// Reporting day rolls forward only at 06:00 Krasnoyarsk, not at midnight.
const todayKras=()=>date(new Date(Date.now()+3600000));
const reply=(obj:object,status=200)=>NextResponse.json(obj,{status,headers:{"Cache-Control":"no-store"}});
async function adminAccess(){const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user)throw Error("Требуется авторизация");const db=createAdminClient();const {data,error}=await db.from("app_user_access").select("admin_level,is_blocked").eq("user_id",user.id).maybeSingle();if(error||!data||data.is_blocked||!["admin","senior_admin"].includes(data.admin_level??""))throw Error("Недостаточно прав для финансовой аналитики");}
async function work(req:NextRequest,attempt:number,started:number,history?:{run_day:string;from:string;to:string}){
 if(!process.env.CRON_SECRET||req.headers.get("authorization")!=="Bearer "+process.env.CRON_SECRET)return reply({ok:false,error:"Unauthorized"},401);
 const token=process.env.WB_FINANCE_TOKEN?.trim();
 if(!token)return reply({ok:false,error:"Missing WB_FINANCE_TOKEN"},503);
 const db=createAdminClient();
 const currentDay=todayKras(),day=history?.run_day??currentDay,from=history?.from??shift(currentDay,-31),to=history?.to??shift(currentDay,-1);
 // Previous partial windows must never block today's rolling 31-day window.
 // Keep their raw cache for audit, but remove them from the active queue.
 if(!history){const archived=await db.from('wb_finance_cache_jobs').update({status:'superseded',updated_at:new Date().toISOString()})
  .lt('run_day',day).gte('date_to',shift(currentDay,-28)).in('status',['pending','waiting','running','failed']);
 if(archived.error)return reply({ok:false,error:archived.error.message},503);}

 const {data:existing,error:existingError}=await db.from("wb_finance_cache_jobs").select("*").eq("run_day",day).maybeSingle();
 if(existingError)return reply({ok:false,error:existingError.message},503);
 if(!existing){
  const {error:createError}=await db.from("wb_finance_cache_jobs").insert({run_day:day,date_from:from,date_to:to,status:"pending",next_offset:0,rows_saved:0});
  if(createError)return reply({ok:false,error:createError.message},503);
 }else if(existing.rows_saved===0&&(existing.date_from!==from||existing.date_to!==to||existing.status==='superseded')){
  const {error:rangeError}=await db.from("wb_finance_cache_jobs").update({date_from:from,date_to:to,status:"pending",next_offset:0,retry_at:null,last_error:null,updated_at:new Date().toISOString()}).eq("run_day",day);
  if(rangeError)return reply({ok:false,error:rangeError.message},503);
 }else if(existing.rows_saved>0&&(existing.date_from!==from||existing.date_to!==to)){
  // Already-completed 28-day cache must remain immutable; rolling coverage is
  // assembled from the published day snapshots, not by rewriting old source.
  if(existing.status==='complete')return reply({ok:true,status:'complete',from:existing.date_from,to:existing.date_to,rowsSaved:existing.rows_saved,historyWindow:true});
  return reply({ok:false,error:"Текущий кэш WB создан для другого периода; требуется безопасный перезапуск",runDay:day},409);
 }

 const {data:current,error:jobError}=await db.from("wb_finance_cache_jobs").select("*").eq("run_day",day).single();
 if(jobError)return reply({ok:false,error:jobError.message},503);
 const job=current as Job;
 if(job.status==="complete")return reply({ok:true,status:"complete",from:job.date_from,to:job.date_to,rowsSaved:job.rows_saved});
 const now=Date.now();
 if(job.retry_at&&Date.parse(job.retry_at)>now)return reply({ok:true,status:"waiting",from:job.date_from,to:job.date_to,rowsSaved:job.rows_saved,retryAt:job.retry_at});
 if(job.status==="running"&&Date.parse(job.updated_at)>now-240000)return reply({ok:true,status:"busy",from:job.date_from,to:job.date_to,rowsSaved:job.rows_saved});
 const {data:locked,error:lockError}=await db.from("wb_finance_cache_jobs")
  .update({status:"running",updated_at:new Date().toISOString(),last_error:null})
  .eq("run_day",job.run_day).eq("next_offset",job.next_offset).eq("status",job.status).select("run_day");
 if(lockError||!locked?.length)return reply({ok:true,status:"busy"});
 const reserve=new Date(Date.now()+80000).toISOString();
 // A persisted 80-second guard prevents accidental repeated requests.
 const {data:slot}=await db.from("wb_sync_state").select("next_allowed_at").eq("sync_key","finance_detailed").maybeSingle();
 if(slot?.next_allowed_at&&Date.parse(slot.next_allowed_at)>Date.now()){
  await db.from("wb_finance_cache_jobs").update({status:"waiting",retry_at:slot.next_allowed_at,updated_at:new Date().toISOString()}).eq("run_day",job.run_day);
  return reply({ok:true,status:"cooldown",retryAt:slot.next_allowed_at});
 }
 await db.from("wb_sync_state").upsert({sync_key:"finance_detailed",next_allowed_at:reserve,last_attempt_at:new Date().toISOString(),last_message:"WB finance cache background import",updated_at:new Date().toISOString()},{onConflict:"sync_key"});
 try{
  const response=await fetch("https://finance-api.wildberries.ru/api/finance/v1/sales-reports/detailed",{
   method:"POST",cache:"no-store",headers:{Authorization:token,"Content-Type":"application/json"},
   body:JSON.stringify({dateFrom:job.date_from+"T00:00:00",dateTo:job.date_to+"T23:59:59",limit:PAGE_SIZE,offset:job.next_offset}),
   signal:AbortSignal.timeout(48000)
  });
  if(response.status===429){
   const raw=response.headers.get("X-RateLimit-Retry")??response.headers.get("Retry-After");
   const delay=raw&&Number.isFinite(Number(raw))&&Number(raw)>0?Math.ceil(Number(raw))*1000+5000:90000;
   const retryAt=new Date(Date.now()+delay).toISOString();
   await db.from("wb_sync_state").upsert({sync_key:"finance_detailed",next_allowed_at:retryAt,last_http_status:429,last_message:"WB finance 429",updated_at:new Date().toISOString()},{onConflict:"sync_key"});
   await db.from("wb_finance_cache_jobs").update({status:"waiting",retry_at:retryAt,last_error:"WB 429",updated_at:new Date().toISOString()}).eq("run_day",job.run_day);
   return reply({ok:true,status:"rate_limited",retryAt});
  }
  if(response.status!==204&&!response.ok)throw new Error("WB Finance HTTP "+response.status+" "+(await response.text()).slice(0,250));
  const raw=response.status===204?[]:await response.json();
  if(!Array.isArray(raw))throw new Error("Unexpected WB financial response format");
  for(let p=0;p<raw.length;p+=BATCH){
   const rows=raw.slice(p,p+BATCH).map((payload:unknown,i:number)=>({run_day:job.run_day,line_index:job.next_offset+p+i,payload}));
   const {error}=await db.from("wb_finance_cache_lines").upsert(rows,{onConflict:"run_day,line_index"});
   if(error)throw new Error("Save cache: "+error.message);
  }
  const done=raw.length<PAGE_SIZE;
  const {error:progressError}=await db.from("wb_finance_cache_jobs").update({
   status:done?"complete":"waiting",next_offset:job.next_offset+raw.length,rows_saved:job.next_offset+raw.length,
   retry_at:done?null:reserve,completed_at:done?new Date().toISOString():null,
   updated_at:new Date().toISOString()
  }).eq("run_day",job.run_day);
  if(progressError)throw new Error(progressError.message);
  if(done){const published=await db.rpc('finance_publish_wb_daily',{p_run_day:job.run_day});if(published.error)return reply({ok:false,status:'complete_unpublished',error:published.error.message,runDay:job.run_day},503);}
  if(!done&&attempt<2&&Date.now()-started<190000){
    const wait=Math.min(Math.max(0,Date.parse(reserve)-Date.now()+1700),85000);
    if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
    if(Date.now()-started<235000)return work(req,attempt+1,started,history);
  }
  return reply({ok:true,status:done?"complete":"waiting",from:job.date_from,to:job.date_to,rowsSaved:job.next_offset+raw.length,pages_processed:attempt+1});
 }catch(e){
  const message=e instanceof Error?e.message:String(e);
  await db.from("wb_finance_cache_jobs").update({status:"failed",retry_at:new Date(Date.now()+300000).toISOString(),last_error:message.slice(0,350),updated_at:new Date().toISOString()}).eq("run_day",job.run_day);
  return reply({ok:false,error:message.slice(0,350)},503);
 }
}

// Daily financial sync and historical recovery are separate requests, so the
// second report cannot hit the same WB finance rate limit at midnight.
async function runAll(req:NextRequest){
 const [financeResponse,auxiliary]=await Promise.all([work(req,0,Date.now()),runAuxiliarySync()]);
 const finance=await financeResponse.json();
 const ok=financeResponse.ok&&auxiliary.ok;
 return reply({ok,finance,auxiliary,backfill:{status:'separate_daily_job',period:'2026-10-01 – 2026-10-02'}},ok?200:503);
}
export async function runHistoricalWbFinance(req:NextRequest){
 const db=createAdminClient(),target=['2026-10-01','2026-10-02'];
 const snapshots=await db.from('wb_finance_daily_snapshots').select('snapshot_day').in('snapshot_day',target);
 if(snapshots.error)return reply({ok:false,error:snapshots.error.message},503);
 if((snapshots.data??[]).length===2)return reply({ok:true,status:'complete',period:target});
 return work(req,0,Date.now(),{run_day:'2026-10-30',from:'2026-10-01',to:'2026-10-02'});
}
export async function GET(req:NextRequest){return runAll(req);}
export async function POST(req:NextRequest){try{await adminAccess();const secret=process.env.CRON_SECRET;if(!secret)return reply({ok:false,error:"Не найден CRON_SECRET"},503);const internal=new NextRequest(req.url,{method:"GET",headers:{authorization:"Bearer "+secret}});return runAll(internal);}catch(e){return reply({ok:false,error:e instanceof Error?e.message:String(e)},403);}}
