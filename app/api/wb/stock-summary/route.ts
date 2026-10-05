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

  const supabaseUrl: string =
    supabaseUrlRaw;

  const supabaseKey: string =
    supabaseKeyRaw;

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: "application/json",
  };

  try {
    // ========================================================
    // 1. УЗНАЁМ ID ПОСЛЕДНЕГО УСПЕШНОГО СНИМКА
    // ========================================================

    const stateUrl =
      `${supabaseUrl}/rest/v1/wb_sync_state` +
      "?sync_key=eq.stocks" +
      "&select=last_snapshot_id,last_success_at" +
      "&limit=1";

    const stateResponse =
      await fetch(stateUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

    const stateText =
      await stateResponse.text();

    if (!stateResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не удалось получить состояние синхронизации остатков",
          supabaseStatus:
            stateResponse.status,
          supabaseResponse:
            stateText,
        },
        { status: 500 }
      );
    }

    const stateRows =
      JSON.parse(stateText);

    const state =
      Array.isArray(stateRows)
        ? stateRows[0]
        : null;

    const snapshotId =
      state?.last_snapshot_id;

    if (!snapshotId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "В Supabase пока нет успешного снимка остатков WB",
        },
        { status: 404 }
      );
    }

    // ========================================================
    // 2. ПОЛУЧАЕМ ВСЕ СТРОКИ ПОСЛЕДНЕГО СНИМКА
    // ========================================================

    const stockUrl =
      `${supabaseUrl}/rest/v1/wb_stock_snapshots` +
      `?snapshot_id=eq.${snapshotId}` +
      "&select=nm_id,vendor_code,barcode,tech_size,volume,warehouse_name,quantity,warehouse_type,captured_at" +
      "&limit=10000";

    const stockResponse =
      await fetch(stockUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

    const stockText =
      await stockResponse.text();

    if (!stockResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не удалось получить последний снимок остатков",
          supabaseStatus:
            stockResponse.status,
          supabaseResponse:
            stockText,
        },
        { status: 500 }
      );
    }

    const rows =
      JSON.parse(stockText);

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Supabase вернул неожиданный формат остатков",
        },
        { status: 500 }
      );
    }

    // ========================================================
    // 3. ГРУППИРУЕМ ПО SKU
    // ========================================================

    const bySku =
      new Map<number, any>();

    for (const row of rows) {
      const nmId =
        Number(row.nm_id);

      if (!Number.isFinite(nmId)) {
        continue;
      }

      if (!bySku.has(nmId)) {
        bySku.set(nmId, {
          nmId,

          vendorCode:
            row.vendor_code ?? null,

          barcode:
            row.barcode ?? null,

          techSize:
            row.tech_size ?? null,

          volume:
            row.volume ?? null,

          totalStock:
            null,

          wbRussiaAggregate:
            null,

          toClient:
            null,

          returning:
            null,

          physicalStockSum:
            0,

          physicalWarehouses:
            [],
        });
      }

      const item =
        bySku.get(nmId);

      const quantity =
        Number(row.quantity ?? 0);

      if (
        row.warehouse_type ===
        "total"
      ) {
        item.totalStock =
          quantity;
      }

      if (
        row.warehouse_type ===
        "wbRussiaAggregate"
      ) {
        item.wbRussiaAggregate =
          quantity;
      }

      if (
        row.warehouse_type ===
        "toClient"
      ) {
        item.toClient =
          quantity;
      }

      if (
        row.warehouse_type ===
        "returning"
      ) {
        item.returning =
          quantity;
      }

      if (
        row.warehouse_type ===
        "physical"
      ) {
        item.physicalStockSum +=
          quantity;

        item.physicalWarehouses.push({
          warehouseName:
            row.warehouse_name,

          quantity,
        });
      }
    }

    // ========================================================
    // 4. ФОРМИРУЕМ РЕЗУЛЬТАТ
    // ========================================================

    const items =
      Array.from(
        bySku.values()
      ).map((item) => {
        item.physicalWarehouses.sort(
          (
            a: {
              quantity: number;
            },
            b: {
              quantity: number;
            }
          ) =>
            b.quantity -
            a.quantity
        );

        return item;
      });

    items.sort(
      (
        a,
        b
      ) =>
        (b.totalStock ?? 0) -
        (a.totalStock ?? 0)
    );

    // ========================================================
    // 5. КОНТРОЛЬНЫЕ ПОКАЗАТЕЛИ
    // ========================================================

    const itemsWithTotal =
      items.filter(
        (item) =>
          item.totalStock !==
          null
      ).length;

    const itemsWithPhysicalWarehouses =
      items.filter(
        (item) =>
          item.physicalWarehouses
            .length > 0
      ).length;

    const itemsWithAggregate =
      items.filter(
        (item) =>
          item.wbRussiaAggregate !==
          null
      ).length;

    return NextResponse.json({
      ok: true,

      message:
        "Последний снимок остатков WB получен из Supabase",

      snapshot: {
        snapshotId,

        lastSuccessAt:
          state?.last_success_at ??
          null,

        rows:
          rows.length,

        skuCount:
          items.length,
      },

      coverage: {
        itemsWithTotal,

        itemsWithPhysicalWarehouses,

        itemsWithAggregate,
      },

      sample:
        items.slice(0, 20),

      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Ошибка формирования сводки остатков WB",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
