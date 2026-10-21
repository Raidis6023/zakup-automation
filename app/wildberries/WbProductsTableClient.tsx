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

export type WbProductRow = {
  nmId: number;
  sellerArticle: string | null;
  productName: string | null;
  brandName: string | null;
  masterCode: string | null;
  sales28Days: number;
  avgSalesPerDay: number;
  cancelled28Days: number;
  fbwStock: number;
  daysOfStock: number | null;
  toClient: number;
  fromClient: number;
};


type SortKey =
  | "masterCode"
  | "nmId"
  | "sellerArticle"
  | "productName"
  | "sales28Days"
  | "avgSalesPerDay"
  | "cancelled28Days"
  | "fbwStock"
  | "daysOfStock";


type SortDirection =
  | "asc"
  | "desc";


type Props = {
  items: WbProductRow[];
};


// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEY =
  "wb-products-expanded";


const TEXT_SORT_KEYS =
  new Set<SortKey>([
    "masterCode",
    "sellerArticle",
    "productName",
  ]);


// ============================================================
// ICONS
// ============================================================

function ProductsTableIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
      />


      <path
        d="M3 9h18"
      />


      <path
        d="M3 14h18"
      />


      <path
        d="M9 4v16"
      />


      <path
        d="M15 4v16"
      />

    </svg>

  );

}


function ChevronIcon({
  expanded,
}: {
  expanded: boolean;
}) {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={
        expanded
          ? "wb-products-chevron wb-products-chevron--expanded"
          : "wb-products-chevron"
      }
    >

      <path
        d="m7 10 5 5 5-5"
      />

    </svg>

  );

}


// ============================================================
// FORMAT
// ============================================================

function formatInteger(
  value:
    number
    |
    null
    |
    undefined
) {

  const number =
    Number(
      value
      ??
      0
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "0";

  }


  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    Math.round(
      number
    )
  );

}


// ============================================================
// TEXT
// ============================================================

function normalizeText(
  value:
    string
    |
    null
    |
    undefined
) {

  return (
    value
    ??
    ""
  )
    .trim()
    .toLocaleLowerCase(
      "ru-RU"
    );

}


// ============================================================
// SORT
// ============================================================

function compareRows(
  first:
    WbProductRow,

  second:
    WbProductRow,

  key:
    SortKey,

  direction:
    SortDirection
) {

  const multiplier =
    direction ===
    "asc"
      ? 1
      : -1;


  // ==========================================================
  // TEXT
  // ==========================================================

  if (
    TEXT_SORT_KEYS.has(
      key
    )
  ) {

    const firstValue =
      normalizeText(
        first[key] as
          string
          |
          null
          |
          undefined
      );


    const secondValue =
      normalizeText(
        second[key] as
          string
          |
          null
          |
          undefined
      );


    if (
      !firstValue
      &&
      !secondValue
    ) {

      return 0;

    }


    if (
      !firstValue
    ) {

      return 1;

    }


    if (
      !secondValue
    ) {

      return -1;

    }


    return (
      firstValue.localeCompare(
        secondValue,
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
      )
      *
      multiplier
    );

  }


  // ==========================================================
  // NUMBERS
  // ==========================================================

  const firstRaw =
    first[key] as
      number
      |
      null;


  const secondRaw =
    second[key] as
      number
      |
      null;


  if (
    firstRaw ===
      null
    &&
    secondRaw ===
      null
  ) {

    return 0;

  }


  if (
    firstRaw ===
    null
  ) {

    return 1;

  }


  if (
    secondRaw ===
    null
  ) {

    return -1;

  }


  const firstValue =
    Number(
      firstRaw
    );


  const secondValue =
    Number(
      secondRaw
    );


  if (
    firstValue ===
    secondValue
  ) {

    return 0;

  }


  return (
    firstValue >
    secondValue

      ? 1

      : -1
  )
  *
  multiplier;

}


// ============================================================
// COMPONENT
// ============================================================

