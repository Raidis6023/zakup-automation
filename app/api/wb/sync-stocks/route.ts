import {
  NextRequest,
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  60;


// ============================================================
// НАСТРОЙКИ
// ============================================================

const SYNC_KEY =
  "stocks";

const COOLDOWN_SECONDS =
  30
  *
  60;

const PAGE_LIMIT =
  1000;

const SUPABASE_BATCH_SIZE =
  500;

const STOCKS_URL =
  "https://seller-analytics-api.wildberries.ru/api/v2/stocks-report/products/products";

const FUNNEL_URL =
  "https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products";


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

    buyoutCount?:
      number;

    ordersCount?:
      number;

    toClientCount?:
      number;

    fromClientCount?:
      number;

    availability?:
      string;

    [key: string]:
      unknown;

  };

  [key: string]:
    unknown;

};


type FunnelProduct = {

  product?: {

    nmId?:
      number;

    vendorCode?:
      string;

    [key: string]:
      unknown;

  };

  statistic?: {

    selected?: {

      cancelCount?:
        number;

      [key: string]:
        unknown;

    };

    [key: string]:
      unknown;

  };

  [key: string]:
    unknown;

};


type Period = {
  start: string;
  end: string;
};


// ============================================================
// JSON
// ============================================================

function parseJson(
  text:
    string
): any {

  if (!text) {

    return null;

  }


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
// CONFIG
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
  rows:
    T[],

  batchSize:
    number
):
T[][] {

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
// ДАТЫ
// ============================================================

function addSeconds(
  value:
    string,

  seconds:
    number
) {

  return new Date(
    new Date(
      value
    ).getTime()
    +
    seconds
    *
    1000
  ).toISOString();

}


function getTimestamp(
  value:
    string | null | undefined
):
number | null {

  if (!value) {

    return null;

  }


  const timestamp =
    new Date(
      value
    ).getTime();


  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;

}


function laterIso(
  first:
    string | null,

  second:
    string | null
):
string | null {

  const firstTime =
    getTimestamp(
      first
    );


  const secondTime =
    getTimestamp(
      second
    );


  if (
    firstTime === null
    &&
    secondTime === null
  ) {

    return null;

  }


  if (
    firstTime === null
  ) {

    return second;

  }


  if (
    secondTime === null
  ) {

    return first;

  }


  return firstTime >= secondTime
    ? first
    : second;

}


// ============================================================
// SYNC STATE
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


  return rows[0]
    ??
    null;

}


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
      new Date()
        .toISOString(),

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
      `Не удалось прочитать последний snapshot WB. HTTP ${response.status}: ${text}`
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


