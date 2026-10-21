import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
const PAGE_SIZE=10000;
const BATCH=200;
type Job={run_day:string;date_from:string;date_to:string;status:string;next_offset:number;rows_saved:number;retry_at:string|null;updated_at:string};
const date=(v:Date)=>v.toISOString().slice(0,10);
const shift=(d:string,delta:number)=>date(new Date(Date.parse(d+"T00:00:00Z")+delta*86400000));
// Reporting day rolls forward only at 06:00 Krasnoyarsk, not at midnight.
const todayKras=()=>date(new Date(Date.now()+3600000));
const reply=(obj:object,status=200)=>NextResponse.json(obj,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest){
 if(!process.env.CRON_SECRET||req.headers.get("authorization")!=="Bearer "+process.env.CRON_SECRET)return reply({ok:false,error:"Unauthorized"},401);
 const token=process.env.WB_FINANCE_TOKEN?.trim();
 if(!token)return reply({ok:false,error:"Missing WB_FINANCE_TOKEN"},503);
 const db=createAdminClient();
 const day=todayKras(),from=shift(day,-31),to=shift(day,-1);
 const {error:initError}=await db.from("wb_finance_cache_jobs").upsert({run_day:day,date_from:from,date_to:to,status:"pending",next_offset:0,rows_saved:0},{onConflict:"run_day",ignoreDuplicates:true});
 if(initError)return reply({ok:false,error:initError.message},503);
 // One job at a time. Prioritize unfinished jobs; never create partial complete snapshots.
 const {data:pending,error:jobError}=await db.from("wb_finance_cache_jobs").select("*").neq("status","complete").order("run_day",{ascending:true}).limit(10);
 if(jobError)return reply({ok:false,error:jobError.message},503);
 const now=Date.now();
 const job=(pending??[] as Job[]).find(j=>!(j.retry_at&&Date.parse(j.retry_at)>now)&&!(j.status==="running"&&Date.parse(j.updated_at)>now-240000)) as Job|undefined;
 if(!job)return reply({ok:true,status:"waiting_or_complete",day});
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
  return reply({ok:true,status:done?"complete":"waiting",from:job.date_from,to:job.date_to,rowsSaved:job.next_offset+raw.length});
 }catch(e){
  const message=e instanceof Error?e.message:String(e);
  await db.from("wb_finance_cache_jobs").update({status:"failed",retry_at:new Date(Date.now()+300000).toISOString(),last_error:message.slice(0,350),updated_at:new Date().toISOString()}).eq("run_day",job.run_day);
  return reply({ok:false,error:message.slice(0,350)},503);
 }
}
