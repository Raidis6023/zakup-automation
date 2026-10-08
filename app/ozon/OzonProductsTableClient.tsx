"use client";

import {
  Fragment,
  useMemo,
  useState,
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
    number = 1
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

export default function OzonProductsTableClient(
  {
    products,
    clusterRowsByMasterCode,
  }:
  Props
) {
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
    masterCode: string
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
                    ?? ""
                  )
                    .localeCompare(
                      right.cluster_name
                      ?? "",
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
                    ?? ""
                  )
                    .localeCompare(
                      right.offer_id
                      ?? "",
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
      style={{
        overflowX:
          "auto",

        marginTop:
          "18px",

        border:
          "1px solid var(--border-color, #e5e7eb)",

        borderRadius:
          "12px",
      }}
    >
      <table
        style={{
          width:
            "100%",

          borderCollapse:
            "collapse",

          minWidth:
            "1250px",
        }}
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

            <TableHeader align="right">
              Продажи 28 дн.
            </TableHeader>

            <TableHeader align="right">
              Среднее / день
            </TableHeader>

            <TableHeader align="right">
              Отмены
            </TableHeader>

            <TableHeader align="right">
              Остаток
            </TableHeader>

            <TableHeader align="right">
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
                  ?? [];

                const offers =
                  (
                    product.listings
                    ?? []
                  )
                    .map(
                      listing =>
                        listing.offer_id
                    )
                    .filter(
                      (
                        value
                      ): value is string =>
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

                    {/* =========================================
                        ОСНОВНАЯ СТРОКА MASTER_CODE
                        ========================================= */}

                    <tr>

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

                          style={{
                            display:
                              "inline-flex",

                            alignItems:
                              "center",

                            gap:
                              "7px",

                            padding:
                              0,

                            border:
                              "none",

                            background:
                              "transparent",

                            color:
                              "inherit",

                            cursor:
                              "pointer",

                            font:
                              "inherit",
                          }}
                        >

                          <span
                            style={{
                              display:
                                "inline-flex",

                              alignItems:
                                "center",

                              justifyContent:
                                "center",

                              width:
                                "14px",

                              fontSize:
                                "11px",

                              opacity:
                                0.8,
                            }}
                          >
                            {
                              isExpanded
                                ? "▼"
                                : "▶"
                            }
                          </span>


                          <span
                            style={{
                              fontFamily:
                                "monospace",

                              fontWeight:
                                700,

                              textDecoration:
                                "underline",
                            }}
                          >
                            {
                              masterCode
                            }
                          </span>

                        </button>

                      </TableCell>


                      <TableCell>

                        <div
                          style={{
                            fontWeight:
                              600,
                          }}
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
                                className="muted"

                                style={{
                                  marginTop:
                                    "4px",

                                  fontSize:
                                    "11px",
                                }}
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
                          style={{
                            maxWidth:
                              "360px",

                            wordBreak:
                              "break-word",
                          }}
                        >
                          {
                            offers
                            ||
                            "—"
                          }
                        </div>

                      </TableCell>


                      <TableCell align="right">

                        <strong>
                          {
                            formatNumber(
                              product
                                .sales_28_days
                            )
                          }
                        </strong>

                      </TableCell>


                      <TableCell align="right">

                        {
                          formatDecimal(
                            product
                              .average_sales_per_day,
                            2
                          )
                        }

                      </TableCell>


                      <TableCell align="right">

                        {
                          formatNumber(
                            product
                              .cancelled_28_days
                          )
                        }

                      </TableCell>


                      <TableCell align="right">

                        <strong>
                          {
                            formatNumber(
                              product
                                .stock_quantity
                            )
                          }
                        </strong>

                      </TableCell>


                      <TableCell align="right">

                        {
                          formatDecimal(
                            product
                              .stock_days,
                            1
                          )
                        }

                      </TableCell>

                    </tr>


                    {/* =========================================
                        РАСКРЫТИЕ:
                        ПРОДАЖИ + ОСТАТКИ ПО КЛАСТЕРАМ
                        ========================================= */}

                    {
                      isExpanded
                        ? (

                          <tr>

                            <td
                              colSpan={
                                8
                              }

                              style={{
                                padding:
                                  "0 12px 18px",

                                borderBottom:
                                  "1px solid var(--border-color, #eef0f2)",
                              }}
                            >

                              <div
                                style={{
                                  padding:
                                    "14px 30px 0",
                                }}
                              >

                                {/* =============================
                                    ЗАГОЛОВОК
                                    ============================= */}

                                <div
                                  style={{
                                    display:
                                      "flex",

                                    alignItems:
                                      "flex-start",

                                    justifyContent:
                                      "space-between",

                                    gap:
                                      "16px",

                                    flexWrap:
                                      "wrap",
                                  }}
                                >

                                  <div>

                                    <div
                                      style={{
                                        fontWeight:
                                          700,

                                        fontSize:
                                          "13px",
                                      }}
                                    >
                                      Продажи и остатки по кластерам
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


                                {/* =============================
                                    ТАБЛИЦА
                                    ============================= */}

                                <div
                                  style={{
                                    overflowX:
                                      "auto",

                                    marginTop:
                                      "14px",

                                    border:
                                      "1px solid var(--border-color, #d1d5db)",

                                    borderRadius:
                                      "11px",
                                  }}
                                >

                                  <table
                                    style={{
                                      width:
                                        "100%",

                                      minWidth:
                                        "1320px",

                                      borderCollapse:
                                        "collapse",
                                    }}
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

                                        <ClusterHeader align="right">
                                          Продажи 28 дн.
                                        </ClusterHeader>

                                        <ClusterHeader align="right">
                                          Среднее / день
                                        </ClusterHeader>

                                        <ClusterHeader align="right">
                                          Отмены
                                        </ClusterHeader>

                                        <ClusterHeader align="right">
                                          Остаток
                                        </ClusterHeader>

                                        <ClusterHeader align="right">
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

                                                style={{
                                                  padding:
                                                    "18px",

                                                  textAlign:
                                                    "center",

                                                  fontSize:
                                                    "12px",

                                                  opacity:
                                                    0.65,
                                                }}
                                              >
                                                Нет строк
                                                последнего расчёта FBO
                                                для этого товара.
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


                                                  <ClusterCell align="right">

                                                    <strong>
                                                      {
                                                        formatNumber(
                                                          row.sales_28_days
                                                        )
                                                      }
                                                    </strong>

                                                  </ClusterCell>


                                                  <ClusterCell align="right">

                                                    {
                                                      formatDecimal(
                                                        row.average_sales_per_day,
                                                        2
                                                      )
                                                    }

                                                  </ClusterCell>


                                                  <ClusterCell align="right">

                                                    {
                                                      formatNumber(
                                                        row.cancelled_28_days
                                                      )
                                                    }

                                                  </ClusterCell>


                                                  <ClusterCell align="right">

                                                    <strong>
                                                      {
                                                        formatNumber(
                                                          row.stock_quantity
                                                        )
                                                      }
                                                    </strong>

                                                  </ClusterCell>


                                                  <ClusterCell align="right">

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

function ClusterSummary(
  {
    rows,
  }:
  {
    rows:
      OzonClusterDetailRow[];
  }
) {
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
          ?? 0
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
          ?? 0
        ),
      0
    );


  return (
    <div
      style={{
        display:
          "flex",

        gap:
          "18px",

        flexWrap:
          "wrap",

        justifyContent:
          "flex-end",

        fontSize:
          "11px",
      }}
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

function TableHeader(
  {
    children,
    align = "left",
  }:
  {
    children:
      React.ReactNode;

    align?:
      "left"
      | "right";
  }
) {
  return (
    <th
      style={{
        padding:
          "12px 14px",

        textAlign:
          align,

        borderBottom:
          "1px solid var(--border-color, #e5e7eb)",

        fontSize:
          "12px",

        fontWeight:
          700,

        whiteSpace:
          "nowrap",

        opacity:
          0.75,
      }}
    >
      {children}
    </th>
  );
}


function TableCell(
  {
    children,
    align = "left",
  }:
  {
    children:
      React.ReactNode;

    align?:
      "left"
      | "right";
  }
) {
  return (
    <td
      style={{
        padding:
          "12px 14px",

        textAlign:
          align,

        borderBottom:
          "1px solid var(--border-color, #eef0f2)",

        fontSize:
          "13px",

        verticalAlign:
          "top",
      }}
    >
      {children}
    </td>
  );
}


// ============================================================
// ВНУТРЕННЯЯ ТАБЛИЦА КЛАСТЕРОВ
// ============================================================

function ClusterHeader(
  {
    children,
    align = "left",
  }:
  {
    children:
      React.ReactNode;

    align?:
      "left"
      | "right";
  }
) {
  return (
    <th
      style={{
        padding:
          "10px 12px",

        textAlign:
          align,

        borderBottom:
          "1px solid var(--border-color, #d1d5db)",

        fontSize:
          "11px",

        whiteSpace:
          "nowrap",

        fontWeight:
          700,

        opacity:
          0.75,
      }}
    >
      {children}
    </th>
  );
}


function ClusterCell(
  {
    children,
    align = "left",
  }:
  {
    children:
      React.ReactNode;

    align?:
      "left"
      | "right";
  }
) {
  return (
    <td
      style={{
        padding:
          "9px 12px",

        textAlign:
          align,

        borderBottom:
          "1px solid var(--border-color, #e5e7eb)",

        fontSize:
          "11px",

        verticalAlign:
          "middle",

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </td>
  );
}
