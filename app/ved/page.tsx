import Link
from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  revalidatePath,
} from "next/cache";

import ThemeToggle
from "../ThemeToggle";

import "./ved-reference.css";


// ============================================================
// ТИПЫ
// ============================================================

type VedOrder = {
  id: string;
  order_number: string | null;
  status: string | null;
  workflow_status: string;
  created_by_name: string | null;
  preparation_department: string | null;
  preparation_responsible_name: string | null;
  ved_responsible_name: string | null;
  calculation_scenario: string | null;
  transport_mode: string | null;
  transport_variant: string | null;
  new_products_volume_m3: number | null;
  first_sent_to_ved_at: string | null;
  last_sent_to_ved_at: string | null;
  ved_taken_at: string | null;
  production_handoff_date: string | null;
  expected_arrival_date: string | null;
  actual_arrival_date: string | null;
  created_at: string;
  updated_at: string;
};


type VedOrderItem = {
  ved_order_id: string;
  cartons: number | null;
  order_quantity: number | null;
  total_price_cny: number | null;
  total_volume_m3: number | null;
  total_weight_tons: number | null;
  moq_review_status: string | null;
  status: string | null;
};


type OrderTotals = {
  items: number;
  cartons: number;
  quantity: number;
  priceCny: number;
  volumeM3: number;
  weightTons: number;
};


type VedReferenceIconName =
  | "waiting"
  | "work"
  | "production"
  | "transit"
  | "info";


// ============================================================
// ИКОНКИ СТРАНИЦЫ
// ============================================================

function VedReferenceIcon({
  name,
}: {
  name: VedReferenceIconName;
}) {

  if (
    name === "waiting"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <path
          d="
            M12 3
            20 7
            12 11
            4 7
            Z
          "
        />

        <path
          d="
            M4 7
            v10
            l8 4
            8-4
            V7
          "
        />

        <path
          d="
            M12 11
            v10
          "
        />

      </svg>

    );

  }


  if (
    name === "work"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <rect
          x="3"
          y="7"
          width="18"
          height="13"
          rx="2"
        />

        <path
          d="
            M8 7
            V5
            c0-1.1.9-2 2-2
            h4
            c1.1 0 2 .9 2 2
            v2
          "
        />

        <path
          d="
            M3 12
            h18
          "
        />

        <path
          d="
            M10 12
            v2
            h4
            v-2
          "
        />

      </svg>

    );

  }


  if (
    name === "production"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <path
          d="
            M6 3
            h8
            l4 4
            v14
            H6
            Z
          "
        />

        <path
          d="
            M14 3
            v5
            h4
          "
        />

        <path
          d="
            M9 12
            h6
          "
        />

        <path
          d="
            M9 16
            h6
          "
        />

      </svg>

    );

  }


  if (
    name === "transit"
  ) {

    return (

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >

        <path
          d="
            M3 6
            h11
            v10
            H3
            Z
          "
        />

        <path
          d="
            M14 10
            h4
            l3 3
            v3
            h-7
          "
        />

        <circle
          cx="7"
          cy="18"
          r="2"
        />

        <circle
          cx="18"
          cy="18"
          r="2"
        />

      </svg>

    );

  }


  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path
        d="
          M12 10
          v6
        "
      />

      <path
        d="
          M12 7
          h.01
        "
      />

    </svg>

  );

}


// ============================================================
// SUPABASE
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена переменная NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена переменная SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


// ============================================================
// ПОЛУЧЕНИЕ ЗАКАЗОВ ВЭД
// ============================================================

async function getVedOrders():
Promise<VedOrder[]> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const statuses = [
    "sent_to_ved",
    "ved_in_work",
    "returned_for_edit",
    "production_confirmed",
    "in_transit",
    "arrived",
    "rejected",
    "cancelled",
  ].join(
    ","
  );


  const select = [
    "id",
    "order_number",
    "status",
    "workflow_status",
    "created_by_name",
    "preparation_department",
    "preparation_responsible_name",
    "ved_responsible_name",
    "calculation_scenario",
    "transport_mode",
    "transport_variant",
    "new_products_volume_m3",
    "first_sent_to_ved_at",
    "last_sent_to_ved_at",
    "ved_taken_at",
    "production_handoff_date",
    "expected_arrival_date",
    "actual_arrival_date",
    "created_at",
    "updated_at",
  ].join(
    ","
  );


  const url = [
    `${supabaseUrl}/rest/v1/ved_orders`,
    `?workflow_status=in.(${statuses})`,
    `&select=${select}`,
    `&order=created_at.desc`,
  ].join(
    ""
  );


  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();


    throw new Error(
      `Не удалось загрузить заказы ВЭД: ${response.status} ${errorText}`
    );

  }


  return response.json();

}


