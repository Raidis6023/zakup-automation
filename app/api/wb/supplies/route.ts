export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  120;


const WB_BASE =
  "https://supplies-api.wildberries.ru";


type WbSupplyListRow = {
  supplyID?:
    number
    |
    null;

  preorderID?:
    number
    |
    null;

  createDate?:
    string
    |
    null;

  supplyDate?:
    string
    |
    null;

  factDate?:
    string
    |
    null;

  updatedDate?:
    string
    |
    null;

  statusID?:
    number
    |
    null;

  boxTypeID?:
    number
    |
    null;

  quantity?:
    number
    |
    null;

  acceptedQuantity?:
    number
    |
    null;
};


type WbSupplyDetail = {
  statusID?:
    number;

  boxTypeID?:
    number;

  createDate?:
    string;

  supplyDate?:
    string
    |
    null;

  factDate?:
    string
    |
    null;

  updatedDate?:
    string
    |
    null;

  warehouseID?:
    number;

  warehouseName?:
    string;

  actualWarehouseID?:
    number
    |
    null;

  actualWarehouseName?:
    string;

  transitWarehouseID?:
    number
    |
    null;

  transitWarehouseName?:
    string;

  quantity?:
    number;

  acceptedQuantity?:
    number;

  readyForSaleQuantity?:
    number;

  unloadingQuantity?:
    number;

  rejectReason?:
    string
    |
    null;

  isBoxOnPallet?:
    boolean;
};


type WbGood = {
  barcode?:
    string;

  vendorCode?:
    string;

  nmID?:
    number;

  techSize?:
    string;

  color?:
    string
    |
    null;

  supplierBoxAmount?:
    number
    |
    null;

  quantity?:
    number;

  readyForSaleQuantity?:
    number
    |
    null;

  acceptedQuantity?:
    number
    |
    null;

  unloadingQuantity?:
    number
    |
    null;
};


type WbBox = {
  packageCode?:
    string;

  quantity?:
    number;

  barcodes?: Array<{
    barcode?:
      string;

    quantity?:
      number;
  }>;
};


function getToken() {

  const token =
    process.env
      .WB_READ_TOKEN
      ?.trim();


  if (!token) {

    throw new Error(
      "Не найден WB_READ_TOKEN"
    );

  }


  return token;

}


