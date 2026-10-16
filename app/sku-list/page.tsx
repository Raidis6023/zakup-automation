import Link
  from "next/link";

import {
  getOzonSeptemberRows,
} from "./ozonFinancialData";

import SkuListTabsClient, {
  type SkuListFinancialRow,
} from "./SkuListTabsClient";

import "./sku-list.css";


type ProductMappingRow = {
  offer_id: string | null;
  master_code: string | null;
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


async function getProductMappings():
Promise<ProductMappingRow[]> {

  const config =
    getSupabaseConfig();


  if (
    !config
  ) {

    return [];

  }


  const response =
    await fetch(
      config.supabaseUrl
      +
      "/rest/v1/products?select=offer_id,master_code&offer_id=not.is.null&master_code=not.is.null&limit=2000",
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


  if (
    !response.ok
  ) {

    return [];

  }


  return (
    await response.json()
  ) as
    ProductMappingRow[];

}


function normalizeForMatch(
  value:
    string
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
  value:
    string
) {

  return value.replace(
    /[.*+?^$()|[\]\\{}]/g,
    "\\$&"
  );

}


function articleContainsOffer(
  article:
    string,
  offerId:
    string
) {

  const normalizedArticle =
    normalizeForMatch(
      article
    );


  const normalizedOffer =
    normalizeForMatch(
      offerId
    );


  if (
    !normalizedOffer
  ) {

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


  /*
   * В отчёте Ozon встречаются строки вроде
   * "0,5 лAVD-TH5", где код приклеен к описанию
   * без пробела. Для достаточно длинных кодов
   * разрешаем точное вхождение.
   */
  return (
    normalizedOffer.length >=
      5
    &&
    normalizedArticle.includes(
      normalizedOffer
    )
  );

}


function buildOzonRows(
  mappings:
    ProductMappingRow[]
):
SkuListFinancialRow[] {

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


        return {
          enot:
            mapping?.enot
            ??
            null,

          article:
            row.article,

          operatingProfit:
            row.profit,

          revenue:
            row.revenue,

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

  const mappings =
    await getProductMappings();


  const ozonRows =
    buildOzonRows(
      mappings
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
