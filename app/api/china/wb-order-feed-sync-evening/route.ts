import { NextRequest } from "next/server";
import { GET as runOrderFeed } from "../wb-order-feed-sync/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Third daily slot; no call is sent to WB when all recent days are verified.
export async function GET(request: NextRequest) {
  return runOrderFeed(request);
}
