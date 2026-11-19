import { getIntegrationSecret } from "@/lib/integrations/secrets";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


// ============================================================
// ТИПЫ
// ============================================================

type CampaignResponse = {
  campaign?: {
    id?: number;

    business?: {
      id?: number;
      name?: string;
    };
  };
};


type RawYandexOfferMapping = {
  offer?: {
    offerId?: string;
    name?: string;
    vendor?: string;
    vendorCode?: string;
    barcodes?: string[];

    [key: string]:
      unknown;
  };

  mapping?: {
    marketSku?: string;
    marketSkuName?: string;
    marketModelName?: string;
    marketCategoryId?: number;
    marketCategoryName?: string;

    [key: string]:
      unknown;
  };

  [key: string]:
    unknown;
};


type OfferMappingsResponse = {
  status?: string;

  result?: {
    paging?: {
      nextPageToken?: string;
    };

    offerMappings?:
      RawYandexOfferMapping[];
  };

  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};


type ExistingYandexProduct = {
  offer_id: string;
  master_code: string | null;
  first_seen_at: string;
};


type YandexProductUpsertRow = {
  offer_id: string;
  market_sku: string | null;
  market_category_name: string | null;
  master_code: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  raw_data: RawYandexOfferMapping;
  updated_at: string;
};


// ============================================================
// ENV
// ============================================================

function getRequiredEnv(
  name: string
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Не найдена переменная окружения ${name}`
    );
  }

  return value;
}


function getSupabaseConfig() {
  const supabaseUrl =
    (process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
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
// ВАЖНО:
// СОХРАНЯЕМ marketSku БЕЗ ПОТЕРИ ТОЧНОСТИ
//
// Яндекс присылает marketSku как JSON integer.
//
// Некоторые Product ID больше
// Number.MAX_SAFE_INTEGER.
//
// Если вызвать обычный response.json(),
// JavaScript округлит такие значения.
//
// Поэтому:
// 1. сначала читаем исходный JSON как текст;
// 2. только числовые значения поля marketSku
//    превращаем в JSON-строки;
// 3. после этого вызываем JSON.parse().
//
// Например:
//
// 228068011021017088
//
// останется именно:
//
// "228068011021017088"
//
// а не превратится в:
//
// 228068011021017100
// ============================================================

function parseYandexJsonPreservingMarketSku(
  rawText: string
): OfferMappingsResponse {
  const safeText =
    rawText.replace(
      /("marketSku"\s*:\s*)(-?\d+)(?=\s*[,}])/g,
      '$1"$2"'
    );

  return JSON.parse(
    safeText
  ) as OfferMappingsResponse;
}


// ============================================================
// ОБЫЧНЫЙ JSON ДЛЯ НЕПРОБЛЕМНЫХ ОТВЕТОВ
// ============================================================

function parseJson<T>(
  rawText: string,
  sourceName: string
): T {
  try {
    return JSON.parse(
      rawText
    ) as T;
  } catch {
    throw new Error(
      `${sourceName}: сервер вернул некорректный JSON`
    );
  }
}


// ============================================================
// API HEADERS
// ============================================================

function getYandexHeaders(
  apiKey: string
): HeadersInit {
  return {
    "Api-Key":
      apiKey,

    Accept:
      "application/json",
  };
}


// ============================================================
// BUSINESS ID
// ============================================================

async function getBusinessId(
  apiKey: string,
  campaignId: string
): Promise<number> {
  const url =
    `https://api.partner.market.yandex.ru/v2/campaigns/${encodeURIComponent(
      campaignId
    )}`;

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers:
          getYandexHeaders(
            apiKey
          ),

        cache:
          "no-store",
      }
    );

  const rawText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      [
        "Яндекс campaign API",
        `HTTP ${response.status}`,
        rawText,
      ].join(": ")
    );
  }

  const data =
    parseJson<CampaignResponse>(
      rawText,
      "Яндекс campaign API"
    );

  const businessId =
    data
      .campaign
      ?.business
      ?.id;

  if (
    typeof businessId !==
      "number"
    ||
    !Number.isFinite(
      businessId
    )
  ) {
    throw new Error(
      "Яндекс API не вернул campaign.business.id"
    );
  }

  return businessId;
}


// ============================================================
// ЗАГРУЗКА ОДНОЙ СТРАНИЦЫ КАТАЛОГА
// ============================================================

async function getOfferMappingsPage({
  apiKey,
  businessId,
  pageToken,
}: {
  apiKey: string;
  businessId: number;
  pageToken: string | null;
}): Promise<OfferMappingsResponse> {
  const url =
    new URL(
      `https://api.partner.market.yandex.ru/v2/businesses/${businessId}/offer-mappings`
    );

  url.searchParams.set(
    "limit",
    "100"
  );

  url.searchParams.set(
    "language",
    "RU"
  );

  if (pageToken) {
    url.searchParams.set(
      "pageToken",
      pageToken
    );
  }

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "POST",

        headers:
          getYandexHeaders(
            apiKey
          ),

        cache:
          "no-store",
      }
    );

  const rawText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      [
        "Яндекс offer-mappings",
        `HTTP ${response.status}`,
        rawText,
      ].join(": ")
    );
  }

  let data:
    OfferMappingsResponse;

  try {
    data =
      parseYandexJsonPreservingMarketSku(
        rawText
      );
  } catch {
    throw new Error(
      "Яндекс offer-mappings вернул некорректный JSON"
    );
  }

  if (
    data.status
    &&
    data.status !== "OK"
  ) {
    throw new Error(
      `Яндекс offer-mappings вернул status=${data.status}`
    );
  }

  return data;
}


