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


type AdminLevel =
  | "none"
  | "admin"
  | "senior_admin";


type AdminUserRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role_name: string;
  admin_level: AdminLevel;
  admin_role_name: string | null;
  has_admin_access: boolean;
};


type StatusType =
  | "idle"
  | "success"
  | "error";


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


function getBadgeClass(
  level: AdminLevel
) {

  if (
    level ===
      "senior_admin"
  ) {

    return `
      admin-level-badge
      admin-level-badge-senior
    `;

  }


  if (
    level ===
      "admin"
  ) {

    return `
      admin-level-badge
      admin-level-badge-admin
    `;

  }


  return "admin-level-badge";

}


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
            ) as
              AdminUserRow[];


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


  const currentUser =
    useMemo(
      () =>
        users.find(
          user =>
            user.user_id ===
              currentUserId
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


  async function handleAdminLevelChange(
    targetUser:
      AdminUserRow,

    nextLevel:
      AdminLevel
  ) {

    if (
      !canManageAdminLevels
      ||
      changingUserId !==
        null
      ||
      targetUser.admin_level ===
        nextLevel
    ) {

      return;

    }


    setChangingUserId(
      targetUser.user_id
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
                user.user_id !==
                  targetUser.user_id
              ) {

                return user;

              }


              return {
                ...user,

                admin_level:
                  nextLevel,

                has_admin_access:
                  nextLevel !==
                    "none",

                admin_role_name:
                  nextLevel ===
                    "senior_admin"

                    ? "Старший администратор"

                    : nextLevel ===
                        "admin"

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


      /*
       * Если текущий Старший администратор
       * изменил собственные права, серверный
       * layout должен сразу перепроверить доступ.
       */
      if (
        targetUser.user_id ===
          currentUserId
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


  return (

    <div
      className=
        "admin-users"
    >

      <div
        className=
          "admin-users-note"
      >

        {
          canManageAdminLevels

            ? (

              <>
                <strong>
                  Старший администратор:
                </strong>

                {" "}

                вы можете выдавать,
                изменять и снимать
                административные права.
              </>

            )

            : (

              <>
                <strong>
                  Администратор:
                </strong>

                {" "}

                список сотрудников доступен
                для просмотра. Изменять
                административные права может
                только Старший администратор.
              </>

            )
        }

      </div>


      <div
        className={
          status ===
            "error"

            ? `
                admin-users-status
                admin-users-status-error
              `

            : status ===
                "success"

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
        className=
          "admin-users-card"
      >

        {
          loading

            ? (

              <div
                className=
                  "admin-users-loading"
              >
                Загружаем сотрудников...
              </div>

            )

            : users.length ===
                0

              ? (

                <div
                  className=
                    "admin-users-empty"
                >
                  Сотрудники не найдены
                </div>

              )

              : (

                <div
                  className=
                    "admin-users-table-wrap"
                >

                  <table
                    className=
                      "admin-users-table"
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

                      </tr>

                    </thead>


                    <tbody>

                      {
                        users.map(
                          user => (

                            <tr
                              key={
                                user.user_id
                              }
                            >

                              <td>

                                <div
                                  className=
                                    "admin-user-main"
                                >

                                  <span
                                    className=
                                      "admin-user-name"
                                  >

                                    {
                                      user.first_name
                                    }

                                    {" "}

                                    {
                                      user.last_name
                                    }


                                    {
                                      user.user_id ===
                                        currentUserId
                                      &&
                                      (

                                        <span
                                          className=
                                            "admin-user-you"
                                        >
                                          Вы
                                        </span>

                                      )
                                    }

                                  </span>


                                  <span
                                    className=
                                      "admin-user-email"
                                  >
                                    {
                                      user.email
                                    }
                                  </span>

                                </div>

                              </td>


                              <td>

                                <span
                                  className=
                                    "admin-user-role"
                                >
                                  {
                                    user.role_name
                                  }
                                </span>

                              </td>


                              <td>

                                {
                                  canManageAdminLevels

                                    ? (

                                      <select
                                        className=
                                          "admin-level-select"

                                        value={
                                          user.admin_level
                                        }

                                        disabled={
                                          changingUserId !==
                                            null
                                        }

                                        onChange={
                                          event =>
                                            void handleAdminLevelChange(
                                              user,
                                              event
                                                .currentTarget
                                                .value
                                                as AdminLevel
                                            )
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

                            </tr>

                          )
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
