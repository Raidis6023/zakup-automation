import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "../ThemeToggle";
import StocksClient, { type StockRow, type StockEvent } from "./StocksClient";
import "./stocks.css";

export const dynamic = "force-dynamic";

type StockSnapshot = {
  id: number;
  product_id: string;
  snapshot_date: string;
  warehouse_name: string;
  quantity: number;
  imported_at: string | null;
};
type Product = { id: string; offer_id: string; name: string | null; master_code: string | null };
type ChinaRun = {
  own_stock_snapshot_date: string | null;
  responsible_storage_snapshot_date: string | null;
};

async function read<T>(table: string, options: Record<string, string>): Promise<T[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) throw Error("Не настроен Supabase");
  const url = new URL(base + "/rest/v1/" + table);
  for (const [name, value] of Object.entries(options)) url.searchParams.set(name, value);
  const r = await fetch(url.toString(), {
    headers: { apikey: key, Authorization: "Bearer " + key },
    cache: "no-store",
  });
  if (!r.ok) throw Error("Ошибка чтения " + table + ": HTTP " + r.status);
  return await r.json() as T[];
}

async function pages<T>(table: string, select: string, filter: Record<string, string> = {}) {
  const result: T[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const block = await read<T>(table, {
      select, order: table === "products" ? "id.asc" : "snapshot_date.desc,id.asc",
      offset: String(offset), limit: "1000", ...filter,
    });
    result.push(...block);
    if (block.length < 1000) return result;
  }
  throw Error("Слишком большой отчёт. Требуется пагинация.");
}

async function load(table: string): Promise<StockSnapshot[]> {
  const [last] = await read<{ snapshot_date: string }>(table, {
    select: "snapshot_date", order: "snapshot_date.desc", limit: "1",
  });
  if (!last) return [];
  const after = new Date(last.snapshot_date + "T12:00:00Z");
  after.setUTCDate(after.getUTCDate() - 125);
  return pages<StockSnapshot>(table, "id,product_id,snapshot_date,warehouse_name,quantity,imported_at", {
    snapshot_date: "gte." + after.toISOString().slice(0, 10),
  });
}

function dateList(snapshots: StockSnapshot[]) {
  return Array.from(new Set(snapshots.map((s) => s.snapshot_date))).sort((a, b) => b.localeCompare(a));
}
function aggregate(snapshots: StockSnapshot[], productKeys: Map<string, string>) {
  const dates = new Map<string, Map<string, number>>();
  for (const s of snapshots) {
    const product = productKeys.get(s.product_id) || "id:" + s.product_id;
    if (!dates.has(s.snapshot_date)) dates.set(s.snapshot_date, new Map());
    const quantities = dates.get(s.snapshot_date)!;
    quantities.set(product, (quantities.get(product) || 0) + s.quantity);
  }
  return dates;
}
function count(maps: Map<string, Map<string, number>>, date: string | null, code: string) {
  return date ? (maps.get(date)?.get(code) || 0) : 0;
}
function changes(
  maps: Map<string, Map<string, number>>, dates: string[], code: string,
  source: "АВЕДЭКС" | "ОХ", from: string,
): StockEvent[] {
  const forward = [...dates].reverse();
  const result: StockEvent[] = [];
  for (let i = 1; i < forward.length; i++) {
    if (forward[i] < from) continue;
    const prev = count(maps, forward[i - 1], code);
    const curr = count(maps, forward[i], code);
    if (prev !== curr) result.push({ date: forward[i], source, previous: prev, current: curr, delta: curr - prev });
  }
  return result;
}

