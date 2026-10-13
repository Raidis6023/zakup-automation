"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


// ============================================================
// TYPES
// ============================================================

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

    salesStatus?:
      number;

    ordersStatus?:
      number;

  };

};


// ============================================================
// ЛИМИТЫ
// ============================================================

const STOCKS_COOLDOWN_SECONDS =
  30
  *
  60;


const CANCELLATIONS_COOLDOWN_SECONDS =
  3
  *
  60
  *
  60;


const DAILY_SYNC_WINDOW_START_UTC_HOUR =
  22;


const DAILY_SYNC_WINDOW_SECONDS =
  60
  *
  60;


const DAILY_SYNC_GRACE_SECONDS =
  2
  *
  60;


// ============================================================
// COOLDOWN
// ============================================================

function getCooldownSeconds(
  endpoint:
    string
) {

  if (
    endpoint.startsWith(
      "/api/wb/sync-stocks"
    )
  ) {

    return STOCKS_COOLDOWN_SECONDS;

  }


  if (
    endpoint.startsWith(
      "/api/wb/sync-orders"
    )
  ) {

    return CANCELLATIONS_COOLDOWN_SECONDS;

  }


  return 0;

}


// ============================================================
// TIMESTAMP
// ============================================================

function getTimestamp(
  value:
    string | null | undefined
):
number | null {

  if (!value) {

    return null;

  }


  const result =
    new Date(
      value
    ).getTime();


  if (
    !Number.isFinite(
      result
    )
  ) {

    return null;

  }


  return result;

}


// ============================================================
// + СЕКУНДЫ
// ============================================================

function addSeconds(
  value:
    string | null | undefined,

  seconds:
    number
):
string | null {

  const timestamp =
    getTimestamp(
      value
    );


  if (
    timestamp ===
      null
    ||
    seconds <=
      0
  ) {

    return null;

  }


  return new Date(
    timestamp
    +
    seconds
    *
    1000
  ).toISOString();

}


// ============================================================
// БОЛЕЕ ПОЗДНЯЯ ДАТА
// ============================================================

function laterDate(
  first:
    string | null | undefined,

  second:
    string | null | undefined
):
string | null {

  const firstTime =
    getTimestamp(
      first
    );


  const secondTime =
    getTimestamp(
      second
    );


  if (
    firstTime ===
      null
    &&
    secondTime ===
      null
  ) {

    return null;

  }


  if (
    firstTime ===
      null
  ) {

    return second
      ??
      null;

  }


  if (
    secondTime ===
      null
  ) {

    return first
      ??
      null;

  }


  return firstTime >=
    secondTime

    ?
    first
    ??
    null

    :
    second
    ??
    null;

}


// ============================================================
// NEXT ALLOWED
// ============================================================

function getEffectiveNextAllowedAt(
  state:
    SyncState | null | undefined,

  endpoint:
    string
):
string | null {

  const cooldownSeconds =
    getCooldownSeconds(
      endpoint
    );


  const calculated =
    addSeconds(
      state?.lastSuccessAt,
      cooldownSeconds
    );


  return laterDate(
    state?.nextAllowedAt,
    calculated
  );

}


// ============================================================
// ОКНО ЕЖЕДНЕВНОЙ СИНХРОНИЗАЦИИ
//
// Vercel Hobby запускает cron с расписанием 22:00 UTC
// в гибком часовом окне.
// Для Красноярска это примерно 05:00–06:00.
// ============================================================

function getDailySyncWindowStartTimestamp(
  now:
    number
) {

  const date =
    new Date(
      now
    );


  let start =
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      DAILY_SYNC_WINDOW_START_UTC_HOUR,
      0,
      0,
      0
    );


  const end =
    start
    +
    DAILY_SYNC_WINDOW_SECONDS
    *
    1000
    +
    DAILY_SYNC_GRACE_SECONDS
    *
    1000;


  if (
    now >=
      end
  ) {

    start +=
      24
      *
      60
      *
      60
      *
      1000;

  }


  return start;

}


// ============================================================
// HH:MM:SS
// ============================================================

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
      safe
      /
      3600
    );


  const minutes =
    Math.floor(
      (
        safe
        %
        3600
      )
      /
      60
    );


  const seconds =
    safe
    %
    60;


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


// ============================================================
// ДАТА
// ============================================================

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


// ============================================================
// API MESSAGE
// ============================================================

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


// ============================================================
// COMPONENT
// ============================================================

