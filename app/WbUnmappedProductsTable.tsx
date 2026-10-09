"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


// ============================================================
// TYPES
// ============================================================

export type WbUnmappedProduct = {

  nmId:
    number;

  sellerArticle:
    string | null;

  productName:
    string | null;

  brandName:
    string | null;

  firstSeenAt:
    string | null;

  sales28Days:
    number;

  cancelled28Days:
    number;

  fbwStock:
    number;

};


type Props = {

  rows:
    WbUnmappedProduct[];

};


// ============================================================
// DATE
// ============================================================

function formatDateTime(
  value:
    string | null
) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(
      value
    );


  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {

    return "—";

  }


  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Asia/Krasnoyarsk",

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

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

export default function WbUnmappedProductsTable({
  rows,
}: Props) {

  const router =
    useRouter();


  const [
    values,
    setValues,
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
    loadingNmId,
    setLoadingNmId,
  ] =
    useState<
      number | null
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


  if (
    rows.length ===
    0
  ) {

    return null;

  }


  async function linkProduct(
    nmId: number
  ) {

    const masterCode =
      String(
        values[
          nmId
        ]
        ??
        ""
      )
        .trim()
        .toUpperCase();


    if (
      !/^[0-9A-Z]{6}$/.test(
        masterCode
      )
    ) {

      setErrors(
        current => ({
          ...current,

          [nmId]:
            "Введите master_code из 6 символов",
        })
      );

      return;

    }


    setLoadingNmId(
      nmId
    );


    setErrors(
      current => ({
        ...current,

        [nmId]:
          "",
      })
    );


    try {

      const response =
        await fetch(
          "/api/wb/link-master-code",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                nmId,
                masterCode,
              }),
          }
        );


      const data =
        await response.json();


      if (
        !response.ok
        ||
        !data?.ok
      ) {

        throw new Error(
          data?.message
          ??
          "Не удалось привязать master_code"
        );

      }


      router.refresh();

    } catch (
      error
    ) {

      setErrors(
        current => ({
          ...current,

          [nmId]:
            error instanceof Error
              ?
              error.message
              :
              "Ошибка привязки",
        })
      );

    } finally {

      setLoadingNmId(
        null
      );

    }

  }


  return (

    <section
      className=
        "section"
    >

      <div
        className=
          "section-header"
      >

        <div>

          <h2
            className=
              "section-title"
          >
            Товары без master_code
          </h2>


          <div
            className=
              "muted"
          >
            Новые товары Wildberries,
            которые система пока
            не смогла привязать
            к физическому товару.
          </div>


          <div
            className=
              "muted"

            style={{
              marginTop:
                "6px",
            }}
          >
            Они не участвуют
            в расчёте закупки
            до ручной привязки.
          </div>

        </div>


        <div
          style={{
            display:
              "inline-flex",

            alignItems:
              "center",

            padding:
              "7px 12px",

            borderRadius:
              "999px",

            background:
              "rgba(245, 120, 40, 0.12)",

            fontSize:
              "12px",

            fontWeight:
              700,

            whiteSpace:
              "nowrap",
          }}
        >
          Требуют привязки:{" "}
          {rows.length}
        </div>

      </div>


      <div
        className=
          "table-wrapper"
      >

        <table
          className=
            "table"

          style={{
            minWidth:
              "1180px",
          }}
        >

          <thead>

            <tr>

              <th
                className=
                  "left"
              >
                Артикул продавца
              </th>


              <th
                className=
                  "left"
              >
                Артикул WB
              </th>


              <th
                className=
                  "left"
              >
                Товар
              </th>


              <th
                className=
                  "left"
              >
                Впервые найден
              </th>


              <th
                className=
                  "left"
              >
                master_code
              </th>


              <th
                className=
                  "left"
              >
                Действие
              </th>

            </tr>

          </thead>


          <tbody>

            {
              rows.map(
                row => {

                  const value =
                    values[
                      row.nmId
                    ]
                    ??
                    "";


                  const normalized =
                    value
                      .trim()
                      .toUpperCase();


                  const valid =
                    /^[0-9A-Z]{6}$/.test(
                      normalized
                    );


                  const loading =
                    loadingNmId ===
                    row.nmId;


                  return (

                    <tr
                      key={
                        row.nmId
                      }
                    >

                      <td
                        className=
                          "left"

                        style={{
                          whiteSpace:
                            "normal",

                          minWidth:
                            "260px",
                        }}
                      >

                        <strong>
                          {
                            row.sellerArticle
                            ||
                            "—"
                          }
                        </strong>

                      </td>


                      <td
                        className=
                          "left"
                      >

                        {
                          row.nmId
                        }

                      </td>


                      <td
                        className=
                          "left"

                        style={{
                          whiteSpace:
                            "normal",

                          minWidth:
                            "300px",

                          maxWidth:
                            "500px",
                        }}
                      >

                        {
                          row.productName
                          ||
                          "—"
                        }


                        {
                          row.brandName
                          &&
                          row.brandName.trim()
                          &&
                          (
                            <div
                              className=
                                "muted"

                              style={{
                                marginTop:
                                  "4px",
                              }}
                            >
                              {
                                row.brandName
                              }
                            </div>
                          )
                        }

                      </td>


                      <td
                        className=
                          "left"
                      >

                        {
                          formatDateTime(
                            row.firstSeenAt
                          )
                        }

                      </td>


                      <td
                        className=
                          "left"
                      >

                        <div
                          style={{
                            minWidth:
                              "180px",
                          }}
                        >

                          <input
                            type=
                              "text"

                            value={
                              value
                            }

                            maxLength={
                              6
                            }

                            placeholder=
                              "Например, 01ABCD"

                            onChange={
                              event => {

                                const next =
                                  event
                                    .target
                                    .value
                                    .toUpperCase()
                                    .replace(
                                      /[^0-9A-Z]/g,
                                      ""
                                    )
                                    .slice(
                                      0,
                                      6
                                    );


                                setValues(
                                  current => ({
                                    ...current,

                                    [row.nmId]:
                                      next,
                                  })
                                );

                              }
                            }

                            onKeyDown={
                              event => {

                                if (
                                  event.key ===
                                    "Enter"
                                  &&
                                  valid
                                  &&
                                  !loading
                                ) {

                                  event.preventDefault();

                                  linkProduct(
                                    row.nmId
                                  );

                                }

                              }
                            }

                            style={{
                              width:
                                "170px",

                              height:
                                "38px",

                              padding:
                                "0 11px",

                              border:
                                "1px solid var(--border)",

                              borderRadius:
                                "8px",

                              background:
                                "var(--background)",

                              color:
                                "var(--text)",

                              font:
                                "inherit",

                              fontSize:
                                "13px",
                            }}
                          />


                          {
                            errors[
                              row.nmId
                            ]
                            &&
                            (
                              <div
                                style={{
                                  marginTop:
                                    "5px",

                                  maxWidth:
                                    "220px",

                                  fontSize:
                                    "11px",

                                  color:
                                    "#dc2626",

                                  whiteSpace:
                                    "normal",
                                }}
                              >
                                {
                                  errors[
                                    row.nmId
                                  ]
                                }
                              </div>
                            )
                          }

                        </div>

                      </td>


                      <td
                        className=
                          "left"
                      >

                        <button
                          type=
                            "button"

                          className=
                            "primary-button"

                          disabled={
                            !valid
                            ||
                            loading
                          }

                          onClick={
                            () =>
                              linkProduct(
                                row.nmId
                              )
                          }
                        >

                          {
                            loading
                              ?
                              "Привязываем..."
                              :
                              "Привязать"
                          }

                        </button>

                      </td>

                    </tr>

                  );

                }
              )
            }

          </tbody>

        </table>

      </div>


      <div
        className=
          "muted"

        style={{
          marginTop:
            "10px",

          fontSize:
            "11px",
        }}
      >
        Можно ввести существующий
        master_code или новый.
        После привязки товар исчезнет
        из этого списка и появится
        в обычной таблице товаров.
      </div>

    </section>

  );

}
