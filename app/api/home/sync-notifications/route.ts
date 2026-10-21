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


type SyncNotificationKind =
  | "sync_success"
  | "stock_zero";


type SyncNotification = {
  id:
    string;

  kind:
    SyncNotificationKind;

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

  description:
    string;

  href:
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

    kind:
      "sync_success",

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

    description:
      `${marketplaceLabel}, данные за ${formatKrasnoyarskDate(
        completedAt
      )}, ${formatKrasnoyarskTime(
        completedAt
      )}`,

    href:
      marketplace ===
        "ozon"

        ? "/ozon"

        : marketplace ===
            "wildberries"

          ? "/wildberries"

          : "/yandex-market",
  };

}


function buildTestStockNotification({
  id,
  marketplace,
  marketplaceLabel,
  article,
  href,
  notificationAt,
}: {
  id:
    string;

  marketplace:
    SyncNotification["marketplace"];

  marketplaceLabel:
    string;

  article:
    string;

  href:
    string;

  notificationAt:
    string;
}):
SyncNotification {

  return {
    id,

    kind:
      "stock_zero",

    marketplace,

    marketplaceLabel,

    title:
      "Товар закончился",

    completedAt:
      notificationAt,

    notificationAt,

    dataDate:
      formatKrasnoyarskDate(
        notificationAt
      ),

    updateTime:
      formatKrasnoyarskTime(
        notificationAt
      ),

    notificationTime:
      formatKrasnoyarskTime(
        notificationAt
      ),

    notificationDisplay:
      getNotificationDisplay(
        notificationAt
      ),

    description:
      `${marketplaceLabel}, ${article} — осталось 0 дней`,

    href,
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


  /*
   * Пробные уведомления о нулевом запасе в днях.
   * Данные маркетплейсов здесь не изменяются.
   */
  notifications.push(
    buildTestStockNotification({
      id:
        "test-stock-zero:ozon:01OIP2:2026-10-21",

      marketplace:
        "ozon",

      marketplaceLabel:
        "Ozon",

      article:
        "01OIP2",

      href:
        "/ozon?focusStockDays=01OIP2",

      notificationAt:
        "2026-10-21T02:15:00.000Z",
    }),

    buildTestStockNotification({
      id:
        "test-stock-zero:wildberries:1286384330:2026-10-21",

      marketplace:
        "wildberries",

      marketplaceLabel:
        "WB",

      article:
        "1286384330",

      href:
        "/wildberries?focusStockDays=1286384330",

      notificationAt:
        "2026-10-21T02:16:00.000Z",
    }),

    buildTestStockNotification({
      id:
        "test-stock-zero:yandex-market:AVD-P01:2026-10-21",

      marketplace:
        "yandex_market",

      marketplaceLabel:
        "Яндекс Маркет",

      article:
        "AVD-P01",

      href:
        "/yandex-market?focusStockDays=AVD-P01",

      notificationAt:
        "2026-10-21T02:17:00.000Z",
    })
  );


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
