import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/server";

import LoginExperience from "./LoginExperience";
import styles from "./LoginNotice.module.css";
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


  // Verify the signed JWT without a remote Auth request on every visit.
  // An unauthenticated user can render the login form even during a
  // temporary Auth rate limit; sign-in itself will report the rate limit.
  let signedIn = false;
  try {
    const { data: verified } = await supabase.auth.getClaims();
    const claims = verified?.claims;
    signedIn = Boolean(claims?.sub);
  } catch {
    // The login form must still render during a temporary Auth outage.
  }


  /*
   * Если пользователь уже вошёл,
   * второй раз форму входа ему
   * не показываем.
   */
  if (
    signedIn
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
    <main className="login-page">
      <LoginExperience blocked={isBlocked}>
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



      </LoginExperience>
    </main>
  );
}
