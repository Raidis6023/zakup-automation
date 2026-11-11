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
const MAX_PAGES = 4;
const PAGE_DELAY_MS = 61_000;

type FeedOrder = {
  srid: string;
  nmId: number;
  status: "created" | "buyout" | "cancel" | "return" | "returnDefective";
  isMp: false;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED = new Set(["created", "buyout", "cancel", "return", "returnDefective"]);

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

async function pause(milliseconds: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
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
    || typeof x.createdAt !== "string" || !Number.isFinite(Date.parse(x.createdAt))
    || typeof x.updatedAt !== "string" || !Number.isFinite(Date.parse(x.updatedAt))) {
    throw new Error("WB: ответ Ленты заказов не соответствует документированному формату");
  }
  // FBS records are never persisted in the procurement status ledger.
  if (x.isMp) return null;
  return {
    srid: x.srid, nmId: Number(x.nmId), status: x.status as FeedOrder["status"],
    isMp: false, createdAt: x.createdAt, updatedAt: x.updatedAt,
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
};

/** Refreshes the two last completed Krasnoyarsk days from WB Order Feed. */
export async function syncChinaWbOrderFeed({
  force = false,
}: { force?: boolean } = {}): Promise<ChinaWbFeedSyncResult> {
  const today = dateInKrasnoyarsk();
  const to = dayOffset(today, -1);
  const from = dayOffset(today, -2);
  const db = createAdminClient();
  const { data: previous, error: lastError } = await db
    .from("china_wb_feed_days").select("verified_at,fbw_buyouts,fbw_returns")
    .eq("sale_day", to).maybeSingle();
  if (lastError) throw new Error("Закуп: не удалось прочитать состояние Ленты WB");

  const fresh = previous?.verified_at
    && Date.now() - Date.parse(previous.verified_at) < 4 * 3_600_000;
  if (!force && fresh) {
    const { data: fromDay, error } = await db.from("china_wb_feed_days")
      .select("verified_at,fbw_buyouts,fbw_returns")
      .eq("sale_day", from).maybeSingle();
    if (error) throw new Error("Закуп: не удалось проверить второй день Ленты WB");
    if (fromDay?.verified_at) {
      return {
        ok: true, reused: true, from, to, fbwOrders: 0,
        fbwBuyouts: Number(previous.fbw_buyouts ?? 0) + Number(fromDay.fbw_buyouts ?? 0),
        fbwReturns: Number(previous.fbw_returns ?? 0) + Number(fromDay.fbw_returns ?? 0),
        totalOrders: 0,
      };
    }
  }

  const token = process.env.WB_READ_TOKEN?.trim();
  if (!token) throw new Error("Закуп: токен WB_READ_TOKEN не настроен");

  const { data: acquired, error: beginError } = await db
    .rpc("china_begin_wb_feed_sync");
  if (beginError) throw new Error("Закуп: не удалось захватить блокировку WB");
  if (acquired !== true) {
    throw new Error("Лента WB уже обновляется либо достигнут лимит 1 запрос в минуту. Повторите расчёт позднее.");
  }

  try {
    const snapshotOrders = new Map<string, FeedOrder>();
    let snapshotTime: string | null = null;
    let offset = 0;
    let totalOrders = 0;
    let finished = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await pause(PAGE_DELAY_MS);
      const payload: Record<string, unknown> = {
        selectedPeriod: {
          start: from + "T00:00:00+03:00",
          end: to + "T23:59:59+03:00",
        },
        nmIds: [], subjectIds: [], brandNames: [], tagIds: [],
        pagination: {
          offset, limit: PAGE_LIMIT,
          ...(snapshotTime ? { snapshotTime } : {}),
        },
      };
      const response = await fetch(WB_ORDER_FEED_URL, {
        method: "POST", cache: "no-store",
        headers: {
          Authorization: token, Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Лента WB ограничила частоту запросов. Результат не сохранён."
            : `Лента заказов WB вернула HTTP ${response.status}. Результат не сохранён.`,
        );
      }
      const body = await response.json() as {
        data?: { snapshotTime?: unknown; orders?: unknown };
      };
      const data = body?.data;
      if (!data || typeof data.snapshotTime !== "string"
        || data.snapshotTime.length < 5 || !Array.isArray(data.orders)) {
        throw new Error("WB: отсутствуют маркер снимка или массив заказов");
      }
      if (snapshotTime && snapshotTime !== data.snapshotTime) {
        throw new Error("WB: сменился снимок при пагинации. Не сохраняем неполный результат.");
      }
      snapshotTime = data.snapshotTime;
      const orders = data.orders;
      totalOrders += orders.length;

      const pageSrids = new Set<string>();
      for (const value of orders) {
        const raw = value as Record<string, unknown>;
        if (typeof raw?.srid !== "string" || !raw.srid) {
          throw new Error("WB: строка без srid");
        }
        if (pageSrids.has(raw.srid) || snapshotOrders.has(raw.srid)) {
          throw new Error("WB: повторяющийся srid между страницами");
        }
        pageSrids.add(raw.srid);
        const normalized = asFeedOrder(value);
        if (normalized) snapshotOrders.set(normalized.srid, normalized);
      }
      offset += orders.length;
      if (orders.length < PAGE_LIMIT) {
        finished = true;
        break;
      }
    }
    if (!finished || !snapshotTime) {
      throw new Error("WB: больше страниц, чем безопасно загрузить за один запуск. Неполный снимок не принят.");
    }

    const statuses = [...snapshotOrders.values()];
    const { error: storeError } = await db.rpc("china_store_wb_feed_batch", {
      p_date_from: from, p_date_to: to, p_snapshot: snapshotTime,
      p_orders: statuses, p_total_orders: totalOrders,
    });
    if (storeError) {
      throw new Error("Закуп: не удалось атомарно сохранить статусы WB: " + storeError.message);
    }
    return {
      ok: true, reused: false, from, to,
      fbwOrders: statuses.length,
      fbwBuyouts: statuses.filter((x) => x.status === "buyout").length,
      fbwReturns: statuses.filter((x) => x.status === "return" || x.status === "returnDefective").length,
      totalOrders,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка WB";
    console.error("[CHINA WB ORDER FEED]", message);
    try {
      await db.rpc("china_finish_wb_feed_sync", {
        p_error: message.slice(0, 300),
      });
    } catch {
      // Preserve the original WB error. The database lock has a 6-minute TTL.
    }
    throw error;
  }
}
