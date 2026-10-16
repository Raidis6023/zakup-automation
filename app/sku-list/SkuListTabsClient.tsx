"use client";

import {
  useMemo,
  useState,
} from "react";


export type ProductArticleStatus =
  | "Активный"
  | "Неактивный"
  | "FBS"
  | "Выводится из продажи"
  | "Сезонный"
  | "В пути";


export type SkuListFinancialRow = {
  enot: string | null;
  status: ProductArticleStatus;
  sku: string | null;
  sellerArticle: string;
  productName: string | null;
  revenue: number;
  operatingProfit: number;
  purchases: number;
};


type MarketplaceTab =
  | "all"
  | "ozon"
  | "wildberries"
  | "yandex-market";


type SortKey =
  | "enot"
  | "status"
  | "sku"
  | "sellerArticle"
  | "productName"
  | "revenue"
  | "operatingProfit"
  | "purchases";


type SortDirection =
  | "asc"
  | "desc";


const STATUS_OPTIONS:
ReadonlyArray<ProductArticleStatus> = [
  "Активный",
  "Неактивный",
  "FBS",
  "Выводится из продажи",
  "Сезонный",
  "В пути",
];


const TEXT_SORT =
  new Set<SortKey>([
    "enot",
    "status",
    "sellerArticle",
    "productName",
  ]);


const moneyFormatter =
  new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        0,
    }
  );


const integerFormatter =
  new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        0,
    }
  );


function formatRubles(
  value: number
) {
  return (
    moneyFormatter.format(
      value
    )
    +
    " ₽"
  );
}


function formatInteger(
  value: number
) {
  return integerFormatter.format(
    value
  );
}


function sortValue(
  row: SkuListFinancialRow,
  key: SortKey
):
string | number | null {
  return row[
    key
  ];
}


