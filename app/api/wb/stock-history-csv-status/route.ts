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

  const url = new URL(
    "https://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads"
  );

  // Просим WB вернуть именно наш отчёт.
  url.searchParams.append("filter[downloadIds]", reportId);

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

    let data: any;

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
          message:
            "Wildberries вернул ошибку при проверке статуса CSV-отчёта",
          wbStatus: response.status,
          reportId,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    const reports = Array.isArray(data?.data) ? data.data : [];

    const report =
      reports.find((item: any) => item?.id === reportId) ?? null;

    if (!report) {
      return NextResponse.json({
        ok: false,
        message: "Наш отчёт не найден в ответе Wildberries",
        wbStatus: response.status,
        reportId,
        rateLimit,
        wbResponse: data,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Статус CSV-отчёта WB получен",
      wbStatus: response.status,
      reportId,
      rateLimit,

      status: report.status ?? null,
      createdAt: report.createdAt ?? null,
      name: report.name ?? null,
      size: report.size ?? null,
      startDate: report.startDate ?? null,
      endDate: report.endDate ?? null,

      report,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось проверить статус CSV-отчёта WB",
        reportId,
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
