import type {
  ReactNode,
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
// GENERIC SUPABASE ROW LOADER
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


// ============================================================
// SINGLE PAGE LOADER
// ============================================================

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
// LATEST STOCK RUN
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


// ============================================================
// STOCK SNAPSHOTS
// ============================================================

async function getStockSnapshots(
  syncRunId: string
):
Promise<StockSnapshotRow[]> {

  return fetchAllRows<
    StockSnapshotRow
  >(
    "yandex_stock_snapshots",

    "offer_id,available",

    {
      sync_run_id:
        `eq.${syncRunId}`,
    }
  );

}


// ============================================================
// LATEST SALES RUN
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


// ============================================================
// SALES DAILY
// ============================================================

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

  if (
    products.length ===
    0
  ) {
    return null;
  }


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


  const milliseconds =
    end.getTime()
    -
    start.getTime();


  const days =
    Math.floor(
      milliseconds
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
  // METRICS
  // ==========================================================

  const stockByOffer =
    new Map<
      string,
      number
    >();


  for (
    const row
    of stockRows
  ) {

    stockByOffer.set(
      row.offer_id,

      (
        stockByOffer.get(
          row.offer_id
        )
        ??
        0
      )
      +
      Number(
        row.available
        ??
        0
      )
    );

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
    const [
      offerId,
      stock,
    ]
    of stockByOffer
  ) {

    const current =
      metricsByOffer.get(
        offerId
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


    current.stock =
      stock;


    metricsByOffer.set(
      offerId,
      current
    );

  }


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

        const aUnlinked =
          !a.master_code
          ||
          a.master_code
            .trim() ===
            "";


        const bUnlinked =
          !b.master_code
          ||
          b.master_code
            .trim() ===
            "";


        if (
          aUnlinked !==
          bUnlinked
        ) {

          return aUnlinked
            ? -1
            : 1;

        }


        return a.offer_id
          .localeCompare(
            b.offer_id,
            "ru"
          );

      }
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

              alignItems:
                "flex-start",

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

                    lineHeight:
                      1.45,
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
            CATALOG
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
              label=
                "Категорий"

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
            }}
          >

            <div>

              <h2 className="section-title">
                Товары без master_code
              </h2>


              <div className="reason-text">
                Новые товары Яндекс Маркета,
                которые система пока
                не связала
                с физическим товаром.
              </div>

            </div>


            <div
              style={{
                padding:
                  "8px 12px",

                borderRadius:
                  "999px",

                background:
                  unlinkedProducts.length
                    ? "#fff4ed"
                    : "#ecfdf3",

                color:
                  unlinkedProducts.length
                    ? "#b54708"
                    : "#027a48",

                fontSize:
                  "13px",

                fontWeight:
                  700,
              }}
            >
              {
                unlinkedProducts.length
                  ? `Требуют привязки: ${unlinkedProducts.length}`
                  : "Все товары привязаны"
              }
            </div>

          </div>


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
            В колонке «Отмены» учитываются
            прямые отмены и невыкупы.
          </div>


          <ProductsTable
            products=
              {
                sortedProducts
              }

            metricsByOffer=
              {
                metricsByOffer
              }

            periodDays=
              {
                salesPeriodDays
              }
          />

        </section>


        {/* ===================================
            SAFE MODE
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Безопасный режим
          </h2>


          <div className="reason-text">
            API-ключ Яндекс Маркета
            не передаётся в браузер
            пользователя.
          </div>


          <div className="reason-text">
            Остатки берутся только
            из последнего успешного
            снимка складов.
          </div>


          <div className="reason-text">
            Продажи берутся только
            из последнего успешного
            расчёта yandex_sales_daily.
          </div>

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
// PRODUCTS TABLE
// ============================================================

function ProductsTable({
  products,
  metricsByOffer,
  periodDays,
}: {
  products:
    YandexProductRow[];

  metricsByOffer:
    Map<
      string,
      ProductMetrics
    >;

  periodDays:
    number;
}) {

  return (
    <div
      style={{
        marginTop:
          "18px",

        overflowX:
          "auto",

        border:
          "1px solid var(--table-divider, #282e38)",

        borderRadius:
          "10px",
      }}
    >

      <table
        style={{
          width:
            "100%",

          minWidth:
            "1320px",

          borderCollapse:
            "separate",

          borderSpacing:
            0,
        }}
      >

        <thead>

          <tr
            style={{
              background:
                "var(--table-header-bg, #1b2028)",
            }}
          >

            <TableHeader>
              Артикул
            </TableHeader>


            <TableHeader>
              Product ID
            </TableHeader>


            <TableHeader>
              Товар
            </TableHeader>


            <TableHeader>
              master_code
            </TableHeader>


            <TableHeader numeric>
              Продажи {periodDays} дн.
            </TableHeader>


            <TableHeader numeric>
              Среднее / день
            </TableHeader>


            <TableHeader numeric>
              Отмены
            </TableHeader>


            <TableHeader numeric>
              Остаток
            </TableHeader>


            <TableHeader numeric>
              Дней запаса
            </TableHeader>

          </tr>

        </thead>


        <tbody>

          {
            products.map(
              (
                product,
                index
              ) => {

                const isLast =
                  index ===
                  products.length - 1;


                const divider =
                  isLast
                    ? "none"
                    : "1px solid var(--table-divider, #282e38)";


                const linked =
                  Boolean(
                    product
                      .master_code
                      ?.trim()
                  );


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


                const averagePerDay =
                  periodDays > 0
                    ? metrics.sales
                      /
                      periodDays
                    : 0;


                const stockDays =
                  averagePerDay > 0
                    ? metrics.stock
                      /
                      averagePerDay
                    : null;


                return (
                  <tr
                    key={
                      product.id
                    }
                  >

                    <TableCell
                      divider=
                        {divider}

                      strong
                    >
                      {
                        product
                          .offer_id
                      }
                    </TableCell>


                    <TableCell
                      divider=
                        {divider}

                      nowrap
                    >
                      {
                        product
                          .market_sku
                        ??
                        "—"
                      }
                    </TableCell>


                    <TableCell
                      divider=
                        {divider}
                    >
                      {
                        getProductName(
                          product
                        )
                      }
                    </TableCell>


                    <TableCell
                      divider=
                        {divider}

                      strong=
                        {linked}

                      nowrap
                    >
                      {
                        product
                          .master_code
                        ||
                        "—"
                      }
                    </TableCell>


                    <TableCell
                      divider=
                        {divider}

                      numeric

                      strong
                    >
                      {
                        formatInteger(
                          metrics.sales
                        )
                      }
                    </TableCell>


                    <TableCell
                      divider=
                        {divider}

                      numeric
                    >
                      {
                        formatAverage(
                          averagePerDay
                        )
                      }
                    </TableCell>


                    <TableCell
                      divider=
                        {divider}

                      numeric
                    >
                      {
                        formatInteger(
                          metrics.cancellations
                        )
                      }
                    </TableCell>


                    <TableCell
                      divider=
                        {divider}

                      numeric

                      strong
                    >
                      {
                        formatInteger(
                          metrics.stock
                        )
                      }
                    </TableCell>


                    <TableCell
                      divider=
                        {divider}

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
                    </TableCell>

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
// TABLE HEADER
// ============================================================

function TableHeader({
  children,
  numeric = false,
}: {
  children:
    ReactNode;

  numeric?: boolean;
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


// ============================================================
// TABLE CELL
// ============================================================

function TableCell({
  children,
  divider,
  strong = false,
  nowrap = false,
  numeric = false,
}: {
  children:
    ReactNode;

  divider:
    string;

  strong?: boolean;

  nowrap?: boolean;

  numeric?: boolean;
}) {

  return (
    <td
      style={{
        padding:
          "11px 14px",

        border:
          "none",

        borderBottom:
          divider,

        verticalAlign:
          "top",

        textAlign:
          numeric
            ? "right"
            : "left",

        fontSize:
          "12px",

        fontWeight:
          strong
            ? 700
            : 500,

        whiteSpace:
          (
            nowrap
            ||
            numeric
          )
            ? "nowrap"
            : "normal",
      }}
    >
      {children}
    </td>
  );

}
