"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Detail = { type_id: string; name: string; amount: number; count: number };
type FinanceRow = {
  offer_id: string; master_code: string | null; name: string | null; manager: string;
  ozon_amount: number; sold_units: number | null; unit_cost: number | null;
  cogs: number | null; mayak_unit: number | null; mayak_expense: number | null;
  mayak_covered_units: number | null; estimated_result: number | null;
  buyout_units: number | null; data_gaps: string[]; details: Detail[];
};
type FinanceReport = {
  from: string; to: string; synced_days: number; total_days: number;
  missing_days: string[]; operation_count: number; ledger_amount: number;
  allocated_amount: number; unallocated_amount: number; total_mayak: number; sales_window_covered: boolean;
  profit_status: string; warning: string;
  actual_buyout_days: number; actual_buyouts_covered: boolean;
  source: string; calculation_includes_api_calls: boolean;
  reference_gaps: Array<{offer_id:string;master_code:string|null;name:string|null;manager:string;missing:string[]}>;
  rows: FinanceRow[]; unallocated_details: Array<{ name: string; amount: number }>;
};
const API = "/api/agents/ozon-finance";
const currency = (v: number | null | undefined) =>
  v == null ? "Нет данных" : v.toLocaleString("ru-RU", { style: "currency", currency: "RUB" });
