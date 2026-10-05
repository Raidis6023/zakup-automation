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

  expected_arrival_date: string | null;

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
    dateError,
    setDateError,
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


      setOrder(
        result.order
      );


      setOrderNumber(
        result.order.order_number
        ??
        ""
      );


      setProductionDate(
        result.order.production_handoff_date
        ??
        ""
      );


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

      setDateError(
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

    setDateError(
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
  // ALREADY CONFIRMED
  // ==========================================================

  if (
    order.workflow_status ===
      "production_confirmed"
    ||
    order.workflow_status ===
      "in_transit"
    ||
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

        {/* ORDER NUMBER */}

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


        {/* PRODUCTION DATE */}

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

                setDateError(
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
                dateError
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


          {dateError && (

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
