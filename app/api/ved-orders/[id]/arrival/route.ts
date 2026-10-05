import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type ArrivalRequest = {
  actualArrivalDate?:
    string;

  actorName?:
    string;

  actorUserId?:
    string | null;

  actorRole?:
    string;
};


type ArrivalResponse = {
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

  item_status?:
    string;

  actual_arrival_date?:
    string;

  arrival_confirmed_at?:
    string;

  expected_arrival_date?:
    string;

  included_items?:
    number;

  stock_bridge_active?:
    boolean;
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
      ArrivalRequest =
        await request.json();


    // ========================================================
    // 3. ARRIVAL DATE
    // ========================================================

    const actualArrivalDate =
      body.actualArrivalDate
        ?.trim();


    if (
      !actualArrivalDate
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Укажите фактическую дату прибытия заказа",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      !isValidDateString(
        actualArrivalDate
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Некорректная фактическая дата прибытия заказа",
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
        `${supabaseUrl}/rest/v1/rpc/confirm_ved_order_arrival`,
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

                p_actual_arrival_date:
                  actualArrivalDate,

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
      ArrivalResponse =
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
            "Не удалось подтвердить прибытие заказа",
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
      "VED arrival confirmation error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка подтверждения прибытия заказа",
      },
      {
        status:
          500,
      }
    );

  }

}
