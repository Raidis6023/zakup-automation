import { getOzonCredentials } from "@/lib/integrations/secrets";
export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  120;


const OZON_API_BASE =
  "https://api-seller.ozon.ru";


const ORDER_STATES =
  [
    "DATA_FILLING",
    "READY_TO_SUPPLY",
    "ACCEPTED_AT_SUPPLY_WAREHOUSE",
    "IN_TRANSIT",
    "ACCEPTANCE_AT_STORAGE_WAREHOUSE",
    "REPORTS_CONFIRMATION_AWAITING",
    "REPORT_REJECTED",
    "COMPLETED",
    "REJECTED_AT_SUPPLY_WAREHOUSE",
    "CANCELLED",
    "OVERDUE",
  ];


type OzonSupply = {
  is_crossdock?:
    boolean;

  macrolocal_cluster_id?:
    number;

  bundle_id?:
    string;

  state?:
    string;

  storage_warehouse?: {
    address?:
      string;

    name?:
      string;

    warehouse_id?:
      number;

    arrival_date?:
      string;
  };

  supply_id?:
    number;
};


type OzonOrder = {
  created_date?:
    string;

  data_filling_deadline_utc?:
    string;

  dropoff_warehouse?: {
    address?:
      string;

    name?:
      string;

    warehouse_id?:
      number;
  };

  order_id?:
    number;

  order_number?:
    string;

  state?:
    string;

  state_updated_date?:
    string;

  supplies?:
    OzonSupply[];

  timeslot?: {
    timeslot?: {
      from?:
        string;

      to?:
        string;
    };

    timezone_info?: {
      iana_name?:
        string;

      offset?:
        string;
    };
  };
};


type OzonOrderListResponse = {
  order_ids?:
    string[];

  last_id?:
    string;
};


type OzonOrderGetResponse = {
  orders?:
    OzonOrder[];
};


type OzonBundleItem = {
  sku?:
    number;

  name?:
    string;

  offer_id?:
    string;

  quantity?:
    number;

  barcode?:
    string;

  product_id?:
    number;
};


type OzonBundleResponse = {
  items?:
    OzonBundleItem[];

  has_next?:
    boolean;

  last_id?:
    string;
};


type OzonCargoResponse = {
  not_found_supply_ids?:
    string[];

  supplies_cargoes?: Array<{
    bundle_id?:
      string;

    supply_id?:
      number;

    cargoes_without_transport_cargoes?: Array<{
      barcode?:
        string;

      bundle_id?:
        string;

      cargo_id?:
        number;
    }>;

    transport_cargoes?: Array<{
      bundle_id?:
        string;

      transport_cargo_id?:
        number;

      type?:
        string;

      cargoes?: Array<{
        barcode?:
          string;

        bundle_id?:
          string;

        cargo_id?:
          number;
      }>;
    }>;
  }>;
};


async function getCredentials() {
  const { sellerClientId: clientId, sellerApiKey: apiKey } = await getOzonCredentials();
  if (!clientId || !apiKey) throw new Error("Укажите ключи Ozon Seller в администрировании ПАНДЫ");
  return { clientId, apiKey };
}


function sleep(
  milliseconds:
    number
) {

  return new Promise<void>(
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  );

}


async function ozonPost<T>(
  path:
    string,

  body:
    unknown
):
Promise<T> {

  const {
    clientId,
    apiKey,
  } =
    await getCredentials();


  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {

    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        30000
      );


    try {

      const response =
        await fetch(
          `${OZON_API_BASE}${path}`,
          {
            method:
              "POST",

            headers: {
              "Client-Id":
                clientId,

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

            signal:
              controller.signal,
          }
        );


      const text =
        await response.text();


      if (
        response.ok
      ) {

        return (
          text
            ? JSON.parse(
                text
              ) as T
            : {} as T
        );

      }


      if (
        (
          response.status ===
            429
          ||
          response.status >=
            500
        )
        &&
        attempt <
          3
      ) {

        const retryAfter =
          Number(
            response.headers.get(
              "retry-after"
            )
          );


        await sleep(
          Number.isFinite(
            retryAfter
          )
            ? Math.min(
                5000,
                Math.max(
                  1000,
                  retryAfter
                  *
                  1000
                )
              )
            : attempt
              *
              1200
        );


        continue;

      }


      throw new Error(
        `Ozon ${path}: HTTP ${response.status}: ${text}`
      );

    } finally {

      clearTimeout(
        timeout
      );

    }

  }


  throw new Error(
    `Ozon ${path}: исчерпаны попытки запроса`
  );

}


