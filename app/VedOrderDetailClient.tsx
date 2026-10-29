"use client";

import Button from "./ui/Button";

import {
  useEffect,
  useState,
  Fragment,
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

  ved_responsible_user_id: string | null;
  ved_responsible_name: string | null;

  calculation_scenario: string | null;
  transport_mode: string | null;
  transport_variant: string | null;

  transport_units: number | null;
  selected_capacity_m3: number | null;
  new_products_volume_m3: number;

  first_sent_to_ved_at: string | null;
  last_sent_to_ved_at: string | null;

  ved_taken_at: string | null;

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
// PREPARATION TYPES
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


type PreparationResponse = {
  ok: boolean;
  error?: string;

  item_id?: string;

  chinese_article?: string | null;
  carton_weight_kg?: number | null;
};


// ============================================================
// VED TYPES
// ============================================================

type VedEditResponse = {
  ok: boolean;
  error?: string;

  item_id?: string;
  order_id?: string;

  our_article?: string | null;

  unit_price_cny?: number;
  units_per_carton?: number;

  carton_volume_m3?: number;
  carton_weight_kg?: number;

  order_quantity?: number;

  incoterm?: string;

  port?: string | null;
  ved_comment?: string | null;
};


type VedMoqResponse = {
  ok: boolean;
  error?: string;

  item_id?: string;
  order_id?: string;

  moq_quantity?: number;

  cartons?: number;
  order_quantity?: number;

  coverage_after_order_days?: number | null;

  moq_review_required?: boolean;
  moq_review_status?: string;

  total_price_cny?: number | null;
  total_volume_m3?: number | null;
  total_weight_tons?: number | null;
};


// ============================================================
// HANDOFF TYPES
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
// PREPARATION EDITORS
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
// VED EDITORS
// ============================================================

type VedEditorState = {
  ourArticle: string;

  unitPriceCny: string;

  unitsPerCarton: string;

  cartonVolumeM3: string;
  cartonWeightKg: string;

  moqQuantity: string;

  incoterm: string;

  port: string;

  vedComment: string;

  loading: boolean;
  loadingMoq: boolean;

  error: string;
};


type VedEditorsState = {
  [itemId: string]:
    VedEditorState;
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
    !Number.isFinite(
      parsed
    )
    ||
    parsed <= 0
  ) {

    return null;

  }


  return parsed;

}


function parsePositiveInteger(
  value:
    string
):
  number | null {

  const parsed =
    parsePositiveNumber(
      value
    );


  if (
    parsed === null
    ||
    !Number.isInteger(
      parsed
    )
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
    item.moq_review_status ===
    "rejected"
  ) {

    return "Не заказывать";

  }


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

    return "Решение по MOQ";

  }


  if (
    item.order_quantity > 0
  ) {

    return "Готов к заказу";

  }


  return "Условия подтверждены";

}


function getItemListStatus(
  item:
    VedOrderItem
) {

  if (
    item.moq_review_status ===
    "rejected"
  ) {

    return "Не заказывать";

  }


  if (
    item.moq_review_status ===
    "pending"
  ) {

    return "Решение по MOQ";

  }


  if (
    !item.moq_confirmed_at
    ||
    !item.price_confirmed_at
    ||
    !item.chinese_article_snapshot
    ||
    !item.carton_weight_kg_snapshot
    ||
    !item.photo_url
  ) {

    return "Нужно заполнить";

  }


  if (
    item.order_quantity > 0
  ) {

    return "Готов";

  }


  return "Подготовка";

}


// ============================================================
// SMALL UI
// ============================================================

function CompactMetric(
  {
    label,
    value,
  }:
  {
    label: string;
    value: string;
  }
) {

  return (

    <div
      style={{
        minWidth:
          "110px",

        padding:
          "10px 12px",

        border:
          "1px solid var(--border)",

        borderRadius:
          "10px",

        background:
          "var(--card)",
      }}
    >

      <div
        className="muted"

        style={{
          fontSize:
            "11px",

          marginBottom:
            "4px",
        }}
      >
        {label}
      </div>


      <div
        style={{
          fontSize:
            "17px",

          lineHeight:
            1.15,

          fontWeight:
            700,
        }}
      >
        {value}
      </div>

    </div>

  );

}


function ReadOnlyField(
  {
    label,
    value,
  }:
  {
    label: string;
    value: string;
  }
) {

  return (

    <div>

      <div
        className="card-label"

        style={{
          marginBottom:
            "6px",
        }}
      >
        {label}
      </div>


      <div
        style={{
          minHeight:
            "40px",

          display:
            "flex",

          alignItems:
            "center",

          padding:
            "0 11px",

          border:
            "1px solid var(--border)",

          borderRadius:
            "8px",
        }}
      >
        {value}
      </div>

    </div>

  );

}


