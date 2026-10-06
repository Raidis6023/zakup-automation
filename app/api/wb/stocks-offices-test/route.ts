import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// НАСТРОЙКИ
// ============================================================

// Овощечистка AVD-VP1
const DEFAULT_NM_ID = 1286384330;

const WB_URL =
  "https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/offices";

// ============================================================
// ТИПЫ
// ============================================================

type StockMetrics = {
  stockCount?: number | string | null;
  stockSum?: number | string | null;

  toClientCount?: number | string | null;
  fromClientCount?: number | string | null;

  saleRate?: {
    days?: number | null;
    hours?: number | null;
  } | null;

  avgStockTurnover?: {
    days?: number | null;
    hours?: number | null;
  } | null;
};

type OfficeRow = {
  officeID?: number | string | null;
  officeName?: string | null;
  metrics?: StockMetrics | null;
};

type RegionRow = {
  regionName?: string | null;
  metrics?: StockMetrics | null;
  offices?: OfficeRow[] | null;
};

type WBResponse = {
  data?: {
    regions?: RegionRow[] | null;
    currency?: string | null;
  } | null;
};

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

function toNumber(
  value: unknown,
  fallback = 0
): number {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : fallback;
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

  return "";
}

function getMoscowDate(): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Europe/Moscow",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "Не удалось определить текущую дату по Москве"
    );
  }

  return `${year}-${month}-${day}`;
}

function normalizeMetrics(
  metrics:
    | StockMetrics
    | null
    | undefined
) {
  return {
    stockCount:
      toNumber(
        metrics?.stockCount
      ),

    stockSum:
      toNumber(
        metrics?.stockSum
      ),

    toClientCount:
      toNumber(
        metrics?.toClientCount
      ),

    fromClientCount:
      toNumber(
        metrics?.fromClientCount
      ),

    saleRate:
      metrics?.saleRate ??
      null,

    avgStockTurnover:
      metrics?.avgStockTurnover ??
      null,
  };
}

// ============================================================
// ОСНОВНОЙ ROUTE
// ============================================================

