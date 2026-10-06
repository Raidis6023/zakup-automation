import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// SKU, КОТОРЫЕ ЕСТЬ В ПРОДАЖАХ,
// НО НЕ ПОПАЛИ В ОСНОВНОЙ SNAPSHOT ОСТАТКОВ
// ============================================================

const MISSING_NM_IDS = [
  1286404475,
  1220924007,
  262068733,
  757604447,
  914555171,
  1378037145,
];


// ============================================================
// WB API
// ============================================================

const WB_WAREHOUSES_URL =
  "https://seller-analytics-api.wildberries.ru/api/analytics/v1/stocks-report/wb-warehouses";


// ============================================================
// JSON
// ============================================================

function parseJson(
  text: string
): any {

  try {

    return JSON.parse(
      text
    );

  } catch {

    return {
      raw:
        text,
    };

  }

}


// ============================================================
// ЧИСЛО
// ============================================================

function safeNumber(
  value: unknown
): number {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return 0;

  }


  return Math.max(
    0,
    number
  );

}


// ============================================================
// GET
// ============================================================

export async function GET() {

  // ==========================================================
  // 1. TOKEN
  // ==========================================================

  const wbToken =
    process.env
      .WB_READ_TOKEN;


  if (!wbToken) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найден WB_READ_TOKEN в Vercel",
      },
      {
        status:
          500,
      }
    );

  }


  try {

    // ========================================================
    // 2. ЗАПРОС ТОЛЬКО К ТЕКУЩИМ ОСТАТКАМ СКЛАДОВ WB
    // ========================================================

    const requestBody = {

      nmIds:
        MISSING_NM_IDS,

      chrtIds:
        [],

      limit:
        250000,

      offset:
        0,

    };


    const response =
      await fetch(
        WB_WAREHOUSES_URL,
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
    // 3. ЛИМИТЫ WB
    // ========================================================

    const retryHeader =
      response
        .headers
        .get(
          "x-ratelimit-retry"
        );


    const resetHeader =
      response
        .headers
        .get(
          "x-ratelimit-reset"
        );


    const limitHeader =
      response
        .headers
        .get(
          "x-ratelimit-limit"
        );


    const remainingHeader =
      response
        .headers
        .get(
          "x-ratelimit-remaining"
        );


    const retrySecondsRaw =
      retryHeader
      ??
      resetHeader;


    const retrySeconds =
      retrySecondsRaw
        ?
        Number(
          retrySecondsRaw
        )
        :
        null;


    const nextAllowedAt =
      retrySeconds !== null
      &&
      Number.isFinite(
        retrySeconds
      )
      &&
      retrySeconds
      >
      0
        ?
        new Date(
          Date.now()
          +
          retrySeconds
          *
          1000
        ).toISOString()
        :
        null;


    const rateLimit = {

      retryAfterSeconds:
        retrySeconds,

      nextAllowedAt,

      limit:
        limitHeader,

      remaining:
        remainingHeader,

    };


    // ========================================================
    // 4. 204 = ДАННЫХ НЕТ
    // ========================================================

    if (
      response.status
      ===
      204
    ) {

      return NextResponse.json({

        ok:
          true,

        message:
          "WB не вернул ни одной строки остатков для проверяемых SKU",

        wbStatus:
          204,

        source: {

          endpoint:
            WB_WAREHOUSES_URL,

          nmIds:
            MISSING_NM_IDS,

        },

        rateLimit,


        summary: {

          skuChecked:
            MISSING_NM_IDS.length,

          skuFound:
            0,

          skuAbsent:
            MISSING_NM_IDS.length,

          skuWithPositiveStock:
            0,

          skuWithZeroStock:
            0,

        },


        checks:
          MISSING_NM_IDS.map(
            (nmId) => ({

              nmId,

              found:
                false,

              quantity:
                null,

              inWayToClient:
                null,

              inWayFromClient:
                null,

              warehouseRows:
                0,

              conclusion:
                "SKU отсутствует и в основном отчёте, и в текущем отчёте складов WB. Пока автоматически считать остаток нулевым нельзя.",

            })
          ),

      });

    }


    // ========================================================
    // 5. ЧИТАЕМ ОТВЕТ
    // ========================================================

    const text =
      await response
        .text();


    const data =
      parseJson(
        text
      );


    // ========================================================
    // 6. 429
    // ========================================================

    if (
      response.status
      ===
      429
    ) {

      return NextResponse.json(
        {

          ok:
            false,

          message:
            "Wildberries временно ограничил запрос остатков",

          wbStatus:
            429,

          rateLimit,

          recommendation:
            nextAllowedAt
              ?
              `Повторить запрос после ${nextAllowedAt}`
              :
              "Повторить запрос позже",

          wbResponse:
            data,

        },
        {
          status:
            429,
        }
      );

    }


    // ========================================================
    // 7. ДРУГАЯ ОШИБКА
    // ========================================================

    if (!response.ok) {

      return NextResponse.json(
        {

          ok:
            false,

          message:
            "Wildberries вернул ошибку при проверке отсутствующих SKU",

          wbStatus:
            response.status,

          rateLimit,

          wbResponse:
            data,

        },
        {
          status:
            response.status,
        }
      );

    }


    // ========================================================
    // 8. ПРОВЕРЯЕМ ФОРМАТ
    // ========================================================

    const items =
      Array.isArray(
        data
          ?.data
          ?.items
      )
        ?
        data
          .data
          .items
        :
        [];


    // ========================================================
    // 9. ГРУППИРУЕМ ПО NM ID
    //
    // WB МОЖЕТ ВЕРНУТЬ НЕСКОЛЬКО СТРОК:
    // размер × склад.
    //
    // Поэтому всё суммируем по nmId.
    // ========================================================

    const rowsByNmId =
      new Map<
        number,
        any[]
      >();


    for (
      const item
      of items
    ) {

      const nmId =
        Number(
          item
            ?.nmId
        );


      if (
        !Number.isFinite(
          nmId
        )
        ||
        nmId
        <=
        0
      ) {

        continue;

      }


      const current =
        rowsByNmId.get(
          nmId
        )
        ??
        [];


      current.push(
        item
      );


      rowsByNmId.set(
        nmId,
        current
      );

    }


    // ========================================================
    // 10. РЕЗУЛЬТАТ ПО 6 SKU
    // ========================================================

    const checks =
      MISSING_NM_IDS.map(
        (nmId) => {

          const rows =
            rowsByNmId.get(
              nmId
            )
            ??
            [];


          const found =
            rows.length
            >
            0;


          const quantity =
            rows.reduce(
              (
                sum:
                  number,

                row:
                  any
              ) =>
                sum
                +
                safeNumber(
                  row
                    ?.quantity
                ),
              0
            );


          const inWayToClient =
            rows.reduce(
              (
                sum:
                  number,

                row:
                  any
              ) =>
                sum
                +
                safeNumber(
                  row
                    ?.inWayToClient
                ),
              0
            );


          const inWayFromClient =
            rows.reduce(
              (
                sum:
                  number,

                row:
                  any
              ) =>
                sum
                +
                safeNumber(
                  row
                    ?.inWayFromClient
                ),
              0
            );


          // ==================================================
          // ВЫВОД
          // ==================================================

          let conclusion:
            string;


          if (
            found
            &&
            quantity
            >
            0
          ) {

            conclusion =
              "WB показывает положительный физический остаток. Значит, отсутствие SKU в основном products/products нельзя трактовать как нулевой остаток.";

          } else if (
            found
            &&
            quantity
            ===
            0
          ) {

            conclusion =
              "WB знает этот SKU, но текущий физический остаток по складам равен 0.";

          } else {

            conclusion =
              "SKU не найден в текущем отчёте складов WB. Он также отсутствовал в основном products/products. Автоматически считать его нулевым пока не будем.";

          }


          return {

            nmId,

            found,

            warehouseRows:
              rows.length,

            quantity,

            inWayToClient,

            inWayFromClient,


            warehouses:
              rows.map(
                (
                  row:
                    any
                ) => ({

                  chrtId:
                    row
                      ?.chrtId
                    ??
                    null,

                  warehouseId:
                    row
                      ?.warehouseId
                    ??
                    null,

                  warehouseName:
                    row
                      ?.warehouseName
                    ??
                    null,

                  regionName:
                    row
                      ?.regionName
                    ??
                    null,

                  quantity:
                    safeNumber(
                      row
                        ?.quantity
                    ),

                  inWayToClient:
                    safeNumber(
                      row
                        ?.inWayToClient
                    ),

                  inWayFromClient:
                    safeNumber(
                      row
                        ?.inWayFromClient
                    ),

                })
              ),


            conclusion,

          };

        }
      );


    // ========================================================
    // 11. SUMMARY
    // ========================================================

    const skuFound =
      checks.filter(
        (item) =>
          item.found
      ).length;


    const skuAbsent =
      checks.filter(
        (item) =>
          !item.found
      ).length;


    const skuWithPositiveStock =
      checks.filter(
        (item) =>
          item.found
          &&
          item.quantity
          >
          0
      ).length;


    const skuWithZeroStock =
      checks.filter(
        (item) =>
          item.found
          &&
          item.quantity
          ===
          0
      ).length;


    const totalQuantity =
      checks.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.quantity,
        0
      );


    const totalToClient =
      checks.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.inWayToClient,
        0
      );


    const totalFromClient =
      checks.reduce(
        (
          sum,
          item
        ) =>
          sum
          +
          item.inWayFromClient,
        0
      );


    // ========================================================
    // 12. ОТВЕТ
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      message:
        "Проверка отсутствующих SKU через текущие остатки складов WB завершена",


      source: {

        endpoint:
          WB_WAREHOUSES_URL,

        note:
          "Один ответ может содержать несколько строк одного nmId: по размерам и складам. quantity суммируется по nmId.",

      },


      rateLimit,


      summary: {

        skuChecked:
          MISSING_NM_IDS.length,

        skuFound,

        skuAbsent,

        skuWithPositiveStock,

        skuWithZeroStock,

        totalQuantity,

        totalToClient,

        totalFromClient,

      },


      checks,

    });

  } catch (error) {

    console.error(
      "Ошибка check-missing-stocks:",
      error
    );


    return NextResponse.json(
      {

        ok:
          false,

        message:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка проверки отсутствующих SKU",

      },
      {
        status:
          500,
      }
    );

  }

}
