
"use client";

import { useMemo, useState, type ReactNode } from "react";
import Button from "../ui/Button";
import { useRouter } from "next/navigation";
import { saveChinaManualAdjustment } from "../actions";

// ============================================================
// ТИП ТОВАРА
// Новые поля v9 необязательны для совместимости с v8.
// ============================================================

export type ZakupTableItem = {
  calculation_item_id: string;
  offer_id: string;
  name: string | null;

  sales_28_days?: number | null;
  ozon_sales_28_days?: number | null;
  wb_sales_28_days?: number | null;
  yandex_sales_28_days?: number | null;
  avg_sales_per_day: number;

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

// ============================================================
// КОЛОНКИ И СОРТИРОВКА
// ============================================================

type SortKey =
  | "offer_id"
  | "name"
  | "sales_28_days"
  | "ozon_sales_28_days"
  | "wb_sales_28_days"
  | "yandex_sales_28_days"
  | "avg_sales_per_day"
  | "own_stock_quantity"
  | "responsible_storage_quantity"
  | "ozon_stock_quantity"
  | "wb_stock_quantity"
  | "yandex_stock_quantity"
  | "active_ved_quantity"
  | "effective_stock"
  | "coverage_days"
  | "container_effective_final_units"
  | "container_effective_volume_m3"
  | "truck_effective_final_units"
  | "truck_effective_volume_m3";

type SortDirection = "asc" | "desc";
type SortValue = string | number | null;

type Column = {
  key: SortKey;
  label: string;
  align: "left" | "center";
  detail?: boolean;
  hint?: string;
};

const DEFAULT_SORT_KEY: SortKey = "avg_sales_per_day";
const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

// detail: true = показывать в подробном режиме.
// Остальные колонки видны всегда.

const COLUMNS: readonly Column[] = [
  {
    key: "offer_id",
    label: "Артикул",
    align: "left",
  },
  {
    key: "name",
    label: "Товар",
    align: "left",
  },
  {
    key: "sales_28_days",
    label: "Всего, 28 дн.",
    align: "center",
    detail: true,
    hint: "Сумма продаж Ozon, WB и Яндекс Маркета за 28 дней",
  },
  {
    key: "ozon_sales_28_days",
    label: "Ozon, прод.",
    align: "center",
    detail: true,
    hint: "Неотменённые FBO-отправления за 28 дней",
  },
  {
    key: "wb_sales_28_days",
    label: "WB, прод.",
    align: "center",
    detail: true,
    hint: "Фактические FBW-продажи за вычетом возвратов за 28 дней",
  },
  {
    key: "yandex_sales_28_days",
    label: "ЯМ, прод.",
    align: "center",
    detail: true,
    hint: "Чистые продажи FBY за 28 дней",
  },
  {
    key: "avg_sales_per_day",
    label: "Продажи/сутки",
    align: "center",
  },
  {
    key: "own_stock_quantity",
    label: "Наш склад",
    align: "center",
  },
  {
    key: "responsible_storage_quantity",
    label: "Отв. хранение",
    align: "center",
    detail: true,
  },
  {
    key: "ozon_stock_quantity",
    label: "Ozon, остаток",
    align: "center",
  },
  {
    key: "wb_stock_quantity",
    label: "WB, остаток",
    align: "center",
    detail: true,
  },
  {
    key: "yandex_stock_quantity",
    label: "ЯМ, остаток",
    align: "center",
    detail: true,
  },
  {
    key: "active_ved_quantity",
    label: "Заказано ВЭД",
    align: "center",
    hint: "Товары, уже заказанные в ВЭД (в том числе импортированные проформы в работе), но ещё не отражённые в складе. Это не физический остаток.",
  },
  {
    key: "effective_stock",
    label: "Запас с ВЭД",
    align: "center",
    hint: "Расчётный запас: физические остатки нашего склада, ОХ, Ozon, WB, ЯМ плюс учтённые заказы ВЭД. Товары в ВЭД не являются наличием на складе.",
  },
  {
    key: "coverage_days",
    label: "Покрытие",
    align: "center",
  },
  {
    key: "container_effective_final_units",
    label: "Контейнер, шт.",
    align: "center",
  },
  {
    key: "container_effective_volume_m3",
    label: "Контейнер, м³",
    align: "center",
  },
  {
    key: "truck_effective_final_units",
    label: "Фура, шт.",
    align: "center",
  },
  {
    key: "truck_effective_volume_m3",
    label: "Фура, м³",
    align: "center",
  },
];

// ============================================================
// НАПРАВЛЕНИЕ ПЕРВОГО КЛИКА
// ============================================================

function getInitialDirection(key: SortKey): SortDirection {
  // Артикул и Товар: от А до Я.
  // Числовые показатели: от большего к меньшему.
  return key === "offer_id" || key === "name"
    ? "asc"
    : "desc";
}

// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

function formatRoundedInteger(
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(Number(value))) {
    return "—";
  }

  return Math.round(Number(value)).toLocaleString("ru-RU");
}

