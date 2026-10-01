import {
  runChinaCalculation,
  simulateChinaTransport,
  saveChinaManualAdjustment,
} from "./actions";

import ThemeToggle from "./ThemeToggle";


// ============================================
// ТИП ТОВАРА
// ============================================

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


  // ==========================================
  // КОНТЕЙНЕР — СИСТЕМНЫЙ РАСЧЁТ
  // ==========================================

  container_order_units: number;
  container_cartons: number;
  container_final_units: number;
  container_order_volume_m3: number;


  // ==========================================
  // КОНТЕЙНЕР — РУЧНАЯ КОРРЕКТИРОВКА
  // ==========================================

  container_manual_quantity:
    number | null;

  container_manual_final_units:
    number | null;

  container_manual_volume_m3:
    number | null;

  container_manual_comment:
    string | null;


  // Итог после учёта ручной корректировки
  container_effective_final_units:
    number;

  container_effective_volume_m3:
    number;


  // ==========================================
  // ФУРА — СИСТЕМНЫЙ РАСЧЁТ
  // ==========================================

  truck_order_units: number;
  truck_cartons: number;
  truck_final_units: number;
  truck_order_volume_m3: number;


  // ==========================================
  // ФУРА — РУЧНАЯ КОРРЕКТИРОВКА
  // ==========================================

  truck_manual_quantity:
    number | null;

  truck_manual_final_units:
    number | null;

  truck_manual_volume_m3:
    number | null;

  truck_manual_comment:
    string | null;


  // Итог после учёта ручной корректировки
  truck_effective_final_units:
    number;

  truck_effective_volume_m3:
    number;
};


// ============================================
// ТИП ДАШБОРДА
// ============================================

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


// ============================================
// ПОЛУЧЕНИЕ ДАННЫХ ИЗ SUPABASE
// ============================================

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
        method: "POST",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({}),

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


// ============================================
// НАЗВАНИЕ ТРАНСПОРТА
// ============================================

