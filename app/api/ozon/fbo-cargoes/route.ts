export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  120;


const OZON_API_BASE =
  "https://api-seller.ozon.ru";

const SUPABASE_PAGE_SIZE =
  1000;

const MAX_BOXES_PER_REQUEST =
  30;


type SupplyRequestRow = {
  id: string;
  calculation_run_id: string;
  cluster_name: string | null;
  status: string;
  ozon_order_id: string | number | null;
};

type ReplenishmentItemRow = {
  product_id: string;
  ozon_sku: string | number | null;
};

type ProductRow = {
  id: string;
  master_code: string | null;
  offer_id: string | null;
  units_per_carton: number | null;
};

type OzonOrder = {
  order_id?: string | number;
  order_number?: string;
  supplies?: Array<{
    supply_id?: string | number;
    bundle_id?: string;
    state?: string;
  }>;
};

type OzonOrderGetResponse = {
  orders?: OzonOrder[];
};

type BundleItem = {
  sku?: string | number;
  offer_id?: string;
  barcode?: string;
  quantity?: string | number;
  quant?: string | number;
};

type BundleResponse = {
  items?: BundleItem[];
  has_next?: boolean;
  last_id?: string;
};

type CargoCreateResponse = {
  operation_id?: string;
  errors?: {
    error_reasons?: string[];
    items_validation?: unknown[];
  };
};

type CargoCreateInfoResponse = {
  status?: string;
  errors?: {
    error_reasons?: string[];
    items_validation?: unknown[];
  };
  result?: {
    cargoes?: Array<{
      key?: string;
      value?: {
        cargo_id?: string | number;
      };
    }>;
  };
};

type CargoSuppliesResponse = {
  supplies_cargoes?: Array<{
    supply_id?: string | number;
    cargoes_without_transport_cargoes?: unknown[];
    transport_cargoes?: Array<{
      cargoes?: unknown[];
    }>;
  }>;
};

type CargoRulesResponse = {
  supply_check_lists?: unknown[];
};


function normalizeKey(
  value:
    unknown
) {

  return String(
    value
    ??
    ""
  ).trim();

}


function toPositiveInteger(
  value:
    unknown
):
number | null {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
    ||
    number <= 0
  ) {

    return null;

  }


  const integer =
    Math.floor(
      number
    );


  return Number.isSafeInteger(
    integer
  )
    ? integer
    : null;

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


function getConfig() {

  const ozonClientId =
    process.env
      .OZON_CLIENT_ID
      ?.trim();

  const ozonApiKey =
    process.env
      .OZON_API_KEY
      ?.trim();

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.replace(
        /\/$/,
        ""
      );

  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY
      ?.trim();


  if (
    !ozonClientId
    ||
    !ozonApiKey
    ||
    !supabaseUrl
    ||
    !supabaseSecretKey
  ) {

    throw new Error(
      "Не найдены настройки Ozon / Supabase"
    );

  }


  return {
    ozonClientId,
    ozonApiKey,
    supabaseUrl,
    supabaseSecretKey,
  };

}


