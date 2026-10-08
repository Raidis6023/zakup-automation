import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/server";

import SetPasswordForm
  from "./SetPasswordForm";

import "./set-password.css";


export default async function SetPasswordPage() {

  const supabase =
    await createClient();


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

    redirect(
      "/login"
    );

  }


  const {
    data:
      mustChangePassword,
    error:
      flagError,
  } =
    await supabase
      .rpc(
        "app_get_must_change_password"
      );


  if (
    flagError
  ) {

    throw new Error(
      "Не удалось проверить статус смены пароля"
    );

  }


  if (
    !mustChangePassword
  ) {

    redirect(
      "/"
    );

  }


  return (

    <main
      className="set-password-page"
    >

      <section
        className="set-password-card"
      >

        <div
          className="set-password-logo"
        >

          <img
            src="/logos/babushkina-marketplace.png"
            alt="ИП Бабушкина Маркетплейсы"
          />

        </div>


        <div
          className=
            "set-password-heading"
        >

          <h1>
            Создайте новый пароль
          </h1>


          <p>
            Вы вошли с временным паролем.
            Перед началом работы задайте
            постоянный пароль вашей
            учётной записи.
          </p>

        </div>


        <SetPasswordForm />

      </section>

    </main>

  );

}
