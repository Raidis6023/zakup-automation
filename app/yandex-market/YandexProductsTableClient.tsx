"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";


// ============================================================
// TYPES
// ============================================================

export type YandexWarehouseMetric = {
  warehouseId:
    number
    | null;

  warehouseName:
    string;

  sales:
    number;

  cancellations:
    number;

  stock:
    number;
};


export type YandexProductsTableItem = {
  id:
    number;

  master_code:
    string
    | null;

  name:
    string;

  offer_id:
    string;

  sales:
    number;

  cancellations:
    number;

  stock:
    number;

  warehouses:
    YandexWarehouseMetric[];
};


// ============================================================
// SORT
// ============================================================

type SortKey =
  | "master_code"
  | "name"
  | "offer_id"
  | "sales"
  | "average"
  | "cancellations"
  | "stock"
  | "stock_days";


type SortDirection =
  | "asc"
  | "desc";


type SortValue =
  | string
  | number
  | null;


const DEFAULT_SORT_KEY:
  SortKey =
    "sales";


const DEFAULT_SORT_DIRECTION:
  SortDirection =
    "desc";


// ============================================================
// FORMAT
// ============================================================

function formatWholeNumber(
  value:
    number
    | null
    | undefined
) {

  if (
    value === null
    ||
    value === undefined
    ||
    Number.isNaN(
      value
    )
  ) {

    return "—";

  }


  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        0,

      minimumFractionDigits:
        0,
    }
  ).format(
    Math.round(
      value
    )
  );

}


// ============================================================
// ФОРМАТЫ ДЛЯ РАСКРЫТИЯ ПО СКЛАДАМ
// ПОКА ОСТАВЛЯЕМ КАК БЫЛО
// ============================================================

function formatInteger(
  value:
    number
) {

  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    value
  );

}


function formatAverage(
  value:
    number
) {

  return new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(
    value
  );

}


function formatStockDays(
  value:
    number
) {

  return new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits:
        1,

      maximumFractionDigits:
        1,
    }
  ).format(
    value
  );

}


// ============================================================
// CALCULATED VALUES
// ============================================================

function getAverage(
  item:
    YandexProductsTableItem,

  periodDays:
    number
) {

  if (
    periodDays <=
    0
  ) {

    return 0;

  }


  return item.sales
    /
    periodDays;

}


function getStockDays(
  item:
    YandexProductsTableItem,

  periodDays:
    number
):
number | null {

  const average =
    getAverage(
      item,
      periodDays
    );


  if (
    average <=
    0
  ) {

    return null;

  }


  return item.stock
    /
    average;

}


// ============================================================
// FIRST CLICK DIRECTION
// ============================================================

function getInitialDirection(
  key:
    SortKey
):
SortDirection {

  if (
    key ===
      "master_code"
    ||
    key ===
      "name"
    ||
    key ===
      "offer_id"
  ) {

    return "asc";

  }


  return "desc";

}


// ============================================================
// SORT VALUE
// ============================================================

function getSortValue(
  item:
    YandexProductsTableItem,

  key:
    SortKey,

  periodDays:
    number
):
SortValue {

  switch (
    key
  ) {

    case "master_code":

      return item.master_code;


    case "name":

      return item.name;


    case "offer_id":

      return item.offer_id;


    case "sales":

      return item.sales;


    case "average":

      return getAverage(
        item,
        periodDays
      );


    case "cancellations":

      return item.cancellations;


    case "stock":

      return item.stock;


    case "stock_days":

      return getStockDays(
        item,
        periodDays
      );

  }

}


