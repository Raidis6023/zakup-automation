import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.WB_READ_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message: "Не найден WB_READ_TOKEN в Vercel",
      },
      { status: 500 }
    );
  }

  // Этот ID мы получили из incomeID реального заказа WB.
  const incomeID = 41397707;

  // Проверяем гипотезу:
  // является ли incomeID идентификатором FBW-поставки.
  const url =
    `https://supplies-api.wildberries.ru/api/v1/supplies/${incomeID}` +
    `?isPreorderID=false`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: token,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const text = await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    const rateLimit = {
      retryAfterSeconds: response.headers.get("x-ratelimit-retry"),
      resetAfterSeconds: response.headers.get("x-ratelimit-reset"),
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Wildberries вернул ошибку при поиске поставки по incomeID",
          wbStatus: response.status,
          incomeID,
          rateLimit,
          wbResponse: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "Wildberries нашёл FBW-поставку с ID, равным incomeID заказа",

      wbStatus: response.status,
      incomeID,

      rateLimit,

      warehouse: {
        warehouseID: data?.warehouseID ?? null,
        warehouseName: data?.warehouseName ?? null,

        actualWarehouseID:
          data?.actualWarehouseID ?? null,
        actualWarehouseName:
          data?.actualWarehouseName ?? null,

        transitWarehouseID:
          data?.transitWarehouseID ?? null,
        transitWarehouseName:
          data?.transitWarehouseName ?? null,
      },

      supply: {
        statusID: data?.statusID ?? null,
        boxTypeID: data?.boxTypeID ?? null,

        createDate: data?.createDate ?? null,
        supplyDate: data?.supplyDate ?? null,
        factDate: data?.factDate ?? null,

        quantity: data?.quantity ?? null,
        acceptedQuantity:
          data?.acceptedQuantity ?? null,
        readyForSaleQuantity:
          data?.readyForSaleQuantity ?? null,
      },

      // Сохраняем полный ответ, чтобы ничего не потерять.
      wbResponse: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Не удалось проверить связь incomeID с FBW-поставкой",
        incomeID,
        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}
