import type {
  ReactNode,
} from "react";

import Link
from "next/link";

import ThemeToggle
from "../ThemeToggle";

import OzonStockSyncClient
from "../OzonStockSyncClient";

import OzonProductsTableClient, {
  type OzonClusterDetailRow,
  type OzonProductRow,
} from "./OzonProductsTableClient";

import OzonUnlinkedProductsClient, {
  type OzonUnlinkedProductRow,
} from "./OzonUnlinkedProductsClient";

import "./ozon-reference.css";


export const dynamic =
  "force-dynamic";


// ============================================================
// ТИПЫ
// ============================================================

type LatestSync = {
  id: string;
  date_from: string;
  date_to: string;
  completed_days: number;
  status: string;
  postings_received: number;
  cancelled_postings: number;
  aggregated_rows_saved: number;
  created_at: string;
};


type Summary = {
  active_listing_rows: number;
  active_master_codes: number;
  sales_28_days: number;
  cancelled_28_days: number;
  stock_quantity: number;
};


type DailySalesRow = {
  sale_date: string;
  rows_count: number;
  sales_quantity: number;
  cancelled_quantity: number;
};


type ListingRow = {
  product_id: string;
  offer_id: string | null;
  ozon_product_id: string | number | null;
  name: string | null;
};


type ProductRow = {
  master_code: string;
  product_name: string | null;
  listing_count: number;
  listings: ListingRow[];
  sales_28_days: number;
  cancelled_28_days: number;
  average_sales_per_day: number;
  stock_quantity: number;
  stock_days: number | null;
};


type DashboardData = {
  latest_sync: LatestSync | null;
  stock_snapshot_date: string | null;
  summary: Summary | null;
  daily_sales: DailySalesRow[];
  products: ProductRow[];
};


type ReplenishmentRun = {
  id: string;
  created_at: string;
  status: string;
  calculation_version: string;
  sales_date_from: string;
  sales_date_to: string;
  stock_snapshot_date: string;
  total_product_cluster_pairs: number;
  pairs_with_need: number;
  total_need_units: number;
};


type ReplenishmentItem = {
  product_id: string;
  offer_id: string | null;
  product_name: string | null;
  ozon_sku: string | null;
  cluster_id: string;
  cluster_name: string | null;
  sales_28_days: number;
  cancelled_28_days: number;
  avg_sales_per_day: number;
  stock_quantity: number;
  coverage_days: number | null;
};


type ReplenishmentData = {
  run: ReplenishmentRun | null;
  items: ReplenishmentItem[];
};


type OzonReferenceIconName =
  | "clock"
  | "calendar"
  | "warehouse"
  | "postings"
  | "sales"
  | "cancel"
  | "stock"
  | "products"
  | "listings"
  | "info"
  | "shield";


// ============================================================
// ИКОНКИ
// ============================================================

function OzonReferenceIcon({
  name,
}: {
  name:
    OzonReferenceIconName;
}) {

  if (
    name === "clock"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
        />

        <path
          d="M12 7v5l3 2"
        />
      </svg>

    );

  }


  if (
    name === "calendar"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="2"
        />

        <path
          d="M8 3v4M16 3v4M3 10h18"
        />
      </svg>

    );

  }


  if (
    name === "warehouse"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M3 10 12 4l9 6v10H3Z"
        />

        <path
          d="M8 20v-6h8v6"
        />
      </svg>

    );

  }


  if (
    name === "postings"
    ||
    name === "listings"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M5 4h14v16H5Z"
        />

        <path
          d="M8 8h8M8 12h8M8 16h5"
        />
      </svg>

    );

  }


  if (
    name === "sales"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M4 19V11M10 19V5M16 19V8M22 19V3"
        />
      </svg>

    );

  }


  if (
    name === "cancel"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
        />

        <path
          d="m9 9 6 6M15 9l-6 6"
        />
      </svg>

    );

  }


  if (
    name === "stock"
    ||
    name === "products"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="
            M12 3
            20 7
            12 11
            4 7
            Z
          "
        />

        <path
          d="
            M4 7
            v10
            l8 4
            8-4
            V7
          "
        />

        <path
          d="M12 11v10"
        />
      </svg>

    );

  }


  if (
    name === "shield"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="
            M12 3
            20 6
            v6
            c0 4.5-2.8 7.5-8 9
            -5.2-1.5-8-4.5-8-9V6Z
          "
        />

        <path
          d="m9 12 2 2 4-4"
        />
      </svg>

    );

  }


  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path
        d="M12 10v6M12 7h.01"
      />
    </svg>

  );

}


// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

function formatNumber(
  value:
    number
    |
    null
    |
    undefined
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


function formatDate(
  value:
    string
    |
    null
    |
    undefined
) {

  if (!value) {

    return "—";

  }


  const [
    year,
    month,
    day,
  ] =
    value
      .slice(
        0,
        10
      )
      .split(
        "-"
      );


  if (
    !year
    ||
    !month
    ||
    !day
  ) {

    return value;

  }


  return `${day}.${month}.${year}`;

}


function formatDateTimeKrasnoyarsk(
  value:
    string
    |
    null
    |
    undefined
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

      second:
        "2-digit",
    }
  ).format(
    date
  );

}


// ============================================================
// SUPABASE CONFIG
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


// ============================================================
// SUPABASE GET
// ============================================================

async function supabaseGet<T>(
  url:
    URL
):
  Promise<T> {

  const {
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Supabase GET ${response.status}: ${text}`
    );

  }


  return JSON.parse(
    text
  ) as T;

}


// ============================================================
// DASHBOARD
// ============================================================

async function getOzonDashboard():
  Promise<DashboardData> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_ozon_sync_dashboard`,
      {
        method:
          "POST",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            {}
          ),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Supabase RPC error ${response.status}: ${text}`
    );

  }


  return JSON.parse(
    text
  ) as
    DashboardData;

}


// ============================================================
// ПОСЛЕДНИЙ УСПЕШНЫЙ РАСЧЁТ FBO
// ============================================================

async function getLatestReplenishment():
  Promise<ReplenishmentData> {

  const {
    supabaseUrl,
  } =
    getSupabaseConfig();


  const runUrl =
    new URL(
      `${supabaseUrl}/rest/v1/ozon_fbo_replenishment_runs`
    );


  runUrl.searchParams.set(
    "select",
    [
      "id",
      "created_at",
      "status",
      "calculation_version",
      "sales_date_from",
      "sales_date_to",
      "stock_snapshot_date",
      "total_product_cluster_pairs",
      "pairs_with_need",
      "total_need_units",
    ].join(
      ","
    )
  );


  runUrl.searchParams.set(
    "status",
    "eq.success"
  );


  runUrl.searchParams.set(
    "order",
    "created_at.desc"
  );


  runUrl.searchParams.set(
    "limit",
    "1"
  );


  const runs =
    await supabaseGet<
      ReplenishmentRun[]
    >(
      runUrl
    );


  const run =
    runs[
      0
    ]
    ??
    null;


  if (!run) {

    return {
      run:
        null,

      items:
        [],
    };

  }


  const items:
    ReplenishmentItem[] =
      [];


  const pageSize =
    1000;


  for (
    let offset = 0;
    offset < 100000;
    offset += pageSize
  ) {

    const itemsUrl =
      new URL(
        `${supabaseUrl}/rest/v1/ozon_fbo_replenishment_items`
      );


    itemsUrl.searchParams.set(
      "select",
      [
        "product_id",
        "offer_id",
        "product_name",
        "ozon_sku",
        "cluster_id",
        "cluster_name",
        "sales_28_days",
        "cancelled_28_days",
        "avg_sales_per_day",
        "stock_quantity",
        "coverage_days",
      ].join(
        ","
      )
    );


    itemsUrl.searchParams.set(
      "calculation_run_id",
      `eq.${run.id}`
    );


    itemsUrl.searchParams.set(
      "order",
      "product_id.asc,cluster_name.asc,cluster_id.asc"
    );


    itemsUrl.searchParams.set(
      "limit",
      String(
        pageSize
      )
    );


    itemsUrl.searchParams.set(
      "offset",
      String(
        offset
      )
    );


    const page =
      await supabaseGet<
        ReplenishmentItem[]
      >(
        itemsUrl
      );


    items.push(
      ...page
    );


    if (
      page.length <
      pageSize
    ) {

      break;

    }

  }


  return {
    run,
    items,
  };

}


// ============================================================
// ТОВАРЫ OZON БЕЗ MASTER_CODE
// ============================================================

async function getOzonUnlinkedProducts():
  Promise<OzonUnlinkedProductRow[]> {

  const {
    supabaseUrl,
  } =
    getSupabaseConfig();


  const url =
    new URL(
      `${supabaseUrl}/rest/v1/ozon_unlinked_products`
    );


  url.searchParams.set(
    "select",
    [
      "id",
      "offer_id",
      "ozon_product_id",
      "ozon_sku",
      "name",
      "first_seen_at",
      "last_seen_at",
    ].join(
      ","
    )
  );


  url.searchParams.set(
    "status",
    "eq.pending"
  );


  url.searchParams.set(
    "order",
    "first_seen_at.desc"
  );


  url.searchParams.set(
    "limit",
    "1000"
  );


  return supabaseGet<
    OzonUnlinkedProductRow[]
  >(
    url
  );

}


// ============================================================
// СОБИРАЕМ ДЕТАЛИ ПО MASTER_CODE
// ============================================================

function buildClusterRowsByMasterCode(
  products:
    ProductRow[],

  replenishmentItems:
    ReplenishmentItem[]
):
  Record<
    string,
    OzonClusterDetailRow[]
  > {

  const productIndex =
    new Map<
      string,
      {
        masterCode:
          string;

        ozonProductId:
          string
          |
          number
          |
          null;
      }
    >();


  for (
    const product
    of products
  ) {

    for (
      const listing
      of product.listings
      ??
      []
    ) {

      if (
        !listing.product_id
      ) {

        continue;

      }


      productIndex.set(
        listing.product_id,
        {
          masterCode:
            product.master_code,

          ozonProductId:
            listing.ozon_product_id
            ??
            null,
        }
      );

    }

  }


  const result:
    Record<
      string,
      OzonClusterDetailRow[]
    > =
      {};


  for (
    const item
    of replenishmentItems
  ) {

    const mapping =
      productIndex.get(
        item.product_id
      );


    if (!mapping) {

      continue;

    }


    if (
      !result[
        mapping.masterCode
      ]
    ) {

      result[
        mapping.masterCode
      ] =
        [];

    }


    result[
      mapping.masterCode
    ].push(
      {
        product_id:
          item.product_id,

        offer_id:
          item.offer_id,

        ozon_product_id:
          mapping.ozonProductId,

        ozon_sku:
          item.ozon_sku,

        cluster_id:
          item.cluster_id,

        cluster_name:
          item.cluster_name,

        sales_28_days:
          Number(
            item.sales_28_days
            ??
            0
          ),

        cancelled_28_days:
          Number(
            item.cancelled_28_days
            ??
            0
          ),

        average_sales_per_day:
          Number(
            item.avg_sales_per_day
            ??
            0
          ),

        stock_quantity:
          Number(
            item.stock_quantity
            ??
            0
          ),

        stock_days:
          item.coverage_days ===
            null

            ? null

            : Number(
                item.coverage_days
              ),
      }
    );

  }


  return result;

}


// ============================================================
// СТРАНИЦА OZON
// ============================================================

export default async function OzonPage() {

  let dashboard:
    DashboardData
    |
    null =
      null;


  let dashboardError:
    string
    |
    null =
      null;


  let replenishment:
    ReplenishmentData =
      {
        run:
          null,

        items:
          [],
      };


  let replenishmentError:
    string
    |
    null =
      null;


  let unlinkedProducts:
    OzonUnlinkedProductRow[] =
      [];


  let unlinkedProductsError:
    string
    |
    null =
      null;


  try {

    dashboard =
      await getOzonDashboard();

  } catch (
    error
  ) {

    dashboardError =

      error instanceof Error

        ? error.message

        : String(
            error
          );

  }


  try {

    replenishment =
      await getLatestReplenishment();

  } catch (
    error
  ) {

    replenishmentError =

      error instanceof Error

        ? error.message

        : String(
            error
          );

  }


  try {

    unlinkedProducts =
      await getOzonUnlinkedProducts();

  } catch (
    error
  ) {

    unlinkedProductsError =

      error instanceof Error

        ? error.message

        : String(
            error
          );

  }


  const latestSync =
    dashboard
      ?.latest_sync
    ??
    null;


  const summary =
    dashboard
      ?.summary
    ??
    null;


  const dailySales =
    dashboard
      ?.daily_sales
    ??
    [];


  const products =
    dashboard
      ?.products
    ??
    [];


  const clusterRowsByMasterCode =
    buildClusterRowsByMasterCode(
      products,
      replenishment.items
    );


  return (

    <main
      className=
        "page ozon-reference-page"
    >

      <div
        className=
          "container"
      >

        {/* ===================================
            HEADER
            =================================== */}

        <header
          className=
            "header ozon-header"
        >

          <div
            className=
              "ozon-title-wrap"
          >

            <span
              className=
                "ozon-title-icon"
            >

              <img
                src="/logos/ozon.png"
                alt=""
              />

            </span>


            <div>

              <div
                className=
                  "small-label"
              >
                СИСТЕМА ЗАКУПА
              </div>


              <h1
                className=
                  "title"
              >
                Ozon — синхронизация
              </h1>


              <p
                className=
                  "subtitle"
              >
                FBO продажи, отмены
                и доступные остатки Ozon.
              </p>

            </div>

          </div>


          <div
            className=
              "header-actions ozon-header-actions"
          >

            <ThemeToggle />


            <Link
              href="/stock-import"

              className=
                "secondary-button ozon-navigation-button"
            >
              Остатки склада
            </Link>


            <Link
              href="/"

              className=
                "secondary-button ozon-navigation-button"
            >
              ← Главная
            </Link>

          </div>

        </header>


        {/* ===================================
            ERRORS
            =================================== */}

        {
          dashboardError

            ? (

              <section
                className=
                  "section ozon-error-section"
              >

                <div
                  className=
                    "ozon-error-title"
                >
                  Ошибка загрузки данных Ozon
                </div>


                <div
                  className=
                    "reason-text ozon-error-text"
                >
                  {
                    dashboardError
                  }
                </div>

              </section>

            )

            : null
        }


        {
          replenishmentError

            ? (

              <section
                className=
                  "section ozon-error-section"
              >

                <div
                  className=
                    "ozon-error-title"
                >
                  Ошибка загрузки расчёта FBO
                </div>


                <div
                  className=
                    "reason-text ozon-error-text"
                >
                  {
                    replenishmentError
                  }
                </div>

              </section>

            )

            : null
        }


        {/* ===================================
            SYNC STATE
            =================================== */}

        <section
          className=
            "section ozon-sync-state-section"
        >

          <div
            className=
              "ozon-section-top"
          >

            <div
              className=
                "ozon-section-heading"
            >

              <h2
                className=
                  "section-title"
              >
                Состояние синхронизации
              </h2>


              <div
                className=
                  "reason-text"
              >
                Последняя успешная загрузка
                FBO-данных из Ozon.
              </div>

            </div>


            <span
              className={
                latestSync
                  ?.status ===
                  "success"

                  ? "ozon-status-badge ozon-status-badge--success"

                  : "ozon-status-badge ozon-status-badge--warning"
              }
            >

              <span
                className=
                  "ozon-status-dot"
              />


              {
                latestSync
                  ?.status ===
                  "success"

                  ? "Синхронизация завершена"

                  : "Нет успешной загрузки"
              }

            </span>

          </div>


          <div
            className=
              "ozon-sync-info-grid"
          >

            <InfoCard
              icon="clock"

              label=
                "Последняя синхронизация"

              value={
                formatDateTimeKrasnoyarsk(
                  latestSync
                    ?.created_at
                )
              }

              hint=
                "Красноярское время"
            />


            <InfoCard
              icon="calendar"

              label=
                "Период продаж"

              value={
                latestSync

                  ? `${formatDate(
                      latestSync.date_from
                    )} – ${formatDate(
                      latestSync.date_to
                    )}`

                  : "—"
              }

              hint=
                "Скользящие 28 дней"
            />


            <InfoCard
              icon="warehouse"

              label=
                "Снимок остатков"

              value={
                formatDate(
                  dashboard
                    ?.stock_snapshot_date
                )
              }

              hint="FBO"
            />


            <InfoCard
              icon="postings"

              label=
                "Отправлений"

              value={
                formatNumber(
                  latestSync
                    ?.postings_received
                )
              }

              hint=
                "Получено из Ozon"
            />

          </div>

        </section>


        {/* ===================================
            SUMMARY
            =================================== */}

        <section
          className=
            "summary-grid ozon-summary-grid"
        >

          <SummaryCard
            icon="sales"
            tone="green"
            label="Продажи за 28 дней"
            value={
              formatNumber(
                summary
                  ?.sales_28_days
              )
            }
            hint="шт., без отмен"
          />


          <SummaryCard
            icon="cancel"
            tone="red"
            label="Отмены"
            value={
              formatNumber(
                summary
                  ?.cancelled_28_days
              )
            }
            hint="шт. отдельно от продаж"
          />


          <SummaryCard
            icon="stock"
            tone="blue"
            label="Остаток FBO"
            value={
              formatNumber(
                summary
                  ?.stock_quantity
              )
            }
            hint="доступно к продаже"
          />


          <SummaryCard
            icon="products"
            tone="purple"
            label="Физических товаров"
            value={
              formatNumber(
                summary
                  ?.active_master_codes
              )
            }
            hint="по master_code"
          />


          <SummaryCard
            icon="listings"
            tone="orange"
            label="Размещений"
            value={
              formatNumber(
                summary
                  ?.active_listing_rows
              )
            }
            hint="активных строк products"
          />

        </section>


        {/* ===================================
            HOW TO COMPARE
            =================================== */}

        <section
          className=
            "section ozon-info-panel"
        >

          <span
            className=
              "ozon-panel-icon"
          >

            <OzonReferenceIcon
              name="info"
            />

          </span>


          <div>

            <h2
              className=
                "section-title"
            >
              Как сверять с кабинетом Ozon
            </h2>


            <div
              className=
                "ozon-info-list"
            >

              <div
                className=
                  "reason-text"
              >
                Продажи: FBO за период,
                указанный выше. Отменённые
                отправления в продажи не входят.
              </div>


              <div
                className=
                  "reason-text"
              >
                Отмены считаются отдельно
                и отображаются отдельным показателем.
              </div>


              <div
                className=
                  "reason-text"
              >
                Остаток: доступный FBO-остаток
                из /v1/analytics/stocks,
                поле available_stock_count.
              </div>


              <div
                className=
                  "reason-text"
              >
                Для корректного сравнения
                в кабинете Ozon нужно выбирать
                тот же период и FBO.
              </div>

            </div>

          </div>

        </section>


        {/* ===================================
            DAILY SALES
            =================================== */}

        <section
          className=
            "section ozon-daily-section"
        >

          <div
            className=
              "ozon-daily-header"
          >

            <h2
              className=
                "section-title"
            >
              Продажи по дням
            </h2>


            <div
              className=
                "reason-text"
            >
              Контрольная сверка с кабинетом Ozon.
            </div>

          </div>


          <div
            className=
              "ozon-daily-table-shell"
          >

            <table
              className=
                "ozon-daily-table"
            >

              <thead>

                <tr>

                  <th
                    style={{
                      textAlign:
                        "left",
                    }}
                  >
                    Дата
                  </th>


                  <th
                    style={{
                      textAlign:
                        "right",
                    }}
                  >
                    Продажи, шт.
                  </th>


                  <th
                    style={{
                      textAlign:
                        "right",
                    }}
                  >
                    Отмены, шт.
                  </th>


                  <th
                    style={{
                      textAlign:
                        "right",
                    }}
                  >
                    Строк в БД
                  </th>

                </tr>

              </thead>


              <tbody>

                {
                  dailySales.map(
                    row => (

                      <tr
                        key={
                          row.sale_date
                        }
                      >

                        <td>
                          <strong>
                            {
                              formatDate(
                                row.sale_date
                              )
                            }
                          </strong>
                        </td>


                        <td
                          style={{
                            textAlign:
                              "right",
                          }}
                        >

                          <strong>
                            {
                              formatNumber(
                                row.sales_quantity
                              )
                            }
                          </strong>

                        </td>


                        <td
                          style={{
                            textAlign:
                              "right",
                          }}
                        >
                          {
                            formatNumber(
                              row.cancelled_quantity
                            )
                          }
                        </td>


                        <td
                          style={{
                            textAlign:
                              "right",
                          }}
                        >
                          {
                            formatNumber(
                              row.rows_count
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

        </section>


        {/* ===================================
            UNLINKED
            =================================== */}

        <section
          className=
            "section ozon-unlinked-section"
        >

          <div
            className=
              "ozon-unlinked-header"
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
                  "reason-text"
              >
                Новые товары Ozon, которые
                система пока не смогла привязать
                к физическому товару.
              </div>


              <div
                className=
                  "reason-text"
              >
                Они не останавливают общую
                синхронизацию и не участвуют
                в расчёте потребности до
                ручной привязки.
              </div>

            </div>


            <span
              className={
                unlinkedProducts.length >
                0

                  ? "ozon-unlinked-state ozon-unlinked-state--warning"

                  : "ozon-unlinked-state ozon-unlinked-state--success"
              }
            >

              <span
                className=
                  "ozon-status-dot"
              />


              {
                unlinkedProducts.length >
                0

                  ? `Требуют привязки: ${unlinkedProducts.length}`

                  : "Все товары привязаны"
              }

            </span>

          </div>


          <div
            className=
              "ozon-unlinked-content"
          >

            {
              unlinkedProductsError

                ? (

                  <div
                    className=
                      "ozon-error-text"
                  >
                    Не удалось загрузить список:{" "}
                    {
                      unlinkedProductsError
                    }
                  </div>

                )

                : (

                  <OzonUnlinkedProductsClient
                    products={
                      unlinkedProducts
                    }
                  />

                )
            }

          </div>

        </section>


        {/* ===================================
            PRODUCTS
            =================================== */}

        <section
          className=
            "section ozon-products-section"
        >

          <div
            className=
              "ozon-products-header"
          >

            <div
              className=
                "ozon-products-header-copy"
            >

              <h2
                className=
                  "section-title"
              >
                Данные по товарам
              </h2>


              <div
                className=
                  "reason-text"
              >
                Верхняя строка:
                агрегат физического товара
                по master_code.
              </div>


              <div
                className=
                  "reason-text"
              >
                Раскрытие:
                продажи, отмены,
                средние продажи,
                остаток и дни запаса
                отдельно по каждому
                Ozon-размещению и кластеру.
              </div>


              {
                replenishment.run

                  ? (

                    <div
                      className=
                        "ozon-calculation-info"
                    >
                      Расшифровка по расчёту{" "}

                      <strong>
                        {
                          replenishment
                            .run
                            .calculation_version
                        }
                      </strong>

                      {" "}от{" "}

                      {
                        formatDateTimeKrasnoyarsk(
                          replenishment
                            .run
                            .created_at
                        )
                      }.
                    </div>

                  )

                  : null
              }

            </div>

          </div>


          <OzonProductsTableClient
            products={
              products as
                OzonProductRow[]
            }

            clusterRowsByMasterCode={
              clusterRowsByMasterCode
            }
          />

        </section>


        {/* ===================================
            SAFE MODE
            =================================== */}

        <section
          className=
            "section ozon-safe-section"
        >

          <span
            className=
              "ozon-safe-icon"
          >

            <OzonReferenceIcon
              name="shield"
            />

          </span>


          <div>

            <h2
              className=
                "section-title"
            >
              Безопасный режим
            </h2>


            <div
              className=
                "ozon-info-list"
            >

              <div
                className=
                  "reason-text"
              >
                Сначала система полностью
                получает и проверяет данные Ozon.
              </div>


              <div
                className=
                  "reason-text"
              >
                Только после успешного завершения
                всех запросов продажи и остатки
                записываются в Supabase одной транзакцией.
              </div>


              <div
                className=
                  "reason-text"
              >
                После успешной записи автоматически
                запускается расчёт потребности FBO.
              </div>


              <div
                className=
                  "reason-text"
              >
                Ошибка API не считается
                нулевым остатком.
              </div>

            </div>

          </div>

        </section>


        {/* ===================================
            MANUAL SYNC
            =================================== */}

        <div
          className=
            "ozon-sync-module"
        >

          <OzonStockSyncClient />

        </div>

      </div>

    </main>

  );

}


// ============================================================
// INFO CARD
// ============================================================

function InfoCard({
  icon,
  label,
  value,
  hint,
}: {
  icon:
    OzonReferenceIconName;

  label:
    string;

  value:
    string;

  hint?:
    string;
}) {

  return (

    <div
      className=
        "ozon-info-card"
    >

      <span
        className=
          "ozon-info-icon"
      >

        <OzonReferenceIcon
          name={
            icon
          }
        />

      </span>


      <div
        className=
          "ozon-info-copy"
      >

        <div
          className=
            "card-label"
        >
          {
            label
          }
        </div>


        <div
          className=
            "ozon-info-value"
        >
          {
            value
          }
        </div>


        {
          hint

            ? (

              <div
                className=
                  "muted"
              >
                {
                  hint
                }
              </div>

            )

            : null
        }

      </div>

    </div>

  );

}


// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon:
    OzonReferenceIconName;

  tone:
    "blue"
    |
    "green"
    |
    "red"
    |
    "purple"
    |
    "orange";

  label:
    string;

  value:
    string;

  hint:
    string;
}) {

  return (

    <div
      className=
        "card ozon-summary-card"
    >

      <span
        className={
          `ozon-summary-icon ozon-summary-icon--${tone}`
        }
      >

        <OzonReferenceIcon
          name={
            icon
          }
        />

      </span>


      <div
        className=
          "ozon-summary-copy"
      >

        <div
          className=
            "card-label"
        >
          {
            label
          }
        </div>


        <div
          className=
            "big-number"
        >
          {
            value
          }
        </div>


        <div
          className=
            "muted"
        >
          {
            hint
          }
        </div>

      </div>

    </div>

  );

}
