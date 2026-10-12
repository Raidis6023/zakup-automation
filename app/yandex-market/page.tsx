import {
  Fragment,
  type CSSProperties,
  type ReactNode,
} from "react";

import Link from "next/link";

import ThemeToggle from "../ThemeToggle";

import YandexUnlinkedProductsClient
  from "./YandexUnlinkedProductsClient";

import YandexSyncActionsClient
  from "./YandexSyncActionsClient";


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
  created_at: string;
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

  created_at: string;

  finished_at:
    | string
    | null;
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

  updated_at: string;
};


type ProductMetrics = {
  sales: number;

  cancellations: number;

  stock: number;
};


type WarehouseMetrics = {
  warehouseId:
    number | null;

  warehouseName: string;

  sales: number;

  cancellations: number;

  stock: number;
};


type ProductGroup = {
  key: string;

  masterCode:
    string | null;

  name: string;

  products:
    YandexProductRow[];
};


type PlacementWarehouseRow = {
  offerId: string;

  productId: string;

  warehouseId:
    number | null;

  warehouseName: string;

  sales: number;

  cancellations: number;

  stock: number;
};


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


// ============================================================
// HEADERS
// ============================================================

function getSupabaseHeaders(
  secretKey: string
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
// LOADERS
// ============================================================

async function fetchAllRows<T>(
  table: string,
  select: string,
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
  table: string,
  select: string,
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
    ].join(","),

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


  return rows[0]
    ??
    null;

}