// ============================================================
// ПОЛУЧЕНИЕ ПОЗИЦИЙ ЗАКАЗОВ
// ============================================================

async function getVedOrderItems(
  orderIds: string[]
):
Promise<VedOrderItem[]> {

  if (
    orderIds.length === 0
  ) {

    return [];

  }


  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const ids =
    orderIds.join(
      ","
    );


  const select = [
    "ved_order_id",
    "cartons",
    "order_quantity",
    "total_price_cny",
    "total_volume_m3",
    "total_weight_tons",
    "moq_review_status",
    "status",
  ].join(
    ","
  );


  const url = [
    `${supabaseUrl}/rest/v1/ved_order_items`,
    `?ved_order_id=in.(${ids})`,
    `&select=${select}`,
  ].join(
    ""
  );


  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();


    throw new Error(
      `Не удалось загрузить позиции заказов: ${response.status} ${errorText}`
    );

  }


  return response.json();

}


// ============================================================
// ВЗЯТЬ ЗАКАЗ В РАБОТУ
// ============================================================

async function takeOrderInWork(
  formData: FormData
) {

  "use server";


  const orderId =
    String(
      formData.get(
        "orderId"
      )
      ??
      ""
    ).trim();


  if (!orderId) {

    throw new Error(
      "Не указан ID заказа"
    );

  }


  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/take_ved_order_in_work`,
      {
        method:
          "POST",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            {
              p_order_id:
                orderId,

              p_actor_name:
                "тест ВЭД",

              p_actor_user_id:
                null,

              p_actor_role:
                "ved",
            }
          ),

        cache:
          "no-store",
      }
    );


  const responseText =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Не удалось взять заказ в работу: ${response.status} ${responseText}`
    );

  }


  let result:
    Record<
      string,
      unknown
    > =
      {};


  if (responseText) {

    try {

      result =
        JSON.parse(
          responseText
        );

    } catch {

      throw new Error(
        `Supabase вернул неожиданный ответ: ${responseText}`
      );

    }

  }


  if (
    result.ok === false
  ) {

    throw new Error(
      String(
        result.error
        ??
        "Не удалось взять заказ в работу"
      )
    );

  }


  revalidatePath(
    "/ved"
  );


  revalidatePath(
    `/ved-orders/${orderId}`
  );


  redirect(
    `/ved-orders/${orderId}?from=ved`
  );

}


// ============================================================
// СТАТУС
// ============================================================

function workflowStatusName(
  status:
    string
    |
    null
    |
    undefined
) {

  switch (
    status
  ) {

    case "sent_to_ved":
      return "Передан в ВЭД";

    case "ved_in_work":
      return "В работе ВЭД";

    case "returned_for_edit":
      return "Возвращён на доработку";

    case "production_confirmed":
      return "В производстве";

    case "in_transit":
      return "В пути";

    case "arrived":
      return "Прибыл";

    case "rejected":
      return "Отклонён";

    case "cancelled":
      return "Отменён";

    case "draft":
      return "Черновик";

    default:
      return status ?? "—";

  }

}


function workflowStatusClass(
  status:
    string
    |
    null
    |
    undefined
) {

  switch (
    status
  ) {

    case "sent_to_ved":
      return "ved-status--waiting";

    case "ved_in_work":
      return "ved-status--work";

    case "returned_for_edit":
      return "ved-status--returned";

    case "production_confirmed":
      return "ved-status--production";

    case "in_transit":
      return "ved-status--transit";

    case "arrived":
      return "ved-status--arrived";

    case "rejected":
    case "cancelled":
      return "ved-status--rejected";

    default:
      return "ved-status--default";

  }

}


// ============================================================
// ТРАНСПОРТ
// ============================================================

