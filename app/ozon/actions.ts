"use server";

import { revalidatePath } from "next/cache";
import { POST as runExistingOzonDailySync } from "../api/ozon/daily-sync/route";
import { GET as getOzonSyncStates } from "../api/ozon-sync-state/route";

type StateRow = {
  nextAllowedAt?: string | null;
  lastHttpStatus?: number | null;
};

type SyncState = {
  ok?: boolean;
  stocks?: StateRow;
  sales?: StateRow;
};

type DailyResponse = {
  ok?: boolean;
  error?: string;
  attention_required?: boolean;
  write_succeeded?: boolean;
  replenishment?: { succeeded?: boolean; error?: string | null };
  dates?: {
    sales_date_from?: string;
    sales_date_to?: string;
    stock_snapshot_date?: string;
  };
};

export type OzonManualSyncResult = {
  ok: boolean;
  message: string;
  warning?: string;
  period?: string;
};

// Daily Vercel cron runs at 22:00 UTC. Avoid an overlapping manual run.
function cronIsReserved(now: Date) {
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minute >= 21 * 60 + 55 && minute < 22 * 60 + 10;
}

export async function refreshAllOzonData(): Promise<OzonManualSyncResult> {
  if (cronIsReserved(new Date())) {
    return { ok: false, message: "Сейчас работает окно ежедневного обновления Ozon. Повторите попытку после 05:10 по Красноярску." };
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, message: "Сервер не настроен: отсутствует CRON_SECRET." };
  }

  // Recheck both rate limits on the server, not only in the browser.
  try {
    const response = await getOzonSyncStates();
    if (!response.ok) {
      return { ok: false, message: "Не удалось проверить лимиты Ozon. Обновление не запущено." };
    }
    const state = await response.json() as SyncState;
    if (state.ok !== true) {
      return { ok: false, message: "Состояние синхронизации Ozon сейчас недоступно. Попробуйте позже." };
    }

    const now = Date.now();
    for (const [label, row] of [["остатков", state.stocks], ["продаж", state.sales]] as const) {
      if (!row) continue;
      const allowedAt = row.nextAllowedAt ? Date.parse(row.nextAllowedAt) : NaN;
      if (Number.isFinite(allowedAt) && allowedAt > now) {
        const date = new Date(allowedAt).toLocaleString("ru-RU", { timeZone: "Asia/Krasnoyarsk" });
        return { ok: false, message: `Лимит обновления ${label} ещё действует до ${date} (Красноярск). Запрос не отправлен.` };
      }
      if (row.lastHttpStatus === 429 && !row.nextAllowedAt) {
        return { ok: false, message: `Ozon ограничил запросы ${label}, точное время снятия лимита неизвестно. Обновление не запущено.` };
      }
    }
  } catch {
    return { ok: false, message: "Не удалось проверить состояние Ozon. Обновление не запущено." };
  }

  try {
    // Reuse the same atomic sync as the unchanged Vercel cron. CRON_SECRET
    // is created only on the server and never sent to the browser.
    const request = new Request("http://internal/api/ozon/daily-sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const response = await runExistingOzonDailySync(request);
    const result = await response.json() as DailyResponse;

    if (!response.ok || result.ok !== true) {
      return {
        ok: false,
        message: result.write_succeeded
          ? "Продажи и остатки сохранены, но возникла ошибка после записи. Проверьте данные."
          : "Синхронизация не завершена. Данные не были записаны частично.",
        warning: result.error,
      };
    }

    revalidatePath("/ozon");
    return {
      ok: true,
      message: "Продажи и остатки Ozon успешно обновлены.",
      period: result.dates?.sales_date_from && result.dates.sales_date_to
        ? `${result.dates.sales_date_from} – ${result.dates.sales_date_to}`
        : undefined,
      warning: result.attention_required
        ? `Данные сохранены, но расчёт FBO требует проверки: ${result.replenishment?.error ?? "не завершён"}`
        : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      message: "Не удалось завершить обновление Ozon. Проверьте состояние данных перед повторным запуском.",
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}
