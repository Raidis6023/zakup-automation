import {
  NextRequest,
  NextResponse,
} from "next/server";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// TYPES
// ============================================================

type StepName =
  | "stocks"
  | "sales"
  | "daily_sales";


type StepResult = {
  step: StepName;
  path: string;
  status: number;
  attempts: number;
  body: unknown;
};


class CronStepError extends Error {

  step: StepName;
  path: string;
  status: number;
  attempts: number;
  body: unknown;


  constructor({
    step,
    path,
    status,
    attempts,
    body,
  }: {
    step: StepName;
    path: string;
    status: number;
    attempts: number;
    body: unknown;
  }) {

    super(
      `Ошибка шага ${step}: HTTP ${status}`
    );


    this.name =
      "CronStepError";


    this.step =
      step;


    this.path =
      path;


    this.status =
      status;


    this.attempts =
      attempts;


    this.body =
      body;

  }

}


// ============================================================
// HELPERS
// ============================================================

function sleep(
  milliseconds: number
) {

  return new Promise<void>(
    resolve => {

      setTimeout(
        resolve,
        milliseconds
      );

    }
  );

}


async function parseResponse(
  response: Response
):
Promise<unknown> {

  const text =
    await response.text();


  if (!text) {

    return null;

  }


  try {

    return JSON.parse(
      text
    );

  } catch {

    return {
      raw_response:
        text,
    };

  }

}


function responseIsOk(
  body: unknown
):
boolean {

  if (
    typeof body !==
      "object"
    ||
    body ===
      null
  ) {

    return false;

  }


  return (
    body as {
      ok?: unknown;
    }
  ).ok === true;

}


// ============================================================
// RUN ONE INTERNAL API STEP
//
// Для временных 5xx / fetch failed:
// делаем одну повторную попытку.
//
// 4xx не повторяем.
// Например, preflight 409 нужно именно исправлять,
// а не тыкать в него ещё десять раз.
// ============================================================

async function runStep({
  origin,
  step,
  path,
}: {
  origin: string;
  step: StepName;
  path: string;
}):
Promise<StepResult> {

  const maxAttempts =
    2;


  let lastNetworkError:
    string | null =
    null;


  for (
    let attempt =
      1;

    attempt <=
      maxAttempts;

    attempt +=
      1
  ) {

    try {

      const response =
        await fetch(
          `${origin}${path}`,
          {
            method:
              "POST",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",
          }
        );


      const body =
        await parseResponse(
          response
        );


      if (
        response.ok
        &&
        responseIsOk(
          body
        )
      ) {

        return {
          step,
          path,

          status:
            response.status,

          attempts:
            attempt,

          body,
        };

      }


      const canRetry =
        response.status >=
          500
        &&
        attempt <
          maxAttempts;


      if (canRetry) {

        await sleep(
          3000
        );

        continue;

      }


      throw new CronStepError({
        step,
        path,

        status:
          response.status,

        attempts:
          attempt,

        body,
      });

    } catch (error) {

      if (
        error instanceof
        CronStepError
      ) {

        throw error;

      }


      lastNetworkError =
        error instanceof Error
          ? error.message
          : String(error);


      if (
        attempt <
        maxAttempts
      ) {

        await sleep(
          3000
        );

        continue;

      }

    }

  }


  throw new CronStepError({
    step,
    path,

    status:
      0,

    attempts:
      maxAttempts,

    body: {
      error:
        lastNetworkError
        ??
        "Неизвестная сетевая ошибка",
    },
  });

}


// ============================================================
// GET
//
// Vercel Cron вызывает route именно GET-запросом.
//
// Порядок:
//
// 1. Остатки
// 2. Сырые продажи / возвраты / parent orders
// 3. Пересчёт yandex_sales_daily
//
// Если любой шаг падает,
// следующие шаги НЕ выполняются.
// ============================================================

