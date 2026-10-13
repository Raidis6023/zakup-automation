import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";


// ============================================================
// СЛУЖЕБНЫЕ CRON-МАРШРУТЫ
// ============================================================

const CRON_API_ROUTES =
  new Set<string>([
    "/api/ozon/daily-sync",

    "/api/yandex/daily-sync",
    "/api/yandex/stocks",
    "/api/yandex/sales",
    "/api/yandex/sales/daily-sync",
    "/api/yandex/sales/daily-preview",
  ]);


// ============================================================
// HELPERS
// ============================================================

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


function normalizePathname(
  pathname: string
):
string {

  if (
    pathname.length >
    1
  ) {

    return pathname.replace(
      /\/+$/,
      ""
    );

  }


  return pathname;

}


function hasValidCronAuthorization(
  request: NextRequest
):
boolean {

  const cronSecret =
    process.env
      .CRON_SECRET
      ?.trim();


  if (!cronSecret) {

    return false;

  }


  const authorization =
    request.headers.get(
      "authorization"
    );


  return (
    authorization ===
    `Bearer ${cronSecret}`
  );

}


// ============================================================
// SESSION / ACCESS PROXY
// ============================================================

export async function updateSession(
  request: NextRequest
) {

  let supabaseResponse =
    NextResponse.next({
      request,
    });


  const pathname =
    request
      .nextUrl
      .pathname;


  const normalizedPathname =
    normalizePathname(
      pathname
    );


  const isApiRoute =
    pathname === "/api"
    ||
    pathname.startsWith(
      "/api/"
    );


  // ==========================================================
  // CRON / SERVER-TO-SERVER BYPASS
  // ==========================================================

  if (
    CRON_API_ROUTES.has(
      normalizedPathname
    )
    &&
    hasValidCronAuthorization(
      request
    )
  ) {

    return supabaseResponse;

  }


  // ==========================================================
  // SUPABASE CONFIG
  // ==========================================================

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


  // ==========================================================
  // SUPABASE CLIENT
  // ==========================================================

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


  return supabaseResponse;

}
