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


type StockSyncRow = {
  created_at: string;
};


type SalesDailySyncRow = {
  updated_at: string;
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
// LOAD PRODUCTS
// ============================================================

async function getYandexProducts():
Promise<YandexProductRow[]> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_products`
    );


  url.searchParams.set(
    "select",
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
    ].join(",")
  );


  url.searchParams.set(
    "order",
    "offer_id.asc"
  );


  url.searchParams.set(
    "limit",
    "5000"
  );


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
      `Supabase yandex_products: HTTP ${response.status}: ${text}`
    );

  }


  return JSON.parse(
    text
  ) as YandexProductRow[];

}


// ============================================================
// LAST STOCK SYNC
// ============================================================

async function getLatestStockSync():
Promise<string | null> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_stock_sync_runs`
    );


  url.searchParams.set(
    "select",
    "created_at"
  );


  url.searchParams.set(
    "status",
    "eq.success"
  );


  url.searchParams.set(
    "order",
    "created_at.desc"
  );


  url.searchParams.set(
    "limit",
    "1"
  );


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
      `Supabase yandex_stock_sync_runs: HTTP ${response.status}: ${text}`
    );

  }


  const rows =
    JSON.parse(
      text
    ) as StockSyncRow[];


  return rows[0]
    ?.created_at
    ??
    null;

}


// ============================================================
// LAST SALES DAILY SYNC
// ============================================================

async function getLatestSalesSync():
Promise<string | null> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_sales_daily`
    );


  url.searchParams.set(
    "select",
    "updated_at"
  );


  url.searchParams.set(
    "order",
    "updated_at.desc"
  );


  url.searchParams.set(
    "limit",
    "1"
  );


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
      `Supabase yandex_sales_daily: HTTP ${response.status}: ${text}`
    );

  }


  const rows =
    JSON.parse(
      text
    ) as SalesDailySyncRow[];


  return rows[0]
    ?.updated_at
    ??
    null;

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


function formatNumber(
  value: number
):
string {

  return new Intl.NumberFormat(
    "ru-RU"
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


// ============================================================
// PAGE
// ============================================================

export default async function YandexMarketPage() {

  let products:
    YandexProductRow[] =
    [];


  let loadError:
    string | null =
    null;


  let stockUpdatedAt:
    string | null =
    null;


  let salesUpdatedAt:
    string | null =
    null;


  let syncStateError:
    string | null =
    null;


  try {

    products =
      await getYandexProducts();

  } catch (error) {

    loadError =
      error instanceof Error
        ? error.message
        : String(error);

  }


  const [
    stockResult,
    salesResult,
  ] =
    await Promise.allSettled(
      [
        getLatestStockSync(),
        getLatestSalesSync(),
      ]
    );


  if (
    stockResult.status ===
    "fulfilled"
  ) {

    stockUpdatedAt =
      stockResult.value;

  } else {

    syncStateError =
      stockResult.reason
        instanceof Error
        ? stockResult.reason.message
        : String(
            stockResult.reason
          );

  }


  if (
    salesResult.status ===
    "fulfilled"
  ) {

    salesUpdatedAt =
      salesResult.value;

  } else {

    const salesError =
      salesResult.reason
        instanceof Error
        ? salesResult.reason.message
        : String(
            salesResult.reason
          );


    syncStateError =
      syncStateError
        ? `${syncStateError}; ${salesError}`
        : salesError;

  }


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
            CATALOG SYNC STATE
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
                  formatNumber(
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
                  formatNumber(
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
                  formatNumber(
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
                  formatNumber(
                    unlinkedProducts.length
                  )
                }

              hint=
                "требуют привязки"
            />

          </div>

        </section>


        {/* ===================================
            STOCKS + SALES
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Обновление данных
          </h2>


          <div className="reason-text">
            Остатки и продажи обновляются
            независимо друг от друга.
          </div>


          <div className="reason-text">
            При обновлении продаж система
            сначала получает свежие заказы,
            отмены, невыкупы и возвраты,
            а затем пересчитывает
            yandex_sales_daily.
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
                  Не удалось получить время
                  последнего обновления:
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
            HOW TO CHECK
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Как сверять с кабинетом
            Яндекс Маркета
          </h2>


          <div className="reason-text">
            Артикул — offerId продавца,
            полученный из каталога
            Яндекс Маркета.
          </div>


          <div className="reason-text">
            Product ID — marketSku.
            Он хранится как текст,
            чтобы длинные идентификаторы
            Яндекса не округлялись.
          </div>


          <div className="reason-text">
            Категория — категория
            сопоставленной карточки
            Яндекс Маркета.
          </div>


          <div className="reason-text">
            Остатки и продажи
            сохраняются отдельными
            источниками данных
            и не изменяют каталог.
          </div>

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
                  formatNumber(
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
                  formatNumber(
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
                  formatNumber(
                    unlinkedProducts.length
                  )
                }

              hint=
                "пока не участвуют в общей номенклатуре"
            />

          </div>

        </section>


        {/* ===================================
            UNLINKED PRODUCTS
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
                не смогла связать
                с физическим товаром.
              </div>


              <div className="reason-text">
                Можно привязать товар
                к существующему master_code
                или указать новый код.
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
            ALL PRODUCTS
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Данные по товарам
          </h2>


          <div className="reason-text">
            Текущий каталог,
            полученный через
            offer-mappings.
          </div>


          <div className="reason-text">
            Сейчас показываем только
            те данные, которые уже
            подтверждены API.
          </div>


          <ProductsTable
            products=
              {
                sortedProducts
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
            Обновление остатков
            и продаж выполняется
            через серверные API routes.
          </div>


          <div className="reason-text">
            Продажи считаются успешно
            обновлёнными только после
            успешного получения сырых
            данных и пересчёта
            yandex_sales_daily.
          </div>


          <div className="reason-text">
            Ошибка одного из этапов
            не должна отображаться
            пользователю как успешное
            обновление.
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
}: {
  products:
    YandexProductRow[];
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
            "980px",

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
              Категория
            </TableHeader>


            <TableHeader>
              master_code
            </TableHeader>


            <TableHeader>
              Последняя синхронизация
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
                    >
                      {
                        product
                          .market_category_name
                        ||
                        "—"
                      }
                    </TableCell>


                    <TableCell
                      divider=
                        {divider}

                      strong=
                        {linked}
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

                      nowrap
                    >
                      {
                        formatDateTimeKrasnoyarsk(
                          product
                            .last_seen_at
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
}: {
  children:
    ReactNode;
}) {

  return (
    <th
      style={{
        padding:
          "12px 14px",

        textAlign:
          "left",

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
}: {
  children:
    ReactNode;

  divider:
    string;

  strong?: boolean;

  nowrap?: boolean;
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

        fontSize:
          "12px",

        fontWeight:
          strong
            ? 700
            : 500,

        whiteSpace:
          nowrap
            ? "nowrap"
            : "normal",
      }}
    >
      {children}
    </td>
  );

}
