import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getYesterdayMoscowDate() {
  const now = new Date();

  const moscowNow = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Europe/Moscow",
    })
  );

  moscowNow.setDate(moscowNow.getDate() - 1);

  const year = moscowNow.getFullYear();
  const month = String(moscowNow.getMonth() + 1).padStart(2, "0");
  const day = String(moscowNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function GET() {
  const token = process.env.WB_READ_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не найден WB_READ_TOKEN в Vercel",
      },
      { status: 500 }
    );
  }

  // Берём полный предыдущий день.
  // flag=1 означает: вернуть все заказы именно за указанную дату.
  const dateFrom = getYesterdayMoscowDate();

  const url = new URL(
    "https://statistics-api.wildberries.ru/api/v1/supplier/orders"
  );

  url.searchParams.set("dateFrom", dateFrom);
  url.searchParams.set("flag", "1");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: token,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const text = await response.text();

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    const rateLimit = {
      retryAfterSeconds: response.headers.get("x-ratelimit-retry"),
      resetAfterSeconds: response.headers.get("x-ratelimit-reset"),
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Wildberries вернул ошибку при чтении заказов",
          wbStatus: response.status,
          dateFrom,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    const orders = Array.isArray(data) ? data : [];

    const warehouseNames = Array.from(
      new Set(
        orders
          .map((item: any) => item?.warehouseName)
          .filter(Boolean)
      )
    ).sort();

    const warehouseTypes = Array.from(
      new Set(
        orders
          .map((item: any) => item?.warehouseType)
          .filter(Boolean)
      )
    ).sort();

    const cancelledOrders = orders.filter(
      (item: any) => item?.isCancel === true
    );

    const activeOrders = orders.filter(
      (item: any) => item?.isCancel !== true
    );

    const wbWarehouseOrders = orders.filter(
      (item: any) => item?.warehouseType === "Склад WB"
    );

    const sellerWarehouseOrders = orders.filter(
      (item: any) => item?.warehouseType === "Склад продавца"
    );

    return NextResponse.json({
      ok: true,
      message: "Реальные заказы Wildberries получены",
      wbStatus: response.status,

      dateFrom,
      rateLimit,

      ordersCount: orders.length,

      activeOrdersCount: activeOrders.length,
      cancelledOrdersCount: cancelledOrders.length,

      wbWarehouseOrdersCount: wbWarehouseOrders.length,
      sellerWarehouseOrdersCount: sellerWarehouseOrders.length,

      warehouseCount: warehouseNames.length,
      warehouses: warehouseNames,

      warehouseTypes,

      // Первые 30 заказов для анализа структуры.
      sample: orders.slice(0, 30),

      // Несколько отменённых отдельно,
      // чтобы сразу увидеть isCancel и cancelDate.
      cancelledSample: cancelledOrders.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить заказы Wildberries",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
