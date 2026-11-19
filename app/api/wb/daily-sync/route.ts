import { getInternalAppOrigin } from "@/lib/server/internal-origin";
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
// ВНУТРЕННИЙ ВЫЗОВ ЕДИНОГО WB SYNC
// ============================================================

async function callUnifiedSync(
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


    console.log(
      "[WB DAILY] unified-sync",
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
      data?.ok !== false
      &&
      data?.blockedByRateLimit !== true;


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
      "[WB DAILY] unified-sync exception",
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
            ? error.message
            : String(
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
  // 2. SECRET + DOMAIN
  // ==========================================================

  const cronSecret =
    getCronSecret();


  const origin =
    getInternalAppOrigin();


  // ==========================================================
  // 3. ОДИН МАРШРУТ НА ВСЕ ДАННЫЕ WB
  // ==========================================================

  const syncUrl =
    `${origin}/api/wb/sync-stocks?force=1&source=daily-cron`;


  const syncResult =
    await callUnifiedSync(
      syncUrl,
      cronSecret
    );


  // ==========================================================
  // 4. РЕЗУЛЬТАТ
  // ==========================================================

  const completedAt =
    new Date()
      .toISOString();


  const result = {

    ok:
      syncResult.ok,

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
        "Один утренний sync обновляет остатки, продажи и cancelCount. На Vercel Hobby cron имеет гибкое окно до 1 часа, поэтому запуск запланирован заранее, чтобы к 07:00 данные были свежими.",

    },

    completedAt,

    dataSync: {

      ok:
        syncResult.ok,

      httpStatus:
        syncResult.httpStatus,

      durationMs:
        syncResult.durationMs,

      result:
        syncResult.data,

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
        syncResult.ok,

      status:
        syncResult.httpStatus,

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
        syncResult.ok
          ? 200
          : 502,
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
