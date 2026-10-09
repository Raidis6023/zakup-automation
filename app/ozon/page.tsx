
import type { ReactNode } from "react";
import Link from "next/link";

import ThemeToggle from "../ThemeToggle";
import OzonStockSyncClient from "../OzonStockSyncClient";

import OzonProductsTableClient, {
  type OzonClusterDetailRow,
  type OzonProductRow,
} from "./OzonProductsTableClient";

import OzonUnlinkedProductsClient, {
  type OzonUnlinkedProductRow,
} from "./OzonUnlinkedProductsClient";

export const dynamic = "force-dynamic";

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
  offer_id: string | null;
  ozon_product_id: string | number | null;
  name: string | null;
};

type ProductRow = {
  master_code: string;
  product_name: string | null;
  listing_count: number;
  listings: ListingRow[];
  sales_28_days: number;
  cancelled_28_days: number;
  average_sales_per_day: number;
  stock_quantity: number;
  stock_days: number | null;
};

type DashboardData = {
  latest_sync: LatestSync | null;
  stock_snapshot_date: string | null;
  summary: Summary | null;
  daily_sales: DailySalesRow[];
  products: ProductRow[];
};

type ReplenishmentRun = {
  id: string;
  created_at: string;
  status: string;
  calculation_version: string;
  sales_date_from: string;
  sales_date_to: string;
  stock_snapshot_date: string;
  total_product_cluster_pairs: number;
  pairs_with_need: number;
  total_need_units: number;
};

type ReplenishmentItem = {
  product_id: string;
  offer_id: string | null;
  product_name: string | null;
  ozon_sku: string | null;
  cluster_id: string;
  cluster_name: string | null;
  sales_28_days: number;
  cancelled_28_days: number;
  avg_sales_per_day: number;
  stock_quantity: number;
  coverage_days: number | null;
};

type ReplenishmentData = {
  run: ReplenishmentRun | null;
  items: ReplenishmentItem[];
};

// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

function formatNumber(
  value: number | null | undefined
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  const [year, month, day] = value
    .slice(0, 10)
    .split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}.${month}.${year}`;
}

function formatDateTimeKrasnoyarsk(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Krasnoyarsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

// ============================================================
// SUPABASE CONFIG
// ============================================================

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

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
// SUPABASE GET
// ============================================================

async function supabaseGet<T>(
  url: URL
): Promise<T> {
  const { supabaseSecretKey } =
    getSupabaseConfig();

  const response = await fetch(
    url.toString(),
    {
      method: "GET",
      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase GET ${response.status}: ${text}`
    );
  }

  return JSON.parse(text) as T;
}

// ============================================================
// DASHBOARD
// ============================================================

async function getOzonDashboard():
  Promise<DashboardData> {
  const {
    supabaseUrl,
    supabaseSecretKey,
  } = getSupabaseConfig();

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/get_ozon_sync_dashboard`,
    {
      method: "POST",
      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase RPC error ${response.status}: ${text}`
    );
  }

  return JSON.parse(text) as DashboardData;
}

// ============================================================
// ПОСЛЕДНИЙ УСПЕШНЫЙ РАСЧЁТ FBO
// ============================================================

