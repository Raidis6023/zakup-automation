"use client";
import {prepareFinanceSeries,clearFinanceSeries} from '../../components/finance/finance-series-cache';
import OzonMissingRateEditor from "./OzonMissingRateEditor";
import OrderFulfillmentPanels from "../../components/finance/OrderFulfillmentPanels";
import FinancierDetailTable from "./FinancierDetailTable";
import AccrualBreakdownList from '../../components/finance/AccrualBreakdownList';
import { useCallback, useEffect, useMemo, useState } from "react";

type Detail = { type_id: string; name: string; amount: number; count: number };
type FinanceRow = {
  offer_id: string; master_code: string | null; name: string | null; manager: string;
  ozon_amount: number; sold_units: number | null; unit_cost: number | null;
  cogs: number | null; mayak_unit: number | null; mayak_expense: number | null;
  mayak_covered_units: number | null; estimated_result: number | null;
  buyout_units: number | null; data_gaps: string[]; details: Detail[];
  order_count:number|null;cancelled_units:number|null;revenue:number|null;advertising_amount:number;
  performance_ad_expense:number|null;
  ozon_stock:number|null;main_stock:number|null;ox_stock:number|null;
  in_china:number|null;in_crossdock:number|null;in_transit:number|null;
  transit_revenue:number|null;transit_drr:number|null;discontinued:boolean;
};
type FinanceReport = {
  cache_updated_at?:string|null;
  from: string; to: string; synced_days: number; total_days: number;
  missing_days: string[]; operation_count: number; ledger_amount: number;
  allocated_amount: number; unallocated_amount: number; total_mayak: number; sales_window_covered: boolean;
  profit_status: string; warning: string;
  ads_covered:boolean;ads_covered_days:number;ads_performance_total:number|null;
   ads_daily_sync?:Array<{day:string;status:string;rows_saved:number;expense_rub:number;last_error:string|null;checked_at:string}>;
  advertising?:{finance_total:number;finance_unallocated:number};
  actual_buyout_days: number; actual_buyouts_covered: boolean;
  unit_method?:string;stock_as_of?:{ozon_at:string|null;main_at:string|null;ox_at:string|null}|null;
  source: string; calculation_includes_api_calls: boolean;
  reference_gaps: Array<{offer_id:string;master_code:string|null;name:string|null;manager:string;missing:string[]}>;
  background_jobs: Array<{day:string;status:string;pages_completed:number;rows_saved:number;last_error:string|null;updated_at:string}>;
  rows: FinanceRow[]; unallocated_details: Array<{ type_id?:string; name: string; amount: number;daily?:Array<{date:string;amount:number;count:number}> }>;
};
const API = "/api/agents/ozon-finance";
const currency = (v: number | null | undefined) =>
  v == null ? "Нет данных" : (Math.sign(v)*Math.round(Math.abs(v))||0).toLocaleString("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
    body: JSON.stringify(body), cache: "no-store", signal: body.action === 'analyze' ? AbortSignal.timeout(75000) : undefined });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.error || "Ошибка сервера");
  return data;
}
export default function FinancierClient() {
  const [from, setFrom] = useState(() => isoShift(-14));
  const [to, setTo] = useState(() => isoShift(-1));
  const [appliedFrom,setAppliedFrom] = useState(() => isoShift(-14));
  const [appliedTo,setAppliedTo] = useState(() => isoShift(-1));
  const [pendingManager,setPendingManager] = useState("Все КМ");
  const [managerOptions,setManagerOptions]=useState<string[]>([]);
  const [data, setData] = useState<FinanceReport | null>(null);
  const [adsBusy,setAdsBusy]=useState(false),[adsStatus,setAdsStatus]=useState('');
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
  const [aiError,setAiError]=useState("");
  const load = useCallback(async () => {
    setError(""); setLoading(true);
    try {
      const query = new URLSearchParams({from:appliedFrom,to:appliedTo});
      const response = await fetch(API + "?" + query.toString(), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Ошибка получения отчёта");
      if(json.missing_days?.length)throw Error('Период ещё не загружен полностью: '+json.missing_days.join(', '));
      clearFinanceSeries();
      setData(json as FinanceReport);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [appliedFrom,appliedTo]);
  useEffect(()=>{fetch(API+'?mode=managers',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d.ok)setManagerOptions(d.managers)}).catch(()=>{});},[]);
  const managers = useMemo(() => ["Все КМ",
    ...new Set([...managerOptions,...(data?.rows ?? []).map(r => r.manager)].sort((a, b) => a.localeCompare(b, "ru")))],
    [data,managerOptions]);
  const rows = useMemo(() => (data?.rows ?? []).filter(r =>
    (managerFilter === "Все КМ" || r.manager === managerFilter) &&
    (r.offer_id + " " + (r.master_code ?? "") + " " + (r.name ?? ""))
      .toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))), [data, managerFilter, search]);
  const filteredAccruals = useMemo(()=>{
    if(managerFilter==="Все КМ")return data?.allocated_amount??null;
    return rows.reduce((sum,r)=>sum+Number(r.ozon_amount),0);
  },[rows,data,managerFilter]);
  const missingRows = useMemo(() => data?.reference_gaps ?? [], [data]);
  const active = rows.find(r => r.offer_id === selected);
  async function formReport() {
    setBusy(true);setError("");setProgress("");
    try {
      if (!from || !to || from>to)throw new Error("Проверь даты периода");
      // Selecting a date or KM reads ONLY the local Supabase cache.
      // It must never enqueue a fresh Ozon API import.
      const requested={from,to,manager:pendingManager};
      const response=await fetch(API+'?'+new URLSearchParams({from,to}),{cache:'no-store'});
      const report=await response.json();if(!response.ok||!report.ok)throw Error(report.error??'Ошибка отчёта');
      if(report.missing_days?.length)throw Error('Период загружен не полностью. Не хватает дней: '+report.missing_days.join(', ')+'. Нажмите «Загрузить / продолжить из Ozon».');
      setProgress('Подготавливаем таблицу и все дни графиков…');
      setAppliedFrom(requested.from);setAppliedTo(requested.to);setManagerFilter(requested.manager);setData(report);setSelected('');setProgress('');
    }catch(error){setError(error instanceof Error?error.message:String(error))}
    finally{setBusy(false)}
  }
  async function queueFinance(){
    setBusy(true);setError('');try{
      if(!from||!to||from>to)throw Error('Проверь даты периода');
      await post({action:'queuePeriod',from,to});
      // Do not merely queue the missing days. A single daily cron may run
      // long after the user clicks. Import the missing pages immediately.
      const response=await fetch(API+'?'+new URLSearchParams({from,to}),{cache:'no-store'});
      const report=await response.json();
      if(!response.ok||!report.ok)throw Error(report.error??'Не удалось проверить полноту периода');
      const missing=(report.missing_days??[]) as string[];
      if(missing.length===0){
        await formReport();
        return;
      }
      setProgress('Загружаем недостающие дни Ozon: '+missing.join(', ')+'. Прогресс сохраняется.');
      const complete=await syncPeriod(missing);
      if(complete)await formReport();
    }catch(e){setError(e instanceof Error?e.message:'Ошибка загрузки');}
    finally{setBusy(false);}
  }
  async function toggleDiscontinued(r:FinanceRow,checked:boolean) {
    if(!r.master_code)return;
    try {
      await post({action:"setDiscontinued",master_code:r.master_code,discontinued:checked});
      setData(current=>current?({...current,rows:current.rows.map(item=>
        item.master_code===r.master_code?{...item,discontinued:checked}:item)}):current);
    }catch(error){setError(error instanceof Error?error.message:String(error))}
  }
  const pct=(value:number|null|undefined)=>
    value==null||!Number.isFinite(value)?"—":(value*100).toLocaleString("ru-RU",{maximumFractionDigits:1})+"%";
  const qty=(value:number|null|undefined)=>value==null?"—":value.toLocaleString("ru-RU");

  async function preflight(): Promise<void> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/agents/ozon-finance-sync?diagnostics=1", {
        method: "GET", cache: "no-store", signal: controller.signal,
      });
      const raw = await response.text();
      let json: { ok?: boolean; error?: string; stage?: string;
        project_ref?: string; server_latency_ms?: number;
        credentials?: { seller_id_present?:boolean; seller_api_key_present?:boolean } };
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
      if (!json.credentials?.seller_id_present || !json.credentials?.seller_api_key_present) {
        throw new Error("В этом окружении Vercel отсутствуют Seller API-ключи OZON_CLIENT_ID / OZON_API_KEY. Рекламные ключи Performance их не заменяют.");
      }
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
  async function syncPeriod(missingOverride?:string[]):Promise<boolean> {
    if (!data && !missingOverride) return false;
    const forceRefresh = !missingOverride && data?.missing_days.length === 0;
    if (forceRefresh && !window.confirm("Все дни загружены. Перезапустить финансовую синхронизацию за выбранный период?")) return false;
    const days = missingOverride ?? (forceRefresh ? listDays(from, to) : (data?.missing_days ?? []));
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
      return true;
    } catch (e) {
      setError(
        "Завершено дней: " + completed + "/" + days.length +
        ". " + (e instanceof Error ? e.message : String(e)) +
        " Уже загруженные страницы сохранены. Можно продолжить после обновления страницы."
      );
      await load();
      return false;
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
    setAiBusy(true); setAiError(""); setAdvice("");
    try {
      const result = await post({ action: "analyze", from:appliedFrom, to:appliedTo });
      setAdvice(result.advice);
    } catch (e) { setAiError(e instanceof Error ? e.message : String(e)); }
    finally { setAiBusy(false); }
  }
  function exportCsv() {
    const content = [
      ["Артикул", "master_code", "КМ", "Начисления Ozon, ₽", "Продажи, шт (предварительно)",
        "Цена закупа, руб/шт", "ТК Маяк, ₽/шт", "ТК Маяк, расход, ₽", "Предварительный результат"].join(";"),
      ...rows.map(r => [r.offer_id, r.master_code ?? "", r.manager,
        Math.round(r.ozon_amount),
        r.sold_units ?? "", ...[r.unit_cost,r.mayak_unit,r.mayak_expense,r.estimated_result].map(v=>v==null?"":Math.round(v))].map(x => '"' + String(x).replaceAll('"', '""') + '"').join(";")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url;
    a.download = "ozon-finance-" + from + "-" + to + ".csv"; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="ozf-layout">
      <div className="ozf-panel ozf-filters">
        <label>С даты<input type="date" value={from} onChange={e=>setFrom(e.target.value)} disabled={busy}/></label>
        <label>По дату (включительно)<input type="date" value={to} onChange={e=>setTo(e.target.value)} disabled={busy}/></label>
        <label>КМ<select disabled={busy||loading} value={pendingManager} onChange={e=>setPendingManager(e.target.value)}>
          {managers.map(m=><option key={m} value={m}>{m}</option>)}
        </select></label>
        <button className="ozf-btn ozf-primary" disabled={busy||loading}
          onClick={()=>void formReport()}>{busy?"Формируем…":"Сформировать"}</button>
        <button className="ozf-btn" disabled={!data||loading||busy} onClick={()=>void load()}>Обновить расчёт</button>
        <button className="ozf-btn" onClick={()=>void queueFinance()} disabled={loading||busy}>Загрузить / продолжить из Ozon</button><button className="ozf-btn" disabled={adsBusy} onClick={async()=>{setAdsBusy(true);setAdsStatus('Обработка очереди рекламы…');try{const r=await fetch('/api/agents/ozon-finance-ads',{method:'POST'}),j=await r.json();const daily=j.daily_sku as {ok?:boolean;day?:string;rows_saved?:number;expense_rub?:number;error?:string}|undefined;
setAdsStatus((daily?(daily.ok?'CPC по SKU за '+daily.day+': '+String(daily.rows_saved??0)+' строк, '+Number(daily.expense_rub??0).toLocaleString('ru-RU')+' ₽. ':'Оперативная реклама: '+String(daily.error??'ошибка')+'. '):'')+
 'История кампаний: '+String(j.phase??j.error??'неизвестно')+'. Загружено отчётов: '+String(j.reports_processed??0)+'.');
if(daily?.ok)void load();}catch(e){setAdsStatus(String(e))}finally{setAdsBusy(false)}}}>{adsBusy?'Выгружаем рекламу…':'Продолжить рекламу Ozon'}</button><span role="status">{adsStatus}</span>
      </div>
      {data&&<p>Показан период: <b>{data.from} — {data.to}</b> включительно. Кэш: {data.cache_updated_at?new Date(data.cache_updated_at).toLocaleString('ru-RU',{timeZone:'Asia/Krasnoyarsk'}):'—'} (Красноярск).</p>}
      {data?.ads_daily_sync?.length?(()=>{const latest=data.ads_daily_sync![0];return <p className={latest.status==='failed'?'ozf-error':'ozf-progress'} role="status">
 Оперативная реклама Ozon по SKU: {latest.day}, статус {latest.status==='complete'?'загружено':latest.status==='empty'?'пустой ответ площадки':'ошибка'}, строк {latest.rows_saved}, сумма {latest.status==='complete'?Number(latest.expense_rub).toLocaleString('ru-RU')+' ₽':'не подтверждена'}. {latest.last_error||''} Историческая детализация кампаний загружается отдельно.
 </p>})():null}
       {connectionStatus && <p className="ozf-progress" role="status">{connectionStatus}</p>}
      {error && <p className="ozf-error" role="alert">{error}</p>}
      {progress && <p className="ozf-progress" role="status">{progress}</p>}
      {(busy||loading)&&<div className="bi-skeleton" role="status">Подготавливаем полный отчёт…</div>}
      {data&&!busy&&!loading&&<OrderFulfillmentPanels market="ozon" from={data.from} to={data.to}/>}
       {data&&!busy&&!loading&&<FinancierDetailTable data={data} rows={rows}
        includeUnallocated={managerFilter==="Все КМ"} onSaved={load}
        onToggle={(masterCode,offerId,checked)=>{
          const row=rows.find(r=>r.master_code===masterCode && r.offer_id===offerId);
          if(row)return toggleDiscontinued(row,checked);
        }}/>}
      {data&&!busy&&!loading&&<><details className="ozf-panel ozf-missing-report ozf-collapsible-register">
        <summary><strong>Контроль незаполненных данных · {missingRows.length} размещений</strong><span>Нажмите, чтобы открыть список</span></summary>
        <div className="ozf-toolbar">
          <div><h2>Контроль незаполненных данных · {missingRows.length} размещений</h2>
            <p>Отдельный реестр по всей номенклатуре, независимо от выгрузки начислений. Нет master_code, КМ, себестоимости или ТК Маяк.</p></div>
          <a href="/ozon/financier/settings" className="ozf-btn">Открыть справочник тарифов</a>
        </div>
        <div className="ozf-table-scroll"><table className="ozf-table">
          <thead><tr><th>Артикул</th><th>master_code</th><th>КМ</th><th>Чего не хватает</th><th>Статус результата</th><th>Добавить для расчёта</th></tr></thead>
          <tbody>
            {missingRows.map(r=><tr key={r.offer_id}>
              <td>{r.offer_id}</td><td>{r.master_code??"Не привязан"}</td><td>{r.manager}</td>
              <td>{r.missing.join(", ")}</td>
              <td>Неполные исходные данные</td><td><OzonMissingRateEditor master={r.master_code} offer={r.offer_id} missing={r.missing} day={data.from} onSaved={load}/></td>
            </tr>)}
            {!missingRows.length&&<tr><td colSpan={6} className="ozf-empty">В справочнике товаров все обязательные поля заполнены.</td></tr>}
          </tbody>
        </table></div>
      </details>
      <div className="ozf-panel ozf-ai">
        <div className="ozf-toolbar"><div><h2>ИИ-аудитор</h2></div>
          <button className="ozf-btn ozf-primary" onClick={() => void analyze()} disabled={aiBusy || !data || data.missing_days.length > 0}>{aiBusy ? "Анализ…" : "Проанализировать начисления"}</button></div>
        {aiBusy&&<p role="status" className="ozf-progress">Анализируем начисления…</p>}
        {aiError&&<p role="alert" className="ozf-error">{aiError}</p>}
        {!aiBusy&&(!data||data.missing_days.length>0)&&<p role="status">{!data?'Сначала сформируйте отчёт.':'Дождитесь загрузки всех дней выбранного периода.'}</p>}
        {advice&&<div role="status" className="ozf-advice">{advice}</div>}
      </div>
      {!!data?.unallocated_details.length && <div className="ozf-panel" id="ozf-unallocated">
        <h2>Нераспределённые расходы</h2>

        {(()=>{
          const other=data.unallocated_details.filter(d=>
            !["41","46"].includes(String(d.type_id??"")) &&
            !/оплата за клик|реклам|размещени.*склад|платн.*хранени/i.test(d.name));
          const otherTotal=Math.round(other.reduce((sum,d)=>sum+Number(d.amount),0)*100)/100;
          return <AccrualBreakdownList items={other.map(x=>({...x,typeId:String(x.type_id??'')}))} market="ozon" from={data.from} to={data.to} total={otherTotal}
            totalLabel="Итого прочие нераспределённые начисления"/>;
        })()}
      </div>}
      </>}
    </section>
  );
}
