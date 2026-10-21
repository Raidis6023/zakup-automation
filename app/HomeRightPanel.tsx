"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "../lib/supabase/client";

import {
  HomeBellIcon,
  HomeTasksIcon,
} from "./HomeHeaderIcons";

import {
  buildCurrentUserTasks,
  buildPersonalNotes,
  isManagerTaskProfile,
  MANAGER_TASKS,
  PRIVILEGED_TASKS,
  type PersonalNote,
  type TaskItem,
  type TaskRole,
} from "./HomeTasksData";

import {
  dismissSyncNotification,
  loadVisibleSyncNotifications,
  SYNC_NOTIFICATION_DISMISSED_EVENT,
  type SyncNotification,
} from "./SyncNotificationsClient";

import "./HomeRightPanel.css";

type CurrentUserProfileRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  role_name: string;
  has_admin_access: boolean;
  admin_role_name: string | null;
};

type TabId =
  | "all"
  | "notes"
  | TaskRole;


const ADMIN_TABS: Array<{ id: TabId; label: string }> = [
  { id: "all", label: "Все" },
  { id: "notes", label: "Заметки" },
  { id: "administrators", label: "Администраторы" },
  { id: "category_manager", label: "КМ" },
  { id: "ved", label: "ВЭД" },
  { id: "procurement", label: "Закуп" },
  { id: "analyst", label: "Аналитика" },
  { id: "marketing", label: "Маркетинг" },
];

const MANAGER_TABS: Array<{ id: TabId; label: string }> = [
  { id: "all", label: "Все" },
  { id: "notes", label: "Заметки" },
  { id: "category_manager", label: "КМ" },
  { id: "ved", label: "ВЭД" },
  { id: "procurement", label: "Закуп" },
  { id: "analyst", label: "Аналитика" },
  { id: "marketing", label: "Маркетинг" },
];

const BASIC_TABS: Array<{ id: TabId; label: string }> = [
  { id: "all", label: "Все" },
  { id: "notes", label: "Заметки" },
];

function ToggleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}


function SyncSuccessIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="m5.8 12.4 3.7 3.7 8.7-8.9"
      />
    </svg>
  );
}


function StockAlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 4.5 20 19H4Z" />
      <path d="M12 9v4.5" />
      <path d="M12 16.7h.01" />
    </svg>
  );
}


function DismissIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M7 7l10 10"
      />
      <path
        d="M17 7 7 17"
      />
    </svg>
  );
}

