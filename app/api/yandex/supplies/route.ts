export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  120;


const YANDEX_API_BASE =
  "https://api.partner.market.yandex.ru";


type Location = {
  requestedDate?:
    string;

  serviceId?:
    number;

  name?:
    string;

  type?:
    string;

  address?: {
    fullAddress?:
      string;
  };
};


type RequestCounters = {
  planCount?:
    number;

  factCount?:
    number;

  undefinedCount?:
    number;

  surplusCount?:
    number;

  shortageCount?:
    number;

  defectCount?:
    number;

  acceptableCount?:
    number;

  unacceptableCount?:
    number;

  actualPalletsCount?:
    number;

  actualBoxCount?:
    number;
};


type SupplyRequest = {
  id?: {
    id?:
      number;

    marketplaceRequestId?:
      string;

    warehouseRequestId?:
      string;
  };

  type?:
    string;

  subtype?:
    string;

  status?:
    string;

  updatedAt?:
    string;

  counters?:
    RequestCounters;

  targetLocation?:
    Location;

  transitLocation?:
    Location
    |
    null;

  etrnIdentifier?:
    string;
};


type ListResponse = {
  status?:
    string;

  result?: {
    requests?:
      SupplyRequest[];

    paging?: {
      nextPageToken?:
        string;
    };
  };

  errors?: Array<{
    code?:
      string;

    message?:
      string;
  }>;
};


type Item = {
  offerId?:
    string;

  name?:
    string;

  price?:
    {
      value?:
        number;

      currencyId?:
        string;
    };

  counters?: {
    planCount?:
      number;

    factCount?:
      number;

    surplusCount?:
      number;

    shortageCount?:
      number;

    defectCount?:
      number;
  };
};


type ItemsResponse = {
  status?:
    string;

  result?: {
    items?:
      Item[];

    paging?: {
      nextPageToken?:
        string;
    };
  };

  errors?: Array<{
    code?:
      string;

    message?:
      string;
  }>;
};


function getConfig() {

  const apiKey =
    process.env
      .YANDEX_API_KEY
      ?.trim();

  const campaignId =
    process.env
      .YANDEX_CAMPAIGN_ID
      ?.trim();


  if (
    !apiKey
    ||
    !campaignId
  ) {

    throw new Error(
      "Не найдены YANDEX_API_KEY / YANDEX_CAMPAIGN_ID"
    );

  }


  return {
    apiKey,
    campaignId,
  };

}


async function yandexPost<T>(
  path:
    string,

  body:
    unknown
):
Promise<T> {

  const {
    apiKey,
  } =
    getConfig();


  const response =
    await fetch(
      `${YANDEX_API_BASE}${path}`,
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
            body
          ),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    if (
      response.status ===
      403
    ) {

      throw new Error(
        "Токен Яндекс Маркета не имеет доступа к управлению поставками. Нужен доступ supplies-management:read-only."
      );

    }


    throw new Error(
      `Яндекс Маркет ${path}: HTTP ${response.status}: ${text}`
    );

  }


  return (
    text
      ? JSON.parse(
          text
        ) as T
      : {} as T
  );

}


function statusLabel(
  status:
    string
) {

  const labels:
    Record<
      string,
      string
    > =
    {
      CREATED:
        "Создана",

      VALIDATED:
        "Проверена",

      PUBLISHED:
        "Опубликована",

      ARRIVED_TO_SERVICE:
        "Прибыла на склад",

      ARRIVED_TO_XDOC_SERVICE:
        "Прибыла на транзит",

      SHIPPED_TO_SERVICE:
        "Отгружена к складу",

      REGISTERED_IN_ELECTRONIC_QUEUE:
        "В электронной очереди",

      TRANSIT_MOVING:
        "В пути",

      WAREHOUSE_HANDLING:
        "Обработка на складе",

      ACCEPTED_BY_WAREHOUSE_SYSTEM:
        "Принята складом",

      FINISHED:
        "Завершена",

      CANCELLED:
        "Отменена",

      INVALID:
        "Ошибка данных",

      CANCELLATION_REQUESTED:
        "Запрошена отмена",

      CANCELLATION_REJECTED:
        "Отмена отклонена",

      READY_FOR_UTILIZATION:
        "Готова к утилизации",

      READY_TO_WITHDRAW:
        "Готова к вывозу",

      NEED_PREPARATION:
        "Требует подготовки",

      WAREHOUSE_SIGNED_ACT:
        "Акт подписан складом",
    };


  return labels[
    status
  ]
  ??
  status
  ??
  "Неизвестно";

}


