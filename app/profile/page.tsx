import Link
  from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/server";

import "./profile.css";


type ProfileRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_path: string | null;
  role_name: string;
  has_admin_access: boolean;
  admin_role_name: string | null;
};


function getInitials(
  firstName: string,
  lastName: string
) {

  const first =
    firstName
      .trim()
      .charAt(
        0
      );


  const last =
    lastName
      .trim()
      .charAt(
        0
      );


  return (
    `${first}${last}`
      .toUpperCase()
    ||
    "П"
  );

}


export default async function ProfilePage() {

  const supabase =
    await createClient();


  const {
    data: {
      user,
    },
  } =
    await supabase
      .auth
      .getUser();


  if (
    !user
  ) {

    redirect(
      "/login"
    );

  }


  const {
    data,
    error,
  } =
    await supabase
      .rpc(
        "app_get_my_profile"
      );


  if (
    error
  ) {

    throw new Error(
      `Не удалось загрузить профиль: ${error.message}`
    );

  }


  const rawProfile =
    Array.isArray(
      data
    )

      ? data[0]

      : data;


  const profile =
    rawProfile as
      ProfileRow
      |
      null
      |
      undefined;


  if (
    !profile
  ) {

    throw new Error(
      "Профиль пользователя не найден"
    );

  }


  const fullName =
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
    ||
    "Пользователь";


  const initials =
    getInitials(
      profile.first_name,
      profile.last_name
    );


  const adminRole =
    profile.has_admin_access

      ? (
          profile.admin_role_name
          ||
          "Администратор"
        )

      : "Нет";


  return (

    <main
      className=
        "profile-page"
    >

      <div
        className=
          "profile-container"
      >

        <Link
          href="/"

          className=
            "profile-back"
        >
          ← На главную
        </Link>


        <header
          className=
            "profile-header"
        >

          <h1>
            Мой профиль
          </h1>


          <p>
            Основные данные вашей
            учётной записи WorkSpace.
          </p>

        </header>


        <section
          className=
            "profile-card"
        >

          <div
            className=
              "profile-main"
          >

            <div
              className=
                "profile-avatar"
            >
              {
                initials
              }
            </div>


            <div
              className=
                "profile-main-text"
            >

              <div
                className=
                  "profile-name"
              >
                {
                  fullName
                }
              </div>


              <div
                className=
                  "profile-role"
              >
                {
                  profile.role_name
                }
              </div>

            </div>

          </div>


          <div
            className=
              "profile-section"
          >

            <h2>
              Личные данные
            </h2>


            <div
              className=
                "profile-grid"
            >

              <div
                className=
                  "profile-field"
              >

                <span
                  className=
                    "profile-label"
                >
                  Имя
                </span>


                <span
                  className=
                    "profile-value"
                >
                  {
                    profile.first_name
                  }
                </span>

              </div>


              <div
                className=
                  "profile-field"
              >

                <span
                  className=
                    "profile-label"
                >
                  Фамилия
                </span>


                <span
                  className=
                    "profile-value"
                >
                  {
                    profile.last_name
                  }
                </span>

              </div>


              <div
                className=
                  "profile-field"
              >

                <span
                  className=
                    "profile-label"
                >
                  Email
                </span>


                <span
                  className=
                    "profile-value"
                >
                  {
                    profile.email
                  }
                </span>

              </div>

            </div>

          </div>


          <div
            className=
              "profile-section"
          >

            <h2>
              Доступ
            </h2>


            <div
              className=
                "profile-grid"
            >

              <div
                className=
                  "profile-field"
              >

                <span
                  className=
                    "profile-label"
                >
                  Рабочая роль
                </span>


                <span
                  className=
                    "profile-value"
                >
                  {
                    profile.role_name
                  }
                </span>

              </div>


              <div
                className=
                  "profile-field"
              >

                <span
                  className=
                    "profile-label"
                >
                  Административные права
                </span>


                <span
                  className=
                    "profile-value"
                >
                  {
                    adminRole
                  }
                </span>

              </div>

            </div>


            <p
              className=
                "profile-note"
            >
              Рабочая роль и
              административные права
              изменяются администраторами
              системы и не редактируются
              пользователем самостоятельно.
            </p>

          </div>

        </section>

      </div>

    </main>

  );

}