async function deleteSnapshot(
  snapshotId:
    string
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
// ПЕРИОД = ТОТ ЖЕ, ЧТО У OZON И DASHBOARD
// ============================================================

async function getReportPeriod():
Promise<Period> {

  const {
    supabaseUrl,
    supabaseKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/ozon_sales_sync_runs`
      +
      `?select=date_from,date_to`
      +
      `&status=eq.success`
      +
      `&completed_days=eq.28`
      +
      `&order=date_to.desc,created_at.desc`
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
      `Не удалось определить 28-дневный период Ozon. HTTP ${response.status}: ${text}`
    );

  }


  const rows =
    parseJson(
      text
    );


  const dateFrom =
    Array.isArray(
      rows
    )
      ? rows[0]?.date_from
      : null;


  const dateTo =
    Array.isArray(
      rows
    )
      ? rows[0]?.date_to
      : null;


  if (
    typeof dateFrom !== "string"
    ||
    typeof dateTo !== "string"
  ) {

    throw new Error(
      "Не найден успешный 28-дневный период Ozon"
    );

  }


  return {
    start:
      dateFrom,

    end:
      dateTo,
  };

}


// ============================================================
// RATE LIMIT
// ============================================================

function parseRetrySeconds(
  response:
    Response
):
number | null {

  const retryCandidates = [

    response.headers.get(
      "x-ratelimit-retry"
    ),

    response.headers.get(
      "retry-after"
    ),

  ];


  for (
    const raw
    of retryCandidates
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


  const resetRaw =
    response.headers.get(
      "x-ratelimit-reset"
    );


  if (resetRaw) {

    const resetValue =
      Number(
        resetRaw
      );


    if (
      Number.isFinite(
        resetValue
      )
      &&
      resetValue > 0
    ) {

      // Некоторые API возвращают reset как Unix timestamp,
      // некоторые — как количество секунд.
      if (
        resetValue >
        10_000_000_000
      ) {

        const seconds =
          Math.ceil(
            (
              resetValue
              -
              Date.now()
            )
            /
            1000
          );


        return seconds > 0
          ? seconds
          : null;

      }


      if (
        resetValue >
        1_000_000_000
      ) {

        const seconds =
          Math.ceil(
            resetValue
            -
            Date.now()
            /
            1000
          );


        return seconds > 0
          ? seconds
          : null;

      }


      return Math.ceil(
        resetValue
      );

    }

  }


  return null;

}


function getRateLimitHeaders(
  response:
    Response
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


function buildNextAllowedAt(
  attemptAt:
    string,

  retrySeconds:
    number | null
) {

  const normalCooldown =
    addSeconds(
      attemptAt,
      COOLDOWN_SECONDS
    );


  const wbCooldown =
    retrySeconds !== null
      ? addSeconds(
          attemptAt,
          retrySeconds
        )
      : null;


  return laterIso(
    normalCooldown,
    wbCooldown
  );

}


// ============================================================
// WB REQUEST: ОСТАТКИ + ВЫКУПЫ
// ============================================================

async function loadStocks(
  wbToken:
    string,

  currentPeriod:
    Period
) {

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

    offset:
      0,

  };


  const response =
    await fetch(
      STOCKS_URL,
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


  const text =
    await response.text();


  const data =
    parseJson(
      text
    );


  const items =
    Array.isArray(
      data?.data?.items
    )
      ? data.data.items as WBProduct[]
      : [];


  return {
    response,
    data,
    items,
    requestBody,
    rateLimit:
      getRateLimitHeaders(
        response
      ),
  };

}


// ============================================================
// WB REQUEST: ОТМЕНЫ ИЗ ВОРОНКИ
// ============================================================

async function loadCancellations(
  wbToken:
    string,

  currentPeriod:
    Period
) {

  const requestBody = {

    selectedPeriod: {
      start:
        currentPeriod.start,
      end:
        currentPeriod.end,
    },

    nmIds:
      [],

    brandNames:
      [],

    subjectIds:
      [],

    tagIds:
      [],

    skipDeletedNm:
      true,

    limit:
      PAGE_LIMIT,

    offset:
      0,

  };


  const response =
    await fetch(
      FUNNEL_URL,
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


  const text =
    await response.text();


  const data =
    parseJson(
      text
    );


  const products =
    Array.isArray(
      data?.data?.products
    )
      ? data.data.products as FunnelProduct[]
      : [];


  return {
    response,
    data,
    products,
    requestBody,
    rateLimit:
      getRateLimitHeaders(
        response
      ),
  };

}


// ============================================================
// GET
// ============================================================

export async function GET(
  request:
    NextRequest
) {

  try {

    const force =
      request.nextUrl.searchParams.get(
        "force"
      )
      ===
      "1";


    const source =
      request.nextUrl.searchParams.get(
        "source"
      )
      ??
      "manual";


    const wbToken =
      getWBToken();


    const {
      supabaseUrl,
      supabaseKey,
    } =
      getSupabaseConfig();


    // ========================================================
    // 1. STATE И 30-МИНУТНЫЙ GUARD
    // ========================================================

    const state =
      await getSyncState();


    const now =
      Date.now();


    const stateNextAllowed =
      getTimestamp(
        state?.next_allowed_at
      );


    const calculatedNextAllowed =
      state?.last_success_at
        ? getTimestamp(
            addSeconds(
              state.last_success_at,
              COOLDOWN_SECONDS
            )
          )
        : null;


    const effectiveNextAllowed =
      Math.max(
        stateNextAllowed
        ??
        0,

        calculatedNextAllowed
        ??
        0
      );


    if (
      effectiveNextAllowed >
      now
    ) {

      const nextAllowedAt =
        new Date(
          effectiveNextAllowed
        ).toISOString();


      return NextResponse.json({

        ok:
          true,

        skipped:
          true,

        blockedByRateLimit:
          true,

        forced:
          force,

        source,

        message:
          "Обновление Wildberries доступно не чаще одного раза в 30 минут",

        secondsRemaining:
          Math.ceil(
            (
              effectiveNextAllowed
              -
              now
            )
            /
            1000
          ),

        nextAllowedAt,

        lastHttpStatus:
          state?.last_http_status
          ??
          null,

        wildberriesRequestSent:
          false,

      });

    }


    // ========================================================
    // 2. ПОСЛЕДНИЙ SNAPSHOT И ПЕРИОД
    // ========================================================

    const [
      latestSnapshot,
      currentPeriod,
    ] =
      await Promise.all([
        getLatestSnapshot(),
        getReportPeriod(),
      ]);


    // ========================================================
    // 3. ФИКСИРУЕМ ПОПЫТКУ
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
        "Начало синхронизации данных Wildberries",

      stage:
        "loading",

      lastSnapshotId:
        state?.last_snapshot_id
        ??
        null,

    });


    // ========================================================
    // 4. ОСТАТКИ + ПРОДАЖИ
    // ========================================================

    const stocks =
      await loadStocks(
        wbToken,
        currentPeriod
      );


    if (!stocks.response.ok) {

      const retrySeconds =
        parseRetrySeconds(
          stocks.response
        );


      const nextAllowedAt =
        buildNextAllowedAt(
          attemptAt,
          retrySeconds
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
          stocks.response.status,

        retryAfterSeconds:
          retrySeconds
          ??
          COOLDOWN_SECONDS,

        lastMessage:
          stocks.response.status === 429
            ? "Too Many Requests от WB при загрузке остатков и продаж"
            : `Ошибка WB HTTP ${stocks.response.status} при загрузке остатков и продаж`,

        stage:
          stocks.response.status === 429
            ? "rate_limited"
            : "failed",

        lastSnapshotId:
          state?.last_snapshot_id
          ??
          null,

      });


      return NextResponse.json(
        {
          ok:
            false,

          blockedByRateLimit:
            stocks.response.status === 429,

          message:
            stocks.response.status === 429
              ? "Wildberries не разрешил обновить остатки и продажи из-за лимита API"
              : "Wildberries вернул ошибку при загрузке остатков и продаж",

          wbStatus:
            stocks.response.status,

          nextAllowedAt,

          retryAfterSeconds:
            retrySeconds,

          step:
            "stocks-and-sales",

          rateLimit:
            stocks.rateLimit,

          wbResponse:
            stocks.data,
        },
        {
          status:
            stocks.response.status === 429
              ? 429
              : 502,
        }
      );

    }


    if (
      stocks.items.length ===
      0
    ) {

      const nextAllowedAt =
        buildNextAllowedAt(
          attemptAt,
          null
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
          stocks.response.status,

        retryAfterSeconds:
          COOLDOWN_SECONDS,

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

          message:
            "Wildberries ответил успешно, но список товаров в остатках пуст",

          nextAllowedAt,

          step:
            "stocks-and-sales",
        },
        {
          status:
            502,
        }
      );

    }


    if (
      stocks.items.length >=
      PAGE_LIMIT
    ) {

      const nextAllowedAt =
        buildNextAllowedAt(
          attemptAt,
          null
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
          stocks.response.status,

        retryAfterSeconds:
          COOLDOWN_SECONDS,

        lastMessage:
          "Отчёт остатков достиг лимита 1000 строк; нужна отдельная безопасная пагинация",

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

          message:
            "WB вернул 1000 товаров. Синхронизация остановлена, чтобы не нарушить лимит базового токена при пагинации.",

          nextAllowedAt,
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 5. ОТМЕНЫ ИЗ ВОРОНКИ
    // ========================================================

    const funnel =
      await loadCancellations(
        wbToken,
        currentPeriod
      );


    if (!funnel.response.ok) {

      const retrySeconds =
        parseRetrySeconds(
          funnel.response
        );


      const nextAllowedAt =
        buildNextAllowedAt(
          attemptAt,
          retrySeconds
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
          funnel.response.status,

        retryAfterSeconds:
          retrySeconds
          ??
          COOLDOWN_SECONDS,

        lastMessage:
          funnel.response.status === 429
            ? "Too Many Requests от WB при загрузке отмен из Воронки продаж"
            : `Ошибка WB HTTP ${funnel.response.status} при загрузке отмен`,

        stage:
          funnel.response.status === 429
            ? "rate_limited"
            : "failed",

        lastSnapshotId:
          state?.last_snapshot_id
          ??
          null,

      });


      return NextResponse.json(
        {
          ok:
            false,

          blockedByRateLimit:
            funnel.response.status === 429,

          message:
            funnel.response.status === 429
              ? "Остатки и продажи WB были получены, но общий snapshot не сохранён: Воронка продаж не разрешила получить отмены из-за лимита API"
              : "Остатки и продажи WB были получены, но общий snapshot не сохранён: ошибка при загрузке отмен",

          wbStatus:
            funnel.response.status,

          nextAllowedAt,

          retryAfterSeconds:
            retrySeconds,

          step:
            "cancellations",

          rateLimit:
            funnel.rateLimit,

          wbResponse:
            funnel.data,
        },
        {
          status:
            funnel.response.status === 429
              ? 429
              : 502,
        }
      );

    }


    if (
      funnel.products.length >=
      PAGE_LIMIT
    ) {

      const nextAllowedAt =
        buildNextAllowedAt(
          attemptAt,
          null
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
          funnel.response.status,

        retryAfterSeconds:
          COOLDOWN_SECONDS,

        lastMessage:
          "Воронка продаж достигла лимита 1000 товаров; нужна отдельная безопасная пагинация",

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

          message:
            "Воронка WB вернула 1000 товаров. Синхронизация остановлена, чтобы не нарушить лимит базового токена при пагинации.",

          nextAllowedAt,
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 6. MAP CANCELCOUNT ПО NMID
    // ========================================================

    const funnelByNmId =
      new Map<
        number,
        FunnelProduct
      >();


    for (
      const item
      of funnel.products
    ) {

      const nmId =
        Number(
          item?.product?.nmId
        );


      if (
        !Number.isFinite(
          nmId
        )
        ||
        nmId <= 0
      ) {

        continue;

      }


      funnelByNmId.set(
        nmId,
        item
      );

    }


    // ========================================================
    // 7. УБИРАЕМ ДУБЛИ STOCK NMID
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
      of stocks.items
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
    // 8. СОЗДАЁМ ОБЩИЙ SNAPSHOT
    // ========================================================

    const snapshotId =
      makeUuid();


    const snapshotAt =
      new Date()
        .toISOString();


    let currentProductsWithoutFunnelRow =
      0;


    const rows =
      uniqueItems.map(
        (item) => {

          const nmId =
            Number(
              item.nmID
            );


          const metrics =
            item.metrics
            ??
            {};


          const funnelRow =
            funnelByNmId.get(
              nmId
            );


          const selected =
            funnelRow?.statistic?.selected
            ??
            null;


          if (!funnelRow) {

            currentProductsWithoutFunnelRow +=
              1;

          }


          const stockCount =
            Math.max(
              0,
              Number(
                metrics.stockCount
              )
              ||
              0
            );


          const buyoutCount =
            Math.max(
              0,
              Number(
                metrics.buyoutCount
              )
              ||
              0
            );


          const ordersCount =
            Math.max(
              0,
              Number(
                metrics.ordersCount
              )
              ||
              0
            );


          const cancelCount =
            Math.max(
              0,
              Number(
                selected?.cancelCount
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
              nmId,

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

            raw: {

              ...item,

              salesFunnel: {

                source:
                  "/api/analytics/v3/sales-funnel/products",

                selectedPeriod: {
                  start:
                    currentPeriod.start,
                  end:
                    currentPeriod.end,
                },

                cancelCount,

                matched:
                  Boolean(
                    funnelRow
                  ),

                selected:
                  selected,

              },

            },

            _control: {
              buyoutCount,
              ordersCount,
              cancelCount,
            },

          };

        }
      );


    // _control нужен только для расчёта ответа,
    // в таблицу его не пишем.
    const dbRows =
      rows.map(
        ({
          _control,
          ...row
        }) => row
      );


    // ========================================================
    // 9. ЗАПИСЬ SNAPSHOT
    // ========================================================

    const batches =
      splitIntoBatches(
        dbRows,
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


        const nextAllowedAt =
          buildNextAllowedAt(
            attemptAt,
            null
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
            200,

          retryAfterSeconds:
            COOLDOWN_SECONDS,

          lastMessage:
            "WB ответил успешно, но общий snapshot не удалось сохранить",

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

            message:
              "Ошибка записи общего snapshot Wildberries в Supabase",

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

            nextAllowedAt,
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
    // 10. КОНТРОЛЬНЫЕ СУММЫ
    // ========================================================

    const totals =
      rows.reduce(
        (
          acc,
          row
        ) => {

          acc.stockCount +=
            row.stock_count;

          acc.toClientCount +=
            row.to_client_count;

          acc.fromClientCount +=
            row.from_client_count;

          acc.buyoutCount +=
            row._control.buyoutCount;

          acc.ordersCount +=
            row._control.ordersCount;

          acc.cancelCount +=
            row._control.cancelCount;


          if (
            row.stock_count ===
            0
          ) {

            acc.zeroStockSku +=
              1;

          }


          return acc;

        },
        {
          stockCount:
            0,
          buyoutCount:
            0,
          ordersCount:
            0,
          cancelCount:
            0,
          toClientCount:
            0,
          fromClientCount:
            0,
          zeroStockSku:
            0,
        }
      );


    // ========================================================
    // 11. УСПЕХ
    // ========================================================

    const nextAllowedAt =
      addSeconds(
        snapshotAt,
        COOLDOWN_SECONDS
      );


    await saveSyncState({

      lastAttemptAt:
        attemptAt,

      lastSuccessAt:
        snapshotAt,

      nextAllowedAt,

      lastHttpStatus:
        200,

      retryAfterSeconds:
        COOLDOWN_SECONDS,

      lastMessage:
        `Успешно обновлены данные WB: ${savedRows} SKU; продажи ${totals.buyoutCount}; отмены ${totals.cancelCount}`,

      stage:
        "completed",

      lastSnapshotId:
        snapshotId,

    });


    // ========================================================
    // 12. ОТВЕТ
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

      source,

      message:
        "Данные Wildberries успешно обновлены: остатки, продажи и отмены",

      wildberriesRequestSent:
        true,

      nextAllowedAt,

      retryAfterSeconds:
        COOLDOWN_SECONDS,

      previousSnapshot:
        latestSnapshot
          ? {
              snapshotId:
                latestSnapshot.snapshot_id,
              snapshotAt:
                latestSnapshot.snapshot_at,
            }
          : null,

      newSnapshot: {
        snapshotId,
        snapshotAt,
        rows:
          savedRows,
      },

      period: {
        dateFrom:
          currentPeriod.start,
        dateTo:
          currentPeriod.end,
        days:
          28,
      },

      processing: {

        stockRowsReceived:
          stocks.items.length,

        funnelProductsReturned:
          funnel.products.length,

        uniqueSku:
          uniqueItems.length,

        invalidNmIdRows,

        currentProductsWithoutFunnelRow,

        batches:
          batches.length,

      },

      totals,

      wildberries: {

        status:
          200,

        stocks: {
          status:
            stocks.response.status,
          rateLimit:
            stocks.rateLimit,
        },

        funnel: {
          status:
            funnel.response.status,
          rateLimit:
            funnel.rateLimit,
        },

      },

    });

  } catch (
    error
  ) {

    console.error(
      "Ошибка общей синхронизации WB:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Ошибка синхронизации данных Wildberries",

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      {
        status:
          500,
      }
    );

  }

}
