import Link
from "next/link";

import {
  runChinaCalculation,
  simulateChinaTransport,
  saveChinaManualAdjustment,
  createVedOrderDraft,
} from "../actions";

import ThemeToggle
from "../ThemeToggle";

import "./zakup-reference.css";


// ============================================================
// ТИП ТОВАРА
// ============================================================

type ChinaItem = {
  calculation_item_id: string;
  offer_id: string;
  name: string | null;

  avg_sales_per_day: number;

  own_stock_quantity: number;
  ozon_stock_quantity: number;
  physical_stock: number;

  active_ved_quantity: number;
  effective_stock: number;
  coverage_days: number | null;

  container_order_units: number;
  container_cartons: number;
  container_final_units: number;
  container_order_volume_m3: number;

  container_manual_quantity: number | null;
  container_manual_final_units: number | null;
  container_manual_volume_m3: number | null;
  container_manual_comment: string | null;

  container_effective_final_units: number;
  container_effective_volume_m3: number;

  truck_order_units: number;
  truck_cartons: number;
  truck_final_units: number;
  truck_order_volume_m3: number;

  truck_manual_quantity: number | null;
  truck_manual_final_units: number | null;
  truck_manual_volume_m3: number | null;
  truck_manual_comment: string | null;

  truck_effective_final_units: number;
  truck_effective_volume_m3: number;
};


// ============================================================
// ТИП ДАШБОРДА
// ============================================================

type ChinaDashboard = {
  run: {
    id: string;
    calculated_at: string;
    calculation_version: string;
    sales_window_days: number;
    container_lead_days: number;
    truck_lead_days: number;
    safety_buffer_days: number;
    container_order_point_days: number;
    truck_order_point_days: number;
    container_capacity_m3: number;
    container_tolerance_m3: number;
  } | null;

  simulation: {
    new_products_volume_m3: number;
    container_existing_volume_m3: number;
    container_total_volume_m3: number;
    truck_existing_volume_m3: number;
    truck_total_volume_m3: number;
    transport_scenario: string;
    selected_transport_volume_m3: number;
    decision_reason: string;
    created_at: string;
  } | null;

  items: ChinaItem[];
};


// ============================================================
// ИКОНКИ СТРАНИЦЫ ЗАКУПА
// ============================================================

type ReferenceIconName =
  | "cube"
  | "calculate"
  | "sales"
  | "box"
  | "truck"
  | "transport"
  | "chart"
  | "document"
  | "products"
  | "info";


