"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


// ============================================================
// TYPES
// ============================================================

type ApiResponse = {
  ok?: boolean;

  error?: string;

  message?: string;

  [key: string]:
    unknown;
};


type Props = {
  initialStockUpdatedAt:
    string | null;

  initialSalesUpdatedAt:
    string | null;
};


// ============================================================
// FORMAT
// ============================================================

function formatDateTimeKrasnoyarsk(
  value:
    string
    | null
): string {

  if (!value) {
    return "Ещё не обновлялись";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }


  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Asia/Krasnoyarsk",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

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
// FETCH
// ============================================================

async function postJson(
  url: string
):
Promise<ApiResponse> {

  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  let data:
    ApiResponse;


  try {

    data =
      text
        ? JSON.parse(
            text
          ) as ApiResponse
        : {};

  } catch {

    throw new Error(
      `Сервер вернул некорректный ответ: ${text}`
    );

  }


  if (
    !response.ok
    ||
    data.ok !== true
  ) {

    throw new Error(
      data.error
      ??
      data.message
      ??
      `HTTP ${response.status}`
    );

  }


  return data;

}


// ============================================================
// COMPONENT
// ============================================================

export default function YandexSyncActionsClient({
  initialStockUpdatedAt,
  initialSalesUpdatedAt,
}: Props) {

  const router =
    useRouter();


  const [
    stockUpdatedAt,
    setStockUpdatedAt,
  ] =
    useState<
      string | null
    >(
      initialStockUpdatedAt
    );


  const [
    salesUpdatedAt,
    setSalesUpdatedAt,
  ] =
    useState<
      string | null
    >(
      initialSalesUpdatedAt
    );


  const [
    stockLoading,
    setStockLoading,
  ] =
    useState(
      false
    );


  const [
    salesLoading,
    setSalesLoading,
  ] =
    useState(
      false
    );


  const [
    stockMessage,
    setStockMessage,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    salesMessage,
    setSalesMessage,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    stockError,
    setStockError,
  ] =
    useState(
      false
    );


  const [
    salesError,
    setSalesError,
  ] =
    useState(
      false
    );


  useEffect(
    () => {

      setStockUpdatedAt(
        initialStockUpdatedAt
      );

    },
    [
      initialStockUpdatedAt,
    ]
  );


  useEffect(
    () => {

      setSalesUpdatedAt(
        initialSalesUpdatedAt
      );

    },
    [
      initialSalesUpdatedAt,
    ]
  );


  // ==========================================================
  // STOCKS
  // ==========================================================

  async function updateStocks() {

    if (
      stockLoading
      ||
      salesLoading
    ) {
      return;
    }


    setStockLoading(
      true
    );


    setStockError(
      false
    );


    setStockMessage(
      "Получаем свежие остатки Яндекс Маркета..."
    );


    try {

      await postJson(
        "/api/yandex/stocks"
      );


      const now =
        new Date()
          .toISOString();


      setStockUpdatedAt(
        now
      );


      setStockMessage(
        "Остатки успешно обновлены."
      );


      router.refresh();

    } catch (error) {

      setStockError(
        true
      );


      setStockMessage(
        error instanceof Error
          ? error.message
          : String(error)
      );

    } finally {

      setStockLoading(
        false
      );

    }

  }


  // ==========================================================
  // SALES
  //
  // 1. Сырые заказы + возвраты.
  // 2. Только после успеха пересчитываем daily.
  // ==========================================================

  async function updateSales() {

    if (
      salesLoading
      ||
      stockLoading
    ) {
      return;
    }


    setSalesLoading(
      true
    );


    setSalesError(
      false
    );


    setSalesMessage(
      "Получаем заказы, отмены, невыкупы и возвраты..."
    );


    try {

      await postJson(
        "/api/yandex/sales"
      );


      setSalesMessage(
        "Данные получены. Пересчитываем дневные продажи..."
      );


      await postJson(
        "/api/yandex/sales/daily-sync"
      );


      const now =
        new Date()
          .toISOString();


      setSalesUpdatedAt(
        now
      );


      setSalesMessage(
        "Продажи успешно обновлены."
      );


      router.refresh();

    } catch (error) {

      setSalesError(
        true
      );


      setSalesMessage(
        error instanceof Error
          ? error.message
          : String(error)
      );

    } finally {

      setSalesLoading(
        false
      );

    }

  }


  const anyLoading =
    stockLoading
    ||
    salesLoading;


  return (
    <div
      style={{
        display:
          "grid",

        gridTemplateColumns:
          "repeat(auto-fit, minmax(290px, 1fr))",

        gap:
          "16px",

        marginTop:
          "18px",
      }}
    >

      {/* ===================================
          STOCKS
          =================================== */}

      <div className="card">

        <div className="card-label">
          Остатки
        </div>


        <div
          style={{
            marginTop:
              "8px",

            fontSize:
              "13px",

            fontWeight:
              700,
          }}
        >
          {
            formatDateTimeKrasnoyarsk(
              stockUpdatedAt
            )
          }
        </div>


        <div
          className="muted"

          style={{
            marginTop:
              "5px",

            fontSize:
              "11px",
          }}
        >
          Последнее успешное обновление,
          красноярское время
        </div>


        <button
          type="button"

          className=
            "secondary-button"

          disabled=
            {anyLoading}

          onClick=
            {
              () =>
                void updateStocks()
            }

          style={{
            marginTop:
              "14px",

            minWidth:
              "170px",

            opacity:
              anyLoading
                ? 0.6
                : 1,

            cursor:
              anyLoading
                ? "not-allowed"
                : "pointer",
          }}
        >
          {
            stockLoading
              ? "Обновляем..."
              : "Обновить остатки"
          }
        </button>


        {
          stockMessage
            ? (

              <div
                style={{
                  marginTop:
                    "10px",

                  fontSize:
                    "12px",

                  lineHeight:
                    1.45,

                  color:
                    stockError
                      ? "#f04438"
                      : "#027a48",
                }}
              >
                {stockMessage}
              </div>

            )
            : null
        }

      </div>


      {/* ===================================
          SALES
          =================================== */}

      <div className="card">

        <div className="card-label">
          Продажи
        </div>


        <div
          style={{
            marginTop:
              "8px",

            fontSize:
              "13px",

            fontWeight:
              700,
          }}
        >
          {
            formatDateTimeKrasnoyarsk(
              salesUpdatedAt
            )
          }
        </div>


        <div
          className="muted"

          style={{
            marginTop:
              "5px",

            fontSize:
              "11px",
          }}
        >
          Последний успешный пересчёт
          yandex_sales_daily
        </div>


        <button
          type="button"

          className=
            "secondary-button"

          disabled=
            {anyLoading}

          onClick=
            {
              () =>
                void updateSales()
            }

          style={{
            marginTop:
              "14px",

            minWidth:
              "170px",

            opacity:
              anyLoading
                ? 0.6
                : 1,

            cursor:
              anyLoading
                ? "not-allowed"
                : "pointer",
          }}
        >
          {
            salesLoading
              ? "Обновляем..."
              : "Обновить продажи"
          }
        </button>


        {
          salesMessage
            ? (

              <div
                style={{
                  marginTop:
                    "10px",

                  fontSize:
                    "12px",

                  lineHeight:
                    1.45,

                  color:
                    salesError
                      ? "#f04438"
                      : "#027a48",
                }}
              >
                {salesMessage}
              </div>

            )
            : null
        }

      </div>

    </div>
  );

}
