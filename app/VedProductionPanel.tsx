"use client";

import {
  useEffect,
  useState,
} from "react";


// ============================================================
// TYPES
// ============================================================

type VedOrder = {
  id: string;

  order_number: string | null;

  workflow_status: string;

  ved_responsible_user_id: string | null;
  ved_responsible_name: string | null;

  production_handoff_date: string | null;
  production_confirmed_at: string | null;

  transit_departure_date: string | null;
  transit_started_at: string | null;

  expected_arrival_date: string | null;

  actual_arrival_date: string | null;
  arrival_confirmed_at: string | null;

  planned_lead_days?: number | null;
};


type OrderResponse = {
  ok: boolean;

  error?: string;

  order?: VedOrder;
};


type ProductionResponse = {
  ok: boolean;

  error?: string;

  order_id?: string;

  order_number?: string;

  workflow_status?: string;

  production_handoff_date?: string;

  production_confirmed_at?: string;

  planned_lead_days?: number;

  expected_arrival_date?: string;

  included_items?: number;
};


type TransitResponse = {
  ok: boolean;

  error?: string;

  order_id?: string;

  order_number?: string;

  workflow_status?: string;

  transit_departure_date?: string;

  transit_started_at?: string;

  expected_arrival_date?: string;

  included_items?: number;
};


type ArrivalResponse = {
  ok: boolean;

  error?: string;

  order_id?: string;

  order_number?: string;

  workflow_status?: string;

  item_status?: string;

  actual_arrival_date?: string;

  arrival_confirmed_at?: string;

  expected_arrival_date?: string;

  included_items?: number;

  stock_bridge_active?: boolean;
};


type StockBridgeResponse = {
  ok: boolean;

  error?: string;

  order_id?: string;

  order_number?: string;

  workflow_status?: string;

  bridge_applicable?: boolean;

  stock_bridge_active?: boolean;

  stock_bridge_completed?: boolean;

  actual_arrival_date?: string | null;

  arrival_confirmed_at?: string | null;

  warehouse_snapshot_date?: string | null;

  warehouse_snapshot_imported_at?: string | null;
};


// ============================================================
// HELPERS
// ============================================================

