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
// ОБЩЕЕ СОСТОЯНИЕ СИНХРОНИЗАЦИИ
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


type SyncStateResponse = {
  ok?:
    boolean;

  error?:
    string;

  stocks?:
    SyncState;

  sales?:
    SyncState;
};


// ============================================================
// ОСТАТКИ
// ============================================================

type StockSyncResult = {
  ok:
    boolean;

  blockedByRateLimit?:
    boolean;

  message?:
    string;

  snapshotDate?:
    string;

  error?:
    string;

  lastHttpStatus?:
    number | null;

  lastAttemptAt?:
    string | null;

  lastSuccessAt?:
    string | null;

  nextAllowedAt?:
    string | null;

  retryAfterSeconds?:
    number | null;

  ozon?: {
    reportedTotalProducts:
      number | null;

    productsReceived:
      number;

    uniqueOffers:
      number;

    fboSkuCount:
      number;

    analyticsRequests:
      number;

    analyticsRows:
      number;

    uniqueClusters:
      number;

    clusterRowsPrepared:
      number;
  };

  supabase?: {
    ok?:
      boolean;

    sync_run_id?:
      string;

    snapshot_date?:
      string;

    products_received?:
      number;

    fbo_skus_received?:
      number;

    analytics_rows_received?:
      number;

    cluster_rows_saved?:
      number;
  };
};


// ============================================================
// ПРОДАЖИ
// ============================================================

type SalesSyncResult = {
  ok:
    boolean;

  blockedByRateLimit?:
    boolean;

  message?:
    string;

  error?:
    string;

  lastHttpStatus?:
    number | null;

  lastAttemptAt?:
    string | null;

  lastSuccessAt?:
    string | null;

  nextAllowedAt?:
    string | null;

  retryAfterSeconds?:
    number | null;

  period?: {
    completedDays:
      number;

    timezone:
      string;

    dateFrom:
      string;

    dateTo:
      string;
  };

  ozon?: {
    postingsReceived:
      number;

    uniquePostings:
      number;

    cancelledPostings:
      number;

    statusCounts:
      Record<string, number>;

    uniqueProducts:
      number;

    uniqueClusters:
      number;

    aggregatedRows:
      number;

    salesQuantityExcludingCancelled:
      number;

    cancelledQuantity:
      number;
  };

  supabase?: {
    ok?:
      boolean;

    sync_run_id?:
      string;

    date_from?:
      string;

    date_to?:
      string;

    completed_days?:
      number;

    postings_received?:
      number;

    cancelled_postings?:
      number;

    aggregated_rows_saved?:
      number;
  };
};


// ============================================================
// ПРОЧЕЕ
// ============================================================

type SyncKind =
  | "stocks"
  | "sales";


const EMPTY_SYNC_STATE:
  SyncState =
{
  lastHttpStatus:
    null,

  lastAttemptAt:
    null,

  lastSuccessAt:
    null,

  nextAllowedAt:
    null,

  retryAfterSeconds:
    null,

  lastMessage:
    null,
};


// ============================================================
// ПОСЛЕ 07:00 ДАЁМ DAILY-SYNC 2 МИНУТЫ
// ============================================================

const DAILY_SYNC_GRACE_SECONDS =
  2
  *
  60;


// ============================================================
// ФОРМАТ ЧИСЛА
// ============================================================

