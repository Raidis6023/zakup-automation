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
// AUTH
//
// Vercel Cron при наличии CRON_SECRET
// отправляет:
// Authorization: Bearer <CRON_SECRET>
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
// ВНУТРЕННИЙ ВЫЗОВ НАШЕГО ROUTE
// ============================================================

async function callRoute(
  url:
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
  // 2. ОПРЕДЕЛЯЕМ ТЕКУЩИЙ DOMAIN
  // ==========================================================

  const origin =
    new URL(
      request.url
    ).origin;


  // ==========================================================
  // 3. ROUTES
  //
  // sync-orders:
  //   реальные FBW продажи
  //   +
  //   FBW отмены
  //
  // sync-stocks:
  //   текущий FBW остаток
  //
  // force=1 нужен остаткам, чтобы ежедневный cron
  // не остановился на внутренней проверке свежести.
  // ==========================================================

  const salesUrl =
    `${origin}/api/wb/sync-orders?force=1&source=daily-cron`;


  const stocksUrl =
    `${origin}/api/wb/sync-stocks?force=1&source=daily-cron`;


  // ==========================================================
  // 4. ЗАПУСКАЕМ ПАРАЛЛЕЛЬНО
  //
  // Это разные методы WB.
  // Так ежедневное обновление занимает меньше времени.
  // ==========================================================

  const [
    salesResult,
    stocksResult,
  ] =
    await Promise.all([

      callRoute(
        salesUrl
      ),

      callRoute(
        stocksUrl
      ),

    ]);


  // ==========================================================
  // 5. ОБЩИЙ РЕЗУЛЬТАТ
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


  // ==========================================================
  // Если один из источников не обновился,
  // cron должен считаться ошибочным.
  // Это полезно в Vercel Logs.
  // ==========================================================

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
//
// Именно GET вызывает Vercel Cron.
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  return runDailySync(
    request
  );

}