function compareRows(
  left: SkuListFinancialRow,
  right: SkuListFinancialRow,
  key: SortKey,
  direction: SortDirection
) {
  const leftValue =
    sortValue(
      left,
      key
    );

  const rightValue =
    sortValue(
      right,
      key
    );

  if (
    leftValue ===
      null
    ||
    leftValue ===
      ""
  ) {
    return (
      rightValue ===
        null
      ||
      rightValue ===
        ""
    )

      ? 0

      : 1;
  }

  if (
    rightValue ===
      null
    ||
    rightValue ===
      ""
  ) {
    return -1;
  }

  const sign =
    direction ===
      "asc"

      ? 1

      : -1;

  if (
    TEXT_SORT.has(
      key
    )
  ) {
    return String(
      leftValue
    ).localeCompare(
      String(
        rightValue
      ),
      [
        "ru",
        "en",
      ],
      {
        numeric:
          true,

        sensitivity:
          "base",
      }
    )
    *
    sign;
  }

  return (
    Number(
      leftValue
    )
    -
    Number(
      rightValue
    )
  )
  *
  sign;
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

  const [
    rows,
    setRows,
  ] =
    useState<
      SkuListFinancialRow[]
    >(
      ozonRows
    );

  const [
    savingMasterCodes,
    setSavingMasterCodes,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      "operatingProfit"
    );

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      "desc"
    );

  const totals =
    useMemo(
      () =>
        rows.reduce(
          (
            accumulator,
            row
          ) => ({
            revenue:
              accumulator.revenue
              +
              row.revenue,

            operatingProfit:
              accumulator.operatingProfit
              +
              row.operatingProfit,

            purchases:
              accumulator.purchases
              +
              row.purchases,
          }),
          {
            revenue:
              0,

            operatingProfit:
              0,

            purchases:
              0,
          }
        ),
      [
        rows,
      ]
    );


  const sortedRows =
    useMemo(
      () =>
        rows
          .map(
            (
              row,
              index
            ) => ({
              row,
              index,
            })
          )
          .sort(
            (
              left,
              right
            ) =>
              compareRows(
                left.row,
                right.row,
                sortKey,
                sortDirection
              )
              ||
              left.index
              -
              right.index
          )
          .map(
            item =>
              item.row
          ),
      [
        rows,
        sortKey,
        sortDirection,
      ]
    );

  function handleSort(
    key: SortKey
  ) {
    if (
      sortKey ===
      key
    ) {
      setSortDirection(
        previous =>
          previous ===
            "asc"

            ? "desc"

            : "asc"
      );

      return;
    }

    setSortKey(
      key
    );

    setSortDirection(
      TEXT_SORT.has(
        key
      )

        ? "asc"

        : "desc"
    );
  }

  async function handleStatusChange(
    masterCode: string,
    nextStatus: ProductArticleStatus
  ) {
    const previousStatus =
      rows.find(
        row =>
          row.enot ===
          masterCode
      )?.status
      ??
      "Активный";

    setRows(
      previous =>
        previous.map(
          row =>
            row.enot ===
              masterCode

              ? {
                  ...row,
                  status:
                    nextStatus,
                }

              : row
        )
    );

    setSavingMasterCodes(
      previous => {
        const next =
          new Set(
            previous
          );

        next.add(
          masterCode
        );

        return next;
      }
    );

    try {
      const response =
        await fetch(
          "/api/sku-list/status",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                masterCode,
                status:
                  nextStatus,
              }),
          }
        );

      if (!response.ok) {
        throw new Error(
          "Не удалось сохранить статус"
        );
      }
    } catch (
      error
    ) {
      console.error(
        error
      );

      setRows(
        previous =>
          previous.map(
            row =>
              row.enot ===
                masterCode

                ? {
                    ...row,
                    status:
                      previousStatus,
                  }

                : row
          )
      );
    } finally {
      setSavingMasterCodes(
        previous => {
          const next =
            new Set(
              previous
            );

          next.delete(
            masterCode
          );

          return next;
        }
      );
    }
  }

  function SortHeading({
    column,
    label,
  }: {
    column:
      SortKey;

    label:
      string;
  }) {
    const active =
      sortKey ===
      column;

    return (
      <th
        aria-sort={
          !active

            ? "none"

            : sortDirection ===
                "asc"

              ? "ascending"

              : "descending"
        }
      >
        <button
          type="button"
          className={
            active

              ? "sku-list-sort-button sku-list-sort-button--active"

              : "sku-list-sort-button"
          }
          onClick={
            () =>
              handleSort(
                column
              )
          }
        >
          <span>
            {
              label
            }
          </span>

          {
            active

              ? (
                <span
                  className=
                    "sku-list-sort-arrow"
                  aria-hidden="true"
                >
                  {
                    sortDirection ===
                      "asc"

                      ? "↑"

                      : "↓"
                  }
                </span>
              )

              : null
          }
        </button>
      </th>
    );
  }

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
                  "sku-list-table-scroll"
              >
                <div
                  className=
                    "sku-list-table-inner"
                >
                  <div
                    className=
                      "sku-list-totals-strip"
                    aria-label=
                      "Итоги по Ozon"
                  >
                    <div
                      className=
                        "sku-list-totals-spacer"
                    />

                    <div
                      className=
                        "sku-list-total-cell sku-list-total-label"
                    >
                      ИТОГО
                    </div>

                    <div
                      className=
                        "sku-list-total-cell sku-list-total-value"
                    >
                      {
                        formatRubles(
                          totals.revenue
                        )
                      }
                    </div>

                    <div
                      className=
                        "sku-list-total-cell sku-list-total-value"
                    >
                      {
                        formatRubles(
                          totals.operatingProfit
                        )
                      }
                    </div>

                    <div
                      className=
                        "sku-list-total-cell sku-list-total-value"
                    >
                      {
                        formatRubles(
                          totals.purchases
                        )
                      }
                    </div>
                  </div>

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
                        "sku-list-col-status"
                    />

                    <col
                      className=
                        "sku-list-col-sku"
                    />

                    <col
                      className=
                        "sku-list-col-seller"
                    />

                    <col
                      className=
                        "sku-list-col-product"
                    />

                    <col
                      className=
                        "sku-list-col-number"
                    />

                    <col
                      className=
                        "sku-list-col-profit"
                    />

                    <col
                      className=
                        "sku-list-col-number"
                    />
                  </colgroup>

                  <thead>
                    <tr>
                      <SortHeading
                        column="enot"
                        label="ЕНОТ"
                      />

                      <SortHeading
                        column="status"
                        label="Статус"
                      />

                      <SortHeading
                        column="sku"
                        label="SKU"
                      />

                      <SortHeading
                        column="sellerArticle"
                        label="Артикул продавца"
                      />

                      <SortHeading
                        column="productName"
                        label="Товар"
                      />

                      <SortHeading
                        column="revenue"
                        label="Выручка, ₽"
                      />

                      <SortHeading
                        column="operatingProfit"
                        label="Операционная прибыль, ₽"
                      />

                      <SortHeading
                        column="purchases"
                        label="Выкупы, шт."
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {
                      sortedRows.map(
                        (
                          row,
                          index
                        ) => {
                          const masterCode =
                            row.enot
                            ??
                            "";

                          const saving =
                            masterCode
                            &&
                            savingMasterCodes.has(
                              masterCode
                            );

                          return (
                            <tr
                              key={
                                row.sellerArticle
                                +
                                "-"
                                +
                                index
                              }
                            >
                              <td
                                className=
                                  "sku-list-enot sku-list-compact-cell"
                              >
                                {
                                  row.enot
                                  ??
                                  "—"
                                }
                              </td>

                              <td
                                className=
                                  "sku-list-status-cell"
                              >
                                <div
                                  className=
                                    "sku-list-status-control"
                                  data-status={
                                    row.status
                                  }
                                >
                                  <select
                                    className=
                                      "sku-list-status-select"
                                    value={
                                      row.status
                                    }
                                    disabled={
                                      !masterCode
                                      ||
                                      Boolean(
                                        saving
                                      )
                                    }
                                    aria-label={
                                      "Статус "
                                      +
                                      (
                                        row.sellerArticle
                                      )
                                    }
                                    onChange={
                                      event => {
                                        if (
                                          !masterCode
                                        ) {
                                          return;
                                        }

                                        handleStatusChange(
                                          masterCode,
                                          event
                                            .target
                                            .value as
                                              ProductArticleStatus
                                        );
                                      }
                                    }
                                  >
                                    {
                                      STATUS_OPTIONS.map(
                                        option => (
                                          <option
                                            key={
                                              option
                                            }
                                            value={
                                              option
                                            }
                                          >
                                            {
                                              option
                                            }
                                          </option>
                                        )
                                      )
                                    }
                                  </select>
                                </div>
                              </td>

                              <td
                                className=
                                  "sku-list-sku sku-list-compact-cell"
                              >
                                {
                                  row.sku
                                  ??
                                  "—"
                                }
                              </td>

                              <td
                                className=
                                  "sku-list-text-cell"
                                title={
                                  row.sellerArticle
                                }
                              >
                                {
                                  row.sellerArticle
                                }
                              </td>

                              <td
                                className=
                                  "sku-list-text-cell"
                                title={
                                  row.productName
                                  ??
                                  undefined
                                }
                              >
                                {
                                  row.productName
                                  ??
                                  "—"
                                }
                              </td>

                              <td
                                className=
                                  "sku-list-number-cell"
                              >
                                {
                                  formatRubles(
                                    row.revenue
                                  )
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
                                  formatRubles(
                                    row.operatingProfit
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
                          );
                        }
                      )
                    }
                  </tbody>
                  </table>
                </div>
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
