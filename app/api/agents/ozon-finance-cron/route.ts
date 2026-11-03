import { getOzonCredentials } from "../../../../lib/integrations/secrets";
import { NextRequest, NextResponse } from "next/server";
import { POST as processOneFinancePage } from "../ozon-finance-sync/route";
import { GET as planFinanceWindow } from "../ozon-finance-plan/route";
import { createAdminClient } from "../../../../lib/supabase/admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function reply(data: object, status=200) {
  return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
}

export async function GET(request: NextRequest) {
  // Vercel Cron supplies Authorization: Bearer CRON_SECRET.
  const cronSecret=process.env.CRON_SECRET;
  if(!cronSecret || request.headers.get("authorization")!=="Bearer "+cronSecret)
    return reply({ok:false,error:"Unauthorized scheduler"},401);

  const {sellerClientId:client,sellerApiKey:key}=await getOzonCredentials();
  if(!client || !key) return reply({
    ok:false,stage:"configuration",
    error:"Не заданы ключи Ozon Seller. Добавьте их в разделе «Администрирование → API»",
  },503);

  // Finance planning and loading must not rely on scheduler invocation order.
  const plan=await planFinanceWindow(request);
  if(!plan.ok){
    const details=await plan.json() as {error?:string};
    const reason=String(details.error??"Ошибка планирования Ozon").slice(0,300);
    console.error("Ozon finance planning failed",reason);
    return reply({ok:false,phase:"planning",error:reason,http_status:plan.status},503);
  }
  const db=createAdminClient();
  // Keep the descriptions of ALL Ozon charge types in the local dictionary.
  // Refresh at most when empty; the report itself never calls Ozon.
  const { count:typesCount }=await db.from("ozon_finance_types")
    .select("type_id",{head:true,count:"exact"});
  if(!typesCount) {
    try {
      const tr=await fetch("https://api-seller.ozon.ru/v1/finance/accrual/types",{
        method:"POST",cache:"no-store",headers:{
          "Client-Id":client,"Api-Key":key,"Content-Type":"application/json"
        },body:"{}",signal:AbortSignal.timeout(17000)
      });
      if(tr.ok) {
        const parsed=await tr.json() as {accrual_types?:Array<{
          id:number|string;name?:string;description?:string
        }>};
        const values=(parsed.accrual_types??[]).filter(x=>x.id!=null)
          .map(x=>({type_id:String(x.id),name:x.name||"",
            description:x.description||x.name||""}));
        if(values.length)await db.from("ozon_finance_types")
          .upsert(values,{onConflict:"type_id"});
      } else {
        console.warn("Ozon finance type dictionary: HTTP",tr.status);
      }
    }catch(error){console.warn("Ozon finance type dictionary unavailable",
      error instanceof Error?error.message:"Unknown error")}
  }
  // The daily 05:00 KRAS plan includes local YESTERDAY even when UTC
  // is still on that same calendar date. Do not postpone that day until 07:00.
  const localToday=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  // Look at the entire rolling period before prioritizing missing days.
  // Limiting to the oldest 14 first can starve newly missing dates.
  const windowFrom=new Date(Date.parse(localToday+"T00:00:00Z")-28*86400000).toISOString().slice(0,10);
  const {data,error}=await db.from("ozon_finance_page_jobs")
    .select("day,status,pages_completed,rows_saved,updated_at")
    .eq("account_key","main").neq("status","complete")
    .gte("day",windowFrom).lt("day",localToday)
    .order("day",{ascending:true}).limit(28);
  if(error)return reply({ok:false,error:error.message},503);
  const pending=data??[];
  if(!pending.length)return reply({ok:true,phase:"ledger_cache_idle",
    note:"28-day window is planned at 05:00 KRAS; supporting APIs run independently."});
  const {data:published,error:publishedError}=await db.from("ozon_finance_sync_days")
    .select("day").eq("account_key","main").lt("day",localToday);
  if(publishedError)return reply({ok:false,error:publishedError.message},503);
  const publishedDays=new Set((published??[]).map(row=>row.day));
  // Missing days always beat refreshes. Otherwise the rolling 7-day refresh
  // can keep putting old dates back at the head of the queue forever.
  pending.sort((a,b)=>{
    const aMissing=publishedDays.has(a.day)?1:0,bMissing=publishedDays.has(b.day)?1:0;
    return aMissing-bMissing||a.day.localeCompare(b.day);
  });

  // Do NOT use user-supplied URLs. Fixed same-origin endpoint, credential
  // passed only over HTTPS, never included in response or logs.
  const started=Date.now();
  let pages=0,last:null|unknown=null,completedDays=0;
  try {
   for(const job of pending) {
    const day=job.day;
    let dayPages=0;
    while(dayPages<10 && pages<36 && Date.now()-started<235000) {
      // Execute in the same server process. No Vercel-to-Vercel fetch.
      // This shares authenticated service-role access with the scheduler.
      const pageRequest = new NextRequest(
        new URL("/api/agents/ozon-finance-sync", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json",
            Authorization: "Bearer " + cronSecret },
          body: JSON.stringify({ day }),
        }
      );
      const response=await processOneFinancePage(pageRequest);
      const state=await response.json() as {
        ok?:boolean; busy?:boolean; done?:boolean; error?:string;
        rows_saved?:number; pages_completed?:number;
      };
      if(!response.ok || !state.ok) {
        // Persist the exact stage/error where the operator can inspect it.
        // Never include access tokens, secrets or request headers.
        const diagnostic = String(state.error ?? ("HTTP "+response.status)).slice(0,400);
        await db.from("ozon_finance_page_jobs")
          .update({status:"failed",last_error:"Cron: "+diagnostic,
            updated_at:new Date().toISOString()})
          .eq("account_key","main").eq("day",day)
          .eq("pages_completed",0);
        console.error("Ozon finance background import failure",
          {day, status:response.status, detail:diagnostic});
        return reply({ok:false,phase:"import_failed",day,detail:diagnostic,
          completed_days:completedDays},502);
      }
      last={day,rows_saved:state.rows_saved,pages_completed:state.pages_completed,
        done:!!state.done,busy:!!state.busy};
      if(state.done)completedDays++;
      if(state.busy || state.done)break;
      pages++;dayPages++;
    }
    if(Date.now()-started>=235000||pages>=36)break;
   }
    return reply({ok:true,phase:"import",
      remaining_days:Math.max(0,pending.length-completedDays),
      completed_days:completedDays,pages,last});
  }catch(error) {
    const diagnostic = error instanceof Error?error.message:"Unexpected exception";
    console.error("Ozon finance scheduler exception", {diagnostic});
    return reply({ok:false,phase:"server_error",error:diagnostic.slice(0,300)},503);
  }
}

