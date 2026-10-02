import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.WB_TEST_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: "В Vercel не найдена переменная WB_TEST_TOKEN",
      },
      { status: 500 }
    );
  }

  const dateFrom = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const url = new URL(
    "https://statistics-api-sandbox.wildberries.ru/api/v1/supplier/sales"
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

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Wildberries вернул ошибку",
          wbStatus: response.status,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    const sales = Array.isArray(data) ? data : [];

    return NextResponse.json({
      ok: true,
      message: "Подключение к тестовому API Wildberries работает",
      wbStatus: response.status,
      dateFrom,
      salesCount: sales.length,
      sample: sales.slice(0, 3),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось выполнить запрос к Wildberries",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
