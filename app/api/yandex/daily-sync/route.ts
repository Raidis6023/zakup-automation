export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const INTERNAL_MAX_RETRIES =
  2;

const RETRY_DELAY_MS =
  3000;


// ============================================================
// TYPES
// ============================================================

type StepName =
  | "stocks"
  | "sales"
  | "sales_daily";


type JsonObject = {
  [key: string]:
    unknown;
};


type StepResult = {
  step:
    StepName;

  path:
    string;

  status:
    number;

  attempts:
    number;

  body:
    JsonObject;
};


// ============================================================
// ERROR
// ============================================================

class YandexDailySyncStepError
  extends Error {

  step:
    StepName;

  path:
    string;

  status:
    number;

  attempts:
    number;

  body:
    unknown;


  constructor({
    step,
    path,
    status,
    attempts,
    body,
  }: {
    step:
      StepName;

    path:
      string;

    status:
      number;

    attempts:
      number;

    body:
      unknown;
  }) {

    super(
      [
        "Ошибка ежедневной синхронизации Яндекса",
        `step=${step}`,
        `HTTP ${status}`,
      ].join(
        ": "
      )
    );


    this.name =
      "YandexDailySyncStepError";


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
  milliseconds:
    number
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


function normalizeKey(
  value:
    unknown
):
string {

  return String(
    value
    ??
    ""
  ).trim();

}


function isJsonObject(
  value:
    unknown
):
value is JsonObject {

  return Boolean(
    value
    &&
    typeof value ===
      "object"
    &&
    !Array.isArray(
      value
    )
  );

}


// ============================================================
// CONFIG
// ============================================================

function getConfig() {

  const cronSecret =
    process.env
      .CRON_SECRET
      ?.trim();


  if (!cronSecret) {

    throw new Error(
      "Не найдена переменная CRON_SECRET"
    );

  }


  return {
    cronSecret,
  };

}


// ============================================================
// AUTH
// ============================================================

function isAuthorized(
  request:
    Request,

  cronSecret:
    string
):
boolean {

  return (
    request.headers.get(
      "authorization"
    )
    ===
    `Bearer ${cronSecret}`
  );

}


// ============================================================
// RESPONSE PARSER
// ============================================================

async function parseResponse(
  response:
    Response
):
Promise<JsonObject> {

  const text =
    await response.text();


  if (!text) {

    return {};

  }


  try {

    const parsed =
      JSON.parse(
        text
      );


    if (
      isJsonObject(
        parsed
      )
    ) {

      return parsed;

    }


    return {
      value:
        parsed,
    };

  } catch {

    return {
      raw_response:
        text,
    };

  }

}


// ============================================================
// INTERNAL POST
// ============================================================

async function runInternalPost({
  origin,
  cronSecret,
  step,
  path,
}: {
  origin:
    string;

  cronSecret:
    string;

  step:
    StepName;

  path:
    string;
}):
Promise<StepResult> {

  let lastNetworkError:
    string | null =
    null;


  for (
    let attempt = 1;
    attempt <= INTERNAL_MAX_RETRIES;
    attempt += 1
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

              Authorization:
                `Bearer ${cronSecret}`,
            },

            cache:
              "no-store",
          }
        );


      const body =
        await parseResponse(
          response
        );


      const bodyOk =
        body.ok ===
        true;


      if (
        response.ok
        &&
        bodyOk
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


      // ======================================================
      // 5xx можно один раз повторить.
      //
      // 4xx не повторяем:
      // mapping / preflight / validation
      // сами по себе не исправятся.
      // ======================================================

      if (
        response.status >=
          500
        &&
        attempt <
          INTERNAL_MAX_RETRIES
      ) {

        console.warn(
          [
            "YANDEX DAILY SYNC RETRY",
            `step=${step}`,
            `HTTP ${response.status}`,
            `attempt=${attempt}/${INTERNAL_MAX_RETRIES}`,
          ].join(
            " | "
          )
        );


        await sleep(
          RETRY_DELAY_MS
        );


        continue;

      }


      throw new YandexDailySyncStepError({
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
        YandexDailySyncStepError
      ) {

        throw error;

      }


      lastNetworkError =
        error instanceof Error
          ? error.message
          : String(
              error
            );


      if (
        attempt <
        INTERNAL_MAX_RETRIES
      ) {

        console.warn(
          [
            "YANDEX DAILY SYNC NETWORK RETRY",
            `step=${step}`,
            `attempt=${attempt}/${INTERNAL_MAX_RETRIES}`,
            `error=${lastNetworkError}`,
          ].join(
            " | "
          )
        );


        await sleep(
          RETRY_DELAY_MS
        );


        continue;

      }

    }

  }


  throw new YandexDailySyncStepError({
    step,

    path,

    status:
      0,

    attempts:
      INTERNAL_MAX_RETRIES,

    body: {
      error:
        lastNetworkError
        ??
        "Неизвестная сетевая ошибка",
    },
  });

}


// ============================================================
// DAILY SYNC
// ============================================================

