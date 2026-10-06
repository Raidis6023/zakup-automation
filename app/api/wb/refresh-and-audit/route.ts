import {
  NextRequest,
  NextResponse,
} from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;


// ============================================================
// ТИПЫ
// ============================================================

type SyncKey =
  | "orders"
  | "stocks";


type SyncState = {
  sync_key: string;

  last_attempt_at:
    string | null;

  last_success_at:
    string | null;

  next_allowed_at:
    string | null;

  last_http_status:
    number | null;

  retry_after_seconds:
    number | null;

  last_message:
    string | null;
};


type InternalCallResult = {
  httpStatus: number | null;
  responseOk: boolean;
  data: Record<string, any>;
};


type RefreshStage = {
  source:
    SyncKey;

  status:
    "PASS"
    |
    "FAIL";

  message:
    string;

  beforeLastSuccessAt:
    string | null;

  afterLastSuccessAt:
    string | null;

  timestampAdvanced:
    boolean;

  wildberriesRequestSent:
    boolean | null;

  blockedByRateLimit:
    boolean;

  skipped:
    boolean;

  httpStatus:
    number | null;

  nextAllowedAt:
    string | null;

  response:
    Record<string, any>;
};


// ============================================================
// SUPABASE
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
// ЧИТАЕМ WB_SYNC_STATE
// ============================================================

