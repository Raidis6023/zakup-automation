"use client";

import {
  useState,
} from "react";


// ============================================================
// ОСТАТКИ
// ============================================================

type StockSyncResult = {

  ok: boolean;

  message?: string;

  snapshotDate?: string;

  error?: string;

  ozon?: {

    reportedTotalProducts:
      number | null;

    productsReceived:
      number;

    uniqueOffers:
      number;

    fboSkuCount:
      number;

    analyticsRequests:
      number;

    analyticsRows:
      number;

    uniqueClusters:
      number;

    clusterRowsPrepared:
      number;

  };

  supabase?: {

    ok?: boolean;

    sync_run_id?: string;

    snapshot_date?: string;

    products_received?: number;

    fbo_skus_received?: number;

    analytics_rows_received?: number;

    cluster_rows_saved?: number;

  };

};


// ============================================================
// ПРОДАЖИ
// ============================================================

type SalesSyncResult = {

  ok: boolean;

  message?: string;

  error?: string;

  period?: {

    completedDays:
      number;

    timezone:
      string;

    dateFrom:
      string;

    dateTo:
      string;

  };

  ozon?: {

    postingsReceived:
      number;

    uniquePostings:
      number;

    cancelledPostings:
      number;

    statusCounts:
      Record<string, number>;

    uniqueProducts:
      number;

    uniqueClusters:
      number;

    aggregatedRows:
      number;

    salesQuantityExcludingCancelled:
      number;

    cancelledQuantity:
      number;

  };

  supabase?: {

    ok?: boolean;

    sync_run_id?: string;

    date_from?: string;

    date_to?: string;

    completed_days?: number;

    postings_received?: number;

    cancelled_postings?: number;

    aggregated_rows_saved?: number;

  };

};


// ============================================================
// ФОРМАТ ЧИСЛА
// ============================================================

function formatNumber(
  value:
    | number
    | null
    | undefined
) {

  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }


  return Number(
    value
  ).toLocaleString(
    "ru-RU"
  );
}


// ============================================================
// КОМПОНЕНТ
// ============================================================

