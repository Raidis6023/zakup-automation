"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./YandexFbySupplyPlanner.module.css";

type Item = {
  offerId: string;
  name: string;
  rawNeed: number;
  quantity: number;
  cartonCount: number;
  sales28: number;
  stock: number;
  errors: string[];
};
type Cluster = { name: string; rawNeed: number; proposedUnits: number; cartons: number; articles: number; sales28: number; stock: number; warehouseIds: number[] };
type Allocation = { cluster: string; offerId: string; name: string; rawNeed: number; quantity: number; cartons: number; sales28: number; stock: number; errors: string[] };
type Plan = {
  calculatedAt: string;
  salesPeriod: string;
  stockDate: string;
  stale: boolean;
  staleReasons: string[];
  clusters: Cluster[];
  selectedClusters: string[];
  allocations: Allocation[];
  unmappedWarehouses: string[];
  items: Item[];
  blocked: Item[];
  totals: { articles: number; blocked: number; units: number; cartons: number; rawNeed: number };
  notice: string;
  eligibility: {source:string;checkedAt:string;excludedCount:number;unknownCount:number;stale:boolean};
  excluded: Array<{offerId:string;cluster:string;reason:string}>;
};

const endpoint = "/api/yandex/fby-supply-plan";
const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);

export default function YandexFbySupplyPlanner() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [showClusters, setShowClusters] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [allowPartial, setAllowPartial] = useState(false);
  const [allowStale, setAllowStale] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = selected === null ? "" : "?clusters=" + encodeURIComponent(selected.join(","));
        const response = await fetch(endpoint + query, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { ok: boolean; plan?: Plan; error?: string };
        if (!response.ok || !data.ok || !data.plan) throw new Error(data.error || "Не удалось рассчитать поставку");
        if (!controller.signal.aborted) {
          setPlan(data.plan);
          if (selected === null) setSelected(data.plan.selectedClusters);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Ошибка связи");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
    // Повторный расчет только при изменении выбора кластеров/кнопке обновления.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, version]);

  useEffect(() => {
    const onCheck = () => setVersion(v => v + 1);
    window.addEventListener("yandex-eligibility-updated", onCheck);
    return () => window.removeEventListener("yandex-eligibility-updated", onCheck);
  }, []);

  const selectedSet = useMemo(() => new Set(selected || []), [selected]);

  function toggleCluster(name: string) {
    setSelected(current => current?.includes(name) ? current.filter(x => x !== name) : [...(current || []), name]);
  }

  async function download(mode: "plan" | "upload") {
    if (!plan || !selected?.length || downloading) return;
    setError("");
    setDownloading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusterNames: selected, allowPartial, allowStale, mode }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Ошибка скачивания");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "yandex-" + (mode === "plan" ? "cluster-plan" : "upload") + "-" + new Date().toISOString().slice(0, 10) + ".xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка скачивания");
    } finally {
      setDownloading(false);
    }
  }

  const hasBlockingIssues = Boolean(plan && (plan.unmappedWarehouses.length > 0 || (plan.blocked.length > 0 && !allowPartial) || (plan.stale && !allowStale)));
  const noRows = !plan || plan.items.length === 0;
  const disabled = loading || downloading || noRows || !selected?.length || hasBlockingIssues;

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <div className={styles.tag}>ЯНДЕКС МАРКЕТ · FBY</div>
          <h2>Мультипоставка по потребности</h2>
          <p>Считаем потребность по каждому кластеру отдельно, затем формируем общую мультипоставку с точным разбором по регионам в Excel.</p>
        </div>
        <button type="button" className={styles.secondary} onClick={() => setVersion(v => v + 1)} disabled={loading}>
          {loading ? "Считаем…" : "Пересчитать"}
        </button>
      </div>

      {error && <div role="alert" className={styles.alertDanger}>{error}</div>}

      {plan && (
        <>
          <div className={styles.facts}>
            <div><span>Нужно, до округления</span><strong>{fmt(plan.totals.rawNeed)} шт.</strong></div>
            <div><span>К поставке</span><strong>{fmt(plan.totals.units)} шт.</strong></div>
            <div><span>Коробов</span><strong>{fmt(plan.totals.cartons)}</strong></div>
            <div><span>Артикулов в файле</span><strong>{fmt(plan.totals.articles)}</strong></div>
          </div>

          <p className={styles.meta}>Продажи: {plan.salesPeriod} (28 дней). Остатки: {plan.stockDate}. Рассчитано: {new Date(plan.calculatedAt).toLocaleString("ru-RU")}.</p>
          <p className={styles.info}>{plan.notice}</p>
          <p className={styles.meta}>Матрица допуска: {plan.eligibility.source} · {new Date(plan.eligibility.checkedAt).toLocaleString("ru-RU")} · исключено сочетаний SKU / кластер: {plan.eligibility.excludedCount} · без подтверждения: {plan.eligibility.unknownCount}</p>
          {plan.excluded.length > 0 && (
            <div className={styles.alertWarning}>
              <strong>Яндекс не принимает {plan.excluded.length} сочетаний «артикул / кластер».</strong> Они исключены из рассчитанной поставки до определения потребности.
              <div className={styles.tableWrapper}>
                <table>
                  <thead><tr><th>Кластер</th><th>Артикул</th><th>Причина</th></tr></thead>
                  <tbody>{plan.excluded.slice(0,80).map((x,i)=>(
                    <tr key={x.cluster+x.offerId+i}><td>{x.cluster}</td><td>{x.offerId}</td><td>{x.reason}</td></tr>
                  ))}</tbody>
                </table>
                {plan.excluded.length>80&&<p className={styles.meta}>Показаны первые 80 исключений.</p>}
              </div>
            </div>
          )}

          <div className={styles.selectionBar}>
            <div><strong>Кластеры: {selected?.length || 0} из {plan.clusters.length}</strong><small>Кластерные группы определены по складам FBY. Регион доставки покупателя может отличаться от региона склада.</small></div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={() => setSelected(plan.clusters.map(c => c.name))}>Все</button>
              <button type="button" className={styles.secondary} onClick={() => setShowClusters(v => !v)}>{showClusters ? "Скрыть" : "Выбрать кластеры"}</button>
            </div>
          </div>

          {showClusters && (
            <div className={styles.warehouseList}>
              {plan.clusters.map(cluster => (
                <label key={cluster.name} className={styles.warehouse}>
                  <input type="checkbox" checked={selectedSet.has(cluster.name)} onChange={() => toggleCluster(cluster.name)} />
                  <span>{cluster.name}<small>{fmt(cluster.rawNeed)} шт. нужно · {fmt(cluster.proposedUnits)} шт. после округления</small></span>
                </label>
              ))}
            </div>
          )}

          {plan.unmappedWarehouses.length > 0 && (
            <div className={styles.alertDanger}><strong>Есть склады без сопоставленного кластера:</strong> {plan.unmappedWarehouses.join(", ")}. Добавь их привязку, прежде чем использовать расчёт.</div>
          )}

          <div className={styles.tableWrapper}>
            <table>
              <thead><tr><th>Кластер</th><th>Продажи за 28 дней</th><th>Остаток</th><th>Нужно</th><th>К поставке</th><th>Коробов</th><th>SKU с потребностью</th></tr></thead>
              <tbody>{plan.clusters.map(c => (
                <tr key={c.name}>
                  <td><strong>{c.name}</strong></td><td>{fmt(c.sales28)}</td><td>{fmt(c.stock)}</td>
                  <td>{fmt(c.rawNeed)}</td><td><strong>{fmt(c.proposedUnits)}</strong></td>
                  <td>{fmt(c.cartons)}</td><td>{fmt(c.articles)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          {plan.stale && (
            <div className={styles.alertDanger}>
              <strong>Данные устарели.</strong> {plan.staleReasons.join(". ")}. Обнови продажи и остатки ЯМ, прежде чем создавать настоящую поставку.
              <label className={styles.override}><input type="checkbox" checked={allowStale} onChange={e => setAllowStale(e.target.checked)} /> Разрешить экспорт со старыми данными для тестирования</label>
            </div>
          )}

          {plan.blocked.length > 0 && (
            <div className={styles.alertWarning}>
              <strong>Не войдут в Excel: {plan.blocked.length} поз.</strong> Нет обязательных реквизитов либо корректной вложимости. Пропускать такие позиции без предупреждения нельзя.
              <div className={styles.actions}>
                <button type="button" className={styles.linkButton} onClick={() => setShowBlocked(v => !v)}>{showBlocked ? "Скрыть проблемы" : "Показать проблемы"}</button>
              </div>
              {showBlocked && <div className={styles.tableWrapper}><table><thead><tr><th>Артикул</th><th>Нужно</th><th>Проблема</th></tr></thead><tbody>
                {plan.blocked.map(row => <tr key={row.offerId}><td>{row.offerId}</td><td>{fmt(row.rawNeed)}</td><td>{row.errors.join("; ")}</td></tr>)}
              </tbody></table></div>}
              <label className={styles.override}><input type="checkbox" checked={allowPartial} onChange={e => setAllowPartial(e.target.checked)} /> Я понимаю, что Excel будет неполным. Выгрузить только корректные позиции.</label>
            </div>
          )}

          <div className={styles.tableWrapper}>
            <table>
              <thead><tr><th>Кластер</th><th>Артикул ЯМ</th><th>Товар</th><th>Нужно</th><th>К поставке</th><th>Коробов</th></tr></thead>
              <tbody>
                {plan.allocations.filter(row => row.quantity > 0).slice(0, 200).map(row =>
                  <tr key={row.cluster + row.offerId}>
                    <td>{row.cluster}</td><td>{row.offerId}</td><td>{row.name}</td>
                    <td>{fmt(row.rawNeed)}</td><td><strong>{fmt(row.quantity)}</strong></td><td>{fmt(row.cartons)}</td>
                  </tr>
                )}
                {plan.items.length === 0 && <tr><td colSpan={6}>По выбранным кластерам нет товаров с готовой потребностью.</td></tr>}
              </tbody>
            </table>
            {plan.allocations.filter(row => row.quantity > 0).length > 200 && <p className={styles.meta}>В таблице 200 позиций; в Excel попадут все.</p>}
          </div>

          <div className={styles.footer}>
            <p><strong>Важно:</strong> в стандартном шаблоне ЯМ нет поля «кластер». Скачай детальный план для контроля, а для импорта отдельный файл. После «Распределить» проверь и скорректируй числа по кластерам. Незавершённые поставки из потребности пока не вычитаются.</p>
            <div className={styles.actions}>
              <button type="button" disabled={disabled} className={styles.secondary} onClick={() => void download("plan")}>
                {downloading ? "Готовим…" : "Excel: план по кластерам"}
              </button>
              <button type="button" disabled={disabled} className={styles.primary} onClick={() => void download("upload")}>
                {downloading ? "Готовим…" : "Excel для загрузки в ЯМ"}
              </button>
            </div>
          </div>
        </>
      )}

      {!plan && loading && <p className={styles.meta}>Загружаем продажи, остатки и справочник вложимости…</p>}
    </section>
  );
}
