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
  buildCreatedByMeWorkspaceTasks,
  buildAdminActiveWorkspaceTasks,
  buildAdminUnacceptedWorkspaceTasks,
  buildMyWorkspaceTasks,
  buildPersonalNotes,
  buildUnacceptedWorkspaceTasks,
  type PersonalNote,
  type TaskItem,
} from "./HomeTasksData";

import {
  dismissSyncNotification,
  loadVisibleSyncNotifications,
  SYNC_NOTIFICATION_DISMISSED_EVENT,
  type SyncNotification,
} from "./SyncNotificationsClient";

import "./HomeRightPanel.css";
import useWorkspaceTasks from "./useWorkspaceTasks";

type CurrentUserProfileRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  role_name: string;
  has_admin_access: boolean;
  admin_role_name: string | null;
};

type TabId = "my" | "unaccepted" | "created" | "notes" | "admin" | "active";

const TASK_TABS: Array<{ id: TabId; label: string }> = [
  { id: "my", label: "Мои" },
  { id: "unaccepted", label: "Непринятые" },
  { id: "created", label: "Поставленные мной" },
  { id: "notes", label: "Заметки" },
  { id: "admin", label: "Админ" },
];
const ADMIN_TASK_TABS: Array<{ id: TabId; label: string }> = [
  { id: "active", label: "Активные" },
  { id: "unaccepted", label: "Непринятые" },
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
      <path
        className="stock-alert-triangle"
        d="M12 4 20.2 19H3.8Z"
      />
      <path
        className="stock-alert-mark"
        d="M12 9v4.5"
      />
      <circle
        className="stock-alert-dot"
        cx="12"
        cy="16.25"
        r="1.15"
      />
    </svg>
  );
}

