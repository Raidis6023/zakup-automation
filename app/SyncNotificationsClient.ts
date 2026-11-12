import { createClient } from "../lib/supabase/client";

export type SyncNotificationKind =
  | "sync_success" | "stock_zero" | "task_cancelled"
  | "system_notice" | "sync_failure" | "note_reminder"
  | "task_created" | "task_taken" | "task_completed" | "access_changed";

export type SyncNotification = {
  id: string;
  kind: SyncNotificationKind;
  marketplace: "ozon" | "wildberries" | "yandex_market" | null;
  marketplaceLabel: string;
  title: string;
  completedAt: string;
  notificationAt: string;
  dataDate: string;
  updateTime: string;
  notificationTime: string;
  notificationDisplay: string;
  description: string;
  href: string;
  unread?: boolean;
  severity?: "info" | "warning" | "critical";
};

const STORAGE_PREFIX = "workspace-dismissed-sync-notifications";
export const SYNC_NOTIFICATION_DISMISSED_EVENT = "workspace-sync-notification-dismissed";
const getStorageKey = (id?: string | null) => STORAGE_PREFIX + ":" + (id ?? "anonymous");

export function getDismissedSyncNotificationIds(userId?: string | null): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch { return new Set(); }
}

function isServerNotification(id: string) {
  return /^server:[0-9a-f-]{36}$/i.test(id);
}

/** Server-side read state follows the user across devices. */
export function markSyncNotificationRead(id: string) {
  if (!isServerNotification(id)) return;
  void createClient().rpc("app_notification_action", {
    p_id: id.slice("server:".length),
    p_action: "read",
  }).then(({ error }) => {
    if (error) console.error("Не удалось отметить уведомление прочитанным:", error.message);
  });
}

export function dismissSyncNotification(notificationId: string, userId?: string | null) {
  if (typeof window === "undefined") return;
  // Persist personal notification state in Supabase, not only localStorage.
  if (isServerNotification(notificationId)) {
    void createClient().rpc("app_notification_action", {
      p_id: notificationId.slice("server:".length),
      p_action: "dismiss",
    }).then(({ error }) => {
      if (error) console.error("Не удалось скрыть уведомление:", error.message);
    });
  }
  const dismissed = getDismissedSyncNotificationIds(userId);
  dismissed.add(notificationId);
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(Array.from(dismissed)));
  } catch { /* Storage may be blocked. */ }
  window.dispatchEvent(new CustomEvent(SYNC_NOTIFICATION_DISMISSED_EVENT, {
    detail: { notificationId, userId: userId ?? null },
  }));
}

type ServerNotification = {
  id: string;
  kind: string;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  href: string;
  created_at: string;
  read_at: string | null;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Krasnoyarsk", day: "2-digit", month: "2-digit",
  }).format(new Date(iso));
}
function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Krasnoyarsk", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export async function loadVisibleSyncNotifications(
  userId?: string | null, signal?: AbortSignal
): Promise<SyncNotification[]> {
  const items: SyncNotification[] = [];
  const client = createClient();

  // Existing successful marketplace snapshots continue to work during migration.
  try {
    const response = await fetch("/api/home/sync-notifications", {
      cache: "no-store", method: "GET", signal,
    });
    if (response.ok) {
      const data: { ok?: boolean; notifications?: SyncNotification[] } = await response.json();
      if (data.ok && Array.isArray(data.notifications)) items.push(...data.notifications);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  if (signal?.aborted) throw new DOMException("Загрузка отменена", "AbortError");

  try {
    const { data, error } = await client.rpc("app_notifications_snapshot", { p_limit: 80 });
    if (error) throw error;
    for (const row of (Array.isArray(data) ? data : []) as ServerNotification[]) {
      if (!row.id || !row.created_at || Number.isNaN(Date.parse(row.created_at))) continue;
      // The interactive access-request card still comes from the existing
      // approval flow. Do not show the same pending request twice.
      if (row.kind === "access_request") continue;
      const at = row.created_at;
      const time = formatTime(at);
      const kind: SyncNotificationKind =
        row.kind === "task_cancelled" ? "task_cancelled"
        : row.kind === "sync_failure" ? "sync_failure"
        : row.kind === "note_reminder" ? "note_reminder"
        : row.kind === "task_created" ? "task_created"
        : row.kind === "task_taken" ? "task_taken"
        : row.kind === "task_completed" ? "task_completed"
        : row.kind === "access_changed" ? "access_changed"
        : "system_notice";
      items.push({
        id: "server:" + row.id, kind, marketplace: null,
        marketplaceLabel: row.category === "tasks" ? "Задачи"
          : row.category === "sync" ? "Синхронизации"
          : row.category === "notes" ? "Заметки"
          : "Система",
        title: row.title, description: row.body,
        completedAt: at, notificationAt: at, dataDate: formatDate(at),
        updateTime: time, notificationTime: time, notificationDisplay: time,
        href: row.href?.startsWith("/") && !row.href.startsWith("//") ? row.href : "/",
        unread: !row.read_at, severity: row.severity,
      });
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error("Не удалось загрузить персональные уведомления:", error);
  }
  const dismissed = getDismissedSyncNotificationIds(userId);
  return items.filter(item => !dismissed.has(item.id))
    .sort((a,b) => Date.parse(b.notificationAt) - Date.parse(a.notificationAt));
}
