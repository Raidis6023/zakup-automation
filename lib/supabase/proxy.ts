import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";


function copyCookies(
  source: NextResponse,
  target: NextResponse
) {

  for (
    const cookie
    of source.cookies.getAll()
  ) {

    target.cookies.set(
      cookie
    );

  }


  return target;

}


export async function updateSession(
  request: NextRequest
) {

  let supabaseResponse =
    NextResponse.next({
      request,
    });


  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabasePublishableKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;


  if (
    !supabaseUrl
    ||
    !supabasePublishableKey
  ) {

    throw new Error(
      "Не настроены переменные окружения Supabase"
    );

  }


  const supabase =
    createServerClient(
      supabaseUrl,
      supabasePublishableKey,
      {
        cookies: {

          getAll() {

            return request
              .cookies
              .getAll();

          },


          setAll(
            cookiesToSet
          ) {

            for (
              const {
                name,
                value,
              }
              of cookiesToSet
            ) {

              request.cookies.set(
                name,
                value
              );

            }


            supabaseResponse =
              NextResponse.next({
                request,
              });


            for (
              const {
                name,
                value,
                options,
              }
              of cookiesToSet
            ) {

              supabaseResponse
                .cookies
                .set(
                  name,
                  value,
                  options
                );

            }

          },

        },
      }
    );


  // ==========================================================
  // ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
  // ==========================================================

  const {
    data: {
      user,
    },
  } =
    await supabase
      .auth
      .getUser();


  const pathname =
    request
      .nextUrl
      .pathname;


  const isApiRoute =
    pathname === "/api"
    ||
    pathname.startsWith(
      "/api/"
    );


  // ==========================================================
  // ПУБЛИЧНЫЕ МАРШРУТЫ
  // ==========================================================

  const isPublicRoute =
    pathname === "/login"
    ||
    pathname === "/request-access"
    ||
    pathname === "/auth"
    ||
    pathname.startsWith(
      "/auth/"
    );


  // ==========================================================
  // СТРАНИЦА ОБЯЗАТЕЛЬНОЙ СМЕНЫ ПАРОЛЯ
  // ==========================================================

  const isSetPasswordRoute =
    pathname === "/set-password"
    ||
    pathname.startsWith(
      "/set-password/"
    );


  // ==========================================================
  // НЕАВТОРИЗОВАННЫЙ ПОЛЬЗОВАТЕЛЬ
  // ==========================================================

  if (
    !user
  ) {

    if (
      isPublicRoute
    ) {

      return supabaseResponse;

    }


    if (
      isApiRoute
    ) {

      const apiResponse =
        NextResponse.json(
          {
            ok:
              false,

            error:
              "Требуется авторизация",
          },
          {
            status:
              401,
          }
        );


      return copyCookies(
        supabaseResponse,
        apiResponse
      );

    }


    const loginUrl =
      request
        .nextUrl
        .clone();


    loginUrl.pathname =
      "/login";


    const redirectResponse =
      NextResponse.redirect(
        loginUrl
      );


    return copyCookies(
      supabaseResponse,
      redirectResponse
    );

  }


  // ==========================================================
  // ПРОВЕРЯЕМ БЛОКИРОВКУ ПОЛЬЗОВАТЕЛЯ
  // ==========================================================

  const {
    data:
      isBlocked,
    error:
      blockStatusError,
  } =
    await supabase
      .rpc(
        "app_get_my_block_status"
      );


  // ==========================================================
  // ЕСЛИ НЕ УДАЛОСЬ ПРОВЕРИТЬ БЛОКИРОВКУ
  //
  // Закрытые страницы не открываем.
  // Публичные страницы оставляем доступными.
  // ==========================================================

  if (
    blockStatusError
  ) {

    console.error(
      "Не удалось проверить блокировку пользователя:",
      blockStatusError
    );


    if (
      isPublicRoute
    ) {

      return supabaseResponse;

    }


    if (
      isApiRoute
    ) {

      const apiResponse =
        NextResponse.json(
          {
            ok:
              false,

            error:
              "Не удалось проверить доступ пользователя",
          },
          {
            status:
              503,
          }
        );


      return copyCookies(
        supabaseResponse,
        apiResponse
      );

    }


    const loginUrl =
      request
        .nextUrl
        .clone();


    loginUrl.pathname =
      "/login";


    loginUrl.search =
      "";


    loginUrl.searchParams.set(
      "access_error",
      "1"
    );


    const redirectResponse =
      NextResponse.redirect(
        loginUrl
      );


    return copyCookies(
      supabaseResponse,
      redirectResponse
    );

  }


  // ==========================================================
  // ПОЛЬЗОВАТЕЛЬ ЗАБЛОКИРОВАН
  //
  // Сбрасываем текущую Supabase-сессию.
  // ==========================================================

  if (
    isBlocked === true
  ) {

    const {
      error:
        signOutError,
    } =
      await supabase
        .auth
        .signOut();


    if (
      signOutError
    ) {

      console.error(
        "Не удалось завершить сессию заблокированного пользователя:",
        signOutError
      );

    }


    if (
      isApiRoute
    ) {

      const apiResponse =
        NextResponse.json(
          {
            ok:
              false,

            error:
              "Учётная запись заблокирована",
          },
          {
            status:
              403,
          }
        );


      return copyCookies(
        supabaseResponse,
        apiResponse
      );

    }


    /*
     * Если пользователь уже находится на /login,
     * не создаём цикл перенаправлений.
     */

    if (
      pathname === "/login"
    ) {

      return supabaseResponse;

    }


    const loginUrl =
      request
        .nextUrl
        .clone();


    loginUrl.pathname =
      "/login";


    loginUrl.search =
      "";


    loginUrl.searchParams.set(
      "blocked",
      "1"
    );


    const redirectResponse =
      NextResponse.redirect(
        loginUrl
      );


    return copyCookies(
      supabaseResponse,
      redirectResponse
    );

  }


  // ==========================================================
  // ПРОВЕРЯЕМ ОБЯЗАТЕЛЬНУЮ СМЕНУ ПАРОЛЯ
  // ==========================================================

  const {
    data:
      mustChangePassword,
    error:
      passwordFlagError,
  } =
    await supabase
      .rpc(
        "app_get_must_change_password"
      );


  // ==========================================================
  // ЕСЛИ ПРОВЕРКА СЛОМАЛАСЬ
  // ==========================================================

  if (
    passwordFlagError
  ) {

    if (
      isSetPasswordRoute
    ) {

      return supabaseResponse;

    }


    if (
      isApiRoute
    ) {

      const apiResponse =
        NextResponse.json(
          {
            ok:
              false,

            error:
              "Не удалось проверить состояние пароля",
          },
          {
            status:
              503,
          }
        );


      return copyCookies(
        supabaseResponse,
        apiResponse
      );

    }


    const setPasswordUrl =
      request
        .nextUrl
        .clone();


    setPasswordUrl.pathname =
      "/set-password";


    const redirectResponse =
      NextResponse.redirect(
        setPasswordUrl
      );


    return copyCookies(
      supabaseResponse,
      redirectResponse
    );

  }


  // ==========================================================
  // ВРЕМЕННЫЙ ПАРОЛЬ ЕЩЁ НЕ ЗАМЕНЁН
  // ==========================================================

  if (
    mustChangePassword === true
    &&
    !isSetPasswordRoute
  ) {

    if (
      isApiRoute
    ) {

      const apiResponse =
        NextResponse.json(
          {
            ok:
              false,

            error:
              "Необходимо изменить временный пароль",
          },
          {
            status:
              403,
          }
        );


      return copyCookies(
        supabaseResponse,
        apiResponse
      );

    }


    const setPasswordUrl =
      request
        .nextUrl
        .clone();


    setPasswordUrl.pathname =
      "/set-password";


    const redirectResponse =
      NextResponse.redirect(
        setPasswordUrl
      );


    return copyCookies(
      supabaseResponse,
      redirectResponse
    );

  }


  // ==========================================================
  // ПАРОЛЬ УЖЕ ЗАМЕНЁН
  // ==========================================================

  if (
    mustChangePassword !== true
    &&
    isSetPasswordRoute
  ) {

    const homeUrl =
      request
        .nextUrl
        .clone();


    homeUrl.pathname =
      "/";


    const redirectResponse =
      NextResponse.redirect(
        homeUrl
      );


    return copyCookies(
      supabaseResponse,
      redirectResponse
    );

  }


  // ==========================================================
  // ОБЫЧНАЯ ЗАЩИТА ЗАКРЫТЫХ МАРШРУТОВ
  // ==========================================================

  return supabaseResponse;

}
