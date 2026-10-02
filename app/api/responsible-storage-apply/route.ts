import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// SUPABASE
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
// РЕАЛЬНЫЙ ИМПОРТ
// ============================================================

export async function POST(
  request: NextRequest
) {

  try {

    const body =
      await request.json();


    const snapshotDate =
      body?.snapshotDate;


    const sourceFileName =
      body?.sourceFileName;


    const rows =
      body?.rows;


    if (
      typeof snapshotDate !==
        "string"
      ||
      !snapshotDate
    ) {

      return NextResponse.json(
        {
          ok: false,
          error:
            "Не определена дата снимка ОХ",
        },
        {
          status: 400,
        }
      );

    }


    if (
      !Array.isArray(
        rows
      )
      ||
      rows.length === 0
    ) {

      return NextResponse.json(
        {
          ok: false,
          error:
            "Нет данных для импорта ОХ",
        },
        {
          status: 400,
        }
      );

    }


    if (
      rows.length >
        10000
    ) {

      return NextResponse.json(
        {
          ok: false,
          error:
            "Слишком много строк для одного импорта",
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
        `${supabaseUrl}/rest/v1/rpc/apply_responsible_storage_import`,
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
                p_snapshot_date:
                  snapshotDate,

                p_source_file_name:
                  typeof sourceFileName ===
                    "string"
                    ? sourceFileName
                    : null,

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
      "Responsible storage apply error:",
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка импорта ОХ",
      },
      {
        status: 500,
      }
    );

  }

}
