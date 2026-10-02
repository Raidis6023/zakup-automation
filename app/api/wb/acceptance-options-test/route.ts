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
    "https://supplies-api-sandbox.wildberries.ru/api/v1/acceptance/options";

  // Пока используем тестовые значения из примера документации WB.
  // Позже подставим наши реальные тестовые баркоды из песочницы.
  const requestBody = [
    {
      quantity: 1,
      barcode: "k",
    },
    {
      quantity: 7,
      barcode: "1111111111",
    },
  ];

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

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return NextResponse.json(
      {
        ok: response.ok,
        message: response.ok
          ? "Метод опций приёмки WB ответил успешно"
          : "Wildberries вернул ошибку",
        wbStatus: response.status,
        requestBody,
        wbResponse: data,
      },
      { status: response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось выполнить запрос к WB",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
