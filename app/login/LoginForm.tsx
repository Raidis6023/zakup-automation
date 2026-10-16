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

import AccessPanda from "./AccessPanda";
import pandaStyles from "./AccessPanda.module.css";


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


function CloseIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );

}


// ============================================================
// LOGIN FORM
// ============================================================

export default function LoginForm() {

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


  // ==========================================================
  // ACCESS REQUEST
  // ==========================================================

  const [
    accessModalOpen,
    setAccessModalOpen,
  ] = useState(false);


  const [
    accessFirstName,
    setAccessFirstName,
  ] = useState("");


  const [
    accessLastName,
    setAccessLastName,
  ] = useState("");


  const [
    accessEmail,
    setAccessEmail,
  ] = useState("");


  const [
    accessDepartment,
    setAccessDepartment,
  ] = useState("");


  const [
    accessComment,
    setAccessComment,
  ] = useState("");


  const [
    accessLoading,
    setAccessLoading,
  ] = useState(false);


  const [
    accessError,
    setAccessError,
  ] = useState<string | null>(
    null
  );


  const [
    accessSuccess,
    setAccessSuccess,
  ] = useState(false);


  // ==========================================================
  // LOGIN
  // ==========================================================

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


  // ==========================================================
  // OPEN ACCESS REQUEST
  // ==========================================================

  function openAccessModal() {

    setAccessError(
      null
    );

    setAccessSuccess(
      false
    );


    /*
     * Если человек уже ввёл email
     * в форму входа, не заставляем
     * его печатать его второй раз.
     */
    if (
      email.trim() &&
      !accessEmail.trim()
    ) {

      setAccessEmail(
        email.trim()
      );

    }


    setAccessModalOpen(
      true
    );

  }


  // ==========================================================
  // CLOSE ACCESS REQUEST
  // ==========================================================

  function closeAccessModal() {

    if (accessLoading) {
      return;
    }


    setAccessModalOpen(
      false
    );

    setAccessError(
      null
    );

    setAccessSuccess(
      false
    );

  }


  // ==========================================================
  // SUBMIT ACCESS REQUEST
  // ==========================================================

  async function handleAccessRequest(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    if (accessLoading) {
      return;
    }


    setAccessError(
      null
    );


    const firstName =
      accessFirstName.trim();


    const lastName =
      accessLastName.trim();


    const normalizedEmail =
      accessEmail
        .trim()
        .toLowerCase();


    const department =
      accessDepartment.trim();


    const comment =
      accessComment.trim();


    if (!firstName) {

      setAccessError(
        "Введите имя"
      );

      return;
    }


    if (!lastName) {

      setAccessError(
        "Введите фамилию"
      );

      return;
    }


    if (!normalizedEmail) {

      setAccessError(
        "Введите email"
      );

      return;
    }


    setAccessLoading(
      true
    );


    try {

      const supabase =
        createClient();


      const {
        error:
          requestError,
      } =
        await supabase
          .rpc(
            "app_submit_access_request",
            {
              p_first_name:
                firstName,

              p_last_name:
                lastName,

              p_email:
                normalizedEmail,

              p_department:
                department || null,

              p_comment:
                comment || null,
            }
          );


      if (requestError) {

        const message =
          requestError.message
            .toLowerCase();


        if (
          message.includes(
            "уже существует"
          )
        ) {

          setAccessError(
            "Для этого email уже существует учётная запись или активный запрос доступа"
          );

        } else if (
          message.includes(
            "корректный email"
          )
        ) {

          setAccessError(
            "Введите корректный email"
          );

        } else if (
          message.includes(
            "корректное имя"
          )
        ) {

          setAccessError(
            "Введите корректное имя"
          );

        } else if (
          message.includes(
            "корректную фамилию"
          )
        ) {

          setAccessError(
            "Введите корректную фамилию"
          );

        } else if (
          message.includes(
            "название отдела слишком длинное"
          )
        ) {

          setAccessError(
            "Название отдела слишком длинное"
          );

        } else if (
          message.includes(
            "комментарий слишком длинный"
          )
        ) {

          setAccessError(
            "Комментарий слишком длинный"
          );

        } else {

          setAccessError(
            "Не удалось отправить запрос. Попробуйте ещё раз"
          );

        }


        return;
      }


      setAccessSuccess(
        true
      );


      setAccessFirstName(
        ""
      );

      setAccessLastName(
        ""
      );

      setAccessEmail(
        ""
      );

      setAccessDepartment(
        ""
      );

      setAccessComment(
        ""
      );

    } catch {

      setAccessError(
        "Не удалось связаться с сервером"
      );

    } finally {

      setAccessLoading(
        false
      );

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
              openAccessModal
            }
            disabled={loading}
          >
            Запросить доступ
          </button>

        </div>

      </form>


      {accessModalOpen && (

        <div
          className="access-modal-overlay"
          onMouseDown={
            event => {

              if (
                event.target ===
                event.currentTarget
              ) {

                closeAccessModal();

              }

            }
          }
        >

          <div
            className={pandaStyles.stage}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeAccessModal();
              }
            }}
          >
          <div
            className="access-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-modal-title"
          >

            <button
              type="button"
              className="access-modal-close"
              onClick={
                closeAccessModal
              }
              aria-label="Закрыть"
              disabled={accessLoading}
            >
              <CloseIcon />
            </button>


            {!accessSuccess
              ? (

                <>
                  <div
                    className="access-modal-heading"
                  >

                    <h2
                      id="access-modal-title"
                    >
                      Запрос доступа
                    </h2>

                    <p>
                      Оставьте свои данные.
                      Администратор назначит роль
                      и предоставит доступ к WorkSpace.
                    </p>

                  </div>


                  <form
                    className="access-request-form"
                    onSubmit={
                      handleAccessRequest
                    }
                  >

                    <div
                      className="access-name-grid"
                    >

                      <label
                        className="login-field"
                      >

                        <span>
                          Имя *
                        </span>

                        <input
                          type="text"
                          value={
                            accessFirstName
                          }
                          onChange={
                            event =>
                              setAccessFirstName(
                                event.target.value
                              )
                          }
                          autoComplete="given-name"
                          maxLength={100}
                          disabled={
                            accessLoading
                          }
                          required
                        />

                      </label>


                      <label
                        className="login-field"
                      >

                        <span>
                          Фамилия *
                        </span>

                        <input
                          type="text"
                          value={
                            accessLastName
                          }
                          onChange={
                            event =>
                              setAccessLastName(
                                event.target.value
                              )
                          }
                          autoComplete="family-name"
                          maxLength={100}
                          disabled={
                            accessLoading
                          }
                          required
                        />

                      </label>

                    </div>


                    <label
                      className="login-field"
                    >

                      <span>
                        Email *
                      </span>

                      <input
                        type="email"
                        value={
                          accessEmail
                        }
                        onChange={
                          event =>
                            setAccessEmail(
                              event.target.value
                            )
                        }
                        autoComplete="email"
                        maxLength={254}
                        placeholder="name@company.ru"
                        disabled={
                          accessLoading
                        }
                        required
                      />

                    </label>


                    <label
                      className="login-field"
                    >

                      <span>
                        Отдел
                      </span>

                      <input
                        type="text"
                        value={
                          accessDepartment
                        }
                        onChange={
                          event =>
                            setAccessDepartment(
                              event.target.value
                            )
                        }
                        maxLength={150}
                        placeholder="Например: Закуп"
                        disabled={
                          accessLoading
                        }
                      />

                    </label>


                    <label
                      className="
                        login-field
                        access-comment-field
                      "
                    >

                      <span>
                        Комментарий
                      </span>

                      <textarea
                        value={
                          accessComment
                        }
                        onChange={
                          event =>
                            setAccessComment(
                              event.target.value
                            )
                        }
                        maxLength={2000}
                        placeholder="При необходимости"
                        disabled={
                          accessLoading
                        }
                      />

                    </label>


                    {accessError && (

                      <div
                        className="login-error"
                        role="alert"
                      >
                        {accessError}
                      </div>

                    )}


                    <div
                      className="access-modal-actions"
                    >

                      <button
                        type="button"
                        className="
                          access-secondary-button
                        "
                        onClick={
                          closeAccessModal
                        }
                        disabled={
                          accessLoading
                        }
                      >
                        Отмена
                      </button>


                      <button
                        type="submit"
                        className="
                          access-primary-button
                        "
                        disabled={
                          accessLoading
                        }
                      >

                        {accessLoading
                          ? "Отправляем..."
                          : "Отправить запрос"
                        }

                      </button>

                    </div>

                  </form>
                </>

              )
              : (

                <div
                  className="access-success"
                >

                  <div
                    className="access-success-icon"
                  >
                    ✓
                  </div>


                  <h2>
                    Запрос отправлен
                  </h2>


                  <p>
                    Администратор рассмотрит
                    заявку и назначит вам
                    доступ к WorkSpace.
                  </p>


                  <button
                    type="button"
                    className="
                      access-primary-button
                      access-success-button
                    "
                    onClick={
                      closeAccessModal
                    }
                  >
                    Готово
                  </button>

                </div>

              )
            }

          </div>

          <AccessPanda success={accessSuccess} />

          </div>

        </div>

      )}

    </>

  );

}
