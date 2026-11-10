import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Both manual refresh and daily cron use SAVED WB finance and Yandex/Ozon
// sales sync windows. Never request WB supplier/sales from procurement.
async function authorized(request: NextRequest): Promise<boolean> {
  if (request.method === "GET") {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && request.headers.get("authorization") === "Bearer " + secret);
  }

  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return false;

  const admin = createAdminClient();
  const { data, error: roleError } = await admin
    .from("app_user_access")
    .select("system_role,admin_level,is_blocked")
    .eq("user_id", user.id)
    .maybeSingle();

  return !roleError && Boolean(
    data && !data.is_blocked &&
      (data.system_role === "procurement" ||
       data.admin_level === "admin" || data.admin_level === "senior_admin")
  );
}

async function sync(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json(
      { ok: false, error: "Нет прав на обновление закупа" }, { status: 403 }
    );
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("china_import_wb_sales_from_daily");
  if (error) {
    // Show the readiness failure; do not call the rate-limited WB Statistics.
    console.error("[CHINA DAILY SALES] import failed", error.message);
    return NextResponse.json(
      { ok: false, error: error.message, source: "wb_finance_daily" },
      { status: 409 }
    );
  }
  if (!data || data.ok !== true) {
    return NextResponse.json(
      { ok: false, error: "Не удалось подтвердить ежедневную выгрузку WB" },
      { status: 502 }
    );
  }

  console.info("[CHINA DAILY SALES] verified", {
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    rowsSaved: data.rowsSaved,
    fbwSales: data.fbwSales,
    fbwReturns: data.fbwReturns,
    unmatchedFbwOperations: data.unmatchedFbwOperations,
    source: data.source,
  });

  return NextResponse.json(data, { status: 200 });
}

export async function GET(request: NextRequest) { return sync(request); }
export async function POST(request: NextRequest) { return sync(request); }
