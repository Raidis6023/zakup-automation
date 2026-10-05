import { NextResponse } from "next/server";

import {
  calculateNeed,
} from "../../../../lib/wb/procurement";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_DAYS = 28;

// Данные заказов и остатков должны быть не старше 24 часов.
const MAX_DATA_AGE_HOURS = 24;

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

// ============================================================
// ТИПЫ
// ============================================================

type SyncStateRow = {
  sync_key: string;

  last_attempt_at:
    | string
    | null;

  last_success_at:
    | string
    | null;

  next_allowed_at:
    | string
    | null;

  last_http_status:
    | number
    | null;

  retry_after_seconds:
    | number
    | null;

  last_message:
    | string
    | null;

  stage?:
    | string
    | null;

  external_task_id?:
    | string
    | null;

  last_snapshot_id?:
    | string
    | null;

  updated_at?:
    | string
    | null;
};

type OrderRow = {
  srid: string;

  order_date: string;

  nm_id:
    | number
    | string;

  supplier_article:
    | string
    | null;

  warehouse_type:
    | string
    | null;

  is_cancel:
    | boolean
    | null;
};

type StockRow = {
  nm_id:
    | number
    | string;

  vendor_code:
    | string
    | null;

  barcode:
    | string
    | null;

  tech_size:
    | string
    | null;

  volume:
    | number
    | string
    | null;

  warehouse_name:
    | string
    | null;

  quantity:
    | number
    | string
    | null;

  warehouse_type:
    | string
    | null;

  captured_at:
    | string
    | null;
};

