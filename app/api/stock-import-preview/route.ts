import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ImportRow = {
  source_row_number: number;
  warehouse_name: string | null;
  product_name: string | null;
  offer_id_raw: string | null;
  free_stock: number | null;
  barcode: string | null;
  parse_error: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await createClient();
    const { data: { user }, error } = await auth.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Необходимо войти в WorkSpace" },
        { status: 401 },
      );
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
    }
    const input = body as { fileName?: unknown; reportDate?: unknown; rows?: unknown };
    const fileName = input.fileName;
    const reportDate = input.reportDate;
    const rows = input.rows;

    if (typeof fileName !== "string" || !fileName.trim()) {
      return NextResponse.json({ ok: false, error: "Не указано имя файла" }, { status: 400 });
    }
    if (typeof reportDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return NextResponse.json({ ok: false, error: "Не удалось определить дату остатков" }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 10000) {
      return NextResponse.json({ ok: false, error: "Некорректное количество товарных строк" }, { status: 400 });
    }
    const typedRows: ImportRow[] = rows;
    if (typedRows.some((row) => !row || !Number.isInteger(row.source_row_number))) {
      return NextResponse.json({ ok: false, error: "Ошибка формата товарных строк" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) {
      throw new Error("Не настроено подключение к Supabase");
    }
    const response = await fetch(url + "/rest/v1/rpc/create_stock_import_preview", {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: "Bearer " + secret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_source_file_name: fileName,
        p_report_date: reportDate,
        p_rows: typedRows,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text();
      let message = "Supabase отклонил импорт";
      try {
        const payload = JSON.parse(text) as { message?: string };
        if (typeof payload.message === "string") message = payload.message.slice(0, 350);
      } catch {
        // Keep only the HTTP status, not raw upstream error payloads.
      }
      return NextResponse.json(
        { ok: false, error: message + " (HTTP " + response.status + ")" },
        { status: 422 },
      );
    }
    const batchId: unknown = await response.json();
    if (typeof batchId !== "string" || !/^[0-9a-f-]{36}$/i.test(batchId)) {
      throw new Error("Сервер не вернул корректный ID партии импорта");
    }
    return NextResponse.json({ ok: true, batchId });
  } catch (error) {
    console.error("AVЕDEX stock preview failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Ошибка сервера при проверке Excel" },
      { status: 500 },
    );
  }
}
