import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type PreparationRequest = {
  chineseArticle?:
    string;

  cartonWeightKg?:
    number | string;

  actorName?:
    string;

  actorUserId?:
    string | null;

  actorRole?:
    string;
};


type PreparationResponse = {
  ok:
    boolean;

  error?:
    string;

  item_id?:
    string;

  our_article?:
    string | null;

  chinese_article?:
    string | null;

  carton_weight_kg?:
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
// PARSE NUMBER
// ============================================================

function parsePositiveNumber(
  value:
    number | string | undefined
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
      )
      .replace(
        ",",
        "."
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
      PreparationRequest =
        await request.json();


    // ========================================================
    // 3. CHINESE ARTICLE
    // ========================================================

    const chineseArticle =
      body.chineseArticle
        ?.trim();


    if (!chineseArticle) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Укажите китайский артикул",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 4. CARTON WEIGHT
    // ========================================================

    const cartonWeightKg =
      parsePositiveNumber(
        body.cartonWeightKg
      );


    if (
      cartonWeightKg === null
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Вес транспортного короба должен быть больше 0",
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
            "Не указан сотрудник, изменяющий данные",
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
    // 6. SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/update_ved_order_item_preparation_data`,
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
                  itemId,

                p_chinese_article:
                  chineseArticle,

                p_carton_weight_kg:
                  cartonWeightKg,

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


    const result:
      PreparationResponse =
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
            "Не удалось сохранить данные позиции",
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
      "VED preparation data error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка сохранения данных позиции",
      },
      {
        status:
          500,
      }
    );

  }

}
