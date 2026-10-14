"use client";

import {
  useMemo,
  useState,
} from "react";


// ============================================================
// ТИП ТОВАРА
// ============================================================

export type ZakupTableItem = {
  calculation_item_id: string;
  offer_id: string;
  name: string | null;

  avg_sales_per_day: number;

  own_stock_quantity: number;
  ozon_stock_quantity: number;
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
// СОРТИРОВКА
// ============================================================

type SortKey =
  | "offer_id"
  | "name"
  | "avg_sales_per_day"
  | "own_stock_quantity"
  | "ozon_stock_quantity"
  | "active_ved_quantity"
  | "effective_stock"
  | "coverage_days"
  | "container_effective_final_units"
  | "container_effective_volume_m3"
  | "truck_effective_final_units"
  | "truck_effective_volume_m3";


type SortDirection =
  | "asc"
  | "desc";


type SortValue =
  | string
  | number
  | null;


const DEFAULT_SORT_KEY:
  SortKey =
    "avg_sales_per_day";


const DEFAULT_SORT_DIRECTION:
  SortDirection =
    "desc";


// ============================================================
// НАПРАВЛЕНИЕ ПЕРВОГО КЛИКА
// ============================================================

function getInitialDirection(
  key:
    SortKey
):
SortDirection {

  /*
   * Текстовые колонки:
   * первый клик = А → Я / A → Z.
   */

  if (
    key ===
      "offer_id"
    ||
    key ===
      "name"
  ) {

    return "asc";

  }


  /*
   * Числовые колонки:
   * первый клик = от большего к меньшему.
   */

  return "desc";

}


// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

function formatRoundedInteger(
  value:
    number
    |
    null
    |
    undefined
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "—";

  }


  return Math.round(
    number
  ).toLocaleString(
    "ru-RU"
  );

}


function formatOneDecimal(
  value:
    number
    |
    null
    |
    undefined
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "—";

  }


  return number.toLocaleString(
    "ru-RU",
    {
      minimumFractionDigits:
        1,

      maximumFractionDigits:
        1,
    }
  );

}


// ============================================================
// ЗНАЧЕНИЕ ДЛЯ СОРТИРОВКИ
// ============================================================

function getSortValue(
  item:
    ZakupTableItem,

  key:
    SortKey
):
SortValue {

  switch (
    key
  ) {

    case "offer_id":

      return item.offer_id;


    case "name":

      return item.name;


    case "avg_sales_per_day":

      return item.avg_sales_per_day;


    case "own_stock_quantity":

      return item.own_stock_quantity;


    case "ozon_stock_quantity":

      return item.ozon_stock_quantity;


    case "active_ved_quantity":

      return item.active_ved_quantity;


    case "effective_stock":

      return item.effective_stock;


    case "coverage_days":

      return item.coverage_days;


    case "container_effective_final_units":

      return item
        .container_effective_final_units;


    case "container_effective_volume_m3":

      return item
        .container_effective_volume_m3;


    case "truck_effective_final_units":

      return item
        .truck_effective_final_units;


    case "truck_effective_volume_m3":

      return item
        .truck_effective_volume_m3;

  }

}


// ============================================================
// СРАВНЕНИЕ
// ============================================================

function compareValues(
  left:
    SortValue,

  right:
    SortValue,

  direction:
    SortDirection
) {

  /*
   * Пустые значения всегда держим внизу.
   */

  if (
    left === null
    &&
    right === null
  ) {

    return 0;

  }


  if (
    left === null
  ) {

    return 1;

  }


  if (
    right === null
  ) {

    return -1;

  }


  let result =
    0;


  if (
    typeof left ===
      "number"
    &&
    typeof right ===
      "number"
  ) {

    result =
      left
      -
      right;

  } else {

    /*
     * Для Артикула и Товара:
     * естественная алфавитно-цифровая сортировка.
     *
     * numeric: true нужен, чтобы условный
     * AV-2 шёл раньше AV-10, а не наоборот.
     */

    result =
      String(
        left
      ).localeCompare(
        String(
          right
        ),
        [
          "ru",
          "en",
        ],
        {
          numeric:
            true,

          sensitivity:
            "base",
        }
      );

  }


  return direction ===
    "asc"

    ? result

    : -result;

}