function formatOneDecimal(
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(Number(value))) {
    return "—";
  }

  return Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// ============================================================
// ЗНАЧЕНИЕ ДЛЯ СОРТИРОВКИ
// ============================================================

function getSortValue(
  item: ZakupTableItem,
  key: SortKey
): SortValue {
  const value = item[key];

  return typeof value === "number" || typeof value === "string"
    ? value
    : null;
}

// ============================================================
// СРАВНЕНИЕ
// ============================================================

function compareValues(
  left: SortValue,
  right: SortValue,
  direction: SortDirection
): number {
  // Пустые значения всегда внизу.
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  const comparison =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), ["ru", "en"], {
          numeric: true,
          sensitivity: "base",
        });

  return direction === "asc"
    ? comparison
    : -comparison;
}

// ============================================================
// ОТОБРАЖЕНИЕ ЯЧЕЙКИ
// ============================================================

function renderCell(
  item: ZakupTableItem,
  key: SortKey
): ReactNode {
  switch (key) {
    case "offer_id":
      return <strong>{item.offer_id}</strong>;

    case "name":
      return item.name ?? "—";

    case "coverage_days":
      return item.coverage_days == null ? (
        "—"
      ) : (
        <>
          <strong>
            {formatRoundedInteger(item.coverage_days)}
          </strong>{" "}
          дн.
        </>
      );

    case "container_effective_final_units":
      return (
        <>
          <strong>
            {formatRoundedInteger(
              item.container_effective_final_units
            )}
          </strong>

          {item.container_manual_quantity != null && (
            <div className="muted">вручную</div>
          )}
        </>
      );

    case "truck_effective_final_units":
      return (
        <>
          <strong>
            {formatRoundedInteger(
              item.truck_effective_final_units
            )}
          </strong>

          {item.truck_manual_quantity != null && (
            <div className="muted">вручную</div>
          )}
        </>
      );

    case "container_effective_volume_m3":
      return formatOneDecimal(
        item.container_effective_volume_m3
      );

    case "truck_effective_volume_m3":
      return formatOneDecimal(
        item.truck_effective_volume_m3
      );

    default:
      return formatRoundedInteger(item[key]);
  }
}

// ============================================================
// ТАБЛИЦА
// ============================================================

