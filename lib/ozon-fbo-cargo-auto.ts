const OZON_API_BASE =
  "https://api-seller.ozon.ru";

const SUPABASE_PAGE_SIZE =
  1000;

const MAX_BOXES_PER_REQUEST =
  30;


type ProductRow = {
  id: string;
  master_code: string | null;
  offer_id: string | null;
  units_per_carton: number | null;
};

type ReplenishmentItemRow = {
  product_id: string;
  ozon_sku: string | number | null;
};

type OzonOrder = {
  order_id?: string | number;
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

type CargoSuppliesResponse = {
  supplies_cargoes?: Array<{
    supply_id?: string | number;
    cargoes_without_transport_cargoes?: unknown[];
    transport_cargoes?: Array<{
      cargoes?: unknown[];
    }>;
  }>;
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


  return order
  ??
  null;

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
    attempt < 24;
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
      1250
    );

  }


  throw new Error(
    `Ozon не завершил создание грузомест operation_id=${operationId}`
  );

}


async function buildBoxPlan(
  calculationRunId:
    string,

  orderId:
    number
) {

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
        calculationRunId
      ),
    ]);


  if (!order) {

    return {
      ready:
        false as const,

      reason:
        "Ozon пока не вернул созданную заявку через /v3/supply-order/get",
    };

  }


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

    return {
      ready:
        false as const,

      reason:
        "Ozon пока не вернул supply_id / bundle_id для созданной заявки",
    };

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

      state:
        string;

      boxes:
        Array<{
          key:
            string;

          offer_id:
            string;

          barcode:
            string | null;

          quantity:
            number;

          quant:
            number;
        }>;

      expected_boxes:
        number;
    }> =
    [];


  for (
    const supply
    of supplies
  ) {

    const bundleItems =
      await getBundleItems(
        supply.bundle_id
      );


    const boxes:
      Array<{
        key:
          string;

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

        throw new Error(
          `SKU ${sku}: не найден товар из расчёта потребности`
        );

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

        throw new Error(
          `SKU ${sku}: нет вложимости транспортного короба`
        );

      }


      if (
        packValues.size >
          1
      ) {

        throw new Error(
          `SKU ${sku}: конфликт вложимости по master_code ${master}`
        );

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

        throw new Error(
          `SKU ${sku}: Ozon распределил ${quantity} шт., вложимость ${pack}; остаток ${quantity % pack} шт. Грузоместа автоматически не создаём.`
        );

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

        throw new Error(
          `SKU ${sku}: отсутствует offer_id`
        );

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


      for (
        let boxIndex = 1;
        boxIndex <= boxCount;
        boxIndex++
      ) {

        boxes.push({
          key:
            [
              "auto-fbo",
              orderId,
              supply.supply_id,
              sku,
              boxIndex,
            ].join(
              "-"
            ),

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

      state:
        supply.state,

      boxes,

      expected_boxes:
        boxes.length,
    });

  }


  return {
    ready:
      true as const,

    supplies:
      supplyPlans,

    expected_boxes:
      supplyPlans.reduce(
        (
          sum,
          supply
        ) =>
          sum
          +
          supply.expected_boxes,
        0
      ),
  };

}


export async function createNextAutomaticCargoBatch({
  calculationRunId,
  orderId,
  continueExisting,
}: {
  calculationRunId:
    string;

  orderId:
    number;

  continueExisting:
    boolean;
}) {

  const plan =
    await buildBoxPlan(
      calculationRunId,
      orderId
    );


  if (!plan.ready) {

    return {
      done:
        false,

      pending:
        true,

      created_boxes:
        0,

      expected_boxes:
        0,

      message:
        plan.reason,
    };

  }


  let totalExisting =
    0;


  for (
    const supply
    of plan.supplies
  ) {

    const existing =
      await getExistingCargoCount(
        supply.supply_id
      );


    totalExisting +=
      existing;


    if (
      existing >
        supply.expected_boxes
    ) {

      throw new Error(
        `Поставка ${supply.supply_id}: в Ozon уже ${existing} грузомест, а по расчёту должно быть ${supply.expected_boxes}. Автоматически не меняем.`
      );

    }


    if (
      existing ===
        supply.expected_boxes
    ) {

      continue;

    }


    if (
      existing >
        0
      &&
      !continueExisting
    ) {

      throw new Error(
        `Поставка ${supply.supply_id}: уже есть ${existing} грузомест из ${supply.expected_boxes}. Это не подтверждённый автопрогресс, поэтому существующие грузоместа не трогаем.`
      );

    }


    const batch =
      supply.boxes.slice(
        existing,
        existing
        +
        MAX_BOXES_PER_REQUEST
      );


    if (
      batch.length ===
        0
    ) {

      continue;

    }


    const response =
      await ozonPost<
        CargoCreateResponse
      >(
        "/v1/cargoes/create",
        {
          supply_id:
            supply.supply_id,

          delete_current_version:
            existing ===
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
        `Поставка ${supply.supply_id}: Ozon не вернул operation_id создания грузомест`
      );

    }


    await waitCargoOperation(
      operationId
    );


    const createdNow =
      existing
      +
      batch.length;

    const overallCreated =
      totalExisting
      +
      batch.length;


    return {
      done:
        overallCreated >=
          plan.expected_boxes,

      pending:
        false,

      created_boxes:
        overallCreated,

      expected_boxes:
        plan.expected_boxes,

      message:
        `AUTO_GM: создано ${overallCreated}/${plan.expected_boxes} коробов. Поставка ${supply.supply_id}: ${createdNow}/${supply.expected_boxes}.`,
    };

  }


  return {
    done:
      true,

    pending:
      false,

    created_boxes:
      totalExisting,

    expected_boxes:
      plan.expected_boxes,

    message:
      `AUTO_GM: создано ${totalExisting}/${plan.expected_boxes} коробов.`,
  };

}
