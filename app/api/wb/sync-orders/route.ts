import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrlRaw =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKeyRaw =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrlRaw) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL",
      },
      { status: 500 }
    );
  }

  if (!supabaseKeyRaw) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY",
      },
      { status: 500 }
    );
  }

  const supabaseUrl: string = supabaseUrlRaw;
  const supabaseKey: string = supabaseKeyRaw;

  try {
    const url =
      `${supabaseUrl}/rest/v1/wb_sync_state` +
      "?select=*" +
      "&order=sync_key.asc";

    const response = await fetch(url, {
      method: "GET",

      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
      },

      cache: "no-store",
    });

    const text = await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не удалось получить состояние синхронизаций из Supabase",
          supabaseStatus: response.status,
          supabaseResponse: data,
        },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];

    const now = new Date();

    const syncs = rows.map((row: any) => {
      let blocked = false;
      let secondsRemaining = 0;

      if (row.next_allowed_at) {
        const nextAllowed = new Date(
          row.next_allowed_at
        );

        if (
          Number.isFinite(nextAllowed.getTime()) &&
          nextAllowed.getTime() > now.getTime()
        ) {
          blocked = true;

          secondsRemaining = Math.ceil(
            (nextAllowed.getTime() - now.getTime()) /
              1000
          );
        }
      }

      return {
        syncKey: row.sync_key,

        blocked,

        secondsRemaining,

        lastAttemptAt:
          row.last_attempt_at ?? null,

        lastSuccessAt:
          row.last_success_at ?? null,

        nextAllowedAt:
          row.next_allowed_at ?? null,

        lastHttpStatus:
          row.last_http_status ?? null,

        retryAfterSeconds:
          row.retry_after_seconds ?? null,

        lastMessage:
          row.last_message ?? null,

        updatedAt:
          row.updated_at ?? null,
      };
    });

    return NextResponse.json({
      ok: true,

      message:
        "Состояние синхронизаций WB получено",

      checkedAt:
        now.toISOString(),

      syncs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка при получении состояния синхронизаций WB",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
