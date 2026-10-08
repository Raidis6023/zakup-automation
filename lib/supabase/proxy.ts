import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";


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


            supabaseResponse =
              NextResponse.next({
                request,
              });


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


  /*
   * ВАЖНО:
   *
   * Пока мы только обновляем Auth-сессию.
   * Никаких редиректов на /login здесь ещё нет.
   *
   * Защиту сайта добавим на Шаге 5.
   */

  await supabase
    .auth
    .getClaims();


  return supabaseResponse;

}
