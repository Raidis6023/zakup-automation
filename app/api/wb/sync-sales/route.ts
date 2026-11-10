import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationSecret } from "@/lib/integrations/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SALES_ENDPOINT = "https://statistics-api.wildberries.ru/api/v1/supplier/sales";
const PAGE_LIMIT_WARNING = 79000;
const BATCH_SIZE = 400;

type WbSale = {
  saleID?: unknown;
  srid?: unknown;
  date?: unknown;
  lastChangeDate?: unknown;
  nmId?: unknown;
  supplierArticle?: unknown;
  barcode?: unknown;
  warehouseName?: unknown;
  warehouseType?: unknown;
  incomeID?: unknown;
};

function validTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.slice(0, 19);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : null;
}

function olderThanDays(date: string, days: number): boolean {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Krasnoyarsk", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const threshold = new Date(today + "T00:00:00Z");
  threshold.setUTCDate(threshold.getUTCDate() - days);
  return date < threshold.toISOString().slice(0, 10);
}

async function authorize(request: NextRequest): Promise<boolean> {
  if (request.method === "GET") {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && request.headers.get("authorization") === "Bearer " + secret);
  }

  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return false;
  const db = createAdminClient();
  const { data: access, error: accessError } = await db
    .from("app_user_access")
    .select("system_role,admin_level,is_blocked")
    .eq("user_id", user.id)
    .maybeSingle();
  return !accessError && Boolean(access && access.is_blocked !== true &&
    (access.system_role === "procurement" ||
      access.admin_level === "admin" || access.admin_level === "senior_admin"));
}

