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
type Warehouse = { id: number; name: string; rawNeed: number; articles: number; sales28: number };
type Plan = {
  calculatedAt: string;
  salesPeriod: string;
  stockDate: string;
  stale: boolean;
  staleReasons: string[];
  warehouses: Warehouse[];
  selectedWarehouseIds: number[];
  items: Item[];
  blocked: Item[];
  totals: { articles: number; blocked: number; units: number; cartons: number; rawNeed: number };
  notice: string;
};

const endpoint = "/api/yandex/fby-supply-plan";
const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);

export default function YandexFbySupplyPlanner() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [showWarehouses, setShowWarehouses] = useState(false);
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
        const query = selected === null ? "" : "?warehouses=" + encodeURIComponent(selected.join(","));
        const response = await fetch(endpoint + query, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { ok: boolean; plan?: Plan; error?: string };
        if (!response.ok || !data.ok || !data.plan) throw new Error(data.error || "Не удалось рассчитать поставку");
        if (!controller.signal.aborted) {
          setPlan(data.plan);
          if (selected === null) setSelected(data.plan.selectedWarehouseIds);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Ошибка связи");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
    // Повторный расчет только при изменении выбора складов/кнопке обновления.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, version]);

  const selectedSet = useMemo(() => new Set(selected || []), [selected]);

  function toggleWarehouse(id: number) {
    setSelected(current => current?.includes(id) ? current.filter(x => x !== id) : [...(current || []), id]);
  }

  async function download() {
    if (!plan || !selected?.length || downloading) return;
    setError("");
    setDownloading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseIds: selected, allowPartial, allowStale }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Ошибка скачивания");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "yandex-multisupply-" + new Date().toISOString().slice(0, 10) + ".xlsx";
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

  const hasBlockingIssues = Boolean(plan && (plan.blocked.length > 0 && !allowPartial || plan.stale && !allowStale));
  const noRows = !plan || plan.items.length === 0;
  const disabled = loading || downloading || noRows || !selected?.length || hasBlockingIssues;

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <div className={styles.tag}>ЯНДЕКС МАРКЕТ · FBY</div>
          <h2>Мультипоставка по потребности</h2>
          <p>Формируем Excel по всем выбранным складам. Распределение по кластерам и слот выберешь после загрузки в ЯМ.</p>
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

          <div className={styles.selectionBar}>
            <div><strong>Склады в расчёте: {selected?.length || 0} из {plan.warehouses.length}</strong><small>Это склады из статистики ЯМ, не официальные кластеры. Доступность регионов уточняется в кабинете.</small></div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={() => setSelected(plan.warehouses.map(w => w.id))}>Все</button>
              <button type="button" className={styles.secondary} onClick={() => setShowWarehouses(v => !v)}>{showWarehouses ? "Скрыть склады" : "Выбрать склады"}</button>
            </div>
          </div>

          {showWarehouses && (
            <div className={styles.warehouseList}>
              {plan.warehouses.map(w => (
                <label key={w.id} className={styles.warehouse}>
                  <input type="checkbox" checked={selectedSet.has(w.id)} onChange={() => toggleWarehouse(w.id)} />
                  <span>{w.name}<small>#{w.id} · {fmt(w.rawNeed)} шт. потребность</small></span>
                </label>
              ))}
            </div>
          )}

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
              <thead><tr><th>Артикул ЯМ</th><th>Товар</th><th>Нужно</th><th>К поставке</th><th>Коробов</th></tr></thead>
              <tbody>
                {plan.items.slice(0, 150).map(row =>
                  <tr key={row.offerId}>
                    <td>{row.offerId}</td><td>{row.name}</td>
                    <td>{fmt(row.rawNeed)}</td><td><strong>{fmt(row.quantity)}</strong></td><td>{fmt(row.cartonCount)}</td>
                  </tr>
                )}
                {plan.items.length === 0 && <tr><td colSpan={5}>По выбранным складам нет товаров с готовой потребностью.</td></tr>}
              </tbody>
            </table>
            {plan.items.length > 150 && <p className={styles.meta}>Показаны первые 150 позиций. В Excel попадут все {plan.items.length}.</p>}
          </div>

          <div className={styles.footer}>
            <p>Excel: лист «Поставка», четыре поля в формате шаблона ЯМ. После загрузки нажми «Распределить» и проверь кластеры. Незавершённые поставки автоматически не вычитаются.</p>
            <button type="button" disabled={disabled} className={styles.primary} onClick={() => void download()}>
              {downloading ? "Готовим файл…" : "Скачать Excel мультипоставки"}
            </button>
          </div>
        </>
      )}

      {!plan && loading && <p className={styles.meta}>Загружаем продажи, остатки и справочник вложимости…</p>}
    </section>
  );
}
