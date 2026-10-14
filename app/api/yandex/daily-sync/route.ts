export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


// ============================================================
// SETTINGS
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


type Config = {
  cronSecret:
    string;

  supabaseUrl:
    string;

  supabaseSecretKey:
    string;
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

function getConfig():
Config {

  const cronSecret =
    process.env
      .CRON_SECRET
      ?.trim();


  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim()
    ||
    process.env
      .SUPABASE_URL
      ?.trim();


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY
      ?.trim()
    ||
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
      ?.trim();


  if (!cronSecret) {

    throw new Error(
      "Не найдена переменная CRON_SECRET"
    );

  }


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL или SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY"
    );

  }


  return {
    cronSecret,
    supabaseUrl,
    supabaseSecretKey,
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
// SUPABASE HEADERS
// ============================================================

function getSupabaseHeaders(
  secretKey:
    string
) {

  return {
    apikey:
      secretKey,

    Authorization:
      `Bearer ${secretKey}`,

    "Content-Type":
      "application/json",

    Accept:
      "application/json",
  };

}


// ============================================================
// JOURNAL: CREATE RUN
// ============================================================

async function createJournalRun({
  config,
  request,
}: {
  config:
    Config;

  request:
    Request;
}):
Promise<string> {

  const url =
    new URL(
      `${config.supabaseUrl}/rest/v1/marketplace_daily_sync_runs`
    );


  url.searchParams.set(
    "select",
    "id"
  );


  const requestUrl =
    new URL(
      request.url
    );


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "POST",

        headers: {
          ...getSupabaseHeaders(
            config.supabaseSecretKey
          ),

          Prefer:
            "return=representation",
        },

        body:
          JSON.stringify({
            marketplace:
              "yandex_market",

            status:
              "running",

            details: {
              request_method:
                request.method,

              request_path:
                requestUrl.pathname,

              user_agent:
                request.headers.get(
                  "user-agent"
                ),

              vercel_id:
                request.headers.get(
                  "x-vercel-id"
                ),
            },
          }),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Не удалось создать marketplace_daily_sync_runs: HTTP ${response.status}: ${text}`
    );

  }


  const rows =
    JSON.parse(
      text
    ) as Array<{
      id?: string;
    }>;


  const id =
    rows[0]
      ?.id;


  if (!id) {

    throw new Error(
      "Supabase не вернул id marketplace_daily_sync_runs"
    );

  }


  return id;

}


// ============================================================
// JOURNAL: FINISH RUN
// ============================================================

async function finishJournalRun({
  config,
  journalRunId,
  status,
  startedAtMs,
  failedStep,
  errorMessage,
  details,
}: {
  config:
    Config;

  journalRunId:
    string;

  status:
    "success"
    | "failed";

  startedAtMs:
    number;

  failedStep?:
    string | null;

  errorMessage?:
    string | null;

  details:
    JsonObject;
}) {

  const url =
    new URL(
      `${config.supabaseUrl}/rest/v1/marketplace_daily_sync_runs`
    );


  url.searchParams.set(
    "id",
    `eq.${journalRunId}`
  );


  const finishedAt =
    new Date();


  const durationMs =
    Math.max(
      0,
      finishedAt.getTime()
      -
      startedAtMs
    );


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "PATCH",

        headers: {
          ...getSupabaseHeaders(
            config.supabaseSecretKey
          ),

          Prefer:
            "return=minimal",
        },

        body:
          JSON.stringify({
            status,

            finished_at:
              finishedAt.toISOString(),

            failed_step:
              failedStep
              ??
              null,

            error_message:
              errorMessage
              ??
              null,

            duration_ms:
              durationMs,

            details,
          }),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Не удалось завершить marketplace_daily_sync_runs: HTTP ${response.status}: ${text}`
    );

  }

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


      if (
        response.ok
        &&
        body.ok ===
          true
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
      // Только временные 5xx повторяем.
      // 4xx сами себя не починят.
      // ======================================================

      if (
        response.status >=
          500
        &&
        attempt <
          INTERNAL_MAX_RETRIES
      ) {

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
// SERIALIZE STEPS FOR JOURNAL
// ============================================================

function serializeCompletedSteps(
  steps:
    StepResult[]
) {

  return steps.map(
    step => ({
      step:
        step.step,

      path:
        step.path,

      status:
        step.status,

      attempts:
        step.attempts,

      body:
        step.body,
    })
  );

}


// ============================================================
// DAILY SYNC
// ============================================================

async function runDailySync(
  request:
    Request
) {

  const startedAtMs =
    Date.now();


  const startedAtIso =
    new Date(
      startedAtMs
    ).toISOString();


  const completedSteps:
    StepResult[] =
    [];


  let journalRunId:
    string | null =
    null;


  let config:
    Config;


  // ==========================================================
  // CONFIG
  // ==========================================================

  try {

    config =
      getConfig();

  } catch (error) {

    return Response.json(
      {
        ok:
          false,

        source:
          "yandex_daily_sync",

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status:
          500,
      }
    );

  }


  // ==========================================================
  // AUTH
  //
  // Не пишем неавторизованные попытки в журнал,
  // чтобы таблица не превратилась в мусорку.
  // ==========================================================

  if (
    !isAuthorized(
      request,
      config.cronSecret
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


  try {

    // ========================================================
    // JOURNAL START
    // ========================================================

    journalRunId =
      await createJournalRun({
        config,
        request,
      });


    // ========================================================
    // ORIGIN
    // ========================================================

    const requestUrl =
      new URL(
        request.url
      );


    const origin =
      requestUrl.origin;


    // ========================================================
    // 1. STOCKS
    // ========================================================

    const stocksResult =
      await runInternalPost({
        origin,

        cronSecret:
          config.cronSecret,

        step:
          "stocks",

        path:
          "/api/yandex/stocks",
      });


    completedSteps.push(
      stocksResult
    );


    // ========================================================
    // 2. SALES
    // ========================================================

    const salesResult =
      await runInternalPost({
        origin,

        cronSecret:
          config.cronSecret,

        step:
          "sales",

        path:
          "/api/yandex/sales",
      });


    completedSteps.push(
      salesResult
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
          salesResult.attempts,

        body: {
          error:
            "Синхронизация продаж завершилась без sync_run_id",

          response:
            salesResult.body,
        },
      });

    }


    // ========================================================
    // 3. SALES DAILY
    // ========================================================

    const dailyResult =
      await runInternalPost({
        origin,

        cronSecret:
          config.cronSecret,

        step:
          "sales_daily",

        path:
          "/api/yandex/sales/daily-sync",
      });


    completedSteps.push(
      dailyResult
    );


    const dailySyncRunId =
      normalizeKey(
        dailyResult
          .body
          .sync_run_id
      );


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
          dailyResult.attempts,

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
    // SUCCESS JOURNAL
    // ========================================================

    await finishJournalRun({
      config,

      journalRunId,

      status:
        "success",

      startedAtMs,

      failedStep:
        null,

      errorMessage:
        null,

      details: {
        started_at:
          startedAtIso,

        sales_sync_run_id:
          salesSyncRunId,

        completed_steps:
          serializeCompletedSteps(
            completedSteps
          ),
      },
    });


    const finishedAt =
      new Date();


    const durationMs =
      finishedAt.getTime()
      -
      startedAtMs;


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

        journal_run_id:
          journalRunId,

        sales_sync_run_id:
          salesSyncRunId,

        steps: {
          stocks: {
            ok:
              true,

            status:
              stocksResult.status,

            attempts:
              stocksResult.attempts,

            body:
              stocksResult.body,
          },

          sales: {
            ok:
              true,

            status:
              salesResult.status,

            attempts:
              salesResult.attempts,

            body:
              salesResult.body,
          },

          sales_daily: {
            ok:
              true,

            status:
              dailyResult.status,

            attempts:
              dailyResult.attempts,

            body:
              dailyResult.body,
          },
        },

        started_at:
          startedAtIso,

        finished_at:
          finishedAt.toISOString(),

        duration_ms:
          durationMs,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    // ========================================================
    // DETERMINE FAILURE
    // ========================================================

    let failedStep:
      string | null =
      null;


    let errorMessage:
      string;


    let errorDetails:
      unknown;


    if (
      error instanceof
      YandexDailySyncStepError
    ) {

      failedStep =
        error.step;


      errorMessage =
        error.message;


      errorDetails = {
        path:
          error.path,

        status:
          error.status,

        attempts:
          error.attempts,

        body:
          error.body,
      };

    } else {

      errorMessage =
        error instanceof Error
          ? error.message
          : String(
              error
            );


      errorDetails = {
        raw_error:
          errorMessage,
      };

    }


    // ========================================================
    // FAILED JOURNAL
    // ========================================================

    if (
      journalRunId
    ) {

      try {

        await finishJournalRun({
          config,

          journalRunId,

          status:
            "failed",

          startedAtMs,

          failedStep,

          errorMessage,

          details: {
            started_at:
              startedAtIso,

            failed:
              errorDetails,

            completed_steps:
              serializeCompletedSteps(
                completedSteps
              ),
          },
        });

      } catch (
        journalError
      ) {

        console.error(
          "YANDEX DAILY SYNC JOURNAL ERROR:",
          journalError
        );

      }

    }


    // ========================================================
    // RESPONSE
    // ========================================================

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

          journal_run_id:
            journalRunId,

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
            serializeCompletedSteps(
              completedSteps
            ),

          duration_ms:
            Date.now()
            -
            startedAtMs,
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

        journal_run_id:
          journalRunId,

        error:
          errorMessage,

        completed_steps:
          serializeCompletedSteps(
            completedSteps
          ),

        duration_ms:
          Date.now()
          -
          startedAtMs,
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
