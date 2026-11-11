"use client";

import { useMemo, useState, type ReactNode } from "react";
import Button from "../ui/Button";

// The main procurement calculation is unchanged. Both table modes
// show the same ENOT-linked products and the same inventory snapshot.
export type ZakupTableItem = {
  calculation_item_id: string;
  master_code?: string | null;
  ozon_name?: string | null;
  offer_id: string;
  name: string | null;

  sales_28_days?: number | null;
  ozon_sales_28_days?: number | null;
  wb_sales_28_days?: number | null;
  yandex_sales_28_days?: number | null;
  avg_sales_per_day: number;
  needs_china_order?: boolean;
  units_per_carton?: number | null;
  transport_carton_volume_m3?: number | null;

  own_stock_quantity: number;
  responsible_storage_quantity?: number | null;
  ozon_stock_quantity: number;
  wb_stock_quantity?: number | null;
  yandex_stock_quantity?: number | null;
  physical_stock: number;
  active_ved_quantity: number;
  effective_stock: number;
  coverage_days: number | null;

  container_order_units: number;
  container_cartons: number;
  container_final_units: number;
  container_order_volume_m3: number;
  container_manual_quantity: number | null;
  container_manual_final_units: number | null;
  container_manual_volume_m3: number | null;
  container_manual_comment: string | null;
  container_effective_final_units: number;
  container_effective_volume_m3: number;

  truck_order_units: number;
  truck_cartons: number;
  truck_final_units: number;
  truck_order_volume_m3: number;
  truck_manual_quantity: number | null;
  truck_manual_final_units: number | null;
  truck_manual_volume_m3: number | null;
  truck_manual_comment: string | null;
  truck_effective_final_units: number;
  truck_effective_volume_m3: number;
};

type SortDirection = "asc" | "desc";
type SortValue = number | string | null;
type SortKey =
  | "master_code"
  | "offer_id"
  | "name"
  | "ozon_name"
  | "avg_sales_per_day"
  | "marketplace_stock"
  | "own_stock_quantity"
  | "responsible_storage_quantity"
  | "active_ved_quantity"
  | "overall_stock"
  | "coverage_days"
  | "ozon_sales_28_days"
  | "ozon_daily_sales"
  | "ozon_stock_quantity"
  | "wb_sales_28_days"
  | "wb_daily_sales"
  | "wb_stock_quantity"
  | "yandex_sales_28_days"
  | "yandex_daily_sales"
  | "yandex_stock_quantity";

type Column = {
  key: SortKey;
  label: string;
  align: "left" | "center";
  hint?: string;
};

// Exactly 10 columns. Stock order is intentionally fixed:
// marketplace stock, AVEDEX, responsible storage, VED, total, coverage.
const SUMMARY_COLUMNS: readonly Column[] = [
  { key: "master_code", label: "ЕНОТ", align: "left" },
  { key: "offer_id", label: "Артикул", align: "left" },
  { key: "name", label: "Товар", align: "left" },
  {
    key: "avg_sales_per_day",
    label: "Продажи/сутки",
    align: "center",
    hint: "Сумма продаж Ozon, WB и ЯМ за 28 дней / 28; сопоставление по ЕНОТ",
  },
  {
    key: "marketplace_stock",
    label: "Остатки на МП",
    align: "center",
    hint: "Остатки на складах Ozon + Wildberries + Яндекс Маркета",
  },
  { key: "own_stock_quantity", label: "АВЕДЭКС", align: "center" },
  { key: "responsible_storage_quantity", label: "ОХ", align: "center" },
  {
    key: "active_ved_quantity",
    label: "Заказано ВЭД",
    align: "center",
    hint: "Действующие заказы ВЭД, ещё не включённые в физический остаток",
  },
  {
    key: "overall_stock",
    label: "Общий запас",
    align: "center",
    hint: "Ozon + WB + ЯМ + АВЕДЭКС + ОХ + Заказано ВЭД",
  },
  { key: "coverage_days", label: "Покрытие", align: "center" },
];