export default function HomeRightPanel() {
  const router =
    useRouter();

  const pathname = usePathname() ?? "/";
  const adminHomeMode = pathname === "/admin";

  const [open, setOpen] =
    useState(false);

  const [profile, setProfile] =
    useState<CurrentUserProfileRow | null>(null);

  const [syncNotifications, setSyncNotifications] =
    useState<SyncNotification[]>([]);

  const [
    exitingNotificationIds,
    setExitingNotificationIds,
  ] =
    useState<Set<string>>(
      () =>
        new Set<string>()
    );

  const [notificationsLoading, setNotificationsLoading] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState<TabId>("all");

  useEffect(
    () => {
      setOpen(false);
      setActiveTab("all");
    },
    [pathname]
  );

  useEffect(
    () => {
      let active = true;

      async function loadProfile() {
        try {
          const supabase = createClient();
          const { data } =
            await supabase.rpc(
              "app_get_my_profile"
            );

          if (!active) {
            return;
          }

          const rows =
            Array.isArray(data)
              ? data
              : data
                ? [data]
                : [];

          setProfile(
            (
              rows[0]
              ??
              null
            ) as
              CurrentUserProfileRow
              |
              null
          );
        } catch {
          if (active) {
            setProfile(null);
          }
        }
      }

      void loadProfile();

      return () => {
        active = false;
      };
    },
    []
  );

  useEffect(
    () => {
      function handleToggle() {
        setOpen(current => !current);
      }

      window.addEventListener(
        "workspace-toggle-right-panel",
        handleToggle
      );

      return () => {
        window.removeEventListener(
          "workspace-toggle-right-panel",
          handleToggle
        );
      };
    },
    []
  );


  useEffect(
    () => {
      if (
        !open
      ) {
        return;
      }

      const controller =
        new AbortController();

      async function loadSyncNotifications() {
        setNotificationsLoading(
          true
        );

        try {
          const nextNotifications =
            await loadVisibleSyncNotifications(
              profile
                ?.user_id
              ??
              null,
              controller.signal
            );

          setSyncNotifications(
            nextNotifications
          );
        } catch (
          error
        ) {
          if (
            error instanceof DOMException
            &&
            error.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Не удалось загрузить уведомления синхронизации:",
            error
          );
        } finally {
          if (
            !controller.signal.aborted
          ) {
            setNotificationsLoading(
              false
            );
          }
        }
      }

      void loadSyncNotifications();

      return () => {
        controller.abort();
      };
    },
    [
      open,
      profile
        ?.user_id,
    ]
  );


  useEffect(
    () => {

      function handleDismissedNotification(
        event:
          Event
      ) {

        const customEvent =
          event as
            CustomEvent<{
              notificationId?:
                string;
            }>;


        const notificationId =
          customEvent
            .detail
            ?.notificationId;


        if (
          !notificationId
        ) {

          return;

        }


        setSyncNotifications(
          current =>
            current.filter(
              notification =>
                notification.id !==
                notificationId
            )
        );

      }


      window.addEventListener(
        SYNC_NOTIFICATION_DISMISSED_EVENT,
        handleDismissedNotification
      );


      return () => {

        window.removeEventListener(
          SYNC_NOTIFICATION_DISMISSED_EVENT,
          handleDismissedNotification
        );

      };

    },
    []
  );


  function handleDismissSyncNotification(
    notificationId:
      string
  ) {

    setExitingNotificationIds(
      current => {

        const next =
          new Set(
            current
          );


        next.add(
          notificationId
        );


        return next;

      }
    );


    window.setTimeout(
      () => {

        dismissSyncNotification(
          notificationId,
          profile
            ?.user_id
          ??
          null
        );


        setExitingNotificationIds(
          current => {

            const next =
              new Set(
                current
              );


            next.delete(
              notificationId
            );


            return next;

          }
        );

      },
      280
    );

  }


  const managerMode =
    !adminHomeMode
    && isManagerTaskProfile(profile);

  const tabs =
    adminHomeMode
      ? ADMIN_TABS
      : managerMode
        ? MANAGER_TABS
        : BASIC_TABS;

  useEffect(
    () => {
      if (
        !tabs.some(
          tab => tab.id === activeTab
        )
      ) {
        setActiveTab("all");
      }
    },
    [activeTab, tabs]
  );

  const currentUserTasks =
    useMemo<TaskItem[]>(
      () => buildCurrentUserTasks(profile),
      [profile]
    );

  const personalNotes =
    useMemo<PersonalNote[]>(
      () => buildPersonalNotes(profile),
      [profile]
    );

  const visibleTasks =
    adminHomeMode
      ? PRIVILEGED_TASKS
      : managerMode
        ? MANAGER_TASKS
        : currentUserTasks;

  const filteredTasks =
    activeTab === "all"
      ? visibleTasks
      : activeTab === "notes"
        ? []
        : visibleTasks.filter(
            task => task.role === activeTab
          );

  return (
    <aside
      className={
        [
          "home-right-panel",
          adminHomeMode
            ? "home-right-panel--admin"
            : "home-right-panel--work",
          open
            ? ""
            : "home-right-panel--collapsed",
        ]
          .filter(Boolean)
          .join(" ")
      }
      aria-label="Правая рабочая панель"
    >
      <button
        type="button"
        className="home-right-panel-toggle"
        onClick={
          () => {
            window.dispatchEvent(
              new CustomEvent(
                "workspace-toggle-right-panel"
              )
            );
          }
        }
        aria-label={
          open
            ? "Свернуть правую панель"
            : "Развернуть правую панель"
        }
        title={
          open
            ? "Свернуть панель"
            : "Развернуть панель"
        }
      >
        <ToggleIcon />
      </button>

      <section
        className="
          home-right-panel-section
          home-right-panel-tasks
        "
      >
        <div className="home-right-panel-heading">
          <span className="home-right-panel-heading-icon">
            <HomeTasksIcon />
          </span>
          <strong>Задачи</strong>
        </div>

        <div className="home-right-panel-tabs">
          {
            tabs.map(
              tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    activeTab === tab.id
                      ? "home-right-panel-tab home-right-panel-tab--active"
                      : "home-right-panel-tab"
                  }
                  onClick={
                    () => setActiveTab(tab.id)
                  }
                >
                  {tab.label}
                </button>
              )
            )
          }
        </div>

        <div className="home-right-panel-task-list">
          {
            activeTab === "notes"
              ? personalNotes.map(
                  note => (
                    <div
                      key={note.id}
                      className="
                        home-right-panel-task
                        home-right-panel-task--note
                      "
                    >
                      <div>
                        <strong>{note.title}</strong>
                        <span>Личная заметка</span>
                      </div>
                    </div>
                  )
                )
              : filteredTasks.length > 0
                ? filteredTasks.map(
                    task => (
                      <div
                        key={task.id}
                        className="home-right-panel-task"
                      >
                        <span
                          className={
                            `home-right-panel-status home-right-panel-status--${task.status}`
                          }
                        />
                        <div>
                          <strong>{task.title}</strong>
                          <span>
                            {task.creator}
                            {" → "}
                            {task.assignee}
                          </span>
                        </div>
                      </div>
                    )
                  )
                : (
                  <div className="home-right-panel-empty">
                    В этой категории задач пока нет.
                  </div>
                )
          }
        </div>
      </section>

      <section
        className="
          home-right-panel-section
          home-right-panel-notifications
        "
      >
        <div className="home-right-panel-heading">
          <span className="home-right-panel-heading-icon">
            <HomeBellIcon />
          </span>

          <strong>
            Уведомления
          </strong>
        </div>

        <div
          className=
            "home-sync-notification-list"
        >
          {
            notificationsLoading
            &&
            syncNotifications.length ===
              0
              ? (
                <div
                  className=
                    "home-sync-notification-empty"
                >
                  Загружаем уведомления…
                </div>
              )
              : syncNotifications.length ===
                  0
                ? (
                  <div
                    className=
                      "home-sync-notification-empty"
                  >
                    Уведомлений пока нет.
                  </div>
                )
                : syncNotifications.map(
                    notification => (
                      <div
                        key={
                          notification.id
                        }
                        className={
                          `home-sync-notification ${
                            notification.kind ===
                              "stock_zero"

                              ? "home-sync-notification--alert"

                              : ""
                          } ${
                            exitingNotificationIds.has(
                              notification.id
                            )

                              ? "home-sync-notification--exiting"

                              : ""
                          }`
                        }

                        role="button"
                        tabIndex={0}

                        onClick={
                          () =>
                            router.push(
                              notification.href
                            )
                        }

                        onKeyDown={
                          event => {

                            if (
                              event.key ===
                                "Enter"
                              ||
                              event.key ===
                                " "
                            ) {

                              event.preventDefault();

                              router.push(
                                notification.href
                              );

                            }

                          }
                        }
                      >
                        <span
                          className={
                            notification.kind ===
                              "stock_zero"

                              ? "home-sync-notification-icon home-sync-notification-icon--alert"

                              : "home-sync-notification-icon"
                          }
                        >
                          {
                            notification.kind ===
                              "stock_zero"

                              ? <StockAlertIcon />

                              : <SyncSuccessIcon />
                          }
                        </span>

                        <div
                          className=
                            "home-sync-notification-copy"
                        >
                          <strong>
                            {
                              notification.title
                            }
                          </strong>

                          <span>
                            {
                              notification.description
                            }
                          </span>
                        </div>

                        <div
                          className=
                            "home-sync-notification-meta"
                        >
                          <button
                            type="button"

                            className=
                              "home-sync-notification-dismiss"

                            onClick={
                              event => {

                                event.stopPropagation();

                                handleDismissSyncNotification(
                                  notification.id
                                );

                              }
                            }

                            onKeyDown={
                              event => {

                                event.stopPropagation();

                              }
                            }

                            aria-label=
                              "Убрать уведомление"

                            title=
                              "Убрать уведомление"
                          >
                            <DismissIcon />
                          </button>

                          <time
                            className=
                              "home-sync-notification-time"

                            dateTime={
                              notification.notificationAt
                            }
                          >
                            {
                              notification.notificationDisplay
                            }
                          </time>
                        </div>
                      </div>
                    )
                  )
          }
        </div>
      </section>
    </aside>
  );
}
