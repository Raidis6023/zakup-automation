"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createClient,
} from "../lib/supabase/client";

import "./HomeRightPanel.css";


type CurrentUserProfileRow = {
  first_name:
    string;

  last_name:
    string;

  role_name:
    string;

  has_admin_access:
    boolean;

  admin_role_name:
    string | null;
};


type TaskRole =
  | "category_manager"
  | "ved"
  | "procurement"
  | "analyst"
  | "marketing";


type TaskStatus =
  | "red"
  | "yellow"
  | "green";


type TaskItem = {
  id:
    string;

  title:
    string;

  creator:
    string;

  assignee:
    string;

  role:
    TaskRole;

  status:
    TaskStatus;
};


type TabId =
  | "all"
  | "notes"
  | TaskRole;


const STORAGE_KEY =
  "workspace-home-right-panel-open";


const PRIVILEGED_TABS: Array<{
  id:
    TabId;

  label:
    string;
}> = [
  {
    id:
      "all",
    label:
      "Все",
  },
  {
    id:
      "notes",
    label:
      "Заметки",
  },
  {
    id:
      "category_manager",
    label:
      "КМ",
  },
  {
    id:
      "ved",
    label:
      "ВЭД",
  },
  {
    id:
      "procurement",
    label:
      "Закуп",
  },
  {
    id:
      "analyst",
    label:
      "Аналитика",
  },
  {
    id:
      "marketing",
    label:
      "Маркетинг",
  },
];


const BASIC_TABS: Array<{
  id:
    TabId;

  label:
    string;
}> = [
  {
    id:
      "all",
    label:
      "Все",
  },
  {
    id:
      "notes",
    label:
      "Заметки",
  },
];


const PRIVILEGED_TASKS:
TaskItem[] = [
  {
    id:
      "task-1",
    title:
      "Проверить расчёт по новому товару",
    creator:
      "Анна Волкова",
    assignee:
      "Мария Соколова",
    role:
      "ved",
    status:
      "red",
  },
  {
    id:
      "task-2",
    title:
      "Подтвердить заказ поставщику",
    creator:
      "Илья Петров",
    assignee:
      "Алексей Орлов",
    role:
      "procurement",
    status:
      "yellow",
  },
  {
    id:
      "task-3",
    title:
      "Согласовать цену на товар",
    creator:
      "Елена Смирнова",
    assignee:
      "Олег Крылов",
    role:
      "analyst",
    status:
      "yellow",
  },
  {
    id:
      "task-4",
    title:
      "Проверить карточки новой категории",
    creator:
      "Алексей Орлов",
    assignee:
      "Мария Соколова",
    role:
      "category_manager",
    status:
      "green",
  },
  {
    id:
      "task-5",
    title:
      "Подготовить материалы для акции",
    creator:
      "Мария Соколова",
    assignee:
      "Елена Смирнова",
    role:
      "marketing",
    status:
      "green",
  },
];


function TasksPanelIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="2"
      />


      <path
        d="m8 8 1.5 1.5L12 7"
      />


      <path
        d="M13.5 8H16"
      />


      <path
        d="m8 13 1.5 1.5L12 12"
      />


      <path
        d="M13.5 13H16"
      />

    </svg>

  );

}


function BellIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
      />


      <path
        d="M10 21h4"
      />

    </svg>

  );

}


function ToggleIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="m9 6 6 6-6 6"
      />
    </svg>

  );

}


function getFullName(
  profile:
    CurrentUserProfileRow | null
) {

  if (
    !profile
  ) {

    return "Текущий сотрудник";

  }


  const value =
    [
      profile.first_name,
      profile.last_name,
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      )
      .trim();


  return value
    ||
    "Текущий сотрудник";

}


function isManager(
  profile:
    CurrentUserProfileRow | null
) {

  const role =
    profile
      ?.role_name
      ?.trim()
      .toLowerCase()
    ||
    "";


  return (
    role ===
      "руководитель"
    ||
    role.startsWith(
      "руководитель "
    )
  );

}


