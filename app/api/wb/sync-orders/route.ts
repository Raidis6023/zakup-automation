import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  300;


// ============================================================
// CONFIG
// ============================================================

const SYNC_KEY =
  "orders";


const SUPABASE_BATCH_SIZE =
  1000;


const CONTROL_NM_ID =
  232169288;


// После успешного запроса sales следующий sales-запрос
// считаем безопасным через 2 часа.
const SALES_COOLDOWN_SECONDS =
  2 * 60 * 60;


// Кнопка продаж также использует /supplier/orders.
// Для всей кнопки используем более длинное окно.
const ORDERS_COOLDOWN_SECONDS =
  3 * 60 * 60;


// Диагностическая защита от подозрительно большой выдачи WB.
const WB_RESPONSE_SAFETY_LIMIT =
  80000;


// ============================================================
// HELPERS
// ============================================================

function parseJson(
  value: string
): any {

  try {

    return JSON.parse(
      value
    );

  } catch {

    return value;

  }

}


function splitIntoBatches<T>(
  items: T[],
  size: number
): T[][] {

  const result:
    T[][] =
    [];


  for (
    let i = 0;
    i < items.length;
    i += size
  ) {

    result.push(
      items.slice(
        i,
        i + size
      )
    );

  }


  return result;

}


function normalizeCancelDate(
  value: unknown
):
string | null {

  if (
    typeof value !==
      "string"
    ||
    !value
  ) {

    return null;

  }


  if (
    value.startsWith(
      "0001-01-01"
    )
  ) {

    return null;

  }


  return value;

}


// ============================================================
// ДАТА В ФОРМАТЕ YYYY-MM-DD
// ============================================================

function dateKey(
  value: unknown
):
string | null {

  if (
    typeof value !==
      "string"
    ||
    value.length <
      10
  ) {

    return null;

  }


  return value.slice(
    0,
    10
  );

}


// ============================================================
// ДАТА ± N ДНЕЙ
// ============================================================

function shiftDate(
  value: string,
  days: number
) {

  const date =
    new Date(
      `${value}T00:00:00.000Z`
    );


  date.setUTCDate(
    date.getUTCDate()
    +
    days
  );


  return date
    .toISOString()
    .slice(
      0,
      10
    );

}


// ============================================================
// ПОПАДАЕТ ЛИ WB-СТРОКА В НАШ ПЕРИОД
//
// WB возвращает дату в локальном формате с timezone.
// Для календарного периода нам важно именно YYYY-MM-DD
// из исходной строки, а не дата после перевода в UTC.
// ============================================================

function isInsidePeriod(
  value: unknown,
  dateFrom: string,
  dateTo: string
) {

  const key =
    dateKey(
      value
    );


  if (!key) {

    return false;

  }


  return (
    key >=
      dateFrom
    &&
    key <=
      dateTo
  );

}


// ============================================================
// RATE LIMIT
// ============================================================

function parseRetrySeconds(
  response: Response
):
number | null {

  const raw =
    response.headers.get(
      "x-ratelimit-retry"
    )
    ??
    response.headers.get(
      "x-ratelimit-reset"
    );


  if (!raw) {

    return null;

  }


  const value =
    Number(
      raw
    );


  if (
    !Number.isFinite(
      value
    )
    ||
    value <=
      0
  ) {

    return null;

  }


  return Math.ceil(
    value
  );

}


function getRateLimitHeaders(
  response: Response
) {

  return {

    limit:
      response.headers.get(
        "x-ratelimit-limit"
      ),

    remaining:
      response.headers.get(
        "x-ratelimit-remaining"
      ),

    retry:
      response.headers.get(
        "x-ratelimit-retry"
      ),

    reset:
      response.headers.get(
        "x-ratelimit-reset"
      ),

  };

}


function addSeconds(
  value: string,
  seconds: number
) {

  return new Date(
    new Date(
      value
    ).getTime()
    +
    seconds *
    1000
  ).toISOString();

}


function laterIso(
  first:
    string | null,
  second:
    string | null
):
string | null {

  if (!first) {

    return second;

  }


  if (!second) {

    return first;

  }


  const firstTime =
    new Date(
      first
    ).getTime();


  const secondTime =
    new Date(
      second
    ).getTime();


  return firstTime >=
    secondTime
    ?
    first
    :
    second;

}


// ============================================================
// MAIN
// ============================================================

