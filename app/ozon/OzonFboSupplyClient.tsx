"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type SupplyRequestStatus =
  | "queued"
  | "draft_created"
  | "draft_ready"
  | "slot_selected"
  | "creating"
  | "success"
  | "no_slot"
  | "failed";

type SupplyRun = {
  id: string;
  calculation_run_id: string;
  status: "running" | "success" | "partial" | "failed";
  created_at: string;
  finished_at: string | null;
  formation_date: string;
  target_date: string;
  window_date_from: string;
  window_date_to: string;
  total_clusters: number;
  success_clusters: number;
  no_slot_clusters: number;
  failed_clusters: number;
  total_units: string | number;
  drop_off_name: string | null;
  drop_off_address: string | null;
};

type SupplyRequest = {
  id: string;
  macrolocal_cluster_id: string | number;
  cluster_name: string | null;
  status: SupplyRequestStatus;
  sku_count: number;
  total_units: string | number;
  draft_id: string | number | null;
  storage_warehouse_name: string | null;
  timeslot_from: string | null;
  timeslot_to: string | null;
  ozon_order_id: string | number | null;
  next_attempt_at: string | null;
  attempts: number;
  error_message: string | null;
};

type StatusPayload = {
  ok: boolean;
  error?: string;
  run: SupplyRun | null;
  requests: SupplyRequest[];
  progress: {
    total: number;
    success: number;
    no_slot: number;
    failed: number;
    in_progress: number;
    percent: number;
  };
  next_action_at: string | null;
};


function formatNumber(
  value:
    string
    |
    number
    |
    null
    |
    undefined
) {

  const number =
    Number(
      value
    );


  return Number.isFinite(
    number
  )
    ? number.toLocaleString(
        "ru-RU"
      )
    : "—";

}


function formatDate(
  value:
    string
    |
    null
    |
    undefined
) {

  if (!value) {

    return "—";

  }


  const [
    year,
    month,
    day,
  ] =
    value
      .slice(
        0,
        10
      )
      .split(
        "-"
      );


  return (
    year
    &&
    month
    &&
    day
  )
    ? `${day}.${month}.${year}`
    : value;

}


function formatDateTime(
  value:
    string
    |
    null
    |
    undefined
) {

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
    }
  ).format(
    date
  );

}


function sleep(
  milliseconds:
    number
) {

  return new Promise<void>(
    resolve =>
      window.setTimeout(
        resolve,
        milliseconds
      )
  );

}


function getStatusLabel(
  status:
    SupplyRequestStatus
) {

  switch (
    status
  ) {

    case "queued":
      return "В очереди";

    case "draft_created":
      return "Черновик создан";

    case "draft_ready":
      return "Склад выбран";

    case "slot_selected":
      return "Таймслот выбран";

    case "creating":
      return "Создаётся заявка";

    case "success":
      return "Создана";

    case "no_slot":
      return "Нет таймслота";

    case "failed":
      return "Ошибка";

  }

}


function getRunLabel(
  status:
    SupplyRun[
      "status"
    ]
) {

  switch (
    status
  ) {

    case "running":
      return "Создание заявок идёт";

    case "success":
      return "Все заявки созданы";

    case "partial":
      return "Создание завершено частично";

    case "failed":
      return "Создание завершилось ошибкой";

  }

}


