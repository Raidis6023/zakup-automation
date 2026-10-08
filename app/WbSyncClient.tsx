"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type SyncState = {

  lastHttpStatus:
    number | null;

  lastAttemptAt:
    string | null;

  lastSuccessAt:
    string | null;

  nextAllowedAt:
    string | null;

  retryAfterSeconds:
    number | null;

  lastMessage:
    string | null;

};


type Props = {

  endpoint:
    string;

  label:
    string;

  loadingLabel:
    string;

  initialState?:
    SyncState | null;

};


type ApiResult = {

  ok?:
    boolean;

  skipped?:
    boolean;

  blockedByRateLimit?:
    boolean;

  message?:
    string;

  error?:
    unknown;

  wbStatus?:
    number;

  lastHttpStatus?:
    number;

  nextAllowedAt?:
    string | null;

  secondsRemaining?:
    number;

  retryAfterSeconds?:
    number | null;

  retryAfterSecondsOriginally?:
    number | null;

  saved?: {

    syncedAt?:
      string;

  };

  newSnapshot?: {

    snapshotAt?:
      string;

  };

  wildberries?: {

    status?:
      number;

  };

};


function getResultMessage(
  data:
    ApiResult | null,
  fallback:
    string
) {

  if (
    data
    &&
    typeof data.message ===
      "string"
    &&
    data.message.trim()
  ) {

    return data.message;

  }


  if (
    data
    &&
    typeof data.error ===
      "string"
    &&
    data.error.trim()
  ) {

    return data.error;

  }


  return fallback;

}


function formatDuration(
  totalSeconds:
    number
) {

  const safe =
    Math.max(
      0,
      Math.floor(
        totalSeconds
      )
    );


  const hours =
    Math.floor(
      safe / 3600
    );


  const minutes =
    Math.floor(
      (
        safe % 3600
      )
      /
      60
    );


  const seconds =
    safe % 60;


  return [
    String(
      hours
    ).padStart(
      2,
      "0"
    ),

    String(
      minutes
    ).padStart(
      2,
      "0"
    ),

    String(
      seconds
    ).padStart(
      2,
      "0"
    ),
  ].join(
    ":"
  );

}


function formatDateTime(
  value:
    string | null
) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(
      value
    );


  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {

    return "—";

  }


  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Asia/Krasnoyarsk",

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

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


