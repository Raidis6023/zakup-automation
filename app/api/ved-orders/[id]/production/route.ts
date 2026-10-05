import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type ProductionRequest = {
  orderNumber?:
    string;

  productionHandoffDate?:
    string;

  actorName?:
    string;

  actorUserId?:
    string | null;

  actorRole?:
    string;
};


type ProductionResponse = {
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

  production_handoff_date?:
    string;

  production_confirmed_at?:
    string;

  planned_lead_days?:
    number;

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
      ProductionRequest =
        await request.json();


    // ========================================================
    // 3. ORDER NUMBER
    // ========================================================

    const orderNumber =
      body.orderNumber
        ?.trim();


    if (!orderNumber) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Укажите номер заказа",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 4. PRODUCTION DATE
    // ========================================================

    const productionHandoffDate =
      body.productionHandoffDate
        ?.trim();


    if (
      !productionHandoffDate
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Укажите дату передачи заказа в производство",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      !isValidDateString(
        productionHandoffDate
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Некорректная дата передачи заказа в производство",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 5. ACTOR
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
    // 6. SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/confirm_ved_order_production`,
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

                p_order_number:
                  orderNumber,

                p_production_handoff_date:
                  productionHandoffDate,

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
    // 7. SUPABASE ERROR
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
    // 8. EMPTY RESPONSE
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
    // 9. PARSE RESPONSE
    // ========================================================

    const result:
      ProductionResponse =
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
            "Не удалось подтвердить передачу заказа в производство",
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 10. SUCCESS
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
      "VED production confirmation error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка подтверждения производства",
      },
      {
        status:
          500,
      }
    );

  }

}
