import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WB_URL =
  "https://finance-api.wildberries.ru/api/finance/v1/sales-reports/detailed";

const DEFAULT_NM_ID = 1286384330;

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function toNumber(value: unknown): number {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

function getMoscowDateOffset(
  daysOffset: number
): string {
  const now = new Date();

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  const parts =
    formatter.formatToParts(now);

  const year =
    Number(
      parts.find(
        (part) => part.type === "year"
      )?.value
    );

  const month =
    Number(
      parts.find(
        (part) => part.type === "month"
      )?.value
    );

  const day =
    Number(
      parts.find(
        (part) => part.type === "day"
      )?.value
    );

  // Создаём UTC-дату только как удобный календарный объект.
  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  date.setUTCDate(
    date.getUTCDate() +
      daysOffset
  );

  const resultYear =
    date.getUTCFullYear();

  const resultMonth =
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0");

  const resultDay =
    String(
      date.getUTCDate()
    ).padStart(2, "0");

  return `${resultYear}-${resultMonth}-${resultDay}`;
}

// ============================================================
// ОСНОВНОЙ ROUTE
// ============================================================

export async function GET(
  request: Request
) {
  const token =
    process.env.WB_READ_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не найден WB_READ_TOKEN в Vercel",
      },
      {
        status: 500,
      }
    );
  }

  const url =
    new URL(request.url);

  const nmIdParam =
    url.searchParams.get("nmId");

  const nmId =
    nmIdParam
      ? Number(nmIdParam)
      : DEFAULT_NM_ID;

  if (
    !Number.isInteger(nmId) ||
    nmId <= 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Некорректный nmId",
        received:
          nmIdParam,
      },
      {
        status: 400,
      }
    );
  }

  // ==========================================================
  // БЕРЁМ 7 ПОЛНЫХ ПРОШЕДШИХ ДНЕЙ
  // ==========================================================

  const dateFrom =
    getMoscowDateOffset(-7);

  const dateTo =
    getMoscowDateOffset(-1);

  // ==========================================================
  // ЗАПРАШИВАЕМ ТОЛЬКО НУЖНЫЕ ПОЛЯ
  //
  // Нам сейчас не нужна вся финансовая простыня.
  // Цель — проверить именно officeName.
  // ==========================================================

  const requestBody = {
    dateFrom,
    dateTo,

    limit: 100000,

    rrdId: 0,

    period: "daily",

    fields: [
      "rrdId",
      "nmId",
      "officeName",
      "docTypeName",
      "sellerOperName",
      "quantity",
      "orderDt",
      "saleDt",
      "deliveryMethod",
      "srid",
      "giId",
    ],
  };

  try {
    // ========================================================
    // РОВНО ОДИН ЗАПРОС К WB
    //
    // У BASIC:
    // 2 запроса / 24 часа
    // интервал 12 часов.
    //
    // НИКАКИХ RETRY.
    // ========================================================

    const response =
      await fetch(
        WB_URL,
        {
          method: "POST",

          headers: {
            Authorization: token,
            Accept: "application/json",
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              requestBody
            ),

          cache: "no-store",
        }
      );

    // ========================================================
    // 204 — ДАННЫХ НЕТ
    // ========================================================

    if (
      response.status === 204
    ) {
      return NextResponse.json({
        ok: true,

        message:
          "WB вернул 204: финансовых строк за выбранный период нет",

        wbStatus: 204,

        nmId,

        period: {
          dateFrom,
          dateTo,
        },

        warning:
          "Не повторяйте запрос сразу. Для Basic лимит финансового метода — 2 запроса за 24 часа с интервалом 12 часов.",
      });
    }

    const text =
      await response.text();

    const parsed =
      parseJson(text);

    // ========================================================
    // ОШИБКА
    // ========================================================

    if (!response.ok) {
      let hint: string | null =
        null;

      if (
        response.status === 403
      ) {
        hint =
          "Если токен Basic, вероятная причина — в токене не включена категория «Финансы». Сам метод по актуальной документации доступен Basic.";
      }

      if (
        response.status === 429
      ) {
        hint =
          "Сработал лимит WB. Для Basic у этого метода 2 запроса за 24 часа и интервал 12 часов.";
      }

      return NextResponse.json(
        {
          ok: false,

          message:
            "WB finance detailed вернул ошибку",

          wbStatus:
            response.status,

          hint,

          period: {
            dateFrom,
            dateTo,
          },

          requestBody,

          rateLimit: {
            retryAfter:
              response.headers.get(
                "retry-after"
              ),

            limit:
              response.headers.get(
                "x-ratelimit-limit"
              ),

            remaining:
              response.headers.get(
                "x-ratelimit-remaining"
              ),

            reset:
              response.headers.get(
                "x-ratelimit-reset"
              ),
          },

          wbResponse:
            parsed,

          warning:
            "Не запускайте запрос повторно сразу.",
        },
        {
          status:
            response.status,
        }
      );
    }

    // ========================================================
    // УСПЕШНЫЙ ОТВЕТ
    // ========================================================

    if (!Array.isArray(parsed)) {
      return NextResponse.json({
        ok: false,

        message:
          "WB вернул успешный HTTP-ответ, но формат данных оказался неожиданным",

        wbStatus:
          response.status,

        wbResponse:
          parsed,
      });
    }

    const rows =
      parsed as Array<
        Record<string, unknown>
      >;

    // ========================================================
    // ВСЕ OFFICE NAME
    // ========================================================

    const allOfficeNames =
      Array.from(
        new Set(
          rows
            .map(
              (row) =>
                normalizeText(
                  row.officeName
                )
            )
            .filter(Boolean)
        )
      ).sort();

    // ========================================================
    // ТОЛЬКО НАША ОВОЩЕЧИСТКА
    // ========================================================

    const targetRows =
      rows.filter(
        (row) =>
          toNumber(
            row.nmId
          ) === nmId
      );

    const targetOfficeNames =
      Array.from(
        new Set(
          targetRows
            .map(
              (row) =>
                normalizeText(
                  row.officeName
                )
            )
            .filter(Boolean)
        )
      ).sort();

    // ========================================================
    // РАСПРЕДЕЛЕНИЕ СТРОК ПО OFFICE NAME ДЛЯ НАШЕГО SKU
    // ========================================================

    const officeCounter =
      new Map<
        string,
        number
      >();

    for (
      const row of targetRows
    ) {
      const officeName =
        normalizeText(
          row.officeName
        ) || "НЕ УКАЗАН";

      officeCounter.set(
        officeName,
        (
          officeCounter.get(
            officeName
          ) ?? 0
        ) + 1
      );
    }

    const targetByOffice =
      Array.from(
        officeCounter.entries()
      )
        .map(
          ([
            officeName,
            rowsCount,
          ]) => ({
            officeName,
            rowsCount,
          })
        )
        .sort(
          (a, b) =>
            b.rowsCount -
            a.rowsCount
        );

    // ========================================================
    // DOC TYPE
    // ========================================================

    const targetDocTypes =
      Array.from(
        new Set(
          targetRows
            .map(
              (row) =>
                normalizeText(
                  row.docTypeName
                )
            )
            .filter(Boolean)
        )
      ).sort();

    // ========================================================
    // DELIVERY METHOD
    // ========================================================

    const targetDeliveryMethods =
      Array.from(
        new Set(
          targetRows
            .map(
              (row) =>
                normalizeText(
                  row.deliveryMethod
                )
            )
            .filter(Boolean)
        )
      ).sort();

    // ========================================================
    // ОПРЕДЕЛЯЕМ, ПОХОЖИ ЛИ OFFICE NAME НА АГРЕГАТЫ
    // ========================================================

    const obviousAggregateNames =
      new Set([
        "Склад WB",
        "Склад WB РФ",
        "Склад WB СГТ РФ",
        "Свой склад РФ",
        "Свой склад СГТ РФ",
      ]);

    const possiblePhysicalOffices =
      targetOfficeNames.filter(
        (name) =>
          !obviousAggregateNames.has(
            name
          )
      );

    let conclusion: string;

    if (
      targetRows.length === 0
    ) {
      conclusion =
        "За выбранные 7 дней в финансовом отчёте не нашлось строк для этого nmId. По складской детализации этого SKU вывод сделать нельзя.";
    } else if (
      possiblePhysicalOffices.length >
      0
    ) {
      conclusion =
        "Интересный результат: для целевого SKU найдены officeName, которые не похожи на стандартные агрегаты WB. Их нужно проверить как возможные физические склады.";
    } else if (
      targetOfficeNames.length >
      0
    ) {
      conclusion =
        "Для целевого SKU officeName присутствует, но WB вернул только агрегированные названия складов.";
    } else {
      conclusion =
        "Финансовые строки целевого SKU есть, но поле officeName пустое.";
    }

    // ========================================================
    // ВЫВОД
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "WB finance detailed успешно проверен",

      wbStatus:
        response.status,

      request: {
        targetNmId:
          nmId,

        period: {
          dateFrom,
          dateTo,
        },
      },

      source: {
        totalRows:
          rows.length,

        lastRrdId:
          rows.length > 0
            ? rows[
                rows.length - 1
              ].rrdId ?? null
            : null,

        note:
          "Это первая страница финансового отчёта с rrdId=0. Для диагностического теста повторную страницу автоматически не запрашиваем из-за лимита Basic.",
      },

      allData: {
        uniqueOfficeNamesCount:
          allOfficeNames.length,

        uniqueOfficeNames:
          allOfficeNames,
      },

      targetSku: {
        nmId,

        rowsCount:
          targetRows.length,

        officeNames:
          targetOfficeNames,

        possiblePhysicalOffices,

        byOffice:
          targetByOffice,

        docTypes:
          targetDocTypes,

        deliveryMethods:
          targetDeliveryMethods,

        previewRows:
          targetRows.slice(
            0,
            50
          ),
      },

      conclusion,

      warning:
        "Для Basic у финансового метода очень жёсткий лимит. Не запускайте маршрут повторно.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка теста финансового отчёта WB",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      {
        status: 500,
      }
    );
  }
}
