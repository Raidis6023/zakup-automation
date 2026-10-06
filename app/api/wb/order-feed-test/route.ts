import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// НАСТРОЙКИ ТЕСТА
// ============================================================

// Овощечистка AVD-VP1
const TARGET_NM_ID = 1286384330;

// Проверяем последние 28 календарных дней.
// Order Feed фильтруется по дате ТЕКУЩЕГО СТАТУСА заказа,
// а не строго по дате первоначального заказа.
const PERIOD_DAYS = 28;

const WB_URL =
  "https://seller-analytics-api.wildberries.ru/api/analytics/v1/order-feed";

// Один запрос максимум.
// Специально НЕ делаем автоматическую пагинацию,
// потому что у Basic-токена лимит 1 запрос / 3 часа.
const LIMIT = 1000;

// ============================================================
// ТИПЫ
// ============================================================

type OrderFeedOrder = {
  nmId?: number;
  chrtId?: number;

  srid?: string;

  createdAt?: string;
  updatedAt?: string;

  status?: string;
  cancelType?: string | null;

  warehouseName?: string | null;
  warehouseRegion?: string | null;

  isMp?: boolean;

  destinationCity?: string | null;
  destinationDistrict?: string | null;

  sellerPrice?: number;
  isB2b?: boolean;
};

