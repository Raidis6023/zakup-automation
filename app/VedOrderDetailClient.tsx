"use client";

import {
  useEffect,
  useState,
} from "react";


// ============================================================
// TYPES
// ============================================================

type VedOrder = {
  id: string;

  order_number:
    string | null;

  status:
    string;

  workflow_status:
    string;

  created_by_name:
    string | null;

  preparation_department:
    string | null;

  preparation_responsible_name:
    string | null;

  ved_responsible_name:
    string | null;

  calculation_scenario:
    string | null;

  transport_mode:
    string | null;

  transport_variant:
    string | null;

  transport_units:
    number | null;

  selected_capacity_m3:
    number | null;

  new_products_volume_m3:
    number;

  first_sent_to_ved_at:
    string | null;

  last_sent_to_ved_at:
    string | null;

  production_handoff_date:
    string | null;

  production_confirmed_at:
    string | null;

  expected_arrival_date:
    string | null;

  actual_arrival_date:
    string | null;

  created_at:
    string;

  updated_at:
    string;
};


type VedOrderItem = {
  id: string;

  product_id:
    string | null;

  status:
    string;

  item_kind:
    string;

  chinese_article_snapshot:
    string | null;

  our_article_snapshot:
    string | null;

  product_name_snapshot:
    string | null;

  photo_url:
    string | null;

  priority_group:
    string | null;

  position_sort:
    number | null;

  demand_container_units:
    number | null;

  demand_truck_units:
    number | null;

  selected_demand_units:
    number | null;

  moq_quantity:
    number | null;

  moq_confirmed_at:
    string | null;

  unit_price_cny:
    number | null;

  price_confirmed_at:
    string | null;

  moq_excess_review_required:
    boolean;

  moq_review_status:
    string;

  units_per_carton_snapshot:
    number | null;

  carton_volume_m3_snapshot:
    number | null;

  carton_weight_kg_snapshot:
    number | null;

  cartons:
    number | null;

  order_quantity:
    number;

  coverage_after_order_days:
    number | null;

  is_partial_fill:
    boolean;

  manual_cartons_override:
    boolean;

  incoterm:
    string | null;

  port:
    string | null;

  analytics_comment:
    string | null;

  ved_comment:
    string | null;

  total_price_cny:
    number | null;

  total_volume_m3:
    number | null;

  total_weight_tons:
    number | null;

  quantity:
    number;
};


type VedOrderTotals = {
  items_count:
    number;

  total_units:
    number;

  total_cartons:
    number;

  total_price_cny:
    number;

  total_volume_m3:
    number;

  total_weight_tons:
    number;
};


type VedOrderStatistics = {
  items_count:
    number;

  terms_confirmed:
    number;

  terms_pending:
    number;

  moq_review_pending:
    number;

  ready_for_transport:
    number;

  missing_chinese_article:
    number;

  missing_weight:
    number;
};


type VedOrderResponse = {
  ok:
    boolean;

  error?:
    string;

  order?:
    VedOrder;

  totals?:
    VedOrderTotals;

  statistics?:
    VedOrderStatistics;

  items?:
    VedOrderItem[];
};


// ============================================================
// MOQ / PRICE PREVIEW
// ============================================================

type TermsPreview = {
  ok:
    boolean;

  error?:
    string;

  item_id?:
    string;

  our_article?:
    string | null;

  product_name?:
    string | null;

  scenario?:
    string;

  target_days?:
    number;

  selected_demand_units?:
    number;

  units_per_carton?:
    number;

  moq_quantity?:
    number;

  unit_price_cny?:
    number;

  standard_cartons?:
    number;

  standard_quantity?:
    number;

  moq_changed_quantity?:
    boolean;

  final_cartons?:
    number;

  final_quantity?:
    number;

  coverage_after_order_days?:
    number | null;

  target_coverage_days?:
    number;

  moq_review_required?:
    boolean;

  total_price_cny?:
    number;

  total_volume_m3?:
    number | null;

  total_weight_tons?:
    number | null;

  terms_confirmed?:
    boolean;

  moq_review_status?:
    string;

  proposed_cartons?:
    number;

  proposed_quantity?:
    number;

  accepted_cartons?:
    number;

  accepted_quantity?:
    number;

  ready_for_transport?:
    boolean;
};


// ============================================================
// EDITOR STATE
// ============================================================

type ItemEditorState = {
  moq:
    string;

  price:
    string;

  loadingPreview:
    boolean;

  loadingConfirm:
    boolean;

  error:
    string;

  preview:
    TermsPreview | null;
};


type EditorsState = {
  [itemId: string]:
    ItemEditorState;
};


