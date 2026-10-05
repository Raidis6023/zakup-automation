import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type VedEditRequest = {
  ourArticle?:
    string | null;

  unitPriceCny?:
    number | string;

  unitsPerCarton?:
    number | string;

  cartonVolumeM3?:
    number | string;

  cartonWeightKg?:
    number | string;

  incoterm?:
    string;

  port?:
    string | null;

  vedComment?:
    string | null;

  actorName?:
    string;

  actorUserId?:
    string | null;

  actorRole?:
    string;
};


type VedEditResponse = {
  ok:
    boolean;

  error?:
    string;

  item_id?:
    string;

  order_id?:
    string;

  our_article?:
    string | null;

  unit_price_cny?:
    number;

  units_per_carton?:
    number;

  carton_volume_m3?:
    number;

  carton_weight_kg?:
    number;

  order_quantity?:
    number;

  incoterm?:
    string;

  port?:
    string | null;

  ved_comment?:
    string | null;
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
// NUMBER HELPERS
// ============================================================

function parsePositiveNumber(
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


function parsePositiveInteger(
  value:
    number
    | string
    | undefined
):
  number | null {

  const parsed =
    parsePositiveNumber(
      value
    );


  if (
    parsed === null
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
      VedEditRequest =
        await request.json();


    // ========================================================
    // 3. ACTOR
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
    // 4. PRICE
    // ========================================================

    const unitPriceCny =
      parsePositiveNumber(
        body.unitPriceCny
      );


    if (
      unitPriceCny === null
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Цена должна быть больше 0",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 5. UNITS PER CARTON
    // ========================================================

    const unitsPerCarton =
      parsePositiveInteger(
        body.unitsPerCarton
      );


    if (
      unitsPerCarton === null
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Количество штук в коробе должно быть целым числом больше 0",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 6. CARTON VOLUME
    // ========================================================

    const cartonVolumeM3 =
      parsePositiveNumber(
        body.cartonVolumeM3
      );


    if (
      cartonVolumeM3 === null
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Объём короба должен быть больше 0",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 7. CARTON WEIGHT
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
            "Вес короба должен быть больше 0",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 8. INCOTERM
    // ========================================================

    const incoterm =
      body.incoterm
        ?.trim()
        .toUpperCase();


    if (
      incoterm !==
        "FOB"
      &&
      incoterm !==
        "FCA"
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Условия поставки должны быть FOB или FCA",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 9. TEXT VALUES
    // ========================================================

    const ourArticle =
      body.ourArticle
        ?.trim()
      ||
      null;


    const port =
      body.port
        ?.trim()
      ||
      null;


    const vedComment =
      body.vedComment
        ?.trim()
      ||
      null;


    // ========================================================
    // 10. SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/update_ved_order_item_by_ved`,
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

                p_our_article:
                  ourArticle,

                p_unit_price_cny:
                  unitPriceCny,

                p_units_per_carton:
                  unitsPerCarton,

                p_carton_volume_m3:
                  cartonVolumeM3,

                p_carton_weight_kg:
                  cartonWeightKg,

                p_incoterm:
                  incoterm,

                p_port:
                  port,

                p_ved_comment:
                  vedComment,

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
      VedEditResponse =
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
            "Не удалось сохранить изменения ВЭД",
        },
        {
          status:
            500,
        }
      );

    }


    // ========================================================
    // 11. SUCCESS
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
      "VED item edit error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка сохранения позиции ВЭД",
      },
      {
        status:
          500,
      }
    );

  }

}