function chunks<T>(
  values:
    T[],

  size:
    number
) {

  const result:
    T[][] =
    [];


  for (
    let index = 0;
    index < values.length;
    index += size
  ) {

    result.push(
      values.slice(
        index,
        index + size
      )
    );

  }


  return result;

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
      DATA_FILLING:
        "Заполнение данных",

      READY_TO_SUPPLY:
        "Готова к отгрузке",

      ACCEPTED_AT_SUPPLY_WAREHOUSE:
        "Принята на точке отгрузки",

      IN_TRANSIT:
        "В пути",

      ACCEPTANCE_AT_STORAGE_WAREHOUSE:
        "Приёмка на складе",

      REPORTS_CONFIRMATION_AWAITING:
        "Ожидает согласования актов",

      REPORT_REJECTED:
        "Спор по актам",

      COMPLETED:
        "Завершена",

      REJECTED_AT_SUPPLY_WAREHOUSE:
        "Отказано в приёмке",

      CANCELLED:
        "Отменена",

      OVERDUE:
        "Просрочена",
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
    "COMPLETED",
    "CANCELLED",
    "REJECTED_AT_SUPPLY_WAREHOUSE",
  ].includes(
    status
  );

}


async function getOrders(
  orderIds:
    string[]
) {

  const orders:
    OzonOrder[] =
    [];


  for (
    const batch
    of chunks(
      orderIds,
      50
    )
  ) {

    const response =
      await ozonPost<
        OzonOrderGetResponse
      >(
        "/v3/supply-order/get",
        {
          order_ids:
            batch,
        }
      );


    orders.push(
      ...(
        response.orders
        ??
        []
      )
    );

  }


  return orders;

}


async function getCargoMap(
  supplyIds:
    number[]
) {

  const result =
    new Map<
      number,
      {
        boxCount:
          number;

        palletCount:
          number;

        cargoCount:
          number;
      }
    >();


  for (
    const batch
    of chunks(
      supplyIds,
      50
    )
  ) {

    const response =
      await ozonPost<
        OzonCargoResponse
      >(
        "/v1/cargoes/supplies/get",
        {
          supply_ids:
            batch.map(
              String
            ),
        }
      );


    for (
      const supply
      of response.supplies_cargoes
      ??
      []
    ) {

      const supplyId =
        Number(
          supply.supply_id
        );


      if (
        !Number.isFinite(
          supplyId
        )
      ) {

        continue;

      }


      const freeCargoes =
        supply
          .cargoes_without_transport_cargoes
          ?.length
        ??
        0;


      const transport =
        supply.transport_cargoes
        ??
        [];


      const nestedCargoes =
        transport.reduce(
          (
            total,
            row
          ) =>
            total
            +
            (
              row.cargoes
                ?.length
              ??
              0
            ),
          0
        );


      result.set(
        supplyId,
        {
          boxCount:
            freeCargoes
            +
            nestedCargoes,

          palletCount:
            transport.length,

          cargoCount:
            freeCargoes
            +
            nestedCargoes
            +
            transport.length,
        }
      );

    }

  }


  return result;

}


function normalizeSummary(
  order:
    OzonOrder,

  supply:
    OzonSupply
    |
    null,

  cargo:
    {
      boxCount:
        number;

      palletCount:
        number;

      cargoCount:
        number;
    }
    |
    null
) {

  const orderId =
    String(
      order.order_id
      ??
      ""
    );


  const supplyId =
    supply?.supply_id !==
      undefined
    &&
    supply?.supply_id !==
      null
      ? String(
          supply.supply_id
        )
      : "";


  const state =
    supply?.state
    ??
    order.state
    ??
    "UNSPECIFIED";


  return {
    key:
      `${orderId}:${supplyId || "order"}`,

    id:
      orderId,

    number:
      order.order_number
      ??
      (
        orderId
          ? `Ozon № ${orderId}`
          : "Ozon"
      ),

    secondaryNumber:
      supplyId
        ? `Поставка ${supplyId}`
        : null,

    status:
      state,

    statusLabel:
      statusLabel(
        state
      ),

    isTerminal:
      isTerminal(
        state
      ),

    createdAt:
      order.created_date
      ??
      null,

    updatedAt:
      order.state_updated_date
      ??
      null,

    timeslotFrom:
      order.timeslot
        ?.timeslot
        ?.from
      ??
      null,

    timeslotTo:
      order.timeslot
        ?.timeslot
        ?.to
      ??
      null,

    destinationName:
      supply
        ?.storage_warehouse
        ?.name
      ??
      null,

    destinationAddress:
      supply
        ?.storage_warehouse
        ?.address
      ??
      null,

    transitName:
      null,

    dropoffName:
      order
        .dropoff_warehouse
        ?.name
      ??
      null,

    plannedUnits:
      null,

    acceptedUnits:
      null,

    boxCount:
      cargo?.boxCount
      ??
      null,

    palletCount:
      cargo?.palletCount
      ??
      null,

    cargoCount:
      cargo?.cargoCount
      ??
      null,

    supplyType:
      supply?.is_crossdock
        ? "CROSSDOCK"
        : "DIRECT",

    detail: {
      order_id:
        orderId,

      supply_id:
        supplyId,
    },
  };

}


