import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SUPABASE_BATCH_SIZE =
  1000;

const SYNC_KEY =
  "orders";

const MAX_WB_ROWS_PER_RESPONSE =
  80000;


// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function parseJson(
  text: string
): any {

  try {

    return JSON.parse(
      text
    );

  } catch {

    return text;

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
): string | null {

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


function getDatePart(
  value: unknown
): string | null {

  if (
    typeof value !==
      "string"
    ||
    value.length < 10
  ) {

    return null;

  }


  return value.slice(
    0,
    10
  );

}


function isDateInsidePeriod(
  value: unknown,
  dateFrom: string,
  dateTo: string
): boolean {

  const date =
    getDatePart(
      value
    );


  if (!date) {

    return false;

  }


  return (
    date >=
      dateFrom
    &&
    date <=
      dateTo
  );

}


function toPositiveNumber(
  value: string | null
): number | null {

  if (!value) {

    return null;

  }


  const parsed =
    Number(
      value
    );


  if (
    !Number.isFinite(
      parsed
    )
    ||
    parsed <= 0
  ) {

    return null;

  }


  return parsed;

}


// ============================================================
// ОСНОВНОЙ МАРШРУТ
// ============================================================

export async function GET() {

  // ==========================================================
  // 0. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
  // ==========================================================

  const wbTokenRaw =
    process.env.WB_READ_TOKEN;


  const supabaseUrlRaw =
    process.env.SUPABASE_URL
    ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;


  const supabaseKeyRaw =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env.SUPABASE_SECRET_KEY;


  if (!wbTokenRaw) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найден WB_READ_TOKEN в Vercel",
      },
      {
        status:
          500,
      }
    );

  }


  if (!supabaseUrlRaw) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найдена SUPABASE_URL или NEXT_PUBLIC_SUPABASE_URL",
      },
      {
        status:
          500,
      }
    );

  }


  if (!supabaseKeyRaw) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найдена SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY",
      },
      {
        status:
          500,
      }
    );

  }


  const wbToken:
    string =
    wbTokenRaw;


  const supabaseUrl:
    string =
    supabaseUrlRaw;


  const supabaseKey:
    string =
    supabaseKeyRaw;


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

  };


  // ==========================================================
  // СОХРАНЕНИЕ СОСТОЯНИЯ СИНХРОНИЗАЦИИ
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

    const body = {

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
        new Date().toISOString(),

    };


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/wb_sync_state?on_conflict=sync_key`,
        {
          method:
            "POST",

          headers: {
            ...supabaseHeaders,

            "Content-Type":
              "application/json",

            Prefer:
              "resolution=merge-duplicates,return=minimal",
          },

          body:
            JSON.stringify(
              body
            ),

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
  // ОБРАБОТКА 429
  // ==========================================================

  async function handleRateLimit(
    response: Response,
    attemptAt: string,
    previousSuccessAt:
      string | null,
    sourceName: string,
    responseData: any
  ) {

    const retryHeader =
      response.headers.get(
        "x-ratelimit-retry"
      )
      ??
      response.headers.get(
        "retry-after"
      );


    const resetHeader =
      response.headers.get(
        "x-ratelimit-reset"
      );


    const retrySeconds =
      toPositiveNumber(
        retryHeader
      )
      ??
      toPositiveNumber(
        resetHeader
      )
      ??
      60;


    const nextAllowedAt =
      new Date(
        Date.now()
        +
        retrySeconds
        *
        1000
      ).toISOString();


    await saveSyncState({

      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        previousSuccessAt,

      nextAllowedAt,

      lastHttpStatus:
        429,

      retryAfterSeconds:
        retrySeconds,

      lastMessage:
        `Лимит WB при загрузке ${sourceName}`,

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
          `Wildberries ограничил запрос ${sourceName}. Повторная попытка будет доступна после окончания лимита.`,

        wbStatus:
          429,

        source:
          sourceName,

        retryAfterSeconds:
          retrySeconds,

        nextAllowedAt,

        wbResponse:
          responseData,
      },
      {
        status:
          429,
      }
    );

  }


  try {

    // ========================================================
    // 1. СОСТОЯНИЕ СИНХРОНИЗАЦИИ
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
    // 2. ЕСЛИ WB УЖЕ ВЕРНУЛ ЛИМИТ
    // ========================================================

    if (
      state?.next_allowed_at
    ) {

      const nextAllowed =
        new Date(
          state.next_allowed_at
        );


      const now =
        new Date();


      if (
        Number.isFinite(
          nextAllowed.getTime()
        )
        &&
        nextAllowed.getTime()
        >
        now.getTime()
      ) {

        const secondsRemaining =
          Math.ceil(
            (
              nextAllowed.getTime()
              -
              now.getTime()
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
            "Запрос к Wildberries не выполнен: ещё действует лимит площадки",

          secondsRemaining,

          nextAllowedAt:
            state.next_allowed_at,

          lastAttemptAt:
            state.last_attempt_at,

          lastSuccessAt:
            state.last_success_at,
        });

      }

    }


    // ========================================================
    // 3. ПОЛУЧАЕМ ТОЧНЫЙ 28-ДНЕВНЫЙ ПЕРИОД
    //
    // Тот же период используется на Ozon и WB dashboard.
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
            "Не удалось получить общий 28-дневный период",

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


    if (
      periodRows.length ===
      0
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
        periodRows[0].date_from
      ).slice(
        0,
        10
      );


    const dateTo =
      String(
        periodRows[0].date_to
      ).slice(
        0,
        10
      );


    // ========================================================
    // 4. ФИКСИРУЕМ ПОПЫТКУ
    // ========================================================

    const attemptAt =
      new Date().toISOString();


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
    // 5. ЗАГРУЖАЕМ РЕАЛЬНЫЕ ПРОДАЖИ
    // ========================================================

    const salesUrl =
      new URL(
        "https://statistics-api.wildberries.ru/api/v1/supplier/sales"
      );


    salesUrl.searchParams.set(
      "dateFrom",
      `${dateFrom}T00:00:00`
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


    if (
      salesResponse.status ===
      429
    ) {

      return await handleRateLimit(
        salesResponse,
        attemptAt,
        state?.last_success_at
        ??
        null,
        "FBW-продаж",
        salesData
      );

    }


    if (!salesResponse.ok) {

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
          salesResponse.status,

        retryAfterSeconds:
          null,

        lastMessage:
          `Ошибка supplier/sales HTTP ${salesResponse.status}`,

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Wildberries вернул ошибку при загрузке продаж",

          wbStatus:
            salesResponse.status,

          wbResponse:
            salesData,
        },
        {
          status:
            salesResponse.status,
        }
      );

    }


    if (
      !Array.isArray(
        salesData
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "supplier/sales вернул неожиданный формат данных",

          wbResponse:
            salesData,
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 6. ЗАЩИТА ОТ НЕПОЛНОЙ ВЫДАЧИ SALES
    // ========================================================

    if (
      salesData.length >=
      MAX_WB_ROWS_PER_RESPONSE
    ) {

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
          409,

        retryAfterSeconds:
          null,

        lastMessage:
          "supplier/sales достиг лимита 80000 строк",

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "supplier/sales вернул 80000 строк. Запись остановлена, чтобы не сохранить неполные данные.",

          received:
            salesData.length,
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 7. ЗАГРУЖАЕМ ЗАКАЗЫ ДЛЯ ОТМЕН
    // ========================================================

    const ordersUrl =
      new URL(
        "https://statistics-api.wildberries.ru/api/v1/supplier/orders"
      );


    ordersUrl.searchParams.set(
      "dateFrom",
      `${dateFrom}T00:00:00`
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


    if (
      ordersResponse.status ===
      429
    ) {

      return await handleRateLimit(
        ordersResponse,
        attemptAt,
        state?.last_success_at
        ??
        null,
        "FBW-отмен",
        ordersData
      );

    }


    if (!ordersResponse.ok) {

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
          ordersResponse.status,

        retryAfterSeconds:
          null,

        lastMessage:
          `Ошибка supplier/orders HTTP ${ordersResponse.status}`,

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Wildberries вернул ошибку при загрузке заказов/отмен",

          wbStatus:
            ordersResponse.status,

          wbResponse:
            ordersData,
        },
        {
          status:
            ordersResponse.status,
        }
      );

    }


    if (
      !Array.isArray(
        ordersData
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "supplier/orders вернул неожиданный формат данных",

          wbResponse:
            ordersData,
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 8. ЗАЩИТА ОТ НЕПОЛНОЙ ВЫДАЧИ ORDERS
    // ========================================================

    if (
      ordersData.length >=
      MAX_WB_ROWS_PER_RESPONSE
    ) {

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
          409,

        retryAfterSeconds:
          null,

        lastMessage:
          "supplier/orders достиг лимита 80000 строк",

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "supplier/orders вернул 80000 строк. Запись остановлена, чтобы не сохранить неполные данные.",

          received:
            ordersData.length,
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 9. ПОДГОТОВКА FBW-ПРОДАЖ
    //
    // В wb_sales попадает ТОЛЬКО:
    //
    // warehouseType = "Склад WB"
    // saleID = S...
    // дата входит в общий 28-дневный период
    //
    // FBS не сохраняем.
    // Возвраты R... не сохраняем.
    // ========================================================

    const syncedAt =
      new Date().toISOString();


    const salesRows =
      salesData
        .filter(
          (
            sale:
              any
          ) => {

            const saleId =
              typeof sale?.saleID ===
                "string"
                ?
                sale.saleID.trim()
                :
                "";


            return (
              sale.warehouseType ===
                "Склад WB"
              &&
              saleId.startsWith(
                "S"
              )
              &&
              Number(
                sale.nmId
              ) >
                0
              &&
              isDateInsidePeriod(
                sale.date,
                dateFrom,
                dateTo
              )
            );

          }
        )
        .map(
          (
            sale:
              any
          ) => ({

            sale_id:
              sale.saleID,

            srid:
              typeof sale.srid ===
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
              Number(
                sale.nmId
              ),

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

          })
        );


    // ========================================================
    // 10. УБИРАЕМ ДУБЛИКАТЫ SALES
    // ========================================================

    const uniqueSalesMap =
      new Map<
        string,
        any
      >();


    for (
      const row
      of salesRows
    ) {

      uniqueSalesMap.set(
        row.sale_id,
        row
      );

    }


    const uniqueSalesRows =
      Array.from(
        uniqueSalesMap.values()
      );


    // ========================================================
    // 11. ПОДГОТОВКА FBW-ЗАКАЗОВ
    //
    // wb_orders сохраняем для отмен.
    //
    // FBS здесь больше не нужен.
    // ========================================================

    const orderRows =
      ordersData
        .filter(
          (
            order:
              any
          ) => {

            return (
              order?.warehouseType ===
                "Склад WB"
              &&
              typeof order?.srid ===
                "string"
              &&
              order.srid.trim() !==
                ""
              &&
              Number(
                order.nmId
              ) >
                0
              &&
              isDateInsidePeriod(
                order.date,
                dateFrom,
                dateTo
              )
            );

          }
        )
        .map(
          (
            order:
              any
          ) => ({

            srid:
              order.srid,

            order_date:
              order.date,

            last_change_date:
              order.lastChangeDate
              ??
              null,

            nm_id:
              Number(
                order.nmId
              ),

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

          })
        );


    // ========================================================
    // 12. УБИРАЕМ ДУБЛИКАТЫ ORDERS
    // ========================================================

    const uniqueOrdersMap =
      new Map<
        string,
        any
      >();


    for (
      const row
      of orderRows
    ) {

      uniqueOrdersMap.set(
        row.srid,
        row
      );

    }


    const uniqueOrderRows =
      Array.from(
        uniqueOrdersMap.values()
      );


    // ========================================================
    // 13. ДОПОЛНИТЕЛЬНАЯ СТАТИСТИКА
    // ========================================================

    const fbwReturnsIgnored =
      salesData.filter(
        (
          sale:
            any
        ) =>
          sale?.warehouseType ===
            "Склад WB"
          &&
          typeof sale?.saleID ===
            "string"
          &&
          sale.saleID.startsWith(
            "R"
          )
          &&
          isDateInsidePeriod(
            sale.date,
            dateFrom,
            dateTo
          )
      ).length;


    const fbsSalesIgnored =
      salesData.filter(
        (
          sale:
            any
        ) =>
          sale?.warehouseType ===
            "Склад продавца"
          &&
          typeof sale?.saleID ===
            "string"
          &&
          sale.saleID.startsWith(
            "S"
          )
          &&
          isDateInsidePeriod(
            sale.date,
            dateFrom,
            dateTo
          )
      ).length;


    const fbsOrdersIgnored =
      ordersData.filter(
        (
          order:
            any
        ) =>
          order?.warehouseType ===
            "Склад продавца"
          &&
          isDateInsidePeriod(
            order.date,
            dateFrom,
            dateTo
          )
      ).length;


    const cancelledFbwOrders =
      uniqueOrderRows.filter(
        (
          row:
            any
        ) =>
          row.is_cancel ===
          true
      );


    // ========================================================
    // 14. СНАЧАЛА ЗАПИСЫВАЕМ SALES
    // ========================================================

    const salesBatches =
      splitIntoBatches(
        uniqueSalesRows,
        SUPABASE_BATCH_SIZE
      );


    let savedSalesRows =
      0;


    for (
      let i = 0;
      i < salesBatches.length;
      i++
    ) {

      const batch =
        salesBatches[i];


      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/wb_sales?on_conflict=sale_id`,
          {
            method:
              "POST",

            headers: {
              ...supabaseHeaders,

              "Content-Type":
                "application/json",

              Prefer:
                "resolution=merge-duplicates,return=minimal",
            },

            body:
              JSON.stringify(
                batch
              ),

            cache:
              "no-store",
          }
        );


      if (!response.ok) {

        const text =
          await response.text();


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
            500,

          retryAfterSeconds:
            null,

          lastMessage:
            "Ошибка записи FBW-продаж в Supabase",

        });


        return NextResponse.json(
          {
            ok:
              false,

            message:
              "WB ответил успешно, но не удалось записать FBW-продажи в wb_sales",

            failedBatch:
              i + 1,

            batches:
              salesBatches.length,

            savedBeforeFailure:
              savedSalesRows,

            supabaseStatus:
              response.status,

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


      savedSalesRows +=
        batch.length;

    }


    // ========================================================
    // 15. ЗАПИСЫВАЕМ FBW-ЗАКАЗЫ / ОТМЕНЫ
    // ========================================================

    const orderBatches =
      splitIntoBatches(
        uniqueOrderRows,
        SUPABASE_BATCH_SIZE
      );


    let savedOrderRows =
      0;


    for (
      let i = 0;
      i < orderBatches.length;
      i++
    ) {

      const batch =
        orderBatches[i];


      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/wb_orders?on_conflict=srid`,
          {
            method:
              "POST",

            headers: {
              ...supabaseHeaders,

              "Content-Type":
                "application/json",

              Prefer:
                "resolution=merge-duplicates,return=minimal",
            },

            body:
              JSON.stringify(
                batch
              ),

            cache:
              "no-store",
          }
        );


      if (!response.ok) {

        const text =
          await response.text();


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
            500,

          retryAfterSeconds:
            null,

          lastMessage:
            "Продажи сохранены, но произошла ошибка записи заказов/отмен",

        });


        return NextResponse.json(
          {
            ok:
              false,

            message:
              "FBW-продажи сохранены, но не удалось записать FBW-заказы/отмены",

            salesAlreadySaved:
              savedSalesRows,

            failedOrderBatch:
              i + 1,

            orderBatches:
              orderBatches.length,

            supabaseStatus:
              response.status,

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


      savedOrderRows +=
        batch.length;

    }


    // ========================================================
    // 16. УСПЕШНАЯ СИНХРОНИЗАЦИЯ
    // ========================================================

    await saveSyncState({

      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        syncedAt,

      nextAllowedAt:
        null,

      lastHttpStatus:
        200,

      retryAfterSeconds:
        null,

      lastMessage:
        "FBW-продажи и отмены WB успешно синхронизированы",

    });


    // ========================================================
    // 17. КОНТРОЛЬНАЯ БРИТВА
    // ========================================================

    const controlNmId =
      232169288;


    const controlSales =
      uniqueSalesRows.filter(
        (
          row:
            any
        ) =>
          row.nm_id ===
          controlNmId
      ).length;


    const controlCancellations =
      cancelledFbwOrders.filter(
        (
          row:
            any
        ) =>
          row.nm_id ===
          controlNmId
      ).length;


    // ========================================================
    // 18. ОТВЕТ
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

        fbwSales:
          uniqueSalesRows.length,

        fbwCancelledOrders:
          cancelledFbwOrders.length,

        fbwReturnsIgnored,

        fbsSalesIgnored,

        fbsOrdersIgnored,

      },

      saved: {

        salesRows:
          savedSalesRows,

        orderRows:
          savedOrderRows,

        syncedAt,

      },

      controlProduct: {

        nmId:
          controlNmId,

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

        fbsIncluded:
          false,

        returnsIncluded:
          false,

      },

      wildberries: {

        salesStatus:
          salesResponse.status,

        ordersStatus:
          ordersResponse.status,

        salesRateLimit: {

          limit:
            salesResponse.headers.get(
              "x-ratelimit-limit"
            ),

          remaining:
            salesResponse.headers.get(
              "x-ratelimit-remaining"
            ),

          retry:
            salesResponse.headers.get(
              "x-ratelimit-retry"
            ),

          reset:
            salesResponse.headers.get(
              "x-ratelimit-reset"
            ),

        },

        ordersRateLimit: {

          limit:
            ordersResponse.headers.get(
              "x-ratelimit-limit"
            ),

          remaining:
            ordersResponse.headers.get(
              "x-ratelimit-remaining"
            ),

          retry:
            ordersResponse.headers.get(
              "x-ratelimit-retry"
            ),

          reset:
            ordersResponse.headers.get(
              "x-ratelimit-reset"
            ),

        },

      },

    });

  } catch (error) {

    console.error(
      "Ошибка синхронизации WB:",
      error
    );


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
