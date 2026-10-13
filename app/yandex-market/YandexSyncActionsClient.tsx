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
// ICONS
// ============================================================

function StocksIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="
          M12 3
          20 7
          12 11
          4 7
          Z
        "
      />

      <path
        d="
          M4 7
          v10
          l8 4
          8-4
          V7
        "
      />

      <path
        d="M12 11v10"
      />

    </svg>

  );

}


function SalesIcon() {

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


// ============================================================
// FORMAT
// ============================================================

function formatDateTimeKrasnoyarsk(
  value:
    string
    |
    null
):
string {

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
  url:
    string
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
          ) as
            ApiResponse

        : {};

  } catch {

    throw new Error(
      `Сервер вернул некорректный ответ: ${text}`
    );

  }


  if (
    !response.ok
    ||
    data.ok !==
      true
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

    } catch (
      error
    ) {

      setStockError(
        true
      );


      setStockMessage(
        error instanceof Error

          ? error.message

          : String(
              error
            )
      );

    } finally {

      setStockLoading(
        false
      );

    }

  }


  // ==========================================================
  // SALES
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

    } catch (
      error
    ) {

      setSalesError(
        true
      );


      setSalesMessage(
        error instanceof Error

          ? error.message

          : String(
              error
            )
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
      className=
        "yandex-sync-actions"
    >

      {/* ===================================
          STOCKS
          =================================== */}

      <div
        className=
          "yandex-sync-card"
      >

        <div
          className=
            "yandex-sync-card-top"
        >

          <span
            className=
              "yandex-sync-card-icon"
          >
            <StocksIcon />
          </span>


          <div
            className=
              "yandex-sync-card-copy"
          >

            <div
              className=
                "yandex-sync-card-title"
            >
              Остатки
            </div>


            <div
              className=
                "yandex-sync-date"
            >
              {
                formatDateTimeKrasnoyarsk(
                  stockUpdatedAt
                )
              }
            </div>


            <div
              className=
                "yandex-sync-hint"
            >
              Последнее успешное обновление,
              красноярское время
            </div>

          </div>

        </div>


        <button
          type="button"

          className=
            "secondary-button yandex-sync-button"

          disabled={
            anyLoading
          }

          onClick={
            () =>
              void updateStocks()
          }
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
                className={
                  stockError

                    ? "yandex-sync-message yandex-sync-message--error"

                    : "yandex-sync-message"
                }
              >
                {
                  stockMessage
                }
              </div>

            )

            : null
        }

      </div>


      {/* ===================================
          SALES
          =================================== */}

      <div
        className=
          "yandex-sync-card"
      >

        <div
          className=
            "yandex-sync-card-top"
        >

          <span
            className=
              "yandex-sync-card-icon"
          >
            <SalesIcon />
          </span>


          <div
            className=
              "yandex-sync-card-copy"
          >

            <div
              className=
                "yandex-sync-card-title"
            >
              Продажи
            </div>


            <div
              className=
                "yandex-sync-date"
            >
              {
                formatDateTimeKrasnoyarsk(
                  salesUpdatedAt
                )
              }
            </div>


            <div
              className=
                "yandex-sync-hint"
            >
              Последний успешный пересчёт
              yandex_sales_daily
            </div>

          </div>

        </div>


        <button
          type="button"

          className=
            "secondary-button yandex-sync-button"

          disabled={
            anyLoading
          }

          onClick={
            () =>
              void updateSales()
          }
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
                className={
                  salesError

                    ? "yandex-sync-message yandex-sync-message--error"

                    : "yandex-sync-message"
                }
              >
                {
                  salesMessage
                }
              </div>

            )

            : null
        }

      </div>

    </div>

  );

}