async function getOverview() {

  const list =
    await ozonPost<
      OzonOrderListResponse
    >(
      "/v3/supply-order/list",
      {
        filter: {
          states:
            ORDER_STATES,
        },

        limit:
          50,

        sort_by:
          "ORDER_CREATION",

        sort_dir:
          "DESC",
      }
    );


  const orderIds =
    (
      list.order_ids
      ??
      []
    ).slice(
      0,
      50
    );


  if (
    orderIds.length ===
    0
  ) {

    return [];

  }


  const orders =
    await getOrders(
      orderIds
    );


  const supplyIds =
    Array.from(
      new Set(
        orders.flatMap(
          order =>
            (
              order.supplies
              ??
              []
            )
              .map(
                supply =>
                  Number(
                    supply.supply_id
                  )
              )
              .filter(
                id =>
                  Number.isFinite(
                    id
                  )
                  &&
                  id >
                    0
              )
        )
      )
    );


  let cargoMap =
    new Map<
      number,
      {
        boxCount:
          number;

        palletCount:
          number;

        cargoCount:
          number;
      }
    >();


  if (
    supplyIds.length >
      0
  ) {

    try {

      cargoMap =
        await getCargoMap(
          supplyIds
        );

    } catch (
      error
    ) {

      console.error(
        "Ozon cargo overview error:",
        error
      );

    }

  }


  return orders.flatMap(
    order => {

      const supplies =
        order.supplies
        ??
        [];


      if (
        supplies.length ===
        0
      ) {

        return [
          normalizeSummary(
            order,
            null,
            null
          ),
        ];

      }


      return supplies.map(
        supply =>
          normalizeSummary(
            order,
            supply,
            supply.supply_id
              ? cargoMap.get(
                  Number(
                    supply.supply_id
                  )
                )
                ??
                null
              : null
          )
      );

    }
  );

}


async function getBundleItems(
  bundleId:
    string
) {

  const items:
    OzonBundleItem[] =
    [];


  let lastId =
    "";


  for (
    let page = 0;
    page < 100;
    page++
  ) {

    const response =
      await ozonPost<
        OzonBundleResponse
      >(
        "/v1/supply-order/bundle",
        {
          bundle_ids: [
            bundleId,
          ],

          limit:
            100,

          is_asc:
            true,

          sort_field:
            "SKU",

          ...(
            lastId
              ? {
                  last_id:
                    lastId,
                }
              : {}
          ),
        }
      );


    items.push(
      ...(
        response.items
        ??
        []
      )
    );


    if (
      !response.has_next
    ) {

      break;

    }


    const next =
      response.last_id
      ??
      "";


    if (
      !next
      ||
      next ===
        lastId
    ) {

      break;

    }


    lastId =
      next;

  }


  return items;

}


