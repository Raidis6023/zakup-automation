import {
  NextResponse,
} from "next/server";


// ============================================
// ТЕСТ ПОЛУЧЕНИЯ ОСТАТКОВ OZON
//
// НИЧЕГО НЕ ЗАПИСЫВАЕТ В SUPABASE.
// Только читает данные из Ozon.
// ============================================

export async function GET() {

  const clientId =
    process.env.OZON_CLIENT_ID;

  const apiKey =
    process.env.OZON_API_KEY;


  // ==========================================
  // ПРОВЕРЯЕМ СЕКРЕТЫ
  // ==========================================

  if (!clientId) {

    return NextResponse.json(
      {
        ok: false,

        error:
          "Vercel не видит OZON_CLIENT_ID",
      },
      {
        status: 500,
      }
    );

  }


  if (!apiKey) {

    return NextResponse.json(
      {
        ok: false,

        error:
          "Vercel не видит OZON_API_KEY",
      },
      {
        status: 500,
      }
    );

  }


  try {

    // ========================================
    // ЗАПРАШИВАЕМ ПЕРВЫЕ 20 ТОВАРОВ
    // ========================================

    const response =
      await fetch(
        "https://api-seller.ozon.ru/v4/product/info/stocks",
        {
          method: "POST",

          headers: {

            "Client-Id":
              clientId,

            "Api-Key":
              apiKey,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",

          },

          body:
            JSON.stringify(
              {
                cursor: "",

                filter: {
                  visibility:
                    "ALL",
                },

                limit: 20,
              }
            ),

          cache:
            "no-store",
        }
      );


    const responseText =
      await response.text();


    // ========================================
    // OZON ВЕРНУЛ ОШИБКУ
    // ========================================

    if (!response.ok) {

      return NextResponse.json(
        {
          ok: false,

          ozonStatus:
            response.status,

          ozonResponse:
            responseText,
        },
        {
          status:
            response.status,
        }
      );

    }


    // ========================================
    // РАЗБИРАЕМ JSON
    // ========================================

    let data:
      unknown;


    try {

      data =
        JSON.parse(
          responseText
        );

    } catch {

      return NextResponse.json(
        {
          ok: false,

          error:
            "Ozon вернул ответ, который не удалось разобрать как JSON",

          raw:
            responseText,
        },
        {
          status: 500,
        }
      );

    }


    // ========================================
    // ВОЗВРАЩАЕМ ОТВЕТ
    //
    // СЕКРЕТЫ СЮДА НЕ ПОПАДАЮТ.
    // ========================================

    return NextResponse.json(
      {
        ok: true,

        message:
          "Остатки Ozon успешно получены",

        data,
      },
      {
        status: 200,
      }
    );


  } catch (error) {

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка получения остатков Ozon",
      },
      {
        status: 500,
      }
    );

  }

}
