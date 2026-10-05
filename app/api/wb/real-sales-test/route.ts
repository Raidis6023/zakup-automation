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

  // Берём данные за последние 7 дней.
  const dateFrom = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const url = new URL(
    "https://statistics-api.wildberries.ru/api/v1/supplier/sales"
  );

  url.searchParams.set("dateFrom", dateFrom);
  url.searchParams.set("flag", "0");

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
          message: "Wildberries вернул ошибку при чтении продаж",
          wbStatus: response.status,
          dateFrom,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    const sales = Array.isArray(data) ? data : [];

    // Собираем список складов, которые реально встретились
    const warehouseNames = Array.from(
      new Set(
        sales
          .map((item: any) => item?.warehouseName)
          .filter(Boolean)
      )
    ).sort();

    return NextResponse.json({
      ok: true,
      message: "Реальные продажи Wildberries получены",
      wbStatus: response.status,
      dateFrom,
      rateLimit,

      salesCount: sales.length,

      warehouseCount: warehouseNames.length,
      warehouses: warehouseNames,

      // Показываем первые 20 записей,
      // чтобы ответ не превратился в километровый JSON.
      sample: sales.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить продажи Wildberries",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