// ============================================================
// COMPONENT
// ============================================================

export default function ZakupProductsTableClient({
  items,
}: {
  items:
    ZakupTableItem[];
}) {

  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      DEFAULT_SORT_KEY
    );


  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      DEFAULT_SORT_DIRECTION
    );


  // ==========================================================
  // СОРТИРОВАННЫЕ ДАННЫЕ
  // ==========================================================

  const sortedItems =
    useMemo(
      () => {

        const nextItems =
          [
            ...items,
          ];


        nextItems.sort(
          (
            left,
            right
          ) => {

            const result =
              compareValues(
                getSortValue(
                  left,
                  sortKey
                ),

                getSortValue(
                  right,
                  sortKey
                ),

                sortDirection
              );


            if (
              result !==
              0
            ) {

              return result;

            }


            /*
             * Если значения выбранного столбца
             * одинаковые, используем Артикул
             * как стабильную вторичную сортировку.
             */

            return left
              .offer_id
              .localeCompare(
                right.offer_id,
                [
                  "ru",
                  "en",
                ],
                {
                  numeric:
                    true,

                  sensitivity:
                    "base",
                }
              );

          }
        );


        return nextItems;

      },
      [
        items,
        sortKey,
        sortDirection,
      ]
    );


  // ==========================================================
  // НАЖАТИЕ НА ЗАГОЛОВОК
  // ==========================================================

  function changeSort(
    key:
      SortKey
  ) {

    /*
     * Если нажали на уже активный столбец,
     * просто разворачиваем направление.
     */

    if (
      key ===
      sortKey
    ) {

      setSortDirection(
        current =>
          current ===
            "desc"

            ? "asc"

            : "desc"
      );


      return;

    }


    /*
     * Если выбран новый столбец:
     *
     * Артикул / Товар:
     * первый клик = А → Я / A → Z.
     *
     * Остальные:
     * первый клик = от большего к меньшему.
     */

    setSortKey(
      key
    );


    setSortDirection(
      getInitialDirection(
        key
      )
    );

  }


  return (

    <div
      className=
        "table-wrapper"
    >

      <table
        className=
          "table zakup-sortable-table"
      >

        <thead>

          <tr>

            <SortableHeader
              label="Артикул"

              sortKey="offer_id"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="left"
            />


            <SortableHeader
              label="Товар"

              sortKey="name"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="left"
            />


            <SortableHeader
              label="Продажи/сутки"

              sortKey=
                "avg_sales_per_day"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />


            <SortableHeader
              label="Наш склад"

              sortKey=
                "own_stock_quantity"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />


            <SortableHeader
              label="Ozon"

              sortKey=
                "ozon_stock_quantity"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />


            <SortableHeader
              label="ВЭД"

              sortKey=
                "active_ved_quantity"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />


            <SortableHeader
              label="Общий остаток"

              sortKey=
                "effective_stock"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />


            <SortableHeader
              label="Покрытие"

              sortKey=
                "coverage_days"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />


            <SortableHeader
              label="Контейнер, шт."

              sortKey=
                "container_effective_final_units"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />


            <SortableHeader
              label="Контейнер, м³"

              sortKey=
                "container_effective_volume_m3"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />


            <SortableHeader
              label="Фура, шт."

              sortKey=
                "truck_effective_final_units"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />


            <SortableHeader
              label="Фура, м³"

              sortKey=
                "truck_effective_volume_m3"

              currentKey={
                sortKey
              }

              direction={
                sortDirection
              }

              onSort={
                changeSort
              }

              align="right"
            />

          </tr>

        </thead>


        <tbody>

          {
            sortedItems.map(
              item => (

                <tr
                  key={
                    item
                      .calculation_item_id
                  }
                >

                  <td
                    className=
                      "left"
                  >

                    <strong>
                      {
                        item.offer_id
                      }
                    </strong>

                  </td>


                  <td
                    className=
                      "left"
                  >
                    {
                      item.name
                      ??
                      "—"
                    }
                  </td>


                  <td
                    className=
                      "right"
                  >
                    {
                      formatRoundedInteger(
                        item
                          .avg_sales_per_day
                      )
                    }
                  </td>


                  <td
                    className=
                      "right"
                  >
                    {
                      formatRoundedInteger(
                        item
                          .own_stock_quantity
                      )
                    }
                  </td>


                  <td
                    className=
                      "right"
                  >
                    {
                      formatRoundedInteger(
                        item
                          .ozon_stock_quantity
                      )
                    }
                  </td>


                  <td
                    className=
                      "right"
                  >
                    {
                      formatRoundedInteger(
                        item
                          .active_ved_quantity
                      )
                    }
                  </td>


                  <td
                    className=
                      "right"
                  >
                    {
                      formatRoundedInteger(
                        item
                          .effective_stock
                      )
                    }
                  </td>


                  <td
                    className=
                      "right"
                  >

                    {
                      item
                        .coverage_days ===
                        null

                        ? "—"

                        : (
                          <>
                            <strong>
                              {
                                formatRoundedInteger(
                                  item
                                    .coverage_days
                                )
                              }
                            </strong>{" "}
                            дн.
                          </>
                        )
                    }

                  </td>


                  <td
                    className=
                      "right"
                  >

                    <strong>
                      {
                        formatRoundedInteger(
                          item
                            .container_effective_final_units
                        )
                      }
                    </strong>


                    {
                      item
                        .container_manual_quantity !==
                        null

                        ? (

                          <div
                            className=
                              "muted"
                          >
                            вручную
                          </div>

                        )

                        : null
                    }

                  </td>


                  <td
                    className=
                      "right"
                  >
                    {
                      formatOneDecimal(
                        item
                          .container_effective_volume_m3
                      )
                    }
                  </td>


                  <td
                    className=
                      "right"
                  >

                    <strong>
                      {
                        formatRoundedInteger(
                          item
                            .truck_effective_final_units
                        )
                      }
                    </strong>


                    {
                      item
                        .truck_manual_quantity !==
                        null

                        ? (

                          <div
                            className=
                              "muted"
                          >
                            вручную
                          </div>

                        )

                        : null
                    }

                  </td>


                  <td
                    className=
                      "right"
                  >
                    {
                      formatOneDecimal(
                        item
                          .truck_effective_volume_m3
                      )
                    }
                  </td>

                </tr>

              )
            )
          }

        </tbody>

      </table>

    </div>

  );

}


