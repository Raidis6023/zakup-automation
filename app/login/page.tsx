import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/server";

import LoginForm
  from "./LoginForm";

import styles
  from "./LoginNotice.module.css";

import "./login.css";


// ============================================================
// TYPES
// ============================================================

type LoginPageProps = {

  searchParams:
    Promise<{
      blocked?:
        string;

      access_error?:
        string;
    }>;

};


// ============================================================
// LOGIN PAGE
// ============================================================

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {

  const params =
    await searchParams;


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


  /*
   * Если пользователь уже вошёл,
   * второй раз форму входа ему
   * не показываем.
   */
  if (
    user
  ) {

    redirect(
      "/"
    );

  }


  const isBlocked =
    params.blocked ===
      "1";


  const hasAccessError =
    params.access_error ===
      "1";


  return (

    <main
      className=
        "login-page"
    >

      <section
        className=
          "login-card"
      >

        <div
          className=
            "login-logo"
        >

          <img
            src=
              "/logos/babushkina-marketplace.png"

            alt=
              "ИП Бабушкина Маркетплейсы"
          />

        </div>


        <div
          className=
            "login-heading"
        >

          <h1>
            Вход в WorkSpace
          </h1>


          <p>
            Введите данные вашей
            учётной записи
          </p>

        </div>


        {
          isBlocked
          &&
          (

            <div
              className={
                styles.notice
              }

              role=
                "alert"
            >

              <strong
                className={
                  styles.noticeTitle
                }
              >
                Учётная запись заблокирована
              </strong>


              <p
                className={
                  styles.noticeText
                }
              >
                Доступ к WorkSpace
                приостановлен администратором.
                Для восстановления доступа
                обратитесь к администратору.
              </p>

            </div>

          )
        }


        {
          !isBlocked
          &&
          hasAccessError
          &&
          (

            <div
              className={`
                ${styles.notice}
                ${styles.noticeNeutral}
              `}

              role=
                "alert"
            >

              <strong
                className={
                  styles.noticeTitle
                }
              >
                Не удалось проверить доступ
              </strong>


              <p
                className={
                  styles.noticeText
                }
              >
                WorkSpace временно не смог
                проверить состояние вашей
                учётной записи. Попробуйте
                войти ещё раз немного позже.
              </p>

            </div>

          )
        }


        <LoginForm />

      </section>

    </main>

  );

}