function isTerminal(
  status:
    string
) {

  return [
    "FINISHED",
    "CANCELLED",
    "INVALID",
  ].includes(
    status
  );

}


function normalizeSummary(
  request:
    SupplyRequest
) {

  const requestId =
    String(
      request.id
        ?.id
      ??
      ""
    );


  const marketplaceId =
    request.id
      ?.marketplaceRequestId
    ??
    "";


  const counters =
    request.counters
    ??
    {};


  const target =
    request.targetLocation
    ??
    null;

  const transit =
    request.transitLocation
    ??
    null;

  const status =
    request.status
    ??
    "UNKNOWN";


  return {
    key:
      `ym:${requestId}`,

    id:
      requestId,

    number:
      marketplaceId
        ? `ЯМ № ${marketplaceId}`
        : requestId
          ? `ЯМ заявка ${requestId}`
          : "ЯМ поставка",

    secondaryNumber:
      request.id
        ?.warehouseRequestId
      ??
      null,

    status,

    statusLabel:
      statusLabel(
        status
      ),

    isTerminal:
      isTerminal(
        status
      ),

    createdAt:
      null,

    updatedAt:
      request.updatedAt
      ??
      null,

    timeslotFrom:
      transit
        ?.requestedDate
      ??
      target
        ?.requestedDate
      ??
      null,

    timeslotTo:
      null,

    destinationName:
      target?.name
      ??
      null,

    destinationAddress:
      target
        ?.address
        ?.fullAddress
      ??
      null,

    transitName:
      transit?.name
      ??
      null,

    dropoffName:
      null,

    plannedUnits:
      counters.planCount
      ??
      null,

    acceptedUnits:
      counters.factCount
      ??
      null,

    boxCount:
      counters.actualBoxCount
      ??
      null,

    palletCount:
      counters.actualPalletsCount
      ??
      null,

    cargoCount:
      (
        counters.actualBoxCount !==
          undefined
        ||
        counters.actualPalletsCount !==
          undefined
      )
        ? Number(
            counters.actualBoxCount
            ??
            0
          )
          +
          Number(
            counters.actualPalletsCount
            ??
            0
          )
        : null,

    supplyType:
      request.subtype
      ??
      request.type
      ??
      null,

    detail: {
      id:
        requestId,
    },
  };

}


async function getOverview() {

  const {
    campaignId,
  } =
    getConfig();


  const response =
    await yandexPost<
      ListResponse
    >(
      `/v2/campaigns/${encodeURIComponent(
        campaignId
      )}/supply-requests?limit=50`,
      {
        requestTypes: [
          "SUPPLY",
        ],

        sorting: {
          direction:
            "DESC",

          attribute:
            "UPDATED_AT",
        },
      }
    );


  return (
    response.result
      ?.requests
    ??
    []
  ).map(
    normalizeSummary
  );

}


async function getItems(
  requestId:
    number
) {

  const {
    campaignId,
  } =
    getConfig();


  const result:
    Item[] =
    [];


  let pageToken =
    "";


  for (
    let page = 0;
    page < 100;
    page++
  ) {

    const url =
      new URL(
        `${YANDEX_API_BASE}/v2/campaigns/${encodeURIComponent(
          campaignId
        )}/supply-requests/items`
      );


    url.searchParams.set(
      "limit",
      "500"
    );


    if (pageToken) {

      url.searchParams.set(
        "pageToken",
        pageToken
      );

    }


    const path =
      url.pathname
      +
      url.search;


    const response =
      await yandexPost<
        ItemsResponse
      >(
        path,
        {
          requestId,
        }
      );


    const pageItems =
      response.result
        ?.items
      ??
      [];


    result.push(
      ...pageItems
    );


    const next =
      response.result
        ?.paging
        ?.nextPageToken
      ??
      "";


    if (
      !next
      ||
      next ===
        pageToken
    ) {

      break;

    }


    pageToken =
      next;

  }


  return result;

}