// ============================================================
// COMPARE
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
   * Пустые значения всегда внизу.
   */

  if (
    left ===
      null
    &&
    right ===
      null
  ) {

    return 0;

  }


  if (
    left ===
    null
  ) {

    return 1;

  }


  if (
    right ===
    null
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

export default function YandexProductsTableClient({
  items,
  periodDays,
}: {
  items:
    YandexProductsTableItem[];

  periodDays:
    number;
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


  const [
    notificationFocus,
    setNotificationFocus,
  ] =
    useState<
      string
      |
      null
    >(
      null
    );


  useEffect(
    () => {

      const params =
        new URLSearchParams(
          window.location.search
        );

      const focus =
        params.get(
          "focusStockDays"
        );

      if (
        focus
      ) {

        setNotificationFocus(
          focus
        );

      }

    },
    []
  );


  // ==========================================================
  // SORTED ITEMS
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
                  sortKey,
                  periodDays
                ),

                getSortValue(
                  right,
                  sortKey,
                  periodDays
                ),

                sortDirection
              );


            if (
              result !==
              0
            ) {

              return result;

            }


            return left.offer_id
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
        periodDays,
        sortKey,
        sortDirection,
      ]
    );


  useEffect(
    () => {

      if (
        !notificationFocus
      ) {

        return;

      }

      const row =
        Array.from(
          document.querySelectorAll<
            HTMLElement
          >(
            "[data-ym-focus-key]"
          )
        ).find(
          element =>
            element.dataset
              .ymFocusKey ===
              notificationFocus
        );

      if (
        !row
      ) {

        return;

      }

      const url =
        new URL(
          window.location.href
        );

      url.searchParams.delete(
        "focusStockDays"
      );

      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`
      );

      window.requestAnimationFrame(
        () => {

          row.scrollIntoView({
            behavior:
              "smooth",

            block:
              "center",
          });

        }
      );

      const timer =
        window.setTimeout(
          () => {

            setNotificationFocus(
              null
            );

          },
          10_000
        );

      return () => {

        window.clearTimeout(
          timer
        );

      };

    },
    [
      notificationFocus,
      sortedItems,
    ]
  );


  // ==========================================================
  // CHANGE SORT
  // ==========================================================

  function changeSort(
    key:
      SortKey
  ) {

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
        "ym-products-table-shell"
    >

      <div
        className=
          "ym-products-table"
      >

        {/* ===================================
            HEADER
            =================================== */}

        <div
          className=
            "ym-products-grid ym-products-table-header"
        >

          <SortableHeader
            label="ЕНОТ"

            sortKey=
              "master_code"

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
            label="Артикул"

            sortKey=
              "offer_id"

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
            label={`Продажи ${periodDays} дн.`}

            sortKey="sales"

            currentKey={
              sortKey
            }

            direction={
              sortDirection
            }

            onSort={
              changeSort
            }

            align="center"
          />


          <SortableHeader
            label="Среднее / день"

            sortKey="average"

            currentKey={
              sortKey
            }

            direction={
              sortDirection
            }

            onSort={
              changeSort
            }

            align="center"
          />


          <SortableHeader
            label="Отмены"

            sortKey=
              "cancellations"

            currentKey={
              sortKey
            }

            direction={
              sortDirection
            }

            onSort={
              changeSort
            }

            align="center"
          />


          <SortableHeader
            label="Остаток"

            sortKey="stock"

            currentKey={
              sortKey
            }

            direction={
              sortDirection
            }

            onSort={
              changeSort
            }

            align="center"
          />


          <SortableHeader
            label="Дней запаса"

            sortKey=
              "stock_days"

            currentKey={
              sortKey
            }

            direction={
              sortDirection
            }

            onSort={
              changeSort
            }

            align="center"
          />

        </div>


        {/* ===================================
            ROWS
            =================================== */}

        {
          sortedItems.map(
            item => {

              const average =
                getAverage(
                  item,
                  periodDays
                );


              const stockDays =
                getStockDays(
                  item,
                  periodDays
                );


              return (
                <details
                  key={
                    item.id
                  }

                  className={
                    notificationFocus ===
                      item.offer_id

                      ? "ym-product-details ym-product-details--notification-focus"

                      : "ym-product-details"
                  }

                  data-ym-focus-key={
                    item.offer_id
                  }
                >

                  <summary
                    className=
                      "ym-products-grid ym-product-summary"
                  >

                    <MainCell
                      strong
                    >

                      <span
                        className=
                          "ym-enot-wrap"
                      >

                        <span
                          className=
                            "ym-product-chevron"

                          aria-hidden="true"
                        >
                          ▶
                        </span>


                        <span
                          className=
                            "ym-enot-code"
                        >
                          {
                            item.master_code
                            ??
                            "—"
                          }
                        </span>

                      </span>

                    </MainCell>


                    <MainCell
                      strong
                      text
                    >
                      {item.name}
                    </MainCell>


                    <MainCell
                      strong
                      text
                    >
                      {item.offer_id}
                    </MainCell>


                    <MainCell
                      numeric
                      strong
                    >
                      {
                        formatWholeNumber(
                          item.sales
                        )
                      }
                    </MainCell>


                    <MainCell numeric>
                      {
                        formatWholeNumber(
                          average
                        )
                      }
                    </MainCell>


                    <MainCell numeric>
                      {
                        formatWholeNumber(
                          item.cancellations
                        )
                      }
                    </MainCell>


                    <MainCell
                      numeric
                      strong
                    >
                      {
                        formatWholeNumber(
                          item.stock
                        )
                      }
                    </MainCell>


                    <MainCell
                      numeric
                      strong

                      className={
                        notificationFocus ===
                          item.offer_id

                          ? "ym-products-stock-days--notification-focus"

                          : undefined
                      }
                    >
                      {
                        stockDays ===
                        null

                          ? "—"

                          : formatWholeNumber(
                              stockDays
                            )
                      }
                    </MainCell>

                  </summary>


                  {/* =================================
                      WAREHOUSE EXPANSION
                      ПОКА НЕ ПЕРЕОФОРМЛЯЕМ
                      ================================= */}

                  <div
                    style={{
                      padding:
                        "16px 18px 18px 38px",

                      borderTop:
                        "1px solid var(--table-divider, #282e38)",
                    }}
                  >

                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        gap:
                          "16px",

                        marginBottom:
                          "14px",
                      }}
                    >

                      <div>

                        <div
                          style={{
                            fontSize:
                              "14px",

                            fontWeight:
                              700,
                          }}
                        >
                          Продажи и остатки по складам
                        </div>


                        <div
                          className="muted"

                          style={{
                            marginTop:
                              "4px",

                            fontSize:
                              "11px",
                          }}
                        >
                          По конкретным складам
                          Яндекс Маркета.
                        </div>

                      </div>


                      <div
                        style={{
                          display:
                            "flex",

                          gap:
                            "18px",

                          fontSize:
                            "12px",

                          fontWeight:
                            700,
                        }}
                      >

                        <span>
                          Строк:{" "}
                          {
                            formatInteger(
                              item
                                .warehouses
                                .length
                            )
                          }
                        </span>


                        <span>
                          Продажи:{" "}
                          {
                            formatInteger(
                              item.sales
                            )
                          }
                        </span>


                        <span>
                          Отмены:{" "}
                          {
                            formatInteger(
                              item.cancellations
                            )
                          }
                        </span>


                        <span>
                          Остаток:{" "}
                          {
                            formatInteger(
                              item.stock
                            )
                          }
                        </span>

                      </div>

                    </div>


                    {
                      item.warehouses.length >
                      0

                        ? (
                          <WarehouseTable
                            offerId={
                              item.offer_id
                            }

                            rows={
                              item.warehouses
                            }

                            periodDays={
                              periodDays
                            }
                          />
                        )

                        : (
                          <div className="reason-text">
                            Нет данных по складам.
                          </div>
                        )
                    }

                  </div>

                </details>
              );

            }
          )
        }

      </div>

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
    | "center";
}) {

  const active =
    sortKey ===
    currentKey;


  const ariaSort:
    "ascending"
    | "descending"
    | "none" =

      active

        ? direction ===
          "desc"

          ? "descending"

          : "ascending"

        : "none";


  return (
    <div
      role="columnheader"

      aria-sort={
        ariaSort
      }

      className=
        "ym-products-header-cell"
    >

      <button
        type="button"

        className={
          [
            "ym-products-sort-button",

            align ===
              "center"

              ? "ym-products-sort-button--center"

              : "ym-products-sort-button--left",

            active

              ? "ym-products-sort-button--active"

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
          {label}
        </span>


        {
          active

            ? (
              <span
                className=
                  "ym-products-sort-indicator"

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

    </div>
  );

}


// ============================================================
// MAIN CELL
// ============================================================

function MainCell({
  children,
  numeric = false,
  strong = false,
  text = false,
  className,
}: {
  children:
    ReactNode;

  numeric?:
    boolean;

  strong?:
    boolean;

  text?:
    boolean;

  className?:
    string;
}) {

  return (
    <div
      className={
        [
          "ym-products-main-cell",

          numeric
            ? "ym-products-main-cell--numeric"
            : "",

          strong
            ? "ym-products-main-cell--strong"
            : "",

          text
            ? "ym-products-main-cell--text"
            : "",

          className
          ??
          "",
        ]
          .filter(
            Boolean
          )
          .join(
            " "
          )
      }
    >
      {children}
    </div>
  );

}


// ============================================================
// WAREHOUSE TABLE
// ОСТАВЛЯЕМ В ПРЕЖНЕМ ВИДЕ
// ============================================================

function WarehouseTable({
  offerId,
  rows,
  periodDays,
}: {
  offerId:
    string;

  rows:
    YandexWarehouseMetric[];

  periodDays:
    number;
}) {

  return (
    <div
      style={{
        overflowX:
          "auto",
      }}
    >

      <table
        style={{
          width:
            "100%",

          minWidth:
            "1000px",

          borderCollapse:
            "separate",

          borderSpacing:
            0,

          border:
            "none",
        }}
      >

        <thead>

          <tr>

            <WarehouseHeader>
              Артикул
            </WarehouseHeader>


            <WarehouseHeader>
              Склад
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Продажи {periodDays} дн.
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Среднее / день
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Отмены
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Остаток
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Дней запаса
            </WarehouseHeader>

          </tr>

        </thead>


        <tbody>

          {
            rows.map(
              (
                row,
                index
              ) => {

                const average =
                  periodDays > 0

                    ? row.sales
                      /
                      periodDays

                    : 0;


                const stockDays =
                  average > 0

                    ? row.stock
                      /
                      average

                    : null;


                const divider =
                  index ===
                  rows.length - 1

                    ? "none"

                    : "1px solid var(--table-divider, #282e38)";


                return (
                  <tr
                    key={
                      [
                        offerId,
                        row.warehouseId
                        ??
                        "null",
                        row.warehouseName,
                      ].join("|")
                    }
                  >

                    <WarehouseCell
                      divider={
                        divider
                      }

                      strong
                    >
                      {offerId}
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }
                    >
                      {row.warehouseName}
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric

                      strong
                    >
                      {
                        formatInteger(
                          row.sales
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric
                    >
                      {
                        formatAverage(
                          average
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric
                    >
                      {
                        formatInteger(
                          row.cancellations
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric

                      strong
                    >
                      {
                        formatInteger(
                          row.stock
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric

                      strong
                    >
                      {
                        stockDays ===
                        null

                          ? "—"

                          : formatStockDays(
                              stockDays
                            )
                      }
                    </WarehouseCell>

                  </tr>
                );

              }
            )
          }

        </tbody>

      </table>

    </div>
  );

}


// ============================================================
// WAREHOUSE HEADER
// ============================================================

function WarehouseHeader({
  children,
  numeric = false,
}: {
  children:
    ReactNode;

  numeric?:
    boolean;
}) {

  return (
    <th
      style={{
        padding:
          "12px 14px",

        textAlign:
          numeric
            ? "right"
            : "left",

        fontSize:
          "12px",

        fontWeight:
          700,

        color:
          "var(--text-secondary, #b8c0cc)",

        border:
          "none",

        borderBottom:
          "1px solid var(--table-divider, #282e38)",

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </th>
  );

}


// ============================================================
// WAREHOUSE CELL
// ============================================================

function WarehouseCell({
  children,
  divider,
  numeric = false,
  strong = false,
}: {
  children:
    ReactNode;

  divider:
    string;

  numeric?:
    boolean;

  strong?:
    boolean;
}) {

  return (
    <td
      style={{
        padding:
          "12px 14px",

        textAlign:
          numeric
            ? "right"
            : "left",

        fontSize:
          "13px",

        lineHeight:
          1.35,

        fontWeight:
          strong
            ? 700
            : 500,

        border:
          "none",

        borderBottom:
          divider,

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </td>
  );

}
