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

  // incomeID из реального заказа
  const incomeID = 41397707;

  // Товар из того же заказа
  const targetNmID = 1286384330;

  const url = new URL(
    `https://supplies-api.wildberries.ru/api/v1/supplies/${incomeID}/goods`
  );

  url.searchParams.set("limit", "1000");
  url.searchParams.set("offset", "0");
  url.searchParams.set("isPreorderID", "false");

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

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    const rateLimit = {
      retryAfterSeconds:
        response.headers.get("x-ratelimit-retry"),
      resetAfterSeconds:
        response.headers.get("x-ratelimit-reset"),
      limit:
        response.headers.get("x-ratelimit-limit"),
      remaining:
        response.headers.get("x-ratelimit-remaining"),
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Wildberries вернул ошибку при получении товаров поставки",
          wbStatus: response.status,
          incomeID,
          targetNmID,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    const goods = Array.isArray(data) ? data : [];

    const targetProduct = goods.find(
      (item: any) => Number(item?.nmID) === targetNmID
    );

    return NextResponse.json({
      ok: true,
      message:
        "Товары FBW-поставки Wildberries получены",

      wbStatus: response.status,

      incomeID,
      targetNmID,

      rateLimit,

      goodsCount: goods.length,

      targetProductFound: Boolean(targetProduct),

      targetProduct: targetProduct ?? null,

      sample: goods.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не удалось получить товары FBW-поставки Wildberries",
        incomeID,
        targetNmID,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
