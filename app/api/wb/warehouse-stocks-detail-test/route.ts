import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// НАСТРОЙКИ
// ============================================================

// Овощечистка AVD-VP1.
// Можно потом передать другой nmId через URL:
// ?nmId=123456789
const DEFAULT_NM_ID = 1286384330;

const WB_URL =
  "https://seller-analytics-api.wildberries.ru/api/analytics/v1/stocks-report/wb-warehouses";

// По документации для одного запроса допустимо до 250000 строк.
// Для одного SKU столько нам, разумеется, не понадобится.
// Но пусть API сам отдаст все найденные склады.
const LIMIT = 250000;

// ============================================================
// ТИПЫ
// ============================================================

type WBWarehouseStockItem = {
  nmId?: number | string | null;
  chrtId?: number | string | null;

  warehouseId?: number | string | null;
  warehouseName?: string | null;
  regionName?: string | null;

  quantity?: number | string | null;

  inWayToClient?: number | string | null;
  inWayFromClient?: number | string | null;
};

type WBWarehouseStockResponse = {
  data?: {
    items?: WBWarehouseStockItem[];
  };
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

  return Number.isFinite(number)
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

  return "";
}

function isAggregateWarehouse(
  item: WBWarehouseStockItem
): boolean {
  const warehouseId =
    toNumber(
      item.warehouseId
    );

  const warehouseName =
    normalizeText(
      item.warehouseName
    )
      .toLowerCase();

  const regionName =
    normalizeText(
      item.regionName
    )
      .toLowerCase();

  // WB уже использовал -999999 для общего "Склад WB".
  if (
    warehouseId ===
    -999999
  ) {
    return true;
  }

  const aggregateNames =
    new Set([
      "склад wb",
      "склад wb рф",
    ]);

  if (
    aggregateNames.has(
      warehouseName
    )
  ) {
    return true;
  }

  if (
    aggregateNames.has(
      regionName
    )
  ) {
    return true;
  }

  return false;
}

// ============================================================
// ОСНОВНОЙ МАРШРУТ
// ============================================================

