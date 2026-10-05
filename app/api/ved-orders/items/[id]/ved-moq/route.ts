import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type VedMoqRequest = {
  moqQuantity?:
    number | string;

  actorName?:
    string;

  actorUserId?:
    string | null;

  actorRole?:
    string;
};


type VedMoqResponse = {
  ok:
    boolean;

  error?:
    string;

  item_id?:
    string;

  order_id?:
    string;

  moq_quantity?:
    number;

  cartons?:
    number;

  order_quantity?:
    number;

  coverage_after_order_days?:
    number | null;

  moq_review_required?:
    boolean;

  moq_review_status?:
    string;

  total_price_cny?:
    number | null;

  total_volume_m3?:
    number | null;

  total_weight_tons?:
    number | null;
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
// PARSE MOQ
// ============================================================

function parsePositiveInteger(
  value:
    number
    | string
    | undefined
):
  number | null {

  if (
    value === undefined
    ||
    value === null
  ) {

    return null;

  }


  const normalized =
    String(value)
      .trim()
      .replace(
        /\s/g,
        ""
      );


  if (!normalized) {

    return null;

  }


  const parsed =
    Number(
      normalized
    );


  if (
    !Number.isFinite(
      parsed
    )
    ||
    parsed <= 0
    ||
    !Number.isInteger(
      parsed
    )
  ) {

    return null;

  }


  return parsed;

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


    const itemId =
      id?.trim();


    if (!itemId) {

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
      VedMoqRequest =
        await request.json();


    // ========================================================
    // 3. MOQ
    // ========================================================

    const moqQuantity =
      parsePositiveInteger(
        body.moqQuantity
      );


    if (
      moqQuantity === null
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "MOQ должен быть целым числом больше 0",
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
        `${supabaseUrl}/rest/v1/rpc/update_ved_order_item_moq_by_ved`,
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
                p_item_id:
                  itemId,

                p_moq_quantity:
                  moqQuantity,

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
      VedMoqResponse =
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
            "Не удалось сохранить новый MOQ",
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 6. SUCCESS
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
      "VED MOQ edit error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка изменения MOQ",
      },
      {
        status:
          500,
      }
    );

  }

}
