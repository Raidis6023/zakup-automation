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
  // OZON CRON
  //
  // Vercel Cron приходит без пользовательской Supabase-сессии.
  // Сам endpoint защищён CRON_SECRET.
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
  // Этот endpoint тоже вызывается непосредственно Vercel Cron.
  // Пользовательская сессия ему не нужна.
  //
  // Сам /api/wb/daily-sync проверяет:
  // Authorization: Bearer CRON_SECRET
  // ==========================================================

  if (
    pathname ===
    "/api/wb/daily-sync"
  ) {

    return NextResponse.next();

  }


  // ==========================================================
  // ВНУТРЕННИЕ WB-ЗАПРОСЫ ОТ DAILY CRON
  //
  // /api/wb/daily-sync внутри вызывает:
  //
  // /api/wb/sync-orders
  // /api/wb/sync-stocks
  //
  // Они тоже приходят без пользовательской Supabase-сессии.
  //
  // Но пропускаем их ТОЛЬКО если передан правильный CRON_SECRET.
  // Просто открыть эти API наружу нельзя.
  // ==========================================================

  const isWbInternalSyncRoute =
    pathname ===
      "/api/wb/sync-orders"
    ||
    pathname ===
      "/api/wb/sync-stocks";


  if (
    isWbInternalSyncRoute
  ) {

    const cronSecret =
      process.env.CRON_SECRET;


    const authorization =
      request.headers.get(
        "authorization"
      );


    if (
      cronSecret
      &&
      authorization ===
        `Bearer ${cronSecret}`
    ) {

      return NextResponse.next();

    }

  }


  // ==========================================================
  // ОБЫЧНАЯ АВТОРИЗАЦИЯ WORKSPACE
  //
  // Все обычные страницы и API работают как раньше.
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
