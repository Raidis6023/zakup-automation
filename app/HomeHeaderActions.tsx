"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import {
  createClient,
} from "../lib/supabase/client";

import HomeThemeToggle
  from "./HomeThemeToggle";

import styles
  from "./HomeHeaderActions.module.css";


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


function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12"
      />

      <path
        d="M18 6L6 18"
      />
    </svg>
  );
}


// ============================================================
// NOTIFICATIONS
// ============================================================

type AccessRequestNotificationRow = {
  request_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  comment: string | null;
  created_at: string;
};


type NotificationItem = {
  id: string;
  type: "access_request";
  title: string;
  text: string;
  createdAt: string;

  request: {
    firstName: string;
    lastName: string;
    email: string;
    department: string | null;
    comment: string | null;
  };
};


// ============================================================
// ROLES
// ============================================================

type WorkingRole =
  ""
  | "analyst"
  | "procurement"
  | "ved"
  | "category_manager"
  | "marketing"
  | "manager";


type CategoryMarketplace =
  ""
  | "ozon"
  | "wildberries"
  | "yandex_market";


const WORKING_ROLES: {
  value: WorkingRole;
  label: string;
}[] = [
  {
    value: "",
    label: "Выберите роль",
  },
  {
    value: "analyst",
    label: "Аналитик",
  },
  {
    value: "procurement",
    label: "Закуп",
  },
  {
    value: "ved",
    label: "ВЭД",
  },
  {
    value: "category_manager",
    label: "Категорийный менеджер",
  },
  {
    value: "marketing",
    label: "Маркетинг",
  },
  {
    value: "manager",
    label: "Руководитель",
  },
];


const MARKETPLACES: {
  value: CategoryMarketplace;
  label: string;
}[] = [
  {
    value: "",
    label: "Выберите маркетплейс",
  },
  {
    value: "ozon",
    label: "Ozon",
  },
  {
    value: "wildberries",
    label: "Wildberries",
  },
  {
    value: "yandex_market",
    label: "Яндекс Маркет",
  },
];


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


