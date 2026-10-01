import {
  NextResponse,
} from "next/server";


// ============================================
// ТИПЫ
// ============================================

type OzonProductStock = {
  type?: string;
  present?: number;
  reserved?: number;
  sku?: number;
  warehouse_ids?: number[];
};


type OzonProductItem = {
  product_id?: number;
  offer_id?: string;

  stocks?: OzonProductStock[];
};


type OzonProductStocksResponse = {
  items?: OzonProductItem[];

  total?: number;

  cursor?: string;
};


// ============================================
// ТЕСТ ОСТАТКОВ OZON ПО КЛАСТЕРАМ
//
// ЭТА ВЕРСИЯ:
// 1. Получает несколько товаров.
// 2. Берёт их FBO SKU.
// 3. Передаёт SKU в /v1/analytics/stocks.
// 4. Возвращает реальный ответ Ozon.
//
// В SUPABASE НИЧЕГО НЕ ЗАПИСЫВАЕМ.
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


  const headers = {

    "Client-Id":
      clientId,

    "Api-Key":
      apiKey,

    "Content-Type":
      "application/json",

    Accept:
      "application/json",

  };


  try {

    // ========================================
    // ШАГ 1.
    // БЕРЁМ НЕСКОЛЬКО ТОВАРОВ
    // И ИХ OZON SKU
    // ========================================

    const productsResponse =
      await fetch(
        "https://api-seller.ozon.ru/v4/product/info/stocks",
        {
          method: "POST",

          headers,

          body:
            JSON.stringify(
              {
                cursor: "",

                filter: {
                  visibility:
                    "ALL",
                },

                limit: 50,
              }
            ),

          cache:
            "no-store",
        }
      );


    const productsText =
      await productsResponse.text();


    if (
      !productsResponse.ok
    ) {

      return NextResponse.json(
        {
          ok: false,

          step:
            "product_info_stocks",

          ozonStatus:
            productsResponse.status,

          ozonResponse:
            productsText,
        },
        {
          status:
            productsResponse.status,
        }
      );

    }


    let productsData:
      OzonProductStocksResponse;


    try {

      productsData =
        JSON.parse(
          productsText
        ) as OzonProductStocksResponse;

    } catch {

      return NextResponse.json(
        {
          ok: false,

          step:
            "product_info_stocks",

          error:
            "Не удалось разобрать ответ /v4/product/info/stocks",
        },
        {
          status: 500,
        }
      );

    }


    // ========================================
    // ШАГ 2.
    // СОБИРАЕМ FBO SKU
    // ========================================

    const skuSet =
      new Set<string>();


    for (
      const item
      of productsData.items ?? []
    ) {

      for (
        const stock
        of item.stocks ?? []
      ) {

        if (
          stock.type === "fbo"
          &&
          stock.sku
          &&
          stock.sku > 0
        ) {

          skuSet.add(
            String(
              stock.sku
            )
          );

        }

      }

    }


    const fboSkus =
      Array.from(
        skuSet
      )
        .slice(
          0,
          20
        );


    if (
      fboSkus.length === 0
    ) {

      return NextResponse.json(
        {
          ok: false,

          error:
            "В первых товарах не найдено FBO SKU для проверки аналитики",
        },
        {
          status: 400,
        }
      );

    }


    // ========================================
    // ШАГ 3.
    // ЗАПРАШИВАЕМ ОСТАТКИ
    // ПО КЛАСТЕРАМ
    // ========================================

    const analyticsResponse =
      await fetch(
        "https://api-seller.ozon.ru/v1/analytics/stocks",
        {
          method: "POST",

          headers,

          body:
            JSON.stringify(
              {
                skus:
                  fboSkus,
              }
            ),

          cache:
            "no-store",
        }
      );


    const analyticsText =
      await analyticsResponse.text();


    // ========================================
    // OZON ВЕРНУЛ ОШИБКУ
    // ========================================

    if (
      !analyticsResponse.ok
    ) {

      return NextResponse.json(
        {
          ok: false,

          step:
            "analytics_stocks",

          testedSkus:
            fboSkus,

          ozonStatus:
            analyticsResponse.status,

          ozonResponse:
            analyticsText,
        },
        {
          status:
            analyticsResponse.status,
        }
      );

    }


    // ========================================
    // РАЗБИРАЕМ ОТВЕТ
    // ========================================

    let analyticsData:
      unknown;


    try {

      analyticsData =
        JSON.parse(
          analyticsText
        );

    } catch {

      analyticsData =
        analyticsText;

    }


    // ========================================
    // УСПЕХ
    // ========================================

    return NextResponse.json(
      {
        ok: true,

        message:
          "Ozon analytics/stocks успешно отвечает",

        productStockTest: {

          totalProductsInCabinet:
            productsData.total
            ?? null,

          testedFboSkuCount:
            fboSkus.length,

          testedFboSkus:
            fboSkus,

        },

        analyticsData,
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
            : "Неизвестная ошибка Ozon API",
      },
      {
        status: 500,
      }
    );

  }

}