function formatDate(
  value:
    string
    | null
    | undefined
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(
      `${value.substring(0, 10)}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }


  return date.toLocaleDateString(
    "ru-RU"
  );

}


// ============================================================
// COMPONENT
// ============================================================

export default function VedProductionPanel(
  {
    orderId,
  }:
  {
    orderId: string;
  }
) {

  const [
    order,
    setOrder,
  ] =
    useState<VedOrder | null>(
      null
    );


  const [
    stockBridge,
    setStockBridge,
  ] =
    useState<StockBridgeResponse | null>(
      null
    );


  const [
    orderNumber,
    setOrderNumber,
  ] =
    useState(
      ""
    );


  const [
    productionDate,
    setProductionDate,
  ] =
    useState(
      ""
    );


  const [
    transitDate,
    setTransitDate,
  ] =
    useState(
      ""
    );


  const [
    arrivalDate,
    setArrivalDate,
  ] =
    useState(
      ""
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    submitting,
    setSubmitting,
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


  const [
    stockBridgeError,
    setStockBridgeError,
  ] =
    useState(
      ""
    );


  const [
    productionDateError,
    setProductionDateError,
  ] =
    useState(
      false
    );


  const [
    transitDateError,
    setTransitDateError,
  ] =
    useState(
      false
    );


  const [
    arrivalDateError,
    setArrivalDateError,
  ] =
    useState(
      false
    );


  // ==========================================================
  // LOAD ORDER
  // ==========================================================

  async function loadOrder() {

    setLoading(
      true
    );


    setError(
      ""
    );


    setStockBridgeError(
      ""
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/${orderId}`,
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );


      const result:
        OrderResponse =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
        ||
        !result.order
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось получить заказ"
        );

      }


      const loadedOrder =
        result.order;


      setOrder(
        loadedOrder
      );


      setOrderNumber(
        loadedOrder.order_number
        ??
        ""
      );


      setProductionDate(
        loadedOrder.production_handoff_date
        ??
        ""
      );


      setTransitDate(
        loadedOrder.transit_departure_date
        ??
        ""
      );


      setArrivalDate(
        loadedOrder.actual_arrival_date
        ??
        ""
      );


      // ======================================================
      // STOCK BRIDGE
      // ======================================================

      if (
        loadedOrder.workflow_status ===
          "arrived"
      ) {

        try {

          const bridgeResponse =
            await fetch(
              `/api/ved-orders/${orderId}/stock-bridge`,
              {
                method:
                  "GET",

                cache:
                  "no-store",
              }
            );


          const bridgeResult:
            StockBridgeResponse =
              await bridgeResponse.json();


          if (
            !bridgeResponse.ok
            ||
            !bridgeResult.ok
          ) {

            throw new Error(
              bridgeResult.error
              ||
              "Не удалось получить состояние склада"
            );

          }


          setStockBridge(
            bridgeResult
          );


        } catch (
          bridgeCaughtError
        ) {

          setStockBridge(
            null
          );


          setStockBridgeError(
            bridgeCaughtError instanceof Error
              ? bridgeCaughtError.message
              : "Не удалось получить состояние складского моста"
          );

        }

      } else {

        setStockBridge(
          null
        );

      }


    } catch (
      caughtError
    ) {

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Неизвестная ошибка загрузки заказа"
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      void loadOrder();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      orderId,
    ]
  );


  // ==========================================================
  // CONFIRM PRODUCTION
  // ==========================================================

  async function confirmProduction() {

    if (!order) {
      return;
    }


    const cleanOrderNumber =
      orderNumber
        .trim();


    if (!cleanOrderNumber) {

      setError(
        "Укажите номер заказа"
      );

      return;

    }


    if (!productionDate) {

      setProductionDateError(
        true
      );


      setError(
        ""
      );


      return;

    }


    const actorName =
      order
        .ved_responsible_name
        ?.trim();


    if (!actorName) {

      setError(
        "У заказа не назначен ответственный ВЭД"
      );

      return;

    }


    setSubmitting(
      true
    );


    setError(
      ""
    );


    setProductionDateError(
      false
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/${orderId}/production`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  orderNumber:
                    cleanOrderNumber,

                  productionHandoffDate:
                    productionDate,

                  actorName,

                  actorUserId:
                    order
                      .ved_responsible_user_id
                    ??
                    null,

                  actorRole:
                    "ved",
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        ProductionResponse =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось подтвердить передачу в производство"
        );

      }


      window.location.reload();


    } catch (
      caughtError
    ) {

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Неизвестная ошибка подтверждения производства"
      );

    } finally {

      setSubmitting(
        false
      );

    }

  }


  // ==========================================================
  // CONFIRM TRANSIT
  // ==========================================================

  async function confirmTransit() {

    if (!order) {
      return;
    }


    if (!transitDate) {

      setTransitDateError(
        true
      );


      setError(
        ""
      );


      return;

    }


    const actorName =
      order
        .ved_responsible_name
        ?.trim();


    if (!actorName) {

      setError(
        "У заказа не назначен ответственный ВЭД"
      );

      return;

    }


    setSubmitting(
      true
    );


    setError(
      ""
    );


    setTransitDateError(
      false
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/${orderId}/transit`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  transitDepartureDate:
                    transitDate,

                  actorName,

                  actorUserId:
                    order
                      .ved_responsible_user_id
                    ??
                    null,

                  actorRole:
                    "ved",
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        TransitResponse =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось подтвердить отправку заказа"
        );

      }


      window.location.reload();


    } catch (
      caughtError
    ) {

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Неизвестная ошибка подтверждения отправки заказа"
      );

    } finally {

      setSubmitting(
        false
      );

    }

  }


  // ==========================================================
  // CONFIRM ARRIVAL
  // ==========================================================

  async function confirmArrival() {

    if (!order) {
      return;
    }


    if (!arrivalDate) {

      setArrivalDateError(
        true
      );


      setError(
        ""
      );


      return;

    }


    const actorName =
      order
        .ved_responsible_name
        ?.trim();


    if (!actorName) {

      setError(
        "У заказа не назначен ответственный ВЭД"
      );

      return;

    }


    setSubmitting(
      true
    );


    setError(
      ""
    );


    setArrivalDateError(
      false
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/${orderId}/arrival`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  actualArrivalDate:
                    arrivalDate,

                  actorName,

                  actorUserId:
                    order
                      .ved_responsible_user_id
                    ??
                    null,

                  actorRole:
                    "ved",
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        ArrivalResponse =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось подтвердить прибытие заказа"
        );

      }


      window.location.reload();


    } catch (
      caughtError
    ) {

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Неизвестная ошибка подтверждения прибытия заказа"
      );

    } finally {

      setSubmitting(
        false
      );

    }

  }


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return null;

  }


  if (!order) {

    return null;

  }


  // ==========================================================
  // BEFORE VED TAKES ORDER
  // ==========================================================

  if (
    order.workflow_status !==
      "ved_in_work"
    &&
    order.workflow_status !==
      "production_confirmed"
    &&
    order.workflow_status !==
      "in_transit"
    &&
    order.workflow_status !==
      "arrived"
  ) {

    return null;

  }


  // ==========================================================
  // ARRIVED
  // ==========================================================

  if (
    order.workflow_status ===
      "arrived"
  ) {

    return (

      <section
        className="section"

        style={{
          padding:
            "16px 20px",

          marginBottom:
            "14px",
        }}
      >

        <div
          className="small-label"
        >
          ПРИБЫТИЕ
        </div>


        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              "18px",

            flexWrap:
              "wrap",

            marginTop:
              "8px",
          }}
        >

          <div>

            <div
              style={{
                fontSize:
                  "18px",

                fontWeight:
                  700,
              }}
            >
              Заказ прибыл
            </div>


            <div
              className="muted"

              style={{
                marginTop:
                  "4px",
              }}
            >
              Фактическое прибытие заказа подтверждено.
            </div>

          </div>


          <div
            style={{
              display:
                "flex",

              gap:
                "28px",

              flexWrap:
                "wrap",
            }}
          >

            <div>

              <div className="card-label">
                Номер заказа
              </div>

              <strong>
                {order.order_number
                ??
                "—"}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Передан в производство
              </div>

              <strong>
                {formatDate(
                  order.production_handoff_date
                )}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Отправлен
              </div>

              <strong>
                {formatDate(
                  order.transit_departure_date
                )}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Ожидалось
              </div>

              <strong>
                {formatDate(
                  order.expected_arrival_date
                )}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Фактически прибыл
              </div>

              <strong>
                {formatDate(
                  order.actual_arrival_date
                )}
              </strong>

            </div>

          </div>

        </div>


        {/* ==================================================
            STOCK BRIDGE STATUS
        ================================================== */}

        <div
          style={{
            marginTop:
              "18px",

            paddingTop:
              "16px",

            borderTop:
              "1px solid var(--border)",
          }}
        >

          {stockBridge?.stock_bridge_completed ? (

            <div>

              <div
                style={{
                  fontSize:
                    "16px",

                  fontWeight:
                    700,
                }}
              >
                Учтён на собственном складе
              </div>


              <div
                className="muted"

                style={{
                  marginTop:
                    "4px",
                }}
              >
                Складской мост завершён. Заказ больше не учитывается как активный ВЭД.
              </div>


              <div
                style={{
                  marginTop:
                    "10px",

                  display:
                    "flex",

                  gap:
                    "28px",

                  flexWrap:
                    "wrap",
                }}
              >

                <div>

                  <div className="card-label">
                    Снимок склада
                  </div>

                  <strong>
                    {formatDate(
                      stockBridge
                        .warehouse_snapshot_date
                    )}
                  </strong>

                </div>

              </div>

            </div>

          ) : stockBridge?.stock_bridge_active ? (

            <div>

              <div
                style={{
                  fontSize:
                    "16px",

                  fontWeight:
                    700,
                }}
              >
                Ожидает обновления собственного склада
              </div>


              <div
                className="muted"

                style={{
                  marginTop:
                    "4px",
                }}
              >
                До появления нового полного снимка склада товары продолжают временно учитываться как активный ВЭД.
              </div>

            </div>

          ) : (

            <div>

              <div
                style={{
                  fontSize:
                    "16px",

                  fontWeight:
                    700,
                }}
              >
                Состояние склада
              </div>


              <div
                className="muted"

                style={{
                  marginTop:
                    "4px",
                }}
              >
                Состояние складского моста пока не определено.
              </div>

            </div>

          )}

        </div>


        {stockBridgeError && (

          <div
            style={{
              marginTop:
                "12px",

              color:
                "#d64545",

              fontWeight:
                700,
            }}
          >
            {stockBridgeError}
          </div>

        )}


        {error && (

          <div
            style={{
              marginTop:
                "12px",

              color:
                "#d64545",

              fontWeight:
                700,
            }}
          >
            {error}
          </div>

        )}

      </section>

    );

  }


  // ==========================================================
  // IN TRANSIT
  // ==========================================================

  if (
    order.workflow_status ===
      "in_transit"
  ) {

    return (

      <section
        className="section"

        style={{
          padding:
            "18px 20px",

          marginBottom:
            "14px",
        }}
      >

        <div
          className="small-label"
        >
          ЛОГИСТИКА
        </div>


        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              "18px",

            flexWrap:
              "wrap",

            marginTop:
              "8px",
          }}
        >

          <div>

            <div
              style={{
                fontSize:
                  "18px",

                fontWeight:
                  700,
              }}
            >
              Заказ в пути
            </div>


            <div
              className="muted"

              style={{
                marginTop:
                  "4px",
              }}
            >
              Заказ продолжает учитываться как активный ВЭД.
            </div>

          </div>


          <div
            style={{
              display:
                "flex",

              gap:
                "28px",

              flexWrap:
                "wrap",
            }}
          >

            <div>

              <div className="card-label">
                Номер заказа
              </div>

              <strong>
                {order.order_number
                ??
                "—"}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Передан в производство
              </div>

              <strong>
                {formatDate(
                  order.production_handoff_date
                )}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Отправлен
              </div>

              <strong>
                {formatDate(
                  order.transit_departure_date
                )}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Ожидаемое прибытие
              </div>

              <strong>
                {formatDate(
                  order.expected_arrival_date
                )}
              </strong>

            </div>

          </div>

        </div>


        <div
          style={{
            marginTop:
              "18px",

            paddingTop:
              "16px",

            borderTop:
              "1px solid var(--border)",
          }}
        >

          <div
            style={{
              fontSize:
                "16px",

              fontWeight:
                700,
            }}
          >
            Подтверждение прибытия
          </div>


          <div
            className="muted"

            style={{
              marginTop:
                "4px",
            }}
          >
            Укажите фактическую дату прибытия заказа.
          </div>


          <div
            style={{
              display:
                "flex",

              alignItems:
                "flex-end",

              gap:
                "12px",

              flexWrap:
                "wrap",

              marginTop:
                "14px",
            }}
          >

            <div
              style={{
                minWidth:
                  "240px",
              }}
            >

              <div
                className="card-label"

                style={{
                  marginBottom:
                    "6px",
                }}
              >
                Фактическая дата прибытия
              </div>


              <input
                type="date"

                value={
                  arrivalDate
                }

                disabled={
                  submitting
                }

                onChange={
                  (
                    event
                  ) => {

                    setArrivalDate(
                      event.target.value
                    );


                    setArrivalDateError(
                      false
                    );


                    setError(
                      ""
                    );

                  }
                }

                style={{
                  width:
                    "100%",

                  minHeight:
                    "42px",

                  padding:
                    "0 11px",

                  border:
                    arrivalDateError
                      ? "1px solid #d64545"
                      : "1px solid var(--border)",

                  borderRadius:
                    "8px",

                  background:
                    "var(--background)",

                  color:
                    "var(--text)",
                }}
              />


              {arrivalDateError && (

                <div
                  style={{
                    marginTop:
                      "6px",

                    color:
                      "#d64545",

                    fontWeight:
                      700,

                    fontSize:
                      "13px",
                  }}
                >
                  Укажите фактическую дату прибытия заказа
                </div>

              )}

            </div>


            <button
              type="button"

              className="primary-button"

              disabled={
                submitting
              }

              onClick={
                () => {

                  void confirmArrival();

                }
              }
            >
              {submitting
                ? "Подтверждаем..."
                : "Подтвердить прибытие"}
            </button>

          </div>

        </div>


        {error && (

          <div
            style={{
              marginTop:
                "12px",

              color:
                "#d64545",

              fontWeight:
                700,
            }}
          >
            {error}
          </div>

        )}

      </section>

    );

  }


  // ==========================================================
  // PRODUCTION CONFIRMED
  // ==========================================================

  if (
    order.workflow_status ===
      "production_confirmed"
  ) {

    return (

      <section
        className="section"

        style={{
          padding:
            "18px 20px",

          marginBottom:
            "14px",
        }}
      >

        <div
          className="small-label"
        >
          ПРОИЗВОДСТВО
        </div>


        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              "18px",

            flexWrap:
              "wrap",

            marginTop:
              "8px",
          }}
        >

          <div>

            <div
              style={{
                fontSize:
                  "18px",

                fontWeight:
                  700,
              }}
            >
              Заказ передан в производство
            </div>


            <div
              className="muted"

              style={{
                marginTop:
                  "4px",
              }}
            >
              Заказ теперь учитывается как активный ВЭД.
            </div>

          </div>


          <div
            style={{
              display:
                "flex",

              gap:
                "28px",

              flexWrap:
                "wrap",
            }}
          >

            <div>

              <div className="card-label">
                Номер заказа
              </div>

              <strong>
                {order.order_number
                ??
                "—"}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Передан в производство
              </div>

              <strong>
                {formatDate(
                  order.production_handoff_date
                )}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Срок
              </div>

              <strong>
                {order.planned_lead_days
                  ? `${order.planned_lead_days} дней`
                  : "—"}
              </strong>

            </div>


            <div>

              <div className="card-label">
                Ожидаемое прибытие
              </div>

              <strong>
                {formatDate(
                  order.expected_arrival_date
                )}
              </strong>

            </div>

          </div>

        </div>


        <div
          style={{
            marginTop:
              "18px",

            paddingTop:
              "16px",

            borderTop:
              "1px solid var(--border)",
          }}
        >

          <div
            style={{
              fontSize:
                "16px",

              fontWeight:
                700,
            }}
          >
            Отправка заказа
          </div>


          <div
            className="muted"

            style={{
              marginTop:
                "4px",
            }}
          >
            Укажите фактическую дату отправки заказа из Китая.
          </div>


          <div
            style={{
              display:
                "flex",

              alignItems:
                "flex-end",

              gap:
                "12px",

              flexWrap:
                "wrap",

              marginTop:
                "14px",
            }}
          >

            <div
              style={{
                minWidth:
                  "240px",
              }}
            >

              <div
                className="card-label"

                style={{
                  marginBottom:
                    "6px",
                }}
              >
                Фактическая дата отправки
              </div>


              <input
                type="date"

                value={
                  transitDate
                }

                disabled={
                  submitting
                }

                onChange={
                  (
                    event
                  ) => {

                    setTransitDate(
                      event.target.value
                    );


                    setTransitDateError(
                      false
                    );


                    setError(
                      ""
                    );

                  }
                }

                style={{
                  width:
                    "100%",

                  minHeight:
                    "42px",

                  padding:
                    "0 11px",

                  border:
                    transitDateError
                      ? "1px solid #d64545"
                      : "1px solid var(--border)",

                  borderRadius:
                    "8px",

                  background:
                    "var(--background)",

                  color:
                    "var(--text)",
                }}
              />


              {transitDateError && (

                <div
                  style={{
                    marginTop:
                      "6px",

                    color:
                      "#d64545",

                    fontWeight:
                      700,

                    fontSize:
                      "13px",
                  }}
                >
                  Укажите дату фактической отправки заказа
                </div>

              )}

            </div>


            <button
              type="button"

              className="primary-button"

              disabled={
                submitting
              }

              onClick={
                () => {

                  void confirmTransit();

                }
              }
            >
              {submitting
                ? "Подтверждаем..."
                : "Подтвердить отправку"}
            </button>

          </div>

        </div>


        {error && (

          <div
            style={{
              marginTop:
                "12px",

              color:
                "#d64545",

              fontWeight:
                700,
            }}
          >
            {error}
          </div>

        )}

      </section>

    );

  }


  // ==========================================================
  // PRODUCTION FORM
  // ==========================================================

  return (

    <section
      className="section"

      style={{
        padding:
          "18px 20px",

        marginBottom:
          "14px",
      }}
    >

      <div
        className="small-label"
      >
        ПЕРЕДАЧА В ПРОИЗВОДСТВО
      </div>


      <div
        style={{
          fontSize:
            "18px",

          fontWeight:
            700,

          marginTop:
            "4px",
        }}
      >
        Подтверждение заказа
      </div>


      <div
        className="muted"

        style={{
          marginTop:
            "4px",
        }}
      >
        После подтверждения заказ начнёт учитываться как активный ВЭД.
      </div>


      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "minmax(220px, 1fr) minmax(220px, 1fr)",

          gap:
            "14px",

          marginTop:
            "16px",
        }}
      >

        <div>

          <div
            className="card-label"

            style={{
              marginBottom:
                "6px",
            }}
          >
            Номер заказа
          </div>


          <input
            type="text"

            value={
              orderNumber
            }

            disabled={
              submitting
            }

            placeholder=
              "Введите номер заказа"

            onChange={
              (
                event
              ) => {

                setOrderNumber(
                  event.target.value
                );


                setError(
                  ""
                );

              }
            }

            style={{
              width:
                "100%",

              minHeight:
                "42px",

              padding:
                "0 11px",

              border:
                "1px solid var(--border)",

              borderRadius:
                "8px",

              background:
                "var(--background)",

              color:
                "var(--text)",
            }}
          />

        </div>


        <div>

          <div
            className="card-label"

            style={{
              marginBottom:
                "6px",
            }}
          >
            Дата передачи в производство
          </div>


          <input
            type="date"

            value={
              productionDate
            }

            disabled={
              submitting
            }

            onChange={
              (
                event
              ) => {

                setProductionDate(
                  event.target.value
                );


                setProductionDateError(
                  false
                );


                setError(
                  ""
                );

              }
            }

            style={{
              width:
                "100%",

              minHeight:
                "42px",

              padding:
                "0 11px",

              border:
                productionDateError
                  ? "1px solid #d64545"
                  : "1px solid var(--border)",

              borderRadius:
                "8px",

              background:
                "var(--background)",

              color:
                "var(--text)",
            }}
          />


          {productionDateError && (

            <div
              style={{
                marginTop:
                  "6px",

                color:
                  "#d64545",

                fontWeight:
                  700,

                fontSize:
                  "13px",
              }}
            >
              Укажите дату передачи заказа в производство
            </div>

          )}

        </div>

      </div>


      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",

          gap:
            "12px",

          flexWrap:
            "wrap",

          marginTop:
            "16px",
        }}
      >

        <button
          type="button"

          className=
            "primary-button"

          disabled={
            submitting
          }

          onClick={
            () => {

              void confirmProduction();

            }
          }
        >

          {submitting
            ? "Подтверждаем..."
            : "Подтвердить передачу в производство"}

        </button>


        <div
          className="muted"

          style={{
            fontSize:
              "12px",
          }}
        >
          После подтверждения действие отменить обычной кнопкой будет нельзя.
        </div>

      </div>


      {error && (

        <div
          style={{
            marginTop:
              "12px",

            color:
              "#d64545",

            fontWeight:
              700,
          }}
        >
          {error}
        </div>

      )}

    </section>

  );

}
