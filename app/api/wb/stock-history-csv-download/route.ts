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

  const reportId = "8054a889-bf8e-41b8-bc0a-7d7ab837d081";

  const url =
    `https://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads/file/${reportId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: token,
        Accept: "application/zip",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();

      let data: unknown;

      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return NextResponse.json(
        {
          ok: false,
          message: "Wildberries не дал скачать CSV-отчёт",
          wbStatus: response.status,

          rateLimit: {
            retryAfterSeconds:
              response.headers.get("x-ratelimit-retry"),
            resetAfterSeconds:
              response.headers.get("x-ratelimit-reset"),
            limit:
              response.headers.get("x-ratelimit-limit"),
            remaining:
              response.headers.get("x-ratelimit-remaining"),
          },

          wbResponse: data,
        },
        { status: response.status }
      );
    }

    const zipBuffer = await response.arrayBuffer();

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename="wb-stock-history-2026-10-04.zip"',
        "Content-Length": String(zipBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось скачать отчёт Wildberries",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
