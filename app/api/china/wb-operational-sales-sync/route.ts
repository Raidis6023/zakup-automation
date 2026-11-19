import { getIntegrationSecret } from "@/lib/integrations/secrets";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// WB Statistics: sales and returns (preliminary).
// One request per invocation, and at least two hours between attempts to
// respect even the slowest Basic token. No Order Feed calls from this task.
const SALES_URL = "https://statistics-api.wildberries.ru/api/v1/supplier/sales";
const RATE_LIMIT_MS = 2 * 60 * 60 * 1000;
const PAGE_LIMIT = 80_000;
const CHUNK_SIZE = 450;

type WbSale = {
  saleID?: unknown;
  nmId?: unknown;
  srid?: unknown;
  warehouseType?: unknown;
  date?: unknown;
  lastChangeDate?: unknown;
};
type NormalizedSale = {
  sale_id: string;
  nm_id: number;
  srid: string | null;
  sale_day: string;
  last_change_at: string;
  is_return: boolean;
  updated_at: string;
};

function localDay(time: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(time);
}

function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(day + "T12:00:00Z") + delta * 86_400_000)
    .toISOString().slice(0, 10);
}

function moscowDate(value: unknown): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("WB: продажа без даты");
  }
  const source = value.trim().replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(source)
    ? source : source + "+03:00";
  const date = new Date(withZone);
  if (!Number.isFinite(date.getTime())) throw new Error("WB: неверная дата продажи");
  return date;
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  if (request.method === "GET") {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && request.headers.get("authorization") === "Bearer " + secret);
  }
  // Same-origin form action only. Never expose a public remote sync trigger.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) return false;

  const client = await createClient();
  const { data: { user }, error: sessionError } = await client.auth.getUser();
  if (sessionError || !user) return false;

  const admin = createAdminClient();
  const { data, error } = await admin.from("app_user_access")
    .select("system_role,admin_level,is_blocked")
    .eq("user_id", user.id).maybeSingle();
  return !error && Boolean(data && !data.is_blocked &&
    (data.system_role === "procurement" ||
      data.admin_level === "admin" || data.admin_level === "senior_admin"));
}