// ============================================================
// ЗАГРУЗКА ВСЕГО КАТАЛОГА
// ============================================================

async function getAllOfferMappings(
  apiKey: string,
  businessId: number
): Promise<{
  items: RawYandexOfferMapping[];
  pages: number;
}> {
  const items:
    RawYandexOfferMapping[] =
    [];

  let pageToken:
    string | null =
    null;

  let pages =
    0;

  const seenPageTokens =
    new Set<string>();

  while (true) {
    const data =
      await getOfferMappingsPage({
        apiKey,
        businessId,
        pageToken,
      });

    pages +=
      1;

    const pageItems =
      data
        .result
        ?.offerMappings
      ??
      [];

    items.push(
      ...pageItems
    );

    const nextPageToken =
      data
        .result
        ?.paging
        ?.nextPageToken
        ?.trim()
      ||
      null;

    if (!nextPageToken) {
      break;
    }

    if (
      seenPageTokens.has(
        nextPageToken
      )
    ) {
      throw new Error(
        "Яндекс API вернул повторяющийся nextPageToken"
      );
    }

    seenPageTokens.add(
      nextPageToken
    );

    pageToken =
      nextPageToken;

    if (pages > 1000) {
      throw new Error(
        "Защитная остановка: слишком много страниц offer-mappings"
      );
    }
  }

  return {
    items,
    pages,
  };
}


// ============================================================
// ВАЛИДАЦИЯ И DEDUPE ПО offerId
//
// offerId является идентификатором товара продавца.
// Именно по нему yandex_products имеет UNIQUE.
// marketSku здесь НЕ используется как уникальный ключ.
// ============================================================

function normalizeOfferMappings(
  items: RawYandexOfferMapping[]
): RawYandexOfferMapping[] {
  const byOfferId =
    new Map<
      string,
      RawYandexOfferMapping
    >();

  for (
    const item
    of items
  ) {
    const offerId =
      item
        .offer
        ?.offerId
        ?.trim();

    if (!offerId) {
      throw new Error(
        "В ответе Яндекс найден товар без offer.offerId"
      );
    }

    if (
      byOfferId.has(
        offerId
      )
    ) {
      throw new Error(
        `Яндекс API вернул дублирующийся offerId: ${offerId}`
      );
    }

    byOfferId.set(
      offerId,
      item
    );
  }

  return Array.from(
    byOfferId.values()
  );
}


// ============================================================
// ТЕКУЩИЕ YANDEX_PRODUCTS
//
// Нужны, чтобы:
//
// 1. не потерять уже назначенный master_code;
// 2. не менять first_seen_at при каждой синхронизации.
// ============================================================

