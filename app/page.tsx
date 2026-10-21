import WorkspaceDecoration from "./WorkspaceDecoration";
import HomePandaAssistant from "./HomePandaAssistant";
import styles from "./HomeDashboard.module.css";
import HomeMarketplaceCards, {
  type HomeMarketplaceMetric,
} from "./HomeMarketplaceCards";


import {
  getOzonSeptemberRows,
} from "./sku-list/ozonFinancialData";

import {
  getWbSeptemberRows,
} from "./sku-list/wbFinancialData";

import {
  getYandexSeptemberRows,
} from "./sku-list/yandexFinancialData";


type FinancialSourceRow = {
  revenue: number;
  profit: number;
  buys: number;
};


function summarize(
  rows: FinancialSourceRow[]
) {
  return rows.reduce(
    (
      total,
      row
    ) => ({
      revenue:
        total.revenue
        +
        row.revenue,

      operatingProfit:
        total.operatingProfit
        +
        row.profit,

      purchases:
        total.purchases
        +
        row.buys,
    }),
    {
      revenue:
        0,

      operatingProfit:
        0,

      purchases:
        0,
    }
  );
}


// ============================================================
// ГЛАВНАЯ СТРАНИЦА WORKSPACE
// ============================================================

export default function Home() {
  const ozon =
    summarize(
      getOzonSeptemberRows()
    );

  const wildberries =
    summarize(
      getWbSeptemberRows()
    );

  const yandexMarket =
    summarize(
      getYandexSeptemberRows()
    );

  const allMarketplaces = {
    revenue:
      ozon.revenue
      +
      wildberries.revenue
      +
      yandexMarket.revenue,

    operatingProfit:
      ozon.operatingProfit
      +
      wildberries.operatingProfit
      +
      yandexMarket.operatingProfit,

    purchases:
      ozon.purchases
      +
      wildberries.purchases
      +
      yandexMarket.purchases,
  };

  const metrics:
  HomeMarketplaceMetric[] = [
    {
      id:
        "all",

      title:
        "Все МП",

      ...allMarketplaces,
    },
    {
      id:
        "ozon",

      title:
        "Ozon",

      ...ozon,
    },
    {
      id:
        "wildberries",

      title:
        "Wildberries",

      ...wildberries,
    },
    {
      id:
        "yandex-market",

      title:
        "Яндекс Маркет",

      ...yandexMarket,
    },
  ];

  return (
    <section
      className={styles.dashboard}
      aria-label=
        "Главная страница"
    >
      <div
        className=
          "home-title-row"
      >
        <div>
          <h1>
            Главная страница
          </h1>

          <p>
            Основные рабочие пространства
            и быстрый доступ к разделам системы
          </p>
        </div>

        <WorkspaceDecoration />
      </div>

      <HomeMarketplaceCards
        metrics={
          metrics
        }
      />

      <div className={styles.assistantDock}>
        <HomePandaAssistant />
      </div>
    </section>
  );
}
