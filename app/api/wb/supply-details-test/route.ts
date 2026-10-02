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

  const supplyId = 41513381;

  const url =
    `https://supplies-api.wildberries.ru/api/v1/supplies/${supplyId}`;

  try {
    const response = await fetch(url, {
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

    // Читаем служебные заголовки лимитов WB
    const rateLimitRetry =
      response.headers.get("x-ratelimit-retry");

    const rateLimitReset =
      response.headers.get("x-ratelimit-reset");

    const rateLimitLimit =
      response.headers.get("x-ratelimit-limit");

    const rateLimitRemaining =
      response.headers.get("x-ratelimit-remaining");

    const rateLimit = {
      retryAfterSeconds: rateLimitRetry,
      resetAfterSeconds: rateLimitReset,
      burstLimit: rateLimitLimit,
      remaining: rateLimitRemaining,
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Wildberries вернул ошибку при чтении деталей поставки",
          supplyId,
          wbStatus: response.status,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Детали FBW-поставки получены",
      supplyId,
      wbStatus: response.status,
      rateLimit,
      supply: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить детали поставки WB",
        supplyId,
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
