import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// ПРОВЕРЯЕМЫЕ SKU
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
// API WB
// ============================================================

const PRODUCTS_URL =
  "https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/products";


const WAREHOUSES_URL =
  "https://seller-analytics-api.wildberries.ru/api/analytics/v1/stocks-report/wb-warehouses";


// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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
// ДАТА МОСКВЫ
// ============================================================

function getMoscowDate():
  string {

  const formatter =
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
    );


  const parts =
    formatter.formatToParts(
      new Date()
    );


  const year =
    parts.find(
      (part) =>
        part.type
        ===
        "year"
    )?.value;


  const month =
    parts.find(
      (part) =>
        part.type
        ===
        "month"
    )?.value;


  const day =
    parts.find(
      (part) =>
        part.type
        ===
        "day"
    )?.value;


  if (
    !year
    ||
    !month
    ||
    !day
  ) {

    throw new Error(
      "Не удалось определить дату Москвы"
    );

  }


  return (
    `${year}-${month}-${day}`
  );

}


// ============================================================
// ПАУЗА
// ============================================================

function sleep(
  ms: number
) {

  return new Promise<void>(
    (resolve) => {

      setTimeout(
        resolve,
        ms
      );

    }
  );

}


// ============================================================
// ОСНОВНОЙ ROUTE
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

    const reportDate =
      getMoscowDate();


    // ========================================================
    // 2. ТОЧЕЧНЫЙ ЗАПРОС В PRODUCTS/PRODUCTS
    // ========================================================

    const productsBody = {

      nmIDs:
        MISSING_NM_IDS,


      currentPeriod: {

        start:
          reportDate,

        end:
          reportDate,

      },


      // Только FBW / склады Wildberries
      stockType:
        "wb",


      // Не исключаем удалённые карточки
      skipDeletedNm:
        false,


      // Все возможные категории наличия
      availabilityFilters: [

        "deficient",

        "actual",

        "balanced",

        "nonActual",

        "nonLiquid",

        "invalidData",

      ],


      orderBy: {

        field:
          "avgOrders",

        mode:
          "desc",

      },


      limit:
        1000,

      offset:
        0,

    };


    const productsResponse =
      await fetch(
        PRODUCTS_URL,
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
              productsBody
            ),

          cache:
            "no-store",
        }
      );


    const productsText =
      await productsResponse
        .text();


    const productsData =
      parseJson(
        productsText
      );


    if (
      !productsResponse.ok
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          stage:
            "products-products",

          message:
            "Ошибка точечного запроса products/products",

          wbStatus:
            productsResponse.status,

          wbResponse:
            productsData,
        },
        {
          status:
            productsResponse.status,
        }
      );

    }


    const productItems =
      Array.isArray(
        productsData
          ?.data
          ?.items
      )
        ?
        productsData
          .data
          .items
        :
        [];


    // ========================================================
    // 3. НЕ ЛЕЗЕМ В ЛИМИТ WB СРАЗУ ВТОРЫМ ЗАПРОСОМ
    // ========================================================

    await sleep(
      21_000
    );


    // ========================================================
    // 4. ПРОВЕРЯЕМ ТЕ ЖЕ SKU ЧЕРЕЗ WB-WAREHOUSES
    // ========================================================

    const warehousesBody = {

      nmIds:
        MISSING_NM_IDS,

      chrtIds:
        [],

      limit:
        250000,

      offset:
        0,

    };


    const warehousesResponse =
      await fetch(
        WAREHOUSES_URL,
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
              warehousesBody
            ),

          cache:
            "no-store",
        }
      );


    const warehousesText =
      await warehousesResponse
        .text();


    const warehousesData =
      parseJson(
        warehousesText
      );


    if (
      !warehousesResponse.ok
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          stage:
            "wb-warehouses",

          message:
            "Ошибка точечного запроса wb-warehouses",

          productsProducts: {

            status:
              productsResponse.status,

            itemsReceived:
              productItems.length,

            items:
              productItems,

          },

          wbStatus:
            warehousesResponse.status,

          wbResponse:
            warehousesData,
        },
        {
          status:
            warehousesResponse.status,
        }
      );

    }


    const warehouseItems =
      Array.isArray(
        warehousesData
          ?.data
          ?.items
      )
        ?
        warehousesData
          .data
          .items
        :
        [];


    // ========================================================
    // 5. ГРУППИРУЕМ PRODUCTS/PRODUCTS ПО NMID
    // ========================================================

    const productByNmId =
      new Map<
        number,
        any
      >();


    for (
      const item
      of productItems
    ) {

      const nmId =
        Number(
          item
            ?.nmID
          ??
          item
            ?.nmId
      );


      if (
        Number.isFinite(
          nmId
        )
      ) {

        productByNmId.set(
          nmId,
          item
        );

      }

    }


    // ========================================================
    // 6. ГРУППИРУЕМ WB-WAREHOUSES
    // ========================================================

    const warehousesByNmId =
      new Map<
        number,
        any[]
      >();


    for (
      const item
      of warehouseItems
    ) {

      const nmId =
        Number(
          item
            ?.nmId
          ??
          item
            ?.nmID
      );


      if (
        !Number.isFinite(
          nmId
        )
      ) {

        continue;

      }


      const current =
        warehousesByNmId.get(
          nmId
        )
        ??
        [];


      current.push(
        item
      );


      warehousesByNmId.set(
        nmId,
        current
      );

    }


    // ========================================================
    // 7. ИТОГ ПО КАЖДОМУ SKU
    // ========================================================

    const checks =
      MISSING_NM_IDS.map(
        (nmId) => {

          const product =
            productByNmId.get(
              nmId
            )
            ??
            null;


          const warehouses =
            warehousesByNmId.get(
              nmId
            )
            ??
            [];


          const warehouseQuantity =
            warehouses.reduce(
              (
                sum:
                  number,

                row:
                  any
              ) => {

                return (
                  sum
                  +
                  Math.max(
                    0,
                    Number(
                      row
                        ?.quantity
                    )
                    ||
                    0
                  )
                );

              },
              0
            );


          const inWayToClient =
            warehouses.reduce(
              (
                sum:
                  number,

                row:
                  any
              ) => {

                return (
                  sum
                  +
                  Math.max(
                    0,
                    Number(
                      row
                        ?.inWayToClient
                    )
                    ||
                    0
                  )
                );

              },
              0
            );


          const inWayFromClient =
            warehouses.reduce(
              (
                sum:
                  number,

                row:
                  any
              ) => {

                return (
                  sum
                  +
                  Math.max(
                    0,
                    Number(
                      row
                        ?.inWayFromClient
                    )
                    ||
                    0
                  )
                );

              },
              0
            );


          const productReportFound =
            product
            !==
            null;


          const warehouseRowsFound =
            warehouses.length
            >
            0;


          let conclusion =
            "";


          // --------------------------------------------------
          // СЦЕНАРИЙ 1
          // --------------------------------------------------

          if (
            productReportFound
          ) {

            conclusion =
              "SKU находится при точечном запросе products/products. Значит, проблема не в отсутствии товара у WB, а в полном снимке или логике его получения.";

          }


          // --------------------------------------------------
          // СЦЕНАРИЙ 2
          // --------------------------------------------------

          else if (
            warehouseRowsFound
            &&
            warehouseQuantity
            >
            0
          ) {

            conclusion =
              "SKU отсутствует в products/products, но wb-warehouses показывает реальный положительный остаток. Такой SKU нельзя считать нулевым. Для него понадобится резервный источник остатка.";

          }


          // --------------------------------------------------
          // СЦЕНАРИЙ 3
          // --------------------------------------------------

          else if (
            warehouseRowsFound
            &&
            warehouseQuantity
            ===
            0
          ) {

            conclusion =
              "SKU отсутствует в products/products, но wb-warehouses знает этот товар и показывает остаток 0. Вероятнее всего текущий FBW-остаток действительно равен нулю.";

          }


          // --------------------------------------------------
          // СЦЕНАРИЙ 4
          // --------------------------------------------------

          else {

            conclusion =
              "SKU отсутствует сразу в обоих текущих отчётах остатков WB. Нужно отдельно проверить состояние карточки товара. Пока автоматически считать остаток нулевым не будем.";

          }


          return {

            nmId,


            productsProducts: {

              found:
                productReportFound,

              stockCount:
                product
                  ?.metrics
                  ?.stockCount
                ??
                null,

              toClientCount:
                product
                  ?.metrics
                  ?.toClientCount
                ??
                null,

              fromClientCount:
                product
                  ?.metrics
                  ?.fromClientCount
                ??
                null,

              availability:
                product
                  ?.metrics
                  ?.availability
                ??
                null,

              vendorCode:
                product
                  ?.vendorCode
                ??
                null,

              productName:
                product
                  ?.name
                ??
                null,

            },


            wbWarehouses: {

              found:
                warehouseRowsFound,

              rows:
                warehouses.length,

              quantity:
                warehouseQuantity,

              inWayToClient,

              inWayFromClient,

              warehouses:
                warehouses.map(
                  (
                    row:
                      any
                  ) => ({

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

                    chrtId:
                      row
                        ?.chrtId
                      ??
                      null,

                    quantity:
                      Number(
                        row
                          ?.quantity
                      )
                      ||
                      0,

                    inWayToClient:
                      Number(
                        row
                          ?.inWayToClient
                      )
                      ||
                      0,

                    inWayFromClient:
                      Number(
                        row
                          ?.inWayFromClient
                      )
                      ||
                      0,

                  })
                ),

            },


            conclusion,

          };

        }
      );


    // ========================================================
    // 8. СВОДКА
    // ========================================================

    const foundInProducts =
      checks.filter(
        (item) =>
          item
            .productsProducts
            .found
      ).length;


    const foundInWarehouses =
      checks.filter(
        (item) =>
          item
            .wbWarehouses
            .found
      ).length;


    const positiveWarehouseStock =
      checks.filter(
        (item) =>
          item
            .wbWarehouses
            .quantity
          >
          0
      ).length;


    const absentEverywhere =
      checks.filter(
        (item) =>
          !item
            .productsProducts
            .found
          &&
          !item
            .wbWarehouses
            .found
      ).length;


    // ========================================================
    // 9. ОТВЕТ
    // ========================================================

    return NextResponse.json({

      ok:
        true,


      message:
        "Проверка отсутствующих SKU WB завершена",


      testedNmIds:
        MISSING_NM_IDS,


      reportDate,


      sources: {

        productsProducts: {

          endpoint:
            PRODUCTS_URL,

          stockType:
            "wb",

          skipDeletedNm:
            false,

          httpStatus:
            productsResponse.status,

          returnedItems:
            productItems.length,

        },


        wbWarehouses: {

          endpoint:
            WAREHOUSES_URL,

          httpStatus:
            warehousesResponse.status,

          returnedRows:
            warehouseItems.length,

        },

      },


      summary: {

        skuChecked:
          MISSING_NM_IDS.length,

        foundInProductsProducts:
          foundInProducts,

        foundInWbWarehouses:
          foundInWarehouses,

        skuWithPositivePhysicalStock:
          positiveWarehouseStock,

        absentInBothReports:
          absentEverywhere,

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
            "Неизвестная ошибка диагностики отсутствующих SKU",
      },
      {
        status:
          500,
      }
    );

  }

}
