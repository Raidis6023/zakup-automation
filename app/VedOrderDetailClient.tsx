"use client";

import {
  Fragment,
  useEffect,
  useState,
} from "react";


// ============================================================
// TYPES: ORDER
// ============================================================

type VedOrder = {
  id: string;
  order_number: string | null;
  status: string;
  workflow_status: string;

  created_by_name: string | null;

  preparation_department: string | null;
  preparation_responsible_name: string | null;
  ved_responsible_name: string | null;

  calculation_scenario: string | null;
  transport_mode: string | null;
  transport_variant: string | null;

  transport_units: number | null;
  selected_capacity_m3: number | null;
  new_products_volume_m3: number;

  first_sent_to_ved_at: string | null;
  last_sent_to_ved_at: string | null;

  production_handoff_date: string | null;
  production_confirmed_at: string | null;

  expected_arrival_date: string | null;
  actual_arrival_date: string | null;

  created_at: string;
  updated_at: string;
};


type VedOrderItem = {
  id: string;
  product_id: string | null;

  status: string;
  item_kind: string;

  chinese_article_snapshot: string | null;
  our_article_snapshot: string | null;
  product_name_snapshot: string | null;

  photo_url: string | null;

  priority_group: string | null;
  position_sort: number | null;

  demand_container_units: number | null;
  demand_truck_units: number | null;
  selected_demand_units: number | null;

  moq_quantity: number | null;
  moq_confirmed_at: string | null;

  unit_price_cny: number | null;
  price_confirmed_at: string | null;

  moq_excess_review_required: boolean;
  moq_review_status: string;

  units_per_carton_snapshot: number | null;
  carton_volume_m3_snapshot: number | null;
  carton_weight_kg_snapshot: number | null;

  cartons: number | null;
  order_quantity: number;

  coverage_after_order_days: number | null;

  is_partial_fill: boolean;
  manual_cartons_override: boolean;

  incoterm: string | null;
  port: string | null;

  analytics_comment: string | null;
  ved_comment: string | null;

  total_price_cny: number | null;
  total_volume_m3: number | null;
  total_weight_tons: number | null;

  quantity: number;
};


type VedOrderTotals = {
  items_count: number;
  total_units: number;
  total_cartons: number;
  total_price_cny: number;
  total_volume_m3: number;
  total_weight_tons: number;
};


type VedOrderStatistics = {
  items_count: number;
  terms_confirmed: number;
  terms_pending: number;
  moq_review_pending: number;
  ready_for_transport: number;
  missing_chinese_article: number;
  missing_weight: number;
};


type VedOrderResponse = {
  ok: boolean;
  error?: string;

  order?: VedOrder;
  totals?: VedOrderTotals;
  statistics?: VedOrderStatistics;
  items?: VedOrderItem[];
};


// ============================================================
// TYPES: MOQ / PRICE
// ============================================================

type TermsPreview = {
  ok: boolean;
  error?: string;

  item_id?: string;

  selected_demand_units?: number;

  standard_cartons?: number;
  standard_quantity?: number;

  final_cartons?: number;
  final_quantity?: number;

  coverage_after_order_days?: number | null;
  target_coverage_days?: number;

  moq_review_required?: boolean;

  total_price_cny?: number;
  total_volume_m3?: number | null;
  total_weight_tons?: number | null;
};


// ============================================================
// TYPES: PREPARATION
// ============================================================

type PreparationResponse = {
  ok: boolean;
  error?: string;

  item_id?: string;

  our_article?: string | null;

  chinese_article?: string | null;

  carton_weight_kg?: number | null;
};


// ============================================================
// TYPES: HANDOFF
// ============================================================

type HandoffProblemItem = {
  item_id?: string;

  our_article?: string | null;
  product_name?: string | null;

  problems?: string[];
};


type HandoffReadiness = {
  ok: boolean;
  error?: string;

  order_id?: string;
  workflow_status?: string;

  ready?: boolean;

  total_items?: number;
  included_items?: number;
  excluded_items?: number;

  problem_items?: HandoffProblemItem[];
};


type HandoffSendResponse = {
  ok: boolean;
  error?: string;

  sent?: boolean;

  order_id?: string;
  workflow_status?: string;

  readiness?: HandoffReadiness;
};


// ============================================================
// EDITORS
// ============================================================

type ItemEditorState = {
  chineseArticle: string;
  cartonWeightKg: string;

  moq: string;
  price: string;

  loadingPreparation: boolean;
  loadingPreview: boolean;
  loadingConfirm: boolean;
  loadingReview: boolean;

  error: string;

  preview: TermsPreview | null;
};


type EditorsState = {
  [itemId: string]:
    ItemEditorState;
};


// ============================================================
// HELPERS
// ============================================================

function formatNumber(
  value:
    number
    | null
    | undefined,

  digits = 0
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  return Number(value)
    .toLocaleString(
      "ru-RU",
      {
        maximumFractionDigits:
          digits,
      }
    );

}


function formatDate(
  value:
    string
    | null
    | undefined
) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date
    .toLocaleDateString(
      "ru-RU"
    );

}


function parsePositiveNumber(
  value:
    string
):
  number | null {

  const normalized =
    value
      .trim()
      .replace(
        /\s/g,
        ""
      )
      .replace(
        ",",
        "."
      );


  if (!normalized) {

    return null;

  }


  const parsed =
    Number(
      normalized
    );


  if (
    !Number.isFinite(parsed)
    ||
    parsed <= 0
  ) {

    return null;

  }


  return parsed;

}


