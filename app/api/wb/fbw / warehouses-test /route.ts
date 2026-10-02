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

  const url =
    "https://supplies-api-sandbox.wildberries.ru/api/v1/warehouses";

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

    const warehouses = Array.isArray(data) ? data : [];

    return NextResponse.json({
      ok: true,
      message: "Подключение к FBW-песочнице Wildberries работает",
      wbStatus: response.status,
      warehousesCount: warehouses.length,
      warehouses: warehouses.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось выполнить запрос к FBW-песочнице Wildberries",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
