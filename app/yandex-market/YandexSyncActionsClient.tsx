"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type Props = {
  initialSyncUpdatedAt:
    string | null;

  periodDateFrom:
    string | null;

  periodDateTo:
    string | null;
};


type SyncResponse = {
  ok?: boolean;

  finished_at?: string;

  failed_step?: string;

  failed_body?: {
    error?: string;
  };

  error?: string;
};


// ============================================================
// FORMAT
// ============================================================

function formatDateTimeKrasnoyarsk(
  value:
    string
    | null
):
string {

  if (!value) {
    return "—";
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


function formatPeriodDate(
  value:
    string
    | null
):
string {

  if (!value) {
    return "—";
  }


  const [
    year,
    month,
    day,
  ] =
    value.split(
      "-"
    );


  if (
    !year
    ||
    !month
    ||
    !day
  ) {

    return value;

  }


  return `${day}.${month}.${year}`;

}


// ============================================================
// ICONS
// ============================================================

function CheckIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12.5l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

}


function ErrorIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );

}


function ClockIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

}


function CalendarIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 3v3M17 3v3M4 9h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );

}


function RefreshIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 7v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M18.2 8.3A7 7 0 1 0 19 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

}


// ============================================================
// COMPONENT
// ============================================================

export default function YandexSyncActionsClient({
  initialSyncUpdatedAt,
  periodDateFrom,
  periodDateTo,
}: Props) {

  const router =
    useRouter();


  const [
    syncUpdatedAt,
    setSyncUpdatedAt,
  ] =
    useState<
      string
      | null
    >(
      initialSyncUpdatedAt
    );


  const [
    status,
    setStatus,
  ] =
    useState<
      "idle"
      | "loading"
      | "success"
      | "error"
    >(
      "idle"
    );


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<
      string
      | null
    >(
      null
    );


  async function handleSync() {

    if (
      status ===
      "loading"
    ) {

      return;

    }


    setStatus(
      "loading"
    );


    setErrorMessage(
      null
    );


    try {

      const response =
        await fetch(
          "/api/yandex/daily-sync",
          {
            method:
              "POST",

            headers: {
              Accept:
                "application/json",
            },

            cache:
              "no-store",
          }
        );


      const text =
        await response.text();


      let body:
        SyncResponse;


      try {

        body =
          text
            ? JSON.parse(
                text
              ) as SyncResponse
            : {};

      } catch {

        throw new Error(
          `Сервер вернул некорректный ответ: ${text}`
        );

      }


      if (
        !response.ok
        ||
        body.ok !==
          true
      ) {

        const failedStep =
          body.failed_step
            ? `Этап: ${body.failed_step}. `
            : "";


        const reason =
          body.failed_body
            ?.error
          ||
          body.error
          ||
          `HTTP ${response.status}`;


        throw new Error(
          `${failedStep}${reason}`
        );

      }


      setSyncUpdatedAt(
        body.finished_at
        ??
        new Date()
          .toISOString()
      );


      setStatus(
        "success"
      );


      router.refresh();

    } catch (error) {

      setStatus(
        "error"
      );


      setErrorMessage(
        error instanceof Error
          ? error.message
          : String(
              error
            )
      );

    }

  }


  const isLoading =
    status ===
    "loading";


  const hasError =
    status ===
    "error";


  const statusClass =
    hasError
      ? "ym-sync-status-card--error"
      : isLoading
        ? "ym-sync-status-card--loading"
        : "ym-sync-status-card--success";


  return (
    <div
      className=
        "card ym-sync-hero"
    >

      {/* ===================================
          1 / 4 STATUS
          =================================== */}

      <div
        className=
          "ym-sync-hero__quarter"
      >

        <div
          className={
            `ym-sync-status-card ${statusClass}`
          }
        >

          <div
            className=
              "ym-sync-status-card__icon"
          >

            {
              hasError
                ? (
                  <ErrorIcon />
                )
                : isLoading
                  ? (
                    <span
                      className=
                        "ym-sync-hero-button__icon ym-sync-hero-button__icon--spinning"
                    >
                      <RefreshIcon />
                    </span>
                  )
                  : (
                    <CheckIcon />
                  )
            }

          </div>


          <div
            className=
              "ym-sync-status-card__content"
          >

            <div
              className=
                "ym-sync-status-card__title"
            >
              {
                hasError
                  ? "Ошибка синхронизации"
                  : isLoading
                    ? "Синхронизация выполняется"
                    : "Синхронизация завершена"
              }
            </div>


            <div
              className=
                "ym-sync-status-card__hint"
            >
              {
                hasError
                  ? (
                    errorMessage
                    ??
                    "Не удалось обновить данные"
                  )
                  : isLoading
                    ? "Обновляем данные Яндекс Маркета"
                    : "Данные Яндекс Маркета успешно обновлены"
              }
            </div>

          </div>

        </div>

      </div>


      {/* ===================================
          2 / 4 LAST SYNC
          =================================== */}

      <div
        className=
          "ym-sync-hero__quarter ym-sync-hero__quarter--border"
      >

        <div
          className=
            "ym-sync-fact"
        >

          <div
            className=
              "ym-sync-fact__icon"
          >
            <ClockIcon />
          </div>


          <div
            className=
              "ym-sync-fact__content"
          >

            <div
              className=
                "ym-sync-fact__label"
            >
              Последняя синхронизация
            </div>


            <div
              className=
                "ym-sync-fact__value"
            >
              {
                formatDateTimeKrasnoyarsk(
                  syncUpdatedAt
                )
              }
            </div>


            <div
              className=
                "ym-sync-fact__hint"
            >
              Красноярское время
            </div>

          </div>

        </div>

      </div>


      {/* ===================================
          3 / 4 PERIOD
          =================================== */}

      <div
        className=
          "ym-sync-hero__quarter ym-sync-hero__quarter--border"
      >

        <div
          className=
            "ym-sync-fact"
        >

          <div
            className=
              "ym-sync-fact__icon"
          >
            <CalendarIcon />
          </div>


          <div
            className=
              "ym-sync-fact__content"
          >

            <div
              className=
                "ym-sync-fact__label"
            >
              Период продаж
            </div>


            <div
              className=
                "ym-sync-fact__value"
            >
              {
                formatPeriodDate(
                  periodDateFrom
                )
              }
              {" – "}
              {
                formatPeriodDate(
                  periodDateTo
                )
              }
            </div>


            <div
              className=
                "ym-sync-fact__hint"
            >
              Скользящие 28 дней
            </div>

          </div>

        </div>

      </div>


      {/* ===================================
          4 / 4 BUTTON
          =================================== */}

      <div
        className=
          "ym-sync-hero__quarter ym-sync-hero__quarter--border"
      >

        <div
          className=
            "ym-sync-hero__action"
        >

          <div
            className=
              "ym-sync-client--hero"
          >

            <div
              className={
                hasError
                  ? "ym-sync-message-slot ym-sync-message-slot--error"
                  : isLoading
                    ? "ym-sync-message-slot ym-sync-message-slot--loading"
                    : "ym-sync-message-slot"
              }
            >
              {
                hasError
                  ? "Ошибка обновления"
                  : isLoading
                    ? "Обновление данных"
                    : ""
              }
            </div>


            <button
              type="button"

              className=
                "ym-sync-hero-button"

              onClick={
                handleSync
              }

              disabled={
                isLoading
              }
            >

              <span
                className={
                  isLoading
                    ? "ym-sync-hero-button__icon ym-sync-hero-button__icon--spinning"
                    : "ym-sync-hero-button__icon"
                }
              >
                <RefreshIcon />
              </span>


              {
                isLoading
                  ? "Обновление..."
                  : "Обновить данные"
              }

            </button>


            <div
              className=
                "ym-sync-note-slot"
            />

          </div>

        </div>

      </div>

    </div>
  );

}
