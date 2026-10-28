import PageHeader from "../ui/PageHeader";
// Admin layout already verifies a logged-in administrator.
export const dynamic = "force-dynamic";

const sections = [
  { code: "finance", title: "Финансовые отчёты", caption: "Ozon, Wildberries, Яндекс Маркет" },
  { code: "sales", title: "Продажи по дням", caption: "Продажи по товарам и периодам" },
  { code: "products", title: "ЕНОТ / номенклатура", caption: "Артикулы, наименования, привязка к ЕНОТ" },
  { code: "stocks", title: "Остатки", caption: "Аведэкс и ОХ ИП Бабушкиной отдельно" },
];

export default function AdminPage() {
  const configured = /^[a-f0-9]{64}$/i.test(process.env.ONE_C_API_KEY_SHA256 ?? "");

  return (
    <section aria-label="Администрирование">
      <PageHeader variant="home" title="Администрирование" description="Управление сотрудниками, доступами и настройками WorkSpace" />

      <section
        aria-label="Наше API-хуяпи v1"
        style={{
          marginTop: 24,
          padding: 24,
          borderRadius: 16,
          border: "1px solid var(--border, #d9dfe9)",
          background: "var(--card-bg, transparent)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Наше API-хуяпи v1</h2>
            <p style={{ marginTop: 8, opacity: 0.75 }}>
              Единая интеграция с 1С. Один защищённый адрес для всех четырёх разделов.
            </p>
          </div>
          <span
            style={{
              borderRadius: 999, padding: "6px 12px", fontSize: 13,
              color: configured ? "#087c51" : "#b16b08",
              background: configured ? "#e6f6ed" : "#fff4db",
            }}
          >
            {configured ? "Ключ настроен" : "Ключ не настроен"}
          </span>
        </div>
        <p style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Единая точка доступа</p>
        <code style={{
          display: "block", padding: "12px 16px", borderRadius: 10, overflowX: "auto",
          background: "rgba(127,127,127,0.08)", userSelect: "all",
        }}>
          GET /api/v1/1c/export?dataset=products
        </code>
        <p style={{ marginTop: 10, fontSize: 13, opacity: 0.72 }}>
          Программисты 1С передают dataset, дополнительные параметры, секретный Bearer-ключ и заголовок x-vercel-protection-bypass.
          Никакого доступа к внутренним таблицам Supabase.
        </p>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12, marginTop: 18,
        }}>
          {sections.map(({ code, title, caption }) => (
            <div
              key={code}
              style={{ border: "1px solid var(--border, #d9dfe9)", borderRadius: 12, padding: 14 }}
            >
              <strong>{title}</strong>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 5 }}>{caption}</div>
              <code style={{ fontSize: 12, display: "inline-block", marginTop: 10 }}>dataset={code}</code>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 18, fontSize: 13, opacity: 0.75 }}>
          Документация для 1С: <code>docs/1c-export-v1.md</code> в репозитории.
          До настройки ключа запросы безопасно блокируются.
        </p>
      </section>
    </section>
  );
}