function formatNotificationTime(
  value: string
) {
  const date =
    new Date(value);


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
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


// ============================================================
// SAFE VALUE CONVERTERS
// ============================================================

function getWorkingRole(
  value: string
): WorkingRole {

  switch (value) {

    case "analyst":
      return "analyst";

    case "procurement":
      return "procurement";

    case "ved":
      return "ved";

    case "category_manager":
      return "category_manager";

    case "marketing":
      return "marketing";

    case "manager":
      return "manager";

    default:
      return "";

  }

}


function getCategoryMarketplace(
  value: string
): CategoryMarketplace {

  switch (value) {

    case "ozon":
      return "ozon";

    case "wildberries":
      return "wildberries";

    case "yandex_market":
      return "yandex_market";

    default:
      return "";

  }

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
      | "notifications"
      | null
    >(
      null
    );


  // ==========================================================
  // NOTIFICATIONS
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
  // ACCESS REQUEST MODAL
  // ==========================================================

  const [
    selectedNotification,
    setSelectedNotification,
  ] =
    useState<
      NotificationItem | null
    >(
      null
    );


  const [
    selectedRole,
    setSelectedRole,
  ] =
    useState<
      WorkingRole
    >(
      ""
    );


  const [
    selectedMarketplace,
    setSelectedMarketplace,
  ] =
    useState<
      CategoryMarketplace
    >(
      ""
    );


  // ==========================================================
  // CALENDAR
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


              return "forbidden";

            }


            setNotificationsError(
              "Не удалось загрузить уведомления"
            );


            return "error";

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


          return "success";

        } catch {

          setNotificationsError(
            "Не удалось загрузить уведомления"
          );


          return "error";

        } finally {

          setNotificationsLoading(
            false
          );

        }

      },
      []
    );


  // ==========================================================
  // INITIAL NOTIFICATIONS + POLLING
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
  // UPDATE TODAY
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
  // CLOSE PANELS / MODAL
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
          event.key !==
          "Escape"
        ) {

          return;

        }


        if (
          selectedNotification
        ) {

          setSelectedNotification(
            null
          );

          return;

        }


        setOpenPanel(
          null
        );

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
    [
      selectedNotification,
    ]
  );


  // ==========================================================
  // CALENDAR CELLS
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
  // CALENDAR NAVIGATION
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
  // NOTIFICATION PANEL
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


    if (willOpen) {

      void loadNotifications();

    }

  }


  // ==========================================================
  // OPEN ACCESS REQUEST
  // ==========================================================

  function openAccessRequest(
    notification: NotificationItem
  ) {

    setSelectedNotification(
      notification
    );


    setSelectedRole(
      ""
    );


    setSelectedMarketplace(
      ""
    );


    setOpenPanel(
      null
    );

  }


  function closeAccessRequest() {

    setSelectedNotification(
      null
    );


    setSelectedRole(
      ""
    );


    setSelectedMarketplace(
      ""
    );

  }


  // ==========================================================
  // ROLE CHANGE
  // ==========================================================

  function changeRole(
    role: WorkingRole
  ) {

    setSelectedRole(
      role
    );


    if (
      role !==
      "category_manager"
    ) {

      setSelectedMarketplace(
        ""
      );

    }

  }


  const unreadCount =
    notifications.length;


  // ==========================================================
  // ACCESS REQUEST MODAL
  // ==========================================================

  const accessRequestModal =
    selectedNotification
    &&
    typeof document !==
      "undefined"

      ? createPortal(

          <div
            className={
              styles.modalOverlay
            }

            onMouseDown={
              event => {

                if (
                  event.target ===
                  event.currentTarget
                ) {

                  closeAccessRequest();

                }

              }
            }
          >

            <div
              className={
                styles.modal
              }

              role="dialog"

              aria-modal="true"

              aria-labelledby=
                "access-request-title"
            >

              <button
                type="button"

                className={
                  styles.closeButton
                }

                aria-label=
                  "Закрыть"

                onClick={
                  closeAccessRequest
                }
              >
                <CloseIcon />
              </button>


              <div
                className={
                  styles.modalHeader
                }
              >

                <h2
                  id="access-request-title"
                >
                  Запрос доступа
                </h2>


                <p>
                  Проверьте данные сотрудника
                  и назначьте ему рабочую роль.
                </p>

              </div>


              <div
                className={
                  styles.requestInfo
                }
              >

                <div
                  className={
                    styles.requestRow
                  }
                >

                  <span
                    className={
                      styles.requestLabel
                    }
                  >
                    Сотрудник
                  </span>


                  <span
                    className={
                      styles.requestValue
                    }
                  >
                    {
                      selectedNotification
                        .request
                        .firstName
                    }
                    {" "}
                    {
                      selectedNotification
                        .request
                        .lastName
                    }
                  </span>

                </div>


                <div
                  className={
                    styles.requestRow
                  }
                >

                  <span
                    className={
                      styles.requestLabel
                    }
                  >
                    Email
                  </span>


                  <span
                    className={
                      styles.requestValue
                    }
                  >
                    {
                      selectedNotification
                        .request
                        .email
                    }
                  </span>

                </div>


                <div
                  className={
                    styles.requestRow
                  }
                >

                  <span
                    className={
                      styles.requestLabel
                    }
                  >
                    Отдел
                  </span>


                  <span
                    className={
                      styles.requestValue
                    }
                  >
                    {
                      selectedNotification
                        .request
                        .department
                      ||
                      "Не указан"
                    }
                  </span>

                </div>


                <div
                  className={
                    styles.requestRow
                  }
                >

                  <span
                    className={
                      styles.requestLabel
                    }
                  >
                    Комментарий
                  </span>


                  <span
                    className={
                      styles.requestValue
                    }
                  >
                    {
                      selectedNotification
                        .request
                        .comment
                      ||
                      "Нет"
                    }
                  </span>

                </div>

              </div>


              <div
                className={
                  styles.roleForm
                }
              >

                <div
                  className={
                    styles.field
                  }
                >

                  <label
                    htmlFor=
                      "access-request-role"
                  >
                    Рабочая роль *
                  </label>


                  <select
                    id=
                      "access-request-role"

                    value={
                      selectedRole
                    }

                    onChange={
                      event =>
                        changeRole(
                          getWorkingRole(
                            event.currentTarget.value
                          )
                        )
                    }
                  >

                    {WORKING_ROLES.map(
                      role => (

                        <option
                          key={
                            role.value
                            ||
                            "empty"
                          }

                          value={
                            role.value
                          }
                        >
                          {
                            role.label
                          }
                        </option>

                      )
                    )}

                  </select>

                </div>


                {selectedRole ===
                  "category_manager"
                  &&
                  (

                    <div
                      className={
                        styles.field
                      }
                    >

                      <label
                        htmlFor=
                          "access-request-marketplace"
                      >
                        Маркетплейс *
                      </label>


                      <select
                        id=
                          "access-request-marketplace"

                        value={
                          selectedMarketplace
                        }

                        onChange={
                          event =>
                            setSelectedMarketplace(
                              getCategoryMarketplace(
                                event.currentTarget.value
                              )
                            )
                        }
                      >

                        {MARKETPLACES.map(
                          marketplace => (

                            <option
                              key={
                                marketplace.value
                                ||
                                "empty"
                              }

                              value={
                                marketplace.value
                              }
                            >
                              {
                                marketplace.label
                              }
                            </option>

                          )
                        )}

                      </select>

                    </div>

                  )}


                <div
                  className={
                    styles.adminNote
                  }
                >

                  <strong>
                    Административные права:
                  </strong>
                  {" "}
                  не выдаются при обычном
                  одобрении заявки.

                </div>

              </div>


              <div
                className={
                  styles.footer
                }
              >

                <span
                  className={
                    styles.footerHint
                  }
                >
                  На следующем шаге подключим
                  реальные действия
                  «Отклонить» и «Одобрить»
                  с приглашением сотрудника.
                </span>


                <button
                  type="button"

                  className={
                    styles.closeFooterButton
                  }

                  onClick={
                    closeAccessRequest
                  }
                >
                  Закрыть
                </button>

              </div>

            </div>

          </div>,

          document.body

        )

      : null;


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <>

      <div
        className="home-topbar-right"
        ref={actionsRef}
      >


        {/* ====================================================
            NOTIFICATIONS
        ==================================================== */}

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
                className=
                  "home-notification-badge"
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
                  className=
                    "home-popup-header"
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

                          <button
                            key={
                              notification.id
                            }

                            type="button"

                            className={`
                              home-notification-item
                              ${styles.notificationButton}
                            `}

                            onClick={
                              () =>
                                openAccessRequest(
                                  notification
                                )
                            }
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
                                notification
                                  .request
                                  .email
                              }

                              {
                                notification.createdAt

                                  ? ` · ${
                                      formatNotificationTime(
                                        notification
                                          .createdAt
                                      )
                                    }`

                                  : ""
                              }
                            </span>

                          </button>

                        )
                      )}

                    </div>

                  )}

              </div>

            )}

        </div>


        {/* ====================================================
            CALENDAR
        ==================================================== */}

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
          className=
            "home-topbar-divider"
        />


        {/* ====================================================
            THEME
        ==================================================== */}

        <HomeThemeToggle />


        <div
          className=
            "home-topbar-divider"
        />


        {/* ====================================================
            PROFILE
        ==================================================== */}

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
            className=
              "home-profile-text"
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


      {accessRequestModal}

    </>

  );

}
