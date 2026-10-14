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


// ============================================================
// ЕДИНЫЙ ЛИМИТ РУЧНОЙ КНОПКИ
// ============================================================

const WB_COOLDOWN_SECONDS =
  30 * 60;


// ============================================================
// УТРЕННИЙ CRON
// ============================================================

const DAILY_SYNC_UTC_HOUR =
  22;

const DAILY_SYNC_WINDOW_SECONDS =
  60 * 60;

const DAILY_SYNC_GRACE_SECONDS =
  5 * 60;


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


  const timestamp =
    new Date(
      value
    ).getTime();


  return Number.isFinite(
    timestamp
  )
    ?
    timestamp
    :
    null;

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
// EFFECTIVE NEXT ALLOWED
// ============================================================

function getEffectiveNextAllowedAt(
  state:
    SyncState | null | undefined
):
string | null {

  return laterDate(

    state
      ?.nextAllowedAt,

    addSeconds(
      state
        ?.lastSuccessAt,
      WB_COOLDOWN_SECONDS
    )

  );

}


// ============================================================
// БЛИЖАЙШИЙ CRON
// ============================================================

function getNextDailySyncStart(
  now:
    number
):
number {

  const date =
    new Date(
      now
    );


  let result =
    Date.UTC(

      date.getUTCFullYear(),

      date.getUTCMonth(),

      date.getUTCDate(),

      DAILY_SYNC_UTC_HOUR,

      0,

      0,

      0

    );


  if (
    result <=
    now
  ) {

    result +=
      24
      *
      60
      *
      60
      *
      1000;

  }


  return result;

}


// ============================================================
// ПРЕДЫДУЩИЙ CRON
// ============================================================

function getPreviousDailySyncStart(
  now:
    number
):
number {

  return (
    getNextDailySyncStart(
      now
    )
    -
    24
    *
    60
    *
    60
    *
    1000
  );

}


// ============================================================
// HH:MM:SS
// ============================================================

function formatDuration(
  totalSeconds:
    number
):
string {

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
    hours,
    minutes,
    seconds,
  ]
    .map(
      value =>
        String(
          value
        ).padStart(
          2,
          "0"
        )
    )
    .join(
      ":"
    );

}


// ============================================================
// ВРЕМЯ ДОСТУПНОСТИ ПО КРАСНОЯРСКУ
// ============================================================

