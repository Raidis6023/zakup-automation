import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


// ============================================================
// TYPES
// ============================================================

type AssignRequest = {
  yandexProductId?: number;
  masterCode?: string;
};


type AssignResult = {
  ok?: boolean;

  yandex_product_id?: number;

  product_id?: string;

  offer_id?: string;

  market_sku?:
    | string
    | null;

  master_code?: string;

  master_code_existed_before?: boolean;

  created_new_master_code?: boolean;
};


type SupabaseError = {
  message?: string;
  details?: string;
  hint?: string;
};


// ============================================================
// SUPABASE CONFIG
// ============================================================

function getSupabaseConfig() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim()
    ||
    process.env
      .SUPABASE_URL
      ?.trim();


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY
      ?.trim()
    ||
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
      ?.trim();


  if (!supabaseUrl) {
    throw new Error(
      "Не найдена NEXT_PUBLIC_SUPABASE_URL или SUPABASE_URL"
    );
  }


  if (!supabaseSecretKey) {
    throw new Error(
      "Не найдена SUPABASE_SECRET_KEY или SUPABASE_SERVICE_ROLE_KEY"
    );
  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };
}


// ============================================================
// SUPABASE ERROR
// ============================================================

function getSupabaseErrorMessage(
  text: string
): string {
  if (!text) {
    return "Неизвестная ошибка Supabase";
  }


  try {
    const parsed =
      JSON.parse(
        text
      ) as SupabaseError;


    if (
      parsed.message
      &&
      parsed.message.trim() !==
        ""
    ) {
      return parsed.message;
    }

  } catch {
    // Если ответ не JSON,
    // возвращаем исходный текст.
  }


  return text;
}


// ============================================================
// POST
// ============================================================

export async function POST(
  request: Request
) {
  try {

    // ========================================================
    // 1. BODY
    // ========================================================

    let body:
      AssignRequest;


    try {
      body =
        (await request.json()) as AssignRequest;

    } catch {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Некорректный JSON",
        },
        {
          status:
            400,
        }
      );
    }


    // ========================================================
    // 2. YANDEX PRODUCT ID
    // ========================================================

    const yandexProductId =
      Number(
        body.yandexProductId
      );


    if (
      !Number.isInteger(
        yandexProductId
      )
      ||
      yandexProductId <=
        0
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Некорректный yandexProductId",
        },
        {
          status:
            400,
        }
      );
    }


    // ========================================================
    // 3. MASTER CODE
    //
    // ВАЖНО:
    // это может быть как существующий,
    // так и совершенно новый master_code.
    // ========================================================

    const masterCode =
      String(
        body.masterCode
        ??
        ""
      )
        .trim()
        .toUpperCase();


    if (!masterCode) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Введите master_code",
        },
        {
          status:
            400,
        }
      );
    }


    if (
      masterCode.length >
      100
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "master_code слишком длинный",
        },
        {
          status:
            400,
        }
      );
    }


    // ========================================================
    // 4. SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/assign_yandex_unlinked_master_code`,
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
                p_yandex_product_id:
                  yandexProductId,

                p_master_code:
                  masterCode,
              }
            ),

          cache:
            "no-store",
        }
      );


    const responseText =
      await response.text();


    // ========================================================
    // 5. SUPABASE ERROR
    // ========================================================

    if (!response.ok) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            getSupabaseErrorMessage(
              responseText
            ),
        },
        {
          status:
            400,
        }
      );
    }


    // ========================================================
    // 6. RESULT
    // ========================================================

    let result:
      AssignResult =
      {
        ok:
          true,
      };


    if (
      responseText.trim() !==
      ""
    ) {
      try {
        result =
          JSON.parse(
            responseText
          ) as AssignResult;

      } catch {
        return NextResponse.json(
          {
            ok:
              false,

            error:
              "Supabase вернул неожиданный ответ",
          },
          {
            status:
              500,
          }
        );
      }
    }


    // ========================================================
    // 7. RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        ok:
          true,

        result,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX ASSIGN MASTER CODE ERROR:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status:
          500,
      }
    );
  }
}