export default function WbSyncClient({
  endpoint,
  label,
  loadingLabel,
  initialState,
}: Props) {

  const router =
    useRouter();


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    message,
    setMessage,
  ] =
    useState(
      ""
    );


  const [
    error,
    setError,
  ] =
    useState(
      false
    );


  const [
    now,
    setNow,
  ] =
    useState(
      Date.now()
    );


  const [
    rateState,
    setRateState,
  ] =
    useState<SyncState>({
      lastHttpStatus:
        initialState?.lastHttpStatus
        ??
        null,

      lastAttemptAt:
        initialState?.lastAttemptAt
        ??
        null,

      lastSuccessAt:
        initialState?.lastSuccessAt
        ??
        null,

      nextAllowedAt:
        initialState?.nextAllowedAt
        ??
        null,

      retryAfterSeconds:
        initialState?.retryAfterSeconds
        ??
        null,

      lastMessage:
        initialState?.lastMessage
        ??
        null,
    });


  useEffect(
    () => {

      setRateState({
        lastHttpStatus:
          initialState?.lastHttpStatus
          ??
          null,

        lastAttemptAt:
          initialState?.lastAttemptAt
          ??
          null,

        lastSuccessAt:
          initialState?.lastSuccessAt
          ??
          null,

        nextAllowedAt:
          initialState?.nextAllowedAt
          ??
          null,

        retryAfterSeconds:
          initialState?.retryAfterSeconds
          ??
          null,

        lastMessage:
          initialState?.lastMessage
          ??
          null,
      });

    },
    [
      initialState?.lastHttpStatus,
      initialState?.lastAttemptAt,
      initialState?.lastSuccessAt,
      initialState?.nextAllowedAt,
      initialState?.retryAfterSeconds,
      initialState?.lastMessage,
    ]
  );


  useEffect(
    () => {

      const timer =
        window.setInterval(
          () => {

            setNow(
              Date.now()
            );

          },
          1000
        );


      return () => {

        window.clearInterval(
          timer
        );

      };

    },
    []
  );


  const nextAllowedTimestamp =
    useMemo(
      () => {

        if (
          !rateState.nextAllowedAt
        ) {

          return null;

        }


        const timestamp =
          new Date(
            rateState.nextAllowedAt
          ).getTime();


        if (
          !Number.isFinite(
            timestamp
          )
        ) {

          return null;

        }


        return timestamp;

      },
      [
        rateState.nextAllowedAt,
      ]
    );


  const secondsRemaining =
    nextAllowedTimestamp
      &&
      nextAllowedTimestamp >
        now

      ? Math.ceil(
          (
            nextAllowedTimestamp
            -
            now
          )
          /
          1000
        )

      : 0;


  const activeKnownRateLimit =
    secondsRemaining >
    0;


  const unknownRateLimit =
    rateState.lastHttpStatus ===
      429
    &&
    !activeKnownRateLimit
    &&
    !rateState.nextAllowedAt;


  const disabled =
    loading
    ||
    activeKnownRateLimit;


  async function runSync() {

    if (disabled) {

      return;

    }


    setLoading(
      true
    );


    setMessage(
      ""
    );


    setError(
      false
    );


    try {

      const response =
        await fetch(
          endpoint,
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );


      const text =
        await response.text();


      let data:
        ApiResult | null =
        null;


      try {

        data =
          text
            ? JSON.parse(
                text
              ) as ApiResult
            : null;

      } catch {

        data =
          null;

      }


      const rateLimited =
        response.status ===
          429
        ||
        data?.wbStatus ===
          429
        ||
        data?.lastHttpStatus ===
          429
        ||
        data?.blockedByRateLimit ===
          true;


      if (rateLimited) {

        const nextAllowedAt =
          typeof data?.nextAllowedAt ===
            "string"

            ? data.nextAllowedAt

            : null;


        setRateState(
          current => ({
            ...current,

            lastHttpStatus:
              429,

            lastAttemptAt:
              new Date()
                .toISOString(),

            nextAllowedAt,

            retryAfterSeconds:
              typeof data?.retryAfterSeconds ===
                "number"

                ? data.retryAfterSeconds

                : typeof data?.retryAfterSecondsOriginally ===
                    "number"

                  ? data.retryAfterSecondsOriginally

                  : null,

            lastMessage:
              getResultMessage(
                data,
                "Лимит Wildberries"
              ),
          })
        );


        setMessage(
          getResultMessage(
            data,
            nextAllowedAt
              ? "Wildberries временно ограничил запрос"
              : "Wildberries ограничил запрос, но не сообщил время сброса лимита"
          )
        );


        setError(
          false
        );


        router.refresh();


        return;

      }


      if (
        !response.ok
        ||
        data?.ok ===
          false
      ) {

        setError(
          true
        );


        setMessage(
          getResultMessage(
            data,
            `Ошибка HTTP ${response.status}`
          )
        );


        router.refresh();


        return;

      }


      const successAt =
        data?.saved?.syncedAt
        ??
        data?.newSnapshot?.snapshotAt
        ??
        new Date().toISOString();


      setRateState(
        current => ({
          ...current,

          lastHttpStatus:
            data?.wildberries?.status
            ??
            200,

          lastAttemptAt:
            successAt,

          lastSuccessAt:
            successAt,

          nextAllowedAt:
            null,

          retryAfterSeconds:
            null,

          lastMessage:
            getResultMessage(
              data,
              "Синхронизация завершена"
            ),
        })
      );


      setMessage(
        getResultMessage(
          data,
          "Синхронизация завершена"
        )
      );


      router.refresh();

    } catch (
      syncError
    ) {

      setError(
        true
      );


      setMessage(
        syncError instanceof Error
          ? syncError.message
          : "Не удалось выполнить синхронизацию"
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  return (

    <div
      style={{
        display:
          "flex",

        flexDirection:
          "column",

        alignItems:
          "flex-end",

        gap:
          "8px",

        minWidth:
          "280px",
      }}
    >


      {/* ======================================
          СОСТОЯНИЕ ЛИМИТА
          ====================================== */}

      {
        activeKnownRateLimit
        &&
        (

          <div
            style={{
              width:
                "100%",

              padding:
                "10px 12px",

              borderRadius:
                "10px",

              background:
                "rgba(220, 70, 70, 0.10)",

              border:
                "1px solid rgba(220, 70, 70, 0.22)",

              textAlign:
                "right",
            }}
          >

            <div
              style={{
                fontWeight:
                  700,

                fontSize:
                  "13px",
              }}
            >
              🔴 Лимит Wildberries
            </div>


            <div
              className="muted"
              style={{
                marginTop:
                  "4px",
              }}
            >
              До следующей попытки:{" "}

              <strong>
                {
                  formatDuration(
                    secondsRemaining
                  )
                }
              </strong>
            </div>


            <div
              className="muted"
              style={{
                marginTop:
                  "2px",
              }}
            >
              Доступно с:{" "}

              {
                formatDateTime(
                  rateState.nextAllowedAt
                )
              }
            </div>

          </div>

        )
      }


      {
        unknownRateLimit
        &&
        (

          <div
            style={{
              width:
                "100%",

              padding:
                "10px 12px",

              borderRadius:
                "10px",

              background:
                "rgba(245, 158, 11, 0.10)",

              border:
                "1px solid rgba(245, 158, 11, 0.25)",

              textAlign:
                "right",
            }}
          >

            <div
              style={{
                fontWeight:
                  700,

                fontSize:
                  "13px",
              }}
            >
              🟠 Последний запрос получил лимит WB
            </div>


            <div
              className="muted"
              style={{
                marginTop:
                  "4px",
              }}
            >
              Wildberries не сообщил точное время сброса.
              Повторную попытку можно выполнить вручную.
            </div>

          </div>

        )
      }


      {
        !activeKnownRateLimit
        &&
        !unknownRateLimit
        &&
        (

          <div
            style={{
              width:
                "100%",

              textAlign:
                "right",

              fontSize:
                "13px",

              fontWeight:
                700,
            }}
          >
            🟢 Можно обновить сейчас
          </div>

        )
      }


      {
        rateState.lastSuccessAt
        &&
        (

          <div
            className="muted"
            style={{
              width:
                "100%",

              textAlign:
                "right",

              fontSize:
                "12px",
            }}
          >
            Последнее успешное обновление:{" "}
            {
              formatDateTime(
                rateState.lastSuccessAt
              )
            }
          </div>

        )
      }


      {/* ======================================
          КНОПКА
          ====================================== */}

      <button

        type="button"

        className=
          "primary-button"

        onClick={
          runSync
        }

        disabled={
          disabled
        }

        style={{
          opacity:
            disabled
              ? 0.55
              : 1,

          cursor:
            disabled
              ? "not-allowed"
              : "pointer",
        }}

      >

        {
          loading
            ? loadingLabel

            : activeKnownRateLimit
              ? `Лимит WB · ${formatDuration(
                  secondsRemaining
                )}`

              : label
        }

      </button>


      {/* ======================================
          РЕЗУЛЬТАТ ПОСЛЕДНЕГО НАЖАТИЯ
          ====================================== */}

      {
        message
        &&
        (

          <div
            className="muted"
            style={{
              maxWidth:
                "420px",

              textAlign:
                "right",

              color:
                error
                  ? "#b42318"
                  : undefined,
            }}
          >
            {message}
          </div>

        )
      }

    </div>

  );

}
