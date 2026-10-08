import type {
  ReactNode,
} from "react";

import Link from "next/link";

import ThemeToggle from "../ThemeToggle";
import WbSyncClient from "../WbSyncClient";


export const dynamic =
  "force-dynamic";


type DailySalesRow = {
  date: string;
  sales: number;
  cancelled: number;
  dbRows: number;
};


type ProductRow = {
  nmId: number;
  sellerArticle: string | null;
  productName: string | null;
  brandName: string | null;
  masterCode: string | null;

  sales28Days: number;
  avgSalesPerDay: number;
  cancelled28Days: number;

  fbwStock: number;
  daysOfStock: number | null;

  toClient: number;
  fromClient: number;
};


type DashboardData = {
  ok: boolean;

  calculationKey: string;
  marketplace: string;

  status: {
    ok: boolean;
    label: string;

    lastSuccessfulSyncAt: string | null;
    ordersLastSuccessAt: string | null;
    stocksLastSuccessAt: string | null;

    ordersLastHttpStatus: number | null;
    stocksLastHttpStatus: number | null;

    stockSnapshotId: string | null;
    stockSnapshotAt: string | null;
  };

  period: {
    days: number;
    dateFrom: string;
    dateTo: string;
    samePeriodAsOzon: boolean;
    note: string;
  };

  summary: {
    orderRows: number;
    sales28Days: number;
    cancelled28Days: number;

    fbwStock: number;
    toClient: number;
    fromClient: number;

    physicalProducts: number;
    listings: number;
  };

  dailySales: DailySalesRow[];

  products: ProductRow[];

  validation: {
    currentUnmapped: number;
    mappingRows: number;
    duplicateNmId: number;
    duplicateSrid: number;
    nullIsCancel: number;
    ordersOutsideCurrentSnapshot: number;
  };
};


