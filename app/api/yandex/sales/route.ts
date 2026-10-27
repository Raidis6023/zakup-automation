import {
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";


// ============================================================
// CONFIG
// ============================================================

const SALES_WINDOW_DAYS = 28;


// ============================================================
// TYPES
// ============================================================

type YandexPrice = {
  type?: string;
  costPerItem?: number;
  total?: number;
};


type YandexItem = {
  offerName?: string;

  marketSku?:
    string
    | number;

  shopSku?: string;

  count?: number;

  prices?: YandexPrice[] | null;

  warehouse?: {
    id?: number;
    name?: string;
  } | null;

  details?: unknown[] | null;

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

  deliveryRegion?: {
    id?: number;
    name?: string;
  } | null;

  items?: YandexItem[];

  initialItems?:
    YandexItem[]
    | null;

  buyerType?: string;

  currency?: string;

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


type YandexReturnItem = {
  marketSku?:
    string
    | number;

  shopSku?: string;

  count?: number;

  decisions?: unknown[] | null;

  instances?: unknown[] | null;

  tracks?: unknown[] | null;

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

  shipmentRecipientType?: string;

  shipmentStatus?: string;

  refundAmount?: number;

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


type YandexProductRow = {
  id: number;
  offer_id: string;
  master_code: string | null;
};


type ProductRow = {
  id: string;
  offer_id: string;
  master_code: string | null;
};


type ExistingOrderRow = {
  order_id: string;
};


type PreparedData = {
  campaignId: string;

  supabaseUrl: string;

  supabaseSecretKey: string;

  dateFrom: string;

  dateTo: string;

  ordersPages: number;

  returnsPages: number;

  windowOrders: YandexOrder[];

  parentOrders: YandexOrder[];

  allOrders: YandexOrder[];

  returns: YandexReturn[];

  parentOrdersRequested: number;

  parentOrdersStillMissing: string[];

  yandexProductByOffer:
    Map<
      string,
      YandexProductRow
    >;

  productByOffer:
    Map<
      string,
      ProductRow
    >;

  shopSkus:
    Set<string>;

  missingShopSkuLines: number;

  missingYandexProductSkus:
    string[];

  unlinkedYandexProductSkus:
    string[];

  missingProductRowSkus:
    string[];

  productWithoutMasterCodeSkus:
    string[];

  masterCodeConflictSkus:
    Array<{
      shop_sku: string;
      yandex_master_code: string;
      product_master_code: string;
    }>;
};


// ============================================================
// ENV
// ============================================================

function getConfig() {

  const yandexApiKey =
    process.env
      .YANDEX_API_KEY
      ?.trim();


  const campaignId =
    process.env
      .YANDEX_CAMPAIGN_ID
      ?.trim();


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


  if (!yandexApiKey) {
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


  if (!supabaseUrl) {
    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL или SUPABASE_URL"
    );
  }


  if (!supabaseSecretKey) {
    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY"
    );
  }


  return {
    yandexApiKey,
    campaignId,
    supabaseUrl,
    supabaseSecretKey,
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
// SAFE JSON
// ============================================================

function parseYandexJson<T>(
  text: string
):
T {

  const safeText =
    text.replace(
      /"marketSku"\s*:\s*(\d+)/g,
      '"marketSku":"$1"'
    );


  return JSON.parse(
    safeText
  ) as T;

}


// ============================================================
// FETCH ORDERS BY DATE
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
            JSON.stringify({
              dateFrom,
              dateTo,
            }),

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
        parseYandexJson<
          YandexOrdersResponse
        >(
          text
        );

    } catch {

      throw new Error(
        `Некорректный JSON stats/orders, страница ${pages}: ${text}`
      );

    }


    if (!response.ok) {

      throw new Error(
        `Yandex stats/orders HTTP ${response.status}: ${text}`
      );

    }


    orders.push(
      ...(
        data.result
          ?.orders
        ??
        []
      )
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
        "stats/orders повторно вернул тот же nextPageToken"
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
      "Достигнут лимит страниц stats/orders"
    );

  }


  return {
    pages,
    orders,
  };

}


// ============================================================
// FETCH ORDERS BY IDS
// ============================================================

async function fetchOrdersByIds(
  apiKey: string,
  campaignId: string,
  orderIds: string[]
) {

  if (
    orderIds.length ===
    0
  ) {

    return {
      requests:
        0,

      orders:
        [] as YandexOrder[],
    };

  }


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
              JSON.stringify({
                orders:
                  numericIds,
              }),

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
          parseYandexJson<
            YandexOrdersResponse
          >(
            text
          );

      } catch {

        throw new Error(
          `Некорректный JSON родительских заказов: ${text}`
        );

      }


      if (!response.ok) {

        throw new Error(
          `Yandex parent orders HTTP ${response.status}: ${text}`
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
// FETCH RETURNS
// ============================================================

async function fetchReturns(
  apiKey: string,
  campaignId: string,
  dateFrom: string,
  dateTo: string
) {

  const returns:
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


    url.searchParams.set(
      "fromDate",
      dateFrom
    );


    url.searchParams.set(
      "toDate",
      dateTo
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


    const text =
      await response.text();


    let data:
      YandexReturnsResponse;


    try {

      data =
        parseYandexJson<
          YandexReturnsResponse
        >(
          text
        );

    } catch {

      throw new Error(
        `Некорректный JSON returns, страница ${pages}: ${text}`
      );

    }


    if (!response.ok) {

      throw new Error(
        `Yandex returns HTTP ${response.status}: ${text}`
      );

    }


    returns.push(
      ...(
        data.result
          ?.returns
        ??
        []
      )
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
        "returns повторно вернул тот же nextPageToken"
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
      "Достигнут лимит страниц returns"
    );

  }


  // ==========================================================
  // DEDUPLICATE RETURNS
  // ==========================================================
  //
  // Yandex can return the same return id more than once across
  // pages of the same response. Supabase upserts yandex_returns
  // by return_id, and PostgreSQL rejects a single INSERT batch
  // that tries to update the same key twice.
  //
  // Keep one row per return id. If duplicates differ, prefer
  // the row with the newest updateDate, then creationDate.

  const uniqueReturnsById =
    new Map<
      string,
      YandexReturn
    >();


  const getReturnFreshness =
    (
      row:
        YandexReturn
    ) => {

      const updateTime =
        Date.parse(
          String(
            row.updateDate
            ??
            ""
          )
        );


      if (
        Number.isFinite(
          updateTime
        )
      ) {

        return updateTime;

      }


      const creationTime =
        Date.parse(
          String(
            row.creationDate
            ??
            ""
          )
        );


      return Number.isFinite(
        creationTime
      )
        ? creationTime
        : 0;

    };


  for (
    const row
    of returns
  ) {

    const returnId =
      String(
        row.id
        ??
        ""
      ).trim();


    if (!returnId) {

      // buildReturnRows will still reject a malformed return
      // without id. Do not hide invalid source data here.
      uniqueReturnsById.set(
        `__missing__:${uniqueReturnsById.size}`,
        row
      );

      continue;

    }


    const existing =
      uniqueReturnsById.get(
        returnId
      );


    if (
      !existing
      ||
      getReturnFreshness(
        row
      )
      >=
      getReturnFreshness(
        existing
      )
    ) {

      uniqueReturnsById.set(
        returnId,
        row
      );

    }

  }


  const uniqueReturns =
    Array.from(
      uniqueReturnsById.values()
    );


  const duplicatesDropped =
    returns.length
    -
    uniqueReturns.length;


  if (
    duplicatesDropped >
    0
  ) {

    console.warn(
      `YANDEX RETURNS: removed ${duplicatesDropped} duplicate row(s) by return_id before database upsert`
    );

  }


  return {
    pages,
    returns:
      uniqueReturns,
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

    "Content-Type":
      "application/json",

    Accept:
      "application/json",
  };

}


async function fetchAllSupabaseRows<T>(
  baseUrl: string,
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
        `${baseUrl}/rest/v1/${table}`
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
          method:
            "GET",

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
// PREFLIGHT
// ============================================================

async function prepareData():
Promise<PreparedData> {

  const {
    yandexApiKey,
    campaignId,
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  // Берём 28 полных календарных дней по Красноярску.
  // Текущий (ещё не завершённый) день в продажи не включаем.
  const dateTo =
    shiftDate(
      getKrasnoyarskDate(),
      -1
    );


  const dateFrom =
    shiftDate(
      dateTo,
      -(
        SALES_WINDOW_DAYS
        -
        1
      )
    );


  const [
    ordersResult,
    returnsResult,
    yandexProducts,
    products,
    existingOrders,
  ] =
    await Promise.all(
      [
        fetchOrders(
          yandexApiKey,
          campaignId,
          dateFrom,
          dateTo
        ),

        fetchReturns(
          yandexApiKey,
          campaignId,
          dateFrom,
          dateTo
        ),

        fetchAllSupabaseRows<
          YandexProductRow
        >(
          supabaseUrl,
          supabaseSecretKey,
          "yandex_products",
          "id,offer_id,master_code"
        ),

        fetchAllSupabaseRows<
          ProductRow
        >(
          supabaseUrl,
          supabaseSecretKey,
          "products",
          "id,offer_id,master_code"
        ),

        fetchAllSupabaseRows<
          ExistingOrderRow
        >(
          supabaseUrl,
          supabaseSecretKey,
          "yandex_orders",
          "order_id"
        ),
      ]
    );


  // ==========================================================
  // KNOWN ORDERS
  // ==========================================================

  const knownOrderIds =
    new Set<string>();


  for (
    const row
    of existingOrders
  ) {

    knownOrderIds.add(
      row.order_id
    );

  }


  for (
    const order
    of ordersResult.orders
  ) {

    const orderId =
      String(
        order.id
        ??
        ""
      ).trim();


    if (orderId) {

      knownOrderIds.add(
        orderId
      );

    }

  }


  // ==========================================================
  // MISSING PARENT ORDERS
  // ==========================================================

  const missingParentIdsSet =
    new Set<string>();


  for (
    const row
    of returnsResult.returns
  ) {

    const orderId =
      String(
        row.orderId
        ??
        ""
      ).trim();


    if (
      orderId
      &&
      !knownOrderIds.has(
        orderId
      )
    ) {

      missingParentIdsSet.add(
        orderId
      );

    }

  }


  const missingParentIds =
    Array.from(
      missingParentIdsSet
    )
      .sort();


  const parentResult =
    await fetchOrdersByIds(
      yandexApiKey,
      campaignId,
      missingParentIds
    );


  const receivedParentIds =
    new Set(
      parentResult.orders
        .map(
          order =>
            String(
              order.id
              ??
              ""
            ).trim()
        )
        .filter(
          Boolean
        )
    );


  const parentOrdersStillMissing =
    missingParentIds
      .filter(
        id =>
          !receivedParentIds.has(
            id
          )
      );


  // ==========================================================
  // ALL ORDERS FOR THIS RUN
  // ==========================================================

  const allOrderMap =
    new Map<
      string,
      YandexOrder
    >();


  for (
    const order
    of [
      ...ordersResult.orders,
      ...parentResult.orders,
    ]
  ) {

    const orderId =
      String(
        order.id
        ??
        ""
      ).trim();


    if (orderId) {

      allOrderMap.set(
        orderId,
        order
      );

    }

  }


  const allOrders =
    Array.from(
      allOrderMap.values()
    );


  // ==========================================================
  // PRODUCT MAPS
  // ==========================================================

  const yandexProductByOffer =
    new Map<
      string,
      YandexProductRow
    >();


  for (
    const row
    of yandexProducts
  ) {

    yandexProductByOffer.set(
      row.offer_id,
      row
    );

  }


  const productByOffer =
    new Map<
      string,
      ProductRow
    >();


  for (
    const row
    of products
  ) {

    productByOffer.set(
      row.offer_id,
      row
    );

  }


  // ==========================================================
  // PREFLIGHT ITEMS
  // ==========================================================

  const shopSkus =
    new Set<string>();


  let missingShopSkuLines =
    0;


  function registerItem(
    item:
      YandexItem
      |
      YandexReturnItem
  ) {

    const shopSku =
      String(
        item.shopSku
        ??
        ""
      ).trim();


    if (!shopSku) {

      missingShopSkuLines +=
        1;

      return;

    }


    shopSkus.add(
      shopSku
    );

  }


  for (
    const order
    of allOrders
  ) {

    for (
      const item
      of order.items
      ??
      []
    ) {

      if (
        item.offerName ===
        "Доставка"
      ) {

        continue;

      }


      registerItem(
        item
      );

    }

  }


  for (
    const row
    of returnsResult.returns
  ) {

    for (
      const item
      of row.items
      ??
      []
    ) {

      registerItem(
        item
      );

    }

  }


  const missingYandexProductSkus:
    string[] =
    [];


  const unlinkedYandexProductSkus:
    string[] =
    [];


  const missingProductRowSkus:
    string[] =
    [];


  const productWithoutMasterCodeSkus:
    string[] =
    [];


  const masterCodeConflictSkus:
    Array<{
      shop_sku: string;
      yandex_master_code: string;
      product_master_code: string;
    }> =
    [];


  for (
    const shopSku
    of shopSkus
  ) {

    const yp =
      yandexProductByOffer.get(
        shopSku
      );


    if (!yp) {

      missingYandexProductSkus.push(
        shopSku
      );

      continue;

    }


    const yandexMaster =
      yp.master_code
        ?.trim()
      ||
      "";


    if (!yandexMaster) {

      unlinkedYandexProductSkus.push(
        shopSku
      );

      continue;

    }


    const product =
      productByOffer.get(
        shopSku
      );


    if (!product) {

      missingProductRowSkus.push(
        shopSku
      );

      continue;

    }


    const productMaster =
      product.master_code
        ?.trim()
      ||
      "";


    if (!productMaster) {

      productWithoutMasterCodeSkus.push(
        shopSku
      );

      continue;

    }


    if (
      productMaster
      !==
      yandexMaster
    ) {

      masterCodeConflictSkus.push(
        {
          shop_sku:
            shopSku,

          yandex_master_code:
            yandexMaster,

          product_master_code:
            productMaster,
        }
      );

    }

  }


  missingYandexProductSkus.sort();

  unlinkedYandexProductSkus.sort();

  missingProductRowSkus.sort();

  productWithoutMasterCodeSkus.sort();


  masterCodeConflictSkus.sort(
    (
      a,
      b
    ) =>
      a.shop_sku.localeCompare(
        b.shop_sku
      )
  );


  return {
    campaignId,
    supabaseUrl,
    supabaseSecretKey,

    dateFrom,
    dateTo,

    ordersPages:
      ordersResult.pages,

    returnsPages:
      returnsResult.pages,

    windowOrders:
      ordersResult.orders,

    parentOrders:
      parentResult.orders,

    allOrders,

    returns:
      returnsResult.returns,

    parentOrdersRequested:
      missingParentIds.length,

    parentOrdersStillMissing,

    yandexProductByOffer,
    productByOffer,

    shopSkus,

    missingShopSkuLines,
    missingYandexProductSkus,
    unlinkedYandexProductSkus,
    missingProductRowSkus,
    productWithoutMasterCodeSkus,
    masterCodeConflictSkus,
  };

}


// ============================================================
// PREFLIGHT STATUS
// ============================================================

function hasPreflightErrors(
  data: PreparedData
) {

  return (
    data.parentOrdersStillMissing.length >
      0
    ||
    data.missingShopSkuLines >
      0
    ||
    data.missingYandexProductSkus.length >
      0
    ||
    data.missingProductRowSkus.length >
      0
    ||
    data.productWithoutMasterCodeSkus.length >
      0
    ||
    data.masterCodeConflictSkus.length >
      0
  );

}


// ============================================================
// HELPERS
// ============================================================

function makeKey(
  parts: Array<
    string
    |
    number
    |
    null
    |
    undefined
  >
) {

  return createHash(
    "sha256"
  )
    .update(
      parts
        .map(
          value =>
            String(
              value
              ??
              ""
            )
        )
        .join(
          "\u001f"
        )
    )
    .digest(
      "hex"
    );

}


function getPrice(
  item: YandexItem,
  type: string
):
number | null {

  const price =
    item.prices
      ?.find(
        row =>
          row.type ===
          type
      )
      ?.costPerItem;


  return typeof price ===
    "number"
    ? price
    : null;

}


function normalizeId(
  value:
    string
    |
    number
    |
    undefined
):
string {

  return String(
    value
    ??
    ""
  ).trim();

}


// ============================================================
// NORMALIZE ORDERS
// ============================================================

function buildOrderRows(
  data: PreparedData,
  syncRunId: string
) {

  const now =
    new Date()
      .toISOString();


  const orders:
    Record<
      string,
      unknown
    >[] =
    [];


  const itemMap =
    new Map<
      string,
      Record<
        string,
        any
      >
    >();


  for (
    const order
    of data.allOrders
  ) {

    const orderId =
      normalizeId(
        order.id
      );


    if (!orderId) {

      throw new Error(
        "Получен заказ без id"
      );

    }


    const creationDate =
      String(
        order.creationDate
        ??
        ""
      ).slice(
        0,
        10
      );


    if (
      !/^\d{4}-\d{2}-\d{2}$/
        .test(
          creationDate
        )
    ) {

      throw new Error(
        `У заказа ${orderId} нет корректной creationDate`
      );

    }


    orders.push(
      {
        order_id:
          orderId,

        last_sync_run_id:
          syncRunId,

        creation_date:
          creationDate,

        status_update_at:
          order.statusUpdateDate
          ??
          null,

        status:
          order.status
          ??
          "UNKNOWN",

        partner_order_id:
          order.partnerOrderId
          ??
          null,

        payment_type:
          order.paymentType
          ??
          null,

        fake:
          order.fake ===
          true,

        delivery_region_id:
          order.deliveryRegion
            ?.id
          ??
          null,

        delivery_region_name:
          order.deliveryRegion
            ?.name
          ??
          null,

        buyer_type:
          order.buyerType
          ??
          null,

        currency:
          order.currency
          ??
          null,

        raw_payload:
          order,

        updated_at:
          now,
      }
    );


    for (
      const item
      of order.items
      ??
      []
    ) {

      if (
        item.offerName ===
        "Доставка"
      ) {

        continue;

      }


      const shopSku =
        String(
          item.shopSku
          ??
          ""
        ).trim();


      if (!shopSku) {

        throw new Error(
          `У заказа ${orderId} есть товар без shopSku`
        );

      }


      const yp =
        data
          .yandexProductByOffer
          .get(
            shopSku
          );


      const product =
        data
          .productByOffer
          .get(
            shopSku
          );


      if (
        !yp
      ) {

        throw new Error(
          `Не удалось сопоставить ${shopSku}`
        );

      }


      const marketSku =
        String(
          item.marketSku
          ??
          ""
        ).trim();


      const warehouseId =
        typeof item.warehouse
          ?.id ===
          "number"
        ? item.warehouse.id
        : null;


      const marketplacePrice =
        getPrice(
          item,
          "MARKETPLACE"
        );


      const buyerPrice =
        getPrice(
          item,
          "BUYER"
        );


      const cashback =
        getPrice(
          item,
          "CASHBACK"
        );


      const itemKey =
        makeKey(
          [
            orderId,
            shopSku,
            marketSku,
            warehouseId,
            item.offerName,
            marketplacePrice,
            buyerPrice,
            cashback,
          ]
        );


      const existing =
        itemMap.get(
          itemKey
        );


      if (existing) {

        existing.quantity =
          Number(
            existing.quantity
            ??
            0
          )
          +
          Number(
            item.count
            ??
            0
          );


        existing.raw_payload
          .source_items
          .push(
            item
          );


        continue;

      }


      itemMap.set(
        itemKey,
        {
          item_key:
            itemKey,

          order_id:
            orderId,

          last_sync_run_id:
            syncRunId,

          yandex_product_id:
            yp.id,

          product_id:
            product
              ?.id
            ??
            null,

          shop_sku:
            shopSku,

          market_sku:
            marketSku
            ||
            null,

          master_code:
            yp.master_code
            ??
            null,

          offer_name:
            item.offerName
            ??
            null,

          quantity:
            Number(
              item.count
              ??
              0
            ),

          warehouse_id:
            warehouseId,

          warehouse_name:
            item.warehouse
              ?.name
            ??
            null,

          marketplace_price:
            marketplacePrice,

          buyer_price:
            buyerPrice,

          cashback,

          item_details:
            item.details
            ??
            null,

          raw_payload: {
            source_items: [
              item,
            ],
          },

          updated_at:
            now,
        }
      );

    }

  }


  return {
    orders,

    items:
      Array.from(
        itemMap.values()
      ),
  };

}


// ============================================================
// NORMALIZE RETURNS
// ============================================================

function buildReturnRows(
  data: PreparedData,
  syncRunId: string
) {

  const now =
    new Date()
      .toISOString();


  const returns:
    Record<
      string,
      unknown
    >[] =
    [];


  const itemMap =
    new Map<
      string,
      Record<
        string,
        any
      >
    >();


  for (
    const row
    of data.returns
  ) {

    const returnId =
      normalizeId(
        row.id
      );


    if (!returnId) {

      throw new Error(
        "Получен возврат без id"
      );

    }


    const orderId =
      normalizeId(
        row.orderId
      )
      ||
      null;


    returns.push(
      {
        return_id:
          returnId,

        order_id:
          orderId,

        last_sync_run_id:
          syncRunId,

        creation_at:
          row.creationDate
          ??
          null,

        update_at:
          row.updateDate
          ??
          null,

        return_type:
          row.returnType
          ??
          "UNKNOWN",

        refund_status:
          row.refundStatus
          ??
          null,

        shipment_recipient_type:
          row.shipmentRecipientType
          ??
          null,

        shipment_status:
          row.shipmentStatus
          ??
          null,

        refund_amount_raw:
          typeof row.refundAmount ===
          "number"
          ? row.refundAmount
          : null,

        amount:
          typeof row.amount
            ?.value ===
            "number"
          ? row.amount.value
          : null,

        currency:
          row.amount
            ?.currencyId
          ??
          null,

        fast_return:
          typeof row.fastReturn ===
          "boolean"
          ? row.fastReturn
          : null,

        raw_payload:
          row,

        updated_at:
          now,
      }
    );


    for (
      const item
      of row.items
      ??
      []
    ) {

      const shopSku =
        String(
          item.shopSku
          ??
          ""
        ).trim();


      if (!shopSku) {

        throw new Error(
          `У возврата ${returnId} есть товар без shopSku`
        );

      }


      const yp =
        data
          .yandexProductByOffer
          .get(
            shopSku
          );


      const product =
        data
          .productByOffer
          .get(
            shopSku
          );


      if (
        !yp
      ) {

        throw new Error(
          `Не удалось сопоставить возвратный товар ${shopSku}`
        );

      }


      const marketSku =
        String(
          item.marketSku
          ??
          ""
        ).trim();


      const itemKey =
        makeKey(
          [
            returnId,
            shopSku,
            marketSku,
          ]
        );


      const existing =
        itemMap.get(
          itemKey
        );


      if (existing) {

        existing.quantity =
          Number(
            existing.quantity
            ??
            0
          )
          +
          Number(
            item.count
            ??
            0
          );


        existing.decisions =
          [
            ...(
              existing.decisions
              ??
              []
            ),

            ...(
              item.decisions
              ??
              []
            ),
          ];


        existing.instances =
          [
            ...(
              existing.instances
              ??
              []
            ),

            ...(
              item.instances
              ??
              []
            ),
          ];


        existing.tracks =
          [
            ...(
              existing.tracks
              ??
              []
            ),

            ...(
              item.tracks
              ??
              []
            ),
          ];


        existing.raw_payload
          .source_items
          .push(
            item
          );


        continue;

      }


      itemMap.set(
        itemKey,
        {
          item_key:
            itemKey,

          return_id:
            returnId,

          order_id:
            orderId,

          last_sync_run_id:
            syncRunId,

          yandex_product_id:
            yp.id,

          product_id:
            product
              ?.id
            ??
            null,

          shop_sku:
            shopSku,

          market_sku:
            marketSku
            ||
            null,

          master_code:
            yp.master_code
            ??
            null,

          quantity:
            Number(
              item.count
              ??
              0
            ),

          decisions:
            item.decisions
            ??
            null,

          instances:
            item.instances
            ??
            null,

          tracks:
            item.tracks
            ??
            null,

          raw_payload: {
            source_items: [
              item,
            ],
          },

          updated_at:
            now,
        }
      );

    }

  }


  return {
    returns,

    items:
      Array.from(
        itemMap.values()
      ),
  };

}


// ============================================================
// CREATE SYNC RUN
// ============================================================

async function createSyncRun(
  data: PreparedData
):
Promise<string> {

  const url =
    new URL(
      `${data.supabaseUrl}/rest/v1/yandex_sales_sync_runs`
    );


  url.searchParams.set(
    "select",
    "id"
  );


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "POST",

        headers: {
          ...getSupabaseHeaders(
            data.supabaseSecretKey
          ),

          Prefer:
            "return=representation",
        },

        body:
          JSON.stringify({
            date_from:
              data.dateFrom,

            date_to:
              data.dateTo,

            status:
              "running",

            orders_received:
              data.allOrders.length,

            returns_received:
              data.returns.length,

            unmatched_order_items:
              0,

            unmatched_return_items:
              0,
          }),
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Не удалось создать sync run: ${response.status}: ${text}`
    );

  }


  const rows =
    JSON.parse(
      text
    ) as Array<{
      id: string;
    }>;


  const id =
    rows[0]
      ?.id;


  if (!id) {

    throw new Error(
      "Supabase не вернул id sync run"
    );

  }


  return id;

}


// ============================================================
// UPSERT
// ============================================================

async function upsertRows(
  supabaseUrl: string,
  secretKey: string,
  table: string,
  conflictColumn: string,
  rows:
    Record<
      string,
      unknown
    >[]
):
Promise<number> {

  if (
    rows.length ===
    0
  ) {

    return 0;

  }


  const batchSize =
    200;


  let saved =
    0;


  for (
    let index =
      0;

    index <
      rows.length;

    index +=
      batchSize
  ) {

    const batch =
      rows.slice(
        index,
        index +
          batchSize
      );


    const url =
      new URL(
        `${supabaseUrl}/rest/v1/${table}`
      );


    url.searchParams.set(
      "on_conflict",
      conflictColumn
    );


    const response =
      await fetch(
        url.toString(),
        {
          method:
            "POST",

          headers: {
            ...getSupabaseHeaders(
              secretKey
            ),

            Prefer:
              "resolution=merge-duplicates,return=minimal",
          },

          body:
            JSON.stringify(
              batch
            ),
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      throw new Error(
        `Supabase ${table}: HTTP ${response.status}: ${text}`
      );

    }


    saved +=
      batch.length;

  }


  return saved;

}


// ============================================================
// PATCH RUN
// ============================================================

async function patchSyncRun(
  supabaseUrl: string,
  secretKey: string,
  syncRunId: string,
  body:
    Record<
      string,
      unknown
    >
) {

  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_sales_sync_runs`
    );


  url.searchParams.set(
    "id",
    `eq.${syncRunId}`
  );


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "PATCH",

        headers: {
          ...getSupabaseHeaders(
            secretKey
          ),

          Prefer:
            "return=minimal",
        },

        body:
          JSON.stringify(
            body
          ),
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Не удалось обновить sync run: HTTP ${response.status}: ${text}`
    );

  }

}


// ============================================================
// GET
// ============================================================

export async function GET() {

  try {

    const data =
      await prepareData();


    const orderItemLines =
      data.allOrders.reduce(
        (
          total,
          order
        ) =>
          total
          +
          (
            order.items
              ?.filter(
                item =>
                  item.offerName
                  !==
                  "Доставка"
              )
              .length
            ??
            0
          ),
        0
      );


    const returnItemLines =
      data.returns.reduce(
        (
          total,
          row
        ) =>
          total
          +
          (
            row.items
              ?.length
            ??
            0
          ),
        0
      );


    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "preflight_yandex_sales_with_parent_orders",

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        campaign_id:
          data.campaignId,

        period: {
          date_from:
            data.dateFrom,

          date_to:
            data.dateTo,

          days:
            SALES_WINDOW_DAYS,
        },

        orders_pages:
          data.ordersPages,

        returns_pages:
          data.returnsPages,

        window_orders_received:
          data.windowOrders.length,

        parent_orders_requested:
          data.parentOrdersRequested,

        parent_orders_received:
          data.parentOrders.length,

        parent_orders_still_missing:
          data.parentOrdersStillMissing,

        total_orders_to_save:
          data.allOrders.length,

        order_item_lines:
          orderItemLines,

        returns_received:
          data.returns.length,

        return_item_lines:
          returnItemLines,

        unique_shop_skus:
          data.shopSkus.size,

        preflight_ok:
          !hasPreflightErrors(
            data
          ),

        missing_shop_sku_lines:
          data.missingShopSkuLines,

        missing_yandex_product_skus:
          data.missingYandexProductSkus,

        unlinked_yandex_product_skus:
          data.unlinkedYandexProductSkus,

        missing_product_row_skus:
          data.missingProductRowSkus,

        product_without_master_code_skus:
          data.productWithoutMasterCodeSkus,

        master_code_conflicts:
          data.masterCodeConflictSkus,
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


// ============================================================
// POST
// ============================================================

export async function POST() {

  let syncRunId:
    string | null =
    null;


  let prepared:
    PreparedData
    |
    null =
    null;


  try {

    prepared =
      await prepareData();


    if (
      hasPreflightErrors(
        prepared
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          writes_to_yandex:
            false,

          writes_to_database:
            false,

          blocked_by_preflight:
            true,

          parent_orders_still_missing:
            prepared
              .parentOrdersStillMissing,

          missing_shop_sku_lines:
            prepared
              .missingShopSkuLines,

          missing_yandex_product_skus:
            prepared
              .missingYandexProductSkus,

          unlinked_yandex_product_skus:
            prepared
              .unlinkedYandexProductSkus,

          missing_product_row_skus:
            prepared
              .missingProductRowSkus,

          product_without_master_code_skus:
            prepared
              .productWithoutMasterCodeSkus,

          master_code_conflicts:
            prepared
              .masterCodeConflictSkus,
        },
        {
          status:
            409,
        }
      );

    }


    syncRunId =
      await createSyncRun(
        prepared
      );


    const orderData =
      buildOrderRows(
        prepared,
        syncRunId
      );


    const returnData =
      buildReturnRows(
        prepared,
        syncRunId
      );


    const ordersSaved =
      await upsertRows(
        prepared.supabaseUrl,
        prepared.supabaseSecretKey,
        "yandex_orders",
        "order_id",
        orderData.orders
      );


    const orderItemsSaved =
      await upsertRows(
        prepared.supabaseUrl,
        prepared.supabaseSecretKey,
        "yandex_order_items",
        "item_key",
        orderData.items
      );


    const returnsSaved =
      await upsertRows(
        prepared.supabaseUrl,
        prepared.supabaseSecretKey,
        "yandex_returns",
        "return_id",
        returnData.returns
      );


    const returnItemsSaved =
      await upsertRows(
        prepared.supabaseUrl,
        prepared.supabaseSecretKey,
        "yandex_return_items",
        "item_key",
        returnData.items
      );


    await patchSyncRun(
      prepared.supabaseUrl,
      prepared.supabaseSecretKey,
      syncRunId,
      {
        status:
          "success",

        order_items_saved:
          orderItemsSaved,

        return_items_saved:
          returnItemsSaved,

        finished_at:
          new Date()
            .toISOString(),

        error_message:
          null,
      }
    );


    return NextResponse.json(
      {
        ok:
          true,

        writes_to_yandex:
          false,

        writes_to_database:
          true,

        sync_run_id:
          syncRunId,

        period: {
          date_from:
            prepared.dateFrom,

          date_to:
            prepared.dateTo,

          days:
            SALES_WINDOW_DAYS,
        },

        window_orders_received:
          prepared
            .windowOrders
            .length,

        parent_orders_requested:
          prepared
            .parentOrdersRequested,

        parent_orders_received:
          prepared
            .parentOrders
            .length,

        parent_orders_still_missing:
          prepared
            .parentOrdersStillMissing
            .length,

        total_orders_received:
          prepared
            .allOrders
            .length,

        orders_saved:
          ordersSaved,

        order_items_saved:
          orderItemsSaved,

        returns_received:
          prepared
            .returns
            .length,

        returns_saved:
          returnsSaved,

        return_items_saved:
          returnItemsSaved,

        unlinked_yandex_product_skus:
          prepared
            .unlinkedYandexProductSkus,

        unmatched_order_items:
          0,

        unmatched_return_items:
          0,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX SALES POST ERROR:",
      error
    );


    if (
      syncRunId
      &&
      prepared
    ) {

      try {

        await patchSyncRun(
          prepared.supabaseUrl,
          prepared.supabaseSecretKey,
          syncRunId,
          {
            status:
              "failed",

            finished_at:
              new Date()
                .toISOString(),

            error_message:
              error instanceof Error
              ? error.message
              : String(error),
          }
        );

      } catch (
        secondaryError
      ) {

        console.error(
          "YANDEX SALES FAILED RUN UPDATE ERROR:",
          secondaryError
        );

      }

    }


    return NextResponse.json(
      {
        ok:
          false,

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        sync_run_id:
          syncRunId,

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
