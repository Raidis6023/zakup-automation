"use client";

import {
  useState,
  type ReactNode,
} from "react";

import {
  useRouter,
} from "next/navigation";


// ============================================================
// TYPES
// ============================================================

type RawYandexProduct = {
  offer?: {
    name?: string;
  };

  mapping?: {
    marketSkuName?: string;
  };
};


export type YandexUnlinkedProductRow = {
  id: number;

  offer_id: string;

  market_sku:
    | string
    | null;

  market_category_name:
    | string
    | null;

  first_seen_at: string;

  raw_data:
    | RawYandexProduct
    | null;
};


type ApiResponse = {
  ok?: boolean;

  error?: string;

  result?: {
    master_code?: string;

    master_code_existed_before?: boolean;

    created_new_master_code?: boolean;
  };
};


// ============================================================
// HELPERS
// ============================================================

function getProductName(
  product: YandexUnlinkedProductRow
): string {
  const offerName =
    product
      .raw_data
      ?.offer
      ?.name
      ?.trim();


  if (offerName) {
    return offerName;
  }


  const marketName =
    product
      .raw_data
      ?.mapping
      ?.marketSkuName
      ?.trim();


  if (marketName) {
    return marketName;
  }


  return "—";
}


function formatDateTimeKrasnoyarsk(
  value: string
): string {
  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }


  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Asia/Krasnoyarsk",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  ).format(
    date
  );
}


// ============================================================
// COMPONENT
// ============================================================