export async function GET(
  request: Request
) {
  // ==========================================================
  // 1. БЕРЁМ НАШ ОБЫЧНЫЙ BASIC TOKEN
  // ==========================================================

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

  // ==========================================================
  // 2. NM ID
  //
  // По умолчанию овощечистка.
  //
  // Но потом можно открыть:
  //
  // /api/wb/stocks-offices-test?nmId=123456789
  //
  // и проверить любой другой SKU.
  // ==========================================================

  const requestUrl =
    new URL(
      request.url
    );

  const nmIdParam =
    requestUrl.searchParams.get(
      "nmId"
    );

  const nmId =
    nmIdParam
      ? Number(nmIdParam)
      : DEFAULT_NM_ID;

  if (
    !Number.isInteger(
      nmId
    ) ||
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
  // 3. ТЕКУЩАЯ ДАТА ПО МОСКВЕ
  // ==========================================================

  const reportDate =
    getMoscowDate();

  // ==========================================================
  // 4. ТЕЛО ЗАПРОСА
  //
  // stockType = wb
  // означает, что нас интересуют именно склады Wildberries,
  // а не FBS / собственные склады продавца.
  // ==========================================================

  const requestBody = {
    nmIDs: [
      nmId,
    ],

    subjectIDs: [],

    brandNames: [],

    tagIDs: [],

    currentPeriod: {
      start:
        reportDate,

      end:
        reportDate,
    },

    stockType:
      "wb",

    skipDeletedNm:
      false,
  };

  try {
    // ========================================================
    // 5. РОВНО ОДИН ЗАПРОС В WB
    //
    // НИКАКИХ RETRY.
    // НИКАКИХ ПОВТОРОВ.
    //
    // У BASIC ЖЁСТКИЙ ЛИМИТ.
    // ========================================================

    const response =
      await fetch(
        WB_URL,
        {
          method:
            "POST",

          headers: {
            Authorization:
              wbToken,

            Accept:
              "application/json",

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              requestBody
            ),

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
    // 6. ЕСЛИ WB ВЕРНУЛ ОШИБКУ
    // ========================================================

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "WB stocks-report/offices вернул ошибку",

          wildberriesRequestSent:
            true,

          wbStatus:
            response.status,

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

          request: {
            nmId,

            reportDate,

            body:
              requestBody,
          },

          wbResponse:
            responseBody,

          warning:
            "Не запускайте маршрут повторно сразу. У Basic-токена этого метода жёсткий лимит.",
        },
        {
          status:
            response.status,
        }
      );
    }

    // ========================================================
    // 7. РАЗБИРАЕМ УСПЕШНЫЙ ОТВЕТ
    // ========================================================

    const parsed =
      responseBody as
        WBResponse;

    const regions =
      Array.isArray(
        parsed?.data?.regions
      )
        ? parsed.data!.regions!
        : [];

    // ========================================================
    // 8. НОРМАЛИЗУЕМ РЕГИОНЫ
    // ========================================================

    const normalizedRegions =
      regions.map(
        (region) => {
          const offices =
            Array.isArray(
              region.offices
            )
              ? region.offices
              : [];

          const normalizedOffices =
            offices.map(
              (office) => {
                const officeIDRaw =
                  Number(
                    office.officeID
                  );

                const officeID =
                  Number.isFinite(
                    officeIDRaw
                  )
                    ? officeIDRaw
                    : null;

                return {
                  officeID,

                  officeName:
                    normalizeText(
                      office.officeName
                    ),

                  metrics:
                    normalizeMetrics(
                      office.metrics
                    ),
                };
              }
            );

          return {
            regionName:
              normalizeText(
                region.regionName
              ),

            metrics:
              normalizeMetrics(
                region.metrics
              ),

            offices:
              normalizedOffices,
          };
        }
      );

    // ========================================================
    // 9. СОБИРАЕМ ВСЕ ФИЗИЧЕСКИЕ СКЛАДЫ
    // ========================================================

    const physicalWarehouses =
      normalizedRegions.flatMap(
        (region) =>
          region.offices.map(
            (office) => ({
              regionName:
                region.regionName,

              officeID:
                office.officeID,

              officeName:
                office.officeName,

              stockCount:
                office.metrics
                  .stockCount,

              stockSum:
                office.metrics
                  .stockSum,

              toClientCount:
                office.metrics
                  .toClientCount,

              fromClientCount:
                office.metrics
                  .fromClientCount,

              saleRate:
                office.metrics
                  .saleRate,

              avgStockTurnover:
                office.metrics
                  .avgStockTurnover,
            })
          )
      );

    // ========================================================
    // 10. РЕГИОНЫ БЕЗ ДЕТАЛИЗАЦИИ ПО СКЛАДАМ
    //
    // Это особенно важно.
    //
    // Если stockCount есть, а offices пуст,
    // значит WB показал остаток только агрегированно.
    // ========================================================

    const regionsWithoutOfficeDetail =
      normalizedRegions
        .filter(
          (region) =>
            region.offices.length ===
            0
        )
        .map(
          (region) => ({
            regionName:
              region.regionName,

            stockCount:
              region.metrics
                .stockCount,

            stockSum:
              region.metrics
                .stockSum,

            toClientCount:
              region.metrics
                .toClientCount,

            fromClientCount:
              region.metrics
                .fromClientCount,

            saleRate:
              region.metrics
                .saleRate,

            avgStockTurnover:
              region.metrics
                .avgStockTurnover,
          })
        );

    // ========================================================
    // 11. СЧИТАЕМ ОСТАТОК ПО ФИЗИЧЕСКИМ СКЛАДАМ
    // ========================================================

    const physicalStock =
      physicalWarehouses.reduce(
        (
          sum,
          warehouse
        ) =>
          sum +
          warehouse.stockCount,
        0
      );

    // ========================================================
    // 12. СЧИТАЕМ АГРЕГИРОВАННЫЙ ОСТАТОК
    // ========================================================

    const aggregateStock =
      regionsWithoutOfficeDetail.reduce(
        (
          sum,
          region
        ) =>
          sum +
          region.stockCount,
        0
      );

    // ========================================================
    // 13. РЕГИОНАЛЬНЫЕ ИТОГИ
    //
    // ВАЖНО:
    // это отдельная диагностическая сумма.
    //
    // Мы НЕ складываем её с physicalStock,
    // потому что region.metrics может уже включать
    // остатки дочерних offices.
    // ========================================================

    const regionMetricsTotalStock =
      normalizedRegions.reduce(
        (
          sum,
          region
        ) =>
          sum +
          region.metrics
            .stockCount,
        0
      );

    // ========================================================
    // 14. ПРОВЕРЯЕМ, ЕСТЬ ЛИ РЕАЛЬНАЯ СКЛАДСКАЯ ДЕТАЛИЗАЦИЯ
    // ========================================================

    const physicalWarehouseNames =
      Array.from(
        new Set(
          physicalWarehouses
            .map(
              (warehouse) =>
                warehouse.officeName
            )
            .filter(
              (
                name
              ) =>
                name.length >
                0
            )
        )
      );

    const hasPhysicalWarehouses =
      physicalWarehouses.length >
      0;

    const hasAggregatedRegions =
      regionsWithoutOfficeDetail.some(
        (region) =>
          region.stockCount >
          0
      );

    // ========================================================
    // 15. ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА
    //
    // Сумма offices внутри каждого региона
    // против region.metrics.stockCount.
    //
    // Это поможет понять, есть ли скрытая часть остатка.
    // ========================================================

    const regionChecks =
      normalizedRegions.map(
        (region) => {
          const officeStockSum =
            region.offices.reduce(
              (
                sum,
                office
              ) =>
                sum +
                office.metrics
                  .stockCount,
              0
            );

          const regionStock =
            region.metrics
              .stockCount;

          const difference =
            regionStock -
            officeStockSum;

          return {
            regionName:
              region.regionName,

            regionStock,

            officeStockSum,

            difference,

            officeCount:
              region.offices.length,

            fullyExplainedByOffices:
              difference === 0 &&
              region.offices.length >
                0,
          };
        }
      );

    // ========================================================
    // 16. ВЫВОД
    // ========================================================

    let conclusion:
      string;

    if (
      hasPhysicalWarehouses &&
      !hasAggregatedRegions
    ) {
      conclusion =
        "Успех: WB вернул поскладочную детализацию. Проверьте regionChecks: если difference=0, остаток региона полностью объясняется физическими складами.";
    } else if (
      hasPhysicalWarehouses &&
      hasAggregatedRegions
    ) {
      conclusion =
        "Частичный успех: WB вернул реальные физические склады, но есть и регионы с агрегированным остатком без списка складов.";
    } else if (
      !hasPhysicalWarehouses &&
      hasAggregatedRegions
    ) {
      conclusion =
        "WB вернул остатки, но не раскрыл физические склады: данные пришли только на уровне агрегированных регионов.";
    } else {
      conclusion =
        "Метод ответил успешно, но положительных складских остатков для выбранного SKU не найдено.";
    }

    return NextResponse.json({
      ok: true,

      message:
        "WB stocks-report/offices успешно проверен",

      wildberriesRequestSent:
        true,

      wbStatus:
        response.status,

      request: {
        nmId,

        article:
          nmId ===
            DEFAULT_NM_ID
            ? "Овощечистка AVD-VP1"
            : null,

        reportDate,

        stockType:
          "wb",
      },

      response: {
        currency:
          parsed?.data
            ?.currency ??
          null,

        regionsCount:
          normalizedRegions.length,

        physicalWarehouseRows:
          physicalWarehouses.length,

        regionsWithoutOfficeDetail:
          regionsWithoutOfficeDetail.length,
      },

      summary: {
        hasPhysicalWarehouses,

        hasAggregatedRegions,

        physicalWarehouseCount:
          physicalWarehouses.length,

        physicalWarehouseNames,

        physicalStock,

        aggregateStockFromRegionsWithoutOffices:
          aggregateStock,

        regionMetricsTotalStock,

        important:
          "regionMetricsTotalStock нельзя складывать с physicalStock: региональный итог может уже включать склады внутри региона.",
      },

      regionChecks,

      physicalWarehouses,

      regionsWithoutOfficeDetail,

      regions:
        normalizedRegions,

      conclusion,

      raw:
        responseBody,

      warning:
        "Basic-токен: не запускайте этот маршрут повторно сразу из-за лимита метода.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка теста WB stocks-report/offices",

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
