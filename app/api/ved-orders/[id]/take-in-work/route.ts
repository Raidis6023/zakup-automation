import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type TakeInWorkRequest = {
  actorName?:
    string;

  actorUserId?:
    string | null;

  actorRole?:
    string;
};


type TakeInWorkResponse = {
  ok:
    boolean;

  error?:
    string;

  order_id?:
    string;

  workflow_status?:
    string;

  status?:
    string;

  ved_responsible_user_id?:
    string | null;

  ved_responsible_name?:
    string;

  ved_taken_at?:
    string;
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
      TakeInWorkRequest =
        await request.json();


    // ========================================================
    // 3. VED EMPLOYEE
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
            "Укажите сотрудника ВЭД",
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
    // 4. SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/take_ved_order_in_work`,
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


    if (!response.ok) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            `Ошибка Supabase. HTTP ${response.status}. ${text}`,
        },
        {
          status:
            500,
        }
      );

    }


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


    const result:
      TakeInWorkResponse =
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
            "Не удалось взять заказ в работу",
        },
        {
          status:
            500,
        }
      );

    }


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
      "Take VED order in work error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка взятия заказа в работу",
      },
      {
        status:
          500,
      }
    );

  }

}
