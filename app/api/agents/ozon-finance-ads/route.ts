import { NextRequest } from "next/server";
import { runHistoricalAdvertising } from "./worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
/** Cron-only, serialized Ozon Performance historical advertising sync. */
export async function GET(request:NextRequest) {
 return runHistoricalAdvertising(request);
}
