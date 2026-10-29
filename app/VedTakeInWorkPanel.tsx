"use client";

import Button from "./ui/Button";

import {
  useEffect,
  useState,
} from "react";


// ============================================================
// TYPES
// ============================================================

type VedOrder = {
  id: string;

  workflow_status: string;

  ved_responsible_name: string | null;
};


type OrderResponse = {
  ok: boolean;

  error?: string;

  order?: VedOrder;
};


type TakeInWorkResponse = {
  ok: boolean;

  error?: string;

  workflow_status?: string;

  ved_responsible_name?: string;

  ved_taken_at?: string;
};


// ============================================================
// COMPONENT
// ============================================================

export default function VedTakeInWorkPanel(
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
    actorName,
    setActorName,
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
  // TAKE IN WORK
  // ==========================================================

  async function takeInWork() {

    const name =
      actorName
        .trim();


    if (!name) {

      setError(
        "Укажите сотрудника ВЭД"
      );

      return;

    }


    setSubmitting(
      true
    );

    setError(
      ""
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/${orderId}/take-in-work`,
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
                  actorName:
                    name,

                  actorUserId:
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
        TakeInWorkResponse =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось взять заказ в работу"
        );

      }


      window.location.reload();


    } catch (
      caughtError
    ) {

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Неизвестная ошибка"
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

    return (

      <section
        className="section"

        style={{
          padding:
            "14px 20px",

          marginBottom:
            "14px",
        }}
      >

        <div className="muted">
          Проверяем статус ВЭД...
        </div>

      </section>

    );

  }


  // ==========================================================
  // LOAD ERROR
  // ==========================================================

  if (
    error
    &&
    !order
  ) {

    return (

      <section
        className="section"

        style={{
          padding:
            "14px 20px",

          marginBottom:
            "14px",
        }}
      >

        <div
          style={{
            color:
              "#d64545",

            fontWeight:
              700,
          }}
        >
          Ошибка блока ВЭД: {error}
        </div>

      </section>

    );

  }


  if (!order) {

    return null;

  }


  // ==========================================================
  // PANEL IS ONLY NEEDED AFTER HANDOFF
  // ==========================================================

  if (
    order.workflow_status !==
      "sent_to_ved"
  ) {

    return null;

  }


  if (
    order
      .ved_responsible_name
      ?.trim()
  ) {

    return null;

  }


  // ==========================================================
  // UI
  // ==========================================================

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
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          gap:
            "16px",

          flexWrap:
            "wrap",
        }}
      >

        <div>

          <div className="small-label">
            ОТДЕЛ ВЭД
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
            Заказ передан в ВЭД
          </div>


          <div
            className="muted"

            style={{
              marginTop:
                "3px",
            }}
          >
            Укажите сотрудника, который принимает заказ в работу.
          </div>

        </div>


        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              "8px",

            flexWrap:
              "wrap",
          }}
        >

          <input
            type="text"

            value={
              actorName
            }

            disabled={
              submitting
            }

            placeholder=
              "Сотрудник ВЭД"

            onChange={
              (
                event
              ) => {

                setActorName(
                  event.target.value
                );

                setError(
                  ""
                );

              }
            }

            onKeyDown={
              (
                event
              ) => {

                if (
                  event.key ===
                  "Enter"
                ) {

                  void takeInWork();

                }

              }
            }

            className="ws-editor-input"
            style={{ width: "220px" }}
          />


          <Button
            type="button"

            

            disabled={
              submitting
            }

            onClick={
              () => {

                void takeInWork();

              }
            }
          >

            {submitting
              ? "Принимаем..."
              : "Взять в работу"}

          </Button>

        </div>

      </div>


      {error && (

        <div
          style={{
            marginTop:
              "10px",

            color:
              "#d64545",

            fontWeight:
              600,
          }}
        >
          {error}
        </div>

      )}

    </section>

  );

}
