import {
  NextRequest,
  NextResponse,
} from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SYNC_KEY =
  "stocks";

const REPEAT_GUARD_HOURS =
  1;

const PAGE_LIMIT =
  1000;

const SUPABASE_BATCH_SIZE =
  500;

const SALES_PERIOD_DAYS =
  28;

const WB_URL =
  "https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/products";


// ============================================================
// ТИПЫ
// ============================================================

type SyncState = {
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

  stage?:
    string | null;

  external_task_id?:
    string | null;

  last_snapshot_id?:
    string | null;
};


type WBProduct = {
  nmID?:
    number;

  vendorCode?:
    string;

  name?:
    string;

  brandName?:
    string;

  metrics?: {
    stockCount?:
      number;

    toClientCount?:
      number;

    fromClientCount?:
      number;

    availability?:
      string;
  };

  [key: string]:
    unknown;
};


// ============================================================
// JSON
// ============================================================

function parseJson(
  text: string
): any {

  try {

    return JSON.parse(
      text
    );

  } catch {

    return {
      rawText:
        text,
    };

  }

}


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
// WB TOKEN
// ============================================================

function getWBToken() {

  const token =
    process.env.WB_READ_TOKEN;


  if (!token) {

    throw new Error(
      "Не найдена переменная окружения WB_READ_TOKEN"
    );

  }


  return token;

}


// ============================================================
// UUID
// ============================================================

function makeUuid() {

  return crypto.randomUUID();

}


// ============================================================
// BATCHES
// ============================================================

function splitIntoBatches<T>(
  rows: T[],
  batchSize: number
): T[][] {

  const result:
    T[][] =
    [];


  for (
    let i = 0;
    i < rows.length;
    i += batchSize
  ) {

    result.push(
      rows.slice(
        i,
        i + batchSize
      )
    );

  }


  return result;

}


// ============================================================
// ЧИТАЕМ STATE
// ============================================================

async function getSyncState():
Promise<SyncState | null> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
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
      `Не удалось прочитать wb_sync_state. HTTP ${response.status}: ${text}`
    );

  }


  const rows =
    parseJson(
      text
    );


  if (
    !Array.isArray(
      rows
    )
  ) {

    return null;

  }


  return (
    rows[0]
    ??
    null
  );

}


// ============================================================
// СОХРАНЯЕМ STATE
// ============================================================

async function saveSyncState(
  data: {
    lastAttemptAt:
      string | null;

    lastSuccessAt:
      string | null;

    nextAllowedAt:
      string | null;

    lastHttpStatus:
      number | null;

    retryAfterSeconds:
      number | null;

    lastMessage:
      string | null;

    stage?:
      string | null;

    lastSnapshotId?:
      string | null;
  }
) {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const body = {
    sync_key:
      SYNC_KEY,

    last_attempt_at:
      data.lastAttemptAt,

    last_success_at:
      data.lastSuccessAt,

    next_allowed_at:
      data.nextAllowedAt,

    last_http_status:
      data.lastHttpStatus,

    retry_after_seconds:
      data.retryAfterSeconds,

    last_message:
      data.lastMessage,

    stage:
      data.stage
      ??
      null,

    external_task_id:
      null,

    last_snapshot_id:
      data.lastSnapshotId
      ??
      null,

    updated_at:
      new Date().toISOString(),
  };


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/wb_sync_state`
      +
      `?on_conflict=sync_key`,
      {
        method:
          "POST",

        headers: {
          apikey:
            supabaseKey,

          Authorization:
            `Bearer ${supabaseKey}`,

          Accept:
            "application/json",

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
      `Не удалось сохранить wb_sync_state. HTTP ${response.status}: ${text}`
    );

  }

}


// ============================================================
// ПОСЛЕДНИЙ SNAPSHOT
// ============================================================

async function getLatestSnapshot():
Promise<{
  snapshot_id: string;
  snapshot_at: string;
} | null> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/wb_stock_product_snapshots`
      +
      `?select=snapshot_id,snapshot_at`
      +
      `&order=snapshot_at.desc`
      +
      `&limit=1`,
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
      `Не удалось прочитать последний snapshot остатков. HTTP ${response.status}: ${text}`
    );

  }


  const rows =
    parseJson(
      text
    );


  if (
    !Array.isArray(
      rows
    )
    ||
    rows.length === 0
  ) {

    return null;

  }


  return {
    snapshot_id:
      String(
        rows[0].snapshot_id
      ),

    snapshot_at:
      String(
        rows[0].snapshot_at
      ),
  };

}


