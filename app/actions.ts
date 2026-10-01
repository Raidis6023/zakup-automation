"use server";

import { revalidatePath } from "next/cache";

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
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify(body),

      cache: "no-store",
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
// РАССЧИТАТЬ ПОТРЕБНОСТЬ КИТАЙ
// ============================================

export async function runChinaCalculation() {
  await callSupabaseRpc(
    "run_china_calculation"
  );

  revalidatePath("/");
}


// ============================================
// ПЕРЕСЧИТАТЬ ТРАНСПОРТ
// ============================================

export async function simulateChinaTransport(
  formData: FormData
) {
  const rawValue =
    formData.get("newProductsVolume");

  const volume = Number(
    String(rawValue ?? "")
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