// ============================================================
// SORTABLE HEADER
// ============================================================

function SortableHeader({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  align,
}: {
  label:
    string;

  sortKey:
    SortKey;

  currentKey:
    SortKey;

  direction:
    SortDirection;

  onSort:
    (
      key:
        SortKey
    ) => void;

  align:
    "left"
    |
    "right";
}) {

  const active =
    sortKey ===
    currentKey;


  const ariaSort =
    active

      ? direction ===
        "desc"

        ? "descending"

        : "ascending"

      : "none";


  return (

    <th
      className={
        align
      }

      aria-sort={
        ariaSort
      }
    >

      <button
        type="button"

        className={
          [
            "zakup-sort-button",

            align ===
              "right"

              ? "zakup-sort-button--right"

              : "zakup-sort-button--left",

            active

              ? "zakup-sort-button--active"

              : "",
          ]
            .filter(
              Boolean
            )
            .join(
              " "
            )
        }

        onClick={
          () =>
            onSort(
              sortKey
            )
        }
      >

        <span>
          {
            label
          }
        </span>


        {
          active

            ? (

              <span
                className=
                  "zakup-sort-indicator"

                aria-hidden="true"
              >
                {
                  direction ===
                    "desc"

                    ? "↓"

                    : "↑"
                }
              </span>

            )

            : null
        }

      </button>

    </th>

  );

}