async function syncSales(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ ok: false, error: "Нет прав на обновление закупа" }, { status: 403 });
  }

  const db = createAdminClient();
  const { data: ozonRun, error: runError } = await db
    .from("ozon_sales_sync_runs")
    .select("date_from,date_to")
    .eq("status", "success")
    .eq("completed_days", 28)
    .order("date_to", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError || !ozonRun?.date_from || !ozonRun?.date_to) {
    return NextResponse.json(
      { ok: false, error: "Нет проверенного 28-дневного периода Ozon" },
      { status: 409 },
    );
  }
  if (olderThanDays(ozonRun.date_to, 2)) {
    return NextResponse.json(
      { ok: false, error: "Период продаж Ozon устарел; сначала обновите Ozon" },
      { status: 409 },
    );
  }

  const start = new Date(ozonRun.date_from + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - 1);
  const requestedFrom = start.toISOString().slice(0, 10);
  const requestedTo = ozonRun.date_to;

  const { data: previous } = await db
    .from("wb_sales_import_runs")
    .select("id,completed_at,rows_received,rows_saved")
    .eq("status", "success")
    .lte("date_from", requestedFrom)
    .gte("date_to", requestedTo)
    .gte("completed_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previous) {
    return NextResponse.json({
      ok: true, skipped: true, reason: "Продажи WB уже проверены за последние 4 часа",
      dateFrom: requestedFrom, dateTo: requestedTo,
      rowsReceived: previous.rows_received, rowsSaved: previous.rows_saved,
    });
  }

  const token = await getIntegrationSecret("wb_read_token");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Не настроен WB Read Token" }, { status: 503 });
  }

  const { data: record, error: recordError } = await db
    .from("wb_sales_import_runs")
    .insert({ date_from: requestedFrom, date_to: requestedTo, status: "running" })
    .select("id").single();
  if (recordError || !record) {
    return NextResponse.json({ ok: false, error: "Не удалось зарегистрировать загрузку WB" }, { status: 500 });
  }

  try {
    const url = new URL(SALES_ENDPOINT);
    url.searchParams.set("dateFrom", requestedFrom + "T00:00:00");
    url.searchParams.set("flag", "0");

    const response = await fetch(url.toString(), {
      headers: { Authorization: token, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(42000),
    });
    if (!response.ok) {
      throw new Error("WB supplier/sales HTTP " + response.status +
        (response.status === 429 ? ": лимит запросов, повторите позднее" : ""));
    }
    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new Error("WB вернул неожиданный формат supplier/sales");
    }
    if (body.length >= PAGE_LIMIT_WARNING) {
      throw new Error("Ответ WB близок к лимиту 80 000 строк; нужна постраничная выгрузка");
    }

    const unique = new Map<string, Record<string, unknown>>();
    let fbwSales = 0;
    let fbwReturns = 0;
    for (const entry of body as WbSale[]) {
      const saleId = String(entry.saleID ?? "").trim();
      const saleDate = validTimestamp(entry.date);
      const changedAt = validTimestamp(entry.lastChangeDate);
      const nmId = Number(entry.nmId);
      if (!saleId || !saleDate || !changedAt || !Number.isSafeInteger(nmId) || nmId <= 0 ||
          (!saleId.startsWith("S") && !saleId.startsWith("R"))) {
        throw new Error("WB вернул некорректную запись продажи/возврата; импорт не подтверждён");
      }
      if (saleDate.slice(0, 10) > requestedTo) continue;
      // Полный 28-дневный отрезок читается единым запросом по lastChangeDate.
      const row = {
        sale_id: saleId,
        srid: typeof entry.srid === "string" ? entry.srid : null,
        sale_date: saleDate,
        last_change_date: changedAt,
        nm_id: nmId,
        supplier_article: typeof entry.supplierArticle === "string" ? entry.supplierArticle : null,
        barcode: typeof entry.barcode === "string" ? entry.barcode : null,
        warehouse_name: typeof entry.warehouseName === "string" ? entry.warehouseName : null,
        warehouse_type: typeof entry.warehouseType === "string" ? entry.warehouseType : null,
        income_id: Number.isSafeInteger(Number(entry.incomeID)) ? Number(entry.incomeID) : null,
        raw: { source: "supplier/sales", saleID: saleId },
        synced_at: new Date().toISOString(),
      };
      if (row.warehouse_type === "Склад WB" &&
          saleDate.slice(0, 10) >= ozonRun.date_from) {
        if (saleId.startsWith("S")) fbwSales += 1;
        else fbwReturns += 1;
      }
      unique.set(saleId, row);
    }

    if (fbwSales === 0) {
      throw new Error("Выгрузка WB не содержит ни одной продажи FBW за расчётный период");
    }

    const values = Array.from(unique.values());
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const { error: saveError } = await db.from("wb_sales").upsert(
        values.slice(i, i + BATCH_SIZE), { onConflict: "sale_id" },
      );
      if (saveError) throw new Error("Не удалось сохранить пакет WB: " + saveError.message);
    }

    const { error: finishError } = await db.from("wb_sales_import_runs").update({
      status: "success",
      completed_at: new Date().toISOString(),
      rows_received: body.length,
      rows_saved: values.length,
      fbw_sales: fbwSales,
      fbw_returns: fbwReturns,
      error: null,
    }).eq("id", record.id);
    if (finishError) throw new Error("Не удалось подтвердить полноту загрузки: " + finishError.message);

    console.info("[WB SALES] verified", {
      dateFrom: requestedFrom, dateTo: requestedTo,
      rowsReceived: body.length, rowsSaved: values.length, fbwSales, fbwReturns,
    });
    return NextResponse.json({
      ok: true, dateFrom: requestedFrom, dateTo: requestedTo,
      rowsReceived: body.length, rowsSaved: values.length, fbwSales, fbwReturns,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка WB";
    await db.from("wb_sales_import_runs").update({
      status: "failed", completed_at: new Date().toISOString(), error: message.slice(0, 500),
    }).eq("id", record.id);
    console.error("[WB SALES] failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

export async function GET(request: NextRequest) { return syncSales(request); }
export async function POST(request: NextRequest) { return syncSales(request); }
