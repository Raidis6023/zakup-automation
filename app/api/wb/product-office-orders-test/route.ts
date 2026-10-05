import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

  // Тестовый реальный товар
  const nmID = 232169288;

  // Берём тот же день, который уже проверяли через /supplier/orders
  const currentPeriod = {
    start: "2026-10-04",
    end: "2026-10-04",
  };

  const url =
    "https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/sizes";

  const requestBody = {
    nmID,
    currentPeriod,

    // Только склады Wildberries — FBW
    stockType: "wb",

    // Обязательная сортировка по официальной схеме WB
    orderBy: {
      field: "avgOrders",
      mode: "desc",
    },

    // Самое важное:
    // просим детализацию по конкретным складам
    includeOffice: true,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });

    const text = await response.text();

    let data: any;

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
          message:
            "Wildberries вернул ошибку при получении статистики товара по складам",
          wbStatus: response.status,
          nmID,
          currentPeriod,
          requestBody,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    const offices = Array.isArray(data?.data?.offices)
      ? data.data.offices
      : [];

    const officeSummary = offices.map((office: any) => ({
      regionName: office?.regionName ?? null,
      officeID: office?.officeID ?? null,
      officeName: office?.officeName ?? null,

      ordersCount: office?.metrics?.ordersCount ?? null,
      ordersSum: office?.metrics?.ordersSum ?? null,
      avgOrders: office?.metrics?.avgOrders ?? null,

      buyoutCount: office?.metrics?.buyoutCount ?? null,
      buyoutSum: office?.metrics?.buyoutSum ?? null,

      stockCount: office?.metrics?.stockCount ?? null,
      saleRate: office?.metrics?.saleRate ?? null,
    }));

    const totalOrdersCount = officeSummary.reduce(
      (sum: number, office: any) =>
        sum +
        (typeof office.ordersCount === "number"
          ? office.ordersCount
          : 0),
      0
    );

    const totalStockCount = officeSummary.reduce(
      (sum: number, office: any) =>
        sum +
        (typeof office.stockCount === "number"
          ? office.stockCount
          : 0),
      0
    );

    return NextResponse.json({
      ok: true,
      message:
        "Статистика SKU по конкретным складам Wildberries получена",

      wbStatus: response.status,

      nmID,
      currentPeriod,

      rateLimit,

      officeCount: officeSummary.length,

      totalOrdersCount,
      totalStockCount,

      offices: officeSummary,

      // Оставляем полный ответ WB,
      // чтобы при необходимости посмотреть дополнительные поля.
      wbResponse: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не удалось получить статистику товара по складам Wildberries",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
