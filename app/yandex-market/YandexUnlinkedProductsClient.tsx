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

type RawYandexProduct = {
  offer?: {
    name?: string;
  };

  mapping?: {
    marketSkuName?: string;
  };
};


export type YandexUnlinkedProductRow = {
  id:
    number;

  offer_id:
    string;

  market_sku:
    | string
    | null;

  market_category_name:
    | string
    | null;

  first_seen_at:
    string;

  raw_data:
    | RawYandexProduct
    | null;
};


type ApiResponse = {
  ok?:
    boolean;

  error?:
    string;

  result?: {
    master_code?:
      string;

    master_code_existed_before?:
      boolean;

    created_new_master_code?:
      boolean;
  };
};


// ============================================================
// HELPERS
// ============================================================

function getProductName(
  product:
    YandexUnlinkedProductRow
):
string {

  const offerName =
    product
      .raw_data
      ?.offer
      ?.name
      ?.trim();


  if (
    offerName
  ) {

    return offerName;

  }


  const marketName =
    product
      .raw_data
      ?.mapping
      ?.marketSkuName
      ?.trim();


  if (
    marketName
  ) {

    return marketName;

  }


  return "—";

}


function formatDateTimeKrasnoyarsk(
  value:
    string
):
string {

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
      |
      null
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
    productId:
      number,

    value:
      string
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
    product:
      YandexUnlinkedProductRow
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


    if (
      !masterCode
    ) {

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
        (
          await response.json()
        ) as
          ApiResponse;


      if (
        !response.ok
        ||
        data.ok !==
          true
      ) {

        throw new Error(
          data.error
          ??
          "Не удалось привязать master_code"
        );

      }


      setRows(
        current =>
          current.filter(
            row =>
              row.id !==
              product.id
          )
      );


      setMasterCodes(
        current => {

          const next = {
            ...current,
          };


          delete next[
            product.id
          ];


          return next;

        }
      );


      router.refresh();

    } catch (
      error
    ) {

      setErrors(
        current => ({
          ...current,

          [product.id]:
            error instanceof Error

              ? error.message

              : String(
                  error
                ),
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
        className=
          "yandex-unlinked-empty"
      >
        Непривязанных товаров нет.
      </div>

    );

  }


  // ==========================================================
  // TABLE
  // ==========================================================

  return (

    <div
      className=
        "yandex-unlinked-client"
    >

      <div
        className=
          "yandex-unlinked-table-shell"
      >

        <table
          className=
            "yandex-unlinked-table"
        >

          <thead>

            <tr>

              <th>
                Артикул
              </th>

              <th>
                Product ID
              </th>

              <th>
                Товар
              </th>

              <th>
                Категория
              </th>

              <th>
                Впервые найден
              </th>

              <th>
                master_code
              </th>

              <th>
                Действие
              </th>

            </tr>

          </thead>


          <tbody>

            {
              rows.map(
                product => {

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

                      <td>

                        <strong>
                          {
                            product
                              .offer_id
                          }
                        </strong>

                      </td>


                      <td>
                        {
                          product
                            .market_sku
                          ??
                          "—"
                        }
                      </td>


                      <td
                        className=
                          "yandex-unlinked-product"
                      >
                        {
                          getProductName(
                            product
                          )
                        }
                      </td>


                      <td>
                        {
                          product
                            .market_category_name
                          ||
                          "—"
                        }
                      </td>


                      <td>
                        {
                          formatDateTimeKrasnoyarsk(
                            product
                              .first_seen_at
                          )
                        }
                      </td>


                      <td>

                        <div
                          className=
                            "yandex-unlinked-master-wrap"
                        >

                          <input
                            type="text"

                            value={
                              currentCode
                            }

                            onChange={
                              event =>
                                changeMasterCode(
                                  product.id,
                                  event
                                    .target
                                    .value
                                )
                            }

                            onKeyDown={
                              event => {

                                if (
                                  event.key ===
                                  "Enter"
                                ) {

                                  event
                                    .preventDefault();


                                  void assignMasterCode(
                                    product
                                  );

                                }

                              }
                            }

                            placeholder=
                              "Например, 01ABCD"

                            disabled={
                              submitting
                            }

                            autoComplete=
                              "off"

                            spellCheck={
                              false
                            }

                            className=
                              "yandex-unlinked-input"
                          />


                          {
                            error

                              ? (

                                <div
                                  className=
                                    "yandex-unlinked-error"
                                >
                                  {
                                    error
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
                            "secondary-button yandex-unlinked-button"

                          disabled={
                            submitting
                            ||
                            !currentCode
                              .trim()
                          }

                          onClick={
                            () =>
                              void assignMasterCode(
                                product
                              )
                          }
                        >
                          {
                            submitting

                              ? "Привязка..."

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
          "yandex-unlinked-hint"
      >
        Можно указать существующий master_code
        или ввести новый. Если введённого кода
        ещё нет, система создаст новый физический
        товар с этим master_code.
      </div>

    </div>

  );

}
