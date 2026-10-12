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

type SyncRunRow = {
  id: string;
  date_from: string;
  date_to: string;
  created_at: string;
};


type OrderRow = {
  order_id: string;
  creation_date: string;
  status: string;
};


type OrderItemRow = {
  order_id: string;

  yandex_product_id:
    number | null;

  product_id:
    string | null;

  shop_sku: string;

  market_sku:
    string | null;

  master_code:
    string | null;

  quantity: number;

  warehouse_id:
    number | null;

  warehouse_name:
    string | null;
};


type ReturnRow = {
  return_id: string;

  order_id:
    string | null;

  return_type: string;

  refund_status:
    string | null;
};


type ReturnItemRow = {
  return_id: string;

  order_id:
    string | null;

  shop_sku: string;

  market_sku:
    string | null;

  quantity: number;
};


type OrderSkuGroup = {
  orderId: string;

  shopSku: string;

  marketSku: string;

  productId:
    string | null;

  yandexProductId:
    number | null;

  masterCode:
    string | null;

  warehouseId:
    number | null;

  warehouseName:
    string | null;

  warehouseKeys:
    Set<string>;

  orderStatus: string;

  saleDate: string;

  orderUnits: number;
};


type NegativeGroup = {
  orderId: string;

  shopSku: string;

  marketSku: string;

  rawReturnUnits: number;

  rawUnredeemedUnits: number;

  activeTypes:
    Set<string>;
};


type ClassifiedRow = {
  order_id: string;

  product_id: string;

  yandex_product_id:
    number | null;

  shop_sku: string;

  master_code:
    string | null;

  warehouse_id:
    number | null;

  warehouse_name:
    string | null;

  sale_date: string;

  ordered_quantity: number;

  sales_quantity: number;

  cancelled_quantity: number;

  unredeemed_quantity: number;

  returned_quantity: number;

  net_sales_quantity: number;
};


type DailyRow = {
  product_id: string;

  yandex_product_id:
    number | null;

  shop_sku: string;

  master_code:
    string | null;

  warehouse_id:
    number | null;

  warehouse_name:
    string | null;

  sale_date: string;

  ordered_quantity: number;

  sales_quantity: number;

  cancelled_quantity: number;

  unredeemed_quantity: number;

  returned_quantity: number;

  net_sales_quantity: number;
};


// ============================================================
// CONFIG
// ============================================================

function getConfig() {

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
    supabaseUrl,
    supabaseSecretKey,
  };

}


// ============================================================
// SUPABASE
// ============================================================

