type ChinaItem = {
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

  truck_order_units: number;
  truck_cartons: number;
  truck_final_units: number;
  truck_order_volume_m3: number;
};

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


async function getChinaDashboard(): Promise<ChinaDashboard> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

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

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/get_china_dashboard`,
    {
      method: "POST",

      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({}),

      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ошибка Supabase: ${response.status} ${errorText}`
    );
  }

  return response.json();
}


function transportName(scenario?: string) {
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


function formatNumber(
  value: number | null | undefined,
  digits = 0
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}


export default async function Home() {
  let dashboard: ChinaDashboard;

  try {
    dashboard = await getChinaDashboard();
  } catch (error) {
    return (
      <main style={styles.page}>
        <div style={styles.error}>
          <h1>Ошибка загрузки данных</h1>

          <p>
            {error instanceof Error
              ? error.message
              : "Неизвестная ошибка"}
          </p>
        </div>
      </main>
    );
  }

  const simulation = dashboard.simulation;
  const run = dashboard.run;

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        <header style={styles.header}>
          <div>
            <div style={styles.smallLabel}>
              СИСТЕМА ЗАКУПА
            </div>

            <h1 style={styles.title}>
              Китай — расчёт потребности
            </h1>

            <p style={styles.subtitle}>
              Тестовый режим. Реальные заказы не создаются.
            </p>
          </div>

          <div style={styles.versionBox}>
            <div style={styles.smallLabel}>
              Версия расчёта
            </div>

            <strong>
              {run?.calculation_version ?? "—"}
            </strong>
          </div>
        </header>


        <section style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Продажи
            </div>

            <div style={styles.bigNumber}>
              {run?.sales_window_days ?? 28} дней
            </div>

            <div style={styles.muted}>
              Период среднего значения
            </div>
          </div>


          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Контейнер
            </div>

            <div style={styles.bigNumber}>
              {run?.container_order_point_days ?? 100} дней
            </div>

            <div style={styles.muted}>
              90 дней плечо + 10 дней буфер
            </div>
          </div>


          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Фура
            </div>

            <div style={styles.bigNumber}>
              {run?.truck_order_point_days ?? 70} дней
            </div>

            <div style={styles.muted}>
              60 дней плечо + 10 дней буфер
            </div>
          </div>


          <div style={styles.card}>
            <div style={styles.cardLabel}>
              Транспорт
            </div>

            <div style={styles.bigNumber}>
              {transportName(
                simulation?.transport_scenario
              )}
            </div>

            <div style={styles.muted}>
              Текущий результат симуляции
            </div>
          </div>
        </section>


        {simulation && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Транспортная симуляция
            </h2>

            <div style={styles.transportGrid}>
              <div style={styles.transportCard}>
                <span style={styles.cardLabel}>
                  Новые товары
                </span>

                <strong style={styles.transportValue}>
                  {formatNumber(
                    simulation.new_products_volume_m3,
                    3
                  )}{" "}
                  м³
                </strong>
              </div>


              <div style={styles.transportCard}>
                <span style={styles.cardLabel}>
                  Контейнерный расчёт
                </span>

                <strong style={styles.transportValue}>
                  {formatNumber(
                    simulation.container_total_volume_m3,
                    3
                  )}{" "}
                  м³
                </strong>
              </div>


              <div style={styles.transportCard}>
                <span style={styles.cardLabel}>
                  После пересчёта под фуру
                </span>

                <strong style={styles.transportValue}>
                  {formatNumber(
                    simulation.truck_total_volume_m3,
                    3
                  )}{" "}
                  м³
                </strong>
              </div>


              <div style={styles.transportCard}>
                <span style={styles.cardLabel}>
                  Выбранный объём
                </span>

                <strong style={styles.transportValue}>
                  {formatNumber(
                    simulation.selected_transport_volume_m3,
                    3
                  )}{" "}
                  м³
                </strong>
              </div>
            </div>


            <div style={styles.reasonBox}>
              <strong>
                Решение:{" "}
                {transportName(
                  simulation.transport_scenario
                )}
              </strong>

              <div style={styles.reasonText}>
                {simulation.decision_reason}
              </div>
            </div>
          </section>
        )}


        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              Товары
            </h2>

            <div style={styles.muted}>
              SKU: {dashboard.items.length}
            </div>
          </div>


          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Артикул</th>
                  <th style={styles.th}>Товар</th>

                  <th style={styles.thRight}>
                    Продажи/сутки
                  </th>

                  <th style={styles.thRight}>
                    Наш склад
                  </th>

                  <th style={styles.thRight}>
                    Ozon
                  </th>

                  <th style={styles.thRight}>
                    ВЭД
                  </th>

                  <th style={styles.thRight}>
                    Покрытие
                  </th>

                  <th style={styles.thRight}>
                    Контейнер, шт.
                  </th>

                  <th style={styles.thRight}>
                    Контейнер, м³
                  </th>

                  <th style={styles.thRight}>
                    Фура, шт.
                  </th>

                  <th style={styles.thRight}>
                    Фура, м³
                  </th>
                </tr>
              </thead>

              <tbody>
                {dashboard.items.map((item) => (
                  <tr key={item.offer_id}>
                    <td style={styles.td}>
                      <strong>
                        {item.offer_id}
                      </strong>
                    </td>

                    <td style={styles.td}>
                      {item.name ?? "—"}
                    </td>

                    <td style={styles.tdRight}>
                      {formatNumber(
                        item.avg_sales_per_day,
                        2
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      {formatNumber(
                        item.own_stock_quantity
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      {formatNumber(
                        item.ozon_stock_quantity
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      {formatNumber(
                        item.active_ved_quantity
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      <strong>
                        {formatNumber(
                          item.coverage_days,
                          1
                        )}
                      </strong>{" "}
                      дн.
                    </td>

                    <td style={styles.tdRight}>
                      {formatNumber(
                        item.container_final_units
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      {formatNumber(
                        item.container_order_volume_m3,
                        3
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      {formatNumber(
                        item.truck_final_units
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      {formatNumber(
                        item.truck_order_volume_m3,
                        3
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>


        <footer style={styles.footer}>
          Последний расчёт:{" "}
          {run?.calculated_at
            ? new Date(
                run.calculated_at
              ).toLocaleString("ru-RU")
            : "—"}
        </footer>

      </div>
    </main>
  );
}


const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f5f6f8",
    color: "#171717",
    padding: "40px 24px",
    fontFamily:
      "Arial, Helvetica, sans-serif",
  },

  container: {
    maxWidth: "1500px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "24px",
    alignItems: "flex-start",
    marginBottom: "30px",
  },

  smallLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#777",
    marginBottom: "6px",
  },

  title: {
    fontSize: "34px",
    margin: 0,
    fontWeight: 700,
  },

  subtitle: {
    marginTop: "8px",
    color: "#666",
  },

  versionBox: {
    background: "#fff",
    border: "1px solid #e4e4e4",
    borderRadius: "12px",
    padding: "14px 18px",
    minWidth: "150px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "28px",
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: "14px",
    padding: "20px",
  },

  cardLabel: {
    fontSize: "12px",
    color: "#777",
    marginBottom: "8px",
  },

  bigNumber: {
    fontSize: "24px",
    fontWeight: 700,
    marginBottom: "5px",
  },

  muted: {
    color: "#777",
    fontSize: "13px",
  },

  section: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: "14px",
    padding: "22px",
    marginBottom: "24px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "18px",
  },

  sectionTitle: {
    margin: "0 0 18px 0",
    fontSize: "20px",
  },

  transportGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },

  transportCard: {
    background: "#f8f8f8",
    borderRadius: "10px",
    padding: "16px",
  },

  transportValue: {
    display: "block",
    fontSize: "21px",
  },

  reasonBox: {
    marginTop: "18px",
    padding: "16px",
    background: "#f4f4f4",
    borderRadius: "10px",
  },

  reasonText: {
    marginTop: "7px",
    color: "#555",
    lineHeight: 1.5,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },

  th: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #ddd",
    color: "#666",
    whiteSpace: "nowrap",
  },

  thRight: {
    textAlign: "right",
    padding: "12px 10px",
    borderBottom: "1px solid #ddd",
    color: "#666",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "13px 10px",
    borderBottom: "1px solid #eee",
    whiteSpace: "nowrap",
  },

  tdRight: {
    padding: "13px 10px",
    borderBottom: "1px solid #eee",
    textAlign: "right",
    whiteSpace: "nowrap",
  },

  footer: {
    color: "#777",
    fontSize: "12px",
    paddingBottom: "30px",
  },

  error: {
    maxWidth: "700px",
    margin: "80px auto",
    padding: "24px",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "12px",
  },
};
