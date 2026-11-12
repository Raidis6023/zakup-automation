import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";


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

  manualCartons?: number;

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


// Manually created product lines have no selected_demand_units.
// The standard preview assumes this value exists and would write a NULL
// order_quantity. Keep this workflow fully separate and permissions-checked.
async function processManualTerms(
  itemId: string,
  action: "preview" | "confirm",
  moqQuantity: number,
  unitPriceCny: number,
  cartons: number
) {
  if (!Number.isSafeInteger(cartons) || cartons < 0 || cartons > 100000) {
    return NextResponse.json({ ok: false, error: "Введите целое количество коробов от 0 до 100 000" }, { status: 400 });
  }

  const session = await createClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
  }
  const { data: rawProfile, error: profileError } = await session.rpc("app_get_my_profile");
  type Profile = {
    user_id?: string;
    role_name?: string;
    has_admin_access?: boolean;
    first_name?: string;
    last_name?: string;
  };
  const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as Profile | null;
  if (profileError || !profile || profile.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Не удалось проверить права сотрудника" }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data: item, error: itemError } = await admin.from("ved_order_items")
    .select("id,added_manually,selected_demand_units,ved_order_id")
    .eq("id", itemId).maybeSingle();
  if (itemError || !item) {
    return NextResponse.json({ ok: false, error: "Позиция заказа не найдена" }, { status: 404 });
  }
  if (item.added_manually !== true || item.selected_demand_units !== null) {
    return NextResponse.json({ ok: false, error: "Для этого товара используется обычный расчёт закупки" }, { status: 409 });
  }
  const { data: order, error: orderError } = await admin.from("ved_orders")
    .select("workflow_status,preparation_department").eq("id", item.ved_order_id).maybeSingle();
  if (orderError || !order) {
    return NextResponse.json({ ok: false, error: "Заказ не найден" }, { status: 404 });
  }
  const allowed = profile.has_admin_access === true ||
    (profile.role_name === "Закуп" && order.preparation_department === "procurement") ||
    (profile.role_name === "Аналитик" && order.preparation_department === "analytics");
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Нет прав на изменение этого заказа" }, { status: 403 });
  }
  if (!["draft", "returned_for_edit"].includes(order.workflow_status)) {
    return NextResponse.json({ ok: false, error: "Изменять товар можно только в черновике заказа" }, { status: 409 });
  }
  const actorName = [profile.first_name, profile.last_name]
    .map(name => String(name ?? "").trim()).filter(Boolean).join(" ") ||
    user.email || "Сотрудник";
  const { data, error } = await admin.rpc("ved_manual_item_terms", {
    p_item_id: itemId,
    p_moq_quantity: moqQuantity,
    p_unit_price_cny: unitPriceCny,
    p_cartons: cartons,
    p_confirm: action === "confirm",
    p_actor_user_id: user.id,
    p_actor_name: actorName,
    p_actor_role: profile.role_name || "Администратор",
  });
  if (error) {
    console.warn("[VED TERMS] Manual calculation rejected", {
      itemId, reason: error.message
    });
    return NextResponse.json({
      ok: false,
      error: error.message.length <= 350 ? error.message :
        "Не удалось рассчитать позицию, проверьте MOQ и количество коробов"
    }, { status: 400 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
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


    // Ручные позиции из каталога / Excel не имеют спроса из закупки.
    // Ноль коробов означает подтверждение только MOQ и цены.
    if (body.manualCartons !== undefined) {
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");
      if (!origin || !host || new URL(origin).host !== host) {
        return NextResponse.json({ ok: false, error: "Недопустимый источник запроса" }, { status: 403 });
      }
      return processManualTerms(
        id.trim(),
        action,
        moqQuantity,
        unitPriceCny,
        Number(body.manualCartons)
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