type StockInfo = {
  nmId: number;

  vendorCode:
    | string
    | null;

  barcode:
    | string
    | null;

  volume:
    | number
    | null;

  snapshotRows: number;

  totalRows: number;

  totalStock:
    number;

  wbRussiaAggregate:
    number;

  physicalStockSum:
    number;

  toClient:
    number;

  returning:
    number;

  hasTotalRow:
    boolean;
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function parseJson(
  text: string
): unknown {
  try {
    return JSON.parse(
      text
    );
  } catch {
    return text;
  }
}

function toFiniteNumber(
  value: unknown,
  fallback = 0
): number {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function getAgeHours(
  value:
    | string
    | null
    | undefined
): number | null {
  if (!value) {
    return null;
  }

  const time =
    new Date(
      value
    ).getTime();

  if (
    !Number.isFinite(
      time
    )
  ) {
    return null;
  }

  return (
    Date.now() -
    time
  ) / (
    1000 *
    60 *
    60
  );
}

function formatAgeHours(
  value:
    | number
    | null
): number | null {
  if (
    value === null
  ) {
    return null;
  }

  return Number(
    value.toFixed(
      2
    )
  );
}

// ============================================================
// ОСНОВНОЙ МАРШРУТ
// ============================================================

export async function GET() {
  const supabaseUrlRaw =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKeyRaw =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrlRaw) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL",
      },
      { status: 500 }
    );
  }

  if (!supabaseKeyRaw) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY",
      },
      { status: 500 }
    );
  }

  const supabaseUrl:
    string =
    supabaseUrlRaw;

  const supabaseKey:
    string =
    supabaseKeyRaw;

  const headers = {
    apikey:
      supabaseKey,

    Authorization:
      `Bearer ${supabaseKey}`,

    Accept:
      "application/json",
  };

  // ==========================================================
  // ЧТЕНИЕ СТРАНИЦАМИ ИЗ SUPABASE
  // ==========================================================

  async function fetchAllRows<T>(
    table: string,
    baseParams:
      URLSearchParams
  ): Promise<{
    rows: T[];
    pagesRead: number;
  }> {
    const result:
      T[] = [];

    let pagesRead =
      0;

    for (
      let page = 0;
      page < MAX_PAGES;
      page++
    ) {
      const params =
        new URLSearchParams(
          baseParams
        );

      params.set(
        "limit",
        String(
          PAGE_SIZE
        )
      );

      params.set(
        "offset",
        String(
          page *
            PAGE_SIZE
        )
      );

      const url =
        `${supabaseUrl}/rest/v1/${table}?${params.toString()}`;

      const response =
        await fetch(
          url,
          {
            method:
              "GET",

            headers,

            cache:
              "no-store",
          }
        );

      const text =
        await response.text();

      if (
        !response.ok
      ) {
        throw new Error(
          `Ошибка чтения ${table}, HTTP ${response.status}: ${text}`
        );
      }

      const pageRows =
        parseJson(
          text
        );

      if (
        !Array.isArray(
          pageRows
        )
      ) {
        throw new Error(
          `Supabase вернул неожиданный формат таблицы ${table}`
        );
      }

      pagesRead++;

      result.push(
        ...(
          pageRows as T[]
        )
      );

      if (
        pageRows.length <
        PAGE_SIZE
      ) {
        return {
          rows:
            result,

          pagesRead,
        };
      }
    }

    throw new Error(
      `Достигнут защитный лимит ${MAX_PAGES} страниц при чтении ${table}`
    );
  }

  try {
    // ========================================================
    // 1. ЧИТАЕМ СОСТОЯНИЕ СИНХРОНИЗАЦИЙ ORDERS И STOCKS
    // ========================================================

    const stateParams =
      new URLSearchParams();

    stateParams.set(
      "select",
      "*"
    );

    stateParams.set(
      "sync_key",
      "in.(orders,stocks)"
    );

    const stateResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_sync_state?${stateParams.toString()}`,
        {
          method:
            "GET",

          headers,

          cache:
            "no-store",
        }
      );

    const stateText =
      await stateResponse.text();

    if (
      !stateResponse.ok
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Не удалось получить состояние синхронизаций WB",

          supabaseStatus:
            stateResponse.status,

          supabaseResponse:
            parseJson(
              stateText
            ),
        },
        { status: 500 }
      );
    }

    const stateRows:
      SyncStateRow[] =
      JSON.parse(
        stateText
      );

    const ordersState =
      stateRows.find(
        (row) =>
          row.sync_key ===
          "orders"
      );

    const stocksState =
      stateRows.find(
        (row) =>
          row.sync_key ===
          "stocks"
      );

    // ========================================================
    // 2. ПРОВЕРЯЕМ, ЧТО СИНХРОНИЗАЦИИ ВООБЩЕ ЕСТЬ
    // ========================================================

    if (
      !ordersState
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: нет состояния синхронизации orders",

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    if (
      !stocksState
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: нет состояния синхронизации stocks",

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    if (
      !ordersState
        .last_success_at
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: заказы WB ещё ни разу успешно не синхронизировались",

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    if (
      !stocksState
        .last_success_at
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: остатки WB ещё ни разу успешно не синхронизировались",

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    // ========================================================
    // 3. ПРОВЕРЯЕМ ПОСЛЕДНИЙ HTTP-СТАТУС
    //
    // Ошибка API не должна превращаться в нулевой остаток.
    // ========================================================

    if (
      ordersState
        .last_http_status !==
      200
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: последняя попытка обновления заказов WB была неуспешной",

          ordersState,

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    if (
      stocksState
        .last_http_status !==
      200
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: последняя попытка обновления остатков WB была неуспешной",

          stocksState,

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    // ========================================================
    // 4. ПРОВЕРЯЕМ СВЕЖЕСТЬ ДАННЫХ
    //
    // Правило:
    // и заказы, и остатки должны быть обновлены
    // не более 24 часов назад.
    // ========================================================

    const ordersAgeHours =
      getAgeHours(
        ordersState
          .last_success_at
      );

    const stocksAgeHours =
      getAgeHours(
        stocksState
          .last_success_at
      );

    if (
      ordersAgeHours ===
      null
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: не удалось определить возраст данных заказов WB",

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    if (
      stocksAgeHours ===
      null
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: не удалось определить возраст данных остатков WB",

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    if (
      ordersAgeHours <
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: дата успешной синхронизации заказов находится в будущем",

          ordersAgeHours:
            formatAgeHours(
              ordersAgeHours
            ),

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    if (
      stocksAgeHours <
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: дата успешной синхронизации остатков находится в будущем",

          stocksAgeHours:
            formatAgeHours(
              stocksAgeHours
            ),

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    const staleSources:
      string[] = [];

    if (
      ordersAgeHours >
      MAX_DATA_AGE_HOURS
    ) {
      staleSources.push(
        "orders"
      );
    }

    if (
      stocksAgeHours >
      MAX_DATA_AGE_HOURS
    ) {
      staleSources.push(
        "stocks"
      );
    }

    if (
      staleSources.length >
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: данные Wildberries старше 24 часов. Сначала необходимо обновить данные.",

          freshness: {
            maxAgeHours:
              MAX_DATA_AGE_HOURS,

            staleSources,

            orders: {
              lastSuccessAt:
                ordersState
                  .last_success_at,

              ageHours:
                formatAgeHours(
                  ordersAgeHours
                ),

              fresh:
                ordersAgeHours <=
                MAX_DATA_AGE_HOURS,
            },

            stocks: {
              lastSuccessAt:
                stocksState
                  .last_success_at,

              ageHours:
                formatAgeHours(
                  stocksAgeHours
                ),

              fresh:
                stocksAgeHours <=
                MAX_DATA_AGE_HOURS,
            },
          },

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    // ========================================================
    // 5. ПРОВЕРЯЕМ SNAPSHOT ОСТАТКОВ
    // ========================================================

    const snapshotId =
      stocksState
        .last_snapshot_id;

    if (
      !snapshotId
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: у последней успешной синхронизации остатков нет snapshotId",

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    // ========================================================
    // 6. ФИКСИРУЕМ РАСЧЁТНЫЕ 28 ДНЕЙ
    // ========================================================

    const periodEnd =
      new Date(
        ordersState
          .last_success_at
      );

    if (
      !Number.isFinite(
        periodEnd.getTime()
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Некорректная дата last_success_at для orders",

          wildberriesRequestSent:
            false,
        },
        { status: 500 }
      );
    }

    const periodStart =
      new Date(
        periodEnd.getTime() -
          SALES_DAYS *
            24 *
            60 *
            60 *
            1000
      );

    // ========================================================
    // 7. ЧИТАЕМ FBW-ЗАКАЗЫ ЗА 28 ДНЕЙ
    //
    // ВАЖНО:
    // фильтр именно по order_date.
    //
    // "Свой склад" / FBS сюда НЕ входит.
    // ========================================================

    const orderParams =
      new URLSearchParams();

    orderParams.set(
      "select",
      "srid,order_date,nm_id,supplier_article,warehouse_type,is_cancel"
    );

    orderParams.append(
      "order_date",
      `gte.${periodStart.toISOString()}`
    );

    orderParams.append(
      "order_date",
      `lte.${periodEnd.toISOString()}`
    );

    orderParams.set(
      "warehouse_type",
      "eq.Склад WB"
    );

    orderParams.set(
      "order",
      "order_date.asc,srid.asc"
    );

    const orderResult =
      await fetchAllRows<
        OrderRow
      >(
        "wb_orders",
        orderParams
      );

    const periodFbwOrders =
      orderResult.rows;

    const activeFbwOrders =
      periodFbwOrders.filter(
        (order) =>
          order.is_cancel !==
          true
      );

    const cancelledFbwOrders =
      periodFbwOrders.filter(
        (order) =>
          order.is_cancel ===
          true
      );

    // ========================================================
    // 8. ЧИТАЕМ ПОСЛЕДНИЙ СНИМОК ОСТАТКОВ WB
    // ========================================================

    const stockParams =
      new URLSearchParams();

    stockParams.set(
      "select",
      "nm_id,vendor_code,barcode,tech_size,volume,warehouse_name,quantity,warehouse_type,captured_at"
    );

    stockParams.set(
      "snapshot_id",
      `eq.${snapshotId}`
    );

    stockParams.set(
      "order",
      "nm_id.asc,warehouse_name.asc"
    );

    const stockResult =
      await fetchAllRows<
        StockRow
      >(
        "wb_stock_snapshots",
        stockParams
      );

    const stockRows =
      stockResult.rows;

    if (
      stockRows.length ===
      0
    ) {
      return NextResponse.json(
        {
          ok: false,

          calculationBlocked:
            true,

          message:
            "Расчёт заблокирован: последний snapshot остатков пуст",

          snapshotId,

          wildberriesRequestSent:
            false,
        },
        { status: 409 }
      );
    }

    // ========================================================
    // 9. СЧИТАЕМ ПРОДАЖИ ПО SKU
    //
    // Каждая неотменённая строка orders = 1 единица.
    // ========================================================

    const ordersCountBySku =
      new Map<
        number,
        number
      >();

    const supplierArticleBySku =
      new Map<
        number,
        string
      >();

    for (
      const order of
      activeFbwOrders
    ) {
      const nmId =
        Number(
          order.nm_id
        );

      if (
        !Number.isFinite(
          nmId
        )
      ) {
        continue;
      }

      ordersCountBySku.set(
        nmId,
        (
          ordersCountBySku.get(
            nmId
          ) ??
          0
        ) + 1
      );

      if (
        order.supplier_article &&
        !supplierArticleBySku.has(
          nmId
        )
      ) {
        supplierArticleBySku.set(
          nmId,
          order.supplier_article
        );
      }
    }

    // ========================================================
    // 10. СОБИРАЕМ ОСТАТКИ ПО SKU
    //
    // В формулу идёт ТОЛЬКО totalStock.
    //
    // "Свой склад" / FBS здесь не учитывается.
    // ========================================================

    const stockBySku =
      new Map<
        number,
        StockInfo
      >();

    for (
      const row of
      stockRows
    ) {
      const nmId =
        Number(
          row.nm_id
        );

      if (
        !Number.isFinite(
          nmId
        )
      ) {
        continue;
      }

      if (
        !stockBySku.has(
          nmId
        )
      ) {
        const parsedVolume =
          Number(
            row.volume
          );

        stockBySku.set(
          nmId,
          {
            nmId,

            vendorCode:
              row.vendor_code ??
              null,

            barcode:
              row.barcode ??
              null,

            volume:
              Number.isFinite(
                parsedVolume
              )
                ? parsedVolume
                : null,

            snapshotRows:
              0,

            totalRows:
              0,

            totalStock:
              0,

            wbRussiaAggregate:
              0,

            physicalStockSum:
              0,

            toClient:
              0,

            returning:
              0,

            hasTotalRow:
              false,
          }
        );
      }

      const item =
        stockBySku.get(
          nmId
        )!;

      item.snapshotRows++;

      if (
        !item.vendorCode &&
        row.vendor_code
      ) {
        item.vendorCode =
          row.vendor_code;
      }

      if (
        !item.barcode &&
        row.barcode
      ) {
        item.barcode =
          row.barcode;
      }

      const quantity =
        toFiniteNumber(
          row.quantity,
          0
        );

      if (
        row.warehouse_type ===
        "total"
      ) {
        item.hasTotalRow =
          true;

        item.totalRows++;

        item.totalStock +=
          quantity;
      }

      if (
        row.warehouse_type ===
        "wbRussiaAggregate"
      ) {
        item.wbRussiaAggregate +=
          quantity;
      }

      if (
        row.warehouse_type ===
        "physical"
      ) {
        item.physicalStockSum +=
          quantity;
      }

      if (
        row.warehouse_type ===
        "toClient"
      ) {
        item.toClient +=
          quantity;
      }

      if (
        row.warehouse_type ===
        "returning"
      ) {
        item.returning +=
          quantity;
      }
    }

    // ========================================================
    // 11. ОБЪЕДИНЯЕМ SKU ИЗ ПРОДАЖ И ОСТАТКОВ
    // ========================================================

    const allSku =
      new Set<number>();

    for (
      const nmId of
      ordersCountBySku.keys()
    ) {
      allSku.add(
        nmId
      );
    }

    for (
      const nmId of
      stockBySku.keys()
    ) {
      allSku.add(
        nmId
      );
    }

    // ========================================================
    // 12. РАСЧЁТ ПОТРЕБНОСТИ
    //
    // needRaw = математический результат формулы.
    // needRoundedUp = реальное количество в целых штуках.
    //
    // Пример:
    // 422.14 -> 423
    // 1.01   -> 2
    // 0      -> 0
    // ========================================================

    const items =
      Array.from(
        allSku
      ).map(
        (nmId) => {
          const ordersCount =
            ordersCountBySku.get(
              nmId
            ) ??
            0;

          const dailySales =
            ordersCount /
            SALES_DAYS;

          const stockInfo =
            stockBySku.get(
              nmId
            );

          let totalStock =
            0;

          let stockSource:
            | "TOTAL_ROW"
            | "TOTAL_ROW_MISSING_ASSUMED_ZERO"
            | "SKU_ABSENT_FROM_SNAPSHOT_ASSUMED_ZERO";

          if (
            stockInfo?.hasTotalRow
          ) {
            totalStock =
              stockInfo.totalStock;

            stockSource =
              "TOTAL_ROW";
          } else if (
            stockInfo
          ) {
            totalStock =
              0;

            stockSource =
              "TOTAL_ROW_MISSING_ASSUMED_ZERO";
          } else {
            totalStock =
              0;

            stockSource =
              "SKU_ABSENT_FROM_SNAPSHOT_ASSUMED_ZERO";
          }

          const needResult =
            calculateNeed(
              totalStock,
              dailySales
            );

          const needRoundedUp =
            needResult.need >
            0
              ? Math.ceil(
                  needResult.need
                )
              : 0;

          return {
            nmId,

            supplierArticle:
              supplierArticleBySku.get(
                nmId
              ) ??
              stockInfo?.vendorCode ??
              null,

            vendorCode:
              stockInfo?.vendorCode ??
              null,

            barcode:
              stockInfo?.barcode ??
              null,

            volume:
              stockInfo?.volume ??
              null,

            sales: {
              periodDays:
                SALES_DAYS,

              ordersCount,

              dailySales:
                needResult.dailySales,
            },

            stock: {
              totalStock:
                needResult.stock,

              source:
                stockSource,

              hasTotalRow:
                stockInfo?.hasTotalRow ??
                false,

              totalRows:
                stockInfo?.totalRows ??
                0,

              physicalStockSum:
                stockInfo?.physicalStockSum ??
                0,

              wbRussiaAggregate:
                stockInfo?.wbRussiaAggregate ??
                0,

              toClient:
                stockInfo?.toClient ??
                0,

              returning:
                stockInfo?.returning ??
                0,
            },

            calculation: {
              daysOfStock:
                needResult.daysOfStock,

              needRaw:
                needResult.need,

              needRoundedUp,

              rule:
                needResult.rule,
            },
          };
        }
      );

    // ========================================================
    // 13. СОРТИРОВКА
    //
    // Сначала самая большая округлённая потребность.
    // При равенстве — больший сырой расчёт.
    // Затем — больше средних продаж.
    // ========================================================

    items.sort(
      (
        a,
        b
      ) => {
        const byRoundedNeed =
          b.calculation
            .needRoundedUp -
          a.calculation
            .needRoundedUp;

        if (
          byRoundedNeed !==
          0
        ) {
          return byRoundedNeed;
        }

        const byRawNeed =
          b.calculation
            .needRaw -
          a.calculation
            .needRaw;

        if (
          byRawNeed !==
          0
        ) {
          return byRawNeed;
        }

        return (
          b.sales.dailySales -
          a.sales.dailySales
        );
      }
    );

    // ========================================================
    // 14. КОНТРОЛЬ КАЧЕСТВА
    // ========================================================

    const skuWithNeed =
      items.filter(
        (item) =>
          item.calculation
            .needRaw >
          0
      );

    const noSales =
      items.filter(
        (item) =>
          item.calculation.rule ===
          "NO_SALES"
      );

    const moreThan30Days =
      items.filter(
        (item) =>
          item.calculation.rule ===
          "MORE_THAN_30_DAYS"
      );

    const lessThan10Days =
      items.filter(
        (item) =>
          item.calculation.rule ===
          "LESS_THAN_10_DAYS"
      );

    const between10And30Days =
      items.filter(
        (item) =>
          item.calculation.rule ===
          "BETWEEN_10_AND_30_DAYS"
      );

    const missingTotalRow =
      items.filter(
        (item) =>
          item.stock.source ===
          "TOTAL_ROW_MISSING_ASSUMED_ZERO"
      );

    const salesSkuAbsentFromSnapshot =
      items.filter(
        (item) =>
          item.stock.source ===
          "SKU_ABSENT_FROM_SNAPSHOT_ASSUMED_ZERO" &&
          item.sales.ordersCount >
            0
      );

    const totalNeedRaw =
      skuWithNeed.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.calculation
            .needRaw,
        0
      );

    // ВАЖНО:
    // округляем вверх каждый SKU отдельно,
    // а затем суммируем.
    const totalNeedRoundedUp =
      skuWithNeed.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.calculation
            .needRoundedUp,
        0
      );

    // ========================================================
    // 15. ВОЗВРАЩАЕМ РЕЗУЛЬТАТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "Реальная потребность WB рассчитана по данным Supabase",

      wildberriesRequestSent:
        false,

      calculationScope: {
        marketplace:
          "Wildberries",

        fulfillment:
          "FBW / Склад WB",

        ownWarehouseFbsIncluded:
          false,

        granularity:
          "SKU × весь Wildberries",

        clusterCalculation:
          false,

        reason:
          "Надёжная привязка FBW-заказа к физическому складу WB пока не установлена",
      },

      formula: {
        salesDays:
          SALES_DAYS,

        cancelledOrdersExcluded:
          true,

        sellerWarehouseExcluded:
          true,

        ownWarehouseFbsExcluded:
          true,

        stockUsed:
          "totalStock",

        toClientIncludedInStock:
          false,

        returningIncludedInStock:
          false,

        rules: {
          moreThan30Days:
            "need = 0",

          lessThan10Days:
            "need = dailySales × 30",

          between10And30Days:
            "need = (40 - daysOfStock) × dailySales",
        },

        rounding:
          "Каждая положительная потребность округляется вверх до целого количества единиц.",
      },

      freshness: {
        maxAgeHours:
          MAX_DATA_AGE_HOURS,

        allSourcesFresh:
          true,

        orders: {
          lastSuccessAt:
            ordersState
              .last_success_at,

          ageHours:
            formatAgeHours(
              ordersAgeHours
            ),

          fresh:
            true,

          lastHttpStatus:
            ordersState
              .last_http_status,
        },

        stocks: {
          lastSuccessAt:
            stocksState
              .last_success_at,

          ageHours:
            formatAgeHours(
              stocksAgeHours
            ),

          fresh:
            true,

          lastHttpStatus:
            stocksState
              .last_http_status,

          snapshotId,
        },
      },

      period: {
        days:
          SALES_DAYS,

        start:
          periodStart.toISOString(),

        end:
          periodEnd.toISOString(),
      },

      sourceRows: {
        fbwOrdersInsidePeriod:
          periodFbwOrders.length,

        activeFbwOrders:
          activeFbwOrders.length,

        cancelledFbwOrders:
          cancelledFbwOrders.length,

        orderPagesRead:
          orderResult.pagesRead,

        stockSnapshotRows:
          stockRows.length,

        stockPagesRead:
          stockResult.pagesRead,
      },

      summary: {
        skuCount:
          items.length,

        skuWithActiveSales:
          ordersCountBySku.size,

        skuWithNeed:
          skuWithNeed.length,

        totalNeedRaw:
          Number(
            totalNeedRaw.toFixed(
              6
            )
          ),

        totalNeedRoundedUp,

        rules: {
          noSales:
            noSales.length,

          moreThan30Days:
            moreThan30Days.length,

          lessThan10Days:
            lessThan10Days.length,

          between10And30Days:
            between10And30Days.length,
        },
      },

      dataQuality: {
        snapshotSkuCount:
          stockBySku.size,

        skuWithMissingTotalRow:
          missingTotalRow.length,

        salesSkuAbsentFromSnapshot:
          salesSkuAbsentFromSnapshot.length,

        note:
          "Нулевой FBW-остаток допускается только внутри успешно полученного снимка. Остатки и продажи FBS / «Свой склад» сейчас не участвуют в расчёте.",
      },

      topNeed:
        skuWithNeed.slice(
          0,
          20
        ),

      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка реального расчёта потребности WB",

        wildberriesRequestSent:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
