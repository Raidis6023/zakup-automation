import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret)
    return json({ ok: false, error: "Unauthorized" }, 401);
  try {
    // Krasnoyarsk has a stable UTC+07:00 offset; include only COMPLETED
    // calendar days. At 05:00 on October 22: September 21–October 21.
    const krasnoyarskToday = new Date(Date.now() + 7 * 3_600_000)
      .toISOString().slice(0, 10);
    const db = createAdminClient();
    const { data, error } = await db.rpc("ozon_finance_schedule_window", {
      p_local_date: krasnoyarskToday,
      p_window_days: 28,
      p_recent_refresh_days: 7,
    });
    if (error) throw new Error("Failed to plan 28 days: " + error.message);

    // Advertising is independent of the Seller accrual ledger.
    // NEVER postpone fresh days because an old 28-day campaign report is
    // unfinished: that was the cause of the October 28–November gaps.
    const yesterday=new Date(Date.parse(krasnoyarskToday+'T00:00:00Z')-86400000);
    const currentTo=yesterday.toISOString().slice(0,10);
    const recentFrom=new Date(yesterday.getTime()-6*86400000).toISOString().slice(0,10);
    const {data:alreadyCovered,error:coverageError}=await db.from('ozon_finance_ad_coverage')
      .select('day').eq('account_key','main').gte('day',recentFrom).lte('day',currentTo);
    if(coverageError)throw coverageError;
    const covered=new Set((alreadyCovered??[]).map(x=>x.day));
    const {data:existing,error:jobsError}=await db.from('ozon_finance_ad_sync_jobs')
      .select('date_from,date_to,status').eq('account_key','main')
      .gte('date_to',recentFrom).lte('date_from',currentTo);
    if(jobsError)throw jobsError;
    const existingSingles=new Set((existing??[]).filter(x=>x.date_from===x.date_to).map(x=>x.date_from));
    const newDays:string[]=[];
    for(let t=Date.parse(recentFrom+'T00:00:00Z');t<=Date.parse(currentTo+'T00:00:00Z');t+=86400000){
      const day=new Date(t).toISOString().slice(0,10);
      if(covered.has(day)||existingSingles.has(day))continue;
      const insert=await db.from('ozon_finance_ad_sync_jobs').upsert({
       account_key:'main',date_from:day,date_to:day,status:'pending',last_error:null
      },{onConflict:'account_key,date_from,date_to',ignoreDuplicates:true});
      if(insert.error)throw insert.error;
      newDays.push(day);
    }
    const newAdvertisingJob=newDays.length>0;
    return json({ok:true,timezone:"Asia/Krasnoyarsk",scheduled_local_time:"05:00",
      cache:"supabase",period_days:28,
      seller:data,advertising_job_created:newAdvertisingJob,advertising_new_days:newDays,
      advertising_progress:"independent; no double deduction of Seller PPC"});
  } catch(error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("Finance rolling cache planner error", message);
    return json({ok:false,error:message.slice(0,360)},503);
  }
}