async function getLatestReplenishment():
  Promise<ReplenishmentData> {
  const { supabaseUrl } =
    getSupabaseConfig();

  // 1. Последний успешный расчёт

  const runUrl = new URL(
    `${supabaseUrl}/rest/v1/ozon_fbo_replenishment_runs`
  );

  runUrl.searchParams.set(
    "select",
    [
      "id",
      "created_at",
      "status",
      "calculation_version",
      "sales_date_from",
      "sales_date_to",
      "stock_snapshot_date",
      "total_product_cluster_pairs",
      "pairs_with_need",
      "total_need_units",
    ].join(",")
  );

  runUrl.searchParams.set(
    "status",
    "eq.success"
  );

  runUrl.searchParams.set(
    "order",
    "created_at.desc"
  );

  runUrl.searchParams.set(
    "limit",
    "1"
  );

  const runs = await supabaseGet<
    ReplenishmentRun[]
  >(runUrl);

  const run = runs[0] ?? null;

  if (!run) {
    return {
      run: null,
      items: [],
    };
  }

  // 2. Детализация расчёта

  const items: ReplenishmentItem[] = [];
  const pageSize = 1000;

  for (
    let offset = 0;
    offset < 100000;
    offset += pageSize
  ) {
    const itemsUrl = new URL(
      `${supabaseUrl}/rest/v1/ozon_fbo_replenishment_items`
    );

    itemsUrl.searchParams.set(
      "select",
      [
        "product_id",
        "offer_id",
        "product_name",
        "ozon_sku",
        "cluster_id",
        "cluster_name",
        "sales_28_days",
        "cancelled_28_days",
        "avg_sales_per_day",
        "stock_quantity",
        "coverage_days",
      ].join(",")
    );

    itemsUrl.searchParams.set(
      "calculation_run_id",
      `eq.${run.id}`
    );

    itemsUrl.searchParams.set(
      "order",
      "product_id.asc,cluster_name.asc,cluster_id.asc"
    );

    itemsUrl.searchParams.set(
      "limit",
      String(pageSize)
    );

    itemsUrl.searchParams.set(
      "offset",
      String(offset)
    );

    const page = await supabaseGet<
      ReplenishmentItem[]
    >(itemsUrl);

    items.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return {
    run,
    items,
  };
}

// ============================================================
// ТОВАРЫ OZON БЕЗ MASTER_CODE
// ============================================================

async function getOzonUnlinkedProducts():
  Promise<OzonUnlinkedProductRow[]> {
  const { supabaseUrl } =
    getSupabaseConfig();

  const url = new URL(
    `${supabaseUrl}/rest/v1/ozon_unlinked_products`
  );

  url.searchParams.set(
    "select",
    [
      "id",
      "offer_id",
      "ozon_product_id",
      "ozon_sku",
      "name",
      "first_seen_at",
      "last_seen_at",
    ].join(",")
  );

  url.searchParams.set(
    "status",
    "eq.pending"
  );

  url.searchParams.set(
    "order",
    "first_seen_at.desc"
  );

  url.searchParams.set(
    "limit",
    "1000"
  );

  return supabaseGet<
    OzonUnlinkedProductRow[]
  >(url);
}

// ============================================================
// СОБИРАЕМ ДЕТАЛИ ПО MASTER_CODE
// ============================================================

function buildClusterRowsByMasterCode(
  products: ProductRow[],
  replenishmentItems: ReplenishmentItem[]
): Record<string, OzonClusterDetailRow[]> {
  const productIndex = new Map<
    string,
    {
      masterCode: string;
      ozonProductId: string | number | null;
    }
  >();

  for (const product of products) {
    for (const listing of product.listings ?? []) {
      if (!listing.product_id) {
        continue;
      }

      productIndex.set(
        listing.product_id,
        {
          masterCode: product.master_code,
          ozonProductId:
            listing.ozon_product_id ?? null,
        }
      );
    }
  }

  const result: Record<
    string,
    OzonClusterDetailRow[]
  > = {};

  for (const item of replenishmentItems) {
    const mapping = productIndex.get(
      item.product_id
    );

    if (!mapping) {
      continue;
    }

    if (!result[mapping.masterCode]) {
      result[mapping.masterCode] = [];
    }

    result[mapping.masterCode].push({
      product_id: item.product_id,
      offer_id: item.offer_id,
      ozon_product_id: mapping.ozonProductId,
      ozon_sku: item.ozon_sku,
      cluster_id: item.cluster_id,
      cluster_name: item.cluster_name,
      sales_28_days: Number(
        item.sales_28_days ?? 0
      ),
      cancelled_28_days: Number(
        item.cancelled_28_days ?? 0
      ),
      average_sales_per_day: Number(
        item.avg_sales_per_day ?? 0
      ),
      stock_quantity: Number(
        item.stock_quantity ?? 0
      ),
      stock_days:
        item.coverage_days === null
          ? null
          : Number(item.coverage_days),
    });
  }

  return result;
}

// ============================================================
// СТРАНИЦА OZON
// ============================================================

export default async function OzonPage() {
  let dashboard: DashboardData | null = null;
  let dashboardError: string | null = null;

  let replenishment: ReplenishmentData = {
    run: null,
    items: [],
  };

  let replenishmentError: string | null = null;

  let unlinkedProducts:
    OzonUnlinkedProductRow[] = [];

  let unlinkedProductsError: string | null = null;

  // DASHBOARD

  try {
    dashboard = await getOzonDashboard();
  } catch (error) {
    dashboardError =
      error instanceof Error
        ? error.message
        : String(error);
  }

  // FBO CALCULATION DETAILS

  try {
    replenishment =
      await getLatestReplenishment();
  } catch (error) {
    replenishmentError =
      error instanceof Error
        ? error.message
        : String(error);
  }

  // ТОВАРЫ БЕЗ MASTER_CODE

  try {
    unlinkedProducts =
      await getOzonUnlinkedProducts();
  } catch (error) {
    unlinkedProductsError =
      error instanceof Error
        ? error.message
        : String(error);
  }

  const latestSync =
    dashboard?.latest_sync ?? null;

  const summary =
    dashboard?.summary ?? null;

  const dailySales =
    dashboard?.daily_sales ?? [];

  const products =
    dashboard?.products ?? [];

  const clusterRowsByMasterCode =
    buildClusterRowsByMasterCode(
      products,
      replenishment.items
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

        {/* ===================================
            ОШИБКА DASHBOARD
            =================================== */}

        {dashboardError ? (
          <section className="section">
            <h2 className="section-title">
              Ошибка загрузки данных Ozon
            </h2>

            <div
              className="reason-text"
              style={{
                color: "#b42318",
              }}
            >
              {dashboardError}
            </div>
          </section>
        ) : null}

        {/* ===================================
            ОШИБКА ДЕТАЛИЗАЦИИ FBO
            =================================== */}

        {replenishmentError ? (
          <section className="section">
            <h2 className="section-title">
              Ошибка загрузки расчёта FBO
            </h2>

            <div
              className="reason-text"
              style={{
                color: "#b42318",
              }}
            >
              {replenishmentError}
            </div>
          </section>
        ) : null}

        {/* ===================================
            СОСТОЯНИЕ СИНХРОНИЗАЦИИ
            =================================== */}

        <section className="section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              flexWrap: "wrap",
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
                padding: "8px 12px",
                borderRadius: "999px",
                background:
                  latestSync?.status === "success"
                    ? "#ecfdf3"
                    : "#fff4ed",
                color:
                  latestSync?.status === "success"
                    ? "#027a48"
                    : "#b54708",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {latestSync?.status === "success"
                ? "Успешно"
                : "Нет успешной загрузки"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "16px",
              marginTop: "20px",
            }}
          >
            <InfoCard
              label="Последняя синхронизация"
              value={formatDateTimeKrasnoyarsk(
                latestSync?.created_at
              )}
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
              value={formatDate(
                dashboard?.stock_snapshot_date
              )}
              hint="FBO"
            />

            <InfoCard
              label="Отправлений"
              value={formatNumber(
                latestSync?.postings_received
              )}
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
              {formatNumber(
                summary?.sales_28_days
              )}
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
              {formatNumber(
                summary?.cancelled_28_days
              )}
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
              {formatNumber(
                summary?.stock_quantity
              )}
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
              {formatNumber(
                summary?.active_master_codes
              )}
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
              {formatNumber(
                summary?.active_listing_rows
              )}
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
            доступный FBO-остаток
            из /v1/analytics/stocks,
            поле available_stock_count.
          </div>

          <div className="reason-text">
            Для корректного сравнения
            в кабинете Ozon нужно выбирать
            тот же период и FBO.
          </div>
        </section>

        {/* ===================================
            ПРОДАЖИ ПО ДНЯМ
            ОФОРМЛЕНИЕ КАК НА WILDBERRIES
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
              overflowX: "auto",
              marginTop: "18px",
              border: "none",
              borderRadius: "10px",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: "680px",
                borderCollapse: "separate",
                borderSpacing: 0,
                border: "none",
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      "var(--table-header-bg, #1b2028)",
                  }}
                >
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: 700,
                      color:
                        "var(--text-secondary, #b8c0cc)",
                      border: "none",
                      borderBottom:
                        "1px solid var(--table-divider, #282e38)",
                      borderTopLeftRadius: "10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Дата
                  </th>

                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "right",
                      fontSize: "12px",
                      fontWeight: 700,
                      color:
                        "var(--text-secondary, #b8c0cc)",
                      border: "none",
                      borderBottom:
                        "1px solid var(--table-divider, #282e38)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Продажи, шт.
                  </th>

                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "right",
                      fontSize: "12px",
                      fontWeight: 700,
                      color:
                        "var(--text-secondary, #b8c0cc)",
                      border: "none",
                      borderBottom:
                        "1px solid var(--table-divider, #282e38)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Отмены, шт.
                  </th>

                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "right",
                      fontSize: "12px",
                      fontWeight: 700,
                      color:
                        "var(--text-secondary, #b8c0cc)",
                      border: "none",
                      borderBottom:
                        "1px solid var(--table-divider, #282e38)",
                      borderTopRightRadius: "10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Строк в БД
                  </th>
                </tr>
              </thead>

              <tbody>
                {dailySales.map((row, index) => {
                  const isLast =
                    index === dailySales.length - 1;

                  const divider = isLast
                    ? "none"
                    : "1px solid var(--table-divider, #282e38)";

                  return (
                    <tr key={row.sale_date}>
                      <td
                        style={{
                          padding: "12px 14px",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: 700,
                          border: "none",
                          borderBottom: divider,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(row.sale_date)}
                      </td>

                      <td
                        style={{
                          padding: "12px 14px",
                          textAlign: "right",
                          fontSize: "13px",
                          border: "none",
                          borderBottom: divider,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <strong>
                          {formatNumber(
                            row.sales_quantity
                          )}
                        </strong>
                      </td>

                      <td
                        style={{
                          padding: "12px 14px",
                          textAlign: "right",
                          fontSize: "13px",
                          border: "none",
                          borderBottom: divider,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatNumber(
                          row.cancelled_quantity
                        )}
                      </td>

                      <td
                        style={{
                          padding: "12px 14px",
                          textAlign: "right",
                          fontSize: "13px",
                          border: "none",
                          borderBottom: divider,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatNumber(
                          row.rows_count
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===================================
            ТОВАРЫ БЕЗ MASTER_CODE
            =================================== */}

        <section className="section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 className="section-title">
                Товары без master_code
              </h2>

              <div className="reason-text">
                Новые товары Ozon, которые
                система пока не смогла
                привязать к физическому товару.
              </div>

              <div className="reason-text">
                Они не останавливают общую
                синхронизацию и не участвуют
                в расчёте потребности до
                ручной привязки.
              </div>
            </div>

            <div
              style={{
                padding: "8px 12px",
                borderRadius: "999px",
                background:
                  unlinkedProducts.length > 0
                    ? "#fff4ed"
                    : "#ecfdf3",
                color:
                  unlinkedProducts.length > 0
                    ? "#b54708"
                    : "#027a48",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {unlinkedProducts.length > 0
                ? `Требуют привязки: ${unlinkedProducts.length}`
                : "Все товары привязаны"}
            </div>
          </div>

          {unlinkedProductsError ? (
            <div
              className="reason-text"
              style={{
                color: "#b42318",
                marginTop: "14px",
              }}
            >
              Не удалось загрузить список:{" "}
              {unlinkedProductsError}
            </div>
          ) : (
            <OzonUnlinkedProductsClient
              products={unlinkedProducts}
            />
          )}
        </section>

        {/* ===================================
            ТОВАРЫ
            =================================== */}

        <section className="section">
          <h2 className="section-title">
            Данные по товарам
          </h2>

          <div className="reason-text">
            Верхняя строка:
            агрегат физического товара
            по master_code.
          </div>

          <div className="reason-text">
            Раскрытие:
            продажи, отмены,
            средние продажи,
            остаток и дни запаса
            отдельно по каждому
            Ozon-размещению и кластеру.
          </div>

          {replenishment.run ? (
            <div
              className="muted"
              style={{
                marginTop: "6px",
                fontSize: "11px",
              }}
            >
              Расшифровка по расчёту{" "}
              <strong>
                {
                  replenishment.run
                    .calculation_version
                }
              </strong>
              {" "}от{" "}
              {formatDateTimeKrasnoyarsk(
                replenishment.run.created_at
              )}.
            </div>
          ) : null}

          <OzonProductsTableClient
            products={
              products as OzonProductRow[]
            }
            clusterRowsByMasterCode={
              clusterRowsByMasterCode
            }
          />
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
            продажи и остатки записываются
            в Supabase одной транзакцией.
          </div>

          <div className="reason-text">
            После успешной записи
            автоматически запускается
            расчёт потребности FBO.
          </div>

          <div className="reason-text">
            Ошибка API не считается
            нулевым остатком.
          </div>
        </section>

        {/* ===================================
            СИНХРОНИЗАЦИЯ
            =================================== */}

        <OzonStockSyncClient />

      </div>
    </main>
  );
}

// ============================================================
// КОМПОНЕНТЫ
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
          fontSize: "18px",
          fontWeight: 700,
          marginTop: "6px",
        }}
      >
        {value}
      </div>

      {hint ? (
        <div
          className="muted"
          style={{
            marginTop: "5px",
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
