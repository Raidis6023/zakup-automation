import {
  type NextRequest,
} from "next/server";

import {
  updateSession,
} from "@/lib/supabase/proxy";


export async function proxy(
  request: NextRequest
) {

  return await updateSession(
    request
  );

}


export const config = {

  matcher: [

    /*
     * Запускаем Proxy почти для всех страниц,
     * кроме статических файлов и изображений.
     */

    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",

  ],

};
