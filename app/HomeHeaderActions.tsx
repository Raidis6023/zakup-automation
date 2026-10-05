"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

type NotificationItem = {
  id: string;
  title: string;
  text?: string;
  createdAt: string;
};


// Здесь в дальнейшем будут реальные уведомления.
// Сейчас список действительно пустой.

const notifications: NotificationItem[] = [];


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
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
}


// ============================================================
// COMPONENT
// ============================================================

export default function HomeHeaderActions() {

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
          visibleMonth.getFullYear();


        const month =
          visibleMonth.getMonth();


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
            length: 42,
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


  const unreadCount =
    notifications.length;


  return (

    <div
      className="home-topbar-right"
      ref={actionsRef}
    >


      {/* ======================================================
          NOTIFICATIONS
      ====================================================== */}

      <div className="home-action-wrapper">

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
            () =>
              setOpenPanel(
                current =>
                  current ===
                  "notifications"
                    ? null
                    : "notifications"
              )
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

              <div className="home-popup-header">

                <strong>
                  Уведомления
                </strong>

              </div>


              {notifications.length ===
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


                          {notification.text && (

                            <span>
                              {
                                notification.text
                              }
                            </span>

                          )}

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

      <div className="home-action-wrapper">

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

                    if (
                      !date
                    ) {

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

        <span className="home-avatar">
          ТС
        </span>


        <span className="home-profile-text">

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