export async function GET(
  request: Request
) {
  // ==========================================================
  // 1. ТОКЕН
  //
  // Сначала ищем отдельный токен для этого метода.
  //
  // Если его пока нет, пробуем существующий WB_READ_TOKEN.
  // Это позволит сразу понять, имеет ли наш текущий токен
  // доступ к методу.
  // ==========================================================

  const specialToken =
    process.env.WB_WAREHOUSE_TOKEN;

  const fallbackToken =
    process.env.WB_READ_TOKEN;

  const wbToken =
    specialToken ??
    fallbackToken;

  const tokenSource =
    specialToken
      ? "WB_WAREHOUSE_TOKEN"
      : fallbackToken
      ? "WB_READ_TOKEN"
      : null;

  if (!wbToken) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Не найден WB_WAREHOUSE_TOKEN или WB_READ_TOKEN в Vercel",
      },
      {
        status: 500,
      }
    );
  }

  // ==========================================================
  // 2. NM ID
  // ==========================================================

  const url =
    new URL(
      request.url
    );

  const nmIdRaw =
    url.searchParams.get(
      "nmId"
    );

  const parsedNmId =
    nmIdRaw
      ? Number(nmIdRaw)
      : DEFAULT_NM_ID;

  if (
    !Number.isInteger(
      parsedNmId
    ) ||
    parsedNmId <= 0
  ) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Некорректный nmId",

        received:
          nmIdRaw,
      },
      {
        status: 400,
      }
    );
  }

  const nmId =
    parsedNmId;

  // ==========================================================
  // 3. ТЕЛО ЗАПРОСА
  //
  // Официальная схема:
  // nmIds
  // chrtIds
  // limit
  // offset
  // ==========================================================

  const requestBody = {
    nmIds: [
      nmId,
    ],

    chrtIds: [],

    limit:
      LIMIT,

    offset:
      0,
  };

  try {
    // ========================================================
    // 4. РОВНО ОДИН ЗАПРОС В WILDBERRIES
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

    // ========================================================
    // 5. 204 — ДАННЫХ НЕТ
    // ========================================================

    if (
      response.status ===
      204
    ) {
      return NextResponse.json({
        ok: true,

        message:
          "WB ответил 204: по этому nmId данных об остатках не найдено",

        wildberriesRequestSent:
          true,

        wbStatus:
          204,

        tokenSource,

        nmId,

        itemsCount:
          0,

        physicalWarehouses:
          [],

        aggregateWarehouses:
          [],
      });
    }

    const responseText =
      await response.text();

    const responseBody =
      parseJson(
        responseText
      );

    // ========================================================
    // 6. ОШИБКА WB
    // ========================================================

    if (!response.ok) {
      let accessHint:
        string | null =
        null;

      if (
        response.status ===
          401
      ) {
        accessHint =
          "WB не принял токен. Проверяем корректность токена.";
      }

      if (
        response.status ===
          403
      ) {
        accessHint =
          "Вероятнее всего текущий токен не имеет доступа к этому методу. По документации wb-warehouses доступен Personal, Service и Base token with secret.";
      }

      if (
        response.status ===
          402
      ) {
        accessHint =
          "WB требует доступ, связанный с тарифом или типом токена.";
      }

      if (
        response.status ===
          429
      ) {
        accessHint =
          "Сработал лимит запросов WB. Повторно сразу не запускаем.";
      }

      return NextResponse.json(
        {
          ok: false,

          message:
            "WB warehouses inventory вернул ошибку",

          wildberriesRequestSent:
            true,

          wbStatus:
            response.status,

          tokenSource,

          accessHint,

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

            body:
              requestBody,
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
    // 7. РАЗБИРАЕМ УСПЕШНЫЙ ОТВЕТ
    // ========================================================

    const parsed =
      responseBody as
        WBWarehouseStockResponse;

    const items =
      Array.isArray(
        parsed?.data?.items
      )
        ? parsed.data!.items!
        : [];

    // ========================================================
    // 8. НОРМАЛИЗУЕМ СТРОКИ
    // ========================================================

    const normalizedItems =
      items.map(
        (
          item
        ) => {
          const warehouseIdRaw =
            Number(
              item.warehouseId
            );

          const warehouseId =
            Number.isFinite(
              warehouseIdRaw
            )
              ? warehouseIdRaw
              : null;

          const chrtIdRaw =
            Number(
              item.chrtId
            );

          const chrtId =
            Number.isFinite(
              chrtIdRaw
            )
              ? chrtIdRaw
              : null;

          return {
            nmId:
              toNumber(
                item.nmId
              ),

            chrtId,

            warehouseId,

            warehouseName:
              normalizeText(
                item.warehouseName
              ),

            regionName:
              normalizeText(
                item.regionName
              ),

            quantity:
              toNumber(
                item.quantity
              ),

            inWayToClient:
              toNumber(
                item.inWayToClient
              ),

            inWayFromClient:
              toNumber(
                item.inWayFromClient
              ),

            warehouseType:
              isAggregateWarehouse(
                item
              )
                ? "aggregate"
                : "physical",
          };
        }
      );

    // ========================================================
    // 9. ФИЗИЧЕСКИЕ И АГРЕГИРОВАННЫЕ СКЛАДЫ
    // ========================================================

    const physicalWarehouses =
      normalizedItems.filter(
        (item) =>
          item.warehouseType ===
          "physical"
      );

    const aggregateWarehouses =
      normalizedItems.filter(
        (item) =>
          item.warehouseType ===
          "aggregate"
      );

    // ========================================================
    // 10. ИТОГИ
    // ========================================================

    const totalQuantity =
      normalizedItems.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.quantity,
        0
      );

    const physicalQuantity =
      physicalWarehouses.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.quantity,
        0
      );

    const aggregateQuantity =
      aggregateWarehouses.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.quantity,
        0
      );

    const totalInWayToClient =
      normalizedItems.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.inWayToClient,
        0
      );

    const totalInWayFromClient =
      normalizedItems.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.inWayFromClient,
        0
      );

    const physicalWarehouseNames =
      Array.from(
        new Set(
          physicalWarehouses
            .map(
              (item) =>
                item.warehouseName
            )
            .filter(
              Boolean
            )
        )
      );

    const physicalRegions =
      Array.from(
        new Set(
          physicalWarehouses
            .map(
              (item) =>
                item.regionName
            )
            .filter(
              Boolean
            )
        )
      );

    const hasPhysicalDetail =
      physicalWarehouses.length >
      0;

    const hasAggregatePart =
      aggregateWarehouses.length >
      0;

    const physicalSharePercent =
      totalQuantity > 0
        ? Number(
            (
              (
                physicalQuantity /
                totalQuantity
              ) *
              100
            ).toFixed(2)
          )
        : 0;

    const aggregateSharePercent =
      totalQuantity > 0
        ? Number(
            (
              (
                aggregateQuantity /
                totalQuantity
              ) *
              100
            ).toFixed(2)
          )
        : 0;

    // ========================================================
    // 11. ВЫВОД
    // ========================================================

    let conclusion =
      "";

    if (
      hasPhysicalDetail &&
      !hasAggregatePart
    ) {
      conclusion =
        "Отличный результат: весь полученный остаток WB удалось разложить по физическим складам.";
    } else if (
      hasPhysicalDetail &&
      hasAggregatePart
    ) {
      conclusion =
        "Частичный успех: WB вернул физические склады, но часть остатка осталась агрегированной.";
    } else if (
      !hasPhysicalDetail &&
      hasAggregatePart
    ) {
      conclusion =
        "WB вернул только агрегированный склад. Физическая детализация этого SKU через данный метод сейчас скрыта.";
    } else {
      conclusion =
        "Ответ успешный, но складские строки не найдены.";
    }

    return NextResponse.json({
      ok: true,

      message:
        "Тест WB Warehouses Inventory выполнен",

      wildberriesRequestSent:
        true,

      wbStatus:
        response.status,

      tokenSource,

      request: {
        nmId,

        body:
          requestBody,
      },

      summary: {
        responseRows:
          normalizedItems.length,

        physicalRows:
          physicalWarehouses.length,

        aggregateRows:
          aggregateWarehouses.length,

        totalQuantity,

        physicalQuantity,

        aggregateQuantity,

        physicalSharePercent,

        aggregateSharePercent,

        totalInWayToClient,

        totalInWayFromClient,

        hasPhysicalDetail,

        hasAggregatePart,
      },

      physicalWarehouseNames,

      physicalRegions,

      physicalWarehouses,

      aggregateWarehouses,

      allItems:
        normalizedItems,

      conclusion,

      raw:
        responseBody,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка теста WB Warehouses Inventory",

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