export async function GET() {

  // ==========================================================
  // ENV
  // ==========================================================

  const wbToken =
    process.env.WB_READ_TOKEN
    ?.trim();


  const supabaseUrl =
    process.env.SUPABASE_URL
    ?.trim()
    ??
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim();


  const supabaseKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
      ?.trim()
    ??
    process.env
      .SUPABASE_SECRET_KEY
      ?.trim();


  if (!wbToken) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найден WB_READ_TOKEN",
      },
      {
        status:
          500,
      }
    );

  }


  if (!supabaseUrl) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найдена SUPABASE_URL",
      },
      {
        status:
          500,
      }
    );

  }


  if (!supabaseKey) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найден SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY",
      },
      {
        status:
          500,
      }
    );

  }


  // ==========================================================
  // SUPABASE HEADERS
  // ==========================================================

  const supabaseHeaders = {

    apikey:
      supabaseKey,

    Authorization:
      `Bearer ${supabaseKey}`,

    Accept:
      "application/json",

    "Content-Type":
      "application/json",

  };


  // ==========================================================
  // SAVE SYNC STATE
  // ==========================================================

  async function saveSyncState(
    data: {
      lastAttemptAt?: string | null;
      lastSuccessAt?: string | null;
      nextAllowedAt?: string | null;
      lastHttpStatus?: number | null;
      retryAfterSeconds?: number | null;
      lastMessage?: string | null;
    }
  ) {

    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_sync_state?on_conflict=sync_key`,
        {
          method:
            "POST",

          headers: {
            ...supabaseHeaders,

            Prefer:
              "resolution=merge-duplicates,return=minimal",
          },

          body:
            JSON.stringify({

              sync_key:
                SYNC_KEY,

              last_attempt_at:
                data.lastAttemptAt
                ??
                null,

              last_success_at:
                data.lastSuccessAt
                ??
                null,

              next_allowed_at:
                data.nextAllowedAt
                ??
                null,

              last_http_status:
                data.lastHttpStatus
                ??
                null,

              retry_after_seconds:
                data.retryAfterSeconds
                ??
                null,

              last_message:
                data.lastMessage
                ??
                null,

              updated_at:
                new Date()
                  .toISOString(),

            }),

          cache:
            "no-store",
        }
      );


    if (!response.ok) {

      const text =
        await response.text();


      throw new Error(
        `Не удалось сохранить wb_sync_state: ${text}`
      );

    }

  }


  // ==========================================================
  // UPSERT BATCHES
  // ==========================================================

  async function upsertRows(
    table:
      string,

    conflictColumn:
      string,

    rows:
      any[]
  ) {

    const batches =
      splitIntoBatches(
        rows,
        SUPABASE_BATCH_SIZE
      );


    let saved =
      0;


    for (
      let i = 0;
      i < batches.length;
      i++
    ) {

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/${table}?on_conflict=${conflictColumn}`,
          {
            method:
              "POST",

            headers: {
              ...supabaseHeaders,

              Prefer:
                "resolution=merge-duplicates,return=minimal",
            },

            body:
              JSON.stringify(
                batches[i]
              ),

            cache:
              "no-store",
          }
        );


      if (!response.ok) {

        const text =
          await response.text();


        return {

          ok:
            false,

          saved,

          failedBatch:
            i + 1,

          batchesCount:
            batches.length,

          status:
            response.status,

          response:
            parseJson(
              text
            ),

        };

      }


      saved +=
        batches[i]
          .length;

    }


    return {

      ok:
        true,

      saved,

      failedBatch:
        null,

      batchesCount:
        batches.length,

      status:
        200,

      response:
        null,

    };

  }


  try {

    // ========================================================
    // 1. ЧИТАЕМ СОСТОЯНИЕ
    // ========================================================

    const stateResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_sync_state`
        +
        `?sync_key=eq.${SYNC_KEY}`
        +
        `&select=*`
        +
        `&limit=1`,
        {
          method:
            "GET",

          headers:
            supabaseHeaders,

          cache:
            "no-store",
        }
      );


    if (!stateResponse.ok) {

      const text =
        await stateResponse.text();


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Не удалось прочитать состояние синхронизации WB",

          supabaseStatus:
            stateResponse.status,

          supabaseResponse:
            parseJson(
              text
            ),
        },
        {
          status:
            500,
        }
      );

    }


    const stateRows:
      any[] =
      await stateResponse.json();


    const state =
      stateRows[0]
      ??
      null;


    // ========================================================
    // 2. НЕ ЛЕЗЕМ В WB, ЕСЛИ ЕЩЁ ДЕЙСТВУЕТ СОХРАНЁННЫЙ ЛИМИТ
    // ========================================================

    if (
      state?.next_allowed_at
    ) {

      const nextAllowed =
        new Date(
          state.next_allowed_at
        ).getTime();


      if (
        Number.isFinite(
          nextAllowed
        )
        &&
        nextAllowed >
          Date.now()
      ) {

        const secondsRemaining =
          Math.ceil(
            (
              nextAllowed
              -
              Date.now()
            )
            /
            1000
          );


        return NextResponse.json({

          ok:
            true,

          skipped:
            true,

          blockedByRateLimit:
            true,

          wildberriesRequestSent:
            false,

          message:
            "Запрос к Wildberries не выполнен: действует сохранённый лимит площадки",

          secondsRemaining,

          nextAllowedAt:
            state.next_allowed_at,

          lastAttemptAt:
            state.last_attempt_at,

          lastSuccessAt:
            state.last_success_at,

          lastHttpStatus:
            state.last_http_status,

        });

      }

    }


    // ========================================================
    // 3. ПЕРИОД
    //
    // Используем ТОТ ЖЕ успешный 28-дневный период,
    // что и Ozon/dashboard.
    // ========================================================

    const periodResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/ozon_sales_sync_runs`
        +
        `?status=eq.success`
        +
        `&completed_days=eq.28`
        +
        `&date_from=not.is.null`
        +
        `&date_to=not.is.null`
        +
        `&select=date_from,date_to,created_at`
        +
        `&order=date_to.desc,created_at.desc`
        +
        `&limit=1`,
        {
          method:
            "GET",

          headers:
            supabaseHeaders,

          cache:
            "no-store",
        }
      );


    if (!periodResponse.ok) {

      const text =
        await periodResponse.text();


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Не удалось получить текущий 28-дневный период",

          supabaseStatus:
            periodResponse.status,

          supabaseResponse:
            parseJson(
              text
            ),
        },
        {
          status:
            500,
        }
      );

    }


    const periodRows:
      any[] =
      await periodResponse.json();


    const period =
      periodRows[0]
      ??
      null;


    if (
      !period?.date_from
      ||
      !period?.date_to
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Не найден успешный 28-дневный период Ozon",
        },
        {
          status:
            500,
        }
      );

    }


    const dateFrom =
      String(
        period.date_from
      );


    const dateTo =
      String(
        period.date_to
      );


    // ========================================================
    // ВАЖНАЯ ПРАВКА
    //
    // Продажи:
    // запрашиваем от начала нашего периода.
    //
    // Заказы/отмены:
    // запрашиваем НА 1 ДЕНЬ РАНЬШЕ.
    //
    // Это позволяет получить строки вроде:
    //
    // 2026-09-15 00:21 +03
    //
    // которые в БД как timestamptz выглядят:
    //
    // 2026-09-14 21:21 UTC.
    //
    // После ответа всё равно фильтруем строго
    // на dateFrom ... dateTo.
    // ========================================================

    const ordersRequestDateFrom =
      shiftDate(
        dateFrom,
        -1
      );


    // ========================================================
    // 4. ФИКСИРУЕМ ПОПЫТКУ
    // ========================================================

    const attemptAt =
      new Date()
        .toISOString();


    await saveSyncState({

      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        state?.last_success_at
        ??
        null,

      nextAllowedAt:
        null,

      lastHttpStatus:
        null,

      retryAfterSeconds:
        null,

      lastMessage:
        "Начало синхронизации FBW-продаж и отмен WB",

    });


    // ========================================================
    // 5. ЗАПРОС ПРОДАЖ
    // ========================================================

    const salesUrl =
      new URL(
        "https://statistics-api.wildberries.ru/api/v1/supplier/sales"
      );


    salesUrl.searchParams.set(
      "dateFrom",
      `${dateFrom}T00:00:00+03:00`
    );


    salesUrl.searchParams.set(
      "flag",
      "0"
    );


    const salesResponse =
      await fetch(
        salesUrl.toString(),
        {
          method:
            "GET",

          headers: {

            Authorization:
              wbToken,

            Accept:
              "application/json",

          },

          cache:
            "no-store",
        }
      );


    const salesText =
      await salesResponse.text();


    const salesData =
      parseJson(
        salesText
      );


    const salesRateLimit =
      getRateLimitHeaders(
        salesResponse
      );


    // ========================================================
    // SALES 429
    // ========================================================

    if (
      salesResponse.status ===
      429
    ) {

      const retrySeconds =
        parseRetrySeconds(
          salesResponse
        );


      const fallbackNext =
        addSeconds(
          attemptAt,
          SALES_COOLDOWN_SECONDS
        );


      const headerNext =
        retrySeconds
        !==
        null
          ?
          addSeconds(
            attemptAt,
            retrySeconds
          )
          :
          null;


      const nextAllowedAt =
        laterIso(
          fallbackNext,
          headerNext
        );


      await saveSyncState({

        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at
          ??
          null,

        nextAllowedAt,

        lastHttpStatus:
          429,

        retryAfterSeconds:
          retrySeconds,

        lastMessage:
          "Лимит WB при загрузке FBW-продаж",

      });


      return NextResponse.json(
        {
          ok:
            false,

          blockedByRateLimit:
            true,

          wildberriesRequestSent:
            true,

          message:
            "Wildberries ограничил запрос FBW-продаж. Повторная попытка будет доступна после окончания лимита.",

          wbStatus:
            429,

          source:
            "FBW-продаж",

          retryAfterSeconds:
            retrySeconds,

          nextAllowedAt,

          wbResponse:
            salesData,
        },
        {
          status:
            429,
        }
      );

    }


    if (!salesResponse.ok) {

      const nextAllowedAt =
        addSeconds(
          attemptAt,
          SALES_COOLDOWN_SECONDS
        );


      await saveSyncState({

        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at
          ??
          null,

        nextAllowedAt,

        lastHttpStatus:
          salesResponse.status,

        retryAfterSeconds:
          null,

        lastMessage:
          `Ошибка WB HTTP ${salesResponse.status} при загрузке FBW-продаж`,

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Wildberries вернул ошибку при загрузке FBW-продаж",

          wbStatus:
            salesResponse.status,

          nextAllowedAt,

          wbResponse:
            salesData,
        },
        {
          status:
            502,
        }
      );

    }


    if (
      !Array.isArray(
        salesData
      )
    ) {

      const nextAllowedAt =
        addSeconds(
          attemptAt,
          SALES_COOLDOWN_SECONDS
        );


      await saveSyncState({

        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at
          ??
          null,

        nextAllowedAt,

        lastHttpStatus:
          salesResponse.status,

        retryAfterSeconds:
          null,

        lastMessage:
          "WB вернул неожиданный формат FBW-продаж",

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "WB вернул неожиданный формат продаж",

          nextAllowedAt,

          wbResponse:
            salesData,
        },
        {
          status:
            500,
        }
      );

    }


    if (
      salesData.length >=
      WB_RESPONSE_SAFETY_LIMIT
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Ответ WB по продажам достиг защитного лимита строк. Нельзя гарантировать полноту данных.",

          received:
            salesData.length,
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 6. ФИЛЬТРУЕМ ПРОДАЖИ
    // ========================================================

    const salesInsidePeriod =
      salesData.filter(
        (
          row:
            any
        ) =>
          isInsidePeriod(
            row?.date,
            dateFrom,
            dateTo
          )
      );


    const fbwSalesRaw =
      salesInsidePeriod.filter(
        (
          row:
            any
        ) =>
          row?.warehouseType ===
            "Склад WB"
          &&
          typeof row?.saleID ===
            "string"
          &&
          row.saleID.startsWith(
            "S"
          )
      );


    const fbwReturnsIgnored =
      salesInsidePeriod.filter(
        (
          row:
            any
        ) =>
          row?.warehouseType ===
            "Склад WB"
          &&
          typeof row?.saleID ===
            "string"
          &&
          row.saleID.startsWith(
            "R"
          )
      ).length;


    const fbsSalesIgnored =
      salesInsidePeriod.filter(
        (
          row:
            any
        ) =>
          row?.warehouseType ===
            "Склад продавца"
          &&
          typeof row?.saleID ===
            "string"
          &&
          row.saleID.startsWith(
            "S"
          )
      ).length;


    const syncedAt =
      new Date()
        .toISOString();


    const salesMap =
      new Map<
        string,
        any
      >();


    for (
      const sale
      of fbwSalesRaw
    ) {

      const saleId =
        typeof sale?.saleID ===
          "string"
          ?
          sale.saleID.trim()
          :
          "";


      const nmId =
        Number(
          sale?.nmId
        );


      if (
        !saleId
        ||
        !Number.isFinite(
          nmId
        )
        ||
        nmId <=
          0
        ||
        !sale?.date
      ) {

        continue;

      }


      salesMap.set(
        saleId,
        {

          sale_id:
            saleId,

          srid:
            typeof sale?.srid ===
              "string"
              ?
              sale.srid
              :
              null,

          sale_date:
            sale.date,

          last_change_date:
            sale.lastChangeDate
            ??
            null,

          nm_id:
            nmId,

          supplier_article:
            sale.supplierArticle
            ??
            null,

          barcode:
            sale.barcode
            ??
            null,

          warehouse_name:
            sale.warehouseName
            ??
            null,

          warehouse_type:
            "Склад WB",

          income_id:
            typeof sale.incomeID ===
              "number"
              ?
              sale.incomeID
              :
              null,

          raw:
            sale,

          synced_at:
            syncedAt,

        }
      );

    }


    const salesRows =
      Array.from(
        salesMap.values()
      );


    // ========================================================
    // 7. СОХРАНЯЕМ ПРОДАЖИ
    // ========================================================

    const salesSave =
      await upsertRows(
        "wb_sales",
        "sale_id",
        salesRows
      );


    if (!salesSave.ok) {

      const nextAllowedAt =
        addSeconds(
          attemptAt,
          SALES_COOLDOWN_SECONDS
        );


      await saveSyncState({

        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at
          ??
          null,

        nextAllowedAt,

        lastHttpStatus:
          500,

        retryAfterSeconds:
          SALES_COOLDOWN_SECONDS,

        lastMessage:
          "Ошибка записи FBW-продаж в Supabase",

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Ошибка записи FBW-продаж в Supabase",

          failedBatch:
            salesSave.failedBatch,

          batchesCount:
            salesSave.batchesCount,

          savedBeforeFailure:
            salesSave.saved,

          supabaseStatus:
            salesSave.status,

          supabaseResponse:
            salesSave.response,

          nextAllowedAt,

          wildberriesRequestSent:
            true,
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 8. ЗАПРОС ORDERS С БУФЕРОМ В 1 ДЕНЬ
    // ========================================================

    const ordersUrl =
      new URL(
        "https://statistics-api.wildberries.ru/api/v1/supplier/orders"
      );


    ordersUrl.searchParams.set(
      "dateFrom",
      `${ordersRequestDateFrom}T00:00:00+03:00`
    );


    ordersUrl.searchParams.set(
      "flag",
      "0"
    );


    const ordersResponse =
      await fetch(
        ordersUrl.toString(),
        {
          method:
            "GET",

          headers: {

            Authorization:
              wbToken,

            Accept:
              "application/json",

          },

          cache:
            "no-store",
        }
      );


    const ordersText =
      await ordersResponse.text();


    const ordersData =
      parseJson(
        ordersText
      );


    const ordersRateLimit =
      getRateLimitHeaders(
        ordersResponse
      );


    // ========================================================
    // ORDERS 429
    // ========================================================

    if (
      ordersResponse.status ===
      429
    ) {

      const retrySeconds =
        parseRetrySeconds(
          ordersResponse
        );


      const salesNext =
        addSeconds(
          attemptAt,
          SALES_COOLDOWN_SECONDS
        );


      const ordersFallbackNext =
        addSeconds(
          attemptAt,
          ORDERS_COOLDOWN_SECONDS
        );


      const ordersHeaderNext =
        retrySeconds
        !==
        null
          ?
          addSeconds(
            attemptAt,
            retrySeconds
          )
          :
          null;


      const nextAllowedAt =
        laterIso(
          salesNext,
          laterIso(
            ordersFallbackNext,
            ordersHeaderNext
          )
        );


      await saveSyncState({

        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at
          ??
          null,

        nextAllowedAt,

        lastHttpStatus:
          429,

        retryAfterSeconds:
          retrySeconds,

        lastMessage:
          "Лимит WB при загрузке FBW-отмен",

      });


      return NextResponse.json(
        {
          ok:
            false,

          blockedByRateLimit:
            true,

          wildberriesRequestSent:
            true,

          message:
            "Продажи сохранены, но Wildberries ограничил запрос заказов/отмен.",

          wbStatus:
            429,

          source:
            "FBW-отмен",

          retryAfterSeconds:
            retrySeconds,

          nextAllowedAt,

          salesAlreadySaved:
            salesRows.length,

          wbResponse:
            ordersData,
        },
        {
          status:
            429,
        }
      );

    }


    if (!ordersResponse.ok) {

      const nextAllowedAt =
        addSeconds(
          attemptAt,
          ORDERS_COOLDOWN_SECONDS
        );


      await saveSyncState({

        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at
          ??
          null,

        nextAllowedAt,

        lastHttpStatus:
          ordersResponse.status,

        retryAfterSeconds:
          null,

        lastMessage:
          `Ошибка WB HTTP ${ordersResponse.status} при загрузке заказов/отмен`,

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Продажи сохранены, но WB вернул ошибку при загрузке заказов/отмен",

          wbStatus:
            ordersResponse.status,

          salesAlreadySaved:
            salesRows.length,

          nextAllowedAt,

          wbResponse:
            ordersData,
        },
        {
          status:
            502,
        }
      );

    }


    if (
      !Array.isArray(
        ordersData
      )
    ) {

      const nextAllowedAt =
        addSeconds(
          attemptAt,
          ORDERS_COOLDOWN_SECONDS
        );


      await saveSyncState({

        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at
          ??
          null,

        nextAllowedAt,

        lastHttpStatus:
          500,

        retryAfterSeconds:
          null,

        lastMessage:
          "WB вернул неожиданный формат заказов/отмен",

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "WB вернул неожиданный формат заказов/отмен",

          salesAlreadySaved:
            salesRows.length,

          nextAllowedAt,

          wbResponse:
            ordersData,
        },
        {
          status:
            500,
        }
      );

    }


    if (
      ordersData.length >=
      WB_RESPONSE_SAFETY_LIMIT
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Ответ WB по заказам достиг защитного лимита строк. Нельзя гарантировать полноту данных.",

          received:
            ordersData.length,
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 9. СТРОГО ФИЛЬТРУЕМ ORDERS ОБРАТНО НА 28 ДНЕЙ
    //
    // Вот здесь и исправляется проблема трёх строк.
    //
    // Запросили с 14.09,
    // но сохраняем только строки,
    // чья исходная дата WB = 15.09 ... 12.10.
    // ========================================================

    const ordersInsidePeriod =
      ordersData.filter(
        (
          row:
            any
        ) =>
          isInsidePeriod(
            row?.date,
            dateFrom,
            dateTo
          )
      );


    const fbsOrdersIgnored =
      ordersInsidePeriod.filter(
        (
          row:
            any
        ) =>
          row?.warehouseType ===
            "Склад продавца"
      ).length;


    const fbwOrdersRaw =
      ordersInsidePeriod.filter(
        (
          row:
            any
        ) =>
          row?.warehouseType ===
            "Склад WB"
      );


    const ordersMap =
      new Map<
        string,
        any
      >();


    for (
      const order
      of fbwOrdersRaw
    ) {

      const srid =
        typeof order?.srid ===
          "string"
          ?
          order.srid.trim()
          :
          "";


      const nmId =
        Number(
          order?.nmId
        );


      if (
        !srid
        ||
        !Number.isFinite(
          nmId
        )
        ||
        nmId <=
          0
        ||
        !order?.date
      ) {

        continue;

      }


      ordersMap.set(
        srid,
        {

          srid,

          order_date:
            order.date,

          last_change_date:
            order.lastChangeDate
            ??
            null,

          nm_id:
            nmId,

          supplier_article:
            order.supplierArticle
            ??
            null,

          barcode:
            order.barcode
            ??
            null,

          warehouse_name:
            order.warehouseName
            ??
            null,

          warehouse_type:
            "Склад WB",

          is_cancel:
            order.isCancel ===
            true,

          cancel_date:
            normalizeCancelDate(
              order.cancelDate
            ),

          income_id:
            typeof order.incomeID ===
              "number"
              ?
              order.incomeID
              :
              null,

          raw:
            order,

          synced_at:
            syncedAt,

        }
      );

    }


    const orderRows =
      Array.from(
        ordersMap.values()
      );


    const fbwCancelledOrders =
      orderRows.filter(
        row =>
          row.is_cancel ===
          true
      ).length;


    // ========================================================
    // 10. СОХРАНЯЕМ ORDERS
    // ========================================================

    const ordersSave =
      await upsertRows(
        "wb_orders",
        "srid",
        orderRows
      );


    if (!ordersSave.ok) {

      const nextAllowedAt =
        addSeconds(
          attemptAt,
          ORDERS_COOLDOWN_SECONDS
        );


      await saveSyncState({

        lastAttemptAt:
          attemptAt,

        lastSuccessAt:
          state?.last_success_at
          ??
          null,

        nextAllowedAt,

        lastHttpStatus:
          500,

        retryAfterSeconds:
          ORDERS_COOLDOWN_SECONDS,

        lastMessage:
          "Ошибка записи FBW-заказов/отмен в Supabase",

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Продажи сохранены, но произошла ошибка записи FBW-заказов/отмен в Supabase",

          salesAlreadySaved:
            salesRows.length,

          failedBatch:
            ordersSave.failedBatch,

          batchesCount:
            ordersSave.batchesCount,

          savedBeforeFailure:
            ordersSave.saved,

          supabaseStatus:
            ordersSave.status,

          supabaseResponse:
            ordersSave.response,

          nextAllowedAt,

          wildberriesRequestSent:
            true,
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 11. УСПЕХ
    //
    // После обоих запросов кнопка снова доступна
    // по более длинному окну /supplier/orders.
    // ========================================================

    const successAt =
      new Date()
        .toISOString();


    const nextAllowedAt =
      addSeconds(
        successAt,
        ORDERS_COOLDOWN_SECONDS
      );


    await saveSyncState({

      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        successAt,

      nextAllowedAt,

      lastHttpStatus:
        200,

      retryAfterSeconds:
        ORDERS_COOLDOWN_SECONDS,

      lastMessage:
        "FBW-продажи и отмены WB успешно синхронизированы",

    });


    // ========================================================
    // 12. CONTROL PRODUCT
    // ========================================================

    const controlSales =
      salesRows.filter(
        row =>
          row.nm_id ===
          CONTROL_NM_ID
      ).length;


    const controlCancellations =
      orderRows.filter(
        row =>
          row.nm_id ===
            CONTROL_NM_ID
          &&
          row.is_cancel ===
            true
      ).length;


    // ========================================================
    // 13. RESPONSE
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      blockedByRateLimit:
        false,

      skipped:
        false,

      wildberriesRequestSent:
        true,

      message:
        "FBW-продажи и отмены Wildberries успешно сохранены",

      period: {

        days:
          28,

        dateFrom,

        dateTo,

        ordersRequestDateFrom,

        note:
          "Заказы запрашиваются с запасом в 1 день, но в БД для расчёта сохраняется только основной 28-дневный период.",

      },

      source: {

        sales:
          "/api/v1/supplier/sales",

        cancellations:
          "/api/v1/supplier/orders",

      },

      processing: {

        salesResponseRows:
          salesData.length,

        ordersResponseRows:
          ordersData.length,

        salesInsidePeriod:
          salesInsidePeriod.length,

        ordersInsidePeriod:
          ordersInsidePeriod.length,

        fbwSales:
          salesRows.length,

        fbwCancelledOrders,

        fbwReturnsIgnored,

        fbsSalesIgnored,

        fbsOrdersIgnored,

      },

      saved: {

        salesRows:
          salesSave.saved,

        orderRows:
          ordersSave.saved,

        syncedAt:
          successAt,

      },

      controlProduct: {

        nmId:
          CONTROL_NM_ID,

        fbwSales:
          controlSales,

        fbwCancellations:
          controlCancellations,

      },

      rules: {

        sales:
          "warehouseType = Склад WB AND saleID startsWith S",

        cancellations:
          "warehouseType = Склад WB AND isCancel = true",

        orderDateBuffer:
          "Запрос orders начинается на 1 календарный день раньше, после чего данные фильтруются обратно на основной период.",

        fbsIncluded:
          false,

        returnsIncluded:
          false,

      },

      nextAllowedAt,

      wildberries: {

        salesStatus:
          salesResponse.status,

        ordersStatus:
          ordersResponse.status,

        salesRateLimit,

        ordersRateLimit,

      },

    });

  } catch (
    error
  ) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Ошибка синхронизации FBW-продаж и отмен Wildberries",

        error:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка",
      },
      {
        status:
          500,
      }
    );

  }

}
