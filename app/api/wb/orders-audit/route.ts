import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SALES_DAYS = 28;

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
    // 1. ПОСЛЕДНЯЯ УСПЕШНАЯ СИНХРОНИЗАЦИЯ ORDERS
    // ========================================================

    const stateUrl =
      `${supabaseUrl}/rest/v1/wb_sync_state` +
      "?sync_key=eq.orders" +
      "&select=last_success_at,last_attempt_at,last_http_status,last_message" +
      "&limit=1";

    const stateResponse =
      await fetch(stateUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

    if (!stateResponse.ok) {
      const text =
        await stateResponse.text();

      return NextResponse.json(
        {
          ok: false,
          message:
            "Не удалось получить состояние синхронизации orders",
          supabaseStatus:
            stateResponse.status,
          supabaseResponse:
            text,
        },
        { status: 500 }
      );
    }

    const stateRows =
      await stateResponse.json();

    const state =
      Array.isArray(stateRows)
        ? stateRows[0]
        : null;

    const lastSuccessAt =
      state?.last_success_at;

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
    // 2. ФИКСИРУЕМ ТОЧНОЕ ОКНО 28 ДНЕЙ
    // ========================================================

    const periodEnd =
      new Date(lastSuccessAt);

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
    // 3. ЧИТАЕМ ВСЕ СОХРАНЁННЫЕ ЗАКАЗЫ
    // ========================================================

    const ordersUrl =
      `${supabaseUrl}/rest/v1/wb_orders` +
      "?select=srid,order_date,last_change_date,nm_id,supplier_article,warehouse_name,warehouse_type,is_cancel,cancel_date,income_id,synced_at" +
      "&limit=20000";

    const ordersResponse =
      await fetch(ordersUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

    if (!ordersResponse.ok) {
      const text =
        await ordersResponse.text();

      return NextResponse.json(
        {
          ok: false,
          message:
            "Не удалось получить wb_orders из Supabase",
          supabaseStatus:
            ordersResponse.status,
          supabaseResponse:
            text,
        },
        { status: 500 }
      );
    }

    const orders =
      await ordersResponse.json();

    if (!Array.isArray(orders)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Supabase вернул неожиданный формат wb_orders",
        },
        { status: 500 }
      );
    }

    // ========================================================
    // 4. АУДИТ ДАТ
    // ========================================================

    const validDates =
      orders
        .map((order: any) => ({
          ...order,

          orderTime:
            new Date(
              order.order_date
            ).getTime(),

          changeTime:
            order.last_change_date
              ? new Date(
                  order.last_change_date
                ).getTime()
              : null,
        }))
        .filter(
          (order: any) =>
            Number.isFinite(
              order.orderTime
            )
        );

    const insidePeriod =
      validDates.filter(
        (order: any) =>
          order.orderTime >=
            periodStart.getTime() &&
          order.orderTime <=
            periodEnd.getTime()
      );

    const outsidePeriod =
      validDates.filter(
        (order: any) =>
          order.orderTime <
            periodStart.getTime() ||
          order.orderTime >
            periodEnd.getTime()
      );

    // ========================================================
    // 5. FBW ЗА НУЖНЫЕ 28 ДНЕЙ
    // ========================================================

    const fbwInside =
      insidePeriod.filter(
        (order: any) =>
          order.warehouse_type ===
          "Склад WB"
      );

    const activeFbwInside =
      fbwInside.filter(
        (order: any) =>
          order.is_cancel !== true
      );

    const cancelledFbwInside =
      fbwInside.filter(
        (order: any) =>
          order.is_cancel === true
      );

    const sellerInside =
      insidePeriod.filter(
        (order: any) =>
          order.warehouse_type ===
          "Склад продавца"
      );

    // ========================================================
    // 6. УНИКАЛЬНЫЕ SKU
    // ========================================================

    const activeFbwSku =
      new Set<number>();

    for (
      const order of activeFbwInside
    ) {
      const nmId =
        Number(order.nm_id);

      if (
        Number.isFinite(nmId)
      ) {
        activeFbwSku.add(nmId);
      }
    }

    // ========================================================
    // 7. МИНИМАЛЬНАЯ / МАКСИМАЛЬНАЯ ДАТА
    // ========================================================

    const orderTimes =
      validDates.map(
        (order: any) =>
          order.orderTime
      );

    const minOrderDate =
      orderTimes.length > 0
        ? new Date(
            Math.min(
              ...orderTimes
            )
          ).toISOString()
        : null;

    const maxOrderDate =
      orderTimes.length > 0
        ? new Date(
            Math.max(
              ...orderTimes
            )
          ).toISOString()
        : null;

    // ========================================================
    // 8. ПРИМЕРЫ СТАРЫХ ЗАКАЗОВ
    // ========================================================

    const outsideSample =
      outsidePeriod
        .sort(
          (
            a: any,
            b: any
          ) =>
            a.orderTime -
            b.orderTime
        )
        .slice(0, 20)
        .map(
          (order: any) => ({
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
    // 9. РЕЗУЛЬТАТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "Аудит заказов WB выполнен только по данным Supabase",

      wildberriesRequestSent:
        false,

      synchronization: {
        lastSuccessAt,
        lastAttemptAt:
          state?.last_attempt_at ??
          null,
        lastHttpStatus:
          state?.last_http_status ??
          null,
      },

      calculationPeriod: {
        days:
          SALES_DAYS,

        start:
          periodStart.toISOString(),

        end:
          periodEnd.toISOString(),
      },

      database: {
        totalRows:
          orders.length,

        validOrderDates:
          validDates.length,

        minOrderDate,

        maxOrderDate,
      },

      periodAudit: {
        inside28Days:
          insidePeriod.length,

        outside28Days:
          outsidePeriod.length,
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

      outsidePeriodSample:
        outsideSample,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка аудита заказов WB",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
