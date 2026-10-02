import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.WB_TEST_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не найден WB_TEST_TOKEN в Vercel",
      },
      { status: 500 }
    );
  }

  const url =
    "https://supplies-api-sandbox.wildberries.ru/api/v1/supplies?limit=20&offset=0";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },

      // Фильтры пока не задаём.
      // WB должен вернуть последние доступные поставки.
      body: JSON.stringify({}),

      cache: "no-store",
    });

    const text = await response.text();

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Wildberries FBW Sandbox вернул ошибку",
          wbStatus: response.status,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    const supplies = Array.isArray(data) ? data : [];

    return NextResponse.json({
      ok: true,
      message: "Список FBW-поставок получен",
      wbStatus: response.status,
      suppliesCount: supplies.length,
      supplies: supplies,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось получить список FBW-поставок",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
