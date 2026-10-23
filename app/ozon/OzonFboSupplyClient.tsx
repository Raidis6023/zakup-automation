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

type PreviewWarehouse = {
  warehouse_id: number;
  name: string | null;
  address: string | null;
  availability: string;
  total_score: number | null;
  total_rank: number | null;
};

type PreviewArticle = {
  master_code: string | null;
  offer_id: string | null;
  product_name: string | null;
  sku: number | null;
  raw_need: number;
  units_per_carton: number | null;
  cartons: number;
  final_quantity: number;
  rule:
    | "full_cartons_rounded"
    | "zero_less_than_one_carton"
    | "missing_pack"
    | "pack_conflict"
    | "missing_enot"
    | "invalid_sku";
  ozon_rejected: boolean;
  ozon_rejection_reasons: string[];
};

type PreviewSlot = {
  date: string;
  from: string;
  to: string;
};

type PreviewCluster = {
  macrolocal_cluster_id: number;
  cluster_name: string | null;
  raw_need_units: number;
  proposed_units: number;
  ozon_accepted_units: number;
  cartons: number;
  article_count: number;
  articles_to_supply: number;
  missing_pack_count: number;
  zero_after_rounding_count: number;
  draft_id: number | null;
  status: "available" | "partial" | "not_available" | "no_supply" | "error";
  recommended_warehouse: PreviewWarehouse | null;
  warehouses: PreviewWarehouse[];
  timeslots: PreviewSlot[];
  supports_common_timeslot: boolean;
  error: string | null;
  articles: PreviewArticle[];
};

