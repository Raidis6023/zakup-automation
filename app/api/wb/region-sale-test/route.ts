import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// НАСТРОЙКИ
// ============================================================

// Овощечистка AVD-VP1
const TARGET_NM_ID = 1286384330;

// Берём тот же календарный период,
// который использовали в последнем Order Feed тесте.
const DATE_FROM = "2026-09-09";
const DATE_TO = "2026-10-06";

const WB_URL =
  "https://seller-analytics-api.wildberries.ru/api/v1/analytics/region-sale";

// ============================================================
// ТИПЫ
// ============================================================

type RegionSaleRow = {
  cityName?: string | null;

  countryName?: string | null;

  foName?: string | null;

  nmID?: number | string | null;

  regionName?: string | null;

  sa?: string | null;

  saleInvoiceCostPrice?: number | string | null;

  saleInvoiceCostPricePerc?: number | string | null;

  saleItemInvoiceQty?: number | string | null;
};

type RegionSaleResponse = {
  report?: RegionSaleRow[];
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function parseJson(
  text: string
): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toNumber(
  value: unknown
): number {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function normalizeText(
  value: unknown
): string {
  if (
    typeof value === "string" &&
    value.trim().length > 0
  ) {
    return value.trim();
  }

  return "НЕ УКАЗАНО";
}

function groupRows(
  rows: RegionSaleRow[],
  field:
    | "countryName"
    | "foName"
    | "regionName"
    | "cityName"
) {
  const map =
    new Map<
      string,
      number
    >();

  for (
    const row of
    rows
  ) {
    const name =
      normalizeText(
        row[field]
      );

    const quantity =
      toNumber(
        row.saleItemInvoiceQty
      );

    map.set(
      name,
      (
        map.get(name) ??
        0
      ) + quantity
    );
  }

  const total =
    Array.from(
      map.values()
    ).reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    );

  return Array.from(
    map.entries()
  )
    .map(
      (
        [
          name,
          quantity,
        ]
      ) => ({
        name,

        quantity,

        sharePercent:
          total > 0
            ? Number(
                (
                  (
                    quantity /
                    total
                  ) *
                  100
                ).toFixed(2)
              )
            : 0,
      })
    )
    .sort(
      (
        a,
        b
      ) =>
        b.quantity -
        a.quantity
    );
}

// ============================================================
// ОСНОВНОЙ МАРШРУТ
// ============================================================

export async function GET() {
  const wbToken =
    process.env.WB_READ_TOKEN;

  if (!wbToken) {
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

  const params =
    new URLSearchParams();

  params.set(
    "dateFrom",
    DATE_FROM
  );

  params.set(
    "dateTo",
    DATE_TO
  );

  const url =
    `${WB_URL}?${params.toString()}`;

  try {
    // ========================================================
    // ОДИН ЗАПРОС В WB
    // ========================================================

    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            Authorization:
              wbToken,

            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );

    const responseText =
      await response.text();

    const responseBody =
      parseJson(
        responseText
      );

    // ========================================================
    // ОШИБКА WB
    // ========================================================

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "WB region-sale вернул ошибку",

          wildberriesRequestSent:
            true,

          wbStatus:
            response.status,

          retryAfter:
            response.headers.get(
              "retry-after"
            ),

          rateLimitLimit:
            response.headers.get(
              "x-ratelimit-limit"
            ),

          rateLimitRemaining:
            response.headers.get(
              "x-ratelimit-remaining"
            ),

          request: {
            dateFrom:
              DATE_FROM,

            dateTo:
              DATE_TO,
          },

          wbResponse:
            responseBody,
        },
        {
          status:
            response.status,
        }
      );
    }

    // ========================================================
    // РАЗБИРАЕМ ОТВЕТ
    // ========================================================

    const parsed =
      responseBody as RegionSaleResponse;

    const report =
      Array.isArray(
        parsed?.report
      )
        ? parsed.report
        : [];

    // ========================================================
    // ОСТАВЛЯЕМ ТОЛЬКО НАШ SKU
    // ========================================================

    const targetRows =
      report.filter(
        (row) =>
          Number(
            row.nmID
          ) ===
          TARGET_NM_ID
      );

    // ========================================================
    // ОБЩЕЕ КОЛИЧЕСТВО ПРОДАННЫХ ЕДИНИЦ
    // ========================================================

    const totalSoldQuantity =
      targetRows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          toNumber(
            row.saleItemInvoiceQty
          ),
        0
      );

    // ========================================================
    // ГРУППИРУЕМ ГЕОГРАФИЮ
    // ========================================================

    const byCountry =
      groupRows(
        targetRows,
        "countryName"
      );

    const byFederalDistrict =
      groupRows(
        targetRows,
        "foName"
      );

    const byRegion =
      groupRows(
        targetRows,
        "regionName"
      );

    const byCity =
      groupRows(
        targetRows,
        "cityName"
      );

    // ========================================================
    // ПРОВЕРЯЕМ ЗАПОЛНЕННОСТЬ
    // ========================================================

    const rowsWithCountry =
      targetRows.filter(
        (row) =>
          normalizeText(
            row.countryName
          ) !==
          "НЕ УКАЗАНО"
      ).length;

    const rowsWithFederalDistrict =
      targetRows.filter(
        (row) =>
          normalizeText(
            row.foName
          ) !==
          "НЕ УКАЗАНО"
      ).length;

    const rowsWithRegion =
      targetRows.filter(
        (row) =>
          normalizeText(
            row.regionName
          ) !==
          "НЕ УКАЗАНО"
      ).length;

    const rowsWithCity =
      targetRows.filter(
        (row) =>
          normalizeText(
            row.cityName
          ) !==
          "НЕ УКАЗАНО"
      ).length;

    // ========================================================
    // НЕБОЛЬШОЙ ОБРАЗЕЦ СЫРЫХ СТРОК
    // ========================================================

    const sampleRows =
      targetRows
        .slice(
          0,
          30
        )
        .map(
          (row) => ({
            nmID:
              row.nmID ??
              null,

            sa:
              row.sa ??
              null,

            countryName:
              row.countryName ??
              null,

            foName:
              row.foName ??
              null,

            regionName:
              row.regionName ??
              null,

            cityName:
              row.cityName ??
              null,

            saleItemInvoiceQty:
              toNumber(
                row.saleItemInvoiceQty
              ),
          })
        );

    // ========================================================
    // ИТОГ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "Региональные продажи WB успешно получены",

      wildberriesRequestSent:
        true,

      wbStatus:
        response.status,

      testPurpose: {
        main:
          "Проверить официальный отчёт продаж WB по регионам",

        goal:
          "Понять, можно ли использовать региональную структуру продаж как основу для кластеров поставки",
      },

      request: {
        nmId:
          TARGET_NM_ID,

        article:
          "Овощечистка AVD-VP1",

        dateFrom:
          DATE_FROM,

        dateTo:
          DATE_TO,

        note:
          "Это отчёт по продажам, а не по всем неотменённым заказам. Поэтому totalSoldQuantity не обязан совпадать с 394 заказами procurement-real.",
      },

      response: {
        totalReportRows:
          report.length,

        targetSkuRows:
          targetRows.length,

        targetSkuFound:
          targetRows.length >
          0,
      },

      targetSku: {
        nmId:
          TARGET_NM_ID,

        totalSoldQuantity,

        geographyCoverage: {
          targetRows:
            targetRows.length,

          rowsWithCountry,

          rowsWithFederalDistrict,

          rowsWithRegion,

          rowsWithCity,

          countryCoveragePercent:
            targetRows.length >
            0
              ? Number(
                  (
                    (
                      rowsWithCountry /
                      targetRows.length
                    ) *
                    100
                  ).toFixed(2)
                )
              : 0,

          federalDistrictCoveragePercent:
            targetRows.length >
            0
              ? Number(
                  (
                    (
                      rowsWithFederalDistrict /
                      targetRows.length
                    ) *
                    100
                  ).toFixed(2)
                )
              : 0,

          regionCoveragePercent:
            targetRows.length >
            0
              ? Number(
                  (
                    (
                      rowsWithRegion /
                      targetRows.length
                    ) *
                    100
                  ).toFixed(2)
                )
              : 0,

          cityCoveragePercent:
            targetRows.length >
            0
              ? Number(
                  (
                    (
                      rowsWithCity /
                      targetRows.length
                    ) *
                    100
                  ).toFixed(2)
                )
              : 0,
        },

        byCountry,

        byFederalDistrict,

        byRegion,

        byCity,
      },

      sampleRows,

      conclusionHint:
        "Если byFederalDistrict и byRegion заполнены нормально, этот отчёт можно использовать для изучения региональной структуры спроса. Но количество продаж пока нельзя автоматически подставлять вместо количества неотменённых заказов.",

      warning:
        "Это диагностический тест. Текущий procurement-real он не изменяет.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка теста WB region-sale",

        wildberriesRequestSent:
          false,

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
