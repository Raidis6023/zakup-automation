"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "../../../lib/supabase/client";

// ============================================================
// TYPES
// ============================================================

type AdminLevel =
  | "none"
  | "admin"
  | "senior_admin";


type WorkingRole =
  | "analyst"
  | "procurement"
  | "ved"
  | "category_manager"
  | "marketing"
  | "manager";


type CategoryMarketplace =
  | "ozon"
  | "wildberries"
  | "yandex_market";


type AdminUserRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;

  system_role: WorkingRole | null;
  role_name: string;

  category_marketplace: CategoryMarketplace | null;
  category_marketplace_name: string | null;

  admin_level: AdminLevel;
  admin_role_name: string | null;
  has_admin_access: boolean;

  can_manage_working_role: boolean;

  is_blocked: boolean;
  blocked_at: string | null;
  blocked_by: string | null;

  can_manage_blocking: boolean;
};


type StatusType =
  | "idle"
  | "success"
  | "error";


// ============================================================
// CONSTANTS
// ============================================================

const WORKING_ROLES: Array<{
  value: WorkingRole;
  label: string;
}> = [
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


const MARKETPLACES: Array<{
  value: CategoryMarketplace;
  label: string;
}> = [
  {
    value: "ozon",
    label: "Ozon",
  },
  {
    value: "wildberries",
    label: "WB",
  },
  {
    value: "yandex_market",
    label: "ЯМ",
  },
];


// ============================================================
// HELPERS
// ============================================================

function getAdminLevelLabel(
  level: AdminLevel
) {

  switch (
    level
  ) {

    case "admin":
      return "Администратор";

    case "senior_admin":
      return "Старший администратор";

    default:
      return "Без административных прав";

  }

}


function getAdminLevel(
  value: string
): AdminLevel {

  switch (
    value
  ) {

    case "admin":
      return "admin";

    case "senior_admin":
      return "senior_admin";

    default:
      return "none";

  }

}


function getWorkingRole(
  value: string
): WorkingRole | null {

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
      return null;

  }

}


function getMarketplace(
  value: string
): CategoryMarketplace | null {

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
      return null;

  }

}


function getRoleLabel(
  role: WorkingRole,
  marketplace: CategoryMarketplace | null = null
) {

  if (
    role === "category_manager"
  ) {

    if (
      marketplace === "ozon"
    ) {

      return "Категорийный менеджер / Ozon";

    }


    if (
      marketplace === "wildberries"
    ) {

      return "Категорийный менеджер / WB";

    }


    if (
      marketplace === "yandex_market"
    ) {

      return "Категорийный менеджер / ЯМ";

    }


    return "Категорийный менеджер";

  }


  const item =
    WORKING_ROLES.find(
      option =>
        option.value === role
    );


  return (
    item?.label
    ??
    "Роль не назначена"
  );

}


function getMarketplaceLabel(
  marketplace: CategoryMarketplace
) {

  const item =
    MARKETPLACES.find(
      option =>
        option.value === marketplace
    );


  return (
    item?.label
    ??
    ""
  );

}


function getBadgeClass(
  level: AdminLevel
) {

  if (
    level === "senior_admin"
  ) {

    return `
      admin-level-badge
      admin-level-badge-senior
    `;

  }


  if (
    level === "admin"
  ) {

    return `
      admin-level-badge
      admin-level-badge-admin
    `;

  }


  return "admin-level-badge";

}


function TrashIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />

    </svg>

  );

}


// ============================================================
// COMPONENT
// ============================================================

