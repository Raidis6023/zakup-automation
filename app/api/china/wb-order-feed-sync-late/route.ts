import { NextRequest } from "next/server";
import { GET as runOrderFeed } from "../wb-order-feed-sync/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Second daily slot, five hours after the first one. WB Basic tokens may
// permit only one call per three hours; this route uses the same DB lock.
export async function GET(request: NextRequest) {
  return runOrderFeed(request);
}
