import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type MoqReviewRequest = {
  decision?:
    "approve" | "reject";

  actorName?:
    string;

  actorUserId?:
    string | null;

  actorRole?:
    string;

  comment?:
    string | null;
};


type MoqReviewResponse = {
  ok:
    boolean;

  error?:
    string;

  item_id?:
    string;

  our_article?:
    string | null;

  product_name?:
    string | null;

  decision?:
    string;

  moq_quantity?:
    number;

  unit_price_cny?:
    number;

  proposed_cartons?:
    number;

  proposed_quantity?:
    number;

  coverage_after_order_days?:
    number | null;

  moq_review_status?:
    string;

  accepted_cartons?:
    number;

  accepted_quantity?:
    number;

  ready_for_transport?:
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
    // 1. ITEM ID
    // ========================================================

    const {
      id,
    } =
      await context.params;


    if (
      !id
      ||
      !id.trim()
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Не указан ID позиции заказа",
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
      MoqReviewRequest =
        await request.json();


    // ========================================================
    // 3. DECISION
    // ========================================================

    if (
      body.decision !==
        "approve"
      &&
      body.decision !==
        "reject"
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Решение должно быть approve или reject",
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
            "Не указан сотрудник, принимающий решение",
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
      "analytics";


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
        `${supabaseUrl}/rest/v1/rpc/resolve_ved_order_item_moq_review`,
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

          },

          body:
            JSON.stringify(
              {
                p_item_id:
                  id.trim(),

                p_decision:
                  body.decision,

                p_actor_name:
                  actorName,

                p_actor_user_id:
                  body.actorUserId
                  ??
                  null,

                p_actor_role:
                  actorRole,

                p_comment:
                  body.comment
                  ??
                  null,
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


    const result:
      MoqReviewResponse =
        JSON.parse(
          text
        );


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
      "MOQ review error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка решения по MOQ",
      },
      {
        status:
          500,
      }
    );

  }

}