async function getSyncStates(): Promise<{
  orders: SyncState | null;
  stocks: SyncState | null;
}> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/wb_sync_state`
      +
      `?sync_key=in.(orders,stocks)`
      +
      `&select=*`,
      {
        method:
          "GET",

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
      `Не удалось прочитать wb_sync_state. HTTP ${response.status}: ${text}`
    );

  }


  const rows =
    JSON.parse(
      text
    ) as SyncState[];


  return {

    orders:
      rows.find(
        (row) =>
          row.sync_key
          ===
          "orders"
      )
      ??
      null,


    stocks:
      rows.find(
        (row) =>
          row.sync_key
          ===
          "stocks"
      )
      ??
      null,

  };

}


// ============================================================
// ВНУТРЕННИЙ API-ВЫЗОВ
// ============================================================

async function callInternalApi(
  url: string
): Promise<InternalCallResult> {

  try {

    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    let data:
      Record<string, any>;


    try {

      const parsed =
        JSON.parse(
          text
        );


      data =
        parsed
        &&
        typeof parsed
        ===
        "object"
          ?
          parsed
          :
          {
            value:
              parsed,
          };

    } catch {

      data = {
        rawText:
          text,
      };

    }


    return {
      httpStatus:
        response.status,

      responseOk:
        response.ok,

      data,
    };

  } catch (error) {

    return {
      httpStatus:
        null,

      responseOk:
        false,

      data: {
        ok:
          false,

        message:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка внутреннего API-вызова",
      },
    };

  }

}


// ============================================================
// СРАВНЕНИЕ TIMESTAMP
// ============================================================

function timestampAdvanced(
  before:
    string | null | undefined,

  after:
    string | null | undefined
): boolean {

  if (!after) {

    return false;

  }


  const afterMs =
    new Date(
      after
    ).getTime();


  if (
    !Number.isFinite(
      afterMs
    )
  ) {

    return false;

  }


  if (!before) {

    return true;

  }


  const beforeMs =
    new Date(
      before
    ).getTime();


  if (
    !Number.isFinite(
      beforeMs
    )
  ) {

    return true;

  }


  return (
    afterMs
    >
    beforeMs
  );

}


// ============================================================
// ОПРЕДЕЛЯЕМ, БЫЛ ЛИ РЕАЛЬНЫЙ ЗАПРОС В WB
// ============================================================

function getRequestSentFlag(
  data:
    Record<string, any>
): boolean | null {

  if (
    typeof data.wildberriesRequestSent
    ===
    "boolean"
  ) {

    return data.wildberriesRequestSent;

  }


  if (
    typeof data.requestSent
    ===
    "boolean"
  ) {

    return data.requestSent;

  }


  return null;

}


// ============================================================
// СОБИРАЕМ РЕЗУЛЬТАТ ЭТАПА
// ============================================================

function buildRefreshStage(
  source:
    SyncKey,

  before:
    SyncState | null,

  after:
    SyncState | null,

  call:
    InternalCallResult
): RefreshStage {

  const beforeLastSuccessAt =
    before
      ?.last_success_at
    ??
    null;


  const afterLastSuccessAt =
    after
      ?.last_success_at
    ??
    null;


  const advanced =
    timestampAdvanced(
      beforeLastSuccessAt,
      afterLastSuccessAt
    );


  const blockedByRateLimit =
    call.data
      ?.blockedByRateLimit
    ===
    true;


  const skipped =
    call.data
      ?.skipped
    ===
    true;


  const wildberriesRequestSent =
    getRequestSentFlag(
      call.data
    );


  const passed =
    call.responseOk
    &&
    call.data
      ?.ok
    ===
    true
    &&
    !blockedByRateLimit
    &&
    !skipped
    &&
    advanced;


  let message:
    string;


  if (passed) {

    message =
      source === "orders"
        ?
        "Заказы Wildberries успешно обновлены. Получена новая успешная версия данных."
        :
        "Остатки Wildberries успешно обновлены. Получен новый snapshot.";

  }

  else if (
    blockedByRateLimit
  ) {

    message =
      source === "orders"
        ?
        "Заказы WB не обновлены: Wildberries пока не разрешает новый запрос из-за лимита API."
        :
        "Остатки WB не обновлены: Wildberries пока не разрешает новый запрос из-за лимита API.";

  }

  else if (
    skipped
  ) {

    message =
      source === "orders"
        ?
        "Заказы WB не были заново загружены: sync-orders пропустил запрос."
        :
        "Остатки WB не были заново загружены: sync-stocks пропустил запрос.";

  }

  else if (
    !call.responseOk
    ||
    call.data
      ?.ok
    !==
    true
  ) {

    message =
      source === "orders"
        ?
        "Не удалось обновить заказы WB."
        :
        "Не удалось обновить остатки WB.";

  }

  else if (
    !advanced
  ) {

    message =
      source === "orders"
        ?
        "sync-orders завершился без ошибки, но дата успешной загрузки заказов не изменилась. Аудит свежих данных запускать нельзя."
        :
        "sync-stocks завершился без ошибки, но дата успешного snapshot остатков не изменилась. Аудит свежих данных запускать нельзя.";

  }

  else {

    message =
      "Источник не прошёл проверку обновления.";

  }


  return {
    source,

    status:
      passed
        ?
        "PASS"
        :
        "FAIL",

    message,

    beforeLastSuccessAt,

    afterLastSuccessAt,

    timestampAdvanced:
      advanced,

    wildberriesRequestSent,

    blockedByRateLimit,

    skipped,

    httpStatus:
      call.httpStatus,

    nextAllowedAt:
      call.data
        ?.nextAllowedAt
      ??
      after
        ?.next_allowed_at
      ??
      null,

    response:
      call.data,
  };

}


// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    const origin =
      request
        .nextUrl
        .origin;


    // ========================================================
    // 1. СОСТОЯНИЕ ДО ОБНОВЛЕНИЯ
    // ========================================================

    const beforeStates =
      await getSyncStates();


    // ========================================================
    // 2. ОБНОВЛЯЕМ ЗАКАЗЫ
    // ========================================================

    const ordersCall =
      await callInternalApi(
        `${origin}/api/wb/sync-orders`
      );


    const afterOrdersStates =
      await getSyncStates();


    const ordersStage =
      buildRefreshStage(
        "orders",
        beforeStates.orders,
        afterOrdersStates.orders,
        ordersCall
      );


    // ========================================================
    // 3. ОБНОВЛЯЕМ ОСТАТКИ
    //
    // Делаем попытку даже если заказы не обновились.
    // Так мы видим реальное состояние обоих источников.
    // ========================================================

    const stocksBefore =
      afterOrdersStates.stocks;


    const stocksCall =
      await callInternalApi(
        `${origin}/api/wb/sync-stocks`
      );


    const finalStates =
      await getSyncStates();


    const stocksStage =
      buildRefreshStage(
        "stocks",
        stocksBefore,
        finalStates.stocks,
        stocksCall
      );


    // ========================================================
    // 4. ПРОВЕРЯЕМ, ОБНОВИЛИСЬ ЛИ ОБА ИСТОЧНИКА
    // ========================================================

    const bothUpdated =
      ordersStage.status
      ===
      "PASS"
      &&
      stocksStage.status
      ===
      "PASS";


    // ========================================================
    // 5. ЕСЛИ НЕТ, АУДИТ НЕ ЗАПУСКАЕМ
    // ========================================================

    if (!bothUpdated) {

      return NextResponse.json(
        {
          ok:
            false,

          result:
            "REFRESH_FAILED",

          auditStarted:
            false,

          auditResult:
            null,

          message:
            "Аудит не запущен, потому что не удалось получить новые данные сразу по заказам и остаткам Wildberries.",


          simpleSummary: {

            orders:
              ordersStage.status
              ===
              "PASS"
                ?
                "Заказы обновлены"
                :
                "Заказы НЕ обновлены",

            stocks:
              stocksStage.status
              ===
              "PASS"
                ?
                "Остатки обновлены"
                :
                "Остатки НЕ обновлены",

            audit:
              "Не запускался",
          },


          refresh: {

            orders:
              ordersStage,

            stocks:
              stocksStage,
          },


          currentSyncState: {

            orders:
              finalStates.orders,

            stocks:
              finalStates.stocks,
          },

        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 6. ОБА ИСТОЧНИКА СВЕЖИЕ И НОВЫЕ
    //
    // ТЕПЕРЬ ЗАПУСКАЕМ FULL-AUDIT.
    // ========================================================

    const auditCall =
      await callInternalApi(
        `${origin}/api/wb/full-audit`
      );


    const auditPassed =
      auditCall.responseOk
      &&
      auditCall.data
        ?.ok
      ===
      true
      &&
      auditCall.data
        ?.auditResult
      ===
      "PASS";


    // ========================================================
    // 7. АУДИТ НЕ ПРОШЁЛ
    // ========================================================

    if (!auditPassed) {

      return NextResponse.json(
        {
          ok:
            false,

          result:
            "AUDIT_FAILED",

          auditStarted:
            true,

          auditResult:
            auditCall.data
              ?.auditResult
            ??
            "FAIL",

          message:
            "Новые данные Wildberries успешно получены, но полный аудит обнаружил проблему.",


          simpleSummary: {

            orders:
              "Заказы обновлены",

            stocks:
              "Остатки обновлены",

            audit:
              "Аудит НЕ пройден",
          },


          refresh: {

            orders:
              ordersStage,

            stocks:
              stocksStage,
          },


          audit: {
            httpStatus:
              auditCall.httpStatus,

            response:
              auditCall.data,
          },

        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 8. ПОЛНЫЙ УСПЕХ
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      result:
        "PASS",

      auditStarted:
        true,

      auditResult:
        "PASS",

      message:
        "Новые данные Wildberries получены и полный аудит успешно пройден.",


      simpleSummary: {

        orders:
          "Заказы обновлены",

        stocks:
          "Остатки обновлены",

        audit:
          "Аудит пройден",
      },


      refreshedData: {

        orders: {

          previousLastSuccessAt:
            ordersStage.beforeLastSuccessAt,

          newLastSuccessAt:
            ordersStage.afterLastSuccessAt,
        },


        stocks: {

          previousLastSuccessAt:
            stocksStage.beforeLastSuccessAt,

          newLastSuccessAt:
            stocksStage.afterLastSuccessAt,
        },

      },


      refresh: {

        orders:
          ordersStage,

        stocks:
          stocksStage,
      },


      audit: {

        httpStatus:
          auditCall.httpStatus,

        resultSummary:
          auditCall.data
            ?.resultSummary
          ??
          null,

        independentCalculation:
          auditCall.data
            ?.independentCalculation
          ??
          null,

        productionCalculation:
          auditCall.data
            ?.productionCalculation
          ??
          null,

        failedChecks:
          auditCall.data
            ?.failedChecks
          ??
          [],

        warningChecks:
          auditCall.data
            ?.warningChecks
          ??
          [],

        checks:
          auditCall.data
            ?.checks
          ??
          [],
      },

    });

  } catch (error) {

    console.error(
      "Ошибка WB refresh-and-audit:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        result:
          "SYSTEM_ERROR",

        auditStarted:
          false,

        auditResult:
          null,

        message:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка обновления и аудита WB",
      },
      {
        status:
          500,
      }
    );

  }

}