function ReferenceIcon({
  name,
}: {
  name: ReferenceIconName;
}) {

  if (
    name ===
    "sales"
  ) {

    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="9"
          cy="20"
          r="1.5"
        />

        <circle
          cx="18"
          cy="20"
          r="1.5"
        />

        <path
          d="
            M3 4
            h2
            l2.2 10
            h10.9
            l2-7
            H6
          "
        />
      </svg>
    );

  }


  if (
    name ===
    "box"
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
    name ===
    "truck"
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


  if (
    name ===
    "transport"
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


  if (
    name ===
    "chart"
  ) {

    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="
            M5 20
            V12
          "
        />

        <path
          d="
            M10 20
            V7
          "
        />

        <path
          d="
            M15 20
            V10
          "
        />

        <path
          d="
            M20 20
            V4
          "
        />
      </svg>
    );

  }


  if (
    name ===
    "document"
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
    name ===
    "products"
  ) {

    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="
            M12 3
            19 7
            12 11
            5 7
            Z
          "
        />

        <path
          d="
            M5 7
            v9
            l7 4
            7-4
            V7
          "
        />

        <path
          d="
            M12 11
            v9
          "
        />
      </svg>
    );

  }


  if (
    name ===
    "calculate"
  ) {

    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="
            M6 4
            h12
          "
        />

        <path
          d="
            M6 9
            h12
          "
        />

        <path
          d="
            M6 14
            h12
          "
        />

        <path
          d="
            M6 19
            h12
          "
        />
      </svg>
    );

  }


  if (
    name ===
    "info"
  ) {

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


// ============================================================
// ПОЛУЧЕНИЕ ДАННЫХ ИЗ SUPABASE
// ============================================================

async function getChinaDashboard():
  Promise<ChinaDashboard> {

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


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_china_dashboard`,
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
        },

        body:
          JSON.stringify(
            {}
          ),

        cache:
          "no-store",
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();


    throw new Error(
      `Ошибка Supabase: ${response.status} ${errorText}`
    );

  }


  return response.json();

}


// ============================================================
// НАЗВАНИЕ ТРАНСПОРТА
// ============================================================

function transportName(
  scenario?: string
) {

  switch (
    scenario
  ) {

    case "container":

      return "Контейнер 68 м³";


    case "container_manual_review":

      return "Контейнер — ручная проверка";


    case "truck_90":

      return "Фура 90 м³";


    case "truck_100":

      return "Фура 100 м³";


    case "manual_review_over_100":

      return "Требуется ручное решение";


    default:

      return "Не рассчитано";

  }

}


// ============================================================
// ФОРМАТИРОВАНИЕ ЧИСЕЛ
// ============================================================

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

  if (
    value ===
      null
    ||
    value ===
      undefined
  ) {

    return "—";

  }


  return Number(
    value
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


// ============================================================
// СТРАНИЦА ЗАКУПА
// ============================================================

export default async function Home() {

  let dashboard:
    ChinaDashboard;


  try {

    dashboard =
      await getChinaDashboard();

  } catch (
    error
  ) {

    return (

      <main
        className=
          "page zakup-reference-page"
      >

        <div
          className=
            "error-box"
        >

          <h1>
            Ошибка загрузки данных
          </h1>


          <p>
            {
              error instanceof Error

                ? error.message

                : "Неизвестная ошибка"
            }
          </p>

        </div>

      </main>

    );

  }


  const simulation =
    dashboard.simulation;


  const run =
    dashboard.run;


  // ==========================================================
  // СЦЕНАРИЙ ДЛЯ ФОРМИРОВАНИЯ ЗАКАЗА
  // ==========================================================

  const orderScenario:
    "container"
    |
    "truck"
    |
    null =

      simulation
        ?.transport_scenario ===
        "container"

        ? "container"

        : simulation
            ?.transport_scenario ===
            "truck_90"
          ||
          simulation
            ?.transport_scenario ===
            "truck_100"

          ? "truck"

          : null;


  const hasOrderItems =

    orderScenario !==
      null

      ? dashboard.items.some(
          (
            item
          ) =>

            orderScenario ===
              "container"

              ? item
                  .container_effective_final_units >
                0

              : item
                  .truck_effective_final_units >
                0
        )

      : false;


  const canCreateOrder =
    Boolean(
      run
      &&
      simulation
      &&
      orderScenario
      &&
      hasOrderItems
    );


  return (

    <main
      className=
        "page zakup-reference-page"
    >

      <div
        className=
          "container"
      >

        {/* ===================================
            HEADER
            =================================== */}

        <header
          className=
            "header zakup-header"
        >

          <div
            className=
              "zakup-title-block"
          >

            <span
              className=
                "zakup-title-icon"
            >

              <ReferenceIcon
                name="cube"
              />

            </span>


            <div>

              <div
                className=
                  "small-label"
              >
                СИСТЕМА ЗАКУПА / РАСЧЁТЫ ПОТРЕБНОСТИ
              </div>


              <h1
                className=
                  "title"
              >
                Китай — расчёт потребности
              </h1>


              <p
                className=
                  "subtitle"
              >
                Тестовый режим.
                Формируется внутренний черновик ВЭД.
                Внешний заказ поставщику автоматически
                не отправляется.
              </p>

            </div>

          </div>


          <div
            className=
              "header-actions zakup-header-actions"
          >

            <ThemeToggle />


            <div
              className=
                "version-box zakup-version"
            >

              <div
                className=
                  "small-label"
              >
                Версия расчёта
              </div>


              <strong>
                {
                  run
                    ?.calculation_version
                  ??
                  "—"
                }
              </strong>

            </div>


            <Link
              href="/"

              className=
                "secondary-button navigation-button"
            >
              ← Главная
            </Link>

          </div>

        </header>


        {/* ===================================
            УПРАВЛЕНИЕ РАСЧЁТОМ
            =================================== */}

        <section
          className=
            "controls zakup-control-strip"
        >

          <div
            className=
              "zakup-control-content"
          >

            <span
              className=
                "zakup-section-icon"
            >

              <ReferenceIcon
                name="calculate"
              />

            </span>


            <div>

              <h2
                className=
                  "controls-title"
              >
                Управление расчётом
              </h2>


              <div
                className=
                  "muted"
              >
                Создание нового расчёта
                потребности по текущим данным
              </div>

            </div>

          </div>


          <form
            action={
              runChinaCalculation
            }
          >

            <button
              type="submit"

              className=
                "primary-button"
            >
              Рассчитать потребность Китай
            </button>

          </form>

        </section>


        {/* ===================================
            ОСНОВНЫЕ ПАРАМЕТРЫ
            =================================== */}

        <section
          className=
            "summary-grid zakup-summary-grid"
        >

          <div
            className=
              "card zakup-metric-card"
          >

            <span
              className=
                "zakup-metric-icon zakup-metric-icon--green"
            >

              <ReferenceIcon
                name="sales"
              />

            </span>


            <div
              className=
                "zakup-metric-copy"
            >

              <div
                className=
                  "card-label"
              >
                Продажи
              </div>


              <div
                className=
                  "big-number"
              >
                {
                  run
                    ?.sales_window_days
                  ??
                  28
                } дней
              </div>


              <div
                className=
                  "muted"
              >
                Период среднего значения
              </div>

            </div>

          </div>


          <div
            className=
              "card zakup-metric-card"
          >

            <span
              className=
                "zakup-metric-icon zakup-metric-icon--red"
            >

              <ReferenceIcon
                name="box"
              />

            </span>


            <div
              className=
                "zakup-metric-copy"
            >

              <div
                className=
                  "card-label"
              >
                Контейнер
              </div>


              <div
                className=
                  "big-number"
              >
                {
                  run
                    ?.container_order_point_days
                  ??
                  100
                } дней
              </div>


              <div
                className=
                  "muted"
              >
                90 дней плечо + 10 дней буфер
              </div>

            </div>

          </div>


          <div
            className=
              "card zakup-metric-card"
          >

            <span
              className=
                "zakup-metric-icon zakup-metric-icon--blue"
            >

              <ReferenceIcon
                name="box"
              />

            </span>


            <div
              className=
                "zakup-metric-copy"
            >

              <div
                className=
                  "card-label"
              >
                Фура
              </div>


              <div
                className=
                  "big-number"
              >
                {
                  run
                    ?.truck_order_point_days
                  ??
                  70
                } дней
              </div>


              <div
                className=
                  "muted"
              >
                60 дней плечо + 10 дней буфер
              </div>

            </div>

          </div>


          <div
            className=
              "card zakup-metric-card"
          >

            <span
              className=
                "zakup-metric-icon zakup-metric-icon--purple"
            >

              <ReferenceIcon
                name="truck"
              />

            </span>


            <div
              className=
                "zakup-metric-copy"
            >

              <div
                className=
                  "card-label"
              >
                Транспорт
              </div>


              <div
                className=
                  "big-number"
              >
                {
                  transportName(
                    simulation
                      ?.transport_scenario
                  )
                }
              </div>


              <div
                className=
                  "muted"
              >
                Текущий результат симуляции
              </div>

            </div>

          </div>

        </section>


        {/* ===================================
            НАСТРОЙКА СИМУЛЯЦИИ
            =================================== */}

        <section
          className=
            "section zakup-transport-input-section"
        >

          <div
            className=
              "zakup-section-heading"
          >

            <span
              className=
                "zakup-section-icon"
            >

              <ReferenceIcon
                name="transport"
              />

            </span>


            <div>

              <h2
                className=
                  "section-title"
              >
                Симуляция транспорта
              </h2>


              <div
                className=
                  "muted"
              >
                Укажите общий объём новых товаров.
                Объём действующих SKU система
                считает автоматически.
              </div>

            </div>

          </div>


          <form
            action={
              simulateChinaTransport
            }

            className=
              "transport-form zakup-transport-form"
          >

            <div
              className=
                "input-group"
            >

              <label
                htmlFor=
                  "newProductsVolume"

                className=
                  "input-label"
              >
                Новые товары, м³
              </label>


              <input
                id=
                  "newProductsVolume"

                name=
                  "newProductsVolume"

                type="number"

                step=
                  "0.001"

                min="0"

                defaultValue={
                  simulation
                    ?.new_products_volume_m3
                  ??
                  0
                }

                className=
                  "input"

                required
              />

            </div>


            <button
              type="submit"

              className=
                "secondary-button"
            >
              Пересчитать транспорт
            </button>

          </form>

        </section>


        {/* ===================================
            РЕЗУЛЬТАТ ТРАНСПОРТА
            =================================== */}

        {
          simulation
          &&
          (

            <section
              className=
                "section zakup-transport-result"
            >

              <div
                className=
                  "section-header"
              >

                <div
                  className=
                    "zakup-section-heading"
                >

                  <span
                    className=
                      "zakup-section-icon"
                  >

                    <ReferenceIcon
                      name="chart"
                    />

                  </span>


                  <div>

                    <h2
                      className=
                        "section-title"
                    >
                      Транспортная симуляция
                    </h2>


                    <div
                      className=
                        "muted"
                    >
                      Последний рассчитанный сценарий
                    </div>

                  </div>

                </div>

              </div>


              <div
                className=
                  "transport-grid zakup-result-grid"
              >

                <div
                  className=
                    "transport-card zakup-result-card"
                >

                  <span
                    className=
                      "zakup-result-icon zakup-result-icon--green"
                  >

                    <ReferenceIcon
                      name="box"
                    />

                  </span>


                  <div
                    className=
                      "zakup-result-copy"
                  >

                    <span
                      className=
                        "card-label"
                    >
                      Новые товары
                    </span>


                    <strong
                      className=
                        "transport-value"
                    >
                      {
                        formatNumber(
                          simulation
                            .new_products_volume_m3,
                          3
                        )
                      } м³
                    </strong>

                  </div>

                </div>


                <div
                  className=
                    "transport-card zakup-result-card"
                >

                  <span
                    className=
                      "zakup-result-icon zakup-result-icon--purple"
                  >

                    <ReferenceIcon
                      name="box"
                    />

                  </span>


                  <div
                    className=
                      "zakup-result-copy"
                  >

                    <span
                      className=
                        "card-label"
                    >
                      Контейнерный расчёт
                    </span>


                    <strong
                      className=
                        "transport-value"
                    >
                      {
                        formatNumber(
                          simulation
                            .container_total_volume_m3,
                          3
                        )
                      } м³
                    </strong>


                    <div
                      className=
                        "muted"
                    >
                      Действующие SKU:{" "}
                      {
                        formatNumber(
                          simulation
                            .container_existing_volume_m3,
                          3
                        )
                      } м³
                    </div>

                  </div>

                </div>


                <div
                  className=
                    "transport-card zakup-result-card"
                >

                  <span
                    className=
                      "zakup-result-icon zakup-result-icon--blue"
                  >

                    <ReferenceIcon
                      name="truck"
                    />

                  </span>


                  <div
                    className=
                      "zakup-result-copy"
                  >

                    <span
                      className=
                        "card-label"
                    >
                      После пересчёта под фуру
                    </span>


                    <strong
                      className=
                        "transport-value"
                    >
                      {
                        formatNumber(
                          simulation
                            .truck_total_volume_m3,
                          3
                        )
                      } м³
                    </strong>


                    <div
                      className=
                        "muted"
                    >
                      Действующие SKU:{" "}
                      {
                        formatNumber(
                          simulation
                            .truck_existing_volume_m3,
                          3
                        )
                      } м³
                    </div>

                  </div>

                </div>


                <div
                  className=
                    "transport-card zakup-result-card"
                >

                  <span
                    className=
                      "zakup-result-icon zakup-result-icon--orange"
                  >

                    <ReferenceIcon
                      name="box"
                    />

                  </span>


                  <div
                    className=
                      "zakup-result-copy"
                  >

                    <span
                      className=
                        "card-label"
                    >
                      Выбранный объём
                    </span>


                    <strong
                      className=
                        "transport-value"
                    >
                      {
                        formatNumber(
                          simulation
                            .selected_transport_volume_m3,
                          3
                        )
                      } м³
                    </strong>

                  </div>

                </div>

              </div>


              <div
                className=
                  "reason-box zakup-decision-box"
              >

                <span
                  className=
                    "zakup-decision-icon"
                >

                  <ReferenceIcon
                    name="info"
                  />

                </span>


                <div
                  className=
                    "zakup-decision-copy"
                >

                  <strong>
                    Решение:{" "}
                    {
                      transportName(
                        simulation
                          .transport_scenario
                      )
                    }
                  </strong>


                  <div
                    className=
                      "reason-text"
                  >
                    {
                      simulation
                        .decision_reason
                    }
                  </div>

                </div>

              </div>

            </section>

          )
        }


        {/* ===================================
            ФОРМИРОВАНИЕ ЗАКАЗА
            =================================== */}

        {
          simulation
          &&
          (

            <section
              className=
                "controls zakup-order-strip"
            >

              <div
                className=
                  "zakup-order-content"
              >

                <span
                  className=
                    "zakup-order-icon"
                >

                  <ReferenceIcon
                    name="document"
                  />

                </span>


                <div>

                  <h2
                    className=
                      "controls-title"
                  >
                    Формирование заказа
                  </h2>


                  <div
                    className=
                      "muted"
                  >

                    {
                      canCreateOrder

                        ? `Будет создан внутренний черновик ВЭД. Сценарий: ${
                            orderScenario ===
                              "container"

                              ? "контейнер"

                              : "фура"
                          }.`

                        : orderScenario

                          ? "В выбранном сценарии нет SKU с итоговым количеством больше 0."

                          : "Текущий транспортный сценарий требует ручного решения. Автоматическое формирование заказа недоступно."
                    }

                  </div>

                </div>

              </div>


              {
                canCreateOrder
                &&
                orderScenario
                &&
                (

                  <form
                    action={
                      createVedOrderDraft
                    }
                  >

                    <input
                      type="hidden"

                      name=
                        "scenario"

                      value={
                        orderScenario
                      }
                    />


                    <input
                      type="hidden"

                      name=
                        "newProductsVolume"

                      value={
                        simulation
                          .new_products_volume_m3
                      }
                    />


                    <button
                      type="submit"

                      className=
                        "secondary-button"
                    >
                      Сформировать заказ
                    </button>

                  </form>

                )
              }

            </section>

          )
        }


        {/* ===================================
            ОСНОВНАЯ ТАБЛИЦА ТОВАРОВ
            =================================== */}

        <section
          className=
            "section zakup-products-section"
        >

          <div
            className=
              "section-header"
          >

            <div
              className=
                "zakup-products-heading"
            >

              <span
                className=
                  "zakup-products-icon"
              >

                <ReferenceIcon
                  name="products"
                />

              </span>


              <div>

                <h2
                  className=
                    "section-title"
                >
                  Товары
                </h2>


                <div
                  className=
                    "muted"
                >
                  Итоговые значения уже
                  учитывают ручные корректировки
                </div>

              </div>

            </div>


            <div
              className=
                "muted"
            >
              SKU: {
                dashboard
                  .items
                  .length
              }
            </div>

          </div>


          <div
            className=
              "table-wrapper"
          >

            <table
              className=
                "table"
            >

              <thead>

                <tr>

                  <th
                    className=
                      "left"
                  >
                    Артикул
                  </th>

                  <th
                    className=
                      "left"
                  >
                    Товар
                  </th>

                  <th
                    className=
                      "right"
                  >
                    Продажи/сутки
                  </th>

                  <th
                    className=
                      "right"
                  >
                    Наш склад
                  </th>

                  <th
                    className=
                      "right"
                  >
                    Ozon
                  </th>

                  <th
                    className=
                      "right"
                  >
                    ВЭД
                  </th>

                  <th
                    className=
                      "right"
                  >
                    Общий остаток
                  </th>

                  <th
                    className=
                      "right"
                  >
                    Покрытие
                  </th>

                  <th
                    className=
                      "right"
                  >
                    Контейнер, шт.
                  </th>

                  <th
                    className=
                      "right"
                  >
                    Контейнер, м³
                  </th>

                  <th
                    className=
                      "right"
                  >
                    Фура, шт.
                  </th>

                  <th
                    className=
                      "right"
                  >
                    Фура, м³
                  </th>

                </tr>

              </thead>


              <tbody>

                {
                  dashboard.items.map(
                    (
                      item
                    ) => (

                      <tr
                        key={
                          item
                            .calculation_item_id
                        }
                      >

                        <td
                          className=
                            "left"
                        >
                          <strong>
                            {
                              item.offer_id
                            }
                          </strong>
                        </td>


                        <td
                          className=
                            "left"
                        >
                          {
                            item.name
                            ??
                            "—"
                          }
                        </td>


                        <td
                          className=
                            "right"
                        >
                          {
                            formatNumber(
                              item
                                .avg_sales_per_day,
                              2
                            )
                          }
                        </td>


                        <td
                          className=
                            "right"
                        >
                          {
                            formatNumber(
                              item
                                .own_stock_quantity
                            )
                          }
                        </td>


                        <td
                          className=
                            "right"
                        >
                          {
                            formatNumber(
                              item
                                .ozon_stock_quantity
                            )
                          }
                        </td>


                        <td
                          className=
                            "right"
                        >
                          {
                            formatNumber(
                              item
                                .active_ved_quantity
                            )
                          }
                        </td>


                        <td
                          className=
                            "right"
                        >
                          {
                            formatNumber(
                              item
                                .effective_stock
                            )
                          }
                        </td>


                        <td
                          className=
                            "right"
                        >

                          <strong>
                            {
                              formatNumber(
                                item
                                  .coverage_days,
                                1
                              )
                            }
                          </strong>{" "}
                          дн.

                        </td>


                        <td
                          className=
                            "right"
                        >

                          <strong>
                            {
                              formatNumber(
                                item
                                  .container_effective_final_units
                              )
                            }
                          </strong>


                          {
                            item
                              .container_manual_quantity !==
                              null
                            &&
                            (

                              <div
                                className=
                                  "muted"
                              >
                                вручную
                              </div>

                            )
                          }

                        </td>


                        <td
                          className=
                            "right"
                        >
                          {
                            formatNumber(
                              item
                                .container_effective_volume_m3,
                              3
                            )
                          }
                        </td>


                        <td
                          className=
                            "right"
                        >

                          <strong>
                            {
                              formatNumber(
                                item
                                  .truck_effective_final_units
                              )
                            }
                          </strong>


                          {
                            item
                              .truck_manual_quantity !==
                              null
                            &&
                            (

                              <div
                                className=
                                  "muted"
                              >
                                вручную
                              </div>

                            )
                          }

                        </td>


                        <td
                          className=
                            "right"
                        >
                          {
                            formatNumber(
                              item
                                .truck_effective_volume_m3,
                              3
                            )
                          }
                        </td>

                      </tr>

                    )
                  )
                }

              </tbody>

            </table>

          </div>

        </section>


        {/* ===================================
            РУЧНЫЕ КОРРЕКТИРОВКИ
            =================================== */}

        <section
          className=
            "section zakup-adjustments-section"
        >

          <div
            className=
              "section-header"
          >

            <div>

              <h2
                className=
                  "section-title"
              >
                Ручные корректировки
              </h2>


              <div
                className=
                  "muted"
              >
                Системный расчёт не
                перезаписывается.
                Каждая корректировка
                сохраняется отдельно.
              </div>

            </div>

          </div>


          <div
            className=
              "adjustments-list"
          >

            {
              dashboard.items.map(
                (
                  item
                ) => (

                  <div
                    className=
                      "adjustment-card"

                    key={
                      item
                        .calculation_item_id
                    }
                  >

                    <div
                      className=
                        "adjustment-product"
                    >

                      <strong>
                        {
                          item.offer_id
                        }
                      </strong>


                      <span
                        className=
                          "muted"
                      >
                        {
                          item.name
                          ??
                          "—"
                        }
                      </span>


                      <span
                        className=
                          "muted"
                      >
                        Продажи:{" "}
                        {
                          formatNumber(
                            item
                              .avg_sales_per_day,
                            2
                          )
                        } / сутки
                      </span>


                      <span
                        className=
                          "muted"
                      >
                        Остаток:{" "}
                        {
                          formatNumber(
                            item
                              .effective_stock
                          )
                        } шт.
                      </span>


                      <span
                        className=
                          "muted"
                      >
                        Покрытие:{" "}
                        {
                          formatNumber(
                            item
                              .coverage_days,
                            1
                          )
                        } дн.
                      </span>

                    </div>


                    <form
                      action={
                        saveChinaManualAdjustment
                      }

                      className=
                        "adjustment-form"
                    >

                      <input
                        type="hidden"

                        name=
                          "calculationItemId"

                        value={
                          item
                            .calculation_item_id
                        }
                      />


                      <input
                        type="hidden"

                        name=
                          "scenario"

                        value=
                          "container"
                      />


                      <div>

                        <div
                          className=
                            "input-label"
                        >
                          Контейнер
                        </div>


                        <div
                          className=
                            "muted"
                        >
                          Потребность:{" "}
                          {
                            formatNumber(
                              item
                                .container_order_units
                            )
                          } шт.
                        </div>


                        <div
                          className=
                            "muted"
                        >
                          После коробок:{" "}
                          {
                            formatNumber(
                              item
                                .container_final_units
                            )
                          } шт.
                        </div>


                        <div
                          className=
                            "muted"
                        >
                          Объём системы:{" "}
                          {
                            formatNumber(
                              item
                                .container_order_volume_m3,
                              3
                            )
                          } м³
                        </div>

                      </div>


                      <div
                        className=
                          "input-group"
                      >

                        <label
                          className=
                            "input-label"
                        >
                          Количество вручную
                        </label>


                        <input
                          className=
                            "adjustment-input"

                          type="number"

                          min="0"

                          step="1"

                          name=
                            "manualQuantity"

                          defaultValue={
                            item
                              .container_manual_quantity
                            ??
                            item
                              .container_order_units
                          }

                          required
                        />

                      </div>


                      <div
                        className=
                          "input-group"
                      >

                        <label
                          className=
                            "input-label"
                        >
                          Комментарий
                        </label>


                        <input
                          className=
                            "comment-input"

                          type="text"

                          name=
                            "comment"

                          placeholder=
                            "Причина изменения"

                          defaultValue={
                            item
                              .container_manual_comment
                            ??
                            ""
                          }
                        />

                      </div>


                      <button
                        className=
                          "secondary-button"

                        type=
                          "submit"
                      >
                        Сохранить
                      </button>

                    </form>


                    {
                      item
                        .container_manual_quantity !==
                        null
                      &&
                      (

                        <div
                          className=
                            "reason-text"
                        >
                          Текущая ручная
                          корректировка контейнера:{" "}

                          <strong>
                            {
                              formatNumber(
                                item
                                  .container_manual_quantity
                              )
                            } шт.
                          </strong>

                          {" → "}

                          {
                            formatNumber(
                              item
                                .container_manual_final_units
                            )
                          } шт. после коробок

                          {" / "}

                          {
                            formatNumber(
                              item
                                .container_manual_volume_m3,
                              3
                            )
                          } м³
                        </div>

                      )
                    }


                    <form
                      action={
                        saveChinaManualAdjustment
                      }

                      className=
                        "adjustment-form"
                    >

                      <input
                        type="hidden"

                        name=
                          "calculationItemId"

                        value={
                          item
                            .calculation_item_id
                        }
                      />


                      <input
                        type="hidden"

                        name=
                          "scenario"

                        value=
                          "truck"
                      />


                      <div>

                        <div
                          className=
                            "input-label"
                        >
                          Фура
                        </div>


                        <div
                          className=
                            "muted"
                        >
                          Потребность:{" "}
                          {
                            formatNumber(
                              item
                                .truck_order_units
                            )
                          } шт.
                        </div>


                        <div
                          className=
                            "muted"
                        >
                          После коробок:{" "}
                          {
                            formatNumber(
                              item
                                .truck_final_units
                            )
                          } шт.
                        </div>


                        <div
                          className=
                            "muted"
                        >
                          Объём системы:{" "}
                          {
                            formatNumber(
                              item
                                .truck_order_volume_m3,
                              3
                            )
                          } м³
                        </div>

                      </div>


                      <div
                        className=
                          "input-group"
                      >

                        <label
                          className=
                            "input-label"
                        >
                          Количество вручную
                        </label>


                        <input
                          className=
                            "adjustment-input"

                          type="number"

                          min="0"

                          step="1"

                          name=
                            "manualQuantity"

                          defaultValue={
                            item
                              .truck_manual_quantity
                            ??
                            item
                              .truck_order_units
                          }

                          required
                        />

                      </div>


                      <div
                        className=
                          "input-group"
                      >

                        <label
                          className=
                            "input-label"
                        >
                          Комментарий
                        </label>


                        <input
                          className=
                            "comment-input"

                          type="text"

                          name=
                            "comment"

                          placeholder=
                            "Причина изменения"

                          defaultValue={
                            item
                              .truck_manual_comment
                            ??
                            ""
                          }
                        />

                      </div>


                      <button
                        className=
                          "secondary-button"

                        type=
                          "submit"
                      >
                        Сохранить
                      </button>

                    </form>


                    {
                      item
                        .truck_manual_quantity !==
                        null
                      &&
                      (

                        <div
                          className=
                            "reason-text"
                        >
                          Текущая ручная
                          корректировка фуры:{" "}

                          <strong>
                            {
                              formatNumber(
                                item
                                  .truck_manual_quantity
                              )
                            } шт.
                          </strong>

                          {" → "}

                          {
                            formatNumber(
                              item
                                .truck_manual_final_units
                            )
                          } шт. после коробок

                          {" / "}

                          {
                            formatNumber(
                              item
                                .truck_manual_volume_m3,
                              3
                            )
                          } м³
                        </div>

                      )
                    }

                  </div>

                )
              )
            }

          </div>

        </section>


        {/* ===================================
            FOOTER
            =================================== */}

        <footer
          className=
            "footer"
        >
          Последний расчёт:{" "}
          {
            run
              ?.calculated_at

              ? new Date(
                  run
                    .calculated_at
                ).toLocaleString(
                  "ru-RU"
                )

              : "—"
          }
        </footer>

      </div>

    </main>

  );

}
