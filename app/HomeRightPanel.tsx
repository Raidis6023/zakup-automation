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

import {
  buildCurrentUserTasks,
  buildPersonalNotes,
  isManagerTaskProfile,
  PRIVILEGED_TASKS,
  type PersonalNote,
  type TaskItem,
  type TaskRole,
} from "./HomeTasksData";

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
    isManagerTaskProfile(
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


  const currentUserTasks =
    useMemo<TaskItem[]>(
      () =>
        buildCurrentUserTasks(
          profile
        ),
      [
        profile,
      ]
    );


  const personalNotes =
    useMemo<PersonalNote[]>(
      () =>
        buildPersonalNotes(
          profile
        ),
      [
        profile,
      ]
    );



  const visibleTasks =
    privileged

      ? PRIVILEGED_TASKS

      : currentUserTasks;


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
