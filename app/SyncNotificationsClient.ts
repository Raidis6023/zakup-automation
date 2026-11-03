export type SyncNotificationKind =
  | "sync_success"
  | "stock_zero"
  | "task_cancelled";


import { createClient } from "../lib/supabase/client";

export type SyncNotification = {
  id:
    string;

  kind:
    SyncNotificationKind;

  marketplace:
    | "ozon"
    | "wildberries"
    | "yandex_market"
    | null;

  marketplaceLabel:
    string;

  title:
    string;

  completedAt:
    string;

  notificationAt:
    string;

  dataDate:
    string;

  updateTime:
    string;

  notificationTime:
    string;

  notificationDisplay:
    string;

  description:
    string;

  href:
    string;
};


const STORAGE_PREFIX =
  "workspace-dismissed-sync-notifications";


export const SYNC_NOTIFICATION_DISMISSED_EVENT =
  "workspace-sync-notification-dismissed";


function getStorageKey(
  userId?:
    string | null
) {

  return `${STORAGE_PREFIX}:${userId ?? "anonymous"}`;

}


export function getDismissedSyncNotificationIds(
  userId?:
    string | null
) {

  if (
    typeof window ===
      "undefined"
  ) {

    return new Set<string>();

  }


  try {

    const raw =
      window.localStorage.getItem(
        getStorageKey(
          userId
        )
      );


    if (
      !raw
    ) {

      return new Set<string>();

    }


    const parsed =
      JSON.parse(
        raw
      );


    return new Set<string>(
      Array.isArray(
        parsed
      )

        ? parsed.filter(
            value =>
              typeof value ===
              "string"
          )

        : []
    );

  } catch {

    return new Set<string>();

  }

}


export function dismissSyncNotification(
  notificationId:
    string,

  userId?:
    string | null
) {

  if (
    typeof window ===
      "undefined"
  ) {

    return;

  }


  const dismissed =
    getDismissedSyncNotificationIds(
      userId
    );


  dismissed.add(
    notificationId
  );


  try {

    window.localStorage.setItem(
      getStorageKey(
        userId
      ),
      JSON.stringify(
        Array.from(
          dismissed
        )
      )
    );

  } catch {

    // Local storage may be unavailable in restrictive browser modes.
  }


  window.dispatchEvent(
    new CustomEvent(
      SYNC_NOTIFICATION_DISMISSED_EVENT,
      {
        detail: {
          notificationId,
          userId:
            userId
            ??
            null,
        },
      }
    )
  );

}


export async function loadVisibleSyncNotifications(
  userId?: string | null,
  signal?: AbortSignal
): Promise<SyncNotification[]> {
  const notifications: SyncNotification[] = [];

  try {
    const response = await fetch("/api/home/sync-notifications", {
      method: "GET",
      cache: "no-store",
      signal,
    });

    if (response.ok) {
      const data = await response.json() as {
        ok?: boolean;
        notifications?: SyncNotification[];
      };

      if (data.ok === true && Array.isArray(data.notifications)) {
        notifications.push(...data.notifications);
      }
    }
  } catch (cause) {
    if (signal?.aborted) throw cause;
  }

  if (signal?.aborted) {
    throw new DOMException("Загрузка уведомлений отменена", "AbortError");
  }

  try {
    const { data, error } = await createClient()
      .rpc("workspace_task_notifications_snapshot");

    if (!error && Array.isArray(data)) {
      const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Asia/Krasnoyarsk",
        day: "2-digit",
        month: "2-digit",
      });
      const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Asia/Krasnoyarsk",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      for (const row of data as Array<{
        id: string;
        kind: "task_cancelled";
        title: string;
        description: string;
        href: string;
        notificationAt: string;
      }>) {
        const createdAt = row.notificationAt;
        const date = new Date(createdAt);
        if (!row.id || Number.isNaN(date.getTime())) continue;

        const time = timeFormatter.format(date);
        notifications.push({
          id: row.id,
          kind: "task_cancelled",
          marketplace: null,
          marketplaceLabel: "Задачи",
          title: row.title || "Задача отменена",
          completedAt: createdAt,
          notificationAt: createdAt,
          dataDate: dateFormatter.format(date),
          updateTime: time,
          notificationTime: time,
          notificationDisplay: time,
          description: row.description,
          href: row.href || "/tasks",
        });
      }
    }
  } catch (cause) {
    if (signal?.aborted) throw cause;
    console.error("Не удалось загрузить уведомления об отменённых задачах:", cause);
  }

  const dismissed = getDismissedSyncNotificationIds(userId);

  return notifications
    .filter(notification => !dismissed.has(notification.id))
    .sort((left, right) =>
      new Date(right.notificationAt).getTime()
      - new Date(left.notificationAt).getTime()
    );
}