function transportName(
  scenario?: string
) {

  switch (scenario) {

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


// ============================================
// ФОРМАТИРОВАНИЕ ЧИСЕЛ
// ============================================

function formatNumber(
  value:
    | number
    | null
    | undefined,

  digits = 0
) {

  if (
    value === null ||
    value === undefined
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


// ============================================
// ГЛАВНАЯ СТРАНИЦА
// ============================================

export default async function Home() {

  let dashboard:
    ChinaDashboard;


  try {

    dashboard =
      await getChinaDashboard();

  } catch (error) {

    return (

      <main className="page">

        <div className="error-box">

          <h1>
            Ошибка загрузки данных
          </h1>


          <p>

            {error instanceof Error
              ? error.message
              : "Неизвестная ошибка"}

          </p>

        </div>

      </main>

    );
  }


  const simulation =
    dashboard.simulation;


  const run =
    dashboard.run;


  return (

    <main className="page">

      <div className="container">


        {/* ===================================
            HEADER
            =================================== */}

        <header className="header">

          <div>

            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>


            <h1 className="title">
              Китай — расчёт потребности
            </h1>


            <p className="subtitle">
              Тестовый режим.
              Реальные заказы
              не создаются.
            </p>

          </div>


          <div className="header-actions">

            <ThemeToggle />


            <div className="version-box">

              <div className="small-label">
                Версия расчёта
              </div>


              <strong>

                {run
                  ?.calculation_version
                  ?? "—"}

              </strong>

            </div>

          </div>

        </header>


        {/* ===================================
            УПРАВЛЕНИЕ РАСЧЁТОМ
            =================================== */}

        <section className="controls">

          <div>

            <h2 className="controls-title">
              Управление расчётом
            </h2>


            <div className="muted">
              Создание нового расчёта
              потребности по текущим данным
            </div>

          </div>


          <form
            action={
              runChinaCalculation
            }
          >

            <button
              type="submit"
              className="primary-button"
            >
              Рассчитать потребность Китай
            </button>

          </form>

        </section>


        {/* ===================================
            ОСНОВНЫЕ ПАРАМЕТРЫ
            =================================== */}

        <section className="summary-grid">


          {/* ПРОДАЖИ */}

          <div className="card">

            <div className="card-label">
              Продажи
            </div>


            <div className="big-number">

              {run
                ?.sales_window_days
                ?? 28} дней

            </div>


            <div className="muted">
              Период среднего значения
            </div>

          </div>


          {/* КОНТЕЙНЕР */}

          <div className="card">

            <div className="card-label">
              Контейнер
            </div>


            <div className="big-number">

              {run
                ?.container_order_point_days
                ?? 100} дней

            </div>


            <div className="muted">
              90 дней плечо
              + 10 дней буфер
            </div>

          </div>


          {/* ФУРА */}

          <div className="card">

            <div className="card-label">
              Фура
            </div>


            <div className="big-number">

              {run
                ?.truck_order_point_days
                ?? 70} дней

            </div>


            <div className="muted">
              60 дней плечо
              + 10 дней буфер
            </div>

          </div>


          {/* РЕШЕНИЕ */}

          <div className="card">

            <div className="card-label">
              Транспорт
            </div>


            <div className="big-number">

              {transportName(
                simulation
                  ?.transport_scenario
              )}

            </div>


            <div className="muted">
              Текущий результат
              симуляции
            </div>

          </div>

        </section>


        {/* ===================================
            НАСТРОЙКА СИМУЛЯЦИИ
            =================================== */}

        <section className="section">

          <div className="section-header">

            <div>

              <h2 className="section-title">
                Симуляция транспорта
              </h2>


              <div className="muted">
                Укажите общий объём
                новых товаров.
                Объём действующих SKU
                система считает автоматически.
              </div>

            </div>

          </div>


          <form
            action={
              simulateChinaTransport
            }

            className="transport-form"
          >

            <div className="input-group">

              <label
                htmlFor=
                  "newProductsVolume"

                className="input-label"
              >
                Новые товары, м³
              </label>


              <input
                id=
                  "newProductsVolume"

                name=
                  "newProductsVolume"

                type="number"

                step="0.001"

                min="0"

                defaultValue={
                  simulation
                    ?.new_products_volume_m3
                    ?? 0
                }

                className="input"

                required
              />

            </div>


            <button
              type="submit"
              className="primary-button"
            >
              Пересчитать транспорт
            </button>

          </form>

        </section>


        {/* ===================================
            РЕЗУЛЬТАТ ТРАНСПОРТНОЙ СИМУЛЯЦИИ
            =================================== */}

        {simulation && (

          <section className="section">

            <div className="section-header">

              <div>

                <h2 className="section-title">
                  Транспортная симуляция
                </h2>


                <div className="muted">
                  Последний рассчитанный
                  сценарий
                </div>

              </div>

            </div>


            <div className="transport-grid">


              {/* НОВЫЕ ТОВАРЫ */}

              <div className="transport-card">

                <span className="card-label">
                  Новые товары
                </span>


                <strong className="transport-value">

                  {formatNumber(
                    simulation
                      .new_products_volume_m3,
                    3
                  )} м³

                </strong>

              </div>


              {/* КОНТЕЙНЕР */}

              <div className="transport-card">

                <span className="card-label">
                  Контейнерный расчёт
                </span>


                <strong className="transport-value">

                  {formatNumber(
                    simulation
                      .container_total_volume_m3,
                    3
                  )} м³

                </strong>


                <div className="muted">

                  Действующие SKU:{" "}

                  {formatNumber(
                    simulation
                      .container_existing_volume_m3,
                    3
                  )} м³

                </div>

              </div>


              {/* ФУРА */}

              <div className="transport-card">

                <span className="card-label">
                  После пересчёта под фуру
                </span>


                <strong className="transport-value">

                  {formatNumber(
                    simulation
                      .truck_total_volume_m3,
                    3
                  )} м³

                </strong>


                <div className="muted">

                  Действующие SKU:{" "}

                  {formatNumber(
                    simulation
                      .truck_existing_volume_m3,
                    3
                  )} м³

                </div>

              </div>


              {/* ВЫБРАННЫЙ ОБЪЁМ */}

              <div className="transport-card">

                <span className="card-label">
                  Выбранный объём
                </span>


                <strong className="transport-value">

                  {formatNumber(
                    simulation
                      .selected_transport_volume_m3,
                    3
                  )} м³

                </strong>

              </div>

            </div>


            <div className="reason-box">

              <strong>

                Решение:{" "}

                {transportName(
                  simulation
                    .transport_scenario
                )}

              </strong>


              <div className="reason-text">

                {
                  simulation
                    .decision_reason
                }

              </div>

            </div>

          </section>

        )}


        {/* ===================================
            ОСНОВНАЯ ТАБЛИЦА ТОВАРОВ
            =================================== */}

        <section className="section">


          <div className="section-header">

            <div>

              <h2 className="section-title">
                Товары
              </h2>


              <div className="muted">
                Итоговые значения уже
                учитывают ручные корректировки
              </div>

            </div>


            <div className="muted">

              SKU: {
                dashboard.items.length
              }

            </div>

          </div>


          <div className="table-wrapper">

            <table className="table">

              <thead>

                <tr>

                  <th className="left">
                    Артикул
                  </th>


                  <th className="left">
                    Товар
                  </th>


                  <th className="right">
                    Продажи/сутки
                  </th>


                  <th className="right">
                    Наш склад
                  </th>


                  <th className="right">
                    Ozon
                  </th>


                  <th className="right">
                    ВЭД
                  </th>


                  <th className="right">
                    Общий остаток
                  </th>


                  <th className="right">
                    Покрытие
                  </th>


                  <th className="right">
                    Контейнер, шт.
                  </th>


                  <th className="right">
                    Контейнер, м³
                  </th>


                  <th className="right">
                    Фура, шт.
                  </th>


                  <th className="right">
                    Фура, м³
                  </th>

                </tr>

              </thead>


              <tbody>

                {dashboard.items.map(
                  (item) => (

                    <tr
                      key={
                        item.calculation_item_id
                      }
                    >


                      {/* АРТИКУЛ */}

                      <td className="left">

                        <strong>
                          {
                            item.offer_id
                          }
                        </strong>

                      </td>


                      {/* НАЗВАНИЕ */}

                      <td className="left">

                        {
                          item.name
                          ?? "—"
                        }

                      </td>


                      {/* ПРОДАЖИ */}

                      <td className="right">

                        {formatNumber(
                          item
                            .avg_sales_per_day,
                          2
                        )}

                      </td>


                      {/* НАШ СКЛАД */}

                      <td className="right">

                        {formatNumber(
                          item
                            .own_stock_quantity
                        )}

                      </td>


                      {/* OZON */}

                      <td className="right">

                        {formatNumber(
                          item
                            .ozon_stock_quantity
                        )}

                      </td>


                      {/* ВЭД */}

                      <td className="right">

                        {formatNumber(
                          item
                            .active_ved_quantity
                        )}

                      </td>


                      {/* ЭФФЕКТИВНЫЙ ОСТАТОК */}

                      <td className="right">

                        {formatNumber(
                          item
                            .effective_stock
                        )}

                      </td>


                      {/* ПОКРЫТИЕ */}

                      <td className="right">

                        <strong>

                          {formatNumber(
                            item
                              .coverage_days,
                            1
                          )}

                        </strong>{" "}
                        дн.

                      </td>


                      {/* КОНТЕЙНЕР ШТ */}

                      <td className="right">

                        <strong>

                          {formatNumber(
                            item
                              .container_effective_final_units
                          )}

                        </strong>


                        {item
                          .container_manual_quantity
                          !== null && (

                          <div className="muted">
                            вручную
                          </div>

                        )}

                      </td>


                      {/* КОНТЕЙНЕР М3 */}

                      <td className="right">

                        {formatNumber(
                          item
                            .container_effective_volume_m3,
                          3
                        )}

                      </td>


                      {/* ФУРА ШТ */}

                      <td className="right">

                        <strong>

                          {formatNumber(
                            item
                              .truck_effective_final_units
                          )}

                        </strong>


                        {item
                          .truck_manual_quantity
                          !== null && (

                          <div className="muted">
                            вручную
                          </div>

                        )}

                      </td>


                      {/* ФУРА М3 */}

                      <td className="right">

                        {formatNumber(
                          item
                            .truck_effective_volume_m3,
                          3
                        )}

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* ===================================
            РУЧНЫЕ КОРРЕКТИРОВКИ
            =================================== */}

        <section className="section">

          <div className="section-header">

            <div>

              <h2 className="section-title">
                Ручные корректировки
              </h2>


              <div className="muted">
                Системный расчёт не
                перезаписывается.
                Каждая корректировка
                сохраняется отдельно.
              </div>

            </div>

          </div>


          <div className="adjustments-list">

            {dashboard.items.map(
              (item) => (

                <div
                  className="adjustment-card"

                  key={
                    item.calculation_item_id
                  }
                >


                  {/* ===========================
                      ТОВАР
                      =========================== */}

                  <div className="adjustment-product">

                    <strong>
                      {item.offer_id}
                    </strong>


                    <span className="muted">

                      {
                        item.name
                        ?? "—"
                      }

                    </span>


                    <span className="muted">

                      Продажи:{" "}

                      {formatNumber(
                        item
                          .avg_sales_per_day,
                        2
                      )} / сутки

                    </span>


                    <span className="muted">

                      Остаток:{" "}

                      {formatNumber(
                        item.effective_stock
                      )} шт.

                    </span>


                    <span className="muted">

                      Покрытие:{" "}

                      {formatNumber(
                        item.coverage_days,
                        1
                      )} дн.

                    </span>

                  </div>


                  {/* ===========================
                      КОНТЕЙНЕР
                      =========================== */}

                  <form
                    action={
                      saveChinaManualAdjustment
                    }

                    className="adjustment-form"
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

                      name="scenario"

                      value="container"
                    />


                    <div>

                      <div className="input-label">
                        Контейнер
                      </div>


                      <div className="muted">

                        Потребность:{" "}

                        {formatNumber(
                          item
                            .container_order_units
                        )} шт.

                      </div>


                      <div className="muted">

                        После коробок:{" "}

                        {formatNumber(
                          item
                            .container_final_units
                        )} шт.

                      </div>


                      <div className="muted">

                        Объём системы:{" "}

                        {formatNumber(
                          item
                            .container_order_volume_m3,
                          3
                        )} м³

                      </div>

                    </div>


                    {/* РУЧНОЕ КОЛИЧЕСТВО */}

                    <div className="input-group">

                      <label
                        className="input-label"
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


                    {/* КОММЕНТАРИЙ */}

                    <div className="input-group">

                      <label
                        className="input-label"
                      >
                        Комментарий
                      </label>


                      <input
                        className=
                          "comment-input"

                        type="text"

                        name="comment"

                        placeholder=
                          "Причина изменения"

                        defaultValue={
                          item
                            .container_manual_comment
                          ?? ""
                        }
                      />

                    </div>


                    <button
                      className=
                        "secondary-button"

                      type="submit"
                    >
                      Сохранить
                    </button>

                  </form>


                  {/* ТЕКУЩАЯ КОРРЕКТИРОВКА
                      КОНТЕЙНЕРА */}

                  {item
                    .container_manual_quantity
                    !== null && (

                    <div className="reason-text">

                      Текущая ручная
                      корректировка контейнера:{" "}

                      <strong>

                        {formatNumber(
                          item
                            .container_manual_quantity
                        )} шт.

                      </strong>

                      {" → "}

                      {formatNumber(
                        item
                          .container_manual_final_units
                      )} шт. после коробок

                      {" / "}

                      {formatNumber(
                        item
                          .container_manual_volume_m3,
                        3
                      )} м³

                    </div>

                  )}


                  {/* ===========================
                      ФУРА
                      =========================== */}

                  <form
                    action={
                      saveChinaManualAdjustment
                    }

                    className="adjustment-form"
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

                      name="scenario"

                      value="truck"
                    />


                    <div>

                      <div className="input-label">
                        Фура
                      </div>


                      <div className="muted">

                        Потребность:{" "}

                        {formatNumber(
                          item
                            .truck_order_units
                        )} шт.

                      </div>


                      <div className="muted">

                        После коробок:{" "}

                        {formatNumber(
                          item
                            .truck_final_units
                        )} шт.

                      </div>


                      <div className="muted">

                        Объём системы:{" "}

                        {formatNumber(
                          item
                            .truck_order_volume_m3,
                          3
                        )} м³

                      </div>

                    </div>


                    {/* РУЧНОЕ КОЛИЧЕСТВО */}

                    <div className="input-group">

                      <label
                        className="input-label"
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


                    {/* КОММЕНТАРИЙ */}

                    <div className="input-group">

                      <label
                        className="input-label"
                      >
                        Комментарий
                      </label>


                      <input
                        className=
                          "comment-input"

                        type="text"

                        name="comment"

                        placeholder=
                          "Причина изменения"

                        defaultValue={
                          item
                            .truck_manual_comment
                          ?? ""
                        }
                      />

                    </div>


                    <button
                      className=
                        "secondary-button"

                      type="submit"
                    >
                      Сохранить
                    </button>

                  </form>


                  {/* ТЕКУЩАЯ КОРРЕКТИРОВКА
                      ФУРЫ */}

                  {item
                    .truck_manual_quantity
                    !== null && (

                    <div className="reason-text">

                      Текущая ручная
                      корректировка фуры:{" "}

                      <strong>

                        {formatNumber(
                          item
                            .truck_manual_quantity
                        )} шт.

                      </strong>

                      {" → "}

                      {formatNumber(
                        item
                          .truck_manual_final_units
                      )} шт. после коробок

                      {" / "}

                      {formatNumber(
                        item
                          .truck_manual_volume_m3,
                        3
                      )} м³

                    </div>

                  )}

                </div>

              )
            )}

          </div>

        </section>


        {/* ===================================
            FOOTER
            =================================== */}

        <footer className="footer">

          Последний расчёт:{" "}

          {run?.calculated_at

            ? new Date(
                run.calculated_at
              ).toLocaleString(
                "ru-RU"
              )

            : "—"}

        </footer>

      </div>

    </main>
  );
}
