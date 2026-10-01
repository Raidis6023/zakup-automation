"use server";

import { revalidatePath } from "next/cache";


// ============================================
// НАСТРОЙКИ SUPABASE
// ============================================

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;


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


// ============================================
// УНИВЕРСАЛЬНЫЙ ВЫЗОВ RPC SUPABASE
// ============================================

async function callSupabaseRpc(
  functionName: string,
  body: Record<string, unknown> = {}
) {
  const {
    supabaseUrl,
    supabaseSecretKey,
  } = getSupabaseConfig();


  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",

      headers: {
        apikey:
          supabaseSecretKey,

        Authorization:
          `Bearer ${supabaseSecretKey}`,

        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(body),

      cache:
        "no-store",
    }
  );


  if (!response.ok) {
    const errorText =
      await response.text();


    throw new Error(
      `Ошибка Supabase: ${response.status} ${errorText}`
    );
  }


  return response.json();
}


// ============================================
// 1. РАССЧИТАТЬ ПОТРЕБНОСТЬ КИТАЙ
// ============================================

export async function runChinaCalculation() {

  await callSupabaseRpc(
    "run_china_calculation"
  );


  revalidatePath("/");
}


// ============================================
// 2. ПЕРЕСЧИТАТЬ ТРАНСПОРТ
// ============================================

export async function simulateChinaTransport(
  formData: FormData
) {

  const rawValue =
    formData.get(
      "newProductsVolume"
    );


  const volume =
    Number(
      String(
        rawValue ?? ""
      )
        .replace(",", ".")
    );


  if (
    Number.isNaN(volume) ||
    volume < 0
  ) {

    throw new Error(
      "Введите корректный объём новых товаров"
    );

  }


  await callSupabaseRpc(
    "simulate_china_transport",
    {
      p_new_products_volume_m3:
        volume,
    }
  );


  revalidatePath("/");
}


// ============================================
// 3. РУЧНАЯ КОРРЕКТИРОВКА SKU
// ============================================

export async function saveChinaManualAdjustment(
  formData: FormData
) {

  const calculationItemId =
    String(
      formData.get(
        "calculationItemId"
      ) ?? ""
    );


  const scenario =
    String(
      formData.get(
        "scenario"
      ) ?? ""
    );


  const rawQuantity =
    String(
      formData.get(
        "manualQuantity"
      ) ?? ""
    );


  const comment =
    String(
      formData.get(
        "comment"
      ) ?? ""
    ).trim();


  const quantity =
    Number(rawQuantity);


  // ==========================================
  // ПРОВЕРКА ID
  // ==========================================

  if (!calculationItemId) {

    throw new Error(
      "Не найден ID строки расчёта SKU"
    );

  }


  // ==========================================
  // ПРОВЕРКА СЦЕНАРИЯ
  // ==========================================

  if (
    scenario !== "container" &&
    scenario !== "truck"
  ) {

    throw new Error(
      "Некорректный сценарий транспортировки"
    );

  }


  // ==========================================
  // ПРОВЕРКА КОЛИЧЕСТВА
  // ==========================================

  if (
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {

    throw new Error(
      "Количество должно быть целым числом от 0"
    );

  }


  // ==========================================
  // СОХРАНЯЕМ РУЧНУЮ КОРРЕКТИРОВКУ
  // ==========================================

  await callSupabaseRpc(
    "save_china_manual_adjustment",
    {
      p_calculation_item_id:
        calculationItemId,

      p_scenario:
        scenario,

      p_manual_quantity:
        quantity,

      p_comment:
        comment || null,

      // Временно.
      // Позже здесь будет ID
      // реально авторизованного сотрудника.
      p_adjusted_by:
        "test-user",
    }
  );


  // ==========================================
  // ПОЛУЧАЕМ ТЕКУЩИЙ ОБЪЁМ НОВЫХ ТОВАРОВ
  //
  // Он нужен, чтобы после ручной
  // корректировки пересчитать транспорт,
  // сохранив текущую симуляцию новинок.
  // ==========================================

  const dashboard =
    await callSupabaseRpc(
      "get_china_dashboard"
    ) as {

      simulation?: {

        new_products_volume_m3?:
          number | string;

      } | null;

    };


  const currentNewProductsVolume =
    Number(
      dashboard
        ?.simulation
        ?.new_products_volume_m3
      ?? 0
    );


  // ==========================================
  // АВТОМАТИЧЕСКИ ПЕРЕСЧИТЫВАЕМ ТРАНСПОРТ
  // ==========================================

  await callSupabaseRpc(
    "simulate_china_transport",
    {
      p_new_products_volume_m3:
        currentNewProductsVolume,
    }
  );


  // ==========================================
  // ОБНОВЛЯЕМ ГЛАВНУЮ СТРАНИЦУ
  // ==========================================

  revalidatePath("/");
}
