import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";


// ============================================================
// TYPES
// ============================================================

type OzonSyncStateRow = {
  sync_key:
    string;

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

  updated_at:
    string | null;
};


type DashboardResponse = {
  latest_sync?:
    {
      status?:
        string;

      created_at?:
        string | null;
    }
    | null;
};


type ClientSyncState = {
  lastHttpStatus:
    number | null;

  lastAttemptAt:
    string | null;

  lastSuccessAt:
    string | null;

  nextAllowedAt:
    string | null;

  retryAfterSeconds:
    number | null;

  lastMessage:
    string | null;
};


// ============================================================
// SUPABASE
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


// ============================================================
// TIMESTAMP
// ============================================================

function getTimestamp(
  value:
    string | null | undefined
):
number | null {

  if (!value) {

    return null;

  }


  const timestamp =
    new Date(
      value
    ).getTime();


  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;

}


// ============================================================
// MAP
// ============================================================

function toClientState(
  row:
    OzonSyncStateRow | null,

  dailySyncAt:
    string | null
):
ClientSyncState {

  const storedLastSuccessAt =
    row?.last_success_at
    ??
    null;


  const storedLastAttemptAt =
    row?.last_attempt_at
    ??
    null;


  const dailyTimestamp =
    getTimestamp(
      dailySyncAt
    );


  const storedSuccessTimestamp =
    getTimestamp(
      storedLastSuccessAt
    );


  const storedAttemptTimestamp =
    getTimestamp(
      storedLastAttemptAt
    );


  // ==========================================================
  // ЕСЛИ ПОСЛЕ СОХРАНЁННОГО СОСТОЯНИЯ
  // УСПЕЛ ПРОЙТИ ЕЖЕДНЕВНЫЙ DAILY-SYNC,
  // ПОКАЗЫВАЕМ ЕГО КАК БОЛЕЕ СВЕЖЕЕ ОБНОВЛЕНИЕ.
  //
  // DAILY-SYNC ОБНОВЛЯЕТ И ПРОДАЖИ, И ОСТАТКИ.
  // ==========================================================

  const dailySyncIsNewer =
    dailyTimestamp !==
      null
    &&
    (
      storedSuccessTimestamp ===
        null
      ||
      dailyTimestamp >
        storedSuccessTimestamp
    )
    &&
    (
      storedAttemptTimestamp ===
        null
      ||
      dailyTimestamp >
        storedAttemptTimestamp
    );


  if (dailySyncIsNewer) {

    return {
      lastHttpStatus:
        200,

      lastAttemptAt:
        dailySyncAt,

      lastSuccessAt:
        dailySyncAt,

      nextAllowedAt:
        null,

      retryAfterSeconds:
        null,

      lastMessage:
        "Автоматическая синхронизация Ozon успешно завершена",
    };

  }


  return {
    lastHttpStatus:
      row?.last_http_status
      ??
      null,

    lastAttemptAt:
      storedLastAttemptAt,

    lastSuccessAt:
      storedLastSuccessAt,

    nextAllowedAt:
      row?.next_allowed_at
      ??
      null,

    retryAfterSeconds:
      row?.retry_after_seconds
      ??
      null,

    lastMessage:
      row?.last_message
      ??
      null,
  };

}


// ============================================================
// GET
// ============================================================

export async function GET() {

  try {

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    // ========================================================
    // 1. СОСТОЯНИЕ РУЧНЫХ КНОПОК
    // ========================================================

    const stateResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/ozon_sync_state?select=*`,
        {
          method:
            "GET",

          headers: {
            apikey:
              supabaseSecretKey,

            Authorization:
              `Bearer ${supabaseSecretKey}`,

            Accept:
              "application/json",
          },

          cache:
            "no-store",
        }
      );


    const stateText =
      await stateResponse.text();


    if (!stateResponse.ok) {

      throw new Error(
        `Не удалось загрузить ozon_sync_state. HTTP ${stateResponse.status}: ${stateText}`
      );

    }


    const rows =
      JSON.parse(
        stateText
      ) as OzonSyncStateRow[];


    // ========================================================
    // 2. ПОСЛЕДНИЙ DAILY-SYNC
    // ========================================================

    let dailySyncAt:
      string | null =
      null;


    try {

      const dashboardResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/get_ozon_sync_dashboard`,
          {
            method:
              "POST",

            headers: {
              apikey:
                supabaseSecretKey,

              Authorization:
                `Bearer ${supabaseSecretKey}`,

              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              "{}",

            cache:
              "no-store",
          }
        );


      const dashboardText =
        await dashboardResponse.text();


      if (
        dashboardResponse.ok
        &&
        dashboardText
      ) {

        const dashboard =
          JSON.parse(
            dashboardText
          ) as DashboardResponse;


        if (
          dashboard
            .latest_sync
            ?.status ===
              "success"
        ) {

          dailySyncAt =
            dashboard
              .latest_sync
              ?.created_at
            ??
            null;

        }

      }

    } catch (
      dashboardError
    ) {

      console.error(
        "Не удалось прочитать Ozon dashboard для sync-state:",
        dashboardError
      );

    }


    // ========================================================
    // 3. СОБИРАЕМ ДВА НЕЗАВИСИМЫХ СОСТОЯНИЯ
    // ========================================================

    const stocksRow =
      rows.find(
        row =>
          row.sync_key ===
          "stocks"
      )
      ??
      null;


    const salesRow =
      rows.find(
        row =>
          row.sync_key ===
          "sales"
      )
      ??
      null;


    return NextResponse.json(
      {
        ok:
          true,

        stocks:
          toClientState(
            stocksRow,
            dailySyncAt
          ),

        sales:
          toClientState(
            salesRow,
            dailySyncAt
          ),
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "Ozon sync-state error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Не удалось получить состояние синхронизации Ozon",
      },
      {
        status:
          500,
      }
    );

  }

}