function getHeaders(
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


async function getLatestSuccessfulRun(
  supabaseUrl: string,
  secretKey: string
):
Promise<SyncRunRow> {

  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_sales_sync_runs`
    );


  url.searchParams.set(
    "select",
    "id,date_from,date_to,created_at"
  );


  url.searchParams.set(
    "status",
    "eq.success"
  );


  url.searchParams.set(
    "order",
    "created_at.desc"
  );


  url.searchParams.set(
    "limit",
    "1"
  );


  const response =
    await fetch(
      url.toString(),
      {
        headers:
          getHeaders(
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
      `Не удалось получить последний sync run: HTTP ${response.status}: ${text}`
    );

  }


  const rows =
    JSON.parse(
      text
    ) as SyncRunRow[];


  const run =
    rows[0];


  if (!run) {

    throw new Error(
      "Не найден успешный yandex_sales_sync_run"
    );

  }


  return run;

}


async function fetchAllRows<T>(
  supabaseUrl: string,
  secretKey: string,
  table: string,
  select: string,
  filters:
    Record<
      string,
      string
    >
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


    for (
      const [
        key,
        value,
      ]
      of Object.entries(
        filters
      )
    ) {

      url.searchParams.set(
        key,
        value
      );

    }


    const response =
      await fetch(
        url.toString(),
        {
          headers:
            getHeaders(
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
// KEY
// ============================================================

function makeSkuKey(
  orderId: string,
  shopSku: string,
  marketSku:
    string | null
) {

  return [
    orderId,
    shopSku,
    marketSku ?? "",
  ].join(
    "\u001f"
  );

}


function makeDailyKey(
  productId: string,
  saleDate: string,
  warehouseId:
    number | null
) {

  return [
    productId,
    saleDate,

    warehouseId === null
      ? "NULL"
      : String(
          warehouseId
        ),
  ].join(
    "\u001f"
  );

}


// ============================================================
// GET
//
// ТОЛЬКО PREVIEW.
// НИЧЕГО НЕ ПИШЕТ В yandex_sales_daily.
// ============================================================

export async function GET() {

  try {

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getConfig();


    const run =
      await getLatestSuccessfulRun(
        supabaseUrl,
        supabaseSecretKey
      );


    const [
      orders,
      orderItems,
      returns,
      returnItems,
    ] =
      await Promise.all(
        [
          fetchAllRows<
            OrderRow
          >(
            supabaseUrl,
            supabaseSecretKey,
            "yandex_orders",
            [
              "order_id",
              "creation_date",
              "status",
            ].join(
              ","
            ),
            {
              last_sync_run_id:
                `eq.${run.id}`,
            }
          ),

          fetchAllRows<
            OrderItemRow
          >(
            supabaseUrl,
            supabaseSecretKey,
            "yandex_order_items",
            [
              "order_id",
              "yandex_product_id",
              "product_id",
              "shop_sku",
              "market_sku",
              "master_code",
              "quantity",
              "warehouse_id",
              "warehouse_name",
            ].join(
              ","
            ),
            {
              last_sync_run_id:
                `eq.${run.id}`,
            }
          ),

          fetchAllRows<
            ReturnRow
          >(
            supabaseUrl,
            supabaseSecretKey,
            "yandex_returns",
            [
              "return_id",
              "order_id",
              "return_type",
              "refund_status",
            ].join(
              ","
            ),
            {
              last_sync_run_id:
                `eq.${run.id}`,
            }
          ),

          fetchAllRows<
            ReturnItemRow
          >(
            supabaseUrl,
            supabaseSecretKey,
            "yandex_return_items",
            [
              "return_id",
              "order_id",
              "shop_sku",
              "market_sku",
              "quantity",
            ].join(
              ","
            ),
            {
              last_sync_run_id:
                `eq.${run.id}`,
            }
          ),
        ]
      );


    // ========================================================
    // ORDERS
    // ========================================================

    const allOrderMap =
      new Map<
        string,
        OrderRow
      >();


    for (
      const order
      of orders
    ) {

      allOrderMap.set(
        order.order_id,
        order
      );

    }


    const windowOrders =
      orders.filter(
        order =>
          order.creation_date >=
            run.date_from
          &&
          order.creation_date <=
            run.date_to
      );


    const windowOrderIds =
      new Set(
        windowOrders.map(
          order =>
            order.order_id
        )
      );


    const parentOrdersOutsideWindow =
      orders.filter(
        order =>
          !windowOrderIds.has(
            order.order_id
          )
      );


    // ========================================================
    // ORDER SKU GROUPS
    // ========================================================

    const orderSkuMap =
      new Map<
        string,
        OrderSkuGroup
      >();


    let orderItemRowsInWindow =
      0;


    for (
      const item
      of orderItems
    ) {

      if (
        !windowOrderIds.has(
          item.order_id
        )
      ) {

        continue;

      }


      orderItemRowsInWindow +=
        1;


      const order =
        allOrderMap.get(
          item.order_id
        );


      if (!order) {

        continue;

      }


      const key =
        makeSkuKey(
          item.order_id,
          item.shop_sku,
          item.market_sku
        );


      const warehouseKey =
        item.warehouse_id ===
          null
        ? "NULL"
        : String(
            item.warehouse_id
          );


      const existing =
        orderSkuMap.get(
          key
        );


      if (existing) {

        existing.orderUnits +=
          Number(
            item.quantity
            ??
            0
          );


        existing.warehouseKeys.add(
          warehouseKey
        );


        continue;

      }


      orderSkuMap.set(
        key,
        {
          orderId:
            item.order_id,

          shopSku:
            item.shop_sku,

          marketSku:
            item.market_sku
            ??
            "",

          productId:
            item.product_id,

          yandexProductId:
            item.yandex_product_id,

          masterCode:
            item.master_code,

          warehouseId:
            item.warehouse_id,

          warehouseName:
            item.warehouse_name,

          warehouseKeys:
            new Set([
              warehouseKey,
            ]),

          orderStatus:
            order.status,

          saleDate:
            order.creation_date,

          orderUnits:
            Number(
              item.quantity
              ??
              0
            ),
        }
      );

    }


    // ========================================================
    // RETURNS MAP
    // ========================================================

    const returnMap =
      new Map<
        string,
        ReturnRow
      >();


    for (
      const row
      of returns
    ) {

      returnMap.set(
        row.return_id,
        row
      );

    }


    // ========================================================
    // NEGATIVE EVENTS
    //
    // CANCELLED возврат не считаем.
    // ========================================================

    const negativeMap =
      new Map<
        string,
        NegativeGroup
      >();


    const unknownReturnTypes =
      new Set<string>();


    let returnItemsWithoutReturn =
      0;


    let returnItemsWithoutOrder =
      0;


    let excludedParentNegativeUnitsRaw =
      0;


    for (
      const item
      of returnItems
    ) {

      const returnRow =
        returnMap.get(
          item.return_id
        );


      if (!returnRow) {

        returnItemsWithoutReturn +=
          1;

        continue;

      }


      const orderId =
        item.order_id
        ??
        returnRow.order_id;


      if (!orderId) {

        returnItemsWithoutOrder +=
          1;

        continue;

      }


      const quantity =
        Number(
          item.quantity
          ??
          0
        );


      // ------------------------------------------------------
      // Возврат был отменён.
      // ------------------------------------------------------

      if (
        returnRow.return_type ===
          "RETURN"
        &&
        returnRow.refund_status ===
          "CANCELLED"
      ) {

        continue;

      }


      if (
        returnRow.return_type !==
          "RETURN"
        &&
        returnRow.return_type !==
          "UNREDEEMED"
      ) {

        unknownReturnTypes.add(
          returnRow.return_type
        );

        continue;

      }


      // ------------------------------------------------------
      // Родительский заказ старше полного окна.
      // Сырьё сохраняем, но daily по неполному дню
      // из него сейчас не строим.
      // ------------------------------------------------------

      if (
        !windowOrderIds.has(
          orderId
        )
      ) {

        excludedParentNegativeUnitsRaw +=
          quantity;

        continue;

      }


      const key =
        makeSkuKey(
          orderId,
          item.shop_sku,
          item.market_sku
        );


      let group =
        negativeMap.get(
          key
        );


      if (!group) {

        group = {
          orderId,

          shopSku:
            item.shop_sku,

          marketSku:
            item.market_sku
            ??
            "",

          rawReturnUnits:
            0,

          rawUnredeemedUnits:
            0,

          activeTypes:
            new Set<string>(),
        };


        negativeMap.set(
          key,
          group
        );

      }


      group.activeTypes.add(
        returnRow.return_type
      );


      if (
        returnRow.return_type ===
        "RETURN"
      ) {

        group.rawReturnUnits +=
          quantity;

      }


      if (
        returnRow.return_type ===
        "UNREDEEMED"
      ) {

        group.rawUnredeemedUnits +=
          quantity;

      }

    }


    // ========================================================
    // PREFLIGHT PROBLEMS
    // ========================================================

    const ambiguousWarehouseGroups:
      Array<{
        order_id: string;
        shop_sku: string;
        market_sku: string;
        warehouse_count: number;
      }> =
      [];


    const missingProductGroups:
      Array<{
        order_id: string;
        shop_sku: string;
      }> =
      [];


    const mixedNegativeGroups:
      Array<{
        order_id: string;
        shop_sku: string;
        market_sku: string;
        types: string[];
      }> =
      [];


    const cappedCases:
      Array<{
        order_id: string;
        shop_sku: string;
        market_sku: string;
        order_units: number;
        raw_return_units: number;
        returned_units: number;
        raw_unredeemed_units: number;
        unredeemed_units: number;
      }> =
      [];


    const classifiedRows:
      ClassifiedRow[] =
      [];


    for (
      const [
        key,
        orderGroup,
      ]
      of orderSkuMap
    ) {

      if (
        orderGroup
          .warehouseKeys
          .size >
        1
      ) {

        ambiguousWarehouseGroups.push(
          {
            order_id:
              orderGroup.orderId,

            shop_sku:
              orderGroup.shopSku,

            market_sku:
              orderGroup.marketSku,

            warehouse_count:
              orderGroup
                .warehouseKeys
                .size,
          }
        );

      }


      if (
        !orderGroup.productId
        ||
        !orderGroup.masterCode
      ) {

        missingProductGroups.push(
          {
            order_id:
              orderGroup.orderId,

            shop_sku:
              orderGroup.shopSku,
          }
        );


        continue;

      }


      const negative =
        negativeMap.get(
          key
        );


      const rawReturnUnits =
        negative
          ?.rawReturnUnits
        ??
        0;


      const rawUnredeemedUnits =
        negative
          ?.rawUnredeemedUnits
        ??
        0;


      const activeTypes =
        negative
          ?.activeTypes
        ??
        new Set<string>();


      if (
        activeTypes.size >
        1
      ) {

        mixedNegativeGroups.push(
          {
            order_id:
              orderGroup.orderId,

            shop_sku:
              orderGroup.shopSku,

            market_sku:
              orderGroup.marketSku,

            types:
              Array.from(
                activeTypes
              ).sort(),
          }
        );

      }


      const returnedUnits =
        Math.min(
          orderGroup.orderUnits,
          rawReturnUnits
        );


      const unredeemedUnits =
        Math.min(
          orderGroup.orderUnits,
          rawUnredeemedUnits
        );


      if (
        rawReturnUnits >
          orderGroup.orderUnits
        ||
        rawUnredeemedUnits >
          orderGroup.orderUnits
      ) {

        cappedCases.push(
          {
            order_id:
              orderGroup.orderId,

            shop_sku:
              orderGroup.shopSku,

            market_sku:
              orderGroup.marketSku,

            order_units:
              orderGroup.orderUnits,

            raw_return_units:
              rawReturnUnits,

            returned_units:
              returnedUnits,

            raw_unredeemed_units:
              rawUnredeemedUnits,

            unredeemed_units:
              unredeemedUnits,
          }
        );

      }


      const cancelledUnits =
        orderGroup
          .orderStatus
          .startsWith(
            "CANCELLED"
          )
        ? Math.max(
            orderGroup.orderUnits
            -
            returnedUnits
            -
            unredeemedUnits,
            0
          )
        : 0;


      const salesUnits =
        orderGroup.orderUnits
        -
        cancelledUnits
        -
        unredeemedUnits;


      const netSalesUnits =
        salesUnits
        -
        returnedUnits;


      classifiedRows.push(
        {
          order_id:
            orderGroup.orderId,

          product_id:
            orderGroup.productId,

          yandex_product_id:
            orderGroup.yandexProductId,

          shop_sku:
            orderGroup.shopSku,

          master_code:
            orderGroup.masterCode,

          warehouse_id:
            orderGroup.warehouseId,

          warehouse_name:
            orderGroup.warehouseName,

          sale_date:
            orderGroup.saleDate,

          ordered_quantity:
            orderGroup.orderUnits,

          sales_quantity:
            salesUnits,

          cancelled_quantity:
            cancelledUnits,

          unredeemed_quantity:
            unredeemedUnits,

          returned_quantity:
            returnedUnits,

          net_sales_quantity:
            netSalesUnits,
        }
      );

    }


    // ========================================================
    // RETURNS, ДЛЯ КОТОРЫХ НЕ НАШЁЛСЯ ORDER SKU
    // В ПОЛНОМ ОКНЕ
    // ========================================================

    const unmatchedNegativeGroups:
      Array<{
        order_id: string;
        shop_sku: string;
        market_sku: string;
      }> =
      [];


    for (
      const [
        key,
        negative,
      ]
      of negativeMap
    ) {

      if (
        !orderSkuMap.has(
          key
        )
      ) {

        unmatchedNegativeGroups.push(
          {
            order_id:
              negative.orderId,

            shop_sku:
              negative.shopSku,

            market_sku:
              negative.marketSku,
          }
        );

      }

    }


    // ========================================================
    // DAILY AGGREGATION
    // ========================================================

    const dailyMap =
      new Map<
        string,
        DailyRow
      >();


    for (
      const row
      of classifiedRows
    ) {

      const key =
        makeDailyKey(
          row.product_id,
          row.sale_date,
          row.warehouse_id
        );


      const existing =
        dailyMap.get(
          key
        );


      if (existing) {

        existing.ordered_quantity +=
          row.ordered_quantity;

        existing.sales_quantity +=
          row.sales_quantity;

        existing.cancelled_quantity +=
          row.cancelled_quantity;

        existing.unredeemed_quantity +=
          row.unredeemed_quantity;

        existing.returned_quantity +=
          row.returned_quantity;

        existing.net_sales_quantity +=
          row.net_sales_quantity;


        continue;

      }


      dailyMap.set(
        key,
        {
          product_id:
            row.product_id,

          yandex_product_id:
            row.yandex_product_id,

          shop_sku:
            row.shop_sku,

          master_code:
            row.master_code,

          warehouse_id:
            row.warehouse_id,

          warehouse_name:
            row.warehouse_name,

          sale_date:
            row.sale_date,

          ordered_quantity:
            row.ordered_quantity,

          sales_quantity:
            row.sales_quantity,

          cancelled_quantity:
            row.cancelled_quantity,

          unredeemed_quantity:
            row.unredeemed_quantity,

          returned_quantity:
            row.returned_quantity,

          net_sales_quantity:
            row.net_sales_quantity,
        }
      );

    }


    const dailyRows =
      Array.from(
        dailyMap.values()
      )
        .sort(
          (
            a,
            b
          ) => {

            const dateCompare =
              a.sale_date.localeCompare(
                b.sale_date
              );


            if (
              dateCompare !==
              0
            ) {

              return dateCompare;

            }


            return a.shop_sku.localeCompare(
              b.shop_sku
            );

          }
        );


    // ========================================================
    // TOTALS
    // ========================================================

    const totals =
      dailyRows.reduce(
        (
          acc,
          row
        ) => {

          acc.ordered_quantity +=
            row.ordered_quantity;

          acc.sales_quantity +=
            row.sales_quantity;

          acc.cancelled_quantity +=
            row.cancelled_quantity;

          acc.unredeemed_quantity +=
            row.unredeemed_quantity;

          acc.returned_quantity +=
            row.returned_quantity;

          acc.net_sales_quantity +=
            row.net_sales_quantity;


          return acc;

        },
        {
          ordered_quantity:
            0,

          sales_quantity:
            0,

          cancelled_quantity:
            0,

          unredeemed_quantity:
            0,

          returned_quantity:
            0,

          net_sales_quantity:
            0,
        }
      );


    // ========================================================
    // MATH CHECK
    // ========================================================

    const mathViolations =
      dailyRows.filter(
        row =>
          row.sales_quantity !==
            (
              row.ordered_quantity
              -
              row.cancelled_quantity
              -
              row.unredeemed_quantity
            )
          ||
          row.net_sales_quantity !==
            (
              row.sales_quantity
              -
              row.returned_quantity
            )
          ||
          row.returned_quantity >
            row.sales_quantity
          ||
          row.net_sales_quantity <
            0
      );


    const previewOk =
      ambiguousWarehouseGroups.length ===
        0
      &&
      missingProductGroups.length ===
        0
      &&
      mixedNegativeGroups.length ===
        0
      &&
      unmatchedNegativeGroups.length ===
        0
      &&
      unknownReturnTypes.size ===
        0
      &&
      returnItemsWithoutReturn ===
        0
      &&
      returnItemsWithoutOrder ===
        0
      &&
      mathViolations.length ===
        0;


    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "yandex_sales_daily_preview",

        writes_to_database:
          false,

        sync_run_id:
          run.id,

        complete_period: {
          date_from:
            run.date_from,

          date_to:
            run.date_to,
        },

        source: {
          orders_in_sync_run:
            orders.length,

          orders_inside_complete_period:
            windowOrders.length,

          parent_orders_outside_complete_period:
            parentOrdersOutsideWindow.length,

          order_item_rows_inside_complete_period:
            orderItemRowsInWindow,

          excluded_parent_negative_units_raw:
            excludedParentNegativeUnitsRaw,
        },

        preview_ok:
          previewOk,

        daily_rows_count:
          dailyRows.length,

        totals,

        checks: {
          ambiguous_warehouse_groups:
            ambiguousWarehouseGroups.length,

          missing_product_groups:
            missingProductGroups.length,

          mixed_negative_groups:
            mixedNegativeGroups.length,

          unmatched_negative_groups:
            unmatchedNegativeGroups.length,

          unknown_return_types:
            Array.from(
              unknownReturnTypes
            ).sort(),

          return_items_without_return:
            returnItemsWithoutReturn,

          return_items_without_order:
            returnItemsWithoutOrder,

          math_violations:
            mathViolations.length,

          capped_cases:
            cappedCases.length,
        },

        capped_cases:
          cappedCases,

        problem_samples: {
          ambiguous_warehouse_groups:
            ambiguousWarehouseGroups.slice(
              0,
              20
            ),

          missing_product_groups:
            missingProductGroups.slice(
              0,
              20
            ),

          mixed_negative_groups:
            mixedNegativeGroups.slice(
              0,
              20
            ),

          unmatched_negative_groups:
            unmatchedNegativeGroups.slice(
              0,
              20
            ),

          math_violations:
            mathViolations.slice(
              0,
              20
            ),
        },

        sample_daily_rows:
          dailyRows.slice(
            0,
            20
          ),
      }
    );

  } catch (error) {

    console.error(
      "YANDEX SALES DAILY PREVIEW ERROR:",
      error
    );


    return NextResponse.json(
      {
        ok:
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
