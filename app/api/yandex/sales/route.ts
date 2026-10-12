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

type YandexItem = {
  offerName?: string;

  marketSku?:
    string
    | number;

  shopSku?: string;

  count?: number;

  initialCount?: number;

  prices?: Array<{
    type?: string;
    costPerItem?: number;
    total?: number;
  }> | null;

  warehouse?: {
    id?: number;
    name?: string;
  } | null;

  details?: Array<{
    itemStatus?: string;
    itemCount?: number;
    updateDate?: string;
    stockType?: string;
  }> | null;

  [key: string]:
    unknown;
};


type YandexOrder = {
  id?:
    string
    | number;

  creationDate?: string;

  statusUpdateDate?: string;

  status?: string;

  partnerOrderId?: string;

  paymentType?: string;

  fake?: boolean;

  items?: YandexItem[];

  initialItems?:
    YandexItem[]
    | null;

  [key: string]:
    unknown;
};


type YandexOrdersResponse = {
  status?: string;

  result?: {
    orders?: YandexOrder[];

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
      "Не удалось определить текущую дату по Красноярску"
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
// marketSku в Яндексе может быть длинным числом.
// До JSON.parse превращаем его в строку,
// чтобы JavaScript не испортил точность.
// ============================================================

function parseYandexJson(
  text: string
):
YandexOrdersResponse {

  const safeText =
    text.replace(
      /"marketSku"\s*:\s*(\d+)/g,
      '"marketSku":"$1"'
    );


  return JSON.parse(
    safeText
  ) as YandexOrdersResponse;
}


// ============================================================
// FETCH ORDERS
// ============================================================

async function fetchOrders(
  apiKey: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string
) {

  const orders:
    YandexOrder[] =
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
        `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}/stats/orders`
      );


    url.searchParams.set(
      "limit",
      "200"
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
                dateFrom,
                dateTo,
              }
            ),

          cache:
            "no-store",
        }
      );


    const responseText =
      await response.text();


    let data:
      YandexOrdersResponse;


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
        `Yandex stats/orders: HTTP ${response.status}: ${responseText}`
      );

    }


    const pageOrders =
      data.result
        ?.orders
      ??
      [];


    orders.push(
      ...pageOrders
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
      "Достигнут защитный лимит страниц Яндекс Маркета"
    );

  }


  return {
    pages,
    orders,
  };
}


// ============================================================
// GET
//
// READ ONLY.
// НИЧЕГО НЕ ПИШЕТ НИ В ЯНДЕКС, НИ В SUPABASE.
// ============================================================

