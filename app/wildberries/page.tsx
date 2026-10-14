import type {
  ReactNode,
} from "react";

import Link
from "next/link";

import ThemeToggle
from "../ThemeToggle";

import WbSyncClient
from "../WbSyncClient";

import WbUnmappedProductsTable
from "../WbUnmappedProductsTable";

import WorkspaceDecoration
from "../WorkspaceDecoration";

import "./wb-reference.css";
import "./wb-reference-top.css";
import "./wb-page-header.css";


export const dynamic =
  "force-dynamic";


// ============================================================
// TYPES
// ============================================================

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


type UnmappedProductRow = {
  nmId: number;
  sellerArticle: string | null;
  productName: string | null;
  brandName: string | null;
  firstSeenAt: string | null;
  sales28Days: number;
  cancelled28Days: number;
  fbwStock: number;
};


type DashboardData = {

  ok:
    boolean;

  calculationKey:
    string;

  marketplace:
    string;


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

    cancellationsLastSuccessAt?:
      string | null;

    stocksAndSalesLastSuccessAt?:
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

    samePeriodAsOzon:
      boolean;

    note:
      string;

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
    unknown[];


  products:
    ProductRow[];


  unmappedProducts:
    UnmappedProductRow[];


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

    missingFunnelRows?:
      number;

  };

};


// ============================================================
// SYNC STATE
// ============================================================

type WbSyncStateRow = {

  sync_key:
    string;

  last_attempt_at:
    string | null;

  last_success_at:
    string | null;

  next_allowed_at:
    string | null;

  last_http_status:
    number | null;

  retry_after_seconds:
    number | null;

  last_message:
    string | null;

  updated_at:
    string | null;

};


type ClientSyncState = {

  lastHttpStatus:
    number | null;

  lastAttemptAt:
    string | null;

  lastSuccessAt:
    string | null;

  nextAllowedAt:
    string | null;

  retryAfterSeconds:
    number | null;

  lastMessage:
    string | null;

};


type WbReferenceIconName =
  | "clock"
  | "calendar"
  | "warehouse"
  | "orders"
  | "sales"
  | "cancel"
  | "stock"
  | "products"
  | "listings"
  | "info"
  | "shield";


// ============================================================
// ICONS
// ============================================================

function WbReferenceIcon({
  name,
}: {
  name:
    WbReferenceIconName;
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
    "calendar"
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
          height="16"
          rx="2"
        />

        <path
          d="M8 3v4M16 3v4M3 10h18"
        />

      </svg>

    );

  }


  if (
    name ===
    "warehouse"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <path
          d="M3 10 12 4l9 6v10H3Z"
        />

        <path
          d="M8 20v-6h8v6"
        />

      </svg>

    );

  }


  if (
    name ===
      "orders"
    ||
    name ===
      "listings"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <path
          d="M5 4h14v16H5Z"
        />

        <path
          d="M8 8h8M8 12h8M8 16h5"
        />

      </svg>

    );

  }


  if (
    name ===
    "sales"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <path
          d="M4 19V11M10 19V5M16 19V8M22 19V3"
        />

      </svg>

    );

  }


  if (
    name ===
    "cancel"
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
          d="m9 9 6 6M15 9l-6 6"
        />

      </svg>

    );

  }


  if (
    name ===
      "stock"
    ||
    name ===
      "products"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <path
          d="M12 3 20 7 12 11 4 7Z"
        />

        <path
          d="M4 7v10l8 4 8-4V7"
        />

        <path
          d="M12 11v10"
        />

      </svg>

    );

  }


  if (
    name ===
    "shield"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <path
          d="M12 3 20 6v6c0 4.5-2.8 7.5-8 9-5.2-1.5-8-4.5-8-9V6Z"
        />

        <path
          d="m9 12 2 2 4-4"
        />

      </svg>

    );

  }


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
        d="M12 10v6M12 7h.01"
      />

    </svg>

  );

}


// ============================================================
// SUPABASE
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env.SUPABASE_URL
    ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;


  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env.SUPABASE_SECRET_KEY;


  if (
    !supabaseUrl
  ) {

    throw new Error(
      "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (
    !supabaseKey
  ) {

    throw new Error(
      "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseKey,
  };

}


// ============================================================
// DASHBOARD
// ============================================================

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


  if (
    !response.ok
  ) {

    throw new Error(
      `Не удалось загрузить WB dashboard. HTTP ${response.status}: ${text}`
    );

  }


  try {

    return JSON.parse(
      text
    ) as
      DashboardData;

  } catch {

    throw new Error(
      "Supabase вернул некорректный JSON для WB dashboard"
    );

  }

}


