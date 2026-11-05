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
  
  // ID задачи, которую только что создал Wildberries
  const taskId = "fb3998e1-f8c8-403f-ab1d-34801ec1c4f1";

  const url =
    `https://seller-analytics-api.wildberries.ru/api/v1/warehouse_remains/tasks/${taskId}/status`;

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
          message: "Wildberries вернул ошибку при проверке статуса отчёта",
          taskId,
          wbStatus: response.status,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Статус отчёта по остаткам получен",
      taskId,
      wbStatus: response.status,
      rateLimit,
      wbResponse: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось проверить статус отчёта WB",
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
