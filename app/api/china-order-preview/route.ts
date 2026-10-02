import {
  NextRequest,
  NextResponse,
} from "next/server";


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
  request: NextRequest
) {

  try {

    const body =
      await request.json();


    const scenario =
      body?.scenario;


    if (
      scenario !== "container"
      &&
      scenario !== "truck"
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            "Сценарий должен быть container или truck",
        },
        {
          status: 400,
        }
      );

    }


    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_china_order_preview`,
        {
          method: "POST",

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
                p_scenario:
                  scenario,
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
          ok: false,

          error:
            `Ошибка Supabase. HTTP ${response.status}. ${text}`,
        },
        {
          status: 500,
        }
      );

    }


    const data =
      JSON.parse(
        text
      );


    return NextResponse.json(
      data,
      {
        status: 200,
      }
    );


  } catch (error) {

    console.error(
      "China order preview error:",
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка состава заказа",
      },
      {
        status: 500,
      }
    );

  }

}