export default function OzonFboSupplyClient({
  calculationRunId,
  calculationCreatedAt,
  pairsWithNeed,
  totalNeedUnits,
}: {
  calculationRunId:
    string
    |
    null;

  calculationCreatedAt:
    string
    |
    null;

  pairsWithNeed:
    number;

  totalNeedUnits:
    number;
}) {

  const router =
    useRouter();


  const [
    status,
    setStatus,
  ] =
    useState<
      StatusPayload
      |
      null
    >(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    starting,
    setStarting,
  ] =
    useState(
      false
    );


  const [
    processing,
    setProcessing,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState(
      ""
    );


  const mountedRef =
    useRef(
      true
    );


  const loopRef =
    useRef(
      false
    );


  async function loadStatus() {

    const response =
      await fetch(
        "/api/ozon/fbo-supply",
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
        StatusPayload;


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


    if (
      mountedRef.current
    ) {

      setStatus(
        data
      );

    }


    return data;

  }


  async function processLoop(
    runId:
      string
  ) {

    if (
      loopRef.current
    ) {

      return;

    }


    loopRef.current =
      true;


    if (
      mountedRef.current
    ) {

      setProcessing(
        true
      );


      setError(
        ""
      );

    }


    try {

      while (
        mountedRef.current
      ) {

        const response =
          await fetch(
            "/api/ozon/fbo-supply",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    action:
                      "process_next",

                    run_id:
                      runId,
                  }
                ),

              cache:
                "no-store",
            }
          );


        const data =
          await response
            .json() as
            StatusPayload;


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


        if (
          !mountedRef.current
        ) {

          break;

        }


        setStatus(
          data
        );


        if (
          !data.run
          ||
          data.run.status !==
            "running"
        ) {

          router.refresh();

          break;

        }


        const nextAt =
          data.next_action_at
            ? Date.parse(
                data.next_action_at
              )
            : NaN;


        const waitMs =
          Number.isFinite(
            nextAt
          )
            ? Math.max(
                1500,
                Math.min(
                  35000,
                  nextAt
                  -
                  Date.now()
                  +
                  500
                )
              )
            : 2000;


        await sleep(
          waitMs
        );

      }

    } catch (loopError) {

      if (
        mountedRef.current
      ) {

        setError(
          loopError
            instanceof Error
            ? loopError.message
            : String(
                loopError
              )
        );

      }

    } finally {

      loopRef.current =
        false;


      if (
        mountedRef.current
      ) {

        setProcessing(
          false
        );

      }

    }

  }


  async function start() {

    if (
      starting
      ||
      processing
      ||
      !calculationRunId
      ||
      pairsWithNeed <=
        0
    ) {

      return;

    }


    setStarting(
      true
    );


    setError(
      ""
    );


    try {

      const response =
        await fetch(
          "/api/ozon/fbo-supply",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  action:
                    "start",
                }
              ),

            cache:
              "no-store",
          }
        );


      const data =
        await response
          .json() as
          StatusPayload;


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


      setStatus(
        data
      );


      if (
        data.run?.status ===
          "running"
      ) {

        void processLoop(
          data.run.id
        );

      } else {

        router.refresh();

      }

    } catch (startError) {

      setError(
        startError
          instanceof Error
          ? startError.message
          : String(
              startError
            )
      );

    } finally {

      setStarting(
        false
      );

    }

  }


  useEffect(
    () => {

      mountedRef.current =
        true;


      void (
        async () => {

          try {

            const data =
              await loadStatus();


            if (
              data.run?.status ===
                "running"
            ) {

              void processLoop(
                data.run.id
              );

            }

          } catch (loadError) {

            if (
              mountedRef.current
            ) {

              setError(
                loadError
                  instanceof Error
                  ? loadError.message
                  : String(
                      loadError
                    )
              );

            }

          } finally {

            if (
              mountedRef.current
            ) {

              setLoading(
                false
              );

            }

          }

        }
      )();


      return () => {

        mountedRef.current =
          false;

      };

      // Запускаем один раз при открытии страницы.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );


  const sameCalculation =
    Boolean(
      calculationRunId
      &&
      status
        ?.run
        ?.calculation_run_id ===
          calculationRunId
    );


  const currentRun =
    status
      ?.run
    ??
    null;


  const runIsRunning =
    currentRun
      ?.status ===
    "running";


  const currentCalculationDone =
    sameCalculation
    &&
    currentRun
    &&
    currentRun.status !==
      "running";


  const canStart =
    Boolean(
      calculationRunId
      &&
      pairsWithNeed >
        0
      &&
      !runIsRunning
      &&
      !currentCalculationDone
      &&
      !starting
      &&
      !processing
    );


  const problemRows =
    (
      status
        ?.requests
      ??
      []
    ).filter(
      row =>
        row.status ===
          "failed"
        ||
        row.status ===
          "no_slot"
    );


  const successfulRows =
    (
      status
        ?.requests
      ??
      []
    ).filter(
      row =>
        row.status ===
        "success"
    );


  return (

    <section
      className=
        "section ozon-fbo-supply-section"
    >

      <div
        className=
          "ozon-fbo-supply-head"
      >

        <div>

          <h2
            className=
              "section-title"
          >
            Автосоздание поставок FBO
          </h2>


          <div
            className=
              "reason-text"
          >
            Один запуск создаёт отдельную
            cross-dock заявку Ozon
            для каждого макрокластера.
          </div>


          <div
            className=
              "reason-text"
          >
            Маршрут: МСК ФБС → Внуково →
            склад размещения кластера.
            Цель таймслота: +7 дней,
            допустимо от +5 до +9 дней.
          </div>

        </div>


        <button
          type="button"

          className=
            "primary-button"

          disabled={
            !canStart
          }

          onClick={
            () => {
              void start();
            }
          }
        >

          {
            loading
              ? "Проверяем состояние..."

              : starting
                ? "Формируем очередь..."

                : runIsRunning
                  ? "Заявки создаются..."

                  : currentCalculationDone
                    ? "Текущий расчёт обработан"

                    : pairsWithNeed <=
                        0
                      ? "Поставка не требуется"

                      : "Создать заявки по кластерам"
          }

        </button>

      </div>


      <div
        className=
          "ozon-fbo-supply-facts"
      >

        <div
          className=
            "ozon-fbo-supply-fact"
        >
          <span>
            Расчёт
          </span>

          <strong>
            {
              calculationCreatedAt
                ? formatDateTime(
                    calculationCreatedAt
                  )
                : "—"
            }
          </strong>
        </div>


        <div
          className=
            "ozon-fbo-supply-fact"
        >
          <span>
            Позиций с потребностью
          </span>

          <strong>
            {
              formatNumber(
                pairsWithNeed
              )
            }
          </strong>
        </div>


        <div
          className=
            "ozon-fbo-supply-fact"
        >
          <span>
            Требуется, шт.
          </span>

          <strong>
            {
              formatNumber(
                totalNeedUnits
              )
            }
          </strong>
        </div>


        <div
          className=
            "ozon-fbo-supply-fact"
        >
          <span>
            Целевая дата
          </span>

          <strong>
            {
              currentRun
                ? formatDate(
                    currentRun.target_date
                  )
                : "после запуска +7 дней"
            }
          </strong>
        </div>

      </div>


      {
        currentRun
        &&
        status
          ? (

            <div
              className=
                "ozon-fbo-supply-progress-wrap"
            >

              <div
                className=
                  "ozon-fbo-supply-progress-top"
              >

                <strong>
                  {
                    getRunLabel(
                      currentRun.status
                    )
                  }
                </strong>


                <span>
                  {
                    status.progress.percent
                  }%
                </span>

              </div>


              <div
                className=
                  "ozon-fbo-supply-progress"
              >
                <span
                  style={{
                    width:
                      `${status.progress.percent}%`,
                  }}
                />
              </div>


              <div
                className=
                  "ozon-fbo-supply-counters"
              >

                <span>
                  Создано:{" "}
                  <strong>
                    {
                      status.progress.success
                    }
                  </strong>
                </span>


                <span>
                  В работе:{" "}
                  <strong>
                    {
                      status.progress.in_progress
                    }
                  </strong>
                </span>


                <span>
                  Нет слота:{" "}
                  <strong>
                    {
                      status.progress.no_slot
                    }
                  </strong>
                </span>


                <span>
                  Ошибки:{" "}
                  <strong>
                    {
                      status.progress.failed
                    }
                  </strong>
                </span>

              </div>


              <div
                className=
                  "reason-text"
              >
                Точка отгрузки:{" "}
                <strong>
                  {
                    currentRun.drop_off_name
                    ??
                    "Внуково"
                  }
                </strong>

                {
                  currentRun.drop_off_address
                    ? ` · ${currentRun.drop_off_address}`
                    : ""
                }
              </div>


              <div
                className=
                  "reason-text"
              >
                Окно поиска таймслота:{" "}
                {
                  formatDate(
                    currentRun.window_date_from
                  )
                }

                {" — "}

                {
                  formatDate(
                    currentRun.window_date_to
                  )
                }
              </div>

            </div>

          )
          : null
      }


      {
        error
          ? (

            <div
              className=
                "ozon-fbo-supply-error"
            >

              <strong>
                Создание приостановлено
              </strong>


              <div>
                {
                  error
                }
              </div>


              {
                currentRun
                ?.status ===
                "running"
                  ? (

                    <button
                      type="button"

                      className=
                        "secondary-button"

                      disabled={
                        processing
                      }

                      onClick={
                        () => {
                          void processLoop(
                            currentRun.id
                          );
                        }
                      }
                    >
                      Продолжить
                    </button>

                  )
                  : null
              }

            </div>

          )
          : null
      }


      {
        problemRows.length >
        0
          ? (

            <div
              className=
                "ozon-fbo-supply-problems"
            >

              <strong>
                Кластеры, которые требуют внимания
              </strong>


              {
                problemRows.map(
                  row => (

                    <div
                      key={
                        row.id
                      }

                      className=
                        "ozon-fbo-supply-row"
                    >

                      <span>
                        {
                          row.cluster_name
                          ??
                          `Кластер ${row.macrolocal_cluster_id}`
                        }
                      </span>


                      <span>
                        {
                          getStatusLabel(
                            row.status
                          )
                        }
                      </span>


                      <span>
                        {
                          row.error_message
                          ??
                          "—"
                        }
                      </span>

                    </div>

                  )
                )
              }

            </div>

          )
          : null
      }


      {
        successfulRows.length >
        0
          ? (

            <div
              className=
                "ozon-fbo-supply-success-list"
            >

              <strong>
                Созданные заявки
              </strong>


              {
                successfulRows
                  .slice(
                    -8
                  )
                  .map(
                    row => (

                      <div
                        key={
                          row.id
                        }

                        className=
                          "ozon-fbo-supply-row"
                      >

                        <span>
                          {
                            row.cluster_name
                            ??
                            `Кластер ${row.macrolocal_cluster_id}`
                          }
                        </span>


                        <span>
                          {
                            row.ozon_order_id
                              ? `Ozon № ${row.ozon_order_id}`
                              : "Создана"
                          }
                        </span>


                        <span>
                          {
                            row.timeslot_from
                              ? formatDateTime(
                                  row.timeslot_from
                                )
                              : "—"
                          }
                        </span>

                      </div>

                    )
                  )
              }

            </div>

          )
          : null
      }

    </section>

  );

}
