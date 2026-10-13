"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  useRouter,
} from "next/navigation";


export type OzonUnlinkedProductRow = {
  id: string;

  offer_id: string;

  ozon_product_id:
    | string
    | number
    | null;

  ozon_sku:
    | string
    | null;

  name:
    | string
    | null;

  first_seen_at: string;

  last_seen_at: string;
};


type Props = {
  products:
    OzonUnlinkedProductRow[];
};


type ApiResponse = {
  ok?:
    boolean;

  error?:
    string;

  result?: {
    master_code?:
      string;
  };
};


const MASTER_CODE_LENGTH =
  6;


// ============================================================
// MASTER CODE
// ============================================================

function normalizeMasterCode(
  value:
    string
):
  string {

  return value
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ""
    )
    .slice(
      0,
      MASTER_CODE_LENGTH
    );

}


function isValidMasterCode(
  value:
    string
):
  boolean {

  return /^[A-Z0-9]{6}$/.test(
    value
  );

}


// ============================================================
// ДАТА
// ============================================================

function formatDateTimeKrasnoyarsk(
  value:
    | string
    | null
    | undefined
) {

  if (!value) {

    return "—";

  }


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

export default function OzonUnlinkedProductsClient({
  products,
}: Props) {

  const router =
    useRouter();


  const [
    rows,
    setRows,
  ] =
    useState<
      OzonUnlinkedProductRow[]
    >(
      products
    );


  const [
    masterCodes,
    setMasterCodes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {}
    );


  const [
    busyId,
    setBusyId,
  ] =
    useState<
      string
      |
      null
    >(
      null
    );


  const [
    rowErrors,
    setRowErrors,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {}
    );


  const [
    successMessage,
    setSuccessMessage,
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

      setRows(
        products
      );

    },
    [
      products,
    ]
  );


  function setMasterCode(
    id:
      string,

    value:
      string
  ) {

    const normalizedValue =
      normalizeMasterCode(
        value
      );


    setMasterCodes(
      previous => ({
        ...previous,

        [id]:
          normalizedValue,
      })
    );


    setRowErrors(
      previous => {

        if (
          !previous[
            id
          ]
        ) {

          return previous;

        }


        const next = {
          ...previous,
        };


        delete next[
          id
        ];


        return next;

      }
    );


    setSuccessMessage(
      null
    );

  }


  async function assignMasterCode(
    row:
      OzonUnlinkedProductRow
  ) {

    const masterCode =
      normalizeMasterCode(
        masterCodes[
          row.id
        ]
        ??
        ""
      );


    if (
      !isValidMasterCode(
        masterCode
      )
    ) {

      setRowErrors(
        previous => ({
          ...previous,

          [row.id]:
            "master_code должен состоять ровно из 6 латинских букв или цифр",
        })
      );


      return;

    }


    setBusyId(
      row.id
    );


    setSuccessMessage(
      null
    );


    setRowErrors(
      previous => {

        const next = {
          ...previous,
        };


        delete next[
          row.id
        ];


        return next;

      }
    );


    try {

      const response =
        await fetch(
          "/api/ozon/unlinked/assign",
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
                  id:
                    row.id,

                  master_code:
                    masterCode,
                }
              ),
          }
        );


      const text =
        await response.text();


      let data:
        ApiResponse =
          {};


      if (text) {

        try {

          data =
            JSON.parse(
              text
            ) as
              ApiResponse;

        } catch {

          data = {
            ok:
              false,

            error:
              text,
          };

        }

      }


      if (
        !response.ok
        ||
        data.ok !==
          true
      ) {

        throw new Error(
          data.error
          ||
          `HTTP ${response.status}`
        );

      }


      setRows(
        previous =>
          previous.filter(
            item =>
              item.id !==
              row.id
          )
      );


      setMasterCodes(
        previous => {

          const next = {
            ...previous,
          };


          delete next[
            row.id
          ];


          return next;

        }
      );


      setSuccessMessage(
        `Товар ${row.offer_id} привязан к master_code ${masterCode}`
      );


      router.refresh();

    } catch (
      error
    ) {

      setRowErrors(
        previous => ({
          ...previous,

          [row.id]:

            error instanceof Error

              ? error.message

              : String(
                  error
                ),
        })
      );

    } finally {

      setBusyId(
        null
      );

    }

  }


  if (
    rows.length ===
    0
  ) {

    return (

      <div
        className=
          "ozon-unlinked-empty"
      >
        Непривязанных товаров Ozon нет.
      </div>

    );

  }


  return (

    <div
      className=
        "ozon-unlinked-client"
    >

      {
        successMessage

          ? (

            <div
              className=
                "ozon-unlinked-success"
            >
              {
                successMessage
              }
            </div>

          )

          : null
      }


      <div
        className=
          "ozon-unlinked-table-shell"
      >

        <table
          className=
            "ozon-unlinked-table"
        >

          <thead>

            <tr>

              <HeaderCell>
                Offer ID
              </HeaderCell>


              <HeaderCell>
                Ozon product ID
              </HeaderCell>


              <HeaderCell>
                SKU
              </HeaderCell>


              <HeaderCell>
                Товар
              </HeaderCell>


              <HeaderCell>
                Впервые найден
              </HeaderCell>


              <HeaderCell>
                master_code
              </HeaderCell>


              <HeaderCell>
                Действие
              </HeaderCell>

            </tr>

          </thead>


          <tbody>

            {
              rows.map(
                row => {

                  const currentMasterCode =
                    masterCodes[
                      row.id
                    ]
                    ??
                    "";


                  const isBusy =
                    busyId ===
                    row.id;


                  const masterCodeIsValid =
                    isValidMasterCode(
                      currentMasterCode
                    );


                  const rowError =
                    rowErrors[
                      row.id
                    ];


                  return (

                    <tr
                      key={
                        row.id
                      }
                    >

                      <Cell>

                        <strong>
                          {
                            row.offer_id
                          }
                        </strong>

                      </Cell>


                      <Cell>
                        {
                          row.ozon_product_id
                          ??
                          "—"
                        }
                      </Cell>


                      <Cell>
                        {
                          row.ozon_sku
                          ??
                          "—"
                        }
                      </Cell>


                      <Cell>
                        {
                          row.name
                          ??
                          "—"
                        }
                      </Cell>


                      <Cell>
                        {
                          formatDateTimeKrasnoyarsk(
                            row.first_seen_at
                          )
                        }
                      </Cell>


                      <Cell>

                        <div
                          className=
                            "ozon-unlinked-master-wrap"
                        >

                          <input
                            type="text"

                            value={
                              currentMasterCode
                            }

                            onChange={
                              event =>
                                setMasterCode(
                                  row.id,
                                  event.target.value
                                )
                            }

                            onKeyDown={
                              event => {

                                if (
                                  event.key ===
                                    "Enter"
                                  &&
                                  !isBusy
                                  &&
                                  masterCodeIsValid
                                ) {

                                  void assignMasterCode(
                                    row
                                  );

                                }

                              }
                            }

                            maxLength={
                              MASTER_CODE_LENGTH
                            }

                            autoCapitalize=
                              "characters"

                            autoComplete=
                              "off"

                            spellCheck={
                              false
                            }

                            placeholder=
                              "Например, 01ABCD"

                            disabled={
                              isBusy
                            }

                            className={
                              rowError

                                ? "ozon-unlinked-input ozon-unlinked-input--error"

                                : "ozon-unlinked-input"
                            }
                          />


                          {
                            rowError

                              ? (

                                <div
                                  className=
                                    "ozon-unlinked-error"
                                >
                                  {
                                    rowError
                                  }
                                </div>

                              )

                              : null
                          }

                        </div>

                      </Cell>


                      <Cell>

                        <button
                          type="button"

                          onClick={
                            () => {

                              void assignMasterCode(
                                row
                              );

                            }
                          }

                          disabled={
                            isBusy
                            ||
                            !masterCodeIsValid
                          }

                          className=
                            "ozon-unlinked-button"
                        >
                          {
                            isBusy

                              ? "Привязываю..."

                              : "Привязать"
                          }
                        </button>

                      </Cell>

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
          "ozon-unlinked-hint"
      >
        Можно ввести существующий master_code или новый.
        После привязки товар исчезнет из этого списка и будет
        участвовать в обычной синхронизации со следующего запуска.
      </div>

    </div>

  );

}


// ============================================================
// TABLE
// ============================================================

function HeaderCell({
  children,
}: {
  children:
    ReactNode;
}) {

  return (

    <th>
      {
        children
      }
    </th>

  );

}


function Cell({
  children,
}: {
  children:
    ReactNode;
}) {

  return (

    <td>
      {
        children
      }
    </td>

  );

}
