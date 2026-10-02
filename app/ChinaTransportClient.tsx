"use client";

import {
  useEffect,
  useState,
} from "react";


// ============================================================
// ТИПЫ
// ============================================================

type TransportScenario = {
  existing_products?: number;
  existing_products_volume_m3?: number;
  new_products_volume_m3?: number;
  total_volume_m3?: number;
  nominal_capacity_m3?: number;
  manual_review_limit_m3?: number;
  truck_90_capacity_m3?: number;
  truck_100_capacity_m3?: number;
};


type TransportBlockers = {
  products_without_own_stock_data?: number;
  container_products_without_packaging?: number;
  truck_products_without_packaging?: number;
};


type TransportProducts = {
  total?: number;
  container_need?: number;
  truck_need?: number;
  with_responsible_storage?: number;
};


type TransportDecision = {
  ok: boolean;

  error?: string;

  run_id?: string;
  calculation_version?: string;

  decision_status?: string;
  decision_code?: string;
  decision_name?: string;
  reason?: string;

  switched_to_truck?: boolean;

  selected_capacity_m3?: number | null;
  selected_volume_m3?: number;

  new_products_volume_m3?: number;

  container?: TransportScenario;
  truck?: TransportScenario;

  volume_reduction_after_truck_recalculation_m3?: number;

  products?: TransportProducts;
  blockers?: TransportBlockers;

  known_container_existing_volume_m3?: number;
  known_container_total_volume_m3?: number;

  known_truck_existing_volume_m3?: number;
  known_truck_total_volume_m3?: number;
};


// ============================================================
// ФОРМАТ ЧИСЕЛ
// ============================================================

function formatNumber(
  value: number | null | undefined,
  maximumFractionDigits = 3
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  return Number(value)
    .toLocaleString(
      "ru-RU",
      {
        maximumFractionDigits,
      }
    );

}


// ============================================================
// ЧТЕНИЕ ЧИСЛА ИЗ INPUT
// ============================================================

function parseInputNumber(
  value: string
): number | null {

  const normalized =
    value
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");


  if (!normalized) {

    return null;

  }


  const parsed =
    Number(normalized);


  if (
    !Number.isFinite(parsed)
  ) {

    return null;

  }


  return parsed;

}


// ============================================================
// ЗАПРОС К API
// ============================================================

async function requestTransportDecision(
  volume: number
): Promise<TransportDecision> {

  const response =
    await fetch(
      "/api/china-transport",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            {
              newProductsVolumeM3:
                volume,
            }
          ),

        cache: "no-store",
      }
    );


  const data: TransportDecision =
    await response.json();


  if (
    !response.ok
    ||
    !data.ok
  ) {

    throw new Error(
      data.error
      ||
      "Не удалось выполнить транспортный расчёт"
    );

  }


  return data;

}


// ============================================================
// КОМПОНЕНТ
// ============================================================

