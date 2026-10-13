import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


// ============================================================
// GET
// ============================================================

export async function GET() {

  const wbToken =
    process.env
      .WB_READ_TOKEN
      ?.trim();


  if (!wbToken) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найден WB_READ_TOKEN",
      },
      {
        status:
          500,
      }
    );

  }


  const url =
    "https://seller-analytics-api.wildberries.ru"
    +
    "/api/analytics/v3/sales-funnel/products";


  const requestBody = {

    selectedPeriod: {

      start:
        "2026-10-12",

      end:
        "2026-10-12",

    },

    nmIds:
      [],

    brandNames:
      [],

    subjectIds:
      [],

    tagIds:
      [],

    skipDeletedNm:
      true,

    limit:
      1000,

    offset:
      0,

  };


  try {

    const response =
      await fetch(
        url,
        {
          method:
            "POST",

          headers: {

            Authorization:
              wbToken,

            Accept:
              "application/json",

            "Content-Type":
              "application/json",

          },

          body:
            JSON.stringify(
              requestBody
            ),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    let data:
      any;


    try {

      data =
        JSON.parse(
          text
        );

    } catch {

      data =
        text;

    }


    return NextResponse.json(
      {

        ok:
          response.ok,

        wbStatus:
          response.status,

        rateLimit: {

          limit:
            response.headers.get(
              "x-ratelimit-limit"
            ),

          remaining:
            response.headers.get(
              "x-ratelimit-remaining"
            ),

          retry:
            response.headers.get(
              "x-ratelimit-retry"
            ),

          reset:
            response.headers.get(
              "x-ratelimit-reset"
            ),

        },

        requestBody,

        wbResponse:
          data,

      },
      {
        status:
          response.ok
            ?
            200
            :
            response.status,
      }
    );

  } catch (
    error
  ) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Ошибка тестового запроса WB",

        error:
          error instanceof Error
            ?
            error.message
            :
            "Неизвестная ошибка",
      },
      {
        status:
          500,
      }
    );

  }

}
