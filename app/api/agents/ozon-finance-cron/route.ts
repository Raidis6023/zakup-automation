import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await db.from("ozon_finance_page_jobs")
    .select("day,status,pages_completed,rows_saved,updated_at")
    .eq("account_key","main").neq("status","complete")
    .lt("day",today).order("day",{ascending:true}).limit(14);
  if(error)return reply({ok:false,error:error.message},503);
  const pending=data??[];
  if(!pending.length)return reply({ok:true,phase:"idle",remaining_days:0});

  // Do NOT use user-supplied URLs. Fixed same-origin endpoint, credential
  // passed only over HTTPS, never included in response or logs.
  const day=pending[0].day;
  const started=Date.now();
  let pages=0, last:null|unknown=null;
  try {
    while(pages<2 && Date.now()-started<47000) {
      const response=await fetch(new URL("/api/agents/ozon-finance-sync",request.url),{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+cronSecret},
        body:JSON.stringify({day}),cache:"no-store",
        signal:AbortSignal.timeout(26000),
      });
      const state=await response.json() as {
        ok?:boolean; busy?:boolean; done?:boolean; error?:string;
        rows_saved?:number; pages_completed?:number;
      };
      if(!response.ok || !state.ok) {
        return reply({ok:false,phase:"import_failed",day,
          detail:state.error??("HTTP "+response.status)},502);
      }
      last={day,rows_saved:state.rows_saved,pages_completed:state.pages_completed,
        done:!!state.done,busy:!!state.busy};
      if(state.busy || state.done)break;
      pages++;
    }
    return reply({ok:true,phase:"import",remaining_days:pending.length,last});
  }catch(error) {
    return reply({ok:false,phase:"server_error",day,
      error:error instanceof Error?error.message:"Unexpected exception"},503);
  }
}
