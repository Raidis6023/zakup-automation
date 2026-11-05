import { getIntegrationSecret } from "@/lib/integrations/secrets";
import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


type ReturnRow = {
  order_id:
    string | null;
};


type OrderRow = {
  order_id: string;
};


type YandexItem = {
  offerName?: string;
  marketSku?: string | number;
  shopSku?: string;
  count?: number;

  [key: string]:
    unknown;
};


type YandexOrder = {
  id?: string | number;
  creationDate?: string;
  statusUpdateDate?: string;
  status?: string;
  items?: YandexItem[];

  [key: string]:
    unknown;
};


type YandexOrdersResponse = {
  result?: {
    orders?: YandexOrder[];

    paging?: {
      nextPageToken?: string;
    };
  };
};


// ============================================================
// CONFIG
// ============================================================

async function getConfig() {

  const apiKey =
    await getIntegrationSecret("yandex_api_key");


  const campaignId =
    await getIntegrationSecret("yandex_campaign_id");


  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim()
    ||
    process.env
      .SUPABASE_URL
      ?.trim();


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY
      ?.trim()
    ||
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
      ?.trim();


  if (
    !apiKey
    ||
    !campaignId
    ||
    !supabaseUrl
    ||
    !supabaseSecretKey
  ) {

    throw new Error(
      "Не найдена одна из обязательных переменных окружения"
    );

  }


  return {
    apiKey,
    campaignId,
    supabaseUrl,
    supabaseSecretKey,
  };

}


// ============================================================
// SUPABASE
// ============================================================

function getSupabaseHeaders(
  secretKey: string
) {

  return {
    apikey:
      secretKey,

    Authorization:
      `Bearer ${secretKey}`,

    Accept:
      "application/json",
  };

}


async function fetchAllRows<T>(
  supabaseUrl: string,
  secretKey: string,
  table: string,
  select: string
):
Promise<T[]> {

  const result:
    T[] =
    [];


  const pageSize =
    1000;


  let offset =
    0;


  while (true) {

    const url =
      new URL(
        `${supabaseUrl}/rest/v1/${table}`
      );


    url.searchParams.set(
      "select",
      select
    );


    url.searchParams.set(
      "limit",
      String(
        pageSize
      )
    );


    url.searchParams.set(
      "offset",
      String(
        offset
      )
    );


    const response =
      await fetch(
        url.toString(),
        {
          headers:
            getSupabaseHeaders(
              secretKey
            ),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      throw new Error(
        `Supabase ${table}: HTTP ${response.status}: ${text}`
      );

    }


    const rows =
      JSON.parse(
        text
      ) as T[];


    result.push(
      ...rows
    );


    if (
      rows.length <
      pageSize
    ) {

      break;

    }


    offset +=
      pageSize;

  }


  return result;

}


// ============================================================
// SAFE JSON
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
// FETCH ORDERS BY IDS
// ============================================================

async function fetchOrdersByIds(
  apiKey: string,
  campaignId: string,
  orderIds: string[]
) {

  const result:
    YandexOrder[] =
    [];


  const chunkSize =
    200;


  let requests =
    0;


  for (
    let index =
      0;

    index <
      orderIds.length;

    index +=
      chunkSize
  ) {

    const chunk =
      orderIds.slice(
        index,
        index +
          chunkSize
      );


    const numericIds =
      chunk.map(
        value => {

          const number =
            Number(
              value
            );


          if (
            !Number.isSafeInteger(
              number
            )
          ) {

            throw new Error(
              `Некорректный order_id: ${value}`
            );

          }


          return number;

        }
      );


    let pageToken:
      string | null =
      null;


    do {

      requests +=
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
                  orders:
                    numericIds,
                }
              ),

            cache:
              "no-store",
          }
        );


      const text =
        await response.text();


      let data:
        YandexOrdersResponse;


      try {

        data =
          parseYandexJson(
            text
          );

      } catch {

        throw new Error(
          `Яндекс вернул некорректный JSON: ${text}`
        );

      }


      if (!response.ok) {

        throw new Error(
          `Yandex stats/orders HTTP ${response.status}: ${text}`
        );

      }


      result.push(
        ...(
          data.result
            ?.orders
          ??
          []
        )
      );


      const next =
        data.result
          ?.paging
          ?.nextPageToken
          ?.trim()
        ??
        "";


      pageToken =
        next
        ||
        null;


    } while (
      pageToken
    );

  }


  return {
    requests,
    orders:
      result,
  };

}


// ============================================================
// GET
//
// ТОЛЬКО ДИАГНОСТИКА.
// НИЧЕГО НЕ ПИШЕМ.
// ============================================================

export async function GET() {

  try {

    const {
      apiKey,
      campaignId,
      supabaseUrl,
      supabaseSecretKey,
    } =
      await getConfig();


    const [
      returns,
      existingOrders,
    ] =
      await Promise.all(
        [
          fetchAllRows<
            ReturnRow
          >(
            supabaseUrl,
            supabaseSecretKey,
            "yandex_returns",
            "order_id"
          ),

          fetchAllRows<
            OrderRow
          >(
            supabaseUrl,
            supabaseSecretKey,
            "yandex_orders",
            "order_id"
          ),
        ]
      );


    const existingIds =
      new Set(
        existingOrders.map(
          row =>
            row.order_id
        )
      );


    const returnOrderIds =
      new Set<string>();


    for (
      const row
      of returns
    ) {

      const orderId =
        row.order_id
          ?.trim();


      if (orderId) {

        returnOrderIds.add(
          orderId
        );

      }

    }


    const missingIds =
      Array.from(
        returnOrderIds
      )
        .filter(
          id =>
            !existingIds.has(
              id
            )
        )
        .sort();


    const {
      requests,
      orders,
    } =
      await fetchOrdersByIds(
        apiKey,
        campaignId,
        missingIds
      );


    const receivedIds =
      new Set(
        orders.map(
          order =>
            String(
              order.id
              ??
              ""
            )
              .trim()
        )
          .filter(
            Boolean
          )
      );


    const stillMissingIds =
      missingIds.filter(
        id =>
          !receivedIds.has(
            id
          )
      );


    const creationDates =
      orders
        .map(
          order =>
            order.creationDate
        )
        .filter(
          (
            value
          ):
          value is string =>
            Boolean(
              value
            )
        )
        .sort();


    const statusCounts:
      Record<
        string,
        number
      > =
      {};


    let itemLines =
      0;


    let itemUnits =
      0;


    const shopSkus =
      new Set<string>();


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


      for (
        const item
        of order.items
        ??
        []
      ) {

        itemLines +=
          1;


        itemUnits +=
          Number(
            item.count
            ??
            0
          );


        const shopSku =
          item.shopSku
            ?.trim();


        if (shopSku) {

          shopSkus.add(
            shopSku
          );

        }

      }

    }


    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "read_only_return_parent_orders",

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        campaign_id:
          campaignId,

        return_order_ids:
          returnOrderIds.size,

        orders_already_in_database:
          existingIds.size,

        missing_parent_orders_requested:
          missingIds.length,

        yandex_requests:
          requests,

        parent_orders_received:
          orders.length,

        still_missing_parent_orders:
          stillMissingIds.length,

        still_missing_order_ids:
          stillMissingIds,

        earliest_parent_order_date:
          creationDates[0]
          ??
          null,

        latest_parent_order_date:
          creationDates[
            creationDates.length -
            1
          ]
          ??
          null,

        status_counts:
          statusCounts,

        item_lines:
          itemLines,

        item_units:
          itemUnits,

        unique_shop_skus:
          shopSkus.size,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX RETURN PARENT ORDERS ERROR:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

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
