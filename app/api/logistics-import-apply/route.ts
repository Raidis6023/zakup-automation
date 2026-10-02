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
// ПОДТВЕРЖДЕНИЕ ИМПОРТА
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    const body =
      await request.json();


    const rows =
      body?.rows;


    if (
      !Array.isArray(rows)
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            "Не передан массив логистических данных",
        },
        {
          status: 400,
        }
      );

    }


    if (
      rows.length === 0
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            "Нет данных для импорта",
        },
        {
          status: 400,
        }
      );

    }


    if (
      rows.length > 5000
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            "Слишком много строк в одном импорте",
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
        `${supabaseUrl}/rest/v1/rpc/apply_transport_carton_import`,
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
                p_rows:
                  rows,
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
      "Logistics import error:",
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка импорта",
      },
      {
        status: 500,
      }
    );

  }

}