async function runDailySync(
  request:
    Request
) {

  const startedAt =
    Date.now();


  const startedAtIso =
    new Date()
      .toISOString();


  const completedSteps:
    StepResult[] =
    [];


  try {

    // ========================================================
    // 1. CONFIG + AUTH
    // ========================================================

    const {
      cronSecret,
    } =
      getConfig();


    if (
      !isAuthorized(
        request,
        cronSecret
      )
    ) {

      return Response.json(
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


    // ========================================================
    // 2. ORIGIN
    // ========================================================

    const requestUrl =
      new URL(
        request.url
      );


    const origin =
      requestUrl.origin;


    console.log(
      "YANDEX DAILY SYNC START",
      {
        started_at:
          startedAtIso,

        origin,
      }
    );


    // ========================================================
    // 3. STOCKS
    // ========================================================

    const stocksResult =
      await runInternalPost({
        origin,

        cronSecret,

        step:
          "stocks",

        path:
          "/api/yandex/stocks",
      });


    completedSteps.push(
      stocksResult
    );


    console.log(
      "YANDEX DAILY SYNC STOCKS OK"
    );


    // ========================================================
    // 4. SALES
    // ========================================================

    const salesResult =
      await runInternalPost({
        origin,

        cronSecret,

        step:
          "sales",

        path:
          "/api/yandex/sales",
      });


    completedSteps.push(
      salesResult
    );


    console.log(
      "YANDEX DAILY SYNC SALES OK"
    );


    const salesSyncRunId =
      normalizeKey(
        salesResult
          .body
          .sync_run_id
      );


    if (!salesSyncRunId) {

      throw new YandexDailySyncStepError({
        step:
          "sales",

        path:
          "/api/yandex/sales",

        status:
          500,

        attempts:
          salesResult
            .attempts,

        body: {
          error:
            "Синхронизация продаж завершилась без sync_run_id",

          response:
            salesResult.body,
        },
      });

    }


    // ========================================================
    // 5. SALES DAILY
    // ========================================================

    const dailyResult =
      await runInternalPost({
        origin,

        cronSecret,

        step:
          "sales_daily",

        path:
          "/api/yandex/sales/daily-sync",
      });


    completedSteps.push(
      dailyResult
    );


    console.log(
      "YANDEX DAILY SYNC SALES DAILY OK"
    );


    const dailySyncRunId =
      normalizeKey(
        dailyResult
          .body
          .sync_run_id
      );


    // ========================================================
    // 6. ПРОВЕРЯЕМ, ЧТО DAILY ПЕРЕСЧИТАЛ
    // ТОТ ЖЕ САМЫЙ SALES RUN
    // ========================================================

    if (
      dailySyncRunId
      &&
      dailySyncRunId !==
        salesSyncRunId
    ) {

      throw new YandexDailySyncStepError({
        step:
          "sales_daily",

        path:
          "/api/yandex/sales/daily-sync",

        status:
          500,

        attempts:
          dailyResult
            .attempts,

        body: {
          error:
            "daily-sync пересчитал другой sales sync run",

          expected_sync_run_id:
            salesSyncRunId,

          actual_sync_run_id:
            dailySyncRunId,

          response:
            dailyResult.body,
        },
      });

    }


    // ========================================================
    // 7. SUCCESS
    // ========================================================

    const finishedAt =
      new Date()
        .toISOString();


    const durationMs =
      Date.now()
      -
      startedAt;


    console.log(
      "YANDEX DAILY SYNC SUCCESS",
      {
        sales_sync_run_id:
          salesSyncRunId,

        duration_ms:
          durationMs,
      }
    );


    return Response.json(
      {
        ok:
          true,

        mode:
          "write_sync",

        source:
          "yandex_daily_sync",

        writes_to_yandex:
          false,

        writes_to_database:
          true,

        sales_sync_run_id:
          salesSyncRunId,

        steps: {
          stocks: {
            ok:
              true,

            status:
              stocksResult
                .status,

            attempts:
              stocksResult
                .attempts,

            body:
              stocksResult
                .body,
          },

          sales: {
            ok:
              true,

            status:
              salesResult
                .status,

            attempts:
              salesResult
                .attempts,

            body:
              salesResult
                .body,
          },

          sales_daily: {
            ok:
              true,

            status:
              dailyResult
                .status,

            attempts:
              dailyResult
                .attempts,

            body:
              dailyResult
                .body,
          },
        },

        started_at:
          startedAtIso,

        finished_at:
          finishedAt,

        duration_ms:
          durationMs,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX DAILY SYNC ERROR",
      error
    );


    const durationMs =
      Date.now()
      -
      startedAt;


    if (
      error instanceof
      YandexDailySyncStepError
    ) {

      return Response.json(
        {
          ok:
            false,

          mode:
            "write_sync",

          source:
            "yandex_daily_sync",

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
            completedSteps.map(
              step => ({
                step:
                  step.step,

                path:
                  step.path,

                status:
                  step.status,

                attempts:
                  step.attempts,
              })
            ),

          note:
            "Следующие этапы после ошибки не запускались.",

          duration_ms:
            durationMs,
        },
        {
          status:
            500,
        }
      );

    }


    return Response.json(
      {
        ok:
          false,

        mode:
          "write_sync",

        source:
          "yandex_daily_sync",

        writes_to_yandex:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),

        completed_steps:
          completedSteps.map(
            step => ({
              step:
                step.step,

              path:
                step.path,

              status:
                step.status,

              attempts:
                step.attempts,
            })
          ),

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


// ============================================================
// ROUTES
// ============================================================

export async function GET(
  request:
    Request
) {

  return runDailySync(
    request
  );

}


export async function POST(
  request:
    Request
) {

  return runDailySync(
    request
  );

}
