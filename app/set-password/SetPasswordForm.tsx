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
            c5.5 0 9 5 9 8
            a10.6 10.6 0 0 1
            -2.1 3.5
          "
        />

        <path
          d="
            M6.6 6.6
            C4.3 8 3 10.2 3 12
            c0 3 3.5 8 9 8
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
          s3.5-8 9-8
          9 5 9 8
          -3.5 8-9 8
          -9-5-9-8
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


export default function SetPasswordForm() {

  const router =
    useRouter();


  const [
    password,
    setPassword,
  ] =
    useState("");


  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");


  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);


  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] =
    useState(false);


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    if (loading) {
      return;
    }


    setError(
      null
    );


    if (
      password.length < 10
    ) {

      setError(
        "Пароль должен содержать не менее 10 символов"
      );

      return;

    }


    if (
      password !==
      confirmPassword
    ) {

      setError(
        "Пароли не совпадают"
      );

      return;

    }


    setLoading(
      true
    );


    try {

      const supabase =
        createClient();


      const {
        error:
          updatePasswordError,
      } =
        await supabase
          .auth
          .updateUser({
            password,
          });


      if (
        updatePasswordError
      ) {

        const message =
          updatePasswordError
            .message
            .toLowerCase();


        if (
          message.includes(
            "password"
          )
          &&
          message.includes(
            "characters"
          )
        ) {

          setError(
            "Пароль не соответствует требованиям безопасности"
          );

        } else {

          setError(
            "Не удалось изменить пароль"
          );

        }


        return;

      }


      const {
        error:
          completeError,
      } =
        await supabase
          .rpc(
            "app_complete_password_change"
          );


      if (
        completeError
      ) {

        setError(
          "Пароль изменён, но не удалось завершить настройку учётной записи. Повторите попытку"
        );


        return;

      }


      router.replace("/");

      router.refresh();

    } catch {

      setError(
        "Не удалось связаться с сервером"
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  return (

    <form
      className="set-password-form"
      onSubmit={handleSubmit}
    >

      <label
        className="set-password-field"
      >

        <span>
          Новый пароль
        </span>


        <div
          className=
            "set-password-input-wrapper"
        >

          <input
            type={
              showPassword
                ? "text"
                : "password"
            }

            value={
              password
            }

            onChange={
              event =>
                setPassword(
                  event.target.value
                )
            }

            autoComplete="new-password"

            disabled={
              loading
            }

            minLength={10}

            required
          />


          <button
            type="button"

            className=
              "set-password-toggle"

            onClick={
              () =>
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

            disabled={
              loading
            }
          >

            <EyeIcon
              crossed={
                showPassword
              }
            />

          </button>

        </div>

      </label>


      <label
        className="set-password-field"
      >

        <span>
          Повторите пароль
        </span>


        <div
          className=
            "set-password-input-wrapper"
        >

          <input
            type={
              showConfirmPassword
                ? "text"
                : "password"
            }

            value={
              confirmPassword
            }

            onChange={
              event =>
                setConfirmPassword(
                  event.target.value
                )
            }

            autoComplete="new-password"

            disabled={
              loading
            }

            minLength={10}

            required
          />


          <button
            type="button"

            className=
              "set-password-toggle"

            onClick={
              () =>
                setShowConfirmPassword(
                  current =>
                    !current
                )
            }

            aria-label={
              showConfirmPassword
                ? "Скрыть пароль"
                : "Показать пароль"
            }

            disabled={
              loading
            }
          >

            <EyeIcon
              crossed={
                showConfirmPassword
              }
            />

          </button>

        </div>

      </label>


      <p
        className="set-password-hint"
      >
        Используйте не менее 10 символов.
        Этот пароль заменит временный пароль,
        выданный администратором.
      </p>


      {error && (

        <div
          className="set-password-error"
          role="alert"
        >
          {error}
        </div>

      )}


      <button
        type="submit"

        className=
          "set-password-submit"

        disabled={
          loading
        }
      >

        {
          loading
            ? "Сохраняем..."
            : "Сохранить новый пароль"
        }

      </button>

    </form>

  );

}