export default function AdminUsersPanel() {

  const router =
    useRouter();


  const [
    users,
    setUsers,
  ] =
    useState<
      AdminUserRow[]
    >(
      []
    );


  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    changingUserId,
    setChangingUserId,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    pendingCategoryUserId,
    setPendingCategoryUserId,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    status,
    setStatus,
  ] =
    useState<
      StatusType
    >(
      "idle"
    );


  const [
    statusMessage,
    setStatusMessage,
  ] =
    useState(
      ""
    );


  // ==========================================================
  // LOAD USERS
  // ==========================================================

  const loadUsers =
    useCallback(
      async () => {

        setLoading(
          true
        );


        setStatus(
          "idle"
        );


        setStatusMessage(
          ""
        );


        try {

          const supabase =
            createClient();


          const {
            data: {
              user,
            },
            error:
              userError,
          } =
            await supabase
              .auth
              .getUser();


          if (
            userError
            ||
            !user
          ) {

            setStatus(
              "error"
            );


            setStatusMessage(
              "Не удалось определить текущего пользователя"
            );


            return;

          }


          setCurrentUserId(
            user.id
          );


          const {
            data,
            error,
          } =
            await supabase
              .rpc(
                "app_get_admin_users"
              );


          if (
            error
          ) {

            console.error(
              "Ошибка загрузки сотрудников:",
              error
            );


            setStatus(
              "error"
            );


            setStatusMessage(
              "Не удалось загрузить список сотрудников"
            );


            return;

          }


          const rows =
            (
              data
              ??
              []
            ) as AdminUserRow[];


          setUsers(
            rows
          );

        } catch (
          error
        ) {

          console.error(
            "Ошибка загрузки сотрудников:",
            error
          );


          setStatus(
            "error"
          );


          setStatusMessage(
            "Не удалось загрузить список сотрудников"
          );

        } finally {

          setLoading(
            false
          );

        }

      },
      []
    );


  useEffect(
    () => {

      void loadUsers();

    },
    [
      loadUsers,
    ]
  );


  // ==========================================================
  // CURRENT USER
  // ==========================================================

  const currentUser =
    useMemo(
      () =>
        users.find(
          user =>
            user.user_id === currentUserId
        )
        ??
        null,
      [
        users,
        currentUserId,
      ]
    );


  const canManageAdminLevels =
    currentUser
      ?.admin_level ===
        "senior_admin";


  // ==========================================================
  // STATUS
  // ==========================================================

  function clearStatus() {

    setStatus(
      "idle"
    );


    setStatusMessage(
      ""
    );

  }


  // ==========================================================
  // CHANGE WORKING ROLE
  // ==========================================================

  async function saveWorkingRole(
    targetUser: AdminUserRow,
    nextRole: WorkingRole,
    nextMarketplace: CategoryMarketplace | null
  ) {

    if (
      !targetUser.can_manage_working_role
      ||
      changingUserId !== null
    ) {

      return;

    }


    setChangingUserId(
      targetUser.user_id
    );


    clearStatus();


    try {

      const supabase =
        createClient();


      const {
        error,
      } =
        await supabase
          .rpc(
            "app_set_user_working_role",
            {
              target_user_id:
                targetUser.user_id,

              new_system_role:
                nextRole,

              new_category_marketplace:
                nextMarketplace,
            }
          );


      if (
        error
      ) {

        console.error(
          "Ошибка изменения рабочей роли:",
          error
        );


        setStatus(
          "error"
        );


        setStatusMessage(
          error.message
          ||
          "Не удалось изменить рабочую роль"
        );


        return;

      }


      setUsers(
        current =>
          current.map(
            user => {

              if (
                user.user_id !== targetUser.user_id
              ) {

                return user;

              }


              return {
                ...user,

                system_role:
                  nextRole,

                role_name:
                  getRoleLabel(
                    nextRole,
                    nextMarketplace
                  ),

                category_marketplace:
                  nextMarketplace,

                category_marketplace_name:
                  nextMarketplace

                    ? getMarketplaceLabel(
                        nextMarketplace
                      )

                    : null,
              };

            }
          )
      );


      setPendingCategoryUserId(
        null
      );


      setStatus(
        "success"
      );


      setStatusMessage(
        `Рабочая роль пользователя ${
          targetUser.first_name
        } ${
          targetUser.last_name
        } обновлена`
      );


      if (
        targetUser.user_id === currentUserId
      ) {

        window.location.reload();

      }

    } catch (
      error
    ) {

      console.error(
        "Ошибка изменения рабочей роли:",
        error
      );


      setStatus(
        "error"
      );


      setStatusMessage(
        "Не удалось изменить рабочую роль"
      );

    } finally {

      setChangingUserId(
        null
      );

    }

  }


  function handleWorkingRoleChange(
    targetUser: AdminUserRow,
    value: string
  ) {

    const nextRole =
      getWorkingRole(
        value
      );


    if (
      !nextRole
    ) {

      return;

    }


    clearStatus();


    if (
      nextRole === "category_manager"
      &&
      targetUser.system_role !== "category_manager"
    ) {

      setPendingCategoryUserId(
        targetUser.user_id
      );


      return;

    }


    setPendingCategoryUserId(
      null
    );


    if (
      nextRole === targetUser.system_role
    ) {

      return;

    }


    void saveWorkingRole(
      targetUser,
      nextRole,
      null
    );

  }


  function handleMarketplaceChange(
    targetUser: AdminUserRow,
    value: string
  ) {

    const nextMarketplace =
      getMarketplace(
        value
      );


    if (
      !nextMarketplace
    ) {

      return;

    }


    void saveWorkingRole(
      targetUser,
      "category_manager",
      nextMarketplace
    );

  }


  // ==========================================================
  // CHANGE ADMIN LEVEL
  // ==========================================================

  async function handleAdminLevelChange(
    targetUser: AdminUserRow,
    nextLevel: AdminLevel
  ) {

    if (
      !canManageAdminLevels
      ||
      changingUserId !== null
      ||
      targetUser.admin_level === nextLevel
    ) {

      return;

    }


    setChangingUserId(
      targetUser.user_id
    );


    clearStatus();


    try {

      const supabase =
        createClient();


      const {
        error,
      } =
        await supabase
          .rpc(
            "app_set_user_admin_level",
            {
              target_user_id:
                targetUser.user_id,

              new_admin_level:
                nextLevel,
            }
          );


      if (
        error
      ) {

        console.error(
          "Ошибка изменения административных прав:",
          error
        );


        setStatus(
          "error"
        );


        setStatusMessage(
          error.message
          ||
          "Не удалось изменить административные права"
        );


        return;

      }


      setUsers(
        current =>
          current.map(
            user => {

              if (
                user.user_id !== targetUser.user_id
              ) {

                return user;

              }


              return {
                ...user,

                admin_level:
                  nextLevel,

                has_admin_access:
                  nextLevel !== "none",

                admin_role_name:
                  nextLevel === "senior_admin"

                    ? "Старший администратор"

                    : nextLevel === "admin"

                      ? "Администратор"

                      : null,
              };

            }
          )
      );


      setStatus(
        "success"
      );


      setStatusMessage(
        `Права пользователя ${
          targetUser.first_name
        } ${
          targetUser.last_name
        } обновлены`
      );


      if (
        targetUser.user_id === currentUserId
      ) {

        router.refresh();

      }

    } catch (
      error
    ) {

      console.error(
        "Ошибка изменения административных прав:",
        error
      );


      setStatus(
        "error"
      );


      setStatusMessage(
        "Не удалось изменить административные права"
      );

    } finally {

      setChangingUserId(
        null
      );

    }

  }


  // ==========================================================
  // BLOCK / UNBLOCK USER
  // ==========================================================

  async function handleBlockedChange(
    targetUser: AdminUserRow
  ) {

    if (
      !targetUser.can_manage_blocking
      ||
      changingUserId !== null
    ) {

      return;

    }


    const nextBlocked =
      !targetUser.is_blocked;


    const actionConfirmed =
      window.confirm(
        nextBlocked

          ? `Заблокировать пользователя ${targetUser.first_name} ${targetUser.last_name}?`

          : `Разблокировать пользователя ${targetUser.first_name} ${targetUser.last_name}?`
      );


    if (
      !actionConfirmed
    ) {

      return;

    }


    setChangingUserId(
      targetUser.user_id
    );


    clearStatus();


    try {

      const supabase =
        createClient();


      const {
        error,
      } =
        await supabase
          .rpc(
            "app_set_user_blocked",
            {
              target_user_id:
                targetUser.user_id,

              new_is_blocked:
                nextBlocked,
            }
          );


      if (
        error
      ) {

        console.error(
          "Ошибка изменения блокировки:",
          error
        );


        setStatus(
          "error"
        );


        setStatusMessage(
          error.message
          ||
          "Не удалось изменить состояние учётной записи"
        );


        return;

      }


      setUsers(
        current =>
          current.map(
            user => {

              if (
                user.user_id !== targetUser.user_id
              ) {

                return user;

              }


              return {
                ...user,

                is_blocked:
                  nextBlocked,

                blocked_at:
                  nextBlocked
                    ? new Date().toISOString()
                    : null,

                blocked_by:
                  nextBlocked
                    ? currentUserId
                    : null,
              };

            }
          )
      );


      setStatus(
        "success"
      );


      setStatusMessage(
        nextBlocked

          ? `Пользователь ${targetUser.first_name} ${targetUser.last_name} заблокирован`

          : `Пользователь ${targetUser.first_name} ${targetUser.last_name} разблокирован`
      );

    } catch (
      error
    ) {

      console.error(
        "Ошибка изменения блокировки:",
        error
      );


      setStatus(
        "error"
      );


      setStatusMessage(
        "Не удалось изменить состояние учётной записи"
      );

    } finally {

      setChangingUserId(
        null
      );

    }

  }


  // ==========================================================
  // DELETE USER
  // ==========================================================

  async function handleDeleteUser(
    targetUser:
      AdminUserRow
  ) {

    if (
      !canManageAdminLevels
      ||
      changingUserId !== null
      ||
      targetUser.user_id === currentUserId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Удалить пользователя ${targetUser.first_name} ${targetUser.last_name} полностью? Будут удалены имя, фамилия, email, пароль, фото и доступ к WorkSpace. Действие необратимо.`
      );

    if (!confirmed) {
      return;
    }

    setChangingUserId(
      targetUser.user_id
    );

    clearStatus();

    try {
      const response =
        await fetch(
          "/api/admin/users/delete",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  targetUserId:
                    targetUser.user_id,
                }
              ),
          }
        );

      const result =
        await response.json() as
          {
            ok: boolean;
            error?: string;
            warning?: string;
          };

      if (
        !response.ok
        ||
        !result.ok
      ) {
        setStatus("error");
        setStatusMessage(
          result.error
          ??
          "Не удалось удалить пользователя"
        );
        return;
      }

      setUsers(
        current =>
          current.filter(
            user =>
              user.user_id !==
              targetUser.user_id
          )
      );

      setStatus("success");
      setStatusMessage(
        result.warning
          ? `Пользователь ${targetUser.first_name} ${targetUser.last_name} удалён. ${result.warning}`
          : `Пользователь ${targetUser.first_name} ${targetUser.last_name} удалён полностью`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Ошибка удаления пользователя:",
        error
      );
      setStatus("error");
      setStatusMessage(
        "Не удалось удалить пользователя"
      );
    } finally {
      setChangingUserId(null);
    }
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div
      className="admin-users"
    >

      <div
        className="admin-users-note"
      >

        {
          canManageAdminLevels

            ? (

              <>

                <strong>
                  Старший администратор:
                </strong>

                {" "}

                вы можете изменять рабочие роли,
                административные права и состояние
                учётных записей сотрудников.

              </>

            )

            : (

              <>

                <strong>
                  Администратор:
                </strong>

                {" "}

                вы можете изменять рабочие роли
                и блокировать обычных сотрудников.
                Административные права изменяет
                только Старший администратор.

              </>

            )
        }

      </div>


      <div
        className={
          status === "error"

            ? `
                admin-users-status
                admin-users-status-error
              `

            : status === "success"

              ? `
                  admin-users-status
                  admin-users-status-success
                `

              : "admin-users-status"
        }

        aria-live="polite"
      >
        {
          statusMessage
        }
      </div>


      <div
        className="admin-users-card"
      >

        {
          loading

            ? (

              <div
                className="admin-users-loading"
              >
                Загружаем сотрудников...
              </div>

            )

            : users.length === 0

              ? (

                <div
                  className="admin-users-empty"
                >
                  Сотрудники не найдены
                </div>

              )

              : (

                <div
                  className="admin-users-table-wrap"
                >

                  <table
                    className="admin-users-table"
                  >

                    <thead>

                      <tr>

                        <th>
                          Сотрудник
                        </th>


                        <th>
                          Рабочая роль
                        </th>


                        <th>
                          Административные права
                        </th>


                        <th>
                          Статус
                        </th>


                        <th>
                          Управление
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {
                        users.map(
                          user => {

                            const pendingCategory =
                              pendingCategoryUserId ===
                                user.user_id;


                            const displayedRole =
                              pendingCategory

                                ? "category_manager"

                                : user.system_role;


                            const showMarketplace =
                              displayedRole ===
                                "category_manager";


                            return (

                              <tr
                                key={
                                  user.user_id
                                }
                              >

                                <td>

                                  <div
                                    className="admin-user-main"
                                  >

                                    <span
                                      className="admin-user-name"
                                    >

                                      {
                                        user.first_name
                                      }

                                      {" "}

                                      {
                                        user.last_name
                                      }


                                      {
                                        user.user_id === currentUserId
                                        &&
                                        (

                                          <span
                                            className="admin-user-you"
                                          >
                                            Вы
                                          </span>

                                        )
                                      }

                                    </span>


                                    <span
                                      className="admin-user-email"
                                    >
                                      {
                                        user.email
                                      }
                                    </span>

                                  </div>

                                </td>


                                <td>

                                  {
                                    user.can_manage_working_role

                                      ? (

                                        <div
                                          className="admin-role-control"
                                        >

                                          <select
                                            className="admin-working-role-select"

                                            value={
                                              displayedRole
                                              ??
                                              ""
                                            }

                                            disabled={
                                              changingUserId !== null
                                            }

                                            onChange={
                                              event => {

                                                handleWorkingRoleChange(
                                                  user,
                                                  event
                                                    .currentTarget
                                                    .value
                                                );

                                              }
                                            }
                                          >

                                            {
                                              !displayedRole
                                              &&
                                              (

                                                <option
                                                  value=""
                                                  disabled
                                                >
                                                  Роль не назначена
                                                </option>

                                              )
                                            }


                                            {
                                              WORKING_ROLES.map(
                                                role => (

                                                  <option
                                                    key={
                                                      role.value
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


                                          {
                                            showMarketplace
                                            &&
                                            (

                                              <select
                                                className="admin-marketplace-select"

                                                value={
                                                  pendingCategory

                                                    ? ""

                                                    : (
                                                        user
                                                          .category_marketplace
                                                        ??
                                                        ""
                                                      )
                                                }

                                                disabled={
                                                  changingUserId !== null
                                                }

                                                onChange={
                                                  event => {

                                                    handleMarketplaceChange(
                                                      user,
                                                      event
                                                        .currentTarget
                                                        .value
                                                    );

                                                  }
                                                }
                                              >

                                                <option
                                                  value=""
                                                  disabled
                                                >
                                                  Выберите маркетплейс
                                                </option>


                                                {
                                                  MARKETPLACES.map(
                                                    marketplace => (

                                                      <option
                                                        key={
                                                          marketplace.value
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

                                            )
                                          }

                                        </div>

                                      )

                                      : (

                                        <div
                                          className="admin-user-role"
                                        >

                                          <span
                                            className="admin-role-locked"
                                          >
                                            {
                                              user.role_name
                                            }
                                          </span>


                                          {
                                            user
                                              .category_marketplace_name
                                            &&
                                            (

                                              <span
                                                className="admin-user-marketplace"
                                              >
                                                {
                                                  user
                                                    .category_marketplace_name
                                                }
                                              </span>

                                            )
                                          }

                                        </div>

                                      )
                                  }

                                </td>


                                <td>

                                  {
                                    canManageAdminLevels

                                      ? (

                                        <select
                                          className="admin-level-select"

                                          value={
                                            user.admin_level
                                          }

                                          disabled={
                                            changingUserId !== null
                                          }

                                          onChange={
                                            event => {

                                              const nextLevel =
                                                getAdminLevel(
                                                  event
                                                    .currentTarget
                                                    .value
                                                );


                                              void handleAdminLevelChange(
                                                user,
                                                nextLevel
                                              );

                                            }
                                          }
                                        >

                                          <option
                                            value="none"
                                          >
                                            Без административных прав
                                          </option>


                                          <option
                                            value="admin"
                                          >
                                            Администратор
                                          </option>


                                          <option
                                            value="senior_admin"
                                          >
                                            Старший администратор
                                          </option>

                                        </select>

                                      )

                                      : (

                                        <span
                                          className={
                                            getBadgeClass(
                                              user.admin_level
                                            )
                                          }
                                        >
                                          {
                                            getAdminLevelLabel(
                                              user.admin_level
                                            )
                                          }
                                        </span>

                                      )
                                  }

                                </td>


                                <td>

                                  <span
                                    className={
                                      user.is_blocked

                                        ? `
                                            admin-account-status
                                            admin-account-status-blocked
                                          `

                                        : "admin-account-status"
                                    }
                                  >
                                    {
                                      user.is_blocked

                                        ? "Заблокирован"

                                        : "Активен"
                                    }
                                  </span>

                                </td>


                                <td>

                                  <div
                                    className="admin-blocking-control"
                                  >

                                    {
                                      user.can_manage_blocking

                                        ? (

                                          <button
                                            type="button"

                                            className={
                                              user.is_blocked

                                                ? `
                                                    admin-block-button
                                                    admin-unblock-button
                                                  `

                                                : "admin-block-button"
                                            }

                                            disabled={
                                              changingUserId !== null
                                            }

                                            onClick={
                                              () =>
                                                void handleBlockedChange(
                                                  user
                                                )
                                            }
                                          >
                                            {
                                              changingUserId ===
                                                user.user_id

                                                ? "Сохраняем..."

                                                : user.is_blocked

                                                  ? "Разблокировать"

                                                  : "Заблокировать"
                                            }
                                          </button>

                                        )

                                        : (

                                          <span
                                            className="admin-blocking-unavailable"
                                          >
                                            Недоступно
                                          </span>

                                        )
                                    }



                                    {
                                      canManageAdminLevels
                                      &&
                                      user.user_id !== currentUserId
                                      &&
                                      (

                                        <button
                                          type="button"
                                          className=
                                            "admin-delete-user-button"
                                          disabled={
                                            changingUserId !== null
                                          }
                                          onClick={
                                            () =>
                                              void handleDeleteUser(
                                                user
                                              )
                                          }
                                          aria-label={
                                            `Удалить пользователя ${user.first_name} ${user.last_name}`
                                          }
                                          title=
                                            "Удалить пользователя"
                                        >
                                          <TrashIcon />
                                        </button>

                                      )
                                    }
                                  </div>

                                </td>

                              </tr>

                            );

                          }
                        )
                      }

                    </tbody>

                  </table>

                </div>

              )
        }

      </div>

    </div>

  );

}
