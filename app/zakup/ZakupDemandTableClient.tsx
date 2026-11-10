"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveChinaManualAdjustment } from "../actions";
import type { ZakupTableItem } from "./ZakupProductsTableClient";

type Scenario = "container" | "truck";
type DemandItem = ZakupTableItem & {
  needs_china_order?: boolean;
  units_per_carton?: number | null;
  transport_carton_volume_m3?: number | null;
};

function formatInteger(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("ru-RU");
}

function formatDecimal(value: number | null | undefined, digits: number) {
  return value == null ? "—" : Number(value).toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function isPending(item: DemandItem, scenario: Scenario) {
  return scenario === "container"
    ? item.container_manual_quantity == null
    : item.truck_manual_quantity == null;
}

function PurchaseRow({ item, scenario }: { item: DemandItem; scenario: Scenario }) {
  const router = useRouter();
  const perCarton = Number(item.units_per_carton ?? 0);
  const demand = scenario === "container" ? item.container_order_units : item.truck_order_units;
  const systemQuantity = scenario === "container" ? item.container_final_units : item.truck_final_units;
  const manualQuantity = scenario === "container" ? item.container_manual_quantity : item.truck_manual_quantity;
  const selectedQuantity = scenario === "container"
    ? item.container_effective_final_units
    : item.truck_effective_final_units;
  const selectedVolume = scenario === "container"
    ? item.container_effective_volume_m3
    : item.truck_effective_volume_m3;

  const suggestedQuantity = systemQuantity > 0 ? systemQuantity : perCarton;
  const [quantity, setQuantity] = useState(String(
    manualQuantity != null && manualQuantity > 0 ? manualQuantity : suggestedQuantity,
  ));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = manualQuantity == null;
  const included = manualQuantity != null && manualQuantity > 0;
  const excluded = manualQuantity === 0;

  async function decide(action: "include" | "exclude") {
    if (saving) return;
    const requested = action === "exclude" ? 0 : Number(quantity);
    if (action === "include" &&
      (!Number.isSafeInteger(requested) || perCarton <= 0 ||
        requested < perCarton || requested % perCarton !== 0)) {
      setError("Укажите положительное количество, кратное " + perCarton + " шт. в коробке");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const data = new FormData();
      data.set("calculationItemId", item.calculation_item_id);
      data.set("scenario", scenario);
      data.set("manualQuantity", String(requested));
      data.set("comment", action === "exclude"
        ? "Исключено из заказа решением закупщика"
        : "Подтверждено для включения в заказ");
      await saveChinaManualAdjustment(data);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Решение не сохранено");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className={excluded ? "zakup-demand-row--excluded" : pending ? "zakup-demand-row--pending" : ""}>
      <td className="left"><strong>{item.offer_id}</strong></td>
      <td className="left">{item.name ?? "—"}</td>
      <td className="center">{formatDecimal(item.avg_sales_per_day, 1)}</td>
      <td className="center">{formatInteger(item.effective_stock)}</td>
      <td className="center">{item.coverage_days == null ? "—" : formatInteger(item.coverage_days) + " дн."}</td>
      <td className="center">{formatInteger(demand)}</td>
      <td className="center">{perCarton > 0 ? formatInteger(perCarton) : "Нет данных"}</td>
      <td className="center">
        <label className="zakup-demand-quantity">
          <span className="sr-only">Количество к заказу для {item.offer_id}</span>
          <input
            type="number"
            className="input"
            min={perCarton || 1}
            step={perCarton || 1}
            value={quantity}
            disabled={saving || perCarton <= 0}
            onChange={(event) => setQuantity(event.target.value)}
            aria-label={"Количество к заказу, " + item.offer_id}
          />
        </label>
        {included && selectedQuantity > 0 ? (
          <span className="zakup-demand-current">Сохранено: {formatInteger(selectedQuantity)}</span>
        ) : null}
      </td>
      <td className="center">
        {included ? formatDecimal(selectedVolume, 3) : "—"}
      </td>
      <td className="center">
        <div className="zakup-demand-decision">
          <span className={["zakup-demand-status", included ? "is-included" : excluded ? "is-excluded" : ""].join(" ")}>
            {included ? "В заказе" : excluded ? "Исключён" : "Не решено"}
          </span>
          <div className="zakup-demand-actions">
            <button type="button" className={"zakup-demand-action " + (included ? "is-selected" : "")}
              onClick={() => decide("include")} disabled={saving || perCarton <= 0}>
              {saving ? "Сохранение…" : "В заказ"}
            </button>
            <button type="button" className={"zakup-demand-action " + (excluded ? "is-selected" : "")}
              onClick={() => decide("exclude")} disabled={saving}>
              Исключить
            </button>
          </div>
          {error ? <span className="zakup-demand-error" role="alert">{error}</span> : null}
        </div>
      </td>
    </tr>
  );
}

export default function ZakupDemandTableClient({
  items,
  scenario,
}: {
  items: DemandItem[];
  scenario: Scenario;
}) {
  const [sortField, setSortField] = useState<"offer_id" | "avg_sales_per_day" | "demand">("demand");
  const [descending, setDescending] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending">("all");
  const pendingCount = items.filter(item => isPending(item, scenario)).length;
  const includedCount = items.filter(item => {
    const manual = scenario === "container" ? item.container_manual_quantity : item.truck_manual_quantity;
    return manual != null && manual > 0;
  }).length;
  const excludedCount = items.length - pendingCount - includedCount;

  const visibleItems = useMemo(() => {
    const list = items.filter(item => statusFilter === "all" || isPending(item, scenario));
    list.sort((a, b) => {
      const lhs = sortField === "offer_id" ? a.offer_id : sortField === "avg_sales_per_day"
        ? a.avg_sales_per_day : scenario === "container" ? a.container_order_units : a.truck_order_units;
      const rhs = sortField === "offer_id" ? b.offer_id : sortField === "avg_sales_per_day"
        ? b.avg_sales_per_day : scenario === "container" ? b.container_order_units : b.truck_order_units;
      const comparison = typeof lhs === "string" && typeof rhs === "string"
        ? lhs.localeCompare(rhs, "ru", { numeric: true })
        : Number(lhs) - Number(rhs);
      return comparison === 0
        ? a.offer_id.localeCompare(b.offer_id, "ru", { numeric: true })
        : comparison * (descending ? -1 : 1);
    });
    return list;
  }, [items, scenario, sortField, descending, statusFilter]);

  function sort(field: "offer_id" | "avg_sales_per_day" | "demand") {
    if (sortField === field) setDescending(value => !value);
    else { setSortField(field); setDescending(field !== "offer_id"); }
  }

  function sortableLabel(label: string, field: "offer_id" | "avg_sales_per_day" | "demand") {
    return (
      <button className={"zakup-sort-button zakup-sort-button--center " +
        (sortField === field ? "zakup-sort-button--active" : "")}
        type="button" onClick={() => sort(field)}>
        {label} {sortField === field ? (descending ? "↓" : "↑") : ""}
      </button>
    );
  }

  return (
    <>
      <div className="zakup-demand-toolbar">
        <span>
          <strong>{pendingCount}</strong> без решения · {includedCount} включено · {excludedCount} исключено
          <span className="zakup-demand-period"> · {scenario === "container" ? "Контейнер" : "Фура"}</span>
        </span>
        <button className="zakup-demand-filter" type="button"
          aria-pressed={statusFilter === "pending"}
          onClick={() => setStatusFilter(value => value === "pending" ? "all" : "pending")}>
          {statusFilter === "pending" ? "Показать все" : "Только без решения"}
        </button>
      </div>
      <div className="table-wrapper" style={{ overflowX: "auto" }}>
        <table className="table zakup-sortable-table zakup-demand-table" style={{ minWidth: "1680px" }}>
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="left">{sortableLabel("Артикул", "offer_id")}</th>
              <th className="left">Товар</th>
              <th className="center">{sortableLabel("Продажи/сутки", "avg_sales_per_day")}</th>
              <th className="center">Запас с ВЭД</th>
              <th className="center">Покрытие</th>
              <th className="center">{sortableLabel("Потребность, шт.", "demand")}</th>
              <th className="center">В коробке</th>
              <th className="center">Количество, шт.</th>
              <th className="center">Объём, м³</th>
              <th className="center">Решение</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map(item => (
              <PurchaseRow key={item.calculation_item_id + ":" + scenario}
                item={item} scenario={scenario} />
            ))}
            {visibleItems.length === 0 ? (
              <tr><td colSpan={10} className="center">
                {items.length === 0 ? "Потребности в закупке нет" : "Все позиции рассмотрены"}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
