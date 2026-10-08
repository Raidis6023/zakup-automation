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
  //
  // Рабочие страницы не открываем.
  // Иначе при проблеме БД можно было бы случайно обойти
  // обязательную смену временного пароля.
  // ==========================================================

  if (
    passwordFlagError
  ) {

    if (
      isSetPasswordRoute
    ) {

      return supabaseResponse;

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
  //
  // На /set-password такому пользователю делать нечего.
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

  if (
    !isPublicRoute
  ) {

    return supabaseResponse;

  }


  return supabaseResponse;

}
