import { getOzonCredentials } from "@/lib/integrations/secrets";
export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;


// ============================================================
// ТИПЫ
// ============================================================

type SellerWarehouse = {
  seller_warehouse_id?:
    string
    | number;

  seller_warehouse_name?:
    string;

  is_active?:
    boolean;

  is_pickup?:
    boolean;

  courier_comment?:
    string;

  address?: {
    address?:
      string;

    city?:
      string;

    region?:
      string;

    country_code?:
      string;

    timezone?:
      string;

    macrolocal_cluster_id?:
      string
      | number;

    coordinates?: {
      latitude?:
        number;

      longitude?:
        number;
    };
  } | null;

  working_days?:
    unknown[];

  [key: string]:
    unknown;
};


type SellerWarehouseResponse = {
  warehouses?:
    SellerWarehouse[];
};


type DropOffWarehouse = {
  warehouse_id?:
    string
    | number;

  warehouse_type?:
    string;

  name?:
    string;

  address?:
    string;

  coordinates?: {
    latitude?:
      number;

    longitude?:
      number;
  };

  [key: string]:
    unknown;
};


type DropOffResponse = {
  search?:
    DropOffWarehouse[];
};


// ============================================================
// CONFIG
// ============================================================

async function getConfig() {
  const { sellerClientId: ozonClientId, sellerApiKey: ozonApiKey } = await getOzonCredentials();
  if (!ozonClientId || !ozonApiKey) throw new Error("Укажите ключи Ozon Seller в администрировании ПАНДЫ");
  return { ozonClientId, ozonApiKey };
}


// ============================================================
// HELPERS
// ============================================================

function normalizeText(
  value:
    unknown
): string {

  return String(
    value
    ??
    ""
  ).trim();

}


// ============================================================
// OZON POST
// ============================================================

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
    await getConfig();


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => {

        controller.abort();

      },
      30000
    );


  try {

    const response =
      await fetch(
        `https://api-seller.ozon.ru${path}`,
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

          signal:
            controller.signal,
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      throw new Error(
        `Ozon ${path}: HTTP ${response.status}: ${text}`
      );

    }


    if (!text) {

      return {} as T;

    }


    return JSON.parse(
      text
    ) as T;

  } finally {

    clearTimeout(
      timeout
    );

  }

}


// ============================================================
// СКЛАДЫ ПРОДАВЦА
// ============================================================

async function getSellerWarehouses():
Promise<
  SellerWarehouse[]
> {

  const response =
    await ozonPost<
      SellerWarehouseResponse
    >(
      "/v1/warehouse/fbo/seller/list",
      {}
    );


  return (
    response.warehouses
    ??
    []
  );

}


// ============================================================
// ТОЧКИ CROSS-DOCK
// ============================================================

async function searchDropOffWarehouses(
  search:
    string
):
Promise<
  DropOffWarehouse[]
> {

  const response =
    await ozonPost<
      DropOffResponse
    >(
      "/v1/warehouse/fbo/list",
      {
        filter_by_supply_type: [
          "CREATE_TYPE_CROSSDOCK",
        ],

        search,
      }
    );


  return (
    response.search
    ??
    []
  );

}


// ============================================================
// GET
// ============================================================

