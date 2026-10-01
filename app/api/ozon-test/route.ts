import { NextResponse } from "next/server";


// ============================================
// ТЕСТ ПОДКЛЮЧЕНИЯ К OZON SELLER API
// ============================================

export async function GET() {

  const clientId =
    process.env.OZON_CLIENT_ID;

  const apiKey =
    process.env.OZON_API_KEY;


  // ==========================================
  // ПРОВЕРКА ПЕРЕМЕННЫХ VERCEL
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
    // READ-ONLY ЗАПРОС В OZON
    //
    // Получаем информацию о кабинете.
    // Ничего в Ozon не изменяем.
    // ========================================

    const response =
      await fetch(
        "https://api-seller.ozon.ru/v1/seller/info",
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
            JSON.stringify({}),

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
    // РАЗБИРАЕМ УСПЕШНЫЙ ОТВЕТ
    // ========================================

    let data:
      unknown;


    try {

      data =
        JSON.parse(
          responseText
        );

    } catch {

      data =
        responseText;

    }


    // ========================================
    // СЕКРЕТЫ В БРАУЗЕР НЕ ВОЗВРАЩАЕМ
    // ========================================

    return NextResponse.json(
      {
        ok: true,

        message:
          "Подключение к Ozon Seller API работает",

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
            : "Неизвестная ошибка подключения к Ozon",
      },
      {
        status: 500,
      }
    );

  }

}
