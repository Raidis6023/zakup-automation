import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const PRODUCTS_URL =
  "https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/products";


// Для Базового токена WB:
// минимум 30 минут между запросами отчёта остатков.
const MIN_INTERVAL_MINUTES = 30;


// Небольшой запас, чтобы не попасть ровно в границу лимита.
const SAFETY_SECONDS = 15;


// ============================================================
// ПРОБЛЕМНЫЕ SKU
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
      raw: text,
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
        part.type === "year"
    )?.value;


  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;


  const day =
    parts.find(
      (part) =>
        part.type === "day"
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


  return `${year}-${month}-${day}`;

}


// ============================================================
// SUPABASE CONFIG
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env.SUPABASE_URL
    ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;


  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env.SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseKey) {

    throw new Error(
      "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseKey,
  };

}


// ============================================================
// ЧИТАЕМ ПОСЛЕДНЮЮ СИНХРОНИЗАЦИЮ ОСТАТКОВ
// ============================================================

async function getLastStocksSuccess():
  Promise<string | null> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const url =
    `${supabaseUrl}/rest/v1/wb_sync_state`
    +
    "?sync_key=eq.stocks"
    +
    "&select=last_success_at"
    +
    "&limit=1";


  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {

          apikey:
            supabaseKey,

          Authorization:
            `Bearer ${supabaseKey}`,

          Accept:
            "application/json",

        },

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Не удалось прочитать wb_sync_state: ${text}`
    );

  }


  const rows =
    parseJson(
      text
    );


  if (
    !Array.isArray(
      rows
    )
    ||
    rows.length === 0
  ) {

    return null;

  }


  return (
    rows[0]
      ?.last_success_at
    ??
    null
  );

}


// ============================================================
// GET
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


  try {

    // ========================================================
    // 1. ПРОВЕРЯЕМ, ПРОШЛО ЛИ 30 МИНУТ
    // ========================================================

    const lastStocksSuccess =
      await getLastStocksSuccess();


    if (
      lastStocksSuccess
    ) {

      const lastTime =
        new Date(
          lastStocksSuccess
        ).getTime();


      if (
        Number.isFinite(
          lastTime
        )
      ) {

        const allowedAtMs =
          lastTime
          +
          MIN_INTERVAL_MINUTES
          *
          60
          *
          1000
          +
          SAFETY_SECONDS
          *
          1000;


        if (
          Date.now()
          <
          allowedAtMs
        ) {

          const secondsRemaining =
            Math.ceil(
              (
                allowedAtMs
                -
                Date.now()
              )
              /
              1000
            );


          const minutesRemaining =
            Math.ceil(
              secondsRemaining
              /
              60
            );


          return NextResponse.json({

            ok:
              true,

            skipped:
              true,

            wildberriesRequestSent:
              false,

            message:
              "Диагностический запрос пока не отправлен, чтобы не нарушить лимит Базового токена WB",

            rateLimitProtection: {

              minIntervalMinutes:
                MIN_INTERVAL_MINUTES,

              safetySeconds:
                SAFETY_SECONDS,

              lastStocksSuccess,

              nextAllowedAt:
                new Date(
                  allowedAtMs
                ).toISOString(),

              secondsRemaining,

              minutesRemaining,

            },

            instruction:
              `Повтори открытие этой ссылки примерно через ${minutesRemaining} мин.`,

          });

        }

      }

    }


    // ========================================================
    // 2. ФОРМИРУЕМ ТОЧЕЧНЫЙ ЗАПРОС
    // ========================================================

    const reportDate =
      getMoscowDate();


    const requestBody = {

      nmIDs:
        MISSING_NM_IDS,


      currentPeriod: {

        start:
          reportDate,

        end:
          reportDate,

      },


      stockType:
        "wb",


      skipDeletedNm:
        false,


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


    // ========================================================
    // 3. ЗАПРОС К WB
    // ========================================================

    const response =
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
              requestBody
            ),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    const data =
      parseJson(
        text
      );


    // ========================================================
    // 4. RATE LIMIT HEADERS
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


    const rateLimit = {

      retry:
        retryHeader,

      reset:
        resetHeader,

      limit:
        limitHeader,

      remaining:
        remainingHeader,

    };


    // ========================================================
    // 5. 429
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
            "WB всё ещё ограничивает запрос по лимиту Базового токена",

          wbStatus:
            429,

          rateLimit,

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
    // 6. ДРУГАЯ ОШИБКА
    // ========================================================

    if (!response.ok) {

      return NextResponse.json(
        {

          ok:
            false,

          message:
            "Wildberries вернул ошибку при точечной проверке SKU",

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
    // 7. ЧИТАЕМ ТОВАРЫ
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
    // 8. СОБИРАЕМ ПО NM ID
    // ========================================================

    const byNmId =
      new Map<
        number,
        any
      >();


    for (
      const item
      of items
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
        !Number.isFinite(
          nmId
        )
      ) {

        continue;

      }


      byNmId.set(
        nmId,
        item
      );

    }


    // ========================================================
    // 9. ПРОВЕРЯЕМ КАЖДЫЙ ИЗ 6 SKU
    // ========================================================

    const checks =
      MISSING_NM_IDS.map(
        (nmId) => {

          const product =
            byNmId.get(
              nmId
            )
            ??
            null;


          const found =
            product
            !==
            null;


          const stockCount =
            found
              ?
              Number(
                product
                  ?.metrics
                  ?.stockCount
                ??
                0
              )
              :
              null;


          const toClientCount =
            found
              ?
              Number(
                product
                  ?.metrics
                  ?.toClientCount
                ??
                0
              )
              :
              null;


          const fromClientCount =
            found
              ?
              Number(
                product
                  ?.metrics
                  ?.fromClientCount
                ??
                0
              )
              :
              null;


          let conclusion:
            string;


          if (
            found
          ) {

            conclusion =
              "SKU найден при точечном запросе. Значит, его отсутствие в полном snapshot нужно отдельно объяснить логикой выдачи WB.";

          } else {

            conclusion =
              "SKU не возвращён даже при прямом запросе по nmID. Пока не считаем это автоматически нулевым остатком.";

          }


          return {

            nmId,

            found,

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

            stockCount,

            toClientCount,

            fromClientCount,

            availability:
              product
                ?.metrics
                ?.availability
              ??
              null,

            conclusion,

          };

        }
      );


    // ========================================================
    // 10. SUMMARY
    // ========================================================

    const foundCount =
      checks.filter(
        (item) =>
          item.found
      ).length;


    const notFoundCount =
      checks.filter(
        (item) =>
          !item.found
      ).length;


    const foundWithStock =
      checks.filter(
        (item) =>
          item.found
          &&
          (
            item.stockCount
            ??
            0
          )
          >
          0
      ).length;


    const foundWithZeroStock =
      checks.filter(
        (item) =>
          item.found
          &&
          (
            item.stockCount
            ??
            0
          )
          ===
          0
      ).length;


    // ========================================================
    // 11. ОТВЕТ
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      message:
        "Точечная проверка отсутствующих SKU завершена",

      wildberriesRequestSent:
        true,


      source: {

        endpoint:
          PRODUCTS_URL,

        stockType:
          "wb",

        reportDate,

      },


      rateLimit,


      summary: {

        skuChecked:
          MISSING_NM_IDS.length,

        found:
          foundCount,

        notFound:
          notFoundCount,

        foundWithPositiveStock:
          foundWithStock,

        foundWithZeroStock:
          foundWithZeroStock,

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
            "Неизвестная ошибка проверки SKU",

      },
      {
        status:
          500,
      }
    );

  }

}