async function getExistingYandexProducts():
Promise<Map<string, ExistingYandexProduct>> {
  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();

  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_products`
    );

  url.searchParams.set(
    "select",
    [
      "offer_id",
      "master_code",
      "first_seen_at",
    ].join(",")
  );

  url.searchParams.set(
    "limit",
    "5000"
  );

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",

        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const rawText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      [
        "Supabase yandex_products GET",
        `HTTP ${response.status}`,
        rawText,
      ].join(": ")
    );
  }

  const rows =
    parseJson<
      ExistingYandexProduct[]
    >(
      rawText,
      "Supabase yandex_products GET"
    );

  const result =
    new Map<
      string,
      ExistingYandexProduct
    >();

  for (
    const row
    of rows
  ) {
    result.set(
      row.offer_id,
      row
    );
  }

  return result;
}


// ============================================================
// ПОДГОТОВКА СТРОК ДЛЯ SUPABASE
// ============================================================

function buildUpsertRows(
  items: RawYandexOfferMapping[],
  existing:
    Map<
      string,
      ExistingYandexProduct
    >,
  syncedAt: string
): YandexProductUpsertRow[] {
  return items.map(
    (
      item
    ) => {
      const offerId =
        item
          .offer
          ?.offerId
          ?.trim();

      if (!offerId) {
        throw new Error(
          "Невозможно сохранить товар без offerId"
        );
      }

      const existingRow =
        existing.get(
          offerId
        );

      const rawMarketSku =
        item
          .mapping
          ?.marketSku;

      let marketSku:
        string | null =
        null;

      if (
        typeof rawMarketSku ===
          "string"
      ) {
        const trimmed =
          rawMarketSku.trim();

        marketSku =
          trimmed !== ""
            ? trimmed
            : null;
      }

      const categoryName =
        item
          .mapping
          ?.marketCategoryName;

      return {
        offer_id:
          offerId,

        market_sku:
          marketSku,

        market_category_name:
          typeof categoryName ===
            "string"
            &&
            categoryName.trim() !== ""
            ? categoryName.trim()
            : null,

        master_code:
          existingRow
            ?.master_code
          ??
          null,

        first_seen_at:
          existingRow
            ?.first_seen_at
          ??
          syncedAt,

        last_seen_at:
          syncedAt,

        is_active:
          true,

        raw_data:
          item,

        updated_at:
          syncedAt,
      };
    }
  );
}


// ============================================================
// UPSERT В SUPABASE
// ============================================================

async function upsertYandexProducts(
  rows: YandexProductUpsertRow[]
): Promise<void> {
  if (
    rows.length ===
    0
  ) {
    return;
  }

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();

  const url =
    new URL(
      `${supabaseUrl}/rest/v1/yandex_products`
    );

  url.searchParams.set(
    "on_conflict",
    "offer_id"
  );

  const response =
    await fetch(
      url.toString(),
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

          Prefer:
            "resolution=merge-duplicates,return=minimal",
        },

        body:
          JSON.stringify(
            rows
          ),

        cache:
          "no-store",
      }
    );

  const rawText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      [
        "Supabase yandex_products UPSERT",
        `HTTP ${response.status}`,
        rawText,
      ].join(": ")
    );
  }
}


// ============================================================
// ПРОВЕРКА БОЛЬШИХ PRODUCT ID
// ============================================================

function countLargeMarketSkus(
  rows: YandexProductUpsertRow[]
): number {
  const maxSafe =
    BigInt(
      Number.MAX_SAFE_INTEGER
    );

  let count =
    0;

  for (
    const row
    of rows
  ) {
    if (!row.market_sku) {
      continue;
    }

    try {
      const value =
        BigInt(
          row.market_sku
        );

      if (
        value >
        maxSafe
      ) {
        count +=
          1;
      }
    } catch {
      // Если Яндекс когда-нибудь
      // изменит формат marketSku,
      // синхронизация из-за этого
      // не должна падать.
    }
  }

  return count;
}


// ============================================================
// КОНТРОЛЬНЫЕ SKU
//
// Ничего не меняют.
// Просто возвращаются в JSON ответа,
// чтобы мы сразу увидели,
// сохранились ли длинные ID точно.
// ============================================================

function buildPrecisionCheck(
  rows: YandexProductUpsertRow[]
) {
  const controlOfferIds =
    new Set([
      "AVD-NY150G",
      "AVD-NY150GR",
      "AVD-NY150S",
    ]);

  return rows
    .filter(
      (
        row
      ) =>
        controlOfferIds.has(
          row.offer_id
        )
    )
    .map(
      (
        row
      ) => ({
        offer_id:
          row.offer_id,

        market_sku:
          row.market_sku,
      })
    )
    .sort(
      (
        a,
        b
      ) =>
        a.offer_id.localeCompare(
          b.offer_id
        )
    );
}


// ============================================================
// ROUTE
// ============================================================

export async function GET() {
  try {
    const apiKey = await getIntegrationSecret("yandex_api_key");
    if (!apiKey) throw new Error("Не найдена YANDEX_API_KEY");

    const campaignId = await getIntegrationSecret("yandex_campaign_id");
    if (!campaignId) throw new Error("Не найдена YANDEX_CAMPAIGN_ID");

    const businessId =
      await getBusinessId(
        apiKey,
        campaignId
      );

    const {
      items:
        rawItems,
      pages,
    } =
      await getAllOfferMappings(
        apiKey,
        businessId
      );

    const items =
      normalizeOfferMappings(
        rawItems
      );

    const existing =
      await getExistingYandexProducts();

    const syncedAt =
      new Date()
        .toISOString();

    const rows =
      buildUpsertRows(
        items,
        existing,
        syncedAt
      );

    await upsertYandexProducts(
      rows
    );

    const largeMarketSkus =
      countLargeMarketSkus(
        rows
      );

    const precisionCheck =
      buildPrecisionCheck(
        rows
      );

    return NextResponse.json(
      {
        ok:
          true,

        business_id:
          businessId,

        pages,

        received:
          rawItems.length,

        unique_offers:
          items.length,

        saved:
          rows.length,

        market_sku_storage:
          "text",

        large_market_skus_preserved:
          largeMarketSkus,

        precision_check:
          precisionCheck,

        synced_at:
          syncedAt,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "YANDEX PRODUCTS SYNC ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          message,
      },
      {
        status:
          500,
      }
    );
  }
}
