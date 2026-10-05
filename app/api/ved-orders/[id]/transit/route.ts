import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type TransitRequest = {
  transitDepartureDate?:
    string;

  actorName?:
    string;

  actorUserId?:
    string | null;

  actorRole?:
    string;
};


type TransitResponse = {
  ok:
    boolean;

  error?:
    string;

  order_id?:
    string;

  order_number?:
    string;

  workflow_status?:
    string;

  transit_departure_date?:
    string;

  transit_started_at?:
    string;

  expected_arrival_date?:
    string;

  included_items?:
    number;
};


// ============================================================
// SUPABASE CONFIG
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Vercel не видит NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Vercel не видит SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


// ============================================================
// DATE CHECK
// ============================================================

function isValidDateString(
  value:
    string
) {

  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(
        value
      )
  ) {

    return false;

  }


  const date =
    new Date(
      `${value}T00:00:00Z`
    );


  return !Number.isNaN(
    date.getTime()
  );

}


// ============================================================
// POST
// ============================================================

export async function POST(

  request:
    NextRequest,

  context: {
    params:
      Promise<{
        id: string;
      }>;
  }

) {

  try {

    // ========================================================
    // 1. ORDER ID
    // ========================================================

    const {
      id,
    } =
      await context.params;


    const orderId =
      id?.trim();


    if (!orderId) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Не указан ID заказа",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 2. BODY
    // ========================================================

    const body:
      TransitRequest =
        await request.json();


    // ========================================================
    // 3. TRANSIT DATE
    // ========================================================

    const transitDepartureDate =
      body.transitDepartureDate
        ?.trim();


    if (
      !transitDepartureDate
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Укажите дату фактической отправки заказа",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      !isValidDateString(
        transitDepartureDate
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Некорректная дата фактической отправки заказа",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 4. ACTOR
    // ========================================================

    const actorName =
      body.actorName
        ?.trim();


    if (!actorName) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Не указан сотрудник ВЭД",
        },
        {
          status:
            400,
        }
      );

    }


    const actorRole =
      body.actorRole
        ?.trim()
      ||
      "ved";


    // ========================================================
    // 5. SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/confirm_ved_order_in_transit`,
        {
          method:
            "POST",

          headers: {

            apikey:
              supabaseSecretKey,

            Authorization:
              `Bearer ${supabaseSecretKey}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",

          },

          body:
            JSON.stringify(
              {
                p_order_id:
                  orderId,

                p_transit_departure_date:
                  transitDepartureDate,

                p_actor_name:
                  actorName,

                p_actor_user_id:
                  body.actorUserId
                  ??
                  null,

                p_actor_role:
                  actorRole,
              }
            ),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    // ========================================================
    // 6. SUPABASE ERROR
    // ========================================================

    if (!response.ok) {

      let errorMessage =
        `Ошибка Supabase. HTTP ${response.status}. ${text}`;


      try {

        const parsed =
          JSON.parse(
            text
          );


        if (
          parsed
          &&
          typeof parsed.message ===
            "string"
        ) {

          errorMessage =
            parsed.message;

        }

      } catch {

        // Оставляем исходный текст ошибки.

      }


      return NextResponse.json(
        {
          ok:
            false,

          error:
            errorMessage,
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 7. EMPTY RESPONSE
    // ========================================================

    if (!text.trim()) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Supabase вернул пустой ответ",
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 8. PARSE RESPONSE
    // ========================================================

    const result:
      TransitResponse =
        JSON.parse(
          text
        );


    if (!result.ok) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            result.error
            ??
            "Не удалось перевести заказ в статус «В пути»",
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 9. SUCCESS
    // ========================================================

    return NextResponse.json(
      result,
      {
        status:
          200,
      }
    );


  } catch (
    error
  ) {

    console.error(
      "VED transit confirmation error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка подтверждения отправки заказа",
      },
      {
        status:
          500,
      }
    );

  }

}