// Exactly 17 columns: 3 common, 3*3 marketplace, 5 inventory.
const BREAKDOWN_COLUMNS: readonly Column[] = [
  { key: "master_code", label: "ЕНОТ", align: "left" },
  { key: "offer_id", label: "Артикул", align: "left" },
  {
    key: "ozon_name",
    label: "Название товара",
    align: "left",
    hint: "Наименование из того же каталога, который показывается на странице Ozon",
  },
  {
    key: "ozon_sales_28_days",
    label: "Выкуплено товаров",
    align: "center",
    hint: "Текущий источник Ozon: неотменённые FBO-отправления за 28 дней. Не финансовый отчёт о выкупах.",
  },
  { key: "ozon_daily_sales", label: "Средние продажи в день", align: "center" },
  { key: "ozon_stock_quantity", label: "На складах", align: "center" },
  {
    key: "wb_sales_28_days",
    label: "Выкуплено товаров",
    align: "center",
    hint: "Подтверждённые FBW-выкупы за 28 дней с учётом возвратов",
  },
  { key: "wb_daily_sales", label: "Средние продажи в день", align: "center" },
  { key: "wb_stock_quantity", label: "На складах", align: "center" },
  {
    key: "yandex_sales_28_days",
    label: "Выкуплено товаров",
    align: "center",
    hint: "Чистые FBY-продажи Яндекс Маркета за 28 дней",
  },
  { key: "yandex_daily_sales", label: "Средние продажи в день", align: "center" },
  { key: "yandex_stock_quantity", label: "На складах", align: "center" },
  { key: "own_stock_quantity", label: "АВЕДЭКС", align: "center" },
  { key: "responsible_storage_quantity", label: "ОХ", align: "center" },
  {
    key: "active_ved_quantity",
    label: "Заказано ВЭД",
    align: "center",
    hint: "Заказано в Китае и ещё не отражено в складском остатке",
  },
  {
    key: "overall_stock",
    label: "Общий запас",
    align: "center",
    hint: "Ozon + WB + ЯМ + АВЕДЭКС + ОХ + Заказано ВЭД",
  },
  { key: "coverage_days", label: "Покрытие", align: "center" },
];

function quantity(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function marketplaceStock(item: ZakupTableItem): number {
  return (
    quantity(item.ozon_stock_quantity) +
    quantity(item.wb_stock_quantity) +
    quantity(item.yandex_stock_quantity)
  );
}

function overallStock(item: ZakupTableItem): number {
  return (
    marketplaceStock(item) +
    quantity(item.own_stock_quantity) +
    quantity(item.responsible_storage_quantity) +
    quantity(item.active_ved_quantity)
  );
}

// Remove ONLY the exact seller article in trailing parentheses/brackets.
// Parentheses describing dimensions, quantities, colors, etc. remain intact.
function cleanTitle(value: string | null | undefined, article: string): string {
  const title = (value ?? "").trim();
  const expectedArticle = article.trim().toLocaleLowerCase("ru-RU");
  if (!title || !expectedArticle) return title;

  for (const [open, close] of [["(", ")"], ["[", "]"]]) {
    if (!title.endsWith(close)) continue;
    const start = title.lastIndexOf(open);
    if (start < 0) continue;
    const suffixArticle = title.slice(start + 1, -1).trim().toLocaleLowerCase("ru-RU");
    if (suffixArticle === expectedArticle) {
      return title.slice(0, start).replace(/[\s,;:\-–]+$/u, "").trim();
    }
  }
  return title;
}

function getValue(item: ZakupTableItem, key: SortKey): SortValue {
  switch (key) {
    case "name":
      return cleanTitle(item.name ?? item.ozon_name, item.offer_id);
    case "ozon_name":
      return cleanTitle(item.ozon_name ?? item.name, item.offer_id);
    case "master_code":
      return item.master_code ?? null;
    case "marketplace_stock":
      return marketplaceStock(item);
    case "overall_stock":
      return overallStock(item);
    case "avg_sales_per_day":
      return item.sales_28_days == null
        ? item.avg_sales_per_day
        : quantity(item.sales_28_days) / 28;
    case "ozon_daily_sales":
      return item.ozon_sales_28_days == null ? null : quantity(item.ozon_sales_28_days) / 28;
    case "wb_daily_sales":
      return item.wb_sales_28_days == null ? null : quantity(item.wb_sales_28_days) / 28;
    case "yandex_daily_sales":
      return item.yandex_sales_28_days == null ? null : quantity(item.yandex_sales_28_days) / 28;
    default: {
      const value = item[key as keyof ZakupTableItem];
      return typeof value === "string" || typeof value === "number" ? value : null;
    }
  }
}

function formatInteger(value: SortValue): string {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value).toLocaleString("ru-RU")
    : "—";
}

function formatDaily(value: SortValue): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const decimals = Math.abs(value) < 0.1 ? 2 : 1;
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function renderCell(item: ZakupTableItem, key: SortKey): ReactNode {
  const value = getValue(item, key);
  if (key === "master_code" || key === "offer_id") {
    return <strong>{value || "—"}</strong>;
  }
  if (key === "name" || key === "ozon_name") {
    return value || "—";
  }
  if (key === "coverage_days") {
    return value == null ? "—" : <><strong>{formatInteger(value)}</strong> дн.</>;
  }
  if (
    key === "avg_sales_per_day" ||
    key === "ozon_daily_sales" ||
    key === "wb_daily_sales" ||
    key === "yandex_daily_sales"
  ) {
    return formatDaily(value);
  }
  return formatInteger(value);
}