function isoShift(delta: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function listDays(from: string, to: string) {
  const arr: string[] = [];
  for (let v = Date.parse(from + "T00:00:00Z"), end = Date.parse(to + "T00:00:00Z");
    Number.isFinite(v) && v <= end && arr.length < 367; v += 86400000)
    arr.push(new Date(v).toISOString().slice(0, 10));
  return arr;
}
async function post(body: Record<string, unknown>) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store" });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.error || "Ошибка сервера");
  return data;
}
export default function FinancierClient() {
  const [from, setFrom] = useState(() => isoShift(-14));
  const [to, setTo] = useState(() => isoShift(-1));
  const [data, setData] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [managerFilter, setManagerFilter] = useState("Все КМ");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [editManager, setEditManager] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editMayak, setEditMayak] = useState("");
  const [editValidFrom, setEditValidFrom] = useState(() => isoShift(0));
  const [advice, setAdvice] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const load = useCallback(async () => {
    setError(""); setLoading(true);
    try {
      const query = new URLSearchParams({ from, to });
      const response = await fetch(API + "?" + query.toString(), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Ошибка получения отчёта");
      setData(json as FinanceReport);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);
  const managers = useMemo(() => ["Все КМ",
    ...new Set((data?.rows ?? []).map(r => r.manager).sort((a, b) => a.localeCompare(b, "ru")))],
    [data]);
  const rows = useMemo(() => (data?.rows ?? []).filter(r =>
    (managerFilter === "Все КМ" || r.manager === managerFilter) &&
    (r.offer_id + " " + (r.master_code ?? "") + " " + (r.name ?? ""))
      .toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))), [data, managerFilter, search]);
  const missingRows = useMemo(() => data?.reference_gaps ?? [], [data]);
  const active = rows.find(r => r.offer_id === selected);
  async function preflight(): Promise<void> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/agents/ozon-finance-sync?diagnostics=1", {
        method: "GET", cache: "no-store", signal: controller.signal,
      });
      const raw = await response.text();
      let json: { ok?: boolean; error?: string; stage?: string;
        project_ref?: string; server_latency_ms?: number };
      try { json = JSON.parse(raw); }
      catch { throw new Error("Vercel вернул не JSON, HTTP " + response.status +
        ". Проверьте Preview URL и авторизацию сайта."); }
      if (!response.ok || !json.ok) throw new Error(
        "Ошибка проверки API (" + (json.stage ?? "unknown") +
        "), HTTP " + response.status + ": " + (json.error ?? "неизвестная ошибка")
      );
      if (json.project_ref !== "zlkluzcjppefelgwihyz") throw new Error(
        "Preview подключён к другой Supabase (" + (json.project_ref ?? "?") +
        "), а финансовая база проекта имеет ID zlkluzcjppefelgwihyz. Импорт остановлен."
      );
      setConnectionStatus("Соединение исправно: Vercel → Supabase (" +
        json.project_ref + "), " + json.server_latency_ms + " мс.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("API не ответил за 15 секунд ещё до обращения к Ozon. Проверьте авторизацию, Supabase и Preview.");
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }
  async function checkConnection() {
    setDiagnosing(true);
    setError("");
    setConnectionStatus("Проверяем подключение Vercel к Supabase…");
    try { await preflight(); }
    catch (error) {
      setConnectionStatus("");
      setError(error instanceof Error ? error.message : String(error));
    } finally { setDiagnosing(false); }
  }
  async function mapDaySkus(day: string) {
    let totalMatched = 0;
    let notMatched = 0;
    for (let batch = 1; batch <= 100; batch++) {
      setProgress("Начисления за " + day + " сохранены. Сопоставляем SKU с артикулами: пакет " + batch + "…");
      const reply = await fetch("/api/agents/ozon-finance-map", {
        method: "POST", headers: { "Content-Type": "application/json" },
        cache: "no-store", body: JSON.stringify({ day }),
        signal: AbortSignal.timeout(55000),
      });
      const json = await reply.json();
      if (!reply.ok || !json.ok) throw new Error(json.error || "Не удалось сопоставить товары Ozon");
      totalMatched += Number(json.resolved ?? 0);
      notMatched += Number(json.unresolved ?? 0);
      if (!json.more) return { matched: totalMatched, unresolved: notMatched };
      await new Promise(resolve => setTimeout(resolve, 280));
    }
    throw new Error("Не завершено сопоставление SKU: больше 100 пакетов.");
  }
  async function remapPeriod() {
    if (!data || busy) return;
    const ready = listDays(from, to).filter(d => !data.missing_days.includes(d));
    if (!ready.length) { setError("Сначала загрузите хотя бы один день начислений"); return; }
    setBusy(true); setError("");
    let matched = 0, unmatched = 0;
    try {
      for (const day of ready) {
        const status = await mapDaySkus(day);
        matched += status.matched; unmatched += status.unresolved;
      }
      setProgress("Сопоставление завершено. Найдено товаров: " + matched +
        (unmatched ? ". Не удалось определить артикул для " + unmatched + " SKU." : "."));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await load();
    } finally { setBusy(false); }
  }
  async function syncPeriod() {
    if (!data) return;
    const forceRefresh = data.missing_days.length === 0;
    if (forceRefresh && !window.confirm("Все дни загружены. Перезапустить финансовую синхронизацию за выбранный период?")) return;
    const days = forceRefresh ? listDays(from, to) : data.missing_days;
    setBusy(true); setError(""); setAdvice("");
    let completed = 0;
    let totalPages = 0;
    let totalRows = 0;
    try {
      setProgress("Проверяем соединение с Supabase перед загрузкой…");
      await preflight();
      for (const day of days) {
        let firstStep = true;
        let waiting = 0;
        while (true) {
          setProgress(
            "Ozon " + day + " · день " + (completed + 1) + "/" + days.length +
            " · страниц: " + totalPages + " · сохранено записей: " + totalRows +
            ". Запрашиваем следующую страницу…"
          );
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 48000);
          let response: Response;
          try {
            response = await fetch("/api/agents/ozon-finance-sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              body: JSON.stringify({ day, restart: forceRefresh && firstStep }),
              signal: controller.signal,
            });
          } catch (networkError) {
            if (networkError instanceof Error && networkError.name === "AbortError") {
              throw new Error("Сервер не закончил загрузку страницы за 48 секунд. Проверьте состояние API и повторите. Сохранённые ранее страницы не потеряются.");
            }
            throw networkError;
          } finally {
            window.clearTimeout(timer);
          }
          firstStep = false;
          const result = await response.json();
          if (!response.ok || !result.ok) {
            throw new Error(result.error || "Ошибка синхронизации Ozon за " + day);
          }
          if (result.busy) {
            waiting += 1;
            if (waiting > 35) throw new Error("Запрос по " + day + " слишком долго обрабатывается. Прогресс сохранён. Обновите страницу и продолжите.");
            setProgress("Ozon " + day + ": ждём освобождения предыдущей страницы. Сохранено " + result.rows_saved + " записей.");
            await new Promise(resolve => setTimeout(resolve, 2500));
            continue;
          }
          waiting = 0;
          totalPages = Number(result.pages_completed ?? totalPages);
          totalRows = Number(result.rows_saved ?? totalRows);
          setProgress(
            "Ozon " + day + " · загружено страниц: " +
            result.pages_completed + " · начислений: " + result.rows_saved +
            (result.done ? " · день готов." : " · продолжаем…")
          );
          if (result.done) {
            completed += 1;
            try {
              const mappings = await mapDaySkus(day);
              setProgress("Ozon " + day + " готов · строк: " + result.rows_saved +
                " · SKU сопоставлено: " + mappings.matched +
                (mappings.unresolved ? " · без артикула: " + mappings.unresolved : ""));
            } catch (mappingError) {
              // Finance rows are already committed. Mapping failure is non-fatal
              // and can be resumed from the separate button, without a costly reimport.
              setError("Начисления за " + day + " сохранены. Сопоставление SKU: " +
                (mappingError instanceof Error ? mappingError.message : String(mappingError)) +
                ". Используйте кнопку «Сопоставить SKU», не перезагружая начисления.");
            }
            await load();
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
      setProgress("Выгрузка завершена. Загружено дней: " + completed + " из " + days.length +
        ". Количество начислений: " + totalRows + " за последний день.");
      await load();
    } catch (e) {
      setError(
        "Завершено дней: " + completed + "/" + days.length +
        ". " + (e instanceof Error ? e.message : String(e)) +
        " Уже загруженные страницы сохранены. Можно продолжить после обновления страницы."
      );
      await load();
    } finally { setBusy(false); }
  }
  function choose(r: FinanceRow) {
    setSelected(r.offer_id === selected ? "" : r.offer_id);
    setEditManager(r.manager === "Не назначен" ? "" : r.manager);
    setEditCost(r.unit_cost == null ? "" : String(r.unit_cost));
    setEditMayak(r.mayak_unit == null ? "" : String(r.mayak_unit));
    setEditValidFrom(from);
  }
  async function save() {
    if (!active?.master_code) return;
    setBusy(true); setError("");
    try {
      const body: Record<string, unknown> = {
        action: "saveProduct", master_code: active.master_code, manager: editManager,
      };
      if (editCost.trim() !== "") {
        body.cost = Number(editCost.replace(",", "."));
        body.valid_from = editValidFrom;
      }
      if (editMayak.trim() !== "") {
        body.mayak = Number(editMayak.replace(",", "."));
        body.valid_from = editValidFrom;
      }
      await post(body);
      setProgress("Изменения сохранены для " + active.master_code);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function analyze() {
    setAiBusy(true); setError(""); setAdvice("");
    try {
      const result = await post({ action: "analyze", from, to });
      setAdvice(result.advice);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setAiBusy(false); }
  }
  function exportCsv() {
    const content = [
      ["Артикул", "master_code", "КМ", "Начисления Ozon, ₽", "Продажи, шт (предварительно)",
        "Себестоимость, ₽/шт", "ТК Маяк, ₽/шт", "ТК Маяк, расход, ₽", "Предварительный результат"].join(";"),
      ...rows.map(r => [r.offer_id, r.master_code ?? "", r.manager,
        r.ozon_amount.toFixed(2).replace(".", ","),
        r.sold_units ?? "", r.unit_cost ?? "", r.mayak_unit ?? "", r.mayak_expense ?? "", r.estimated_result ?? ""].map(x => '"' + String(x).replaceAll('"', '""') + '"').join(";")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url;
    a.download = "ozon-finance-" + from + "-" + to + ".csv"; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="ozf-layout">
      <div className="ozf-panel ozf-filters">
        <label>С даты<input type="date" value={from} onChange={e => setFrom(e.target.value)} disabled={busy}/></label>
        <label>По дату<input type="date" value={to} onChange={e => setTo(e.target.value)} disabled={busy}/></label>
        <button className="ozf-btn" onClick={() => void checkConnection()} disabled={busy || diagnosing}>
          {diagnosing ? "Проверяем API…" : "Проверить соединение"}
        </button>
        <button className="ozf-btn" onClick={() => void load()} disabled={loading || busy}>Обновить отчёт</button>
        <button className="ozf-btn ozf-primary" onClick={() => void syncPeriod()} disabled={busy || loading || !data}>
          {busy ? "Загрузка…" : (data?.missing_days.length ? "Загрузить недостающие дни" : "Пересинхронизировать период")}
        </button>
        <button className="ozf-btn" onClick={() => void remapPeriod()} disabled={busy || loading || !data || data.synced_days===0}>
          Сопоставить SKU
        </button>
      </div>
      {connectionStatus && <p className="ozf-progress" role="status">{connectionStatus}</p>}
      {error && <p className="ozf-error" role="alert">{error}</p>}
      {progress && <p className="ozf-progress" role="status">{progress}</p>}
      <div className="ozf-metrics">
        <div className="ozf-panel"><span>Начисления Ozon, все статьи</span><strong>{currency(data?.ledger_amount)}</strong><small>Без себестоимости. Это не прибыль.</small></div>
        <div className="ozf-panel"><span>Привязано к артикулам</span><strong>{currency(data?.allocated_amount)}</strong><small>Сумма операций с установленным товаром</small></div>
        <div className="ozf-panel"><span>Без привязки к товару</span><strong>{currency(data?.unallocated_amount)}</strong><small>Не распределяется произвольно</small></div>
        <div className="ozf-panel"><span>ТК Маяк, учтённый расход</span><strong>{currency(data?.total_mayak)}</strong><small>Сумма только по товарам с полными тарифами и FBO-данными</small></div>
        <div className="ozf-panel"><span>Кэш Ozon</span><strong>{data ? data.synced_days + " / " + data.total_days + " дней" : "..."}</strong><small>{data?.operation_count.toLocaleString("ru-RU") ?? "0"} начислений · смена дат без запросов к Ozon</small></div>
        <div className="ozf-panel"><span>Фактические выкупы</span><strong>{data ? data.actual_buyout_days + " / " + data.total_days + " дней" : "..."}</strong><small>Себестоимость признаётся только по подтверждённым выкупам</small></div>
      </div>
      <p className="ozf-notice">{data?.warning ?? "Загружаем доступные финансовые данные…"}</p>
      <div className="ozf-panel">
        <div className="ozf-toolbar">
          <div><h2>Финансы по артикулам</h2><p>Нажмите на товар для статей начислений и назначения КМ.</p></div>
          <div className="ozf-filter-actions">
            <input aria-label="Поиск артикула" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск артикула / master_code"/>
            <select aria-label="Категорийный менеджер" value={managerFilter} onChange={e => setManagerFilter(e.target.value)}>
              {managers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button className="ozf-btn" onClick={exportCsv} disabled={!rows.length}>CSV</button>
          </div>
        </div>
        <div className="ozf-table-scroll"><table className="ozf-table">
          <thead><tr><th>Артикул Ozon</th><th>master_code</th><th>КМ</th><th>Начисления, ₽</th><th>Заказано FBO, шт*</th><th>Факт. выкупы, шт</th><th>Себестоимость/шт</th><th>ТК Маяк, ₽/шт</th><th>ТК Маяк, ₽</th><th>Результат*</th></tr></thead>
          <tbody>
            {rows.map(r => <tr key={r.offer_id} onClick={() => choose(r)} className={selected === r.offer_id ? "ozf-row-active" : ""}>
              <td><b>{r.offer_id}</b><small>{r.name ?? ""}</small></td>
              <td>{r.master_code ?? "Не сопоставлен"}</td><td>{r.manager}</td>
              <td className={r.ozon_amount < 0 ? "ozf-negative" : ""}>{currency(r.ozon_amount)}</td>
              <td>{r.sold_units ?? "Нет подтверждения"}</td>
              <td>{r.buyout_units ?? "Нет подтверждения"}</td>
              <td>{currency(r.unit_cost)}</td><td>{currency(r.mayak_unit)}</td>
              <td>{currency(r.mayak_expense)}</td>
              <td>{r.estimated_result == null ? "Нет расчёта" : currency(r.estimated_result) + " *"}</td>
            </tr>)}
            {!rows.length && <tr><td colSpan={10} className="ozf-empty">Нет данных для выбранного периода или КМ.</td></tr>}
          </tbody>
        </table></div>
        <p className="ozf-footnote">* ТК Маяк = тариф × неотменённые заказанные FBO-штуки. Себестоимость = подтверждённые фактические выкупы × себестоимость на дату реализации. При отсутствии подтверждённых выкупов результат не публикуется. Общие начисления не распределяются произвольно.</p>
      </div>
      <div className="ozf-panel ozf-missing-report">
        <div className="ozf-toolbar">
          <div><h2>Контроль незаполненных данных · {missingRows.length} размещений</h2>
            <p>Отдельный реестр по всей номенклатуре, независимо от выгрузки начислений. Нет master_code, КМ, себестоимости или ТК Маяк.</p></div>
          <a href="#ozf-rates" className="ozf-btn">Открыть справочник тарифов</a>
        </div>
        <div className="ozf-table-scroll"><table className="ozf-table">
          <thead><tr><th>Артикул</th><th>master_code</th><th>КМ</th><th>Чего не хватает</th><th>Статус результата</th></tr></thead>
          <tbody>
            {missingRows.map(r=><tr key={r.offer_id}>
              <td>{r.offer_id}</td><td>{r.master_code??"Не привязан"}</td><td>{r.manager}</td>
              <td>{r.missing.join(", ")}</td>
              <td>Неполные исходные данные</td>
            </tr>)}
            {!missingRows.length&&<tr><td colSpan={5} className="ozf-empty">В справочнике товаров все обязательные поля заполнены.</td></tr>}
          </tbody>
        </table></div>
      </div>
      {active && <div className="ozf-panel ozf-detail">
        <h2>{active.offer_id} · детализация</h2>
        <div className="ozf-edit">
          <label>Ответственный КМ<input value={editManager} onChange={e => setEditManager(e.target.value)} placeholder="Дарья, Вероника, Ольга…"/></label>
          <label>Себестоимость, ₽ / шт<input type="text" inputMode="decimal" value={editCost} onChange={e => setEditCost(e.target.value)} placeholder="Например, 139.50"/></label>
          <label>ТК Маяк, ₽ / шт<input type="text" inputMode="decimal" value={editMayak} onChange={e => setEditMayak(e.target.value)} placeholder="Например, 3.14"/></label>
          <label>Тариф с даты<input type="date" value={editValidFrom} onChange={e=>setEditValidFrom(e.target.value)}/></label>
          <button className="ozf-btn ozf-primary" disabled={busy || !active.master_code} onClick={() => void save()}>Сохранить</button>
        </div>
        <p className="ozf-footnote">Стоимость и «ТК Маяк» сохраняются с указанной даты. Расчёт учитывает изменения тарифов по дням FBO-заказов. Если в исходной таблице цена отсутствует, она не заменяется нулём.</p>
        <div className="ozf-notice">ТК Маяк: {currency(active.mayak_unit)} × {active.sold_units ?? "нет данных"} шт. = {currency(active.mayak_expense)}. Этот расход не является начислением Ozon и не входит в сумму Ozon выше.</div>
        <table className="ozf-table"><thead><tr><th>Статья начисления Ozon</th><th>Операций</th><th>Сумма</th></tr></thead>
          <tbody>{active.details.map((d, i) => <tr key={d.type_id + "-" + i}><td>{d.name}</td><td>{d.count}</td><td className={d.amount < 0 ? "ozf-negative" : ""}>{currency(d.amount)}</td></tr>)}</tbody>
        </table>
      </div>}
      <div className="ozf-panel ozf-ai">
        <div className="ozf-toolbar"><div><h2>ИИ-аудитор</h2><p>Ищет аномалии и предлагает проверки, но не пересчитывает суммы сам.</p></div>
          <button className="ozf-btn ozf-primary" onClick={() => void analyze()} disabled={aiBusy || !data || data.missing_days.length > 0}>{aiBusy ? "Анализ…" : "Проанализировать начисления"}</button></div>
        {advice ? <div className="ozf-advice">{advice}</div> : <p className="ozf-footnote">Для анализа потребуется отдельный ключ OpenAI API в серверных настройках. Без него отчёт и импорт работают.</p>}
      </div>
      {!!data?.unallocated_details.length && <div className="ozf-panel">
        <h2>Нераспределённые начисления</h2><p>Эти суммы учтены в общем результате Ozon, но не засчитаны отдельным артикулам.</p>
        <table className="ozf-table"><thead><tr><th>Статья</th><th>Сумма</th></tr></thead><tbody>
          {data.unallocated_details.map((d, i) => <tr key={d.name + i}><td>{d.name}</td><td>{currency(d.amount)}</td></tr>)}
        </tbody></table>
      </div>}
    </section>
  );
}
