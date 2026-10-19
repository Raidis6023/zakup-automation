"use client";

import Link
  from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

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

import {
  approveAccessRequest,
  rejectAccessRequest,
} from "./access-request-actions";

import HomeThemeToggle
  from "./HomeThemeToggle";

import WorkspaceModeSwitcher
  from "./WorkspaceModeSwitcher";

import {
  HomeBellIcon,
  HomeTasksIcon,
} from "./HomeHeaderIcons";

import {
  buildAdministratorTasks,
  buildCurrentUserTasks,
} from "./HomeTasksData";

import styles
  from "./HomeHeaderActions.module.css";


// ============================================================
// ICONS
// ============================================================

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
// TYPES
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


type ApprovalResult = {

  email:
    string;

  fullName:
    string;

  temporaryPassword:
    string;

};


type RequestAction =
  "approve"
  | "reject"
  | null;


type CopyStatus =
  "idle"
  | "copied"
  | "error";


type CurrentUserProfileRow = {

  user_id:
    string;

  first_name:
    string;

  last_name:
    string;

  email:
    string;

  avatar_path:
    string | null;

  role_name:
    string;

  has_admin_access:
    boolean;

  admin_role_name:
    string | null;

};


// ============================================================
// CONSTANTS
// ============================================================

const WORKING_ROLES: Array<{

  value:
    WorkingRole;

  label:
    string;

}> = [

  {
    value:
      "",

    label:
      "Выберите роль",
  },

  {
    value:
      "analyst",

    label:
      "Аналитик",
  },

  {
    value:
      "procurement",

    label:
      "Закуп",
  },

  {
    value:
      "ved",

    label:
      "ВЭД",
  },

  {
    value:
      "category_manager",

    label:
      "Категорийный менеджер",
  },

  {
    value:
      "marketing",

    label:
      "Маркетинг",
  },

  {
    value:
      "manager",

    label:
      "Руководитель",
  },

];


const MARKETPLACES: Array<{

  value:
    CategoryMarketplace;

  label:
    string;

}> = [

  {
    value:
      "",

    label:
      "Выберите маркетплейс",
  },

  {
    value:
      "ozon",

    label:
      "Ozon",
  },

  {
    value:
      "wildberries",

    label:
      "Wildberries",
  },

  {
    value:
      "yandex_market",

    label:
      "Яндекс Маркет",
  },

];


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
  first:
    Date,

  second:
    Date
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
  date:
    Date
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
  value:
    string
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


