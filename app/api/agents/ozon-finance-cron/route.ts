import { NextRequest, NextResponse } from "next/server";
import { POST as processOneFinancePage } from "../ozon-finance-sync/route";
import { POST as processSkuMapping } from "../ozon-finance-map/route";
import { GET as processFboTransit } from "../ozon-finance-transit/route";
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

  const client=process.env.OZON_CLIENT_ID;
  const key=process.env.OZON_API_KEY;
  if(!client || !key) return reply({
    ok:false,stage:"configuration",
    error:"Нужны OZON_CLIENT_ID и OZON_API_KEY в Production. Performance API не подходит."
  },503);

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
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await db.from("ozon_finance_page_jobs")
    .select("day,status,pages_completed,rows_saved,updated_at")
    .eq("account_key","main").neq("status","complete")
    .lt("day",today).order("day",{ascending:true}).limit(14);
  if(error)return reply({ok:false,error:error.message},503);
  const pending=data??[];
  if(!pending.length) {
    // Historical import finished. Resolve SKU mappings in small batches,
    // without reloading Ozon accruals or blocking interactive reports.
    const {data:complete,error:doneError}=await db.from("ozon_finance_sync_days")
      .select("day").eq("account_key","main")
      .gte("day","2026-10-04").lt("day",today)
      .order("day",{ascending:true}).limit(365);
    if(doneError)return reply({ok:false,phase:"mapping_lookup",error:doneError.message},503);
    for(const candidate of complete??[]) {
      const {data:unmapped,error:mapError}=await db.rpc("ozon_finance_unmapped_skus",{
        p_day:candidate.day,p_limit:1,p_account:"main"
      });
      if(mapError)return reply({ok:false,phase:"mapping_lookup",error:mapError.message},503);
      if((unmapped??[]).length===0)continue;
      // Call the trusted handler directly. Self-HTTP can be blocked by
      // deployment protection and previously hid the real error behind 502.
      const mapRequest = new NextRequest(
        new URL("/api/agents/ozon-finance-map", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json",
            Authorization: "Bearer " + cronSecret },
          body: JSON.stringify({ day: candidate.day }),
        }
      );
      const m=await processSkuMapping(mapRequest);
      const parsed=await m.json() as {ok?:boolean;processed?:number;resolved?:number;error?:string};
      return reply({ok:!!parsed.ok,phase:"sku_mapping",day:candidate.day,
        mapped:parsed.resolved??0,processed:parsed.processed??0,
        error:parsed.ok?undefined:parsed.error},m.ok?200:502);
    }
    // No financial pages or missing SKU remain. Refresh a coherent snapshot
    // of FBO customer shipments still not delivered to the buyer.
    const tr=await processFboTransit(request);
    const trData=await tr.json();
    return reply({ok:tr.ok,phase:"transit_snapshot",
      remaining_days:0,mappings_complete:true,transit:trData},
      tr.ok?200:502);
  }

  // Do NOT use user-supplied URLs. Fixed same-origin endpoint, credential
  // passed only over HTTPS, never included in response or logs.
  const day=pending[0].day;
  const started=Date.now();
  let pages=0, last:null|unknown=null;
  try {
    while(pages<10 && Date.now()-started<235000) {
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
        return reply({ok:false,phase:"import_failed",day,detail:diagnostic},502);
      }
      last={day,rows_saved:state.rows_saved,pages_completed:state.pages_completed,
        done:!!state.done,busy:!!state.busy};
      if(state.busy || state.done)break;
      pages++;
    }
    return reply({ok:true,phase:"import",remaining_days:pending.length,last});
  }catch(error) {
    const diagnostic = error instanceof Error?error.message:"Unexpected exception";
    await db.from("ozon_finance_page_jobs")
      .update({status:"failed",last_error:"Cron exception: "+diagnostic.slice(0,350),
        updated_at:new Date().toISOString()})
      .eq("account_key","main").eq("day",day)
      .eq("pages_completed",0);
    console.error("Ozon finance scheduler exception", {day, diagnostic});
    return reply({ok:false,phase:"server_error",day,error:diagnostic.slice(0,300)},503);
  }
}