async function syncSales(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Нет прав на загрузку WB" }, { status: 403 });
  }

  const token = (await getIntegrationSecret("wb_read_token"))?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "WB_READ_TOKEN не настроен" }, { status: 503 });
  }

  const today = localDay(new Date(), "Asia/Krasnoyarsk");
  const yesterday = shiftDay(today, -1);
  const db = createAdminClient();

  // Resume incomplete paginated backfills across calendar days. Never mark
  // a newer day complete while an older 80k-row page is still outstanding.
  const { data: unfinished, error: unfinishedError } = await db
    .from("china_wb_operational_jobs").select("*")
    .in("status", ["waiting", "rate_limited", "failed"])
    .not("cursor", "is", null)
    .order("job_day", { ascending: true }).limit(1).maybeSingle();
  if (unfinishedError) throw new Error("WB: невозможно прочитать незавершённую выгрузку");

  const jobDay: string = unfinished?.job_day ?? today;
  const target: string = unfinished?.date_to ?? yesterday;
  const fromDay: string = unfinished?.date_from ?? shiftDay(target, -34);

  const { data: current, error: currentError } = unfinished
    ? { data: unfinished, error: null }
    : await db.from("china_wb_operational_jobs").select("*")
        .eq("job_day", jobDay).maybeSingle();
  if (currentError) throw new Error("WB: невозможно прочитать состояние загрузки: " + currentError.message);

  if (current?.status === "complete") {
    return NextResponse.json({
      ok: true, reused: true, dateFrom: current.date_from, dateTo: current.date_to,
      savedFbw: current.fbw_rows, rawRows: current.rows_seen,
      source: "supplier_sales", message: "Оперативная выгрузка WB уже завершена за сегодня",
    });
  }

  // Atomic lock + a conservative account-wide rate-limit budget.
  const now = new Date(), nextAllowed = new Date(now.getTime() + RATE_LIMIT_MS);
  const { data: acquired, error: lockError } = await db.from("wb_sync_state")
    .update({
      last_attempt_at: now.toISOString(),
      next_allowed_at: nextAllowed.toISOString(),
      last_message: "China WB operational supplier sales request",
      updated_at: now.toISOString(),
    })
    .eq("sync_key", "china_supplier_sales")
    .or("next_allowed_at.is.null,next_allowed_at.lt." + now.toISOString())
    .select("sync_key").maybeSingle();

  if (lockError) throw new Error("WB: ошибка ограничения частоты: " + lockError.message);
  if (!acquired) {
    const { data: state } = await db.from("wb_sync_state")
      .select("next_allowed_at,last_message")
      .eq("sync_key", "china_supplier_sales").maybeSingle();
    return NextResponse.json({
      ok: false, retryAt: state?.next_allowed_at ?? null,
      error: "WB: действует пауза между запросами. Повторять запрос сейчас нельзя.",
    }, { status: 409 });
  }

  const cursor = current?.cursor || null;
  const dateFrom = cursor ?? fromDay + "T00:00:00+03:00";
  const { error: beginError } = await db.from("china_wb_operational_jobs")
    .upsert({
      job_day: jobDay, date_from: fromDay, date_to: target,
      status: "running", cursor,
      rows_seen: Number(current?.rows_seen ?? 0),
      fbw_rows: Number(current?.fbw_rows ?? 0),
      last_error: null, updated_at: now.toISOString(),
    }, { onConflict: "job_day" });
  if (beginError) throw new Error("WB: невозможно создать операционную загрузку: " + beginError.message);

  try {
    const url = new URL(SALES_URL);
    url.searchParams.set("dateFrom", dateFrom);
    url.searchParams.set("flag", "0");

    const response = await fetch(url, {
      headers: { Authorization: token, Accept: "application/json" },
      method: "GET", cache: "no-store", signal: AbortSignal.timeout(75_000),
    });

    if (response.status === 429) {
      const retry = Number(response.headers.get("X-Ratelimit-Retry") ??
        response.headers.get("Retry-After"));
      const waitMs = Math.max(RATE_LIMIT_MS,
        Number.isFinite(retry) && retry > 0 ? (Math.ceil(retry) + 15) * 1000 : 0);
      const until = new Date(Date.now() + waitMs).toISOString();
      await db.from("wb_sync_state").update({
        next_allowed_at: until, last_http_status: 429,
        last_message: "WB supplier/sales: HTTP 429", updated_at: new Date().toISOString(),
      }).eq("sync_key", "china_supplier_sales");
      await db.from("china_wb_operational_jobs").update({
        status: "rate_limited", last_error: "HTTP 429", updated_at: new Date().toISOString(),
      }).eq("job_day", jobDay);
      return NextResponse.json({
        ok: false, retryAt: until,
        error: "Wildberries ограничил запросы (429). Пауза сохранена, данные не объявлены полными.",
      }, { status: 429 });
    }

    if (!response.ok) {
      throw new Error("WB supplier/sales HTTP " + response.status +
        ": " + (await response.text()).slice(0, 180));
    }

    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) throw new Error("WB: продажи вернулись не массивом");
    // An unexpectedly empty initial 35-day window is not evidence of 28 days of zero sales.
    if (raw.length === 0 && !cursor) {
      throw new Error("WB: пустой начальный ответ. 28-дневный период не подтверждён.");
    }

    const { data: mapped, error: mappedError } = await db.from("marketplace_listings")
      .select("external_id")
      .eq("account_key", "main").eq("marketplace", "wildberries")
      .eq("is_active", true).eq("china_procurement_enabled", true);
    if (mappedError) throw new Error("WB: не загрузились привязки ЕНОТ");
    const mappedIds = new Set((mapped ?? []).map(x => String(x.external_id)));

    const normalized = new Map<string, NormalizedSale>();
    const unknownIds = new Set<string>();
    let fbsIgnored = 0, otherEvents = 0;
    for (const value of raw as WbSale[]) {
      if (!value || typeof value !== "object") throw new Error("WB: некорректная строка");
      const saleId = typeof value.saleID === "string" ? value.saleID.trim() : "";
      if (!/^[SR]/.test(saleId)) {
        // D is a supplementary payment, not a sale or a return.
        otherEvents++;
        continue;
      }
      if (value.warehouseType === "Склад продавца") {
        fbsIgnored++;
        continue;
      }
      if (value.warehouseType !== "Склад WB") {
        throw new Error("WB: неизвестный тип склада у продажи " + saleId.slice(0, 12));
      }
      const nmId = Number(value.nmId);
      if (!saleId || !Number.isSafeInteger(nmId) || nmId <= 0) {
        throw new Error("WB: некорректный saleID или nmId");
      }
      const sale = moscowDate(value.date);
      const changed = moscowDate(value.lastChangeDate);
      const id = String(nmId);
      if (!mappedIds.has(id)) unknownIds.add(id);
      const row: NormalizedSale = {
        sale_id: saleId, nm_id: nmId,
        srid: typeof value.srid === "string" ? value.srid : null,
        sale_day: localDay(sale, "Europe/Moscow"),
        last_change_at: changed.toISOString(), is_return: saleId.startsWith("R"),
        updated_at: new Date().toISOString(),
      };
      const previous = normalized.get(saleId);
      if (!previous || row.last_change_at >= previous.last_change_at) {
        normalized.set(saleId, row);
      }
    }

    const entries = [...normalized.values()];
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const { error: saveError } = await db.from("china_wb_operational_sales")
        .upsert(entries.slice(i, i + CHUNK_SIZE), { onConflict: "sale_id" });
      if (saveError) throw new Error("WB: сохранение продаж: " + saveError.message);
    }

    const rowsSeen = Number(current?.rows_seen ?? 0) + raw.length;
    const savedFbw = Number(current?.fbw_rows ?? 0) + entries.length;

    if (raw.length >= PAGE_LIMIT) {
      // WB's 80,000-row cap requires a new request from lastChangeDate.
      // Move the cursor back one second to avoid a boundary timestamp gap;
      // saleID upsert handles the overlap on the next permitted invocation.
      const last = raw[raw.length - 1] as WbSale;
      const lastDate = moscowDate(last.lastChangeDate);
      const nextCursor = new Date(lastDate.getTime() - 1000).toISOString();
      await db.from("china_wb_operational_jobs").update({
        status: "waiting", cursor: nextCursor, rows_seen: rowsSeen,
        fbw_rows: savedFbw, updated_at: new Date().toISOString(),
      }).eq("job_day", jobDay);
      return NextResponse.json({
        ok: true, complete: false, waiting: true, dateFrom: fromDay, dateTo: target,
        rawRows: rowsSeen, savedFbw, retryAt: nextAllowed.toISOString(),
        message: "WB: сохранена часть данных, ожидается следующая страница после лимита.",
      });
    }

    await db.from("china_wb_operational_jobs").update({
      rows_seen: rowsSeen, fbw_rows: savedFbw,
      updated_at: new Date().toISOString(),
    }).eq("job_day", jobDay);
    const { data: covered, error: finishError } = await db
      .rpc("china_finish_wb_operational_import", {
        p_job_day: jobDay, p_date_from: fromDay, p_date_to: target,
      });
    if (finishError) throw new Error("WB: нельзя отметить период полным: " + finishError.message);

    console.info("[CHINA WB OPERATIONAL] complete", {
      day: target, daysCovered: covered, rawRows: rowsSeen,
      fbwEvents: savedFbw, unmappedNmIds: unknownIds.size,
      fbsIgnored, otherEvents,
    });
    return NextResponse.json({
      ok: true, complete: true, source: "supplier_sales",
      dateFrom: fromDay, dateTo: target, daysCovered: Number(covered),
      rawRows: rowsSeen, savedFbw, fbsIgnored, otherEvents,
      unmappedNmIds: unknownIds.size,
      message: "Оперативные продажи WB сохранены. Для обновления закупки нажмите «Рассчитать потребность».",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CHINA WB OPERATIONAL]", message);
    await db.from("china_wb_operational_jobs").update({
      status: "failed", last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("job_day", jobDay);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  return syncSales(request);
}

export async function POST(request: NextRequest) {
  return syncSales(request);
}
