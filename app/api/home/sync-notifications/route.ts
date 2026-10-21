import {
  NextResponse,
} from "next/server";

import {
  createClient as createSessionClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


export const dynamic =
  "force-dynamic";


type SyncNotification = {
  id:
    string;

  marketplace:
    "ozon"
    | "wildberries"
    | "yandex_market";

  marketplaceLabel:
    string;

  title:
    string;

  completedAt:
    string;

  notificationAt:
    string;

  dataDate:
    string;

  updateTime:
    string;

  notificationTime:
    string;

  notificationDisplay:
    string;
};


const KRASNOYARSK_TIME_ZONE =
  "Asia/Krasnoyarsk";


function formatKrasnoyarskDate(
  iso:
    string
) {

  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        KRASNOYARSK_TIME_ZONE,

      day:
        "2-digit",

      month:
        "2-digit",
    }
  ).format(
    new Date(
      iso
    )
  );

}


function formatKrasnoyarskTime(
  iso:
    string
) {

  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        KRASNOYARSK_TIME_ZONE,

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    }
  ).format(
    new Date(
      iso
    )
  );

}


function getKrasnoyarskDateParts(
  value:
    string
    |
    Date
) {

  const date =
    value instanceof
      Date

      ? value

      : new Date(
          value
        );


  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          KRASNOYARSK_TIME_ZONE,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );


  const year =
    Number(
      parts.find(
        part =>
          part.type ===
          "year"
      )
        ?.value
      ??
      "0"
    );


  const month =
    Number(
      parts.find(
        part =>
          part.type ===
          "month"
      )
        ?.value
      ??
      "0"
    );


  const day =
    Number(
      parts.find(
        part =>
          part.type ===
          "day"
      )
        ?.value
      ??
      "0"
    );


  return {
    year,
    month,
    day,
  };

}


function getKrasnoyarskDayIndex(
  value:
    string
    |
    Date
) {

  const {
    year,
    month,
    day,
  } =
    getKrasnoyarskDateParts(
      value
    );


  return Math.floor(
    Date.UTC(
      year,
      month - 1,
      day
    )
    /
    86_400_000
  );

}


function getNotificationDisplay(
  notificationAt:
    string
) {

  const notificationDay =
    getKrasnoyarskDayIndex(
      notificationAt
    );


  const todayDay =
    getKrasnoyarskDayIndex(
      new Date()
    );


  const dayDifference =
    todayDay
    -
    notificationDay;


  if (
    dayDifference <=
      0
  ) {

    return formatKrasnoyarskTime(
      notificationAt
    );

  }


  if (
    dayDifference ===
      1
  ) {

    return "вчера";

  }


  if (
    dayDifference ===
      2
  ) {

    return "позавчера";

  }


  return "давно";

}


function buildNotification({
  marketplace,
  marketplaceLabel,
  completedAt,
  notificationAt,
}: {
  marketplace:
    SyncNotification["marketplace"];

  marketplaceLabel:
    string;

  completedAt:
    string;

  notificationAt?:
    string;
}):
SyncNotification {

  const resolvedNotificationAt =
    notificationAt
    ??
    completedAt;


  return {
    id:
      `${marketplace}:${completedAt}`,

    marketplace,

    marketplaceLabel,

    title:
      "Загрузка данных завершена",

    completedAt,

    notificationAt:
      resolvedNotificationAt,

    dataDate:
      formatKrasnoyarskDate(
        completedAt
      ),

    updateTime:
      formatKrasnoyarskTime(
        completedAt
      ),

    notificationTime:
      formatKrasnoyarskTime(
        resolvedNotificationAt
      ),

    notificationDisplay:
      getNotificationDisplay(
        resolvedNotificationAt
      ),
  };

}


export async function GET() {

  const session =
    await createSessionClient();


  const {
    data: {
      user,
    },
  } =
    await session
      .auth
      .getUser();


  if (
    !user
  ) {

    return NextResponse.json(
      {
        ok: false,
        error:
          "Требуется авторизация",
      },
      {
        status:
          401,
      }
    );

  }


  const admin =
    createAdminClient();


  const [
    ozonResult,
    wbResult,
    yandexResult,
  ] =
    await Promise.all([
      admin
        .from(
          "ozon_sales_sync_runs"
        )
        .select(
          "created_at"
        )
        .eq(
          "status",
          "success"
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle(),

      admin
        .from(
          "wb_sync_state"
        )
        .select(
          "last_success_at,updated_at"
        )
        .eq(
          "sync_key",
          "stocks"
        )
        .limit(
          1
        )
        .maybeSingle(),

      admin
        .from(
          "marketplace_daily_sync_runs"
        )
        .select(
          "finished_at"
        )
        .eq(
          "marketplace",
          "yandex_market"
        )
        .eq(
          "status",
          "success"
        )
        .order(
          "finished_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle(),
    ]);


  const notifications:
    SyncNotification[] =
    [];


  const ozonCompletedAt =
    ozonResult
      .data
      ?.created_at;


  if (
    typeof ozonCompletedAt ===
      "string"
  ) {

    notifications.push(
      buildNotification({
        marketplace:
          "ozon",

        marketplaceLabel:
          "Ozon",

        completedAt:
          ozonCompletedAt,
      })
    );

  }


  const wbCompletedAt =
    wbResult
      .data
      ?.last_success_at;


  if (
    typeof wbCompletedAt ===
      "string"
  ) {

    const wbNotificationAt =
      wbResult
        .data
        ?.updated_at;


    notifications.push(
      buildNotification({
        marketplace:
          "wildberries",

        marketplaceLabel:
          "WB",

        completedAt:
          wbCompletedAt,

        notificationAt:
          typeof wbNotificationAt ===
            "string"

            ? wbNotificationAt

            : wbCompletedAt,
      })
    );

  }


  const yandexCompletedAt =
    yandexResult
      .data
      ?.finished_at;


  if (
    typeof yandexCompletedAt ===
      "string"
  ) {

    notifications.push(
      buildNotification({
        marketplace:
          "yandex_market",

        marketplaceLabel:
          "Яндекс Маркет",

        completedAt:
          yandexCompletedAt,
      })
    );

  }


  notifications.sort(
    (
      left,
      right
    ) =>
      new Date(
        left.notificationAt
      ).getTime()
      -
      new Date(
        right.notificationAt
      ).getTime()
  );


  return NextResponse.json(
    {
      ok: true,
      notifications,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );

}
