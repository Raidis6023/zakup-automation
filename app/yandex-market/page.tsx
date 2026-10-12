import {
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
// GENERIC LOADERS
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

  const linked =
    new Map<
      string,
      ProductGroup
    >();


  const unlinked:
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

      unlinked.push(
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
      linked.get(
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


      linked.set(
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
      ...unlinked,

      ...Array.from(
        linked.values()
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
      ).localeCompare(
        b.masterCode
        ??
        b.name,
        "ru"
      );

    }
  );


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

  const result =
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


  try {

    products =
      await getYandexProducts();

  } catch (error) {

    loadError =
      error instanceof Error
        ? error.message
        : String(error);

  }


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
        product.market_sku
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


  const groups =
    buildProductGroups(
      products
    );


  return (
    <main className="page">

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
            transition: transform 0.15s ease;
            transform-origin: center;
          }

          .yandex-product-details[open]
            .yandex-product-chevron {
            transform: rotate(90deg);
          }
        `}
      </style>


      <div className="container">

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


        {
          loadError
            ? (

              <section className="section">

                <h2 className="section-title">
                  Ошибка загрузки данных
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


        <section className="section">

          <h2 className="section-title">
            Состояние каталога
          </h2>


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
            />

          </div>

        </section>


        <section className="section">

          <h2 className="section-title">
            Обновление данных
          </h2>


          {
            syncStateError
              ? (

                <div
                  style={{
                    color:
                      "#f04438",

                    fontSize:
                      "12px",

                    marginTop:
                      "10px",
                  }}
                >
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
            />

          </div>

        </section>


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

                <div className="reason-text">
                  Непривязанных товаров нет.
                </div>

              )
          }

        </section>


        <section className="section">

          <h2 className="section-title">
            Данные по товарам
          </h2>


          <div className="reason-text">
            Продажи за последние
            {" "}
            {salesPeriodDays}
            {" "}
            дней.
          </div>


          <ProductGroups
            groups=
              {
                groups
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
}: {
  label:
    string;

  value:
    string;
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

    </div>
  );

}


// ============================================================
// PRODUCT GROUPS
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
        marginTop:
          "18px",

        border:
          "1px solid var(--table-divider, #282e38)",

        borderRadius:
          "10px",

        overflow:
          "hidden",
      }}
    >

      {/* COLUMN HEADERS */}

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
          style={
            groupHeaderCellStyle
          }
        >
          master_code
        </div>


        <div
          style={
            groupHeaderCellStyle
          }
        >
          Товар
        </div>

      </div>


      {
        groups.map(
          (
            group,
            index
          ) => (

            <ProductGroupRow
              key=
                {
                  group.key
                }

              group=
                {
                  group
                }

              isLast=
                {
                  index ===
                  groups.length - 1
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
// COLLAPSIBLE PRODUCT ROW
// ============================================================

function ProductGroupRow({
  group,
  isLast,
  metricsByOffer,
  warehouseMetricsByOffer,
  periodDays,
}: {
  group:
    ProductGroup;

  isLast:
    boolean;

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

  const rows:
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


    totalSales +=
      metrics.sales;


    totalStock +=
      metrics.stock;


    totalCancellations +=
      metrics.cancellations;


    const warehouses =
      warehouseMetricsByOffer.get(
        product.offer_id
      )
      ??
      [];


    for (
      const warehouse
      of warehouses
    ) {

      if (
        warehouse.sales === 0
        &&
        warehouse.cancellations === 0
        &&
        warehouse.stock === 0
      ) {

        continue;

      }


      rows.push(
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


  rows.sort(
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
    <details
      className=
        "yandex-product-details"

      style={{
        borderBottom:
          isLast
            ? "none"
            : "1px solid var(--table-divider, #282e38)",
      }}
    >

      {/* ===================================
          ALWAYS VISIBLE ROW
          =================================== */}

      <summary
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "150px minmax(260px, 1fr)",

          cursor:
            "pointer",

          userSelect:
            "none",
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

            display:
              "flex",

            alignItems:
              "center",

            gap:
              "8px",
          }}
        >

          <span
            className=
              "yandex-product-chevron"

            aria-hidden="true"
          >
            ▶
          </span>


          <span>
            {
              group.masterCode
              ??
              "—"
            }
          </span>

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

      </summary>


      {/* ===================================
          EXPANDED CONTENT
          =================================== */}

      <div
        style={{
          padding:
            "14px 14px 16px 42px",

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
                  rows.length
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
          rows.length > 0
            ? (

              <WarehouseTable
                rows=
                  {
                    rows
                  }

                periodDays=
                  {
                    periodDays
                  }
              />

            )
            : (

              <div
                className="reason-text"
              >
                Нет данных по складам.
              </div>

            )
        }

      </div>

    </details>
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


                return (
                  <tr
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

                    <WarehouseCell
                      isLast=
                        {
                          index ===
                          rows.length - 1
                        }

                      strong
                    >
                      {row.offerId}
                    </WarehouseCell>


                    <WarehouseCell
                      isLast=
                        {
                          index ===
                          rows.length - 1
                        }
                    >
                      {row.productId}
                    </WarehouseCell>


                    <WarehouseCell
                      isLast=
                        {
                          index ===
                          rows.length - 1
                        }
                    >
                      {row.warehouseName}
                    </WarehouseCell>


                    <WarehouseCell
                      isLast=
                        {
                          index ===
                          rows.length - 1
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
                      isLast=
                        {
                          index ===
                          rows.length - 1
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
                      isLast=
                        {
                          index ===
                          rows.length - 1
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
                      isLast=
                        {
                          index ===
                          rows.length - 1
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
                      isLast=
                        {
                          index ===
                          rows.length - 1
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
// STYLES
// ============================================================

const groupHeaderCellStyle:
CSSProperties = {

  padding:
    "10px 14px",

  fontSize:
    "11px",

  fontWeight:
    700,

  color:
    "var(--text-secondary, #b8c0cc)",
};


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
