"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import WorkspaceCollapsiblePanel
from "./WorkspaceCollapsiblePanel";


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
    nmId:
      number
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
            "Введите ЕНОТ из 6 символов",
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
          "Не удалось привязать ЕНОТ"
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

              ? error.message

              : "Ошибка привязки",
        })
      );

    } finally {

      setLoadingNmId(
        null
      );

    }

  }


  return (

    <WorkspaceCollapsiblePanel
      tone="wildberries"
      icon="unlinked"
      title="Товары без ЕНОТ"
      subtitle="Новые товары Wildberries, которые система пока не смогла привязать к физическому товару."
      meta={
        `Требуют привязки: ${rows.length}`
      }
      className="wb-unmapped-section"
    >

      <div
        className=
          "wb-unmapped-table-shell"
      >

        <table
          className=
            "wb-unmapped-table"
        >

          <thead>

            <tr>

              <th>
                Артикул продавца
              </th>

              <th>
                Артикул WB
              </th>

              <th>
                Товар
              </th>

              <th>
                Впервые найден
              </th>

              <th>
                ЕНОТ
              </th>

              <th>
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
                          "wb-unmapped-article"
                      >

                        <strong>
                          {
                            row.sellerArticle
                            ||
                            "—"
                          }
                        </strong>

                      </td>


                      <td>
                        {
                          row.nmId
                        }
                      </td>


                      <td
                        className=
                          "wb-unmapped-product"
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

                            ? (

                              <div
                                className=
                                  "muted wb-unmapped-brand"
                              >
                                {
                                  row.brandName
                                }
                              </div>

                            )

                            : null
                        }

                      </td>


                      <td>
                        {
                          formatDateTime(
                            row.firstSeenAt
                          )
                        }
                      </td>


                      <td>

                        <div
                          className=
                            "wb-unmapped-master-wrap"
                        >

                          <input
                            type="text"

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


                                  void linkProduct(
                                    row.nmId
                                  );

                                }

                              }
                            }

                            className=
                              "wb-unmapped-input"
                          />


                          {
                            errors[
                              row.nmId
                            ]

                              ? (

                                <div
                                  className=
                                    "wb-unmapped-error"
                                >
                                  {
                                    errors[
                                      row.nmId
                                    ]
                                  }
                                </div>

                              )

                              : null
                          }

                        </div>

                      </td>


                      <td>

                        <button
                          type="button"

                          className=
                            "primary-button wb-unmapped-button"

                          disabled={
                            !valid
                            ||
                            loading
                          }

                          onClick={
                            () => {

                              void linkProduct(
                                row.nmId
                              );

                            }
                          }
                        >
                          {
                            loading

                              ? "Привязываем..."

                              : "Привязать"
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
          "wb-unmapped-hint"
      >
        Можно ввести существующий ЕНОТ
        или новый. После привязки товар исчезнет
        из этого списка и появится в обычной
        таблице товаров.
      </div>

    </WorkspaceCollapsiblePanel>

  );

}