function getWorkflowLabel(
  status:
    string
) {

  switch (status) {

    case "draft":
      return "Черновик";

    case "sent_to_ved":
      return "Передан в ВЭД";

    case "ved_in_work":
      return "В работе ВЭД";

    case "returned_for_edit":
      return "Возвращён на редактирование";

    case "production_confirmed":
      return "Передан в производство";

    case "in_transit":
      return "В пути";

    case "arrived":
      return "Прибыл";

    case "rejected":
      return "Отклонён";

    case "cancelled":
      return "Отменён";

    default:
      return status;

  }

}


function getTermsStatus(
  item:
    VedOrderItem
) {

  if (
    !item.moq_confirmed_at
    ||
    !item.price_confirmed_at
  ) {

    return "Требует подтверждения";

  }


  if (
    item.moq_review_status ===
    "pending"
  ) {

    return "Требует решения";

  }


  if (
    item.moq_review_status ===
    "rejected"
  ) {

    return "Не заказывать";

  }


  if (
    item.order_quantity > 0
  ) {

    return "Готов к заказу";

  }


  return "Условия подтверждены";

}


// ============================================================
// PHOTO
// ============================================================

function ProductPhoto(
  {
    url,
    article,
  }:
  {
    url: string | null;
    article: string | null;
  }
) {

  const photoUrl =
    url?.trim();


  if (!photoUrl) {

    return (

      <div
        style={{
          width:
            "74px",

          height:
            "74px",

          border:
            "1px solid var(--border)",

          borderRadius:
            "10px",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          textAlign:
            "center",

          padding:
            "6px",

          fontSize:
            "11px",

          color:
            "var(--muted)",
        }}
      >

        Нет фото

      </div>

    );

  }


  return (

    <a
      href={
        photoUrl
      }

      target="_blank"

      rel="noreferrer"

      title={
        article
          ? `Открыть фото ${article}`
          : "Открыть фото"
      }

      style={{
        display:
          "block",

        width:
          "74px",

        height:
          "74px",

        border:
          "1px solid var(--border)",

        borderRadius:
          "10px",

        overflow:
          "hidden",

        background:
          "var(--card)",

        textDecoration:
          "none",
      }}
    >

      <div
        style={{
          width:
            "100%",

          height:
            "100%",

          backgroundImage:
            `url("${photoUrl}")`,

          backgroundSize:
            "contain",

          backgroundPosition:
            "center",

          backgroundRepeat:
            "no-repeat",
        }}
      />

    </a>

  );

}


// ============================================================
// COMPONENT
// ============================================================

