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

type YandexReturnItem = {
  marketSku?:
    string
    | number;

  shopSku?: string;

  count?: number;

  decisions?: Array<{
    returnItemId?: number;

    count?: number;

    comment?: string;

    reasonType?: string;

    subreasonType?: string;

    decisionType?: string;

    refundAmount?: number;

    amount?: {
      value?: number;
      currencyId?: string;
    } | null;

    partnerCompensation?: number;

    partnerCompensationAmount?: {
      value?: number;
      currencyId?: string;
    } | null;
  }> | null;

  instances?: Array<{
    stockType?: string;
    status?: string;
    cis?: string;
    imei?: string;
  }> | null;

  tracks?: Array<{
    trackCode?: string;
  }> | null;

  [key: string]:
    unknown;
};


type YandexReturn = {
  id?:
    string
    | number;

  orderId?:
    string
    | number;

  creationDate?: string;

  updateDate?: string;

  refundStatus?: string;

  pickupTillDate?: string;

  shipmentRecipientType?: string;

  shipmentStatus?: string;

  amount?: {
    value?: number;
    currencyId?: string;
  } | null;

  items?: YandexReturnItem[];

  returnType?: string;

  fastReturn?: boolean;

  [key: string]:
    unknown;
};


type YandexReturnsResponse = {
  status?: string;

  result?: {
    returns?: YandexReturn[];

    paging?: {
      nextPageToken?: string;
    };
  };

  errors?: Array<{
    code?: string;
    message?: string;
  }>;
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
      "Не найдена YANDEX_API_KEY"
    );

  }


  if (!campaignId) {

    throw new Error(
      "Не найдена YANDEX_CAMPAIGN_ID"
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
// DATE
// ============================================================

function getKrasnoyarskDate():
string {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Krasnoyarsk",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    )
      .formatToParts(
        new Date()
      );


  const year =
    parts.find(
      part =>
        part.type ===
        "year"
    )?.value;


  const month =
    parts.find(
      part =>
        part.type ===
        "month"
    )?.value;


  const day =
    parts.find(
      part =>
        part.type ===
        "day"
    )?.value;


  if (
    !year
    ||
    !month
    ||
    !day
  ) {

    throw new Error(
      "Не удалось определить дату по Красноярску"
    );

  }


  return `${year}-${month}-${day}`;

}


function shiftDate(
  dateString: string,
  days: number
):
string {

  const [
    year,
    month,
    day,
  ] =
    dateString
      .split("-")
      .map(Number);


  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );


  date.setUTCDate(
    date.getUTCDate()
    +
    days
  );


  return date
    .toISOString()
    .slice(
      0,
      10
    );

}


// ============================================================
// JSON PARSER
//
// Защищаем длинные marketSku от потери точности JS.
// ============================================================

function parseYandexJson(
  text: string
):
YandexReturnsResponse {

  const safeText =
    text.replace(
      /"marketSku"\s*:\s*(\d+)/g,
      '"marketSku":"$1"'
    );


  return JSON.parse(
    safeText
  ) as YandexReturnsResponse;

}


// ============================================================
// FETCH RETURNS
// ============================================================

async function fetchReturns(
  apiKey: string,
  campaignId: string,
  fromDate: string,
  toDate: string
) {

  const rows:
    YandexReturn[] =
    [];


  let pageToken:
    string | null =
    null;


  let pages =
    0;


  const MAX_PAGES =
    100;


  while (
    pages <
    MAX_PAGES
  ) {

    pages +=
      1;


    const url =
      new URL(
        `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/returns`
      );


    // --------------------------------------------------------
    // Используем ТОЛЬКО новые параметры.
    //
    // from_date / to_date устарели.
    // --------------------------------------------------------

    url.searchParams.set(
      "fromDate",
      fromDate
    );


    url.searchParams.set(
      "toDate",
      toDate
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
            "GET",

          headers: {
            "Api-Key":
              apiKey,

            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );


    const responseText =
      await response.text();


    let data:
      YandexReturnsResponse;


    try {

      data =
        parseYandexJson(
          responseText
        );

    } catch {

      throw new Error(
        `Яндекс вернул некорректный JSON на странице ${pages}: ${responseText}`
      );

    }


    if (!response.ok) {

      throw new Error(
        `Yandex returns: HTTP ${response.status}: ${responseText}`
      );

    }


    const pageRows =
      data.result
        ?.returns
      ??
      [];


    rows.push(
      ...pageRows
    );


    const nextPageToken =
      data.result
        ?.paging
        ?.nextPageToken
        ?.trim()
      ??
      "";


    if (!nextPageToken) {

      pageToken =
        null;

      break;

    }


    if (
      nextPageToken ===
      pageToken
    ) {

      throw new Error(
        "Яндекс повторно вернул тот же nextPageToken"
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
      "Достигнут защитный лимит страниц возвратов Яндекс Маркета"
    );

  }


  return {
    pages,
    rows,
  };

}


// ============================================================
// GET
//
// ТОЛЬКО ЧТЕНИЕ.
// НИЧЕГО НЕ ПИШЕМ.
// ============================================================

export async function GET() {

  try {

    const {
      apiKey,
      campaignId,
    } =
      getConfig();


    const toDate =
      getKrasnoyarskDate();


    const fromDate =
      shiftDate(
        toDate,
        -13
      );


    const {
      pages,
      rows,
    } =
      await fetchReturns(
        apiKey,
        campaignId,
        fromDate,
        toDate
      );


    // ========================================================
    // SUMMARY
    // ========================================================

    const returnTypeCounts:
      Record<
        string,
        number
      > =
      {};


    const refundStatusCounts:
      Record<
        string,
        number
      > =
      {};


    const shipmentStatusCounts:
      Record<
        string,
        number
      > =
      {};


    const stockTypeCounts:
      Record<
        string,
        number
      > =
      {};


    const decisionReasonCounts:
      Record<
        string,
        number
      > =
      {};


    const shopSkus =
      new Set<string>();


    const marketSkus =
      new Set<string>();


    const orderIds =
      new Set<string>();


    let itemLines =
      0;


    let itemUnits =
      0;


    let decisionUnits =
      0;


    let amountTotal =
      0;


    for (
      const row
      of rows
    ) {

      const returnType =
        row.returnType
        ??
        "UNKNOWN";


      returnTypeCounts[
        returnType
      ] =
        (
          returnTypeCounts[
            returnType
          ]
          ??
          0
        )
        +
        1;


      const refundStatus =
        row.refundStatus
        ??
        "UNKNOWN";


      refundStatusCounts[
        refundStatus
      ] =
        (
          refundStatusCounts[
            refundStatus
          ]
          ??
          0
        )
        +
        1;


      const shipmentStatus =
        row.shipmentStatus
        ??
        "UNKNOWN";


      shipmentStatusCounts[
        shipmentStatus
      ] =
        (
          shipmentStatusCounts[
            shipmentStatus
          ]
          ??
          0
        )
        +
        1;


      const orderId =
        String(
          row.orderId
          ??
          ""
        )
          .trim();


      if (orderId) {

        orderIds.add(
          orderId
        );

      }


      const amount =
        Number(
          row.amount
            ?.value
          ??
          0
        );


      if (
        Number.isFinite(
          amount
        )
      ) {

        amountTotal +=
          amount;

      }


      for (
        const item
        of row.items
        ??
        []
      ) {

        itemLines +=
          1;


        const count =
          Number(
            item.count
            ??
            0
          );


        if (
          Number.isFinite(
            count
          )
        ) {

          itemUnits +=
            count;

        }


        const shopSku =
          String(
            item.shopSku
            ??
            ""
          )
            .trim();


        if (shopSku) {

          shopSkus.add(
            shopSku
          );

        }


        const marketSku =
          String(
            item.marketSku
            ??
            ""
          )
            .trim();


        if (marketSku) {

          marketSkus.add(
            marketSku
          );

        }


        for (
          const decision
          of item.decisions
          ??
          []
        ) {

          const decisionCount =
            Number(
              decision.count
              ??
              0
            );


          if (
            Number.isFinite(
              decisionCount
            )
          ) {

            decisionUnits +=
              decisionCount;

          }


          const reason =
            decision.reasonType
            ??
            "UNKNOWN";


          decisionReasonCounts[
            reason
          ] =
            (
              decisionReasonCounts[
                reason
              ]
              ??
              0
            )
            +
            1;

        }


        for (
          const instance
          of item.instances
          ??
          []
        ) {

          const stockType =
            instance.stockType
            ??
            "UNKNOWN";


          stockTypeCounts[
            stockType
          ] =
            (
              stockTypeCounts[
                stockType
              ]
              ??
              0
            )
            +
            1;

        }

      }

    }


    const sampleUnredeemed =
      rows.find(
        row =>
          row.returnType ===
          "UNREDEEMED"
      )
      ??
      null;


    const sampleReturn =
      rows.find(
        row =>
          row.returnType ===
          "RETURN"
      )
      ??
      null;


    const sampleWithDecisions =
      rows.find(
        row =>
          (
            row.items
            ??
            []
          )
            .some(
              item =>
                (
                  item.decisions
                    ?.length
                  ??
                  0
                )
                >
                0
            )
      )
      ??
      null;


    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "read_only_yandex_returns",

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        campaign_id:
          campaignId,

        period: {
          date_from:
            fromDate,

          date_to:
            toDate,

          days:
            14,
        },

        pages,

        returns_count:
          rows.length,

        unique_orders:
          orderIds.size,

        return_type_counts:
          returnTypeCounts,

        refund_status_counts:
          refundStatusCounts,

        shipment_status_counts:
          shipmentStatusCounts,

        item_lines:
          itemLines,

        item_units:
          itemUnits,

        decision_units:
          decisionUnits,

        unique_shop_skus:
          shopSkus.size,

        unique_market_skus:
          marketSkus.size,

        amount_total:
          amountTotal,

        stock_type_counts:
          stockTypeCounts,

        decision_reason_counts:
          decisionReasonCounts,

        sample_unredeemed:
          sampleUnredeemed,

        sample_return:
          sampleReturn,

        sample_with_decisions:
          sampleWithDecisions,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX RETURNS GET ERROR:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        mode:
          "read_only_yandex_returns",

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