function getWorkingRole(
  value:
    string
):
WorkingRole {

  switch (
    value
  ) {

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
  value:
    string
):
CategoryMarketplace {

  switch (
    value
  ) {

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


function getProfileInitials(
  firstName:
    string,

  lastName:
    string
) {

  const firstInitial =
    firstName
      .trim()
      .charAt(
        0
      );


  const lastInitial =
    lastName
      .trim()
      .charAt(
        0
      );


  const initials =
    `${firstInitial}${lastInitial}`
      .toUpperCase();


  return (
    initials
    ||
    "П"
  );

}


// ============================================================
// COMPONENT
// ============================================================

export default function HomeHeaderActions() {

  const router =
    useRouter();


  const pathname =
    usePathname()
    ??
    "/";


  const adminMode =
    pathname ===
      "/admin"
    ||
    pathname.startsWith(
      "/admin/"
    );



  const [
    openPanel,
    setOpenPanel,
  ] =
    useState<
      "calendar"
      |
      "tasks"
      |
      "notifications"
      |
      "profile"
      |
      null
    >(
      null
    );



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


  const [
    requestAction,
    setRequestAction,
  ] =
    useState<
      RequestAction
    >(
      null
    );


  const [
    requestActionError,
    setRequestActionError,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    approvalResult,
    setApprovalResult,
  ] =
    useState<
      ApprovalResult | null
    >(
      null
    );


  const [
    copyStatus,
    setCopyStatus,
  ] =
    useState<
      CopyStatus
    >(
      "idle"
    );


  const [
    currentProfile,
    setCurrentProfile,
  ] =
    useState<
      CurrentUserProfileRow | null
    >(
      null
    );


  const [
    profileAvatarUrl,
    setProfileAvatarUrl,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    profileLoading,
    setProfileLoading,
  ] =
    useState(
      true
    );


  const [
    logoutLoading,
    setLogoutLoading,
  ] =
    useState(
      false
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
    useRef<
      HTMLDivElement | null
    >(
      null
    );


  // ==========================================================
  // NOTIFICATIONS
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


          if (
            error
          ) {

            const message =
              error
                .message
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
              data
              ??
              []
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
          result !==
            "success"
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
          intervalId !==
            null
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
  // CURRENT USER PROFILE
  // ==========================================================

  useEffect(
    () => {

      let active =
        true;


      async function loadCurrentProfile() {

        try {

          const supabase =
            createClient();


          const {
            data,
            error,
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


          if (
            error
          ) {

            console.error(
              "Ошибка загрузки профиля:",
              error
            );


            setCurrentProfile(
              null
            );


            setProfileAvatarUrl(
              null
            );


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


          const profile =
            rows[
              0
            ] as
              CurrentUserProfileRow
              |
              undefined;


          if (
            !profile
          ) {

            setCurrentProfile(
              null
            );


            setProfileAvatarUrl(
              null
            );


            return;

          }


          let nextAvatarUrl:
            string | null =
              null;


          if (
            profile.avatar_path
          ) {

            const {
              data:
                signedData,

              error:
                signedError,
            } =
              await supabase
                .storage
                .from(
                  "avatars"
                )
                .createSignedUrl(
                  profile.avatar_path,
                  24 * 60 * 60
                );


            if (
              signedError
            ) {

              console.error(
                "Ошибка загрузки аватара:",
                signedError
              );

            } else {

              nextAvatarUrl =
                signedData.signedUrl;

            }

          }


          if (
            !active
          ) {

            return;

          }


          setCurrentProfile(
            profile
          );


          setProfileAvatarUrl(
            nextAvatarUrl
          );

        } catch (
          error
        ) {

          if (
            active
          ) {

            console.error(
              "Ошибка загрузки профиля:",
              error
            );


            setCurrentProfile(
              null
            );


            setProfileAvatarUrl(
              null
            );

          }

        } finally {

          if (
            active
          ) {

            setProfileLoading(
              false
            );

          }

        }

      }


      void loadCurrentProfile();


      return () => {

        active =
          false;

      };

    },
    []
  );


  // ==========================================================
  // DATE
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
        event:
          MouseEvent
      ) {

        if (
          !actionsRef.current
        ) {

          return;

        }


        const target =
          event.target;


        if (
          target instanceof
            Node
          &&
          !actionsRef.current.contains(
            target
          )
        ) {

          setOpenPanel(
            null
          );

        }

      }


      function handleKeyDown(
        event:
          KeyboardEvent
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

          if (
            requestAction !==
              null
          ) {

            return;

          }


          closeAccessRequest();


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
      requestAction,
    ]
  );


  // ==========================================================
  // CALENDAR
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
  // TASKS POPUP
  // ==========================================================

  function toggleTasks() {

    setOpenPanel(
      current =>
        current ===
          "tasks"

          ? null

          : "tasks"
    );

  }


  // ==========================================================
  // ACCESS REQUEST
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


    if (
      willOpen
    ) {

      void loadNotifications();

    }

  }


  function openAccessRequest(
    notification:
      NotificationItem
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


    setRequestAction(
      null
    );


    setRequestActionError(
      null
    );


    setApprovalResult(
      null
    );


    setCopyStatus(
      "idle"
    );


    setOpenPanel(
      null
    );

  }


  function closeAccessRequest() {

    if (
      requestAction !==
        null
    ) {

      return;

    }


    setSelectedNotification(
      null
    );


    setSelectedRole(
      ""
    );


    setSelectedMarketplace(
      ""
    );


    setRequestActionError(
      null
    );


    setApprovalResult(
      null
    );


    setCopyStatus(
      "idle"
    );

  }


  function changeRole(
    role:
      WorkingRole
  ) {

    setSelectedRole(
      role
    );


    setRequestActionError(
      null
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


  async function handleApproveAccessRequest() {

    if (
      !selectedNotification
      ||
      requestAction !==
        null
    ) {

      return;

    }


    if (
      selectedRole ===
        ""
    ) {

      setRequestActionError(
        "Выберите рабочую роль"
      );


      return;

    }


    if (
      selectedRole ===
        "category_manager"
      &&
      selectedMarketplace ===
        ""
    ) {

      setRequestActionError(
        "Выберите маркетплейс для категорийного менеджера"
      );


      return;

    }


    setRequestAction(
      "approve"
    );


    setRequestActionError(
      null
    );


    try {

      const result =
        await approveAccessRequest(
          {

            requestId:
              selectedNotification.id,

            systemRole:
              selectedRole,

            categoryMarketplace:
              selectedRole ===
                "category_manager"

                ? selectedMarketplace

                : null,

          }
        );


      if (
        !result.ok
      ) {

        setRequestActionError(
          result.error
        );


        return;

      }


      setNotifications(
        current =>
          current.filter(
            notification =>
              notification.id !==
                selectedNotification.id
          )
      );


      setApprovalResult(
        {

          email:
            result.email,

          fullName:
            result.fullName,

          temporaryPassword:
            result.temporaryPassword,

        }
      );


      setCopyStatus(
        "idle"
      );

    } catch {

      setRequestActionError(
        "Не удалось одобрить заявку"
      );

    } finally {

      setRequestAction(
        null
      );

    }

  }


  async function handleRejectAccessRequest() {

    if (
      !selectedNotification
      ||
      requestAction !==
        null
    ) {

      return;

    }


    setRequestAction(
      "reject"
    );


    setRequestActionError(
      null
    );


    try {

      const result =
        await rejectAccessRequest(
          selectedNotification.id
        );


      if (
        !result.ok
      ) {

        setRequestActionError(
          result.error
        );


        return;

      }


      const processedRequestId =
        selectedNotification.id;


      setNotifications(
        current =>
          current.filter(
            notification =>
              notification.id !==
                processedRequestId
          )
      );


      setSelectedNotification(
        null
      );


      setSelectedRole(
        ""
      );


      setSelectedMarketplace(
        ""
      );


      setRequestActionError(
        null
      );


      setApprovalResult(
        null
      );


      setCopyStatus(
        "idle"
      );

    } catch {

      setRequestActionError(
        "Не удалось отклонить заявку"
      );

    } finally {

      setRequestAction(
        null
      );

    }

  }


  async function copyTemporaryPassword() {

    if (
      !approvalResult
    ) {

      return;

    }


    try {

      await navigator
        .clipboard
        .writeText(
          approvalResult
            .temporaryPassword
        );


      setCopyStatus(
        "copied"
      );

    } catch {

      setCopyStatus(
        "error"
      );

    }

  }


  // ==========================================================
  // PROFILE MENU / LOGOUT
  // ==========================================================

  function toggleProfileMenu() {

    setOpenPanel(
      current =>
        current ===
          "profile"

          ? null

          : "profile"
    );

  }


  async function handleLogout() {

    if (
      logoutLoading
    ) {

      return;

    }


    setLogoutLoading(
      true
    );


    try {

      const supabase =
        createClient();


      const {
        error,
      } =
        await supabase
          .auth
          .signOut();


      if (
        error
      ) {

        console.error(
          "Ошибка выхода:",
          error
        );


        setLogoutLoading(
          false
        );


        return;

      }


      setOpenPanel(
        null
      );


      router.replace(
        "/login"
      );


      router.refresh();

    } catch (
      error
    ) {

      console.error(
        "Ошибка выхода:",
        error
      );


      setLogoutLoading(
        false
      );

    }

  }


  const unreadCount =
    notifications.length;


  const currentUserTasks =
    useMemo(
      () =>
        adminMode
          ? buildAdministratorTasks(
              currentProfile
            )
          : buildCurrentUserTasks(
              currentProfile
            ),
      [
        adminMode,
        currentProfile,
      ]
    );


  const canApprove =
    selectedRole !==
      ""
    &&
    (
      selectedRole !==
        "category_manager"
      ||
      selectedMarketplace !==
        ""
    )
    &&
    requestAction ===
      null;


  // ==========================================================
  // PROFILE VALUES
  // ==========================================================

  const profileFirstName =
    currentProfile
      ?.first_name
      ?.trim()
    ||
    "";


  const profileLastName =
    currentProfile
      ?.last_name
      ?.trim()
    ||
    "";


  const profileFullName =
    [
      profileFirstName,
      profileLastName,
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      )
    ||
    (
      profileLoading

        ? "Загрузка..."

        : "Пользователь"
    );


  const profileRoleName =
    currentProfile
      ?.role_name
      ?.trim()
    ||
    (
      profileLoading

        ? "Загрузка..."

        : "Роль не определена"
    );


  const profileEmail =
    currentProfile
      ?.email
      ?.trim()
    ||
    "";


  const profileAdminRole =
    currentProfile
      ?.has_admin_access

      ? (
          currentProfile
            .admin_role_name
          ||
          "Администратор"
        )

      : null;


  const profileInitials =
    currentProfile

      ? getProfileInitials(
          profileFirstName,
          profileLastName
        )

      : profileLoading

        ? "··"

        : "П";


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
                  &&
                  requestAction ===
                    null
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

                disabled={
                  requestAction !==
                    null
                }
              >

                <CloseIcon />

              </button>


              {
                approvalResult

                  ? (

                    <>

                      <div
                        className={
                          styles.modalHeader
                        }
                      >

                        <h2
                          id=
                            "access-request-title"
                        >
                          Доступ одобрен
                        </h2>


                        <p>
                          Учётная запись создана.
                          Передайте сотруднику email
                          и временный пароль.
                        </p>

                      </div>


                      <div
                        className={
                          styles.successBox
                        }
                      >

                        <div
                          className={
                            styles.successTitle
                          }
                        >
                          Сотрудник создан
                        </div>


                        <div
                          className={
                            styles.credentialRow
                          }
                        >

                          <span
                            className={
                              styles.credentialLabel
                            }
                          >
                            Сотрудник
                          </span>


                          <strong
                            className={
                              styles.credentialValue
                            }
                          >
                            {
                              approvalResult
                                .fullName
                            }
                          </strong>

                        </div>


                        <div
                          className={
                            styles.credentialRow
                          }
                        >

                          <span
                            className={
                              styles.credentialLabel
                            }
                          >
                            Email
                          </span>


                          <strong
                            className={
                              styles.credentialValue
                            }
                          >
                            {
                              approvalResult
                                .email
                            }
                          </strong>

                        </div>


                        <div
                          className={
                            styles.passwordBlock
                          }
                        >

                          <span
                            className={
                              styles.credentialLabel
                            }
                          >
                            Временный пароль
                          </span>


                          <div
                            className={
                              styles.passwordLine
                            }
                          >

                            <code
                              className={
                                styles.passwordValue
                              }
                            >
                              {
                                approvalResult
                                  .temporaryPassword
                              }
                            </code>


                            <button
                              type="button"

                              className={
                                styles.copyButton
                              }

                              onClick={
                                copyTemporaryPassword
                              }
                            >
                              {
                                copyStatus ===
                                  "copied"

                                  ? "Скопировано"

                                  : copyStatus ===
                                      "error"

                                    ? "Ошибка копирования"

                                    : "Копировать"
                              }
                            </button>

                          </div>

                        </div>

                      </div>


                      <div
                        className={
                          styles.warningNote
                        }
                      >
                        Этот временный пароль
                        показывается здесь только
                        сейчас. После первого входа
                        сотрудник будет обязан
                        создать собственный пароль.
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
                          После закрытия окна
                          временный пароль повторно
                          в WorkSpace показан не будет.
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

                    </>

                  )

                  : (

                    <>

                      <div
                        className={
                          styles.modalHeader
                        }
                      >

                        <h2
                          id=
                            "access-request-title"
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
                                    event
                                      .currentTarget
                                      .value
                                  )
                                )
                            }

                            disabled={
                              requestAction !==
                                null
                            }
                          >

                            {
                              WORKING_ROLES.map(
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
                              )
                            }

                          </select>

                        </div>


                        {
                          selectedRole ===
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
                                  event => {

                                    setSelectedMarketplace(
                                      getCategoryMarketplace(
                                        event
                                          .currentTarget
                                          .value
                                      )
                                    );


                                    setRequestActionError(
                                      null
                                    );

                                  }
                                }

                                disabled={
                                  requestAction !==
                                    null
                                }
                              >

                                {
                                  MARKETPLACES.map(
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
                                  )
                                }

                              </select>

                            </div>

                          )
                        }


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


                      {
                        requestActionError
                        &&
                        (

                          <div
                            className={
                              styles.actionError
                            }

                            role="alert"
                          >
                            {
                              requestActionError
                            }
                          </div>

                        )
                      }


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
                          При одобрении будет создана
                          учётная запись с временным
                          паролем и выбранной ролью.
                        </span>


                        <div
                          className={
                            styles.footerActions
                          }
                        >

                          <button
                            type="button"

                            className={
                              styles.rejectButton
                            }

                            onClick={
                              handleRejectAccessRequest
                            }

                            disabled={
                              requestAction !==
                                null
                            }
                          >
                            {
                              requestAction ===
                                "reject"

                                ? "Отклоняем..."

                                : "Отклонить"
                            }
                          </button>


                          <button
                            type="button"

                            className={
                              styles.approveButton
                            }

                            onClick={
                              handleApproveAccessRequest
                            }

                            disabled={
                              !canApprove
                            }
                          >
                            {
                              requestAction ===
                                "approve"

                                ? "Одобряем..."

                                : "Одобрить"
                            }
                          </button>

                        </div>

                      </div>

                    </>

                  )
              }

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
        className=
          "home-topbar-right"

        ref={
          actionsRef
        }
      >

        {/* ====================================================
            TASKS
        ==================================================== */}

        <div
          className=
            "home-action-wrapper"
        >

          <button
            type="button"

            className={
              openPanel ===
                "tasks"

                ? "home-icon-button active"

                : "home-icon-button"
            }

            aria-label=
              "Задачи"

            aria-expanded={
              openPanel ===
                "tasks"
            }

            onClick={
              toggleTasks
            }
          >

            <HomeTasksIcon />

          </button>


          {
            openPanel ===
              "tasks"
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
                    Мои задачи
                  </strong>
                </div>


                {
                  currentUserTasks.length ===
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
                          <HomeTasksIcon />
                        </div>


                        <strong>
                          Задач нет
                        </strong>


                        <span>
                          Здесь будут задачи,
                          назначенные именно вам.
                        </span>

                      </div>

                    )

                    : (

                      <div
                        className={
                          styles.taskPopupList
                        }
                      >

                        {
                          currentUserTasks.map(
                            task => (

                              <div
                                key={
                                  task.id
                                }

                                className=
                                  {
                                    styles.taskPopupItem
                                  }
                              >

                                <span
                                  className={
                                    `${styles.taskUrgencyDot} ${
                                      task.status ===
                                        "red"

                                        ? styles.taskUrgencyRed

                                        : task.status ===
                                            "yellow"

                                          ? styles.taskUrgencyYellow

                                          : styles.taskUrgencyGreen
                                    }`
                                  }
                                />


                                <div
                                  className={
                                    styles.taskPopupCopy
                                  }
                                >

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
                        }

                      </div>

                    )
                }

              </div>

            )
          }

        </div>


        {/* ====================================================
            NOTIFICATIONS
        ==================================================== */}

        <div
          className=
            "home-action-wrapper"
        >

          <button
            type="button"

            className={
              openPanel ===
                "notifications"

                ? "home-icon-button active"

                : "home-icon-button"
            }

            aria-label=
              "Уведомления"

            aria-expanded={
              openPanel ===
                "notifications"
            }

            onClick={
              toggleNotifications
            }
          >

            <HomeBellIcon />


            {
              unreadCount > 0
              &&
              (

                <span
                  className=
                    "home-notification-badge"
                >
                  {
                    unreadCount
                  }
                </span>

              )
            }

          </button>


          {
            openPanel ===
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


                {
                  notificationsLoading
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
                          <HomeBellIcon />
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

                    : notificationsError
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
                            <HomeBellIcon />
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

                      : notifications.length ===
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
                              <HomeBellIcon />
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

                            {
                              notifications.map(
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
                                        notification
                                          .createdAt

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
                              )
                            }

                          </div>

                        )
                }

              </div>

            )
          }

        </div>


        {/* ====================================================
            CALENDAR
        ==================================================== */}

        <div
          className=
            "home-action-wrapper"
        >

          <button
            type="button"

            className={
              openPanel ===
                "calendar"

                ? "home-icon-button active"

                : "home-icon-button"
            }

            aria-label=
              "Календарь"

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


          {
            openPanel ===
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

                  {
                    WEEK_DAYS.map(
                      day => (

                        <span
                          key={
                            day
                          }
                        >
                          {
                            day
                          }
                        </span>

                      )
                    )
                  }

                </div>


                <div
                  className="
                    home-calendar-grid
                  "
                >

                  {
                    calendarCells.map(
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

                                ? "home-calendar-day today"

                                : "home-calendar-day"
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
                    )
                  }

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

            )
          }

        </div>


        <div
          className=
            "home-topbar-divider"
        />


        {/* ====================================================
            THEME
        ==================================================== */}

        <HomeThemeToggle />


        {/* ====================================================
            WORKSPACE MODE
        ==================================================== */}

        {
          currentProfile
            ?.has_admin_access
          &&
          (

            <>

              <div
                className=
                  "home-topbar-divider"
              />


              <WorkspaceModeSwitcher />

            </>

          )
        }


        <div
          className=
            "home-topbar-divider"
        />


        {/* ====================================================
            PROFILE
        ==================================================== */}

        <div
          className={
            styles.profileWrapper
          }
        >

          <button
            type="button"

            className=
              "home-profile"

            aria-label=
              "Меню пользователя"

            aria-expanded={
              openPanel ===
                "profile"
            }

            onClick={
              toggleProfileMenu
            }
          >

            <span
              className=
                "home-avatar"

              style={{
                overflow:
                  "hidden",
              }}
            >

              {
                profileAvatarUrl

                  ? (

                    <img
                      src={
                        profileAvatarUrl
                      }

                      alt=""

                      style={{
                        display:
                          "block",

                        width:
                          "100%",

                        height:
                          "100%",

                        objectFit:
                          "cover",
                      }}
                    />

                  )

                  : profileInitials
              }

            </span>


            <span
              className=
                "home-profile-text"
            >

              <strong>
                {
                  profileFullName
                }
              </strong>


              <span>
                {
                  profileRoleName
                }
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


          {
            openPanel ===
              "profile"
            &&
            (

              <div
                className={
                  styles.profileMenu
                }
              >

                <div
                  className={
                    styles.profileMenuHeader
                  }
                >

                  <strong
                    className={
                      styles.profileMenuName
                    }
                  >
                    {
                      profileFullName
                    }
                  </strong>


                  {
                    profileEmail
                    &&
                    (

                      <span
                        className={
                          styles.profileMenuEmail
                        }
                      >
                        {
                          profileEmail
                        }
                      </span>

                    )
                  }


                  <div
                    className={
                      styles.profileMenuRole
                    }
                  >
                    Рабочая роль:
                    {" "}
                    {
                      profileRoleName
                    }
                  </div>


                  {
                    profileAdminRole
                    &&
                    (

                      <div
                        className={
                          styles.profileMenuAdmin
                        }
                      >
                        {
                          profileAdminRole
                        }
                      </div>

                    )
                  }

                </div>


                <div
                  className={
                    styles.profileMenuActions
                  }
                >

                  <Link
                    href="/profile"

                    className={
                      styles.profileMenuLink
                    }

                    onClick={
                      () =>
                        setOpenPanel(
                          null
                        )
                    }
                  >
                    Мой профиль
                  </Link>


                  <button
                    type="button"

                    className={
                      styles.profileMenuButton
                    }

                    onClick={
                      handleLogout
                    }

                    disabled={
                      logoutLoading
                    }
                  >
                    {
                      logoutLoading

                        ? "Выходим..."

                        : "Выйти"
                    }
                  </button>

                </div>

              </div>

            )
          }

        </div>

      </div>


      {
        accessRequestModal
      }

    </>

  );

}