export default function VedOrderDetailClient(
  {
    orderId,
  }:
  {
    orderId:
      string;
  }
) {

  const [
    data,
    setData,
  ] =
    useState<VedOrderResponse | null>(
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
    error,
    setError,
  ] =
    useState(
      ""
    );


  const [
    editors,
    setEditors,
  ] =
    useState<EditorsState>(
      {}
    );


  const [
    handoff,
    setHandoff,
  ] =
    useState<HandoffReadiness | null>(
      null
    );


  const [
    loadingHandoff,
    setLoadingHandoff,
  ] =
    useState(
      false
    );


  const [
    sendingHandoff,
    setSendingHandoff,
  ] =
    useState(
      false
    );


  const [
    handoffError,
    setHandoffError,
  ] =
    useState(
      ""
    );


  const [
    handoffMessage,
    setHandoffMessage,
  ] =
    useState(
      ""
    );


  // ==========================================================
  // LOAD ORDER
  // ==========================================================

  async function loadOrder() {

    setLoading(
      true
    );

    setError(
      ""
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/${orderId}`,
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );


      const result:
        VedOrderResponse =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось получить заказ"
        );

      }


      setData(
        result
      );


      const nextEditors:
        EditorsState =
          {};


      for (
        const item
        of result.items ?? []
      ) {

        nextEditors[
          item.id
        ] = {

          chineseArticle:
            item
              .chinese_article_snapshot
            ??
            "",

          cartonWeightKg:
            item
              .carton_weight_kg_snapshot
            === null

              ? ""

              : String(
                  item
                    .carton_weight_kg_snapshot
                ),

          moq:
            item
              .moq_quantity ===
            null

              ? ""

              : String(
                  item.moq_quantity
                ),

          price:
            item
              .unit_price_cny ===
            null

              ? ""

              : String(
                  item.unit_price_cny
                ),

          loadingPreparation:
            false,

          loadingPreview:
            false,

          loadingConfirm:
            false,

          loadingReview:
            false,

          error:
            "",

          preview:
            null,
        };

      }


      setEditors(
        nextEditors
      );


    } catch (
      caughtError
    ) {

      setError(

        caughtError
        instanceof Error

          ? caughtError.message

          : "Неизвестная ошибка"

      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // ==========================================================
  // HANDOFF READINESS
  // ==========================================================

  async function loadHandoffReadiness() {

    setLoadingHandoff(
      true
    );

    setHandoffError(
      ""
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/${orderId}/handoff`,
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );


      const result:
        HandoffReadiness =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось проверить готовность заказа"
        );

      }


      setHandoff(
        result
      );


    } catch (
      caughtError
    ) {

      setHandoffError(

        caughtError
        instanceof Error

          ? caughtError.message

          : "Неизвестная ошибка проверки готовности"

      );

    } finally {

      setLoadingHandoff(
        false
      );

    }

  }


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(
    () => {

      void loadOrder();

      void loadHandoffReadiness();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      orderId,
    ]
  );


  async function refreshAll() {

    await loadOrder();

    await loadHandoffReadiness();

  }


  // ==========================================================
  // EDITOR
  // ==========================================================

  function updateEditor(
    itemId:
      string,

    patch:
      Partial<ItemEditorState>
  ) {

    setEditors(
      (
        current
      ) => ({

        ...current,

        [itemId]: {

          ...(current[itemId] ?? {

            chineseArticle:
              "",

            cartonWeightKg:
              "",

            moq:
              "",

            price:
              "",

            loadingPreparation:
              false,

            loadingPreview:
              false,

            loadingConfirm:
              false,

            loadingReview:
              false,

            error:
              "",

            preview:
              null,

          }),

          ...patch,

        },

      })
    );

  }


  function getActor() {

    const actorName =
      data
        ?.order
        ?.preparation_responsible_name
        ?.trim();


    const actorRole =
      data
        ?.order
        ?.preparation_department ===
        "procurement"

        ? "procurement"

        : "analytics";


    return {
      actorName,
      actorRole,
    };

  }


  // ==========================================================
  // PREPARATION DATA
  // ==========================================================

  async function savePreparationData(
    item:
      VedOrderItem
  ) {

    const editor =
      editors[
        item.id
      ];


    if (!editor) {

      return;

    }


    const chineseArticle =
      editor
        .chineseArticle
        .trim();


    if (!chineseArticle) {

      updateEditor(
        item.id,
        {
          error:
            "Укажите китайский артикул",
        }
      );

      return;

    }


    const cartonWeightKg =
      parsePositiveNumber(
        editor.cartonWeightKg
      );


    if (
      cartonWeightKg === null
    ) {

      updateEditor(
        item.id,
        {
          error:
            "Укажите вес транспортного короба",
        }
      );

      return;

    }


    const {
      actorName,
      actorRole,
    } =
      getActor();


    if (!actorName) {

      updateEditor(
        item.id,
        {
          error:
            "У заказа не указан ответственный сотрудник",
        }
      );

      return;

    }


    updateEditor(
      item.id,
      {
        loadingPreparation:
          true,

        error:
          "",
      }
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/items/${item.id}/preparation`,
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
                  chineseArticle,

                  cartonWeightKg,

                  actorName,

                  actorUserId:
                    null,

                  actorRole,
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        PreparationResponse =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось сохранить данные позиции"
        );

      }


      await refreshAll();


    } catch (
      caughtError
    ) {

      updateEditor(
        item.id,
        {
          error:

            caughtError
            instanceof Error

              ? caughtError.message

              : "Неизвестная ошибка сохранения",
        }
      );

    } finally {

      updateEditor(
        item.id,
        {
          loadingPreparation:
            false,
        }
      );

    }

  }


  // ==========================================================
  // PREVIEW TERMS
  // ==========================================================

  async function previewTerms(
    item:
      VedOrderItem
  ) {

    const editor =
      editors[
        item.id
      ];


    if (!editor) {

      return;

    }


    const moq =
      parsePositiveNumber(
        editor.moq
      );


    const price =
      parsePositiveNumber(
        editor.price
      );


    if (
      moq === null
      ||
      !Number.isInteger(
        moq
      )
    ) {

      updateEditor(
        item.id,
        {
          error:
            "MOQ должен быть целым числом больше 0",
        }
      );

      return;

    }


    if (
      price === null
    ) {

      updateEditor(
        item.id,
        {
          error:
            "Укажите цену за единицу в юанях",
        }
      );

      return;

    }


    updateEditor(
      item.id,
      {
        loadingPreview:
          true,

        error:
          "",

        preview:
          null,
      }
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/items/${item.id}/terms`,
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
                    "preview",

                  moqQuantity:
                    moq,

                  unitPriceCny:
                    price,
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        TermsPreview =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось выполнить расчёт"
        );

      }


      updateEditor(
        item.id,
        {
          preview:
            result,

          error:
            "",
        }
      );


    } catch (
      caughtError
    ) {

      updateEditor(
        item.id,
        {
          error:

            caughtError
            instanceof Error

              ? caughtError.message

              : "Неизвестная ошибка расчёта",
        }
      );

    } finally {

      updateEditor(
        item.id,
        {
          loadingPreview:
            false,
        }
      );

    }

  }


  // ==========================================================
  // CONFIRM TERMS
  // ==========================================================

  async function confirmTerms(
    item:
      VedOrderItem
  ) {

    const editor =
      editors[
        item.id
      ];


    if (!editor) {

      return;

    }


    const moq =
      parsePositiveNumber(
        editor.moq
      );


    const price =
      parsePositiveNumber(
        editor.price
      );


    if (
      moq === null
      ||
      !Number.isInteger(
        moq
      )
    ) {

      updateEditor(
        item.id,
        {
          error:
            "MOQ должен быть целым числом больше 0",
        }
      );

      return;

    }


    if (
      price === null
    ) {

      updateEditor(
        item.id,
        {
          error:
            "Укажите цену за единицу в юанях",
        }
      );

      return;

    }


    const {
      actorName,
      actorRole,
    } =
      getActor();


    if (!actorName) {

      updateEditor(
        item.id,
        {
          error:
            "У заказа не указан ответственный сотрудник",
        }
      );

      return;

    }


    updateEditor(
      item.id,
      {
        loadingConfirm:
          true,

        error:
          "",
      }
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/items/${item.id}/terms`,
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
                    "confirm",

                  moqQuantity:
                    moq,

                  unitPriceCny:
                    price,

                  actorName,

                  actorUserId:
                    null,

                  actorRole,
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        TermsPreview =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось подтвердить MOQ и цену"
        );

      }


      await refreshAll();


    } catch (
      caughtError
    ) {

      updateEditor(
        item.id,
        {
          error:

            caughtError
            instanceof Error

              ? caughtError.message

              : "Неизвестная ошибка подтверждения",
        }
      );

    } finally {

      updateEditor(
        item.id,
        {
          loadingConfirm:
            false,
        }
      );

    }

  }


  // ==========================================================
  // MOQ REVIEW
  // ==========================================================

  async function resolveMoqReview(
    item:
      VedOrderItem,

    decision:
      "approve"
      |
      "reject"
  ) {

    const {
      actorName,
      actorRole,
    } =
      getActor();


    if (!actorName) {

      updateEditor(
        item.id,
        {
          error:
            "У заказа не указан ответственный сотрудник",
        }
      );

      return;

    }


    updateEditor(
      item.id,
      {
        loadingReview:
          true,

        error:
          "",
      }
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/items/${item.id}/moq-review`,
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
                  decision,

                  actorName,

                  actorUserId:
                    null,

                  actorRole,

                  comment:
                    null,
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        TermsPreview =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось сохранить решение по MOQ"
        );

      }


      await refreshAll();


    } catch (
      caughtError
    ) {

      updateEditor(
        item.id,
        {
          error:

            caughtError
            instanceof Error

              ? caughtError.message

              : "Неизвестная ошибка решения по MOQ",
        }
      );

    } finally {

      updateEditor(
        item.id,
        {
          loadingReview:
            false,
        }
      );

    }

  }


  // ==========================================================
  // SEND TO VED
  // ==========================================================

  async function sendToVed() {

    if (
      !handoff
      ||
      !handoff.ready
    ) {

      setHandoffError(
        "Заказ пока не готов к передаче в ВЭД"
      );

      return;

    }


    const {
      actorName,
      actorRole,
    } =
      getActor();


    if (!actorName) {

      setHandoffError(
        "У заказа не указан ответственный сотрудник"
      );

      return;

    }


    setSendingHandoff(
      true
    );

    setHandoffError(
      ""
    );

    setHandoffMessage(
      ""
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/${orderId}/handoff`,
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
                  actorName,

                  actorUserId:
                    null,

                  actorRole,
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        HandoffSendResponse =
          await response.json();


      if (!response.ok) {

        throw new Error(
          result.error
          ||
          "Не удалось передать заказ в ВЭД"
        );

      }


      if (
        !result.ok
        ||
        !result.sent
      ) {

        if (
          result.readiness
        ) {

          setHandoff(
            result.readiness
          );

        }


        throw new Error(
          result.error
          ||
          "Заказ не готов к передаче в ВЭД"
        );

      }


      setHandoffMessage(
        "Заказ успешно передан в ВЭД"
      );


      await refreshAll();


    } catch (
      caughtError
    ) {

      setHandoffError(

        caughtError
        instanceof Error

          ? caughtError.message

          : "Неизвестная ошибка передачи заказа"

      );

    } finally {

      setSendingHandoff(
        false
      );

    }

  }


  // ==========================================================
  // LOADING / ERROR
  // ==========================================================

  if (loading) {

    return (

      <section className="section">

        <div className="muted">
          Загружаем заказ...
        </div>

      </section>

    );

  }


  if (
    error
    ||
    !data
    ||
    !data.order
  ) {

    return (

      <section className="section">

        <h2 className="section-title">
          Не удалось открыть заказ
        </h2>

        <div className="reason-box">

          <div className="reason-text">
            {error || "Заказ не найден"}
          </div>

        </div>

      </section>

    );

  }


  const order =
    data.order;


  const totals =
    data.totals;


  const statistics =
    data.statistics;


  const items =
    data.items
    ??
    [];


  const canSendToVedStatus =
    order.workflow_status ===
      "draft"
    ||
    order.workflow_status ===
      "returned_for_edit";


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <>


      {/* HEADER */}

      <section className="section">

        <div className="small-label">
          ЗАКАЗ В КИТАЙ
        </div>


        <h2
          className="section-title"

          style={{
            fontSize:
              "28px",

            marginTop:
              "8px",
          }}
        >

          {order.order_number

            ? `Заказ ${order.order_number}`

            : "Черновик заказа"}

        </h2>


        <div className="reason-text">

          Статус:{" "}

          <strong>

            {getWorkflowLabel(
              order.workflow_status
            )}

          </strong>

        </div>

      </section>


      {/* MAIN INFO */}

      <section className="summary-grid">

        <div className="card">

          <div className="card-label">
            Ответственный
          </div>

          <div className="big-number">

            {order
              .preparation_responsible_name
              ??
              "—"}

          </div>

          <div className="muted">

            {order
              .preparation_department ===
              "analytics"

              ? "Аналитика"

              : order
                  .preparation_department ===
                  "procurement"

                ? "Закуп"

                : "—"}

          </div>

        </div>


        <div className="card">

          <div className="card-label">
            Сценарий
          </div>

          <div className="big-number">

            {order
              .calculation_scenario ===
              "container"

              ? "Контейнер"

              : order
                  .calculation_scenario ===
                  "truck"

                ? "Фура"

                : "—"}

          </div>

          <div className="muted">

            {order
              .calculation_scenario ===
              "container"

              ? "Горизонт 100 дней"

              : order
                  .calculation_scenario ===
                  "truck"

                ? "Горизонт 70 дней"

                : ""}

          </div>

        </div>


        <div className="card">

          <div className="card-label">
            Создан
          </div>

          <div className="big-number">

            {formatDate(
              order.created_at
            )}

          </div>

        </div>


        <div className="card">

          <div className="card-label">
            Ответственный ВЭД
          </div>

          <div className="big-number">

            {order
              .ved_responsible_name
              ??
              "Не назначен"}

          </div>

        </div>

      </section>


      {/* READINESS SUMMARY */}

      {statistics && (

        <>

          <section className="section">

            <h2 className="section-title">
              Готовность заказа
            </h2>

          </section>


          <section className="summary-grid">

            <div className="card">

              <div className="card-label">
                Товаров
              </div>

              <div className="big-number">
                {formatNumber(
                  statistics.items_count
                )}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                MOQ + цена подтверждены
              </div>

              <div className="big-number">
                {formatNumber(
                  statistics.terms_confirmed
                )}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Ждут подтверждения
              </div>

              <div className="big-number">
                {formatNumber(
                  statistics.terms_pending
                )}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Готовы к транспорту
              </div>

              <div className="big-number">
                {formatNumber(
                  statistics.ready_for_transport
                )}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Нет китайского артикула
              </div>

              <div className="big-number">
                {formatNumber(
                  statistics
                    .missing_chinese_article
                )}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Нет веса короба
              </div>

              <div className="big-number">
                {formatNumber(
                  statistics.missing_weight
                )}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Проверка MOQ
              </div>

              <div className="big-number">
                {formatNumber(
                  statistics
                    .moq_review_pending
                )}
              </div>

            </div>

          </section>

        </>

      )}


      {/* TOTALS */}

      {totals && (

        <>

          <section className="section">

            <h2 className="section-title">
              Итоги текущего заказа
            </h2>

          </section>


          <section className="summary-grid">

            <div className="card">

              <div className="card-label">
                Коробов
              </div>

              <div className="big-number">
                {formatNumber(
                  totals.total_cartons
                )}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Единиц
              </div>

              <div className="big-number">
                {formatNumber(
                  totals.total_units
                )}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Стоимость
              </div>

              <div className="big-number">

                {formatNumber(
                  totals.total_price_cny,
                  2
                )} CNY

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Объём
              </div>

              <div className="big-number">

                {formatNumber(
                  totals.total_volume_m3,
                  3
                )} м³

              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Вес
              </div>

              <div className="big-number">

                {formatNumber(
                  totals.total_weight_tons,
                  3
                )} т

              </div>

            </div>

          </section>

        </>

      )}


      {/* HANDOFF */}

      <section className="section">

        <h2 className="section-title">
          Готовность к передаче в ВЭД
        </h2>


        {loadingHandoff && (

          <div className="muted">
            Проверяем готовность заказа...
          </div>

        )}


        {!loadingHandoff
          &&
          handoff && (

          <>

            <div className="reason-box">

              <div className="reason-text">

                Включено в заказ:{" "}

                <strong>
                  {formatNumber(
                    handoff.included_items
                  )}
                </strong>

                {" "}из{" "}

                <strong>
                  {formatNumber(
                    handoff.total_items
                  )}
                </strong>

              </div>


              <div className="reason-text">

                Исключено вручную:{" "}

                <strong>
                  {formatNumber(
                    handoff.excluded_items
                  )}
                </strong>

              </div>


              <div
                style={{
                  marginTop:
                    "10px",

                  fontWeight:
                    700,
                }}
              >

                {handoff.ready

                  ? "Заказ готов к передаче в ВЭД"

                  : "Заказ пока не готов к передаче в ВЭД"}

              </div>

            </div>


            {!handoff.ready
              &&
              handoff.problem_items
              &&
              handoff.problem_items.length >
                0 && (

              <div
                style={{
                  display:
                    "grid",

                  gap:
                    "12px",

                  marginTop:
                    "16px",
                }}
              >

                {handoff
                  .problem_items
                  .map(
                    (
                      problemItem
                    ) => (

                      <div
                        key={
                          problemItem.item_id
                          ??
                          problemItem.our_article
                          ??
                          problemItem.product_name
                          ??
                          "problem"
                        }

                        className="card"
                      >

                        <div
                          style={{
                            fontWeight:
                              700,

                            marginBottom:
                              "6px",
                          }}
                        >

                          {problemItem
                            .our_article
                            ??
                            "Без нашего артикула"}

                        </div>


                        <div
                          className="muted"
                          style={{
                            marginBottom:
                              "8px",
                          }}
                        >

                          {problemItem
                            .product_name
                            ??
                            "Наименование не указано"}

                        </div>


                        <div
                          style={{
                            display:
                              "grid",

                            gap:
                              "5px",
                          }}
                        >

                          {problemItem
                            .problems
                            ?.map(
                              (
                                problem,
                                index
                              ) => (

                                <div
                                  key={
                                    `${problem}-${index}`
                                  }

                                  className="reason-text"
                                >
                                  • {problem}
                                </div>

                              )
                            )}

                        </div>

                      </div>

                    )
                  )}

              </div>

            )}


            <div
              style={{
                display:
                  "flex",

                gap:
                  "10px",

                flexWrap:
                  "wrap",

                marginTop:
                  "16px",
              }}
            >

              <button
                type="button"

                className=
                  "secondary-button"

                disabled={
                  loadingHandoff
                  ||
                  sendingHandoff
                }

                onClick={
                  () => {

                    void loadHandoffReadiness();

                  }
                }
              >

                {loadingHandoff
                  ? "Проверяем..."
                  : "Проверить готовность"}

              </button>


              {canSendToVedStatus && (

                <button
                  type="button"

                  className=
                    "primary-button"

                  disabled={
                    !handoff.ready
                    ||
                    sendingHandoff
                    ||
                    loadingHandoff
                  }

                  onClick={
                    () => {

                      void sendToVed();

                    }
                  }
                >

                  {sendingHandoff
                    ? "Передаём..."
                    : "Передать в ВЭД"}

                </button>

              )}

            </div>

          </>

        )}


        {handoffError && (

          <div
            style={{
              marginTop:
                "12px",

              color:
                "#d64545",

              fontWeight:
                600,
            }}
          >

            {handoffError}

          </div>

        )}


        {handoffMessage && (

          <div
            style={{
              marginTop:
                "12px",

              fontWeight:
                700,
            }}
          >

            {handoffMessage}

          </div>

        )}

      </section>


      {/* ITEMS */}

      <section className="section">

        <h2 className="section-title">
          Товары заказа
        </h2>


        <div className="reason-text">

          Нажмите на фотографию,
          чтобы открыть её в полном размере.

        </div>


        <div
          style={{
            overflowX:
              "auto",

            marginTop:
              "18px",
          }}
        >

          <table
            style={{
              width:
                "100%",

              minWidth:
                "2580px",

              borderCollapse:
                "collapse",

              fontSize:
                "13px",
            }}
          >

            <thead>

              <tr>

                {[
                  "Фото",
                  "Китайский арт.",
                  "Наш артикул",
                  "Товар",

                  "Потребность 100",
                  "Потребность 70",
                  "Выбрано",

                  "В коробе",
                  "Вес кор., кг",

                  "MOQ",
                  "Цена CNY",

                  "Статус",

                  "Коробов",
                  "К заказу",

                  "Покрытие",
                  "Стоимость",
                  "Объём, м³",
                  "Вес, т",

                  "Действия",
                ].map(
                  (
                    title
                  ) => (

                    <th
                      key={
                        title
                      }

                      style={{
                        textAlign:
                          "left",

                        padding:
                          "10px",

                        whiteSpace:
                          "nowrap",
                      }}
                    >

                      {title}

                    </th>

                  )
                )}

              </tr>

            </thead>


            <tbody>

              {items.map(
                (
                  item
                ) => {

                  const editor =
                    editors[
                      item.id
                    ];


                  const termsStatus =
                    getTermsStatus(
                      item
                    );


                  const preview =
                    editor
                      ?.preview;


                  const busy =
                    Boolean(

                      editor
                        ?.loadingPreparation

                      ||

                      editor
                        ?.loadingPreview

                      ||

                      editor
                        ?.loadingConfirm

                      ||

                      editor
                        ?.loadingReview

                    );


                  const chineseArticleLocked =
                    Boolean(
                      item
                        .chinese_article_snapshot
                    );


                  return (

                    <Fragment
                      key={
                        item.id
                      }
                    >

                      <tr>


                        {/* PHOTO */}

                        <td
                          style={{
                            padding:
                              "10px",

                            width:
                              "95px",
                          }}
                        >

                          <ProductPhoto
                            url={
                              item.photo_url
                            }

                            article={
                              item.our_article_snapshot
                            }
                          />

                        </td>


                        {/* CHINESE ARTICLE */}

                        <td
                          style={{
                            padding:
                              "10px",

                            minWidth:
                              "150px",
                          }}
                        >

                          <input
                            type="text"

                            value={
                              editor
                                ?.chineseArticle
                              ??
                              ""
                            }

                            disabled={
                              busy
                              ||
                              chineseArticleLocked
                            }

                            title={
                              chineseArticleLocked

                                ? "Китайский артикул уже зафиксирован"

                                : "Введите китайский артикул"
                            }

                            placeholder=
                              "Китайский арт."

                            onChange={
                              (
                                event
                              ) => {

                                updateEditor(
                                  item.id,
                                  {
                                    chineseArticle:
                                      event
                                        .target
                                        .value,

                                    error:
                                      "",
                                  }
                                );

                              }
                            }

                            style={{
                              width:
                                "140px",

                              minHeight:
                                "38px",

                              padding:
                                "0 10px",

                              borderRadius:
                                "8px",

                              border:
                                "1px solid var(--border)",

                              background:
                                chineseArticleLocked
                                  ? "var(--card)"
                                  : "var(--background)",

                              color:
                                "var(--text)",
                            }}
                          />

                        </td>


                        {/* OUR ARTICLE */}

                        <td
                          style={{
                            padding:
                              "10px",

                            fontWeight:
                              600,

                            whiteSpace:
                              "nowrap",
                          }}
                        >

                          {item
                            .our_article_snapshot
                            ??
                            "—"}

                        </td>


                        {/* PRODUCT */}

                        <td
                          style={{
                            padding:
                              "10px",

                            minWidth:
                              "300px",
                          }}
                        >

                          {item
                            .product_name_snapshot
                            ??
                            "—"}

                        </td>


                        {/* DEMANDS */}

                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {formatNumber(
                            item
                              .demand_container_units
                          )}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {formatNumber(
                            item
                              .demand_truck_units
                          )}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",

                            fontWeight:
                              600,
                          }}
                        >

                          {formatNumber(
                            item
                              .selected_demand_units
                          )}

                        </td>


                        {/* PACKING */}

                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {formatNumber(
                            item
                              .units_per_carton_snapshot
                          )}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >

                          <input
                            type="text"

                            inputMode=
                              "decimal"

                            value={
                              editor
                                ?.cartonWeightKg
                              ??
                              ""
                            }

                            disabled={
                              busy
                            }

                            placeholder=
                              "кг"

                            onChange={
                              (
                                event
                              ) => {

                                updateEditor(
                                  item.id,
                                  {
                                    cartonWeightKg:
                                      event
                                        .target
                                        .value,

                                    error:
                                      "",
                                  }
                                );

                              }
                            }

                            style={{
                              width:
                                "95px",

                              minHeight:
                                "38px",

                              padding:
                                "0 10px",

                              borderRadius:
                                "8px",

                              border:
                                "1px solid var(--border)",

                              background:
                                "var(--background)",

                              color:
                                "var(--text)",
                            }}
                          />

                        </td>


                        {/* MOQ */}

                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >

                          <input
                            type="text"

                            inputMode=
                              "numeric"

                            value={
                              editor
                                ?.moq
                              ??
                              ""
                            }

                            disabled={
                              busy
                            }

                            onChange={
                              (
                                event
                              ) => {

                                updateEditor(
                                  item.id,
                                  {
                                    moq:
                                      event
                                        .target
                                        .value,

                                    preview:
                                      null,

                                    error:
                                      "",
                                  }
                                );

                              }
                            }

                            style={{
                              width:
                                "100px",

                              minHeight:
                                "38px",

                              padding:
                                "0 10px",

                              borderRadius:
                                "8px",

                              border:
                                "1px solid var(--border)",

                              background:
                                "var(--background)",

                              color:
                                "var(--text)",
                            }}
                          />

                        </td>


                        {/* PRICE */}

                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >

                          <input
                            type="text"

                            inputMode=
                              "decimal"

                            value={
                              editor
                                ?.price
                              ??
                              ""
                            }

                            disabled={
                              busy
                            }

                            onChange={
                              (
                                event
                              ) => {

                                updateEditor(
                                  item.id,
                                  {
                                    price:
                                      event
                                        .target
                                        .value,

                                    preview:
                                      null,

                                    error:
                                      "",
                                  }
                                );

                              }
                            }

                            style={{
                              width:
                                "105px",

                              minHeight:
                                "38px",

                              padding:
                                "0 10px",

                              borderRadius:
                                "8px",

                              border:
                                "1px solid var(--border)",

                              background:
                                "var(--background)",

                              color:
                                "var(--text)",
                            }}
                          />

                        </td>


                        {/* STATUS */}

                        <td
                          style={{
                            padding:
                              "10px",

                            minWidth:
                              "165px",
                          }}
                        >

                          {termsStatus}

                        </td>


                        {/* FINAL */}

                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {formatNumber(
                            item.cartons
                          )}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",

                            fontWeight:
                              700,
                          }}
                        >

                          {formatNumber(
                            item
                              .order_quantity
                          )}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {item
                            .coverage_after_order_days
                            === null

                            ? "—"

                            : `${formatNumber(
                                item
                                  .coverage_after_order_days,
                                1
                              )} дн.`}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {item
                            .total_price_cny
                            === null

                            ? "—"

                            : `${formatNumber(
                                item
                                  .total_price_cny,
                                2
                              )} CNY`}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {formatNumber(
                            item
                              .total_volume_m3,
                            6
                          )}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >

                          {formatNumber(
                            item
                              .total_weight_tons,
                            6
                          )}

                        </td>


                        {/* ACTIONS */}

                        <td
                          style={{
                            padding:
                              "10px",

                            minWidth:
                              "310px",
                          }}
                        >

                          <div
                            style={{
                              display:
                                "flex",

                              gap:
                                "8px",

                              flexWrap:
                                "wrap",
                            }}
                          >

                            <button
                              type="button"

                              className=
                                "secondary-button"

                              disabled={
                                busy
                              }

                              onClick={
                                () => {

                                  void savePreparationData(
                                    item
                                  );

                                }
                              }
                            >

                              {editor
                                ?.loadingPreparation

                                ? "Сохраняем..."

                                : "Сохранить данные"}

                            </button>


                            <button
                              type="button"

                              className=
                                "secondary-button"

                              disabled={
                                busy
                              }

                              onClick={
                                () => {

                                  void previewTerms(
                                    item
                                  );

                                }
                              }
                            >

                              {editor
                                ?.loadingPreview

                                ? "Считаем..."

                                : "Рассчитать"}

                            </button>


                            {preview
                              &&
                              item
                                .moq_review_status
                                !==
                                "pending" && (

                              <button
                                type="button"

                                className=
                                  "primary-button"

                                disabled={
                                  busy
                                }

                                onClick={
                                  () => {

                                    void confirmTerms(
                                      item
                                    );

                                  }
                                }
                              >

                                {editor
                                  ?.loadingConfirm

                                  ? "Подтверждаем..."

                                  : "Подтвердить"}

                              </button>

                            )}


                            {item
                              .moq_review_status ===
                              "pending"
                              &&
                              preview && (

                              <>

                                <button
                                  type="button"

                                  className=
                                    "primary-button"

                                  disabled={
                                    busy
                                  }

                                  onClick={
                                    () => {

                                      void resolveMoqReview(
                                        item,
                                        "approve"
                                      );

                                    }
                                  }
                                >

                                  {editor
                                    ?.loadingReview

                                    ? "Сохраняем..."

                                    : "Включить в заказ"}

                                </button>


                                <button
                                  type="button"

                                  className=
                                    "secondary-button"

                                  disabled={
                                    busy
                                  }

                                  onClick={
                                    () => {

                                      void resolveMoqReview(
                                        item,
                                        "reject"
                                      );

                                    }
                                  }
                                >

                                  Не заказывать

                                </button>

                              </>

                            )}

                          </div>


                          {item
                            .moq_review_status ===
                            "pending"
                            &&
                            !preview && (

                            <div
                              className="muted"

                              style={{
                                marginTop:
                                  "8px",
                              }}
                            >

                              Нажмите «Рассчитать»,
                              чтобы принять решение по MOQ.

                            </div>

                          )}


                          {editor
                            ?.error && (

                            <div
                              style={{
                                marginTop:
                                  "8px",

                                color:
                                  "#d64545",

                                maxWidth:
                                  "300px",
                              }}
                            >

                              {editor.error}

                            </div>

                          )}

                        </td>

                      </tr>


                      {/* PREVIEW */}

                      {preview && (

                        <tr>

                          <td
                            colSpan={
                              19
                            }

                            style={{
                              padding:
                                "14px 20px 20px",

                              background:
                                "var(--card)",
                            }}
                          >

                            <div className="small-label">
                              ПРЕДВАРИТЕЛЬНЫЙ РАСЧЁТ
                            </div>


                            <div
                              style={{
                                display:
                                  "grid",

                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(150px, 1fr))",

                                gap:
                                  "12px",

                                marginTop:
                                  "12px",
                              }}
                            >

                              <div>

                                <div className="card-label">
                                  Потребность
                                </div>

                                <strong>

                                  {formatNumber(
                                    preview
                                      .selected_demand_units
                                  )}

                                </strong>

                              </div>


                              <div>

                                <div className="card-label">
                                  Обычное округление
                                </div>

                                <strong>

                                  {formatNumber(
                                    preview
                                      .standard_cartons
                                  )} кор.

                                </strong>

                                <div className="muted">

                                  {formatNumber(
                                    preview
                                      .standard_quantity
                                  )} шт.

                                </div>

                              </div>


                              <div>

                                <div className="card-label">
                                  После MOQ
                                </div>

                                <strong>

                                  {formatNumber(
                                    preview
                                      .final_cartons
                                  )} кор.

                                </strong>

                                <div className="muted">

                                  {formatNumber(
                                    preview
                                      .final_quantity
                                  )} шт.

                                </div>

                              </div>


                              <div>

                                <div className="card-label">
                                  Покрытие после заказа
                                </div>

                                <strong>

                                  {preview
                                    .coverage_after_order_days
                                    === null
                                    ||
                                    preview
                                      .coverage_after_order_days
                                      === undefined

                                    ? "—"

                                    : `${formatNumber(
                                        preview
                                          .coverage_after_order_days,
                                        1
                                      )} дн.`}

                                </strong>

                                <div className="muted">

                                  Цель:{" "}

                                  {formatNumber(
                                    preview
                                      .target_coverage_days
                                  )} дн.

                                </div>

                              </div>


                              <div>

                                <div className="card-label">
                                  Стоимость
                                </div>

                                <strong>

                                  {formatNumber(
                                    preview
                                      .total_price_cny,
                                    2
                                  )} CNY

                                </strong>

                              </div>


                              <div>

                                <div className="card-label">
                                  Объём
                                </div>

                                <strong>

                                  {formatNumber(
                                    preview
                                      .total_volume_m3,
                                    6
                                  )} м³

                                </strong>

                              </div>


                              <div>

                                <div className="card-label">
                                  Вес
                                </div>

                                <strong>

                                  {formatNumber(
                                    preview
                                      .total_weight_tons,
                                    6
                                  )} т

                                </strong>

                              </div>

                            </div>


                            {preview
                              .moq_review_required && (

                              <div
                                className="reason-box"

                                style={{
                                  marginTop:
                                    "14px",
                                }}
                              >

                                <strong>
                                  Требуется ручное решение по MOQ
                                </strong>


                                <div className="reason-text">

                                  MOQ увеличивает количество
                                  относительно обычного расчёта,
                                  а запас после поставки превышает
                                  целевой горизонт.

                                </div>

                              </div>

                            )}


                            {!preview
                              .moq_review_required && (

                              <div
                                className="muted"

                                style={{
                                  marginTop:
                                    "14px",
                                }}
                              >

                                MOQ не требует отдельного решения.
                                После подтверждения товар
                                автоматически попадёт в заказ.

                              </div>

                            )}

                          </td>

                        </tr>

                      )}

                    </Fragment>

                  );

                }
              )}

            </tbody>

          </table>

        </div>


        <div
          className="muted"

          style={{
            marginTop:
              "14px",
          }}
        >

          Фото сохранено в позиции текущего заказа.
          Нажмите на изображение для просмотра оригинала.

        </div>

      </section>


      {/* DATES */}

      <section className="section">

        <h2 className="section-title">
          Даты заказа
        </h2>


        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(200px, 1fr))",

            gap:
              "18px",
          }}
        >

          <div>

            <div className="card-label">
              Передан в ВЭД
            </div>

            <strong>
              {formatDate(
                order.first_sent_to_ved_at
              )}
            </strong>

          </div>


          <div>

            <div className="card-label">
              Передан в производство
            </div>

            <strong>
              {formatDate(
                order.production_handoff_date
              )}
            </strong>

          </div>


          <div>

            <div className="card-label">
              Ожидаемое прибытие
            </div>

            <strong>
              {formatDate(
                order.expected_arrival_date
              )}
            </strong>

          </div>


          <div>

            <div className="card-label">
              Фактическое прибытие
            </div>

            <strong>
              {formatDate(
                order.actual_arrival_date
              )}
            </strong>

          </div>

        </div>

      </section>

    </>

  );

}
