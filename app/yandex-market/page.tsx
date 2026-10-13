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

import "./yandex-reference.css";


export const dynamic =
  "force-dynamic";


// ============================================================
// TYPES
// ============================================================

type RawYandexProduct = {
  offer?: {
    offerId?: string;
    name?: string;
    vendor?: string;
    vendorCode?: string;
    barcodes?: string[];
  };

  mapping?: {
    marketSku?: string;
    marketSkuName?: string;
    marketModelName?: string;
    marketCategoryId?: number;
    marketCategoryName?: string;
  };
};


type YandexProductRow = {
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

  master_code:
    | string
    | null;

  first_seen_at:
    string;

  last_seen_at:
    string;

  is_active:
    boolean;

  raw_data:
    | RawYandexProduct
    | null;

  created_at:
    string;

  updated_at:
    string;
};


type StockSyncRunRow = {
  id:
    string;

  created_at:
    string;
};


type StockSnapshotRow = {
  offer_id:
    string;

  warehouse_id:
    number
    |
    null;

  warehouse_name:
    string
    |
    null;

  available:
    number;
};


type SalesSyncRunRow = {
  id:
    string;

  date_from:
    string;

  date_to:
    string;

  created_at:
    string;

  finished_at:
    string
    |
    null;
};


type SalesDailyRow = {
  shop_sku:
    string;

  warehouse_id:
    number
    |
    null;

  warehouse_name:
    string
    |
    null;

  sales_quantity:
    number;

  cancelled_quantity:
    number;

  unredeemed_quantity:
    number;

  updated_at:
    string;
};


type ProductMetrics = {
  sales:
    number;

  cancellations:
    number;

  stock:
    number;
};


type WarehouseMetrics = {
  warehouseId:
    number
    |
    null;

  warehouseName:
    string;

  sales:
    number;

  cancellations:
    number;

  stock:
    number;
};


type YandexReferenceIconName =
  | "clock"
  | "products"
  | "active"
  | "id"
  | "unlinked"
  | "category"
  | "linked";


// ============================================================
// ICONS
// ============================================================

function YandexReferenceIcon({
  name,
}: {
  name:
    YandexReferenceIconName;
}) {

  if (
    name ===
    "clock"
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
    name ===
    "active"
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
          d="m8.5 12 2.3 2.3 4.7-5"
        />

      </svg>

    );

  }


  if (
    name ===
    "id"
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
          height="14"
          rx="2"
        />

        <circle
          cx="8"
          cy="11"
          r="2"
        />

        <path
          d="M13 10h5M13 14h4"
        />

      </svg>

    );

  }


  if (
    name ===
    "category"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <rect
          x="4"
          y="4"
          width="6"
          height="6"
          rx="1"
        />

        <rect
          x="14"
          y="4"
          width="6"
          height="6"
          rx="1"
        />

        <rect
          x="4"
          y="14"
          width="6"
          height="6"
          rx="1"
        />

        <rect
          x="14"
          y="14"
          width="6"
          height="6"
          rx="1"
        />

      </svg>

    );

  }


  if (
    name ===
    "linked"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <path
          d="
            M9 15
            7.5 16.5
            a4 4 0 0 1-5.7-5.7
            l3-3
            a4 4 0 0 1 5.7 0
          "
        />

        <path
          d="
            M15 9
            16.5 7.5
            a4 4 0 0 1 5.7 5.7
            l-3 3
            a4 4 0 0 1-5.7 0
          "
        />

        <path
          d="m8 16 8-8"
        />

      </svg>

    );

  }


  if (
    name ===
    "unlinked"
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
          d="M12 8v5"
        />

        <path
          d="M12 16h.01"
        />

      </svg>

    );

  }


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


// ============================================================
// SUPABASE CONFIG
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


  if (
    !supabaseUrl
  ) {

    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL или SUPABASE_URL"
    );

  }


  if (
    !supabaseSecretKey
  ) {

    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


// ============================================================
// HEADERS
// ============================================================

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


// ============================================================
// GENERIC LOADERS
// ============================================================

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


  while (
    true
  ) {

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
          method:
            "GET",

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


    if (
      !response.ok
    ) {

      throw new Error(
        `Supabase ${table}: HTTP ${response.status}: ${text}`
      );

    }


    const rows =
      JSON.parse(
        text
      ) as
        T[];


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
        method:
          "GET",

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


  if (
    !response.ok
  ) {

    throw new Error(
      `Supabase ${table}: HTTP ${response.status}: ${text}`
    );

  }


  return JSON.parse(
    text
  ) as
    T[];

}


// ============================================================
// PRODUCTS
// ============================================================

async function getYandexProducts():
Promise<YandexProductRow[]> {

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
    ].join(
      ","
    ),

    {
      order:
        "offer_id.asc",
    }
  );

}


