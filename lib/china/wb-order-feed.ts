import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Procurement-only, confirmed WB Order Feed statuses.
 * No raw finance payloads and no FBS records are stored.
 * If any WB page is missing, the entire sync fails closed without marking a day verified.
 */
const WB_ORDER_FEED_URL =
  "https://seller-analytics-api.wildberries.ru/api/analytics/v1/order-feed";
const PAGE_LIMIT = 1000;

type FeedOrder = {
  srid: string;
  nmId: number;
  status: "created" | "buyout" | "cancel" | "return" | "returnDefective";
  isMp: false;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED = new Set(["created", "buyout", "cancel", "return", "returnDefective"]);

// WB timestamps may be returned without an explicit offset. Treat such values
// as Moscow-local, never as UTC (otherwise events near midnight shift days).
function normalizedWbTime(value: unknown): string {
  if (typeof value !== "string") throw new Error("WB: статус без даты");
  const source = value.trim().replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(source)
    ? source : source + "+03:00";
  const parsed = Date.parse(withZone);
  if (!Number.isFinite(parsed)) throw new Error("WB: неправильная дата статуса");
  return new Date(parsed).toISOString();
}

function dateInKrasnoyarsk(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Krasnoyarsk",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function dayOffset(day: string, delta: number): string {
  const time = Date.parse(day + "T12:00:00Z") + delta * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

function asFeedOrder(value: unknown): FeedOrder | null {
  if (!value || typeof value !== "object") {
    throw new Error("WB: некорректная строка Ленты заказов");
  }
  const x = value as Record<string, unknown>;
  if (typeof x.srid !== "string" || !x.srid.trim()
    || !Number.isSafeInteger(x.nmId) || Number(x.nmId) <= 0
    || typeof x.status !== "string" || !ALLOWED.has(x.status)
    || typeof x.isMp !== "boolean"
    || typeof x.createdAt !== "string" || typeof x.updatedAt !== "string") {
    throw new Error("WB: ответ Ленты заказов не соответствует документированному формату");
  }
  // FBS records are never persisted in the procurement status ledger.
  if (x.isMp) return null;
  return {
    srid: x.srid, nmId: Number(x.nmId), status: x.status as FeedOrder["status"],
    isMp: false,
    createdAt: normalizedWbTime(x.createdAt),
    updatedAt: normalizedWbTime(x.updatedAt),
  };
}

export type ChinaWbFeedSyncResult = {
  ok: boolean;
  reused: boolean;
  from: string;
  to: string;
  fbwOrders: number;
  fbwBuyouts: number;
  fbwReturns: number;
  totalOrders: number;
  skipped?: boolean;
  retrySeconds?: number;
};


/**
 * Performs at most ONE WB HTTP request, from a scheduled server-only call.
 * Basic WB tokens can be limited to one request per THREE HOURS. Pagination
 * in a single Vercel invocation is not safe under that limit.
 *
 * Fetch the newest unverified day first; confirmed finance covers older dates.
 * Historical finance rows cover older dates. Never mark a day verified unless
 * the entire one-day result fits in a single page (< PAGE_LIMIT).
 */
export async function syncChinaWbOrderFeed(): Promise<ChinaWbFeedSyncResult> {
  const today = dateInKrasnoyarsk();
  const candidates = [-1, -2, -3].map((delta) => dayOffset(today, delta));
  const db = createAdminClient();

  const { data: verified, error: dayError } = await db
    .from("china_wb_feed_days").select("sale_day,verified_at,fbw_buyouts,fbw_returns")
    .in("sale_day", candidates);
  if (dayError) throw new Error("Закуп: не удалось проверить статусы WB");

  const verifiedDays = new Map((verified ?? []).map((x) => [x.sale_day, x]));
  const target = candidates.find((day) => !verifiedDays.has(day));
  if (!target) {
    return {
      ok: true, reused: true, from: candidates[2], to: candidates[0],
      fbwOrders: 0, fbwBuyouts: (verified ?? []).reduce(
        (sum, x) => sum + Number(x.fbw_buyouts ?? 0), 0),
      fbwReturns: (verified ?? []).reduce(
        (sum, x) => sum + Number(x.fbw_returns ?? 0), 0),
      totalOrders: 0,
    };
  }

  const from = target, to = target;
  const token = process.env.WB_READ_TOKEN?.trim();
  if (!token) throw new Error("Закуп: токен WB_READ_TOKEN не настроен");

  const { data: listings, error: listingsError } = await db
    .from("marketplace_listings").select("external_id")
    .eq("account_key", "main").eq("marketplace", "wildberries")
    .eq("is_active", true).eq("china_procurement_enabled", true);
  if (listingsError) throw new Error("Закуп: не удалось получить список товаров WB");

  const nmIds = [...new Set((listings ?? [])
    .map((x) => Number(x.external_id))
    .filter((x) => Number.isSafeInteger(x) && x > 0))];
  if (nmIds.length === 0 || nmIds.length > 1000) {
    throw new Error("Закуп: неверное количество артикулов WB");
  }

  const { data: acquired, error: beginError } = await db
    .rpc("china_begin_wb_feed_sync");
  if (beginError) throw new Error("Закуп: не удалось проверить лимит WB");
  if (acquired !== true) {
    return {
      ok: false, reused: false, skipped: true, from, to,
      fbwOrders: 0, fbwBuyouts: 0, fbwReturns: 0, totalOrders: 0,
    };
  }

  let deferred = false;
  try {
    const response = await fetch(WB_ORDER_FEED_URL, {
      method: "POST", cache: "no-store",
      headers: {
        Authorization: token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        selectedPeriod: {
          start: from + "T00:00:00+03:00",
          end: to + "T23:59:59+03:00",
        },
        nmIds,
        pagination: { offset: 0, limit: PAGE_LIMIT },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 429) {
      // WB documents X-Ratelimit-Retry in seconds. Missing headers must not
      // trigger a tight loop, especially for Basic 1-request/3h tokens.
      const retryHeader = response.headers.get("X-Ratelimit-Retry")
        ?? response.headers.get("Retry-After");
      const parsed = Number(retryHeader);
      const retrySeconds = retryHeader && Number.isFinite(parsed) && parsed > 0
        ? Math.min(10_800, Math.max(70, Math.ceil(parsed) + 15))
        : 10_800;
      const message = "WB 429: лимит Ленты заказов. Следующий запрос не раньше "
        + retrySeconds + " сек.";
      const { error: cooldownError } = await db.rpc(
        "china_defer_wb_feed_sync",
        { p_wait_seconds: retrySeconds, p_error: message },
      );
      if (cooldownError) throw new Error(
        "Закуп: не удалось записать время следующего запроса WB");
      deferred = true;
      console.warn("[CHINA WB ORDER FEED] throttled", {
        retrySeconds, day: target, message,
      });
      return {
        ok: false, reused: false, skipped: true, retrySeconds,
        from, to, fbwOrders: 0, fbwBuyouts: 0, fbwReturns: 0, totalOrders: 0,
      };
    }

    if (!response.ok) {
      throw new Error("Лента WB вернула HTTP " + response.status
        + ". Неполный отчёт не сохранён.");
    }

    const body = await response.json() as {
      data?: { snapshotTime?: unknown; orders?: unknown };
    };
    const data = body?.data;
    if (!data || typeof data.snapshotTime !== "string"
      || data.snapshotTime.length < 5 || !Array.isArray(data.orders)) {
      throw new Error("WB: неполный ответ Ленты заказов");
    }

    if (data.orders.length >= PAGE_LIMIT) {
      // Do not count the first page as a whole day.
      throw new Error("WB: за день более " + PAGE_LIMIT
        + " заказов. Нужна межзапусковая пагинация; данные не сохранены.");
    }

    const normalized: FeedOrder[] = [];
    const seen = new Set<string>();
    for (const item of data.orders) {
      const order = item as Record<string, unknown>;
      if (typeof order?.srid !== "string" || !order.srid
        || seen.has(order.srid)) {
        throw new Error("WB: некорректный или повторяющийся SRID");
      }
      seen.add(order.srid);
      const record = asFeedOrder(item);
      if (record) normalized.push(record);
    }

    const { error: storeError } = await db.rpc("china_store_wb_feed_batch", {
      p_date_from: from,
      p_date_to: to,
      p_snapshot: data.snapshotTime,
      p_orders: normalized,
      p_total_orders: data.orders.length,
    });
    if (storeError) {
      throw new Error("Закуп: не удалось сохранить WB Ленту: "
        + storeError.message);
    }

    return {
      ok: true, reused: false, from, to,
      fbwOrders: normalized.length,
      fbwBuyouts: normalized.filter((x) => x.status === "buyout").length,
      fbwReturns: normalized.filter(
        (x) => x.status === "return" || x.status === "returnDefective").length,
      totalOrders: data.orders.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CHINA WB ORDER FEED]", message);
    if (!deferred) {
      await db.rpc("china_finish_wb_feed_sync", {
        p_error: message.slice(0, 300),
      });
    }
    throw error;
  }
}
