import { NextRequest, NextResponse } from "next/server";
import { syncChinaWbOrderFeed } from "@/lib/china/wb-order-feed";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function previousDay(day: string, count: number): string {
  return new Date(Date.parse(day + "T12:00:00Z") - count * 86_400_000)
    .toISOString().slice(0, 10);
}

async function recalculateIfComplete(): Promise<{
  calculated: boolean;
  calculatedTo: string | null;
  reason?: string;
}> {
  const db = createAdminClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Krasnoyarsk",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const yesterday = previousDay(today, 1);
  const beforeYesterday = previousDay(today, 2);

  const [wbDays, latestCalculation, ozon, yandex] = await Promise.all([
    db.from("china_wb_feed_days")
      .select("sale_day").in("sale_day", [yesterday, beforeYesterday]),
    db.from("china_calculation_runs")
      .select("id,sales_date_to")
      .order("calculated_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("ozon_sales_sync_runs")
      .select("id").eq("status", "success")
      .eq("completed_days", 28).eq("date_to", yesterday)
      .limit(1).maybeSingle(),
    db.from("yandex_sales_sync_runs")
      .select("id").eq("status", "success")
      .eq("date_to", yesterday)
      .eq("unmatched_order_items", 0)
      .eq("unmatched_return_items", 0)
      .limit(1).maybeSingle(),
  ]);
  if (wbDays.error || latestCalculation.error || ozon.error || yandex.error) {
    throw new Error("Закуп: не удалось проверить полноту исходных данных");
  }
  const present = new Set((wbDays.data ?? []).map((x) => x.sale_day));
  if (!present.has(yesterday) || !present.has(beforeYesterday)) {
    return { calculated: false, calculatedTo: null, reason: "wb_days_incomplete" };
  }
  if (!ozon.data?.id || !yandex.data?.id) {
    return { calculated: false, calculatedTo: null, reason: "other_marketplaces_incomplete" };
  }
  if (latestCalculation.data?.sales_date_to === yesterday) {
    return { calculated: false, calculatedTo: yesterday, reason: "already_calculated" };
  }

  // This existing procedure also updates the transport simulation.
  // It never creates a VED order and accepts only complete 28-day source data.
  const { error: calculateError } = await db.rpc("run_china_calculation_with_transport");
  if (calculateError) {
    throw new Error("Закуп: выкупы WB сохранены, но расчёт не обновился: "
      + calculateError.message);
  }

  const { data: after, error: verifyError } = await db
    .from("china_calculation_runs").select("sales_date_to")
    .order("calculated_at", { ascending: false }).limit(1).maybeSingle();
  if (verifyError || after?.sales_date_to !== yesterday) {
    throw new Error("Закуп: расчёт выполнен, но общий период остался старым");
  }
  return { calculated: true, calculatedTo: yesterday };
}

// CRON_SECRET-only: WB is NEVER queried by the user-facing Calculate button.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const source = await syncChinaWbOrderFeed();
    console.info("[CHINA WB FEED] verified status", {
      from: source.from, to: source.to,
      buyouts: source.fbwBuyouts, returns: source.fbwReturns,
      reused: source.reused, skipped: source.skipped,
    });
    if (!source.ok) {
      return NextResponse.json({
        ...source, calculated: false,
        reason: "wb_rate_limit_or_concurrent_sync",
      });
    }

    // Don't declare the job complete while the procurement calculation
    // still uses an older 28-day period.
    try {
      const calculation = await recalculateIfComplete();
      console.info("[CHINA WB FEED] procurement result", calculation);
      return NextResponse.json({ ...source, ...calculation });
    } catch (calculationError) {
      const error = calculationError instanceof Error
        ? calculationError.message : "Неизвестная ошибка пересчёта";
      console.error("[CHINA WB FEED] calculation failed", error);
      return NextResponse.json(
        { ...source, calculated: false, calculationError: error },
        { status: 503 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка WB";
    console.error("[CHINA WB FEED] failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
