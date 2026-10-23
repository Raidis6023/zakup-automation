import { NextRequest, NextResponse } from "next/server";
import { buildFbwPlan } from "@/lib/wb/fbw-supply-plan";
import { requireFbwSupplyUser } from "@/lib/wb/fbw-supply-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    await requireFbwSupplyUser();
    const plan = await buildFbwPlan(request);
    return NextResponse.json(plan, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка расчёта FBW";
    const status = /авторизац|прав администратора/i.test(message) ? 403 : 503;
    return NextResponse.json({ ok:false, error:message }, {status});
  }
}
