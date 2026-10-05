import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SALES_DAYS = 28;
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

type WBOrderRow = {
  srid: string;
  order_date: string;
  last_change_date: string | null;
  nm_id: number | string;
  supplier_article: string | null;
  warehouse_name: string | null;
  warehouse_type: string | null;
  is_cancel: boolean | null;
  cancel_date: string | null;
  income_id: number | string | null;
  synced_at: string | null;
};

function parseDateMs(
  value: string | null | undefined
): number | null {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time)
    ? time
    : null;
}

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

  const supabaseUrl: string =
    supabaseUrlRaw;

  const supabaseKey: string =
    supabaseKeyRaw;

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: "application/json",
  };

  try {
    // ========================================================
    // 1. СОСТОЯНИЕ ПОСЛЕДНЕЙ СИНХРОНИЗАЦИИ ORDERS
    // ========================================================

    const stateParams =
      new URLSearchParams({
        sync_key: "eq.orders",
        select:
          "last_success_at,last_attempt_at,last_http_status,last_message",
        limit: "1",
      });

    const stateUrl =
      `${supabaseUrl}/rest/v1/wb_sync_state?` +
      stateParams.toString();

    const stateResponse =
      await fetch(stateUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

    const stateText =
      await stateResponse.text();

    if (!stateResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не удалось получить состояние синхронизации orders",
          supabaseStatus:
            stateResponse.status,
          supabaseResponse:
            stateText,
        },
        { status: 500 }
      );
    }

    const stateRows =
      JSON.parse(stateText);

    const state =
      Array.isArray(stateRows)
        ? stateRows[0]
        : null;

    const lastSuccessAt:
      string | null =
      state?.last_success_at ??
      null;

    const lastAttemptAt:
      string | null =
      state?.last_attempt_at ??
      null;

    if (!lastSuccessAt) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Успешная синхронизация заказов ещё не зафиксирована",
        },
        { status: 404 }
      );
    }

    // ========================================================
    // 2. ОКНО РАСЧЁТА
    //
    // Для конца периода используем время начала успешного
    // обращения к WB. Оно ближе всего к dateFrom, который
    // использовался при запросе.
    // ========================================================

    const periodEndSource =
      lastAttemptAt ??
      lastSuccessAt;

    const periodEnd =
      new Date(
        periodEndSource
      );

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
    // 3. ЧИТАЕМ ВСЕ wb_orders СТРАНИЦАМИ ПО 1000
    // ========================================================

    const allOrders:
      WBOrderRow[] = [];

    let pagesRead = 0;

    for (
      let page = 0;
      page < MAX_PAGES;
      page++
    ) {
      const offset =
        page * PAGE_SIZE;

      const orderParams =
        new URLSearchParams({
          select:
            "srid,order_date,last_change_date,nm_id,supplier_article,warehouse_name,warehouse_type,is_cancel,cancel_date,income_id,synced_at",

          order:
            "order_date.asc,srid.asc",

          limit:
            String(PAGE_SIZE),

          offset:
            String(offset),
        });

      const ordersUrl =
        `${supabaseUrl}/rest/v1/wb_orders?` +
        orderParams.toString();

      const ordersResponse =
        await fetch(
          ordersUrl,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        );

      const ordersText =
        await ordersResponse.text();

      if (
        !ordersResponse.ok
      ) {
        return NextResponse.json(
          {
            ok: false,

            message:
              "Не удалось получить страницу wb_orders из Supabase",

            page:
              page + 1,

            offset,

            supabaseStatus:
              ordersResponse.status,

            supabaseResponse:
              ordersText,
          },
          { status: 500 }
        );
      }

      const pageRows =
        JSON.parse(
          ordersText
        );

      if (
        !Array.isArray(pageRows)
      ) {
        return NextResponse.json(
          {
            ok: false,

            message:
              "Supabase вернул неожиданный формат wb_orders",

            page:
              page + 1,
          },
          { status: 500 }
        );
      }

      pagesRead++;

      allOrders.push(
        ...pageRows
      );

      // Последняя страница.
      if (
        pageRows.length <
        PAGE_SIZE
      ) {
        break;
      }

      if (
        page ===
        MAX_PAGES - 1
      ) {
        return NextResponse.json(
          {
            ok: false,

            message:
              "Достигнут защитный лимит MAX_PAGES. Аудит остановлен.",

            rowsRead:
              allOrders.length,

            maxPages:
              MAX_PAGES,
          },
          { status: 500 }
        );
      }
    }

    // ========================================================
    // 4. ПРОВЕРЯЕМ ДАТЫ ЗАКАЗОВ
    // ========================================================

    const ordersWithDates =
      allOrders
        .map(
          (
            order:
              WBOrderRow
          ) => ({
            ...order,

            orderTime:
              parseDateMs(
                order.order_date
              ),

            changeTime:
              parseDateMs(
                order.last_change_date
              ),
          })
        )
        .filter(
          (
            order
          ) =>
            order.orderTime !==
            null
        );

    const invalidOrderDateCount =
      allOrders.length -
      ordersWithDates.length;

    // ========================================================
    // 5. РАЗБИВАЕМ НА 28 ДНЕЙ / СТАРЫЕ / БУДУЩИЕ
    // ========================================================

    const insidePeriod =
      ordersWithDates.filter(
        (order) =>
          order.orderTime! >=
            periodStart.getTime() &&
          order.orderTime! <=
            periodEnd.getTime()
      );

    const olderThanPeriod =
      ordersWithDates.filter(
        (order) =>
          order.orderTime! <
          periodStart.getTime()
      );

    const newerThanPeriod =
      ordersWithDates.filter(
        (order) =>
          order.orderTime! >
          periodEnd.getTime()
      );

    // ========================================================
    // 6. НУЖНЫЕ НАМ ПРОДАЖИ FBW
    // ========================================================

    const fbwInside =
      insidePeriod.filter(
        (order) =>
          order.warehouse_type ===
          "Склад WB"
      );

    const activeFbwInside =
      fbwInside.filter(
        (order) =>
          order.is_cancel !==
          true
      );

    const cancelledFbwInside =
      fbwInside.filter(
        (order) =>
          order.is_cancel ===
          true
      );

    const sellerInside =
      insidePeriod.filter(
        (order) =>
          order.warehouse_type ===
          "Склад продавца"
      );

    // ========================================================
    // 7. УНИКАЛЬНЫЕ SKU С АКТИВНЫМИ FBW-ЗАКАЗАМИ
    // ========================================================

    const activeFbwSku =
      new Set<number>();

    for (
      const order of
      activeFbwInside
    ) {
      const nmId =
        Number(
          order.nm_id
        );

      if (
        Number.isFinite(
          nmId
        )
      ) {
        activeFbwSku.add(
          nmId
        );
      }
    }

    // ========================================================
    // 8. МИНИМАЛЬНАЯ / МАКСИМАЛЬНАЯ ДАТА В БАЗЕ
    // ========================================================

    const allOrderTimes =
      ordersWithDates
        .map(
          (order) =>
            order.orderTime
        )
        .filter(
          (
            value
          ): value is number =>
            value !== null
        );

    const minOrderDate =
      allOrderTimes.length >
      0
        ? new Date(
            Math.min(
              ...allOrderTimes
            )
          ).toISOString()
        : null;

    const maxOrderDate =
      allOrderTimes.length >
      0
        ? new Date(
            Math.max(
              ...allOrderTimes
            )
          ).toISOString()
        : null;

    // ========================================================
    // 9. ПРИМЕРЫ СТАРЫХ ЗАКАЗОВ
    // ========================================================

    const oldOrdersSample =
      [...olderThanPeriod]
        .sort(
          (a, b) =>
            a.orderTime! -
            b.orderTime!
        )
        .slice(0, 20)
        .map(
          (order) => ({
            srid:
              order.srid,

            orderDate:
              order.order_date,

            lastChangeDate:
              order.last_change_date,

            nmId:
              order.nm_id,

            supplierArticle:
              order.supplier_article,

            warehouseType:
              order.warehouse_type,

            isCancel:
              order.is_cancel,
          })
        );

    // ========================================================
    // 10. РЕЗУЛЬТАТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "Полный аудит заказов WB выполнен только по данным Supabase",

      wildberriesRequestSent:
        false,

      synchronization: {
        lastSuccessAt,

        lastAttemptAt,

        lastHttpStatus:
          state?.last_http_status ??
          null,

        lastMessage:
          state?.last_message ??
          null,
      },

      calculationPeriod: {
        days:
          SALES_DAYS,

        start:
          periodStart.toISOString(),

        end:
          periodEnd.toISOString(),

        basedOn:
          lastAttemptAt
            ? "last_attempt_at"
            : "last_success_at",
      },

      database: {
        totalRows:
          allOrders.length,

        pagesRead,

        pageSize:
          PAGE_SIZE,

        validOrderDates:
          ordersWithDates.length,

        invalidOrderDates:
          invalidOrderDateCount,

        minOrderDate,

        maxOrderDate,
      },

      periodAudit: {
        inside28Days:
          insidePeriod.length,

        olderThan28Days:
          olderThanPeriod.length,

        newerThanPeriod:
          newerThanPeriod.length,

        outside28Days:
          olderThanPeriod.length +
          newerThanPeriod.length,
      },

      inside28Days: {
        fbwOrders:
          fbwInside.length,

        activeFbwOrders:
          activeFbwInside.length,

        cancelledFbwOrders:
          cancelledFbwInside.length,

        sellerWarehouseOrders:
          sellerInside.length,

        activeFbwSkuCount:
          activeFbwSku.size,
      },

      oldOrdersSample,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка полного аудита заказов WB",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
