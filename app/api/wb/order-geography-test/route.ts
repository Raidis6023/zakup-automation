import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_DAYS = 28;

// Овощечистка AVD-VP1
const TARGET_NM_ID = 1286384330;

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

// ============================================================
// ТИПЫ
// ============================================================

type SyncStateRow = {
  sync_key: string;
  last_success_at: string | null;
};

type OrderRow = {
  srid: string;
  order_date: string;
  nm_id: number | string;
  supplier_article: string | null;
  warehouse_type: string | null;
  is_cancel: boolean | null;
  raw: Record<string, unknown> | null;
};

type GroupRow = {
  name: string;
  ordersCount: number;
  sharePercent: number;
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

function groupOrders(
  orders: OrderRow[],
  field:
    | "countryName"
    | "oblastOkrugName"
    | "regionName"
): GroupRow[] {
  const map =
    new Map<string, number>();

  for (const order of orders) {
    const raw =
      order.raw &&
      typeof order.raw === "object"
        ? order.raw
        : {};

    const name =
      normalizeText(
        raw[field]
      );

    map.set(
      name,
      (map.get(name) ?? 0) + 1
    );
  }

  const total =
    orders.length;

  return Array.from(
    map.entries()
  )
    .map(
      ([name, ordersCount]) => ({
        name,
        ordersCount,

        sharePercent:
          total > 0
            ? Number(
                (
                  (ordersCount /
                    total) *
                  100
                ).toFixed(2)
              )
            : 0,
      })
    )
    .sort(
      (a, b) =>
        b.ordersCount -
        a.ordersCount
    );
}

// ============================================================
// ОСНОВНОЙ МАРШРУТ
// ============================================================

export async function GET() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не найдена SUPABASE_URL",
      },
      { status: 500 }
    );
  }

  if (!supabaseKey) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не найден ключ Supabase",
      },
      { status: 500 }
    );
  }

  const headers = {
    apikey: supabaseKey,
    Authorization:
      `Bearer ${supabaseKey}`,
    Accept: "application/json",
  };

  // ==========================================================
  // ФУНКЦИЯ ЧТЕНИЯ СТРАНИЦАМИ
  // ==========================================================

  async function fetchAllRows<T>(
    table: string,
    params: URLSearchParams
  ): Promise<{
    rows: T[];
    pagesRead: number;
  }> {
    const allRows: T[] = [];

    for (
      let page = 0;
      page < MAX_PAGES;
      page++
    ) {
      const pageParams =
        new URLSearchParams(
          params
        );

      pageParams.set(
        "limit",
        String(PAGE_SIZE)
      );

      pageParams.set(
        "offset",
        String(
          page *
            PAGE_SIZE
        )
      );

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/${table}?${pageParams.toString()}`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        );

      const text =
        await response.text();

      if (!response.ok) {
        throw new Error(
          `Ошибка чтения ${table}: HTTP ${response.status}: ${text}`
        );
      }

      const parsed =
        parseJson(text);

      if (!Array.isArray(parsed)) {
        throw new Error(
          `Неожиданный ответ ${table}`
        );
      }

      const rows =
        parsed as T[];

      allRows.push(
        ...rows
      );

      if (
        rows.length <
        PAGE_SIZE
      ) {
        return {
          rows: allRows,
          pagesRead:
            page + 1,
        };
      }
    }

    throw new Error(
      "Достигнут лимит страниц"
    );
  }

  try {
    // ========================================================
    // 1. БЕРЁМ ДАТУ ПОСЛЕДНЕЙ УСПЕШНОЙ СИНХРОНИЗАЦИИ
    // ========================================================

    const stateResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_sync_state?sync_key=eq.orders&select=sync_key,last_success_at&limit=1`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

    const stateText =
      await stateResponse.text();

    if (!stateResponse.ok) {
      throw new Error(
        `Ошибка wb_sync_state: ${stateText}`
      );
    }

    const states =
      parseJson(
        stateText
      ) as SyncStateRow[];

    const state =
      Array.isArray(states)
        ? states[0]
        : undefined;

    if (
      !state ||
      !state.last_success_at
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Нет успешной синхронизации orders",
        },
        { status: 409 }
      );
    }

    // ========================================================
    // 2. ТОТ ЖЕ ПЕРИОД 28 ДНЕЙ
    // ========================================================

    const periodEnd =
      new Date(
        state.last_success_at
      );

    const periodStart =
      new Date(
        periodEnd.getTime() -
          SALES_DAYS *
            24 *
            60 *
            60 *
            1000
      );

    // ========================================================
    // 3. ЧИТАЕМ FBW-ЗАКАЗЫ
    // ========================================================

    const params =
      new URLSearchParams();

    params.set(
      "select",
      "srid,order_date,nm_id,supplier_article,warehouse_type,is_cancel,raw"
    );

    params.append(
      "order_date",
      `gte.${periodStart.toISOString()}`
    );

    params.append(
      "order_date",
      `lte.${periodEnd.toISOString()}`
    );

    params.set(
      "warehouse_type",
      "eq.Склад WB"
    );

    params.set(
      "order",
      "order_date.asc"
    );

    const result =
      await fetchAllRows<OrderRow>(
        "wb_orders",
        params
      );

    const allFbwOrders =
      result.rows;

    // ========================================================
    // 4. УБИРАЕМ ОТМЕНЁННЫЕ
    // ========================================================

    const activeFbwOrders =
      allFbwOrders.filter(
        (order) =>
          order.is_cancel !==
          true
      );

    // ========================================================
    // 5. БЕРЁМ ТОЛЬКО ОВОЩЕЧИСТКУ
    // ========================================================

    const targetOrders =
      activeFbwOrders.filter(
        (order) =>
          Number(
            order.nm_id
          ) ===
          TARGET_NM_ID
      );

    // ========================================================
    // 6. ПРОВЕРЯЕМ ЗАПОЛНЕННОСТЬ ГЕОГРАФИИ
    // ========================================================

    let withCountry = 0;
    let withDistrict = 0;
    let withRegion = 0;

    for (
      const order of
      targetOrders
    ) {
      const raw =
        order.raw &&
        typeof order.raw === "object"
          ? order.raw
          : {};

      if (
        normalizeText(
          raw.countryName
        ) !== "НЕ УКАЗАНО"
      ) {
        withCountry++;
      }

      if (
        normalizeText(
          raw.oblastOkrugName
        ) !== "НЕ УКАЗАНО"
      ) {
        withDistrict++;
      }

      if (
        normalizeText(
          raw.regionName
        ) !== "НЕ УКАЗАНО"
      ) {
        withRegion++;
      }
    }

    // ========================================================
    // 7. ГРУППИРУЕМ
    // ========================================================

    const byCountry =
      groupOrders(
        targetOrders,
        "countryName"
      );

    const byFederalDistrict =
      groupOrders(
        targetOrders,
        "oblastOkrugName"
      );

    const byRegion =
      groupOrders(
        targetOrders,
        "regionName"
      );

    const districtSum =
      byFederalDistrict.reduce(
        (sum, row) =>
          sum +
          row.ordersCount,
        0
      );

    const regionSum =
      byRegion.reduce(
        (sum, row) =>
          sum +
          row.ordersCount,
        0
      );

    // ========================================================
    // 8. ВОЗВРАЩАЕМ РЕЗУЛЬТАТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "География активных FBW-заказов рассчитана по данным Supabase",

      wildberriesRequestSent:
        false,

      period: {
        days:
          SALES_DAYS,

        start:
          periodStart.toISOString(),

        end:
          periodEnd.toISOString(),
      },

      source: {
        fbwOrders:
          allFbwOrders.length,

        activeFbwOrders:
          activeFbwOrders.length,

        pagesRead:
          result.pagesRead,
      },

      targetSku: {
        nmId:
          TARGET_NM_ID,

        article:
          "Овощечистка AVD-VP1",

        activeOrders:
          targetOrders.length,

        expectedFromProcurementReal:
          394,

        matchesExpected:
          targetOrders.length ===
          394,

        geographyCoverage: {
          withCountry,

          withFederalDistrict:
            withDistrict,

          withRegion,

          countryPercent:
            targetOrders.length > 0
              ? Number(
                  (
                    (withCountry /
                      targetOrders.length) *
                    100
                  ).toFixed(2)
                )
              : 0,

          federalDistrictPercent:
            targetOrders.length > 0
              ? Number(
                  (
                    (withDistrict /
                      targetOrders.length) *
                    100
                  ).toFixed(2)
                )
              : 0,

          regionPercent:
            targetOrders.length > 0
              ? Number(
                  (
                    (withRegion /
                      targetOrders.length) *
                    100
                  ).toFixed(2)
                )
              : 0,
        },

        check: {
          districtSum,

          regionSum,

          districtSumMatchesOrders:
            districtSum ===
            targetOrders.length,

          regionSumMatchesOrders:
            regionSum ===
            targetOrders.length,
        },

        byCountry,

        byFederalDistrict,

        byRegion,
      },

      conclusionHint:
        "Если activeOrders совпадает с procurement-real и география заполнена почти на 100%, эти же активные заказы можно использовать для распределения потребности по кластерам.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка анализа географии WB",

        wildberriesRequestSent:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
