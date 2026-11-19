export const maxDuration = 300;
import PageHeader from "../ui/PageHeader";


import {
  runChinaCalculation,
  createVedOrderDraft,
} from "../actions";

import ZakupProductsSectionClient
from "./ZakupProductsSectionClient";

import ZakupProductsTableClient, {
  type ZakupTableItem,
} from "./ZakupProductsTableClient";
import ZakupDemandTableClient from "./ZakupDemandTableClient";

import "./zakup-reference.css";
import CreateVedDraftSubmitButton from "./CreateVedDraftSubmitButton";
import ZakupCalculationInfo from "./ZakupCalculationInfo";
import ZakupCalculateButton from "./ZakupCalculateButton";

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
    sales_date_from?: string | null;
    sales_date_to?: string | null;
    container_lead_days: number;
    truck_lead_days: number;
    safety_buffer_days: number;
    order_batch_days?: number;
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
    (process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);


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
      item => item.needs_china_order === true &&
        item.container_manual_quantity != null &&
        item.container_manual_quantity > 0 &&
        item.container_effective_final_units > 0
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
      item => item.needs_china_order === true &&
        item.truck_manual_quantity != null &&
        item.truck_manual_quantity > 0 &&
        item.truck_effective_final_units > 0
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


  const reviewScenario: "container" | "truck" =
    simulation?.transport_scenario === "truck_90" ||
    simulation?.transport_scenario === "truck_100" ||
    simulation?.transport_scenario === "manual_review_over_100"
      ? "truck" : "container";

  // Show demand only for the currently selected transport horizon:
  // 194 days for container, 164 days for truck.
  const demandItems = dashboard.items.filter(item =>
    reviewScenario === "container"
      ? item.container_order_units > 0
      : item.truck_order_units > 0
  );

  // Pending SKU decisions never prevent draft creation, but keep the
  // displayed volume flagged as preliminary until each item is reviewed.
  const pendingDecisions = demandItems.filter(item =>
    reviewScenario === "container"
      ? item.container_manual_quantity == null
      : item.truck_manual_quantity == null
  ).length;

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


  const decisionTitle =
    simulation

      ? `Решение: ${transportName(
          simulation
            .transport_scenario
        )}`

      : "Решение: Требуется расчет транспорта";


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

        <PageHeader
          variant="zakup"
          title="Китай — расчёт потребности"
        />


        {/* ===================================
            ОСНОВНАЯ СЕТКА
            =================================== */}

        {/* Единый расчёт: потребность и транспорт запускаются одной операцией */}
        <div className="zakup-v2-calculation-layout">
          <div className="zakup-v2-top-actions">
          <section className="zakup-v2-action-strip">
            <div className="zakup-v2-action-copy">
              <span className="zakup-v2-section-icon">
                <ReferenceIcon name="calculate" />
              </span>
              <div className="zakup-v2-action-text">
                <h2 className="controls-title">Расчёт закупки</h2>
              </div>
            </div>
            <div className="zakup-v2-action-controls">
              <ZakupCalculateButton />
              <ZakupCalculationInfo rules={run} />
            </div>
          </section>

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

              </div>

            </div>


            <form action={createVedOrderDraft}>
              <input
                type="hidden"
                name="scenario"
                value={orderScenario ?? ""}
              />
              <CreateVedDraftSubmitButton
                hasCalculation={Boolean(run && simulation)}
                scenario={orderScenario}
              />
            </form>

          </section>
          </div>

          <section className="zakup-v2-result-grid zakup-v2-result-grid--single-row">
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
                    Объём фуры
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
                    {pendingDecisions > 0 ? "Предварительный объём" : "Выбранный объём"}
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
                    Подтверждено к закупке SKU:{" "}
                    {
                      selectedSkuCount
                    }
                  </div>

                </div>

              </div>



              <div className="zakup-v2-result-card zakup-v2-result-card--decision">
                <span className="zakup-v2-result-icon zakup-v2-result-icon--blue">
                  <ReferenceIcon name="info" />
                </span>
                <div className="zakup-v2-result-copy">
                  <strong className="zakup-v2-decision-title">{decisionTitle}</strong>
                </div>
              </div>

          </section>
        </div>

        {/* ===================================
            ПОТРЕБНОСТЬ В ЗАКУПКЕ / РЕШЕНИЯ
            =================================== */}
        <ZakupProductsSectionClient
          skuCount={demandItems.length}
          title="Потребность в закупке"
          sectionId="zakup-demand-table"
          showLinks={false}
        >
          <ZakupDemandTableClient items={demandItems} scenario={reviewScenario} />
        </ZakupProductsSectionClient>

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
