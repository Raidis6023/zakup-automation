import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


// ============================================================
// TYPES
// ============================================================

type YandexStock = {
  type?: string;
  count?: number;
};


type YandexTurnover = {
  turnover?: string;
  turnoverDays?: number;
};


type YandexOfferStock = {
  offerId?: string;

  turnoverSummary?:
    YandexTurnover;

  stocks?:
    YandexStock[];

  updatedAt?: string;
};


type YandexWarehouse = {
  warehouseId?: number;

  offers?:
    YandexOfferStock[];
};


type YandexStocksResponse = {
  status?: string;

  result?: {
    paging?: {
      nextPageToken?: string;
    };

    warehouses?:
      YandexWarehouse[];
  };

  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};


type NormalizedRow = {
  warehouse_id:
    number | null;

  offer_id:
    string;

  fit:
    number;

  available:
    number;

  freeze:
    number;

  quarantine:
    number;

  defect:
    number;

  expired:
    number;

  utilization:
    number;

  turnover:
    string | null;

  turnover_days:
    number | null;

  updated_at:
    string | null;
};


// ============================================================
// CONFIG
// ============================================================

function getConfig() {
  const apiKey =
    process.env
      .YANDEX_API_KEY
      ?.trim();


  const campaignId =
    process.env
      .YANDEX_CAMPAIGN_ID
      ?.trim();


  if (!apiKey) {
    throw new Error(
      "Не найдена переменная YANDEX_API_KEY"
    );
  }


  if (!campaignId) {
    throw new Error(
      "Не найдена переменная YANDEX_CAMPAIGN_ID"
    );
  }


  if (
    !/^\d+$/.test(
      campaignId
    )
  ) {
    throw new Error(
      "YANDEX_CAMPAIGN_ID должен быть числом"
    );
  }


  return {
    apiKey,
    campaignId,
  };
}


// ============================================================
// STOCK COUNT
// ============================================================

function getStockCount(
  stocks:
    YandexStock[]
    | undefined,

  type:
    string
): number {
  if (!stocks) {
    return 0;
  }


  const row =
    stocks.find(
      item =>
        item.type === type
    );


  return Number(
    row?.count
    ??
    0
  );
}


// ============================================================
// GET
//
// READ ONLY.
// НИЧЕГО В SUPABASE НЕ ПИШЕМ.
// ============================================================

