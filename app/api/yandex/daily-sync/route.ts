export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


const INTERNAL_MAX_RETRIES =
  2;

const RETRY_DELAY_MS =
  3000;


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

  internalBaseUrl:
    string;
};


type TriggerAuth = {
  mode:
    "cron"
    | "user";

  authorization:
    string | null;

  cookie:
    string | null;
};


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


function getInternalBaseUrl():
string {

  const productionHost =
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL
      ?.trim()
    ||
    process.env
      .NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ?.trim();


  if (productionHost) {

    if (
      productionHost.startsWith(
        "http://"
      )
      ||
      productionHost.startsWith(
        "https://"
      )
    ) {

      return productionHost.replace(
        /\/+$/,
        ""
      );

    }


    return `https://${productionHost}`;

  }


  return "https://zakup-automation.vercel.app";

}


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

    internalBaseUrl:
      getInternalBaseUrl(),
  };

}


function getTriggerAuth(
  request:
    Request,

  cronSecret:
    string
):
TriggerAuth | null {

  const authorization =
    request.headers.get(
      "authorization"
    );


  const cookie =
    request.headers.get(
      "cookie"
    );


  if (
    authorization ===
    `Bearer ${cronSecret}`
  ) {

    return {
      mode:
        "cron",

      authorization,

      cookie:
        null,
    };

  }


  if (cookie) {

    return {
      mode:
        "user",

      authorization:
        null,

      cookie,
    };

  }


  return null;

}


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


async function createJournalRun({
  config,
  request,
  triggerAuth,
}: {
  config:
    Config;

  request:
    Request;

  triggerAuth:
    TriggerAuth;
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
              trigger_mode:
                triggerAuth.mode,

              request_method:
                request.method,

              request_path:
                requestUrl.pathname,

              request_origin:
                requestUrl.origin,

              internal_base_url:
                config.internalBaseUrl,

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


async function runInternalPost({
  baseUrl,
  triggerAuth,
  step,
  path,
}: {
  baseUrl:
    string;

  triggerAuth:
    TriggerAuth;

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

      const headers:
        Record<
          string,
          string
        > =
        {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        };


      if (
        triggerAuth.authorization
      ) {

        headers.Authorization =
          triggerAuth.authorization;

      }


      if (
        triggerAuth.cookie
      ) {

        headers.Cookie =
          triggerAuth.cookie;

      }


      const response =
        await fetch(
          `${baseUrl}${path}`,
          {
            method:
              "POST",

            headers,

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
            : String(error),
      },
      {
        status:
          500,
      }
    );

  }


  const triggerAuth =
    getTriggerAuth(
      request,
      config.cronSecret
    );


  if (!triggerAuth) {

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

    journalRunId =
      await createJournalRun({
        config,
        request,
        triggerAuth,
      });


    const baseUrl =
      config.internalBaseUrl;


    const stocksResult =
      await runInternalPost({
        baseUrl,
        triggerAuth,

        step:
          "stocks",

        path:
          "/api/yandex/stocks",
      });


    completedSteps.push(
      stocksResult
    );


    const salesResult =
      await runInternalPost({
        baseUrl,
        triggerAuth,

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
        },
      });

    }


    const dailyResult =
      await runInternalPost({
        baseUrl,
        triggerAuth,

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
        },
      });

    }


    const finishedAt =
      new Date();


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
        trigger_mode:
          triggerAuth.mode,

        started_at:
          startedAtIso,

        internal_base_url:
          baseUrl,

        sales_sync_run_id:
          salesSyncRunId,

        completed_steps:
          serializeCompletedSteps(
            completedSteps
          ),
      },
    });


    return Response.json(
      {
        ok:
          true,

        mode:
          "write_sync",

        source:
          "yandex_daily_sync",

        trigger_mode:
          triggerAuth.mode,

        writes_to_yandex:
          false,

        writes_to_database:
          true,

        journal_run_id:
          journalRunId,

        sales_sync_run_id:
          salesSyncRunId,

        started_at:
          startedAtIso,

        finished_at:
          finishedAt.toISOString(),

        duration_ms:
          finishedAt.getTime()
          -
          startedAtMs,

        steps: {
          stocks:
            stocksResult,

          sales:
            salesResult,

          sales_daily:
            dailyResult,
        },
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    const failedStep =
      error instanceof
        YandexDailySyncStepError
        ? error.step
        : null;


    const errorMessage =
      error instanceof Error
        ? error.message
        : String(
            error
          );


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
            trigger_mode:
              triggerAuth.mode,

            started_at:
              startedAtIso,

            internal_base_url:
              config.internalBaseUrl,

            completed_steps:
              serializeCompletedSteps(
                completedSteps
              ),

            failed:
              error instanceof
                YandexDailySyncStepError
                ? {
                    path:
                      error.path,

                    status:
                      error.status,

                    attempts:
                      error.attempts,

                    body:
                      error.body,
                  }
                : {
                    error:
                      errorMessage,
                  },
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


    return Response.json(
      {
        ok:
          false,

        source:
          "yandex_daily_sync",

        journal_run_id:
          journalRunId,

        failed_step:
          failedStep,

        error:
          errorMessage,

        completed_steps:
          serializeCompletedSteps(
            completedSteps
          ),
      },
      {
        status:
          500,
      }
    );

  }

}


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
