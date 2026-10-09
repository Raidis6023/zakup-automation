import { NextResponse } from "next/server";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


// ============================================================
// HELPERS
// ============================================================

function parseJson(
  value: string
): unknown {

  try {

    return JSON.parse(
      value
    );

  } catch {

    return value;

  }

}


// ============================================================
// POST
// ============================================================

export async function POST(
  request: Request
) {

  const supabaseUrl =
    process.env.SUPABASE_URL
    ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;


  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env.SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найдена SUPABASE_URL",
      },
      {
        status:
          500,
      }
    );

  }


  if (!supabaseKey) {

    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Не найден SUPABASE_SERVICE_ROLE_KEY",
      },
      {
        status:
          500,
      }
    );

  }


  try {

    const body:
      any =
      await request.json();


    const nmId =
      Number(
        body?.nmId
      );


    const masterCode =
      String(
        body?.masterCode
        ??
        ""
      )
        .trim()
        .toUpperCase();


    // ========================================================
    // VALIDATION
    // ========================================================

    if (
      !Number.isInteger(
        nmId
      )
      ||
      nmId <= 0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Некорректный Артикул WB",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      !/^[0-9A-Z]{6}$/.test(
        masterCode
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          message:
            "master_code должен содержать ровно 6 латинских букв/цифр",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // RPC
    // ========================================================

    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/link_wb_master_code`,
        {
          method:
            "POST",

          headers: {

            apikey:
              supabaseKey,

            Authorization:
              `Bearer ${supabaseKey}`,

            Accept:
              "application/json",

            "Content-Type":
              "application/json",

          },

          body:
            JSON.stringify({

              p_nm_id:
                nmId,

              p_master_code:
                masterCode,

            }),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    const data =
      parseJson(
        text
      );


    if (!response.ok) {

      let message =
        "Не удалось привязать master_code";


      if (
        data
        &&
        typeof data ===
          "object"
        &&
        "message" in data
        &&
        typeof (
          data as any
        ).message ===
          "string"
      ) {

        message =
          (
            data as any
          ).message;

      }


      return NextResponse.json(
        {
          ok:
            false,

          message,

          supabaseStatus:
            response.status,

          supabaseResponse:
            data,
        },
        {
          status:
            400,
        }
      );

    }


    return NextResponse.json(
      {
        ok:
          true,

        message:
          "master_code успешно привязан",

        result:
          data,
      }
    );

  } catch (
    error
  ) {

    console.error(
      "Ошибка привязки master_code WB:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
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
