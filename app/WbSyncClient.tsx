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
// ТИПЫ
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
// ЛИМИТЫ WB
//
// ВАЖНО:
//
// Остатки:
// /api/v2/stocks-report/products/products
// базовый токен:
// 2 запроса / час
// интервал 30 минут
//
// Продажи:
// /api/v1/supplier/sales
//
// Отмены:
// /api/v1/supplier/orders
//
// Для базового токена:
// 1 запрос / 2 часа.
//
// Кнопка "Продажи" вызывает ОБА метода,
// поэтому после успешного обновления
// блокируем её на 2 часа.
//
// Если WB реально вернул 429 и сообщил
// более позднее время, оно имеет приоритет.
// ============================================================

const STOCKS_COOLDOWN_SECONDS =
  30 * 60;


const SALES_COOLDOWN_SECONDS =
  2 * 60 * 60;


// ============================================================
// ОПРЕДЕЛЯЕМ ЛИМИТ ДЛЯ КНОПКИ
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
// ISO DATE HELPERS
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


  if (
    !Number.isFinite(
      timestamp
    )
  ) {

    return null;

  }


  return timestamp;

}


function addSecondsToIso(
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
    seconds <= 0
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
// БЕРЁМ БОЛЕЕ ПОЗДНЕЕ ВРЕМЯ
// ============================================================

function getLaterIsoDate(
  first:
    string | null | undefined,

  second:
    string | null | undefined
):
string | null {

  const firstTimestamp =
    getTimestamp(
      first
    );


  const secondTimestamp =
    getTimestamp(
      second
    );


  if (
    firstTimestamp ===
      null
    &&
    secondTimestamp ===
      null
  ) {

    return null;

  }


  if (
    firstTimestamp ===
      null
  ) {

    return second
      ??
      null;

  }


  if (
    secondTimestamp ===
      null
  ) {

    return first
      ??
      null;

  }


  return firstTimestamp >=
    secondTimestamp

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
// РАСЧЁТ ФАКТИЧЕСКОГО NEXT_ALLOWED_AT
//
// 1. Берём сохранённое время WB, если оно есть.
//
// 2. Считаем минимально разрешённое время
//    от последнего успешного запроса.
//
// 3. Используем БОЛЕЕ ПОЗДНЕЕ.
//
// Это защищает от ситуации:
//
// наш расчёт: 10:00
// WB после 429 сказал: 10:37
//
// → кнопка откроется в 10:37.
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


  const calculatedFromSuccess =
    addSecondsToIso(
      state?.lastSuccessAt,
      cooldownSeconds
    );


  return getLaterIsoDate(
    state?.nextAllowedAt,
    calculatedFromSuccess
  );

}


// ============================================================
// СООБЩЕНИЕ API
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


// ============================================================
// ДАТА / ВРЕМЯ ПО КРАСНОЯРСКУ
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


  // ==========================================================
  // LOCAL STATE
  // ==========================================================

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
    useState<SyncState>(() => {

      return {

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
          getEffectiveNextAllowedAt(
            initialState,
            endpoint
          ),

        retryAfterSeconds:
          initialState?.retryAfterSeconds
          ??
          null,

        lastMessage:
          initialState?.lastMessage
          ??
          null,

      };

    });


  // ==========================================================
  // КОГДА SERVER COMPONENT ОБНОВИЛ ДАННЫЕ
  // ==========================================================

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
          getEffectiveNextAllowedAt(
            initialState,
            endpoint
          ),

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
  // ТАЙМЕР
  //
  // Благодаря ему страницу не надо перезагружать.
  // Когда лимит истекает, кнопка сама становится доступной.
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
  // TIMESTAMP СЛЕДУЮЩЕЙ ПОПЫТКИ
  // ==========================================================

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


  // ==========================================================
  // СКОЛЬКО ОСТАЛОСЬ
  // ==========================================================

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
  // 429 БЕЗ ВРЕМЕНИ
  //
  // Редкий случай, когда WB сказал "нельзя",
  // но не сказал "когда можно".
  // ==========================================================

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


  // ==========================================================
  // НАЖАТИЕ НА КНОПКУ
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
      // ПРОВЕРЯЕМ, БЫЛ ЛИ RATE LIMIT
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

        // ====================================================
        // ВРЕМЯ, КОТОРОЕ СООБЩИЛ WB / SERVER
        // ====================================================

        const serverNextAllowedAt =
          typeof data?.nextAllowedAt ===
            "string"

            ?
            data.nextAllowedAt

            :
            null;


        // ====================================================
        // НАШ РАСЧЁТ ОТ ПОСЛЕДНЕГО УСПЕХА
        // ====================================================

        const calculatedNextAllowedAt =
          addSecondsToIso(
            rateState.lastSuccessAt,
            cooldownSeconds
          );


        // ====================================================
        // БЕРЁМ БОЛЕЕ ПОЗДНЕЕ
        // ====================================================

        const effectiveNextAllowedAt =
          getLaterIsoDate(
            serverNextAllowedAt,
            calculatedNextAllowedAt
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
              typeof data?.retryAfterSeconds ===
                "number"

                ?
                data.retryAfterSeconds

                :
                typeof data?.retryAfterSecondsOriginally ===
                    "number"

                  ?
                  data.retryAfterSecondsOriginally

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
              "Wildberries ограничил запрос, но не сообщил время сброса лимита"
          )
        );


        setError(
          false
        );


        router.refresh();


        return;

      }


      // ======================================================
      // ОБЫЧНАЯ ОШИБКА
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
      // УСПЕШНАЯ СИНХРОНИЗАЦИЯ
      // ======================================================

      const successAt =
        data?.saved?.syncedAt
        ??
        data?.newSnapshot?.snapshotAt
        ??
        new Date().toISOString();


      // ======================================================
      // ПОСЛЕ УСПЕХА СРАЗУ РАССЧИТЫВАЕМ,
      // КОГДА МОЖНО НАЖАТЬ ЕЩЁ РАЗ.
      //
      // Раньше здесь было nextAllowedAt: null.
      // Поэтому интерфейс после успеха мог сразу писать,
      // что кнопку снова можно нажимать.
      // ======================================================

      const calculatedNextAllowedAt =
        addSecondsToIso(
          successAt,
          cooldownSeconds
        );


      setRateState(
        current => ({

          ...current,

          lastHttpStatus:
            data?.wildberries?.status
            ??
            data?.wildberries?.salesStatus
            ??
            data?.wildberries?.ordersStatus
            ??
            200,

          lastAttemptAt:
            successAt,

          lastSuccessAt:
            successAt,

          nextAllowedAt:
            calculatedNextAllowedAt,

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
              className=
                "muted"

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
              label
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
