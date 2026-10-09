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
// AUTH VERCEL CRON
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
// ВНУТРЕННИЙ ВЫЗОВ НАШИХ WB ROUTES
//
// Передаём тот же CRON_SECRET,
// чтобы proxy.ts понимал:
//
// это внутренний доверенный запрос от daily-sync,
// а не посторонний запрос из интернета.
// ============================================================

async function callRoute(
  url:
    string,
  cronSecret:
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

          headers: {

            Accept:
              "application/json",

            Authorization:
              `Bearer ${cronSecret}`,

            "X-Internal-WB-Daily-Sync":
              "1",

          },
        }
      );


    const text =
      await response.text();


    const data =
      parseJson(
        text
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
  // 1. AUTH
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
  // ==========================================================

  const origin =
    new URL(
      request.url
    ).origin;


  // ==========================================================
  // 4. ROUTES
  //
  // sync-orders:
  // реальные FBW продажи + FBW отмены
  //
  // sync-stocks:
  // текущий FBW остаток
  //
  // force=1 нужен остаткам,
  // чтобы cron не остановился на проверке свежести.
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
        cronSecret
      ),

      callRoute(
        stocksUrl,
        cronSecret
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
        "00:00",

      krasnoyarsk:
        "07:00",

      timezone:
        "Asia/Krasnoyarsk",

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
