"use client";

import Button from "./ui/Button";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


// ============================================================
// ТИПЫ ТРАНСПОРТА
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

  raw_need_products?: number;
  below_carton_products?: number;
};


type TransportBlockers = {
  products_without_own_stock_data?: number;
  container_products_without_packaging?: number;
  truck_products_without_packaging?: number;
};


type TransportProducts = {
  total?: number;

  container_raw_need?: number;
  container_need?: number;
  container_below_carton?: number;

  truck_raw_need?: number;
  truck_need?: number;
  truck_below_carton?: number;

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
// СОСТАВ ЗАКАЗА
// ============================================================

type ChinaOrderItem = {
  product_id: string;

  offer_id: string;

  product_name: string | null;

  sales_28_days: number;

  avg_sales_per_day: number;

  own_stock_quantity: number;

  responsible_storage_quantity: number;

  ozon_stock_quantity: number;

  active_ved_quantity: number;

  effective_stock: number;

  coverage_days: number | null;

  units_per_carton: number;

  transport_carton_volume_m3: number;

  order_units: number;

  cartons: number;

  final_units: number;

  order_volume_m3: number;

  has_responsible_storage: boolean;

  own_stock_assumed_zero: boolean;
};


type DeferredOrderItem = {
  product_id: string;

  offer_id: string;

  product_name: string | null;

  avg_sales_per_day: number;

  effective_stock: number;

  coverage_days: number | null;

  units_per_carton: number;

  order_units: number;

  cartons: number;

  final_units: number;

  reason: string;
};


type ChinaOrderPreview = {
  ok: boolean;

  error?: string;

  run_id?: string;

  scenario?: "container" | "truck";

  items_count?: number;

  deferred_count?: number;

  total_final_units?: number;

  total_cartons?: number;

  total_volume_m3?: number;

  items?: ChinaOrderItem[];

  deferred?: DeferredOrderItem[];
};


// ============================================================
// СОЗДАНИЕ ЗАКАЗА
// ============================================================

type CreateOrderResponse = {
  ok: boolean;

  error?: string;

  order_id?: string;

  workflow_status?: string;

  items_created?: number;
};


// ============================================================
// FORMAT
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
// INPUT NUMBER
// ============================================================

function parseInputNumber(
  value: string
): number | null {

  const normalized =
    value
      .trim()
      .replace(
        /\s/g,
        ""
      )
      .replace(
        ",",
        "."
      );


  if (!normalized) {

    return null;

  }


  const parsed =
    Number(
      normalized
    );


  if (
    !Number.isFinite(
      parsed
    )
  ) {

    return null;

  }


  return parsed;

}


// ============================================================
// TRANSPORT API
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
// ORDER PREVIEW API
// ============================================================

async function requestOrderPreview(
  scenario: "container" | "truck"
): Promise<ChinaOrderPreview> {

  const response =
    await fetch(
      "/api/china-order-preview",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            {
              scenario,
            }
          ),

        cache: "no-store",
      }
    );


  const data: ChinaOrderPreview =
    await response.json();


  if (
    !response.ok
    ||
    !data.ok
  ) {

    throw new Error(
      data.error
      ||
      "Не удалось получить состав заказа"
    );

  }


  return data;

}


// ============================================================
// COMPONENT
// ============================================================

