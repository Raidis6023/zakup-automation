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

  const pathname =
    request.nextUrl.pathname;


  // ==========================================================
  // OZON DAILY CRON
  //
  // Вызывается Vercel Cron.
  // Сам endpoint отдельно проверяет CRON_SECRET.
  // ==========================================================

  if (
    pathname ===
    "/api/ozon/daily-sync"
  ) {

    return NextResponse.next();

  }


  // ==========================================================
  // WB DAILY CRON
  //
  // Вызывается Vercel Cron.
  // Сам endpoint отдельно проверяет CRON_SECRET.
  // ==========================================================

  if (
    pathname ===
    "/api/wb/daily-sync"
  ) {

    return NextResponse.next();

  }


  // ==========================================================
  // ВНУТРЕННИЕ WB ROUTES
  //
  // daily-sync вызывает:
  //
  // /api/wb/sync-orders
  // /api/wb/sync-stocks
  //
  // Для них используем отдельный служебный заголовок,
  // чтобы не зависеть от обработки Authorization.
  // ==========================================================

  const isWbInternalRoute =
    pathname ===
      "/api/wb/sync-orders"
    ||
    pathname ===
      "/api/wb/sync-stocks";


  if (
    isWbInternalRoute
  ) {

    const cronSecret =
      process.env.CRON_SECRET;


    const internalSecret =
      request.headers.get(
        "x-wb-internal-secret"
      );


    const internalMarker =
      request.headers.get(
        "x-internal-wb-daily-sync"
      );


    if (
      cronSecret
      &&
      internalMarker ===
        "1"
      &&
      internalSecret ===
        cronSecret
    ) {

      return NextResponse.next();

    }

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