// ============================================================
// УДАЛЕНИЕ НЕПОЛНОГО SNAPSHOT
// ============================================================

async function deleteSnapshot(
  snapshotId: string
) {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  await fetch(
    `${supabaseUrl}/rest/v1/wb_stock_product_snapshots`
    +
    `?snapshot_id=eq.${encodeURIComponent(
      snapshotId
    )}`,
    {
      method:
        "DELETE",

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

}


// ============================================================
// RATE LIMIT
// ============================================================

function parseRetrySeconds(
  response: Response
): number | null {

  const candidates = [

    response.headers.get(
      "x-ratelimit-retry"
    ),

    response.headers.get(
      "x-ratelimit-reset"
    ),

    response.headers.get(
      "retry-after"
    ),

  ];


  for (
    const raw
    of candidates
  ) {

    if (!raw) {

      continue;

    }


    const value =
      Number(
        raw
      );


    if (
      Number.isFinite(
        value
      )
      &&
      value > 0
    ) {

      return Math.ceil(
        value
      );

    }

  }


  return null;

}


// ============================================================
// ПЕРИОД ДЛЯ WB REPORT
// ============================================================

function getReportPeriod() {

  const end =
    new Date();


  const start =
    new Date(
      end.getTime()
      -
      SALES_PERIOD_DAYS
      *
      24
      *
      60
      *
      60
      *
      1000
    );


  return {
    start:
      start
        .toISOString()
        .slice(
          0,
          10
        ),

    end:
      end
        .toISOString()
        .slice(
          0,
          10
        ),
  };

}


// ============================================================
// GET
// ============================================================

export async function GET(
  request: NextRequest
) {

  try {

    const force =
      request
        .nextUrl
        .searchParams
        .get(
          "force"
        )
      ===
      "1";


    const wbToken =
      getWBToken();


    const {
      supabaseUrl,
      supabaseKey,
    } =
      getSupabaseConfig();


    // ========================================================
    // 1. ТЕКУЩЕЕ СОСТОЯНИЕ
    // ========================================================

    const state =
      await getSyncState();


    // ========================================================
    // 2. НЕ ОБХОДИМ РЕАЛЬНЫЙ СОХРАНЁННЫЙ RATE LIMIT
    // ========================================================

    if (
      state?.next_allowed_at
    ) {

      const nextAllowed =
        new Date(
          state.next_allowed_at
        );


      if (
        Number.isFinite(
          nextAllowed.getTime()
        )
        &&
        nextAllowed.getTime()
        >
        Date.now()
      ) {

        const secondsRemaining =
          Math.ceil(
            (
              nextAllowed.getTime()
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

          forced:
            force,

          message:
            "Запрос к Wildberries не выполнен: сохранённый лимит API ещё не восстановился",

          secondsRemaining,

          nextAllowedAt:
            state.next_allowed_at,

          lastHttpStatus:
            state.last_http_status,

          wildberriesRequestSent:
            false,
        });

      }

    }


    // ========================================================
    // 3. ОБЫЧНЫЙ GUARD СВЕЖЕСТИ
    //
    // force=1 ЕГО ОБХОДИТ.
    // ========================================================

    const latestSnapshot =
      await getLatestSnapshot();


    if (
      !force
      &&
      latestSnapshot
    ) {

      const latestTime =
        new Date(
          latestSnapshot.snapshot_at
        ).getTime();


      const hoursSinceLastSync =
        (
          Date.now()
          -
          latestTime
        )
        /
        (
          1000
          *
          60
          *
          60
        );


      if (
        Number.isFinite(
          hoursSinceLastSync
        )
        &&
        hoursSinceLastSync
        <
        REPEAT_GUARD_HOURS
      ) {

        return NextResponse.json({
          ok:
            true,

          skipped:
            true,

          blockedByRateLimit:
            false,

          forced:
            false,

          message:
            "Свежий снимок остатков WB уже существует",

          latestSyncedAt:
            latestSnapshot.snapshot_at,

          latestSnapshotId:
            latestSnapshot.snapshot_id,

          hoursSinceLastSync:
            Number(
              hoursSinceLastSync.toFixed(
                2
              )
            ),

          repeatGuardHours:
            REPEAT_GUARD_HOURS,

          wildberriesRequestSent:
            false,
        });

      }

    }


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
        force
          ?
          "Начало принудительной синхронизации остатков WB"
          :
          "Начало синхронизации остатков WB",

      stage:
        "loading",

      lastSnapshotId:
        state?.last_snapshot_id
        ??
        null,
    });


    // ========================================================
    // 5. ПЕРИОД
    // ========================================================

    const currentPeriod =
      getReportPeriod();


    // ========================================================
    // 6. ПОЛУЧАЕМ ВСЕ СТРАНИЦЫ WB
    // ========================================================

    const allItems:
      WBProduct[] =
      [];


    let offset =
      0;


    let requestCount =
      0;


    let lastWbStatus:
      number | null =
      null;


    const rateLimitHeaders:
      Record<string, string | null> =
      {
        limit:
          null,

        remaining:
          null,

        retry:
          null,

        reset:
          null,
      };


    while (true) {

      const requestBody = {
        currentPeriod,

        stockType:
          "wb",

        skipDeletedNm:
          true,

        availabilityFilters: [
          "deficient",
          "actual",
          "balanced",
          "nonActual",
          "nonLiquid",
          "invalidData",
        ],

        orderBy: {
          field:
            "avgOrders",

          mode:
            "desc",
        },

        limit:
          PAGE_LIMIT,

        offset,
      };


      const wbResponse =
        await fetch(
          WB_URL,
          {
            method:
              "POST",

            headers: {
              Authorization:
                wbToken,

              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                requestBody
              ),

            cache:
              "no-store",
          }
        );


      requestCount +=
        1;


      lastWbStatus =
        wbResponse.status;


      rateLimitHeaders.limit =
        wbResponse.headers.get(
          "x-ratelimit-limit"
        );


      rateLimitHeaders.remaining =
        wbResponse.headers.get(
          "x-ratelimit-remaining"
        );


      rateLimitHeaders.retry =
        wbResponse.headers.get(
          "x-ratelimit-retry"
        );


      rateLimitHeaders.reset =
        wbResponse.headers.get(
          "x-ratelimit-reset"
        );


      const wbText =
        await wbResponse.text();


      const wbData =
        parseJson(
          wbText
        );


      // ======================================================
      // 7. 429
      // ======================================================

      if (
        wbResponse.status
        ===
        429
      ) {

        const retrySeconds =
          parseRetrySeconds(
            wbResponse
          );


        const nextAllowedAt =
          retrySeconds
          !==
          null
            ?
            new Date(
              Date.now()
              +
              retrySeconds
              *
              1000
            ).toISOString()
            :
            null;


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
            "Too Many Requests от Wildberries при загрузке остатков",

          stage:
            "rate_limited",

          lastSnapshotId:
            state?.last_snapshot_id
            ??
            null,
        });


        return NextResponse.json({
          ok:
            false,

          skipped:
            false,

          blockedByRateLimit:
            true,

          forced:
            force,

          message:
            "Wildberries не разрешил обновить остатки из-за лимита API",

          wbStatus:
            429,

          retryAfterSeconds:
            retrySeconds,

          nextAllowedAt,

          wildberriesRequestSent:
            true,

          requestCount,

          rateLimit:
            rateLimitHeaders,

          wbResponse:
            wbData,
        });

      }


      // ======================================================
      // 8. ПРОЧАЯ ОШИБКА WB
      // ======================================================

      if (!wbResponse.ok) {

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
            wbResponse.status,

          retryAfterSeconds:
            null,

          lastMessage:
            `Ошибка WB HTTP ${wbResponse.status} при загрузке остатков`,

          stage:
            "failed",

          lastSnapshotId:
            state?.last_snapshot_id
            ??
            null,
        });


        return NextResponse.json(
          {
            ok:
              false,

            skipped:
              false,

            blockedByRateLimit:
              false,

            forced:
              force,

            message:
              "Wildberries вернул ошибку при загрузке остатков",

            wbStatus:
              wbResponse.status,

            wildberriesRequestSent:
              true,

            requestCount,

            requestBody,

            wbResponse:
              wbData,
          },
          {
            status:
              502,
          }
        );

      }


      // ======================================================
      // 9. ITEMS
      // ======================================================

      const pageItems =
        Array.isArray(
          wbData
            ?.data
            ?.items
        )
          ?
          wbData.data.items as WBProduct[]
          :
          [];


      allItems.push(
        ...pageItems
      );


      if (
        pageItems.length
        <
        PAGE_LIMIT
      ) {

        break;

      }


      offset +=
        PAGE_LIMIT;

    }


    // ========================================================
    // 10. ПРОВЕРКА ОТВЕТА
    // ========================================================

    if (
      allItems.length
      ===
      0
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
          lastWbStatus,

        retryAfterSeconds:
          null,

        lastMessage:
          "WB вернул пустой список товаров в отчёте остатков",

        stage:
          "failed",

        lastSnapshotId:
          state?.last_snapshot_id
          ??
          null,
      });


      return NextResponse.json(
        {
          ok:
            false,

          skipped:
            false,

          forced:
            force,

          message:
            "Wildberries ответил успешно, но список товаров в остатках пуст",

          wildberriesRequestSent:
            true,

          requestCount,
        },
        {
          status:
            502,
        }
      );

    }


    // ========================================================
    // 11. УБИРАЕМ ДУБЛИ NMID
    // ========================================================

    const uniqueByNmId =
      new Map<
        number,
        WBProduct
      >();


    let invalidNmIdRows =
      0;


    for (
      const item
      of allItems
    ) {

      const nmId =
        Number(
          item.nmID
        );


      if (
        !Number.isFinite(
          nmId
        )
        ||
        nmId <= 0
      ) {

        invalidNmIdRows +=
          1;

        continue;

      }


      uniqueByNmId.set(
        nmId,
        item
      );

    }


    const uniqueItems =
      Array.from(
        uniqueByNmId.values()
      );


    // ========================================================
    // 12. СОЗДАЁМ НОВЫЙ SNAPSHOT
    // ========================================================

    const snapshotId =
      makeUuid();


    const snapshotAt =
      new Date().toISOString();


    const rows =
      uniqueItems.map(
        (item) => {

          const metrics =
            item.metrics
            ??
            {};


          const stockCount =
            Math.max(
              0,
              Number(
                metrics.stockCount
              )
              ||
              0
            );


          const toClientCount =
            Math.max(
              0,
              Number(
                metrics.toClientCount
              )
              ||
              0
            );


          const fromClientCount =
            Math.max(
              0,
              Number(
                metrics.fromClientCount
              )
              ||
              0
            );


          return {
            snapshot_id:
              snapshotId,

            snapshot_at:
              snapshotAt,

            nm_id:
              Number(
                item.nmID
              ),

            vendor_code:
              item.vendorCode
              ??
              null,

            product_name:
              item.name
              ??
              null,

            brand_name:
              item.brandName
              ??
              null,

            stock_count:
              stockCount,

            to_client_count:
              toClientCount,

            from_client_count:
              fromClientCount,

            availability:
              metrics.availability
              ??
              null,

            raw:
              item,
          };

        }
      );


    // ========================================================
    // 13. ЗАПИСЬ SNAPSHOT В SUPABASE
    // ========================================================

    const batches =
      splitIntoBatches(
        rows,
        SUPABASE_BATCH_SIZE
      );


    let savedRows =
      0;


    for (
      let i = 0;
      i < batches.length;
      i++
    ) {

      const batch =
        batches[i];


      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/wb_stock_product_snapshots`
          +
          `?on_conflict=snapshot_id,nm_id`,
          {
            method:
              "POST",

            headers: {
              apikey:
                supabaseKey,

              Authorization:
                `Bearer ${supabaseKey}`,

              Accept:
                "application/json",

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


        await deleteSnapshot(
          snapshotId
        );


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
            lastWbStatus,

          retryAfterSeconds:
            null,

          lastMessage:
            "WB ответил успешно, но snapshot остатков не удалось сохранить",

          stage:
            "failed",

          lastSnapshotId:
            state?.last_snapshot_id
            ??
            null,
        });


        return NextResponse.json(
          {
            ok:
              false,

            forced:
              force,

            message:
              "Ошибка записи нового snapshot остатков в Supabase",

            failedBatch:
              i + 1,

            batchesCount:
              batches.length,

            savedBeforeFailure:
              savedRows,

            supabaseStatus:
              response.status,

            supabaseResponse:
              parseJson(
                text
              ),

            wildberriesRequestSent:
              true,
          },
          {
            status:
              500,
          }
        );

      }


      savedRows +=
        batch.length;

    }


    // ========================================================
    // 14. КОНТРОЛЬНЫЕ СУММЫ
    // ========================================================

    const totalStock =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.stock_count,
        0
      );


    const totalToClient =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.to_client_count,
        0
      );


    const totalFromClient =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum
          +
          row.from_client_count,
        0
      );


    const zeroStockSku =
      rows.filter(
        (row) =>
          row.stock_count
          ===
          0
      ).length;


    // ========================================================
    // 15. УСПЕШНЫЙ STATE
    // ========================================================

    await saveSyncState({
      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        snapshotAt,

      nextAllowedAt:
        null,

      lastHttpStatus:
        lastWbStatus,

      retryAfterSeconds:
        null,

      lastMessage:
        `Успешно загружены поартикульные остатки WB: ${savedRows} SKU`,

      stage:
        "completed",

      lastSnapshotId:
        snapshotId,
    });


    // ========================================================
    // 16. ОТВЕТ
    // ========================================================

    return NextResponse.json({

      ok:
        true,

      skipped:
        false,

      blockedByRateLimit:
        false,

      forced:
        force,

      message:
        force
          ?
          "Остатки Wildberries принудительно обновлены"
          :
          "Остатки Wildberries успешно обновлены",

      wildberriesRequestSent:
        true,


      previousSnapshot: latestSnapshot
        ?
        {
          snapshotId:
            latestSnapshot.snapshot_id,

          snapshotAt:
            latestSnapshot.snapshot_at,
        }
        :
        null,


      newSnapshot: {

        snapshotId,

        snapshotAt,

        rows:
          savedRows,
      },


      request: {

        currentPeriod,

        stockType:
          "wb",

        pages:
          requestCount,

        forced:
          force,
      },


      processing: {

        receivedRows:
          allItems.length,

        uniqueSku:
          uniqueItems.length,

        invalidNmIdRows,

        batches:
          batches.length,
      },


      totals: {

        stockCount:
          totalStock,

        toClientCount:
          totalToClient,

        fromClientCount:
          totalFromClient,

        zeroStockSku,
      },


      wildberries: {

        status:
          lastWbStatus,

        rateLimit:
          rateLimitHeaders,
      },

    });

  } catch (error) {

    console.error(
      "Ошибка sync-stocks WB:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Ошибка синхронизации остатков Wildberries",

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
