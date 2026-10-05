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
          "В Vercel не найдена переменная SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL",
      },
      { status: 500 }
    );
  }

  if (!supabaseKeyRaw) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "В Vercel не найдена переменная SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY",
      },
      { status: 500 }
    );
  }

  // После проверок создаём переменные,
  // которые TypeScript уже точно считает строками.
  const supabaseUrl: string = supabaseUrlRaw;
  const supabaseKey: string = supabaseKeyRaw;

  async function checkTable(tableName: string) {
    const url =
      `${supabaseUrl}/rest/v1/${tableName}` +
      "?select=*&limit=1";

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

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return {
      table: tableName,
      status: response.status,
      ok: response.ok,
      data,
    };
  }

  try {
    const ordersTable =
      await checkTable("wb_orders");

    const stocksTable =
      await checkTable("wb_stock_snapshots");

    const allOk =
      ordersTable.ok && stocksTable.ok;

    return NextResponse.json({
      ok: allOk,

      message: allOk
        ? "Vercel успешно подключился к таблицам WB в Supabase"
        : "Есть проблема с подключением к Supabase",

      environment: {
        supabaseUrlFound: true,
        supabaseServerKeyFound: true,
      },

      tables: {
        wb_orders: ordersTable,
        wb_stock_snapshots: stocksTable,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Ошибка при подключении Vercel к Supabase",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