export default function ChinaTransportClient() {

  const router =
    useRouter();


  const [
    inputValue,
    setInputValue,
  ] =
    useState(
      "0"
    );


  const [
    decision,
    setDecision,
  ] =
    useState<TransportDecision | null>(
      null
    );


  const [
    orderPreview,
    setOrderPreview,
  ] =
    useState<ChinaOrderPreview | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState(
      ""
    );


  // ==========================================================
  // ВРЕМЕННО:
  // после подключения авторизации эти поля уберём
  // ==========================================================

  const [
    responsibleName,
    setResponsibleName,
  ] =
    useState(
      ""
    );


  const [
    preparationDepartment,
    setPreparationDepartment,
  ] =
    useState<"analytics" | "procurement">(
      "analytics"
    );


  const [
    creatingOrder,
    setCreatingOrder,
  ] =
    useState(
      false
    );


  const [
    createOrderError,
    setCreateOrderError,
  ] =
    useState(
      ""
    );


  // ==========================================================
  // РАСЧЁТ
  // ==========================================================

  async function loadCalculation(
    volume: number
  ) {

    setLoading(
      true
    );

    setError(
      ""
    );


    try {

      const transport =
        await requestTransportDecision(
          volume
        );


      setDecision(
        transport
      );


      if (
        transport.decision_status ===
        "blocked"
      ) {

        setOrderPreview(
          null
        );

        return;

      }


      const scenario:
        "container" | "truck" =
        transport.switched_to_truck
          ? "truck"
          : "container";


      const preview =
        await requestOrderPreview(
          scenario
        );


      setOrderPreview(
        preview
      );


    } catch (
      caughtError
    ) {

      setDecision(
        null
      );


      setOrderPreview(
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
  // INITIAL
  // ==========================================================

  useEffect(
    () => {

      void loadCalculation(
        0
      );

      // eslint-disable-next-line react-hooks/exhaustive-deps
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


    await loadCalculation(
      volume
    );

  }


  // ==========================================================
  // CREATE ORDER
  // ==========================================================

  async function createOrder() {

    setCreateOrderError(
      ""
    );


    if (!decision) {

      setCreateOrderError(
        "Сначала выполните расчёт транспорта"
      );

      return;

    }


    if (
      decision.decision_status !==
      "ready"
    ) {

      setCreateOrderError(
        "Сначала необходимо принять решение по транспорту"
      );

      return;

    }


    const name =
      responsibleName
        .trim();


    if (!name) {

      setCreateOrderError(
        "Укажите ответственного за подготовку заказа"
      );

      return;

    }


    const newProductsVolume =
      parseInputNumber(
        inputValue
      );


    if (
      newProductsVolume === null
      ||
      newProductsVolume < 0
    ) {

      setCreateOrderError(
        "Некорректный объём новых товаров"
      );

      return;

    }


    const scenario:
      "container" | "truck" =
      decision.switched_to_truck
        ? "truck"
        : "container";


    setCreatingOrder(
      true
    );


    try {

      const response =
        await fetch(
          "/api/ved-orders/create",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  scenario,

                  preparationDepartment,

                  createdByName:
                    name,

                  createdByUserId:
                    null,

                  newProductsVolumeM3:
                    newProductsVolume,
                }
              ),

            cache: "no-store",
          }
        );


      const result: CreateOrderResponse =
        await response.json();


      if (
        !response.ok
        ||
        !result.ok
        ||
        !result.order_id
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось создать заказ"
        );

      }


      router.push(
        `/ved-orders/${result.order_id}`
      );


    } catch (
      caughtError
    ) {

      setCreateOrderError(
        caughtError instanceof Error
          ? caughtError.message
          : "Неизвестная ошибка создания заказа"
      );

    } finally {

      setCreatingOrder(
        false
      );

    }

  }


  // ==========================================================
  // SCENARIO DATA
  // ==========================================================

  const containerExisting =
    decision
      ?.container
      ?.existing_products_volume_m3
    ??
    decision
      ?.known_container_existing_volume_m3;


  const containerTotal =
    decision
      ?.container
      ?.total_volume_m3
    ??
    decision
      ?.known_container_total_volume_m3;


  const truckExisting =
    decision
      ?.truck
      ?.existing_products_volume_m3
    ??
    decision
      ?.known_truck_existing_volume_m3;


  const truckTotal =
    decision
      ?.truck
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
          TRANSPORT INPUT
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
            display:
              "flex",

            gap:
              "12px",

            alignItems:
              "end",

            flexWrap:
              "wrap",
          }}
        >

          <label
            style={{
              display:
                "flex",

              flexDirection:
                "column",

              gap:
                "6px",
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
                (
                  event
                ) => {

                  setInputValue(
                    event
                      .target
                      .value
                  );

                }
              }

              className="ws-editor-input ws-editor-input--large"
              style={{ width: "180px", fontSize: "16px" }}
            />

          </label>


          <Button
            type="button"

            

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

          </Button>

        </div>

      </section>


      {/* ======================================================
          ERROR
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
          TRANSPORT
          ====================================================== */}

      {decision && (

        <>


          <section className="section">

            <div className="small-label">
              РЕШЕНИЕ
            </div>


            <h2
              className="section-title"

              style={{
                fontSize:
                  "28px",

                marginTop:
                  "8px",
              }}
            >

              {decision
                .decision_name
                ??
                "Нет решения"}

            </h2>


            <div className="reason-text">

              {decision
                .reason
                ??
                "—"}

            </div>

          </section>


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

                {decision
                  .decision_code
                  ??
                  "—"}

              </div>

            </div>

          </section>


          {/* ==================================================
              COMPARISON
              ================================================== */}

          <section className="section">

            <h2 className="section-title">
              Сравнение сценариев
            </h2>


            <div
              style={{
                overflowX:
                  "auto",
              }}
            >

              <table
                style={{
                  width:
                    "100%",

                  borderCollapse:
                    "collapse",

                  fontSize:
                    "14px",
                }}
              >

                <thead>

                  <tr>

                    <th
                      style={{
                        textAlign:
                          "left",

                        padding:
                          "12px",
                      }}
                    >
                      Сценарий
                    </th>


                    <th
                      style={{
                        textAlign:
                          "right",

                        padding:
                          "12px",
                      }}
                    >
                      Текущие SKU
                    </th>


                    <th
                      style={{
                        textAlign:
                          "right",

                        padding:
                          "12px",
                      }}
                    >
                      Новые товары
                    </th>


                    <th
                      style={{
                        textAlign:
                          "right",

                        padding:
                          "12px",
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
                        padding:
                          "12px",
                      }}
                    >
                      Контейнер — 100 дней
                    </td>


                    <td
                      style={{
                        padding:
                          "12px",

                        textAlign:
                          "right",
                      }}
                    >

                      {formatNumber(
                        containerExisting
                      )} м³

                    </td>


                    <td
                      style={{
                        padding:
                          "12px",

                        textAlign:
                          "right",
                      }}
                    >

                      {formatNumber(
                        decision
                          .new_products_volume_m3
                      )} м³

                    </td>


                    <td
                      style={{
                        padding:
                          "12px",

                        textAlign:
                          "right",
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
                        padding:
                          "12px",
                      }}
                    >
                      Фура — 70 дней
                    </td>


                    <td
                      style={{
                        padding:
                          "12px",

                        textAlign:
                          "right",
                      }}
                    >

                      {formatNumber(
                        truckExisting
                      )} м³

                    </td>


                    <td
                      style={{
                        padding:
                          "12px",

                        textAlign:
                          "right",
                      }}
                    >

                      {formatNumber(
                        decision
                          .new_products_volume_m3
                      )} м³

                    </td>


                    <td
                      style={{
                        padding:
                          "12px",

                        textAlign:
                          "right",
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
              TRUCK RECALC
              ================================================== */}

          {decision
            .switched_to_truck && (

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
                  Новые товары при этом не пересчитываются.
                </div>

              </div>

            </section>

          )}


          {/* ==================================================
              COUNTERS
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

        </>

      )}


      {/* ======================================================
          ORDER PREVIEW
          ====================================================== */}

      {orderPreview && (

        <>


          <section className="section">

            <div className="small-label">
              СОСТАВ ЗАКАЗА
            </div>


            <h2 className="section-title">

              {orderPreview.scenario ===
                "truck"

                ? "Заказ после пересчёта под фуру"

                : "Заказ для контейнерного сценария"}

            </h2>


            <div className="reason-text">
              Показаны товары выбранного сценария.
            </div>

          </section>


          <section className="summary-grid">


            <div className="card">

              <div className="card-label">
                SKU в заказе
              </div>

              <div className="big-number">

                {formatNumber(
                  orderPreview
                    .items_count,
                  0
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Коробов
              </div>

              <div className="big-number">

                {formatNumber(
                  orderPreview
                    .total_cartons,
                  0
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Итоговых единиц
              </div>

              <div className="big-number">

                {formatNumber(
                  orderPreview
                    .total_final_units,
                  0
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Объём SKU
              </div>

              <div className="big-number">

                {formatNumber(
                  orderPreview
                    .total_volume_m3
                )} м³

              </div>

            </div>

          </section>


          {/* ==================================================
              ORDER ITEMS
              ================================================== */}

          <section className="section">

            <h2 className="section-title">
              Товары заказа
            </h2>


            <div
              style={{
                overflowX:
                  "auto",
              }}
            >

              <table
                style={{
                  width:
                    "100%",

                  minWidth:
                    "1500px",

                  borderCollapse:
                    "collapse",

                  fontSize:
                    "13px",
                }}
              >

                <thead>

                  <tr>

                    {[
                      "Артикул",
                      "Товар",
                      "Прод./сутки",
                      "Наш склад",
                      "ОХ",
                      "Ozon",
                      "ВЭД",
                      "Эфф. остаток",
                      "Покрытие",
                      "Потребность",
                      "Вложимость",
                      "Коробов",
                      "Итого, шт.",
                      "Объём, м³",
                    ].map(
                      (
                        title
                      ) => (

                        <th
                          key={
                            title
                          }

                          style={{
                            textAlign:
                              "right",

                            padding:
                              "10px",
                          }}
                        >

                          {title}

                        </th>

                      )
                    )}

                  </tr>

                </thead>


                <tbody>

                  {(
                    orderPreview
                      .items
                    ??
                    []
                  ).map(
                    (
                      item
                    ) => (

                      <tr
                        key={
                          item.product_id
                        }
                      >

                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "left",
                          }}
                        >
                          {item.offer_id}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "left",

                            minWidth:
                              "300px",
                          }}
                        >
                          {item.product_name ?? "—"}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {formatNumber(
                            item.avg_sales_per_day,
                            2
                          )}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {formatNumber(
                            item.own_stock_quantity,
                            0
                          )}

                          {item
                            .own_stock_assumed_zero
                            ? " *"
                            : ""}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {formatNumber(
                            item.responsible_storage_quantity,
                            0
                          )}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {formatNumber(
                            item.ozon_stock_quantity,
                            0
                          )}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {formatNumber(
                            item.active_ved_quantity,
                            0
                          )}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {formatNumber(
                            item.effective_stock,
                            0
                          )}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {item.coverage_days ===
                            null

                            ? "—"

                            : `${formatNumber(
                                item.coverage_days,
                                1
                              )} дн.`}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {formatNumber(
                            item.order_units,
                            0
                          )}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {formatNumber(
                            item.units_per_carton,
                            0
                          )}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {formatNumber(
                            item.cartons,
                            0
                          )}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          <strong>
                            {formatNumber(
                              item.final_units,
                              0
                            )}
                          </strong>

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          <strong>
                            {formatNumber(
                              item.order_volume_m3,
                              6
                            )}
                          </strong>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>


            <div className="muted">

              * Ноль основного склада получен по правилу:
              товар отсутствует в полном отчёте
              «Свободный остаток».

            </div>

          </section>


          {/* ==================================================
              DEFERRED
              ================================================== */}

          {(orderPreview
            .deferred_count
            ??
            0) > 0 && (

            <section className="section">

              <h2 className="section-title">
                Не вошли из-за округления коробов
              </h2>


              <div className="reason-text">

                По этим SKU потребность рассчитана,
                но её недостаточно для формирования
                одного транспортного короба.

              </div>


              <div
                style={{
                  overflowX:
                    "auto",

                  marginTop:
                    "16px",
                }}
              >

                <table
                  style={{
                    width:
                      "100%",

                    borderCollapse:
                      "collapse",

                    fontSize:
                      "13px",
                  }}
                >

                  <thead>

                    <tr>

                      <th
                        style={{
                          textAlign:
                            "left",

                          padding:
                            "10px",
                        }}
                      >
                        Артикул
                      </th>


                      <th
                        style={{
                          textAlign:
                            "left",

                          padding:
                            "10px",
                        }}
                      >
                        Товар
                      </th>


                      <th
                        style={{
                          textAlign:
                            "right",

                          padding:
                            "10px",
                        }}
                      >
                        Потребность
                      </th>


                      <th
                        style={{
                          textAlign:
                            "right",

                          padding:
                            "10px",
                        }}
                      >
                        Вложимость
                      </th>


                      <th
                        style={{
                          textAlign:
                            "right",

                          padding:
                            "10px",
                        }}
                      >
                        Коробов
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {(
                      orderPreview
                        .deferred
                      ??
                      []
                    ).map(
                      (
                        item
                      ) => (

                        <tr
                          key={
                            item.product_id
                          }
                        >

                          <td
                            style={{
                              padding:
                                "10px",
                            }}
                          >
                            {item.offer_id}
                          </td>


                          <td
                            style={{
                              padding:
                                "10px",
                            }}
                          >
                            {item.product_name ?? "—"}
                          </td>


                          <td
                            style={{
                              padding:
                                "10px",

                              textAlign:
                                "right",
                            }}
                          >
                            {formatNumber(
                              item.order_units,
                              0
                            )}
                          </td>


                          <td
                            style={{
                              padding:
                                "10px",

                              textAlign:
                                "right",
                            }}
                          >
                            {formatNumber(
                              item.units_per_carton,
                              0
                            )}
                          </td>


                          <td
                            style={{
                              padding:
                                "10px",

                              textAlign:
                                "right",
                            }}
                          >
                            0
                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            </section>

          )}


          {/* ==================================================
              CREATE ORDER
              ================================================== */}

          <section className="section">

            <div className="small-label">
              СОЗДАНИЕ ЗАКАЗА
            </div>


            <h2 className="section-title">
              Создать черновик заказа
            </h2>


            <div className="reason-text">
              После создания черновик автоматически откроется.
            </div>


            <div className="muted">

              Поля ответственного временные —
              после подключения пользователей
              сотрудник будет определяться автоматически.

            </div>


            <div
              style={{
                display:
                  "flex",

                gap:
                  "14px",

                flexWrap:
                  "wrap",

                alignItems:
                  "end",

                marginTop:
                  "18px",
              }}
            >

              <label
                style={{
                  display:
                    "flex",

                  flexDirection:
                    "column",

                  gap:
                    "6px",
                }}
              >

                <span className="muted">
                  Отдел
                </span>


                <select
                  value={
                    preparationDepartment
                  }

                  disabled={
                    creatingOrder
                  }

                  onChange={
                    (
                      event
                    ) => {

                      const nextDepartment =
                        event.target.value ===
                        "procurement"
                          ? "procurement"
                          : "analytics";


                      setPreparationDepartment(
                        nextDepartment
                      );

                    }
                  }

                  style={{
                    minHeight:
                      "44px",

                    minWidth:
                      "180px",

                    padding:
                      "0 12px",

                    borderRadius:
                      "10px",

                    border:
                      "1px solid var(--border)",

                    background:
                      "var(--card)",

                    color:
                      "var(--text)",
                  }}
                >

                  <option value="analytics">
                    Аналитика
                  </option>

                  <option value="procurement">
                    Закуп
                  </option>

                </select>

              </label>


              <label
                style={{
                  display:
                    "flex",

                  flexDirection:
                    "column",

                  gap:
                    "6px",
                }}
              >

                <span className="muted">
                  Ответственный
                </span>


                <input
                  type="text"

                  value={
                    responsibleName
                  }

                  disabled={
                    creatingOrder
                  }

                  placeholder=
                    "Имя сотрудника"

                  onChange={
                    (
                      event
                    ) => {

                      setResponsibleName(
                        event.target.value
                      );

                    }
                  }

                  className="ws-editor-input ws-editor-input--large"
              style={{ width: "260px" }}
                />

              </label>


              <Button
                type="button"

                

                disabled={
                  creatingOrder
                  ||
                  decision
                    ?.decision_status
                    !==
                    "ready"
                }

                onClick={
                  () => {

                    void createOrder();

                  }
                }
              >

                {creatingOrder
                  ? "Создаём..."
                  : "Создать заказ"}

              </Button>

            </div>


            {createOrderError && (

              <div
                style={{
                  marginTop:
                    "12px",

                  color:
                    "#d64545",
                }}
              >
                {createOrderError}
              </div>

            )}

          </section>


          <section className="section">

            <div className="muted">

              Версия расчёта:{" "}

              {decision
                ?.calculation_version
                ??
                "—"}

            </div>

          </section>

        </>

      )}

    </>

  );

}