function formatKrasnoyarskTime(
  value:
    string | null | undefined
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
// MESSAGE
// ============================================================

function getResultMessage(
  data:
    ApiResult | null,

  fallback:
    string
):
string {

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
            initialState
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
  // ПОДТЯГИВАЕМ SERVER STATE
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
            initialState
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

      initialState
        ?.lastHttpStatus,

      initialState
        ?.lastAttemptAt,

      initialState
        ?.lastSuccessAt,

      initialState
        ?.nextAllowedAt,

      initialState
        ?.retryAfterSeconds,

      initialState
        ?.lastMessage,

    ]
  );


  // ==========================================================
  // СЕКУНДНЫЙ ТАЙМЕР
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
  // РАЗ В МИНУТУ ОБНОВЛЯЕМ SERVER COMPONENT
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
  // 30-МИНУТНЫЙ ЛИМИТ
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
    rateState
      .lastHttpStatus
    ===
    429
    &&
    !activeKnownRateLimit
    &&
    !rateState
      .nextAllowedAt;


  // ==========================================================
  // РЕЗЕРВ ПЕРЕД УТРЕННИМ CRON
  // ==========================================================

  const nextDailyStart =
    getNextDailySyncStart(
      now
    );


  const previousDailyStart =
    getPreviousDailySyncStart(
      now
    );


  const reservationStart =
    nextDailyStart
    -
    WB_COOLDOWN_SECONDS
    *
    1000;


  const currentWindowEnd =
    previousDailyStart
    +
    (
      DAILY_SYNC_WINDOW_SECONDS
      +
      DAILY_SYNC_GRACE_SECONDS
    )
    *
    1000;


  const beforeDailySyncReservation =
    now >=
      reservationStart
    &&
    now <
      nextDailyStart;


  const dailySyncWindowActive =
    now >=
      previousDailyStart
    &&
    now <
      currentWindowEnd;


  const dailyReservationActive =
    beforeDailySyncReservation
    ||
    dailySyncWindowActive;


  const secondsUntilDailySync =
    beforeDailySyncReservation

      ?
      Math.ceil(
        (
          nextDailyStart
          -
          now
        )
        /
        1000
      )

      :
      0;


  // ==========================================================
  // КНОПКА DISABLED
  // ==========================================================

  const disabled =
    loading
    ||
    activeKnownRateLimit
    ||
    unknownRateLimit
    ||
    dailyReservationActive;


  // ==========================================================
  // ТЕКСТ НАД КНОПКОЙ
  // ==========================================================

  let topMessage =
    message;


  let topMessageClass =
    "wb-sync-hero-message-slot";


  if (
    error
  ) {

    topMessageClass +=
      " wb-sync-hero-message-slot--error";

  } else if (
    activeKnownRateLimit
    ||
    unknownRateLimit
  ) {

    topMessageClass +=
      " wb-sync-hero-message-slot--neutral";

  } else if (
    message
  ) {

    topMessageClass +=
      " wb-sync-hero-message-slot--success";

  }


  // ==========================================================
  // ТЕКСТ ПОД КНОПКОЙ
  // ==========================================================

  let bottomNote =
    "";


  if (
    loading
  ) {

    bottomNote =
      "Получаем свежие данные Wildberries…";

  } else if (
    activeKnownRateLimit
  ) {

    bottomNote =
      `Доступно с ${formatKrasnoyarskTime(
        rateState.nextAllowedAt
      )}`;

  } else if (
    beforeDailySyncReservation
  ) {

    bottomNote =
      "Ручное обновление временно недоступно";

  } else if (
    dailySyncWindowActive
  ) {

    bottomNote =
      "Идёт утреннее автообновление WB";

  } else if (
    unknownRateLimit
  ) {

    bottomNote =
      "Время сброса лимита WB не получено";

  }


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

            ?
            JSON.parse(
              text
            ) as
              ApiResult

            :
            null;

      } catch {

        data =
          null;

      }


      const rateLimited =
        response.status ===
          429
        ||
        data
          ?.wbStatus ===
          429
        ||
        data
          ?.lastHttpStatus ===
          429
        ||
        data
          ?.blockedByRateLimit ===
          true;


      // ======================================================
      // 429 / RATE LIMIT
      // ======================================================

      if (
        rateLimited
      ) {

        const serverNextAllowedAt =
          typeof data
            ?.nextAllowedAt ===
            "string"

            ?
            data.nextAllowedAt

            :
            null;


        const effectiveNextAllowedAt =
          laterDate(

            serverNextAllowedAt,

            addSeconds(

              rateState
                .lastSuccessAt,

              WB_COOLDOWN_SECONDS

            )

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

                ?
                data.retryAfterSeconds

                :
                typeof data
                  ?.retryAfterSecondsOriginally ===
                  "number"

                  ?
                  data
                    .retryAfterSecondsOriginally

                  :
                  null,

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
            "Wildberries временно ограничил запрос"
          )
        );


        setError(
          false
        );


        router.refresh();


        return;

      }


      // ======================================================
      // ПРОЧАЯ ОШИБКА
      // ======================================================

      if (
        !response.ok
        ||
        data
          ?.ok ===
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


      // ======================================================
      // SUCCESS
      // ======================================================

      const successAt =
        data
          ?.saved
          ?.syncedAt
        ??
        data
          ?.newSnapshot
          ?.snapshotAt
        ??
        new Date()
          .toISOString();


      const serverNextAllowedAt =
        typeof data
          ?.nextAllowedAt ===
          "string"

          ?
          data.nextAllowedAt

          :
          null;


      const effectiveNextAllowedAt =
        laterDate(

          serverNextAllowedAt,

          addSeconds(
            successAt,
            WB_COOLDOWN_SECONDS
          )

        );


      setRateState(
        current => ({

          ...current,

          lastHttpStatus:
            data
              ?.wildberries
              ?.status
            ??
            200,

          lastAttemptAt:
            successAt,

          lastSuccessAt:
            successAt,

          nextAllowedAt:
            effectiveNextAllowedAt,

          retryAfterSeconds:
            WB_COOLDOWN_SECONDS,

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

          ?
          syncError.message

          :
          "Не удалось выполнить синхронизацию"
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div
      className="wb-sync-client wb-sync-client--hero"
    >

      {/* ======================================================
          ВЕРХНЯЯ СТРОКА
          Всегда занимает одно и то же место.
          Поэтому кнопка больше не прыгает.
          ====================================================== */}

      <div
        className={
          topMessageClass
        }

        title={
          topMessage
          ||
          undefined
        }
      >

        {
          topMessage
          ||
          "\u00A0"
        }

      </div>


      {/* ======================================================
          КНОПКА
          Всегда стоит в средней строке.
          ====================================================== */}

      <button
        type="button"

        className="wb-sync-hero-button"

        onClick={
          runSync
        }

        disabled={
          disabled
        }

        aria-disabled={
          disabled
        }
      >

        <span
          className={
            loading

              ?
              "wb-sync-hero-button__icon wb-sync-hero-button__icon--spinning"

              :
              "wb-sync-hero-button__icon"
          }

          aria-hidden="true"
        >

          <svg
            viewBox="0 0 24 24"
          >

            <path
              d="M20 11a8 8 0 1 0-2.35 5.65"
            />

            <path
              d="M20 4v7h-7"
            />

          </svg>

        </span>


        <span>

          {
            loading

              ?
              loadingLabel

              :
              activeKnownRateLimit

                ?
                formatDuration(
                  secondsRemaining
                )

                :
                beforeDailySyncReservation

                  ?
                  `Автообновление через ${formatDuration(
                    secondsUntilDailySync
                  )}`

                  :
                  dailySyncWindowActive

                    ?
                    "Автообновление..."

                    :
                    unknownRateLimit

                      ?
                      "Лимит WB"

                      :
                      label
          }

        </span>

      </button>


      {/* ======================================================
          НИЖНЯЯ СТРОКА
          Всегда зарезервирована под "Доступно с..."
          ====================================================== */}

      <div
        className={
          activeKnownRateLimit

            ?
            "wb-sync-hero-note-slot wb-sync-hero-note-slot--limit"

            :
            loading

              ?
              "wb-sync-hero-note-slot wb-sync-hero-note-slot--active"

              :
              "wb-sync-hero-note-slot"
        }
      >

        {
          bottomNote
          ||
          "\u00A0"
        }

      </div>

    </div>

  );

}