export default function WbProductsTableClient({
  items,
}: Props) {

  // ==========================================================
  // COLLAPSE
  // ==========================================================

  const [
    expanded,
    setExpanded,
  ] =
    useState(
      false
    );


  const [
    storageLoaded,
    setStorageLoaded,
  ] =
    useState(
      false
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


  // ==========================================================
  // SORT
  //
  // По умолчанию:
  // Продажи 28 дней -> от большего к меньшему.
  // ==========================================================

  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      "sales28Days"
    );


  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      "desc"
    );


  // ==========================================================
  // LOCAL STORAGE
  // ==========================================================

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

        setExpanded(
          true
        );

        setNotificationFocus(
          focus
        );

        try {

          window.localStorage.setItem(
            STORAGE_KEY,
            "1"
          );

        } catch {

          // Storage may be unavailable.
        }

      } else {

        try {

          const stored =
            window
              .localStorage
              .getItem(
                STORAGE_KEY
              );

          if (
            stored ===
              "1"
          ) {

            setExpanded(
              true
            );

          }

          if (
            stored ===
              "0"
          ) {

            setExpanded(
              false
            );

          }

        } catch {

          // Storage may be unavailable.
        }

      }

      setStorageLoaded(
        true
      );

    },
    []
  );


  // ==========================================================
  // SORTED ITEMS
  // ==========================================================

  const sortedItems =
    useMemo(
      () => {

        return items
          .map(
            (
              item,
              index
            ) => ({
              item,
              index,
            })
          )
          .sort(
            (
              first,
              second
            ) => {

              const result =
                compareRows(
                  first.item,
                  second.item,
                  sortKey,
                  sortDirection
                );


              if (
                result !==
                0
              ) {

                return result;

              }


              return (
                first.index
                -
                second.index
              );

            }
          )
          .map(
            row =>
              row.item
          );

      },
      [
        items,
        sortKey,
        sortDirection,
      ]
    );


  useEffect(
    () => {

      if (
        !storageLoaded
        ||
        !expanded
        ||
        !notificationFocus
      ) {

        return;

      }

      const row =
        Array.from(
          document.querySelectorAll<
            HTMLTableRowElement
          >(
            "[data-wb-focus-key]"
          )
        ).find(
          element =>
            element.dataset
              .wbFocusKey ===
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
      expanded,
      notificationFocus,
      sortedItems,
      storageLoaded,
    ]
  );


  // ==========================================================
  // TOGGLE
  // ==========================================================

  function toggleExpanded() {

    setExpanded(
      previous => {

        const next =
          !previous;


        try {

          window
            .localStorage
            .setItem(
              STORAGE_KEY,
              next
                ? "1"
                : "0"
            );

        } catch {

          /*
           * Сама таблица продолжит работать
           * даже без localStorage.
           */

        }


        return next;

      }
    );

  }


  // ==========================================================
  // SORT CLICK
  // ==========================================================

  function changeSort(
    key:
      SortKey
  ) {

    if (
      sortKey ===
      key
    ) {

      setSortDirection(
        previous =>
          previous ===
          "asc"

            ? "desc"

            : "asc"
      );


      return;

    }


    setSortKey(
      key
    );


    setSortDirection(
      TEXT_SORT_KEYS.has(
        key
      )

        ? "asc"

        : "desc"
    );

  }


  // ==========================================================
  // SORT INDICATOR
  // ==========================================================

  function sortIndicator(
    key:
      SortKey
  ) {

    if (
      sortKey !==
      key
    ) {

      return null;

    }


    return (

      <span
        className="wb-products-sort-indicator"
        aria-hidden="true"
      >

        {
          sortDirection ===
          "asc"

            ? "↑"

            : "↓"
        }

      </span>

    );

  }


  // ==========================================================
  // ARIA SORT
  // ==========================================================

  function ariaSort(
    key:
      SortKey
  ):
    "ascending"
    |
    "descending"
    |
    "none" {

    if (
      sortKey !==
      key
    ) {

      return "none";

    }


    return (
      sortDirection ===
      "asc"

        ? "ascending"

        : "descending"
    );

  }


  // ==========================================================
  // HEADER BUTTON
  // ==========================================================

  function SortButton({
    column,
    children,
  }: {
    column:
      SortKey;

    children:
      ReactNode;
  }) {

    return (

      <button
        type="button"

        className={
          sortKey ===
          column

            ? "wb-products-sort-button wb-products-sort-button--active"

            : "wb-products-sort-button"
        }

        onClick={
          () =>
            changeSort(
              column
            )
        }
      >

        <span>
          {
            children
          }
        </span>


        {
          sortIndicator(
            column
          )
        }

      </button>

    );

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <section
      className="section wb-products-section wb-products-collapsible"
    >

      {/* ======================================================
          COLLAPSE HEADER
          ====================================================== */}

      <button
        type="button"

        className="wb-products-toggle"

        onClick={
          toggleExpanded
        }

        aria-expanded={
          expanded
        }

        aria-controls="wb-products-table"
      >

        <span
          className="wb-products-toggle-icon"
        >

          <ProductsTableIcon />

        </span>


        <span
          className="wb-products-toggle-copy"
        >

          <strong
            className="wb-products-toggle-title"
          >
            Данные по товарам
          </strong>


          <span
            className="muted wb-products-toggle-subtitle"
          >
            Одна строка соответствует одному Артикулу WB
          </span>

        </span>


        <span
          className="wb-products-toggle-chevron"
        >

          <ChevronIcon
            expanded={
              expanded
            }
          />

        </span>

      </button>


      {/* ======================================================
          TABLE
          ====================================================== */}

      {
        storageLoaded
        &&
        expanded

          ? (

            <div
              id="wb-products-table"
              className="wb-products-table-content"
            >

              <div
                className="wb-products-scroll"
              >

                <table
                  className="wb-products-sort-table"
                >

                  <colgroup>

                    <col
                      className="wb-products-col-master"
                    />

                    <col
                      className="wb-products-col-wb"
                    />

                    <col
                      className="wb-products-col-seller"
                    />

                    <col
                      className="wb-products-col-product"
                    />

                    <col
                      className="wb-products-col-sales"
                    />

                    <col
                      className="wb-products-col-average"
                    />

                    <col
                      className="wb-products-col-cancel"
                    />

                    <col
                      className="wb-products-col-stock"
                    />

                    <col
                      className="wb-products-col-days"
                    />

                  </colgroup>


                  <thead>

                    <tr>

                      {/* ======================================
                          ЕНОТ

                          В коде и данных это по-прежнему
                          masterCode.

                          Меняется только название
                          для пользователя.
                          ====================================== */}

                      <th
                        aria-sort={
                          ariaSort(
                            "masterCode"
                          )
                        }
                      >

                        <SortButton
                          column="masterCode"
                        >
                          ЕНОТ
                        </SortButton>

                      </th>


                      <th
                        aria-sort={
                          ariaSort(
                            "nmId"
                          )
                        }
                      >

                        <SortButton
                          column="nmId"
                        >
                          Артикул WB
                        </SortButton>

                      </th>


                      <th
                        aria-sort={
                          ariaSort(
                            "sellerArticle"
                          )
                        }
                      >

                        <SortButton
                          column="sellerArticle"
                        >
                          Артикул продавца
                        </SortButton>

                      </th>


                      <th
                        aria-sort={
                          ariaSort(
                            "productName"
                          )
                        }
                      >

                        <SortButton
                          column="productName"
                        >
                          Товар
                        </SortButton>

                      </th>


                      <th
                        className="wb-products-numeric-head"

                        aria-sort={
                          ariaSort(
                            "sales28Days"
                          )
                        }
                      >

                        <SortButton
                          column="sales28Days"
                        >
                          Продажи 28 дн.
                        </SortButton>

                      </th>


                      <th
                        className="wb-products-numeric-head"

                        aria-sort={
                          ariaSort(
                            "avgSalesPerDay"
                          )
                        }
                      >

                        <SortButton
                          column="avgSalesPerDay"
                        >
                          Среднее / день
                        </SortButton>

                      </th>


                      <th
                        className="wb-products-numeric-head"

                        aria-sort={
                          ariaSort(
                            "cancelled28Days"
                          )
                        }
                      >

                        <SortButton
                          column="cancelled28Days"
                        >
                          Отмены
                        </SortButton>

                      </th>


                      <th
                        className="wb-products-numeric-head"

                        aria-sort={
                          ariaSort(
                            "fbwStock"
                          )
                        }
                      >

                        <SortButton
                          column="fbwStock"
                        >
                          Остаток
                        </SortButton>

                      </th>


                      <th
                        className="wb-products-numeric-head"

                        aria-sort={
                          ariaSort(
                            "daysOfStock"
                          )
                        }
                      >

                        <SortButton
                          column="daysOfStock"
                        >
                          Дней запаса
                        </SortButton>

                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {
                      sortedItems.map(
                        row => (

                          <tr
                            key={
                              row.nmId
                            }

                            className={
                              notificationFocus ===
                                String(
                                  row.nmId
                                )

                                ? "wb-products-row--notification-focus"

                                : undefined
                            }

                            data-wb-focus-key={
                              String(
                                row.nmId
                              )
                            }
                          >

                            {/* ЕНОТ */}

                            <td
                              className="wb-products-master-cell"
                            >

                              {
                                row.masterCode

                                  ? (

                                    <span
                                      className="wb-products-master-code"
                                    >
                                      {
                                        row.masterCode
                                      }
                                    </span>

                                  )

                                  : "—"
                              }

                            </td>


                            {/* Артикул WB */}

                            <td
                              className="wb-products-wb-cell"
                            >

                              <strong>
                                {
                                  row.nmId
                                }
                              </strong>

                            </td>


                            {/* Артикул продавца */}

                            <td
                              className="wb-products-seller-cell"
                              title={
                                row.sellerArticle
                                ??
                                undefined
                              }
                            >

                              {
                                row.sellerArticle
                                ||
                                "—"
                              }

                            </td>


                            {/* Товар */}

                            <td
                              className="wb-products-product-cell"
                            >

                              <div
                                className="wb-products-product-name"
                              >

                                {
                                  row.productName
                                  ||
                                  "—"
                                }

                              </div>


                              {
                                row.brandName
                                &&
                                row.brandName.trim()

                                  ? (

                                    <div
                                      className="muted wb-products-brand"
                                    >
                                      {
                                        row.brandName
                                      }
                                    </div>

                                  )

                                  : null
                              }

                            </td>


                            {/* Продажи */}

                            <td
                              className="wb-products-number-cell wb-products-sales-cell"
                            >

                              <strong>
                                {
                                  formatInteger(
                                    row.sales28Days
                                  )
                                }
                              </strong>

                            </td>


                            {/* Среднее */}

                            <td
                              className="wb-products-number-cell"
                            >

                              {
                                formatInteger(
                                  row.avgSalesPerDay
                                )
                              }

                            </td>


                            {/* Отмены */}

                            <td
                              className="wb-products-number-cell"
                            >

                              {
                                formatInteger(
                                  row.cancelled28Days
                                )
                              }

                            </td>


                            {/* Остаток */}

                            <td
                              className="wb-products-number-cell"
                            >

                              <strong>
                                {
                                  formatInteger(
                                    row.fbwStock
                                  )
                                }
                              </strong>

                            </td>


                            {/* Дней запаса */}

                            <td
                              className={
                                notificationFocus ===
                                  String(
                                    row.nmId
                                  )

                                  ? "wb-products-number-cell wb-products-stock-days--notification-focus"

                                  : "wb-products-number-cell"
                              }
                            >

                              {
                                row.daysOfStock ===
                                null

                                  ? "—"

                                  : formatInteger(
                                      row.daysOfStock
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

            </div>

          )

          : null
      }

    </section>

  );

}
