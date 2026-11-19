import { getIntegrationSecret } from "@/lib/integrations/secrets";
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


// /supplier/orders для нашего Basic-токена
// используем как дорогой маршрут.
// После успешного запроса резервируем 3 часа.
const ORDERS_COOLDOWN_SECONDS =
  3 * 60 * 60;


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


// ============================================================
// MAIN
// ============================================================

export async function GET() {

  const wbToken = await getIntegrationSecret("wb_read_token");


  const supabaseUrl =
    process.env.SUPABASE_URL
    ?.trim()
    ??
    (process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
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


  if (
    !supabaseUrl
    ||
    !supabaseKey
  ) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найдены настройки Supabase",
      },
      {
        status:
          500,
      }
    );

  }


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
  // SAVE STATE
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
  // UPSERT ORDERS
  // ==========================================================

  async function upsertRows(
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
          `${supabaseUrl}/rest/v1/wb_orders?on_conflict=srid`,
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

      status:
        200,

      response:
        null,

    };

  }


  try {

    // ========================================================
    // 1. STATE
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
          headers:
            supabaseHeaders,

          cache:
            "no-store",
        }
      );


    const stateRows =
      stateResponse.ok
        ?
        await stateResponse.json()
        :
        [];


    const state =
      stateRows[0]
      ??
      null;


    // ========================================================
    // 2. RATE LIMIT GUARD
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
            "Запрос отмен WB не выполнен: действует лимит площадки",

          nextAllowedAt:
            state.next_allowed_at,

          secondsRemaining:
            Math.ceil(
              (
                nextAllowed
                -
                Date.now()
              )
              /
              1000
            ),

        });

      }

    }


    // ========================================================
    // 3. PERIOD
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
          headers:
            supabaseHeaders,

          cache:
            "no-store",
        }
      );


    const periodRows =
      periodResponse.ok
        ?
        await periodResponse.json()
        :
        [];


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
            "Не найден 28-дневный период",
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


    const ordersRequestDateFrom =
      shiftDate(
        dateFrom,
        -1
      );


    // ========================================================
    // 4. ATTEMPT
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
        "Начало обновления FBW-отмен",

    });


    // ========================================================
    // 5. WB ORDERS
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


    const response =
      await fetch(
        ordersUrl.toString(),
        {
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


    const text =
      await response.text();


    const data =
      parseJson(
        text
      );


    const rateLimit =
      getRateLimitHeaders(
        response
      );


    // ========================================================
    // 6. 429
    // ========================================================

    if (
      response.status ===
      429
    ) {

      const retrySeconds =
        parseRetrySeconds(
          response
        );


      const nextAllowedAt =
        addSeconds(
          attemptAt,
          Math.max(
            retrySeconds
            ??
            0,

            ORDERS_COOLDOWN_SECONDS
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
          "Лимит WB при загрузке отмен",

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
            "Wildberries ограничил запрос отмен",

          nextAllowedAt,

          retryAfterSeconds:
            retrySeconds,

          wbResponse:
            data,
        },
        {
          status:
            429,
        }
      );

    }


    if (
      !response.ok
      ||
      !Array.isArray(
        data
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
          response.status,

        retryAfterSeconds:
          null,

        lastMessage:
          "Ошибка загрузки отмен WB",

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Ошибка загрузки отмен Wildberries",

          wbStatus:
            response.status,

          nextAllowedAt,

          wbResponse:
            data,
        },
        {
          status:
            502,
        }
      );

    }


    if (
      data.length >=
      WB_RESPONSE_SAFETY_LIMIT
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Ответ WB подозрительно большой",
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 7. FILTER FBW
    // ========================================================

    const periodRowsFiltered =
      data.filter(
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


    const fbwOrders =
      periodRowsFiltered.filter(
        (
          row:
            any
        ) =>
          row?.warehouseType ===
            "Склад WB"
      );


    const syncedAt =
      new Date()
        .toISOString();


    const map =
      new Map<
        string,
        any
      >();


    for (
      const order
      of fbwOrders
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
      ) {

        continue;

      }


      map.set(
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


    const rows =
      Array.from(
        map.values()
      );


    const save =
      await upsertRows(
        rows
      );


    if (!save.ok) {

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
          "Ошибка записи отмен WB",

      });


      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Ошибка записи отмен WB в Supabase",

          nextAllowedAt,

          supabaseResponse:
            save.response,
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 8. SUCCESS
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
        "FBW-отмены Wildberries успешно синхронизированы",

    });


    const cancellations =
      rows.filter(
        row =>
          row.is_cancel ===
          true
      );


    const controlCancellations =
      cancellations.filter(
        row =>
          row.nm_id ===
          CONTROL_NM_ID
      ).length;


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
        "FBW-отмены Wildberries успешно сохранены",

      period: {

        days:
          28,

        dateFrom,

        dateTo,

        ordersRequestDateFrom,

      },

      processing: {

        responseRows:
          data.length,

        rowsInsidePeriod:
          periodRowsFiltered.length,

        fbwOrders:
          rows.length,

        fbwCancellations:
          cancellations.length,

      },

      saved: {

        orderRows:
          save.saved,

        syncedAt:
          successAt,

      },

      controlProduct: {

        nmId:
          CONTROL_NM_ID,

        fbwCancellations:
          controlCancellations,

      },

      nextAllowedAt,

      wildberries: {

        ordersStatus:
          response.status,

        ordersRateLimit:
          rateLimit,

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
          "Ошибка обновления FBW-отмен Wildberries",

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