export async function GET() {

  try {

    const {
      apiKey,
      campaignId,
    } =
      getConfig();


    // --------------------------------------------------------
    // Для первого теста берём 14 календарных дней,
    // включая сегодняшний день.
    // --------------------------------------------------------

    const dateTo =
      getKrasnoyarskDate();


    const dateFrom =
      shiftDate(
        dateTo,
        -13
      );


    const {
      pages,
      orders,
    } =
      await fetchOrders(
        apiKey,
        campaignId,
        dateFrom,
        dateTo
      );


    // ========================================================
    // STATUS COUNTS
    // ========================================================

    const statusCounts:
      Record<
        string,
        number
      > =
      {};


    let fakeOrders =
      0;


    let currentItemLines =
      0;


    let currentProductLines =
      0;


    let deliveryLines =
      0;


    let initialItemLines =
      0;


    let currentUnits =
      0;


    let initialUnits =
      0;


    const shopSkus =
      new Set<string>();


    const marketSkus =
      new Set<string>();


    const warehouses =
      new Map<
        number,
        string
      >();


    const detailStatusCounts:
      Record<
        string,
        number
      > =
      {};


    for (
      const order
      of orders
    ) {

      const status =
        order.status
        ??
        "UNKNOWN";


      statusCounts[
        status
      ] =
        (
          statusCounts[
            status
          ]
          ??
          0
        )
        +
        1;


      if (
        order.fake ===
        true
      ) {

        fakeOrders +=
          1;

      }


      // ======================================================
      // CURRENT ITEMS
      // ======================================================

      for (
        const item
        of order.items
        ??
        []
      ) {

        currentItemLines +=
          1;


        const isDelivery =
          item.offerName ===
          "Доставка";


        if (isDelivery) {

          deliveryLines +=
            1;

        } else {

          currentProductLines +=
            1;


          currentUnits +=
            Number(
              item.count
              ??
              0
            );

        }


        const shopSku =
          String(
            item.shopSku
            ??
            ""
          )
            .trim();


        if (
          shopSku
          &&
          !isDelivery
        ) {

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


        if (
          marketSku
          &&
          !isDelivery
        ) {

          marketSkus.add(
            marketSku
          );

        }


        const warehouseId =
          Number(
            item.warehouse
              ?.id
          );


        if (
          Number.isInteger(
            warehouseId
          )
          &&
          warehouseId >
            0
        ) {

          warehouses.set(
            warehouseId,
            item.warehouse
              ?.name
            ??
            ""
          );

        }


        for (
          const detail
          of item.details
          ??
          []
        ) {

          const detailStatus =
            detail.itemStatus
            ??
            "UNKNOWN";


          detailStatusCounts[
            detailStatus
          ] =
            (
              detailStatusCounts[
                detailStatus
              ]
              ??
              0
            )
            +
            1;

        }

      }


      // ======================================================
      // INITIAL ITEMS
      //
      // Здесь могут быть товары, которые уже полностью
      // исчезли из order.items.
      // ======================================================

      for (
        const item
        of order.initialItems
        ??
        []
      ) {

        initialItemLines +=
          1;


        initialUnits +=
          Number(
            item.initialCount
            ??
            item.count
            ??
            0
          );


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
          const detail
          of item.details
          ??
          []
        ) {

          const detailStatus =
            detail.itemStatus
            ??
            "UNKNOWN";


          detailStatusCounts[
            detailStatus
          ] =
            (
              detailStatusCounts[
                detailStatus
              ]
              ??
              0
            )
            +
            1;

        }

      }

    }


    // ========================================================
    // Нужны реальные примеры разных ситуаций.
    // ========================================================

    const sampleNormalOrder =
      orders.find(
        order =>
          order.status ===
          "DELIVERED"
      )
      ??
      orders[0]
      ??
      null;


    const sampleProblemOrder =
      orders.find(
        order =>
          order.status ===
            "RETURNED"
          ||
          order.status ===
            "PARTIALLY_RETURNED"
          ||
          order.status ===
            "PARTIALLY_DELIVERED"
          ||
          order.status ===
            "CANCELLED_BEFORE_PROCESSING"
          ||
          order.status ===
            "CANCELLED_IN_PROCESSING"
          ||
          order.status ===
            "CANCELLED_IN_DELIVERY"
      )
      ??
      null;


    const sampleOrderWithInitialItems =
      orders.find(
        order =>
          (
            order.initialItems
              ?.length
            ??
            0
          )
          >
          0
      )
      ??
      null;


    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "read_only_yandex_sales",

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        campaign_id:
          campaignId,

        period: {
          date_from:
            dateFrom,

          date_to:
            dateTo,

          days:
            14,
        },

        pages,

        orders_count:
          orders.length,

        fake_orders:
          fakeOrders,

        real_orders:
          orders.length
          -
          fakeOrders,

        status_counts:
          statusCounts,

        current_item_lines:
          currentItemLines,

        current_product_lines:
          currentProductLines,

        delivery_lines:
          deliveryLines,

        initial_item_lines:
          initialItemLines,

        current_product_units:
          currentUnits,

        initial_product_units:
          initialUnits,

        unique_shop_skus:
          shopSkus.size,

        unique_market_skus:
          marketSkus.size,

        warehouses:
          Array.from(
            warehouses.entries()
          )
            .map(
              (
                [
                  id,
                  name,
                ]
              ) => ({
                id,
                name,
              })
            )
            .sort(
              (
                a,
                b
              ) =>
                a.id
                -
                b.id
            ),

        item_detail_status_counts:
          detailStatusCounts,

        sample_delivered_or_first_order:
          sampleNormalOrder,

        sample_cancel_return_or_partial_order:
          sampleProblemOrder,

        sample_order_with_initial_items:
          sampleOrderWithInitialItems,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX SALES GET ERROR:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        mode:
          "read_only_yandex_sales",

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
