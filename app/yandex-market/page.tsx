import {
  type ReactNode,
} from "react";

import Link
  from "next/link";

import ThemeToggle
  from "../ThemeToggle";

import MarketplaceSuppliesPanel
  from "../MarketplaceSuppliesPanel";

import WorkspaceCollapsiblePanel
  from "../WorkspaceCollapsiblePanel";

import YandexUnlinkedProductsClient
  from "./YandexUnlinkedProductsClient";

import YandexSyncActionsClient
  from "./YandexSyncActionsClient";

import YandexProductsSectionClient
  from "./YandexProductsSectionClient";

import YandexFbySupplyPlanner
  from "./YandexFbySupplyPlanner";

import YandexProductsTableClient, {
  type YandexProductsTableItem,
} from "./YandexProductsTableClient";

import "./yandex-reference-top.css";
import "./yandex-products-table.css";


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
    number | null,

  warehouseName:
    string | null
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
      number | null,

    warehouseName:
      string | null
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

    const [
      productsResult,
      fullSync,
      stockRun,
      salesRun,
    ] =
      await Promise.all([
        getYandexProducts(),
        getLatestFullSync(),
        getLatestStockRun(),
        getLatestSalesRun(),
      ]);


    products =
      productsResult;


    fullSyncUpdatedAt =
      fullSync
        ?.finished_at
      ??
      null;


    if (
      stockRun
      &&
      salesRun
    ) {

      const [
        loadedStockRows,
        loadedSalesRows,
      ] =
        await Promise.all([
          getStockSnapshots(
            stockRun.id
          ),
          getSalesDaily(
            salesRun.id
          ),
        ]);


      stockRows =
        loadedStockRows;


      salesRows =
        loadedSalesRows;

    } else if (
      stockRun
    ) {

      stockRows =
        await getStockSnapshots(
          stockRun.id
        );

    } else if (
      salesRun
    ) {

      salesRows =
        await getSalesDaily(
          salesRun.id
        );

    }


    if (
      salesRun
    ) {

      salesPeriodDateFrom =
        salesRun.date_from;


      salesPeriodDateTo =
        salesRun.date_to;


      salesPeriodDays =
        getPeriodDays(
          salesRun.date_from,
          salesRun.date_to
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


  // ==========================================================
  // SERIALIZABLE TABLE ITEMS
  // ==========================================================

  const productTableItems:
    YandexProductsTableItem[] =

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


          return {
            id:
              product.id,

            master_code:
              product.master_code,

            name:
              getProductName(
                product
              ),

            offer_id:
              product.offer_id,

            market_sku:
              product.market_sku,

            sales:
              metrics.sales,

            cancellations:
              metrics.cancellations,

            stock:
              metrics.stock,

            warehouses:
              warehouses.map(
                row => ({
                  warehouseId:
                    row.warehouseId,

                  warehouseName:
                    row.warehouseName,

                  sales:
                    row.sales,

                  cancellations:
                    row.cancellations,

                  stock:
                    row.stock,
                })
              ),
          };

        }
      );


  return (
    <main
      className=
        "page yandex-reference-page"
    >

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
                "secondary-button workspace-home-button navigation-button ym-navigation-button"
            >
              Главная
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
            УПРАВЛЕНИЕ ПОСТАВКАМИ
            =================================== */}

        <YandexFbySupplyPlanner />

        <MarketplaceSuppliesPanel
          marketplace="yandex"
          endpoint="/api/yandex/supplies"
          title="Поставки Яндекс Маркета"
        />


        {/* ===================================
            UNLINKED
            =================================== */}

        <WorkspaceCollapsiblePanel
          tone="yandex"
          icon="unlinked"
          title="Товары без ЕНОТ"
          subtitle="Новые товары Яндекс Маркета, для которых пока не указан ЕНОТ."
          meta={
            `Непривязанных: ${unlinkedProducts.length}`
          }
        >

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
                    padding:
                      "14px 18px 16px",
                  }}
                >
                  Непривязанных товаров нет.
                </div>
              )
          }

        </WorkspaceCollapsiblePanel>


        {/* ===================================
            PRODUCTS
            =================================== */}

        <YandexProductsSectionClient>

          <YandexProductsTableClient
            items={
              productTableItems
            }

            periodDays={
              salesPeriodDays
            }
          />

        </YandexProductsSectionClient>

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
