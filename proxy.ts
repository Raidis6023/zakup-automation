import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  updateSession,
} from "./lib/supabase/proxy";


export async function proxy(
  request: NextRequest
) {

  // ==========================================================
  // OZON CRON
  //
  // Этот endpoint вызывается Vercel Cron без пользовательской
  // Supabase-сессии.
  //
  // Пользовательскую авторизацию WorkSpace здесь пропускаем.
  // Сам endpoint защищён отдельно через:
  //
  // Authorization: Bearer CRON_SECRET
  // ==========================================================

  if (
    request.nextUrl.pathname ===
    "/api/ozon/daily-sync"
  ) {

    return NextResponse.next();

  }


  // ==========================================================
  // ОБЫЧНАЯ АВТОРИЗАЦИЯ WORKSPACE
  // ==========================================================

  return updateSession(
    request
  );

}


export const config = {

  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],

};