// ============================================================
// FORMAT
// ============================================================

function formatNumber(
  value:
    number
    | null
    | undefined,

  digits =
    0
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


// ============================================================
// STATUS
// ============================================================

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

          moq:
            item.moq_quantity ===
            null
              ? ""
              : String(
                  item.moq_quantity
                ),

          price:
            item.unit_price_cny ===
            null
              ? ""
              : String(
                  item.unit_price_cny
                ),

          loadingPreview:
            false,

          loadingConfirm:
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


  useEffect(
    () => {

      void loadOrder();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      orderId,
    ]
  );


  // ==========================================================
  // UPDATE EDITOR
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

            moq:
              "",

            price:
              "",

            loadingPreview:
              false,

            loadingConfirm:
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


    const actorName =
      data
        ?.order
        ?.preparation_responsible_name
        ?.trim();


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


    const actorRole =
      data
        ?.order
        ?.preparation_department ===
        "procurement"

        ? "procurement"

        : "analytics";


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


      await loadOrder();


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
  // LOADING
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


  // ==========================================================
  // ERROR
  // ==========================================================

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


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <>


      {/* ======================================================
          ORDER HEADER
          ====================================================== */}

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


      {/* ======================================================
          MAIN INFO
          ====================================================== */}

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


      {/* ======================================================
          READINESS
          ====================================================== */}

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


      {/* ======================================================
          TOTALS
          ====================================================== */}

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


      {/* ======================================================
          ITEMS
          ====================================================== */}

      <section className="section">

        <h2 className="section-title">
          Товары заказа
        </h2>


        <div className="reason-text">

          Введите MOQ и цену в юанях,
          выполните предварительный расчёт
          и только после проверки подтвердите условия.

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
                "2150px",

              borderCollapse:
                "collapse",

              fontSize:
                "13px",
            }}
          >

            <thead>

              <tr>

                {[
                  "Китайский арт.",
                  "Наш артикул",
                  "Товар",

                  "Потребность 100",
                  "Потребность 70",
                  "Выбрано",

                  "В коробе",

                  "MOQ",
                  "Цена CNY",

                  "Статус",

                  "Коробов",
                  "К заказу",

                  "Покрытие",
                  "Стоимость",
                  "Объём, м³",

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


                  return (

                    <>
                      <tr
                        key={
                          item.id
                        }
                      >


                        <td
                          style={{
                            padding:
                              "10px",
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
                              "10px",

                            fontWeight:
                              600,
                          }}
                        >

                          {item
                            .our_article_snapshot
                            ??
                            "—"}

                        </td>


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

                            inputMode="numeric"

                            value={
                              editor
                                ?.moq
                              ??
                              ""
                            }

                            disabled={
                              editor
                                ?.loadingPreview
                              ||
                              editor
                                ?.loadingConfirm
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
                                "var(--card)",

                              color:
                                "var(--text)",
                            }}
                          />

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >

                          <input
                            type="text"

                            inputMode="decimal"

                            value={
                              editor
                                ?.price
                              ??
                              ""
                            }

                            disabled={
                              editor
                                ?.loadingPreview
                              ||
                              editor
                                ?.loadingConfirm
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
                                "var(--card)",

                              color:
                                "var(--text)",
                            }}
                          />

                        </td>


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

                            minWidth:
                              "250px",
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
                                editor
                                  ?.loadingPreview
                                ||
                                editor
                                  ?.loadingConfirm
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


                            {preview && (

                              <button
                                type="button"

                                className=
                                  "primary-button"

                                disabled={
                                  editor
                                    ?.loadingConfirm
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

                          </div>


                          {editor
                            ?.error && (

                            <div
                              style={{
                                marginTop:
                                  "8px",

                                color:
                                  "#d64545",

                                maxWidth:
                                  "260px",
                              }}
                            >

                              {editor.error}

                            </div>

                          )}

                        </td>

                      </tr>


                      {/* ======================================
                          PREVIEW ROW
                          ====================================== */}

                      {preview && (

                        <tr
                          key={
                            `${item.id}-preview`
                          }
                        >

                          <td
                            colSpan={
                              16
                            }

                            style={{
                              padding:
                                "12px 18px 18px",

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

                                <div className="reason-text">

                                  После подтверждения MOQ и цены
                                  товар пока не попадёт
                                  в транспортный расчёт.

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
                                После подтверждения товар будет
                                включён в заказ автоматически.

                              </div>

                            )}

                          </td>

                        </tr>

                      )}

                    </>

                  );

                }
              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* ======================================================
          DATES
          ====================================================== */}

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