function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

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
  } = getSupabaseConfig();

  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_wb_sync_dashboard`,
      {
        method: "POST",

        headers: {
          apikey: supabaseKey,

          Authorization:
            `Bearer ${supabaseKey}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body: "{}",

        cache: "no-store",
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить WB dashboard. HTTP ${response.status}: ${text}`
    );
  }

  let data: DashboardData;

  try {
    data =
      JSON.parse(
        text
      ) as DashboardData;
  } catch {
    throw new Error(
      "Supabase вернул некорректный JSON для WB dashboard"
    );
  }

  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "WB dashboard вернул пустой ответ"
    );
  }

  return data;
}


function formatInteger(
  value: number | null | undefined
) {
  const number =
    Number(
      value ?? 0
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0";
  }

  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits: 0,
    }
  ).format(number);
}


function formatDecimal(
  value: number | null | undefined,
  digits = 2
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }
  ).format(number);
}


function formatDate(
  value: string | null | undefined
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
    datePart.split("-");

  if (
    parts.length !== 3
  ) {
    return value;
  }

  return [
    parts[2],
    parts[1],
    parts[0],
  ].join(".");
}


function formatKrasnoyarskDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
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
  ).format(date);
}


function formatKrasnoyarskDate(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
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
  ).format(date);
}


function SummaryCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: ReactNode;
  caption: ReactNode;
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
  children: ReactNode;
}) {
  return (
    <div
      className="reason-text"
      style={{
        marginTop: "5px",
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
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Не удалось загрузить страницу Wildberries";
  }

  return (
    <main className="page">

      <div className="container">


        {/* ==================================================
            HEADER
            ================================================== */}

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


        {/* ==================================================
            ОШИБКА ЗАГРУЗКИ
            ================================================== */}

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


              {/* ============================================
                  СОСТОЯНИЕ СИНХРОНИЗАЦИИ
                  ============================================ */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Состояние синхронизации
                    </h2>

                    <div className="muted">
                      Последняя успешная загрузка FBW-данных из Wildberries.
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
                    {dashboard.status.label}
                  </span>

                </div>


                <div
                  className="summary-grid"
                  style={{
                    marginBottom: 0,
                  }}
                >

                  <SummaryCard
                    label="Последняя синхронизация"
                    value={
                      formatKrasnoyarskDateTime(
                        dashboard
                          .status
                          .lastSuccessfulSyncAt
                      )
                    }
                    caption="Красноярское время"
                  />


                  <SummaryCard
                    label="Период продаж"
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
                    caption="Скользящие 28 дней"
                  />


                  <SummaryCard
                    label="Снимок остатков"
                    value={
                      formatKrasnoyarskDate(
                        dashboard
                          .status
                          .stockSnapshotAt
                      )
                    }
                    caption="FBW"
                  />


                  <SummaryCard
                    label="Заказов"
                    value={
                      formatInteger(
                        dashboard
                          .summary
                          .orderRows
                      )
                    }
                    caption="Получено из Wildberries"
                  />

                </div>

              </section>


              {/* ============================================
                  KPI
                  ============================================ */}

              <section className="summary-grid">

                <SummaryCard
                  label="Продажи за 28 дней"
                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .sales28Days
                    )
                  }
                  caption="шт., без отмен"
                />


                <SummaryCard
                  label="Отмены"
                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .cancelled28Days
                    )
                  }
                  caption="шт. отдельно от продаж"
                />


                <SummaryCard
                  label="Остаток FBW"
                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .fbwStock
                    )
                  }
                  caption="доступно на складах WB"
                />


                <SummaryCard
                  label="Связанных master_code"
                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .physicalProducts
                    )
                  }
                  caption="только справочная связь"
                />


                <SummaryCard
                  label="Карточек WB"
                  value={
                    formatInteger(
                      dashboard
                        .summary
                        .listings
                    )
                  }
                  caption="расчётный ключ nmID"
                />

              </section>


              {/* ============================================
                  КАК СВЕРЯТЬ
                  ============================================ */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Как сверять с кабинетом Wildberries
                    </h2>

                  </div>

                </div>


                <InfoLine>
                  Продажи считаются отдельно для каждого числового артикула WB, то есть nmID.
                </InfoLine>


                <InfoLine>
                  Используются только FBW-заказы с типом склада «Склад WB».
                </InfoLine>


                <InfoLine>
                  Отменённые заказы в продажи не входят и показываются отдельным показателем.
                </InfoLine>


                <InfoLine>
                  Остаток каждой карточки берётся только из текущего FBW-остатка Wildberries.
                </InfoLine>


                <InfoLine>
                  Остатки Ozon на этой странице не используются и к остаткам WB не прибавляются.
                </InfoLine>


                <InfoLine>
                  toClient и fromClient отображаются в исходных данных, но в доступный FBW-остаток не входят.
                </InfoLine>


                <InfoLine>
                  master_code отображается только как связь карточки с физическим товаром для будущего расчёта закупки в Китай.
                </InfoLine>


                <InfoLine>
                  Период продаж совпадает с периодом Ozon, но данные площадок остаются раздельными.
                </InfoLine>

              </section>


              {/* ============================================
                  ПРОДАЖИ ПО ДНЯМ
                  ============================================ */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Продажи по дням
                    </h2>

                    <div className="muted">
                      Этот блок удобнее всего использовать для контрольной сверки с кабинетом Wildberries.
                    </div>

                  </div>

                </div>


                <div className="table-wrapper">

                  <table
                    className="table"
                    style={{
                      minWidth: "800px",
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
                            (row) => (

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


              {/* ============================================
                  ДАННЫЕ ПО КАРТОЧКАМ WB
                  ============================================ */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Данные по товарам
                    </h2>

                    <div className="muted">
                      Одна строка соответствует одной карточке Wildberries по nmID.
                    </div>

                  </div>

                </div>


                <div className="table-wrapper">

                  <table
                    className="table"
                    style={{
                      minWidth: "1450px",
                    }}
                  >

                    <thead>

                      <tr>

                        <th className="left">
                          nmID
                        </th>

                        <th className="left">
                          Артикул продавца
                        </th>

                        <th className="left">
                          Товар
                        </th>

                        <th className="left">
                          master_code
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
                            (row) => (

                              <tr
                                key={
                                  row.nmId
                                }
                              >

                                <td className="left">

                                  <strong>
                                    {
                                      row.nmId
                                    }
                                  </strong>

                                </td>


                                <td
                                  className="left"
                                  style={{
                                    whiteSpace:
                                      "normal",

                                    minWidth:
                                      "240px",

                                    maxWidth:
                                      "360px",
                                  }}
                                >
                                  {
                                    row.sellerArticle
                                    ||
                                    "—"
                                  }
                                </td>


                                <td
                                  className="left"
                                  style={{
                                    whiteSpace:
                                      "normal",

                                    minWidth:
                                      "320px",

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
                                    row.brandName
                                    &&
                                    row.brandName.trim()
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
                                          row.brandName
                                        }
                                      </div>
                                    )
                                  }

                                </td>


                                <td className="left">

                                  {
                                    row.masterCode
                                    ||
                                    "—"
                                  }

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
                                    row.daysOfStock === null
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


              {/* ============================================
                  БЕЗОПАСНЫЙ РЕЖИМ
                  ============================================ */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Безопасный режим
                    </h2>

                  </div>

                </div>


                <InfoLine>
                  Система использует только успешно сохранённые данные Wildberries.
                </InfoLine>


                <InfoLine>
                  Ошибка API Wildberries не считается нулевым остатком.
                </InfoLine>


                <InfoLine>
                  Для страницы используется последний успешно сохранённый snapshot остатков WB.
                </InfoLine>


                <InfoLine>
                  Каждая карточка рассчитывается отдельно по nmID.
                </InfoLine>


                <InfoLine>
                  Остатки и продажи Ozon не используются при расчёте показателей WB.
                </InfoLine>


                <InfoLine>
                  FBS, то есть «Склад продавца», в текущий расчёт пополнения WB не входит.
                </InfoLine>

              </section>


              {/* ============================================
                  ОСТАТКИ WB
                  ============================================ */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Остатки Wildberries
                    </h2>

                    <div className="muted">
                      Текущий FBW-остаток по карточкам Wildberries.
                    </div>

                  </div>


                  <WbSyncClient
                    endpoint="/api/wb/sync-stocks?force=1"
                    label="Обновить остатки WB"
                    loadingLabel="Обновляем остатки..."
                  />

                </div>

              </section>


              {/* ============================================
                  ПРОДАЖИ WB
                  ============================================ */}

              <section className="section">

                <div className="section-header">

                  <div>

                    <h2 className="section-title">
                      Продажи Wildberries
                    </h2>

                    <div className="muted">
                      FBW-заказы Wildberries. Отменённые заказы считаются отдельно.
                    </div>

                  </div>


                  <WbSyncClient
                    endpoint="/api/wb/sync-orders"
                    label="Обновить продажи WB"
                    loadingLabel="Обновляем продажи..."
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