async function getRequestById(
  requestId:
    number
) {

  const supplies =
    await getOverview();


  return supplies.find(
    supply =>
      supply.id ===
      String(
        requestId
      )
  )
  ??
  null;

}


async function getDetail(
  id:
    string
) {

  const requestId =
    Number(
      id
    );


  if (
    !Number.isSafeInteger(
      requestId
    )
    ||
    requestId <=
      0
  ) {

    throw new Error(
      "Некорректный ID поставки Яндекс Маркета"
    );

  }


  const [
    summary,
    items,
  ] =
    await Promise.all([
      getRequestById(
        requestId
      ),
      getItems(
        requestId
      ),
    ]);


  if (!summary) {

    throw new Error(
      "Поставка Яндекс Маркета не найдена в текущем списке"
    );

  }


  const cargoPlaces:
    Array<{
      id:
        string;

      type:
        string;

      barcode:
        null;

      quantity:
        number;

      description:
        string;
    }> =
    [];


  const boxCount =
    Number(
      summary.boxCount
      ??
      0
    );

  const palletCount =
    Number(
      summary.palletCount
      ??
      0
    );


  if (
    boxCount >
    0
  ) {

    cargoPlaces.push({
      id:
        `boxes:${requestId}`,

      type:
        "Короба",

      barcode:
        null,

      quantity:
        boxCount,

      description:
        "Яндекс API возвращает фактическое количество коробов без отдельных идентификаторов коробов.",
    });

  }


  if (
    palletCount >
    0
  ) {

    cargoPlaces.push({
      id:
        `pallets:${requestId}`,

      type:
        "Паллеты",

      barcode:
        null,

      quantity:
        palletCount,

      description:
        "Яндекс API возвращает фактическое количество паллет.",
    });

  }


  return {
    ok:
      true,

    summary,

    items:
      items.map(
        item => ({
          sku:
            null,

          offerId:
            item.offerId
            ??
            null,

          name:
            item.name
            ??
            null,

          barcode:
            null,

          plannedQuantity:
            Number(
              item.counters
                ?.planCount
              ??
              0
            ),

          acceptedQuantity:
            item.counters
              ?.factCount
            ??
            null,
        })
      ),

    cargoPlaces,

    notes: [
      "Для Яндекс Маркета дата поставки берётся из requestedDate точки назначения или транзита.",

      "Отдельные номера коробов/паллет этот метод API не возвращает, поэтому показывается их фактическое количество.",
    ],
  };

}


export async function GET(
  request:
    Request
) {

  try {

    const url =
      new URL(
        request.url
      );


    const id =
      url.searchParams.get(
        "id"
      )
      ?.trim()
    ??
    "";


    if (id) {

      return Response.json(
        await getDetail(
          id
        )
      );

    }


    const supplies =
      await getOverview();


    return Response.json(
      {
        ok:
          true,

        marketplace:
          "yandex",

        updatedAt:
          new Date()
            .toISOString(),

        supplies,
      }
    );

  } catch (
    error
  ) {

    console.error(
      "Yandex supplies read error:",
      error
    );


    const message =
      error instanceof Error
        ? error.message
        : String(
            error
          );


    return Response.json(
      {
        ok:
          false,

        marketplace:
          "yandex",

        updatedAt:
          new Date()
            .toISOString(),

        supplies:
          [],

        error:
          message,
      },
      {
        status:
          message.includes(
            "supplies-management"
          )
            ? 403
            : 500,
      }
    );

  }

}
