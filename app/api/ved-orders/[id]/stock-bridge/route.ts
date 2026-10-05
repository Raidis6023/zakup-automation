import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type StockBridgeResponse = {
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

  bridge_applicable?:
    boolean;

  stock_bridge_active?:
    boolean;

  stock_bridge_completed?:
    boolean;

  actual_arrival_date?:
    string | null;

  arrival_confirmed_at?:
    string | null;

  warehouse_snapshot_date?:
    string | null;

  warehouse_snapshot_imported_at?:
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
// GET
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
    // 2. SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_ved_order_stock_bridge_status`,
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
              }
            ),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    // ========================================================
    // 3. SUPABASE ERROR
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
    // 4. EMPTY RESPONSE
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
    // 5. PARSE RESPONSE
    // ========================================================

    const result:
      StockBridgeResponse =
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
            "Не удалось получить состояние складского моста",
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
      "VED stock bridge status error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка получения состояния складского моста",
      },
      {
        status:
          500,
      }
    );

  }

}
