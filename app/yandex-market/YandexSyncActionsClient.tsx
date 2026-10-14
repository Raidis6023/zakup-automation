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
      width="20"
      height="20"
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


function ClockIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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
      width="18"
      height="18"
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


function RefreshIcon({
  spinning = false,
}: {
  spinning?: boolean;
}) {

  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      aria-hidden="true"
      style={{
        animation:
          spinning
            ? "yandex-sync-spin 0.9s linear infinite"
            : undefined,
      }}
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
    useState<string | null>(
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
    useState<string | null>(
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


  return (
    <div
      className="card"

      style={{
        padding:
          "10px 14px",

        marginTop:
          "18px",

        overflow:
          "hidden",
      }}
    >

      <style>
        {`
          @keyframes yandex-sync-spin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          .yandex-sync-strip {
            display: grid;
            grid-template-columns:
              minmax(330px, 1.15fr)
              minmax(250px, 1fr)
              minmax(300px, 1fr)
              minmax(250px, 0.95fr);
            align-items: stretch;
          }

          .yandex-sync-strip__cell {
            min-width: 0;
            padding: 8px 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-left:
              1px solid var(--table-divider, rgba(128, 148, 170, 0.18));
          }

          .yandex-sync-strip__cell:first-child {
            border-left: none;
            padding-left: 0;
          }

          .yandex-sync-strip__cell:last-child {
            padding-right: 0;
          }

          @media (max-width: 1100px) {
            .yandex-sync-strip {
              grid-template-columns: 1fr 1fr;
            }

            .yandex-sync-strip__cell {
              border-left: none;
              border-top:
                1px solid var(--table-divider, rgba(128, 148, 170, 0.18));
            }

            .yandex-sync-strip__cell:nth-child(-n + 2) {
              border-top: none;
            }
          }

          @media (max-width: 680px) {
            .yandex-sync-strip {
              grid-template-columns: 1fr;
            }

            .yandex-sync-strip__cell,
            .yandex-sync-strip__cell:nth-child(-n + 2) {
              border-top:
                1px solid var(--table-divider, rgba(128, 148, 170, 0.18));
              border-left: none;
              padding: 14px 0;
            }

            .yandex-sync-strip__cell:first-child {
              border-top: none;
            }
          }
        `}
      </style>


      <div className="yandex-sync-strip">

        {/* ===================================
            STATUS
            =================================== */}

        <div className="yandex-sync-strip__cell">

          <div
            style={{
              width:
                "100%",

              display:
                "flex",

              alignItems:
                "center",

              gap:
                "12px",

              padding:
                "10px 14px",

              borderRadius:
                "8px",

              background:
                hasError
                  ? "rgba(244, 63, 94, 0.10)"
                  : isLoading
                    ? "rgba(249, 115, 22, 0.10)"
                    : "rgba(16, 185, 129, 0.10)",

              border:
                hasError
                  ? "1px solid rgba(244, 63, 94, 0.28)"
                  : isLoading
                    ? "1px solid rgba(249, 115, 22, 0.28)"
                    : "1px solid rgba(16, 185, 129, 0.25)",
            }}
          >

            <div
              style={{
                width:
                  "32px",

                height:
                  "32px",

                borderRadius:
                  "999px",

                display:
                  "grid",

                placeItems:
                  "center",

                flex:
                  "0 0 auto",

                background:
                  hasError
                    ? "#fb7185"
                    : isLoading
                      ? "#f97316"
                      : "#34d399",

                color:
                  "#07251e",
              }}
            >
              {
                isLoading
                  ? (
                    <RefreshIcon
                      spinning
                    />
                  )
                  : (
                    <CheckIcon />
                  )
              }
            </div>


            <div
              style={{
                minWidth:
                  0,
              }}
            >

              <div
                style={{
                  fontSize:
                    "13px",

                  fontWeight:
                    800,

                  color:
                    hasError
                      ? "#fb7185"
                      : isLoading
                        ? "#fb923c"
                        : "#34d399",
                }}
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
                className="muted"

                style={{
                  marginTop:
                    "3px",

                  fontSize:
                    "10px",

                  lineHeight:
                    1.35,
                }}
              >
                {
                  hasError
                    ? errorMessage
                    : isLoading
                      ? "Обновляем остатки, продажи и дневные данные"
                      : "Данные Яндекс Маркета успешно обновлены"
                }
              </div>

            </div>

          </div>

        </div>


        {/* ===================================
            LAST SYNC
            =================================== */}

        <div className="yandex-sync-strip__cell">

          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "10px",
            }}
          >

            <div
              style={{
                color:
                  "#f97316",
              }}
            >
              <ClockIcon />
            </div>


            <div>

              <div
                className="muted"

                style={{
                  fontSize:
                    "9px",
                }}
              >
                Последняя синхронизация
              </div>


              <div
                style={{
                  marginTop:
                    "2px",

                  fontSize:
                    "13px",

                  fontWeight:
                    800,
                }}
              >
                {
                  formatDateTimeKrasnoyarsk(
                    syncUpdatedAt
                  )
                }
              </div>


              <div
                className="muted"

                style={{
                  marginTop:
                    "2px",

                  fontSize:
                    "9px",
                }}
              >
                Красноярское время
              </div>

            </div>

          </div>

        </div>


        {/* ===================================
            PERIOD
            =================================== */}

        <div className="yandex-sync-strip__cell">

          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "10px",
            }}
          >

            <div
              style={{
                color:
                  "#f97316",
              }}
            >
              <CalendarIcon />
            </div>


            <div>

              <div
                className="muted"

                style={{
                  fontSize:
                    "9px",
                }}
              >
                Период продаж
              </div>


              <div
                style={{
                  marginTop:
                    "2px",

                  fontSize:
                    "13px",

                  fontWeight:
                    800,
                }}
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
                className="muted"

                style={{
                  marginTop:
                    "2px",

                  fontSize:
                    "9px",
                }}
              >
                Скользящие 28 дней
              </div>

            </div>

          </div>

        </div>


        {/* ===================================
            BUTTON
            =================================== */}

        <div className="yandex-sync-strip__cell">

          <button
            type="button"

            onClick={
              handleSync
            }

            disabled={
              isLoading
            }

            style={{
              width:
                "100%",

              minHeight:
                "42px",

              border:
                "1px solid rgba(249, 115, 22, 0.55)",

              borderRadius:
                "7px",

              background:
                isLoading
                  ? "rgba(249, 115, 22, 0.45)"
                  : "linear-gradient(180deg, #fb923c 0%, #f97316 100%)",

              color:
                "#ffffff",

              display:
                "inline-flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              gap:
                "8px",

              fontSize:
                "12px",

              fontWeight:
                800,

              cursor:
                isLoading
                  ? "wait"
                  : "pointer",

              boxShadow:
                isLoading
                  ? "none"
                  : "0 6px 20px rgba(249, 115, 22, 0.18)",

              opacity:
                isLoading
                  ? 0.8
                  : 1,
            }}
          >

            <RefreshIcon
              spinning={
                isLoading
              }
            />


            {
              isLoading
                ? "Обновление..."
                : "Обновить данные"
            }

          </button>

        </div>

      </div>

    </div>
  );

}