export default function ZakupProductsTableClient({
  items,
}: {
  items: ZakupTableItem[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{
    itemId: string; offerId: string; scenario: "container" | "truck";
    quantity: number; comment: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const unresolvedContainer = items.filter(item =>
    item.container_order_units > 0 && item.container_final_units === 0 &&
    item.container_manual_quantity == null
  ).length;
  const unresolvedTruck = items.filter(item =>
    item.truck_order_units > 0 && item.truck_final_units === 0 &&
    item.truck_manual_quantity == null
  ).length;

  async function submitManualAdjustment(formData: FormData) {
    setSaving(true);
    setSaveError("");
    try {
      await saveChinaManualAdjustment(formData);
      setEditing(null);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить решение");
    } finally {
      setSaving(false);
    }
  }

  const [sortKey, setSortKey] =
    useState<SortKey>(DEFAULT_SORT_KEY);

  const [sortDirection, setSortDirection] =
    useState<SortDirection>(DEFAULT_SORT_DIRECTION);

  // При первом открытии показываем все маркетплейсы.
  const [showBreakdown, setShowBreakdown] =
    useState(true);

  // ==========================================================
  // ВИДИМЫЕ КОЛОНКИ
  // ==========================================================

  const visibleColumns = useMemo(
    () =>
      COLUMNS.filter(
        (column) => showBreakdown || !column.detail
      ),
    [showBreakdown]
  );

  // ==========================================================
  // СОРТИРОВАННЫЕ ДАННЫЕ
  // ==========================================================

  const sortedItems = useMemo(() => {
    const nextItems = [...items];

    nextItems.sort((left, right) => {
      const result = compareValues(
        getSortValue(left, sortKey),
        getSortValue(right, sortKey),
        sortDirection
      );

      if (result !== 0) {
        return result;
      }

      // Вторичная сортировка по артикулу.
      return left.offer_id.localeCompare(
        right.offer_id,
        ["ru", "en"],
        {
          numeric: true,
          sensitivity: "base",
        }
      );
    });

    return nextItems;
  }, [items, sortKey, sortDirection]);

  // ==========================================================
  // НАЖАТИЕ НА ЗАГОЛОВОК
  // ==========================================================

  function changeSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) =>
        current === "desc" ? "asc" : "desc"
      );

      return;
    }

    setSortKey(key);
    setSortDirection(getInitialDirection(key));
  }

  // ==========================================================
  // ПЕРЕКЛЮЧЕНИЕ РЕЖИМА ТАБЛИЦЫ
  // ==========================================================

  function toggleBreakdown() {
    // Если скрываем колонку, по которой сортировали,
    // возвращаем сортировку по средним продажам.
    if (
      showBreakdown &&
      COLUMNS.some(
        (column) => column.key === sortKey && column.detail
      )
    ) {
      setSortKey(DEFAULT_SORT_KEY);
      setSortDirection(DEFAULT_SORT_DIRECTION);
    }

    setShowBreakdown(!showBreakdown);
  }

  // ==========================================================
  // JSX
  // ==========================================================

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        <span className="muted">
          Продажи за 28 дней, остатки в штуках
        </span>

        <Button
          type="button"
          variant="secondary"
          aria-expanded={showBreakdown}
          onClick={toggleBreakdown}
        >
          {showBreakdown
            ? "Скрыть разбивку по маркетплейсам"
            : "Показать разбивку по маркетплейсам"}
        </Button>
      </div>

      {unresolvedContainer > 0 || unresolvedTruck > 0 ? (
        <div className="error-box" role="status">
          <strong>Позиции с неполной коробкой требуют решения</strong>
          <p>Контейнер: {unresolvedContainer}; фура: {unresolvedTruck}.
            Они не будут незаметно пропущены при создании заказа.
            Для каждого товара нажмите «Изменить», укажите количество от 0
            (сознательно не закупать) либо не меньше полной коробки и сохраните.
          </p>
        </div>
      ) : null}

      {editing ? (
        <section className="section" aria-label="Ручная корректировка товара">
          <strong>Изменение количества: {editing.offerId} ({editing.scenario === "container" ? "контейнер" : "фура"})</strong>
          <form key={editing.itemId + editing.scenario} action={submitManualAdjustment}
            style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <input type="hidden" name="calculationItemId" value={editing.itemId}/>
            <input type="hidden" name="scenario" value={editing.scenario}/>
            <label>
              Количество, шт.
              <input className="input" type="number" name="manualQuantity" min="0" step="1"
                defaultValue={editing.quantity} required style={{ display: "block", width: 160 }} />
            </label>
            <label>
              Причина / комментарий
              <input className="input" type="text" name="comment" defaultValue={editing.comment}
                maxLength={400} placeholder="Причина решения" style={{ display: "block", width: 280 }} />
            </label>
            <Button type="submit" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
            <Button type="button" variant="secondary" onClick={() => { setEditing(null); setSaveError(""); }}>
              Отмена
            </Button>
          </form>
          {saveError ? <p role="alert">{saveError}</p> : null}
        </section>
      ) : null}

      <div
        className="table-wrapper"
        style={{ overflowX: "auto" }}
      >
        <table
          className="table zakup-sortable-table"
          style={
            showBreakdown
              ? { minWidth: "2250px" }
              : undefined
          }
        >
          <colgroup>
            {visibleColumns.map((column) => (
              <col
                key={column.key}
                className={
                  column.key === "offer_id"
                    ? "zakup-col-article"
                    : column.key === "name"
                      ? "zakup-col-product"
                      : "zakup-col-number"
                }
              />
            ))}
          </colgroup>

          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <SortableHeader
                  key={column.key}
                  label={column.label}
                  hint={column.hint}
                  sortKey={column.key}
                  currentKey={sortKey}
                  direction={sortDirection}
                  onSort={changeSort}
                  align={column.align}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedItems.map((item) => (
              <tr key={item.calculation_item_id}>
                {visibleColumns.map((column) => (
                  <td
                    key={column.key}
                    className={column.align}
                  >
                    {renderCell(item, column.key)}
                    {(column.key === "container_effective_final_units" ||
                      column.key === "truck_effective_final_units") ? (
                      <div>
                        <Button type="button" variant="secondary" onClick={() => {
                          const scenario = column.key === "container_effective_final_units"
                            ? "container" : "truck";
                          setSaveError("");
                          setEditing({
                            itemId: item.calculation_item_id, offerId: item.offer_id, scenario,
                            quantity: scenario === "container"
                              ? (item.container_manual_quantity ?? item.container_order_units)
                              : (item.truck_manual_quantity ?? item.truck_order_units),
                            comment: scenario === "container"
                              ? (item.container_manual_comment ?? "")
                              : (item.truck_manual_comment ?? ""),
                          });
                        }}>Изменить</Button>
                      </div>
                    ) : null}
                    {((column.key === "container_effective_final_units" &&
                        item.container_order_units > 0 && item.container_final_units === 0 &&
                        item.container_manual_quantity == null) ||
                      (column.key === "truck_effective_final_units" &&
                        item.truck_order_units > 0 && item.truck_final_units === 0 &&
                        item.truck_manual_quantity == null)) ? (
                      <small style={{ display: "block" }}>Требует решения</small>
                    ) : null}
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

// ============================================================
// КЛИКАБЕЛЬНЫЙ ЗАГОЛОВОК
// ============================================================

function SortableHeader({
  label,
  hint,
  sortKey,
  currentKey,
  direction,
  onSort,
  align,
}: {
  label: string;
  hint?: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align: "left" | "center";
}) {
  const active = sortKey === currentKey;

  const ariaSort = active
    ? direction === "desc"
      ? "descending"
      : "ascending"
    : "none";

  return (
    <th
      className={align}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        title={hint}
        className={[
          "zakup-sort-button",
          align === "center"
            ? "zakup-sort-button--center"
            : "zakup-sort-button--left",
          active
            ? "zakup-sort-button--active"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>

        {active && (
          <span
            className="zakup-sort-indicator"
            aria-hidden="true"
          >
            {direction === "desc" ? "↓" : "↑"}
          </span>
        )}
      </button>
    </th>
  );
}
