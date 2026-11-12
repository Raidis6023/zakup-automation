"use client";

import { ChoiceField } from "@/app/ui/WorkspaceDateFields";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
  searchIndex?: string;
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


type TotalsLayout = {
  left: number;
  revenueWidth: number;
  profitWidth: number;
  purchasesWidth: number;
};


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


function buildAllMarketplaceRows(
  ozonRows: SkuListFinancialRow[],
  wildberriesRows: SkuListFinancialRow[],
  yandexRows: SkuListFinancialRow[]
):
SkuListFinancialRow[] {
  const byEnot =
    new Map<
      string,
      SkuListFinancialRow
    >();

  const sources = [
    ozonRows,
    wildberriesRows,
    yandexRows,
  ];

  const unlinkedRows: SkuListFinancialRow[] = [];

  for (
    const source
    of sources
  ) {
    for (
      const row
      of source
    ) {
      if (!row.enot) {
        unlinkedRows.push({
          ...row,
          sku: null,
          productName: row.productName ?? row.sellerArticle,
        });
        continue;
      }

      const current =
        byEnot.get(
          row.enot
        );

      if (!current) {
        byEnot.set(
          row.enot,
          {
            enot:
              row.enot,

            status:
              row.status,

            sku:
              null,

            sellerArticle:
              row.enot,

            productName:
              row.productName,
            searchIndex: [row.sellerArticle, row.sku, row.productName]
              .filter(Boolean).join(" "),

            revenue:
              row.revenue,

            operatingProfit:
              row.operatingProfit,

            purchases:
              row.purchases,
          }
        );

        continue;
      }

      current.searchIndex = [current.searchIndex, row.sellerArticle, row.sku, row.productName]
        .filter(Boolean).join(" ");

      current.revenue +=
        row.revenue;

      current.operatingProfit +=
        row.operatingProfit;

      current.purchases +=
        row.purchases;

      if (
        !current.productName
        &&
        row.productName
      ) {
        current.productName =
          row.productName;
      }
    }
  }

  return [
    ...Array.from(
      byEnot.values()
    ),
    ...unlinkedRows,
  ];
}