type OrderFeedResponse = {
  data?: {
    snapshotTime?: string;
    currency?: string;
    orders?: OrderFeedOrder[];
  };
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

function getMoscowPeriod(days: number) {
  // Москва сейчас UTC+3.
  const now = new Date();

  const moscowNow =
    new Date(
      now.getTime() +
        3 * 60 * 60 * 1000
    );

  const endDate =
    moscowNow
      .toISOString()
      .slice(0, 10);

  const startDateObject =
    new Date(
      `${endDate}T00:00:00Z`
    );

  startDateObject.setUTCDate(
    startDateObject.getUTCDate() -
      (days - 1)
  );

  const startDate =
    startDateObject
      .toISOString()
      .slice(0, 10);

  return {
    start:
      `${startDate}T00:00:00+03:00`,

    end:
      `${endDate}T23:59:59+03:00`,
  };
}

function normalizeText(
  value: unknown,
  fallback = "ПУСТО"
): string {
  if (
    typeof value === "string" &&
    value.trim().length > 0
  ) {
    return value.trim();
  }

  return fallback;
}

function countValues(
  values: string[]
) {
  const map =
    new Map<
      string,
      number
    >();

  for (
    const value of values
  ) {
    map.set(
      value,
      (
        map.get(value) ??
        0
      ) + 1
    );
  }

  return Array.from(
    map.entries()
  )
    .map(
      (
        [
          name,
          count,
        ]
      ) => ({
        name,
        count,
      })
    )
    .sort(
      (a, b) =>
        b.count -
        a.count
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

  const period =
    getMoscowPeriod(
      PERIOD_DAYS
    );

  // ==========================================================
  // ТЕЛО ЗАПРОСА
  // ==========================================================

  const requestBody = {
    selectedPeriod: {
      start:
        period.start,

      end:
        period.end,
    },

    nmIds: [
      TARGET_NM_ID,
    ],

    pagination: {
      offset:
        0,

      limit:
        LIMIT,
    },
  };

  try {
    // ========================================================
    // ВАЖНО:
    //
    // ЗДЕСЬ РОВНО ОДИН ЗАПРОС В WILDBERRIES.
    //
    // НИКАКИХ RETRY.
    // НИКАКОЙ АВТОПАГИНАЦИИ.
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

    const text =
      await response.text();

    const body =
      parseJson(
        text
      );

    // ========================================================
    // ЕСЛИ WB ВЕРНУЛ ОШИБКУ
    // ========================================================

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Order Feed WB вернул ошибку",

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

          request:
            requestBody,

          wbResponse:
            body,

          warning:
            "Не обновляйте страницу повторно. У Basic-токена лимит Order Feed — 1 запрос раз в 3 часа.",
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
      body as OrderFeedResponse;

    const orders =
      Array.isArray(
        parsed?.data?.orders
      )
        ? parsed.data!.orders!
        : [];

    // ========================================================
    // СКЛАДЫ
    // ========================================================

    const warehouseNames =
      countValues(
        orders.map(
          (order) =>
            normalizeText(
              order.warehouseName
            )
        )
      );

    const warehouseRegions =
      countValues(
        orders.map(
          (order) =>
            normalizeText(
              order.warehouseRegion
            )
        )
      );

    // ========================================================
    // ГЕОГРАФИЯ ПОКУПАТЕЛЕЙ
    // ========================================================

    const destinationDistricts =
      countValues(
        orders.map(
          (order) =>
            normalizeText(
              order.destinationDistrict
            )
        )
      );

    const destinationCities =
      countValues(
        orders.map(
          (order) =>
            normalizeText(
              order.destinationCity
            )
        )
      );

    // ========================================================
    // СТАТУСЫ
    // ========================================================

    const statuses =
      countValues(
        orders.map(
          (order) =>
            normalizeText(
              order.status
            )
        )
      );

    const cancelTypes =
      countValues(
        orders
          .filter(
            (order) =>
              order.status ===
              "cancel"
          )
          .map(
            (order) =>
              normalizeText(
                order.cancelType
              )
          )
      );

    // ========================================================
    // ПРОВЕРКА — ЕСТЬ ЛИ РЕАЛЬНЫЕ НАЗВАНИЯ СКЛАДОВ
    // ========================================================

    const realWarehouseNames =
      warehouseNames.filter(
        (item) => {
          const value =
            item.name
              .toLowerCase();

          return (
            value !==
              "склад wb" &&
            value !==
              "пусто"
          );
        }
      );

    const physicalWarehouseDetailFound =
      realWarehouseNames.length >
      0;

    // ========================================================
    // ПРОВЕРКА ГЕОГРАФИИ
    // ========================================================

    const ordersWithDestinationDistrict =
      orders.filter(
        (order) =>
          typeof order.destinationDistrict ===
            "string" &&
          order.destinationDistrict
            .trim()
            .length >
            0
      ).length;

    const ordersWithDestinationCity =
      orders.filter(
        (order) =>
          typeof order.destinationCity ===
            "string" &&
          order.destinationCity
            .trim()
            .length >
            0
      ).length;

    const districtCoveragePercent =
      orders.length >
      0
        ? Number(
            (
              (
                ordersWithDestinationDistrict /
                orders.length
              ) *
              100
            ).toFixed(2)
          )
        : 0;

    const cityCoveragePercent =
      orders.length >
      0
        ? Number(
            (
              (
                ordersWithDestinationCity /
                orders.length
              ) *
              100
            ).toFixed(2)
          )
        : 0;

    // ========================================================
    // НЕБОЛЬШОЙ ОБРАЗЕЦ СТРОК
    // ========================================================

    const sampleOrders =
      orders
        .slice(
          0,
          20
        )
        .map(
          (order) => ({
            nmId:
              order.nmId ??
              null,

            srid:
              order.srid ??
              null,

            createdAt:
              order.createdAt ??
              null,

            updatedAt:
              order.updatedAt ??
              null,

            status:
              order.status ??
              null,

            cancelType:
              order.cancelType ??
              null,

            warehouseName:
              order.warehouseName ??
              null,

            warehouseRegion:
              order.warehouseRegion ??
              null,

            destinationDistrict:
              order.destinationDistrict ??
              null,

            destinationCity:
              order.destinationCity ??
              null,

            isMp:
              order.isMp ??
              null,
          })
        );

    // ========================================================
    // ИТОГ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        physicalWarehouseDetailFound
          ? "Order Feed вернул реальные названия складов WB"
          : "Order Feed не подтвердил детализацию по физическим складам WB",

      wildberriesRequestSent:
        true,

      wbStatus:
        response.status,

      testPurpose: {
        main:
          "Проверить, показывает ли новый Order Feed физический склад WB",

        additional:
          "Проверить географию покупателя через destinationDistrict и destinationCity",
      },

      request: {
        nmId:
          TARGET_NM_ID,

        article:
          "Овощечистка AVD-VP1",

        periodDays:
          PERIOD_DAYS,

        selectedPeriod:
          period,

        important:
          "Order Feed фильтруется по дате текущего статуса заказа, поэтому количество строк нельзя напрямую сравнивать с 394 заказами нашего procurement-real.",
      },

      response: {
        snapshotTime:
          parsed?.data
            ?.snapshotTime ??
          null,

        currency:
          parsed?.data
            ?.currency ??
          null,

        ordersReceived:
          orders.length,

        limit:
          LIMIT,

        possibleMoreRows:
          orders.length >=
          LIMIT,
      },

      warehouseCheck: {
        physicalWarehouseDetailFound,

        warehouseNames,

        warehouseRegions,

        realWarehouseNames,
      },

      geographyCheck: {
        ordersWithDestinationDistrict,

        ordersWithDestinationCity,

        districtCoveragePercent,

        cityCoveragePercent,

        destinationDistricts,

        destinationCities,
      },

      statusCheck: {
        statuses,

        cancelTypes,
      },

      sampleOrders,

      conclusionHint:
        physicalWarehouseDetailFound
          ? "Если здесь есть Коледино, Электросталь, Казань и другие физические склады, можно исследовать прямую складскую модель дальше."
          : "Если warehouseName снова только «Склад WB», прямой склад отгрузки через Order Feed нам недоступен. Тогда смотрим destinationDistrict/destinationCity как основу спроса по регионам.",

      warning:
        "НЕ обновляйте этот URL повторно сразу. Для Basic-токена Order Feed имеет лимит 1 запрос раз в 3 часа.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка теста WB Order Feed",

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
