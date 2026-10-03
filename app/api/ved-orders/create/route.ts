import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type CreateOrderRequest = {
  scenario?:
    "container" | "truck";

  preparationDepartment?:
    "analytics" | "procurement";

  createdByName?:
    string;

  createdByUserId?:
    string | null;

  newProductsVolumeM3?:
    number;
};


type CreateOrderResponse = {
  ok:
    boolean;

  order_id?:
    string;

  error?:
    string;

  workflow_status?:
    string;

  scenario?:
    string;

  items_created?:
    number;

  seasonal_excluded?:
    number;

  prefilled_moq_items?:
    number;

  prefilled_price_items?:
    number;

  items_without_weight?:
    number;

  items_without_chinese_article?:
    number;
};


// ============================================================
// SUPABASE CONFIG
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
// ============================================================

export async function POST(
  request:
    NextRequest
) {

  try {

    const body:
      CreateOrderRequest =
        await request.json();


    // ========================================================
    // SCENARIO
    // ========================================================

    const scenario =
      body.scenario;


    if (
      scenario !== "container"
      &&
      scenario !== "truck"
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Сценарий должен быть container или truck",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // DEPARTMENT
    // ========================================================

    const department =
      body.preparationDepartment;


    if (
      department !== "analytics"
      &&
      department !== "procurement"
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Выберите отдел: Аналитика или Закуп",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // RESPONSIBLE
    // ========================================================

    const createdByName =
      body.createdByName
        ?.trim();


    if (!createdByName) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Укажите ответственного за подготовку заказа",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // NEW PRODUCTS VOLUME
    // ========================================================

    const newProductsVolumeM3 =
      Number(
        body.newProductsVolumeM3
        ??
        0
      );


    if (
      !Number.isFinite(
        newProductsVolumeM3
      )
      ||
      newProductsVolumeM3 < 0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Некорректный объём новых товаров",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/create_ved_order_draft`,
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
                p_scenario:
                  scenario,

                p_preparation_department:
                  department,

                p_created_by_name:
                  createdByName,

                p_created_by_user_id:
                  body.createdByUserId
                  ??
                  null,

                p_new_products_volume_m3:
                  newProductsVolumeM3,
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
          ok:
            false,

          error:
            `Ошибка Supabase. HTTP ${response.status}. ${text}`,
        },
        {
          status:
            500,
        }
      );

    }


    const data:
      CreateOrderResponse =
        JSON.parse(
          text
        );


    if (
      !data.ok
      ||
      !data.order_id
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            data.error
            ??
            "Supabase не вернул ID созданного заказа",
        },
        {
          status:
            500,
        }
      );

    }


    return NextResponse.json(
      data,
      {
        status:
          200,
      }
    );


  } catch (
    error
  ) {

    console.error(
      "Create VED order error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка создания заказа",
      },
      {
        status:
          500,
      }
    );

  }

}
