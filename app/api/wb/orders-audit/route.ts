import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SALES_DAYS = 28;
const PAGE_SIZE = 1000;


// ============================================================
// ТИПЫ
// ============================================================

type WBOrder = {
  srid: string;
  order_date: string;
  last_change_date: string | null;
  nm_id: number;
  supplier_article: string | null;
  barcode: string | null;
  warehouse_type: string | null;
  is_cancel: boolean | null;
  cancel_date: string | null;
  synced_at: string | null;
};


type SyncState = {
  sync_key: string;
  last_success_at: string | null;
};


// ============================================================
// SUPABASE CONFIG
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
// ОБЫЧНЫЙ GET
// ============================================================

async function supabaseGet<T>(
  path: string
): Promise<T> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
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
      `Ошибка Supabase HTTP ${response.status}: ${text}`
    );

  }


  return JSON.parse(
    text
  ) as T;

}


// ============================================================
// ПОЛУЧАЕМ ТОЧНОЕ КОЛИЧЕСТВО СТРОК НА СТОРОНЕ SUPABASE
// ============================================================

async function getExactCount(
  query: string
): Promise<number> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/wb_orders?select=srid&${query}`,
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

          Prefer:
            "count=exact",

          Range:
            "0-0",
        },

        cache:
          "no-store",
      }
    );


  if (!response.ok) {

    const text =
      await response.text();


    throw new Error(
      `Ошибка подсчёта Supabase HTTP ${response.status}: ${text}`
    );

  }


  const contentRange =
    response.headers.get(
      "content-range"
    );


  if (!contentRange) {

    throw new Error(
      "Supabase не вернул Content-Range"
    );

  }


  const parts =
    contentRange.split(
      "/"
    );


  const total =
    Number(
      parts[1]
    );


  if (
    !Number.isFinite(
      total
    )
  ) {

    throw new Error(
      `Не удалось разобрать Content-Range: ${contentRange}`
    );

  }


  return total;

}


// ============================================================
// ЧИТАЕМ ВСЕ СТРОКИ С ДЕТЕРМИНИРОВАННОЙ СОРТИРОВКОЙ
// ============================================================

async function loadAllOrders(
  baseQuery: string
): Promise<{
  rows: WBOrder[];
  pages: number;
}> {

  const rows:
    WBOrder[] =
    [];


  let offset =
    0;


  let pages =
    0;


  while (true) {

    pages +=
      1;


    const page =
      await supabaseGet<
        WBOrder[]
      >(
        "wb_orders"
        +
        "?"
        +
        baseQuery
        +
        "&order=order_date.asc,srid.asc"
        +
        `&limit=${PAGE_SIZE}`
        +
        `&offset=${offset}`
      );


    rows.push(
      ...page
    );


    if (
      page.length
      <
      PAGE_SIZE
    ) {

      break;

    }


    offset +=
      PAGE_SIZE;

  }


  return {
    rows,
    pages,
  };

}


// ============================================================
// GET
// ============================================================

export async function GET() {

  try {

    // ========================================================
    // 1. ПОСЛЕДНЯЯ УСПЕШНАЯ СИНХРОНИЗАЦИЯ ORDERS
    // ========================================================

    const states =
      await supabaseGet<
        SyncState[]
      >(
        "wb_sync_state"
        +
        "?sync_key=eq.orders"
        +
        "&select=sync_key,last_success_at"
        +
        "&limit=1"
      );


    const ordersState =
      states[0]
      ??
      null;


    if (
      !ordersState
      ||
      !ordersState.last_success_at
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Нет last_success_at для orders",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 2. ТОТ ЖЕ ПЕРИОД 28 ДНЕЙ
    // ========================================================

    const periodEnd =
      new Date(
        ordersState.last_success_at
      );


    const periodStart =
      new Date(
        periodEnd.getTime()
        -
        SALES_DAYS
        *
        24
        *
        60
        *
        60
        *
        1000
      );


    const periodStartIso =
      periodStart.toISOString();


    const periodEndIso =
      periodEnd.toISOString();


    // ========================================================
    // 3. БАЗОВЫЙ ФИЛЬТР
    // ========================================================

    const commonFilter =
      `order_date=gte.${encodeURIComponent(periodStartIso)}`
      +
      `&order_date=lte.${encodeURIComponent(periodEndIso)}`
      +
      `&warehouse_type=eq.${encodeURIComponent("Склад WB")}`;


    // ========================================================
    // 4. ТОЧНЫЕ COUNTS НА СТОРОНЕ SUPABASE
    // ========================================================

    const [
      serverTotal,
      serverCancelled,
      serverActive,
      serverNullCancel,
    ] =
      await Promise.all([

        getExactCount(
          commonFilter
        ),

        getExactCount(
          commonFilter
          +
          "&is_cancel=eq.true"
        ),

        getExactCount(
          commonFilter
          +
          "&is_cancel=eq.false"
        ),

        getExactCount(
          commonFilter
          +
          "&is_cancel=is.null"
        ),

      ]);


    // ========================================================
    // 5. ЗАГРУЖАЕМ СТРОКИ С ЯВНОЙ СОРТИРОВКОЙ
    // ========================================================

    const select =
      [
        "srid",
        "order_date",
        "last_change_date",
        "nm_id",
        "supplier_article",
        "barcode",
        "warehouse_type",
        "is_cancel",
        "cancel_date",
        "synced_at",
      ].join(",");


    const loaded =
      await loadAllOrders(
        commonFilter
        +
        `&select=${select}`
      );


    const rows =
      loaded.rows;


    // ========================================================
    // 6. COUNTS ПО ЗАГРУЖЕННЫМ СТРОКАМ
    // ========================================================

    const localCancelled =
      rows.filter(
        (row) =>
          row.is_cancel
          ===
          true
      );


    const localActive =
      rows.filter(
        (row) =>
          row.is_cancel
          ===
          false
      );


    const localNull =
      rows.filter(
        (row) =>
          row.is_cancel
          ===
          null
      );


    // ========================================================
    // 7. ПРОВЕРЯЕМ ДУБЛИКАТЫ SRID
    // ========================================================

    const sridCounts =
      new Map<
        string,
        number
      >();


    for (
      const row
      of rows
    ) {

      sridCounts.set(
        row.srid,
        (
          sridCounts.get(
            row.srid
          )
          ??
          0
        )
        +
        1
      );

    }


    const duplicateSrids =
      Array.from(
        sridCounts.entries()
      )
      .filter(
        (
          [, count]
        ) =>
          count
          >
          1
      )
      .map(
        (
          [srid, count]
        ) => ({
          srid,
          count,
        })
      );


    // ========================================================
    // 8. УНИКАЛЬНЫЕ SRID
    // ========================================================

    const uniqueSrids =
      new Set(
        rows.map(
          (row) =>
            row.srid
        )
      );


    // ========================================================
    // 9. СМОТРИМ ВРЕМЯ СИНХРОНИЗАЦИИ СТРОК
    // ========================================================

    const syncCounts =
      new Map<
        string,
        number
      >();


    for (
      const row
      of rows
    ) {

      const key =
        row.synced_at
        ??
        "NULL";


      syncCounts.set(
        key,
        (
          syncCounts.get(
            key
          )
          ??
          0
        )
        +
        1
      );

    }


    const syncVersions =
      Array.from(
        syncCounts.entries()
      )
      .map(
        (
          [syncedAt, count]
        ) => ({
          syncedAt,
          count,
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          String(
            b.syncedAt
          ).localeCompare(
            String(
              a.syncedAt
            )
          )
      );


    // ========================================================
    // 10. CANCEL_DATE VS IS_CANCEL
    // ========================================================

    const cancelledWithoutCancelDate =
      localCancelled.filter(
        (row) =>
          !row.cancel_date
      );


    const activeWithCancelDate =
      localActive.filter(
        (row) =>
          row.cancel_date
          !==
          null
      );


    // ========================================================
    // 11. ПОСЛЕДНИЕ ОТМЕНЁННЫЕ
    // ========================================================

    const cancelledSample =
      [...localCancelled]
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            b.last_change_date
            ??
            b.order_date
          ).getTime()
          -
          new Date(
            a.last_change_date
            ??
            a.order_date
          ).getTime()
      )
      .slice(
        0,
        50
      )
      .map(
        (row) => ({
          srid:
            row.srid,

          nmId:
            row.nm_id,

          supplierArticle:
            row.supplier_article,

          orderDate:
            row.order_date,

          lastChangeDate:
            row.last_change_date,

          isCancel:
            row.is_cancel,

          cancelDate:
            row.cancel_date,

          syncedAt:
            row.synced_at,
        })
      );


    // ========================================================
    // 12. СОПОСТАВЛЯЕМ SERVER COUNTS И ЗАГРУЗКУ
    // ========================================================

    const countsMatch =
      serverTotal
      ===
      rows.length
      &&
      serverCancelled
      ===
      localCancelled.length
      &&
      serverActive
      ===
      localActive.length
      &&
      serverNullCancel
      ===
      localNull.length;


    // ========================================================
    // 13. ПРОВЕРКА МАТЕМАТИКИ
    // ========================================================

    const serverMathValid =
      serverTotal
      ===
      (
        serverCancelled
        +
        serverActive
        +
        serverNullCancel
      );


    const localMathValid =
      rows.length
      ===
      (
        localCancelled.length
        +
        localActive.length
        +
        localNull.length
      );


    // ========================================================
    // 14. ПРЕДВАРИТЕЛЬНЫЙ ДИАГНОЗ
    // ========================================================

    let diagnosis:
      string;


    if (
      !countsMatch
    ) {

      diagnosis =
        "Пагинационная загрузка не совпадает с точными count Supabase. Наиболее вероятная причина — проблема чтения страниц.";

    }

    else if (
      duplicateSrids.length
      >
      0
    ) {

      diagnosis =
        "В выборке обнаружены повторяющиеся srid. Это может искажать расчёт продаж.";

    }

    else if (
      syncVersions.length
      >
      1
    ) {

      diagnosis =
        "В 28-дневной выборке присутствуют строки разных синхронизаций. Это нормально для upsert, но нужно проверить, корректно ли обновляются старые отменённые заказы.";

    }

    else {

      diagnosis =
        "Текущая выборка согласована с точными count Supabase. Если предыдущий procurement-real показал другие числа, наиболее вероятна нестабильная пагинация старого запроса без явной сортировки.";

    }


    // ========================================================
    // 15. ОТВЕТ
    // ========================================================

    return NextResponse.json({

      ok:
        true,


      message:
        "Аудит заказов WB завершён",


      wildberriesRequestSent:
        false,


      period: {

        days:
          SALES_DAYS,

        start:
          periodStartIso,

        end:
          periodEndIso,

        ordersLastSuccessAt:
          ordersState.last_success_at,

      },


      serverCounts: {

        totalFbw:
          serverTotal,

        active:
          serverActive,

        cancelled:
          serverCancelled,

        nullIsCancel:
          serverNullCancel,

        mathValid:
          serverMathValid,

      },


      loadedRows: {

        total:
          rows.length,

        uniqueSrid:
          uniqueSrids.size,

        active:
          localActive.length,

        cancelled:
          localCancelled.length,

        nullIsCancel:
          localNull.length,

        pages:
          loaded.pages,

        pageSize:
          PAGE_SIZE,

        deterministicOrder:
          "order_date.asc,srid.asc",

        mathValid:
          localMathValid,

      },


      comparison: {

        countsMatch,

        totalDifference:
          rows.length
          -
          serverTotal,

        activeDifference:
          localActive.length
          -
          serverActive,

        cancelledDifference:
          localCancelled.length
          -
          serverCancelled,

        nullDifference:
          localNull.length
          -
          serverNullCancel,

      },


      duplicates: {

        duplicateSridCount:
          duplicateSrids.length,

        sample:
          duplicateSrids.slice(
            0,
            50
          ),

      },


      cancelConsistency: {

        cancelledWithoutCancelDate:
          cancelledWithoutCancelDate.length,

        activeWithCancelDate:
          activeWithCancelDate.length,

        note:
          "is_cancel считается основным признаком отмены. cancel_date используется только как дополнительная диагностическая проверка.",

      },


      syncVersions: {

        count:
          syncVersions.length,

        values:
          syncVersions.slice(
            0,
            50
          ),

      },


      diagnosis,


      cancelledSample,

    });

  } catch (error) {

    console.error(
      "Ошибка orders-audit:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка аудита заказов WB",
      },
      {
        status:
          500,
      }
    );

  }

}