async function getDetail(
  orderId:
    string,

  supplyId:
    string
) {

  const orders =
    await getOrders(
      [
        orderId,
      ]
    );


  const order =
    orders[
      0
    ];


  if (!order) {

    throw new Error(
      "Заявка Ozon не найдена"
    );

  }


  const supplies =
    order.supplies
    ??
    [];


  const supply =
    supplyId
      ? supplies.find(
          item =>
            String(
              item.supply_id
              ??
              ""
            ) ===
            supplyId
        )
        ??
        null
      : supplies[
          0
        ]
        ??
        null;


  const [
    bundleItems,
    cargoResponse,
  ] =
    await Promise.all([
      supply?.bundle_id
        ? getBundleItems(
            supply.bundle_id
          )
        : Promise.resolve(
            [] as OzonBundleItem[]
          ),

      supply?.supply_id
        ? ozonPost<
            OzonCargoResponse
          >(
            "/v1/cargoes/supplies/get",
            {
              supply_ids: [
                String(
                  supply.supply_id
                ),
              ],
            }
          )
        : Promise.resolve(
            {} as OzonCargoResponse
          ),
    ]);


  const cargoSupply =
    cargoResponse
      .supplies_cargoes
      ?.find(
        item =>
          String(
            item.supply_id
            ??
            ""
          ) ===
          String(
            supply?.supply_id
            ??
            ""
          )
      )
    ??
    null;


  const cargoPlaces:
    Array<{
      id:
        string;

      type:
        string;

      barcode:
        string
        |
        null;

      quantity:
        number
        |
        null;

      description:
        string
        |
        null;
    }> =
    [];


  for (
    const cargo
    of cargoSupply
      ?.cargoes_without_transport_cargoes
    ??
    []
  ) {

    cargoPlaces.push({
      id:
        String(
          cargo.cargo_id
          ??
          cargo.barcode
          ??
          "cargo"
        ),

      type:
        "Грузоместо",

      barcode:
        cargo.barcode
        ??
        null,

      quantity:
        null,

      description:
        "Отдельное грузоместо",
    });

  }


  for (
    const transport
    of cargoSupply
      ?.transport_cargoes
    ??
    []
  ) {

    cargoPlaces.push({
      id:
        String(
          transport.transport_cargo_id
          ??
          transport.bundle_id
          ??
          "pallet"
        ),

      type:
        transport.type ===
          "PALLET"
          ? "Транспортная паллета"
          : "Транспортное грузоместо",

      barcode:
        null,

      quantity:
        transport.cargoes
          ?.length
        ??
        0,

      description:
        `Внутри грузомест: ${transport.cargoes?.length ?? 0}`,
    });


    for (
      const cargo
      of transport.cargoes
      ??
      []
    ) {

      cargoPlaces.push({
        id:
          String(
            cargo.cargo_id
            ??
            cargo.barcode
            ??
            "cargo"
          ),

        type:
          "Грузоместо в паллете",

        barcode:
          cargo.barcode
          ??
          null,

        quantity:
          null,

        description:
          transport.transport_cargo_id
            ? `Паллета ${transport.transport_cargo_id}`
            : null,
      });

    }

  }


  const plannedUnits =
    bundleItems.reduce(
      (
        total,
        item
      ) =>
        total
        +
        Number(
          item.quantity
          ??
          0
        ),
      0
    );


  const summary = {
    ...normalizeSummary(
      order,
      supply,
      {
        boxCount:
          cargoPlaces.filter(
            cargo =>
              cargo.type.includes(
                "Грузоместо"
              )
          ).length,

        palletCount:
          cargoSupply
            ?.transport_cargoes
            ?.length
          ??
          0,

        cargoCount:
          cargoPlaces.length,
      }
    ),

    plannedUnits,
  };


  return {
    ok:
      true,

    summary,

    items:
      bundleItems.map(
        item => ({
          sku:
            item.sku !==
              undefined
              ? String(
                  item.sku
                )
              : null,

          offerId:
            item.offer_id
            ??
            null,

          name:
            item.name
            ??
            null,

          barcode:
            item.barcode
            ??
            null,

          plannedQuantity:
            Number(
              item.quantity
              ??
              0
            ),

          acceptedQuantity:
            null,
        })
      ),

    cargoPlaces,

    notes: [
      supply?.is_crossdock
        ? "Тип поставки: cross-dock."
        : "Тип поставки: прямая.",

      supply
        ?.storage_warehouse
        ?.arrival_date
        ? `Ожидаемое прибытие на склад размещения: ${supply.storage_warehouse.arrival_date}`
        : "",
    ].filter(
      Boolean
    ),
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


    const orderId =
      url.searchParams.get(
        "order_id"
      )
      ?.trim()
    ??
    "";


    if (orderId) {

      const supplyId =
        url.searchParams.get(
          "supply_id"
        )
        ?.trim()
      ??
      "";


      return Response.json(
        await getDetail(
          orderId,
          supplyId
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
          "ozon",

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
      "Ozon supplies read error:",
      error
    );


    return Response.json(
      {
        ok:
          false,

        marketplace:
          "ozon",

        updatedAt:
          new Date()
            .toISOString(),

        supplies:
          [],

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status:
          500,
      }
    );

  }

}