function transportName(
  order: VedOrder
) {

  const scenario =
    order.calculation_scenario
    ??
    order.transport_mode
    ??
    "";


  if (
    scenario === "container"
  ) {

    return "Контейнер";

  }


  if (
    scenario === "truck"
  ) {

    if (
      order.transport_variant ===
      "truck_100"
    ) {

      return "Фура 100 м³";

    }


    return "Фура";

  }


  return "—";

}


// ============================================================
// ФОРМАТИРОВАНИЕ
// ============================================================

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


  return date.toLocaleDateString(
    "ru-RU"
  );

}


function formatNumber(
  value:
    number
    |
    null
    |
    undefined,

  digits =
    0
) {

  return Number(
    value
    ??
    0
  ).toLocaleString(
    "ru-RU",
    {
      minimumFractionDigits:
        digits,

      maximumFractionDigits:
        digits,
    }
  );

}


function shortId(
  id: string
) {

  return id
    .slice(
      0,
      8
    )
    .toUpperCase();

}


// ============================================================
// СУММЫ ПО ЗАКАЗАМ
// ============================================================

function buildTotals(
  items:
    VedOrderItem[]
):
Map<
  string,
  OrderTotals
> {

  const totals =
    new Map<
      string,
      OrderTotals
    >();


  for (
    const item
    of items
  ) {

    const isRejected =
      item.moq_review_status ===
        "rejected"
      ||
      item.status ===
        "rejected";


    if (
      isRejected
    ) {

      continue;

    }


    const current =
      totals.get(
        item.ved_order_id
      )
      ??
      {
        items: 0,
        cartons: 0,
        quantity: 0,
        priceCny: 0,
        volumeM3: 0,
        weightTons: 0,
      };


    current.items +=
      1;


    current.cartons +=
      Number(
        item.cartons
        ??
        0
      );


    current.quantity +=
      Number(
        item.order_quantity
        ??
        0
      );


    current.priceCny +=
      Number(
        item.total_price_cny
        ??
        0
      );


    current.volumeM3 +=
      Number(
        item.total_volume_m3
        ??
        0
      );


    current.weightTons +=
      Number(
        item.total_weight_tons
        ??
        0
      );


    totals.set(
      item.ved_order_id,
      current
    );

  }


  return totals;

}


// ============================================================
// ГЛАВНАЯ СТРАНИЦА ВЭД
// ============================================================

