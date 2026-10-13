import {
  NextRequest,
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  300;


// ============================================================
// TYPES
// ============================================================

type InternalResult = {

  ok:
    boolean;

  httpStatus:
    number;

  durationMs:
    number;

  data:
    any;

};


// ============================================================
// JSON
// ============================================================

function parseJson(
  text:
    string
) {

  if (!text) {

    return null;

  }


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
// CRON SECRET
// ============================================================

function getCronSecret() {

  const cronSecret =
    process.env.CRON_SECRET;


  if (!cronSecret) {

    throw new Error(
      "Не найдена переменная окружения CRON_SECRET"
    );

  }


  return cronSecret;

}


// ============================================================
// ПРОВЕРКА VERCEL CRON
// ============================================================

function isAuthorized(
  request:
    NextRequest
) {

  const cronSecret =
    process.env.CRON_SECRET;


  if (!cronSecret) {

    return false;

  }


  return (
    request.headers.get(
      "authorization"
    )
    ===
    `Bearer ${cronSecret}`
  );

}


// ============================================================
// ВНУТРЕННИЙ ВЫЗОВ WB ROUTE
// ============================================================

async function callRoute(
  url:
    string,

  cronSecret:
    string,

  name:
    string
):
Promise<InternalResult> {

  const startedAt =
    Date.now();


  try {

    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          cache:
            "no-store",

          redirect:
            "manual",

          headers: {

            Accept:
              "application/json",

            "X-Internal-WB-Daily-Sync":
              "1",

            "X-WB-Internal-Secret":
              cronSecret,

          },
        }
      );


    const text =
      await response.text();


    const data =
      parseJson(
        text
      );


    // ========================================================
    // ПИШЕМ ДИАГНОСТИКУ В VERCEL LOGS
    //
    // Секреты сюда НЕ выводятся.
    // ========================================================

    console.log(
      `[WB DAILY] ${name}`,
      {
        status:
          response.status,

        redirected:
          response.status >= 300
          &&
          response.status < 400,

        location:
          response.headers.get(
            "location"
          ),

        ok:
          response.ok,

        apiOk:
          data?.ok,

        blockedByRateLimit:
          data?.blockedByRateLimit,

        message:
          data?.message
          ??
          null,
      }
    );


    const logicalOk =
      response.ok
      &&
      data?.ok !==
        false
      &&
      data?.blockedByRateLimit !==
        true;


    return {

      ok:
        logicalOk,

      httpStatus:
        response.status,

      durationMs:
        Date.now()
        -
        startedAt,

      data,

    };

  } catch (
    error
  ) {

    console.error(
      `[WB DAILY] ${name} exception`,
      error
    );


    return {

      ok:
        false,

      httpStatus:
        0,

      durationMs:
        Date.now()
        -
        startedAt,

      data: {

        ok:
          false,

        error:
          error instanceof Error
            ?
            error.message
            :
            String(
              error
            ),

      },

    };

  }

}


// ============================================================
// DAILY SYNC
// ============================================================

async function runDailySync(
  request:
    NextRequest
) {

  const startedAt =
    Date.now();


  // ==========================================================
  // 1. AUTH VERCEL CRON
  // ==========================================================

  if (
    !isAuthorized(
      request
    )
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


  // ==========================================================
  // 2. SECRET
  // ==========================================================

  const cronSecret =
    getCronSecret();


  // ==========================================================
  // 3. DOMAIN
  //
  // Используем основной production domain,
  // а не случайный deployment hostname.
  // ==========================================================

  const origin =
    "https://zakup-automation.vercel.app";


  // ==========================================================
  // 4. ROUTES
  // ==========================================================

  const salesUrl =
    `${origin}/api/wb/sync-orders?force=1&source=daily-cron`;


  const stocksUrl =
    `${origin}/api/wb/sync-stocks?force=1&source=daily-cron`;


  // ==========================================================
  // 5. ЗАПУСКАЕМ ПАРАЛЛЕЛЬНО
  // ==========================================================

  const [
    salesResult,
    stocksResult,
  ] =
    await Promise.all([

      callRoute(
        salesUrl,
        cronSecret,
        "sales-and-cancellations"
      ),

      callRoute(
        stocksUrl,
        cronSecret,
        "stocks"
      ),

    ]);


  // ==========================================================
  // 6. ОБЩИЙ РЕЗУЛЬТАТ
  // ==========================================================

  const allOk =
    salesResult.ok
    &&
    stocksResult.ok;


  const completedAt =
    new Date()
      .toISOString();


  const result = {

    ok:
      allOk,

    mode:
      "wb_daily_sync",

    schedule: {

      utc:
        "22:00",

      krasnoyarsk:
        "05:00–06:00",

      timezone:
        "Asia/Krasnoyarsk",

      note:
        "На Vercel Hobby cron имеет гибкое окно до 1 часа. Запуск сделан заранее, чтобы к 07:00 данные были свежими.",

    },

    completedAt,


    salesAndCancellations: {

      ok:
        salesResult.ok,

      httpStatus:
        salesResult.httpStatus,

      durationMs:
        salesResult.durationMs,

      result:
        salesResult.data,

    },


    stocks: {

      ok:
        stocksResult.ok,

      httpStatus:
        stocksResult.httpStatus,

      durationMs:
        stocksResult.durationMs,

      result:
        stocksResult.data,

    },


    durationMs:
      Date.now()
      -
      startedAt,

  };


  console.log(
    "[WB DAILY] finished",
    {
      ok:
        allOk,

      salesStatus:
        salesResult.httpStatus,

      salesOk:
        salesResult.ok,

      stocksStatus:
        stocksResult.httpStatus,

      stocksOk:
        stocksResult.ok,

      durationMs:
        Date.now()
        -
        startedAt,
    }
  );


  return NextResponse.json(
    result,
    {
      status:
        allOk
          ?
          200
          :
          502,
    }
  );

}


// ============================================================
// GET
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  return runDailySync(
    request
  );

}