// ============================================================
// STOCKS
// ============================================================

async function getLatestStockRun():
Promise<StockSyncRunRow | null> {

  const rows =
    await fetchRows<
      StockSyncRunRow
    >(
      "yandex_stock_sync_runs",

      "id,created_at",

      {
        status:
          "eq.success",

        order:
          "created_at.desc",

        limit:
          "1",
      }
    );


  return rows[
    0
  ]
  ??
  null;

}


async function getStockSnapshots(
  syncRunId:
    string
):
Promise<StockSnapshotRow[]> {

  return fetchAllRows<
    StockSnapshotRow
  >(
    "yandex_stock_snapshots",

    [
      "offer_id",
      "warehouse_id",
      "warehouse_name",
      "available",
    ].join(
      ","
    ),

    {
      sync_run_id:
        `eq.${syncRunId}`,
    }
  );

}


// ============================================================
// SALES
// ============================================================

async function getLatestSalesRun():
Promise<SalesSyncRunRow | null> {

  const rows =
    await fetchRows<
      SalesSyncRunRow
    >(
      "yandex_sales_sync_runs",

      [
        "id",
        "date_from",
        "date_to",
        "created_at",
        "finished_at",
      ].join(
        ","
      ),

      {
        status:
          "eq.success",

        order:
          "created_at.desc",

        limit:
          "1",
      }
    );


  return rows[
    0
  ]
  ??
  null;

}


async function getSalesDaily(
  syncRunId:
    string
):
Promise<SalesDailyRow[]> {

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
      "updated_at",
    ].join(
      ","
    ),

    {
      last_sync_run_id:
        `eq.${syncRunId}`,
    }
  );

}


// ============================================================
// FORMAT
// ============================================================

