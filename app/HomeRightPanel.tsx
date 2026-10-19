"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  usePathname,
} from "next/navigation";

import {
  createClient,
} from "../lib/supabase/client";

import {
  HomeBellIcon,
  HomeTasksIcon,
} from "./HomeHeaderIcons";

import "./HomeRightPanel.css";


type CurrentUserProfileRow = {
  user_id:
    string;

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


type PersonalNote = {
  id:
    string;

  title:
    string;
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
      "task-ved-1",
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
      "task-procurement-1",
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
      "task-analyst-1",
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
      "task-category-1",
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
      "task-marketing-1",
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


function getTaskRole(
  profile:
    CurrentUserProfileRow | null
):
TaskRole {

  const role =
    profile
      ?.role_name
      ?.trim()
      .toLowerCase()
    ||
    "";


  if (
    role.startsWith(
      "категорийный менеджер"
    )
  ) {

    return "category_manager";

  }


  if (
    role ===
      "вэд"
  ) {

    return "ved";

  }


  if (
    role ===
      "закуп"
  ) {

    return "procurement";

  }


  if (
    role ===
      "аналитик"
    ||
    role ===
      "аналитика"
  ) {

    return "analyst";

  }


  if (
    role ===
      "маркетинг"
  ) {

    return "marketing";

  }


  return "analyst";

}


export default function HomeRightPanel() {

  const pathname =
    usePathname()
    ??
    "/";


  const adminHomeMode =
    pathname ===
      "/admin";


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

        // Без localStorage панель просто останется открытой.

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

              // Сама панель продолжит работать.

            }


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
    adminHomeMode
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


  const currentTaskRole =
    getTaskRole(
      profile
    );


  const departmentTasks =
    useMemo<TaskItem[]>(
      () => [
        {
          id:
            "department-task-1",
          title:
            "Проверить расчёт по новому товару",
          creator:
            "Анна Волкова",
          assignee:
            currentUserName,
          role:
            currentTaskRole,
          status:
            "red",
        },
        {
          id:
            "department-task-2",
          title:
            "Подтвердить данные перед отправкой",
          creator:
            "Илья Петров",
          assignee:
            currentUserName,
          role:
            currentTaskRole,
          status:
            "yellow",
        },
        {
          id:
            "department-task-3",
          title:
            "Проверить изменения по товару",
          creator:
            "Мария Соколова",
          assignee:
            currentUserName,
          role:
            currentTaskRole,
          status:
            "green",
        },
      ],
      [
        currentTaskRole,
        currentUserName,
      ]
    );


  const personalNotes =
    useMemo<PersonalNote[]>(
      () => {

        const ownerKey =
          profile
            ?.user_id
          ||
          "current-user";


        return [
          {
            id:
              `${ownerKey}-note-1`,
            title:
              "Не забыть проверить новые позиции",
          },
          {
            id:
              `${ownerKey}-note-2`,
            title:
              "Вернуться к сверке отчёта",
          },
        ];

      },
      [
        profile
          ?.user_id,
      ]
    );


  const visibleTasks =
    privileged

      ? PRIVILEGED_TASKS

      : departmentTasks;


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
        [
          "home-right-panel",

          adminHomeMode

            ? "home-right-panel--admin"

            : "home-right-panel--work",

          open

            ? ""

            : "home-right-panel--collapsed",
        ]
          .filter(
            Boolean
          )
          .join(
            " "
          )
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
              "home-right-panel-heading-icon"
          >
            <HomeTasksIcon />
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

              ? personalNotes.map(
                  note => (

                    <div
                      key={
                        note.id
                      }

                      className=
                        "home-right-panel-task home-right-panel-task--note"
                    >

                      <div>
                        <strong>
                          {
                            note.title
                          }
                        </strong>

                        <span>
                          Личная заметка
                        </span>
                      </div>

                    </div>

                  )
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
              "home-right-panel-heading-icon"
          >
            <HomeBellIcon />
          </span>


          <strong>
            Уведомления
          </strong>

        </div>

      </section>

    </aside>

  );

}
