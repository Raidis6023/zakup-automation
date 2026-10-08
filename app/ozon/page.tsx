import type {
  ReactNode,
} from "react";

import Link
  from "next/link";

import ThemeToggle
  from "../ThemeToggle";

import OzonStockSyncClient
  from "../OzonStockSyncClient";

import OzonProductsTableClient,
{
  type OzonClusterStockRow,
  type OzonProductTableRow,
} from "./OzonProductsTableClient";


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


type DashboardProductRow =
  Omit<
    OzonProductTableRow,
    "cluster_stocks"
  >;


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
    DashboardProductRow[];
};


type StockSnapshotRow = {
  product_id: string;

  cluster_id: string;

  cluster_name:
    | string
    | null;

  quantity: number;
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
// SUPABASE
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
  ) as DashboardData;
}


// ============================================================
// ОСТАТКИ ПО КЛАСТЕРАМ
//
// Берём только текущий snapshot.
// Никаких расчётов через master_code здесь нет.
// ============================================================

async function getStockSnapshotRows(
  snapshotDate: string
):
Promise<StockSnapshotRow[]> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const allRows:
    StockSnapshotRow[] =
    [];


  const pageSize =
    1000;


  let offset =
    0;


  while (true) {

    const url =
      new URL(
        `${supabaseUrl}/rest/v1/ozon_stock_snapshots`
      );


    url.searchParams.set(
      "select",
      [
        "product_id",
        "cluster_id",
        "cluster_name",
        "quantity",
      ].join(
        ","
      )
    );


    url.searchParams.set(
      "snapshot_date",
      `eq.${snapshotDate}`
    );


    url.searchParams.set(
      "order",
      "product_id.asc,cluster_id.asc"
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
        `Ошибка загрузки остатков по кластерам ${response.status}: ${text}`
      );

    }


    const page =
      JSON.parse(
        text
      ) as StockSnapshotRow[];


    allRows.push(
      ...page
    );


    if (
      page.length <
      pageSize
    ) {

      break;

    }


    offset +=
      pageSize;

  }


  return allRows;
}


// ============================================================
// ПРИВЯЗКА СТРОК ОСТАТКОВ К РАЗМЕЩЕНИЯМ
//
// master_code используется только для внешней строки таблицы.
// Сами остатки связываются строго по product_id.
// ============================================================

function attachClusterStocks(
  products:
    DashboardProductRow[],

  stockRows:
    StockSnapshotRow[]
):
OzonProductTableRow[] {

  const rowsByProduct =
    new Map<
      string,
      StockSnapshotRow[]
    >();


  for (
    const row
    of stockRows
  ) {

    const current =
      rowsByProduct.get(
        row.product_id
      )
      ?? [];


    current.push(
      row
    );


    rowsByProduct.set(
      row.product_id,
      current
    );

  }


  return products.map(
    product => {

      const clusterStocks:
        OzonClusterStockRow[] =
        [];


      for (
        const listing
        of product.listings
        ?? []
      ) {

        const listingStockRows =
          rowsByProduct.get(
            listing.product_id
          )
          ?? [];


        for (
          const stockRow
          of listingStockRows
        ) {

          clusterStocks.push(
            {
              product_id:
                listing.product_id,

              offer_id:
                listing.offer_id,

              ozon_product_id:
                listing.ozon_product_id,

              listing_name:
                listing.name,

              cluster_id:
                stockRow.cluster_id,

              cluster_name:
                stockRow.cluster_name,

              quantity:
                Number(
                  stockRow.quantity
                  ?? 0
                ),
            }
          );

        }

      }


      clusterStocks.sort(
        (
          left,
          right
        ) => {

          const clusterCompare =
            (
              left.cluster_name
              ?? ""
            ).localeCompare(
              right.cluster_name
              ?? "",
              "ru"
            );


          if (
            clusterCompare !==
            0
          ) {

            return clusterCompare;

          }


          return (
            left.offer_id
            ?? ""
          ).localeCompare(
            right.offer_id
            ?? "",
            "ru"
          );

        }
      );


      return {
        ...product,

        cluster_stocks:
          clusterStocks,
      };

    }
  );
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


  let clusterStocksError:
    string
    | null =
    null;


  let stockRows:
    StockSnapshotRow[] =
    [];


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


  if (
    dashboard
      ?.stock_snapshot_date
  ) {

    try {

      stockRows =
        await getStockSnapshotRows(
          dashboard
            .stock_snapshot_date
        );

    } catch (error) {

      clusterStocksError =
        error instanceof Error
          ? error.message
          : String(
              error
            );

    }

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
    attachClusterStocks(
      dashboard
        ?.products
      ?? [],
      stockRows
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
              label=
                "Снимок остатков"

              value={
                formatDate(
                  dashboard
                    ?.stock_snapshot_date
                )
              }

              hint=
                "FBO"
            />


            <InfoCard
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
            Продажи: FBO за период,
            указанный выше.
            Отменённые отправления
            в продажи не входят.
          </div>


          <div className="reason-text">
            Отмены считаются отдельно
            и отображаются
            отдельным показателем.
          </div>


          <div className="reason-text">

            Остаток:
            доступный FBO-остаток
            из{" "}

            <code>
              /v1/analytics/stocks
            </code>

            , поле{" "}

            <code>
              available_stock_count
            </code>
            .

          </div>


          <div className="reason-text">
            Для корректного сравнения
            в кабинете Ozon нужно выбирать
            тот же период и учитывать время
            снимка остатков.
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
            Одна основная строка соответствует
            одному физическому товару
            по master_code.
            Стрелка раскрывает реальные
            остатки Ozon по размещениям
            и кластерам.
          </div>


          {
            clusterStocksError
              ? (

                <div
                  className="reason-text"

                  style={{
                    marginTop:
                      "12px",

                    color:
                      "#b42318",
                  }}
                >
                  Не удалось загрузить
                  детализацию остатков:
                  {" "}
                  {clusterStocksError}
                </div>

              )
              : null
          }


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

                <OzonProductsTableClient
                  products={
                    products
                  }
                />

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
