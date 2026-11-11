import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Legacy procurement refresh endpoint: read-only WB daily source status.
// The separate procurement cron was retired. Finance rows are never copied.
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
  // No procurement-side import, no new WB rows and no Marketplace request.
  const { data, error } = await db
    .from("wb_finance_cache_jobs")
    .select("run_day,date_from,date_to,status,rows_saved,completed_at")
    .eq("status", "complete")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[CHINA WB SOURCE STATUS] query failed", error.message);
    return NextResponse.json(
      { ok: false, error: "Не удалось проверить ежедневный источник WB" },
      { status: 502 },
    );
  }
  if (!data?.completed_at || Number(data.rows_saved) <= 0) {
    return NextResponse.json(
      { ok: false, error: "Нет завершённой ежедневной финансовой выгрузки WB" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    readOnly: true,
    source: "wb_finance_cache_lines",
    runDay: data.run_day,
    dateFrom: data.date_from,
    dateTo: data.date_to,
    rowsSaved: data.rows_saved,
    completedAt: data.completed_at,
  });

}

export async function GET(request: NextRequest) { return sync(request); }
export async function POST(request: NextRequest) { return sync(request); }