async function getStockSnapshots(
  syncRunId: string
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
    ].join(","),

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
      ].join(","),

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
  syncRunId: string
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
    ].join(","),

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
    | null
    | undefined
):
string {

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


function formatInteger(
  value: number
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
  value: number
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
  value: number
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


function formatPlacementsCount(
  count: number
):
string {

  const mod10 =
    count % 10;


  const mod100 =
    count % 100;


  if (
    mod10 === 1
    &&
    mod100 !== 11
  ) {

    return `${count} размещение`;

  }


  if (
    mod10 >= 2
    &&
    mod10 <= 4
    &&
    (
      mod100 < 12
      ||
      mod100 > 14
    )
  ) {

    return `${count} размещения`;

  }


  return `${count} размещений`;

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


  if (offerName) {
    return offerName;
  }


  const marketName =
    product
      .raw_data
      ?.mapping
      ?.marketSkuName
      ?.trim();


  if (marketName) {
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
  dateFrom: string,
  dateTo: string
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


  return days > 0
    ? days
    : 28;

}


// ============================================================
// PRODUCT GROUPS
// ============================================================

function buildProductGroups(
  products:
    YandexProductRow[]
):
ProductGroup[] {

  const linkedGroups =
    new Map<
      string,
      ProductGroup
    >();


  const unlinkedGroups:
    ProductGroup[] =
    [];


  for (
    const product
    of products
  ) {

    const masterCode =
      product.master_code
        ?.trim()
      ||
      null;


    if (!masterCode) {

      unlinkedGroups.push(
        {
          key:
            `unlinked:${product.id}`,

          masterCode:
            null,

          name:
            getProductName(
              product
            ),

          products: [
            product,
          ],
        }
      );


      continue;

    }


    let group =
      linkedGroups.get(
        masterCode
      );


    if (!group) {

      group = {
        key:
          masterCode,

        masterCode,

        name:
          getProductName(
            product
          ),

        products:
          [],
      };


      linkedGroups.set(
        masterCode,
        group
      );

    }


    group.products.push(
      product
    );

  }


  const groups =
    [
      ...unlinkedGroups,

      ...Array.from(
        linkedGroups.values()
      ),
    ];


  groups.sort(
    (
      a,
      b
    ) => {

      if (
        !a.masterCode
        &&
        b.masterCode
      ) {

        return -1;

      }


      if (
        a.masterCode
        &&
        !b.masterCode
      ) {

        return 1;

      }


      return (
        a.masterCode
        ??
        a.name
      )
        .localeCompare(
          b.masterCode
          ??
          b.name,
          "ru"
        );

    }
  );


  for (
    const group
    of groups
  ) {

    group.products.sort(
      (
        a,
        b
      ) =>
        a.offer_id.localeCompare(
          b.offer_id,
          "ru"
        )
    );

  }


  return groups;

}


// ============================================================
// WAREHOUSE METRICS
// ============================================================

function getWarehouseKey(
  warehouseId:
    number | null,

  warehouseName:
    string | null
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

  const resultMap =
    new Map<
      string,
      Map<
        string,
        WarehouseMetrics
      >
    >();


  function getOrCreate(
    offerId: string,

    warehouseId:
      number | null,

    warehouseName:
      string | null
  ):
  WarehouseMetrics {

    let offerMap =
      resultMap.get(
        offerId
      );


    if (!offerMap) {

      offerMap =
        new Map<
          string,
          WarehouseMetrics
        >();


      resultMap.set(
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


    const normalizedName =
      warehouseName
        ?.trim()
      ||
      "—";


    if (!metric) {

      metric = {
        warehouseId,

        warehouseName:
          normalizedName,

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
      warehouseMap,
    ]
    of resultMap
  ) {

    const rows =
      Array.from(
        warehouseMap.values()
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

  } catch (error) {

    loadError =
      error instanceof Error
        ? error.message
        : String(error);

  }


  // ==========================================================
  // STOCKS
  // ==========================================================

  try {

    const stockRun =
      await getLatestStockRun();


    if (stockRun) {

      stockUpdatedAt =
        stockRun.created_at;


      stockRows =
        await getStockSnapshots(
          stockRun.id
        );

    }

  } catch (error) {

    syncStateError =
      error instanceof Error
        ? error.message
        : String(error);

  }


  // ==========================================================
  // SALES
  // ==========================================================

  try {

    const salesRun =
      await getLatestSalesRun();


    if (salesRun) {

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

  } catch (error) {

    const message =
      error instanceof Error
        ? error.message
        : String(error);


    syncStateError =
      syncStateError
        ? `${syncStateError}; ${message}`
        : message;

  }


  // ==========================================================
  // TOTAL METRICS BY OFFER
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
  // CATALOG INFO
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
        product.market_sku !==
          null
        &&
        product.market_sku
          .trim() !==
          ""
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
          ): value is string =>
            Boolean(
              value
            )
        )
    );


  const productGroups =
    buildProductGroups(
      products
    );


  return (
    <main className="page">

      <div className="container">

        {/* ===================================
            HEADER
            =================================== */}

        <header className="header">

          <div>

            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>


            <h1 className="title">
              Яндекс Маркет — синхронизация
            </h1>


            <p className="subtitle">
              Товары каталога, остатки
              и продажи FBY Яндекс Маркета.
            </p>

          </div>


          <div className="header-actions">

            <ThemeToggle />


            <Link
              href="/stock-import"

              className=
                "secondary-button navigation-button"
            >
              Остатки склада
            </Link>


            <Link
              href="/"

              className=
                "secondary-button navigation-button"
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

              <section className="section">

                <h2 className="section-title">
                  Ошибка загрузки данных
                  Яндекс Маркета
                </h2>


                <div
                  className="reason-text"

                  style={{
                    color:
                      "#b42318",
                  }}
                >
                  {loadError}
                </div>

              </section>

            )
            : null
        }


        {/* ===================================
            CATALOG STATE
            =================================== */}

        <section className="section">

          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              gap:
                "16px",

              flexWrap:
                "wrap",
            }}
          >

            <div>

              <h2 className="section-title">
                Состояние каталога
              </h2>


              <div className="reason-text">
                Последняя успешная загрузка
                каталога товаров из
                Яндекс Маркета.
              </div>

            </div>


            <div
              style={{
                padding:
                  "8px 12px",

                borderRadius:
                  "999px",

                background:
                  latestCatalogSync
                    ? "#ecfdf3"
                    : "#fff4ed",

                color:
                  latestCatalogSync
                    ? "#027a48"
                    : "#b54708",

                fontSize:
                  "13px",

                fontWeight:
                  700,
              }}
            >
              {
                latestCatalogSync
                  ? "Успешно"
                  : "Нет успешной загрузки"
              }
            </div>

          </div>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",

              gap:
                "16px",

              marginTop:
                "20px",
            }}
          >

            <InfoCard
              label=
                "Последняя синхронизация"

              value=
                {
                  formatDateTimeKrasnoyarsk(
                    latestCatalogSync
                  )
                }

              hint=
                "Красноярское время"
            />


            <InfoCard
              label=
                "Товаров каталога"

              value=
                {
                  formatInteger(
                    products.length
                  )
                }

              hint=
                "строк yandex_products"
            />


            <InfoCard
              label=
                "Активных товаров"

              value=
                {
                  formatInteger(
                    activeProducts.length
                  )
                }

              hint=
                "is_active = true"
            />


            <InfoCard
              label=
                "Product ID"

              value=
                {
                  formatInteger(
                    productsWithMarketSku
                      .length
                  )
                }

              hint=
                "есть marketSku"
            />


            <InfoCard
              label=
                "Без master_code"

              value=
                {
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
            UPDATE DATA
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Обновление данных
          </h2>


          <div className="reason-text">
            Остатки и продажи обновляются
            независимо друг от друга.
          </div>


          {
            syncStateError
              ? (

                <div
                  style={{
                    marginTop:
                      "12px",

                    color:
                      "#f04438",

                    fontSize:
                      "12px",
                  }}
                >
                  Ошибка получения данных:
                  {" "}
                  {syncStateError}
                </div>

              )
              : null
          }


          <YandexSyncActionsClient
            initialStockUpdatedAt=
              {
                stockUpdatedAt
              }

            initialSalesUpdatedAt=
              {
                salesUpdatedAt
              }
          />

        </section>


        {/* ===================================
            CATALOG INFO
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Каталог
          </h2>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",

              gap:
                "16px",

              marginTop:
                "16px",
            }}
          >

            <InfoCard
              label="Категорий"

              value=
                {
                  formatInteger(
                    categories.size
                  )
                }

              hint=
                "уникальных категорий Маркета"
            />


            <InfoCard
              label=
                "Привязано к master_code"

              value=
                {
                  formatInteger(
                    products.length
                    -
                    unlinkedProducts.length
                  )
                }

              hint=
                "физические товары"
            />


            <InfoCard
              label=
                "Требуют привязки"

              value=
                {
                  formatInteger(
                    unlinkedProducts.length
                  )
                }

              hint=
                "пока не участвуют в общей номенклатуре"
            />

          </div>

        </section>


        {/* ===================================
            UNLINKED
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Товары без master_code
          </h2>


          {
            unlinkedProducts.length
              ? (

                <YandexUnlinkedProductsClient
                  products=
                    {
                      unlinkedProducts
                    }
                />

              )
              : (

                <div
                  className="reason-text"

                  style={{
                    marginTop:
                      "16px",
                  }}
                >
                  Непривязанных товаров нет.
                </div>

              )
          }

        </section>


        {/* ===================================
            PRODUCT DATA
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Данные по товарам
          </h2>


          <div className="reason-text">
            Продажи рассчитаны за последние
            {" "}
            {salesPeriodDays}
            {" "}
            дней.
          </div>


          <div className="reason-text">
            В «Отмены» входят прямые
            отмены и невыкупы.
          </div>


          <ProductGroups
            groups=
              {
                productGroups
              }

            metricsByOffer=
              {
                metricsByOffer
              }

            warehouseMetricsByOffer=
              {
                warehouseMetricsByOffer
              }

            periodDays=
              {
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
  label,
  value,
  hint,
}: {
  label: string;

  value: string;

  hint?: string;
}) {

  return (
    <div className="card">

      <div className="card-label">
        {label}
      </div>


      <div
        style={{
          fontSize:
            "18px",

          fontWeight:
            700,

          marginTop:
            "6px",
        }}
      >
        {value}
      </div>


      {
        hint
          ? (

            <div
              className="muted"

              style={{
                marginTop:
                  "5px",
              }}
            >
              {hint}
            </div>

          )
          : null
      }

    </div>
  );

}


// ============================================================
// GROUPS
// ============================================================

function ProductGroups({
  groups,
  metricsByOffer,
  warehouseMetricsByOffer,
  periodDays,
}: {
  groups:
    ProductGroup[];

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
        display:
          "flex",

        flexDirection:
          "column",

        gap:
          "18px",

        marginTop:
          "18px",
      }}
    >

      {
        groups.map(
          group => (

            <ProductGroupBlock
              key=
                {
                  group.key
                }

              group=
                {
                  group
                }

              metricsByOffer=
                {
                  metricsByOffer
                }

              warehouseMetricsByOffer=
                {
                  warehouseMetricsByOffer
                }

              periodDays=
                {
                  periodDays
                }
            />

          )
        )
      }

    </div>
  );

}


// ============================================================
// ONE PRODUCT GROUP
// ============================================================

function ProductGroupBlock({
  group,
  metricsByOffer,
  warehouseMetricsByOffer,
  periodDays,
}: {
  group:
    ProductGroup;

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

  const placementRows:
    PlacementWarehouseRow[] =
    [];


  let totalSales =
    0;


  let totalStock =
    0;


  let totalCancellations =
    0;


  for (
    const product
    of group.products
  ) {

    const productMetrics =
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


    totalSales +=
      productMetrics.sales;


    totalStock +=
      productMetrics.stock;


    totalCancellations +=
      productMetrics.cancellations;


    const warehouses =
      warehouseMetricsByOffer.get(
        product.offer_id
      )
      ??
      [];


    const activeWarehouses =
      warehouses.filter(
        row =>
          row.sales > 0
          ||
          row.cancellations > 0
          ||
          row.stock > 0
      );


    for (
      const warehouse
      of activeWarehouses
    ) {

      placementRows.push(
        {
          offerId:
            product.offer_id,

          productId:
            product.market_sku
            ??
            "—",

          warehouseId:
            warehouse.warehouseId,

          warehouseName:
            warehouse.warehouseName,

          sales:
            warehouse.sales,

          cancellations:
            warehouse.cancellations,

          stock:
            warehouse.stock,
        }
      );

    }

  }


  placementRows.sort(
    (
      a,
      b
    ) => {

      const offerCompare =
        a.offerId.localeCompare(
          b.offerId,
          "ru"
        );


      if (
        offerCompare !== 0
      ) {

        return offerCompare;

      }


      return a.warehouseName
        .localeCompare(
          b.warehouseName,
          "ru"
        );

    }
  );


  return (
    <div
      style={{
        border:
          "1px solid var(--table-divider, #282e38)",

        borderRadius:
          "10px",

        overflow:
          "hidden",
      }}
    >

      {/* ===================================
          GROUP HEADER
          =================================== */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "150px minmax(260px, 1fr)",

          background:
            "var(--table-header-bg, #1b2028)",

          borderBottom:
            "1px solid var(--table-divider, #282e38)",
        }}
      >

        <div
          style={{
            padding:
              "10px 14px",

            fontSize:
              "11px",

            fontWeight:
              700,

            color:
              "var(--text-secondary, #b8c0cc)",
          }}
        >
          master_code
        </div>


        <div
          style={{
            padding:
              "10px 14px",

            fontSize:
              "11px",

            fontWeight:
              700,

            color:
              "var(--text-secondary, #b8c0cc)",
          }}
        >
          Товар
        </div>

      </div>


      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "150px minmax(260px, 1fr)",
        }}
      >

        <div
          style={{
            padding:
              "12px 14px",

            fontSize:
              "13px",

            fontWeight:
              700,
          }}
        >
          {
            group.masterCode
            ??
            "—"
          }
        </div>


        <div
          style={{
            padding:
              "12px 14px",
          }}
        >

          <div
            style={{
              fontSize:
                "13px",

              fontWeight:
                700,
            }}
          >
            {group.name}
          </div>


          <div
            style={{
              marginTop:
                "4px",

              fontSize:
                "11px",

              color:
                "var(--text-secondary, #b8c0cc)",
            }}
          >
            {
              formatPlacementsCount(
                group.products.length
              )
            }
          </div>

        </div>

      </div>


      {/* ===================================
          WAREHOUSE SECTION
          =================================== */}

      <div
        style={{
          padding:
            "14px 14px 12px 42px",

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

            alignItems:
              "flex-start",

            gap:
              "16px",

            flexWrap:
              "wrap",

            marginBottom:
              "12px",
          }}
        >

          <div>

            <div
              style={{
                fontSize:
                  "13px",

                fontWeight:
                  700,
              }}
            >
              Продажи и остатки по складам
            </div>


            <div
              style={{
                marginTop:
                  "3px",

                fontSize:
                  "11px",

                color:
                  "var(--text-secondary, #b8c0cc)",
              }}
            >
              По конкретным складам
              Яндекс Маркета,
              без объединения SKU
              по master_code.
            </div>

          </div>


          <div
            style={{
              display:
                "flex",

              gap:
                "18px",

              flexWrap:
                "wrap",

              fontSize:
                "11px",

              fontWeight:
                700,
            }}
          >

            <span>
              Строк:{" "}
              {
                formatInteger(
                  placementRows.length
                )
              }
            </span>


            <span>
              Продажи:{" "}
              {
                formatInteger(
                  totalSales
                )
              }
            </span>


            <span>
              Отмены:{" "}
              {
                formatInteger(
                  totalCancellations
                )
              }
            </span>


            <span>
              Остаток:{" "}
              {
                formatInteger(
                  totalStock
                )
              }
            </span>

          </div>

        </div>


        {
          placementRows.length >
          0
            ? (

              <WarehouseTable
                rows=
                  {
                    placementRows
                  }

                periodDays=
                  {
                    periodDays
                  }
              />

            )
            : (

              <div
                style={{
                  padding:
                    "12px 0",

                  fontSize:
                    "12px",

                  color:
                    "var(--text-secondary, #b8c0cc)",
                }}
              >
                Нет продаж и остатков
                по складам за текущий период.
              </div>

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
  rows,
  periodDays,
}: {
  rows:
    PlacementWarehouseRow[];

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
            "1050px",

          borderCollapse:
            "collapse",

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


                const isLast =
                  index ===
                  rows.length - 1;


                return (
                  <Fragment
                    key={
                      [
                        row.offerId,
                        row.warehouseId
                        ??
                        "null",
                        row.warehouseName,
                      ].join("|")
                    }
                  >

                    <tr>

                      <WarehouseCell
                        isLast=
                          {isLast}

                        strong
                      >
                        {row.offerId}
                      </WarehouseCell>


                      <WarehouseCell
                        isLast=
                          {isLast}
                      >
                        {row.productId}
                      </WarehouseCell>


                      <WarehouseCell
                        isLast=
                          {isLast}
                      >
                        {row.warehouseName}
                      </WarehouseCell>


                      <WarehouseCell
                        isLast=
                          {isLast}

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
                        isLast=
                          {isLast}

                        numeric
                      >
                        {
                          formatAverage(
                            average
                          )
                        }
                      </WarehouseCell>


                      <WarehouseCell
                        isLast=
                          {isLast}

                        numeric
                      >
                        {
                          formatInteger(
                            row.cancellations
                          )
                        }
                      </WarehouseCell>


                      <WarehouseCell
                        isLast=
                          {isLast}

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
                        isLast=
                          {isLast}

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

                  </Fragment>
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
      style={{
        padding:
          "8px 10px",

        textAlign:
          numeric
            ? "right"
            : "left",

        fontSize:
          "11px",

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

        background:
          "transparent",
      }}
    >
      {children}
    </th>
  );

}


// ============================================================
// WAREHOUSE CELL
// ============================================================

function WarehouseCell({
  children,
  isLast,
  numeric = false,
  strong = false,
}: {
  children:
    ReactNode;

  isLast:
    boolean;

  numeric?:
    boolean;

  strong?:
    boolean;
}) {

  return (
    <td
      style={{
        padding:
          "8px 10px",

        textAlign:
          numeric
            ? "right"
            : "left",

        fontSize:
          "11px",

        fontWeight:
          strong
            ? 700
            : 500,

        border:
          "none",

        borderBottom:
          isLast
            ? "none"
            : "1px solid var(--table-divider, #282e38)",

        whiteSpace:
          "nowrap",

        verticalAlign:
          "top",
      }}
    >
      {children}
    </td>
  );

}
