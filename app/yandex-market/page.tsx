import {
  type ReactNode,
} from "react";

import Link
  from "next/link";

import ThemeToggle
  from "../ThemeToggle";

import YandexUnlinkedProductsClient
  from "./YandexUnlinkedProductsClient";

import YandexSyncActionsClient
  from "./YandexSyncActionsClient";

import "./yandex-reference-top.css";


export const dynamic =
  "force-dynamic";


// ============================================================
// TYPES
// ============================================================

type RawYandexProduct = {
  offer?: {
    offerId?: string;
    name?: string;
  };

  mapping?: {
    marketSku?: string;
    marketSkuName?: string;
  };
};


type YandexProductRow = {
  id: number;

  offer_id: string;

  market_sku:
    | string
    | null;

  market_category_name:
    | string
    | null;

  master_code:
    | string
    | null;

  first_seen_at: string;

  last_seen_at: string;

  is_active: boolean;

  raw_data:
    | RawYandexProduct
    | null;

  created_at: string;

  updated_at: string;
};


type StockSyncRunRow = {
  id: string;
};


type StockSnapshotRow = {
  offer_id: string;

  warehouse_id:
    number | null;

  warehouse_name:
    string | null;

  available: number;
};


type SalesSyncRunRow = {
  id: string;

  date_from: string;

  date_to: string;
};


type SalesDailyRow = {
  shop_sku: string;

  warehouse_id:
    number | null;

  warehouse_name:
    string | null;

  sales_quantity: number;

  cancelled_quantity: number;

  unredeemed_quantity: number;
};


type MarketplaceDailySyncRunRow = {
  finished_at:
    string
    | null;
};


type ProductMetrics = {
  sales: number;

  cancellations: number;

  stock: number;
};


type WarehouseMetrics = {
  warehouseId:
    number | null;

  warehouseName:
    string;

  sales:
    number;

  cancellations:
    number;

  stock:
    number;
};


// ============================================================
// SUPABASE
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim()
    ||
    process.env
      .SUPABASE_URL
      ?.trim();


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY
      ?.trim()
    ||
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
      ?.trim();


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL или SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


function getSupabaseHeaders(
  secretKey:
    string
) {

  return {
    apikey:
      secretKey,

    Authorization:
      `Bearer ${secretKey}`,

    Accept:
      "application/json",
  };

}


async function fetchAllRows<T>(
  table:
    string,

  select:
    string,

  params:
    Record<
      string,
      string
    > = {}
):
Promise<T[]> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const result:
    T[] =
    [];


  const pageSize =
    1000;


  let offset =
    0;


  while (true) {

    const url =
      new URL(
        `${supabaseUrl}/rest/v1/${table}`
      );


    url.searchParams.set(
      "select",
      select
    );


    url.searchParams.set(
      "limit",
      String(
        pageSize
      )
    );


    url.searchParams.set(
      "offset",
      String(
        offset
      )
    );


    for (
      const [
        key,
        value,
      ]
      of Object.entries(
        params
      )
    ) {

      url.searchParams.set(
        key,
        value
      );

    }


    const response =
      await fetch(
        url.toString(),
        {
          headers:
            getSupabaseHeaders(
              supabaseSecretKey
            ),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      throw new Error(
        `Supabase ${table}: HTTP ${response.status}: ${text}`
      );

    }


    const rows =
      JSON.parse(
        text
      ) as T[];


    result.push(
      ...rows
    );


    if (
      rows.length <
      pageSize
    ) {

      break;

    }


    offset +=
      pageSize;

  }


  return result;

}


