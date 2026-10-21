import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

  const auth = await createClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Требуется авторизация в WorkSpace" }, { status: 401 });
  }
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


    let chinaRecalculation: { ok: boolean; error?: string } = { ok: false };
    try {
      const dashboardResponse = await fetch(supabaseUrl + "/rest/v1/rpc/get_china_dashboard", {
        method: "POST",
        headers: {
          apikey: supabaseSecretKey,
          Authorization: "Bearer " + supabaseSecretKey,
          "Content-Type": "application/json",
        },
        body: "{}", cache: "no-store",
      });
      if (!dashboardResponse.ok) throw Error("Не удалось проверить ручные корректировки");
      const dashboard = await dashboardResponse.json();
      if (Array.isArray(dashboard?.items) && dashboard.items.some(
        (item: { container_manual_quantity?: number | null; truck_manual_quantity?: number | null }) =>
          item.container_manual_quantity != null || item.truck_manual_quantity != null
      )) {
        throw Error("Обнаружены ручные корректировки в последнем расчёте Китая. Автоматический пересчёт пропущен.");
      }
      const calc = await fetch(supabaseUrl + "/rest/v1/rpc/run_china_calculation", {
        method: "POST",
        headers: { apikey: supabaseSecretKey, Authorization: "Bearer " + supabaseSecretKey, "Content-Type": "application/json" },
        body: "{}", cache: "no-store",
      });
      if (!calc.ok) throw Error("HTTP " + calc.status + ": " + (await calc.text()).slice(0, 400));
      chinaRecalculation = { ok: true };
    } catch (cause) {
      chinaRecalculation = { ok: false, error: cause instanceof Error ? cause.message : "Не удалось пересчитать Китай" };
    }
    revalidatePath("/stocks");
    revalidatePath("/zakup");
    revalidatePath("/ozon");
    return NextResponse.json({ ...data, chinaRecalculation }, { status: 200 });


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
