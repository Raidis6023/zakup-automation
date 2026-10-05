import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// ТЕСТ
// ============================================================

// Овощечистка AVD-VP1
const NM_ID = 1286384330;

// Метод WB принимает именно календарные даты.
//
// Берём 28 календарных дней:
// 08.09.2026 — 05.10.2026 включительно.
//
// ВАЖНО:
// наш основной procurement-real считает скользящие 28 × 24 часа,
// поэтому ordersCount этого теста НЕ ОБЯЗАН в точности быть равен 394.
// Сейчас главная задача — проверить детализацию ПО СКЛАДАМ.
const PERIOD_START = "2026-09-08";
const PERIOD_END = "2026-10-05";

const WB_URL =
  "https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/sizes";

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

type OfficeLike = {
  regionName?: string | null;
  officeID?: number | string | null;
  officeName?: string | null;

  metrics?: {
    ordersCount?: number | string | null;
    stockCount?: number | string | null;
    toClientCount?: number | string | null;
    fromClientCount?: number | string | null;
    buyoutCount?: number | string | null;
    avgOrders?: number | string | null;
  } | null;
};

type SizeLike = {
  name?: string | null;
  chrtID?: number | string | null;
  offices?: OfficeLike[] | null;
};

type ParsedResponse = {
  data?: {
    offices?: OfficeLike[] | null;
    sizes?: SizeLike[] | null;
    currency?: string | null;
  } | null;
};

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

  // ==========================================================
  // ТЕЛО ЗАПРОСА ПО ОФИЦИАЛЬНОЙ СХЕМЕ WB
  // ==========================================================

  const requestBody = {
    nmID: NM_ID,

    currentPeriod: {
      start: PERIOD_START,
      end: PERIOD_END,
    },

    stockType: "wb",

    orderBy: {
      field: "ordersCount",
      mode: "desc",
    },

    includeOffice: true,
  };

  try {
    // ========================================================
    // РОВНО ОДИН ЗАПРОС В WB
    // ========================================================

    const response =
      await fetch(
        WB_URL,
        {
          method: "POST",

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
    // ЕСЛИ WB ВЕРНУЛ ОШИБКУ
    // ========================================================

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "WB не вернул успешный ответ",

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
            nmID:
              NM_ID,

            period: {
              start:
                PERIOD_START,

              end:
                PERIOD_END,
            },

            stockType:
              "wb",

            includeOffice:
              true,
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
    // РАЗБИРАЕМ УСПЕШНЫЙ ОТВЕТ
    // ========================================================

    const parsed =
      responseBody as ParsedResponse;

    const data =
      parsed?.data;

    const topLevelOffices =
      Array.isArray(
        data?.offices
      )
        ? data!.offices!
        : [];

    const sizes =
      Array.isArray(
        data?.sizes
      )
        ? data!.sizes!
        : [];

    const sizeOfficeRows =
      sizes.flatMap(
        (size) => {
          const offices =
            Array.isArray(
              size.offices
            )
              ? size.offices
              : [];

          return offices.map(
            (office) => ({
              ...office,

              _sizeName:
                size.name ??
                null,

              _chrtID:
                size.chrtID ??
                null,
            })
          );
        }
      );

    // ========================================================
    // ВАЖНО
    //
    // Для товара без размеров WB обычно отдаёт data.offices.
    //
    // Для товара с размерами может использоваться
    // data.sizes[].offices.
    //
    // Если есть верхнеуровневые offices,
    // используем их.
    //
    // Иначе агрегируем offices из размеров.
    // ========================================================

    const officeSource =
      topLevelOffices.length >
      0
        ? "data.offices"
        : sizeOfficeRows.length >
          0
        ? "data.sizes[].offices"
        : "NO_OFFICES_FOUND";

    const sourceRows =
      topLevelOffices.length >
      0
        ? topLevelOffices
        : sizeOfficeRows;

    // ========================================================
    // АГРЕГИРУЕМ ПО СКЛАДУ
    //
    // Если данные пришли по размерам,
    // один склад может встретиться несколько раз.
    // ========================================================

    const officeMap =
      new Map<
        string,
        {
          regionName:
            string;

          officeID:
            number | null;

          officeName:
            string;

          ordersCount:
            number;

          stockCount:
            number;

          toClientCount:
            number;

          fromClientCount:
            number;

          buyoutCount:
            number;

          sourceRows:
            number;
        }
      >();

    for (
      const row of
      sourceRows
    ) {
      const officeIDNumber =
        Number(
          row.officeID
        );

      const officeID =
        Number.isFinite(
          officeIDNumber
        )
          ? officeIDNumber
          : null;

      const regionName =
        row.regionName ??
        "";

      const officeName =
        row.officeName ??
        "";

      const key =
        `${officeID ?? "null"}|${regionName}|${officeName}`;

      if (
        !officeMap.has(
          key
        )
      ) {
        officeMap.set(
          key,
          {
            regionName,

            officeID,

            officeName,

            ordersCount:
              0,

            stockCount:
              0,

            toClientCount:
              0,

            fromClientCount:
              0,

            buyoutCount:
              0,

            sourceRows:
              0,
          }
        );
      }

      const target =
        officeMap.get(
          key
        )!;

      target.ordersCount +=
        toNumber(
          row.metrics
            ?.ordersCount
        );

      target.stockCount +=
        toNumber(
          row.metrics
            ?.stockCount
        );

      target.toClientCount +=
        toNumber(
          row.metrics
            ?.toClientCount
        );

      target.fromClientCount +=
        toNumber(
          row.metrics
            ?.fromClientCount
        );

      target.buyoutCount +=
        toNumber(
          row.metrics
            ?.buyoutCount
        );

      target.sourceRows++;
    }

    const offices =
      Array.from(
        officeMap.values()
      );

    offices.sort(
      (a, b) =>
        b.ordersCount -
        a.ordersCount
    );

    // ========================================================
    // ИТОГИ
    // ========================================================

    const totalOrders =
      offices.reduce(
        (
          sum,
          office
        ) =>
          sum +
          office.ordersCount,
        0
      );

    const totalStock =
      offices.reduce(
        (
          sum,
          office
        ) =>
          sum +
          office.stockCount,
        0
      );

    const totalToClient =
      offices.reduce(
        (
          sum,
          office
        ) =>
          sum +
          office.toClientCount,
        0
      );

    const totalFromClient =
      offices.reduce(
        (
          sum,
          office
        ) =>
          sum +
          office.fromClientCount,
        0
      );

    // ========================================================
    // ПРОВЕРЯЕМ, ПОХОЖ ЛИ ОТВЕТ НА РЕАЛЬНУЮ
    // ДЕТАЛИЗАЦИЮ ПО ФИЗИЧЕСКИМ СКЛАДАМ
    // ========================================================

    const physicalLookingOffices =
      offices.filter(
        (office) =>
          office.officeName
            .trim()
            .length >
            0 &&
          office.officeID !==
            -999999
      );

    const aggregateLookingOffices =
      offices.filter(
        (office) =>
          office.officeName
            .trim()
            .length ===
            0 ||
          office.officeID ===
            -999999
      );

    const physicalWarehouseDetailFound =
      physicalLookingOffices.length >
      0;

    // ========================================================
    // РЕЗУЛЬТАТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        physicalWarehouseDetailFound
          ? "WB вернул детализацию, похожую на реальные склады"
          : "WB ответил успешно, но физическая детализация по складам пока не подтверждена",

      wildberriesRequestSent:
        true,

      wbStatus:
        response.status,

      warning:
        "Не обновляйте этот URL повторно сразу: у Basic-токена очень жёсткий лимит этого метода.",

      testPurpose: {
        step1:
          "Проверить, возвращает ли WB физические склады",

        step2:
          "Проверить ordersCount по каждому складу",

        step3:
          "Проверить stockCount по каждому складу",

        step4:
          "Понять, можно ли построить расчёт SKU × склад WB",
      },

      request: {
        nmID:
          NM_ID,

        article:
          "Овощечистка AVD-VP1",

        period: {
          start:
            PERIOD_START,

          end:
            PERIOD_END,

          calendarDays:
            28,
        },

        stockType:
          "wb",

        includeOffice:
          true,

        note:
          "Это 28 календарных дней. Основной procurement-real использует скользящие 28×24 часа, поэтому количество заказов может немного отличаться.",
      },

      responseStructure: {
        officeSource,

        topLevelOfficeRows:
          topLevelOffices.length,

        sizesCount:
          sizes.length,

        sizeOfficeRows:
          sizeOfficeRows.length,

        finalOfficeCount:
          offices.length,
      },

      warehouseDetailCheck: {
        physicalWarehouseDetailFound,

        physicalLookingOfficeCount:
          physicalLookingOffices.length,

        aggregateLookingOfficeCount:
          aggregateLookingOffices.length,
      },

      totals: {
        ordersCount:
          totalOrders,

        stockCount:
          totalStock,

        toClientCount:
          totalToClient,

        fromClientCount:
          totalFromClient,
      },

      offices,

      aggregateLookingOffices,

      raw:
        responseBody,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка теста детализации продаж WB по складам",

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