export async function GET() {
  try {
    const {
      apiKey,
      campaignId,
    } =
      getConfig();


    const rows:
      NormalizedRow[] =
      [];


    let pageToken:
      string | null =
      null;


    let pages =
      0;


    const MAX_PAGES =
      100;


    // ========================================================
    // PAGINATION
    // ========================================================

    while (
      pages <
      MAX_PAGES
    ) {
      pages +=
        1;


      const url =
        new URL(
          `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/offers/stocks`
        );


      url.searchParams.set(
        "limit",
        "100"
      );


      if (pageToken) {
        url.searchParams.set(
          "pageToken",
          pageToken
        );
      }


      const response =
        await fetch(
          url.toString(),
          {
            method:
              "POST",

            headers: {
              "Api-Key":
                apiKey,

              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  withTurnover:
                    true,
                }
              ),

            cache:
              "no-store",
          }
        );


      const responseText =
        await response.text();


      let data:
        YandexStocksResponse;


      try {
        data =
          JSON.parse(
            responseText
          ) as YandexStocksResponse;

      } catch {
        return NextResponse.json(
          {
            ok:
              false,

            writes_to_database:
              false,

            page:
              pages,

            yandex_status:
              response.status,

            error:
              "Яндекс вернул ответ, который не удалось разобрать как JSON",

            raw:
              responseText,
          },
          {
            status:
              502,
          }
        );
      }


      if (!response.ok) {
        return NextResponse.json(
          {
            ok:
              false,

            writes_to_database:
              false,

            page:
              pages,

            yandex_status:
              response.status,

            yandex_response:
              data,
          },
          {
            status:
              response.status,
          }
        );
      }


      // ======================================================
      // NORMALIZE
      // ======================================================

      const warehouses =
        data.result
          ?.warehouses
        ??
        [];


      for (
        const warehouse
        of warehouses
      ) {
        for (
          const offer
          of warehouse.offers
          ??
          []
        ) {
          const offerId =
            String(
              offer.offerId
              ??
              ""
            )
              .trim();


          if (!offerId) {
            continue;
          }


          rows.push(
            {
              warehouse_id:
                warehouse.warehouseId
                ??
                null,

              offer_id:
                offerId,

              fit:
                getStockCount(
                  offer.stocks,
                  "FIT"
                ),

              available:
                getStockCount(
                  offer.stocks,
                  "AVAILABLE"
                ),

              freeze:
                getStockCount(
                  offer.stocks,
                  "FREEZE"
                ),

              quarantine:
                getStockCount(
                  offer.stocks,
                  "QUARANTINE"
                ),

              defect:
                getStockCount(
                  offer.stocks,
                  "DEFECT"
                ),

              expired:
                getStockCount(
                  offer.stocks,
                  "EXPIRED"
                ),

              utilization:
                getStockCount(
                  offer.stocks,
                  "UTILIZATION"
                ),

              turnover:
                offer
                  .turnoverSummary
                  ?.turnover
                ??
                null,

              turnover_days:
                typeof offer
                  .turnoverSummary
                  ?.turnoverDays ===
                  "number"

                  ? offer
                      .turnoverSummary
                      .turnoverDays

                  : null,

              updated_at:
                offer.updatedAt
                ??
                null,
            }
          );
        }
      }


      // ======================================================
      // NEXT PAGE
      // ======================================================

      const nextPageToken =
        data.result
          ?.paging
          ?.nextPageToken
          ?.trim()
        ??
        "";


      if (!nextPageToken) {
        break;
      }


      if (
        nextPageToken ===
        pageToken
      ) {
        throw new Error(
          "Яндекс вернул тот же nextPageToken повторно"
        );
      }


      pageToken =
        nextPageToken;
    }


    if (
      pages >=
        MAX_PAGES
      &&
      pageToken
    ) {
      throw new Error(
        "Достигнут защитный лимит страниц Яндекс Маркета"
      );
    }


    // ========================================================
    // SUMMARY
    // ========================================================

    const warehouseIds =
      Array.from(
        new Set(
          rows
            .map(
              row =>
                row.warehouse_id
            )
            .filter(
              (
                value
              ): value is number =>
                value !== null
            )
        )
      )
        .sort(
          (
            a,
            b
          ) =>
            a - b
        );


    const uniqueOffers =
      new Set(
        rows.map(
          row =>
            row.offer_id
        )
      );


    const totals =
      rows.reduce(
        (
          acc,
          row
        ) => {
          acc.fit +=
            row.fit;

          acc.available +=
            row.available;

          acc.freeze +=
            row.freeze;

          acc.quarantine +=
            row.quarantine;

          acc.defect +=
            row.defect;

          acc.expired +=
            row.expired;

          acc.utilization +=
            row.utilization;

          return acc;
        },
        {
          fit:
            0,

          available:
            0,

          freeze:
            0,

          quarantine:
            0,

          defect:
            0,

          expired:
            0,

          utilization:
            0,
        }
      );


    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "read_only_yandex_fby_stocks",

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        campaign_id:
          campaignId,

        pages,

        rows:
          rows.length,

        unique_offers:
          uniqueOffers.size,

        warehouses:
          warehouseIds,

        warehouse_count:
          warehouseIds.length,

        totals,

        data:
          rows,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX STOCKS ERROR:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        mode:
          "read_only_yandex_fby_stocks",

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status:
          500,
      }
    );
  }
}
