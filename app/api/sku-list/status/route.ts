import {
  NextRequest,
  NextResponse,
} from "next/server";


type ProductArticleStatus =
  | "Активный"
  | "Неактивный"
  | "FBS"
  | "Выводится из продажи"
  | "Сезонный"
  | "В пути";


const ALLOWED_STATUSES =
  new Set<ProductArticleStatus>([
    "Активный",
    "Неактивный",
    "FBS",
    "Выводится из продажи",
    "Сезонный",
    "В пути",
  ]);


function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL
    ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ??
    process.env.SUPABASE_SECRET_KEY;

  if (
    !supabaseUrl
    ||
    !supabaseKey
  ) {
    throw new Error(
      "Не настроено подключение к Supabase"
    );
  }

  return {
    supabaseUrl,
    supabaseKey,
  };
}


export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json() as {
        masterCode?: unknown;
        status?: unknown;
      };

    const masterCode =
      typeof body.masterCode ===
        "string"

        ? body.masterCode.trim()

        : "";

    const status =
      typeof body.status ===
        "string"

        ? body.status as
            ProductArticleStatus

        : null;

    if (!masterCode) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Не указан ЕНОТ",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !status
      ||
      !ALLOWED_STATUSES.has(
        status
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Недопустимый статус",
        },
        {
          status:
            400,
        }
      );
    }

    const {
      supabaseUrl,
      supabaseKey,
    } =
      getSupabaseConfig();

    const response =
      await fetch(
        supabaseUrl
        +
        "/rest/v1/product_article_statuses"
        +
        "?on_conflict=master_code",
        {
          method:
            "POST",

          headers: {
            apikey:
              supabaseKey,

            Authorization:
              "Bearer "
              +
              supabaseKey,

            "Content-Type":
              "application/json",

            Prefer:
              "resolution=merge-duplicates,return=minimal",
          },

          body:
            JSON.stringify({
              master_code:
                masterCode,

              status,

              updated_at:
                new Date()
                  .toISOString(),
            }),

          cache:
            "no-store",
        }
      );

    if (!response.ok) {
      const responseText =
        await response.text();

      throw new Error(
        "Supabase HTTP "
        +
        response.status
        +
        ": "
        +
        responseText
      );
    }

    return NextResponse.json({
      ok:
        true,

      masterCode,

      status,
    });
  } catch (
    error
  ) {
    console.error(
      "Не удалось сохранить статус товара:",
      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Не удалось сохранить статус товара",
      },
      {
        status:
          500,
      }
    );
  }
}
