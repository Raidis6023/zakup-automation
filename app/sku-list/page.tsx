import Link from "next/link";

import {
  getOzonSeptemberRows,
} from "./ozonFinancialData";

import SkuListTabsClient, {
  type ProductArticleStatus,
  type SkuListFinancialRow,
} from "./SkuListTabsClient";

import "./sku-list.css";


type ProductMappingRow = {
  offer_id: string | null;
  master_code: string | null;
  ozon_product_id: string | number | null;
  name: string | null;
};


type ProductStatusRow = {
  master_code: string;
  status: ProductArticleStatus;
};


function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL
    ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env.SUPABASE_SECRET_KEY;

  if (
    !supabaseUrl
    ||
    !supabaseKey
  ) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseKey,
  };
}


async function supabaseGet<T>(
  path: string
):
Promise<T> {
  const config =
    getSupabaseConfig();

  if (!config) {
    return [] as T;
  }

  const response =
    await fetch(
      config.supabaseUrl
      +
      "/rest/v1/"
      +
      path,
      {
        headers: {
          apikey:
            config.supabaseKey,

          Authorization:
            "Bearer "
            +
            config.supabaseKey,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  if (!response.ok) {
    return [] as T;
  }

  return (
    await response.json()
  ) as T;
}


async function getProductMappings():
Promise<ProductMappingRow[]> {
  return supabaseGet<ProductMappingRow[]>(
    "products"
    +
    "?select=offer_id,master_code,ozon_product_id,name"
    +
    "&offer_id=not.is.null"
    +
    "&master_code=not.is.null"
    +
    "&limit=2000"
  );
}


async function getProductStatuses():
Promise<ProductStatusRow[]> {
  return supabaseGet<ProductStatusRow[]>(
    "product_article_statuses"
    +
    "?select=master_code,status"
    +
    "&limit=2000"
  );
}


function normalizeForMatch(
  value: string
) {
  return value
    .trim()
    .toUpperCase()
    .replaceAll(
      "Ё",
      "Е"
    )
    .replace(
      /[‐‑‒–—−]/g,
      "-"
    );
}


function escapeRegExp(
  value: string
) {
  return value.replace(
    /[.*+?^$()|[\]\\{}]/g,
    "\\$&"
  );
}


function articleContainsOffer(
  article: string,
  offerId: string
) {
  const normalizedArticle =
    normalizeForMatch(
      article
    );

  const normalizedOffer =
    normalizeForMatch(
      offerId
    );

  if (!normalizedOffer) {
    return false;
  }

  if (
    normalizedArticle ===
    normalizedOffer
  ) {
    return true;
  }

  const boundaryPattern =
    new RegExp(
      "(^|[^A-ZА-Я0-9])"
      +
      escapeRegExp(
        normalizedOffer
      )
      +
      "($|[^A-ZА-Я0-9])",
      "u"
    );

  if (
    boundaryPattern.test(
      normalizedArticle
    )
  ) {
    return true;
  }

  return (
    normalizedOffer.length >=
      5
    &&
    normalizedArticle.includes(
      normalizedOffer
    )
  );
}


function capitalizeArticle(
  value: string
) {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return trimmed;
  }

  return (
    trimmed.charAt(
      0
    ).toLocaleUpperCase(
      "ru-RU"
    )
    +
    trimmed.slice(
      1
    )
  );
}


function buildOzonRows(
  mappings: ProductMappingRow[],
  statuses: ProductStatusRow[]
):
SkuListFinancialRow[] {
  const statusByMasterCode =
    new Map(
      statuses.map(
        row => [
          row.master_code,
          row.status,
        ]
      )
    );

  const candidates =
    mappings
      .filter(
        row =>
          row.offer_id
          &&
          row.master_code
      )
      .map(
        row => ({
          offerId:
            row.offer_id as string,

          enot:
            row.master_code as string,

          sku:
            row.ozon_product_id ===
              null

              ? null

              : String(
                  row.ozon_product_id
                ),

          productName:
            row.name,
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          right.offerId.length
          -
          left.offerId.length
      );

  return getOzonSeptemberRows()
    .map(
      row => {
        const mapping =
          candidates.find(
            candidate =>
              articleContainsOffer(
                row.article,
                candidate.offerId
              )
          );

        const enot =
          mapping?.enot
          ??
          null;

        return {
          enot,

          status:
            enot

              ? (
                  statusByMasterCode.get(
                    enot
                  )
                  ??
                  "Активный"
                )

              : "Активный",

          sku:
            mapping?.sku
            ??
            null,

          sellerArticle:
            capitalizeArticle(
              row.article
            ),

          productName:
            mapping?.productName
            ??
            null,

          revenue:
            row.revenue,

          operatingProfit:
            row.profit,

          purchases:
            row.buys,
        };
      }
    );
}


// ============================================================
// СТРАНИЦА
// ============================================================

export default async function SkuListPage() {
  const [
    mappings,
    statuses,
  ] =
    await Promise.all([
      getProductMappings(),
      getProductStatuses(),
    ]);

  const ozonRows =
    buildOzonRows(
      mappings,
      statuses
    );

  return (
    <main
      className=
        "page sku-list-page"
    >
      <div
        className=
          "container sku-list-container"
      >
        <header
          className=
            "header sku-list-header"
        >
          <div>
            <div
              className=
                "sku-list-eyebrow"
            >
              КАТАЛОГ / ОБЩИЙ СПИСОК
            </div>

            <h1>
              Список артикулов
            </h1>

            <p>
              Финансовые показатели по артикулам
              маркетплейсов с привязкой к ЕНОТ.
            </p>
          </div>

          <div
            className=
              "header-actions sku-list-header-actions"
          >
            <Link
              href="/"
              className=
                "secondary-button workspace-home-button sku-list-home-button"
            >
              Главная
            </Link>
          </div>
        </header>

        <SkuListTabsClient
          ozonRows={
            ozonRows
          }
        />
      </div>
    </main>
  );
}
