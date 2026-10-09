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
// ЛИМИТЫ НАШИХ ДВУХ КНОПОК
//
// ОСТАТКИ:
// используемый нами stocks-report
// минимальный интервал базового токена = 30 минут.
//
// ПРОДАЖИ:
// одна кнопка вызывает:
// /supplier/sales
// +
// /supplier/orders
//
// sales: 2 часа
// orders: 3 часа
//
// Поэтому вся кнопка снова доступна через 3 часа.
// ============================================================

const STOCKS_COOLDOWN_SECONDS =
  30
  *
  60;


const SALES_COOLDOWN_SECONDS =
  3
  *
  60
  *
  60;


// ============================================================
// ПОСЛЕ 07:00 ДАЁМ CRON 2 МИНУТЫ НА ЗАВЕРШЕНИЕ
// ============================================================

const DAILY_SYNC_GRACE_SECONDS =
  2
  *
  60;


// ============================================================
// КАКОЙ COOLDOWN У ЭТОЙ КНОПКИ
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

    return SALES_COOLDOWN_SECONDS;

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
// ФАКТИЧЕСКОЕ ВРЕМЯ СЛЕДУЮЩЕГО ЗАПРОСА
//
// Если WB уже сообщил next_allowed_at,
// мы его не затираем.
//
// Одновременно считаем окно от последнего
// успешного запроса.
//
// Выбираем более позднюю дату.
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
// БЛИЖАЙШИЕ 07:00 КРАСНОЯРСКА
//
// Красноярск UTC+7,
// поэтому 07:00 Красноярска = 00:00 UTC.
// ============================================================

function getNextDailySyncTimestamp(
  now:
    number
) {

  const date =
    new Date(
      now
    );


  let next =
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0
    );


  if (
    next <=
    now
  ) {

    next +=
      24
      *
      60
      *
      60
      *
      1000;

  }


  return next;

}


// ============================================================
// ПОСЛЕДНИЕ 07:00
// ============================================================