export default function WbSyncClient({
  endpoint,
  label,
  loadingLabel,
  initialState,
}: Props) {

  const router =
    useRouter();


  const cooldownSeconds =
    useMemo(
      () =>
        getCooldownSeconds(
          endpoint
        ),
      [
        endpoint,
      ]
    );


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
    useState<SyncState>(
      () => ({

        lastHttpStatus:
          initialState
            ?.lastHttpStatus
          ??
          null,

        lastAttemptAt:
          initialState
            ?.lastAttemptAt
          ??
          null,

        lastSuccessAt:
          initialState
            ?.lastSuccessAt
          ??
          null,

        nextAllowedAt:
          getEffectiveNextAllowedAt(
            initialState,
            endpoint
          ),

        retryAfterSeconds:
          initialState
            ?.retryAfterSeconds
          ??
          null,

        lastMessage:
          initialState
            ?.lastMessage
          ??
          null,

      })
    );


  // ==========================================================
  // SERVER STATE
  // ==========================================================

  useEffect(
    () => {

      setRateState({

        lastHttpStatus:
          initialState
            ?.lastHttpStatus
          ??
          null,

        lastAttemptAt:
          initialState
            ?.lastAttemptAt
          ??
          null,

        lastSuccessAt:
          initialState
            ?.lastSuccessAt
          ??
          null,

        nextAllowedAt:
          getEffectiveNextAllowedAt(
            initialState,
            endpoint
          ),

        retryAfterSeconds:
          initialState
            ?.retryAfterSeconds
          ??
          null,

        lastMessage:
          initialState
            ?.lastMessage
          ??
          null,

      });

    },
    [
      endpoint,
      initialState?.lastHttpStatus,
      initialState?.lastAttemptAt,
      initialState?.lastSuccessAt,
      initialState?.nextAllowedAt,
      initialState?.retryAfterSeconds,
      initialState?.lastMessage,
    ]
  );


  // ==========================================================
  // COUNTDOWN
  // ==========================================================

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


  // ==========================================================
  // REFRESH SUPABASE STATE
  // ==========================================================

  useEffect(
    () => {

      const timer =
        window.setInterval(
          () => {

            router.refresh();

          },
          60
          *
          1000
        );


      return () => {

        window.clearInterval(
          timer
        );

      };

    },
    [
      router,
    ]
  );


  // ==========================================================
  // RATE LIMIT
  // ==========================================================

  const nextAllowedTimestamp =
    useMemo(
      () =>
        getTimestamp(
          rateState
            .nextAllowedAt
        ),
      [
        rateState
          .nextAllowedAt,
      ]
    );


  const secondsRemaining =
    nextAllowedTimestamp
    &&
    nextAllowedTimestamp >
      now

      ?
      Math.ceil(
        (
          nextAllowedTimestamp
          -
          now
        )
        /
        1000
      )

      :
      0;


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


  // ==========================================================
  // DAILY AUTO-SYNC WINDOW
  // ==========================================================

  const dailySyncWindowStartTimestamp =
    getDailySyncWindowStartTimestamp(
      now
    );


  const dailySyncWindowEndTimestamp =
    dailySyncWindowStartTimestamp
    +
    DAILY_SYNC_WINDOW_SECONDS
    *
    1000
    +
    DAILY_SYNC_GRACE_SECONDS
    *
    1000;


  const reservationStartTimestamp =
    dailySyncWindowStartTimestamp
    -
    cooldownSeconds
    *
    1000;


  const dailyReservationActive =
    cooldownSeconds >
      0
    &&
    now >=
      reservationStartTimestamp
    &&
    now <
      dailySyncWindowStartTimestamp;


  const secondsUntilDailySync =
    dailyReservationActive

      ?
      Math.ceil(
        (
          dailySyncWindowStartTimestamp
          -
          now
        )
        /
        1000
      )

      :
      0;


  const lastSuccessTimestamp =
    getTimestamp(
      rateState
        .lastSuccessAt
    );


  const completedInCurrentWindow =
    lastSuccessTimestamp !==
      null
    &&
    lastSuccessTimestamp >=
      dailySyncWindowStartTimestamp;


  const dailySyncWindowActive =
    now >=
      dailySyncWindowStartTimestamp
    &&
    now <
      dailySyncWindowEndTimestamp
    &&
    !completedInCurrentWindow;


  const disabled =
    loading
    ||
    activeKnownRateLimit
    ||
    dailyReservationActive
    ||
    dailySyncWindowActive;


  // ==========================================================
  // RUN
  // ==========================================================

  async function runSync() {

    if (
      disabled
    ) {

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
              ) as
                ApiResult

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


      if (
        rateLimited
      ) {

        const serverNextAllowedAt =
          typeof data?.nextAllowedAt ===
            "string"

            ? data.nextAllowedAt

            : null;


        const calculatedFromLastSuccess =
          addSeconds(
            rateState
              .lastSuccessAt,

            cooldownSeconds
          );


        const effectiveNextAllowedAt =
          laterDate(
            serverNextAllowedAt,
            calculatedFromLastSuccess
          );


        setRateState(
          current => ({

            ...current,

            lastHttpStatus:
              429,

            lastAttemptAt:
              new Date()
                .toISOString(),

            nextAllowedAt:
              effectiveNextAllowedAt,

            retryAfterSeconds:
              typeof data
                ?.retryAfterSeconds ===
                "number"

                ? data.retryAfterSeconds

                : typeof data
                    ?.retryAfterSecondsOriginally ===
                    "number"

                  ? data
                      .retryAfterSecondsOriginally

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

            effectiveNextAllowedAt

              ? "Wildberries временно ограничил запрос"

              : "Wildberries ограничил запрос, но не сообщил точное время сброса"
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
        data?.saved
          ?.syncedAt
        ??
        data?.newSnapshot
          ?.snapshotAt
        ??
        new Date()
          .toISOString();


      const serverNextAllowedAt =
        typeof data?.nextAllowedAt ===
          "string"

          ? data.nextAllowedAt

          : null;


      const calculatedNextAllowedAt =
        addSeconds(
          successAt,
          cooldownSeconds
        );


      const effectiveNextAllowedAt =
        laterDate(
          serverNextAllowedAt,
          calculatedNextAllowedAt
        );


      setRateState(
        current => ({

          ...current,

          lastHttpStatus:
            data?.wildberries
              ?.status
            ??
            data?.wildberries
              ?.salesStatus
            ??
            data?.wildberries
              ?.ordersStatus
            ??
            200,

          lastAttemptAt:
            successAt,

          lastSuccessAt:
            successAt,

          nextAllowedAt:
            effectiveNextAllowedAt,

          retryAfterSeconds:
            cooldownSeconds >
              0

              ? cooldownSeconds

              : null,

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
      className=
        "wb-sync-client"
    >

      {
        activeKnownRateLimit

          ? (

            <div
              className=
                "wb-sync-state-box wb-sync-state-box--danger"
            >

              <div
                className=
                  "wb-sync-state-title"
              >
                Лимит Wildberries
              </div>


              <div
                className=
                  "wb-sync-state-text"
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
                className=
                  "wb-sync-state-text"
              >
                Доступно с:{" "}

                {
                  formatDateTime(
                    rateState
                      .nextAllowedAt
                  )
                }
              </div>

            </div>

          )

          : null
      }


      {
        !activeKnownRateLimit
        &&
        dailyReservationActive

          ? (

            <div
              className=
                "wb-sync-state-box wb-sync-state-box--info"
            >

              <div
                className=
                  "wb-sync-state-title"
              >
                Резерв для утреннего автообновления
              </div>


              <div
                className=
                  "wb-sync-state-text"
              >
                До начала окна автообновления:{" "}

                <strong>
                  {
                    formatDuration(
                      secondsUntilDailySync
                    )
                  }
                </strong>
              </div>


              <div
                className=
                  "wb-sync-state-text"
              >
                Ручной запрос временно отключён,
                чтобы не занять лимит перед
                автоматическим обновлением WB.
              </div>

            </div>

          )

          : null
      }


      {
        !activeKnownRateLimit
        &&
        !dailyReservationActive
        &&
        dailySyncWindowActive

          ? (

            <div
              className=
                "wb-sync-state-box wb-sync-state-box--info"
            >

              <div
                className=
                  "wb-sync-state-title"
              >
                Автообновление WB
              </div>


              <div
                className=
                  "wb-sync-state-text"
              >
                Автообновление выполняется в окне 05:00–06:00 по Красноярску.
              </div>

            </div>

          )

          : null
      }


      {
        !activeKnownRateLimit
        &&
        !dailyReservationActive
        &&
        !dailySyncWindowActive
        &&
        unknownRateLimit

          ? (

            <div
              className=
                "wb-sync-state-box wb-sync-state-box--warning"
            >

              <div
                className=
                  "wb-sync-state-title"
              >
                Последний запрос получил лимит WB
              </div>


              <div
                className=
                  "wb-sync-state-text"
              >
                Wildberries не сообщил точное время сброса.
              </div>

            </div>

          )

          : null
      }


      {
        !activeKnownRateLimit
        &&
        !dailyReservationActive
        &&
        !dailySyncWindowActive
        &&
        !unknownRateLimit

          ? (

            <div
              className=
                "wb-sync-ready"
            >
              ● Можно обновить сейчас
            </div>

          )

          : null
      }


      {
        rateState
          .lastSuccessAt

          ? (

            <div
              className=
                "muted wb-sync-last-success"
            >
              Последнее успешное обновление:{" "}

              {
                formatDateTime(
                  rateState
                    .lastSuccessAt
                )
              }
            </div>

          )

          : null
      }


      <button
        type="button"

        className=
          "primary-button wb-sync-button"

        onClick={
          runSync
        }

        disabled={
          disabled
        }
      >

        {
          loading

            ? loadingLabel

            : activeKnownRateLimit

              ? `Лимит WB · ${formatDuration(
                  secondsRemaining
                )}`

              : dailyReservationActive

                ? "Резерв для автообновления"

                : dailySyncWindowActive

                  ? "Автообновление WB..."

                  : label
        }

      </button>


      {
        message

          ? (

            <div
              className={
                error

                  ? "wb-sync-message wb-sync-message--error"

                  : "wb-sync-message"
              }
            >
              {
                message
              }
            </div>

          )

          : null
      }

    </div>

  );

}
