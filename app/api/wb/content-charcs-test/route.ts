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
    "https://content-api-sandbox.wildberries.ru/content/v2/object/charcs/105";

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

    return NextResponse.json(
      {
        ok: response.ok,
        message: response.ok
          ? "Сервис характеристик Content Sandbox работает"
          : "Content Sandbox вернул ошибку",
        wbStatus: response.status,
        wbResponse: data,
      },
      { status: response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось обратиться к Content Sandbox WB",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
