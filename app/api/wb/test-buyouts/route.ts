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
    // 1. WB TOKEN
    // ========================================================

    const wbToken =
      process.env.WB_READ_TOKEN;

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

    // ========================================================
    // 2. ТОЧНО ТОТ ЖЕ ПЕРИОД,
    // КОТОРЫЙ БЫЛ В ВЫГРУЗКЕ ИЗ КАБИНЕТА WB
    // ========================================================

    const dateFrom =
      "2026-09-10";

    const dateTo =
      "2026-10-07";

    // ========================================================
    // 3. КОНТРОЛЬНЫЕ ТОВАРЫ
    // ========================================================

    const nmIds = [
      232169288,
      1583608982,
      1583832993,
      1583646991,
      1583876412,
      1583886263,
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
    // 5. ОШИБКА WB
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
    // 6. ТОВАРЫ
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
    // 7. НОРМАЛИЗУЕМ
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

    // ========================================================
    // 8. ИЩЕМ ПРОПАВШИЕ nmID
    // ========================================================

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
    // 9. КОНТРОЛЬНАЯ БРИТВА
    // ========================================================

    const control =
      rows.find(
        (
          row: any
        ) =>
          row.nmId ===
          232169288
      )
      ??
      null;

    const expectedBuyout =
      2153;

    const actualBuyout =
      control
        ?.buyoutCount
      ??
      null;

    const matchesCabinet =
      actualBuyout ===
      expectedBuyout;

    // ========================================================
    // 10. ОТВЕТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "Контрольный Sales Funnel WB за период кабинета успешно получен",

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

      controlCheck: {
        nmId:
          232169288,

        sellerArticle:
          "Бритва мужская 31 кассета арт. 1267",

        cabinetBuyout:
          expectedBuyout,

        apiBuyout:
          actualBuyout,

        difference:
          actualBuyout === null
            ?
            null
            :
            actualBuyout
            -
            expectedBuyout,

        matchesCabinet,
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
