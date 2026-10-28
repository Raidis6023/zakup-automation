"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  useRouter,
} from "next/navigation";

import WorkspaceCollapsiblePanel
from "../WorkspaceCollapsiblePanel";


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

type CargoPayload = {
  ok: boolean;
  error?: string;
  request_id?: string;
  cluster_name?: string | null;
  order_id?: number;
  order_number?: string | null;
  supply_count?: number;
  total_boxes?: number;
  blockers?: string[];
  created?: boolean;
  created_boxes?: number;
  supplies?: Array<{
    supply_id: number;
    bundle_id: string;
    state: string;
    existing_cargoes: number;
    box_count: number;
    unit_count: number;
    items: Array<{
      sku: number;
      offer_id: string;
      quantity: number;
      units_per_carton: number;
      boxes: number;
    }>;
    blockers: string[];
  }>;
  created_supplies?: Array<{
    supply_id: number;
    cargo_ids: number[];
    operations: string[];
    rules: unknown;
  }>;
};
type SupplySummaryPayload = {
  ok: boolean;
  error?: string;
  applications_count?: number;
  total_orders_found?: number;
  pallet_gm?: number;
  box_gm?: number;
  transport_pallets_for_boxes?: number;
  total_volume_m3?: number;
  total_weight_kg?: number | null;
  known_weight_kg?: number;
  missing_weight_cartons?: number;
  transport_unplaced_boxes?: number;
  max_height_cm?: number | null;
  errors?: Array<{
    request_id: string;
    cluster_name: string | null;
    error: string;
  }>;
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
      return "Кластер подтверждён";

    case "slot_selected":
      return "Таймслот выбран";

    case "creating":
      return "Заявка / грузоместа";

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


function FboNestedDisclosure({
  title,
  children,
}: {
  title:
    string;

  children:
    ReactNode;
}) {

  const [
    expanded,
    setExpanded,
  ] =
    useState(
      false
    );


  return (
    <div
      className=
        "ozon-fbo-nested-disclosure"
    >

      <button
        type="button"

        className=
          "ozon-fbo-nested-toggle"

        aria-expanded={
          expanded
        }

        onClick={
          () =>
            setExpanded(
              current =>
                !current
            )
        }
      >
        {title}
      </button>


      {
        expanded
          ? (
            <div
              className=
                "ozon-fbo-nested-body"
            >
              {children}
            </div>
          )
          : null
      }

    </div>
  );

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


  const [
    cargoLoadingId,
    setCargoLoadingId,
  ] =
    useState<
      string
      |
      null
    >(
      null
    );


  const [
    cargoPlans,
    setCargoPlans,
  ] =
    useState<
      Record<
        string,
        CargoPayload
      >
    >(
      {}
    );


  const [
    cargoErrors,
    setCargoErrors,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {}
    );


  const [
    summary,
    setSummary,
  ] =
    useState<
      SupplySummaryPayload
      |
      null
    >(
      null
    );


  const [
    summaryLoading,
    setSummaryLoading,
  ] =
    useState(
      false
    );


  const [
    summaryError,
    setSummaryError,
  ] =
    useState(
      ""
    );


  const [
    cancelingRequestId,
    setCancelingRequestId,
  ] =
    useState<
      string
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


  async function loadSummary(
    runId:
      string
  ) {

    setSummaryLoading(
      true
    );


    setSummaryError(
      ""
    );


    try {

      const response =
        await fetch(
          `/api/ozon/fbo-supply-summary?run_id=${encodeURIComponent(
            runId
          )}`,
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
          SupplySummaryPayload;


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

        setSummary(
          data
        );

      }

    } catch (
      summaryRequestError
    ) {

      if (
        mountedRef.current
      ) {

        setSummaryError(
          summaryRequestError
            instanceof Error
            ? summaryRequestError.message
            : String(
                summaryRequestError
              )
        );

      }

    } finally {

      if (
        mountedRef.current
      ) {

        setSummaryLoading(
          false
        );

      }

    }

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


  async function recreateOrder(
    requestId:
      string,

    clusterId:
      number,

    clusterName:
      string
  ) {

    if (
      cancelingRequestId
      ||
      starting
      ||
      processing
    ) {

      return;

    }


    if (
      !window.confirm(
        `Пересоздать заявку «${clusterName}»? Текущая заявка в Ozon будет отменена, после чего сразу создастся новая.`
      )
    ) {

      return;

    }


    setCancelingRequestId(
      requestId
    );


    setError(
      ""
    );


    try {

      const cancelResponse =
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
                    "cancel_order",

                  request_id:
                    requestId,
                }
              ),

            cache:
              "no-store",
          }
        );


      const cancelled =
        await cancelResponse
          .json() as
          StatusPayload;


      if (
        !cancelResponse.ok
        ||
        cancelled.ok !==
          true
      ) {

        throw new Error(
          cancelled.error
          ??
          `HTTP ${cancelResponse.status}`
        );

      }


      setStatus(
        cancelled
      );


      setCancelingRequestId(
        null
      );


      await start(
        [
          clusterId,
        ]
      );

    } catch (
      recreateError
    ) {

      setError(
        recreateError
          instanceof Error
          ? recreateError.message
          : String(
              recreateError
            )
      );


      setCancelingRequestId(
        null
      );

    }

  }


  async function cancelOrder(
    requestId:
      string,

    clusterName:
      string
  ) {

    if (
      cancelingRequestId
    ) {

      return;

    }


    if (
      !window.confirm(
        `Удалить заявку «${clusterName}» в Ozon? После подтверждения её можно будет создать заново.`
      )
    ) {

      return;

    }


    setCancelingRequestId(
      requestId
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
                    "cancel_order",

                  request_id:
                    requestId,
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
        data.run?.id
      ) {

        void loadSummary(
          data.run.id
        );

      }


      router.refresh();

    } catch (
      cancelError
    ) {

      setError(
        cancelError
          instanceof Error
          ? cancelError.message
          : String(
              cancelError
            )
      );

    } finally {

      setCancelingRequestId(
        null
      );

    }

  }


  async function runCargoAction(
    requestId:
      string,

    action:
      "preview"
      |
      "create"
  ) {

    if (
      cargoLoadingId
    ) {

      return;

    }


    setCargoLoadingId(
      requestId
    );


    setCargoErrors(
      current => ({
        ...current,

        [requestId]:
          "",
      })
    );


    try {

      const response =
        await fetch(
          "/api/ozon/fbo-cargoes",
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
                  action,

                  request_id:
                    requestId,
                }
              ),

            cache:
              "no-store",
          }
        );


      const data =
        await response
          .json() as
          CargoPayload;


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


      setCargoPlans(
        current => ({
          ...current,

          [requestId]:
            data,
        })
      );

    } catch (
      cargoError
    ) {

      setCargoErrors(
        current => ({
          ...current,

          [requestId]:
            cargoError
              instanceof Error
              ? cargoError.message
              : String(
                  cargoError
                ),
        })
      );

    } finally {

      setCargoLoadingId(
        null
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
              calculationRunId
              &&
              pairsWithNeed >
                0
            ) {

              // При открытии страницы ничего не создаём и не продолжаем автоматически.
              // Сначала всегда показываем все рассчитанные варианты,
              // а запуск конкретной заявки остаётся явным действием пользователя.
              void runPreview();

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


  useEffect(
    () => {

      const timer =
        window.setInterval(
          () => {

            if (
              !mountedRef.current
              ||
              loopRef.current
              ||
              document.visibilityState !==
                "visible"
            ) {

              return;

            }


            void loadStatus()
              .catch(
                syncError => {

                  if (
                    mountedRef.current
                  ) {

                    setError(
                      syncError
                        instanceof Error
                        ? syncError.message
                        : String(
                            syncError
                          )
                    );

                  }

                }
              );

          },
          15000
        );


      return () => {

        window.clearInterval(
          timer
        );

      };

      // Автосверка наличия заявок в Ozon.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );


  const summarySignature =
    (
      status
        ?.requests
      ??
      []
    )
      .filter(
        row =>
          Boolean(
            row.ozon_order_id
          )
      )
      .map(
        row =>
          [
            row.id,
            row.status,
            row.ozon_order_id,
          ].join(
            ":"
          )
      )
      .sort()
      .join(
        "|"
      );


  useEffect(
    () => {

      const runId =
        status
          ?.run
          ?.id;


      if (
        !runId
        ||
        !summarySignature
      ) {

        setSummary(
          null
        );


        return;

      }


      void loadSummary(
        runId
      );

      // Сводка зависит только от состава созданных заявок.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      status
        ?.run
        ?.id,
      summarySignature,
    ]
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
    creatableClusterIds.length >
      0
    &&
    !starting
    &&
    !processing
    &&
    !previewLoading;


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

    <WorkspaceCollapsiblePanel
      tone="ozon"
      icon="supply"
      title="Автосоздание поставок FBO"
      subtitle="Потребность, короба, склад и таймслоты по кластерам."
      className=
        "ozon-fbo-supply-section"
    >

      <div
        className=
          "ozon-fbo-supply-content"
      >

        <div
          className=
            "ozon-fbo-supply-head"
        >

          <div>

            <div
              className=
                "reason-text"
            >
            Сначала тест показывает потребность,
            короба, склад и таймслоты по кластерам.
            Сначала автоматически показываем все варианты
            с расчётом потребности. Реальная cross-dock заявка
            создаётся только по кнопке выбранного кластера.
            Статусы существующих заявок автоматически
            сверяются с Ozon каждые 15 секунд.
          </div>


          <div
            className=
              "reason-text"
          >
            Маршрут: МСК ФБС → Внуково →
            кластер размещения. Таймслот ищем
            не раньше +3 суток и берём ближайший доступный.
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
                : "не раньше +3 суток"
            }
          </strong>
        </div>

      </div>


      <FboNestedDisclosure
        title="Кластер подтверждаем сейчас, склад внутри него выбирает Ozon"
      >

                <div
                  className=
                    "reason-text"
                >
                  Потребность рассчитана на уровне кластера.
                  После нажатия «Создать заявку» backend создаёт
                  cross-dock draft только для этого кластера.
                  По текущему формату Ozon сам распределяет товар
                  по доступным складам хранения внутри выбранного кластера.
                  Мы ищем ближайший доступный слот не раньше,
                  чем через 3 суток от даты формирования.
                  После бронирования заявки грузоместа BOX/PALLET
                  создаются автоматически по зоне размещения, литражу
                  и фактическому составу Ozon.
                </div>


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
                  ≤ 0,5 короба → 0:{" "}
                  <strong>
                    {
                      formatNumber(
                        preview.summary.zero_half_or_less_items
                      )
                    }
                  </strong>
                </span>
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
                    <span>Распределение Ozon</span>
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
                          (
                            request
                            &&
                            cancelingRequestId ===
                              request.id
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

                                      if (
                                        request
                                        &&
                                        request.status ===
                                          "success"
                                      ) {

                                        void recreateOrder(
                                          request.id,
                                          cluster.macrolocal_cluster_id,
                                          cluster.cluster_name
                                          ??
                                          `Кластер ${cluster.macrolocal_cluster_id}`
                                        );


                                        return;

                                      }


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
                                      ? "Пересоздать заявку"

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
                                                  ? " · ≤ 0,5 короба → 0"

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

                  alignItems:
                    "center",

                  justifyContent:
                    "flex-end",

                  gap:
                    "12px",

                  flexWrap:
                    "wrap",
                }}
              >
                <div
                  className=
                    "reason-text"
                >
                  {
                    creatableClusterIds.length >
                      0
                      ? `Доступно к созданию: ${creatableClusterIds.length} кластеров. Можно выбрать заявки по одной или запустить все доступные.`
                      : "Нет новых доступных кластеров для создания"
                  }
                </div>


                {
                  creatableClusterIds.length >
                    0
                    ? (
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
                            ||
                            processing
                            ? "Создаём заявки..."
                            : `Создать все заявки (${creatableClusterIds.length})`
                        }
                      </button>
                    )
                    : null
                }
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

      </FboNestedDisclosure>


      <FboNestedDisclosure
        title="Нужно дозаполнить упаковочные данные"
      >

        <div
          className=
            "reason-text"
        >
          Отсутствие размеров или веса не блокирует
          расчёт и создание заявки. Если вложимость
          известна, позиция уже включается с расчётным
          количеством. Без вложимости позиция остаётся
          в потребности, но временно не включается
          в заявку, потому что коробную кратность
          посчитать нельзя.
        </div>


        {
          preview
          &&
          preview.ok
          &&
          preview.summary
            ? (
              (
                preview.packaging_attention
                ??
                []
              ).length >
                0
                ? (
                  <div
                    className=
                      "ozon-fbo-packaging-attention-content"
                  >
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
                : (
                  <div
                    className=
                      "reason-text"

                    style={{
                      marginTop:
                        "10px",
                    }}
                  >
                    По текущему расчёту товаров, требующих
                    дозаполнения упаковочных данных, нет.
                  </div>
                )
            )
            : (
              <div
                className=
                  "reason-text"

                style={{
                  marginTop:
                    "10px",
                }}
              >
                После запуска теста здесь появится список
                товаров, для которых нужно дозаполнить
                упаковочные данные.
              </div>
            )
        }

      </FboNestedDisclosure>


      {
        summaryLoading
        ||
        summary
        ||
        summaryError
          ? (
            <div
              className=
                "reason-box"

              style={{
                marginBottom:
                  "16px",
              }}
            >
              <strong>
                Итог по созданным заявкам
              </strong>


              {
                summaryLoading
                  ? (
                    <div
                      className=
                        "reason-text"

                      style={{
                        marginTop:
                          "8px",
                      }}
                    >
                      Считаем грузоместа, транспортные паллеты, объём и вес...
                    </div>
                  )
                  : null
              }


              {
                summary
                  ? (
                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "repeat(6, minmax(120px, 1fr))",

                        gap:
                          "10px",

                        marginTop:
                          "10px",
                      }}
                    >
                      <div className="ozon-fbo-supply-fact">
                        <span>PALLET ГМ</span>
                        <strong>{formatNumber(summary.pallet_gm)}</strong>
                      </div>

                      <div className="ozon-fbo-supply-fact">
                        <span>BOX ГМ</span>
                        <strong>{formatNumber(summary.box_gm)}</strong>
                      </div>

                      <div className="ozon-fbo-supply-fact">
                        <span>Паллеты с BOX</span>
                        <strong>{formatNumber(summary.transport_pallets_for_boxes)}</strong>
                      </div>

                      <div className="ozon-fbo-supply-fact">
                        <span>Объём</span>
                        <strong>
                          {
                            summary.total_volume_m3 !==
                              undefined
                              ? `${summary.total_volume_m3.toLocaleString(
                                  "ru-RU",
                                  {
                                    maximumFractionDigits:
                                      3,
                                  }
                                )} м³`
                              : "—"
                          }
                        </strong>
                      </div>

                      <div className="ozon-fbo-supply-fact">
                        <span>Вес</span>
                        <strong>
                          {
                            summary.total_weight_kg !==
                              null
                            &&
                            summary.total_weight_kg !==
                              undefined
                              ? `${summary.total_weight_kg.toLocaleString(
                                  "ru-RU",
                                  {
                                    maximumFractionDigits:
                                      1,
                                  }
                                )} кг`
                              : `${(
                                  summary.known_weight_kg
                                  ??
                                  0
                                ).toLocaleString(
                                  "ru-RU",
                                  {
                                    maximumFractionDigits:
                                      1,
                                  }
                                )} кг + пропуски`
                          }
                        </strong>
                      </div>

                      <div className="ozon-fbo-supply-fact">
                        <span>Макс. высота</span>
                        <strong>
                          {
                            summary.max_height_cm !==
                              null
                            &&
                            summary.max_height_cm !==
                              undefined
                              ? `${summary.max_height_cm.toLocaleString(
                                  "ru-RU",
                                  {
                                    maximumFractionDigits:
                                      1,
                                  }
                                )} см`
                              : "—"
                          }
                        </strong>
                      </div>
                    </div>
                  )
                  : null
              }


              {
                summary
                &&
                (
                  (
                    summary.missing_weight_cartons
                    ??
                    0
                  ) >
                    0
                  ||
                  (
                    summary.transport_unplaced_boxes
                    ??
                    0
                  ) >
                    0
                  ||
                  (
                    summary.errors
                    ?.length
                    ??
                    0
                  ) >
                    0
                )
                  ? (
                    <div
                      className=
                        "reason-text"

                      style={{
                        marginTop:
                          "8px",
                      }}
                    >
                      {
                        (
                          summary.missing_weight_cartons
                          ??
                          0
                        ) >
                          0
                          ? `Без веса: ${summary.missing_weight_cartons} коробов. `
                          : ""
                      }

                      {
                        (
                          summary.transport_unplaced_boxes
                          ??
                          0
                        ) >
                          0
                          ? `Не удалось уложить на транспортные паллеты: ${summary.transport_unplaced_boxes} BOX. `
                          : ""
                      }

                      {
                        (
                          summary.errors
                          ?.length
                          ??
                          0
                        ) >
                          0
                          ? `Не посчитано заявок: ${summary.errors?.length ?? 0}.`
                          : ""
                      }
                    </div>
                  )
                  : null
              }


              {
                summaryError
                  ? (
                    <div
                      className=
                        "ozon-fbo-supply-error"

                      style={{
                        marginTop:
                          "8px",
                      }}
                    >
                      {summaryError}
                    </div>
                  )
                  : null
              }
            </div>
          )
          : null
      }


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
                        <div>
                          {
                            row.error_message
                            ??
                            "—"
                          }
                        </div>

                        <button
                          type="button"

                          className=
                            "secondary-button"

                          style={{
                            marginTop:
                              "8px",
                          }}

                          disabled={
                            starting
                            ||
                            processing
                          }

                          onClick={
                            () => {
                              void start(
                                [
                                  Number(
                                    row.macrolocal_cluster_id
                                  ),
                                ]
                              );
                            }
                          }
                        >
                          {
                            row.ozon_order_id
                              ? "Повторить грузоместа"
                              : "Повторить заявку"
                          }
                        </button>
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
                    row => {

                      const cargoPlan =
                        cargoPlans[
                          row.id
                        ];

                      const cargoError =
                        cargoErrors[
                          row.id
                        ];

                      const cargoLoading =
                        cargoLoadingId ===
                        row.id;

                      const existingCargoes =
                        (
                          cargoPlan
                            ?.supplies
                          ??
                          []
                        ).reduce(
                          (
                            sum,
                            supply
                          ) =>
                            sum
                            +
                            supply.existing_cargoes,
                          0
                        );

                      const cargoBlocked =
                        (
                          cargoPlan
                            ?.blockers
                          ??
                          []
                        ).length >
                          0;


                      return (
                        <div
                          key={
                            row.id
                          }
                        >
                          <div
                            className=
                              "ozon-fbo-supply-row ozon-fbo-supply-success-row"
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


                            <span>
                              <div
                                style={{
                                  display:
                                    "flex",

                                  flexDirection:
                                    "column",

                                  gap:
                                    "6px",
                                }}
                              >
                                <button
                                  type="button"

                                  className=
                                    "secondary-button"

                                  disabled={
                                    cargoLoading
                                  }

                                  onClick={
                                    () => {
                                      void runCargoAction(
                                        row.id,
                                        "preview"
                                      );
                                    }
                                  }
                                >
                                  {
                                    cargoLoading
                                      ? "Проверяем..."
                                      : cargoPlan
                                        ?.created
                                        ? `Создано ${cargoPlan.created_boxes ?? cargoPlan.total_boxes ?? 0}`
                                        : "Грузоместа"
                                  }
                                </button>

                                <button
                                  type="button"

                                  className=
                                    "secondary-button"

                                  style={{
                                    borderColor:
                                      "#b42318",

                                    color:
                                      "#b42318",
                                  }}

                                  disabled={
                                    cancelingRequestId ===
                                      row.id
                                  }

                                  onClick={
                                    () => {
                                      void cancelOrder(
                                        row.id,
                                        row.cluster_name
                                        ??
                                        `Кластер ${row.macrolocal_cluster_id}`
                                      );
                                    }
                                  }
                                >
                                  {
                                    cancelingRequestId ===
                                      row.id
                                      ? "Удаляем..."
                                      : "Удалить заявку"
                                  }
                                </button>
                              </div>
                            </span>

                          </div>


                          {
                            cargoError
                              ? (
                                <div
                                  className=
                                    "ozon-fbo-supply-error"

                                  style={{
                                    margin:
                                      "8px 0 12px",
                                  }}
                                >
                                  {cargoError}
                                </div>
                              )
                              : null
                          }


                          {
                            cargoPlan
                              ? (
                                <div
                                  className=
                                    "reason-box"

                                  style={{
                                    margin:
                                      "8px 0 14px",
                                  }}
                                >
                                  <strong>
                                    {
                                      cargoPlan.created
                                        ? "Грузоместа созданы"
                                        : `План грузомест: ${cargoPlan.total_boxes ?? 0} коробов`
                                    }
                                  </strong>


                                  <div
                                    className=
                                      "reason-text"

                                    style={{
                                      marginTop:
                                        "6px",
                                    }}
                                  >
                                    Ozon order:{" "}
                                    <strong>
                                      {
                                        cargoPlan.order_id
                                        ??
                                        row.ozon_order_id
                                        ??
                                        "—"
                                      }
                                    </strong>

                                    {" · "}

                                    Поставок внутри заявки:{" "}
                                    <strong>
                                      {
                                        cargoPlan.supply_count
                                        ??
                                        cargoPlan.supplies
                                          ?.length
                                        ??
                                        0
                                      }
                                    </strong>
                                  </div>


                                  {
                                    (
                                      cargoPlan.supplies
                                      ??
                                      []
                                    ).map(
                                      supply => (
                                        <div
                                          key={
                                            supply.supply_id
                                          }

                                          className=
                                            "reason-text"

                                          style={{
                                            marginTop:
                                              "6px",
                                          }}
                                        >
                                          <strong>
                                            Поставка {supply.supply_id}
                                          </strong>

                                          {" · "}

                                          {supply.box_count} коробов

                                          {" · "}

                                          {formatNumber(
                                            supply.unit_count
                                          )} шт.

                                          {
                                            supply.existing_cargoes >
                                              0
                                              ? ` · уже есть ГМ: ${supply.existing_cargoes}`
                                              : ""
                                          }
                                        </div>
                                      )
                                    )
                                  }


                                  {
                                    (
                                      cargoPlan.blockers
                                      ??
                                      []
                                    ).map(
                                      blocker => (
                                        <div
                                          key={
                                            blocker
                                          }

                                          style={{
                                            color:
                                              "#b42318",

                                            marginTop:
                                              "5px",

                                            fontSize:
                                              "11px",
                                          }}
                                        >
                                          {blocker}
                                        </div>
                                      )
                                    )
                                  }


                                  {
                                    !cargoPlan.created
                                    &&
                                    !cargoBlocked
                                    &&
                                    existingCargoes ===
                                      0
                                      ? (
                                        <button
                                          type="button"

                                          className=
                                            "primary-button"

                                          style={{
                                            marginTop:
                                              "10px",
                                          }}

                                          disabled={
                                            cargoLoading
                                          }

                                          onClick={
                                            () => {
                                              void runCargoAction(
                                                row.id,
                                                "create"
                                              );
                                            }
                                          }
                                        >
                                          {
                                            cargoLoading
                                              ? "Создаём..."
                                              : `Создать ${cargoPlan.total_boxes ?? 0} грузомест`
                                          }
                                        </button>
                                      )
                                      : null
                                  }


                                  {
                                    !cargoPlan.created
                                    &&
                                    existingCargoes >
                                      0
                                      ? (
                                        <div
                                          className=
                                            "reason-text"

                                          style={{
                                            marginTop:
                                              "8px",
                                          }}
                                        >
                                          В Ozon уже есть грузоместа. Автоматическая перезапись отключена, чтобы не сбить уже созданные cargo_id и этикетки.
                                        </div>
                                      )
                                      : null
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

          )
          : null
      }

      </div>

    </WorkspaceCollapsiblePanel>

  );

}