async function wbRequest<T>(
  path:
    string,

  init:
    RequestInit
):
Promise<T> {

  const response =
    await fetch(
      `${WB_BASE}${path}`,
      {
        ...init,

        headers: {
          Authorization:
            getToken(),

          Accept:
            "application/json",

          ...(
            init.headers
            ??
            {}
          ),
        },

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Wildberries ${path}: HTTP ${response.status}: ${text}`
    );

  }


  return (
    text
      ? JSON.parse(
          text
        ) as T
      : [] as T
  );

}


function statusLabel(
  status:
    number
    |
    null
    |
    undefined
) {

  const labels:
    Record<
      number,
      string
    > =
    {
      1:
        "Не запланировано",

      2:
        "Запланировано",

      3:
        "Отгрузка разрешена",

      4:
        "Идёт приёмка",

      5:
        "Принято",

      6:
        "Отгружено на воротах",
    };


  return status
    ? labels[
        status
      ]
      ??
      `Статус ${status}`
    : "Неизвестно";

}


function isTerminal(
  status:
    number
    |
    null
    |
    undefined
) {

  return [
    5,
    6,
  ].includes(
    Number(
      status
    )
  );

}


function boxTypeLabel(
  boxType:
    number
    |
    null
    |
    undefined
) {

  if (
    boxType ===
    5
  ) {

    return "Монопаллеты";

  }


  if (
    boxType ===
    6
  ) {

    return "Суперсейф";

  }


  if (
    boxType ===
      1
    ||
    boxType ===
      2
  ) {

    return "Короба";

  }


  if (
    boxType ===
    0
  ) {

    return "Без коробов";

  }


  return "Поставка";

}


function normalizeSummary(
  row:
    WbSupplyListRow,

  detail?:
    WbSupplyDetail
) {

  const actualId =
    row.supplyID
    ??
    null;

  const preorderId =
    row.preorderID
    ??
    null;

  const id =
    actualId
    ??
    preorderId;


  const status =
    detail?.statusID
    ??
    row.statusID
    ??
    null;

  const boxType =
    detail?.boxTypeID
    ??
    row.boxTypeID
    ??
    null;


  return {
    key:
      `wb:${actualId ?? "pre"}:${preorderId ?? id ?? "unknown"}`,

    id:
      String(
        id
        ??
        ""
      ),

    number:
      actualId
        ? `WB поставка № ${actualId}`
        : preorderId
          ? `WB заказ № ${preorderId}`
          : "WB поставка",

    secondaryNumber:
      actualId
      &&
      preorderId
        ? `Заказ ${preorderId}`
        : null,

    status:
      String(
        status
        ??
        ""
      ),

    statusLabel:
      statusLabel(
        status
      ),

    isTerminal:
      isTerminal(
        status
      ),

    createdAt:
      detail?.createDate
      ??
      row.createDate
      ??
      null,

    updatedAt:
      detail?.updatedDate
      ??
      row.updatedDate
      ??
      null,

    timeslotFrom:
      detail?.supplyDate
      ??
      row.supplyDate
      ??
      null,

    timeslotTo:
      null,

    destinationName:
      detail?.warehouseName
      ??
      null,

    destinationAddress:
      null,

    transitName:
      detail?.transitWarehouseName
      ??
      null,

    dropoffName:
      detail?.actualWarehouseName
      ??
      null,

    plannedUnits:
      detail?.quantity
      ??
      row.quantity
      ??
      null,

    acceptedUnits:
      detail?.acceptedQuantity
      ??
      row.acceptedQuantity
      ??
      null,

    boxCount:
      null,

    palletCount:
      boxType ===
        5
        ? null
        : null,

    cargoCount:
      null,

    supplyType:
      boxTypeLabel(
        boxType
      ),

    detail: {
      id:
        String(
          id
          ??
          ""
        ),

      preorder:
        actualId
          ? "0"
          : "1",
    },
  };

}


async function getOverview() {

  const rows =
    await wbRequest<
      WbSupplyListRow[]
    >(
      "/api/v1/supplies?limit=50&offset=0",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            {}
          ),
      }
    );


  return (
    Array.isArray(
      rows
    )
      ? rows
      : []
  ).map(
    row =>
      normalizeSummary(
        row
      )
  );

}


async function getGoods(
  id:
    string,

  preorder:
    boolean
) {

  const goods:
    WbGood[] =
    [];


  for (
    let offset = 0;
    offset < 100000;
    offset += 1000
  ) {

    const page =
      await wbRequest<
        WbGood[]
      >(
        `/api/v1/supplies/${encodeURIComponent(
          id
        )}/goods?limit=1000&offset=${offset}&isPreorderID=${preorder ? "true" : "false"}`,
        {
          method:
            "GET",
        }
      );


    goods.push(
      ...(
        Array.isArray(
          page
        )
          ? page
          : []
      )
    );


    if (
      !Array.isArray(
        page
      )
      ||
      page.length <
        1000
    ) {

      break;

    }

  }


  return goods;

}


async function getDetail(
  id:
    string,

  preorder:
    boolean
) {

  const [
    detail,
    goods,
  ] =
    await Promise.all([
      wbRequest<
        WbSupplyDetail
      >(
        `/api/v1/supplies/${encodeURIComponent(
          id
        )}?isPreorderID=${preorder ? "true" : "false"}`,
        {
          method:
            "GET",
        }
      ),

      getGoods(
        id,
        preorder
      ),
    ]);


  let boxes:
    WbBox[] =
    [];

  let packageNote =
    "";


  if (!preorder) {

    try {

      boxes =
        await wbRequest<
          WbBox[]
        >(
          `/api/v1/supplies/${encodeURIComponent(
            id
          )}/package`,
          {
            method:
              "GET",
          }
        );

    } catch (
      error
    ) {

      packageNote =
        error instanceof Error
          ? `Упаковка пока недоступна: ${error.message}`
          : "Упаковка пока недоступна.";

    }

  }


  const fakeRow:
    WbSupplyListRow =
    {
      supplyID:
        preorder
          ? null
          : Number(
              id
            ),

      preorderID:
        preorder
          ? Number(
              id
            )
          : null,

      statusID:
        detail.statusID
        ??
        null,

      boxTypeID:
        detail.boxTypeID
        ??
        null,

      createDate:
        detail.createDate
        ??
        null,

      supplyDate:
        detail.supplyDate
        ??
        null,

      factDate:
        detail.factDate
        ??
        null,

      updatedDate:
        detail.updatedDate
        ??
        null,

      quantity:
        detail.quantity
        ??
        null,

      acceptedQuantity:
        detail.acceptedQuantity
        ??
        null,
    };


  const summary =
    normalizeSummary(
      fakeRow,
      detail
    );


  summary.boxCount =
    boxes.length >
      0
      ? boxes.length
      : null;

  summary.palletCount =
    detail.boxTypeID ===
      5
      ? boxes.length >
          0
          ? boxes.length
          : null
      : null;

  summary.cargoCount =
    boxes.length >
      0
      ? boxes.length
      : null;


  return {
    ok:
      true,

    summary,

    items:
      goods.map(
        good => ({
          sku:
            good.nmID !==
              undefined
              ? String(
                  good.nmID
                )
              : null,

          offerId:
            good.vendorCode
            ??
            null,

          name:
            [
              good.color,
              good.techSize,
            ]
              .filter(
                Boolean
              )
              .join(
                " · "
              )
            ||
            null,

          barcode:
            good.barcode
            ??
            null,

          plannedQuantity:
            Number(
              good.quantity
              ??
              0
            ),

          acceptedQuantity:
            good.acceptedQuantity
            ??
            null,
        })
      ),

    cargoPlaces:
      boxes.map(
        (
          box,
          index
        ) => ({
          id:
            box.packageCode
            ??
            `box-${index + 1}`,

          type:
            detail.boxTypeID ===
              5
              ? "Паллета"
              : "Короб",

          barcode:
            box.packageCode
            ??
            null,

          quantity:
            box.quantity
            ??
            null,

          description:
            box.barcodes
              ?.length
              ? `Позиций внутри: ${box.barcodes.length}`
              : null,

          items:
            (
              box.barcodes
              ??
              []
            ).map(
              item => ({
                barcode:
                  item.barcode
                  ??
                  "",

                quantity:
                  Number(
                    item.quantity
                    ??
                    0
                  ),
              })
            ),
        })
      ),

    notes: [
      detail.factDate
        ? `Фактическая дата: ${detail.factDate}`
        : "",

      detail.rejectReason
        ? `Причина ограничения: ${detail.rejectReason}`
        : "",

      preorder
        ? "Это ещё заказ на поставку: отдельные упаковки WB может не возвращать до формирования supplyID."
        : "",

      packageNote,
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


    const id =
      url.searchParams.get(
        "id"
      )
      ?.trim()
    ??
    "";


    if (id) {

      const preorder =
        url.searchParams.get(
          "preorder"
        ) ===
        "1";


      return Response.json(
        await getDetail(
          id,
          preorder
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
          "wildberries",

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
      "WB supplies read error:",
      error
    );


    return Response.json(
      {
        ok:
          false,

        marketplace:
          "wildberries",

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
