"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";


// ============================================================
// ТИПЫ
// ============================================================

export type OzonListingRow = {
  product_id: string;

  offer_id:
    | string
    | null;

  ozon_product_id:
    | string
    | number
    | null;

  name:
    | string
    | null;
};


export type OzonProductRow = {
  master_code: string;

  product_name:
    | string
    | null;

  listing_count: number;

  listings:
    OzonListingRow[];

  sales_28_days: number;

  cancelled_28_days: number;

  average_sales_per_day: number;

  stock_quantity: number;

  stock_days:
    | number
    | null;
};


export type OzonClusterDetailRow = {
  product_id: string;

  offer_id:
    | string
    | null;

  ozon_product_id:
    | string
    | number
    | null;

  ozon_sku:
    | string
    | null;

  cluster_id: string;

  cluster_name:
    | string
    | null;

  sales_28_days: number;

  cancelled_28_days: number;

  average_sales_per_day: number;

  stock_quantity: number;

  stock_days:
    | number
    | null;
};


type Props = {
  products:
    OzonProductRow[];

  clusterRowsByMasterCode:
    Record<
      string,
      OzonClusterDetailRow[]
    >;
  calculationLabel?: string;
};


type OzonSortKey = "master_code" | "ozon_product_id" | "product_name" | "offer_id" | "sales_28_days"
  | "average_sales_per_day" | "cancelled_28_days" | "stock_quantity" | "stock_days";
type SortDirection = "asc" | "desc";
const TEXT_SORT: ReadonlySet<OzonSortKey> = new Set(["master_code", "ozon_product_id", "product_name", "offer_id"]);
const OZON_EXPANDED_KEY = "ozon-products-expanded";

function sortValue(product: OzonProductRow, column: OzonSortKey): string | number | null {
  if (column === "offer_id") {
    return (product.listings ?? [])
      .map(listing => listing.offer_id ?? "")
      .join(", ");
  }

  if (column === "ozon_product_id") {
    return (product.listings ?? [])
      .map(listing => listing.ozon_product_id ?? "")
      .join(", ");
  }

  return product[column];
}

function compareOzon(a: OzonProductRow, b: OzonProductRow, column: OzonSortKey, dir: SortDirection) {
  const av = sortValue(a, column);
  const bv = sortValue(b, column);
  if (av == null || av === "") return bv == null || bv === "" ? 0 : 1;
  if (bv == null || bv === "") return -1;
  const sign = dir === "asc" ? 1 : -1;
  return TEXT_SORT.has(column)
    ? String(av).localeCompare(String(bv), ["ru", "en"], { numeric: true, sensitivity: "base" }) * sign
    : (Number(av) - Number(bv)) * sign;
}

// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

function formatNumber(
  value:
    | number
    | null
    | undefined
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  return new Intl.NumberFormat(
    "ru-RU"
  ).format(
    value
  );

}


function formatDecimal(
  value:
    | number
    | null
    | undefined,

  digits:
    number =
      1
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  return new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        digits,
    }
  ).format(
    value
  );

}


// ============================================================
// КОМПОНЕНТ
// ============================================================

