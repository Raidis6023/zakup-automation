import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/server";

import LoginForm
  from "./LoginForm";

import "./login.css";


export default async function LoginPage() {

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
   * второй раз форму входа ему не показываем.
   */
  if (user) {
    redirect("/");
  }


  return (

    <main className="login-page">

      <section className="login-card">

        <div className="login-logo">

          <img
            src="/logos/babushkina-marketplace.png"
            alt="ИП Бабушкина Маркетплейсы"
          />

        </div>


        <div className="login-heading">

          <h1>
            Вход в WorkSpace
          </h1>

          <p>
            Введите данные вашей учётной записи
          </p>

        </div>


        <LoginForm />


        <div className="login-access-note">

          <span>
            Нет доступа к WorkSpace?
          </span>

          <strong>
            Запрос доступа появится на следующем этапе
          </strong>

        </div>

      </section>

    </main>

  );

}
