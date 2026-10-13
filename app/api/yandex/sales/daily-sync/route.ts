import {
  NextRequest,
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


// ============================================================
// CONFIG
// ============================================================

function getConfig() {

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
    supabaseUrl,
    supabaseSecretKey,
  };

}


// ============================================================
// TYPES
// ============================================================

type PreviewResponse = {
  ok?: boolean;

  preview_ok?: boolean;

  sync_run_id?: string;

  complete_period?: {
    date_from?: string;
    date_to?: string;
  };

  daily_rows_count?: number;

  daily_rows?: unknown[];

  totals?: unknown;

  checks?: unknown;

  capped_cases?: unknown;

  error?: string;
};


type RpcResponse = {
  ok?: boolean;

  sync_run_id?: string;

  date_from?: string;

  date_to?: string;

  rows_received?: number;

  rows_inserted?: number;
};


// ============================================================
// POST
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getConfig();


    // ========================================================
    // PREVIEW URL
    // ========================================================

    const previewUrl =
      new URL(
        "/api/yandex/sales/daily-preview",
        request.nextUrl.origin
      );


    previewUrl.searchParams.set(
      "includeRows",
      "1"
    );


    // ========================================================
    // FORWARD AUTH
    //
    // Ручной запуск из сайта:
    //   Cookie
    //
    // Cron / server-to-server:
    //   Authorization: Bearer CRON_SECRET
    //
    // Если присутствуют оба,
    // передаём оба.
    // ========================================================

    const cookie =
      request.headers.get(
        "cookie"
      );


    const authorization =
      request.headers.get(
        "authorization"
      );


    const previewHeaders:
      Record<
        string,
        string
      > =
      {
        Accept:
          "application/json",
      };


    if (cookie) {

      previewHeaders.Cookie =
        cookie;

    }


    if (authorization) {

      previewHeaders.Authorization =
        authorization;

    }


    // ========================================================
    // PREVIEW REQUEST
    // ========================================================

    const previewResponse =
      await fetch(
        previewUrl.toString(),
        {
          method:
            "GET",

          headers:
            previewHeaders,

          cache:
            "no-store",
        }
      );


    const previewText =
      await previewResponse.text();


    let preview:
      PreviewResponse;


    try {

      preview =
        JSON.parse(
          previewText
        ) as PreviewResponse;

    } catch {

      throw new Error(
        `daily-preview вернул некорректный JSON: ${previewText}`
      );

    }


    // ========================================================
    // PREVIEW HTTP / OK CHECK
    // ========================================================

    if (
      !previewResponse.ok
      ||
      preview.ok !==
        true
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          writes_to_database:
            false,

          blocked_by_preview:
            true,

          preview_http_status:
            previewResponse.status,

          preview,
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // PREVIEW BUSINESS CHECK
    // ========================================================

    if (
      preview.preview_ok !==
      true
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          writes_to_database:
            false,

          blocked_by_preview:
            true,

          message:
            "daily-preview содержит ошибки. Запись заблокирована.",

          preview,
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // ROWS CHECK
    // ========================================================

    if (
      !Array.isArray(
        preview.daily_rows
      )
    ) {

      throw new Error(
        "daily-preview не вернул daily_rows"
      );

    }


    const expectedRows =
      Number(
        preview.daily_rows_count
      );


    if (
      !Number.isInteger(
        expectedRows
      )
      ||
      expectedRows <
        0
    ) {

      throw new Error(
        `Некорректный daily_rows_count: ${preview.daily_rows_count}`
      );

    }


    if (
      preview.daily_rows.length
      !==
      expectedRows
    ) {

      throw new Error(
        `Количество daily_rows не совпало: array=${preview.daily_rows.length}, expected=${expectedRows}`
      );

    }


    // ========================================================
    // RUN / PERIOD
    // ========================================================

    const syncRunId =
      preview.sync_run_id
        ?.trim();


    const dateFrom =
      preview
        .complete_period
        ?.date_from
        ?.trim();


    const dateTo =
      preview
        .complete_period
        ?.date_to
        ?.trim();


    if (
      !syncRunId
      ||
      !dateFrom
      ||
      !dateTo
    ) {

      throw new Error(
        "daily-preview не вернул sync_run_id или полный период"
      );

    }


    // ========================================================
    // ATOMIC RPC
    // ========================================================

    const rpcResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/replace_yandex_sales_daily`,
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
            JSON.stringify({
              p_sync_run_id:
                syncRunId,

              p_date_from:
                dateFrom,

              p_date_to:
                dateTo,

              p_rows:
                preview.daily_rows,
            }),

          cache:
            "no-store",
        }
      );


    const rpcText =
      await rpcResponse.text();


    let rpcResult:
      RpcResponse;


    try {

      rpcResult =
        rpcText
          ? JSON.parse(
              rpcText
            ) as RpcResponse
          : {};

    } catch {

      throw new Error(
        `replace_yandex_sales_daily вернул некорректный JSON: ${rpcText}`
      );

    }


    if (
      !rpcResponse.ok
    ) {

      throw new Error(
        `replace_yandex_sales_daily HTTP ${rpcResponse.status}: ${rpcText}`
      );

    }


    if (
      rpcResult.ok !==
      true
    ) {

      throw new Error(
        `RPC не подтвердил успешную запись: ${rpcText}`
      );

    }


    const insertedRows =
      Number(
        rpcResult.rows_inserted
      );


    if (
      insertedRows !==
      expectedRows
    ) {

      throw new Error(
        `RPC записал неожиданное количество строк: inserted=${insertedRows}, expected=${expectedRows}`
      );

    }


    // ========================================================
    // SUCCESS
    // ========================================================

    return NextResponse.json(
      {
        ok:
          true,

        writes_to_database:
          true,

        sync_run_id:
          syncRunId,

        period: {
          date_from:
            dateFrom,

          date_to:
            dateTo,
        },

        rows_expected:
          expectedRows,

        rows_inserted:
          insertedRows,

        totals:
          preview.totals,

        checks:
          preview.checks,

        capped_cases:
          preview.capped_cases,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX SALES DAILY SYNC ERROR:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        writes_to_database:
          false,

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

}