export default function OzonProductsTableClient({
  products,
  clusterRowsByMasterCode,
  calculationLabel,
}: Props) {

  const [
    expandedMasterCodes,
    setExpandedMasterCodes,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );


  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);

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
  const [sortKey, setSortKey] = useState<OzonSortKey>("sales_28_days");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
            OZON_EXPANDED_KEY,
            "1"
          );

        } catch {

          // Storage may be disabled.
        }

      } else {

        try {

          setExpanded(
            window.localStorage.getItem(
              OZON_EXPANDED_KEY
            ) ===
              "1"
          );

        } catch {

          // Storage may be disabled.
        }

      }

      setReady(
        true
      );

    },
    []
  );

  const sortedProducts = useMemo(
    () => products.map((item, index) => ({ item, index }))
      .sort((a, b) => compareOzon(a.item, b.item, sortKey, sortDirection) || a.index - b.index)
      .map(row => row.item),
    [products, sortKey, sortDirection]
  );


  useEffect(
    () => {

      if (
        !ready
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
            "[data-ozon-focus-key]"
          )
        ).find(
          element =>
            element.dataset
              .ozonFocusKey ===
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
      ready,
      sortedProducts,
    ]
  );

  function toggleTable() {
    setExpanded(previous => {
      const next = !previous;
      try { window.localStorage.setItem(OZON_EXPANDED_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  function SortHeading({ column, label, numeric = false }: {
    column: OzonSortKey;
    label: string;
    numeric?: boolean;
  }) {
    const active = sortKey === column;
    return (
      <th className={numeric ? "ozon-products-numeric-head" : undefined}
        aria-sort={!active ? "none" : sortDirection === "asc" ? "ascending" : "descending"}>
        <button type="button"
          className={active ? "ozon-products-sort-button ozon-products-sort-button--active" : "ozon-products-sort-button"}
          onClick={() => {
            if (active) setSortDirection(previous => previous === "asc" ? "desc" : "asc");
            else {
              setSortKey(column);
              setSortDirection(TEXT_SORT.has(column) ? "asc" : "desc");
            }
          }}>
          <span>{label}</span>
          {active && <span aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>}
        </button>
      </th>
    );
  }

  function toggleMasterCode(
    masterCode:
      string
  ) {

    setExpandedMasterCodes(
      previous => {

        const next =
          new Set(
            previous
          );


        if (
          next.has(
            masterCode
          )
        ) {

          next.delete(
            masterCode
          );

        } else {

          next.add(
            masterCode
          );

        }


        return next;

      }
    );

  }


  const normalizedClusterRows =
    useMemo(
      () => {

        const result:
          Record<
            string,
            OzonClusterDetailRow[]
          > =
          {};


        for (
          const [
            masterCode,
            rows,
          ]
          of Object.entries(
            clusterRowsByMasterCode
          )
        ) {

          result[
            masterCode
          ] =
            [
              ...rows,
            ].sort(
              (
                left,
                right
              ) => {

                const clusterCompare =
                  (
                    left.cluster_name
                    ??
                    ""
                  ).localeCompare(
                    right.cluster_name
                    ??
                    "",
                    "ru"
                  );


                if (
                  clusterCompare !==
                  0
                ) {

                  return clusterCompare;

                }


                const offerCompare =
                  (
                    left.offer_id
                    ??
                    ""
                  ).localeCompare(
                    right.offer_id
                    ??
                    "",
                    "ru"
                  );


                if (
                  offerCompare !==
                  0
                ) {

                  return offerCompare;

                }


                return (
                  left.cluster_id
                    .localeCompare(
                      right.cluster_id,
                      "ru"
                    )
                );

              }
            );

        }


        return result;

      },
      [
        clusterRowsByMasterCode,
      ]
    );


  return (
    <div className="ozon-products-collapsible">
      <button type="button" className="ozon-products-toggle"
        onClick={toggleTable} aria-expanded={expanded} aria-controls="ozon-products-table">
        <span className="ozon-products-toggle-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18M3 15h18M9 4v16M16 4v16" />
          </svg>
        </span>
        <span className="ozon-products-toggle-copy">
          <strong>Данные по товарам</strong>
          <span>Одна строка соответствует одному ЕНОТ. Раскрытие показывает размещения и кластеры.</span>
          {calculationLabel && <span className="ozon-products-calculation-label">{calculationLabel}</span>}
        </span>
      </button>
      {ready && expanded ? (
      <div id="ozon-products-table" className="ozon-products-table-content">
    <div className="ozon-products-table-shell ozon-products-scroll">

      <table
        className=
          "ozon-products-table ozon-products-sort-table"
      >

        <colgroup>
          <col className="ozon-products-col-master" />
          <col className="ozon-products-col-sku" />
          <col className="ozon-products-col-name" />
          <col className="ozon-products-col-offer" />
          <col className="ozon-products-col-number" />
          <col className="ozon-products-col-number" />
          <col className="ozon-products-col-number" />
          <col className="ozon-products-col-number" />
          <col className="ozon-products-col-number" />
        </colgroup>
        <thead><tr>
          <SortHeading column="master_code" label="ЕНОТ" />
          <SortHeading column="ozon_product_id" label="SKU" />
          <SortHeading column="product_name" label="Товар" />
          <SortHeading column="offer_id" label="Артикулы" />
          <SortHeading column="sales_28_days" label="Продажи 28 дн." numeric />
          <SortHeading column="average_sales_per_day" label="Среднее / день" numeric />
          <SortHeading column="cancelled_28_days" label="Отмены" numeric />
          <SortHeading column="stock_quantity" label="Остаток" numeric />
          <SortHeading column="stock_days" label="Дней запаса" numeric />
        </tr></thead>


        <tbody>

          {
            sortedProducts.map(
              (product, index) => {

                const masterCode =
                  product.master_code;


                const isExpanded =
                  expandedMasterCodes
                    .has(
                      masterCode
                    );


                const clusterRows =
                  normalizedClusterRows[
                    masterCode
                  ]
                  ??
                  [];


                const offers =
                  (
                    product.listings
                    ??
                    []
                  )
                    .map(
                      listing =>
                        listing.offer_id
                    )
                    .filter(
                      (
                        value
                      ):
                        value is string =>
                          Boolean(
                            value
                          )
                    )
                    .join(
                      ", "
                    );


                const skus =
                  Array.from(
                    new Set(
                      (
                        product.listings
                        ??
                        []
                      )
                        .map(
                          listing =>
                            listing.ozon_product_id
                        )
                        .filter(
                          value =>
                            value !==
                              null
                            &&
                            value !==
                              undefined
                        )
                        .map(
                          value =>
                            String(
                              value
                            )
                        )
                    )
                  )
                    .join(
                      ", "
                    );


                return (

                  <Fragment
                    key={
                      masterCode
                    }
                  >

                    <tr
                      className={
                        [
                          "ozon-products-master-row",

                          index % 2 ===
                            0

                            ? "ozon-products-row-odd"

                            : "ozon-products-row-even",

                          notificationFocus ===
                            masterCode

                            ? "ozon-products-master-row--notification-focus"

                            : "",
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            " "
                          )
                      }

                      data-ozon-focus-key={
                        masterCode
                      }
                    >

                      <TableCell>

                        <button
                          type="button"

                          onClick={
                            () =>
                              toggleMasterCode(
                                masterCode
                              )
                          }

                          aria-expanded={
                            isExpanded
                          }

                          className=
                            "ozon-products-master-button"
                        >

                          <span
                            className=
                              "ozon-products-chevron"
                          >
                            {
                              isExpanded
                                ? "▼"
                                : "▶"
                            }
                          </span>


                          <span
                            className=
                              "ozon-products-master-code"
                          >
                            {
                              masterCode
                            }
                          </span>

                        </button>

                      </TableCell>


                      <TableCell>
                        {
                          skus
                          ||
                          "—"
                        }
                      </TableCell>


                      <TableCell>

                        <div
                          className=
                            "ozon-products-product-name"
                        >
                          {
                            product
                              .product_name
                            ||
                            "—"
                          }
                        </div>


                        {
                          product.listing_count >
                          1

                            ? (

                              <div
                                className=
                                  "ozon-products-listing-count"
                              >
                                {
                                  product
                                    .listing_count
                                }{" "}
                                размещения
                              </div>

                            )

                            : null
                        }

                      </TableCell>


                      <TableCell>

                        <div
                          className=
                            "ozon-products-offers"
                        >
                          {
                            offers
                            ||
                            "—"
                          }
                        </div>

                      </TableCell>


                      <TableCell
                        align="right"
                      >

                        <strong>
                          {
                            formatNumber(
                              product
                                .sales_28_days
                            )
                          }
                        </strong>

                      </TableCell>


                      <TableCell
                        align="right"
                      >
                        {
                          formatDecimal(
                            product
                              .average_sales_per_day,
                            2
                          )
                        }
                      </TableCell>


                      <TableCell
                        align="right"
                      >
                        {
                          formatNumber(
                            product
                              .cancelled_28_days
                          )
                        }
                      </TableCell>


                      <TableCell
                        align="right"
                      >

                        <strong>
                          {
                            formatNumber(
                              product
                                .stock_quantity
                            )
                          }
                        </strong>

                      </TableCell>


                      <TableCell
                        align="right"

                        className={
                          notificationFocus ===
                            masterCode

                            ? "ozon-products-stock-days--notification-focus"

                            : undefined
                        }
                      >
                        {
                          formatDecimal(
                            product
                              .stock_days,
                            1
                          )
                        }
                      </TableCell>

                    </tr>


                    {
                      isExpanded

                        ? (

                          <tr>

                            <td
                              colSpan={
                                8
                              }

                              className=
                                "ozon-products-expanded-cell"
                            >

                              <div
                                className=
                                  "ozon-products-cluster-panel"
                              >

                                <div
                                  className=
                                    "ozon-products-cluster-heading"
                                >

                                  <div>

                                    <div
                                      className=
                                        "ozon-products-cluster-title"
                                    >
                                      Продажи и остатки по кластерам
                                    </div>


                                    <div
                                      className=
                                        "ozon-products-cluster-subtitle"
                                    >
                                      По конкретным Ozon-размещениям,
                                      без объединения SKU
                                      по master_code.
                                    </div>

                                  </div>


                                  <ClusterSummary
                                    rows={
                                      clusterRows
                                    }
                                  />

                                </div>


                                <div
                                  className=
                                    "ozon-cluster-table-shell"
                                >

                                  <table
                                    className=
                                      "ozon-cluster-table"
                                  >

                                    <thead>

                                      <tr>

                                        <ClusterHeader>
                                          Offer ID
                                        </ClusterHeader>

                                        <ClusterHeader>
                                          Ozon product ID
                                        </ClusterHeader>

                                        <ClusterHeader>
                                          Кластер
                                        </ClusterHeader>

                                        <ClusterHeader
                                          align="right"
                                        >
                                          Продажи 28 дн.
                                        </ClusterHeader>

                                        <ClusterHeader
                                          align="right"
                                        >
                                          Среднее / день
                                        </ClusterHeader>

                                        <ClusterHeader
                                          align="right"
                                        >
                                          Отмены
                                        </ClusterHeader>

                                        <ClusterHeader
                                          align="right"
                                        >
                                          Остаток
                                        </ClusterHeader>

                                        <ClusterHeader
                                          align="right"
                                        >
                                          Дней запаса
                                        </ClusterHeader>

                                      </tr>

                                    </thead>


                                    <tbody>

                                      {
                                        clusterRows.length ===
                                        0

                                          ? (

                                            <tr>

                                              <td
                                                colSpan={
                                                  8
                                                }

                                                className=
                                                  "ozon-cluster-empty"
                                              >
                                                Нет строк последнего
                                                расчёта FBO для этого товара.
                                              </td>

                                            </tr>

                                          )

                                          : (

                                            clusterRows.map(
                                              row => (

                                                <tr
                                                  key={
                                                    [
                                                      row.product_id,
                                                      row.cluster_id,
                                                    ].join(
                                                      "::"
                                                    )
                                                  }
                                                >

                                                  <ClusterCell>

                                                    <strong>
                                                      {
                                                        row.offer_id
                                                        ||
                                                        "—"
                                                      }
                                                    </strong>

                                                  </ClusterCell>


                                                  <ClusterCell>
                                                    {
                                                      row.ozon_product_id
                                                      ??
                                                      "—"
                                                    }
                                                  </ClusterCell>


                                                  <ClusterCell>
                                                    {
                                                      row.cluster_name
                                                      ||
                                                      "—"
                                                    }
                                                  </ClusterCell>


                                                  <ClusterCell
                                                    align="right"
                                                  >

                                                    <strong>
                                                      {
                                                        formatNumber(
                                                          row.sales_28_days
                                                        )
                                                      }
                                                    </strong>

                                                  </ClusterCell>


                                                  <ClusterCell
                                                    align="right"
                                                  >
                                                    {
                                                      formatDecimal(
                                                        row.average_sales_per_day,
                                                        2
                                                      )
                                                    }
                                                  </ClusterCell>


                                                  <ClusterCell
                                                    align="right"
                                                  >
                                                    {
                                                      formatNumber(
                                                        row.cancelled_28_days
                                                      )
                                                    }
                                                  </ClusterCell>


                                                  <ClusterCell
                                                    align="right"
                                                  >

                                                    <strong>
                                                      {
                                                        formatNumber(
                                                          row.stock_quantity
                                                        )
                                                      }
                                                    </strong>

                                                  </ClusterCell>


                                                  <ClusterCell
                                                    align="right"
                                                  >
                                                    {
                                                      formatDecimal(
                                                        row.stock_days,
                                                        1
                                                      )
                                                    }
                                                  </ClusterCell>

                                                </tr>

                                              )
                                            )

                                          )
                                      }

                                    </tbody>

                                  </table>

                                </div>

                              </div>

                            </td>

                          </tr>

                        )

                        : null
                    }

                  </Fragment>

                );

              }
            )
          }

        </tbody>

      </table>
    </div>
    </div>
    ) : null}
    </div>
  );
}


// ============================================================
// ИТОГИ РАСКРЫТИЯ
// ============================================================

function ClusterSummary({
  rows,
}: {
  rows:
    OzonClusterDetailRow[];
}) {

  const sales =
    rows.reduce(
      (
        sum,
        row
      ) =>
        sum
        +
        (
          row.sales_28_days
          ??
          0
        ),
      0
    );


  const stock =
    rows.reduce(
      (
        sum,
        row
      ) =>
        sum
        +
        (
          row.stock_quantity
          ??
          0
        ),
      0
    );


  return (

    <div
      className=
        "ozon-cluster-summary"
    >

      <span>
        Строк:{" "}
        <strong>
          {
            formatNumber(
              rows.length
            )
          }
        </strong>
      </span>


      <span>
        Продажи:{" "}
        <strong>
          {
            formatNumber(
              sales
            )
          }
        </strong>
      </span>


      <span>
        Остаток:{" "}
        <strong>
          {
            formatNumber(
              stock
            )
          }
        </strong>
      </span>

    </div>

  );

}


// ============================================================
// ОСНОВНАЯ ТАБЛИЦА
// ============================================================

function TableHeader({
  children,
  align = "left",
}: {
  children:
    ReactNode;

  align?:
    "left"
    |
    "right";
}) {

  return (

    <th
      className={
        align === "right"
          ? "ozon-table-right"
          : undefined
      }
    >
      {
        children
      }
    </th>

  );

}


function TableCell({
  children,
  align = "left",
  className,
}: {
  children:
    ReactNode;

  align?:
    "left"
    |
    "right";

  className?:
    string;
}) {

  return (

    <td
      className={
        [
          align ===
            "right"

            ? "ozon-table-right"

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
        ||
        undefined
      }
    >
      {
        children
      }
    </td>

  );

}


// ============================================================
// ВНУТРЕННЯЯ ТАБЛИЦА КЛАСТЕРОВ
// ============================================================

function ClusterHeader({
  children,
  align = "left",
}: {
  children:
    ReactNode;

  align?:
    "left"
    |
    "right";
}) {

  return (

    <th
      className={
        align === "right"
          ? "ozon-table-right"
          : undefined
      }
    >
      {
        children
      }
    </th>

  );

}


function ClusterCell({
  children,
  align = "left",
}: {
  children:
    ReactNode;

  align?:
    "left"
    |
    "right";
}) {

  return (

    <td
      className={
        align === "right"
          ? "ozon-table-right"
          : undefined
      }
    >
      {
        children
      }
    </td>

  );

}
