"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";


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
// УНИВЕРСАЛЬНЫЙ RPC SUPABASE
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


  revalidatePath("/zakup");
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
      ).replace(",", ".")
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


  revalidatePath("/zakup");
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


  if (!calculationItemId) {
    throw new Error(
      "Не найден ID строки расчёта SKU"
    );
  }


  if (
    scenario !== "container" &&
    scenario !== "truck"
  ) {
    throw new Error(
      "Некорректный сценарий транспортировки"
    );
  }


  if (
    !Number.isInteger(quantity) ||
    quantity < 0
  ) {
    throw new Error(
      "Количество должно быть целым числом от 0"
    );
  }


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

      p_adjusted_by:
        "test-user",
    }
  );


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


  await callSupabaseRpc(
    "simulate_china_transport",
    {
      p_new_products_volume_m3:
        currentNewProductsVolume,
    }
  );


  revalidatePath("/zakup");
  revalidatePath("/");
}


// ============================================
// 4. СФОРМИРОВАТЬ ЧЕРНОВИК ЗАКАЗА ВЭД
// ============================================

export async function createVedOrderDraft(
  formData: FormData
) {

  const scenario =
    String(
      formData.get(
        "scenario"
      ) ?? ""
    ).trim();


  const rawNewProductsVolume =
    String(
      formData.get(
        "newProductsVolume"
      ) ?? "0"
    );


  const newProductsVolume =
    Number(
      rawNewProductsVolume.replace(",", ".")
    );


  if (
    scenario !== "container" &&
    scenario !== "truck"
  ) {
    throw new Error(
      "Нельзя сформировать заказ: транспортный сценарий не определён"
    );
  }


  if (
    Number.isNaN(newProductsVolume) ||
    newProductsVolume < 0
  ) {
    throw new Error(
      "Некорректный объём новых товаров"
    );
  }


  const result =
    await callSupabaseRpc(
      "create_ved_order_draft",
      {
        p_scenario:
          scenario,

        p_preparation_department:
          "procurement",

        p_created_by_name:
          "Тест Сайта",

        p_created_by_user_id:
          null,

        p_new_products_volume_m3:
          newProductsVolume,
      }
    ) as {
      ok?: boolean;
      order_id?: string;
      workflow_status?: string;
      items_created?: number;
    };


  if (
    !result?.ok ||
    !result?.order_id
  ) {
    throw new Error(
      "Supabase не вернул ID созданного заказа"
    );
  }


  revalidatePath("/zakup");
  revalidatePath("/ved");


  redirect(
    `/ved-orders/${result.order_id}`
  );
}


// ============================================
// 5. СОЗДАТЬ PREVIEW ИМПОРТА ОСТАТКОВ
// ============================================

type StockImportRowInput = {
  source_row_number: number;

  warehouse_name:
    string | null;

  product_name:
    string | null;

  offer_id_raw:
    string | null;

  free_stock:
    number | null;

  barcode:
    string | null;

  parse_error:
    string | null;
};


export async function createStockImportPreview(
  input: {
    fileName: string;
    reportDate: string;
    rows: StockImportRowInput[];
  }
) {

  if (!input.fileName) {
    throw new Error(
      "Не указано имя файла"
    );
  }


  if (!input.reportDate) {
    throw new Error(
      "Не определена дата отчёта"
    );
  }


  if (
    !input.rows ||
    input.rows.length === 0
  ) {
    throw new Error(
      "В Excel не найдено товаров"
    );
  }


  const result =
    await callSupabaseRpc(
      "create_stock_import_preview",
      {
        p_source_file_name:
          input.fileName,

        p_report_date:
          input.reportDate,

        p_rows:
          input.rows,
      }
    );


  if (
    typeof result !== "string" ||
    !result
  ) {
    throw new Error(
      "Supabase не вернул ID импорта"
    );
  }


  revalidatePath(
    "/stock-import"
  );


  return result;
}


// ============================================
// 6. ПОЛУЧИТЬ PREVIEW ИМПОРТА
// ============================================

export async function getStockImportPreview(
  batchId: string
) {

  if (!batchId) {
    throw new Error(
      "Не указан ID импорта"
    );
  }


  return callSupabaseRpc(
    "get_stock_import_preview",
    {
      p_batch_id:
        batchId,
    }
  );
}


// ============================================
// 7. ПОДТВЕРДИТЬ ИМПОРТ
// ============================================

export async function confirmStockImport(
  batchId: string
) {

  if (!batchId) {
    throw new Error(
      "Не указан ID импорта"
    );
  }


  const result =
    await callSupabaseRpc(
      "confirm_own_stock_import",
      {
        p_batch_id:
          batchId,
      }
    );


  revalidatePath(
    "/stock-import"
  );

  revalidatePath("/zakup");
  revalidatePath("/");


  return result;
}