function getPreviousDailySyncTimestamp(
  now:
    number
) {

  const next =
    getNextDailySyncTimestamp(
      now
    );


  return (
    next
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
// ДАТА КРАСНОЯРСК
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
  // ОБНОВЛЕНИЕ ДАННЫХ ОТ SERVER COMPONENT
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
  // СЕКУНДНЫЙ ТАЙМЕР ДЛЯ COUNTDOWN
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
  // ПЕРИОДИЧЕСКИ ПЕРЕЧИТЫВАЕМ SUPABASE
  //
  // Это НЕ запрос к Wildberries.
  //
  // Нужно, чтобы уже открытая страница увидела,
  // что ежедневный cron в 07:00 закончил работу.
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
  // СОХРАНЁННЫЙ / РАССЧИТАННЫЙ RATE LIMIT
  // ==========================================================

  const nextAllowedTimestamp =
    useMemo(
      () => {

        return getTimestamp(
          rateState
            .nextAllowedAt
        );

      },
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


  // ==========================================================
  // 429 БЕЗ ТОЧНОГО ВРЕМЕНИ
  // ==========================================================

  const unknownRateLimit =
    rateState.lastHttpStatus ===
      429
    &&
    !activeKnownRateLimit
    &&
    !rateState.nextAllowedAt;


  // ==========================================================
  // РЕЗЕРВ ПЕРЕД ЕЖЕДНЕВНЫМ 07:00
  //
  // Это важно.
  //
  // Если дать нажать продажи, например, в 05:30,
  // трёхчасовой лимит не даст cron обновить данные в 07:00.
  //
  // Поэтому незадолго до ежедневного обновления
  // ручную кнопку резервируем.
  // ==========================================================

  const nextDailySyncTimestamp =
    getNextDailySyncTimestamp(
      now
    );


  const reservationStartTimestamp =
    nextDailySyncTimestamp
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
      nextDailySyncTimestamp;


  const secondsUntilDailySync =
    dailyReservationActive

      ?
      Math.ceil(
        (
          nextDailySyncTimestamp
          -
          now
        )
        /
        1000
      )

      :
      0;


  // ==========================================================
  // НЕБОЛЬШОЕ ОКНО СРАЗУ ПОСЛЕ 07:00
  //
  // Не даём человеку нажать кнопку буквально в ту же секунду,
  // пока cron ещё заканчивает запись в Supabase.
  // ==========================================================

  const previousDailySyncTimestamp =
    getPreviousDailySyncTimestamp(
      now
    );


  const secondsAfterDailySync =
    Math.floor(
      (
        now
        -
        previousDailySyncTimestamp
      )
      /
      1000
    );


  const dailySyncGraceActive =
    secondsAfterDailySync >=
      0
    &&
    secondsAfterDailySync <
      DAILY_SYNC_GRACE_SECONDS;


  // ==========================================================
  // DISABLED
  // ==========================================================

  const disabled =
    loading
    ||
    activeKnownRateLimit
    ||
    dailyReservationActive
    ||
    dailySyncGraceActive;


  // ==========================================================
  // RUN
  // ==========================================================

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
            ?
            JSON.parse(
              text
            ) as ApiResult

            :
            null;

      } catch {

        data =
          null;

      }


      // ======================================================
      // RATE LIMIT
      // ======================================================

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

        const serverNextAllowedAt =
          typeof data?.nextAllowedAt ===
            "string"

            ?
            data.nextAllowedAt

            :
            null;


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

            effectiveNextAllowedAt

              ?
              "Wildberries временно ограничил запрос"

              :
              "Wildberries ограничил запрос, но не сообщил точное время сброса"
          )
        );


        setError(
          false
        );


        router.refresh();


        return;

      }


      // ======================================================
      // ДРУГАЯ ОШИБКА
      // ======================================================

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


      // ======================================================
      // УСПЕХ
      // ======================================================

      const successAt =
        data?.saved
          ?.syncedAt
        ??
        data?.newSnapshot
          ?.snapshotAt
        ??
        new Date()
          .toISOString();


      // ======================================================
      // ЕСЛИ СЕРВЕР УЖЕ ВЕРНУЛ nextAllowedAt,
      // ИСПОЛЬЗУЕМ ЕГО.
      //
      // ИНАЧЕ СЧИТАЕМ ПО ЛИМИТУ МЕТОДА.
      // ======================================================

      const serverNextAllowedAt =
        typeof data?.nextAllowedAt ===
          "string"

          ?
          data.nextAllowedAt

          :
          null;


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

              ?
              cooldownSeconds

              :
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
  // UI
  // ==========================================================

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
          АКТИВНЫЙ ЛИМИТ
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
              className=
                "muted"

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
              className=
                "muted"

              style={{
                marginTop:
                  "2px",
              }}
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
      }


      {/* ======================================
          РЕЗЕРВ ПЕРЕД 07:00
          ====================================== */}

      {
        !activeKnownRateLimit
        &&
        dailyReservationActive
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
                "rgba(70, 110, 220, 0.10)",

              border:
                "1px solid rgba(70, 110, 220, 0.22)",

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
              🕖 Резерв для обновления в 07:00
            </div>


            <div
              className=
                "muted"

              style={{
                marginTop:
                  "4px",
              }}
            >
              До автоматического обновления:{" "}

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
                "muted"

              style={{
                marginTop:
                  "2px",
              }}
            >
              Кнопка временно отключена,
              чтобы ручной запрос не заблокировал
              утреннее обновление WB.
            </div>

          </div>

        )
      }


      {/* ======================================
          CRON СЕЙЧАС ВЫПОЛНЯЕТСЯ
          ====================================== */}

      {
        !activeKnownRateLimit
        &&
        !dailyReservationActive
        &&
        dailySyncGraceActive
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
                "rgba(70, 110, 220, 0.10)",

              border:
                "1px solid rgba(70, 110, 220, 0.22)",

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
              🔄 Автообновление WB
            </div>


            <div
              className=
                "muted"

              style={{
                marginTop:
                  "4px",
              }}
            >
              Получаем свежие данные после 07:00.
            </div>

          </div>

        )
      }


      {/* ======================================
          НЕИЗВЕСТНЫЙ 429
          ====================================== */}

      {
        !activeKnownRateLimit
        &&
        !dailyReservationActive
        &&
        !dailySyncGraceActive
        &&
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
              className=
                "muted"

              style={{
                marginTop:
                  "4px",
              }}
            >
              Wildberries не сообщил точное время сброса.
            </div>

          </div>

        )
      }


      {/* ======================================
          МОЖНО ОБНОВИТЬ
          ====================================== */}

      {
        !activeKnownRateLimit
        &&
        !dailyReservationActive
        &&
        !dailySyncGraceActive
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


      {/* ======================================
          ПОСЛЕДНИЙ УСПЕХ
          ====================================== */}

      {
        rateState
          .lastSuccessAt
        &&
        (

          <div
            className=
              "muted"

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
                rateState
                  .lastSuccessAt
              )
            }
          </div>

        )
      }


      {/* ======================================
          BUTTON
          ====================================== */}

      <button

        type=
          "button"

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
              ?
              0.55
              :
              1,

          cursor:
            disabled
              ?
              "not-allowed"
              :
              "pointer",
        }}

      >

        {
          loading

            ?
            loadingLabel

            :
            activeKnownRateLimit

              ?
              `Лимит WB · ${formatDuration(
                secondsRemaining
              )}`

              :
              dailyReservationActive

                ?
                "Автообновление в 07:00"

                :
                dailySyncGraceActive

                  ?
                  "Обновляем автоматически..."

                  :
                  label
        }

      </button>


      {/* ======================================
          MESSAGE
          ====================================== */}

      {
        message
        &&
        (

          <div
            className=
              "muted"

            style={{
              maxWidth:
                "420px",

              textAlign:
                "right",

              color:
                error
                  ?
                  "#b42318"
                  :
                  undefined,
            }}
          >
            {message}
          </div>

        )
      }

    </div>

  );

}
