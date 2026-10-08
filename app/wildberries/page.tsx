import type {
  ReactNode,
} from "react";

import Link
  from "next/link";

import ThemeToggle
  from "../ThemeToggle";

import WbSyncClient
  from "../WbSyncClient";


export const dynamic =
  "force-dynamic";


type DailySalesRow = {

  date:
    string;

  sales:
    number;

  cancelled:
    number;

  dbRows:
    number;

};


type ProductRow = {

  masterCode:
    string;

  productName:
    string;

  sellerArticles:
    string;

  nmIds:
    string;

  listingsCount:
    number;

  sales28Days:
    number;

  avgSalesPerDay:
    number;

  cancelled28Days:
    number;

  fbwStock:
    number;

  daysOfStock:
    number | null;

  toClient:
    number;

  fromClient:
    number;

};


type DashboardData = {

  ok:
    boolean;


  status: {

    ok:
      boolean;

    label:
      string;

    lastSuccessfulSyncAt:
      string | null;

    ordersLastSuccessAt:
      string | null;

    stocksLastSuccessAt:
      string | null;

    ordersLastHttpStatus:
      number | null;

    stocksLastHttpStatus:
      number | null;

    stockSnapshotId:
      string | null;

    stockSnapshotAt:
      string | null;

  };


  period: {

    days:
      number;

    dateFrom:
      string;

    dateTo:
      string;

    source:
      string;

    samePeriodAsOzon:
      boolean;

  };


  summary: {

    orderRows:
      number;

    sales28Days:
      number;

    cancelled28Days:
      number;

    fbwStock:
      number;

    toClient:
      number;

    fromClient:
      number;

    physicalProducts:
      number;

    listings:
      number;

  };


  dailySales:
    DailySalesRow[];


  products:
    ProductRow[];


  validation: {

    currentUnmapped:
      number;

    mappingRows:
      number;

    duplicateNmId:
      number;

    duplicateSrid:
      number;

    nullIsCancel:
      number;

    ordersOutsideCurrentSnapshot:
      number;

  };

};


function getSupabaseConfig() {

  const supabaseUrl =
    process.env.SUPABASE_URL
    ??
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env
      .SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseKey) {

    throw new Error(
      "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseKey,
  };

}