export default function HomeRightPanel() {

  const [
    open,
    setOpen,
  ] =
    useState(
      true
    );


  const [
    profile,
    setProfile,
  ] =
    useState<
      CurrentUserProfileRow | null
    >(
      null
    );


  const [
    activeTab,
    setActiveTab,
  ] =
    useState<TabId>(
      "all"
    );


  useEffect(
    () => {

      try {

        const saved =
          window
            .localStorage
            .getItem(
              STORAGE_KEY
            );


        if (
          saved ===
          "0"
        ) {

          setOpen(
            false
          );

        }

      } catch {

        // Панель просто останется открытой.

      }

    },
    []
  );


  useEffect(
    () => {

      let active =
        true;


      async function loadProfile() {

        try {

          const supabase =
            createClient();


          const {
            data,
          } =
            await supabase
              .rpc(
                "app_get_my_profile"
              );


          if (
            !active
          ) {

            return;

          }


          const rows =
            Array.isArray(
              data
            )

              ? data

              : data

                ? [
                    data,
                  ]

                : [];


          setProfile(
            (
              rows[
                0
              ]
              ??
              null
            ) as
              CurrentUserProfileRow
              |
              null
          );

        } catch {

          if (
            active
          ) {

            setProfile(
              null
            );

          }

        }

      }


      void loadProfile();


      return () => {

        active =
          false;

      };

    },
    []
  );


  useEffect(
    () => {

      function handleToggle() {

        setOpen(
          current => {

            const next =
              !current;


            try {

              window
                .localStorage
                .setItem(
                  STORAGE_KEY,
                  next
                    ? "1"
                    : "0"
                );

            } catch {

              // localStorage здесь не критичен.

            }


            window.dispatchEvent(
              new CustomEvent(
                "workspace-right-panel-state",
                {
                  detail: {
                    open:
                      next,
                  },
                }
              )
            );


            return next;

          }
        );

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

      window.dispatchEvent(
        new CustomEvent(
          "workspace-right-panel-state",
          {
            detail: {
              open,
            },
          }
        )
      );

    },
    [
      open,
    ]
  );


  const privileged =
    Boolean(
      profile
        ?.has_admin_access
    )
    ||
    isManager(
      profile
    );


  const tabs =
    privileged

      ? PRIVILEGED_TABS

      : BASIC_TABS;


  useEffect(
    () => {

      if (
        !tabs.some(
          tab =>
            tab.id ===
            activeTab
        )
      ) {

        setActiveTab(
          "all"
        );

      }

    },
    [
      activeTab,
      tabs,
    ]
  );


  const currentUserName =
    getFullName(
      profile
    );


  const basicTasks =
    useMemo<TaskItem[]>(
      () => [
        {
          id:
            "basic-task-1",
          title:
            "Проверить расчёт по новому товару",
          creator:
            "Анна Волкова",
          assignee:
            currentUserName,
          role:
            "ved",
          status:
            "red",
        },
        {
          id:
            "basic-task-2",
          title:
            "Подтвердить данные перед отправкой",
          creator:
            "Илья Петров",
          assignee:
            currentUserName,
          role:
            "procurement",
          status:
            "yellow",
        },
        {
          id:
            "basic-task-3",
          title:
            "Проверить изменения по товару",
          creator:
            "Мария Соколова",
          assignee:
            currentUserName,
          role:
            "analyst",
          status:
            "green",
        },
      ],
      [
        currentUserName,
      ]
    );


  const visibleTasks =
    privileged

      ? PRIVILEGED_TASKS

      : basicTasks;


  const filteredTasks =
    activeTab ===
      "all"

      ? visibleTasks

      : activeTab ===
          "notes"

        ? []

        : visibleTasks.filter(
            task =>
              task.role ===
              activeTab
          );


  return (

    <aside
      className={
        open

          ? "home-right-panel"

          : "home-right-panel home-right-panel--collapsed"
      }

      aria-label=
        "Правая рабочая панель"
    >

      <button
        type="button"

        className=
          "home-right-panel-toggle"

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
        className=
          "home-right-panel-section home-right-panel-tasks"
      >

        <div
          className=
            "home-right-panel-heading"
        >

          <span
            className=
              "home-right-panel-avatar"
          >
            <TasksPanelIcon />
          </span>


          <strong>
            Задачи
          </strong>

        </div>


        <div
          className=
            "home-right-panel-tabs"
        >

          {
            tabs.map(
              tab => (

                <button
                  key={
                    tab.id
                  }

                  type="button"

                  className={
                    activeTab ===
                      tab.id

                      ? "home-right-panel-tab home-right-panel-tab--active"

                      : "home-right-panel-tab"
                  }

                  onClick={
                    () =>
                      setActiveTab(
                        tab.id
                      )
                  }
                >
                  {
                    tab.label
                  }
                </button>

              )
            )
          }

        </div>


        <div
          className=
            "home-right-panel-task-list"
        >

          {
            activeTab ===
              "notes"

              ? (

                <>
                  <div
                    className=
                      "home-right-panel-task"
                  >

                    <span
                      className=
                        "home-right-panel-status home-right-panel-status--yellow"
                    />


                    <div>
                      <strong>
                        Не забыть проверить новые позиции
                      </strong>

                      <span>
                        Личная заметка
                      </span>
                    </div>

                  </div>


                  <div
                    className=
                      "home-right-panel-task"
                  >

                    <span
                      className=
                        "home-right-panel-status home-right-panel-status--green"
                    />


                    <div>
                      <strong>
                        Вернуться к сверке отчёта
                      </strong>

                      <span>
                        Личная заметка
                      </span>
                    </div>

                  </div>
                </>

              )

              : filteredTasks.length >
                  0

                ? filteredTasks.map(
                    task => (

                      <div
                        key={
                          task.id
                        }

                        className=
                          "home-right-panel-task"
                      >

                        <span
                          className={
                            `home-right-panel-status home-right-panel-status--${task.status}`
                          }
                        />


                        <div>
                          <strong>
                            {
                              task.title
                            }
                          </strong>

                          <span>
                            {
                              task.creator
                            }

                            {" → "}

                            {
                              task.assignee
                            }
                          </span>
                        </div>

                      </div>

                    )
                  )

                : (

                  <div
                    className=
                      "home-right-panel-empty"
                  >
                    В этой категории задач пока нет.
                  </div>

                )
          }

        </div>

      </section>


      <section
        className=
          "home-right-panel-section home-right-panel-notifications"
      >

        <div
          className=
            "home-right-panel-heading"
        >

          <span
            className=
              "home-right-panel-secondary-icon"
          >
            <BellIcon />
          </span>


          <strong>
            Уведомления
          </strong>

        </div>


        <div
          className=
            "home-right-panel-placeholder"
        >
          Содержимое этого блока добавим следующим этапом.
        </div>

      </section>


      <section
        className=
          "home-right-panel-section"
        aria-label=
          "Дополнительный блок"
      />

    </aside>

  );

}
