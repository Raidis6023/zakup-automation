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
type Product = { id: string; offer_id: string | null; master_code: string | null; name: string | null };
type OrderTotals = { offer_id:string; master_code:string|null; orders:number;cancelled:number;net_orders:number;covered_cogs_units:number;calculated_cogs:number;mayak_total:number;covered_mayak_units:number };
type RevenueRow = { sku:string;revenue:number };
type AdRow = {sku:string;expense:number|string};
type Itemized = {sku:string;type_id:string;name:string;amount:string|number;item_count:number};
type AdDay = {day:string};
type TransitRow = { sku:string;quantity:number;open_order_value:number|null;as_of:string };
type CrossdockRow = {sku:string;quantity:number;as_of:string};
type StockRow = {product_id:string;ozon_stock:number|null;main_stock:number|null;ox_stock:number|null;ozon_at:string|null;main_at:string|null;ox_at:string|null};
type VedOrder = { id:string;workflow_status:string|null;status:string|null };
type VedItem = {product_id:string|null;ved_order_id:string;status:string;order_quantity:number|null;quantity:number|null};
type StatusRow = {master_code:string;status:string};
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
  performance_ad_expense: number | null;
  allocated_seller_ppc: number;
  order_count: number | null;
  cancelled_units: number | null;
  revenue: number | null;
  main_stock: number | null; ox_stock: number | null; ozon_stock: number | null;
  in_china: number | null; in_crossdock: number | null; in_transit: number | null;
  transit_revenue: number | null; transit_drr: number | null;
  discontinued: boolean;
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
  const [syncRes, ledgerRes, mappingsRes, costsRes, mayakRes, managersRes, expenseRes, ordersRes, revenueRes, adRes, adDaysRes, adJobsRes, itemizedRes, transitRes, crossdockRes, crossdockCurrentRes, stocksRes, vedOrdersRes, vedItemsRes, statusesRes, salesRunsRes, typesRes, productsRes, jobsRes, unallocatedRes] =
    await Promise.all([
      db.from("ozon_finance_sync_days").select("day,record_count,synced_at").eq("account_key", ACCOUNT)
        .gte("day", from).lte("day", to),
      db.rpc("ozon_finance_report_v3", { p_from: from, p_to: to, p_account_key: ACCOUNT }),
      db.from("ozon_finance_sku_map").select("sku,offer_id,master_code").eq("account_key", ACCOUNT),
      db.from("ozon_finance_costs").select("master_code,valid_from,unit_cost_rub").lte("valid_from", to).order("valid_from"),
      db.from("ozon_finance_mayak").select("master_code,valid_from,unit_cost_rub").lte("valid_from", to).order("valid_from"),
      db.from("ozon_finance_managers").select("master_code,manager_name"),
      db.rpc("ozon_finance_cost_breakdown", { p_from: from, p_to: to }),
      db.rpc("ozon_finance_order_totals", { p_from: from, p_to: to }),
      db.rpc("ozon_finance_sales_revenue", {p_from:from,p_to:to,p_account:ACCOUNT}),
      db.rpc("ozon_finance_ad_by_sku",{p_from:from,p_to:to,p_account:ACCOUNT}),
      db.from("ozon_finance_ad_coverage").select("day")
        .eq("account_key",ACCOUNT).gte("day",from).lte("day",to),
      db.from("ozon_finance_ad_sync_jobs").select("status,last_error,date_from,date_to,updated_at")
        .eq("account_key",ACCOUNT).lte("date_from",to).gte("date_to",from)
        .order("updated_at",{ascending:false}).limit(3),
      db.rpc("ozon_finance_itemized_per_sku",{p_from:from,p_to:to,p_account:ACCOUNT}),
      db.rpc("ozon_finance_transit_totals",{p_account:ACCOUNT}),
      db.rpc("ozon_finance_crossdock_totals",{p_account:ACCOUNT}),
      db.from("ozon_finance_crossdock_current").select("published_at").eq("account_key",ACCOUNT).maybeSingle(),
      db.rpc("ozon_finance_stock_summary"),
      db.from("ved_orders").select("id,workflow_status,status").limit(500),
      db.from("ved_order_items").select("product_id,ved_order_id,status,order_quantity,quantity").limit(1500),
      db.from("product_article_statuses").select("master_code,status").limit(1500),
      db.from("ozon_sales_sync_runs").select("date_from,date_to").eq("status","success")
        .lte("date_from",to).gte("date_to",from)
        .order("created_at",{ascending:false}).limit(180),
      db.from("ozon_finance_types").select("type_id,description,name"),
      db.from("products").select("id,offer_id,master_code,name").limit(2000),
      db.from("ozon_finance_page_jobs").select("day,status,pages_completed,rows_saved,last_error,updated_at")
        .eq("account_key",ACCOUNT).gte("day",from).lte("day",to).order("day"),
      db.rpc("ozon_finance_unallocated_v3",{p_from:from,p_to:to,p_account:ACCOUNT}),
    ]);
  for (const item of [syncRes, ledgerRes, mappingsRes, costsRes, mayakRes, managersRes, expenseRes, ordersRes, revenueRes, adRes, adDaysRes, adJobsRes, itemizedRes, transitRes, crossdockRes, crossdockCurrentRes, stocksRes, vedOrdersRes, vedItemsRes, statusesRes, salesRunsRes, typesRes, productsRes, jobsRes, unallocatedRes]) {
    if (item.error) throw item.error;
  }
  const loaded = new Set((syncRes.data ?? []).map(r => r.day));
  const missingDays = days.filter(d => !loaded.has(d));
  const mapBySku = new Map((mappingsRes.data as MapRow[] ?? []).map(r => [r.sku, r]));
  const productByOffer = new Map((productsRes.data as Product[] ?? []).filter(p => p.offer_id).map(p => [p.offer_id!, p]));
  const managers = new Map((managersRes.data as Manager[] ?? []).map(r => [r.master_code, r.manager_name]));
  const expenses = new Map((expenseRes.data as Expense[] ?? []).map(r => [r.offer_id, r]));
  const ordersByOffer = new Map((ordersRes.data as OrderTotals[] ?? []).map(r=>[r.offer_id,r]));
  const revenueBySku = new Map((revenueRes.data as RevenueRow[] ?? []).map(r=>[r.sku,Number(r.revenue)]));
  const adCoverage=new Set((adDaysRes.data as AdDay[]??[]).map(x=>x.day));
  const adComplete=days.every(day=>adCoverage.has(day));
  const adByOffer=new Map<string,number>();
  for(const item of adRes.data as AdRow[]??[]){
    const offer=mapBySku.get(item.sku)?.offer_id;
    if(offer)adByOffer.set(offer,(adByOffer.get(offer)??0)+Number(item.expense));
  }
  const transitBySku = new Map((transitRes.data as TransitRow[] ?? []).map(r=>[r.sku,r]));
  const transitSnapshotReady = (transitRes.data as TransitRow[] ?? []).length>0;
  const transitAsOf = (transitRes.data as TransitRow[] ?? [])[0]?.as_of??null;
  const stocksByProduct = new Map((stocksRes.data as StockRow[] ?? []).map(r=>[r.product_id,r]));
  const crossdockByOffer=new Map<string,number>();
  const crossdockCurrent=crossdockCurrentRes.data;
  for(const item of crossdockRes.data as CrossdockRow[]??[]){
    const offer=mapBySku.get(item.sku)?.offer_id;
    if(offer)crossdockByOffer.set(offer,
      (crossdockByOffer.get(offer)??0)+Number(item.quantity));
  }
  const articleStatus = new Map((statusesRes.data as StatusRow[] ?? []).map(r=>[r.master_code,r.status]));
  const vedOrderStatus = new Map((vedOrdersRes.data as VedOrder[] ?? []).map(r=>[r.id,r.workflow_status || r.status || "draft"]));
  const vedByProduct = new Map<string,number>();
  for(const v of vedItemsRes.data as VedItem[] ?? []){
    const status=vedOrderStatus.get(v.ved_order_id);
    if(!v.product_id || !status || !["in_transit","dispatched","shipping","on_the_way"].includes(status))continue;
    if(["cancelled","received","rejected"].includes(v.status))continue;
    vedByProduct.set(v.product_id,(vedByProduct.get(v.product_id)??0)+Number(v.order_quantity??v.quantity??0));
  }
  const productById = new Map((productsRes.data as Product[]??[]).map(p=>[p.id,p]));
  const unknownChinaStatuses = ![...vedOrderStatus.values()].some(v=>["in_transit","dispatched","shipping","on_the_way"].includes(v));
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
  const revenueByOffer = new Map<string,number>();
  const transitByOffer=new Map<string,{units:number;money:number|null}>();
  for(const [sku,t] of transitBySku){
    const offer=mapBySku.get(sku)?.offer_id;
    if(!offer)continue;
    const prev=transitByOffer.get(offer);
    transitByOffer.set(offer,{units:(prev?.units??0)+Number(t.quantity),
      money:prev?.money===null||t.open_order_value===null?null:
        (prev?.money??0)+Number(t.open_order_value)});
  }
  for(const [sku,revenue] of revenueBySku){
    const m=mapBySku.get(sku); if(!m?.offer_id)continue;
    revenueByOffer.set(m.offer_id,(revenueByOffer.get(m.offer_id)??0)+revenue);
  }
  // A multi-SKU source accrual can produce several itemized fee lines,
  // but the operational counter must still count its original Ozon row once.
  const operationCount = (syncRes.data ?? []).reduce(
    (sum,r)=>sum+Number(r.record_count??0),0);
  const accounting = emptyAccrualReconciliation();
  const unallocatedDetails = new Map<string, number>();
  let unallocatedSellerPpcCents=0;
  for (const line of ledgerRes.data as ReportLine[] ?? []) {
    const amountCents = toKopecks(line.amount);
    const amount = fromKopecks(amountCents);
    accounting.ledgerKopecks += amountCents;
    const m = line.sku ? mapBySku.get(line.sku) : null;
    // Keep SKU-level charges even when the product has no master_code.
    const offer = m?.offer_id || (line.sku ? "SKU:" + line.sku : null);
    const master = m?.master_code || (offer ? productByOffer.get(offer)?.master_code : null) || null;
    const typeId = line.type_id || line.accrued_category || "unknown";
    const fallback:Record<string,string>={
      "1":"Эквайринг","12":"Кросс-докинг","15":"Утилизация",
      "25":"Товарная компенсация","29":"Доставка до места выдачи",
      "32":"Логистика","41":"Оплата за клик",
      "46":"Размещение на складах Ozon",
      "77":"Приёмка поставки на склад Ozon"
    };
    const name = types.get(typeId) || fallback[typeId] || (line.type_id ? "Статья Ozon №"+typeId : line.accrued_category || "Прочие начисления");
    const advertising = classifyAdvertisingAccrual(line.type_id, name, line.accrued_category);
    if (advertising.isAdvertising) {
      accounting.advertisingTotalKopecks += amountCents;
      accounting.classifiedAdvertisingOperations += Number(line.item_count);
    } else if (!types.has(typeId)) {
      accounting.unknownTypeOperations += Number(line.item_count);
    }
    if (!offer) {
      accounting.unallocatedKopecks += amountCents;
      if (String(line.type_id??"")==="41") unallocatedSellerPpcCents+=amountCents;
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
        estimated_result: null, advertising_amount: 0, performance_ad_expense:null,
        allocated_seller_ppc:0,
        order_count:null,cancelled_units:null,revenue:null,
        main_stock:null,ox_stock:null,ozon_stock:null,
        in_china:null,in_crossdock:null,in_transit:null,
        transit_revenue:null,transit_drr:null,discontinued:false,
        details: [] };
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
  // Daily Ozon sales are cached on rolling 28-day runs. A 31-day report
  // is covered by their UNION, even if no single run spans all 31 days.
  const salesRuns=salesRunsRes.data??[];
  const salesWindowCovered=days.every(day=>salesRuns.some(run=>
    run.date_from<=day && run.date_to>=day));
  let totalMayak = 0;
  for (const g of byOffer.values()) {
    g.ozon_amount = round(g.ozon_amount);
    g.advertising_amount = round(g.advertising_amount);
    // Performance SKU allocation is analytic ONLY. Financial Seller postings
    // and per-SKU profit are unchanged; no duplicate booking.
    g.performance_ad_expense=adComplete ? round(adByOffer.get(g.offer_id)??0):null;
    const costH = costHistory.get(g.master_code!) ?? [];
    const mayakH = mayakHistory.get(g.master_code!) ?? [];
    g.unit_cost = costH.length ? Number(costH.at(-1)!.unit_cost_rub) : null;
    g.mayak_unit = mayakH.length ? Number(mayakH.at(-1)!.unit_cost_rub) : null;
    const calc = expenses.get(g.offer_id);
    const units = ordersByOffer.get(g.offer_id);
    g.order_count = salesWindowCovered ? Number(units?.orders ?? 0) : null;
    g.cancelled_units = salesWindowCovered ? Number(units?.cancelled ?? 0) : null;
    // User-defined proxy: ordered minus cancelled. The sales_quantity source
    // already excludes cancelled FBO postings. Never subtract twice.
    g.sold_units = salesWindowCovered ? Number(units?.net_orders ?? 0) : null;
    g.buyout_units = g.sold_units;
    if (salesWindowCovered && units && Number(units.net_orders)===Number(units.covered_cogs_units))
      g.cogs=round(Number(units.calculated_cogs));
    if (salesWindowCovered && (!units || Number(units.net_orders)===0)) g.cogs=0;
    if (salesWindowCovered && units && Number(units.net_orders)===Number(units.covered_mayak_units)){
      g.mayak_expense=round(Number(units.mayak_total));
      g.mayak_covered_units=Number(units.covered_mayak_units);
      totalMayak+=g.mayak_expense;
    }
    if(salesWindowCovered && (!units || Number(units.net_orders)===0)){
      g.mayak_expense=0;g.mayak_covered_units=0;
    }
    g.revenue=round(revenueByOffer.get(g.offer_id)??0);
    const product=productByOffer.get(g.offer_id);
    const stock=product ? stocksByProduct.get(product.id) : null;
    g.ozon_stock=stock?.ozon_stock==null?null:Number(stock.ozon_stock);
    g.main_stock=stock?.main_stock==null?null:Number(stock.main_stock);
    g.ox_stock=stock?.ox_stock==null?null:Number(stock.ox_stock);
    g.in_china=product && !unknownChinaStatuses ? (vedByProduct.get(product.id)??0):null;
    // Transit to buyers and cross-docking need real shipping statuses; current
    // stock snapshots and replenishment CALCULATIONS do not prove in-transit units.
    g.in_crossdock=crossdockCurrent ? (crossdockByOffer.get(g.offer_id)??0):null;
    const open=transitByOffer.get(g.offer_id);
    g.in_transit=transitSnapshotReady?(open?.units??0):null;
    g.transit_revenue=transitSnapshotReady && g.revenue!==null &&
      (open?.money??(open?null:0))!==null
      ?round(g.revenue+Number(open?.money??0)):null;
    const matchedAd=g.advertising_amount<0?-g.advertising_amount:0;
    g.transit_drr=g.transit_revenue && g.transit_revenue>0 && g.advertising_amount<0
      ?matchedAd/g.transit_revenue:null;
    g.discontinued=!!(g.master_code && /выведен|выводится/i.test(articleStatus.get(g.master_code)||""));
    if(!g.master_code)g.data_gaps.push("Нет master_code");
    if(g.manager==="Не назначен")g.data_gaps.push("Не назначен КМ");
    // Missing rates are blockers only when at least one net FBO item
    // requires multiplying by them; zero units imply zero direct costs.
    if(g.unit_cost===null && (g.buyout_units??0)>0)g.data_gaps.push("Нет цены закупа");
    if(g.mayak_unit===null && (g.buyout_units??0)>0)g.data_gaps.push("Нет ТК Маяк");
    if(!salesWindowCovered)g.data_gaps.push("Не подтверждена полнота заказов и отмен");
    if(g.cogs===null && salesWindowCovered)g.data_gaps.push("Не вся цена закупа известна");
    if(g.mayak_expense===null)g.data_gaps.push("Нет полного расчёта ТК Маяк");
    // An unassigned KM/master_code must not erase a valid financial result.
    // Keep it in the exception register, but calculate whenever actual direct
    // costs (including proven zero-unit costs) are known.
    if(g.cogs!==null && g.mayak_expense!==null) {
      g.estimated_result=provisionalResult(g.ozon_amount,g.cogs,g.mayak_expense);
    }else g.estimated_result=null;
    g.details = g.details.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }
  // Attribution of the REAL Seller PPC charge to SKU. The Performance
  // amounts are weights only, never a second expense booked to profit.
  // While coverage is incomplete the charge stays in unallocated Seller
  // totals. Redistribution leaves total company profit invariant.
  let allocatedPpcCents=0;
  const allWeight=[...adByOffer.values()].reduce((sum,v)=>sum+Math.max(0,v),0);
  if(adComplete && unallocatedSellerPpcCents<0 && allWeight>0){
    const ordered=[...adByOffer.entries()].filter(([,weight])=>weight>0)
      .sort((a,b)=>b[1]-a[1]);
    for(const [offer,weight] of ordered){
      const row=byOffer.get(offer);
      if(!row)continue; // unknown SKU allocation remains unallocated
      const portion=Math.min(-unallocatedSellerPpcCents+allocatedPpcCents,
        Math.round(-unallocatedSellerPpcCents*weight/allWeight));
      if(portion<=0)continue;
      const signed=-portion;
      row.allocated_seller_ppc=fromKopecks(signed);
      row.advertising_amount=round(row.advertising_amount+row.allocated_seller_ppc);
      if(row.estimated_result!==null)
        row.estimated_result=round(row.estimated_result+row.allocated_seller_ppc);
      allocatedPpcCents+=signed;
    }
  }
  // Build per-article Ozon service lines from RAW nested finance operations.
  // The database reconciliation guarantees sum(service amounts) = Seller ledger.
  const drillByOffer=new Map<string,Map<string,Group["details"][number]>>();
  for(const item of itemizedRes.data as Itemized[]??[]){
    const m=mapBySku.get(item.sku);
    const offer=m?.offer_id||"SKU:"+item.sku;
    const description=types.get(item.type_id)||item.name;
    const labels=drillByOffer.get(offer)??new Map<string,Group["details"][number]>();
    const key=item.type_id+"|"+description;
    const old=labels.get(key);
    labels.set(key,{type_id:item.type_id,name:description,
      amount:round(Number(item.amount)+(old?.amount??0)),
      count:Number(item.item_count)+(old?.count??0),
      is_advertising: classifyAdvertisingAccrual(item.type_id,description,"ITEM").isAdvertising});
    drillByOffer.set(offer,labels);
  }
  for(const [offer,map] of drillByOffer){
    const row=byOffer.get(offer);
    if(row)row.details=[...map.values()].sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount));
  }
  for(const row of byOffer.values()){
    if(row.allocated_seller_ppc!==0)
      row.details.push({type_id:"PPC_ALLOCATION",
        name:"Оплата за клик (распределено из общих начислений Seller API)",
        amount:row.allocated_seller_ppc,count:0,is_advertising:true});
    row.details.sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount));
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
    unallocated_amount: fromKopecks(accounting.unallocatedKopecks-allocatedPpcCents),
    ppc_allocated_to_skus:fromKopecks(allocatedPpcCents),
    ppc_still_unallocated:fromKopecks(unallocatedSellerPpcCents-allocatedPpcCents),
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
      performance_total: adComplete
        ?round([...adByOffer.values()].reduce((a,b)=>a+b,0)):null,
      discrepancy: null,
      reconciliation_status: accounting.unknownTypeOperations > 0
        ? "requires_type_review" : "not_checked_against_performance",
    },
    sales_window_covered: salesWindowCovered,
    actual_buyout_days: salesWindowCovered ? days.length : 0,
    actual_buyouts_covered: salesWindowCovered,
    unit_method:"orders_minus_cancellations",
    stock_as_of:(stocksRes.data as StockRow[]??[])[0] ?? null,
    transit_as_of:transitAsOf,
    transit_snapshot_ready:transitSnapshotReady,
    crossdock_as_of:crossdockCurrent?.published_at??null,
    source: "supabase_cached_finance",
    ads_covered:adComplete,
    ads_jobs:adJobsRes.data??[],
    ads_covered_days:adCoverage.size,
    ads_performance_total:adComplete?round([...adByOffer.values()].reduce((a,b)=>a+b,0)):null,
    background_jobs: jobsRes.data ?? [],
    calculation_includes_api_calls: false,
    profit_status: salesWindowCovered ? "calculated_from_orders_less_cancellations" : "missing_sales_coverage",
    warning: "Расчёты по кэшу Supabase: количество «выкупов» по согласованной формуле = заказы − отмены (НЕ подтверждение вручения покупателю). Цена закупа списывается по этому количеству. Реклама уже учтена в начислениях Ozon и не списывается дважды. Товары в пути и кросс-докинг без подтверждённых статусов не подменяются нулями.",
    rows: Array.from(byOffer.values()).sort((a, b) => a.ozon_amount - b.ozon_amount),
    reference_gaps: referenceGaps.sort((a,b)=>a.offer_id.localeCompare(b.offer_id,"ru")),
    unallocated_details: (unallocatedRes.data as Array<{
      type_id:string;accrued_category:string;amount:string|number;item_count:number
    }>??[]).map(item=>{
      const fallback:Record<string,string>={
        "1":"Эквайринг","12":"Кросс-докинг","15":"Утилизация",
        "25":"Товарная компенсация","29":"Доставка до места выдачи",
        "32":"Логистика","41":"Оплата за клик","46":"Размещение на складах Ozon",
        "77":"Приёмка поставки на склад Ozon",
        "UNSPECIFIED":"Операции по отправлениям с несколькими товарами",
        "ITEM_REMAINDER":"Остаток товарных начислений без детализации",
        "ITEM_UNCLASSIFIED":"Товарные начисления без типа"
      };
      return {type_id:item.type_id,
        name:types.get(item.type_id)||fallback[item.type_id]||
          "Статья Ozon №"+item.type_id,
        amount:round(Number(item.amount)),count:Number(item.item_count),
        category:item.accrued_category};
    }).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount)),
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
      return fail("Устаревшая выгрузка отключена. Используйте постраничный импорт через /api/agents/ozon-finance-sync.", 410);
    }
    if (payload.action === "queuePeriod") {
      const from=String(payload.from??""),to=String(payload.to??"");
      const dates=dateRange(from,to);
      const today=new Date().toISOString().slice(0,10);
      const eligible=dates.filter(day=>day<=today);
      const {data:completed,error:completedError}=await db.from("ozon_finance_sync_days")
        .select("day").eq("account_key",ACCOUNT).gte("day",from).lte("day",to);
      if(completedError)throw completedError;
      const done=new Set((completed??[]).map(x=>x.day));
      const pending=eligible.filter(day=>!done.has(day));
      // A completed Seller import does not mean Performance SKU data exists.
      // Queue missing ad dates for background processing independently.
      const {data:adCoverage,error:adCovErr}=await db.from("ozon_finance_ad_coverage")
        .select("day").eq("account_key",ACCOUNT).gte("day",from).lte("day",to);
      if(adCovErr)throw adCovErr;
      const adCompleted=new Set((adCoverage??[]).map(x=>x.day));
      const missingAd=eligible.filter(day=>!adCompleted.has(day));
      if(missingAd.length){
        const adStart=missingAd[0],adEnd=missingAd[missingAd.length-1];
        const {error:adError}=await db.from("ozon_finance_ad_sync_jobs").upsert({
          account_key:ACCOUNT,date_from:adStart,date_to:adEnd,status:"pending",
          last_error:null
        },{onConflict:"account_key,date_from,date_to",ignoreDuplicates:true});
        if(adError)throw adError;
      }
      for(const day of pending){
        const {error}=await db.from("ozon_finance_page_jobs").upsert({
          account_key:ACCOUNT,day,run_id:randomUUID(),
          status:"running",last_id:"",pages_completed:0,rows_saved:0
        },{onConflict:"account_key,day",ignoreDuplicates:true});
        if(error)throw error;
      }
      return NextResponse.json({ok:true,queued_days:pending.length,
        completed_days:done.size,requested_days:dates.length,
        source:"supabase_background_queue",
        note:"Даты включительно; очередь пополняется только недостающими днями."});
    }
    if (payload.action === "setDiscontinued") {
      const master=String(payload.master_code??"").trim();
      if(!/^[A-Za-zА-Яа-яЁё0-9._-]{1,80}$/.test(master))
        return fail("Не указан корректный master_code",400);
      const {data:existingStatus,error:readStatusError}=await db
        .from("product_article_statuses").select("status").eq("master_code",master).maybeSingle();
      if(readStatusError)throw readStatusError;
      if(existingStatus && !["Активный","Выводится из продажи"].includes(existingStatus.status))
        return fail("Для этого товара задан специальный статус («"+existingStatus.status+
          "»). Его нельзя изменять флажком финансиста.",409);
      const {error}=await db.from("product_article_statuses").upsert({
        master_code:master,
        status:payload.discontinued===true?"Выводится из продажи":"Активный",
        updated_at:new Date().toISOString()
      },{onConflict:"master_code"});
      if(error)throw error;
      return NextResponse.json({ok:true,master_code:master,
        discontinued:payload.discontinued===true});
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
