"use client";

import {
  useMemo,
  useState,
} from "react";


export type SkuListFinancialRow = {
  enot: string | null;
  article: string;
  operatingProfit: number;
  revenue: number;
  purchases: number;
};


type MarketplaceTab =
  | "all"
  | "ozon"
  | "wildberries"
  | "yandex-market";


function formatMoney(
  value:
    number
) {

  return new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        2,
    }
  ).format(
    value
  );

}


function formatInteger(
  value:
    number
) {

  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        0,
    }
  ).format(
    value
  );

}


export default function SkuListTabsClient({
  ozonRows,
}: {
  ozonRows:
    SkuListFinancialRow[];
}) {

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<MarketplaceTab>(
      "ozon"
    );


  const unmatchedCount =
    useMemo(
      () =>
        ozonRows.filter(
          row =>
            !row.enot
        ).length,
      [
        ozonRows,
      ]
    );


  return (

    <section
      className=
        "sku-list-data-section"
    >

      <div
        className=
          "sku-list-tabs"

        role="tablist"

        aria-label=
          "Маркетплейс"
      >

        <button
          type="button"

          role="tab"

          aria-selected={
            activeTab ===
              "all"
          }

          className={
            activeTab ===
              "all"

              ? "sku-list-tab sku-list-tab--all sku-list-tab--active"

              : "sku-list-tab sku-list-tab--all"
          }

          onClick={
            () =>
              setActiveTab(
                "all"
              )
          }
        >
          Все МП
        </button>


        <button
          type="button"

          role="tab"

          aria-selected={
            activeTab ===
              "ozon"
          }

          className={
            activeTab ===
              "ozon"

              ? "sku-list-tab sku-list-tab--ozon sku-list-tab--active"

              : "sku-list-tab sku-list-tab--ozon"
          }

          onClick={
            () =>
              setActiveTab(
                "ozon"
              )
          }
        >
          Ozon
        </button>


        <button
          type="button"

          role="tab"

          aria-selected={
            activeTab ===
              "wildberries"
          }

          className={
            activeTab ===
              "wildberries"

              ? "sku-list-tab sku-list-tab--wildberries sku-list-tab--active"

              : "sku-list-tab sku-list-tab--wildberries"
          }

          onClick={
            () =>
              setActiveTab(
                "wildberries"
              )
          }
        >
          WB
        </button>


        <button
          type="button"

          role="tab"

          aria-selected={
            activeTab ===
              "yandex-market"
          }

          className={
            activeTab ===
              "yandex-market"

              ? "sku-list-tab sku-list-tab--yandex sku-list-tab--active"

              : "sku-list-tab sku-list-tab--yandex"
          }

          onClick={
            () =>
              setActiveTab(
                "yandex-market"
              )
          }
        >
          Яндекс Маркет
        </button>

      </div>


      {
        activeTab ===
          "ozon"

          ? (

            <div
              className=
                "sku-list-table-card"
            >

              <div
                className=
                  "sku-list-table-meta"
              >

                <span>
                  Ozon · {
                    formatInteger(
                      ozonRows.length
                    )
                  } позиций
                </span>


                {
                  unmatchedCount >
                  0

                    ? (

                      <span
                        className=
                          "sku-list-unmatched"
                      >
                        Без ЕНОТ: {
                          formatInteger(
                            unmatchedCount
                          )
                        }
                      </span>

                    )

                    : null
                }

              </div>


              <div
                className=
                  "sku-list-table-scroll"
              >

                <table
                  className=
                    "sku-list-table"
                >

                  <colgroup>

                    <col
                      className=
                        "sku-list-col-enot"
                    />

                    <col
                      className=
                        "sku-list-col-article"
                    />

                    <col
                      className=
                        "sku-list-col-money"
                    />

                    <col
                      className=
                        "sku-list-col-money"
                    />

                    <col
                      className=
                        "sku-list-col-purchases"
                    />

                  </colgroup>


                  <thead>

                    <tr>

                      <th>
                        ЕНОТ
                      </th>

                      <th>
                        Артикул
                      </th>

                      <th
                        className=
                          "sku-list-number-cell"
                      >
                        Операционная прибыль, ₽
                      </th>

                      <th
                        className=
                          "sku-list-number-cell"
                      >
                        Выручка, ₽
                      </th>

                      <th
                        className=
                          "sku-list-number-cell"
                      >
                        Выкупы, шт.
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {
                      ozonRows.map(
                        (
                          row,
                          index
                        ) => (

                          <tr
                            key={
                              `${row.article}-${index}`
                            }
                          >

                            <td
                              className={
                                row.enot

                                  ? "sku-list-enot"

                                  : "sku-list-enot sku-list-enot--missing"
                              }
                            >
                              {
                                row.enot
                                ??
                                "—"
                              }
                            </td>


                            <td
                              className=
                                "sku-list-article"
                            >
                              {
                                row.article
                              }
                            </td>


                            <td
                              className={
                                row.operatingProfit <
                                0

                                  ? "sku-list-number-cell sku-list-profit-negative"

                                  : "sku-list-number-cell"
                              }
                            >
                              {
                                formatMoney(
                                  row.operatingProfit
                                )
                              }
                            </td>


                            <td
                              className=
                                "sku-list-number-cell"
                            >
                              {
                                formatMoney(
                                  row.revenue
                                )
                              }
                            </td>


                            <td
                              className=
                                "sku-list-number-cell"
                            >
                              {
                                formatInteger(
                                  row.purchases
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

          : (

            <div
              className=
                "sku-list-empty-tab"

              aria-live="polite"
            >
              Данные для этого раздела пока не добавлены.
            </div>

          )
      }

    </section>

  );

}
