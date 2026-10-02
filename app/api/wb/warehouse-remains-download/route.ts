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

  // ID уже готового отчёта WB
  const taskId = "fb3998e1-f8c8-403f-ab1d-34801ec1c4f1";

  const url =
    `https://seller-analytics-api.wildberries.ru/api/v1/warehouse_remains/tasks/${taskId}/download`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: token,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const rateLimit = {
      retryAfterSeconds: response.headers.get("x-ratelimit-retry"),
      resetAfterSeconds: response.headers.get("x-ratelimit-reset"),
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
    };

    // WB с 2026 года возвращает 204,
    // если готовый отчёт не содержит данных.
    if (response.status === 204) {
      return NextResponse.json({
        ok: true,
        message: "Отчёт сформирован, но данных по остаткам нет",
        taskId,
        wbStatus: 204,
        rateLimit,
        recordsCount: 0,
        sample: [],
      });
    }

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
          message: "Wildberries вернул ошибку при скачивании отчёта",
          taskId,
          wbStatus: response.status,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    const records = Array.isArray(data) ? data : [];

    return NextResponse.json({
      ok: true,
      message: "Отчёт по остаткам WB успешно скачан",
      taskId,
      wbStatus: response.status,
      rateLimit,
      recordsCount: records.length,

      // Пока показываем только первые 10 товаров,
      // чтобы браузер не захлебнулся огромным JSON.
      sample: records.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось скачать отчёт по остаткам WB",
        taskId,
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
