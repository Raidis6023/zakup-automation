"use client";

import {
  Fragment,
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
};


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

    <div
      className=
        "ozon-products-table-shell"
    >

      <table
        className=
          "ozon-products-table"
      >

        <thead>

          <tr>

            <TableHeader>
              master_code
            </TableHeader>

            <TableHeader>
              Товар
            </TableHeader>

            <TableHeader>
              Offer ID
            </TableHeader>

            <TableHeader
              align="right"
            >
              Продажи 28 дн.
            </TableHeader>

            <TableHeader
              align="right"
            >
              Среднее / день
            </TableHeader>

            <TableHeader
              align="right"
            >
              Отмены
            </TableHeader>

            <TableHeader
              align="right"
            >
              Остаток
            </TableHeader>

            <TableHeader
              align="right"
            >
              Дней запаса
            </TableHeader>

          </tr>

        </thead>


        <tbody>

          {
            products.map(
              product => {

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


                return (

                  <Fragment
                    key={
                      masterCode
                    }
                  >

                    <tr
                      className=
                        "ozon-products-master-row"
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
