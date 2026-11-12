import WorkspaceDecoration from "./WorkspaceDecoration";
import HomeMarketplaceCards, {
  type HomeMarketplaceMetric,
  type HomePeriodMetrics,
} from "./HomeMarketplaceCards";

import { getOzonSeptemberRows } from "./sku-list/ozonFinancialData";
import { getOzonOctoberRows } from "./sku-list/ozonOctoberFinancialData";
import { getWbSeptemberRows } from "./sku-list/wbFinancialData";
import { getWbOctoberRows } from "./sku-list/wbOctoberFinancialData";
import { getYandexSeptemberRows } from "./sku-list/yandexFinancialData";
import { getYandexOctoberRows } from "./sku-list/yandexOctoberFinancialData";

type FinancialSourceRow = { revenue: number; profit: number; buys: number };

function summarize(rows: FinancialSourceRow[]): HomePeriodMetrics {
  return rows.reduce(
    (total, row) => ({
      revenue: total.revenue + row.revenue,
      operatingProfit: total.operatingProfit + row.profit,
      purchases: total.purchases + row.buys,
    }),
    { revenue: 0, operatingProfit: 0, purchases: 0 },
  );
}

function combined(...groups: HomePeriodMetrics[]): HomePeriodMetrics {
  return groups.reduce(
    (total, row) => ({
      revenue: total.revenue + row.revenue,
      operatingProfit: total.operatingProfit + row.operatingProfit,
      purchases: total.purchases + row.purchases,
    }),
    { revenue: 0, operatingProfit: 0, purchases: 0 },
  );
}

// The same September/October datasets drive the SKU List's "ИТОГО" totals.
// No hardcoded monthly amounts or browser-side financial recalculation.
export default function Home() {
  const september = {
    ozon: summarize(getOzonSeptemberRows()),
    wildberries: summarize(getWbSeptemberRows()),
    yandexMarket: summarize(getYandexSeptemberRows()),
  };
  const october = {
    ozon: summarize(getOzonOctoberRows()),
    wildberries: summarize(getWbOctoberRows()),
    yandexMarket: summarize(getYandexOctoberRows()),
  };

  const metrics: HomeMarketplaceMetric[] = [
    {
      id: "all",
      title: "Все МП",
      periods: {
        "2026-09": combined(...Object.values(september)),
        "2026-10": combined(...Object.values(october)),
      },
    },
    {
      id: "ozon",
      title: "Ozon",
      periods: { "2026-09": september.ozon, "2026-10": october.ozon },
    },
    {
      id: "wildberries",
      title: "Wildberries",
      periods: { "2026-09": september.wildberries, "2026-10": october.wildberries },
    },
    {
      id: "yandex-market",
      title: "Яндекс Маркет",
      periods: { "2026-09": september.yandexMarket, "2026-10": october.yandexMarket },
    },
  ];

  return (
    <section aria-label="Главная страница">
      <div className="home-title-row">
        <div>
          <h1>Главная страница</h1>
          <p>Основные рабочие пространства и быстрый доступ к разделам системы</p>
        </div>
        <WorkspaceDecoration />
      </div>
      <HomeMarketplaceCards metrics={metrics} />
    </section>
  );
}
