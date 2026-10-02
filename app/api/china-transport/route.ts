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
//
// Получает:
// newProductsVolumeM3
//
// Возвращает:
// результат get_china_transport_decision()
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    const body =
      await request.json();


    const rawVolume =
      body?.newProductsVolumeM3;


    const newProductsVolumeM3 =
      Number(
        rawVolume ?? 0
      );


    if (
      !Number.isFinite(
        newProductsVolumeM3
      )
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            "Некорректный объём новых товаров",
        },
        {
          status: 400,
        }
      );

    }


    if (
      newProductsVolumeM3 < 0
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            "Объём новых товаров не может быть отрицательным",
        },
        {
          status: 400,
        }
      );

    }


    if (
      newProductsVolumeM3 >
        10000
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            "Указан слишком большой объём новых товаров",
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
        `${supabaseUrl}/rest/v1/rpc/get_china_transport_decision`,
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
                p_new_products_volume_m3:
                  newProductsVolumeM3,
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


    let data:
      unknown;


    try {

      data =
        JSON.parse(
          text
        );

    } catch {

      return NextResponse.json(
        {
          ok: false,

          error:
            "Supabase вернул некорректный JSON",
        },
        {
          status: 500,
        }
      );

    }


    return NextResponse.json(
      data,
      {
        status: 200,
      }
    );


  } catch (error) {

    console.error(
      "China transport error:",
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка транспортного расчёта",
      },
      {
        status: 500,
      }
    );

  }

}
