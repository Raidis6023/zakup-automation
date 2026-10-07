import type {
  ReactNode,
} from "react";

import Link from "next/link";

import ThemeToggle
  from "../ThemeToggle";

import OzonStockSyncClient
  from "../OzonStockSyncClient";


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

  offer_id:
    | string
    | null;

  ozon_product_id:
    | string
    | number
    | null;

  name:
    | string
    | null;
};


type ProductRow = {
  master_code: string;

  product_name:
    | string
    | null;

  listing_count: number;

  listings:
    ListingRow[];

  sales_28_days: number;

  cancelled_28_days: number;

  average_sales_per_day: number;

  stock_quantity: number;

  stock_days:
    | number
    | null;
};


type DashboardData = {
  latest_sync:
    | LatestSync
    | null;

  stock_snapshot_date:
    | string
    | null;

  summary:
    | Summary
    | null;

  daily_sales:
    DailySalesRow[];

  products:
    ProductRow[];
};


// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

function formatNumber(
  value:
    | number
    | null
    | undefined
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


function formatDecimal(
  value:
    | number
    | null
    | undefined,

  digits:
    number = 1
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  return new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        digits,
    }
  ).format(
    value
  );
}


function formatDate(
  value:
    | string
    | null
    | undefined
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
    | string
    | null
    | undefined
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
// ПОЛУЧЕНИЕ ДАННЫХ
// ============================================================

async function getOzonDashboard():
Promise<DashboardData> {

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
  ) as DashboardData;
}


// ============================================================
// СТРАНИЦА OZON
// ============================================================

