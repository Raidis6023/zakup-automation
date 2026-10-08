"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createClient,
} from "../lib/supabase/client";

import HomeThemeToggle from "./HomeThemeToggle";


// ============================================================
// ICONS
// ============================================================

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


function CalendarIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
      />

      <path
        d="M16 3v4M8 3v4M3 10h18"
      />
    </svg>
  );

}


function ChevronIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="m7 9 5 5 5-5"
      />
    </svg>
  );

}


function ArrowLeftIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="m15 18-6-6 6-6"
      />
    </svg>
  );

}


function ArrowRightIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="m9 18 6-6-6-6"
      />
    </svg>
  );

}


// ============================================================
// NOTIFICATIONS
// ============================================================

type AccessRequestNotificationRow = {

  request_id:
    string;

  first_name:
    string;

  last_name:
    string;

  email:
    string;

  department:
    string | null;

  comment:
    string | null;

  created_at:
    string;

};


type NotificationItem = {

  id:
    string;

  type:
    "access_request";

  title:
    string;

  text:
    string;

  createdAt:
    string;

  request: {
    firstName:
      string;

    lastName:
      string;

    email:
      string;

    department:
      string | null;

    comment:
      string | null;
  };

};


// ============================================================
// CALENDAR CONSTANTS
// ============================================================

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];


const WEEK_DAYS = [
  "Пн",
  "Вт",
  "Ср",
  "Чт",
  "Пт",
  "Сб",
  "Вс",
];


// ============================================================
// HELPERS
// ============================================================

function isSameDay(
  first: Date,
  second: Date
) {

  return (

    first.getFullYear() ===
      second.getFullYear()

    &&

    first.getMonth() ===
      second.getMonth()

    &&

    first.getDate() ===
      second.getDate()

  );

}


function formatToday(
  date: Date
) {

  return date.toLocaleDateString(
    "ru-RU",
    {
      day:
        "numeric",

      month:
        "long",

      year:
        "numeric",
    }
  );

}


function formatNotificationTime(
  value: string
) {

  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  return date.toLocaleString(
    "ru-RU",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );

}


// ============================================================
// COMPONENT
// ============================================================

