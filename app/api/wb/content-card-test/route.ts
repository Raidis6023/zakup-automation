import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET() {
  const token = process.env.WB_TEST_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не найден WB_TEST_TOKEN в Vercel",
      },
      { status: 500 }
    );
  }

  const baseUrl = "https://content-api-sandbox.wildberries.ru";

  try {
    // =====================================================
    // ШАГ 1. ГЕНЕРИРУЕМ ТЕСТОВЫЙ БАРКОД В ПЕСОЧНИЦЕ WB
    // =====================================================

    const barcodeResponse = await fetch(
      `${baseUrl}/content/v2/barcodes`,
      {
        method: "POST",
        headers: {
          Authorization: token,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          count: 1,
        }),
        cache: "no-store",
      }
    );

    const barcodeText = await barcodeResponse.text();

    let barcodeData: any;

    try {
      barcodeData = JSON.parse(barcodeText);
    } catch {
      barcodeData = barcodeText;
    }

    if (!barcodeResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          stage: "generate_barcode",
          message: "Не удалось получить тестовый barcode от WB",
          wbStatus: barcodeResponse.status,
          wbResponse: barcodeData,
        },
        { status: barcodeResponse.status }
      );
    }

    const barcode = barcodeData?.data?.[0];

    if (!barcode) {
      return NextResponse.json(
        {
          ok: false,
          stage: "generate_barcode",
          message: "WB ответил успешно, но barcode в ответе не найден",
          wbResponse: barcodeData,
        },
        { status: 500 }
      );
    }

    // В Content Sandbox действует ограничение по частоте запросов.
    // Немного ждём перед следующим запросом.
    await sleep(1600);

    // =====================================================
    // ШАГ 2. СОЗДАЁМ ТЕСТОВУЮ КАРТОЧКУ
    // =====================================================

    const vendorCode = `WB-SANDBOX-${Date.now()}`;

    const cardBody = [
      {
        subjectID: 105,
        variants: [
          {
            vendorCode: vendorCode,
            kizMarked: false,
            title: "Тестовый товар FBW Sandbox",
            description:
              "Тестовая карточка товара для проверки интеграции с FBW Sandbox Wildberries.",
            brand: "",
            dimensions: {
              length: 12,
              width: 7,
              height: 5,
              weightBrutto: 1,
            },
            sizes: [
              {
                techSize: "S",
                wbSize: "42",
                price: 5000,
                skus: [barcode],
              },
            ],
          },
        ],
      },
    ];

    const cardResponse = await fetch(
      `${baseUrl}/content/v2/cards/upload`,
      {
        method: "POST",
        headers: {
          Authorization: token,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cardBody),
        cache: "no-store",
      }
    );

    const cardText = await cardResponse.text();

    let cardData: any;

    try {
      cardData = JSON.parse(cardText);
    } catch {
      cardData = cardText;
    }

    if (!cardResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          stage: "create_card",
          message:
            "Barcode создан, но при создании карточки WB вернул ошибку",
          generatedBarcode: barcode,
          vendorCode: vendorCode,
          wbStatus: cardResponse.status,
          wbResponse: cardData,
        },
        { status: cardResponse.status }
      );
    }

    // =====================================================
    // ВСЁ УСПЕШНО
    // =====================================================

    return NextResponse.json({
      ok: true,
      message: "Тестовая карточка отправлена на создание в WB Sandbox",
      generatedBarcode: barcode,
      vendorCode: vendorCode,
      subjectID: 105,
      wbStatus: cardResponse.status,
      wbResponse: cardData,
      nextStep:
        "Скопируй generatedBarcode. Его будем использовать в FBW acceptance/options.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не удалось выполнить тест Content Sandbox WB",
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