async function getDashboard():
Promise<DashboardData> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_wb_sync_dashboard`,
      {
        method:
          "POST",

        headers: {

          apikey:
            supabaseKey,

          Authorization:
            `Bearer ${supabaseKey}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",

        },

        body:
          "{}",

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Не удалось загрузить WB dashboard. HTTP ${response.status}: ${text}`
    );

  }


  let data:
    unknown;


  try {

    data =
      JSON.parse(
        text
      );

  } catch {

    throw new Error(
      "Supabase вернул некорректный JSON для WB dashboard"
    );

  }


  if (
    !data
    ||
    typeof data !==
      "object"
  ) {

    throw new Error(
      "WB dashboard вернул пустой ответ"
    );

  }


  return data
    as DashboardData;

}


function formatInteger(
  value:
    number | null | undefined
) {

  const number =
    Number(
      value
      ?? 0
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "0";

  }


  return new Intl
    .NumberFormat(
      "ru-RU",
      {
        maximumFractionDigits:
          0,
      }
    )
    .format(
      number
    );

}


function formatDecimal(
  value:
    number | null | undefined,
  digits =
    2
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "—";

  }


  return new Intl
    .NumberFormat(
      "ru-RU",
      {
        minimumFractionDigits:
          digits,

        maximumFractionDigits:
          digits,
      }
    )
    .format(
      number
    );

}


function formatDate(
  value:
    string | null | undefined
) {

  if (!value) {

    return "—";

  }


  const datePart =
    value.slice(
      0,
      10
    );


  const parts =
    datePart.split(
      "-"
    );


  if (
    parts.length !==
    3
  ) {

    return value;

  }


  return [
    parts[2],
    parts[1],
    parts[0],
  ].join(
    "."
  );

}


function formatKrasnoyarskDateTime(
  value:
    string | null | undefined
) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(
      value
    );


  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {

    return "—";

  }


  return new Intl
    .DateTimeFormat(
      "ru-RU",
      {
        timeZone:
          "Asia/Krasnoyarsk",

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",
      }
    )
    .format(
      date
    );

}


function formatKrasnoyarskDate(
  value:
    string | null | undefined
) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(
      value
    );


  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {

    return "—";

  }


  return new Intl
    .DateTimeFormat(
      "ru-RU",
      {
        timeZone:
          "Asia/Krasnoyarsk",

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",
      }
    )
    .format(
      date
    );

}


function SummaryCard({
  label,
  value,
  caption,
}: {
  label:
    string;

  value:
    ReactNode;

  caption:
    ReactNode;
}) {

  return (

    <div className="card">

      <div className="card-label">
        {label}
      </div>


      <div className="big-number">
        {value}
      </div>


      <div className="muted">
        {caption}
      </div>

    </div>

  );

}


function InfoLine({
  children,
}: {
  children:
    ReactNode;
}) {

  return (

    <div
      className="reason-text"
      style={{
        marginTop:
          "5px",
      }}
    >

      {children}

    </div>

  );

}


export default async function WildberriesPage() {

  let dashboard:
    DashboardData | null =
    null;


  let loadError =
    "";


  try {

    dashboard =
      await getDashboard();

  } catch (
    error
  ) {

    loadError =
      error instanceof Error
        ? error.message
        : "Не удалось загрузить страницу Wildberries";

  }


  return (

    <main className="page">

      <div className="container">


        {/* ==========================================
            HEADER
            ========================================== */}

        <header className="header">

          <div>

            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>


            <h1 className="title">
              Wildberries — синхронизация
            </h1>


            <p className="subtitle">
              FBW продажи, отмены и доступные остатки Wildberries.
            </p>

          </div>


          <div className="header-actions">

            <ThemeToggle />


            <Link
              href="/stock-import"
              className="secondary-button navigation-button"
            >
              Остатки склада
            </Link>


            <Link
              href="/"
              className="secondary-button navigation-button"
            >
              ← Расчёт Китая
            </Link>

          </div>

        </header>


        {/* ==========================================
            ОШИБКА
            ========================================== */}

        {
          loadError
          &&
          (

            <section className="section">

              <div className="section-header">

                <div>

                  <h2 className="section-title">
                    Ошибка загрузки
                  </h2>

                </div>

              </div>


              <div className="reason-text">
                {loadError}
              </div>

            </section>

          )
        }


        {
          dashboard
          &&
          (
            <>


              {/* ======================================
                  СОСТОЯНИЕ СИНХРОНИЗАЦИИ
                  ====================================== */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Состояние синхронизации
                    </h2>


                    <div className="muted">

                      Последняя успешная загрузка
                      FBW-данных из Wildberries.

                    </div>

                  </div>


                  <span

                    style={{

                      display:
                        "inline-flex",

                      alignItems:
                        "center",

                      padding:
                        "7px 11px",

                      borderRadius:
                        "999px",

                      background:
                        dashboard.status.ok
                          ? "rgba(40, 160, 90, 0.12)"
                          : "rgba(220, 70, 70, 0.13)",

                      color:
                        "var(--text)",

                      fontSize:
                        "12px",

                      fontWeight:
                        700,

                      whiteSpace:
                        "nowrap",

                    }}

                  >

                    {
                      dashboard
                        .status
                        .label
                    }

                  </span>

                </div>


                <div

                  className=
                    "summary-grid"

                  style={{
                    marginBottom:
                      0,
                  }}

                >


                  <SummaryCard

                    label=
                      "Последняя синхронизация"

                    value={
                      formatKrasnoyarskDateTime(
                        dashboard
                          .status
                          .lastSuccessfulSyncAt
                      )
                    }

                    caption=
                      "Красноярское время"

                  />


                  <SummaryCard

                    label=
                      "Период продаж"

                    value={
                      <>
                        {
                          formatDate(
                            dashboard
                              .period
                              .dateFrom
                          )
                        }
                        {" — "}
                        {
                          formatDate(
                            dashboard
                              .period
                              .dateTo
                          )
                        }
                      </>
                    }

                    caption=
                      "Скользящие 28 дней"

                  />


                  <SummaryCard

                    label=
                      "Снимок остатков"

                    value={
                      formatKrasnoyarskDate(
                        dashboard
                          .status
                          .stockSnapshotAt
                      )
                    }

                    caption=
                      "FBW"

                  />


                  <SummaryCard

                    label=
                      "Заказов"

                    value={
                      formatInteger(
                        dashboard
                          .summary
                          .orderRows
                      )
                    }

                    caption=
                      "Получено из Wildberries"

                  />


                </div>

              </section>


              {/* ======================================
                  KPI
                  ====================================== */}

              <section className="summary-grid">


                <SummaryCard

                  label=
                    "Продажи за 28 дней"

                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .sales28Days
                    )
                  }

                  caption=
                    "шт., без отмен"

                />


                <SummaryCard

                  label=
                    "Отмены"

                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .cancelled28Days
                    )
                  }

                  caption=
                    "шт. отдельно от продаж"

                />


                <SummaryCard

                  label=
                    "Остаток FBW"

                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .fbwStock
                    )
                  }

                  caption=
                    "доступно на складах WB"

                />


                <SummaryCard

                  label=
                    "Физических товаров"

                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .physicalProducts
                    )
                  }

                  caption=
                    "по master_code"

                />


                <SummaryCard

                  label=
                    "Размещений"

                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .listings
                    )
                  }

                  caption=
                    "текущих карточек WB"

                />


              </section>


              {/* ======================================
                  КАК СВЕРЯТЬ
                  ====================================== */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Как сверять с кабинетом Wildberries
                    </h2>

                  </div>

                </div>


                <InfoLine>

                  Продажи: FBW за период,
                  указанный выше.
                  Отменённые заказы
                  в продажи не входят.

                </InfoLine>


                <InfoLine>

                  Отмены: считаются отдельно
                  и отображаются отдельным
                  показателем.

                </InfoLine>


                <InfoLine>

                  Остаток: используется
                  текущее значение stock_count
                  из успешного snapshot WB.

                </InfoLine>


                <InfoLine>

                  toClient и fromClient
                  показываются в исходных данных,
                  но в FBW-остаток
                  не прибавляются.

                </InfoLine>


                <InfoLine>

                  FBS, то есть
                  «Склад продавца»,
                  на этой странице
                  в продажи не входит.

                </InfoLine>


                <InfoLine>

                  Для корректного сравнения
                  в кабинете Wildberries
                  нужно использовать
                  тот же период и FBW.

                </InfoLine>

              </section>


              {/* ======================================
                  ПРОДАЖИ ПО ДНЯМ
                  ====================================== */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Продажи по дням
                    </h2>


                    <div className="muted">

                      Этот блок удобнее всего
                      использовать для контрольной
                      сверки с кабинетом Wildberries.

                    </div>

                  </div>

                </div>


                <div className="table-wrapper">

                  <table

                    className="table"

                    style={{
                      minWidth:
                        "800px",
                    }}

                  >

                    <thead>

                      <tr>

                        <th className="left">
                          Дата
                        </th>

                        <th className="right">
                          Продажи, шт.
                        </th>

                        <th className="right">
                          Отмены, шт.
                        </th>

                        <th className="right">
                          Строк в БД
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {
                        dashboard
                          .dailySales
                          .map(
                            (
                              row
                            ) => (

                              <tr
                                key={
                                  row.date
                                }
                              >

                                <td className="left">

                                  <strong>
                                    {
                                      formatDate(
                                        row.date
                                      )
                                    }
                                  </strong>

                                </td>


                                <td className="right">

                                  <strong>
                                    {
                                      formatInteger(
                                        row.sales
                                      )
                                    }
                                  </strong>

                                </td>


                                <td className="right">

                                  {
                                    formatInteger(
                                      row.cancelled
                                    )
                                  }

                                </td>


                                <td className="right">

                                  {
                                    formatInteger(
                                      row.dbRows
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


              {/* ======================================
                  ДАННЫЕ ПО ТОВАРАМ
                  ====================================== */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Данные по товарам
                    </h2>


                    <div className="muted">

                      Одна строка соответствует
                      одному физическому товару
                      по master_code.

                    </div>

                  </div>

                </div>


                <div className="table-wrapper">

                  <table

                    className="table"

                    style={{
                      minWidth:
                        "1250px",
                    }}

                  >

                    <thead>

                      <tr>

                        <th className="left">
                          master_code
                        </th>

                        <th className="left">
                          Товар
                        </th>

                        <th className="left">
                          Артикул WB
                        </th>

                        <th className="right">
                          Продажи 28 дн.
                        </th>

                        <th className="right">
                          Среднее / день
                        </th>

                        <th className="right">
                          Отмены
                        </th>

                        <th className="right">
                          Остаток
                        </th>

                        <th className="right">
                          Дней запаса
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {
                        dashboard
                          .products
                          .map(
                            (
                              row
                            ) => (

                              <tr
                                key={
                                  row.masterCode
                                }
                              >

                                <td className="left">

                                  <strong>
                                    {
                                      row.masterCode
                                    }
                                  </strong>

                                </td>


                                <td

                                  className="left"

                                  style={{

                                    whiteSpace:
                                      "normal",

                                    minWidth:
                                      "330px",

                                    maxWidth:
                                      "520px",

                                  }}

                                >

                                  {
                                    row.productName
                                    ||
                                    "—"
                                  }


                                  {
                                    row.listingsCount > 1
                                    &&
                                    (

                                      <div
                                        className="muted"
                                        style={{
                                          marginTop:
                                            "4px",
                                        }}
                                      >

                                        {
                                          formatInteger(
                                            row.listingsCount
                                          )
                                        }
                                        {" размещения"}

                                      </div>

                                    )
                                  }

                                </td>


                                <td

                                  className="left"

                                  style={{

                                    whiteSpace:
                                      "normal",

                                    minWidth:
                                      "260px",

                                    maxWidth:
                                      "420px",

                                  }}

                                >

                                  {
                                    row.sellerArticles
                                    ||
                                    "—"
                                  }


                                  <div

                                    className="muted"

                                    style={{
                                      marginTop:
                                        "4px",
                                    }}

                                  >

                                    nmID: {
                                      row.nmIds
                                    }

                                  </div>

                                </td>


                                <td className="right">

                                  <strong>

                                    {
                                      formatInteger(
                                        row.sales28Days
                                      )
                                    }

                                  </strong>

                                </td>


                                <td className="right">

                                  {
                                    formatDecimal(
                                      row.avgSalesPerDay,
                                      2
                                    )
                                  }

                                </td>


                                <td className="right">

                                  {
                                    formatInteger(
                                      row.cancelled28Days
                                    )
                                  }

                                </td>


                                <td className="right">

                                  <strong>

                                    {
                                      formatInteger(
                                        row.fbwStock
                                      )
                                    }

                                  </strong>

                                </td>


                                <td className="right">

                                  {
                                    row.daysOfStock ===
                                      null

                                      ? "—"

                                      : formatDecimal(
                                          row.daysOfStock,
                                          1
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


              {/* ======================================
                  БЕЗОПАСНЫЙ РЕЖИМ
                  ====================================== */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Безопасный режим
                    </h2>

                  </div>

                </div>


                <InfoLine>

                  Сначала система получает
                  данные Wildberries
                  и проверяет результат
                  синхронизации.

                </InfoLine>


                <InfoLine>

                  Ошибка API Wildberries
                  не считается нулевым
                  остатком.

                </InfoLine>


                <InfoLine>

                  Для страницы используется
                  последний успешно сохранённый
                  snapshot остатков.

                </InfoLine>


                <InfoLine>

                  Карточка без master_code
                  не скрывается молча:
                  загрузка dashboard
                  будет остановлена ошибкой.

                </InfoLine>


                <InfoLine>

                  В расчёте используются
                  только FBW-заказы
                  с типом склада
                  «Склад WB».

                </InfoLine>

              </section>


              {/* ======================================
                  ОБНОВЛЕНИЕ ОСТАТКОВ
                  ====================================== */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Остатки Wildberries
                    </h2>


                    <div className="muted">

                      Текущие карточки WB,
                      FBW-остаток,
                      toClient и fromClient.

                    </div>

                  </div>


                  <WbSyncClient

                    endpoint=
                      "/api/wb/sync-stocks?force=1"

                    label=
                      "Обновить остатки WB"

                    loadingLabel=
                      "Обновляем остатки..."

                  />

                </div>

              </section>


              {/* ======================================
                  ОБНОВЛЕНИЕ ПРОДАЖ
                  ====================================== */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Продажи Wildberries
                    </h2>


                    <div className="muted">

                      FBW-заказы Wildberries.
                      Отменённые заказы
                      считаются отдельно.

                    </div>

                  </div>


                  <WbSyncClient

                    endpoint=
                      "/api/wb/sync-orders"

                    label=
                      "Обновить продажи WB"

                    loadingLabel=
                      "Обновляем продажи..."

                  />

                </div>

              </section>


            </>
          )
        }


      </div>

    </main>

  );

}