export default async function VedPage() {

  let orders:
    VedOrder[] =
      [];


  let items:
    VedOrderItem[] =
      [];


  try {

    orders =
      await getVedOrders();


    items =
      await getVedOrderItems(
        orders.map(
          order =>
            order.id
        )
      );

  } catch (
    error
  ) {

    return (

      <main
        className="page ved-reference-page"
      >

        <div
          className="container"
        >

          <header
            className="header ved-header"
          >

            <div
              className="ved-title-wrap"
            >

              <div
                className="small-label"
              >
                РАБОЧЕЕ ПРОСТРАНСТВО
              </div>


              <h1
                className="title"
              >
                ВЭД
              </h1>


              <p
                className="subtitle"
              >
                Заказы в Китай и работа отдела ВЭД.
              </p>

            </div>


            <div
              className="header-actions ved-header-actions"
            >

              <ThemeToggle />


              <Link
                href="/"
                className="secondary-button ved-back-link"
              >
                Главная
              </Link>

            </div>

          </header>


          <section
            className="section ved-error-section"
          >

            <div
              className="error-box"
            >

              <strong>
                Ошибка загрузки заказов
              </strong>


              <div>

                {
                  error instanceof Error

                    ? error.message

                    : "Неизвестная ошибка"
                }

              </div>

            </div>

          </section>

        </div>

      </main>

    );

  }


  const totals =
    buildTotals(
      items
    );


  const waitingCount =
    orders.filter(
      order =>
        order.workflow_status ===
        "sent_to_ved"
    ).length;


  const inWorkCount =
    orders.filter(
      order =>
        order.workflow_status ===
        "ved_in_work"
    ).length;


  const productionCount =
    orders.filter(
      order =>
        order.workflow_status ===
        "production_confirmed"
    ).length;


  const transitCount =
    orders.filter(
      order =>
        order.workflow_status ===
        "in_transit"
    ).length;


  return (

    <main
      className="page ved-reference-page"
    >

      <div
        className="container"
      >

        {/* ===================================
            HEADER
            =================================== */}

        <header
          className="header ved-header"
        >

          <div
            className="ved-title-wrap"
          >

            <div
              className="small-label"
            >
              РАБОЧЕЕ ПРОСТРАНСТВО
            </div>


            <h1
              className="title"
            >
              ВЭД
            </h1>


            <p
              className="subtitle"
            >
              Заказы в Китай, переданные в работу отдела ВЭД.
            </p>

          </div>


          <div
            className="header-actions ved-header-actions"
          >

            <ThemeToggle />


            <Link
              href="/"
              className="secondary-button ved-back-link"
            >
              Главная
            </Link>

          </div>

        </header>


        {/* ===================================
            СВОДКА
            =================================== */}

        <section
          className="summary-grid ved-summary-grid"
        >

          <div
            className="card ved-summary-card"
          >

            <span
              className="ved-summary-icon ved-summary-icon--blue"
            >

              <VedReferenceIcon
                name="waiting"
              />

            </span>


            <div
              className="ved-summary-copy"
            >

              <div
                className="card-label"
              >
                Ждут ВЭД
              </div>


              <div
                className="big-number"
              >
                {
                  waitingCount
                }
              </div>


              <div
                className="muted"
              >
                Ещё не взяты в работу
              </div>

            </div>

          </div>


          <div
            className="card ved-summary-card"
          >

            <span
              className="ved-summary-icon ved-summary-icon--green"
            >

              <VedReferenceIcon
                name="work"
              />

            </span>


            <div
              className="ved-summary-copy"
            >

              <div
                className="card-label"
              >
                В работе
              </div>


              <div
                className="big-number"
              >
                {
                  inWorkCount
                }
              </div>


              <div
                className="muted"
              >
                Ответственный назначен
              </div>

            </div>

          </div>


          <div
            className="card ved-summary-card"
          >

            <span
              className="ved-summary-icon ved-summary-icon--purple"
            >

              <VedReferenceIcon
                name="production"
              />

            </span>


            <div
              className="ved-summary-copy"
            >

              <div
                className="card-label"
              >
                Производство
              </div>


              <div
                className="big-number"
              >
                {
                  productionCount
                }
              </div>


              <div
                className="muted"
              >
                Подтверждённые заказы
              </div>

            </div>

          </div>


          <div
            className="card ved-summary-card"
          >

            <span
              className="ved-summary-icon ved-summary-icon--orange"
            >

              <VedReferenceIcon
                name="transit"
              />

            </span>


            <div
              className="ved-summary-copy"
            >

              <div
                className="card-label"
              >
                В пути
              </div>


              <div
                className="big-number"
              >
                {
                  transitCount
                }
              </div>


              <div
                className="muted"
              >
                Едут в Россию
              </div>

            </div>

          </div>

        </section>


        {/* ===================================
            ЗАКАЗЫ ВЭД
            =================================== */}

        <section
          className="section ved-orders-section"
        >

          <div
            className="section-header ved-orders-header"
          >

            <div
              className="ved-orders-heading"
            >

              <h2
                className="section-title"
              >
                Заказы ВЭД
              </h2>


              <div
                className="muted"
              >
                Переданные, активные и завершённые заказы.
              </div>

            </div>


            <div
              className="ved-orders-count"
            >
              Всего:{" "}

              <strong>
                {
                  orders.length
                }
              </strong>
            </div>

          </div>


          {
            orders.length ===
            0

              ? (

                <div
                  className="reason-box ved-empty"
                >

                  <strong>
                    Заказов пока нет
                  </strong>


                  <div
                    className="reason-text"
                  >
                    После передачи заказа из Закупа он появится здесь.
                  </div>

                </div>

              )

              : (

                <div
                  className="table-wrapper"
                >

                  <table
                    className="table ved-orders-table"
                  >

                    <thead>

                      <tr>

                        <th className="left">
                          Заказ
                        </th>

                        <th className="left">
                          Статус
                        </th>

                        <th className="left">
                          Транспорт
                        </th>

                        <th className="left">
                          Передан
                        </th>

                        <th className="left">
                          Ответственный ВЭД
                        </th>

                        <th className="right">
                          Товаров
                        </th>

                        <th className="right">
                          Коробов
                        </th>

                        <th className="right">
                          Шт.
                        </th>

                        <th className="right">
                          CNY
                        </th>

                        <th className="right">
                          м³
                        </th>

                        <th className="right">
                          Действие
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {
                        orders.map(
                          order => {

                            const orderTotals =
                              totals.get(
                                order.id
                              )
                              ??
                              {
                                items: 0,
                                cartons: 0,
                                quantity: 0,
                                priceCny: 0,
                                volumeM3: 0,
                                weightTons: 0,
                              };


                            const displayNumber =
                              order.order_number
                              ??
                              `Заказ ${shortId(order.id)}`;


                            return (

                              <tr
                                key={
                                  order.id
                                }
                              >

                                <td className="left">

                                  <Link
                                    href={
                                      `/ved-orders/${order.id}?from=ved`
                                    }
                                    className="ved-order-link"
                                  >

                                    <strong>
                                      {
                                        displayNumber
                                      }
                                    </strong>

                                  </Link>


                                  <div
                                    className="muted ved-order-created"
                                  >
                                    Создан:{" "}

                                    {
                                      formatDate(
                                        order.created_at
                                      )
                                    }
                                  </div>

                                </td>


                                <td className="left">

                                  <span
                                    className={
                                      `ved-status ${workflowStatusClass(
                                        order.workflow_status
                                      )}`
                                    }
                                  >

                                    <span
                                      className="ved-status-dot"
                                    />


                                    {
                                      workflowStatusName(
                                        order.workflow_status
                                      )
                                    }

                                  </span>

                                </td>


                                <td className="left">
                                  {
                                    transportName(
                                      order
                                    )
                                  }
                                </td>


                                <td className="left">
                                  {
                                    formatDate(
                                      order.first_sent_to_ved_at
                                    )
                                  }
                                </td>


                                <td className="left">

                                  {
                                    order.ved_responsible_name
                                    ??
                                    "Не назначен"
                                  }

                                </td>


                                <td className="right">
                                  {
                                    formatNumber(
                                      orderTotals.items
                                    )
                                  }
                                </td>


                                <td className="right">
                                  {
                                    formatNumber(
                                      orderTotals.cartons
                                    )
                                  }
                                </td>


                                <td className="right">

                                  <strong
                                    className="ved-number-strong"
                                  >
                                    {
                                      formatNumber(
                                        orderTotals.quantity
                                      )
                                    }
                                  </strong>

                                </td>


                                <td className="right">
                                  {
                                    formatNumber(
                                      orderTotals.priceCny,
                                      2
                                    )
                                  }
                                </td>


                                <td className="right">
                                  {
                                    formatNumber(
                                      orderTotals.volumeM3,
                                      3
                                    )
                                  }
                                </td>


                                <td
                                  className="right ved-action-cell"
                                >

                                  {
                                    order.workflow_status ===
                                    "sent_to_ved"

                                      ? (

                                        <form
                                          action={
                                            takeOrderInWork
                                          }
                                        >

                                          <input
                                            type="hidden"
                                            name="orderId"
                                            value={
                                              order.id
                                            }
                                          />


                                          <button
                                            type="submit"
                                            className="primary-button ved-action-button"
                                          >
                                            Взять в работу
                                          </button>

                                        </form>

                                      )

                                      : (

                                        <Link
                                          href={
                                            `/ved-orders/${order.id}?from=ved`
                                          }
                                          className="secondary-button ved-action-button"
                                        >
                                          Открыть
                                        </Link>

                                      )
                                  }

                                </td>

                              </tr>

                            );

                          }
                        )
                      }

                    </tbody>

                  </table>

                </div>

              )
          }

        </section>


        {/* ===================================
            ЛОГИКА РАБОТЫ
            =================================== */}

        <section
          className="section ved-logic-section"
        >

          <div
            className="reason-box ved-logic-box"
          >

            <span
              className="ved-logic-icon"
            >
              <VedReferenceIcon
                name="info"
              />
            </span>


            <div
              className="ved-logic-copy"
            >

              <strong>
                Логика работы ВЭД
              </strong>


              <div
                className="reason-text"
              >
                Заказ сначала появляется со статусом{" "}
                «Передан в ВЭД». После нажатия{" "}
                «Взять в работу» сотрудник становится
                ответственным за этот заказ.
              </div>

            </div>

          </div>

        </section>

      </div>

    </main>

  );

}