export default async function OzonPage() {

  let dashboard:
    DashboardData
    | null =
    null;


  let dashboardError:
    string
    | null =
    null;


  try {

    dashboard =
      await getOzonDashboard();

  } catch (error) {

    dashboardError =
      error instanceof Error
        ? error.message
        : String(
            error
          );

  }


  const latestSync =
    dashboard
      ?.latest_sync
    ?? null;


  const summary =
    dashboard
      ?.summary
    ?? null;


  const dailySales =
    dashboard
      ?.daily_sales
    ?? [];


  const products =
    dashboard
      ?.products
    ?? [];


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
              Ozon — синхронизация
            </h1>


            <p className="subtitle">

              FBO продажи, отмены
              и доступные остатки Ozon.

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
              ← Расчёт Китая
            </Link>

          </div>

        </header>


        {/* ===================================
            ОШИБКА DASHBOARD
            =================================== */}

        {
          dashboardError
            ? (

              <section className="section">

                <h2 className="section-title">
                  Ошибка загрузки данных Ozon
                </h2>


                <div
                  className="reason-text"
                  style={{
                    color:
                      "#b42318",
                  }}
                >
                  {dashboardError}
                </div>

              </section>

            )
            : null
        }


        {/* ===================================
            СОСТОЯНИЕ СИНХРОНИЗАЦИИ
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
                Состояние синхронизации
              </h2>


              <div className="reason-text">

                Последняя успешная загрузка
                FBO-данных из Ozon.

              </div>

            </div>


            <div
              style={{
                padding:
                  "8px 12px",

                borderRadius:
                  "999px",

                background:
                  latestSync?.status ===
                  "success"
                    ? "#ecfdf3"
                    : "#fff4ed",

                color:
                  latestSync?.status ===
                  "success"
                    ? "#027a48"
                    : "#b54708",

                fontSize:
                  "13px",

                fontWeight:
                  700,
              }}
            >
              {
                latestSync?.status ===
                "success"
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
              label="Последняя синхронизация"
              value={
                formatDateTimeKrasnoyarsk(
                  latestSync
                    ?.created_at
                )
              }
              hint="Красноярское время"
            />


            <InfoCard
              label="Период продаж"
              value={
                latestSync
                  ? `${formatDate(
                      latestSync.date_from
                    )} – ${formatDate(
                      latestSync.date_to
                    )}`
                  : "—"
              }
              hint="Скользящие 28 дней"
            />


            <InfoCard
              label="Снимок остатков"
              value={
                formatDate(
                  dashboard
                    ?.stock_snapshot_date
                )
              }
              hint="FBO"
            />


            <InfoCard
              label="Отправлений"
              value={
                formatNumber(
                  latestSync
                    ?.postings_received
                )
              }
              hint="Получено из Ozon"
            />

          </div>

        </section>


        {/* ===================================
            ОСНОВНЫЕ ПОКАЗАТЕЛИ
            =================================== */}

        <section className="summary-grid">


          <div className="card">

            <div className="card-label">
              Продажи за 28 дней
            </div>

            <div className="big-number">
              {
                formatNumber(
                  summary
                    ?.sales_28_days
                )
              }
            </div>

            <div className="muted">
              шт., без отмен
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Отмены
            </div>

            <div className="big-number">
              {
                formatNumber(
                  summary
                    ?.cancelled_28_days
                )
              }
            </div>

            <div className="muted">
              шт. отдельно от продаж
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Остаток FBO
            </div>

            <div className="big-number">
              {
                formatNumber(
                  summary
                    ?.stock_quantity
                )
              }
            </div>

            <div className="muted">
              доступно к продаже
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Физических товаров
            </div>

            <div className="big-number">
              {
                formatNumber(
                  summary
                    ?.active_master_codes
                )
              }
            </div>

            <div className="muted">
              по master_code
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Размещений
            </div>

            <div className="big-number">
              {
                formatNumber(
                  summary
                    ?.active_listing_rows
                )
              }
            </div>

            <div className="muted">
              активных строк products
            </div>

          </div>

        </section>


        {/* ===================================
            МЕТОДИКА СРАВНЕНИЯ
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Как сверять с кабинетом Ozon
          </h2>


          <div className="reason-text">

            Продажи:
            FBO за период,
            указанный выше.
            Отменённые отправления
            в продажи не входят.

          </div>


          <div className="reason-text">

            Отмены:
            считаются отдельно
            и отображаются
            отдельным показателем.

          </div>


          <div className="reason-text">

            Остаток:
            доступный FBO-остаток.
            В расчёт записывается
            present − reserved.

          </div>


          <div className="reason-text">

            Для корректного сравнения
            в кабинете Ozon нужно выбирать
            тот же период и FBO.

          </div>

        </section>


        {/* ===================================
            ПРОДАЖИ ПО ДНЯМ
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Продажи по дням
          </h2>


          <div className="reason-text">

            Этот блок удобнее всего
            использовать для контрольной
            сверки с кабинетом Ozon.

          </div>


          <div
            style={{
              overflowX:
                "auto",

              marginTop:
                "18px",

              border:
                "1px solid var(--border-color, #e5e7eb)",

              borderRadius:
                "12px",
            }}
          >

            <table
              style={{
                width:
                  "100%",

                borderCollapse:
                  "collapse",

                minWidth:
                  "680px",
              }}
            >

              <thead>

                <tr>

                  <TableHeader>
                    Дата
                  </TableHeader>

                  <TableHeader align="right">
                    Продажи, шт.
                  </TableHeader>

                  <TableHeader align="right">
                    Отмены, шт.
                  </TableHeader>

                  <TableHeader align="right">
                    Строк в БД
                  </TableHeader>

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

                        <TableCell>
                          {
                            formatDate(
                              row.sale_date
                            )
                          }
                        </TableCell>


                        <TableCell align="right">
                          <strong>
                            {
                              formatNumber(
                                row.sales_quantity
                              )
                            }
                          </strong>
                        </TableCell>


                        <TableCell align="right">
                          {
                            formatNumber(
                              row.cancelled_quantity
                            )
                          }
                        </TableCell>


                        <TableCell align="right">
                          {
                            formatNumber(
                              row.rows_count
                            )
                          }
                        </TableCell>

                      </tr>

                    )
                  )
                }

              </tbody>

            </table>

          </div>

        </section>


        {/* ===================================
            ТОВАРЫ
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Данные по товарам
          </h2>


          <div className="reason-text">

            Одна строка соответствует
            одному физическому товару
            по master_code.

          </div>


          <div
            style={{
              overflowX:
                "auto",

              marginTop:
                "18px",

              border:
                "1px solid var(--border-color, #e5e7eb)",

              borderRadius:
                "12px",
            }}
          >

            <table
              style={{
                width:
                  "100%",

                borderCollapse:
                  "collapse",

                minWidth:
                  "1250px",
              }}
            >

              <thead>

                <tr>

                  <TableHeader>
                    master_code
                  </TableHeader>

                  <TableHeader>
                    Товар
                  </TableHeader>

                  <TableHeader>
                    Offer ID
                  </TableHeader>

                  <TableHeader align="right">
                    Продажи 28 дн.
                  </TableHeader>

                  <TableHeader align="right">
                    Среднее / день
                  </TableHeader>

                  <TableHeader align="right">
                    Отмены
                  </TableHeader>

                  <TableHeader align="right">
                    Остаток
                  </TableHeader>

                  <TableHeader align="right">
                    Дней запаса
                  </TableHeader>

                </tr>

              </thead>


              <tbody>

                {
                  products.map(
                    product => {

                      const offers =
                        (
                          product.listings
                          ?? []
                        )
                          .map(
                            listing =>
                              listing.offer_id
                          )
                          .filter(
                            (
                              value
                            ): value is string =>
                              Boolean(
                                value
                              )
                          )
                          .join(
                            ", "
                          );


                      return (

                        <tr
                          key={
                            product.master_code
                          }
                        >

                          <TableCell>

                            <span
                              style={{
                                fontFamily:
                                  "monospace",

                                fontWeight:
                                  700,
                              }}
                            >
                              {
                                product.master_code
                              }
                            </span>

                          </TableCell>


                          <TableCell>

                            <div>
                              {
                                product
                                  .product_name
                                ||
                                "—"
                              }
                            </div>


                            {
                              product.listing_count >
                              1
                                ? (

                                  <div
                                    className="muted"
                                    style={{
                                      marginTop:
                                        "4px",

                                      fontSize:
                                        "11px",
                                    }}
                                  >
                                    {
                                      product
                                        .listing_count
                                    }{" "}
                                    размещения
                                  </div>

                                )
                                : null
                            }

                          </TableCell>


                          <TableCell>

                            <div
                              style={{
                                maxWidth:
                                  "360px",

                                wordBreak:
                                  "break-word",
                              }}
                            >
                              {
                                offers
                                ||
                                "—"
                              }
                            </div>

                          </TableCell>


                          <TableCell align="right">

                            <strong>
                              {
                                formatNumber(
                                  product
                                    .sales_28_days
                                )
                              }
                            </strong>

                          </TableCell>


                          <TableCell align="right">

                            {
                              formatDecimal(
                                product
                                  .average_sales_per_day,
                                2
                              )
                            }

                          </TableCell>


                          <TableCell align="right">

                            {
                              formatNumber(
                                product
                                  .cancelled_28_days
                              )
                            }

                          </TableCell>


                          <TableCell align="right">

                            <strong>
                              {
                                formatNumber(
                                  product
                                    .stock_quantity
                                )
                              }
                            </strong>

                          </TableCell>


                          <TableCell align="right">

                            {
                              formatDecimal(
                                product
                                  .stock_days,
                                1
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

        </section>


        {/* ===================================
            БЕЗОПАСНЫЙ РЕЖИМ
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Безопасный режим
          </h2>


          <div className="reason-text">

            Сначала система полностью
            получает и проверяет данные
            Ozon.

          </div>


          <div className="reason-text">

            Только после успешного
            завершения всех запросов
            данные записываются
            в Supabase одной транзакцией.

          </div>


          <div className="reason-text">

            Ошибка API не считается
            нулевым остатком.

          </div>

        </section>


        {/* ===================================
            СУЩЕСТВУЮЩИЙ БЛОК СИНХРОНИЗАЦИИ
            =================================== */}

        <OzonStockSyncClient />


      </div>

    </main>

  );
}


// ============================================================
// МАЛЕНЬКИЕ КОМПОНЕНТЫ
// ============================================================

function InfoCard(
  {
    label,
    value,
    hint,
  }:
  {
    label:
      string;

    value:
      string;

    hint?:
      string;
  }
) {

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


function TableHeader(
  {
    children,
    align = "left",
  }:
  {
    children:
      ReactNode;

    align?:
      "left"
      | "right";
  }
) {

  return (

    <th
      style={{
        padding:
          "12px 14px",

        textAlign:
          align,

        borderBottom:
          "1px solid var(--border-color, #e5e7eb)",

        fontSize:
          "12px",

        fontWeight:
          700,

        whiteSpace:
          "nowrap",

        opacity:
          0.75,
      }}
    >
      {children}
    </th>

  );
}


function TableCell(
  {
    children,
    align = "left",
  }:
  {
    children:
      ReactNode;

    align?:
      "left"
      | "right";
  }
) {

  return (

    <td
      style={{
        padding:
          "12px 14px",

        textAlign:
          align,

        borderBottom:
          "1px solid var(--border-color, #eef0f2)",

        fontSize:
          "13px",

        verticalAlign:
          "top",
      }}
    >
      {children}
    </td>

  );
}