export async function GET(
  request:
    Request
) {

  const startedAt =
    Date.now();


  try {

    const url =
      new URL(
        request.url
      );


    const search =
      normalizeText(
        url.searchParams.get(
          "search"
        )
      );


    // ========================================================
    // 1. НАШИ СКЛАДЫ
    // ========================================================

    const sellerWarehouses =
      await getSellerWarehouses();


    const activeSellerWarehouses =
      sellerWarehouses.filter(
        warehouse =>
          warehouse.is_active ===
          true
      );


    // ========================================================
    // 2. ЕСЛИ ПОИСК ЕЩЁ НЕ ЗАДАН
    //
    // Показываем склады продавца.
    // В Ozon за точками cross-dock пока не идём.
    // ========================================================

    if (!search) {

      return Response.json(
        {
          ok:
            true,

          mode:
            "read_only_dropoff_options",

          writes_to_ozon:
            false,

          writes_to_database:
            false,


          search: {
            supplied:
              false,

            value:
              null,

            requirement:
              "Для поиска точки cross-dock укажите ?search=... минимум из 4 символов.",
          },


          seller_warehouses: {
            received:
              sellerWarehouses.length,

            active:
              activeSellerWarehouses.length,

            warehouses:
              activeSellerWarehouses.map(
                warehouse => ({
                  seller_warehouse_id:
                    warehouse
                      .seller_warehouse_id
                    ??
                    null,

                  seller_warehouse_name:
                    warehouse
                      .seller_warehouse_name
                    ??
                    null,

                  is_active:
                    warehouse
                      .is_active
                    ??
                    null,

                  is_pickup:
                    warehouse
                      .is_pickup
                    ??
                    null,

                  address:
                    warehouse
                      .address
                      ?.address
                    ??
                    null,

                  region:
                    warehouse
                      .address
                      ?.region
                    ??
                    null,

                  country_code:
                    warehouse
                      .address
                      ?.country_code
                    ??
                    null,

                  timezone:
                    warehouse
                      .address
                      ?.timezone
                    ??
                    null,

                  macrolocal_cluster_id:
                    warehouse
                      .address
                      ?.macrolocal_cluster_id
                    ??
                    null,

                  coordinates:
                    warehouse
                      .address
                      ?.coordinates
                    ??
                    null,

                  courier_comment:
                    warehouse
                      .courier_comment
                    ??
                    null,
                })
              ),
          },


          drop_off_points: {
            searched:
              false,

            count:
              0,

            points:
              [],
          },


          next_step:
            "Выбрать склад продавца, затем выполнить этот endpoint с параметром search для города или названия подходящей точки отгрузки.",


          duration_ms:
            Date.now()
            -
            startedAt,
        },
        {
          status:
            200,
        }
      );

    }


    // ========================================================
    // 3. OZON ТРЕБУЕТ МИНИМУМ 4 СИМВОЛА
    // ========================================================

    if (
      search.length <
      4
    ) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "read_only_dropoff_options",

          writes_to_ozon:
            false,

          writes_to_database:
            false,

          error:
            "Строка поиска должна содержать минимум 4 символа.",

          search,
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 4. ИЩЕМ ТОЧКИ CROSS-DOCK
    // ========================================================

    const dropOffPoints =
      await searchDropOffWarehouses(
        search
      );


    // ========================================================
    // 5. RESPONSE
    // ========================================================

    return Response.json(
      {
        ok:
          true,

        mode:
          "read_only_dropoff_options",

        writes_to_ozon:
          false,

        writes_to_database:
          false,


        search: {
          supplied:
            true,

          value:
            search,

          supply_type:
            "CREATE_TYPE_CROSSDOCK",
        },


        seller_warehouses: {
          received:
            sellerWarehouses.length,

          active:
            activeSellerWarehouses.length,

          warehouses:
            activeSellerWarehouses.map(
              warehouse => ({
                seller_warehouse_id:
                  warehouse
                    .seller_warehouse_id
                  ??
                  null,

                seller_warehouse_name:
                  warehouse
                    .seller_warehouse_name
                  ??
                  null,

                is_active:
                  warehouse
                    .is_active
                  ??
                  null,

                is_pickup:
                  warehouse
                    .is_pickup
                  ??
                  null,

                address:
                  warehouse
                    .address
                    ?.address
                  ??
                  null,

                region:
                  warehouse
                    .address
                    ?.region
                  ??
                  null,

                country_code:
                  warehouse
                    .address
                    ?.country_code
                  ??
                  null,

                timezone:
                  warehouse
                    .address
                    ?.timezone
                  ??
                  null,

                macrolocal_cluster_id:
                  warehouse
                    .address
                    ?.macrolocal_cluster_id
                  ??
                  null,

                coordinates:
                  warehouse
                    .address
                    ?.coordinates
                  ??
                  null,
              })
            ),
        },


        drop_off_points: {
          searched:
            true,

          count:
            dropOffPoints.length,

          points:
            dropOffPoints.map(
              point => ({
                warehouse_id:
                  point.warehouse_id
                  ??
                  null,

                warehouse_type:
                  point.warehouse_type
                  ??
                  null,

                name:
                  point.name
                  ??
                  null,

                address:
                  point.address
                  ??
                  null,

                coordinates:
                  point.coordinates
                  ??
                  null,


                delivery_info_preview: {
                  drop_off_warehouse: {
                    warehouse_id:
                      point.warehouse_id
                      ??
                      null,

                    warehouse_type:
                      point.warehouse_type
                      ??
                      null,
                  },

                  seller_warehouse_id:
                    null,

                  type:
                    "DROPOFF",
                },
              })
            ),
        },


        ready_for_draft:
          false,


        note:
          "Этот endpoint ничего не создаёт. seller_warehouse_id пока специально не подставляется автоматически.",


        next_step:
          dropOffPoints.length >
          0

            ? "Выбрать seller_warehouse_id и одну точку drop-off. После этого соберём окончательный delivery_info для /v1/draft/multi-cluster/create."

            : "Ozon не нашёл точек по этому запросу. Используйте другое название города или склада.",


        duration_ms:
          Date.now()
          -
          startedAt,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "OZON DROPOFF OPTIONS ERROR",
      error
    );


    return Response.json(
      {
        ok:
          false,

        mode:
          "read_only_dropoff_options",

        writes_to_ozon:
          false,

        writes_to_database:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),

        duration_ms:
          Date.now()
          -
          startedAt,
      },
      {
        status:
          500,
      }
    );

  }

}
