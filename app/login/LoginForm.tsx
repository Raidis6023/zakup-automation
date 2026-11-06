"use client";

import {
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/client";



// ============================================================
// ICONS
// ============================================================

function EyeIcon({
  crossed,
}: {
  crossed: boolean;
}) {

  if (crossed) {

    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M3 3l18 18" />

        <path
          d="
            M10.6 10.7
            a2 2 0 0 0
            2.7 2.7
          "
        />

        <path
          d="
            M9.9 4.3
            A10.8 10.8 0 0 1
            12 4

            c5.5 0
            9 5
            9 8

            a10.6 10.6 0 0 1
            -2.1 3.5
          "
        />

        <path
          d="
            M6.6 6.6

            C4.3 8
            3 10.2
            3 12

            c0 3
            3.5 8
            9 8

            a10.6 10.6 0 0 0
            4.1-.8
          "
        />
      </svg>
    );

  }


  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="
          M3 12

          s3.5-8
          9-8

          9 5
          9 8

          -3.5 8
          -9 8

          -9-5
          -9-8
          Z
        "
      />

      <circle
        cx="12"
        cy="12"
        r="2.5"
      />
    </svg>
  );

}


// ============================================================
// LOGIN FORM (access request is now a separate screen)
// ============================================================

export default function LoginForm({ onRequestAccess }: { onRequestAccess: (email: string) => void }) {
  const router =
    useRouter();


  // ==========================================================
  // LOGIN
  // ==========================================================

  const [
    email,
    setEmail,
  ] = useState("");


  const [
    password,
    setPassword,
  ] = useState("");


  const [
    showPassword,
    setShowPassword,
  ] = useState(false);


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    if (loading) {
      return;
    }


    setError(null);


    const normalizedEmail =
      email
        .trim()
        .toLowerCase();


    if (!normalizedEmail) {

      setError(
        "Введите email"
      );

      return;
    }


    if (!password) {

      setError(
        "Введите пароль"
      );

      return;
    }


    setLoading(true);


    try {

      const supabase =
        createClient();


      const {
        error:
          signInError,
      } =
        await supabase
          .auth
          .signInWithPassword({
            email:
              normalizedEmail,

            password,
          });


      if (signInError) {

        const message =
          signInError.message
            .toLowerCase();


        if (
          signInError.status === 429 ||
          signInError.code === "over_request_rate_limit" ||
          message.includes("rate limit")
        ) {
          setError(
            "Сервис авторизации временно ограничил число запросов. Пароль менять не нужно. Повторите вход позже."
          );
        } else if (
          message.includes(
            "invalid login credentials"
          )
        ) {

          setError(
            "Неверный email или пароль"
          );

        } else if (
          message.includes(
            "email not confirmed"
          )
        ) {

          setError(
            "Email ещё не подтверждён"
          );

        } else {

          setError(
            "Не удалось войти. Попробуйте ещё раз"
          );

        }


        return;
      }


      router.replace("/");

      router.refresh();

    } catch {

      setError(
        "Не удалось связаться с сервером"
      );

    } finally {

      setLoading(false);

    }

  }


  return (
    <>
      <form
        className="login-form"
        onSubmit={handleSubmit}
      >

        <label
          className="login-field"
        >

          <span>
            Email
          </span>


          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            autoComplete="email"
            placeholder="name@company.ru"
            disabled={loading}
          />

        </label>


        <label
          className="login-field"
        >

          <span>
            Пароль
          </span>


          <div
            className="login-password-field"
          >

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete="current-password"
              placeholder="Введите пароль"
              disabled={loading}
            />


            <button
              type="button"
              className="login-password-toggle"
              onClick={() =>
                setShowPassword(
                  current =>
                    !current
                )
              }
              aria-label={
                showPassword
                  ? "Скрыть пароль"
                  : "Показать пароль"
              }
              disabled={loading}
            >

              <EyeIcon
                crossed={
                  showPassword
                }
              />

            </button>

          </div>

        </label>


        {error && (

          <div
            className="login-error"
            role="alert"
          >
            {error}
          </div>

        )}


        <button
          type="submit"
          className="login-submit"
          disabled={loading}
        >

          {loading
            ? "Входим..."
            : "Войти"
          }

        </button>


        <button
          type="button"
          className="login-forgot-password"
          disabled
        >
          Забыли пароль?
        </button>


        <div
          className="login-access-section"
        >

          <span
            className="login-access-caption"
          >
            Ещё нет доступа к WorkSpace?
          </span>


          <button
            type="button"
            className="login-access-button"
            onClick={
              () => onRequestAccess(email)
            }
            disabled={loading}
          >
            Запросить доступ
          </button>

        </div>

      </form>


    </>
  );
}