export default function HomeHeaderActions() {

  // ==========================================================
  // PANELS
  // ==========================================================

  const [
    openPanel,
    setOpenPanel,
  ] =
    useState<
      "calendar"
      |
      "notifications"
      |
      null
    >(
      null
    );


  // ==========================================================
  // NOTIFICATIONS STATE
  // ==========================================================

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      NotificationItem[]
    >(
      []
    );


  const [
    notificationsLoading,
    setNotificationsLoading,
  ] =
    useState(
      true
    );


  const [
    notificationsError,
    setNotificationsError,
  ] =
    useState<
      string | null
    >(
      null
    );


  // ==========================================================
  // CALENDAR STATE
  // ==========================================================

  const [
    today,
    setToday,
  ] =
    useState(
      () =>
        new Date()
    );


  const [
    visibleMonth,
    setVisibleMonth,
  ] =
    useState(
      () => {

        const now =
          new Date();


        return new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

      }
    );


  const actionsRef =
    useRef<HTMLDivElement | null>(
      null
    );


  // ==========================================================
  // LOAD ACCESS REQUEST NOTIFICATIONS
  // ==========================================================

  const loadNotifications =
    useCallback(
      async () => {

        setNotificationsLoading(
          true
        );


        setNotificationsError(
          null
        );


        try {

          const supabase =
            createClient();


          const {
            data,
            error,
          } =
            await supabase
              .rpc(
                "app_get_access_request_notifications"
              );


          if (error) {

            const message =
              error.message
                .toLowerCase();


            /*
             * Обычный пользователь
             * не должен видеть
             * административные заявки.
             *
             * Для него это не ошибка
             * интерфейса: просто
             * уведомлений такого типа нет.
             */
            if (
              message.includes(
                "недостаточно прав"
              )
              ||
              message.includes(
                "требуется авторизация"
              )
            ) {

              setNotifications(
                []
              );


              return "forbidden" as const;

            }


            setNotificationsError(
              "Не удалось загрузить уведомления"
            );


            return "error" as const;

          }


          const rows =
            (
              data ?? []
            ) as
              AccessRequestNotificationRow[];


          const nextNotifications:
            NotificationItem[] =
              rows.map(
                row => {

                  const fullName =
                    [
                      row.first_name,
                      row.last_name,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " "
                      );


                  const detail =
                    row.department

                      ? `${fullName} · ${row.department}`

                      : fullName;


                  return {

                    id:
                      row.request_id,

                    type:
                      "access_request",

                    title:
                      "Новый запрос доступа",

                    text:
                      detail,

                    createdAt:
                      row.created_at,

                    request: {

                      firstName:
                        row.first_name,

                      lastName:
                        row.last_name,

                      email:
                        row.email,

                      department:
                        row.department,

                      comment:
                        row.comment,

                    },

                  };

                }
              );


          setNotifications(
            nextNotifications
          );


          return "success" as const;

        } catch {

          setNotificationsError(
            "Не удалось загрузить уведомления"
          );


          return "error" as const;

        } finally {

          setNotificationsLoading(
            false
          );

        }

      },
      []
    );


  // ==========================================================
  // ПЕРВАЯ ЗАГРУЗКА УВЕДОМЛЕНИЙ
  //
  // Если пользователь является администратором,
  // после успешной первой загрузки проверяем
  // новые заявки раз в минуту.
  //
  // Для обычного пользователя polling
  // не запускается.
  // ==========================================================

  useEffect(
    () => {

      let stopped =
        false;


      let intervalId:
        number | null =
          null;


      async function startNotifications() {

        const result =
          await loadNotifications();


        if (
          stopped
          ||
          result !== "success"
        ) {

          return;

        }


        intervalId =
          window.setInterval(
            () => {

              void loadNotifications();

            },
            60 * 1000
          );

      }


      void startNotifications();


      return () => {

        stopped =
          true;


        if (
          intervalId !== null
        ) {

          window.clearInterval(
            intervalId
          );

        }

      };

    },
    [
      loadNotifications,
    ]
  );


  // ==========================================================
  // ОБНОВЛЯЕМ СЕГОДНЯШНЮЮ ДАТУ
  // ==========================================================

  useEffect(
    () => {

      const interval =
        window.setInterval(
          () => {

            const now =
              new Date();


            setToday(
              previous => {

                if (
                  isSameDay(
                    previous,
                    now
                  )
                ) {

                  return previous;

                }


                return now;

              }
            );

          },
          60 * 1000
        );


      return () => {

        window.clearInterval(
          interval
        );

      };

    },
    []
  );


  // ==========================================================
  // ЗАКРЫТИЕ ПО КЛИКУ СНАРУЖИ
  // ==========================================================

  useEffect(
    () => {

      function handlePointerDown(
        event: MouseEvent
      ) {

        if (
          !actionsRef.current
        ) {

          return;

        }


        if (
          !actionsRef.current.contains(
            event.target as Node
          )
        ) {

          setOpenPanel(
            null
          );

        }

      }


      function handleKeyDown(
        event: KeyboardEvent
      ) {

        if (
          event.key ===
          "Escape"
        ) {

          setOpenPanel(
            null
          );

        }

      }


      document.addEventListener(
        "mousedown",
        handlePointerDown
      );


      document.addEventListener(
        "keydown",
        handleKeyDown
      );


      return () => {

        document.removeEventListener(
          "mousedown",
          handlePointerDown
        );


        document.removeEventListener(
          "keydown",
          handleKeyDown
        );

      };

    },
    []
  );


  // ==========================================================
  // ДНИ КАЛЕНДАРЯ
  // ==========================================================

  const calendarCells =
    useMemo(
      () => {

        const year =
          visibleMonth
            .getFullYear();


        const month =
          visibleMonth
            .getMonth();


        const firstDay =
          new Date(
            year,
            month,
            1
          );


        const mondayOffset =
          (
            firstDay.getDay()
            +
            6
          )
          %
          7;


        const daysInMonth =
          new Date(
            year,
            month + 1,
            0
          )
            .getDate();


        return Array.from(
          {
            length:
              42,
          },
          (
            _,
            index
          ) => {

            const day =
              index
              -
              mondayOffset
              +
              1;


            if (
              day < 1
              ||
              day > daysInMonth
            ) {

              return null;

            }


            return new Date(
              year,
              month,
              day
            );

          }
        );

      },
      [
        visibleMonth,
      ]
    );


  // ==========================================================
  // MONTH NAVIGATION
  // ==========================================================

  function showPreviousMonth() {

    setVisibleMonth(
      current =>
        new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1
        )
    );

  }


  function showNextMonth() {

    setVisibleMonth(
      current =>
        new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          1
        )
    );

  }


  function showCurrentMonth() {

    const now =
      new Date();


    setToday(
      now
    );


    setVisibleMonth(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )
    );

  }


  // ==========================================================
  // TOGGLE NOTIFICATIONS
  // ==========================================================

  function toggleNotifications() {

    const willOpen =
      openPanel !==
        "notifications";


    setOpenPanel(
      willOpen
        ? "notifications"
        : null
    );


    /*
     * При каждом открытии
     * колокольчика обновляем
     * список ещё раз.
     */
    if (willOpen) {

      void loadNotifications();

    }

  }


  const unreadCount =
    notifications.length;


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div
      className="home-topbar-right"
      ref={actionsRef}
    >


      {/* ======================================================
          NOTIFICATIONS
      ====================================================== */}

      <div
        className="home-action-wrapper"
      >

        <button
          type="button"

          className={
            openPanel ===
              "notifications"

              ? "home-icon-button active"

              : "home-icon-button"
          }

          aria-label="Уведомления"

          aria-expanded={
            openPanel ===
              "notifications"
          }

          onClick={
            toggleNotifications
          }
        >

          <BellIcon />


          {unreadCount > 0 && (

            <span
              className="home-notification-badge"
            >
              {unreadCount}
            </span>

          )}

        </button>


        {openPanel ===
          "notifications"
          &&
          (

            <div
              className="
                home-popup
                home-notifications-popup
              "
            >

              <div
                className="home-popup-header"
              >

                <strong>
                  Уведомления
                </strong>

              </div>


              {notificationsLoading
                &&
                notifications.length ===
                  0
                ? (

                  <div
                    className="
                      home-notifications-empty
                    "
                  >

                    <div
                      className="
                        home-notifications-empty-icon
                      "
                    >
                      <BellIcon />
                    </div>


                    <strong>
                      Загружаем
                    </strong>


                    <span>
                      Проверяем новые
                      уведомления.
                    </span>

                  </div>

                )
                :
                notificationsError
                &&
                notifications.length ===
                  0
                ? (

                  <div
                    className="
                      home-notifications-empty
                    "
                  >

                    <div
                      className="
                        home-notifications-empty-icon
                      "
                    >
                      <BellIcon />
                    </div>


                    <strong>
                      Не удалось загрузить
                    </strong>


                    <span>
                      {
                        notificationsError
                      }
                    </span>

                  </div>

                )
                :
                notifications.length ===
                  0
                ? (

                  <div
                    className="
                      home-notifications-empty
                    "
                  >

                    <div
                      className="
                        home-notifications-empty-icon
                      "
                    >
                      <BellIcon />
                    </div>


                    <strong>
                      Уведомлений нет
                    </strong>


                    <span>
                      Здесь появятся новые
                      системные уведомления.
                    </span>

                  </div>

                )
                : (

                  <div
                    className="
                      home-notifications-list
                    "
                  >

                    {notifications.map(
                      notification => (

                        <div
                          key={
                            notification.id
                          }

                          className="
                            home-notification-item
                          "
                        >

                          <strong>
                            {
                              notification.title
                            }
                          </strong>


                          <span>
                            {
                              notification.text
                            }
                          </span>


                          <span>
                            {
                              notification.request.email
                            }

                            {
                              notification.createdAt
                                ? ` · ${formatNotificationTime(
                                    notification.createdAt
                                  )}`
                                : ""
                            }
                          </span>

                        </div>

                      )
                    )}

                  </div>

                )}

            </div>

          )}

      </div>


      {/* ======================================================
          CALENDAR
      ====================================================== */}

      <div
        className="home-action-wrapper"
      >

        <button
          type="button"

          className={
            openPanel ===
              "calendar"

              ? "home-icon-button active"

              : "home-icon-button"
          }

          aria-label="Календарь"

          aria-expanded={
            openPanel ===
              "calendar"
          }

          onClick={
            () =>
              setOpenPanel(
                current =>
                  current ===
                    "calendar"

                    ? null

                    : "calendar"
              )
          }
        >

          <CalendarIcon />

        </button>


        {openPanel ===
          "calendar"
          &&
          (

            <div
              className="
                home-popup
                home-calendar-popup
              "
            >

              <div
                className="
                  home-calendar-header
                "
              >

                <button
                  type="button"

                  className="
                    home-calendar-arrow
                  "

                  aria-label=
                    "Предыдущий месяц"

                  onClick={
                    showPreviousMonth
                  }
                >

                  <ArrowLeftIcon />

                </button>


                <strong>

                  {
                    MONTH_NAMES[
                      visibleMonth
                        .getMonth()
                    ]
                  }

                  {" "}

                  {
                    visibleMonth
                      .getFullYear()
                  }

                </strong>


                <button
                  type="button"

                  className="
                    home-calendar-arrow
                  "

                  aria-label=
                    "Следующий месяц"

                  onClick={
                    showNextMonth
                  }
                >

                  <ArrowRightIcon />

                </button>

              </div>


              <div
                className="
                  home-calendar-weekdays
                "
              >

                {WEEK_DAYS.map(
                  day => (

                    <span
                      key={
                        day
                      }
                    >
                      {day}
                    </span>

                  )
                )}

              </div>


              <div
                className="
                  home-calendar-grid
                "
              >

                {calendarCells.map(
                  (
                    date,
                    index
                  ) => {

                    if (!date) {

                      return (

                        <span
                          key={
                            `empty-${index}`
                          }

                          className="
                            home-calendar-day
                            empty
                          "
                        />

                      );

                    }


                    const currentDay =
                      isSameDay(
                        date,
                        today
                      );


                    return (

                      <button
                        key={
                          date.toISOString()
                        }

                        type="button"

                        className={
                          currentDay

                            ? `
                              home-calendar-day
                              today
                            `

                            : `
                              home-calendar-day
                            `
                        }

                        aria-current={
                          currentDay
                            ? "date"
                            : undefined
                        }
                      >

                        {
                          date.getDate()
                        }

                      </button>

                    );

                  }
                )}

              </div>


              <button
                type="button"

                className="
                  home-calendar-today-button
                "

                onClick={
                  showCurrentMonth
                }
              >

                Сегодня,
                {" "}

                {
                  formatToday(
                    today
                  )
                }

              </button>

            </div>

          )}

      </div>


      <div
        className="home-topbar-divider"
      />


      {/* ======================================================
          THEME
      ====================================================== */}

      <HomeThemeToggle />


      <div
        className="home-topbar-divider"
      />


      {/* ======================================================
          PROFILE
      ====================================================== */}

      <button
        type="button"
        className="home-profile"
      >

        <span
          className="home-avatar"
        >
          ТС
        </span>


        <span
          className="home-profile-text"
        >

          <strong>
            Тест Сайта
          </strong>

          <span>
            Аналитик
          </span>

        </span>


        <span
          className="
            home-profile-chevron
          "
        >

          <ChevronIcon />

        </span>

      </button>

    </div>

  );

}