async function fetchRows<T>(
  table:
    string,

  select:
    string,

  params:
    Record<
      string,
      string
    > = {}
):
Promise<T[]> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const url =
    new URL(
      `${supabaseUrl}/rest/v1/${table}`
    );


  url.searchParams.set(
    "select",
    select
  );


  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      params
    )
  ) {

    url.searchParams.set(
      key,
      value
    );

  }


  const response =
    await fetch(
      url.toString(),
      {
        headers:
          getSupabaseHeaders(
            supabaseSecretKey
          ),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Supabase ${table}: HTTP ${response.status}: ${text}`
    );

  }


  return JSON.parse(
    text
  ) as T[];

}


// ============================================================
// LOADERS
// ============================================================

async function getYandexProducts() {

  return fetchAllRows<
    YandexProductRow
  >(
    "yandex_products",

    [
      "id",
      "offer_id",
      "market_sku",
      "market_category_name",
      "master_code",
      "first_seen_at",
      "last_seen_at",
      "is_active",
      "raw_data",
      "created_at",
      "updated_at",
    ].join(","),

    {
      order:
        "offer_id.asc",
    }
  );

}


async function getLatestFullSync() {

  const rows =
    await fetchRows<
      MarketplaceDailySyncRunRow
    >(
      "marketplace_daily_sync_runs",

      "finished_at",

      {
        marketplace:
          "eq.yandex_market",

        status:
          "eq.success",

        finished_at:
          "not.is.null",

        order:
          "finished_at.desc",

        limit:
          "1",
      }
    );


  return rows[0]
    ??
    null;

}


async function getLatestStockRun() {

  const rows =
    await fetchRows<
      StockSyncRunRow
    >(
      "yandex_stock_sync_runs",

      "id",

      {
        status:
          "eq.success",

        order:
          "created_at.desc",

        limit:
          "1",
      }
    );


  return rows[0]
    ??
    null;

}


async function getStockSnapshots(
  syncRunId:
    string
) {

  return fetchAllRows<
    StockSnapshotRow
  >(
    "yandex_stock_snapshots",

    [
      "offer_id",
      "warehouse_id",
      "warehouse_name",
      "available",
    ].join(","),

    {
      sync_run_id:
        `eq.${syncRunId}`,
    }
  );

}


async function getLatestSalesRun() {

  const rows =
    await fetchRows<
      SalesSyncRunRow
    >(
      "yandex_sales_sync_runs",

      "id,date_from,date_to",

      {
        status:
          "eq.success",

        order:
          "created_at.desc",

        limit:
          "1",
      }
    );


  return rows[0]
    ??
    null;

}


async function getSalesDaily(
  syncRunId:
    string
) {

  return fetchAllRows<
    SalesDailyRow
  >(
    "yandex_sales_daily",

    [
      "shop_sku",
      "warehouse_id",
      "warehouse_name",
      "sales_quantity",
      "cancelled_quantity",
      "unredeemed_quantity",
    ].join(","),

    {
      last_sync_run_id:
        `eq.${syncRunId}`,
    }
  );

}


// ============================================================
// HELPERS
// ============================================================

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


function formatAverage(
  value:
    number
) {

  return new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(
    value
  );

}


function formatStockDays(
  value:
    number
) {

  return new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits:
        1,

      maximumFractionDigits:
        1,
    }
  ).format(
    value
  );

}


function getPeriodDays(
  dateFrom:
    string,

  dateTo:
    string
) {

  const start =
    new Date(
      `${dateFrom}T00:00:00Z`
    );


  const end =
    new Date(
      `${dateTo}T00:00:00Z`
    );


  return Math.max(
    1,

    Math.floor(
      (
        end.getTime()
        -
        start.getTime()
      )
      /
      86_400_000
    )
    +
    1
  );

}


function getProductName(
  product:
    YandexProductRow
) {

  return (
    product
      .raw_data
      ?.offer
      ?.name
      ?.trim()
    ||
    product
      .raw_data
      ?.mapping
      ?.marketSkuName
      ?.trim()
    ||
    "—"
  );

}


function getWarehouseKey(
  warehouseId:
    number
    | null,

  warehouseName:
    string
    | null
) {

  return warehouseId !==
    null
    ? `id:${warehouseId}`
    : `name:${warehouseName?.trim() || "—"}`;

}


function buildWarehouseMetricsByOffer(
  stockRows:
    StockSnapshotRow[],

  salesRows:
    SalesDailyRow[]
) {

  const result =
    new Map<
      string,
      Map<
        string,
        WarehouseMetrics
      >
    >();


  function getOrCreate(
    offerId:
      string,

    warehouseId:
      number
      | null,

    warehouseName:
      string
      | null
  ) {

    let offerMap =
      result.get(
        offerId
      );


    if (!offerMap) {

      offerMap =
        new Map();


      result.set(
        offerId,
        offerMap
      );

    }


    const key =
      getWarehouseKey(
        warehouseId,
        warehouseName
      );


    let metric =
      offerMap.get(
        key
      );


    if (!metric) {

      metric = {
        warehouseId,

        warehouseName:
          warehouseName
            ?.trim()
          ||
          "—",

        sales:
          0,

        cancellations:
          0,

        stock:
          0,
      };


      offerMap.set(
        key,
        metric
      );

    }


    return metric;

  }


  for (
    const row
    of stockRows
  ) {

    getOrCreate(
      row.offer_id,
      row.warehouse_id,
      row.warehouse_name
    ).stock +=
      Number(
        row.available
        ??
        0
      );

  }


  for (
    const row
    of salesRows
  ) {

    const metric =
      getOrCreate(
        row.shop_sku,
        row.warehouse_id,
        row.warehouse_name
      );


    metric.sales +=
      Number(
        row.sales_quantity
        ??
        0
      );


    metric.cancellations +=
      Number(
        row.cancelled_quantity
        ??
        0
      )
      +
      Number(
        row.unredeemed_quantity
        ??
        0
      );

  }


  const finalMap =
    new Map<
      string,
      WarehouseMetrics[]
    >();


  for (
    const [
      offerId,
      warehouses,
    ]
    of result
  ) {

    finalMap.set(
      offerId,

      Array.from(
        warehouses.values()
      ).sort(
        (
          a,
          b
        ) =>
          a.warehouseName
            .localeCompare(
              b.warehouseName,
              "ru"
            )
      )
    );

  }


  return finalMap;

}


// ============================================================
// PAGE
// ============================================================

export default async function YandexMarketPage() {

  let products:
    YandexProductRow[] =
    [];


  let stockRows:
    StockSnapshotRow[] =
    [];


  let salesRows:
    SalesDailyRow[] =
    [];


  let fullSyncUpdatedAt:
    string
    | null =
    null;


  let salesPeriodDateFrom:
    string
    | null =
    null;


  let salesPeriodDateTo:
    string
    | null =
    null;


  let salesPeriodDays =
    28;


  let loadError:
    string
    | null =
    null;


  try {

    products =
      await getYandexProducts();


    const fullSync =
      await getLatestFullSync();


    fullSyncUpdatedAt =
      fullSync
        ?.finished_at
      ??
      null;


    const stockRun =
      await getLatestStockRun();


    if (stockRun) {

      stockRows =
        await getStockSnapshots(
          stockRun.id
        );

    }


    const salesRun =
      await getLatestSalesRun();


    if (salesRun) {

      salesPeriodDateFrom =
        salesRun.date_from;


      salesPeriodDateTo =
        salesRun.date_to;


      salesPeriodDays =
        getPeriodDays(
          salesRun.date_from,
          salesRun.date_to
        );


      salesRows =
        await getSalesDaily(
          salesRun.id
        );

    }

  } catch (error) {

    loadError =
      error instanceof Error
        ? error.message
        : String(
            error
          );

  }


  // ==========================================================
  // KPI
  // ==========================================================

  const salesTotal =
    salesRows.reduce(
      (
        total,
        row
      ) =>
        total
        +
        Number(
          row.sales_quantity
          ??
          0
        ),
      0
    );


  const cancellationsTotal =
    salesRows.reduce(
      (
        total,
        row
      ) =>
        total
        +
        Number(
          row.cancelled_quantity
          ??
          0
        )
        +
        Number(
          row.unredeemed_quantity
          ??
          0
        ),
      0
    );


  const stockTotal =
    stockRows.reduce(
      (
        total,
        row
      ) =>
        total
        +
        Number(
          row.available
          ??
          0
        ),
      0
    );


  const activeProducts =
    products.filter(
      product =>
        product.is_active
    );


  const unlinkedProducts =
    products.filter(
      product =>
        !product.master_code
        ?.trim()
    );


  const linkedProductsCount =
    products.length
    -
    unlinkedProducts.length;


  // ==========================================================
  // PRODUCT METRICS
  // ==========================================================

  const metricsByOffer =
    new Map<
      string,
      ProductMetrics
    >();


  for (
    const row
    of salesRows
  ) {

    const current =
      metricsByOffer.get(
        row.shop_sku
      )
      ??
      {
        sales:
          0,

        cancellations:
          0,

        stock:
          0,
      };


    current.sales +=
      Number(
        row.sales_quantity
        ??
        0
      );


    current.cancellations +=
      Number(
        row.cancelled_quantity
        ??
        0
      )
      +
      Number(
        row.unredeemed_quantity
        ??
        0
      );


    metricsByOffer.set(
      row.shop_sku,
      current
    );

  }


  for (
    const row
    of stockRows
  ) {

    const current =
      metricsByOffer.get(
        row.offer_id
      )
      ??
      {
        sales:
          0,

        cancellations:
          0,

        stock:
          0,
      };


    current.stock +=
      Number(
        row.available
        ??
        0
      );


    metricsByOffer.set(
      row.offer_id,
      current
    );

  }


  const warehouseMetricsByOffer =
    buildWarehouseMetricsByOffer(
      stockRows,
      salesRows
    );


  const sortedProducts =
    [
      ...products,
    ].sort(
      (
        a,
        b
      ) => {

        const masterCompare =
          (
            a.master_code
            ??
            ""
          ).localeCompare(
            b.master_code
            ??
            "",
            "ru"
          );


        if (
          masterCompare !==
          0
        ) {

          return masterCompare;

        }


        return a.offer_id
          .localeCompare(
            b.offer_id,
            "ru"
          );

      }
    );


  return (
    <main
      className=
        "page yandex-reference-page"
    >

      <style>
        {`
          .yandex-product-details > summary {
            list-style: none;
          }

          .yandex-product-details > summary::-webkit-details-marker {
            display: none;
          }

          .yandex-product-chevron {
            display: inline-block;
            transform-origin: center;
            transition: transform 0.15s ease;
          }

          .yandex-product-details[open]
          .yandex-product-chevron {
            transform: rotate(90deg);
          }

          .yandex-product-details > summary:hover {
            background: rgba(255,255,255,0.025);
          }
        `}
      </style>


      <div className="container">

        {/* ===================================
            HEADER
            =================================== */}

        <header
          className=
            "header ym-header"
        >

          <div>

            <h1 className="title">
              Яндекс Маркет
            </h1>


            <p className="subtitle">
              Продажи, возвраты и доступные
              FBY-остатки Яндекс Маркета.
            </p>

          </div>


          <div
            className=
              "header-actions ym-header-actions"
          >

            <ThemeToggle />


            <Link
              href="/stock-import"

              className=
                "secondary-button navigation-button ym-navigation-button"
            >
              Остатки склада
            </Link>


            <Link
              href="/"

              className=
                "secondary-button navigation-button ym-navigation-button"
            >
              ← Главная
            </Link>

          </div>

        </header>


        {/* ===================================
            ERROR
            =================================== */}

        {
          loadError
            ? (

              <div
                className=
                  "card ym-load-error"
              >
                {loadError}
              </div>

            )
            : null
        }


        {/* ===================================
            SYNC
            =================================== */}

        <YandexSyncActionsClient
          initialSyncUpdatedAt={
            fullSyncUpdatedAt
          }

          periodDateFrom={
            salesPeriodDateFrom
          }

          periodDateTo={
            salesPeriodDateTo
          }
        />


        {/* ===================================
            KPI
            =================================== */}

        <div
          className=
            "ym-summary-grid"
        >

          <MetricCard
            tone="green"

            icon={
              <BarChartIcon />
            }

            label=
              "Продажи за 28 дней"

            value={
              formatInteger(
                salesTotal
              )
            }

            hint=
              "Продано товаров, шт."
          />


          <MetricCard
            tone="red"

            icon={
              <CancelIcon />
            }

            label=
              "Отмены"

            value={
              formatInteger(
                cancellationsTotal
              )
            }

            hint=
              "Отмены и невыкупы, шт."
          />


          <MetricCard
            tone="orange"

            icon={
              <CubeIcon />
            }

            label=
              "Остаток FBY"

            value={
              formatInteger(
                stockTotal
              )
            }

            hint=
              "Доступно на складах ЯМ, шт."
          />


          <MetricCard
            tone="blue"

            icon={
              <LinkIcon />
            }

            label=
              "Связанных ЕНОТ"

            value={
              formatInteger(
                linkedProductsCount
              )
            }

            hint=
              "Карточек, связанных с ЕНОТ"
          />


          <MetricCard
            tone="orange"

            icon={
              <ArticleIcon />
            }

            label=
              "Артикулов ЯМ"

            value={
              formatInteger(
                activeProducts.length
              )
            }

            hint=
              "Активных карточек Яндекс Маркета"
          />

        </div>


        {/* ===================================
            INFO
            =================================== */}

        <section
          className=
            "section ym-info-panel"
        >

          <div
            className=
              "ym-panel-icon"
          >
            <InfoIcon />
          </div>


          <div>

            <h2
              className=
                "section-title"
            >
              Как считаются данные Яндекс Маркета
            </h2>


            <div
              className=
                "ym-info-list"
            >

              <div className="reason-text">
                Продажи за 28 дней — количество
                проданных товаров за последние
                28 дней.
              </div>


              <div className="reason-text">
                Отмены — количество товаров,
                которые были отменены или
                не выкуплены за тот же период.
              </div>


              <div className="reason-text">
                Остаток FBY — доступное количество
                товаров на складах Яндекс Маркета
                на момент последнего обновления.
              </div>


              <div className="reason-text">
                Связанных ЕНОТ — количество карточек
                Яндекс Маркета, для которых указан ЕНОТ.
              </div>


              <div className="reason-text">
                Артикулов ЯМ — количество активных
                карточек Яндекс Маркета.
              </div>

            </div>

          </div>

        </section>


        {/* ===================================
            UNLINKED
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Товары без ЕНОТ
          </h2>


          <div className="reason-text">
            Новые товары Яндекс Маркета,
            для которых пока не указан ЕНОТ.
          </div>


          {
            unlinkedProducts.length
              ? (

                <YandexUnlinkedProductsClient
                  products={
                    unlinkedProducts
                  }
                />

              )
              : (

                <div
                  className="reason-text"

                  style={{
                    marginTop:
                      "14px",
                  }}
                >
                  Непривязанных товаров нет.
                </div>

              )
          }

        </section>


        {/* ===================================
            PRODUCTS
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Данные по товарам
          </h2>


          <div className="reason-text">
            Основная строка показывает
            общие показатели артикула.
            При раскрытии — показатели
            по конкретным складам.
          </div>


          <ProductsTable
            products={
              sortedProducts
            }

            metricsByOffer={
              metricsByOffer
            }

            warehouseMetricsByOffer={
              warehouseMetricsByOffer
            }

            periodDays={
              salesPeriodDays
            }
          />

        </section>

      </div>

    </main>
  );

}


// ============================================================
// KPI CARD
// ============================================================

function MetricCard({
  tone,
  icon,
  label,
  value,
  hint,
}: {
  tone:
    "green"
    | "red"
    | "orange"
    | "blue";

  icon:
    ReactNode;

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
        "card ym-summary-card"
    >

      <div
        className={
          `ym-summary-icon ym-summary-icon--${tone}`
        }
      >
        {icon}
      </div>


      <div
        className=
          "ym-summary-copy"
      >

        <div className="card-label">
          {label}
        </div>


        <div className="big-number">
          {value}
        </div>


        <div className="muted">
          {hint}
        </div>

      </div>

    </div>
  );

}


// ============================================================
// ICONS
// ============================================================

function IconBase({
  children,
}: {
  children:
    ReactNode;
}) {

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );

}


function BarChartIcon() {

  return (
    <IconBase>

      <path
        d="M5 19V11M12 19V5M19 19V8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

    </IconBase>
  );

}


function CancelIcon() {

  return (
    <IconBase>

      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
      />


      <path
        d="m9 9 6 6M15 9l-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

    </IconBase>
  );

}


function CubeIcon() {

  return (
    <IconBase>

      <path
        d="m12 3 7 4-7 4-7-4 7-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />


      <path
        d="M5 7v8l7 4 7-4V7M12 11v8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

    </IconBase>
  );

}


function LinkIcon() {

  return (
    <IconBase>

      <path
        d="m9.5 14.5-1.8 1.8a3 3 0 0 1-4.2-4.2l3.2-3.2a3 3 0 0 1 4.2 0"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />


      <path
        d="m14.5 9.5 1.8-1.8a3 3 0 1 1 4.2 4.2l-3.2 3.2a3 3 0 0 1-4.2 0"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />


      <path
        d="m9 15 6-6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />

    </IconBase>
  );

}


function ArticleIcon() {

  return (
    <IconBase>

      <rect
        x="6"
        y="3"
        width="12"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />


      <path
        d="M9 8h6M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

    </IconBase>
  );

}


function InfoIcon() {

  return (
    <IconBase>

      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.8"
      />


      <path
        d="M12 11v5M12 8h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

    </IconBase>
  );

}


// ============================================================
// PRODUCTS TABLE
// ============================================================

function ProductsTable({
  products,
  metricsByOffer,
  warehouseMetricsByOffer,
  periodDays,
}: {
  products:
    YandexProductRow[];

  metricsByOffer:
    Map<
      string,
      ProductMetrics
    >;

  warehouseMetricsByOffer:
    Map<
      string,
      WarehouseMetrics[]
    >;

  periodDays:
    number;
}) {

  return (
    <div
      style={{
        overflowX:
          "auto",

        marginTop:
          "18px",

        border:
          "none",

        borderRadius:
          "10px",
      }}
    >

      <div
        style={{
          minWidth:
            "1220px",
        }}
      >

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "130px minmax(330px, 2.1fr) minmax(230px, 1.4fr) 135px 135px 110px 110px 115px",

            background:
              "var(--table-header-bg, #1b2028)",

            borderBottom:
              "1px solid var(--table-divider, #282e38)",
          }}
        >

          <MainHeader>
            ЕНОТ
          </MainHeader>


          <MainHeader>
            Товар
          </MainHeader>


          <MainHeader>
            Offer ID
          </MainHeader>


          <MainHeader numeric>
            Продажи {periodDays} дн.
          </MainHeader>


          <MainHeader numeric>
            Среднее / день
          </MainHeader>


          <MainHeader numeric>
            Отмены
          </MainHeader>


          <MainHeader numeric>
            Остаток
          </MainHeader>


          <MainHeader numeric>
            Дней запаса
          </MainHeader>

        </div>


        {
          products.map(
            product => {

              const metrics =
                metricsByOffer.get(
                  product.offer_id
                )
                ??
                {
                  sales:
                    0,

                  cancellations:
                    0,

                  stock:
                    0,
                };


              const average =
                periodDays > 0
                  ? metrics.sales
                    /
                    periodDays
                  : 0;


              const stockDays =
                average > 0
                  ? metrics.stock
                    /
                    average
                  : null;


              const warehouses =
                (
                  warehouseMetricsByOffer.get(
                    product.offer_id
                  )
                  ??
                  []
                ).filter(
                  row =>
                    row.sales > 0
                    ||
                    row.cancellations > 0
                    ||
                    row.stock > 0
                );


              return (
                <details
                  key={
                    product.id
                  }

                  className=
                    "yandex-product-details"

                  style={{
                    borderBottom:
                      "1px solid var(--table-divider, #282e38)",
                  }}
                >

                  <summary
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "130px minmax(330px, 2.1fr) minmax(230px, 1.4fr) 135px 135px 110px 110px 115px",

                      alignItems:
                        "center",

                      cursor:
                        "pointer",

                      userSelect:
                        "none",
                    }}
                  >

                    <MainCell strong>

                      <span
                        style={{
                          display:
                            "inline-flex",

                          alignItems:
                            "center",

                          gap:
                            "8px",
                        }}
                      >

                        <span
                          className=
                            "yandex-product-chevron"
                        >
                          ▶
                        </span>


                        <span>
                          {
                            product.master_code
                            ??
                            "—"
                          }
                        </span>

                      </span>

                    </MainCell>


                    <MainCell strong>
                      {
                        getProductName(
                          product
                        )
                      }
                    </MainCell>


                    <MainCell strong>
                      {
                        product.offer_id
                      }
                    </MainCell>


                    <MainCell
                      numeric
                      strong
                    >
                      {
                        formatInteger(
                          metrics.sales
                        )
                      }
                    </MainCell>


                    <MainCell numeric>
                      {
                        formatAverage(
                          average
                        )
                      }
                    </MainCell>


                    <MainCell numeric>
                      {
                        formatInteger(
                          metrics.cancellations
                        )
                      }
                    </MainCell>


                    <MainCell
                      numeric
                      strong
                    >
                      {
                        formatInteger(
                          metrics.stock
                        )
                      }
                    </MainCell>


                    <MainCell
                      numeric
                      strong
                    >
                      {
                        stockDays ===
                        null
                          ? "—"
                          : formatStockDays(
                              stockDays
                            )
                      }
                    </MainCell>

                  </summary>


                  <div
                    style={{
                      padding:
                        "16px 18px 18px 38px",

                      borderTop:
                        "1px solid var(--table-divider, #282e38)",
                    }}
                  >

                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        gap:
                          "16px",

                        marginBottom:
                          "14px",
                      }}
                    >

                      <div>

                        <div
                          style={{
                            fontSize:
                              "14px",

                            fontWeight:
                              700,
                          }}
                        >
                          Продажи и остатки по складам
                        </div>


                        <div
                          className="muted"

                          style={{
                            marginTop:
                              "4px",

                            fontSize:
                              "11px",
                          }}
                        >
                          По конкретным складам
                          Яндекс Маркета.
                        </div>

                      </div>


                      <div
                        style={{
                          display:
                            "flex",

                          gap:
                            "18px",

                          fontSize:
                            "12px",

                          fontWeight:
                            700,
                        }}
                      >

                        <span>
                          Строк:{" "}
                          {
                            formatInteger(
                              warehouses.length
                            )
                          }
                        </span>


                        <span>
                          Продажи:{" "}
                          {
                            formatInteger(
                              metrics.sales
                            )
                          }
                        </span>


                        <span>
                          Отмены:{" "}
                          {
                            formatInteger(
                              metrics.cancellations
                            )
                          }
                        </span>


                        <span>
                          Остаток:{" "}
                          {
                            formatInteger(
                              metrics.stock
                            )
                          }
                        </span>

                      </div>

                    </div>


                    {
                      warehouses.length >
                      0
                        ? (

                          <WarehouseTable
                            offerId={
                              product.offer_id
                            }

                            productId={
                              product.market_sku
                              ??
                              "—"
                            }

                            rows={
                              warehouses
                            }

                            periodDays={
                              periodDays
                            }
                          />

                        )
                        : (

                          <div className="reason-text">
                            Нет данных по складам.
                          </div>

                        )
                    }

                  </div>

                </details>
              );

            }
          )
        }

      </div>

    </div>
  );

}


// ============================================================
// WAREHOUSE TABLE
// ============================================================

function WarehouseTable({
  offerId,
  productId,
  rows,
  periodDays,
}: {
  offerId:
    string;

  productId:
    string;

  rows:
    WarehouseMetrics[];

  periodDays:
    number;
}) {

  return (
    <div
      style={{
        overflowX:
          "auto",
      }}
    >

      <table
        style={{
          width:
            "100%",

          minWidth:
            "1000px",

          borderCollapse:
            "separate",

          borderSpacing:
            0,

          border:
            "none",
        }}
      >

        <thead>

          <tr>

            <WarehouseHeader>
              Offer ID
            </WarehouseHeader>


            <WarehouseHeader>
              Product ID
            </WarehouseHeader>


            <WarehouseHeader>
              Склад
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Продажи {periodDays} дн.
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Среднее / день
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Отмены
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Остаток
            </WarehouseHeader>


            <WarehouseHeader numeric>
              Дней запаса
            </WarehouseHeader>

          </tr>

        </thead>


        <tbody>

          {
            rows.map(
              (
                row,
                index
              ) => {

                const average =
                  periodDays > 0
                    ? row.sales
                      /
                      periodDays
                    : 0;


                const stockDays =
                  average > 0
                    ? row.stock
                      /
                      average
                    : null;


                const divider =
                  index ===
                  rows.length - 1
                    ? "none"
                    : "1px solid var(--table-divider, #282e38)";


                return (
                  <tr
                    key={
                      [
                        offerId,
                        row.warehouseId
                        ??
                        "null",
                        row.warehouseName,
                      ].join("|")
                    }
                  >

                    <WarehouseCell
                      divider={
                        divider
                      }

                      strong
                    >
                      {offerId}
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }
                    >
                      {productId}
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }
                    >
                      {row.warehouseName}
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric
                      strong
                    >
                      {
                        formatInteger(
                          row.sales
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric
                    >
                      {
                        formatAverage(
                          average
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric
                    >
                      {
                        formatInteger(
                          row.cancellations
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric
                      strong
                    >
                      {
                        formatInteger(
                          row.stock
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
                      divider={
                        divider
                      }

                      numeric
                      strong
                    >
                      {
                        stockDays ===
                        null
                          ? "—"
                          : formatStockDays(
                              stockDays
                            )
                      }
                    </WarehouseCell>

                  </tr>
                );

              }
            )
          }

        </tbody>

      </table>

    </div>
  );

}


// ============================================================
// CELLS
// ============================================================

function MainHeader({
  children,
  numeric = false,
}: {
  children:
    ReactNode;

  numeric?:
    boolean;
}) {

  return (
    <div
      style={{
        padding:
          "12px 14px",

        textAlign:
          numeric
            ? "right"
            : "left",

        fontSize:
          "12px",

        fontWeight:
          700,

        color:
          "var(--text-secondary, #b8c0cc)",

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </div>
  );

}


function MainCell({
  children,
  numeric = false,
  strong = false,
}: {
  children:
    ReactNode;

  numeric?:
    boolean;

  strong?:
    boolean;
}) {

  return (
    <div
      style={{
        padding:
          "12px 14px",

        textAlign:
          numeric
            ? "right"
            : "left",

        fontSize:
          "13px",

        lineHeight:
          1.35,

        fontWeight:
          strong
            ? 700
            : 500,

        minWidth:
          0,
      }}
    >
      {children}
    </div>
  );

}


function WarehouseHeader({
  children,
  numeric = false,
}: {
  children:
    ReactNode;

  numeric?:
    boolean;
}) {

  return (
    <th
      style={{
        padding:
          "12px 14px",

        textAlign:
          numeric
            ? "right"
            : "left",

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


function WarehouseCell({
  children,
  divider,
  numeric = false,
  strong = false,
}: {
  children:
    ReactNode;

  divider:
    string;

  numeric?:
    boolean;

  strong?:
    boolean;
}) {

  return (
    <td
      style={{
        padding:
          "12px 14px",

        textAlign:
          numeric
            ? "right"
            : "left",

        fontSize:
          "13px",

        lineHeight:
          1.35,

        fontWeight:
          strong
            ? 700
            : 500,

        border:
          "none",

        borderBottom:
          divider,

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </td>
  );

}