function compareValues(a: SortValue, b: SortValue, direction: SortDirection): number {
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  const result =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), ["ru", "en"], {
          numeric: true,
          sensitivity: "base",
        });
  return direction === "asc" ? result : -result;
}

function SortableHeader({
  column,
  sortKey,
  sortDirection,
  onSort,
  rowSpan,
}: {
  column: Column;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  rowSpan?: number;
}) {
  const active = sortKey === column.key;
  return (
    <th
      scope="col"
      rowSpan={rowSpan}
      className={column.align}
      aria-sort={active ? (sortDirection === "desc" ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        title={column.hint}
        className={[
          "zakup-sort-button",
          column.align === "center" ? "zakup-sort-button--center" : "zakup-sort-button--left",
          active ? "zakup-sort-button--active" : "",
        ].filter(Boolean).join(" ")}
        onClick={() => onSort(column.key)}
      >
        <span>{column.label}</span>
        {active && <span className="zakup-sort-indicator" aria-hidden="true">
          {sortDirection === "desc" ? "↓" : "↑"}
        </span>}
      </button>
    </th>
  );
}

function columnClass(key: SortKey): string {
  if (key === "master_code") return "zakup-products-col-enot";
  if (key === "offer_id") return "zakup-products-col-article";
  if (key === "name" || key === "ozon_name") return "zakup-products-col-title";
  return "zakup-products-col-number";
}

export default function ZakupProductsTableClient({ items }: { items: ZakupTableItem[] }) {
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("avg_sales_per_day");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const visibleColumns = showBreakdown ? BREAKDOWN_COLUMNS : SUMMARY_COLUMNS;

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => {
      const comparison = compareValues(
        getValue(left, sortKey),
        getValue(right, sortKey),
        sortDirection
      );
      return comparison || left.offer_id.localeCompare(right.offer_id, ["ru", "en"], {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [items, sortKey, sortDirection]);

  function changeSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection(current => current === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDirection(key === "master_code" || key === "offer_id" ||
        key === "name" || key === "ozon_name" ? "asc" : "desc");
    }
  }

  function toggleBreakdown() {
    const next = !showBreakdown;
    const nextColumns = next ? BREAKDOWN_COLUMNS : SUMMARY_COLUMNS;
    if (!nextColumns.some(column => column.key === sortKey)) {
      setSortKey(next ? "ozon_sales_28_days" : "avg_sales_per_day");
      setSortDirection("desc");
    }
    setShowBreakdown(next);
  }

  function headerFor(column: Column, rowSpan?: number) {
    return (
      <SortableHeader
        key={column.key}
        column={column}
        rowSpan={rowSpan}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={changeSort}
      />
    );
  }

  return (
    <>
      <div className="zakup-products-view-toolbar">
        <span className="muted">Продажи за 28 дней, остатки в штуках. Данные объединены по ЕНОТ.</span>
        <Button type="button" variant="secondary" aria-expanded={showBreakdown} onClick={toggleBreakdown}>
          {showBreakdown ? "Скрыть разбивку по маркетплейсам" : "Показать разбивку по маркетплейсам"}
        </Button>
      </div>

      <div className="table-wrapper" style={{ overflowX: "auto" }}>
        <table
          className={"table zakup-sortable-table " +
            (showBreakdown ? "zakup-sortable-table--breakdown" : "zakup-sortable-table--summary")}
        >
          <colgroup>
            {visibleColumns.map(column => <col key={column.key} className={columnClass(column.key)} />)}
          </colgroup>
          <thead>
            {showBreakdown ? (
              <>
                <tr className="zakup-products-group-row">
                  {BREAKDOWN_COLUMNS.slice(0, 3).map(column => headerFor(column, 2))}
                  <th className="zakup-products-mp-group zakup-products-mp-group--ozon" colSpan={3} scope="colgroup">Ozon</th>
                  <th className="zakup-products-mp-group zakup-products-mp-group--wb" colSpan={3} scope="colgroup">Wildberries</th>
                  <th className="zakup-products-mp-group zakup-products-mp-group--ym" colSpan={3} scope="colgroup">Яндекс Маркет</th>
                  {BREAKDOWN_COLUMNS.slice(12).map(column => headerFor(column, 2))}
                </tr>
                <tr className="zakup-products-subheader-row">
                  {BREAKDOWN_COLUMNS.slice(3, 12).map(column => headerFor(column))}
                </tr>
              </>
            ) : (
              <tr>{SUMMARY_COLUMNS.map(column => headerFor(column))}</tr>
            )}
          </thead>
          <tbody>
            {sortedItems.map(item => (
              <tr key={item.calculation_item_id}>
                {visibleColumns.map(column => (
                  <td key={column.key} className={column.align}>
                    {renderCell(item, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