// ============================================================
// SYNC STATES
// ============================================================

async function getWbSyncStates():
Promise<WbSyncStateRow[]> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/wb_sync_state?select=*`,
      {
        method:
          "GET",

        headers: {

          apikey:
            supabaseKey,

          Authorization:
            `Bearer ${supabaseKey}`,

          Accept:
            "application/json",

        },

        cache:
          "no-store",
      }
    );


  if (
    !response.ok
  ) {

    const text =
      await response.text();


    throw new Error(
      `Не удалось получить wb_sync_state. HTTP ${response.status}: ${text}`
    );

  }


  return (
    await response.json()
  ) as
    WbSyncStateRow[];

}


// ============================================================
// CLIENT STATE
// ============================================================

function toClientSyncState(
  row:
    WbSyncStateRow | null
):
ClientSyncState | null {

  if (
    !row
  ) {

    return null;

  }


  return {

    lastHttpStatus:
      row.last_http_status,

    lastAttemptAt:
      row.last_attempt_at,

    lastSuccessAt:
      row.last_success_at,

    nextAllowedAt:
      row.next_allowed_at,

    retryAfterSeconds:
      row.retry_after_seconds,

    lastMessage:
      row.last_message,

  };

}


// ============================================================
// FORMAT
// ============================================================

function formatInteger(
  value:
    number | null | undefined
) {

  const number =
    Number(
      value
      ??
      0
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
      maximumFractionDigits:
        0,
    }
  ).format(
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


  return new Intl.NumberFormat(
    "ru-RU",
    {

      minimumFractionDigits:
        digits,

      maximumFractionDigits:
        digits,

    }
  ).format(
    number
  );

}


function formatDate(
  value:
    string | null | undefined
) {

  if (
    !value
  ) {

    return "—";

  }


  const parts =
    value
      .slice(
        0,
        10
      )
      .split(
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
  ).format(
    date
  );

}


// ============================================================
// PAGE
// ============================================================

export default async function WildberriesPage() {

  let dashboard:
    DashboardData | null =
      null;


  let loadError =
    "";


  let syncStates:
    WbSyncStateRow[] =
      [];


  try {

    dashboard =
      await getDashboard();

  } catch (
    error
  ) {

    loadError =
      error instanceof Error

        ?
        error.message

        :
        "Не удалось загрузить страницу Wildberries";

  }


  try {

    syncStates =
      await getWbSyncStates();

  } catch {

    syncStates =
      [];

  }


  const unifiedStateRow =
    syncStates.find(
      row =>
        row.sync_key ===
        "stocks"
    )
    ??
    null;


  const unifiedState =
    toClientSyncState(
      unifiedStateRow
    );


  return (

    <main
      className="page wb-reference-page"
    >

      <div
        className="container"
      >

        {/* =====================================================
            ЗАКРЕПЛЁННАЯ ШАПКА WB

            Только:
            - Wildberries
            - подпись
            - кнопки
            - полосы

            Никакого квадратного WB-логотипа.
            Никакого "СИСТЕМА ЗАКУПА".
            Никакого "— синхронизация".
            ===================================================== */}

        <header
          className="header wb-header wb-page-header-sticky"
        >

          <div
            className="wb-title-wrap wb-title-wrap--text-only"
          >

            <div>

              <h1
                className="title wb-page-title"
              >
                Wildberries
              </h1>


              <p
                className="subtitle wb-page-subtitle"
              >
                Продажи, аналитические отмены и доступные FBW-остатки Wildberries.
              </p>

            </div>

          </div>


          <div
            className="header-actions wb-header-actions"
          >

            <ThemeToggle />


            <Link
              href="/stock-import"
              className="secondary-button wb-navigation-button"
            >
              Остатки склада
            </Link>


            <Link
              href="/"
              className="secondary-button wb-navigation-button"
            >
              ← Главная
            </Link>

          </div>


          <div
            className="wb-page-header-decoration"
            aria-hidden="true"
          >

            <WorkspaceDecoration />

          </div>

        </header>


        {/* =====================================================
            ERROR
            ===================================================== */}

        {
          loadError

            ? (

              <section
                className="section wb-error-section"
              >

                <div
                  className="wb-error-title"
                >
                  Ошибка загрузки Wildberries
                </div>


                <div
                  className="reason-text wb-error-text"
                >
                  {
                    loadError
                  }
                </div>

              </section>

            )

            :
            null
        }


        {
          dashboard

            ? (

              <>

                {/* =================================================
                    ВЕРХНЯЯ ПЛАШКА — 4 РАВНЫЕ ЧАСТИ
                    ================================================= */}

                <section
                  className="card wb-sync-hero"
                  aria-label="Состояние синхронизации Wildberries"
                >

                  {/* ===============================================
                      1 / 4 — СТАТУС
                      =============================================== */}

                  <div
                    className="wb-sync-hero__quarter"
                  >

                    <div
                      className={
                        dashboard.status.ok
                          ? "wb-sync-status-card wb-sync-status-card--success"
                          : "wb-sync-status-card wb-sync-status-card--warning"
                      }
                    >

                      <span
                        className="wb-sync-status-card__icon"
                        aria-hidden="true"
                      >

                        {
                          dashboard.status.ok
                            ? "✓"
                            : "!"
                        }

                      </span>


                      <div
                        className="wb-sync-status-card__content"
                      >

                        <div
                          className="wb-sync-status-card__title"
                        >

                          {
                            dashboard.status.ok
                              ? "Синхронизация завершена"
                              : "Требует проверки"
                          }

                        </div>


                        <div
                          className="wb-sync-status-card__hint"
                        >

                          {
                            dashboard.status.ok
                              ? "Данные Wildberries успешно обновлены"
                              : "Проверьте последнее обновление данных"
                          }

                        </div>

                      </div>

                    </div>

                  </div>


                  {/* ===============================================
                      2 / 4 — ПОСЛЕДНЯЯ СИНХРОНИЗАЦИЯ
                      =============================================== */}

                  <div
                    className="wb-sync-hero__quarter wb-sync-hero__quarter--border"
                  >

                    <div
                      className="wb-sync-fact"
                    >

                      <span
                        className="wb-sync-fact__icon"
                        aria-hidden="true"
                      >

                        <WbReferenceIcon
                          name="clock"
                        />

                      </span>


                      <div
                        className="wb-sync-fact__content"
                      >

                        <div
                          className="wb-sync-fact__label"
                        >
                          Последняя синхронизация
                        </div>


                        <div
                          className="wb-sync-fact__value"
                        >

                          {
                            formatKrasnoyarskDateTime(
                              dashboard.status.lastSuccessfulSyncAt
                            )
                          }

                        </div>


                        <div
                          className="wb-sync-fact__hint"
                        >
                          Красноярское время
                        </div>

                      </div>

                    </div>

                  </div>


                  {/* ===============================================
                      3 / 4 — ПЕРИОД ПРОДАЖ
                      =============================================== */}

                  <div
                    className="wb-sync-hero__quarter wb-sync-hero__quarter--border"
                  >

                    <div
                      className="wb-sync-fact"
                    >

                      <span
                        className="wb-sync-fact__icon"
                        aria-hidden="true"
                      >

                        <WbReferenceIcon
                          name="calendar"
                        />

                      </span>


                      <div
                        className="wb-sync-fact__content"
                      >

                        <div
                          className="wb-sync-fact__label"
                        >
                          Период продаж
                        </div>


                        <div
                          className="wb-sync-fact__value"
                        >

                          {
                            formatDate(
                              dashboard.period.dateFrom
                            )
                          }

                          {" – "}

                          {
                            formatDate(
                              dashboard.period.dateTo
                            )
                          }

                        </div>


                        <div
                          className="wb-sync-fact__hint"
                        >
                          Скользящие 28 дней
                        </div>

                      </div>

                    </div>

                  </div>


                  {/* ===============================================
                      4 / 4 — КНОПКА
                      =============================================== */}

                  <div
                    className="wb-sync-hero__quarter wb-sync-hero__quarter--border"
                  >

                    <div
                      className="wb-sync-hero__action"
                    >

                      <WbSyncClient
                        endpoint="/api/wb/sync-stocks?force=1"
                        label="Обновить данные"
                        loadingLabel="Обновляем данные..."
                        initialState={unifiedState}
                      />

                    </div>

                  </div>

                </section>


                {/* =================================================
                    KPI
                    ================================================= */}

                <section
                  className="summary-grid wb-summary-grid"
                >

                  <SummaryCard
                    icon="sales"
                    tone="green"
                    label="Продажи за 28 дней"

                    value={
                      formatInteger(
                        dashboard.summary.sales28Days
                      )
                    }

                    caption="buyoutCount, шт."
                  />


                  <SummaryCard
                    icon="cancel"
                    tone="red"
                    label="Отмены"

                    value={
                      formatInteger(
                        dashboard.summary.cancelled28Days
                      )
                    }

                    caption="cancelCount Воронки продаж"
                  />


                  <SummaryCard
                    icon="stock"
                    tone="purple"
                    label="Остаток FBW"

                    value={
                      formatInteger(
                        dashboard.summary.fbwStock
                      )
                    }

                    caption="stockCount на складах WB"
                  />


                  <SummaryCard
                    icon="products"
                    tone="blue"
                    label="Связанных master_code"

                    value={
                      formatInteger(
                        dashboard.summary.physicalProducts
                      )
                    }

                    caption="только справочная связь"
                  />


                  <SummaryCard
                    icon="listings"
                    tone="orange"
                    label="Артикулов WB"

                    value={
                      formatInteger(
                        dashboard.summary.listings
                      )
                    }

                    caption="текущих карточек Wildberries"
                  />

                </section>


                {/* =================================================
                    INFO PANEL
                    ================================================= */}

                <section
                  className="section wb-info-panel"
                >

                  <span
                    className="wb-panel-icon"
                  >

                    <WbReferenceIcon
                      name="info"
                    />

                  </span>


                  <div>

                    <h2
                      className="section-title"
                    >
                      Как теперь считаются данные Wildberries
                    </h2>


                    <div
                      className="wb-info-list"
                    >

                      <InfoLine>
                        Продажи за 28 дней берутся из buyoutCount отчёта «История остатков» Wildberries.
                      </InfoLine>


                      <InfoLine>
                        Остаток берётся из stockCount того же отчёта с фильтром stockType = «wb», то есть по складам Wildberries.
                      </InfoLine>


                      <InfoLine>
                        Отмены берутся из cancelCount «Воронки продаж» за тот же 28-дневный период.
                      </InfoLine>


                      <InfoLine>
                        cancelCount — аналитический показатель Воронки продаж. Это уже не старый FBW-флаг isCancel из supplier/orders.
                      </InfoLine>


                      <InfoLine>
                        Все три показателя сохраняются одним общим snapshot, поэтому время синхронизации у них теперь одно.
                      </InfoLine>


                      <InfoLine>
                        master_code используется для связи карточки с физическим товаром и дальнейшего расчёта закупки.
                      </InfoLine>


                      <InfoLine>
                        Период Wildberries берётся тот же, что и последний успешный 28-дневный период Ozon.
                      </InfoLine>

                    </div>

                  </div>

                </section>


                {/* =================================================
                    UNMAPPED
                    ================================================= */}

                <WbUnmappedProductsTable
                  rows={
                    dashboard.unmappedProducts
                    ??
                    []
                  }
                />


                {/* =================================================
                    PRODUCTS
                    ================================================= */}

                <section
                  className="section wb-products-section"
                >

                  <div
                    className="wb-products-header"
                  >

                    <h2
                      className="section-title"
                    >
                      Данные по товарам
                    </h2>


                    <div
                      className="reason-text"
                    >
                      Одна строка соответствует одному Артикулу WB.
                    </div>

                  </div>


                  <div
                    className="wb-products-table-shell"
                  >

                    <table
                      className="wb-products-table"
                    >

                      <thead>

                        <tr>

                          <th>
                            Артикул WB
                          </th>


                          <th>
                            Артикул продавца
                          </th>


                          <th>
                            Товар
                          </th>


                          <th>
                            master_code
                          </th>


                          <th
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            Продажи 28 дн.
                          </th>


                          <th
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            Среднее / день
                          </th>


                          <th
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            Отмены
                          </th>


                          <th
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            Остаток
                          </th>


                          <th
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            Дней запаса
                          </th>

                        </tr>

                      </thead>


                      <tbody>

                        {
                          dashboard.products.map(
                            row => (

                              <tr
                                key={
                                  row.nmId
                                }
                              >

                                <td>

                                  <strong>
                                    {
                                      row.nmId
                                    }
                                  </strong>

                                </td>


                                <td
                                  className="wb-seller-article-cell"
                                >
                                  {
                                    row.sellerArticle
                                    ||
                                    "—"
                                  }
                                </td>


                                <td
                                  className="wb-product-name-cell"
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

                                      ? (

                                        <div
                                          className="muted"
                                        >
                                          {
                                            row.brandName
                                          }
                                        </div>

                                      )

                                      :
                                      null
                                  }

                                </td>


                                <td>

                                  {
                                    row.masterCode

                                      ? (

                                        <span
                                          className="wb-master-code"
                                        >
                                          {
                                            row.masterCode
                                          }
                                        </span>

                                      )

                                      :
                                      "—"
                                  }

                                </td>


                                <td
                                  style={{
                                    textAlign:
                                      "right",
                                  }}
                                >

                                  <strong>

                                    {
                                      formatInteger(
                                        row.sales28Days
                                      )
                                    }

                                  </strong>

                                </td>


                                <td
                                  style={{
                                    textAlign:
                                      "right",
                                  }}
                                >

                                  {
                                    formatDecimal(
                                      row.avgSalesPerDay,
                                      2
                                    )
                                  }

                                </td>


                                <td
                                  style={{
                                    textAlign:
                                      "right",
                                  }}
                                >

                                  {
                                    formatInteger(
                                      row.cancelled28Days
                                    )
                                  }

                                </td>


                                <td
                                  style={{
                                    textAlign:
                                      "right",
                                  }}
                                >

                                  <strong>

                                    {
                                      formatInteger(
                                        row.fbwStock
                                      )
                                    }

                                  </strong>

                                </td>


                                <td
                                  style={{
                                    textAlign:
                                      "right",
                                  }}
                                >

                                  {
                                    row.daysOfStock ===
                                    null

                                      ?
                                      "—"

                                      :
                                      formatDecimal(
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


                {/* =================================================
                    SAFE MODE
                    ================================================= */}

                <section
                  className="section wb-safe-section"
                >

                  <span
                    className="wb-safe-icon"
                  >

                    <WbReferenceIcon
                      name="shield"
                    />

                  </span>


                  <div>

                    <h2
                      className="section-title"
                    >
                      Безопасный режим
                    </h2>


                    <div
                      className="wb-info-list"
                    >

                      <InfoLine>
                        Новый snapshot сохраняется только если успешно получены и «История остатков», и «Воронка продаж».
                      </InfoLine>


                      <InfoLine>
                        Если один из двух запросов WB завершился ошибкой, сайт продолжит показывать предыдущий успешно сохранённый snapshot.
                      </InfoLine>


                      <InfoLine>
                        Ручное обновление доступно не чаще одного раза в 30 минут.
                      </InfoLine>


                      <InfoLine>
                        Перед утренним cron ручная кнопка временно блокируется, чтобы не занять его лимит.
                      </InfoLine>


                      <InfoLine>
                        FBS не входит в stockCount, потому что отчёт остатков запрашивается с stockType = «wb».
                      </InfoLine>


                      <InfoLine>
                        Карточки без master_code показываются отдельно и не участвуют в закупке до ручной привязки.
                      </InfoLine>

                    </div>

                  </div>

                </section>

              </>

            )

            :
            null
        }

      </div>

    </main>

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
  caption,
}: {

  icon:
    WbReferenceIconName;

  tone:
    "green"
    |
    "red"
    |
    "purple"
    |
    "blue"
    |
    "orange";

  label:
    string;

  value:
    ReactNode;

  caption:
    ReactNode;

}) {

  return (

    <div
      className="card wb-summary-card"
    >

      <span
        className={
          `wb-summary-icon wb-summary-icon--${tone}`
        }
      >

        <WbReferenceIcon
          name={
            icon
          }
        />

      </span>


      <div
        className="wb-summary-copy"
      >

        <div
          className="card-label"
        >
          {
            label
          }
        </div>


        <div
          className="big-number"
        >
          {
            value
          }
        </div>


        <div
          className="muted"
        >
          {
            caption
          }
        </div>

      </div>

    </div>

  );

}


// ============================================================
// INFO LINE
// ============================================================

function InfoLine({
  children,
}: {
  children:
    ReactNode;
}) {

  return (

    <div
      className="reason-text"
    >
      {
        children
      }
    </div>

  );

}