function formatNumber(
  value:
    | number
    | null
    | undefined
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  return Number(
    value
  ).toLocaleString(
    "ru-RU"
  );

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
// КРАСНОЯРСКОЕ ВРЕМЯ
// ============================================================

function formatDateTime(
  value:
    string | null | undefined
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
// ПОСЛЕДНИЕ 07:00 КРАСНОЯРСКА
//
// 07:00 KRAT = 00:00 UTC
// ============================================================

function getPreviousDailySyncTimestamp(
  now:
    number
) {

  const date =
    new Date(
      now
    );


  let previous =
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
    previous >
    now
  ) {

    previous -=
      24
      *
      60
      *
      60
      *
      1000;

  }


  return previous;

}


// ============================================================
// MESSAGE
// ============================================================

function getResultMessage(
  data:
    {
      message?:
        string;

      error?:
        string;
    }
    | null,

  fallback:
    string
) {

  if (
    data?.message
    &&
    data.message.trim()
  ) {

    return data.message;

  }


  if (
    data?.error
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

export default function OzonStockSyncClient() {

  const router =
    useRouter();


  const [
    now,
    setNow,
  ] =
    useState(
      Date.now()
    );


  const [
    stateLoaded,
    setStateLoaded,
  ] =
    useState(
      false
    );


  const [
    stocksState,
    setStocksState,
  ] =
    useState<SyncState>(
      EMPTY_SYNC_STATE
    );


  const [
    salesState,
    setSalesState,
  ] =
    useState<SyncState>(
      EMPTY_SYNC_STATE
    );


  // ==========================================================
  // ОСТАТКИ
  // ==========================================================

  const [
    stockLoading,
    setStockLoading,
  ] =
    useState(
      false
    );


  const [
    stockResult,
    setStockResult,
  ] =
    useState<
      StockSyncResult | null
    >(
      null
    );


  const [
    stockMessage,
    setStockMessage,
  ] =
    useState(
      ""
    );


  const [
    stockMessageError,
    setStockMessageError,
  ] =
    useState(
      false
    );


  // ==========================================================
  // ПРОДАЖИ
  // ==========================================================

  const [
    salesLoading,
    setSalesLoading,
  ] =
    useState(
      false
    );


  const [
    salesResult,
    setSalesResult,
  ] =
    useState<
      SalesSyncResult | null
    >(
      null
    );


  const [
    salesMessage,
    setSalesMessage,
  ] =
    useState(
      ""
    );


  const [
    salesMessageError,
    setSalesMessageError,
  ] =
    useState(
      false
    );


  // ==========================================================
  // ЧИТАЕМ СОСТОЯНИЕ ИЗ SUPABASE ЧЕРЕЗ SERVER ROUTE
  // ==========================================================

  async function loadSyncStates() {

    try {

      const response =
        await fetch(
          "/api/ozon-sync-state",
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );


      const data =
        await response
          .json() as
          SyncStateResponse;


      if (
        !response.ok
        ||
        data.ok !==
          true
      ) {

        throw new Error(
          data.error
          ??
          `HTTP ${response.status}`
        );

      }


      setStocksState(
        data.stocks
        ??
        EMPTY_SYNC_STATE
      );


      setSalesState(
        data.sales
        ??
        EMPTY_SYNC_STATE
      );

    } catch (error) {

      console.error(
        "Не удалось получить состояние Ozon:",
        error
      );

    } finally {

      setStateLoaded(
        true
      );

    }

  }


  // ==========================================================
  // INITIAL STATE
  // ==========================================================

  useEffect(
    () => {

      void loadSyncStates();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );


  // ==========================================================
  // СЕКУНДНЫЙ COUNTDOWN
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
  // РАЗ В МИНУТУ ПЕРЕЧИТЫВАЕМ СОСТОЯНИЕ
  //
  // К OZON ЭТОТ ЗАПРОС НЕ ИДЁТ.
  // ==========================================================

  useEffect(
    () => {

      const timer =
        window.setInterval(
          () => {

            void loadSyncStates();

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

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );


  // ==========================================================
  // DAILY-SYNC GRACE
  //
  // ДО 07:00 НИЧЕГО НЕ РЕЗЕРВИРУЕМ.
  // У OZON НЕТ WB-ШНОГО ТРЁХЧАСОВОГО COOLDOWN.
  //
  // ТОЛЬКО НЕ ДАЁМ НАЖАТЬ КНОПКУ
  // В ПЕРВЫЕ 2 МИНУТЫ ПОСЛЕ 07:00.
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
  // СОСТОЯНИЕ ЛИМИТОВ
  // ==========================================================

  const stockNextAllowedTimestamp =
    useMemo(
      () =>
        getTimestamp(
          stocksState.nextAllowedAt
        ),
      [
        stocksState.nextAllowedAt,
      ]
    );


  const salesNextAllowedTimestamp =
    useMemo(
      () =>
        getTimestamp(
          salesState.nextAllowedAt
        ),
      [
        salesState.nextAllowedAt,
      ]
    );


  const stockSecondsRemaining =
    stockNextAllowedTimestamp
    &&
    stockNextAllowedTimestamp >
      now

      ?
      Math.ceil(
        (
          stockNextAllowedTimestamp
          -
          now
        )
        /
        1000
      )

      :
      0;


  const salesSecondsRemaining =
    salesNextAllowedTimestamp
    &&
    salesNextAllowedTimestamp >
      now

      ?
      Math.ceil(
        (
          salesNextAllowedTimestamp
          -
          now
        )
        /
        1000
      )

      :
      0;


  const stockRateLimitActive =
    stockSecondsRemaining >
    0;


  const salesRateLimitActive =
    salesSecondsRemaining >
    0;


  const stockUnknownRateLimit =
    stocksState.lastHttpStatus ===
      429
    &&
    !stockRateLimitActive
    &&
    !stocksState.nextAllowedAt;


  const salesUnknownRateLimit =
    salesState.lastHttpStatus ===
      429
    &&
    !salesRateLimitActive
    &&
    !salesState.nextAllowedAt;


  // ==========================================================
  // ЗАПУСК ОСТАТКОВ
  // ==========================================================

  async function runStockSync() {

    if (
      stockLoading
      ||
      salesLoading
      ||
      stockRateLimitActive
      ||
      dailySyncGraceActive
      ||
      !stateLoaded
    ) {

      return;

    }


    setStockLoading(
      true
    );


    setStockResult(
      null
    );


    setStockMessage(
      ""
    );


    setStockMessageError(
      false
    );


    try {

      const response =
        await fetch(
          "/api/ozon-sync-stocks",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",
          }
        );


      const data =
        await response
          .json() as
          StockSyncResult;


      setStockResult(
        data
      );


      if (
        response.status ===
          429
        ||
        data.blockedByRateLimit ===
          true
      ) {

        setStocksState(
          current => ({
            ...current,

            lastHttpStatus:
              429,

            lastAttemptAt:
              data.lastAttemptAt
              ??
              new Date()
                .toISOString(),

            nextAllowedAt:
              data.nextAllowedAt
              ??
              null,

            retryAfterSeconds:
              data.retryAfterSeconds
              ??
              null,

            lastMessage:
              getResultMessage(
                data,
                "Лимит Ozon"
              ),
          })
        );


        setStockMessage(
          getResultMessage(
            data,
            "Ozon временно ограничил запрос остатков"
          )
        );


        setStockMessageError(
          false
        );


        return;

      }


      if (
        !response.ok
        ||
        data.ok !==
          true
      ) {

        setStockMessageError(
          true
        );


        setStockMessage(
          getResultMessage(
            data,
            `Ошибка HTTP ${response.status}`
          )
        );


        return;

      }


      const successAt =
        data.lastSuccessAt
        ??
        new Date()
          .toISOString();


      setStocksState({
        lastHttpStatus:
          data.lastHttpStatus
          ??
          200,

        lastAttemptAt:
          data.lastAttemptAt
          ??
          successAt,

        lastSuccessAt:
          successAt,

        nextAllowedAt:
          data.nextAllowedAt
          ??
          null,

        retryAfterSeconds:
          data.retryAfterSeconds
          ??
          null,

        lastMessage:
          data.message
          ??
          "Остатки Ozon успешно синхронизированы",
      });


      setStockMessage(
        "Данные остатков обновлены только что"
      );


      setStockMessageError(
        false
      );


      router.refresh();


    } catch (error) {

      setStockResult(
        {
          ok:
            false,

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка синхронизации остатков",
        }
      );


      setStockMessageError(
        true
      );


      setStockMessage(
        error instanceof Error
          ? error.message
          : "Не удалось обновить остатки Ozon"
      );

    } finally {

      setStockLoading(
        false
      );

    }

  }


  // ==========================================================
  // ЗАПУСК ПРОДАЖ
  // ==========================================================

  async function runSalesSync() {

    if (
      stockLoading
      ||
      salesLoading
      ||
      salesRateLimitActive
      ||
      dailySyncGraceActive
      ||
      !stateLoaded
    ) {

      return;

    }


    setSalesLoading(
      true
    );


    setSalesResult(
      null
    );


    setSalesMessage(
      ""
    );


    setSalesMessageError(
      false
    );


    try {

      const response =
        await fetch(
          "/api/ozon-sync-sales",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",
          }
        );


      const data =
        await response
          .json() as
          SalesSyncResult;


      setSalesResult(
        data
      );


      if (
        response.status ===
          429
        ||
        data.blockedByRateLimit ===
          true
      ) {

        setSalesState(
          current => ({
            ...current,

            lastHttpStatus:
              429,

            lastAttemptAt:
              data.lastAttemptAt
              ??
              new Date()
                .toISOString(),

            nextAllowedAt:
              data.nextAllowedAt
              ??
              null,

            retryAfterSeconds:
              data.retryAfterSeconds
              ??
              null,

            lastMessage:
              getResultMessage(
                data,
                "Лимит Ozon"
              ),
          })
        );


        setSalesMessage(
          getResultMessage(
            data,
            "Ozon временно ограничил запрос продаж"
          )
        );


        setSalesMessageError(
          false
        );


        return;

      }


      if (
        !response.ok
        ||
        data.ok !==
          true
      ) {

        setSalesMessageError(
          true
        );


        setSalesMessage(
          getResultMessage(
            data,
            `Ошибка HTTP ${response.status}`
          )
        );


        return;

      }


      const successAt =
        data.lastSuccessAt
        ??
        new Date()
          .toISOString();


      setSalesState({
        lastHttpStatus:
          data.lastHttpStatus
          ??
          200,

        lastAttemptAt:
          data.lastAttemptAt
          ??
          successAt,

        lastSuccessAt:
          successAt,

        nextAllowedAt:
          data.nextAllowedAt
          ??
          null,

        retryAfterSeconds:
          data.retryAfterSeconds
          ??
          null,

        lastMessage:
          data.message
          ??
          "Продажи Ozon успешно синхронизированы",
      });


      setSalesMessage(
        "Данные продаж обновлены только что"
      );


      setSalesMessageError(
        false
      );


      router.refresh();


    } catch (error) {

      setSalesResult(
        {
          ok:
            false,

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка синхронизации продаж",
        }
      );


      setSalesMessageError(
        true
      );


      setSalesMessage(
        error instanceof Error
          ? error.message
          : "Не удалось обновить продажи Ozon"
      );

    } finally {

      setSalesLoading(
        false
      );

    }

  }


  return (

    <>


      {/* ======================================================
          ОСТАТКИ OZON
          ====================================================== */}

      <section className="controls">

        <div>

          <h2 className="controls-title">
            Остатки Ozon
          </h2>


          <div className="muted">

            Все товары кабинета,
            FBO SKU и доступные остатки
            по кластерам.

          </div>

        </div>


        <SyncControl
          kind="stocks"

          label="Обновить остатки Ozon"

          loadingLabel="Загружаем остатки..."

          loading={
            stockLoading
          }

          otherLoading={
            salesLoading
          }

          stateLoaded={
            stateLoaded
          }

          state={
            stocksState
          }

          rateLimitActive={
            stockRateLimitActive
          }

          unknownRateLimit={
            stockUnknownRateLimit
          }

          secondsRemaining={
            stockSecondsRemaining
          }

          dailySyncGraceActive={
            dailySyncGraceActive
          }

          message={
            stockMessage
          }

          messageError={
            stockMessageError
          }

          onClick={
            () => {
              void runStockSync();
            }
          }
        />

      </section>


      {stockLoading && (

        <section className="section">

          <h2 className="section-title">
            Загружаем остатки Ozon
          </h2>


          <div className="reason-text">

            Получаем товары,
            FBO SKU и данные
            analytics/stocks.

          </div>


          <div className="reason-text">

            Новый снимок будет записан
            только после успешного
            завершения всех запросов.

          </div>

        </section>

      )}


      {stockResult &&
        !stockResult.ok &&
        !stockResult.blockedByRateLimit && (

        <section className="section">

          <h2 className="section-title">
            Ошибка остатков Ozon
          </h2>


          <div className="reason-box">

            <strong>
              Остатки не обновлены
            </strong>


            <div className="reason-text">

              {
                stockResult.error
                ??
                stockResult.message
                ??
                "Неизвестная ошибка"
              }

            </div>

          </div>

        </section>

      )}


      {stockResult?.ok && (

        <>

          <section className="summary-grid">

            <div className="card">

              <div className="card-label">
                Товаров сообщил Ozon
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.reportedTotalProducts
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Получено товаров
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.productsReceived
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Уникальных артикулов
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.uniqueOffers
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                FBO SKU
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.fboSkuCount
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Запросов analytics
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.analyticsRequests
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Строк от Ozon
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.analyticsRows
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Кластеров
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .ozon
                    ?.uniqueClusters
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Строк сохранено
              </div>

              <div className="big-number">

                {formatNumber(
                  stockResult
                    .supabase
                    ?.cluster_rows_saved
                  ??
                  stockResult
                    .ozon
                    ?.clusterRowsPrepared
                )}

              </div>

            </div>

          </section>


          <section className="section">

            <h2 className="section-title">
              Остатки синхронизированы
            </h2>


            <div className="reason-box">

              <strong>
                Остатки Ozon успешно
                записаны в Supabase
              </strong>


              <div className="reason-text">

                Дата снимка:{" "}

                {
                  stockResult
                    .snapshotDate
                  ??
                  stockResult
                    .supabase
                    ?.snapshot_date
                  ??
                  "—"
                }

              </div>

            </div>

          </section>

        </>

      )}


      {/* ======================================================
          ПРОДАЖИ OZON
          ====================================================== */}

      <section className="controls">

        <div>

          <h2 className="controls-title">
            Продажи Ozon
          </h2>


          <div className="muted">

            Последние 28 завершённых
            московских дней.
            Отменённые отправления
            считаются отдельно.

          </div>

        </div>


        <SyncControl
          kind="sales"

          label="Обновить продажи Ozon"

          loadingLabel="Загружаем продажи..."

          loading={
            salesLoading
          }

          otherLoading={
            stockLoading
          }

          stateLoaded={
            stateLoaded
          }

          state={
            salesState
          }

          rateLimitActive={
            salesRateLimitActive
          }

          unknownRateLimit={
            salesUnknownRateLimit
          }

          secondsRemaining={
            salesSecondsRemaining
          }

          dailySyncGraceActive={
            dailySyncGraceActive
          }

          message={
            salesMessage
          }

          messageError={
            salesMessageError
          }

          onClick={
            () => {
              void runSalesSync();
            }
          }
        />

      </section>


      {salesLoading && (

        <section className="section">

          <h2 className="section-title">
            Загружаем продажи Ozon
          </h2>


          <div className="reason-text">

            Получаем все FBO-отправления
            за 28 завершённых дней
            и проходим все страницы API.

          </div>


          <div className="reason-text">

            Затем сопоставляем склады
            с кластерами и считаем
            продажи по каждому товару,
            дню и кластеру.

          </div>


          <div className="reason-text">

            Статус cancelled
            в продажи не включается
            и хранится отдельно.

          </div>

        </section>

      )}


      {salesResult &&
        !salesResult.ok &&
        !salesResult.blockedByRateLimit && (

        <section className="section">

          <h2 className="section-title">
            Ошибка продаж Ozon
          </h2>


          <div className="reason-box">

            <strong>
              Продажи не обновлены
            </strong>


            <div className="reason-text">

              {
                salesResult.error
                ??
                salesResult.message
                ??
                "Неизвестная ошибка"
              }

            </div>

          </div>

        </section>

      )}


      {salesResult?.ok && (

        <>

          <section className="summary-grid">

            <div className="card">

              <div className="card-label">
                Период
              </div>

              <div className="big-number">

                {
                  salesResult
                    .period
                    ?.completedDays
                  ?? 28
                } дней

              </div>


              <div className="muted">

                {
                  salesResult
                    .period
                    ?.dateFrom
                  ?? "—"
                }

                {" → "}

                {
                  salesResult
                    .period
                    ?.dateTo
                  ?? "—"
                }

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                FBO-отправлений
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.uniquePostings
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Отменённых отправлений
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.cancelledPostings
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Товаров с продажами
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.uniqueProducts
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Кластеров
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.uniqueClusters
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Продано, шт.
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.salesQuantityExcludingCancelled
                )}

              </div>


              <div className="muted">
                Без cancelled
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Отменено, шт.
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .ozon
                    ?.cancelledQuantity
                )}

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Строк сохранено
              </div>

              <div className="big-number">

                {formatNumber(
                  salesResult
                    .supabase
                    ?.aggregated_rows_saved
                  ??
                  salesResult
                    .ozon
                    ?.aggregatedRows
                )}

              </div>

            </div>

          </section>


          <section className="section">

            <h2 className="section-title">
              Продажи синхронизированы
            </h2>


            <div className="reason-box">

              <strong>
                Продажи Ozon успешно
                записаны в Supabase
              </strong>


              <div className="reason-text">

                Период:{" "}

                {
                  salesResult
                    .period
                    ?.dateFrom
                  ?? "—"
                }

                {" — "}

                {
                  salesResult
                    .period
                    ?.dateTo
                  ?? "—"
                }

              </div>


              <div className="reason-text">

                Продажи без отмен:{" "}

                {formatNumber(
                  salesResult
                    .ozon
                    ?.salesQuantityExcludingCancelled
                )} шт.

              </div>


              <div className="reason-text">

                Отменено:{" "}

                {formatNumber(
                  salesResult
                    .ozon
                    ?.cancelledQuantity
                )} шт.

              </div>


              <div className="reason-text">

                Строк
                день + товар + кластер:{" "}

                {formatNumber(
                  salesResult
                    .supabase
                    ?.aggregated_rows_saved
                  ??
                  salesResult
                    .ozon
                    ?.aggregatedRows
                )}

              </div>

            </div>

          </section>


          <section className="section">

            <h2 className="section-title">
              Статусы отправлений
            </h2>


            <div className="transport-grid">

              {
                Object.entries(
                  salesResult
                    .ozon
                    ?.statusCounts
                  ?? {}
                )
                  .sort(
                    (
                      a,
                      b
                    ) =>
                      b[1] - a[1]
                  )
                  .map(
                    (
                      [
                        status,
                        count,
                      ]
                    ) => (

                      <div
                        className="transport-card"
                        key={status}
                      >

                        <span className="card-label">
                          {status}
                        </span>


                        <strong className="transport-value">

                          {formatNumber(
                            count
                          )}

                        </strong>

                      </div>

                    )
                  )
              }

            </div>

          </section>

        </>

      )}

    </>

  );
}


// ============================================================
// КНОПКА + СТАТУС
// ============================================================

function SyncControl({
  kind,
  label,
  loadingLabel,
  loading,
  otherLoading,
  stateLoaded,
  state,
  rateLimitActive,
  unknownRateLimit,
  secondsRemaining,
  dailySyncGraceActive,
  message,
  messageError,
  onClick,
}: {
  kind:
    SyncKind;

  label:
    string;

  loadingLabel:
    string;

  loading:
    boolean;

  otherLoading:
    boolean;

  stateLoaded:
    boolean;

  state:
    SyncState;

  rateLimitActive:
    boolean;

  unknownRateLimit:
    boolean;

  secondsRemaining:
    number;

  dailySyncGraceActive:
    boolean;

  message:
    string;

  messageError:
    boolean;

  onClick:
    () => void;
}) {

  const disabled =
    !stateLoaded
    ||
    loading
    ||
    otherLoading
    ||
    rateLimitActive
    ||
    dailySyncGraceActive;


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

        maxWidth:
          "440px",
      }}
    >


      {/* СОСТОЯНИЕ ЕЩЁ ЗАГРУЖАЕТСЯ */}

      {
        !stateLoaded
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
            Проверяем возможность обновления...
          </div>

        )
      }


      {/* АКТИВНЫЙ ЛИМИТ */}

      {
        stateLoaded
        &&
        rateLimitActive
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
              🔴 Лимит Ozon
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
                  state.nextAllowedAt
                )
              }
            </div>

          </div>

        )
      }


      {/* DAILY SYNC */}

      {
        stateLoaded
        &&
        !rateLimitActive
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
              🔄 Автообновление Ozon
            </div>


            <div
              className="muted"
              style={{
                marginTop:
                  "4px",
              }}
            >
              Получаем свежие данные
              после 07:00.
            </div>

          </div>

        )
      }


      {/* НЕИЗВЕСТНЫЙ 429 */}

      {
        stateLoaded
        &&
        !rateLimitActive
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
              🟠 Последний запрос получил лимит Ozon
            </div>


            <div
              className="muted"
              style={{
                marginTop:
                  "4px",
              }}
            >
              Ozon не сообщил точное время
              окончания ограничения.
            </div>

          </div>

        )
      }


      {/* МОЖНО ОБНОВИТЬ */}

      {
        stateLoaded
        &&
        !rateLimitActive
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


      {/* ПОСЛЕДНИЙ УСПЕХ */}

      {
        state.lastSuccessAt
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
                state.lastSuccessAt
              )
            }
          </div>

        )
      }


      {/* BUTTON */}

      <button
        type="button"

        className="primary-button"

        disabled={
          disabled
        }

        onClick={
          onClick
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
          !stateLoaded

            ?
            "Проверяем..."

            :
            loading

              ?
              loadingLabel

              :
              rateLimitActive

                ?
                `Лимит Ozon · ${formatDuration(
                  secondsRemaining
                )}`

                :
                dailySyncGraceActive

                  ?
                  "Обновляем автоматически..."

                  :
                  label
        }

      </button>


      {/* MESSAGE */}

      {
        message
        &&
        (

          <div
            style={{
              width:
                "100%",

              padding:
                "8px 10px",

              borderRadius:
                "8px",

              textAlign:
                "right",

              fontSize:
                "12px",

              fontWeight:
                messageError
                  ? 600
                  : 700,

              background:
                messageError
                  ? "rgba(220, 70, 70, 0.08)"
                  : "rgba(40, 160, 90, 0.08)",

              border:
                messageError
                  ? "1px solid rgba(220, 70, 70, 0.18)"
                  : "1px solid rgba(40, 160, 90, 0.18)",

              color:
                messageError
                  ? "#b42318"
                  : undefined,
            }}
          >

            {
              !messageError
              &&
              kind ===
                "stocks"
                ? "✅ "
                : null
            }

            {
              !messageError
              &&
              kind ===
                "sales"
                ? "✅ "
                : null
            }

            {message}

          </div>

        )
      }

    </div>

  );

}
