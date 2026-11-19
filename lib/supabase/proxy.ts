import { getServerSupabaseFetch } from "./server-fetch";
import {
  createServerClient,
} from "@supabase/ssr";

import { isTemporaryAuthFailure } from "./auth-rate-limit";

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
    "/api/wb/sync-sales",

    "/api/yandex/daily-sync",
    "/api/yandex/products/sync",
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


// If Auth's rate limit or network is temporarily unavailable, preserve
// cookies and reply 503 instead of discarding a legitimate session.
function temporaryAuthUnavailable(
  isApiRoute: boolean,
  cookiesResponse: NextResponse
): NextResponse {
  const headers = {
    "Cache-Control": "no-store",
    "Retry-After": "30",
  };
  const response = isApiRoute
    ? NextResponse.json({
        ok: false,
        error: "Сервис авторизации временно перегружен. Повторите запрос позже.",
      }, { status: 503, headers })
    : new NextResponse(
        "Сервис авторизации временно перегружен. Обновите страницу немного позже. Сессия сохранена.",
        { status: 503, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } }
      );
  return copyCookies(cookiesResponse, response);
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

  // Guest-only pages and registration endpoints must never call GoTrue
  // from proxy. Previously even a visit to /login triggered getUser().
  // LoginPage checks valid, signed claims before redirecting logged-in users.
  const noAuthNeeded =
    normalizedPathname === "/login" ||
    normalizedPathname === "/request-access" ||
    normalizedPathname === "/api/registration/submit" ||
    normalizedPathname === "/api/registration/status" ||
    normalizedPathname === "/api/registration/complete";

  if (noAuthNeeded) {
    return supabaseResponse;
  }


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
        global: { fetch: getServerSupabaseFetch() },
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

  // A remote getUser() on EVERY request caused an Auth request storm:
  // page prefetches + background polling + route calls exhausted GoTrue,
  // leading to 429 and everyone being sent back to login.
  //
  // getClaims() validates the signed access token locally with cached JWKS
  // for modern asymmetric Supabase signing keys. Token refresh is still
  // handled by the SSR cookie adapter above.
  let claims: { sub?: string } | null = null;
  try {
    const checked = await supabase.auth.getClaims();
    if (checked.error && isTemporaryAuthFailure(checked.error)) {
      return temporaryAuthUnavailable(isApiRoute, supabaseResponse);
    }
    claims = checked.data?.claims ?? null;
  } catch (error) {
    // Never treat a 429 / network failure as a logged-out user.
    // Otherwise middleware would redirect legitimate sessions to /login.
    console.error("Session verification temporarily unavailable",
      error instanceof Error ? error.name : "unknown");
    return temporaryAuthUnavailable(isApiRoute, supabaseResponse);
  }

  const user = claims?.sub ? { id: claims.sub } : null;


  // ==========================================================
  // ПУБЛИЧНЫЕ МАРШРУТЫ
  // ==========================================================

  const isPublicRoute =
    pathname === "/login"
    ||
    pathname === "/set-password"
    ||
    pathname === "/api/registration/submit"
    ||
    pathname === "/api/registration/status"
    ||
    pathname === "/api/registration/complete"
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
