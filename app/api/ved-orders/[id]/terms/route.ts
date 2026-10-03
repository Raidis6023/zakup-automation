import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type TermsRequest = {
  action?:
    "preview" | "confirm";

  moqQuantity?:
    number;

  unitPriceCny?:
    number;

  actorName?:
    string;

  actorUserId?:
    string | null;

  actorRole?:
    string;
};


type RpcResult = {
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

  scenario?:
    string;

  target_days?:
    number;

  selected_demand_units?:
    number;

  units_per_carton?:
    number;

  moq_quantity?:
    number;

  unit_price_cny?:
    number;

  standard_cartons?:
    number;

  standard_quantity?:
    number;

  moq_changed_quantity?:
    boolean;

  final_cartons?:
    number;

  final_quantity?:
    number;

  coverage_after_order_days?:
    number | null;

  target_coverage_days?:
    number;

  moq_review_required?:
    boolean;

  total_price_cny?:
    number;

  total_volume_m3?:
    number | null;

  total_weight_tons?:
    number | null;

  terms_confirmed?:
    boolean;

  moq_review_status?:
    string;

  proposed_cartons?:
    number;

  proposed_quantity?:
    number;

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
// RPC
// ============================================================

async function callRpc(
  functionName: string,
  body: Record<string, unknown>
):
  Promise<RpcResult> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/${functionName}`,
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
            body
          ),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Ошибка Supabase. HTTP ${response.status}. ${text}`
    );

  }


  return JSON.parse(
    text
  ) as RpcResult;

}


// ============================================================
// POST
//
// action = preview
//   Только предварительно считает.
//
// action = confirm
//   Сохраняет подтверждённые MOQ и цену.
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
      TermsRequest =
        await request.json();


    const action =
      body.action;


    if (
      action !== "preview"
      &&
      action !== "confirm"
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "action должен быть preview или confirm",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 3. MOQ
    // ========================================================

    const moqQuantity =
      Number(
        body.moqQuantity
      );


    if (
      !Number.isInteger(
        moqQuantity
      )
      ||
      moqQuantity <= 0
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
    // 4. PRICE
    // ========================================================

    const unitPriceCny =
      Number(
        body.unitPriceCny
      );


    if (
      !Number.isFinite(
        unitPriceCny
      )
      ||
      unitPriceCny <= 0
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
    // 5. PREVIEW
    // ========================================================

    if (
      action === "preview"
    ) {

      const result =
        await callRpc(
          "preview_ved_order_item_terms",
          {
            p_item_id:
              id.trim(),

            p_moq_quantity:
              moqQuantity,

            p_unit_price_cny:
              unitPriceCny,
          }
        );


      return NextResponse.json(
        result,
        {
          status:
            200,
        }
      );

    }


    // ========================================================
    // 6. CONFIRM
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
            "Не указан сотрудник, подтверждающий MOQ и цену",
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


    const result =
      await callRpc(
        "confirm_ved_order_item_terms",
        {
          p_item_id:
            id.trim(),

          p_moq_quantity:
            moqQuantity,

          p_unit_price_cny:
            unitPriceCny,

          p_actor_name:
            actorName,

          p_actor_user_id:
            body.actorUserId
            ??
            null,

          p_actor_role:
            actorRole,
        }
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
      "VED item terms error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка работы с MOQ и ценой",
      },
      {
        status:
          500,
      }
    );

  }

}
