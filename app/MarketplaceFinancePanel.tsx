import WorkspaceCollapsiblePanel from "./WorkspaceCollapsiblePanel";
import styles from "./MarketplaceFinancePanel.module.css";

type Marketplace = "ozon" | "wildberries" | "yandex";

const config = {
  ozon: {
    tone: "ozon",
    title: "Финансовая аналитика Ozon",
    href: "/ozon/financier",
    message: "Подробная аналитика доступна в разделе ИИ-финансиста Ozon.",
  },
  wildberries: {
    tone: "wildberries",
    title: "Финансовая аналитика Wildberries",
    href: "/wildberries/financier",
    message: "Пока без себестоимости и итоговой прибыли.",
  },
  yandex: {
    tone: "yandex",
    title: "Финансовая аналитика Яндекс Маркет",
    href: "/yandex-market/financier",
    message: "Подробная аналитика доступна в разделе ИИ-финансиста Яндекс Маркета.",
  },
} as const;

export default function MarketplaceFinancePanel({ marketplace }: { marketplace: Marketplace }) {
  const item = config[marketplace];
  return (
    <WorkspaceCollapsiblePanel
      tone={item.tone}
      icon="finance"
      title={item.title}
      subtitle="Детализация реализации и рекламной статистики по артикулам."
      actionHref={item.href}
      actionLabel="Открыть ИИ-финансиста"
    >
      <div className={styles.body}>{item.message}</div>
    </WorkspaceCollapsiblePanel>
  );
}
