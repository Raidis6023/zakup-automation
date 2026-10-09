import {
  NextResponse,
} from "next/server";


export const runtime =
  "nodejs";


export const dynamic =
  "force-dynamic";


// ============================================================
// ТИПЫ
// ============================================================

type AssignRequest = {
  id?:
    unknown;

  master_code?:
    unknown;
};


type AssignResult = {
  ok:
    boolean;

  unlinked_id?:
    string;

  product_id?:
    string;

  offer_id?:
    string;

  ozon_product_id?:
    string
    | number
    | null;

  ozon_sku?:
    string
    | null;

  master_code?:
    string;
};


// ============================================================
// CONFIG
// ============================================================

function getConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена переменная NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена переменная SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };
}


// ============================================================
// NORMALIZE
// ============================================================

function normalizeText(
  value: unknown
): string {

  return String(
    value
    ??
    ""
  ).trim();

}


function normalizeMasterCode(
  value: unknown
): string {

  return normalizeText(
    value
  ).toUpperCase();

}


// ============================================================
// UUID
// ============================================================

function isUuid(
  value: string
): boolean {

  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(
        value
      )
  );

}


// ============================================================
// SUPABASE RPC
// ============================================================

async function assignMasterCode(
  id: string,
  masterCode: string
): Promise<AssignResult> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/assign_ozon_unlinked_master_code`,
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
              p_unlinked_id:
                id,

              p_master_code:
                masterCode,
            }
          ),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (
    !response.ok
  ) {

    let message =
      text;


    try {

      const parsed =
        JSON.parse(
          text
        ) as {
          message?:
            string;

          details?:
            string;

          hint?:
            string;
        };


      message =
        parsed.message
        ||
        parsed.details
        ||
        parsed.hint
        ||
        text;

    } catch {

      // Если Supabase вернул не JSON,
      // оставляем исходный текст.

    }


    throw new Error(
      message
      ||
      `Supabase RPC вернул HTTP ${response.status}`
    );

  }


  if (!text) {

    throw new Error(
      "Supabase не вернул результат привязки"
    );

  }


  const result =
    JSON.parse(
      text
    ) as AssignResult;


  if (
    !result
    ||
    result.ok !==
      true
  ) {

    throw new Error(
      "Supabase не подтвердил привязку товара"
    );

  }


  return result;
}


// ============================================================
// POST
// ============================================================

export async function POST(
  request:
    Request
) {

  try {

    // ========================================================
    // 1. BODY
    // ========================================================

    let body:
      AssignRequest;


    try {

      body =
        await request.json()
        as AssignRequest;

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
    // 2. ID
    // ========================================================

    const id =
      normalizeText(
        body.id
      );


    if (!id) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Не указан ID товара",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      !isUuid(
        id
      )
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Некорректный ID товара",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 3. MASTER_CODE
    // ========================================================

    const masterCode =
      normalizeMasterCode(
        body.master_code
      );


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
    // 4. ПРИВЯЗКА
    // ========================================================

    const result =
      await assignMasterCode(
        id,
        masterCode
      );


    // ========================================================
    // 5. SUCCESS
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
      "OZON UNLINKED ASSIGN ERROR",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error

            ? error.message

            : String(
                error
              ),
      },
      {
        status:
          500,
      }
    );

  }

}
