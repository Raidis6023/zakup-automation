import PageHeader from "../ui/PageHeader";
import VedNewProductsClient from "./VedNewProductsClient";

import {
  getOzonSeptemberRows,
} from "./ozonFinancialData";

import {
  getWbSeptemberRows,
} from "./wbFinancialData";

import {
  getYandexSeptemberRows,
  type YandexFinancialRow,
} from "./yandexFinancialData";

import {
  getYandexOctoberRows,
} from "./yandexOctoberFinancialData";

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


type MarketplaceListingRow = {
  external_id: string;
  seller_article: string | null;
  master_code: string;
};


type YandexProductRow = {
  offer_id: string;
  market_sku: string | null;
  master_code: string | null;
  product_name: string | null;
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


async function getWbMappings():
Promise<MarketplaceListingRow[]> {
  return supabaseGet<MarketplaceListingRow[]>(
    "marketplace_listings"
    +
    "?select=external_id,seller_article,master_code"
    +
    "&marketplace=eq.wildberries"
    +
    "&account_key=eq.main"
    +
    "&is_active=eq.true"
    +
    "&limit=2000"
  );
}


async function getYandexMappings():
Promise<MarketplaceListingRow[]> {
  return supabaseGet<MarketplaceListingRow[]>(
    "marketplace_listings"
    +
    "?select=external_id,seller_article,master_code"
    +
    "&marketplace=eq.yandex_market"
    +
    "&account_key=eq.main"
    +
    "&is_active=eq.true"
    +
    "&limit=2000"
  );
}


async function getYandexProducts():
Promise<YandexProductRow[]> {
  const select =
    encodeURIComponent(
      "offer_id,market_sku,master_code,product_name:raw_data->offer->>name"
    );

  return supabaseGet<YandexProductRow[]>(
    "yandex_products"
    +
    "?select="
    +
    select
    +
    "&is_active=eq.true"
    +
    "&market_sku=not.is.null"
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
    )
    .replace(
      /\s+/g,
      " "
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




function buildWbRows(
  mappings: MarketplaceListingRow[],
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

  const mappingBySellerArticle =
    new Map<
      string,
      MarketplaceListingRow
    >();

  for (
    const mapping
    of mappings
  ) {
    if (
      !mapping.seller_article
      ||
      !mapping.master_code
    ) {
      continue;
    }

    mappingBySellerArticle.set(
      normalizeForMatch(
        mapping.seller_article
      ),
      mapping
    );
  }

  return getWbSeptemberRows()
    .map(
      row => {
        const mapping =
          mappingBySellerArticle.get(
            normalizeForMatch(
              row.article
            )
          );

        const enot =
          mapping?.master_code
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
            mapping?.external_id
            ??
            null,

          sellerArticle:
            capitalizeArticle(
              row.article
            ),

          productName:
            row.name,

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


const YANDEX_ARTICLE_ALIASES =
  new Map<string, string>([
    [
      normalizeForMatch(
        "Сучкорез малый"
      ),
      normalizeForMatch(
        "Suchkorez"
      ),
    ],
    [
      normalizeForMatch(
        "Крючи настенные самоклеящиеся"
      ),
      normalizeForMatch(
        "Крючки настенные самоклеящиеся"
      ),
    ],
  ]);


function buildYandexRows(
  financialRows: YandexFinancialRow[],
  listings: MarketplaceListingRow[],
  yandexProducts: YandexProductRow[],
  products: ProductMappingRow[],
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

  const productNameByMasterCode =
    new Map<string, string>();

  for (
    const product
    of products
  ) {
    if (
      product.master_code
      &&
      product.name
      &&
      !productNameByMasterCode.has(
        product.master_code
      )
    ) {
      productNameByMasterCode.set(
        product.master_code,
        product.name
      );
    }
  }

  const yandexProductByOffer =
    new Map<
      string,
      YandexProductRow
    >();

  for (
    const product
    of yandexProducts
  ) {
    if (
      product.offer_id
    ) {
      yandexProductByOffer.set(
        normalizeForMatch(
          product.offer_id
        ),
        product
      );
    }
  }

  const candidates =
    listings
      .filter(
        row =>
          row.seller_article
          &&
          row.master_code
      )
      .map(
        row => {
          const sellerArticle =
            row.seller_article as string;

          const yandexProduct =
            yandexProductByOffer.get(
              normalizeForMatch(
                sellerArticle
              )
            );

          return {
            sellerArticle,
            normalizedSellerArticle:
              normalizeForMatch(
                sellerArticle
              ),
            enot:
              row.master_code,
            sku:
              yandexProduct
                ?.market_sku
              ??
              null,
            productName:
              yandexProduct
                ?.product_name
              ??
              productNameByMasterCode.get(
                row.master_code
              )
              ??
              sellerArticle,
          };
        }
      )
      .sort(
        (
          left,
          right
        ) =>
          right.sellerArticle.length
          -
          left.sellerArticle.length
      );

  const exactByArticle =
    new Map(
      candidates.map(
        candidate => [
          candidate
            .normalizedSellerArticle,
          candidate,
        ]
      )
    );

  return financialRows
    .map(
      row => {
        const normalizedArticle =
          normalizeForMatch(
            row.article
          );

        const aliasedArticle =
          YANDEX_ARTICLE_ALIASES.get(
            normalizedArticle
          );

        const mapping =
          exactByArticle.get(
            aliasedArticle
            ??
            normalizedArticle
          )
          ??
          candidates.find(
            candidate =>
              articleContainsOffer(
                row.article,
                candidate.sellerArticle
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
            (row.name?.trim() || mapping?.productName)
            ?? null,

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
    wbMappings,
    yandexMappings,
    yandexProducts,
    statuses,
  ] =
    await Promise.all([
      getProductMappings(),
      getWbMappings(),
      getYandexMappings(),
      getYandexProducts(),
      getProductStatuses(),
    ]);

  const ozonRows =
    buildOzonRows(
      mappings,
      statuses
    );

  const wildberriesRows =
    buildWbRows(
      wbMappings,
      statuses
    );


  const yandexRows =
    buildYandexRows(
      getYandexSeptemberRows(),
      yandexMappings,
      yandexProducts,
      mappings,
      statuses
    );

  const yandexOctoberRows =
    buildYandexRows(
      getYandexOctoberRows(),
      yandexMappings,
      yandexProducts,
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
        <PageHeader
            variant="sku-list"
            title="Список артикулов"
            description="Финансовые показатели по артикулам маркетплейсов с привязкой к ЕНОТ."
          />

        <SkuListTabsClient
          ozonRows={
            ozonRows
          }
          wildberriesRows={
            wildberriesRows
          }
          yandexRows={
            yandexRows
          }
          yandexOctoberRows={
            yandexOctoberRows
          }
        />
        <VedNewProductsClient />
      </div>
    </main>
  );
}
