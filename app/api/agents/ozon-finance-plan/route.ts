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

    // The advertising dimension is separate from the Seller money ledger.
    // Enqueue ONLY if there is no active campaign-report job, preventing
    // duplicate historical downloads and Ozon Performance HTTP 429 storms.
    const { count, error: adQueueError } = await db.from("ozon_finance_ad_sync_jobs")
      .select("id", { head: true, count: "exact" })
      .eq("account_key", "main").in("status", ["pending", "running", "failed"]);
    if (adQueueError) throw new Error("Ad queue status: " + adQueueError.message);
    let newAdvertisingJob = false;
    if (!count) {
      const to = new Date(krasnoyarskToday + "T00:00:00Z");
      const from = new Date(to.getTime() - 28 * 86_400_000);
      const periodFrom = from.toISOString().slice(0, 10);
      const periodTo = new Date(to.getTime() - 86_400_000).toISOString().slice(0, 10);
      const { data:adCovered,error:coverageError } = await db
        .from("ozon_finance_ad_coverage").select("day")
        .eq("account_key", "main").gte("day", periodFrom).lte("day", periodTo);
      if (coverageError) throw coverageError;
      if ((adCovered?.length ?? 0) < 28) {
        const {error: insertError} = await db.from("ozon_finance_ad_sync_jobs")
          .upsert({account_key:"main",date_from:periodFrom,date_to:periodTo,
            status:"pending",last_error:null},
            {onConflict:"account_key,date_from,date_to",ignoreDuplicates:true});
        if(insertError)throw insertError;
        newAdvertisingJob=true;
      }
    }
    return json({ok:true,timezone:"Asia/Krasnoyarsk",scheduled_local_time:"05:00",
      cache:"supabase",period_days:28,
      seller: data,advertising_job_created:newAdvertisingJob,
      advertising_progress:"independent; no double deduction of Seller PPC"});
  } catch(error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("Finance rolling cache planner error", message);
    return json({ok:false,error:message.slice(0,360)},503);
  }
}
