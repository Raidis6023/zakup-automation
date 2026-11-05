import { getIntegrationSecret } from "@/lib/integrations/secrets";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getIntegrationSecret("wb_read_token");

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не найден WB_READ_TOKEN в Vercel",
      },
      { status: 500 }
    );
  }

  const url = "https://supplies-api.wildberries.ru/ping";

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
          ? "Боевой токен WB для категории Поставки работает"
          : "Wildberries отклонил токен или доступ к категории Поставки",
        wbStatus: response.status,
        wbResponse: data,
      },
      { status: response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось проверить подключение к WB",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
