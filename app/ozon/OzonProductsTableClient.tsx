"use client";

import {
  Fragment,
  useState,
} from "react";


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


export type OzonClusterStockRow = {
  product_id: string;

  offer_id:
    | string
    | null;

  ozon_product_id:
    | string
    | number
    | null;

  listing_name:
    | string
    | null;

  cluster_id: string;

  cluster_name:
    | string
    | null;

  quantity: number;
};


export type OzonProductTableRow = {
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

  cluster_stocks:
    OzonClusterStockRow[];
};


type Props = {
  products:
    OzonProductTableRow[];
};


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


function MainCell(
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


function DetailHeader(
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
          "9px 12px",

        textAlign:
          align,

        borderBottom:
          "1px solid var(--border-color, #e5e7eb)",

        fontSize:
          "11px",

        fontWeight:
          700,

        opacity:
          0.72,

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </th>

  );
}


function DetailCell(
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
          "1px solid var(--border-color, #eef0f2)",

        fontSize:
          "12px",

        verticalAlign:
          "top",
      }}
    >
      {children}
    </td>

  );
}


export default function OzonProductsTableClient(
  {
    products,
  }:
  Props
) {

  const [
    expanded,
    setExpanded,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >(
      {}
    );


  function toggleProduct(
    masterCode: string
  ) {

    setExpanded(
      previous => ({
        ...previous,

        [masterCode]:
          !previous[
            masterCode
          ],
      })
    );

  }


  return (

    <>

      {
        products.map(
          product => {

            const isExpanded =
              Boolean(
                expanded[
                  product.master_code
                ]
              );


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


            const clusterRows =
              product.cluster_stocks
              ?? [];


            const clusterTotal =
              clusterRows.reduce(
                (
                  total,
                  row
                ) =>
                  total +
                  (
                    Number(
                      row.quantity
                    )
                    || 0
                  ),
                0
              );


            const totalsMatch =
              clusterTotal ===
              product.stock_quantity;


            return (

              <Fragment
                key={
                  product.master_code
                }
              >

                {/* ===================================
                    ОСНОВНАЯ СТРОКА ТОВАРА
                    =================================== */}

                <tr>

                  <MainCell>

                    <button
                      type="button"

                      onClick={
                        () =>
                          toggleProduct(
                            product.master_code
                          )
                      }

                      aria-expanded={
                        isExpanded
                      }

                      title={
                        isExpanded
                          ? "Скрыть остатки по кластерам"
                          : "Показать остатки по кластерам"
                      }

                      style={{
                        display:
                          "inline-flex",

                        alignItems:
                          "center",

                        gap:
                          "8px",

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

                        textAlign:
                          "left",
                      }}
                    >

                      <span
                        aria-hidden="true"

                        style={{
                          display:
                            "inline-flex",

                          alignItems:
                            "center",

                          justifyContent:
                            "center",

                          width:
                            "12px",

                          height:
                            "16px",

                          fontSize:
                            "13px",

                          opacity:
                            0.7,

                          transform:
                            isExpanded
                              ? "rotate(90deg)"
                              : "rotate(0deg)",

                          transition:
                            "transform 120ms ease",
                        }}
                      >
                        ▸
                      </span>


                      <span
                        style={{
                          fontFamily:
                            "monospace",

                          fontWeight:
                            700,
                        }}
                      >
                        {
                          product
                            .master_code
                        }
                      </span>

                    </button>

                  </MainCell>


                  <MainCell>

                    <div>
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

                  </MainCell>


                  <MainCell>

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

                  </MainCell>


                  <MainCell align="right">

                    <strong>
                      {
                        formatNumber(
                          product
                            .sales_28_days
                        )
                      }
                    </strong>

                  </MainCell>


                  <MainCell align="right">

                    {
                      formatDecimal(
                        product
                          .average_sales_per_day,
                        2
                      )
                    }

                  </MainCell>


                  <MainCell align="right">

                    {
                      formatNumber(
                        product
                          .cancelled_28_days
                      )
                    }

                  </MainCell>


                  <MainCell align="right">

                    <strong>
                      {
                        formatNumber(
                          product
                            .stock_quantity
                        )
                      }
                    </strong>

                  </MainCell>


                  <MainCell align="right">

                    {
                      formatDecimal(
                        product
                          .stock_days,
                        1
                      )
                    }

                  </MainCell>

                </tr>


                {/* ===================================
                    РАСКРЫТАЯ ДЕТАЛИЗАЦИЯ
                    =================================== */}

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
                              0,

                            borderBottom:
                              "1px solid var(--border-color, #eef0f2)",
                          }}
                        >

                          <div
                            style={{
                              padding:
                                "14px 18px 18px 42px",

                              background:
                                "rgba(127, 127, 127, 0.055)",
                            }}
                          >

                            <div
                              style={{
                                display:
                                  "flex",

                                justifyContent:
                                  "space-between",

                                alignItems:
                                  "center",

                                gap:
                                  "16px",

                                flexWrap:
                                  "wrap",

                                marginBottom:
                                  "10px",
                              }}
                            >

                              <div>

                                <div
                                  style={{
                                    fontSize:
                                      "12px",

                                    fontWeight:
                                      700,
                                  }}
                                >
                                  Остатки по кластерам
                                </div>


                                <div
                                  className="muted"

                                  style={{
                                    marginTop:
                                      "3px",

                                    fontSize:
                                      "11px",
                                  }}
                                >
                                  По конкретным Ozon-размещениям,
                                  без объединения SKU по master_code.
                                </div>

                              </div>


                              <div
                                style={{
                                  display:
                                    "flex",

                                  gap:
                                    "16px",

                                  alignItems:
                                    "center",

                                  flexWrap:
                                    "wrap",

                                  fontSize:
                                    "12px",
                                }}
                              >

                                <span>
                                  Строк:{" "}
                                  <strong>
                                    {
                                      formatNumber(
                                        clusterRows
                                          .length
                                      )
                                    }
                                  </strong>
                                </span>


                                <span>
                                  Итого:{" "}
                                  <strong>
                                    {
                                      formatNumber(
                                        clusterTotal
                                      )
                                    }
                                  </strong>
                                </span>


                                {
                                  clusterRows.length >
                                    0
                                  &&
                                  !totalsMatch
                                    ? (

                                      <span
                                        style={{
                                          color:
                                            "#b42318",

                                          fontWeight:
                                            700,
                                        }}
                                      >
                                        Не совпадает
                                        с общим остатком{" "}
                                        {
                                          formatNumber(
                                            product
                                              .stock_quantity
                                          )
                                        }
                                      </span>

                                    )
                                    : null
                                }

                              </div>

                            </div>


                            {
                              clusterRows.length ===
                              0
                                ? (

                                  <div
                                    className="muted"

                                    style={{
                                      padding:
                                        "12px 0",

                                      fontSize:
                                        "12px",
                                    }}
                                  >
                                    В текущем снимке нет
                                    строк остатков по кластерам
                                    для этого товара.
                                  </div>

                                )
                                : (

                                  <div
                                    style={{
                                      overflowX:
                                        "auto",

                                      border:
                                        "1px solid var(--border-color, #e5e7eb)",

                                      borderRadius:
                                        "10px",
                                    }}
                                  >

                                    <table
                                      style={{
                                        width:
                                          "100%",

                                        minWidth:
                                          "820px",

                                        borderCollapse:
                                          "collapse",
                                      }}
                                    >

                                      <thead>

                                        <tr>

                                          <DetailHeader>
                                            Offer ID
                                          </DetailHeader>

                                          <DetailHeader>
                                            Ozon product ID
                                          </DetailHeader>

                                          <DetailHeader>
                                            Кластер
                                          </DetailHeader>

                                          <DetailHeader>
                                            cluster_id
                                          </DetailHeader>

                                          <DetailHeader align="right">
                                            Остаток
                                          </DetailHeader>

                                        </tr>

                                      </thead>


                                      <tbody>

                                        {
                                          clusterRows.map(
                                            (
                                              row,
                                              index
                                            ) => (

                                              <tr
                                                key={
                                                  `${row.product_id}:${row.cluster_id}:${index}`
                                                }
                                              >

                                                <DetailCell>

                                                  <div
                                                    style={{
                                                      fontWeight:
                                                        600,
                                                    }}
                                                  >
                                                    {
                                                      row.offer_id
                                                      ||
                                                      "—"
                                                    }
                                                  </div>

                                                </DetailCell>


                                                <DetailCell>

                                                  {
                                                    row.ozon_product_id
                                                      !== null
                                                    &&
                                                    row.ozon_product_id
                                                      !== undefined
                                                      ? String(
                                                          row.ozon_product_id
                                                        )
                                                      : "—"
                                                  }

                                                </DetailCell>


                                                <DetailCell>

                                                  <strong>
                                                    {
                                                      row.cluster_name
                                                      ||
                                                      "Не определён"
                                                    }
                                                  </strong>

                                                </DetailCell>


                                                <DetailCell>

                                                  <span
                                                    style={{
                                                      fontFamily:
                                                        "monospace",

                                                      fontSize:
                                                        "11px",
                                                    }}
                                                  >
                                                    {
                                                      row.cluster_id
                                                    }
                                                  </span>

                                                </DetailCell>


                                                <DetailCell align="right">

                                                  <strong>
                                                    {
                                                      formatNumber(
                                                        row.quantity
                                                      )
                                                    }
                                                  </strong>

                                                </DetailCell>

                                              </tr>

                                            )
                                          )
                                        }

                                      </tbody>

                                    </table>

                                  </div>

                                )
                            }

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

    </>

  );
}