type PreviewPayload = {
  ok: boolean;
  error?: string;
  mode?: "preview_only";
  real_supply_created?: false;
  calculation_run_id?: string;
  formation_date?: string;
  target_date?: string;
  window_date_from?: string;
  window_date_to?: string;
  rounding_rule?: string;
  summary?: {
    clusters: number;
    clusters_with_supply: number;
    raw_need_units: number;
    proposed_units: number;
    ozon_accepted_units: number;
    cartons: number;
    missing_pack_items: number;
    conflicting_pack_items: number;
    missing_enot_items: number;
    invalid_sku_items: number;
    zero_half_or_less_items: number;
    technical_errors: number;
    packaging_attention_items?: number;
  };
  packaging_attention?: Array<{
    master_code: string | null;
    offer_id: string | null;
    product_name: string | null;
    sku: number | null;
    raw_need: number;
    final_quantity: number;
    missing_fields: string[];
    clusters: string[];
    missing_pack: boolean;
    pack_conflict: boolean;
    missing_enot: boolean;
    included_in_request: boolean;
  }>;
  recommended_timeslot?: {
    date: string;
    from: string;
    to: string;
    cluster_count: number;
    cluster_ids: number[];
    coverage_percent: number;
  } | null;
  timeslot_candidates?: Array<{
    date: string;
    from: string;
    to: string;
    cluster_count: number;
    cluster_ids: number[];
    coverage_percent: number;
  }>;
  can_create_real?: boolean;
  draft_ids?: number[];
  clusters?: PreviewCluster[];
  warnings?: string[];
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


function isTerminalRequestStatus(
  status:
    SupplyRequestStatus
) {

  return (
    status ===
      "success"
    ||
    status ===
      "no_slot"
    ||
    status ===
      "failed"
  );

}


function isParkedRequest(
  row:
    SupplyRequest
) {

  if (
    !row.next_attempt_at
  ) {

    return false;

  }


  const time =
    Date.parse(
      row.next_attempt_at
    );


  return (
    Number.isFinite(
      time
    )
    &&
    time >=
      Date.parse(
        "2100-01-01T00:00:00.000Z"
      )
  );

}


function canCreatePreviewCluster(
  cluster:
    PreviewCluster
) {

  return (
    cluster.proposed_units >
      0
    &&
    cluster.articles_to_supply >
      0
    &&
    (
      cluster.status ===
        "available"
      ||
      cluster.status ===
        "partial"
    )
  );

}


function activeRequestClusterIds(
  requests:
    SupplyRequest[]
) {

  return requests
    .filter(
      row =>
        !isTerminalRequestStatus(
          row.status
        )
        &&
        !isParkedRequest(
          row
        )
    )
    .map(
      row =>
        Number(
          row.macrolocal_cluster_id
        )
    )
    .filter(
      value =>
        Number.isFinite(
          value
        )
    );

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


  const [
    previewLoading,
    setPreviewLoading,
  ] =
    useState(
      false
    );


  const [
    previewError,
    setPreviewError,
  ] =
    useState(
      ""
    );


  const [
    preview,
    setPreview,
  ] =
    useState<
      PreviewPayload
      |
      null
    >(
      null
    );


  const [
    expandedPreviewCluster,
    setExpandedPreviewCluster,
  ] =
    useState<
      number
      |
      null
    >(
      null
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
      string,

    targetClusterIds:
      number[]
      =
      []
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
          targetClusterIds.length >
            0
        ) {

          const targets =
            new Set(
              targetClusterIds
            );


          const targetRows =
            data.requests.filter(
              row =>
                targets.has(
                  Number(
                    row.macrolocal_cluster_id
                  )
                )
            );


          const allTargetsFinished =
            targetRows.length ===
              targets.size
            &&
            targetRows.every(
              row =>
                isTerminalRequestStatus(
                  row.status
                )
            );


          if (
            allTargetsFinished
          ) {

            router.refresh();

            break;

          }

        } else if (
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


  async function runPreview() {

    if (
      previewLoading
      ||
      processing
      ||
      starting
      ||
      !calculationRunId
      ||
      pairsWithNeed <=
        0
    ) {

      return;

    }


    setPreviewLoading(
      true
    );


    setPreviewError(
      ""
    );


    setPreview(
      null
    );


    try {

      const response =
        await fetch(
          "/api/ozon/fbo-supply-preview",
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
          PreviewPayload;


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


      setPreview(
        data
      );

    } catch (previewRequestError) {

      setPreviewError(
        previewRequestError
          instanceof Error
          ? previewRequestError.message
          : String(
              previewRequestError
            )
      );

    } finally {

      setPreviewLoading(
        false
      );

    }

  }


  async function start(
    clusterIds:
      number[]
  ) {

    if (
      starting
      ||
      processing
      ||
      !calculationRunId
      ||
      pairsWithNeed <=
        0
      ||
      clusterIds.length ===
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

                  cluster_ids:
                    clusterIds,
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
          data.run.id,
          clusterIds
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

              const activeIds =
                activeRequestClusterIds(
                  data.requests
                );


              if (
                activeIds.length >
                  0
              ) {

                void processLoop(
                  data.run.id,
                  activeIds
                );

              }

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


  const previewMatchesCurrentCalculation =
    Boolean(
      preview
        ?.calculation_run_id
      &&
      calculationRunId
      &&
      preview.calculation_run_id ===
        calculationRunId
    );


  const previewClusters =
    preview
      ?.clusters
    ??
    [];


  const requestByCluster =
    new Map(
      (
        status
          ?.requests
        ??
        []
      ).map(
        row => [
          Number(
            row.macrolocal_cluster_id
          ),
          row,
        ]
      )
    );


  const creatableClusterIds =
    previewMatchesCurrentCalculation
      ? previewClusters
          .filter(
            canCreatePreviewCluster
          )
          .map(
            cluster =>
              cluster.macrolocal_cluster_id
          )
          .filter(
            clusterId => {

              const request =
                requestByCluster.get(
                  clusterId
                );


              return (
                !request
                ||
                request.status ===
                  "failed"
                ||
                request.status ===
                  "no_slot"
                ||
                (
                  !isTerminalRequestStatus(
                    request.status
                  )
                  &&
                  isParkedRequest(
                    request
                  )
                )
              );

            }
          )
      : [];


  const canStartAll =
    Boolean(
      calculationRunId
      &&
      creatableClusterIds.length >
        0
      &&
      !starting
      &&
      !processing
      &&
      !previewLoading
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


  const parkedRows =
    (
      status
        ?.requests
      ??
      []
    ).filter(
      row =>
        !isTerminalRequestStatus(
          row.status
        )
        &&
        isParkedRequest(
          row
        )
    );


  const activeRows =
    (
      status
        ?.requests
      ??
      []
    ).filter(
      row =>
        !isTerminalRequestStatus(
          row.status
        )
        &&
        !isParkedRequest(
          row
        )
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
            Сначала тест показывает потребность,
            короба, склад и таймслоты по кластерам.
            Реальные cross-dock заявки запускаются
            отдельно по кластеру или сразу все.
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


        <div
          style={{
            display:
              "flex",

            flexDirection:
              "column",

            gap:
              "8px",

            minWidth:
              "250px",
          }}
        >

          <button
            type="button"

            className=
              "secondary-button"

            disabled={
              previewLoading
              ||
              starting
              ||
              processing
              ||
              !calculationRunId
              ||
              pairsWithNeed <=
                0
            }

            onClick={
              () => {
                void runPreview();
              }
            }
          >
            {
              previewLoading
                ? "Считаем потребность и короба..."
                : "Тест: потребность по кластерам"
            }
          </button>


          <div
            className=
              "reason-text"

            style={{
              textAlign:
                "right",

              fontSize:
                "11px",
            }}
          >
            Тест только считает потребность и короба.
            Склад размещения и таймслот Ozon определяем
            уже при создании конкретной заявки.
          </div>

        </div>

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
        previewError
          ? (

            <div
              className=
                "ozon-fbo-supply-error"
            >
              <strong>
                Тест поставки не прошёл
              </strong>

              <div>
                {
                  previewError
                }
              </div>
            </div>

          )
          : null
      }


      {
        preview
        &&
        preview.ok
        &&
        preview.summary
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
                  Тест поставки завершён
                </strong>

                <span>
                  Реальные заявки: 0
                </span>
              </div>


              <div
                className=
                  "reason-text"
              >
                Расчёт количества привязан к ЕНОТ и вложимости
                в 1 транспортную коробку. Если потребность меньше
                одного полного короба — к поставке 0. Начиная
                с одного короба, количество коробов округляется
                математически до ближайшего целого.
              </div>


              <div
                className=
                  "ozon-fbo-supply-counters"
              >
                <span>
                  Исходная потребность:{" "}
                  <strong>
                    {
                      formatNumber(
                        preview.summary.raw_need_units
                      )
                    } шт.
                  </strong>
                </span>

                <span>
                  После коробов:{" "}
                  <strong>
                    {
                      formatNumber(
                        preview.summary.proposed_units
                      )
                    } шт.
                  </strong>
                </span>

                <span>
                  Коробов:{" "}
                  <strong>
                    {
                      formatNumber(
                        preview.summary.cartons
                      )
                    }
                  </strong>
                </span>

                <span>
                  Без вложимости:{" "}
                  <strong>
                    {
                      formatNumber(
                        preview.summary.missing_pack_items
                      )
                    }
                  </strong>
                </span>

                <span>
                  Меньше 1 короба → 0:{" "}
                  <strong>
                    {
                      formatNumber(
                        preview.summary.zero_half_or_less_items
                      )
                    }
                  </strong>
                </span>
              </div>


              {
                (
                  preview.packaging_attention
                  ??
                  []
                ).length >
                  0
                  ? (
                    <div
                      className=
                        "reason-box"

                      style={{
                        marginTop:
                          "14px",
                      }}
                    >
                      <strong>
                        Нужно дозаполнить упаковочные данные
                      </strong>

                      <div
                        className=
                          "reason-text"

                        style={{
                          marginTop:
                            "6px",
                        }}
                      >
                        Отсутствие размеров или веса не блокирует
                        расчёт и создание заявки. Если вложимость
                        известна, позиция уже включается с расчётным
                        количеством. Без вложимости позиция остаётся
                        в потребности, но временно не включается
                        в заявку, потому что коробную кратность
                        посчитать нельзя.
                      </div>

                      <div
                        style={{
                          marginTop:
                            "10px",

                          overflowX:
                            "auto",
                        }}
                      >
                        <div
                          style={{
                            minWidth:
                              "980px",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "grid",

                              gridTemplateColumns:
                                "0.7fr 1.1fr 1.8fr 1.1fr 0.7fr 0.8fr",

                              gap:
                                "10px",

                              padding:
                                "7px 0",

                              borderBottom:
                                "1px solid var(--ws-border)",

                              fontSize:
                                "10px",

                              fontWeight:
                                700,
                            }}
                          >
                            <span>ЕНОТ</span>
                            <span>Артикул</span>
                            <span>Товар</span>
                            <span>Не хватает</span>
                            <span>Потребность</span>
                            <span>В заявку</span>
                          </div>

                          {
                            (
                              preview.packaging_attention
                              ??
                              []
                            ).map(
                              (
                                row,
                                index
                              ) => {

                                const missing = [
                                  ...row.missing_fields,
                                  row.missing_pack
                                    ? "вложимость"
                                    : "",
                                  row.pack_conflict
                                    ? "конфликт вложимости"
                                    : "",
                                  row.missing_enot
                                    ? "ЕНОТ"
                                    : "",
                                ].filter(
                                  Boolean
                                );


                                return (
                                  <div
                                    key={
                                      [
                                        row.master_code,
                                        row.sku,
                                        row.offer_id,
                                        index,
                                      ].join(
                                        ":"
                                      )
                                    }

                                    style={{
                                      display:
                                        "grid",

                                      gridTemplateColumns:
                                        "0.7fr 1.1fr 1.8fr 1.1fr 0.7fr 0.8fr",

                                      gap:
                                        "10px",

                                      padding:
                                        "7px 0",

                                      borderBottom:
                                        "1px solid var(--ws-border)",

                                      fontSize:
                                        "10px",

                                      alignItems:
                                        "start",
                                    }}
                                  >
                                    <span>
                                      <strong>
                                        {
                                          row.master_code
                                          ??
                                          "—"
                                        }
                                      </strong>
                                    </span>

                                    <span>
                                      {
                                        row.offer_id
                                        ??
                                        "—"
                                      }
                                    </span>

                                    <span>
                                      {
                                        row.product_name
                                        ??
                                        "—"
                                      }
                                    </span>

                                    <span>
                                      {
                                        missing.length >
                                          0
                                          ? missing.join(
                                              ", "
                                            )
                                          : "—"
                                      }
                                    </span>

                                    <span>
                                      {
                                        formatNumber(
                                          row.raw_need
                                        )
                                      }
                                    </span>

                                    <span>
                                      <strong>
                                        {
                                          formatNumber(
                                            row.final_quantity
                                          )
                                        }
                                      </strong>

                                      <br />

                                      <small
                                        style={{
                                          color:
                                            row.included_in_request
                                              ? "#16794b"
                                              : "#b42318",
                                        }}
                                      >
                                        {
                                          row.included_in_request
                                            ? "не блокирует"
                                            : "ждёт вложимость"
                                        }
                                      </small>
                                    </span>
                                  </div>
                                );

                              }
                            )
                          }
                        </div>
                      </div>
                    </div>
                  )
                  : null
              }


              <div
                className=
                  "reason-box"

                style={{
                  marginTop:
                    "14px",
                }}
              >
                <strong>
                  Склад и таймслот определятся при создании заявки
                </strong>

                <div
                  className=
                    "reason-text"
                >
                  Потребность рассчитана на уровне кластера.
                  После нажатия «Создать заявку» backend создаёт
                  cross-dock draft только для этого кластера,
                  получает от Ozon доступный склад размещения
                  внутри кластера и ищет ближайший доступный слот не раньше,
                  чем через 3 суток от даты формирования.
                </div>
              </div>


              <div
                style={{
                  marginTop:
                    "14px",

                  overflowX:
                    "auto",
                }}
              >
                <div
                  style={{
                    minWidth:
                      "1180px",
                  }}
                >
                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "1.25fr 0.65fr 0.65fr 0.55fr 1.55fr 0.65fr 0.65fr 1fr",

                      gap:
                        "12px",

                      padding:
                        "8px 0",

                      borderBottom:
                        "1px solid var(--ws-border)",

                      fontSize:
                        "11px",

                      fontWeight:
                        700,
                    }}
                  >
                    <span>Кластер</span>
                    <span>Нужно</span>
                    <span>К поставке</span>
                    <span>Коробов</span>
                    <span>Склад размещения</span>
                    <span>Таймслот</span>
                    <span>Состав</span>
                    <span>Заявка</span>
                  </div>


                  {
                    (
                      preview.clusters
                      ??
                      []
                    ).map(
                      cluster => {

                        const expanded =
                          expandedPreviewCluster ===
                          cluster.macrolocal_cluster_id;

                        const request =
                          requestByCluster.get(
                            cluster.macrolocal_cluster_id
                          );

                        const requestActive =
                          Boolean(
                            request
                            &&
                            !isTerminalRequestStatus(
                              request.status
                            )
                            &&
                            !isParkedRequest(
                              request
                            )
                          );

                        const clusterCanCreate =
                          canCreatePreviewCluster(
                            cluster
                          );

                        const clusterButtonDisabled =
                          starting
                          ||
                          processing
                          ||
                          previewLoading
                          ||
                          !clusterCanCreate
                          ||
                          requestActive
                          ||
                          Boolean(
                            request
                            &&
                            request.status ===
                              "success"
                          );


                        return (

                          <div
                            key={
                              cluster.macrolocal_cluster_id
                            }
                          >

                            <div
                              style={{
                                display:
                                  "grid",

                                gridTemplateColumns:
                                  "1.25fr 0.65fr 0.65fr 0.55fr 1.55fr 0.65fr 0.65fr 1fr",

                                gap:
                                  "12px",

                                padding:
                                  "10px 0",

                                borderBottom:
                                  "1px solid var(--ws-border)",

                                alignItems:
                                  "start",

                                fontSize:
                                  "11px",
                              }}
                            >
                              <span>
                                <strong>
                                  {
                                    cluster.cluster_name
                                    ??
                                    `Кластер ${cluster.macrolocal_cluster_id}`
                                  }
                                </strong>

                                <br />

                                <small
                                  className=
                                    "reason-text"
                                >
                                  {
                                    cluster.article_count
                                  } ЕНОТ
                                </small>
                              </span>

                              <span>
                                <strong>
                                  {
                                    formatNumber(
                                      cluster.raw_need_units
                                    )
                                  }
                                </strong>
                                {" шт."}
                              </span>

                              <span>
                                <strong>
                                  {
                                    formatNumber(
                                      cluster.proposed_units
                                    )
                                  }
                                </strong>
                                {" шт."}

                                {
                                  cluster.ozon_accepted_units !==
                                    cluster.proposed_units
                                    ? (
                                      <>
                                        <br />

                                        <small
                                          style={{
                                            color:
                                              "#b42318",
                                          }}
                                        >
                                          Ozon принимает{" "}
                                          {
                                            formatNumber(
                                              cluster.ozon_accepted_units
                                            )
                                          }
                                        </small>
                                      </>
                                    )
                                    : null
                                }
                              </span>

                              <span>
                                <strong>
                                  {
                                    formatNumber(
                                      cluster.cartons
                                    )
                                  }
                                </strong>
                              </span>

                              <span>
                                {
                                  cluster.recommended_warehouse
                                    ? (
                                      <>
                                        <strong>
                                          {
                                            cluster.recommended_warehouse.name
                                            ??
                                            `Склад ${cluster.recommended_warehouse.warehouse_id}`
                                          }
                                        </strong>

                                        {
                                          cluster.recommended_warehouse.address
                                            ? (
                                              <>
                                                <br />

                                                <small
                                                  className=
                                                    "reason-text"
                                                >
                                                  {
                                                    cluster.recommended_warehouse.address
                                                  }
                                                </small>
                                              </>
                                            )
                                            : null
                                        }
                                      </>
                                    )
                                    : (
                                      <small
                                        className=
                                          "reason-text"
                                      >
                                        {
                                          cluster.proposed_units >
                                            0
                                            &&
                                          cluster.status ===
                                            "available"
                                            ? "Определится при создании заявки"
                                            : cluster.error
                                              ??
                                              "—"
                                        }
                                      </small>
                                    )
                                }
                              </span>

                              <span>
                                {
                                  cluster.proposed_units <=
                                    0
                                    ? "Не нужен"
                                    : cluster.status ===
                                        "available"
                                      ? "Ищем при создании"
                                      : "—"
                                }
                              </span>

                              <span>
                                <button
                                  type="button"

                                  className=
                                    "secondary-button"

                                  onClick={
                                    () => {
                                      setExpandedPreviewCluster(
                                        expanded
                                          ? null
                                          : cluster.macrolocal_cluster_id
                                      );
                                    }
                                  }
                                >
                                  {
                                    expanded
                                      ? "Скрыть"
                                      : `${cluster.article_count} поз.`
                                  }
                                </button>
                              </span>

                              <span>
                                <button
                                  type="button"

                                  className=
                                    "primary-button"

                                  disabled={
                                    clusterButtonDisabled
                                  }

                                  onClick={
                                    () => {
                                      void start(
                                        [
                                          cluster.macrolocal_cluster_id,
                                        ]
                                      );
                                    }
                                  }
                                >
                                  {
                                    request
                                    &&
                                    request.status ===
                                      "success"
                                      ? "Создана"

                                      : request
                                        &&
                                        request.status ===
                                          "no_slot"
                                        ? "Повторить: нет слота"

                                        : request
                                          &&
                                          request.status ===
                                            "failed"
                                          ? "Повторить заявку"

                                          : requestActive
                                            ? getStatusLabel(
                                                request!.status
                                              )

                                            : !clusterCanCreate
                                              ? cluster.proposed_units <=
                                                  0
                                                ? "Не требуется"

                                                : cluster.status ===
                                                    "partial"
                                                  ? "Есть отклонения"

                                                  : "Недоступна"

                                              : starting
                                                ? "Запускаем..."

                                                : "Создать заявку"
                                  }
                                </button>
                              </span>
                            </div>


                            {
                              expanded
                                ? (

                                  <div
                                    style={{
                                      padding:
                                        "10px 0 16px 18px",

                                      borderBottom:
                                        "1px solid var(--ws-border)",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display:
                                          "grid",

                                        gridTemplateColumns:
                                          "0.7fr 0.9fr 1.6fr 0.8fr 0.65fr 0.65fr 0.65fr 0.85fr",

                                        gap:
                                          "10px",

                                        minWidth:
                                          "1160px",

                                        padding:
                                          "6px 0",

                                        fontSize:
                                          "10px",

                                        fontWeight:
                                          700,
                                      }}
                                    >
                                      <span>ЕНОТ</span>
                                      <span>Артикул</span>
                                      <span>Товар</span>
                                      <span>Ozon SKU</span>
                                      <span>Потребность</span>
                                      <span>В коробе</span>
                                      <span>Коробов</span>
                                      <span>К поставке</span>
                                    </div>


                                    {
                                      cluster.articles.map(
                                        (
                                          article,
                                          index
                                        ) => (

                                          <div
                                            key={
                                              [
                                                article.master_code,
                                                article.sku,
                                                index,
                                              ].join(
                                                ":"
                                              )
                                            }

                                            style={{
                                              display:
                                                "grid",

                                              gridTemplateColumns:
                                                "0.7fr 0.9fr 1.6fr 0.8fr 0.65fr 0.65fr 0.65fr 0.85fr",

                                              gap:
                                                "10px",

                                              minWidth:
                                                "1160px",

                                              padding:
                                                "7px 0",

                                              borderTop:
                                                "1px solid var(--ws-border)",

                                              fontSize:
                                                "10px",
                                            }}
                                          >
                                            <span>
                                              <strong>
                                                {
                                                  article.master_code
                                                  ??
                                                  "—"
                                                }
                                              </strong>
                                            </span>

                                            <span>
                                              {
                                                article.offer_id
                                                ??
                                                "—"
                                              }
                                            </span>

                                            <span>
                                              {
                                                article.product_name
                                                ??
                                                "—"
                                              }
                                            </span>

                                            <span>
                                              {
                                                article.sku
                                                ??
                                                "—"
                                              }
                                            </span>

                                            <span>
                                              {
                                                formatNumber(
                                                  article.raw_need
                                                )
                                              }
                                            </span>

                                            <span>
                                              {
                                                article.units_per_carton
                                                ??
                                                "—"
                                              }
                                            </span>

                                            <span>
                                              {
                                                formatNumber(
                                                  article.cartons
                                                )
                                              }
                                            </span>

                                            <span>
                                              <strong>
                                                {
                                                  formatNumber(
                                                    article.final_quantity
                                                  )
                                                }
                                              </strong>

                                              {
                                                article.rule ===
                                                  "zero_less_than_one_carton"
                                                  ? " · меньше 1 короба → 0"

                                                  : article.rule ===
                                                      "missing_pack"
                                                      ? " · нет вложимости"

                                                      : article.rule ===
                                                          "pack_conflict"
                                                        ? " · конфликт вложимости"

                                                        : article.rule ===
                                                            "missing_enot"
                                                          ? " · нет ЕНОТ"

                                                          : article.rule ===
                                                              "invalid_sku"
                                                            ? " · нет SKU"

                                                            : ""
                                              }

                                              {
                                                article.ozon_rejected
                                                  ? (
                                                    <>
                                                      <br />

                                                      <small
                                                        style={{
                                                          color:
                                                            "#b42318",
                                                        }}
                                                      >
                                                        Ozon отклонил
                                                        {
                                                          article.ozon_rejection_reasons.length >
                                                            0
                                                            ? `: ${article.ozon_rejection_reasons.join(
                                                                ", "
                                                              )}`
                                                            : ""
                                                        }
                                                      </small>
                                                    </>
                                                  )
                                                  : null
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

                          </div>

                        );

                      }
                    )
                  }
                </div>
              </div>


              <div
                style={{
                  marginTop:
                    "16px",

                  display:
                    "flex",

                  justifyContent:
                    "flex-end",

                  alignItems:
                    "center",

                  gap:
                    "12px",
                }}
              >
                <div
                  className=
                    "reason-text"

                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  {
                    creatableClusterIds.length >
                      0
                      ? `Готово к созданию: ${creatableClusterIds.length} кластеров`
                      : "Нет новых доступных кластеров для создания"
                  }
                </div>

                <button
                  type="button"

                  className=
                    "primary-button"

                  disabled={
                    !canStartAll
                  }

                  onClick={
                    () => {
                      void start(
                        creatableClusterIds
                      );
                    }
                  }
                >
                  {
                    starting
                      ? "Запускаем заявки..."
                      : processing
                        ? "Заявки создаются..."
                        : "Создать все заявки"
                  }
                </button>
              </div>


              {
                (
                  preview.timeslot_candidates
                  ??
                  []
                ).length >
                  1
                  ? (
                    <div
                      className=
                        "reason-box"

                      style={{
                        marginTop:
                          "14px",
                      }}
                    >
                      <strong>
                        Другие общие таймслоты
                      </strong>

                      {
                        (
                          preview.timeslot_candidates
                          ??
                          []
                        )
                          .slice(
                            1,
                            6
                          )
                          .map(
                            slot => (
                              <div
                                key={
                                  `${slot.from}:${slot.to}`
                                }

                                className=
                                  "reason-text"
                              >
                                {
                                  formatDateTime(
                                    slot.from
                                  )
                                }

                                {" → "}

                                {
                                  formatDateTime(
                                    slot.to
                                  )
                                }

                                {" · "}

                                {
                                  slot.cluster_count
                                } кластеров ·{" "}

                                {
                                  slot.coverage_percent
                                }%
                              </div>
                            )
                          )
                      }
                    </div>
                  )
                  : null
              }


              {
                (
                  preview.warnings
                  ??
                  []
                ).map(
                  warning => (
                    <div
                      key={
                        warning
                      }

                      className=
                        "reason-text"

                      style={{
                        marginTop:
                          "6px",
                      }}
                    >
                      {warning}
                    </div>
                  )
                )
              }

            </div>

          )
          : null
      }


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
                    currentRun.status ===
                      "running"
                    &&
                    activeRows.length ===
                      0
                    &&
                    parkedRows.length >
                      0
                      ? "Ожидает запуска кластеров"
                      : getRunLabel(
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
                      activeRows.length
                    }
                  </strong>
                </span>


                <span>
                  Ожидают запуска:{" "}
                  <strong>
                    {
                      parkedRows.length
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
                          const activeIds =
                            activeRequestClusterIds(
                              status
                                ?.requests
                              ??
                              []
                            );


                          if (
                            activeIds.length >
                              0
                          ) {

                            void processLoop(
                              currentRun.id,
                              activeIds
                            );

                          }
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
