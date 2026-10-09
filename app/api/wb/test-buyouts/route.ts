import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {
      rawText: text,
    };
  }
}

export async function GET() {
  try {
    // ========================================================
    // 1. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
    // ========================================================

    const wbToken =
      process.env.WB_READ_TOKEN;

    const supabaseUrl =
      process.env.SUPABASE_URL
      ??
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY
      ??
      process.env.SUPABASE_SECRET_KEY;

    if (!wbToken) {
      return NextResponse.json(
        {
          ok: false,
          message: "Не найден WB_READ_TOKEN",
        },
        {
          status: 500,
        }
      );
    }

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL",
        },
        {
          status: 500,
        }
      );
    }

    if (!supabaseKey) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 2. БЕРЁМ ТОТ ЖЕ 28-ДНЕВНЫЙ ПЕРИОД, ЧТО И OZON
    // ========================================================

    const periodResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/ozon_sales_sync_runs`
        +
        `?status=eq.success`
        +
        `&completed_days=eq.28`
        +
        `&date_from=not.is.null`
        +
        `&date_to=not.is.null`
        +
        `&select=date_from,date_to,created_at`
        +
        `&order=date_to.desc,created_at.desc`
        +
        `&limit=1`,
        {
          method: "GET",

          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: "application/json",
          },

          cache: "no-store",
        }
      );

    const periodText =
      await periodResponse.text();

    if (!periodResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не удалось получить 28-дневный период Ozon",
          supabaseStatus:
            periodResponse.status,
          supabaseResponse:
            parseJson(periodText),
        },
        {
          status: 500,
        }
      );
    }

    const periodRows =
      parseJson(periodText);

    if (
      !Array.isArray(periodRows)
      ||
      periodRows.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "В Supabase не найден успешный 28-дневный период Ozon",
        },
        {
          status: 500,
        }
      );
    }

    const dateFrom =
      String(
        periodRows[0].date_from
      ).slice(0, 10);

    const dateTo =
      String(
        periodRows[0].date_to
      ).slice(0, 10);

    // ========================================================
    // 3. КОНТРОЛЬНЫЕ ТОВАРЫ
    //
    // Включил большую бритву и несколько товаров,
    // которые видны на твоём скрине.
    // ========================================================

    const nmIds = [
      232169288,   // Бритва мужская 31 кассета арт. 1267
      1583832993,  // AVB12R Банты красные
      1583876412,  // AVB12S Банты серебристые
      1583886263,  // AVB12G Банты золотые
      1583608982,  // AVD-NY37M Коза с открыткой
      1583646991,  // AVD-NY37S Коза с открыткой
    ];

    // ========================================================
    // 4. SALES FUNNEL
    // ========================================================

    const wbUrl =
      "https://seller-analytics-api.wildberries.ru"
      +
      "/api/analytics/v3/sales-funnel/products";

    const requestBody = {
      selectedPeriod: {
        start: dateFrom,
        end: dateTo,
      },

      nmIds,

      skipDeletedNm: false,

      orderBy: {
        field: "buyoutCount",
        mode: "desc",
      },

      limit: 1000,

      offset: 0,
    };

    const wbResponse =
      await fetch(
        wbUrl,
        {
          method: "POST",

          headers: {
            Authorization: wbToken,
            Accept: "application/json",
            "Content-Type": "application/json",
          },

          body:
            JSON.stringify(
              requestBody
            ),

          cache: "no-store",
        }
      );

    const wbText =
      await wbResponse.text();

    const wbData =
      parseJson(
        wbText
      );

    // ========================================================
    // 5. ЕСЛИ WB ВЕРНУЛ ОШИБКУ
    // ========================================================

    if (!wbResponse.ok) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Wildberries вернул ошибку Sales Funnel",

          wbStatus:
            wbResponse.status,

          period: {
            dateFrom,
            dateTo,
          },

          rateLimit: {
            limit:
              wbResponse.headers.get(
                "x-ratelimit-limit"
              ),

            remaining:
              wbResponse.headers.get(
                "x-ratelimit-remaining"
              ),

            retry:
              wbResponse.headers.get(
                "x-ratelimit-retry"
              ),

            reset:
              wbResponse.headers.get(
                "x-ratelimit-reset"
              ),

            retryAfter:
              wbResponse.headers.get(
                "retry-after"
              ),
          },

          wbResponse:
            wbData,
        },
        {
          status:
            wbResponse.status,
        }
      );
    }

    // ========================================================
    // 6. ПРОВЕРЯЕМ ФОРМАТ
    // ========================================================

    const products =
      Array.isArray(
        wbData?.data?.products
      )
        ?
        wbData.data.products
        :
        [];

    // ========================================================
    // 7. ДЕЛАЕМ ЧЕЛОВЕЧЕСКИЙ ОТВЕТ
    // ========================================================

    const rows =
      products.map(
        (
          item: any
        ) => {
          const product =
            item?.product
            ??
            {};

          const selected =
            item
              ?.statistic
              ?.selected
            ??
            {};

          return {
            nmId:
              Number(
                product.nmId
              ),

            vendorCode:
              product.vendorCode
              ??
              null,

            productName:
              product.title
              ??
              null,

            orderCount:
              Number(
                selected.orderCount
                ??
                0
              ),

            buyoutCount:
              Number(
                selected.buyoutCount
                ??
                0
              ),

            cancelCount:
              Number(
                selected.cancelCount
                ??
                0
              ),

            orderSum:
              Number(
                selected.orderSum
                ??
                0
              ),

            buyoutSum:
              Number(
                selected.buyoutSum
                ??
                0
              ),

            cancelSum:
              Number(
                selected.cancelSum
                ??
                0
              ),
          };
        }
      );

    const foundNmIds =
      new Set(
        rows.map(
          (
            row: any
          ) =>
            row.nmId
        )
      );

    const missingNmIds =
      nmIds.filter(
        nmId =>
          !foundNmIds.has(
            nmId
          )
      );

    // ========================================================
    // 8. ОТВЕТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "Контрольный Sales Funnel WB успешно получен",

      writesToDatabase:
        false,

      period: {
        days: 28,
        dateFrom,
        dateTo,
      },

      meaning: {
        orderCount:
          "Заказали, шт.",

        buyoutCount:
          "Выкупили, шт.",

        cancelCount:
          "Отменили, шт.",
      },

      expectedControl: {
        nmId:
          232169288,

        sellerArticle:
          "Бритва мужская 31 кассета арт. 1267",

        cabinetScreenshotBuyout:
          2153,

        note:
          "Сравниваем buyoutCount только если период скрина совпадает с period.dateFrom/dateTo.",
      },

      rows,

      missingNmIds,

      wildberries: {
        status:
          wbResponse.status,

        productsReceived:
          products.length,

        rateLimit: {
          limit:
            wbResponse.headers.get(
              "x-ratelimit-limit"
            ),

          remaining:
            wbResponse.headers.get(
              "x-ratelimit-remaining"
            ),

          retry:
            wbResponse.headers.get(
              "x-ratelimit-retry"
            ),

          reset:
            wbResponse.headers.get(
              "x-ratelimit-reset"
            ),
        },
      },
    });
  } catch (error) {
    console.error(
      "Ошибка test-buyouts WB:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка контрольного запроса Sales Funnel WB",

        error:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка",
      },
      {
        status: 500,
      }
    );
  }
}
