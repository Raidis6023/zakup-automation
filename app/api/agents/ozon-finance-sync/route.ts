import { getOzonCredentials } from "../../../../lib/integrations/secrets";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { accrualTypeId } from "../../../../lib/ozon/accrual-type";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACCOUNT = "main";
const API_BASE = "https://api-seller.ozon.ru";
const PAGE_LIMIT = 2500;
const LEASE_SECONDS = 90;
type AdminDB = ReturnType<typeof createAdminClient>;

type Job = {
  account_key: string;
  day: string;
  run_id: string;
  status: "running" | "complete" | "failed";
  last_id: string;
  pages_completed: number;
  rows_saved: number;
  lease_token: string | null;
  lease_until: string | null;
  last_error: string | null;
};
type OzonRow = {
  accrued_category?: string;
  type_id?: string | number;
  non_item_fee?: {type_id?:string|number};
  unit_number?: string;
  total_amount?: { amount?: string; currency?: string };
  posting?: { products?: Array<{ sku?: string | number }> };
  item_fees?: { fees?: Array<{ sku?: string | number; fees?:Array<{type_id?:string|number}> }> };
  [key: string]: unknown;
};
type Page = { accruals?: OzonRow[]; last_id?: string };

function result(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 450) : "Неизвестная ошибка";
}
function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(day + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day &&
    day <= new Date().toISOString().slice(0, 10);
}
async function admin(request?: NextRequest) {
  // Dedicated scheduler may run without a browser session, only with a
  // secret not exposed to clients. Users still need an authenticated admin.
  if (request && process.env.CRON_SECRET && request.headers.get("authorization") ===
      "Bearer " + process.env.CRON_SECRET) return createAdminClient();
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return null;
  const db = createAdminClient();
  const { data: access, error: accessError } = await db
    .from("app_user_access").select("admin_level,is_blocked")
    .eq("user_id", user.id).maybeSingle();
  if (accessError || !access || access.is_blocked ||
      !["admin", "senior_admin"].includes(access.admin_level || "")) return null;
  return db;
}
async function fetchPage(day: string, cursor: string): Promise<Page> {
  const {sellerClientId:clientId,sellerApiKey:apiKey}=await getOzonCredentials();
  if (!clientId || !apiKey) throw new Error("Отсутствуют ключи Seller API в Vercel");
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(API_BASE + "/v1/finance/accrual/by-day", {
        method: "POST",
        headers: { "Client-Id": clientId, "Api-Key": apiKey,
          "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ date: day, last_id: cursor }),
        cache: "no-store",
        signal: AbortSignal.timeout(22000),
      });
    } catch (error) {
      if (attempt === 0) continue;
      throw new Error("Ozon API не ответил за 22 секунды: " + safeError(error));
    }
    if ((response.status === 429 || response.status >= 500) && attempt === 0) {
      await new Promise(r => setTimeout(r, 1600));
      continue;
    }
    if (!response.ok) {
      const details = await response.text();
      throw new Error("Ozon начисления за " + day + ": HTTP " + response.status +
        " — " + details.slice(0, 220));
    }
    const page = await response.json() as Page;
    if (!Array.isArray(page.accruals) || typeof page.last_id !== "string") {
      throw new Error("Ozon вернул некорректную структуру начислений. Данные не сохранены.");
    }
    return page;
  }
  throw new Error("Не удалось загрузить страницу Ozon после повторной попытки");
}
function money(row: OzonRow): string {
  const amount = String(row.total_amount?.amount ?? "0").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error("Некорректная сумма начисления Ozon");
  }
  if (row.total_amount?.currency && row.total_amount.currency !== "RUB") {
    throw new Error("Получено начисление Ozon в валюте, отличной от RUB");
  }
  return amount;
}
function extractSku(row: OzonRow): string | null {
  const skus = [
    ...(row.posting?.products ?? []).map(p => p.sku),
    ...(row.item_fees?.fees ?? []).map(p => p.sku),
  ].map(v => String(v ?? "").trim()).filter(v => v && v !== "0");
  const unique = [...new Set(skus)];
  return unique.length === 1 ? unique[0] : null;
}
function publicProgress(job: Job) {
  return { day: job.day, pages_completed: job.pages_completed,
    rows_saved: job.rows_saved, status: job.status,
    resumable: true, last_error: job.last_error };
}
async function getJob(db: AdminDB, day: string) {
  const { data, error } = await db.from("ozon_finance_page_jobs")
    .select("*").eq("account_key", ACCOUNT).eq("day", day).maybeSingle();
  if (error) throw error;
  return data as Job | null;
}
async function ensureJob(db: AdminDB, day: string): Promise<Job> {
  let job = await getJob(db, day);
  if (!job) {
    const { error } = await db.from("ozon_finance_page_jobs").upsert({
      account_key: ACCOUNT, day, run_id: randomUUID(),
      status: "running", last_id: "", pages_completed: 0, rows_saved: 0,
    }, { onConflict: "account_key,day", ignoreDuplicates: true });
    if (error) throw error;
    job = await getJob(db, day);
  }
  if (!job) throw new Error("Не удалось создать контрольную запись синхронизации");
  return job;
}
async function checkLease(db: AdminDB, job: Job, token: string): Promise<boolean> {
  const expires = new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
  let query = db.from("ozon_finance_page_jobs").update({
    lease_token: token, lease_until: expires, last_error: null,
    status: "running", updated_at: new Date().toISOString(),
  }).eq("account_key", ACCOUNT).eq("day", job.day)
    .eq("run_id", job.run_id).eq("pages_completed", job.pages_completed);
  // Optimistic compare-and-swap blocks simultaneous tabs and stale functions.
  query = job.lease_token === null ? query.is("lease_token", null) :
    query.eq("lease_token", job.lease_token);
  const { data, error } = await query.select("run_id");
  if (error) throw error;
  return !!data?.length;
}
async function releaseError(db: AdminDB, job: Job, token: string, message: string) {
  const { error } = await db.from("ozon_finance_page_jobs").update({
    status: "failed", last_error: message.slice(0, 450),
    lease_token: null, lease_until: null, updated_at: new Date().toISOString(),
  }).eq("account_key", ACCOUNT).eq("day", job.day)
    .eq("run_id", job.run_id).eq("lease_token", token);
  if (error) console.error("Ozon finance checkpoint release failed:", error.message);
}
async function restartCompleted(db: AdminDB, job: Job): Promise<Job> {
  const { data, error } = await db.from("ozon_finance_page_jobs").update({
    run_id: randomUUID(), last_id: "", status: "running",
    pages_completed: 0, rows_saved: 0,
    lease_token: null, lease_until: null,
    last_error: null, started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(), completed_at: null,
  }).eq("account_key", ACCOUNT).eq("day", job.day)
    .eq("run_id", job.run_id).eq("status", "complete").select("*").maybeSingle();
  if (error) throw error;
  return (data ?? await getJob(db, job.day)) as Job;
}
async function syncPage(db: AdminDB, day: string, restart: boolean) {
  let job = await ensureJob(db, day);
  if (job.status === "complete" && restart) job = await restartCompleted(db, job);
  if (job.status === "complete") return result({ ok: true, ...publicProgress(job), done: true });
  if (job.pages_completed >= PAGE_LIMIT) return result({
    ok: false, error: "Защитный предел 2500 страниц. Требуется проверить выгрузку.", ...publicProgress(job),
  }, 409);

  const locked = job.lease_token && job.lease_until && Date.parse(job.lease_until) > Date.now();
  if (locked) return result({ ok: true, ...publicProgress(job), busy: true,
    message: "Предыдущая страница ещё обрабатывается. Ожидаем сохранения." });

  const leaseToken = randomUUID();
  if (!await checkLease(db, job, leaseToken)) {
    const updated = await ensureJob(db, day);
    return result({ ok: true, ...publicProgress(updated), busy: true });
  }
  try {
    const page = await fetchPage(day, job.last_id);
    const nextCursor = page.last_id;
    if (nextCursor && nextCursor === job.last_id) {
      throw new Error("Ozon повторил курсор: остановлено во избежание дубликатов");
    }
    if (!page.accruals!.length && nextCursor) {
      throw new Error("Ozon вернул пустую страницу с курсором: остановлено во избежание бесконечного цикла");
    }
    const data = page.accruals!.map((entry, index) => ({
      account_key: ACCOUNT, day, run_id: job.run_id,
      row_index: job.rows_saved + index, amount: money(entry),
      type_id: accrualTypeId(entry),
      accrued_category: entry.accrued_category ?? null,
      unit_number: entry.unit_number ?? null,
      sku: extractSku(entry), raw: entry,
    }));
    for (let index = 0; index < data.length; index += 160) {
      const { error } = await db.from("ozon_finance_accruals")
        .upsert(data.slice(index, index + 160), { onConflict: "run_id,row_index" });
      if (error) throw new Error("Supabase не сохранил страницу: " + error.message);
    }

    // At publication time the entire day has been stored. If this step fails,
    // the next call replays only the last page; upsert prevents duplicates.
    const completed = !nextCursor;
    const rowsSaved = job.rows_saved + data.length;
    if (completed) {
      const {count:actualCount,error:countError}=await db
        .from("ozon_finance_accruals")
        .select("row_index",{head:true,count:"exact"})
        .eq("account_key",ACCOUNT).eq("day",day).eq("run_id",job.run_id);
      if(countError)throw new Error("Не удалось проверить полноту финансового дня: "+countError.message);
      if(actualCount!==rowsSaved)
        throw new Error("Начисления Ozon неполные: ожидали "+rowsSaved+
          ", сохранено "+actualCount+". День не опубликован.");
      const { error: publishError } = await db.from("ozon_finance_sync_days").upsert({
        account_key: ACCOUNT, day, active_run_id: job.run_id,
        record_count: rowsSaved, synced_at: new Date().toISOString(),
      }, { onConflict: "account_key,day" });
      if (publishError) throw new Error("Ошибка публикации дня: " + publishError.message);
    }

    const { data: updated, error: updateError } = await db
      .from("ozon_finance_page_jobs").update({
        last_id: nextCursor, pages_completed: job.pages_completed + 1,
        rows_saved: rowsSaved, lease_token: null, lease_until: null,
        status: completed ? "complete" : "running",
        completed_at: completed ? new Date().toISOString() : null,
        last_error: null, updated_at: new Date().toISOString(),
      }).eq("account_key", ACCOUNT).eq("day", day)
      .eq("run_id", job.run_id).eq("lease_token", leaseToken)
      .eq("pages_completed", job.pages_completed).select("*").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) throw new Error("Страница сохранена, но контрольная запись устарела. Повторите запрос.");
    if(completed) {
      // The previous version remains published until all new pages
      // are verified. Only then may obsolete generations be cleaned.
      const {error:cleanupError}=await db.rpc("ozon_finance_cleanup_generations",{
        p_day:day,p_account:ACCOUNT
      });
      if(cleanupError)console.warn("Deferred ledger generation cleanup:",
        cleanupError.message.slice(0,180));
    }
    return result({
      ok: true, ...publicProgress(updated as Job), done: completed,
      page_rows: data.length, resume_next: !completed,
    });
  } catch (error) {
    const message = safeError(error);
    await releaseError(db, job, leaseToken, message);
    return result({ ok: false, error: message, day,
      saved_before_failure: job.rows_saved,
      resume_supported: true }, 502);
  }
}
export async function POST(request: NextRequest) {
  const db = await admin(request);
  if (!db) return result({ ok: false, error: "Доступ разрешён только администраторам" }, 403);
  try {
    const input = await request.json() as { day?: string; restart?: boolean };
    if (!input.day || !validDay(input.day)) return result({
      ok: false, error: "Выберите корректную дату начислений Ozon"
    }, 400);
    return await syncPage(db, input.day, input.restart === true);
  } catch (error) {
    return result({ ok: false, error: safeError(error) }, 500);
  }
}
export async function GET(request: NextRequest) {
  try {
    const started = Date.now();
    // Protected diagnostics: exactly the same permissions as importing finance.
    const db = await Promise.race([
      admin(),
      new Promise<null>((_, reject) => setTimeout(
        () => reject(new Error("Авторизация Supabase не ответила за 10 секунд")), 10000
      )),
    ]);
    if (!db) return result({ ok: false, stage: "authorization",
      error: "Доступ разрешён только администраторам" }, 403);
    if (new URL(request.url).searchParams.get("diagnostics") === "1") {
      const projectRef = (() => {
        try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0]; }
        catch { return "invalid"; }
      })();
      const database = await Promise.race([
        db.from("ozon_finance_page_jobs").select("day", { count: "exact", head: true }),
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("Контрольная таблица Supabase не ответила за 10 секунд")), 10000
        )),
      ]);
      if (database.error) return result({
        ok: false, stage: "database", project_ref: projectRef,
        error: "Контрольная таблица недоступна: " + database.error.message.slice(0,220),
      }, 503);
      const ozonCredentials = await getOzonCredentials();
      return result({
        ok: true, stage: "ready", project_ref: projectRef,
        credentials: { seller_id_present: !!ozonCredentials.sellerClientId,
          seller_api_key_present: !!ozonCredentials.sellerApiKey },
        checkpoint_records: database.count ?? 0,
        server_latency_ms: Date.now() - started,
        note: "Браузер, Vercel и Supabase доступны. Сервис Ozon ещё не проверялся.",
      });
    }
    const day = new URL(request.url).searchParams.get("day");
    if (!day || !validDay(day)) return result({ ok: false, error: "Неверная дата" }, 400);
    const job = await getJob(db, day);
    return result({ ok: true, job: job ? publicProgress(job) : null });
  } catch (error) {
    return result({ ok: false, stage: "server", error: safeError(error) }, 503);
  }
}