export default function ChinaTransportClient() {

  const [
    inputValue,
    setInputValue,
  ] =
    useState("0");


  const [
    decision,
    setDecision,
  ] =
    useState<TransportDecision | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState("");


  // ==========================================================
  // ПЕРВИЧНЫЙ РАСЧЁТ ПРИ ОТКРЫТИИ
  // ==========================================================

  useEffect(
    () => {

      async function loadInitial() {

        setLoading(true);

        setError("");


        try {

          const data =
            await requestTransportDecision(
              0
            );


          setDecision(
            data
          );

        } catch (caughtError) {

          setDecision(
            null
          );


          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Неизвестная ошибка"
          );

        } finally {

          setLoading(
            false
          );

        }

      }


      void loadInitial();

    },
    []
  );


  // ==========================================================
  // РУЧНОЙ ПЕРЕСЧЁТ
  // ==========================================================

  async function calculateTransport() {

    const volume =
      parseInputNumber(
        inputValue
      );


    if (
      volume === null
    ) {

      setError(
        "Введите корректный объём новых товаров"
      );

      return;

    }


    if (
      volume < 0
    ) {

      setError(
        "Объём новых товаров не может быть отрицательным"
      );

      return;

    }


    setLoading(
      true
    );

    setError(
      ""
    );


    try {

      const data =
        await requestTransportDecision(
          volume
        );


      setDecision(
        data
      );

    } catch (caughtError) {

      setDecision(
        null
      );


      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Неизвестная ошибка"
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // ==========================================================
  // ДАННЫЕ СЦЕНАРИЕВ
  // ==========================================================

  const containerExisting =
    decision?.container
      ?.existing_products_volume_m3
    ??
    decision
      ?.known_container_existing_volume_m3;


  const containerTotal =
    decision?.container
      ?.total_volume_m3
    ??
    decision
      ?.known_container_total_volume_m3;


  const truckExisting =
    decision?.truck
      ?.existing_products_volume_m3
    ??
    decision
      ?.known_truck_existing_volume_m3;


  const truckTotal =
    decision?.truck
      ?.total_volume_m3
    ??
    decision
      ?.known_truck_total_volume_m3;


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <>

      {/* ======================================================
          УПРАВЛЕНИЕ
          ====================================================== */}

      <section className="controls">

        <div>

          <h2 className="controls-title">
            Транспортная симуляция
          </h2>


          <div className="muted">
            Укажи общий объём новых товаров.
          </div>


          <div className="muted">
            Существующие SKU рассчитываются автоматически.
          </div>

        </div>


        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "end",
            flexWrap: "wrap",
          }}
        >

          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >

            <span className="muted">
              Новые товары, м³
            </span>


            <input
              type="text"

              inputMode="decimal"

              value={
                inputValue
              }

              disabled={
                loading
              }

              onChange={
                (event) => {

                  setInputValue(
                    event.target.value
                  );

                }
              }

              style={{
                width: "180px",
                minHeight: "44px",
                padding: "0 14px",
                borderRadius: "10px",

                border:
                  "1px solid var(--border)",

                background:
                  "var(--card)",

                color:
                  "var(--text)",

                fontSize: "16px",
              }}
            />

          </label>


          <button
            type="button"

            className="primary-button"

            disabled={
              loading
            }

            onClick={
              () => {

                void calculateTransport();

              }
            }
          >

            {loading
              ? "Считаем..."
              : "Пересчитать"}

          </button>

        </div>

      </section>


      {/* ======================================================
          ОШИБКА
          ====================================================== */}

      {error && (

        <section className="section">

          <h2 className="section-title">
            Ошибка
          </h2>


          <div className="reason-box">

            <div className="reason-text">
              {error}
            </div>

          </div>

        </section>

      )}


      {/* ======================================================
          РЕЗУЛЬТАТ
          ====================================================== */}

      {decision && (

        <>

          {/* ==================================================
              ГЛАВНОЕ РЕШЕНИЕ
              ================================================== */}

          <section className="section">

            <div className="small-label">
              РЕШЕНИЕ
            </div>


            <h2
              className="section-title"

              style={{
                fontSize: "28px",
                marginTop: "8px",
              }}
            >

              {decision.decision_name
                ??
                "Нет решения"}

            </h2>


            <div className="reason-text">

              {decision.reason
                ??
                "—"}

            </div>

          </section>


          {/* ==================================================
              СВОДКА
              ================================================== */}

          <section className="summary-grid">


            <div className="card">

              <div className="card-label">
                Новые товары
              </div>

              <div className="big-number">

                {formatNumber(
                  decision
                    .new_products_volume_m3
                )} м³

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Контейнерный расчёт
              </div>

              <div className="big-number">

                {formatNumber(
                  containerTotal
                )} м³

              </div>

              <div className="muted">
                Горизонт 100 дней
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                После пересчёта под фуру
              </div>

              <div className="big-number">

                {formatNumber(
                  truckTotal
                )} м³

              </div>

              <div className="muted">
                Горизонт 70 дней
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Выбранный объём
              </div>

              <div className="big-number">

                {formatNumber(
                  decision
                    .selected_volume_m3
                )} м³

              </div>

              <div className="muted">

                {decision.decision_code
                  ??
                  "—"}

              </div>

            </div>

          </section>


          {/* ==================================================
              СРАВНЕНИЕ СЦЕНАРИЕВ
              ================================================== */}

          <section className="section">

            <h2 className="section-title">
              Сравнение сценариев
            </h2>


            <div
              style={{
                overflowX: "auto",
              }}
            >

              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  fontSize: "14px",
                }}
              >

                <thead>

                  <tr>

                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                      }}
                    >
                      Сценарий
                    </th>


                    <th
                      style={{
                        textAlign: "right",
                        padding: "12px",
                      }}
                    >
                      Текущие SKU
                    </th>


                    <th
                      style={{
                        textAlign: "right",
                        padding: "12px",
                      }}
                    >
                      Новые товары
                    </th>


                    <th
                      style={{
                        textAlign: "right",
                        padding: "12px",
                      }}
                    >
                      Итого
                    </th>

                  </tr>

                </thead>


                <tbody>

                  <tr>

                    <td
                      style={{
                        padding: "12px",
                      }}
                    >
                      Контейнер — 100 дней
                    </td>


                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                      }}
                    >

                      {formatNumber(
                        containerExisting
                      )} м³

                    </td>


                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                      }}
                    >

                      {formatNumber(
                        decision
                          .new_products_volume_m3
                      )} м³

                    </td>


                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                      }}
                    >

                      <strong>

                        {formatNumber(
                          containerTotal
                        )} м³

                      </strong>

                    </td>

                  </tr>


                  <tr>

                    <td
                      style={{
                        padding: "12px",
                      }}
                    >
                      Фура — 70 дней
                    </td>


                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                      }}
                    >

                      {formatNumber(
                        truckExisting
                      )} м³

                    </td>


                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                      }}
                    >

                      {formatNumber(
                        decision
                          .new_products_volume_m3
                      )} м³

                    </td>


                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                      }}
                    >

                      <strong>

                        {formatNumber(
                          truckTotal
                        )} м³

                      </strong>

                    </td>

                  </tr>

                </tbody>

              </table>

            </div>

          </section>


          {/* ==================================================
              ПЕРЕСЧЁТ ПОД ФУРУ
              ================================================== */}

          {decision.switched_to_truck && (

            <section className="section">

              <h2 className="section-title">
                Пересчёт под фуру
              </h2>


              <div className="reason-box">

                <strong>
                  Контейнерный сценарий превысил 68,50 м³.
                </strong>


                <div className="reason-text">
                  Все существующие SKU пересчитаны с горизонта 100 дней на 70 дней.
                </div>


                <div className="reason-text">

                  Снижение объёма:{" "}

                  <strong>

                    {formatNumber(
                      decision
                        .volume_reduction_after_truck_recalculation_m3
                    )} м³

                  </strong>

                </div>


                <div className="reason-text">
                  Объём новых товаров при этом не изменяется.
                </div>

              </div>

            </section>

          )}


          {/* ==================================================
              SKU
              ================================================== */}

          <section className="summary-grid">


            <div className="card">

              <div className="card-label">
                Наших SKU
              </div>

              <div className="big-number">

                {formatNumber(
                  decision
                    .products
                    ?.total,
                  0
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Нужны в контейнер
              </div>

              <div className="big-number">

                {formatNumber(
                  decision
                    .products
                    ?.container_need,
                  0
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Нужны после пересчёта
              </div>

              <div className="big-number">

                {formatNumber(
                  decision
                    .products
                    ?.truck_need,
                  0
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Есть на ОХ
              </div>

              <div className="big-number">

                {formatNumber(
                  decision
                    .products
                    ?.with_responsible_storage,
                  0
                )}

              </div>

              <div className="muted">
                SKU
              </div>

            </div>

          </section>


          {/* ==================================================
              BLOCKED
              ================================================== */}

          {decision.decision_status ===
            "blocked" && (

            <section className="section">

              <h2 className="section-title">
                Что блокирует расчёт
              </h2>


              <div className="reason-box">

                <div className="reason-text">

                  Без данных основного склада:{" "}

                  <strong>

                    {formatNumber(
                      decision
                        .blockers
                        ?.products_without_own_stock_data,
                      0
                    )}

                  </strong>

                </div>


                <div className="reason-text">

                  Без логистики контейнера:{" "}

                  <strong>

                    {formatNumber(
                      decision
                        .blockers
                        ?.container_products_without_packaging,
                      0
                    )}

                  </strong>

                </div>


                <div className="reason-text">

                  Без логистики фуры:{" "}

                  <strong>

                    {formatNumber(
                      decision
                        .blockers
                        ?.truck_products_without_packaging,
                      0
                    )}

                  </strong>

                </div>

              </div>

            </section>

          )}


          {/* ==================================================
              ВЕРСИЯ
              ================================================== */}

          <section className="section">

            <div className="muted">

              Версия расчёта:{" "}

              {decision
                .calculation_version
                ??
                "—"}

            </div>

          </section>

        </>

      )}

    </>

  );

}
