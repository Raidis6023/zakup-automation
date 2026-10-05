import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type ReadinessBlockers = {
  terms_pending?: number;
  moq_review_pending?: number;

  missing_chinese_article?: number;
  missing_name?: number;
  missing_photo?: number;

  missing_units_per_carton?: number;
  missing_carton_volume?: number;
  missing_carton_weight?: number;

  missing_cartons?: number;
  missing_order_quantity?: number;

  missing_incoterm?: number;
};


type ProblemItem = {
  item_id?: string;

  our_article?: string | null;

  product_name?: string | null;

  problems?: string[];
};


type ReadinessResponse = {
  ok: boolean;

  error?: string;

  order_id?: string;

  workflow_status?: string;

  ready?: boolean;

  total_items?: number;

  included_items?: number;

  excluded_items?: number;

  blockers?: ReadinessBlockers;

  problem_items?: ProblemItem[];
};


type SendRequest = {
  actorName?: string;

  actorUserId?: string | null;

  actorRole?: string;
};


type SendResponse = {
  ok: boolean;

  error?: string;

  sent?: boolean;

  order_id?: string;

  workflow_status?: string;

  first_sent_to_ved_at?: string;

  last_sent_to_ved_at?: string;

  readiness?: ReadinessResponse;
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

async function callRpc<T>(
  functionName: string,
  body: Record<string, unknown>
):
  Promise<T> {

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

          Accept:
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


  if (!text.trim()) {

    throw new Error(
      "Supabase вернул пустой ответ"
    );

  }


  return JSON.parse(
    text
  ) as T;

}


// ============================================================
// GET
//
// Проверяет готовность заказа.
// Ничего не изменяет.
// ============================================================

export async function GET(

  _request:
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
    // 2. READINESS
    // ========================================================

    const result =
      await callRpc<ReadinessResponse>(
        "get_ved_order_handoff_readiness",
        {
          p_order_id:
            orderId,
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
      "VED handoff readiness error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка проверки готовности заказа",
      },
      {
        status:
          500,
      }
    );

  }

}


// ============================================================
// POST
//
// Передаёт заказ в ВЭД.
// Перед передачей Supabase ещё раз сам проверяет готовность.
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
      SendRequest =
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
            "Не указан сотрудник, передающий заказ в ВЭД",
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
    // 4. SEND TO VED
    // ========================================================

    const result =
      await callRpc<SendResponse>(
        "send_ved_order_to_ved",
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
      );


    // ========================================================
    // 5. ЕСЛИ ЗАКАЗ НЕ ГОТОВ
    //
    // Это не ошибка сервера.
    // Возвращаем 200 и список блокеров.
    // ========================================================

    if (
      result.ok === false
      &&
      result.sent === false
    ) {

      return NextResponse.json(
        result,
        {
          status:
            200,
        }
      );

    }


    if (
      !result.ok
      ||
      !result.sent
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          sent:
            false,

          error:
            result.error
            ??
            "Не удалось передать заказ в ВЭД",
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
      "VED order handoff error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        sent:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка передачи заказа в ВЭД",
      },
      {
        status:
          500,
      }
    );

  }

}
