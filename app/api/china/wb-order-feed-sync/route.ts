import { NextRequest, NextResponse } from "next/server";
import { syncChinaWbOrderFeed } from "@/lib/china/wb-order-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// CRON_SECRET-only endpoint. Never expose a seller's Order Feed publicly.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncChinaWbOrderFeed();
    console.info("[CHINA WB FEED] confirmed statuses", {
      from: result.from, to: result.to,
      fbwBuyouts: result.fbwBuyouts, fbwReturns: result.fbwReturns,
      reused: result.reused,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка WB";
    console.error("[CHINA WB FEED] failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