export default function OzonStockSyncClient() {

  // ==========================================================
  // ОСТАТКИ
  // ==========================================================

  const [
    stockLoading,
    setStockLoading,
  ] =
    useState(false);


  const [
    stockResult,
    setStockResult,
  ] =
    useState<
      StockSyncResult | null
    >(null);


  // ==========================================================
  // ПРОДАЖИ
  // ==========================================================

  const [
    salesLoading,
    setSalesLoading,
  ] =
    useState(false);


  const [
    salesResult,
    setSalesResult,
  ] =
    useState<
      SalesSyncResult | null
    >(null);


  // ==========================================================
  // ЗАПУСК ОСТАТКОВ
  // ==========================================================

  async function runStockSync() {

    setStockLoading(
      true
    );

    setStockResult(
      null
    );


    try {

      const response =
        await fetch(
          "/api/ozon-sync-stocks",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",
          }
        );


      const data =
        await response
          .json() as
          StockSyncResult;


      setStockResult(
        data
      );


    } catch (error) {

      setStockResult(
        {
          ok: false,

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка синхронизации остатков",
        }
      );

    } finally {

      setStockLoading(
        false
      );

    }

  }


  // ==========================================================
  // ЗАПУСК ПРОДАЖ
  // ==========================================================

  async function runSalesSync() {

    setSalesLoading(
      true
    );

    setSalesResult(
      null
    );


    try {

      const response =
        await fetch(
          "/api/ozon-sync-sales",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",
          }
        );


      const data =
        await response
          .json() as
          SalesSyncResult;


      setSalesResult(
        data
      );


    } catch (error) {

      setSalesResult(
        {
          ok: false,

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка синхронизации продаж",
        }
      );

    } finally {

      setSalesLoading(
        false
      );

    }

  }


  return (

    <>


      {/* ======================================================
          ОСТАТКИ OZON
          ====================================================== */}

      <section className="controls">

        <div>

          <h2 className="controls-title">
            Остатки Ozon
          </h2>


          <div className="muted">

            Все товары кабинета,
            FBO SKU и доступные остатки
            по кластерам.

          </div>

        </div>


        <button
          type="button"

          className="primary-button"

          disabled={
            stockLoading ||
            salesLoading
          }

          onClick={
            () => {
              void runStockSync();
            }
          }
        >

          {stockLoading
            ? "Загружаем остатки..."
            : "Обновить остатки Ozon"}

        </button>

      </section>


      {stockLoading && (

        <section className="section">

          <h2 className="section-title">
            Загружаем остатки Ozon
          </h2>


          <div className="reason-text">

            Получаем товары,
            FBO SKU и данные
            analytics/stocks.

          </div>


          <div className="reason-text">

            Новый снимок будет записан
            только после успешного
            завершения всех запросов.

          </div>

        </section>

      )}


      {stockResult &&
        !stockResult.ok && (

        <section className="section">

          <h2 className="section-title">
            Ошибка остатков Ozon
          </h2>


          <div className="reason-box">

            <strong>
              Остатки не обновлены
            </strong>


            <div className="reason-text">

              {
                stockResult.error
                ??
                stockResult.message
                ??
                "Неизвестная ошибка"
              }

            </div>

          </div>

        </section>

      )}


      {stockResult?.ok && (

        <>

          <section className="summary-grid">


            <div className="card">

              <div className="card-label">
                Товаров сообщил Ozon
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.reportedTotalProducts
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Получено товаров
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.productsReceived
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Уникальных артикулов
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.uniqueOffers
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                FBO SKU
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.fboSkuCount
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Запросов analytics
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.analyticsRequests
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Строк от Ozon
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.analyticsRows
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Кластеров
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.uniqueClusters
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Строк сохранено
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .supabase
                    ?.cluster_rows_saved
                  ??
                  stockResult
                    .ozon
                    ?.clusterRowsPrepared
                )}

              </div>

            </div>

          </section>


          <section className="section">

            <h2 className="section-title">
              Остатки синхронизированы
            </h2>


            <div className="reason-box">

              <strong>
                Остатки Ozon успешно
                записаны в Supabase
              </strong>


              <div className="reason-text">

                Дата снимка:{" "}

                {
                  stockResult
                    .snapshotDate
                  ??
                  stockResult
                    .supabase
                    ?.snapshot_date
                  ??
                  "—"
                }

              </div>

            </div>

          </section>

        </>

      )}


      {/* ======================================================
          ПРОДАЖИ OZON
          ====================================================== */}

      <section className="controls">

        <div>

          <h2 className="controls-title">
            Продажи Ozon
          </h2>


          <div className="muted">

            Последние 28 завершённых
            московских дней.
            Отменённые отправления
            считаются отдельно.

          </div>

        </div>


        <button
          type="button"

          className="primary-button"

          disabled={
            salesLoading ||
            stockLoading
          }

          onClick={
            () => {
              void runSalesSync();
            }
          }
        >

          {salesLoading
            ? "Загружаем продажи..."
            : "Обновить продажи Ozon"}

        </button>

      </section>


      {salesLoading && (

        <section className="section">

          <h2 className="section-title">
            Загружаем продажи Ozon
          </h2>


          <div className="reason-text">

            Получаем все FBO-отправления
            за 28 завершённых дней
            и проходим все страницы API.

          </div>


          <div className="reason-text">

            Затем сопоставляем склады
            с кластерами и считаем
            продажи по каждому товару,
            дню и кластеру.

          </div>


          <div className="reason-text">

            Статус cancelled
            в продажи не включается
            и хранится отдельно.

          </div>

        </section>

      )}


      {salesResult &&
        !salesResult.ok && (

        <section className="section">

          <h2 className="section-title">
            Ошибка продаж Ozon
          </h2>


          <div className="reason-box">

            <strong>
              Продажи не обновлены
            </strong>


            <div className="reason-text">

              {
                salesResult.error
                ??
                salesResult.message
                ??
                "Неизвестная ошибка"
              }

            </div>

          </div>

        </section>

      )}


      {salesResult?.ok && (

        <>

          <section className="summary-grid">


            <div className="card">

              <div className="card-label">
                Период
              </div>

              <div className="big-number">

                {
                  salesResult
                    .period
                    ?.completedDays
                  ?? 28
                } дней

              </div>


              <div className="muted">

                {
                  salesResult
                    .period
                    ?.dateFrom
                  ?? "—"
                }

                {" → "}

                {
                  salesResult
                    .period
                    ?.dateTo
                  ?? "—"
                }

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                FBO-отправлений
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.uniquePostings
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Отменённых отправлений
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.cancelledPostings
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Товаров с продажами
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.uniqueProducts
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Кластеров
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.uniqueClusters
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Продано, шт.
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.salesQuantityExcludingCancelled
                )}

              </div>


              <div className="muted">
                Без cancelled
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Отменено, шт.
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.cancelledQuantity
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Строк сохранено
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .supabase
                    ?.aggregated_rows_saved
                  ??
                  salesResult
                    .ozon
                    ?.aggregatedRows
                )}

              </div>

            </div>

          </section>


          <section className="section">

            <h2 className="section-title">
              Продажи синхронизированы
            </h2>


            <div className="reason-box">

              <strong>
                Продажи Ozon успешно
                записаны в Supabase
              </strong>


              <div className="reason-text">

                Период:{" "}

                {
                  salesResult
                    .period
                    ?.dateFrom
                  ?? "—"
                }

                {" — "}

                {
                  salesResult
                    .period
                    ?.dateTo
                  ?? "—"
                }

              </div>


              <div className="reason-text">

                Продажи без отмен:{" "}

                {formatNumber(
                  salesResult
                    .ozon
                    ?.salesQuantityExcludingCancelled
                )} шт.

              </div>


              <div className="reason-text">

                Отменено:{" "}

                {formatNumber(
                  salesResult
                    .ozon
                    ?.cancelledQuantity
                )} шт.

              </div>


              <div className="reason-text">

                Строк
                день + товар + кластер:{" "}

                {formatNumber(
                  salesResult
                    .supabase
                    ?.aggregated_rows_saved
                  ??
                  salesResult
                    .ozon
                    ?.aggregatedRows
                )}

              </div>

            </div>

          </section>


          <section className="section">

            <h2 className="section-title">
              Статусы отправлений
            </h2>


            <div className="transport-grid">

              {
                Object.entries(
                  salesResult
                    .ozon
                    ?.statusCounts
                  ?? {}
                )
                  .sort(
                    (
                      a,
                      b
                    ) =>
                      b[1] - a[1]
                  )
                  .map(
                    (
                      [
                        status,
                        count,
                      ]
                    ) => (

                      <div
                        className="transport-card"
                        key={status}
                      >

                        <span className="card-label">
                          {status}
                        </span>


                        <strong className="transport-value">

                          {formatNumber(
                            count
                          )}

                        </strong>

                      </div>

                    )
                  )
              }

            </div>

          </section>

        </>

      )}

    </>

  );
}