function ProductPhoto(
  {
    url,
    article,
    size = 64,
  }:
  {
    url: string | null;
    article: string | null;
    size?: number;
  }
) {

  const photoUrl =
    url?.trim();


  if (!photoUrl) {

    return (

      <div
        style={{
          width:
            `${size}px`,

          height:
            `${size}px`,

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

          opacity:
            0.6,
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

      onClick={
        (
          event
        ) => {

          event.stopPropagation();

        }
      }

      style={{
        display:
          "block",

        width:
          `${size}px`,

        height:
          `${size}px`,

        flexShrink:
          0,

        border:
          "1px solid var(--border)",

        borderRadius:
          "10px",

        overflow:
          "hidden",

        background:
          "var(--card)",
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
    excelExportUrl,
    excelExportAvailable,
  }:
  {
    orderId: string;
    excelExportUrl?: string;
    excelExportAvailable?: boolean;
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
    vedEditors,
    setVedEditors,
  ] =
    useState<VedEditorsState>(
      {}
    );


  const [
    selectedItemId,
    setSelectedItemId,
  ] =
    useState<string | null>(
      null
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


  const [
    showProblems,
    setShowProblems,
  ] =
    useState(
      false
    );


  const [
    vedSaveMessage,
    setVedSaveMessage,
  ] =
    useState(
      ""
    );


  // ==========================================================
  // LOAD ORDER
  // ==========================================================

  async function loadOrder(
    showPageLoader =
      false
  ) {

    if (
      showPageLoader
    ) {

      setLoading(
        true
      );

    }


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


      const loadedItems =
        result.items
        ??
        [];


      const nextEditors:
        EditorsState =
          {};


      const nextVedEditors:
        VedEditorsState =
          {};


      for (
        const item
        of loadedItems
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
              .moq_quantity
            === null

              ? ""

              : String(
                  item
                    .moq_quantity
                ),

          price:
            item
              .unit_price_cny
            === null

              ? ""

              : String(
                  item
                    .unit_price_cny
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


        nextVedEditors[
          item.id
        ] = {

          ourArticle:
            item
              .our_article_snapshot
            ??
            "",

          unitPriceCny:
            item
              .unit_price_cny
            === null

              ? ""

              : String(
                  item
                    .unit_price_cny
                ),

          unitsPerCarton:
            item
              .units_per_carton_snapshot
            === null

              ? ""

              : String(
                  item
                    .units_per_carton_snapshot
                ),

          cartonVolumeM3:
            item
              .carton_volume_m3_snapshot
            === null

              ? ""

              : String(
                  item
                    .carton_volume_m3_snapshot
                ),

          cartonWeightKg:
            item
              .carton_weight_kg_snapshot
            === null

              ? ""

              : String(
                  item
                    .carton_weight_kg_snapshot
                ),

          moqQuantity:
            item
              .moq_quantity
            === null

              ? ""

              : String(
                  item
                    .moq_quantity
                ),

          incoterm:
            item.incoterm
            ??
            (
              result.order
                ?.calculation_scenario ===
                "truck"

                ? "FCA"

                : "FOB"
            ),

          port:
            item.port
            ??
            "",

          vedComment:
            item.ved_comment
            ??
            "",

          loading:
            false,

          loadingMoq:
            false,

          error:
            "",
        };

      }


      setEditors(
        nextEditors
      );


      setVedEditors(
        nextVedEditors
      );


      setSelectedItemId(
        (
          current
        ) => {

          if (
            current
            &&
            loadedItems.some(
              (
                item
              ) =>
                item.id ===
                current
            )
          ) {

            return current;

          }


          return null;

        }
      );


    } catch (
      caughtError
    ) {

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Неизвестная ошибка"
      );

    } finally {

      if (
        showPageLoader
      ) {

        setLoading(
          false
        );

      }

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
        caughtError instanceof Error
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

      void loadOrder(
        true
      );

      void loadHandoffReadiness();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      orderId,
    ]
  );


  async function refreshAll() {

    await Promise.all(
      [
        loadOrder(
          false
        ),

        loadHandoffReadiness(),
      ]
    );

  }


  // ==========================================================
  // UPDATE PREPARATION EDITOR
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

          ...(current[
            itemId
          ] ?? {

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


  // ==========================================================
  // UPDATE VED EDITOR
  // ==========================================================

  function updateVedEditor(
    itemId:
      string,

    patch:
      Partial<VedEditorState>
  ) {

    setVedEditors(
      (
        current
      ) => ({

        ...current,

        [itemId]: {

          ...(current[
            itemId
          ] ?? {

            ourArticle:
              "",

            unitPriceCny:
              "",

            unitsPerCarton:
              "",

            cartonVolumeM3:
              "",

            cartonWeightKg:
              "",

            moqQuantity:
              "",

            incoterm:
              "FOB",

            port:
              "",

            vedComment:
              "",

            loading:
              false,

            loadingMoq:
              false,

            error:
              "",

          }),

          ...patch,

        },

      })
    );

  }


  function getPreparationActor() {

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
  // SAVE PREPARATION
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
        editor
          .cartonWeightKg
      );


    if (
      cartonWeightKg ===
      null
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
      getPreparationActor();


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
            caughtError instanceof Error
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
            caughtError instanceof Error
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
      getPreparationActor();


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
            caughtError instanceof Error
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
      getPreparationActor();


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
            caughtError instanceof Error
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
  // SAVE VED DATA
  // ==========================================================

  async function saveVedItem(
    item:
      VedOrderItem
  ) {

    const editor =
      vedEditors[
        item.id
      ];


    if (!editor) {

      return;

    }


    const actorName =
      data
        ?.order
        ?.ved_responsible_name
        ?.trim();


    if (!actorName) {

      updateVedEditor(
        item.id,
        {
          error:
            "У заказа не назначен ответственный ВЭД",
        }
      );

      return;

    }


    const unitPriceCny =
      parsePositiveNumber(
        editor.unitPriceCny
      );


    if (
      unitPriceCny ===
      null
    ) {

      updateVedEditor(
        item.id,
        {
          error:
            "Укажите цену за 1 шт.",
        }
      );

      return;

    }


    const unitsPerCarton =
      parsePositiveInteger(
        editor.unitsPerCarton
      );


    if (
      unitsPerCarton ===
      null
    ) {

      updateVedEditor(
        item.id,
        {
          error:
            "Вложимость должна быть целым числом больше 0",
        }
      );

      return;

    }


    const cartonVolumeM3 =
      parsePositiveNumber(
        editor.cartonVolumeM3
      );


    if (
      cartonVolumeM3 ===
      null
    ) {

      updateVedEditor(
        item.id,
        {
          error:
            "Укажите объём транспортного короба",
        }
      );

      return;

    }


    const cartonWeightKg =
      parsePositiveNumber(
        editor.cartonWeightKg
      );


    if (
      cartonWeightKg ===
      null
    ) {

      updateVedEditor(
        item.id,
        {
          error:
            "Укажите вес транспортного короба",
        }
      );

      return;

    }


    const incoterm =
      editor
        .incoterm
        .trim()
        .toUpperCase();


    if (
      incoterm !==
        "FOB"
      &&
      incoterm !==
        "FCA"
    ) {

      updateVedEditor(
        item.id,
        {
          error:
            "Условия поставки должны быть FOB или FCA",
        }
      );

      return;

    }


    setVedSaveMessage(
      ""
    );


    updateVedEditor(
      item.id,
      {
        loading:
          true,

        error:
          "",
      }
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/items/${item.id}/ved-edit`,
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
                  ourArticle:
                    editor
                      .ourArticle
                      .trim()
                    ||
                    null,

                  unitPriceCny,

                  unitsPerCarton,

                  cartonVolumeM3,

                  cartonWeightKg,

                  incoterm,

                  port:
                    editor
                      .port
                      .trim()
                    ||
                    null,

                  vedComment:
                    editor
                      .vedComment
                      .trim()
                    ||
                    null,

                  actorName,

                  actorUserId:
                    data
                      ?.order
                      ?.ved_responsible_user_id
                    ??
                    null,

                  actorRole:
                    "ved",
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        VedEditResponse =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось сохранить изменения ВЭД"
        );

      }


      await refreshAll();


      setVedSaveMessage(
        "Изменения ВЭД сохранены"
      );


    } catch (
      caughtError
    ) {

      updateVedEditor(
        item.id,
        {
          error:
            caughtError instanceof Error
              ? caughtError.message
              : "Неизвестная ошибка сохранения ВЭД",
        }
      );

    } finally {

      updateVedEditor(
        item.id,
        {
          loading:
            false,
        }
      );

    }

  }


  // ==========================================================
  // SAVE VED MOQ
  // ==========================================================

  async function saveVedMoq(
    item:
      VedOrderItem
  ) {

    const editor =
      vedEditors[
        item.id
      ];


    if (!editor) {

      return;

    }


    if (
      data
        ?.order
        ?.workflow_status !==
        "ved_in_work"
    ) {

      updateVedEditor(
        item.id,
        {
          error:
            "MOQ можно менять только до передачи заказа в производство",
        }
      );

      return;

    }


    const actorName =
      data
        ?.order
        ?.ved_responsible_name
        ?.trim();


    if (!actorName) {

      updateVedEditor(
        item.id,
        {
          error:
            "У заказа не назначен ответственный ВЭД",
        }
      );

      return;

    }


    const moqQuantity =
      parsePositiveInteger(
        editor.moqQuantity
      );


    if (
      moqQuantity ===
      null
    ) {

      updateVedEditor(
        item.id,
        {
          error:
            "MOQ должен быть целым числом больше 0",
        }
      );

      return;

    }


    setVedSaveMessage(
      ""
    );


    updateVedEditor(
      item.id,
      {
        loadingMoq:
          true,

        error:
          "",
      }
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/items/${item.id}/ved-moq`,
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
                  moqQuantity,

                  actorName,

                  actorUserId:
                    data
                      ?.order
                      ?.ved_responsible_user_id
                    ??
                    null,

                  actorRole:
                    "ved",
                }
              ),

            cache:
              "no-store",
          }
        );


      const result:
        VedMoqResponse =
          await response.json();


      if (
        !response.ok
        ||
        !result.ok
      ) {

        throw new Error(
          result.error
          ||
          "Не удалось изменить MOQ"
        );

      }


      await refreshAll();


      setVedSaveMessage(
        `MOQ изменён на ${formatNumber(
          result.moq_quantity
        )}. Количество заказа пересчитано.`
      );


    } catch (
      caughtError
    ) {

      updateVedEditor(
        item.id,
        {
          error:
            caughtError instanceof Error
              ? caughtError.message
              : "Неизвестная ошибка изменения MOQ",
        }
      );

    } finally {

      updateVedEditor(
        item.id,
        {
          loadingMoq:
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
      getPreparationActor();


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
        caughtError instanceof Error
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
  // LOADING
  // ==========================================================

  if (
    loading
  ) {

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


  const selectedItem =
    items.find(
      (
        item
      ) =>
        item.id ===
        selectedItemId
    )
    ??
    null;


  const selectedEditor =
    selectedItem
      ? editors[
          selectedItem.id
        ]
      : null;


  const selectedVedEditor =
    selectedItem
      ? vedEditors[
          selectedItem.id
        ]
      : null;


  const selectedPreview =
    selectedEditor
      ?.preview
    ??
    null;


  const selectedBusy =
    Boolean(
      selectedEditor
        ?.loadingPreparation
      ||
      selectedEditor
        ?.loadingPreview
      ||
      selectedEditor
        ?.loadingConfirm
      ||
      selectedEditor
        ?.loadingReview
    );


  const selectedVedBusy =
    Boolean(
      selectedVedEditor
        ?.loading
      ||
      selectedVedEditor
        ?.loadingMoq
    );


  const chineseArticleLocked =
    Boolean(
      selectedItem
        ?.chinese_article_snapshot
    );


  const targetDays =
    order.calculation_scenario ===
      "container"

      ? 100

      : 70;


  const preparationEditable =
    order.workflow_status ===
      "draft"
    ||
    order.workflow_status ===
      "returned_for_edit";


  const vedWaiting =
    order.workflow_status ===
      "sent_to_ved";


  const vedEditable =
    order.workflow_status ===
      "ved_in_work"
    ||
    order.workflow_status ===
      "production_confirmed"
    ||
    order.workflow_status ===
      "in_transit";


  const vedMoqEditable =
    order.workflow_status ===
      "ved_in_work";


  const canSendToVedStatus =
    preparationEditable;


  const problemCount =
    handoff
      ?.problem_items
      ?.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          (
            item.problems
              ?.length
            ??
            0
          ),
        0
      )
    ??
    0;


  // Original item editor with MOQ, price, calculations and VED controls.
  // Mount only once, inside the currently expanded table row.
  const expandedItemDetail = selectedItem ? (
<section
          id="ved-order-item-detail"

          style={{
            padding: "14px 18px",
            margin: 0,
            background: "transparent",
          }}
        >

          <div
            style={{
              display:
                "flex",

              gap:
                "16px",

              alignItems:
                "flex-start",
            }}
          >

            <ProductPhoto
              url={
                selectedItem.photo_url
              }

              article={
                selectedItem
                  .our_article_snapshot
              }

              size={
                120
              }
            />


            <div
              style={{
                minWidth:
                  0,

                flex:
                  1,
              }}
            >

              <div className="small-label">
                КАРТОЧКА ТОВАРА
              </div>


              <h2
                style={{
                  margin:
                    "5px 0",

                  fontSize:
                    "22px",
                }}
              >
                {selectedItem
                  .our_article_snapshot
                  ??
                  "Без артикула"}
              </h2>


              <div
                style={{
                  fontWeight:
                    600,

                  lineHeight:
                    1.35,

                  maxWidth:
                    "800px",
                }}
              >
                {selectedItem
                  .product_name_snapshot
                  ??
                  "Наименование не указано"}
              </div>


              <div
                className="muted"

                style={{
                  marginTop:
                    "8px",
                }}
              >
                Статус:{" "}

                <strong>
                  {getTermsStatus(
                    selectedItem
                  )}
                </strong>
              </div>

            </div>

          </div>


          {/* ==================================================
              PREPARATION
              ================================================== */}

          {preparationEditable
            &&
            selectedEditor && (

            <>

              <div
                style={{
                  marginTop:
                    "22px",

                  paddingTop:
                    "18px",

                  borderTop:
                    "1px solid var(--border)",
                }}
              >

                <div
                  style={{
                    fontWeight:
                      700,

                    marginBottom:
                      "12px",
                  }}
                >
                  Данные товара
                </div>


                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(210px, 1fr))",

                    gap:
                      "14px",
                  }}
                >

                  <div>

                    <div
                      className="card-label"

                      style={{
                        marginBottom:
                          "6px",
                      }}
                    >
                      Китайский артикул
                    </div>


                    <input
                      type="text"

                      value={
                        selectedEditor
                          .chineseArticle
                      }

                      disabled={
                        selectedBusy
                        ||
                        chineseArticleLocked
                      }

                      placeholder=
                        "Введите китайский артикул"

                      onChange={
                        (
                          event
                        ) => {

                          updateEditor(
                            selectedItem.id,
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

                      className="ws-editor-input"
                    />

                  </div>


                  <ReadOnlyField
                    label="Наш артикул"
                    value={
                      selectedItem
                        .our_article_snapshot
                      ??
                      "—"
                    }
                  />


                  <div>

                    <div
                      className="card-label"

                      style={{
                        marginBottom:
                          "6px",
                      }}
                    >
                      Вес 1 короба, кг
                    </div>


                    <input
                      type="text"

                      inputMode="decimal"

                      value={
                        selectedEditor
                          .cartonWeightKg
                      }

                      disabled={
                        selectedBusy
                      }

                      placeholder="Вес"

                      onChange={
                        (
                          event
                        ) => {

                          updateEditor(
                            selectedItem.id,
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

                      className="ws-editor-input"
                    />

                  </div>


                  <ReadOnlyField
                    label="В 1 коробе"
                    value={
                      `${formatNumber(
                        selectedItem
                          .units_per_carton_snapshot
                      )} шт.`
                    }
                  />


                  <ReadOnlyField
                    label="Объём 1 короба"
                    value={
                      `${formatNumber(
                        selectedItem
                          .carton_volume_m3_snapshot,
                        6
                      )} м³`
                    }
                  />


                  <ReadOnlyField
                    label="Условия поставки"
                    value={
                      selectedItem
                        .incoterm
                      ??
                      "—"
                    }
                  />

                </div>


                <div
                  style={{
                    marginTop:
                      "12px",
                  }}
                >

                  <Button variant="secondary"
                    type="button"

                    

                    disabled={
                      selectedBusy
                    }

                    onClick={
                      () => {

                        void savePreparationData(
                          selectedItem
                        );

                      }
                    }
                  >

                    {selectedEditor
                      .loadingPreparation

                      ? "Сохраняем..."

                      : "Сохранить данные"}

                  </Button>

                </div>

              </div>


              <div
                style={{
                  marginTop:
                    "22px",

                  paddingTop:
                    "18px",

                  borderTop:
                    "1px solid var(--border)",
                }}
              >

                <div
                  style={{
                    fontWeight:
                      700,

                    marginBottom:
                      "12px",
                  }}
                >
                  Условия заказа
                </div>


                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(210px, 1fr))",

                    gap:
                      "14px",
                  }}
                >

                  <div>

                    <div
                      className="card-label"

                      style={{
                        marginBottom:
                          "6px",
                      }}
                    >
                      MOQ
                    </div>


                    <input
                      type="text"

                      inputMode="numeric"

                      value={
                        selectedEditor.moq
                      }

                      disabled={
                        selectedBusy
                      }

                      placeholder="MOQ"

                      onChange={
                        (
                          event
                        ) => {

                          updateEditor(
                            selectedItem.id,
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

                      className="ws-editor-input"
                    />

                  </div>


                  <div>

                    <div
                      className="card-label"

                      style={{
                        marginBottom:
                          "6px",
                      }}
                    >
                      Цена за 1 шт., CNY
                    </div>


                    <input
                      type="text"

                      inputMode="decimal"

                      value={
                        selectedEditor.price
                      }

                      disabled={
                        selectedBusy
                      }

                      placeholder="Цена"

                      onChange={
                        (
                          event
                        ) => {

                          updateEditor(
                            selectedItem.id,
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

                      className="ws-editor-input"
                    />

                  </div>


                  <ReadOnlyField
                    label="Порт"
                    value={
                      selectedItem.port
                      ??
                      "—"
                    }
                  />

                </div>


                <div
                  style={{
                    marginTop:
                      "18px",
                  }}
                >

                  <div
                    style={{
                      fontWeight:
                        700,

                      marginBottom:
                        "10px",
                    }}
                  >
                    Расчёт
                  </div>


                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(145px, 1fr))",

                      gap:
                        "8px",
                    }}
                  >

                    <CompactMetric
                      label="Потребность 100"
                      value={
                        `${formatNumber(
                          selectedItem
                            .demand_container_units
                        )} шт.`
                      }
                    />


                    <CompactMetric
                      label="Потребность 70"
                      value={
                        `${formatNumber(
                          selectedItem
                            .demand_truck_units
                        )} шт.`
                      }
                    />


                    <CompactMetric
                      label="Выбрано"
                      value={
                        `${formatNumber(
                          selectedItem
                            .selected_demand_units
                        )} шт.`
                      }
                    />


                    <CompactMetric
                      label="Целевой горизонт"
                      value={
                        `${targetDays} дн.`
                      }
                    />

                  </div>


                  {selectedPreview && (

                    <div
                      style={{
                        marginTop:
                          "12px",

                        padding:
                          "14px",

                        border:
                          "1px solid var(--border)",

                        borderRadius:
                          "10px",
                      }}
                    >

                      <div
                        style={{
                          display:
                            "grid",

                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",

                          gap:
                            "8px",
                        }}
                      >

                        <CompactMetric
                          label="Обычное округление"
                          value={
                            `${formatNumber(
                              selectedPreview
                                .standard_cartons
                            )} кор. / ${formatNumber(
                              selectedPreview
                                .standard_quantity
                            )} шт.`
                          }
                        />


                        <CompactMetric
                          label="После MOQ"
                          value={
                            `${formatNumber(
                              selectedPreview
                                .final_cartons
                            )} кор. / ${formatNumber(
                              selectedPreview
                                .final_quantity
                            )} шт.`
                          }
                        />


                        <CompactMetric
                          label="Покрытие"
                          value={
                            `${formatNumber(
                              selectedPreview
                                .coverage_after_order_days,
                              1
                            )} дн.`
                          }
                        />


                        <CompactMetric
                          label="Стоимость"
                          value={
                            `${formatNumber(
                              selectedPreview
                                .total_price_cny,
                              2
                            )} CNY`
                          }
                        />


                        <CompactMetric
                          label="Объём"
                          value={
                            `${formatNumber(
                              selectedPreview
                                .total_volume_m3,
                              6
                            )} м³`
                          }
                        />


                        <CompactMetric
                          label="Вес"
                          value={
                            `${formatNumber(
                              selectedPreview
                                .total_weight_tons,
                              6
                            )} т`
                          }
                        />

                      </div>

                    </div>

                  )}


                  <div
                    style={{
                      display:
                        "flex",

                      gap:
                        "9px",

                      flexWrap:
                        "wrap",

                      marginTop:
                        "12px",
                    }}
                  >

                    <Button variant="secondary"
                      type="button"

                      

                      disabled={
                        selectedBusy
                      }

                      onClick={
                        () => {

                          void previewTerms(
                            selectedItem
                          );

                        }
                      }
                    >
                      Рассчитать
                    </Button>


                    {selectedPreview
                      &&
                      selectedItem
                        .moq_review_status !==
                        "pending" && (

                      <Button
                        type="button"

                        

                        disabled={
                          selectedBusy
                        }

                        onClick={
                          () => {

                            void confirmTerms(
                              selectedItem
                            );

                          }
                        }
                      >
                        Подтвердить MOQ и цену
                      </Button>

                    )}


                    {selectedItem
                      .moq_review_status ===
                      "pending"
                      &&
                      selectedPreview && (

                      <>

                        <Button
                          type="button"

                          

                          disabled={
                            selectedBusy
                          }

                          onClick={
                            () => {

                              void resolveMoqReview(
                                selectedItem,
                                "approve"
                              );

                            }
                          }
                        >
                          Включить в заказ
                        </Button>


                        <Button variant="secondary"
                          type="button"

                          

                          disabled={
                            selectedBusy
                          }

                          onClick={
                            () => {

                              void resolveMoqReview(
                                selectedItem,
                                "reject"
                              );

                            }
                          }
                        >
                          Не заказывать
                        </Button>

                      </>

                    )}

                  </div>


                  {selectedEditor.error && (

                    <div
                      style={{
                        marginTop:
                          "10px",

                        color:
                          "#d64545",

                        fontWeight:
                          600,
                      }}
                    >
                      {selectedEditor.error}
                    </div>

                  )}

                </div>

              </div>

            </>

          )}


          {/* ==================================================
              WAITING FOR VED
              ================================================== */}

          {vedWaiting && (

            <div
              className="reason-box"

              style={{
                marginTop:
                  "22px",
              }}
            >

              <strong>
                Заказ передан в ВЭД
              </strong>


              <div className="reason-text">
                Редактирование позиции станет доступно после того,
                как сотрудник ВЭД нажмёт «Взять в работу».
              </div>

            </div>

          )}


          {/* ==================================================
              VED MODE
              ================================================== */}

          {vedEditable
            &&
            selectedVedEditor && (

            <div
              style={{
                marginTop:
                  "22px",

                paddingTop:
                  "18px",

                borderTop:
                  "1px solid var(--border)",
              }}
            >

              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  gap:
                    "12px",

                  alignItems:
                    "center",

                  flexWrap:
                    "wrap",

                  marginBottom:
                    "14px",
                }}
              >

                <div>

                  <div
                    style={{
                      fontWeight:
                        700,

                      fontSize:
                        "17px",
                    }}
                  >
                    Работа ВЭД
                  </div>


                  <div
                    className="muted"

                    style={{
                      marginTop:
                        "3px",
                    }}
                  >
                    Ответственный:{" "}

                    {order
                      .ved_responsible_name
                      ??
                      "—"}
                  </div>

                </div>


                <div
                  style={{
                    padding:
                      "5px 9px",

                    border:
                      "1px solid var(--border)",

                    borderRadius:
                      "999px",

                    fontSize:
                      "12px",

                    fontWeight:
                      700,
                  }}
                >
                  {getWorkflowLabel(
                    order.workflow_status
                  )}
                </div>

              </div>


              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",

                  gap:
                    "14px",
                }}
              >

                <div>

                  <div
                    className="card-label"

                    style={{
                      marginBottom:
                        "6px",
                    }}
                  >
                    Наш артикул
                  </div>


                  <input
                    type="text"

                    value={
                      selectedVedEditor
                        .ourArticle
                    }

                    disabled={
                      selectedVedBusy
                      ||
                      (
                        selectedItem.item_kind ===
                          "existing"
                        &&
                        Boolean(
                          selectedItem
                            .our_article_snapshot
                        )
                      )
                    }

                    onChange={
                      (
                        event
                      ) => {

                        updateVedEditor(
                          selectedItem.id,
                          {
                            ourArticle:
                              event
                                .target
                                .value,

                            error:
                              "",
                          }
                        );

                      }
                    }

                    className="ws-editor-input"
                  />

                </div>


                <ReadOnlyField
                  label="Китайский артикул"
                  value={
                    selectedItem
                      .chinese_article_snapshot
                    ??
                    "—"
                  }
                />


                <div>

                  <div
                    className="card-label"

                    style={{
                      marginBottom:
                        "6px",
                    }}
                  >
                    Цена за 1 шт., CNY
                  </div>


                  <input
                    type="text"

                    inputMode="decimal"

                    value={
                      selectedVedEditor
                        .unitPriceCny
                    }

                    disabled={
                      selectedVedBusy
                    }

                    onChange={
                      (
                        event
                      ) => {

                        updateVedEditor(
                          selectedItem.id,
                          {
                            unitPriceCny:
                              event
                                .target
                                .value,

                            error:
                              "",
                          }
                        );

                      }
                    }

                    className="ws-editor-input"
                  />

                </div>


                {/* =================================================
                    MOQ
                    ================================================= */}

                {vedMoqEditable ? (

                  <div>

                    <div
                      className="card-label"

                      style={{
                        marginBottom:
                          "6px",
                      }}
                    >
                      MOQ
                    </div>


                    <input
                      type="text"

                      inputMode="numeric"

                      value={
                        selectedVedEditor
                          .moqQuantity
                      }

                      disabled={
                        selectedVedBusy
                      }

                      onChange={
                        (
                          event
                        ) => {

                          updateVedEditor(
                            selectedItem.id,
                            {
                              moqQuantity:
                                event
                                  .target
                                  .value,

                              error:
                                "",
                            }
                          );

                        }
                      }

                      className="ws-editor-input"
                    />

                  </div>

                ) : (

                  <ReadOnlyField
                    label="MOQ"
                    value={
                      formatNumber(
                        selectedItem
                          .moq_quantity
                      )
                    }
                  />

                )}


                <div>

                  <div
                    className="card-label"

                    style={{
                      marginBottom:
                        "6px",
                    }}
                  >
                    В 1 коробе, шт.
                  </div>


                  <input
                    type="text"

                    inputMode="numeric"

                    value={
                      selectedVedEditor
                        .unitsPerCarton
                    }

                    disabled={
                      selectedVedBusy
                    }

                    onChange={
                      (
                        event
                      ) => {

                        updateVedEditor(
                          selectedItem.id,
                          {
                            unitsPerCarton:
                              event
                                .target
                                .value,

                            error:
                              "",
                          }
                        );

                      }
                    }

                    className="ws-editor-input"
                  />

                </div>


                <div>

                  <div
                    className="card-label"

                    style={{
                      marginBottom:
                        "6px",
                    }}
                  >
                    Объём 1 короба, м³
                  </div>


                  <input
                    type="text"

                    inputMode="decimal"

                    value={
                      selectedVedEditor
                        .cartonVolumeM3
                    }

                    disabled={
                      selectedVedBusy
                    }

                    onChange={
                      (
                        event
                      ) => {

                        updateVedEditor(
                          selectedItem.id,
                          {
                            cartonVolumeM3:
                              event
                                .target
                                .value,

                            error:
                              "",
                          }
                        );

                      }
                    }

                    className="ws-editor-input"
                  />

                </div>


                <div>

                  <div
                    className="card-label"

                    style={{
                      marginBottom:
                        "6px",
                    }}
                  >
                    Вес 1 короба, кг
                  </div>


                  <input
                    type="text"

                    inputMode="decimal"

                    value={
                      selectedVedEditor
                        .cartonWeightKg
                    }

                    disabled={
                      selectedVedBusy
                    }

                    onChange={
                      (
                        event
                      ) => {

                        updateVedEditor(
                          selectedItem.id,
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

                    className="ws-editor-input"
                  />

                </div>


                <div>

                  <div
                    className="card-label"

                    style={{
                      marginBottom:
                        "6px",
                    }}
                  >
                    Условия поставки
                  </div>


                  <select
                    value={
                      selectedVedEditor
                        .incoterm
                    }

                    disabled={
                      selectedVedBusy
                    }

                    onChange={
                      (
                        event
                      ) => {

                        updateVedEditor(
                          selectedItem.id,
                          {
                            incoterm:
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
                        "100%",

                      minHeight:
                        "40px",

                      padding:
                        "0 11px",

                      border:
                        "1px solid var(--border)",

                      borderRadius:
                        "8px",

                      background:
                        "var(--background)",

                      color:
                        "var(--text)",
                    }}
                  >

                    <option value="FOB">
                      FOB
                    </option>

                    <option value="FCA">
                      FCA
                    </option>

                  </select>

                </div>


                <div>

                  <div
                    className="card-label"

                    style={{
                      marginBottom:
                        "6px",
                    }}
                  >
                    Порт
                  </div>


                  <input
                    type="text"

                    value={
                      selectedVedEditor.port
                    }

                    disabled={
                      selectedVedBusy
                    }

                    placeholder=
                      "Укажите порт"

                    onChange={
                      (
                        event
                      ) => {

                        updateVedEditor(
                          selectedItem.id,
                          {
                            port:
                              event
                                .target
                                .value,

                            error:
                              "",
                          }
                        );

                      }
                    }

                    className="ws-editor-input"
                  />

                </div>

              </div>


              {/* ==================================================
                  VED ACTIONS
                  ================================================== */}

              <div
                style={{
                  display:
                    "flex",

                  gap:
                    "9px",

                  flexWrap:
                    "wrap",

                  alignItems:
                    "center",

                  marginTop:
                    "14px",
                }}
              >

                <Button
                  type="button"

                  

                  disabled={
                    selectedVedBusy
                  }

                  onClick={
                    () => {

                      void saveVedItem(
                        selectedItem
                      );

                    }
                  }
                >

                  {selectedVedEditor.loading

                    ? "Сохраняем..."

                    : "Сохранить изменения ВЭД"}

                </Button>


                {vedMoqEditable && (

                  <Button variant="secondary"
                    type="button"

                    

                    disabled={
                      selectedVedBusy
                    }

                    onClick={
                      () => {

                        void saveVedMoq(
                          selectedItem
                        );

                      }
                    }
                  >

                    {selectedVedEditor
                      .loadingMoq

                      ? "Пересчитываем..."

                      : "Пересчитать по новому MOQ"}

                  </Button>

                )}

              </div>


              {vedMoqEditable && (

                <div
                  className="muted"

                  style={{
                    marginTop:
                      "8px",

                    fontSize:
                      "12px",
                  }}
                >
                  Если вы изменили цену или данные упаковки,
                  сначала нажмите «Сохранить изменения ВЭД»,
                  а затем меняйте MOQ.
                </div>

              )}


              {!vedMoqEditable && (

                <div
                  className="muted"

                  style={{
                    marginTop:
                      "8px",

                    fontSize:
                      "12px",
                  }}
                >
                  После передачи заказа в производство изменение MOQ заблокировано.
                </div>

              )}


              {vedSaveMessage && (

                <div
                  style={{
                    marginTop:
                      "10px",

                    fontWeight:
                      700,
                  }}
                >
                  {vedSaveMessage}
                </div>

              )}


              {selectedVedEditor.error && (

                <div
                  style={{
                    marginTop:
                      "10px",

                    color:
                      "#d64545",

                    fontWeight:
                      600,
                  }}
                >
                  {selectedVedEditor.error}
                </div>

              )}


              {/* ==================================================
                  CURRENT RESULT
                  ================================================== */}

              <div
                style={{
                  marginTop:
                    "18px",

                  paddingTop:
                    "16px",

                  borderTop:
                    "1px solid var(--border)",
                }}
              >

                <div
                  style={{
                    fontWeight:
                      700,

                    marginBottom:
                      "10px",
                  }}
                >
                  Текущий результат
                </div>


                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(135px, 1fr))",

                    gap:
                      "8px",
                  }}
                >

                  <CompactMetric
                    label="MOQ"
                    value={
                      formatNumber(
                        selectedItem
                          .moq_quantity
                      )
                    }
                  />


                  <CompactMetric
                    label="Коробов"
                    value={
                      formatNumber(
                        selectedItem.cartons
                      )
                    }
                  />


                  <CompactMetric
                    label="К заказу"
                    value={
                      `${formatNumber(
                        selectedItem
                          .order_quantity
                      )} шт.`
                    }
                  />


                  <CompactMetric
                    label="Стоимость"
                    value={
                      selectedItem
                        .total_price_cny ===
                        null

                        ? "—"

                        : `${formatNumber(
                            selectedItem
                              .total_price_cny,
                            2
                          )} CNY`
                    }
                  />


                  <CompactMetric
                    label="Объём"
                    value={
                      `${formatNumber(
                        selectedItem
                          .total_volume_m3,
                        6
                      )} м³`
                    }
                  />


                  <CompactMetric
                    label="Вес"
                    value={
                      `${formatNumber(
                        selectedItem
                          .total_weight_tons,
                        6
                      )} т`
                    }
                  />


                  <CompactMetric
                    label="Покрытие"
                    value={
                      selectedItem
                        .coverage_after_order_days ===
                        null

                        ? "—"

                        : `${formatNumber(
                            selectedItem
                              .coverage_after_order_days,
                            1
                          )} дн.`
                    }
                  />

                </div>

              </div>


              {/* ==================================================
                  COMMENT
                  ================================================== */}

              <div
                style={{
                  marginTop:
                    "16px",
                }}
              >

                <div
                  className="card-label"

                  style={{
                    marginBottom:
                      "6px",
                  }}
                >
                  Комментарий ВЭД
                </div>


                <textarea
                  value={
                    selectedVedEditor
                      .vedComment
                  }

                  disabled={
                    selectedVedBusy
                  }

                  placeholder=
                    "Комментарий ВЭД по позиции"

                  rows={
                    4
                  }

                  onChange={
                    (
                      event
                    ) => {

                      updateVedEditor(
                        selectedItem.id,
                        {
                          vedComment:
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
                      "100%",

                    padding:
                      "10px 11px",

                    border:
                      "1px solid var(--border)",

                    borderRadius:
                      "8px",

                    resize:
                      "vertical",

                    background:
                      "var(--background)",

                    color:
                      "var(--text)",

                    font:
                      "inherit",
                  }}
                />

              </div>

            </div>

          )}


          {/* ==================================================
              ITEM TOTAL
              ================================================== */}

          <div
            style={{
              marginTop:
                "22px",

              paddingTop:
                "18px",

              borderTop:
                "1px solid var(--border)",
            }}
          >

            <div
              style={{
                fontWeight:
                  700,

                marginBottom:
                  "12px",
              }}
            >
              Итог позиции
            </div>


            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(135px, 1fr))",

                gap:
                  "8px",
              }}
            >

              <CompactMetric
                label="Коробов"
                value={
                  formatNumber(
                    selectedItem.cartons
                  )
                }
              />


              <CompactMetric
                label="К заказу"
                value={
                  `${formatNumber(
                    selectedItem
                      .order_quantity
                  )} шт.`
                }
              />


              <CompactMetric
                label="Стоимость"
                value={
                  selectedItem
                    .total_price_cny ===
                    null

                    ? "—"

                    : `${formatNumber(
                        selectedItem
                          .total_price_cny,
                        2
                      )} CNY`
                }
              />


              <CompactMetric
                label="Объём"
                value={
                  `${formatNumber(
                    selectedItem
                      .total_volume_m3,
                    6
                  )} м³`
                }
              />


              <CompactMetric
                label="Вес"
                value={
                  `${formatNumber(
                    selectedItem
                      .total_weight_tons,
                    6
                  )} т`
                }
              />


              <CompactMetric
                label="Покрытие"
                value={
                  selectedItem
                    .coverage_after_order_days ===
                    null

                    ? "—"

                    : `${formatNumber(
                        selectedItem
                          .coverage_after_order_days,
                        1
                      )} дн.`
                }
              />

            </div>

          </div>


          {/* ==================================================
              ANALYTICS COMMENT
              ================================================== */}

          <div
            style={{
              marginTop:
                "18px",

              paddingTop:
                "16px",

              borderTop:
                "1px solid var(--border)",
            }}
          >

            <div className="card-label">
              Комментарий аналитики
            </div>


            <div
              style={{
                marginTop:
                  "6px",

                whiteSpace:
                  "pre-wrap",
              }}
            >
              {selectedItem
                .analytics_comment
                ??
                "—"}
            </div>

          </div>

        </section>
  ) : null;


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <>


      {/* ======================================================
          ORDER HEADER
          ====================================================== */}

      <section
        className="section"

        style={{
          padding:
            "18px 20px",
        }}
      >

        {/* Данные заказа слева, экспорт справа */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "1 1 880px",
              minWidth: 0,
            }}
          >

        <div className="small-label">
          ЗАКАЗ В КИТАЙ
        </div>


        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              "12px",

            flexWrap:
              "wrap",

            marginTop:
              "5px",
          }}
        >

          <h2
            style={{
              margin:
                0,

              fontSize:
                "25px",

              lineHeight:
                1.15,
            }}
          >

            {order.order_number

              ? `Заказ ${order.order_number}`

              : "Черновик заказа"}

          </h2>


          <div
            style={{
              padding:
                "5px 9px",

              border:
                "1px solid var(--border)",

              borderRadius:
                "999px",

              fontSize:
                "12px",

              fontWeight:
                700,
            }}
          >

            {getWorkflowLabel(
              order.workflow_status
            )}

          </div>

        </div>


        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",

            gap:
              "8px 22px",

            marginTop:
              "16px",

            fontSize:
              "13px",
          }}
        >

          <div>

            <span className="muted">
              Ответственный:{" "}
            </span>

            <strong>
              {order
                .preparation_responsible_name
                ??
                "—"}
            </strong>

          </div>


          <div>

            <span className="muted">
              Отдел:{" "}
            </span>

            <strong>

              {order
                .preparation_department ===
                "analytics"

                ? "Аналитика"

                : order
                    .preparation_department ===
                    "procurement"

                  ? "Закуп"

                  : "—"}

            </strong>

          </div>


          <div>

            <span className="muted">
              Транспорт:{" "}
            </span>

            <strong>

              {order
                .calculation_scenario ===
                "container"

                ? "Контейнер"

                : order
                    .calculation_scenario ===
                    "truck"

                  ? "Фура"

                  : "—"}

            </strong>

            <span className="muted">
              {" "}· {targetDays} дней
            </span>

          </div>


          <div>

            <span className="muted">
              Создан:{" "}
            </span>

            <strong>
              {formatDate(
                order.created_at
              )}
            </strong>

          </div>


          <div>

            <span className="muted">
              Ответственный ВЭД:{" "}
            </span>

            <strong>
              {order
                .ved_responsible_name
                ??
                "не назначен"}
            </strong>

          </div>

        </div>

          </div>

          {excelExportAvailable && excelExportUrl && (
            <a
              href={excelExportUrl}
              className="secondary-button"
              title="Экспортировать актуальный заказ в Excel"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                textDecoration: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
                minHeight: "40px",
                marginLeft: "auto",
              }}
            >
              Экспорт Excel
            </a>
          )}
        </div>

      </section>


      {/* ======================================================
          READINESS
          ====================================================== */}

      {statistics && (

        <section
          style={{
            marginTop:
              "14px",
          }}
        >

          <div
            style={{
              marginBottom:
                "7px",
            }}
          >
            <strong>
              Готовность
            </strong>
          </div>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(115px, 1fr))",

              gap:
                "8px",
            }}
          >

            <CompactMetric
              label="Товаров"
              value={
                formatNumber(
                  statistics.items_count
                )
              }
            />


            <CompactMetric
              label="MOQ + цена"
              value={
                formatNumber(
                  statistics.terms_confirmed
                )
              }
            />


            <CompactMetric
              label="Ждут"
              value={
                formatNumber(
                  statistics.terms_pending
                )
              }
            />


            <CompactMetric
              label="Готовы"
              value={
                formatNumber(
                  statistics.ready_for_transport
                )
              }
            />


            <CompactMetric
              label="Нет кит. артикула"
              value={
                formatNumber(
                  statistics
                    .missing_chinese_article
                )
              }
            />


            <CompactMetric
              label="Нет веса"
              value={
                formatNumber(
                  statistics.missing_weight
                )
              }
            />


            <CompactMetric
              label="Проверка MOQ"
              value={
                formatNumber(
                  statistics
                    .moq_review_pending
                )
              }
            />

          </div>

        </section>

      )}


      {/* ======================================================
          TOTALS
          ====================================================== */}

      {totals && (

        <section
          style={{
            marginTop:
              "14px",
          }}
        >

          <div
            style={{
              marginBottom:
                "7px",
            }}
          >
            <strong>
              Итоги
            </strong>
          </div>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(130px, 1fr))",

              gap:
                "8px",
            }}
          >

            <CompactMetric
              label="Коробов"
              value={
                formatNumber(
                  totals.total_cartons
                )
              }
            />


            <CompactMetric
              label="Единиц"
              value={
                formatNumber(
                  totals.total_units
                )
              }
            />


            <CompactMetric
              label="Стоимость"
              value={
                `${formatNumber(
                  totals.total_price_cny,
                  2
                )} CNY`
              }
            />


            <CompactMetric
              label="Объём"
              value={
                `${formatNumber(
                  totals.total_volume_m3,
                  3
                )} м³`
              }
            />


            <CompactMetric
              label="Вес"
              value={
                `${formatNumber(
                  totals.total_weight_tons,
                  3
                )} т`
              }
            />

          </div>

        </section>

      )}


      {/* ======================================================
          ITEMS
          ====================================================== */}

      <section
        className="section"

        style={{
          marginTop:
            "18px",
        }}
      >

        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              "12px",

            flexWrap:
              "wrap",
          }}
        >

          <h2
            className="section-title"

            style={{
              margin:
                0,
            }}
          >
            Состав заказа
          </h2>


          <div className="muted">
            {formatNumber(
              items.length
            )} товаров
          </div>

        </div>


        <div
          className="muted"

          style={{
            marginTop:
              "5px",
          }}
        >
          Нажмите на товар, чтобы раскрыть данные прямо под строкой. Повторное нажатие свернёт карточку.
        </div>


        <div
          style={{
            overflowX:
              "auto",

            marginTop:
              "14px",
          }}
        >

          <table
            style={{
              width:
                "100%",

              minWidth:
                "920px",

              borderCollapse:
                "separate",

              borderSpacing:
                "0 6px",

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
                  "Коробов",
                  "Шт.",
                  "Сумма",
                  "Статус",
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
                          "5px 10px",

                        whiteSpace:
                          "nowrap",

                        fontWeight:
                          600,

                        opacity:
                          0.7,
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

                  const selected =
                    selectedItem
                      ?.id ===
                    item.id;


                  return (

                    <Fragment key={item.id}>

                    <tr
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      aria-expanded={selected}
                      aria-label={`Товар ${item.our_article_snapshot ?? "без артикула"}: ${selected ? "свернуть" : "раскрыть"}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedItemId((current) =>
                            current === item.id ? null : item.id
                          );
                          setVedSaveMessage("");
                        }
                      }}
                      onClick={
                        () => {

                          setSelectedItemId((current) =>
                            current === item.id ? null : item.id
                          );

                          setVedSaveMessage(
                            ""
                          );

                        }
                      }

                      style={{
                        cursor:
                          "pointer",

                        background:
                          selected
                            ? "var(--card)"
                            : "transparent",

                        outline:
                          selected
                            ? "1px solid var(--border)"
                            : "1px solid transparent",
                      }}
                    >

                      <td
                        style={{
                          padding:
                            "8px 10px",

                          borderRadius:
                            "10px 0 0 10px",
                        }}
                      >

                        <ProductPhoto
                          url={
                            item.photo_url
                          }

                          article={
                            item
                              .our_article_snapshot
                          }

                          size={
                            48
                          }
                        />

                      </td>


                      <td
                        style={{
                          padding:
                            "8px 10px",

                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {item
                          .chinese_article_snapshot
                          ??
                          "—"}
                      </td>


                      <td
                        style={{
                          padding:
                            "8px 10px",

                          whiteSpace:
                            "nowrap",

                          fontWeight:
                            700,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-block",
                            width: "18px",
                            fontSize: "17px",
                            color: selected ? "var(--text)" : "var(--muted)",
                          }}
                        >
                          {selected ? "▾" : "▸"}
                        </span>
                        {item.our_article_snapshot ?? "—"}
                      </td>


                      <td
                        style={{
                          padding:
                            "8px 10px",

                          minWidth:
                            "260px",
                        }}
                      >
                        {item
                          .product_name_snapshot
                          ??
                          "—"}
                      </td>


                      <td
                        style={{
                          padding:
                            "8px 10px",

                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {formatNumber(
                          item.cartons
                        )}
                      </td>


                      <td
                        style={{
                          padding:
                            "8px 10px",

                          whiteSpace:
                            "nowrap",

                          fontWeight:
                            700,
                        }}
                      >
                        {formatNumber(
                          item.order_quantity
                        )}
                      </td>


                      <td
                        style={{
                          padding:
                            "8px 10px",

                          whiteSpace:
                            "nowrap",
                        }}
                      >

                        {item
                          .total_price_cny ===
                        null

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
                            "8px 10px",

                          whiteSpace:
                            "nowrap",

                          borderRadius:
                            "0 10px 10px 0",

                          fontWeight:
                            600,
                        }}
                      >
                        {getItemListStatus(
                          item
                        )}
                      </td>

                    </tr>

                    {selected && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: "8px 14px 18px",
                            background: "var(--card)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {expandedItemDetail}
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

      </section>


      {/* ======================================================
          HANDOFF
          ====================================================== */}

      <section
        className="section"

        style={{
          marginTop:
            "18px",

          padding:
            "16px 20px",
        }}
      >

        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              "14px",

            flexWrap:
              "wrap",
          }}
        >

          <div>

            <div
              style={{
                fontWeight:
                  700,

                fontSize:
                  "17px",
              }}
            >
              Готовность к передаче в ВЭД
            </div>


            <div
              className="muted"

              style={{
                marginTop:
                  "4px",
              }}
            >

              {loadingHandoff

                ? "Проверяем готовность..."

                : handoff?.ready

                  ? "Все обязательные данные заполнены"

                  : `${formatNumber(
                      problemCount
                    )} незаполненных данных`}

            </div>

          </div>


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

            {!handoff?.ready
              &&
              problemCount > 0 && (

              <Button variant="secondary"
                type="button"

                

                onClick={
                  () => {

                    setShowProblems(
                      (
                        current
                      ) =>
                        !current
                    );

                  }
                }
              >
                {showProblems
                  ? "Скрыть проблемы"
                  : "Показать проблемы"}
              </Button>

            )}


            <Button variant="secondary"
              type="button"

              

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
              Проверить
            </Button>


            {canSendToVedStatus && (

              <Button
                type="button"

                

                disabled={
                  !handoff?.ready
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
              </Button>

            )}

          </div>

        </div>


        {showProblems
          &&
          handoff
            ?.problem_items
          &&
          handoff
            .problem_items
            .length > 0 && (

          <div
            style={{
              display:
                "grid",

              gap:
                "8px",

              marginTop:
                "14px",
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

                    style={{
                      padding:
                        "11px 13px",

                      border:
                        "1px solid var(--border)",

                      borderRadius:
                        "9px",
                    }}
                  >

                    <strong>
                      {problemItem
                        .our_article
                        ??
                        "Без нашего артикула"}
                    </strong>


                    <div
                      className="muted"

                      style={{
                        marginTop:
                          "3px",
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
                          "flex",

                        gap:
                          "6px 14px",

                        flexWrap:
                          "wrap",

                        marginTop:
                          "7px",

                        fontSize:
                          "12px",
                      }}
                    >

                      {problemItem
                        .problems
                        ?.map(
                          (
                            problem,
                            index
                          ) => (

                            <span
                              key={
                                `${problem}-${index}`
                              }
                            >
                              • {problem}
                            </span>

                          )
                        )}

                    </div>

                  </div>

                )
              )}

          </div>

        )}


        {handoffError && (

          <div
            style={{
              marginTop:
                "10px",

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
                "10px",

              fontWeight:
                700,
            }}
          >
            {handoffMessage}
          </div>

        )}

      </section>


      {/* ======================================================
          DATES
          ====================================================== */}

      <section
        className="section"

        style={{
          marginTop:
            "14px",

          padding:
            "14px 20px",
        }}
      >

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",

            gap:
              "10px",
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
              Взял в работу ВЭД
            </div>

            <strong>
              {formatDate(
                order.ved_taken_at
              )}
            </strong>

          </div>


          <div>

            <div className="card-label">
              В производство
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