export default function SkuListTabsClient({
  ozonRows,
  ozonOctoberRows,
  wildberriesRows,
  wildberriesOctoberRows,
  yandexRows,
  yandexOctoberRows,
}: {
  ozonRows:
    SkuListFinancialRow[];

  ozonOctoberRows:
    SkuListFinancialRow[];

  wildberriesRows:
    SkuListFinancialRow[];

  wildberriesOctoberRows:
    SkuListFinancialRow[];

  yandexRows:
    SkuListFinancialRow[];

  yandexOctoberRows:
    SkuListFinancialRow[];
}) {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<MarketplaceTab>(
      "all"
    );

  const [selectedYear, setSelectedYear] =
    useState("2026");

  const [selectedMonth, setSelectedMonth] =
    useState("09");

  const [statusOverrides, setStatusOverrides] =
    useState<Record<string, ProductArticleStatus>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductArticleStatus | "all">("all");

  useEffect(() => {
    // A filter from one marketplace should not silently hide rows in another.
    setStatusFilter("all");
  }, [activeTab]);

  const periodMarketplaceRows = useMemo(
    () => {
      if (
        selectedYear === "2026"
        && selectedMonth === "10"
      ) {
        return {
          ozon: ozonOctoberRows,
          wildberries: wildberriesOctoberRows,
          yandexMarket: yandexOctoberRows,
        };
      }

      return {
        ozon: ozonRows,
        wildberries: wildberriesRows,
        yandexMarket: yandexRows,
      };
    },
    [
      selectedYear,
      selectedMonth,
      ozonRows,
      ozonOctoberRows,
      wildberriesRows,
      wildberriesOctoberRows,
      yandexRows,
      yandexOctoberRows,
    ]
  );

  const marketplaceRows = useMemo(
    () => {
      const applyStatusOverrides = (
        source: SkuListFinancialRow[]
      ) => source.map(row =>
        row.enot && statusOverrides[row.enot]
          ? {
              ...row,
              status: statusOverrides[row.enot],
            }
          : row
      );

      return {
        ozon: applyStatusOverrides(periodMarketplaceRows.ozon),
        wildberries: applyStatusOverrides(periodMarketplaceRows.wildberries),
        yandexMarket: applyStatusOverrides(periodMarketplaceRows.yandexMarket),
      };
    },
    [
      periodMarketplaceRows,
      statusOverrides,
    ]
  );


  const allMarketplaceRows =
    useMemo(
      () =>
        buildAllMarketplaceRows(
          marketplaceRows.ozon,
          marketplaceRows.wildberries,
          marketplaceRows.yandexMarket
        ),
      [
        marketplaceRows,
      ]
    );


  const tableActive =
    activeTab ===
      "all"
    ||
    activeTab ===
      "ozon"
    ||
    activeTab ===
      "wildberries"
    ||
    activeTab ===
      "yandex-market";


  const rows =
    activeTab ===
      "all"

      ? allMarketplaceRows

      : activeTab ===
          "wildberries"

        ? marketplaceRows
            .wildberries

        : activeTab ===
            "yandex-market"

          ? marketplaceRows
              .yandexMarket

          : marketplaceRows
              .ozon;

  const filteredRows = useMemo(() => {
    const terms = searchQuery.trim().toLocaleLowerCase("ru-RU")
      .replaceAll("ё", "е").split(/\s+/).filter(Boolean);
    return rows.filter(row => {
      if (activeTab !== "all" && statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!terms.length) return true;
      const text = [row.enot, row.sku, row.sellerArticle, row.productName, row.searchIndex]
        .filter(Boolean).join(" ").toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
      return terms.every(term => text.includes(term));
    });
  }, [rows, activeTab, searchQuery, statusFilter]);

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

  const tableShellRef =
    useRef<HTMLDivElement>(
      null
    );


  const tableScrollRef =
    useRef<HTMLDivElement>(
      null
    );


  const [
    totalsLayout,
    setTotalsLayout,
  ] =
    useState<TotalsLayout | null>(
      null
    );


  const measureTotals =
    useCallback(
      () => {
        const shell =
          tableShellRef.current;

        const scroll =
          tableScrollRef.current;

        if (
          !shell
          ||
          !scroll
        ) {
          return;
        }

        const revenueHeader =
          scroll.querySelector<HTMLElement>(
            '[data-sku-column="revenue"]'
          );

        const profitHeader =
          scroll.querySelector<HTMLElement>(
            '[data-sku-column="operatingProfit"]'
          );

        const purchasesHeader =
          scroll.querySelector<HTMLElement>(
            '[data-sku-column="purchases"]'
          );

        if (
          !revenueHeader
          ||
          !profitHeader
          ||
          !purchasesHeader
        ) {
          return;
        }

        const shellRect =
          shell.getBoundingClientRect();

        const revenueRect =
          revenueHeader.getBoundingClientRect();

        const profitRect =
          profitHeader.getBoundingClientRect();

        const purchasesRect =
          purchasesHeader.getBoundingClientRect();

        const previousHeader =
          revenueHeader.previousElementSibling;

        const dividerWidth =
          previousHeader

            ? (
                Number.parseFloat(
                  window
                    .getComputedStyle(
                      previousHeader
                    )
                    .borderRightWidth
                )
                ||
                0
              )

            : 0;

        setTotalsLayout({
          left:
            revenueRect.left
            -
            shellRect.left
            -
            72
            -
            dividerWidth,

          revenueWidth:
            profitRect.left
            -
            revenueRect.left,

          profitWidth:
            purchasesRect.left
            -
            profitRect.left,

          purchasesWidth:
            purchasesRect.right
            -
            purchasesRect.left,
        });
      },
      []
    );


  useLayoutEffect(
    () => {
      if (
        !tableActive
      ) {
        return;
      }

      const shell =
        tableShellRef.current;

      const scroll =
        tableScrollRef.current;

      if (
        !shell
        ||
        !scroll
      ) {
        return;
      }

      measureTotals();

      const resizeObserver =
        new ResizeObserver(
          measureTotals
        );

      resizeObserver.observe(
        shell
      );

      resizeObserver.observe(
        scroll
      );

      scroll.addEventListener(
        "scroll",
        measureTotals,
        {
          passive:
            true,
        }
      );

      window.addEventListener(
        "resize",
        measureTotals
      );

      return () => {
        resizeObserver.disconnect();

        scroll.removeEventListener(
          "scroll",
          measureTotals
        );

        window.removeEventListener(
          "resize",
          measureTotals
        );
      };
    },
    [
      activeTab,
      tableActive,
      measureTotals,
    ]
  );


  const totals =
    useMemo(
      () =>
        filteredRows.reduce(
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
        filteredRows,
      ]
    );


  const sortedRows =
    useMemo(
      () =>
        filteredRows
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
        filteredRows,
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

    setStatusOverrides(previous => ({
      ...previous,
      [masterCode]: nextStatus,
    }));

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

      setStatusOverrides(previous => ({
        ...previous,
        [masterCode]: previousStatus,
      }));
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
        data-sku-column={
          column
        }
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
      className={
        activeTab ===
          "all"

          ? "sku-list-data-section sku-list-data-section--all"

          : activeTab ===
              "wildberries"

            ? "sku-list-data-section sku-list-data-section--wildberries"

            : activeTab ===
                "yandex-market"

              ? "sku-list-data-section sku-list-data-section--yandex"

              : "sku-list-data-section"
      }
      data-marketplace={
        activeTab
      }
    >
      <div
        className="sku-list-toolbar"
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

        <div className="sku-list-period-controls" aria-label="Период отчёта">
          <div className="sku-list-period-control">
            <ChoiceField
              label="Год"
              value={selectedYear}
              onChange={setSelectedYear}
              options={[{ value: "2026", label: "2026" }]}
            />
          </div>
          <div className="sku-list-period-control">
            <ChoiceField
              label="Месяц"
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={[
                { value: "09", label: "Сентябрь" },
                { value: "10", label: "Октябрь" },
              ]}
            />
          </div>
        </div>
      </div>
      <div
        className="sku-list-filters"
        style={{
          // The totals bar starts at the measured revenue-column boundary.
          // Keep the search and status filter to its left, including on resize.
          maxWidth: totalsLayout
            ? Math.max(0, totalsLayout.left - 12)
            : "calc(100% - 340px)",
        }}
      >
        <label className="sku-list-search">
          <span className="sku-list-search-heading">Поиск по артикулу, ЕНОТ, SKU или названию</span>
          <input type="search" aria-label="Поиск товара в списке артикулов"
            autoComplete="off" placeholder="Например, артикул, ЕНОТ, SKU или название товара"
            value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />
        </label>
        {activeTab !== "all" && (
          <label className="sku-list-filter-status">
            <span>Статус товара</span>
            <select value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as ProductArticleStatus | "all")}>
              <option value="all">Все статусы</option>
              {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        )}
      </div>

      {
        tableActive

          ? (
            <div
              ref={
                tableShellRef
              }
              className=
                "sku-list-table-shell"
            >
              <div
                className=
                  "sku-list-totals-viewport"
                style={
                  totalsLayout

                    ? {
                        left:
                          totalsLayout.left,

                        width:
                          72
                          +
                          totalsLayout.revenueWidth
                          +
                          totalsLayout.profitWidth
                          +
                          totalsLayout.purchasesWidth,

                        gridTemplateColumns:
                          "72px "
                          +
                          totalsLayout.revenueWidth
                          +
                          "px "
                          +
                          totalsLayout.profitWidth
                          +
                          "px "
                          +
                          totalsLayout.purchasesWidth
                          +
                          "px",

                        visibility:
                          "visible",
                      }

                    : {
                        visibility:
                          "hidden",
                      }
                }
                aria-label={
                  activeTab ===
                    "all"

                    ? "Итоги по всем маркетплейсам"

                    : "Итоги по маркетплейсу"
                }
              >
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
                    "sku-list-total-cell sku-list-total-value sku-list-total-value--last"
                >
                  {
                    formatInteger(
                      totals.purchases
                    )
                    +
                    " шт."
                  }
                </div>
              </div>

              <div
                className=
                  "sku-list-table-card"
              >
                <div
                  ref={
                    tableScrollRef
                  }
                  className=
                    "sku-list-table-scroll"
                >
                  <div
                    className=
                      "sku-list-table-inner"
                  >
                    <table
                      className=
                        "sku-list-table"
                    >
                  <colgroup>
                    {
                      activeTab ===
                        "all"

                        ? (
                          <>
                            <col
                              className=
                                "sku-list-col-enot"
                            />

                            <col
                              className=
                                "sku-list-col-product-all"
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
                          </>
                        )

                        : (
                          <>
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
                          </>
                        )
                    }
                  </colgroup>

                  <thead>
                    <tr>
                      <SortHeading
                        column="enot"
                        label="ЕНОТ"
                      />

                      {
                        activeTab ===
                          "all"

                          ? (
                            <SortHeading
                              column="productName"
                              label="Товар"
                            />
                          )

                          : (
                            <>
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
                            </>
                          )
                      }

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
                      sortedRows.length === 0
                        ? (
                          <tr>
                            <td
                              colSpan={activeTab === "all" ? 5 : 8}
                              className="sku-list-period-empty"
                            >
                              {searchQuery.trim() || (activeTab !== "all" && statusFilter !== "all")
                                ? "По заданным условиям товары не найдены."
                                : <>Данные за {selectedMonth === "10" ? "октябрь" : "сентябрь"} {selectedYear} для этого маркетплейса ещё не загружены.</>}
                            </td>
                          </tr>
                        )
                        : sortedRows.map(
                        (
                          row,
                          index
                        ) => {
                          if (
                            activeTab ===
                            "all"
                          ) {
                            return (
                              <tr
                                key={
                                  row.enot
                                  ??
                                  (
                                    "all-"
                                    +
                                    index
                                  )
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
