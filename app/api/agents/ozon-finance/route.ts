import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { createClient } from "../../../../lib/supabase/server";
import {
  assertAdvertisingAccountingInvariant,
  classifyAdvertisingAccrual,
  emptyAccrualReconciliation,
  fromKopecks,
  provisionalResult,
  toKopecks,
} from "../../../../lib/ozon/financeAdvertising";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ACCOUNT = "main";
const MAX_DAYS = 366;
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
type Expense = { offer_id: string; master_code: string; ordered_units: number; covered_cogs_units: number; covered_mayak_units: number; cogs_total: number; mayak_total: number };
type Product = { offer_id: string | null; master_code: string | null; name: string | null };
type MapRow = { sku: string; offer_id: string | null; master_code: string | null };
type Manager = { master_code: string; manager_name: string };
type Realized = { offer_id: string | null; master_code: string | null; net_buyouts: number; covered_buyouts: number; cogs_total: string | number };
type BuyoutCoverage = { day: string; source: string };
type Group = {
  offer_id: string;
  master_code: string | null;
  name: string | null;
  manager: string;
  ozon_amount: number;
  sold_units: number | null;
  buyout_units: number | null;
  data_gaps: string[];
  unit_cost: number | null;
  cogs: number | null;
  mayak_unit: number | null;
  mayak_expense: number | null;
  mayak_covered_units: number | null;
  estimated_result: number | null;
  advertising_amount: number;
  details: Array<{ type_id: string; name: string; amount: number; count: number; is_advertising: boolean }>;
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
  // app_user_access is intentionally blocked by RLS for browser sessions.
  // Verify JWT first, then resolve permissions on the trusted server client.
  const admin = createAdminClient();
  const { data: rights, error: rightsError } = await admin
    .from("app_user_access").select("admin_level,is_blocked").eq("user_id", user.id).maybeSingle();
  if (rightsError || !rights || rights.is_blocked || !["admin", "senior_admin"].includes(rights.admin_level ?? "")) return null;
  return admin;
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
  const [syncRes, ledgerRes, mappingsRes, costsRes, mayakRes, managersRes, expenseRes, buyoutsRes, buyoutCoverageRes, salesRunsRes, typesRes, productsRes] =
    await Promise.all([
      db.from("ozon_finance_sync_days").select("day,record_count,synced_at").eq("account_key", ACCOUNT)
        .gte("day", from).lte("day", to),
      db.rpc("ozon_finance_report", { p_from: from, p_to: to, p_account_key: ACCOUNT }),
      db.from("ozon_finance_sku_map").select("sku,offer_id,master_code").eq("account_key", ACCOUNT),
      db.from("ozon_finance_costs").select("master_code,valid_from,unit_cost_rub").lte("valid_from", to).order("valid_from"),
      db.from("ozon_finance_mayak").select("master_code,valid_from,unit_cost_rub").lte("valid_from", to).order("valid_from"),
      db.from("ozon_finance_managers").select("master_code,manager_name"),
      db.rpc("ozon_finance_cost_breakdown", { p_from: from, p_to: to }),
      db.rpc("ozon_finance_realized_cost", { p_from: from, p_to: to, p_account: ACCOUNT }),
      db.from("ozon_finance_buyout_coverage").select("day,source").eq("account_key", ACCOUNT).gte("day",from).lte("day",to),
      db.from("ozon_sales_sync_runs").select("date_from,date_to").eq("status", "success")
        .lte("date_from", from).gte("date_to", to).limit(1),
      db.from("ozon_finance_types").select("type_id,description,name"),
      db.from("products").select("offer_id,master_code,name").limit(2000),
    ]);
  for (const item of [syncRes, ledgerRes, mappingsRes, costsRes, mayakRes, managersRes, expenseRes, buyoutsRes, buyoutCoverageRes, salesRunsRes, typesRes, productsRes]) {
    if (item.error) throw item.error;
  }
  const loaded = new Set((syncRes.data ?? []).map(r => r.day));
  const missingDays = days.filter(d => !loaded.has(d));
  const mapBySku = new Map((mappingsRes.data as MapRow[] ?? []).map(r => [r.sku, r]));
  const productByOffer = new Map((productsRes.data as Product[] ?? []).filter(p => p.offer_id).map(p => [p.offer_id!, p]));
  const managers = new Map((managersRes.data as Manager[] ?? []).map(r => [r.master_code, r.manager_name]));
  const expenses = new Map((expenseRes.data as Expense[] ?? []).map(r => [r.offer_id, r]));
  const buyoutsByOffer = new Map((buyoutsRes.data as Realized[] ?? []).filter(x=>x.offer_id).map(r => [r.offer_id!, r]));
  const buyoutCoverage = new Set((buyoutCoverageRes.data as BuyoutCoverage[] ?? []).map(r => r.day));
  const verifiedBuyoutsCovered = days.every(d=>buyoutCoverage.has(d));
  const mayakHistory = new Map<string, Cost[]>();
  for (const m of mayakRes.data as Cost[] ?? []) {
    const arr = mayakHistory.get(m.master_code) ?? [];
    arr.push(m); mayakHistory.set(m.master_code, arr);
  }
  const types = new Map((typesRes.data ?? []).map(r => [r.type_id, r.description || r.name || r.type_id]));
  const costHistory = new Map<string, Cost[]>();
  for (const c of costsRes.data as Cost[] ?? []) {
    const arr = costHistory.get(c.master_code) ?? [];
    arr.push(c); costHistory.set(c.master_code, arr);
  }
  const byOffer = new Map<string, Group>();
  let operationCount = 0;
  const accounting = emptyAccrualReconciliation();
  const unallocatedDetails = new Map<string, number>();
  for (const line of ledgerRes.data as ReportLine[] ?? []) {
    const amountCents = toKopecks(line.amount);
    const amount = fromKopecks(amountCents);
    accounting.ledgerKopecks += amountCents;
    operationCount += Number(line.item_count);
    const m = line.sku ? mapBySku.get(line.sku) : null;
    // Keep SKU-level charges even when the product has no master_code.
    const offer = m?.offer_id || (line.sku ? "SKU:" + line.sku : null);
    const master = m?.master_code || (offer ? productByOffer.get(offer)?.master_code : null) || null;
    const typeId = line.type_id || line.accrued_category || "unknown";
    const name = types.get(typeId) || typeId;
    const advertising = classifyAdvertisingAccrual(line.type_id, name, line.accrued_category);
    if (advertising.isAdvertising) {
      accounting.advertisingTotalKopecks += amountCents;
      accounting.classifiedAdvertisingOperations += Number(line.item_count);
    } else if (!types.has(typeId)) {
      accounting.unknownTypeOperations += Number(line.item_count);
    }
    if (!offer) {
      accounting.unallocatedKopecks += amountCents;
      if (advertising.isAdvertising) accounting.advertisingUnallocatedKopecks += amountCents;
      unallocatedDetails.set(name, (unallocatedDetails.get(name) ?? 0) + amount);
      continue;
    }
    let g = byOffer.get(offer);
    if (!g) {
      g = { offer_id: offer, master_code: master,
        name: productByOffer.get(offer)?.name ?? null,
        manager: (master ? managers.get(master) : null) || "Не назначен",
        ozon_amount: 0, sold_units: null, buyout_units: null, data_gaps: [], unit_cost: null, cogs: null,
        mayak_unit: null, mayak_expense: null, mayak_covered_units: null,
        estimated_result: null, advertising_amount: 0, details: [] };
      byOffer.set(offer, g);
    }
    accounting.directKopecks += amountCents;
    if (advertising.isAdvertising) {
      accounting.advertisingDirectKopecks += amountCents;
      g.advertising_amount += amount;
    }
    g.ozon_amount += amount;
    g.details.push({
      type_id: typeId, name, amount, count: Number(line.item_count),
      is_advertising: advertising.isAdvertising,
    });
  }
  // Financial accruals and posted-order units have different accounting dates.
  // Profit must remain "provisional" until reconciliation to settlement reports.
  const salesWindowCovered = (salesRunsRes.data ?? []).length > 0;
  let totalMayak = 0;
  for (const g of byOffer.values()) {
    g.ozon_amount = round(g.ozon_amount);
    g.advertising_amount = round(g.advertising_amount);
    const costH = costHistory.get(g.master_code!) ?? [];
    const mayakH = mayakHistory.get(g.master_code!) ?? [];
    g.unit_cost = costH.length ? Number(costH.at(-1)!.unit_cost_rub) : null;
    g.mayak_unit = mayakH.length ? Number(mayakH.at(-1)!.unit_cost_rub) : null;
    const calc = expenses.get(g.offer_id);
    g.sold_units = salesWindowCovered ? Number(calc?.ordered_units ?? 0) : null;
    // Cost of goods is recognized ONLY on VERIFIED ACTUAL BUYOUTS, never orders.
    const realized = buyoutsByOffer.get(g.offer_id);
    if (verifiedBuyoutsCovered && realized) {
      g.buyout_units = Number(realized.net_buyouts);
      if (g.buyout_units === Number(realized.covered_buyouts)) {
        g.cogs = round(Number(realized.cogs_total));
      }
    } else if (verifiedBuyoutsCovered && !realized) {
      // A fully verified period with no buyouts is genuinely zero.
      g.buyout_units = 0;
      g.cogs = 0;
    }
    if (salesWindowCovered && calc && calc.ordered_units === calc.covered_mayak_units) {
      g.mayak_expense = round(Number(calc.mayak_total));
      g.mayak_covered_units = Number(calc.covered_mayak_units);
      totalMayak += g.mayak_expense;
    }
    if (salesWindowCovered && !calc) {
      // No ordered units on this listing during a covered period.
      // No orders does not imply no actual buyouts in this period.
      g.mayak_expense = 0;
      g.mayak_covered_units = 0;
    }
    if (!g.master_code) g.data_gaps.push("Нет master_code");
    if (g.manager === "Не назначен") g.data_gaps.push("Не назначен КМ");
    if (g.unit_cost === null) g.data_gaps.push("Нет себестоимости");
    if (g.mayak_unit === null) g.data_gaps.push("Нет ТК Маяк");
    if (!verifiedBuyoutsCovered) g.data_gaps.push("Не подтверждены выкупы за весь период");
    if (g.cogs === null && verifiedBuyoutsCovered) g.data_gaps.push("Не вся себестоимость выкупов известна");
    if (g.mayak_expense === null) g.data_gaps.push("Нет полного расчёта ТК Маяк");
    if (
      g.master_code !== null &&
      g.unit_cost !== null &&
      g.mayak_unit !== null &&
      g.cogs !== null &&
      g.mayak_expense !== null
    ) {
      // Performance API spend NEVER appears in this formula.
      g.estimated_result = provisionalResult(g.ozon_amount, g.cogs, g.mayak_expense);
    } else {
      // Never show a financial result for incomplete reference data.
      g.estimated_result = null;
    }
    g.details = g.details.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }
  // Reference data completeness is independent of whether a finance day
  // was imported. Product listings without master_code must remain visible.
  const referenceGaps = (productsRes.data as Product[] ?? []).map(product => {
    const master = product.master_code;
    const miss: string[] = [];
    if (!master) miss.push("master_code");
    if (!master || !managers.has(master)) miss.push("КМ");
    if (!master || !(costHistory.get(master) ?? []).some(x=>x.valid_from <= from))
      miss.push("Себестоимость");
    if (!master || !(mayakHistory.get(master) ?? []).some(x=>x.valid_from <= from))
      miss.push("ТК Маяк");
    return { offer_id: product.offer_id ?? "(без артикула)",
      master_code: master, name: product.name,
      manager: master ? managers.get(master) ?? "Не назначен" : "Не назначен",
      missing: miss };
  }).filter(p=>p.missing.length>0);

  // Invariant: the Seller finance ledger is partitioned, never augmented by
  // Performance statistics. Throw rather than publish silently doubled amounts.
  assertAdvertisingAccountingInvariant(accounting);
  return {
    from, to, synced_days: loaded.size, total_days: days.length, missing_days: missingDays,
    operation_count: operationCount, total_mayak: round(totalMayak),
    ledger_amount: fromKopecks(accounting.ledgerKopecks),
    allocated_amount: fromKopecks(accounting.directKopecks),
    unallocated_amount: fromKopecks(accounting.unallocatedKopecks),
    advertising: {
      financial_source: "ozon_seller_accruals",
      performance_role: "analytics_and_allocation_only",
      expense_already_in_ledger: true,
      performance_added_to_profit: false,
      finance_total: fromKopecks(accounting.advertisingTotalKopecks),
      finance_direct: fromKopecks(accounting.advertisingDirectKopecks),
      finance_unallocated: fromKopecks(accounting.advertisingUnallocatedKopecks),
      classified_operations: accounting.classifiedAdvertisingOperations,
      unknown_type_operations: accounting.unknownTypeOperations,
      performance_total: null,
      discrepancy: null,
      reconciliation_status: accounting.unknownTypeOperations > 0
        ? "requires_type_review" : "not_checked_against_performance",
    },
    sales_window_covered: salesWindowCovered,
    actual_buyout_days: buyoutCoverage.size,
    actual_buyouts_covered: verifiedBuyoutsCovered,
    source: "supabase_cached_finance",
    calculation_includes_api_calls: false,
    profit_status: verifiedBuyoutsCovered ? "provisional" : "waiting_for_confirmed_buyouts",
    warning: "Отчёт строится из кеша Supabase без запросов к Ozon. Реклама уже включена в начисления и второй раз не вычитается. Себестоимость считается только по подтверждённым фактическим выкупам; пока они не загружены за весь период, прибыль не публикуется. ТК Маяк: ставка × неотменённые заказанные единицы.",
    rows: Array.from(byOffer.values()).sort((a, b) => a.ozon_amount - b.ozon_amount),
    reference_gaps: referenceGaps.sort((a,b)=>a.offer_id.localeCompare(b.offer_id,"ru")),
    unallocated_details: [...unallocatedDetails.entries()]
      .map(([name, sum]) => ({ name, amount: round(sum) }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
  };
}

type WorkbookInput = { master_code?: unknown; manager?: unknown; offer_id?: unknown;
  product_id?: unknown; sku?: unknown; cost?: unknown; mayak?: unknown };

async function buildSettings(db: ReturnType<typeof createAdminClient>) {
  const [p, costs, mayak, managers] = await Promise.all([
    db.from("products").select("master_code,offer_id,name,ozon_product_id").not("master_code", "is", null).limit(2500),
    db.from("ozon_finance_costs").select("master_code,valid_from,unit_cost_rub").order("valid_from"),
    db.from("ozon_finance_mayak").select("master_code,valid_from,unit_cost_rub").order("valid_from"),
    db.from("ozon_finance_managers").select("master_code,manager_name"),
  ]);
  for (const r of [p,costs,mayak,managers]) if (r.error) throw r.error;
  const items = new Map<string, { master_code: string; offer_id: string; name: string | null;
    cost: number | null; cost_date: string | null; mayak: number | null; mayak_date: string | null; manager: string }>();
  for (const product of p.data ?? []) {
    if (!product.master_code) continue;
    if (!items.has(product.master_code)) items.set(product.master_code, {
      master_code: product.master_code,
      offer_id: product.offer_id || "",
      name: product.name ?? null, cost: null, cost_date: null,
      mayak: null, mayak_date: null, manager: "Не назначен",
    });
  }
  for (const value of costs.data ?? []) {
    const item = items.get(value.master_code);
    if (item) { item.cost = Number(value.unit_cost_rub); item.cost_date = value.valid_from; }
  }
  for (const value of mayak.data ?? []) {
    const item = items.get(value.master_code);
    if (item) { item.mayak = Number(value.unit_cost_rub); item.mayak_date = value.valid_from; }
  }
  for (const value of managers.data ?? []) {
    const item = items.get(value.master_code);
    if (item) item.manager = value.manager_name;
  }
  return { rows: [...items.values()].sort((a,b) => a.master_code.localeCompare(b.master_code)), count: items.size };
}

async function importWorkbookRows(db: ReturnType<typeof createAdminClient>, rows: WorkbookInput[], validFrom: string) {
  if (!validDate(validFrom)) throw new Error("Неверная дата начала действия импортированных тарифов");
  if (rows.length < 1 || rows.length > 2000) throw new Error("Допустимо от 1 до 2000 строк за одну загрузку");
  const candidates = rows.map(r => ({
    master: String(r.master_code ?? "").trim(),
    productId: String(r.product_id ?? "").trim(),
    sku: String(r.sku ?? "").trim(),
    manager: String(r.manager ?? "").trim(),
    cost: r.cost === "" || r.cost == null ? null : Number(r.cost),
    mayak: r.mayak === "" || r.mayak == null ? null : Number(r.mayak),
  })).filter(x => x.master && x.productId && x.sku);
  const ids = [...new Set(candidates.map(x => x.productId))];
  const dbProducts: Array<{ master_code: string | null; offer_id: string | null; ozon_product_id: string | number | null }> = [];
  for (let i = 0; i < ids.length; i += 250) {
    const { data, error } = await db.from("products")
      .select("master_code,offer_id,ozon_product_id").in("ozon_product_id", ids.slice(i,i+250));
    if (error) throw error;
    dbProducts.push(...(data ?? []));
  }
  const byId = new Map(dbProducts.map(p => [String(p.ozon_product_id), p]));
  const mapped: Array<{ master: string; manager: string; cost: number | null;
    mayak: number | null; sku: string; offer: string }> = [];
  const issues: string[] = [];
  const usedMaster = new Set<string>();
  const usedSku = new Set<string>();
  for (const row of candidates) {
    const existing = byId.get(row.productId);
    if (!existing || existing.master_code !== row.master || !existing.offer_id) {
      issues.push(row.master + " / Product ID " + row.productId + ": не совпадает со справочником сайта");
      continue;
    }
    if (usedMaster.has(row.master) || usedSku.has(row.sku)) {
      issues.push(row.master + ": повторный master_code или SKU в файле"); continue;
    }
    if (row.manager.length > 80 ||
        (row.cost !== null && (!Number.isFinite(row.cost) || row.cost < 0 || row.cost > 1e9)) ||
        (row.mayak !== null && (!Number.isFinite(row.mayak) || row.mayak < 0 || row.mayak > 1e9))) {
      issues.push(row.master + ": некорректный КМ или цена"); continue;
    }
    usedMaster.add(row.master); usedSku.add(row.sku);
    mapped.push({ master: row.master, manager: row.manager,
      cost: row.cost, mayak: row.mayak, sku: row.sku, offer: existing.offer_id });
  }
  if (!mapped.length) throw new Error("Не найдено товаров, совпадающих с Product ID и master_code из базы");
  // Reject ambiguous imports rather than partly overwriting rates.
  if (issues.length) throw new Error("Обнаружено " + issues.length + " расхождений: " +
    issues.slice(0,8).join("; ") + ". Ничего не импортировано.");
  async function save(table: string, records: Record<string, unknown>[], conflict: string) {
    if (!records.length) return;
    for (let i=0;i<records.length;i+=250) {
      const { error } = await db.from(table).upsert(records.slice(i,i+250),{ onConflict: conflict });
      if (error) throw error;
    }
  }
  await save("ozon_finance_costs", mapped.filter(x=>x.cost!==null).map(x=>({
    master_code: x.master, valid_from: validFrom, unit_cost_rub: x.cost
  })), "master_code,valid_from");
  await save("ozon_finance_mayak", mapped.filter(x=>x.mayak!==null).map(x=>({
    master_code: x.master, valid_from: validFrom, unit_cost_rub: x.mayak
  })), "master_code,valid_from");
  await save("ozon_finance_managers", mapped.filter(x=>x.manager).map(x=>({
    master_code: x.master, manager_name: x.manager
  })), "master_code");
  await save("ozon_finance_sku_map", mapped.map(x=>({
    account_key: ACCOUNT, sku:x.sku, offer_id:x.offer, master_code:x.master,
  })), "account_key,sku");
  return { imported: mapped.length, prices: mapped.filter(x=>x.cost!==null).length,
    mayak: mapped.filter(x=>x.mayak!==null).length, managers: mapped.filter(x=>!!x.manager).length,
    skipped_blank_rows: rows.length-candidates.length };
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
    if (url.searchParams.get("mode") === "settings") {
      return NextResponse.json({ok: true, ...(await buildSettings(db))});
    }
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
    if (payload.action === "importWorkbook") {
      if (!Array.isArray(payload.rows)) return fail("Требуется список строк файла",400);
      const result = await importWorkbookRows(db, payload.rows as WorkbookInput[], String(payload.valid_from ?? ""));
      return NextResponse.json({ok:true,...result});
    }
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
      if (payload.mayak !== undefined) {
        const m = Number(payload.mayak), validFrom = String(payload.valid_from ?? "");
        if (!Number.isFinite(m) || m < 0 || m > 1e9 || !validDate(validFrom))
          return fail("Некорректный тариф ТК Маяк или дата действия", 400);
        const { error } = await db.from("ozon_finance_mayak").upsert({
          master_code: master, valid_from: validFrom, unit_cost_rub: m, updated_at: new Date().toISOString(),
        }, { onConflict: "master_code,valid_from" });
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
      const summary = { from: report.from, to: report.to, advertising: report.advertising, total_mayak: report.total_mayak, ledger_amount: report.ledger_amount,
        allocated_amount: report.allocated_amount, unallocated_amount: report.unallocated_amount,
        operation_count: report.operation_count, profit_status: report.profit_status,
        top_negative: report.rows.slice().sort((a, b) =>
          (a.estimated_result ?? a.ozon_amount) - (b.estimated_result ?? b.ozon_amount)
        ).slice(0, 15).map(r => ({
          offer_id: r.offer_id, master_code: r.master_code, manager: r.manager,
          ozon_amount: r.ozon_amount, sold_units: r.sold_units,
          unit_cost: r.unit_cost, cogs: r.cogs, mayak_expense: r.mayak_expense, estimated_result: r.estimated_result,
          details: r.details.slice(0, 8),
        })), unallocated_details: report.unallocated_details.slice(0, 12) };
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_FINANCE_MODEL || "gpt-6-astra",
          store: false, max_output_tokens: 900,
          instructions: "Ты финансовый аудитор Ozon. Анализируй только переданные суммы. Разделяй факт и гипотезу. estimated_result является лишь предварительной оценкой, не бухгалтерской прибылью. Не давай вымышленных чисел. Ответь по-русски компактно: 3-6 находок, риски сверки и следующие проверки.",
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
