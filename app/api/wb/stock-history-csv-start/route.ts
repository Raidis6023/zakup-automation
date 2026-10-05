import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

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

  // Каждый новый отчёт WB должен иметь уникальный UUID.
  const reportId = randomUUID();

  const url =
    "https://seller-analytics-api.wildberries.ru/api/v2/nm-report/downloads";

  // Берём тот же день, который уже исследовали через /supplier/orders
  // и /stocks-report/products/sizes.
  const requestBody = {
    id: reportId,

    reportType: "STOCK_HISTORY_REPORT_CSV",

    userReportName: "WB stocks test 2026-10-04",

    params: {
      currentPeriod: {
        start: "2026-10-04",
        end: "2026-10-04",
      },

      // Только склады Wildberries — FBW.
      stockType: "wb",

      // Не скрываем удалённые карточки во время теста.
      skipDeletedNm: false,

      // Пустой массив = не фильтруем по статусу доступности.
      availabilityFilters: [],

      // Поле сортировки требуется схемой отчёта.
      orderBy: {
        field: "ordersCount",
        mode: "desc",
      },
    },
  };

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
            "Wildberries вернул ошибку при создании CSV-отчёта по остаткам",
          wbStatus: response.status,
          reportId,
          requestBody,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Задание на создание CSV-отчёта WB отправлено",
      wbStatus: response.status,

      // Обязательно сохраняем этот ID:
      // WB не обязан вернуть его обратно в теле ответа,
      // потому что UUID создаём мы сами.
      reportId,

      reportType: "STOCK_HISTORY_REPORT_CSV",

      period: {
        start: "2026-10-04",
        end: "2026-10-04",
      },

      rateLimit,
      wbResponse: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось создать CSV-отчёт Wildberries",
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
