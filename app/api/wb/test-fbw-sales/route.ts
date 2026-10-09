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
    // 1. TOKEN
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
    // 2. ПЕРИОД КОНТРОЛЬНОЙ ВЫГРУЗКИ
    // ========================================================

    const dateFrom =
      "2026-09-10";

    const dateTo =
      "2026-10-07";

    const controlNmId =
      232169288;

    // ========================================================
    // 3. ЗАПРОС SALES
    // ========================================================

    const wbUrl =
      new URL(
        "https://statistics-api.wildberries.ru/api/v1/supplier/sales"
      );

    wbUrl.searchParams.set(
      "dateFrom",
      `${dateFrom}T00:00:00`
    );

    wbUrl.searchParams.set(
      "flag",
      "0"
    );

    const wbResponse =
      await fetch(
        wbUrl.toString(),
        {
          method: "GET",

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

    const wbText =
      await wbResponse.text();

    const wbData =
      parseJson(
        wbText
      );

    // ========================================================
    // 4. ОШИБКА WB
    // ========================================================

    if (!wbResponse.ok) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "Wildberries вернул ошибку supplier/sales",

          wbStatus:
            wbResponse.status,

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
    // 5. ПРОВЕРКА ФОРМАТА
    // ========================================================

    if (!Array.isArray(wbData)) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "WB вернул неожиданный формат данных",

          wbResponse:
            wbData,
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 6. ТОЧНЫЙ ПЕРИОД ПО ДАТЕ ПРОДАЖИ/ВОЗВРАТА
    //
    // API принимает dateFrom по lastChangeDate,
    // поэтому точный диапазон отрезаем сами по полю date.
    // ========================================================

    const periodRows =
      wbData.filter(
        (
          row: any
        ) => {
          const rowDate =
            String(
              row?.date
              ??
              ""
            ).slice(
              0,
              10
            );

          return (
            rowDate >=
              dateFrom
            &&
            rowDate <=
              dateTo
          );
        }
      );

    // ========================================================
    // 7. FBW / FBS
    // ========================================================

    const fbwRows =
      periodRows.filter(
        (
          row: any
        ) =>
          row?.warehouseType ===
          "Склад WB"
      );

    const fbsRows =
      periodRows.filter(
        (
          row: any
        ) =>
          row?.warehouseType ===
          "Склад продавца"
      );

    // ========================================================
    // 8. ПРОДАЖИ / ВОЗВРАТЫ
    // ========================================================

    const isSale =
      (
        row: any
      ) =>
        String(
          row?.saleID
          ??
          ""
        ).startsWith(
          "S"
        );

    const isReturn =
      (
        row: any
      ) =>
        String(
          row?.saleID
          ??
          ""
        ).startsWith(
          "R"
        );

    const fbwSales =
      fbwRows.filter(
        isSale
      );

    const fbwReturns =
      fbwRows.filter(
        isReturn
      );

    const fbsSales =
      fbsRows.filter(
        isSale
      );

    const fbsReturns =
      fbsRows.filter(
        isReturn
      );

    // ========================================================
    // 9. КОНТРОЛЬНЫЙ ТОВАР
    // ========================================================

    const controlAll =
      periodRows.filter(
        (
          row: any
        ) =>
          Number(
            row?.nmId
          ) ===
          controlNmId
      );

    const controlFbw =
      controlAll.filter(
        (
          row: any
        ) =>
          row?.warehouseType ===
          "Склад WB"
      );

    const controlFbs =
      controlAll.filter(
        (
          row: any
        ) =>
          row?.warehouseType ===
          "Склад продавца"
      );

    const controlFbwSales =
      controlFbw.filter(
        isSale
      );

    const controlFbwReturns =
      controlFbw.filter(
        isReturn
      );

    const controlFbsSales =
      controlFbs.filter(
        isSale
      );

    const controlFbsReturns =
      controlFbs.filter(
        isReturn
      );

    // ========================================================
    // 10. РАЗБИВКА ПО warehouseType
    // ========================================================

    const warehouseTypesMap =
      new Map<
        string,
        number
      >();

    for (
      const row
      of periodRows
    ) {
      const key =
        String(
          row?.warehouseType
          ??
          "ПУСТО"
        );

      warehouseTypesMap.set(
        key,
        (
          warehouseTypesMap.get(
            key
          )
          ??
          0
        )
        +
        1
      );
    }

    const warehouseTypes =
      Array.from(
        warehouseTypesMap.entries()
      ).map(
        (
          [
            name,
            count,
          ]
        ) => ({
          name,
          count,
        })
      );

    // ========================================================
    // 11. ОТВЕТ
    // ========================================================

    return NextResponse.json({
      ok: true,

      message:
        "Контроль FBW-продаж Wildberries завершён",

      writesToDatabase:
        false,

      period: {
        dateFrom,
        dateTo,
        days: 28,
      },

      source: {
        endpoint:
          "/api/v1/supplier/sales",

        note:
          "В production будем учитывать только warehouseType = Склад WB",
      },

      totals: {
        receivedFromWb:
          wbData.length,

        insidePeriod:
          periodRows.length,

        fbwRows:
          fbwRows.length,

        fbsRows:
          fbsRows.length,

        fbwSales:
          fbwSales.length,

        fbwReturns:
          fbwReturns.length,

        fbwNetSales:
          fbwSales.length
          -
          fbwReturns.length,

        fbsSales:
          fbsSales.length,

        fbsReturns:
          fbsReturns.length,
      },

      controlProduct: {
        nmId:
          controlNmId,

        sellerArticle:
          "Бритва мужская 31 кассета арт. 1267",

        allModels: {
          sales:
            controlAll.filter(
              isSale
            ).length,

          returns:
            controlAll.filter(
              isReturn
            ).length,
        },

        fbwOnly: {
          sales:
            controlFbwSales.length,

          returns:
            controlFbwReturns.length,

          netSales:
            controlFbwSales.length
            -
            controlFbwReturns.length,
        },

        fbsOnly: {
          sales:
            controlFbsSales.length,

          returns:
            controlFbsReturns.length,

          netSales:
            controlFbsSales.length
            -
            controlFbsReturns.length,
        },
      },

      warehouseTypes,

      safety: {
        possiblyTruncated:
          wbData.length >=
          80000,

        note:
          wbData.length >=
          80000
            ?
            "Ответ достиг 80000 строк. Нужна отдельная пагинация по lastChangeDate."
            :
            "Ответ меньше 80000 строк, ограничение одной выдачи не достигнуто.",
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
      },
    });
  } catch (error) {
    console.error(
      "Ошибка test-fbw-sales:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка контрольного запроса FBW-продаж",

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