function formatDateTimeKrasnoyarsk(
  value:
    string
    |
    null
    |
    undefined
):
string {

  if (
    !value
  ) {

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


function formatInteger(
  value:
    number
):
string {

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
):
string {

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
):
string {

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


// ============================================================
// PRODUCT HELPERS
// ============================================================

function getProductName(
  product:
    YandexProductRow
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


function getLatestCatalogSync(
  products:
    YandexProductRow[]
):
string | null {

  let latest:
    string | null =
      null;


  let latestTime =
    0;


  for (
    const product
    of products
  ) {

    const time =
      new Date(
        product.last_seen_at
      ).getTime();


    if (
      Number.isFinite(
        time
      )
      &&
      time >
        latestTime
    ) {

      latestTime =
        time;

      latest =
        product.last_seen_at;

    }

  }


  return latest;

}


function getLatestSalesDailyUpdate(
  rows:
    SalesDailyRow[]
):
string | null {

  let latest:
    string | null =
      null;


  let latestTime =
    0;


  for (
    const row
    of rows
  ) {

    const time =
      new Date(
        row.updated_at
      ).getTime();


    if (
      Number.isFinite(
        time
      )
      &&
      time >
        latestTime
    ) {

      latestTime =
        time;

      latest =
        row.updated_at;

    }

  }


  return latest;

}


function getPeriodDays(
  dateFrom:
    string,

  dateTo:
    string
):
number {

  const start =
    new Date(
      `${dateFrom}T00:00:00Z`
    );


  const end =
    new Date(
      `${dateTo}T00:00:00Z`
    );


  const days =
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
    1;


  return days >
    0

    ? days

    : 28;

}


// ============================================================
// WAREHOUSE METRICS
// ============================================================

function getWarehouseKey(
  warehouseId:
    number
    |
    null,

  warehouseName:
    string
    |
    null
):
string {

  if (
    warehouseId !==
    null
  ) {

    return `id:${warehouseId}`;

  }


  return `name:${warehouseName?.trim() || "—"}`;

}


function buildWarehouseMetricsByOffer(
  stockRows:
    StockSnapshotRow[],

  salesRows:
    SalesDailyRow[]
):
Map<
  string,
  WarehouseMetrics[]
> {

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
      |
      null,

    warehouseName:
      string
      |
      null
  ):
  WarehouseMetrics {

    let offerMap =
      result.get(
        offerId
      );


    if (
      !offerMap
    ) {

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


    if (
      !metric
    ) {

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

    const metric =
      getOrCreate(
        row.offer_id,
        row.warehouse_id,
        row.warehouse_name
      );


    metric.stock +=
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

    const rows =
      Array.from(
        warehouses.values()
      );


    rows.sort(
      (
        a,
        b
      ) =>
        a.warehouseName.localeCompare(
          b.warehouseName,
          "ru"
        )
    );


    finalMap.set(
      offerId,
      rows
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


  let loadError:
    string | null =
      null;


  let syncStateError:
    string | null =
      null;


  let stockUpdatedAt:
    string | null =
      null;


  let salesUpdatedAt:
    string | null =
      null;


  let salesPeriodDays =
    28;


  // ==========================================================
  // PRODUCTS
  // ==========================================================

  try {

    products =
      await getYandexProducts();

  } catch (
    error
  ) {

    loadError =
      error instanceof Error

        ? error.message

        : String(
            error
          );

  }


  // ==========================================================
  // STOCKS
  // ==========================================================

  try {

    const stockRun =
      await getLatestStockRun();


    if (
      stockRun
    ) {

      stockUpdatedAt =
        stockRun.created_at;


      stockRows =
        await getStockSnapshots(
          stockRun.id
        );

    }

  } catch (
    error
  ) {

    syncStateError =
      error instanceof Error

        ? error.message

        : String(
            error
          );

  }


  // ==========================================================
  // SALES
  // ==========================================================

  try {

    const salesRun =
      await getLatestSalesRun();


    if (
      salesRun
    ) {

      salesPeriodDays =
        getPeriodDays(
          salesRun.date_from,
          salesRun.date_to
        );


      salesRows =
        await getSalesDaily(
          salesRun.id
        );


      salesUpdatedAt =
        getLatestSalesDailyUpdate(
          salesRows
        )
        ??
        salesRun.finished_at
        ??
        salesRun.created_at;

    }

  } catch (
    error
  ) {

    const message =
      error instanceof Error

        ? error.message

        : String(
            error
          );


    syncStateError =
      syncStateError

        ? `${syncStateError}; ${message}`

        : message;

  }


  // ==========================================================
  // TOTALS BY OFFER
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
  // CATALOG
  // ==========================================================

  const latestCatalogSync =
    getLatestCatalogSync(
      products
    );


  const activeProducts =
    products.filter(
      product =>
        product.is_active
    );


  const productsWithMarketSku =
    products.filter(
      product =>
        Boolean(
          product.market_sku
            ?.trim()
        )
    );


  const unlinkedProducts =
    products.filter(
      product =>
        !product.master_code
        ||
        product.master_code
          .trim() ===
          ""
    );


  const categories =
    new Set(
      products
        .map(
          product =>
            product
              .market_category_name
              ?.trim()
        )
        .filter(
          (
            value
          ):
          value is string =>
            Boolean(
              value
            )
        )
    );


  const sortedProducts =
    [
      ...products,
    ].sort(
      (
        a,
        b
      ) => {

        const aMaster =
          a.master_code
            ?.trim()
          ??
          "";


        const bMaster =
          b.master_code
            ?.trim()
          ??
          "";


        const masterCompare =
          aMaster.localeCompare(
            bMaster,
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

      <div
        className=
          "container"
      >

        {/* ===================================
            HEADER
            =================================== */}

        <header
          className=
            "header yandex-header"
        >

          <div
            className=
              "yandex-title-wrap"
          >

            <span
              className=
                "yandex-title-icon"
            >

              <img
                src=
                  "/logos/yandex-market.png"

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
                Яндекс Маркет — синхронизация
              </h1>


              <p
                className=
                  "subtitle"
              >
                FBY продажи, отмены
                и доступные остатки
                Яндекс Маркета.
              </p>

            </div>

          </div>


          <div
            className=
              "header-actions yandex-header-actions"
          >

            <ThemeToggle />


            <Link
              href=
                "/stock-import"

              className=
                "secondary-button yandex-navigation-button"
            >
              Остатки склада
            </Link>


            <Link
              href="/"

              className=
                "secondary-button yandex-navigation-button"
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

              <section
                className=
                  "section yandex-error-section"
              >

                <div
                  className=
                    "yandex-error-title"
                >
                  Ошибка загрузки данных
                  Яндекс Маркета
                </div>


                <div
                  className=
                    "reason-text yandex-error-text"
                >
                  {
                    loadError
                  }
                </div>

              </section>

            )

            : null
        }


        {/* ===================================
            CATALOG STATUS
            =================================== */}

        <section
          className=
            "section yandex-catalog-section"
        >

          <div
            className=
              "yandex-section-top"
          >

            <div
              className=
                "yandex-section-heading"
            >

              <h2
                className=
                  "section-title"
              >
                Состояние каталога
              </h2>


              <div
                className=
                  "reason-text"
              >
                Последняя успешная загрузка
                каталога Яндекс Маркета.
              </div>

            </div>


            <span
              className={
                latestCatalogSync

                  ? "yandex-status-badge yandex-status-badge--success"

                  : "yandex-status-badge yandex-status-badge--warning"
              }
            >

              <span
                className=
                  "yandex-status-dot"
              />


              {
                latestCatalogSync

                  ? "Каталог загружен"

                  : "Нет успешной загрузки"
              }

            </span>

          </div>


          <div
            className=
              "yandex-status-grid"
          >

            <InfoCard
              icon="clock"

              label=
                "Последняя синхронизация"

              value={
                formatDateTimeKrasnoyarsk(
                  latestCatalogSync
                )
              }

              hint=
                "Красноярское время"
            />


            <InfoCard
              icon="products"

              label=
                "Товаров каталога"

              value={
                formatInteger(
                  products.length
                )
              }

              hint=
                "строк yandex_products"
            />


            <InfoCard
              icon="active"

              label=
                "Активных товаров"

              value={
                formatInteger(
                  activeProducts.length
                )
              }

              hint=
                "is_active = true"
            />


            <InfoCard
              icon="id"

              label=
                "Product ID"

              value={
                formatInteger(
                  productsWithMarketSku
                    .length
                )
              }

              hint=
                "есть marketSku"
            />


            <InfoCard
              icon="unlinked"

              label=
                "Без master_code"

              value={
                formatInteger(
                  unlinkedProducts.length
                )
              }

              hint=
                "требуют привязки"
            />

          </div>

        </section>


        {/* ===================================
            UPDATE
            =================================== */}

        <section
          className=
            "section yandex-update-section"
        >

          <h2
            className=
              "section-title"
          >
            Обновление данных
          </h2>


          <div
            className=
              "reason-text"
          >
            Остатки и продажи обновляются
            независимо друг от друга.
          </div>


          {
            syncStateError

              ? (

                <div
                  className=
                    "reason-text yandex-update-error"
                >
                  {
                    syncStateError
                  }
                </div>

              )

              : null
          }


          <YandexSyncActionsClient
            initialStockUpdatedAt={
              stockUpdatedAt
            }

            initialSalesUpdatedAt={
              salesUpdatedAt
            }
          />

        </section>


        {/* ===================================
            CATALOG SUMMARY
            =================================== */}

        <section
          className=
            "section yandex-summary-section"
        >

          <div
            className=
              "yandex-summary-header"
          >

            <h2
              className=
                "section-title"
            >
              Каталог
            </h2>


            <div
              className=
                "reason-text"
            >
              Состояние привязки каталога
              к единой номенклатуре WorkSpace.
            </div>

          </div>


          <div
            className=
              "yandex-summary-grid"
          >

            <SummaryCard
              icon="category"

              tone="yellow"

              label=
                "Категорий"

              value={
                formatInteger(
                  categories.size
                )
              }

              hint=
                "уникальных категорий Маркета"
            />


            <SummaryCard
              icon="linked"

              tone="green"

              label=
                "Привязано к master_code"

              value={
                formatInteger(
                  products.length
                  -
                  unlinkedProducts.length
                )
              }

              hint=
                "размещений"
            />


            <SummaryCard
              icon="unlinked"

              tone="orange"

              label=
                "Требуют привязки"

              value={
                formatInteger(
                  unlinkedProducts.length
                )
              }

              hint=
                "без master_code"
            />

          </div>

        </section>


        {/* ===================================
            UNLINKED
            =================================== */}

        <section
          className=
            "section yandex-unlinked-section"
        >

          <div
            className=
              "yandex-unlinked-header"
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
                Новые товары Яндекс Маркета,
                которые пока не связаны
                с физическим товаром.
              </div>

            </div>


            <span
              className={
                unlinkedProducts.length >
                0

                  ? "yandex-unlinked-badge yandex-unlinked-badge--warning"

                  : "yandex-unlinked-badge yandex-unlinked-badge--success"
              }
            >

              <span
                className=
                  "yandex-status-dot"
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
              "yandex-unlinked-content"
          >

            <YandexUnlinkedProductsClient
              products={
                unlinkedProducts
              }
            />

          </div>

        </section>


        {/* ===================================
            PRODUCTS
            =================================== */}

        <section
          className=
            "section yandex-products-section"
        >

          <div
            className=
              "yandex-products-header"
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
              Основная строка показывает
              общие показатели артикула.
            </div>


            <div
              className=
                "reason-text"
            >
              Раскрытие:
              продажи, отмены,
              средние продажи,
              остаток и дни запаса
              отдельно по складам
              Яндекс Маркета.
            </div>

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
// INFO CARD
// ============================================================

function InfoCard({
  icon,
  label,
  value,
  hint,
}: {
  icon:
    YandexReferenceIconName;

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
        "yandex-info-card"
    >

      <span
        className=
          "yandex-info-icon"
      >

        <YandexReferenceIcon
          name={
            icon
          }
        />

      </span>


      <div
        className=
          "yandex-info-copy"
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
            "yandex-info-value"
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
    YandexReferenceIconName;

  tone:
    "yellow"
    |
    "green"
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
        "yandex-summary-card"
    >

      <span
        className={
          `yandex-summary-icon yandex-summary-icon--${tone}`
        }
      >

        <YandexReferenceIcon
          name={
            icon
          }
        />

      </span>


      <div>

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
      className=
        "yandex-products-table-shell"
    >

      <div
        className=
          "yandex-products-table"
      >

        {/* ===================================
            TABLE HEADER
            =================================== */}

        <div
          className=
            "yandex-products-grid yandex-products-table-header"
        >

          <MainHeader>
            master_code
          </MainHeader>


          <MainHeader>
            Товар
          </MainHeader>


          <MainHeader>
            Offer ID
          </MainHeader>


          <MainHeader
            numeric
          >
            Продажи {periodDays} дн.
          </MainHeader>


          <MainHeader
            numeric
          >
            Среднее / день
          </MainHeader>


          <MainHeader
            numeric
          >
            Отмены
          </MainHeader>


          <MainHeader
            numeric
          >
            Остаток
          </MainHeader>


          <MainHeader
            numeric
          >
            Дней запаса
          </MainHeader>

        </div>


        {/* ===================================
            PRODUCT ROWS
            =================================== */}

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
                periodDays >
                0

                  ? metrics.sales
                    /
                    periodDays

                  : 0;


              const stockDays =
                average >
                0

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
                )
                .filter(
                  row =>
                    row.sales >
                      0
                    ||
                    row.cancellations >
                      0
                    ||
                    row.stock >
                      0
                );


              return (

                <details
                  key={
                    product.id
                  }

                  className=
                    "yandex-product-details"
                >

                  <summary
                    className=
                      "yandex-products-grid"
                  >

                    <MainCell
                      strong
                    >

                      <span
                        className=
                          "yandex-product-chevron"
                        aria-hidden="true"
                      >
                        ▶
                      </span>


                      <span
                        className={
                          product.master_code

                            ? "yandex-master-code"

                            : undefined
                        }
                      >
                        {
                          product.master_code
                          ??
                          "—"
                        }
                      </span>

                    </MainCell>


                    <MainCell
                      strong
                    >
                      {
                        getProductName(
                          product
                        )
                      }
                    </MainCell>


                    <MainCell
                      strong
                    >
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


                    <MainCell
                      numeric
                    >
                      {
                        formatAverage(
                          average
                        )
                      }
                    </MainCell>


                    <MainCell
                      numeric
                    >
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
                    className=
                      "yandex-warehouse-panel"
                  >

                    <div
                      className=
                        "yandex-warehouse-heading"
                    >

                      <div>

                        <div
                          className=
                            "yandex-warehouse-title"
                        >
                          Продажи и остатки по складам
                        </div>


                        <div
                          className=
                            "muted"
                        >
                          По конкретным складам
                          Яндекс Маркета.
                        </div>

                      </div>


                      <div
                        className=
                          "yandex-warehouse-summary"
                      >

                        <span>
                          Строк:{" "}

                          <strong>
                            {
                              formatInteger(
                                warehouses.length
                              )
                            }
                          </strong>
                        </span>


                        <span>
                          Продажи:{" "}

                          <strong>
                            {
                              formatInteger(
                                metrics.sales
                              )
                            }
                          </strong>
                        </span>


                        <span>
                          Отмены:{" "}

                          <strong>
                            {
                              formatInteger(
                                metrics.cancellations
                              )
                            }
                          </strong>
                        </span>


                        <span>
                          Остаток:{" "}

                          <strong>
                            {
                              formatInteger(
                                metrics.stock
                              )
                            }
                          </strong>
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

                          <div
                            className=
                              "yandex-warehouse-empty"
                          >
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
      className=
        "yandex-warehouse-table-shell"
    >

      <table
        className=
          "yandex-warehouse-table"
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


            <WarehouseHeader
              numeric
            >
              Продажи {periodDays} дн.
            </WarehouseHeader>


            <WarehouseHeader
              numeric
            >
              Среднее / день
            </WarehouseHeader>


            <WarehouseHeader
              numeric
            >
              Отмены
            </WarehouseHeader>


            <WarehouseHeader
              numeric
            >
              Остаток
            </WarehouseHeader>


            <WarehouseHeader
              numeric
            >
              Дней запаса
            </WarehouseHeader>

          </tr>

        </thead>


        <tbody>

          {
            rows.map(
              row => {

                const average =
                  periodDays >
                  0

                    ? row.sales
                      /
                      periodDays

                    : 0;


                const stockDays =
                  average >
                  0

                    ? row.stock
                      /
                      average

                    : null;


                return (

                  <tr
                    key={
                      [
                        offerId,
                        row.warehouseId
                        ??
                        "null",
                        row.warehouseName,
                      ].join(
                        "|"
                      )
                    }
                  >

                    <WarehouseCell
                      strong
                    >
                      {
                        offerId
                      }
                    </WarehouseCell>


                    <WarehouseCell>
                      {
                        productId
                      }
                    </WarehouseCell>


                    <WarehouseCell>
                      {
                        row.warehouseName
                      }
                    </WarehouseCell>


                    <WarehouseCell
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
                      numeric
                    >
                      {
                        formatAverage(
                          average
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
                      numeric
                    >
                      {
                        formatInteger(
                          row.cancellations
                        )
                      }
                    </WarehouseCell>


                    <WarehouseCell
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
// MAIN HEADER
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
      className={
        numeric

          ? "yandex-main-header yandex-main-header--right"

          : "yandex-main-header"
      }
    >
      {
        children
      }
    </div>

  );

}


// ============================================================
// MAIN CELL
// ============================================================

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

  const classes = [
    "yandex-main-cell",

    numeric
      ? "yandex-main-cell--right"
      : "",

    strong
      ? "yandex-main-cell--strong"
      : "",
  ]
    .filter(
      Boolean
    )
    .join(
      " "
    );


  return (

    <div
      className={
        classes
      }
    >
      {
        children
      }
    </div>

  );

}


// ============================================================
// WAREHOUSE HEADER
// ============================================================

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
      className={
        numeric

          ? "yandex-table-right"

          : undefined
      }
    >
      {
        children
      }
    </th>

  );

}


// ============================================================
// WAREHOUSE CELL
// ============================================================

function WarehouseCell({
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

    <td
      className={
        numeric

          ? "yandex-table-right"

          : undefined
      }
    >

      {
        strong

          ? (

            <strong>
              {
                children
              }
            </strong>

          )

          : children
      }

    </td>

  );

}
