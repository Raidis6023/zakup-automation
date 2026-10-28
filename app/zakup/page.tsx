

import {
  runChinaCalculation,
  simulateChinaTransport,
  createVedOrderDraft,
} from "../actions";

import ZakupProductsSectionClient
from "./ZakupProductsSectionClient";

import ZakupProductsTableClient, {
  type ZakupTableItem,
} from "./ZakupProductsTableClient";

import "./zakup-reference.css";
import CreateVedDraftSubmitButton from "./CreateVedDraftSubmitButton";

import "./zakup-layout-v2.css";


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

  items:
    ZakupTableItem[];
};


// ============================================================
// ИКОНКИ
// ============================================================

type ReferenceIconName =
  | "calculate"
  | "sales"
  | "box"
  | "truck"
  | "document"
  | "info";


function ReferenceIcon({
  name,
}: {
  name:
    ReferenceIconName;
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
        d="M6 4h12"
      />

      <path
        d="M6 9h12"
      />

      <path
        d="M6 14h12"
      />

      <path
        d="M6 19h12"
      />

    </svg>

  );

}


// ============================================================
// ДАННЫЕ SUPABASE
// ============================================================

async function getChinaDashboard():
Promise<ChinaDashboard> {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  if (
    !supabaseUrl
  ) {

    throw new Error(
      "Не найдена переменная NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (
    !supabaseSecretKey
  ) {

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


  if (
    !response.ok
  ) {

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
  scenario?:
    string
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

      return "Требуется расчет транспорта";

  }

}


// ============================================================
// ФОРМАТИРОВАНИЕ
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
// КОЛИЧЕСТВО SKU В ВЫБРАННОМ ОБЪЁМЕ
// ============================================================

function getSelectedSkuCount(
  items:
    ZakupTableItem[],

  scenario:
    string
    |
    null
    |
    undefined
) {

  if (
    scenario ===
      "container"
    ||
    scenario ===
      "container_manual_review"
  ) {

    return items.filter(
      item =>
        item
          .container_effective_final_units >
        0
    ).length;

  }


  if (
    scenario ===
      "truck_90"
    ||
    scenario ===
      "truck_100"
    ||
    scenario ===
      "manual_review_over_100"
  ) {

    return items.filter(
      item =>
        item
          .truck_effective_final_units >
        0
    ).length;

  }


  return 0;

}


// ============================================================
// PAGE
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


  const run =
    dashboard.run;


  const simulation =
    dashboard.simulation;


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
          item =>

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


  const newProductsVolume =
    simulation
      ?.new_products_volume_m3
    ??
    0;


  const containerTotalVolume =
    simulation
      ?.container_total_volume_m3
    ??
    0;


  const truckTotalVolume =
    simulation
      ?.truck_total_volume_m3
    ??
    0;


  const selectedTransportVolume =
    simulation
      ?.selected_transport_volume_m3
    ??
    0;


  const selectedSkuCount =
    getSelectedSkuCount(
      dashboard.items,
      simulation
        ?.transport_scenario
    );


  const newProductsCount =
    0;


  let orderDescription =
    "Сначала выполните расчёт транспорта.";


  if (
    simulation
  ) {

    if (
      canCreateOrder
      &&
      orderScenario
    ) {

      orderDescription =
        `Будет создан внутренний черновик ВЭД. Сценарий: ${
          orderScenario ===
            "container"

            ? "контейнер"

            : "фура"
        }.`;

    } else if (
      orderScenario
    ) {

      orderDescription =
        "В выбранном сценарии нет SKU с итоговым количеством больше 0.";

    } else {

      orderDescription =
        "Текущий транспортный сценарий требует ручного решения.";

    }

  }


  const decisionTitle =
    simulation

      ? `Решение: ${transportName(
          simulation
            .transport_scenario
        )}`

      : "Решение: Требуется расчет транспорта";


  const decisionDescription =
    simulation
      ?.decision_reason
    ??
    "Для определения транспорта выполните расчёт.";


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
            "zakup-v2-header"
        >

          <div
            className=
              "zakup-v2-title"
          >
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


          <div className="zakup-v2-header-actions">
            
          </div>

        </header>


        {/* ===================================
            ОСНОВНАЯ СЕТКА
            =================================== */}

        <div
          className=
            "zakup-v2-main-grid"
        >

          {/* =================================
              ЛЕВАЯ ПОЛОВИНА
              ================================= */}

          <div
            className=
              "zakup-v2-column"
          >

            <section
              className=
                "zakup-v2-action-strip"
            >

              <div
                className=
                  "zakup-v2-action-copy"
              >

                <span
                  className=
                    "zakup-v2-section-icon"
                >

                  <ReferenceIcon
                    name="calculate"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-action-text"
                >

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
                    Создайте новый расчёт потребности
                    по текущим данным
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


            <section
              className=
                "zakup-v2-left-metrics"
            >

              <div
                className=
                  "zakup-v2-metric-card"
              >

                <span
                  className=
                    "zakup-v2-metric-icon zakup-v2-metric-icon--green"
                >

                  <ReferenceIcon
                    name="sales"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-metric-copy"
                >

                  <div
                    className=
                      "card-label"
                  >
                    Продажи
                  </div>


                  <div
                    className=
                      "zakup-v2-metric-value"
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
                      "muted zakup-v2-metric-subtitle"
                  >
                    Период среднего значения
                  </div>

                </div>

              </div>


              <div
                className=
                  "zakup-v2-metric-card zakup-v2-metric-card--transport"
              >

                <span
                  className=
                    "zakup-v2-metric-icon zakup-v2-metric-icon--purple"
                >

                  <ReferenceIcon
                    name="truck"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-metric-copy zakup-v2-metric-copy--transport"
                >

                  <div
                    className=
                      "zakup-v2-transport-options"
                  >

                    <span>
                      Контейнер 68 м³
                    </span>

                    <span>
                      Фура 90 м³
                    </span>

                    <span>
                      Фура 100 м³
                    </span>

                  </div>

                </div>

              </div>


              <div
                className=
                  "zakup-v2-metric-card"
              >

                <span
                  className=
                    "zakup-v2-metric-icon zakup-v2-metric-icon--blue"
                >

                  <ReferenceIcon
                    name="box"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-metric-copy"
                >

                  <div
                    className=
                      "card-label"
                  >
                    Фура
                  </div>


                  <div
                    className=
                      "zakup-v2-metric-value"
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
                      "muted zakup-v2-metric-subtitle"
                  >
                    60 дней плечо + 10 дней буфер
                  </div>

                </div>

              </div>


              <div
                className=
                  "zakup-v2-metric-card"
              >

                <span
                  className=
                    "zakup-v2-metric-icon zakup-v2-metric-icon--red"
                >

                  <ReferenceIcon
                    name="box"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-metric-copy"
                >

                  <div
                    className=
                      "card-label"
                  >
                    Контейнер
                  </div>


                  <div
                    className=
                      "zakup-v2-metric-value"
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
                      "muted zakup-v2-metric-subtitle"
                  >
                    90 дней плечо + 10 дней буфер
                  </div>

                </div>

              </div>

            </section>

          </div>


          {/* =================================
              ПРАВАЯ ПОЛОВИНА
              ================================= */}

          <div
            className=
              "zakup-v2-column"
          >

            <section
              className=
                "zakup-v2-simulation-strip"
            >

              <div
                className=
                  "zakup-v2-simulation-copy"
              >

                <span
                  className=
                    "zakup-v2-section-icon"
                >

                  <ReferenceIcon
                    name="truck"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-simulation-text"
                >

                  <h2
                    className=
                      "section-title"
                  >
                    Симуляция транспорта
                  </h2>


                  <div
                    className=
                      "muted zakup-v2-simulation-description"
                  >
                    Укажите общий объём новых товаров.
                    <br />
                    SKU системы считаются автоматически.
                  </div>

                </div>

              </div>


              <form
                action={
                  simulateChinaTransport
                }

                className=
                  "zakup-v2-simulation-controls"
              >

                <div
                  className=
                    "zakup-v2-simulation-input"
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
                      newProductsVolume
                    }

                    className=
                      "input"

                    required
                  />

                </div>


                <div
                  className=
                    "zakup-v2-simulation-button"
                >

                  <button
                    type="submit"

                    className=
                      "primary-button"
                  >
                    Пересчитать транспорт
                  </button>

                </div>

              </form>

            </section>


            <section
              className=
                "zakup-v2-result-grid"
            >

              <div
                className=
                  "zakup-v2-result-card"
              >

                <span
                  className=
                    "zakup-v2-result-icon zakup-v2-result-icon--green"
                >

                  <ReferenceIcon
                    name="box"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-result-copy"
                >

                  <div
                    className=
                      "card-label"
                  >
                    Новые товары
                  </div>


                  <strong
                    className=
                      "zakup-v2-result-value"
                  >
                    {
                      formatNumber(
                        newProductsVolume,
                        3
                      )
                    } м³
                  </strong>


                  <div
                    className=
                      "muted zakup-v2-result-subtitle"
                  >
                    Количество новых артикулов:{" "}
                    {
                      newProductsCount
                    }
                  </div>

                </div>

              </div>


              <div
                className=
                  "zakup-v2-result-card"
              >

                <span
                  className=
                    "zakup-v2-result-icon zakup-v2-result-icon--purple"
                >

                  <ReferenceIcon
                    name="box"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-result-copy"
                >

                  <div
                    className=
                      "card-label"
                  >
                    Контейнерный объём
                  </div>


                  <strong
                    className=
                      "zakup-v2-result-value"
                  >
                    {
                      formatNumber(
                        containerTotalVolume,
                        3
                      )
                    } м³
                  </strong>

                </div>

              </div>


              <div
                className=
                  "zakup-v2-result-card"
              >

                <span
                  className=
                    "zakup-v2-result-icon zakup-v2-result-icon--blue"
                >

                  <ReferenceIcon
                    name="truck"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-result-copy"
                >

                  <div
                    className=
                      "card-label"
                  >
                    После перевоза под фуру
                  </div>


                  <strong
                    className=
                      "zakup-v2-result-value"
                  >
                    {
                      formatNumber(
                        truckTotalVolume,
                        3
                      )
                    } м³
                  </strong>

                </div>

              </div>


              <div
                className=
                  "zakup-v2-result-card"
              >

                <span
                  className=
                    "zakup-v2-result-icon zakup-v2-result-icon--orange"
                >

                  <ReferenceIcon
                    name="box"
                  />

                </span>


                <div
                  className=
                    "zakup-v2-result-copy"
                >

                  <div
                    className=
                      "card-label"
                  >
                    Выбранный объём
                  </div>


                  <strong
                    className=
                      "zakup-v2-result-value"
                  >
                    {
                      formatNumber(
                        selectedTransportVolume,
                        3
                      )
                    } м³
                  </strong>


                  <div
                    className=
                      "muted zakup-v2-result-subtitle"
                  >
                    Количество выбранных SKU:{" "}
                    {
                      selectedSkuCount
                    }
                  </div>

                </div>

              </div>

            </section>

          </div>

        </div>


        {/* ===================================
            ФОРМИРОВАНИЕ ЗАКАЗА + РЕШЕНИЕ
            =================================== */}

        <div
          className=
            "zakup-v2-bottom-grid"
        >

          <section
            className=
              "zakup-v2-order-strip"
          >

            <div
              className=
                "zakup-v2-order-copy"
            >

              <span
                className=
                  "zakup-v2-order-icon"
              >

                <ReferenceIcon
                  name="document"
                />

              </span>


              <div
                className=
                  "zakup-v2-order-text"
              >

                <strong
                  className=
                    "zakup-v2-order-title"
                >
                  Формирование заказа
                </strong>


                <div
                  className=
                    "muted zakup-v2-order-description"
                >
                  {
                    orderDescription
                  }
                </div>

              </div>

            </div>


            {
              canCreateOrder
              &&
              orderScenario
              &&
              simulation

                ? (

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


                    <CreateVedDraftSubmitButton />

                  </form>

                )

                : (

                  <button
                    type="button"

                    className=
                      "primary-button"

                    disabled
                  >
                    Сформировать заказ
                  </button>

                )
            }

          </section>


          <section
            className=
              "zakup-v2-decision-strip"
          >

            <div
              className=
                "zakup-v2-decision-copy"
            >

              <span
                className=
                  "zakup-v2-decision-icon"
              >

                <ReferenceIcon
                  name="info"
                />

              </span>


              <div
                className=
                  "zakup-v2-decision-text"
              >

                <strong
                  className=
                    "zakup-v2-decision-title"
                >
                  {
                    decisionTitle
                  }
                </strong>


                <div
                  className=
                    "muted zakup-v2-decision-description"
                >
                  {
                    decisionDescription
                  }
                </div>

              </div>

            </div>

          </section>

        </div>


        {/* ===================================
            ТОВАРЫ
            =================================== */}

        <ZakupProductsSectionClient
          skuCount={
            dashboard
              .items
              .length
          }
        >

          <ZakupProductsTableClient
            items={
              dashboard.items
            }
          />

        </ZakupProductsSectionClient>


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
