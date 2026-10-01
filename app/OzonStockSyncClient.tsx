"use client";

import {
  useState,
} from "react";


// ============================================================
// ТИП РЕЗУЛЬТАТА СИНХРОНИЗАЦИИ
// ============================================================

type SyncResult = {

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
// КОМПОНЕНТ
// ============================================================

export default function OzonStockSyncClient() {

  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    result,
    setResult,
  ] =
    useState<
      SyncResult | null
    >(null);


  // ==========================================================
  // ЗАПУСК СИНХРОНИЗАЦИИ
  // ==========================================================

  async function runSync() {

    setLoading(true);

    setResult(null);


    try {

      const response =
        await fetch(
          "/api/ozon-sync-stocks",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",
          }
        );


      const data =
        await response.json() as
          SyncResult;


      setResult(
        data
      );


    } catch (error) {

      setResult(
        {
          ok: false,

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка синхронизации",
        }
      );

    } finally {

      setLoading(false);

    }

  }


  // ==========================================================
  // ИНТЕРФЕЙС
  // ==========================================================

  return (

    <>

      <section className="controls">

        <div>

          <h2 className="controls-title">
            Остатки Ozon
          </h2>


          <div className="muted">

            Система получит все товары
            кабинета, FBO SKU и остатки
            по складам и кластерам.

          </div>

        </div>


        <button
          type="button"

          className="primary-button"

          disabled={
            loading
          }

          onClick={
            () => {
              void runSync();
            }
          }
        >

          {loading
            ? "Загружаем Ozon..."
            : "Обновить остатки Ozon"}

        </button>

      </section>


      {loading && (

        <section className="section">

          <h2 className="section-title">
            Синхронизация выполняется
          </h2>


          <div className="reason-text">

            Получаем товары Ozon,
            собираем FBO SKU,
            запрашиваем остатки
            и группируем их по кластерам.

          </div>


          <div className="reason-text">

            Пока процесс не завершён,
            в Supabase новый снимок
            не записывается.

          </div>

        </section>

      )}


      {result && !result.ok && (

        <section className="section">

          <h2 className="section-title">
            Ошибка синхронизации
          </h2>


          <div className="reason-box">

            <strong>
              Данные не обновлены
            </strong>


            <div className="reason-text">

              {
                result.error
                ?? "Неизвестная ошибка"
              }

            </div>

          </div>

        </section>

      )}


      {result?.ok && (

        <>

          <section className="summary-grid">


            <div className="card">

              <div className="card-label">
                Товаров сообщил Ozon
              </div>

              <div className="big-number">

                {
                  result
                    .ozon
                    ?.reportedTotalProducts
                  ?? "—"
                }

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Получено товаров
              </div>

              <div className="big-number">

                {
                  result
                    .ozon
                    ?.productsReceived
                  ?? "—"
                }

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Уникальных артикулов
              </div>

              <div className="big-number">

                {
                  result
                    .ozon
                    ?.uniqueOffers
                  ?? "—"
                }

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                FBO SKU
              </div>

              <div className="big-number">

                {
                  result
                    .ozon
                    ?.fboSkuCount
                  ?? "—"
                }

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Запросов analytics
              </div>

              <div className="big-number">

                {
                  result
                    .ozon
                    ?.analyticsRequests
                  ?? "—"
                }

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Строк от Ozon
              </div>

              <div className="big-number">

                {
                  result
                    .ozon
                    ?.analyticsRows
                  ?? "—"
                }

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Кластеров
              </div>

              <div className="big-number">

                {
                  result
                    .ozon
                    ?.uniqueClusters
                  ?? "—"
                }

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Строк сохранено
              </div>

              <div className="big-number">

                {
                  result
                    .supabase
                    ?.cluster_rows_saved
                  ??
                  result
                    .ozon
                    ?.clusterRowsPrepared
                  ??
                  "—"
                }

              </div>

            </div>

          </section>


          <section className="section">

            <h2 className="section-title">
              Синхронизация завершена
            </h2>


            <div className="reason-box">

              <strong>
                Остатки Ozon успешно
                записаны в Supabase
              </strong>


              <div className="reason-text">

                Дата снимка:{" "}

                {
                  result.snapshotDate
                  ??
                  result
                    .supabase
                    ?.snapshot_date
                  ??
                  "—"
                }

              </div>


              <div className="reason-text">

                Товаров обработано:{" "}

                {
                  result
                    .supabase
                    ?.products_received
                  ??
                  result
                    .ozon
                    ?.productsReceived
                  ??
                  "—"
                }

              </div>


              <div className="reason-text">

                FBO SKU:{" "}

                {
                  result
                    .supabase
                    ?.fbo_skus_received
                  ??
                  result
                    .ozon
                    ?.fboSkuCount
                  ??
                  "—"
                }

              </div>


              <div className="reason-text">

                Исходных строк
                analytics/stocks:{" "}

                {
                  result
                    .supabase
                    ?.analytics_rows_received
                  ??
                  result
                    .ozon
                    ?.analyticsRows
                  ??
                  "—"
                }

              </div>


              <div className="reason-text">

                Итоговых строк
                товар + кластер:{" "}

                {
                  result
                    .supabase
                    ?.cluster_rows_saved
                  ??
                  result
                    .ozon
                    ?.clusterRowsPrepared
                  ??
                  "—"
                }

              </div>

            </div>

          </section>

        </>

      )}

    </>

  );
}