async function supabaseGet<T>(
  path:
    string
):
Promise<T> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
      {
        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Supabase GET ${path}: HTTP ${response.status}: ${text}`
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


async function ozonPost<T>(
  path:
    string,

  body:
    unknown
):
Promise<T> {

  const {
    ozonClientId,
    ozonApiKey,
  } =
    getConfig();


  for (
    let attempt = 1;
    attempt <= 4;
    attempt++
  ) {

    const response =
      await fetch(
        `${OZON_API_BASE}${path}`,
        {
          method:
            "POST",

          headers: {
            "Client-Id":
              ozonClientId,

            "Api-Key":
              ozonApiKey,

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


    if (response.ok) {

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
        4
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
          ? Math.max(
              1200,
              Math.min(
                retryAfter
                *
                1000,
                10000
              )
            )
          : attempt
            *
            1500
      );


      continue;

    }


    throw new Error(
      `Ozon ${path}: HTTP ${response.status}: ${text}`
    );

  }


  throw new Error(
    `Ozon ${path}: исчерпаны попытки`
  );

}


async function getRequest(
  requestId:
    string
) {

  const rows =
    await supabaseGet<
      SupplyRequestRow[]
    >(
      [
        "ozon_fbo_supply_requests",
        "?select=id,calculation_run_id,cluster_name,status,ozon_order_id",
        `&id=eq.${encodeURIComponent(
          requestId
        )}`,
        "&limit=1",
      ].join(
        ""
      )
    );


  const row =
    rows[
      0
    ];


  if (!row) {

    throw new Error(
      "Заявка поставки не найдена"
    );

  }


  if (
    row.status !==
      "success"
  ) {

    throw new Error(
      "Грузоместа можно формировать только после успешного создания заявки Ozon"
    );

  }


  if (
    toPositiveInteger(
      row.ozon_order_id
    ) ===
      null
  ) {

    throw new Error(
      "У созданной заявки отсутствует order_id Ozon"
    );

  }


  return row;

}


async function getProducts() {

  const result:
    ProductRow[] =
    [];


  for (
    let offset = 0;
    offset < 10000;
    offset += SUPABASE_PAGE_SIZE
  ) {

    const page =
      await supabaseGet<
        ProductRow[]
      >(
        [
          "products",
          "?select=id,master_code,offer_id,units_per_carton",
          "&order=created_at.asc",
          `&limit=${SUPABASE_PAGE_SIZE}`,
          `&offset=${offset}`,
        ].join(
          ""
        )
      );


    result.push(
      ...page
    );


    if (
      page.length <
        SUPABASE_PAGE_SIZE
    ) {

      break;

    }

  }


  return result;

}


async function getCalculationItems(
  calculationRunId:
    string
) {

  const result:
    ReplenishmentItemRow[] =
    [];


  for (
    let offset = 0;
    offset < 20000;
    offset += SUPABASE_PAGE_SIZE
  ) {

    const page =
      await supabaseGet<
        ReplenishmentItemRow[]
      >(
        [
          "ozon_fbo_replenishment_items",
          "?select=product_id,ozon_sku",
          `&calculation_run_id=eq.${encodeURIComponent(
            calculationRunId
          )}`,
          `&limit=${SUPABASE_PAGE_SIZE}`,
          `&offset=${offset}`,
        ].join(
          ""
        )
      );


    result.push(
      ...page
    );


    if (
      page.length <
        SUPABASE_PAGE_SIZE
    ) {

      break;

    }

  }


  return result;

}


async function getOrder(
  orderId:
    number
) {

  const response =
    await ozonPost<
      OzonOrderGetResponse
    >(
      "/v3/supply-order/get",
      {
        order_ids: [
          String(
            orderId
          ),
        ],
      }
    );


  const order =
    response.orders
      ?.find(
        row =>
          Number(
            row.order_id
          ) ===
          orderId
      )
    ??
    response.orders
      ?.[0];


  if (!order) {

    throw new Error(
      `Ozon не вернул заявку order_id=${orderId}`
    );

  }


  return order;

}


async function getBundleItems(
  bundleId:
    string
) {

  const items:
    BundleItem[] =
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
        BundleResponse
      >(
        "/v1/supply-order/bundle",
        {
          bundle_ids: [
            bundleId,
          ],

          is_asc:
            true,

          limit:
            100,

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
      normalizeKey(
        response.last_id
      );


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


async function getExistingCargoCount(
  supplyId:
    number
) {

  const response =
    await ozonPost<
      CargoSuppliesResponse
    >(
      "/v1/cargoes/supplies/get",
      {
        supply_ids: [
          String(
            supplyId
          ),
        ],
      }
    );


  const row =
    response.supplies_cargoes
      ?.find(
        item =>
          Number(
            item.supply_id
          ) ===
          supplyId
      );


  if (!row) {

    return 0;

  }


  return (
    row
      .cargoes_without_transport_cargoes
      ?.length
    ??
    0
  )
  +
  (
    row.transport_cargoes
      ??
      []
  ).reduce(
    (
      sum,
      transport
    ) =>
      sum
      +
      (
        transport.cargoes
          ?.length
        ??
        0
      ),
    0
  );

}


function meaningfulReasons(
  values:
    string[]
    |
    undefined
) {

  return (
    values
    ??
    []
  ).filter(
    value =>
      value
      &&
      value !==
        "UNSPECIFIED"
      &&
      value !==
        "ERROR_REASON_UNSPECIFIED"
  );

}


async function waitCargoOperation(
  operationId:
    string
) {

  for (
    let attempt = 0;
    attempt < 40;
    attempt++
  ) {

    const response =
      await ozonPost<
        CargoCreateInfoResponse
      >(
        "/v2/cargoes/create/info",
        {
          operation_id:
            operationId,
        }
      );


    const status =
      normalizeKey(
        response.status
      );


    if (
      status ===
        "SUCCESS"
    ) {

      return response;

    }


    if (
      status ===
        "FAILED"
    ) {

      throw new Error(
        `Ozon не создал грузоместа: ${JSON.stringify(
          response.errors
          ??
          {}
        )}`
      );

    }


    await sleep(
      1500
    );

  }


  throw new Error(
    `Ozon не завершил создание грузомест operation_id=${operationId} за отведённое время`
  );

}


async function buildPlan(
  request:
    SupplyRequestRow
) {

  const orderId =
    toPositiveInteger(
      request.ozon_order_id
    ) as number;


  const [
    order,
    products,
    calculationItems,
  ] =
    await Promise.all([
      getOrder(
        orderId
      ),

      getProducts(),

      getCalculationItems(
        request.calculation_run_id
      ),
    ]);


  const supplies =
    (
      order.supplies
      ??
      []
    )
      .map(
        supply => ({
          supply_id:
            toPositiveInteger(
              supply.supply_id
            ),

          bundle_id:
            normalizeKey(
              supply.bundle_id
            ),

          state:
            normalizeKey(
              supply.state
            ),
        })
      )
      .filter(
        (
          supply
        ): supply is {
          supply_id:
            number;

          bundle_id:
            string;

          state:
            string;
        } =>
          supply.supply_id !==
            null
          &&
          Boolean(
            supply.bundle_id
          )
      );


  if (
    supplies.length ===
      0
  ) {

    throw new Error(
      "Ozon не вернул supply_id / bundle_id для созданной заявки"
    );

  }


  const productById =
    new Map(
      products.map(
        product => [
          product.id,
          product,
        ]
      )
    );


  const packValuesByMaster =
    new Map<
      string,
      Set<number>
    >();


  for (
    const product
    of products
  ) {

    const master =
      normalizeKey(
        product.master_code
      );

    const pack =
      toPositiveInteger(
        product.units_per_carton
      );


    if (
      !master
      ||
      pack ===
        null
    ) {

      continue;

    }


    let values =
      packValuesByMaster.get(
        master
      );


    if (!values) {

      values =
        new Set<number>();

      packValuesByMaster.set(
        master,
        values
      );

    }


    values.add(
      pack
    );

  }


  const productBySku =
    new Map<
      number,
      ProductRow
    >();


  for (
    const item
    of calculationItems
  ) {

    const sku =
      toPositiveInteger(
        item.ozon_sku
      );


    const product =
      productById.get(
        item.product_id
      );


    if (
      sku !==
        null
      &&
      product
    ) {

      productBySku.set(
        sku,
        product
      );

    }

  }


  const supplyPlans:
    Array<{
      supply_id:
        number;

      bundle_id:
        string;

      state:
        string;

      existing_cargoes:
        number;

      box_count:
        number;

      unit_count:
        number;

      boxes:
        Array<{
          key:
            string;

          sku:
            number;

          offer_id:
            string;

          barcode:
            string | null;

          quantity:
            number;

          quant:
            number;
        }>;

      items:
        Array<{
          sku:
            number;

          offer_id:
            string;

          quantity:
            number;

          units_per_carton:
            number;

          boxes:
            number;
        }>;

      blockers:
        string[];
    }> =
    [];


  for (
    const supply
    of supplies
  ) {

    const [
      bundleItems,
      existingCargoes,
    ] =
      await Promise.all([
        getBundleItems(
          supply.bundle_id
        ),

        getExistingCargoCount(
          supply.supply_id
        ),
      ]);


    const boxes:
      Array<{
        key:
          string;

        sku:
          number;

        offer_id:
          string;

        barcode:
          string | null;

        quantity:
          number;

        quant:
          number;
      }> =
      [];

    const itemRows:
      Array<{
        sku:
          number;

        offer_id:
          string;

        quantity:
          number;

        units_per_carton:
          number;

        boxes:
          number;
      }> =
      [];

    const blockers:
      string[] =
      [];


    for (
      const item
      of bundleItems
    ) {

      const sku =
        toPositiveInteger(
          item.sku
        );

      const quantity =
        toPositiveInteger(
          item.quantity
        );


      if (
        sku ===
          null
        ||
        quantity ===
          null
      ) {

        continue;

      }


      const product =
        productBySku.get(
          sku
        );


      if (!product) {

        blockers.push(
          `SKU ${sku}: не найден товар из расчёта потребности`
        );

        continue;

      }


      const master =
        normalizeKey(
          product.master_code
        );


      const packValues =
        master
          ? packValuesByMaster.get(
              master
            )
          : undefined;


      if (
        !packValues
        ||
        packValues.size ===
          0
      ) {

        blockers.push(
          `SKU ${sku}: нет вложимости транспортного короба`
        );

        continue;

      }


      if (
        packValues.size >
          1
      ) {

        blockers.push(
          `SKU ${sku}: конфликт вложимости по master_code ${master}`
        );

        continue;

      }


      const pack =
        Array.from(
          packValues
        )[
          0
        ];


      if (
        quantity %
        pack !==
          0
      ) {

        blockers.push(
          `SKU ${sku}: Ozon распределил ${quantity} шт., вложимость ${pack}; остаток ${quantity % pack} шт.`
        );

        continue;

      }


      const offerId =
        normalizeKey(
          item.offer_id
        )
        ||
        normalizeKey(
          product.offer_id
        );


      if (!offerId) {

        blockers.push(
          `SKU ${sku}: отсутствует offer_id`
        );

        continue;

      }


      const boxCount =
        quantity
        /
        pack;

      const quant =
        toPositiveInteger(
          item.quant
        )
        ??
        1;

      const barcode =
        normalizeKey(
          item.barcode
        )
        ||
        null;


      itemRows.push({
        sku,

        offer_id:
          offerId,

        quantity,

        units_per_carton:
          pack,

        boxes:
          boxCount,
      });


      for (
        let boxIndex = 1;
        boxIndex <= boxCount;
        boxIndex++
      ) {

        boxes.push({
          key:
            [
              "fbo",
              orderId,
              supply.supply_id,
              sku,
              boxIndex,
            ].join(
              "-"
            ),

          sku,

          offer_id:
            offerId,

          barcode,

          quantity:
            pack,

          quant,
        });

      }

    }


    supplyPlans.push({
      supply_id:
        supply.supply_id,

      bundle_id:
        supply.bundle_id,

      state:
        supply.state,

      existing_cargoes:
        existingCargoes,

      box_count:
        boxes.length,

      unit_count:
        itemRows.reduce(
          (
            sum,
            item
          ) =>
            sum
            +
            item.quantity,
          0
        ),

      boxes,

      items:
        itemRows,

      blockers,
    });

  }


  return {
    ok:
      true,

    request_id:
      request.id,

    cluster_name:
      request.cluster_name,

    order_id:
      orderId,

    order_number:
      normalizeKey(
        order.order_number
      )
      ||
      null,

    supply_count:
      supplyPlans.length,

    total_boxes:
      supplyPlans.reduce(
        (
          sum,
          supply
        ) =>
          sum
          +
          supply.box_count,
        0
      ),

    blockers:
      supplyPlans.flatMap(
        supply =>
          supply.blockers
      ),

    supplies:
      supplyPlans,
  };

}


async function createCargoes(
  plan:
    Awaited<
      ReturnType<
        typeof buildPlan
      >
    >,

  replaceExisting:
    boolean
) {

  if (
    plan.blockers.length >
      0
  ) {

    throw new Error(
      `Нельзя создать грузоместа: ${plan.blockers.join(
        " | "
      )}`
    );

  }


  const created:
    Array<{
      supply_id:
        number;

      cargo_ids:
        number[];

      operations:
        string[];

      rules:
        unknown;
    }> =
    [];


  for (
    const supply
    of plan.supplies
  ) {

    if (
      supply.existing_cargoes >
        0
      &&
      !replaceExisting
    ) {

      throw new Error(
        `Поставка ${supply.supply_id}: уже есть грузоместа (${supply.existing_cargoes}). Для перезаписи требуется явное подтверждение.`
      );

    }


    const batches =
      chunks(
        supply.boxes,
        MAX_BOXES_PER_REQUEST
      );


    const cargoIds:
      number[] =
      [];

    const operations:
      string[] =
      [];


    for (
      let batchIndex = 0;
      batchIndex < batches.length;
      batchIndex++
    ) {

      const batch =
        batches[
          batchIndex
        ];


      const response =
        await ozonPost<
          CargoCreateResponse
        >(
          "/v1/cargoes/create",
          {
            supply_id:
              supply.supply_id,

            delete_current_version:
              batchIndex ===
                0,

            cargoes:
              batch.map(
                box => ({
                  key:
                    box.key,

                  value: {
                    type:
                      "BOX",

                    items: [
                      {
                        offer_id:
                          box.offer_id,

                        quantity:
                          box.quantity,

                        quant:
                          box.quant,

                        ...(
                          box.barcode
                            ? {
                                barcode:
                                  box.barcode,
                              }
                            : {}
                        ),
                      },
                    ],
                  },
                })
              ),
          }
        );


      const reasons =
        meaningfulReasons(
          response.errors
            ?.error_reasons
        );


      if (
        reasons.length >
          0
        ||
        (
          response.errors
            ?.items_validation
            ?.length
          ??
          0
        ) >
          0
      ) {

        throw new Error(
          `Поставка ${supply.supply_id}: Ozon отклонил грузоместа: ${JSON.stringify(
            response.errors
          )}`
        );

      }


      const operationId =
        normalizeKey(
          response.operation_id
        );


      if (!operationId) {

        throw new Error(
          `Поставка ${supply.supply_id}: Ozon не вернул operation_id`
        );

      }


      operations.push(
        operationId
      );


      const info =
        await waitCargoOperation(
          operationId
        );


      for (
        const cargo
        of info.result
          ?.cargoes
        ??
        []
      ) {

        const cargoId =
          toPositiveInteger(
            cargo.value
              ?.cargo_id
          );


        if (
          cargoId !==
            null
        ) {

          cargoIds.push(
            cargoId
          );

        }

      }

    }


    const rules =
      await ozonPost<
        CargoRulesResponse
      >(
        "/v1/cargoes/rules/get",
        {
          supply_ids: [
            String(
              supply.supply_id
            ),
          ],
        }
      );


    created.push({
      supply_id:
        supply.supply_id,

      cargo_ids:
        cargoIds,

      operations,

      rules:
        rules.supply_check_lists
        ??
        [],
    });

  }


  return {
    ...plan,

    created:
      true,

    created_supplies:
      created,

    created_boxes:
      created.reduce(
        (
          sum,
          supply
        ) =>
          sum
          +
          supply.cargo_ids.length,
        0
      ),
  };

}


export async function POST(
  request:
    Request
) {

  try {

    const body =
      await request.json() as {
        action?:
          string;

        request_id?:
          string;

        replace_existing?:
          boolean;
      };


    const action =
      normalizeKey(
        body.action
      );

    const requestId =
      normalizeKey(
        body.request_id
      );


    if (!requestId) {

      return Response.json(
        {
          ok:
            false,

          error:
            "Не передан request_id",
        },
        {
          status:
            400,
        }
      );

    }


    const supplyRequest =
      await getRequest(
        requestId
      );


    const plan =
      await buildPlan(
        supplyRequest
      );


    if (
      action ===
        "preview"
    ) {

      return Response.json(
        plan
      );

    }


    if (
      action ===
        "create"
    ) {

      return Response.json(
        await createCargoes(
          plan,
          body.replace_existing ===
            true
        )
      );

    }


    return Response.json(
      {
        ok:
          false,

        error:
          "Неизвестное действие",
      },
      {
        status:
          400,
      }
    );

  } catch (
    error
  ) {

    return Response.json(
      {
        ok:
          false,

        error:
          error instanceof
            Error
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
