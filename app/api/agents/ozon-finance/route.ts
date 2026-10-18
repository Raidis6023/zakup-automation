import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ACCOUNT = "main";
const MAX_DAYS = 31;
const API = "https://api-seller.ozon.ru";

type Entry = {
  accrued_category?: string;
  date?: string;
  type_id?: string | number;
  unit_number?: string;
  total_amount?: { amount?: string; currency?: string };
  posting?: { products?: Array<{ sku?: string | number }> };
  item_fees?: { fees?: Array<{ sku?: string | number }> };
};
type ReportLine = {
  sku: string | null;
  type_id: string | null;
  accrued_category: string | null;
  amount: number | string;
  item_count: number;
};
type Cost = { master_code: string; valid_from: string; unit_cost_rub: number };
type Product = { offer_id: string | null; master_code: string | null; name: string | null };
type MapRow = { sku: string; offer_id: string | null; master_code: string | null };
type Manager = { master_code: string; manager_name: string };
type Sold = { master_code: string; sold_units: number };
type Group = {
  offer_id: string;
  master_code: string | null;
  name: string | null;
  manager: string;
  ozon_amount: number;
  sold_units: number | null;
  unit_cost: number | null;
  cogs: number | null;
  estimated_result: number | null;
  details: Array<{ type_id: string; name: string; amount: number; count: number }>;
};

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}
function dateRange(from: string, to: string): string[] {
  if (!validDate(from) || !validDate(to) || from > to) throw new Error("Некорректный период");
  const start = Date.parse(from + "T00:00:00Z");
  const end = Date.parse(to + "T00:00:00Z");
  const days = Math.round((end - start) / 86400000) + 1;
  if (days > MAX_DAYS || days < 1) throw new Error("Выберите период не более 31 дня");
  return Array.from({ length: days }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}
function amountOf(money: unknown): string {
  if (!money || typeof money !== "object") return "0";
  const obj = money as { amount?: unknown; currency?: string };
  if (obj.currency && obj.currency !== "RUB") throw new Error("Начисление не в RUB");
  const str = String(obj.amount ?? "0");
  if (!/^-?\d+(\.\d+)?$/.test(str)) throw new Error("Некорректная сумма начисления");
  return str;
}
function asNumber(v: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) throw new Error("Некорректное числовое значение");
  return n;
}
function round(v: number): number { return Math.round((v + Number.EPSILON) * 100) / 100; }
function uniqSkus(row: Entry): string[] {
  const candidates = [
    ...(row.posting?.products ?? []).map(x => x.sku),
    ...(row.item_fees?.fees ?? []).map(x => x.sku),
  ];
  return Array.from(new Set(candidates.map(x => String(x ?? "").trim()).filter(x => x && x !== "0")));
}
async function requireFinanceAccess() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return null;
  const { data: rights, error: rightsError } = await session
    .from("app_user_access").select("admin_level,is_blocked").eq("user_id", user.id).maybeSingle();
  if (rightsError || !rights || rights.is_blocked || !["admin", "senior_admin"].includes(rights.admin_level ?? "")) return null;
  return createAdminClient();
}
async function ozonPost<T>(path: string, body: unknown): Promise<T> {
  const client = process.env.OZON_CLIENT_ID;
  const key = process.env.OZON_API_KEY;
  if (!client || !key) throw new Error("Не настроены ключи Ozon в Vercel");
  let last = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(API + path, {
        method: "POST", cache: "no-store",
        headers: { "Client-Id": client, "Api-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
      });
      const bodyText = await response.text();
      if (response.status === 429 || response.status >= 500) {
        last = "Ozon HTTP " + response.status;
        if (attempt < 4) { await new Promise(r => setTimeout(r, 1300 * (attempt + 1))); continue; }
      }
      if (!response.ok) throw new Error("Ozon " + path + " HTTP " + response.status + ": " + bodyText.slice(0, 350));
      return JSON.parse(bodyText) as T;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      if (attempt === 4 || /HTTP 40[01346789]/.test(last)) break;
      await new Promise(r => setTimeout(r, 1300 * (attempt + 1)));
    }
  }
  throw new Error(last || "Ошибка Ozon API");
}
async function syncMappings(db: ReturnType<typeof createAdminClient>, skus: string[]) {
  if (!skus.length) return;
  const existing = new Set<string>();
  for (let i = 0; i < skus.length; i += 500) {
    const { data, error } = await db.from("ozon_finance_sku_map").select("sku,offer_id")
      .eq("account_key", ACCOUNT).in("sku", skus.slice(i, i + 500));
    if (error) throw error;
    for (const row of data ?? []) if (row.offer_id) existing.add(row.sku);
  }
  const missing = skus.filter(s => !existing.has(s));
  for (let i = 0; i < missing.length; i += 500) {
    const resp = await ozonPost<{ items?: Array<{ sku?: string | number; offer_id?: string }> }>(
      "/v3/product/info/list", { sku: missing.slice(i, i + 500) });
    const info = resp.items ?? [];
    const offers = [...new Set(info.map(p => p.offer_id).filter((x): x is string => !!x))];
    const byOffer = new Map<string, string | null>();
    for (let j = 0; j < offers.length; j += 500) {
      const { data, error } = await db.from("products").select("offer_id,master_code")
        .in("offer_id", offers.slice(j, j + 500));
      if (error) throw error;
      for (const p of data ?? []) if (p.offer_id) byOffer.set(p.offer_id, p.master_code);
    }
    const mapped = info.filter(p => p.sku != null).map(p => ({
      account_key: ACCOUNT, sku: String(p.sku), offer_id: p.offer_id || null,
      master_code: p.offer_id ? byOffer.get(p.offer_id) ?? null : null,
      synced_at: new Date().toISOString(),
    }));
    if (mapped.length) {
      const { error } = await db.from("ozon_finance_sku_map").upsert(mapped, { onConflict: "account_key,sku" });
      if (error) throw error;
    }
  }
}
async function syncTypes(db: ReturnType<typeof createAdminClient>) {
  const { count, error } = await db.from("ozon_finance_types").select("type_id", { head: true, count: "exact" });
  if (error) throw error;
  if ((count ?? 0) > 0) return;
  const result = await ozonPost<{ accrual_types?: Array<{ id?: string | number; name?: string; description?: string }> }>(
    "/v1/finance/accrual/types", {});
  const rows = (result.accrual_types ?? []).filter(t => t.id != null).map(t => ({
    type_id: String(t.id), name: t.name ?? "", description: t.description ?? "",
  }));
  if (rows.length) {
    const { error: insertError } = await db.from("ozon_finance_types").upsert(rows, { onConflict: "type_id" });
    if (insertError) throw insertError;
  }
}
async function syncOneDay(db: ReturnType<typeof createAdminClient>, day: string) {
  dateRange(day, day);
  if (day > new Date().toISOString().slice(0, 10)) throw new Error("Нельзя загрузить будущую дату");
  const runId = randomUUID();
  let cursor = "";
  const seen = new Set<string>();
  const rows: Array<{ run_id: string; account_key: string; day: string; row_index: number;
    amount: string; type_id: string | null; accrued_category: string | null;
    unit_number: string | null; sku: string | null; raw: Entry }> = [];
  for (let page = 0; page < 250; page++) {
    const resp = await ozonPost<{ accruals?: Entry[]; last_id?: string }>(
      "/v1/finance/accrual/by-day", { date: day, last_id: cursor });
    for (const accrual of resp.accruals ?? []) {
      const skus = uniqSkus(accrual);
      rows.push({
        run_id: runId, account_key: ACCOUNT, day, row_index: rows.length,
        amount: amountOf(accrual.total_amount), type_id: accrual.type_id == null ? null : String(accrual.type_id),
        accrued_category: accrual.accrued_category ?? null,
        unit_number: accrual.unit_number ?? null,
        sku: skus.length === 1 ? skus[0] : null, raw: accrual,
      });
    }
    const next = String(resp.last_id ?? "");
    if (!next) {
      // Map unique SKUs BEFORE publishing this successful generation.
      const skus = [...new Set(rows.map(r => r.sku).filter((s): s is string => !!s))];
      await syncMappings(db, skus);
      try { await syncTypes(db); } catch (e) { console.warn("Ozon finance type dictionary:", e); }
      for (let i = 0; i < rows.length; i += 300) {
        const { error } = await db.from("ozon_finance_accruals").insert(rows.slice(i, i + 300));
        if (error) throw error;
      }
      const { error } = await db.from("ozon_finance_sync_days").upsert({
        account_key: ACCOUNT, day, active_run_id: runId,
        record_count: rows.length, synced_at: new Date().toISOString(),
      }, { onConflict: "account_key,day" });
      if (error) throw error;
      return { day, rows: rows.length, pages: page + 1 };
    }
    if (seen.has(next) || next === cursor) throw new Error("Ozon вернул повторный курсор: загрузка прервана");
    seen.add(next); cursor = next;
    await new Promise(r => setTimeout(r, 180));
  }
  throw new Error("Превышено 250 страниц начислений: день не опубликован");
}
async function buildReport(db: ReturnType<typeof createAdminClient>, from: string, to: string) {
  const days = dateRange(from, to);
  const [syncRes, ledgerRes, mappingsRes, costsRes, managersRes, soldRes, salesRunsRes, typesRes, productsRes] =
    await Promise.all([
      db.from("ozon_finance_sync_days").select("day,record_count,synced_at").eq("account_key", ACCOUNT)
        .gte("day", from).lte("day", to),
      db.rpc("ozon_finance_report", { p_from: from, p_to: to, p_account_key: ACCOUNT }),
      db.from("ozon_finance_sku_map").select("sku,offer_id,master_code").eq("account_key", ACCOUNT),
      db.from("ozon_finance_costs").select("master_code,valid_from,unit_cost_rub").lte("valid_from", to).order("valid_from"),
      db.from("ozon_finance_managers").select("master_code,manager_name"),
      db.rpc("ozon_finance_sold_units", { p_from: from, p_to: to }),
      db.from("ozon_sales_sync_runs").select("date_from,date_to").eq("status", "success")
        .lte("date_from", from).gte("date_to", to).limit(1),
      db.from("ozon_finance_types").select("type_id,description,name"),
      db.from("products").select("offer_id,master_code,name").limit(2000),
    ]);
  for (const item of [syncRes, ledgerRes, mappingsRes, costsRes, managersRes, soldRes, salesRunsRes, typesRes, productsRes]) {
    if (item.error) throw item.error;
  }
  const loaded = new Set((syncRes.data ?? []).map(r => r.day));
  const missingDays = days.filter(d => !loaded.has(d));
  const mapBySku = new Map((mappingsRes.data as MapRow[] ?? []).map(r => [r.sku, r]));
  const productByOffer = new Map((productsRes.data as Product[] ?? []).filter(p => p.offer_id).map(p => [p.offer_id!, p]));
  const managers = new Map((managersRes.data as Manager[] ?? []).map(r => [r.master_code, r.manager_name]));
  const sold = new Map((soldRes.data as Sold[] ?? []).map(r => [r.master_code, Number(r.sold_units)]));
  const types = new Map((typesRes.data ?? []).map(r => [r.type_id, r.description || r.name || r.type_id]));
  const costHistory = new Map<string, Cost[]>();
  for (const c of costsRes.data as Cost[] ?? []) {
    const arr = costHistory.get(c.master_code) ?? [];
    arr.push(c); costHistory.set(c.master_code, arr);
  }
  const byOffer = new Map<string, Group>();
  let unallocated = 0, totalLedger = 0, operationCount = 0;
  const unallocatedDetails = new Map<string, number>();
  for (const line of ledgerRes.data as ReportLine[] ?? []) {
    const amount = Number(line.amount);
    totalLedger += amount; operationCount += Number(line.item_count);
    const m = line.sku ? mapBySku.get(line.sku) : null;
    const offer = m?.offer_id;
    const master = m?.master_code || (offer ? productByOffer.get(offer)?.master_code : null) || null;
    const typeId = line.type_id || line.accrued_category || "unknown";
    if (!offer || !master) {
      unallocated += amount;
      const name = types.get(typeId) || typeId;
      unallocatedDetails.set(name, (unallocatedDetails.get(name) ?? 0) + amount);
      continue;
    }
    let g = byOffer.get(offer);
    if (!g) {
      g = { offer_id: offer, master_code: master,
        name: productByOffer.get(offer)?.name ?? null,
        manager: managers.get(master) || "Не назначен",
        ozon_amount: 0, sold_units: null, unit_cost: null, cogs: null,
        estimated_result: null, details: [] };
      byOffer.set(offer, g);
    }
    g.ozon_amount += amount;
    const name = types.get(typeId) || typeId;
    g.details.push({ type_id: typeId, name, amount, count: Number(line.item_count) });
  }
  // Existing 28-day sales table gives only a preliminary COGS quantity.
  const salesWindowCovered = (salesRunsRes.data ?? []).length > 0;
  for (const g of byOffer.values()) {
    g.ozon_amount = round(g.ozon_amount);
    const history = costHistory.get(g.master_code!) ?? [];
    const validCosts = history.filter(c => c.valid_from <= from);
    const changedDuringPeriod = history.some(c => c.valid_from > from && c.valid_from <= to);
    const chosen = validCosts.at(-1);
    if (chosen && !changedDuringPeriod) g.unit_cost = Number(chosen.unit_cost_rub);
    // A master_code can have multiple offer_ids. Never repeat total COGS on every listing.
    // COGS is only calculated after granular posting quantities are available.
    g.sold_units = salesWindowCovered ? (sold.get(g.master_code!) ?? 0) : null;
    g.cogs = null;
    g.estimated_result = null;
    g.details = g.details.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }
  return {
    from, to, synced_days: loaded.size, total_days: days.length, missing_days: missingDays,
    operation_count: operationCount,
    ledger_amount: round(totalLedger), allocated_amount: round(totalLedger - unallocated),
    unallocated_amount: round(unallocated),
    sales_window_covered: salesWindowCovered,
    profit_status: "not_verified",
    warning: "Начисления Ozon проверяются по общей сумме. Прибыль не публикуется, пока не подтверждены количества выкупов и себестоимость по каждому размещению.",
    rows: Array.from(byOffer.values()).sort((a, b) => a.ozon_amount - b.ozon_amount),
    unallocated_details: [...unallocatedDetails.entries()]
      .map(([name, sum]) => ({ name, amount: round(sum) }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
  };
}
function fail(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ ok: false, error: message }, { status });
}
export async function GET(request: NextRequest) {
  const db = await requireFinanceAccess();
  if (!db) return fail("Доступ к финансовым данным разрешён только администраторам", 403);
  const url = new URL(request.url);
  try {
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    return NextResponse.json({ ok: true, ...(await buildReport(db, from, to)) });
  } catch (e) { return fail(e, 400); }
}
export async function POST(request: NextRequest) {
  const db = await requireFinanceAccess();
  if (!db) return fail("Доступ к финансовым данным разрешён только администраторам", 403);
  try {
    const payload = await request.json() as Record<string, unknown>;
    if (payload.action === "syncDay") {
      const day = String(payload.day ?? "");
      return NextResponse.json({ ok: true, ...(await syncOneDay(db, day)) });
    }
    if (payload.action === "saveProduct") {
      const master = String(payload.master_code ?? "").trim();
      if (!/^[A-Za-zА-Яа-яЁё0-9._-]{1,80}$/.test(master)) return fail("Некорректный master_code", 400);
      if (payload.manager !== undefined) {
        const manager = String(payload.manager ?? "").trim();
        if (manager.length > 80) return fail("Слишком длинное имя КМ", 400);
        const { error } = manager
          ? await db.from("ozon_finance_managers").upsert({ master_code: master, manager_name: manager }, { onConflict: "master_code" })
          : await db.from("ozon_finance_managers").delete().eq("master_code", master);
        if (error) throw error;
      }
      if (payload.cost !== undefined) {
        const c = Number(payload.cost), validFrom = String(payload.valid_from ?? "");
        if (!Number.isFinite(c) || c < 0 || c > 1e9 || !validDate(validFrom))
          return fail("Некорректная себестоимость или дата", 400);
        const { error } = await db.from("ozon_finance_costs").upsert({
          master_code: master, valid_from: validFrom, unit_cost_rub: c, updated_at: new Date().toISOString(),
        }, { onConflict: "master_code,valid_from" });
        if (error) throw error;
      }
      return NextResponse.json({ ok: true });
    }
    if (payload.action === "analyze") {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return fail("Для ИИ-анализа добавьте OPENAI_API_KEY в переменные Vercel. Основной финансовый расчёт от него не зависит.", 409);
      const report = await buildReport(db, String(payload.from ?? ""), String(payload.to ?? ""));
      if (report.missing_days.length) return fail("Сначала синхронизируйте весь выбранный период", 409);
      const summary = { from: report.from, to: report.to, ledger_amount: report.ledger_amount,
        allocated_amount: report.allocated_amount, unallocated_amount: report.unallocated_amount,
        operation_count: report.operation_count, profit_status: report.profit_status,
        top_negative: report.rows.slice(0, 15).map(r => ({
          offer_id: r.offer_id, master_code: r.master_code, manager: r.manager,
          ozon_amount: r.ozon_amount, details: r.details.slice(0, 8),
        })), unallocated_details: report.unallocated_details.slice(0, 12) };
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_FINANCE_MODEL || "gpt-6-astra",
          store: false, max_output_tokens: 900,
          instructions: "Ты финансовый аудитор Ozon. Анализируй только переданные суммы. Разделяй факт и гипотезу. Никогда не называй озон-начисления прибылью, потому что себестоимость и точные выкупы не подтверждены. Не давай вымышленных чисел. Ответь по-русски компактно: 3-6 находок, риски сверки и следующие проверки.",
          input: JSON.stringify(summary) }),
        signal: AbortSignal.timeout(60000),
      });
      const json = await response.json() as { error?: { message?: string }; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
      if (!response.ok) throw new Error("OpenAI API: " + (json.error?.message || response.status));
      const advice = (json.output ?? []).flatMap(x => x.content ?? [])
        .filter(x => x.type === "output_text").map(x => x.text ?? "").join("\n").trim();
      return NextResponse.json({ ok: true, advice: advice || "Модель не вернула текст" });
    }
    return fail("Неизвестное действие", 400);
  } catch (e) { return fail(e); }
}