export default function YandexUnlinkedProductsClient({
  products,
}: {
  products:
    YandexUnlinkedProductRow[];
}) {
  const router =
    useRouter();


  const [
    rows,
    setRows,
  ] =
    useState<
      YandexUnlinkedProductRow[]
    >(
      products
    );


  const [
    masterCodes,
    setMasterCodes,
  ] =
    useState<
      Record<
        number,
        string
      >
    >(
      {}
    );


  const [
    submittingId,
    setSubmittingId,
  ] =
    useState<
      number
      | null
    >(
      null
    );


  const [
    errors,
    setErrors,
  ] =
    useState<
      Record<
        number,
        string
      >
    >(
      {}
    );


  // ==========================================================
  // INPUT
  // ==========================================================

  function changeMasterCode(
    productId: number,
    value: string
  ) {
    setMasterCodes(
      current => ({
        ...current,

        [productId]:
          value.toUpperCase(),
      })
    );


    setErrors(
      current => ({
        ...current,

        [productId]:
          "",
      })
    );
  }


  // ==========================================================
  // ASSIGN
  // ==========================================================

  async function assignMasterCode(
    product: YandexUnlinkedProductRow
  ) {
    const masterCode =
      (
        masterCodes[
          product.id
        ]
        ??
        ""
      )
        .trim()
        .toUpperCase();


    if (!masterCode) {
      setErrors(
        current => ({
          ...current,

          [product.id]:
            "Введите master_code",
        })
      );

      return;
    }


    setSubmittingId(
      product.id
    );


    setErrors(
      current => ({
        ...current,

        [product.id]:
          "",
      })
    );


    try {
      const response =
        await fetch(
          "/api/yandex/products/assign-master-code",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  yandexProductId:
                    product.id,

                  masterCode,
                }
              ),
          }
        );


      const data =
        (await response.json()) as ApiResponse;


      if (
        !response.ok
        ||
        data.ok !== true
      ) {
        throw new Error(
          data.error
          ??
          "Не удалось привязать master_code"
        );
      }


      // ======================================================
      // УБИРАЕМ ТОВАР ИЗ СПИСКА
      // ======================================================

      setRows(
        current =>
          current.filter(
            row =>
              row.id !==
              product.id
          )
      );


      // ======================================================
      // ОЧИЩАЕМ INPUT
      // ======================================================

      setMasterCodes(
        current => {
          const next =
            {
              ...current,
            };


          delete next[
            product.id
          ];


          return next;
        }
      );


      // ======================================================
      // ОБНОВЛЯЕМ СЕРВЕРНУЮ СТРАНИЦУ
      // ======================================================

      router.refresh();

    } catch (error) {
      setErrors(
        current => ({
          ...current,

          [product.id]:
            error instanceof Error
              ? error.message
              : String(error),
        })
      );

    } finally {
      setSubmittingId(
        null
      );
    }
  }


  // ==========================================================
  // EMPTY
  // ==========================================================

  if (
    rows.length ===
    0
  ) {
    return (
      <div
        className="reason-text"

        style={{
          marginTop:
            "16px",
        }}
      >
        Непривязанных товаров нет.
      </div>
    );
  }


  // ==========================================================
  // TABLE
  // ==========================================================

  return (
    <>

      <div
        style={{
          marginTop:
            "18px",

          overflowX:
            "auto",

          border:
            "1px solid var(--table-divider, #282e38)",

          borderRadius:
            "10px",
        }}
      >

        <table
          style={{
            width:
              "100%",

            minWidth:
              "1180px",

            borderCollapse:
              "separate",

            borderSpacing:
              0,
          }}
        >

          <thead>

            <tr
              style={{
                background:
                  "var(--table-header-bg, #1b2028)",
              }}
            >

              <TableHeader>
                Артикул
              </TableHeader>


              <TableHeader>
                Product ID
              </TableHeader>


              <TableHeader>
                Товар
              </TableHeader>


              <TableHeader>
                Категория
              </TableHeader>


              <TableHeader>
                Впервые найден
              </TableHeader>


              <TableHeader>
                master_code
              </TableHeader>


              <TableHeader>
                Действие
              </TableHeader>

            </tr>

          </thead>


          <tbody>

            {
              rows.map(
                (
                  product,
                  index
                ) => {
                  const isLast =
                    index ===
                    rows.length - 1;


                  const divider =
                    isLast
                      ? "none"
                      : "1px solid var(--table-divider, #282e38)";


                  const currentCode =
                    masterCodes[
                      product.id
                    ]
                    ??
                    "";


                  const submitting =
                    submittingId ===
                    product.id;


                  const error =
                    errors[
                      product.id
                    ]
                    ??
                    "";


                  return (
                    <tr
                      key={
                        product.id
                      }
                    >

                      <TableCell
                        divider=
                          {divider}

                        strong
                      >
                        {
                          product
                            .offer_id
                        }
                      </TableCell>


                      <TableCell
                        divider=
                          {divider}

                        nowrap
                      >
                        {
                          product
                            .market_sku
                          ??
                          "—"
                        }
                      </TableCell>


                      <TableCell
                        divider=
                          {divider}
                      >
                        {
                          getProductName(
                            product
                          )
                        }
                      </TableCell>


                      <TableCell
                        divider=
                          {divider}
                      >
                        {
                          product
                            .market_category_name
                          ||
                          "—"
                        }
                      </TableCell>


                      <TableCell
                        divider=
                          {divider}

                        nowrap
                      >
                        {
                          formatDateTimeKrasnoyarsk(
                            product
                              .first_seen_at
                          )
                        }
                      </TableCell>


                      <TableCell
                        divider=
                          {divider}
                      >

                        <div
                          style={{
                            display:
                              "flex",

                            flexDirection:
                              "column",

                            gap:
                              "6px",
                          }}
                        >

                          <input
                            type="text"

                            value=
                              {
                                currentCode
                              }

                            onChange=
                              {
                                event =>
                                  changeMasterCode(
                                    product.id,
                                    event
                                      .target
                                      .value
                                  )
                              }

                            onKeyDown=
                              {
                                event => {
                                  if (
                                    event.key ===
                                    "Enter"
                                  ) {
                                    event.preventDefault();

                                    void assignMasterCode(
                                      product
                                    );
                                  }
                                }
                              }

                            placeholder=
                              "Например, 01ABCD"

                            disabled=
                              {submitting}

                            autoComplete=
                              "off"

                            spellCheck=
                              {false}

                            style={{
                              width:
                                "190px",

                              boxSizing:
                                "border-box",

                              padding:
                                "9px 10px",

                              borderRadius:
                                "9px",

                              border:
                                "1px solid var(--table-divider, #586170)",

                              background:
                                "var(--input-bg, #11151b)",

                              color:
                                "inherit",

                              fontFamily:
                                "inherit",

                              fontSize:
                                "13px",

                              outline:
                                "none",
                            }}
                          />


                          {
                            error
                              ? (
                                <div
                                  style={{
                                    maxWidth:
                                      "220px",

                                    color:
                                      "#f04438",

                                    fontSize:
                                      "11px",

                                    lineHeight:
                                      1.35,
                                  }}
                                >
                                  {error}
                                </div>
                              )
                              : null
                          }

                        </div>

                      </TableCell>


                      <TableCell
                        divider=
                          {divider}

                        nowrap
                      >

                        <button
                          type="button"

                          className=
                            "secondary-button"

                          disabled=
                            {
                              submitting
                              ||
                              !currentCode
                                .trim()
                            }

                          onClick=
                            {
                              () =>
                                void assignMasterCode(
                                  product
                                )
                            }

                          style={{
                            minWidth:
                              "105px",

                            opacity:
                              (
                                submitting
                                ||
                                !currentCode
                                  .trim()
                              )
                                ? 0.55
                                : 1,

                            cursor:
                              (
                                submitting
                                ||
                                !currentCode
                                  .trim()
                              )
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {
                            submitting
                              ? "Привязка..."
                              : "Привязать"
                          }
                        </button>

                      </TableCell>

                    </tr>
                  );
                }
              )
            }

          </tbody>

        </table>

      </div>


      <div
        className="muted"

        style={{
          marginTop:
            "10px",

          fontSize:
            "11px",

          lineHeight:
            1.5,
        }}
      >
        Можно указать существующий
        master_code или ввести новый.
        Если введённого кода ещё нет,
        система создаст новый физический
        товар с этим master_code.
      </div>

    </>
  );
}


// ============================================================
// TABLE HEADER
// ============================================================

function TableHeader({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <th
      style={{
        padding:
          "12px 14px",

        textAlign:
          "left",

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
// TABLE CELL
// ============================================================

function TableCell({
  children,
  divider,
  strong = false,
  nowrap = false,
}: {
  children:
    ReactNode;

  divider:
    string;

  strong?: boolean;

  nowrap?: boolean;
}) {
  return (
    <td
      style={{
        padding:
          "11px 14px",

        border:
          "none",

        borderBottom:
          divider,

        verticalAlign:
          "top",

        fontSize:
          "12px",

        fontWeight:
          strong
            ? 700
            : 500,

        whiteSpace:
          nowrap
            ? "nowrap"
            : "normal",
      }}
    >
      {children}
    </td>
  );
}
