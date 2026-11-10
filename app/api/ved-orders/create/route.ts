import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";


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


type PhotoSyncResponse = {
  ok:
    boolean;

  error?:
    string;

  order_id?:
    string;

  existing_items?:
    number;

  already_had_photo?:
    number;

  copied_from_product?:
    number;

  loaded_from_ozon?:
    number;

  missing_in_ozon?:
    number;

  missing_offer_id?:
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

  photo_sync?:
    PhotoSyncResponse | null;

  photo_sync_error?:
    string | null;
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
// AUTO PHOTO SYNC
//
// ВАЖНО:
//
// Ошибка фотографий НЕ должна отменять создание заказа.
// Заказ уже создан в Supabase.
//
// Если Ozon временно недоступен,
// пользователь просто увидит блокер «Нет фото».
// ============================================================

async function trySyncPhotos(

  request:
    NextRequest,

  orderId:
    string

):
  Promise<{
    result:
      PhotoSyncResponse | null;

    error:
      string | null;
  }> {

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => {

        controller.abort();

      },
      15000
    );


  try {

    const syncUrl =
      new URL(
        `/api/ved-orders/${orderId}/sync-photos`,
        request.nextUrl.origin
      );


    const response =
      await fetch(
        syncUrl,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          cache:
            "no-store",

          signal:
            controller.signal,
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      return {
        result:
          null,

        error:
          `Автозагрузка фото не выполнена. HTTP ${response.status}. ${text}`,
      };

    }


    if (!text.trim()) {

      return {
        result:
          null,

        error:
          "Автозагрузка фото вернула пустой ответ",
      };

    }


    const data:
      PhotoSyncResponse =
        JSON.parse(
          text
        );


    if (!data.ok) {

      return {
        result:
          data,

        error:
          data.error
          ??
          "Не удалось автоматически загрузить фотографии",
      };

    }


    return {
      result:
        data,

      error:
        null,
    };


  } catch (
    error
  ) {

    if (
      error instanceof Error
      &&
      error.name ===
        "AbortError"
    ) {

      return {
        result:
          null,

        error:
          "Автозагрузка фотографий превысила 15 секунд. Заказ создан без ожидания фотографий.",
      };

    }


    return {
      result:
        null,

      error:
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка автоматической загрузки фотографий",
    };


  } finally {

    clearTimeout(
      timeout
    );

  }

}


// ============================================================
// POST
// ============================================================

export async function POST(
  request:
    NextRequest
) {

  try {

    const session = await createClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
    }
    const { data: rawProfile, error: profileError } = await session.rpc("app_get_my_profile");
    const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as {
      user_id?: string; role_name?: string; has_admin_access?: boolean;
      first_name?: string; last_name?: string;
    } | null;
    if (profileError || !profile || profile.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Не удалось проверить права доступа" }, { status: 403 });
    }

    const body:
      CreateOrderRequest =
        await request.json();


    // ========================================================
    // 1. SCENARIO
    // ========================================================

    const scenario =
      body.scenario;


    if (
      scenario !==
        "container"
      &&
      scenario !==
        "truck"
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
    // 2. DEPARTMENT
    // ========================================================

    const department =
      body.preparationDepartment;


    if (
      department !==
        "analytics"
      &&
      department !==
        "procurement"
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
    // 3. RESPONSIBLE
    // ========================================================

    const allowedToCreate = profile.has_admin_access ||
      (department === "procurement" && profile.role_name === "Закуп") ||
      (department === "analytics" && profile.role_name === "Аналитик");
    if (!allowedToCreate) {
      return NextResponse.json(
        { ok: false, error: "Недостаточно прав для создания заказа" },
        { status: 403 },
      );
    }
    const createdByName = [profile.first_name, profile.last_name]
      .map(value => String(value ?? "").trim()).filter(Boolean).join(" ");


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
    // 4. NEW PRODUCTS VOLUME
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
      newProductsVolumeM3 <
        0
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
    // 5. SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    // ========================================================
    // 6. CREATE DRAFT
    // ========================================================

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
                   user.id,

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


    if (!text.trim()) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Supabase вернул пустой ответ при создании заказа",
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


    // ========================================================
    // 7. AUTO PHOTO SYNC
    //
    // Черновик УЖЕ создан.
    //
    // Здесь пытаемся автоматически получить фотографии
    // только для существующих товаров.
    //
    // Новые товары sync-photos специально игнорирует.
    // ========================================================

    const photoSync =
      await trySyncPhotos(
        request,
        data.order_id
      );


    if (
      photoSync.error
    ) {

      console.error(
        "VED order created, but automatic photo sync failed:",
        photoSync.error
      );

    }


    // ========================================================
    // 8. SUCCESS
    //
    // Даже если фотографии получить не удалось,
    // создание заказа считается успешным.
    // ========================================================

    return NextResponse.json(
      {
        ...data,

        photo_sync:
          photoSync.result,

        photo_sync_error:
          photoSync.error,
      },
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