function TaskCancelledIcon() {
  return <span className="home-task-cancelled-stop">STOP</span>;
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

  const {
    snapshot: workspaceTaskSnapshot,
    loading: workspaceTasksLoading,
    error: workspaceTasksError,
  } = useWorkspaceTasks(adminHomeMode ? "admin" : "work");

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
    useState<TabId>("my");

  const [busyTaskIds, setBusyTaskIds] =
    useState<Set<string>>(() => new Set());

  const [taskActionError, setTaskActionError] =
    useState<string | null>(null);

  useEffect(
    () => {
      setOpen(false);
      setActiveTab(adminHomeMode ? "active" : "my");
    },
    [pathname, adminHomeMode]
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

      const supabase = createClient();
      const taskNotificationChannel = profile?.user_id
        ? supabase
            .channel(`workspace-task-notifications-panel-${profile.user_id}`)
            .on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "workspace_task_notifications",
                filter: `recipient_id=eq.${profile.user_id}`,
              },
              () => {
                void loadSyncNotifications();
              }
            )
            .subscribe()
        : null;

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
        if (taskNotificationChannel) {
          void supabase.removeChannel(taskNotificationChannel);
        }
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


  async function handleTaskAction(task: TaskItem) {
    if (!task.action || busyTaskIds.has(task.id)) return;

    setBusyTaskIds(current => new Set(current).add(task.id));
    setTaskActionError(null);

    try {
      const actionMode = adminHomeMode || activeTab === "admin" ? "admin" : "work";
      const { error } = await createClient().rpc("workspace_task_action_v2", {
        p_mode: actionMode,
        p_action: task.action,
        p_payload: { id: task.id },
      });

      if (error) throw error;

      if (task.action === "take") {
        setActiveTab(actionMode === "admin"
          ? (adminHomeMode ? "active" : "admin")
          : "my");
      }

      window.dispatchEvent(new CustomEvent("workspace-tasks-updated"));
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Не удалось изменить задачу";

      setTaskActionError(
        message.toLowerCase().includes("уже взята")
          ? "Эту задачу уже взял другой сотрудник. Список обновлён."
          : message
      );

      // Refresh even on a conflict: another employee may have won the race.
      window.dispatchEvent(new CustomEvent("workspace-tasks-updated"));
    } finally {
      setBusyTaskIds(current => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  const tabs = adminHomeMode
    ? ADMIN_TASK_TABS
    : TASK_TABS.filter(tab => tab.id !== "admin" || workspaceTaskSnapshot?.is_admin);
  const adminTasksCount = (workspaceTaskSnapshot?.admin_tasks ?? []).filter(
    task => task.status === "not_started" || task.status === "in_progress"
  ).length;

  const myTasks = useMemo<TaskItem[]>(
    () => buildMyWorkspaceTasks(workspaceTaskSnapshot),
    [workspaceTaskSnapshot]
  );
  const unacceptedTasks = useMemo<TaskItem[]>(
    () => buildUnacceptedWorkspaceTasks(workspaceTaskSnapshot),
    [workspaceTaskSnapshot]
  );
  const createdTasks = useMemo<TaskItem[]>(
    () => buildCreatedByMeWorkspaceTasks(workspaceTaskSnapshot),
    [workspaceTaskSnapshot]
  );
  const personalNotes = useMemo<PersonalNote[]>(
    () => buildPersonalNotes(workspaceTaskSnapshot),
    [workspaceTaskSnapshot]
  );
  const adminActiveTasks = useMemo<TaskItem[]>(
    () => buildAdminActiveWorkspaceTasks(workspaceTaskSnapshot),
    [workspaceTaskSnapshot]
  );
  const adminUnacceptedTasks = useMemo<TaskItem[]>(
    () => buildAdminUnacceptedWorkspaceTasks(workspaceTaskSnapshot),
    [workspaceTaskSnapshot]
  );

  const filteredTasks = adminHomeMode
    ? (activeTab === "active" ? adminActiveTasks : adminUnacceptedTasks)
    : activeTab === "admin"
      ? adminUnacceptedTasks
      : activeTab === "my"
        ? myTasks
        : activeTab === "unaccepted"
          ? unacceptedTasks
          : createdTasks;

  const emptyMessage = adminHomeMode
    ? (activeTab === "active"
        ? "Активных задач отдела администрирования пока нет."
        : "Непринятых задач отдела администрирования пока нет.")
    : activeTab === "admin"
      ? "Непринятых задач администрирования нет."
      : activeTab === "my"
        ? "Задач, взятых вами в работу, пока нет."
        : activeTab === "unaccepted"
          ? "Непринятых задач для вашего отдела нет."
          : "Вы пока не поставили задач другим отделам.";

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
                  {tab.id === "admin" && (
                    <span className="home-right-panel-admin-count" aria-label={`Всего незавершённых задач: ${adminTasksCount}`}>
                      {adminTasksCount}
                    </span>
                  )}
                </button>
              )
            )
          }
        </div>

        {taskActionError && (
          <div className="home-right-panel-task-error" role="alert">
            {taskActionError}
          </div>
        )}

        <div className="home-right-panel-task-list">
          {
            workspaceTasksLoading && !workspaceTaskSnapshot
              ? (
                <div className="home-right-panel-empty">
                  Загружаем задачи…
                </div>
              )
              : workspaceTasksError && !workspaceTaskSnapshot
                ? (
                  <div className="home-right-panel-empty">
                    Не удалось загрузить задачи.
                  </div>
                )
                : activeTab === "notes"
                  ? personalNotes.length > 0
                    ? personalNotes.map(note => (
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
                      ))
                    : (
                      <div className="home-right-panel-empty">
                        Заметок пока нет.
                      </div>
                    )
                  : filteredTasks.length > 0
                    ? filteredTasks.map(task => (
                        <div
                          key={task.id}
                          className="home-right-panel-task"
                        >
                          <span
                            className={
                              `home-right-panel-status home-right-panel-status--${task.dotColor}`
                            }
                          />
                          <div className="home-right-panel-task-copy">
                            <strong>{task.title}</strong>
                            <span>
                              {task.creator}
                              {" → "}
                              {task.assignee}
                            </span>
                          </div>
                          <button
                            type="button"
                            className={
                              `home-right-panel-task-action home-right-panel-task-action--${task.action}`
                            }
                            disabled={busyTaskIds.has(task.id)}
                            onClick={() => void handleTaskAction(task)}
                          >
                            {
                              busyTaskIds.has(task.id)
                                ? "..."
                                : task.action === "take"
                                  ? "Взять в работу"
                                  : task.action === "finish"
                                    ? "Завершить"
                                    : "Отменить"
                            }
                          </button>
                        </div>
                      ))
                    : (
                      <div className="home-right-panel-empty">
                        {emptyMessage}
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
                            notification.kind === "stock_zero"
                              || notification.kind === "task_cancelled"

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
                            notification.kind === "task_cancelled"
                              ? "home-sync-notification-icon home-sync-notification-icon--task-cancelled"
                              : notification.kind === "stock_zero"
                                ? "home-sync-notification-icon home-sync-notification-icon--alert"
                                : "home-sync-notification-icon"
                          }
                        >
                          {
                            notification.kind === "task_cancelled"
                              ? <TaskCancelledIcon />
                              : notification.kind === "stock_zero"
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
