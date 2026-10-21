export type SyncNotification = {
  id:
    string;

  marketplace:
    "ozon"
    | "wildberries"
    | "yandex_market";

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
  userId?:
    string | null,

  signal?:
    AbortSignal
):
Promise<SyncNotification[]> {

  const response =
    await fetch(
      "/api/home/sync-notifications",
      {
        method:
          "GET",

        cache:
          "no-store",

        signal,
      }
    );


  const data =
    await response.json() as {
      ok?:
        boolean;

      notifications?:
        SyncNotification[];
    };


  if (
    !response.ok
    ||
    data.ok !==
      true
  ) {

    return [];

  }


  const dismissed =
    getDismissedSyncNotificationIds(
      userId
    );


  return (
    Array.isArray(
      data.notifications
    )

      ? data.notifications

      : []
  ).filter(
    notification =>
      !dismissed.has(
        notification.id
      )
  );

}
