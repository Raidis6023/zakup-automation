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
// FORMAT
// ============================================================

function formatNumber(
  value:
    | number
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
    useState<
      VedOrderResponse | null
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
    error,
    setError,
  ] =
    useState(
      ""
    );


  // ==========================================================
  // LOAD
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

          Сейчас это просмотр черновика.
          Редактирование MOQ, цены и коробов
          добавим следующим шагом.

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
                "1800px",

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
                  "Объём, м³",
                  "Вес, т",

                  "FOB / FCA",
                  "Порт",
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
                          "right",

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

                  const termsStatus =
                    getTermsStatus(
                      item
                    );


                  return (

                    <tr
                      key={
                        item.id
                      }
                    >


                      <td
                        style={{
                          padding:
                            "10px",

                          textAlign:
                            "left",
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

                          textAlign:
                            "left",

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

                          textAlign:
                            "left",

                          minWidth:
                            "320px",
                        }}
                      >

                        {item
                          .product_name_snapshot
                          ??
                          "—"}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        {formatNumber(
                          item
                            .demand_container_units
                        )}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        {formatNumber(
                          item
                            .demand_truck_units
                        )}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        {formatNumber(
                          item
                            .selected_demand_units
                        )}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        {formatNumber(
                          item
                            .units_per_carton_snapshot
                        )}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        {formatNumber(
                          item
                            .moq_quantity
                        )}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        {item
                          .unit_price_cny ===
                          null

                          ? "—"

                          : `${formatNumber(
                              item
                                .unit_price_cny,
                              4
                            )} ¥`}

                      </td>


                      <td
                        style={{
                          padding:
                            "10px",

                          textAlign:
                            "left",

                          whiteSpace:
                            "nowrap",
                        }}
                      >

                        {termsStatus}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        {formatNumber(
                          item.cartons
                        )}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        <strong>

                          {formatNumber(
                            item
                              .order_quantity
                          )}

                        </strong>

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

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


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        {formatNumber(
                          item
                            .total_volume_m3,
                          6
                        )}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "right",
                      }}>

                        {formatNumber(
                          item
                            .total_weight_tons,
                          6
                        )}

                      </td>


                      <td style={{
                        padding:
                          "10px",
                        textAlign:
                          "center",
                      }}>

                        {item.incoterm
                          ??
                          "—"}

                      </td>


                      <td
                        style={{
                          padding:
                            "10px",

                          textAlign:
                            "left",
                        }}
                      >

                        {item.port
                          ??
                          "—"}

                      </td>

                    </tr>

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
