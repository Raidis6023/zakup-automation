import Link
  from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/server";

import ProfileAvatarUploader
  from "./ProfileAvatarUploader";

import ProfileForm
  from "./ProfileForm";

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


  const adminRole =
    profile.has_admin_access

      ? (
          profile.admin_role_name
          ||
          "Администратор"
        )

      : "Нет";


  let avatarUrl:
    string | null =
      null;


  if (
    profile.avatar_path
  ) {

    const {
      data: signedData,
      error: signedError,
    } =
      await supabase
        .storage
        .from(
          "avatars"
        )
        .createSignedUrl(
          profile.avatar_path,
          60 * 60
        );


    if (
      signedError
    ) {

      console.error(
        "Не удалось получить аватар:",
        signedError
      );

    } else {

      avatarUrl =
        signedData.signedUrl;

    }

  }


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

            <ProfileAvatarUploader
              firstName={
                profile.first_name
              }

              lastName={
                profile.last_name
              }

              initialAvatarPath={
                profile.avatar_path
              }

              initialAvatarUrl={
                avatarUrl
              }
            />


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


            <ProfileForm
              userId={
                profile.user_id
              }

              firstName={
                profile.first_name
              }

              lastName={
                profile.last_name
              }

              email={
                profile.email
              }
            />

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
