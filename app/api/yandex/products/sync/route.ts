import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YANDEX_API_BASE =
  "https://api.partner.market.yandex.ru";

const PAGE_LIMIT = 100;

type YandexCampaignResponse = {
  campaign?: {
    id?: number;
    domain?: string;
    business?: {
      id?: number;
      name?: string;
    };
    apiAvailability?: string;
  };
};

type YandexOffer = {
  offer?: {
    offerId?: string;
    name?: string;
    barcodes?: string[];
    vendor?: string;
    vendorCode?: string;
  };

  mapping?: {
    marketSku?: number;
    marketSkuName?: string;
    marketCategoryId?: number;
    marketCategoryName?: string;
  };

  [key: string]: unknown;
};

type OfferMappingsResponse = {
  result?: {
    offerMappings?: YandexOffer[];
    paging?: {
      nextPageToken?: string;
    };
  };

  status?: string;
};

function getConfig() {
  const yandexApiKey =
    process.env.YANDEX_API_KEY?.trim();

  const yandexCampaignId =
    process.env.YANDEX_CAMPAIGN_ID?.trim();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const supabaseSecretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();

  if (!yandexApiKey) {
    throw new Error(
      "Не задан YANDEX_API_KEY"
    );
  }

  if (!yandexCampaignId) {
    throw new Error(
      "Не задан YANDEX_CAMPAIGN_ID"
    );
  }

  if (!supabaseUrl) {
    throw new Error(
      "Не задан NEXT_PUBLIC_SUPABASE_URL или SUPABASE_URL"
    );
  }

  if (!supabaseSecretKey) {
    throw new Error(
      "Не задан SUPABASE_SERVICE_ROLE_KEY или SUPABASE_SECRET_KEY"
    );
  }

  return {
    yandexApiKey,
    yandexCampaignId,
    supabaseUrl,
    supabaseSecretKey,
  };
}

async function yandexRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const {
    yandexApiKey,
  } = getConfig();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      30000
    );

  try {
    const response =
      await fetch(
        url,
        {
          ...options,

          headers: {
            "Api-Key":
              yandexApiKey,

            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            ...(options?.headers || {}),
          },

          cache:
            "no-store",

          signal:
            controller.signal,
        }
      );

    const text =
      await response.text();

    let parsed:
      unknown = null;

    if (text) {
      try {
        parsed =
          JSON.parse(text);
      } catch {
        parsed = {
          raw: text,
        };
      }
    }

    if (!response.ok) {
      throw new Error(
        [
          "Yandex Market API",
          `HTTP ${response.status}`,
          JSON.stringify(parsed),
        ].join(": ")
      );
    }

    return parsed as T;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "Yandex Market API: превышено время ожидания"
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function getBusinessId():
Promise<number> {
  const {
    yandexCampaignId,
  } = getConfig();

  const campaign =
    await yandexRequest<YandexCampaignResponse>(
      `${YANDEX_API_BASE}/v2/campaigns/${encodeURIComponent(
        yandexCampaignId
      )}`,
      {
        method: "GET",
      }
    );

  const businessId =
    campaign.campaign
      ?.business
      ?.id;

  if (
    !businessId ||
    !Number.isFinite(
      businessId
    )
  ) {
    throw new Error(
      `Яндекс не вернул businessId для campaignId=${yandexCampaignId}`
    );
  }

  return businessId;
}

async function getAllOffers(
  businessId: number
): Promise<YandexOffer[]> {
  const result:
    YandexOffer[] = [];

  let pageToken:
    string | undefined =
      undefined;

  let pageNumber = 0;

  do {
    pageNumber += 1;

    if (
      pageNumber > 1000
    ) {
      throw new Error(
        "Слишком много страниц offer-mappings. Синхронизация остановлена."
      );
    }

    const url =
      new URL(
        `${YANDEX_API_BASE}/v2/businesses/${businessId}/offer-mappings`
      );

    url.searchParams.set(
      "limit",
      String(PAGE_LIMIT)
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
      await yandexRequest<OfferMappingsResponse>(
        url.toString(),
        {
          method: "POST",

          /*
           * По документации тело можно
           * не передавать, если нужен
           * полный каталог.
           */
        }
      );

    const offers =
      response.result
        ?.offerMappings ??
      [];

    result.push(
      ...offers
    );

    pageToken =
      response.result
        ?.paging
        ?.nextPageToken;

  } while (pageToken);

  return result;
}

async function upsertProducts(
  offers: YandexOffer[]
) {
  const {
    supabaseUrl,
    supabaseSecretKey,
  } = getConfig();

  const now =
    new Date()
      .toISOString();

  const rows =
    offers
      .map(
        (
          item
        ) => {
          const offerId =
            item.offer
              ?.offerId
              ?.trim();

          if (!offerId) {
            return null;
          }

          return {
            offer_id:
              offerId,

            market_sku:
              item.mapping
                ?.marketSku ??
              null,

            market_category_name:
              item.mapping
                ?.marketCategoryName ??
              null,

            last_seen_at:
              now,

            is_active:
              true,

            raw_data:
              item,

            updated_at:
              now,
          };
        }
      )
      .filter(
        (
          row
        ): row is NonNullable<
          typeof row
        > =>
          row !== null
      );

  if (
    rows.length === 0
  ) {
    throw new Error(
      "Яндекс вернул каталог без offerId"
    );
  }

  /*
   * Supabase/PostgREST обычно нормально
   * переваривает такие пачки, но не будем
   * отправлять весь каталог одним кирпичом.
   */
  const batchSize = 500;

  for (
    let index = 0;
    index < rows.length;
    index += batchSize
  ) {
    const batch =
      rows.slice(
        index,
        index + batchSize
      );

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

            Prefer:
              "resolution=merge-duplicates,return=minimal",
          },

          body:
            JSON.stringify(
              batch
            ),

          cache:
            "no-store",
        }
      );

    const responseText =
      await response.text();

    if (
      !response.ok
    ) {
      throw new Error(
        [
          "Supabase yandex_products",
          `HTTP ${response.status}`,
          responseText,
        ].join(": ")
      );
    }
  }

  return {
    saved:
      rows.length,
  };
}

export async function GET() {
  try {
    const businessId =
      await getBusinessId();

    const offers =
      await getAllOffers(
        businessId
      );

    const saved =
      await upsertProducts(
        offers
      );

    return NextResponse.json(
      {
        ok: true,

        business_id:
          businessId,

        received:
          offers.length,

        saved:
          saved.saved,

        synced_at:
          new Date()
            .toISOString(),
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "YANDEX PRODUCTS SYNC ERROR",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