async function getReport() {
  const [avedexUnfiltered, oh, products, lastRuns] = await Promise.all([
    load("own_stock_snapshots"),
    load("responsible_storage_stock_snapshots"),
    pages<Product>("products", "id,offer_id,name,master_code"),
    read<ChinaRun>("china_calculation_runs", {
      select: "own_stock_snapshot_date,responsible_storage_snapshot_date",
      order: "calculated_at.desc", limit: "1",
    }),
  ]);
  const avedex = avedexUnfiltered.filter((s) => !s.warehouse_name.toLowerCase().includes("тест"));
  const datesA = dateList(avedex), datesO = dateList(oh);
  const [aDate, aPrev] = [datesA[0] || null, datesA[1] || null];
  const [oDate, oPrev] = [datesO[0] || null, datesO[1] || null];
  const lookup = new Map<string, string>();
  const labels = new Map<string, { article: string; name: string; masterCode: string | null }>();
  for (const product of products) {
    const masterCode = product.master_code?.trim() || null;
    const code = masterCode ? "master:" + masterCode : "id:" + product.id;
    lookup.set(product.id, code);
    if (!labels.has(code)) {
      labels.set(code, { article: product.offer_id || masterCode || product.id, name: product.name || "Без названия", masterCode });
    }
  }
  const aMap = aggregate(avedex, lookup), oMap = aggregate(oh, lookup);
  const keys = new Set<string>();
  for (const source of [aMap, oMap]) {
    for (const items of source.values()) for (const key of items.keys()) keys.add(key);
  }
  const maxDate = [aDate, oDate].filter((v): v is string => !!v).sort().at(-1)
    || new Date().toISOString().slice(0, 10);
  const start = new Date(maxDate + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - 30);
  const from = start.toISOString().slice(0, 10);

  const rows: StockRow[] = Array.from(keys, (code): StockRow => {
    const missingAvedex = !!aPrev && !!aMap.get(aPrev)?.has(code) && !aMap.get(aDate || "")?.has(code);
    const missingOh = !!oPrev && !!oMap.get(oPrev)?.has(code) && !oMap.get(oDate || "")?.has(code);
    return {
      code,
      ...(labels.get(code) || { article: code, name: "Нет карточки товара", masterCode: null }),
      avedex: count(aMap, aDate, code),
      oh: count(oMap, oDate, code),
      aDelta: aPrev ? count(aMap, aDate, code) - count(aMap, aPrev, code) : null,
      oDelta: oPrev ? count(oMap, oDate, code) - count(oMap, oPrev, code) : null,
      missingAvedex, missingOh,
      history: [...changes(aMap, datesA, code, "АВЕДЭКС", from),
        ...changes(oMap, datesO, code, "ОХ", from)]
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }).filter((r) => r.avedex !== 0 || r.oh !== 0 || r.history.length || r.missingAvedex || r.missingOh);
  rows.sort((a, b) => (b.avedex + b.oh) - (a.avedex + a.oh) || a.article.localeCompare(b.article, "ru"));
  const chinaRun = lastRuns[0];
  return {
    rows, aDate, aPrev, oDate, oPrev,
    aUploadedAt: avedex.filter((s) => s.snapshot_date === aDate)
      .map((s) => s.imported_at).filter((d): d is string => !!d).sort().at(-1) || null,
    oUploadedAt: oh.filter((s) => s.snapshot_date === oDate)
      .map((s) => s.imported_at).filter((d): d is string => !!d).sort().at(-1) || null,
    aTotal: rows.reduce((sum, r) => sum + r.avedex, 0),
    oTotal: rows.reduce((sum, r) => sum + r.oh, 0),
    missing: rows.filter((r) => r.missingAvedex || r.missingOh).length,
    calculatedFromLatest: !!chinaRun
      && chinaRun.own_stock_snapshot_date === aDate
      && chinaRun.responsible_storage_snapshot_date === oDate,
  };
}

export default async function StocksPage({ searchParams }: {
  searchParams: Promise<{ import?: string; calc?: string }>;
}) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  let report: Awaited<ReturnType<typeof getReport>> | null = null;
  let error: string | null = null;
  try { report = await getReport(); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Не удалось получить остатки"; }
  return (
    <main className="page stocks-page"><div className="container">
      <header className="header">
        <div>
          <div className="small-label">СКЛАДСКОЙ УЧЁТ · ТЕСТОВЫЙ РЕЖИМ</div>
          <h1 className="title">Остатки</h1>
          <p className="subtitle">Контроль еженедельных Excel-выгрузок АВЕДЭКС и ответственного хранения.</p>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <Link className="secondary-button navigation-button" href="/zakup">← Закуп</Link>
          <Link className="secondary-button navigation-button workspace-home-button" href="/">Главная</Link>
        </div>
      </header>
      <section className="section stocks-upload">
        <div className="stocks-buttons">
          <Link className="primary-button stocks-upload-link" href="/stock-import">Загрузить остатки АВЕДЭКС</Link>
          <Link className="primary-button stocks-upload-link" href="/responsible-storage-import">Загрузить ОХ</Link>
        </div>
        <p className="stocks-caption">
          Открываются существующие проверенные импорты Excel. Остатки записываются
          в общие рабочие таблицы Supabase, а не в отдельную тестовую копию.
        </p>
      </section>
      {query.import === "avedex" && (
        <div className={query.calc === "ok" ? "stocks-success" : "stocks-warning"}>
          Остатки АВЕДЭКС сохранены в общей базе. {query.calc === "ok"
            ? "Расчёт Китая обновлён."
            : "Расчёт Китая обновить не удалось. Проверьте входные данные на странице «Закуп»."}
        </div>
      )}
      {error && <section className="section"><strong>Ошибка получения остатков</strong><p>{error}</p></section>}
      {report && <StocksClient {...report} />}
    </div></main>
  );
}