export async function GET(
  request: NextRequest
) {

  const cronSecret =
    process.env
      .CRON_SECRET;


  // ==========================================================
  // CONFIG CHECK
  // ==========================================================

  if (!cronSecret) {

    console.error(
      "YANDEX DAILY CRON: CRON_SECRET is missing"
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          "CRON_SECRET не настроен",
      },
      {
        status:
          500,
      }
    );

  }


  // ==========================================================
  // AUTH
  // ==========================================================

  const authorization =
    request.headers.get(
      "authorization"
    );


  if (
    authorization !==
    `Bearer ${cronSecret}`
  ) {

    console.warn(
      "YANDEX DAILY CRON: unauthorized request"
    );


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
  // START
  // ==========================================================

  const startedAt =
    new Date();


  const completedSteps:
    StepResult[] =
    [];


  const origin =
    request.nextUrl.origin;


  console.log(
    "YANDEX DAILY CRON START",
    {
      started_at:
        startedAt.toISOString(),

      origin,
    }
  );


  try {

    // ========================================================
    // 1. STOCKS
    // ========================================================

    const stocks =
      await runStep({
        origin,

        step:
          "stocks",

        path:
          "/api/yandex/stocks",
      });


    completedSteps.push(
      stocks
    );


    console.log(
      "YANDEX DAILY CRON STOCKS OK"
    );


    // ========================================================
    // 2. SALES
    // ========================================================

    const sales =
      await runStep({
        origin,

        step:
          "sales",

        path:
          "/api/yandex/sales",
      });


    completedSteps.push(
      sales
    );


    console.log(
      "YANDEX DAILY CRON SALES OK"
    );


    // ========================================================
    // 3. DAILY SALES
    // ========================================================

    const dailySales =
      await runStep({
        origin,

        step:
          "daily_sales",

        path:
          "/api/yandex/sales/daily-sync",
      });


    completedSteps.push(
      dailySales
    );


    console.log(
      "YANDEX DAILY CRON DAILY SALES OK"
    );


    // ========================================================
    // SUCCESS
    // ========================================================

    const finishedAt =
      new Date();


    const durationMs =
      finishedAt.getTime()
      -
      startedAt.getTime();


    console.log(
      "YANDEX DAILY CRON SUCCESS",
      {
        started_at:
          startedAt.toISOString(),

        finished_at:
          finishedAt.toISOString(),

        duration_ms:
          durationMs,
      }
    );


    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "yandex_daily_cron",

        writes_to_yandex:
          false,

        writes_to_database:
          true,

        schedule:
          "07:00 Asia/Krasnoyarsk",

        started_at:
          startedAt.toISOString(),

        finished_at:
          finishedAt.toISOString(),

        duration_ms:
          durationMs,

        steps:
          completedSteps,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    // ========================================================
    // FAILED STEP
    // ========================================================

    const finishedAt =
      new Date();


    const durationMs =
      finishedAt.getTime()
      -
      startedAt.getTime();


    if (
      error instanceof
      CronStepError
    ) {

      console.error(
        "YANDEX DAILY CRON FAILED",
        {
          failed_step:
            error.step,

          status:
            error.status,

          attempts:
            error.attempts,

          body:
            error.body,
        }
      );


      return NextResponse.json(
        {
          ok:
            false,

          mode:
            "yandex_daily_cron",

          writes_to_yandex:
            false,

          failed_step:
            error.step,

          failed_path:
            error.path,

          failed_status:
            error.status,

          failed_attempts:
            error.attempts,

          failed_body:
            error.body,

          completed_steps:
            completedSteps,

          started_at:
            startedAt.toISOString(),

          finished_at:
            finishedAt.toISOString(),

          duration_ms:
            durationMs,
        },
        {
          status:
            500,
        }
      );

    }


    console.error(
      "YANDEX DAILY CRON UNKNOWN ERROR",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        mode:
          "yandex_daily_cron",

        writes_to_yandex:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(error),

        completed_steps:
          completedSteps,

        started_at:
          startedAt.toISOString(),

        finished_at:
          finishedAt.toISOString(),

        duration_ms:
          durationMs,
      },
      {
        status:
          500,
      }
    );

  }

}
