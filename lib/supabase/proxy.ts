import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";


// ============================================================
// PUBLIC ROUTES
// ============================================================

function isPublicRoute(
  pathname: string
) {

  /*
   * Страницы, которые должны работать
   * БЕЗ авторизации.
   *
   * /request-access создадим позже.
   * /auth/* понадобится для приглашений,
   * подтверждений и восстановления пароля.
   */

  if (
    pathname === "/login" ||
    pathname === "/request-access" ||
    pathname.startsWith("/auth/")
  ) {
    return true;
  }


  return false;

}


// ============================================================
// UPDATE AUTH SESSION
// ============================================================

export async function updateSession(
  request: NextRequest
) {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabasePublishableKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена переменная NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabasePublishableKey) {

    throw new Error(
      "Не найдена переменная NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );

  }


  let supabaseResponse =
    NextResponse.next({
      request,
    });


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

            /*
             * Сначала обновляем cookies
             * внутри текущего request.
             */

            cookiesToSet
              .forEach(
                ({
                  name,
                  value,
                }) => {

                  request
                    .cookies
                    .set(
                      name,
                      value
                    );

                }
              );


            /*
             * После изменения cookies
             * создаём новый response.
             */

            supabaseResponse =
              NextResponse.next({
                request,
              });


            /*
             * И записываем обновлённые
             * cookies пользователю.
             */

            cookiesToSet
              .forEach(
                ({
                  name,
                  value,
                  options,
                }) => {

                  supabaseResponse
                    .cookies
                    .set(
                      name,
                      value,
                      options
                    );

                }
              );

          },

        },
      }
    );


  // ==========================================================
  // CHECK AUTHENTICATED USER
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
    request.nextUrl.pathname;


  // ==========================================================
  // PROTECT WORKSPACE
  // ==========================================================

  if (
    !user &&
    !isPublicRoute(
      pathname
    )
  ) {

    const loginUrl =
      request.nextUrl.clone();


    loginUrl.pathname =
      "/login";


    /*
     * Пока после входа всегда
     * переходим на главную.
     *
     * Позже можем добавить returnTo,
     * чтобы после входа человек
     * возвращался именно туда,
     * куда первоначально шёл.
     */

    loginUrl.search = "";


    return NextResponse.redirect(
      loginUrl
    );

  }


  // ==========================================================
  // AUTHENTICATED USER
  // ==========================================================

  return supabaseResponse;

}
