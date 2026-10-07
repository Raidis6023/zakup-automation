import { NextRequest, NextResponse } from "next/server";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;


// ============================================================
// ТЕСТОВЫЙ SKU
// ============================================================

const TARGET_SKU =
  "1799713785";

const TARGET_OFFER_ID =
  "ватные палочки 500шт AVD-BCS500";


// ============================================================
// ТИПЫ
// ============================================================

type AnalyticsStockItem = {
  sku?:
    | number
    | string;

  offer_id?:
    string;

  name?:
    string;

  warehouse_id?:
    | number
    | string;

  warehouse_name?:
    string;

  cluster_id?:
    | number
    | string;

  cluster_name?:
    string;

  available_stock_count?:
    number;

  [key: string]:
    unknown;
};


type AnalyticsStockResponse = {
  items?:
    AnalyticsStockItem[];

  stocks?:
    AnalyticsStockItem[];

  result?: {
    items?:
      AnalyticsStockItem[];

    stocks?:
      AnalyticsStockItem[];

    [key: string]:
      unknown;
  };

  [key: string]:
    unknown;
};


// ============================================================
// ENV
// ============================================================

function getConfig() {

  const ozonClientId =
    process.env
      .OZON_CLIENT_ID;

  const ozonApiKey =
    process.env
      .OZON_API_KEY;

  const cronSecret =
    process.env
      .CRON_SECRET;


  if (!ozonClientId) {

    throw new Error(
      "Не найден OZON_CLIENT_ID"
    );

  }


  if (!ozonApiKey) {

    throw new Error(
      "Не найден OZON_API_KEY"
    );

  }


  if (!cronSecret) {

    throw new Error(
      "Не найден CRON_SECRET"
    );

  }


  return {
    ozonClientId,
    ozonApiKey,
    cronSecret,
  };
}


// ============================================================
// OZON POST
// ============================================================

async function ozonPost<T>(
  path: string,
  body: unknown
):
Promise<T> {

  const {
    ozonClientId,
    ozonApiKey,
  } =
    getConfig();


  const response =
    await fetch(
      `https://api-seller.ozon.ru${path}`,
      {
        method:
          "POST",

        headers: {
          "Client-Id":
            ozonClientId,

          "Api-Key":
            ozonApiKey,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            body
          ),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  let parsed:
    unknown;


  try {

    parsed =
      JSON.parse(
        text
      );

  } catch {

    parsed =
      text;

  }


  if (!response.ok) {

    throw new Error(
      `Ozon ${path}: HTTP ${response.status}: ${text}`
    );

  }


  return parsed as T;
}


// ============================================================
// ИЗВЛЕЧЕНИЕ СТРОК
// ============================================================

function extractRows(
  data:
    unknown
):
AnalyticsStockItem[] {

  if (
    Array.isArray(
      data
    )
  ) {

    return data as
      AnalyticsStockItem[];

  }


  if (
    !data
    ||
    typeof data !==
      "object"
  ) {

    return [];

  }


  const object =
    data as
      AnalyticsStockResponse;


  if (
    Array.isArray(
      object.items
    )
  ) {

    return object.items;

  }


  if (
    Array.isArray(
      object.stocks
    )
  ) {

    return object.stocks;

  }


  if (
    object.result
    &&
    Array.isArray(
      object.result.items
    )
  ) {

    return object
      .result
      .items;

  }


  if (
    object.result
    &&
    Array.isArray(
      object.result.stocks
    )
  ) {

    return object
      .result
      .stocks;

  }


  return [];
}


// ============================================================
// ОСНОВНАЯ ПРОВЕРКА
// ============================================================

async function runProbe(
  request:
    NextRequest
) {

  try {

    const {
      cronSecret,
    } =
      getConfig();


    const authorization =
      request.headers.get(
        "authorization"
      );


    if (
      authorization !==
      `Bearer ${cronSecret}`
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Unauthorized",
        },
        {
          status:
            401,
        }
      );

    }


    // ========================================================
    // 1. ЗАПРАШИВАЕМ РОВНО ТОТ МЕТОД,
    //    КОТОРЫЙ ИСПОЛЬЗУЕТ РАБОЧИЙ EXCEL-МАКРОС
    // ========================================================

    const response =
      await ozonPost<
        AnalyticsStockResponse
        | AnalyticsStockItem[]
      >(
        "/v1/analytics/stocks",
        {
          skus: [
            TARGET_SKU,
          ],
        }
      );


    // ========================================================
    // 2. ДОСТАЁМ СТРОКИ
    // ========================================================

    const rows =
      extractRows(
        response
      );


    const targetRows =
      rows.filter(
        row => {

          const sku =
            row.sku != null
              ? String(
                  row.sku
                )
              : "";


          const offerId =
            String(
              row.offer_id
              ?? ""
            );


          return (
            sku ===
              TARGET_SKU
            ||
            offerId ===
              TARGET_OFFER_ID
          );

        }
      );


    // ========================================================
    // 3. ИТОГ "ДОСТУПНО К ПРОДАЖЕ"
    // ========================================================

    const totalAvailable =
      targetRows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          Math.max(
            0,
            Number(
              row
                .available_stock_count
              ?? 0
            )
          ),
        0
      );


    // ========================================================
    // 4. АГРЕГАЦИЯ ПО КЛАСТЕРАМ
    // ========================================================

    const clusterMap =
      new Map<
        string,
        number
      >();


    for (
      const row
      of targetRows
    ) {

      const clusterName =
        String(
          row.cluster_name
          ??
          "Не определён"
        );


      const quantity =
        Math.max(
          0,
          Number(
            row
              .available_stock_count
            ?? 0
          )
        );


      clusterMap.set(
        clusterName,
        (
          clusterMap.get(
            clusterName
          )
          ?? 0
        )
        +
        quantity
      );

    }


    const byCluster =
      Array.from(
        clusterMap.entries()
      )
        .map(
          (
            [
              cluster_name,
              available_stock_count,
            ]
          ) => ({
            cluster_name,
            available_stock_count,
          })
        )
        .sort(
          (
            left,
            right
          ) =>
            right
              .available_stock_count
            -
            left
              .available_stock_count
        );


    // ========================================================
    // 5. ОТВЕТ
    // ========================================================

    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "read_only_analytics_stock_probe",

        writes_to_database:
          false,

        endpoint:
          "/v1/analytics/stocks",

        target: {
          sku:
            TARGET_SKU,

          offer_id:
            TARGET_OFFER_ID,
        },

        result: {
          rows_received:
            rows.length,

          target_rows:
            targetRows.length,

          available_stock_count:
            totalAvailable,

          by_cluster:
            byCluster,
        },

        raw_target_rows:
          targetRows,

        raw_response:
          response,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    return NextResponse.json(
      {
        ok:
          false,

        mode:
          "read_only_analytics_stock_probe",

        writes_to_database:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status:
          500,
      }
    );

  }
}


// ============================================================
// GET / POST
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  return runProbe(
    request
  );
}


export async function POST(
  request:
    NextRequest
) {

  return runProbe(
    request
  );
}
