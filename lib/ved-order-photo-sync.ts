// ============================================================
// ТИПЫ
// ============================================================

type VedOrderItemRow = {
  id: string;
  product_id: string | null;
  our_article_snapshot: string | null;
  photo_url: string | null;
  item_kind: string;
};


type ProductRow = {
  id: string;
  offer_id: string;
  main_photo_url: string | null;
};


type OzonProduct = {
  id?: number | string;
  offer_id?: string;
  primary_image?: string | string[] | null;
  images?: string[] | null;
};

type OzonResponse = {
  items?: OzonProduct[];
};

type OzonPicturesResponse = {
  items?: Array<{
    product_id?: number | string;
    primary_photo?: string[];
    photo?: string[];
  }>;
};


type OzonCatalogResponse = {
  result?: {
    items?: Array<{
      product_id?: number | string;
      offer_id?: string;
    }>;
  };
};

type OzonLookupResult = {
  photos: Map<string, string>;
  recognized: Set<string>;
  fallbackError: string | null;
};


export type VedPhotoSyncResult = {
  ok: boolean;

  order_id: string;

  existing_items: number;

  already_had_photo: number;

  copied_from_product: number;

  loaded_from_ozon: number;

  missing_in_ozon: number;

  missing_offer_id: number;
  requested_from_ozon?: number;
  recognized_in_ozon?: number;
  missing_articles?: string[];
  ozon_fallback_error?: string | null;
};


// ============================================================
// CONFIG
// ============================================================

function getConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


  const ozonClientId =
    process.env
      .OZON_CLIENT_ID;


  const ozonApiKey =
    process.env
      .OZON_API_KEY;


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


  if (!ozonClientId) {

    throw new Error(
      "Vercel не видит OZON_CLIENT_ID"
    );

  }


  if (!ozonApiKey) {

    throw new Error(
      "Vercel не видит OZON_API_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
    ozonClientId,
    ozonApiKey,
  };

}


// ============================================================
// SUPABASE REQUEST
// ============================================================

async function supabaseRequest<T>(
  path: string,
  options?: RequestInit
):
  Promise<T> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
      {
        ...options,

        headers: {

          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          "Content-Type":
            "application/json",

          ...(options?.headers ?? {}),

        },

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Ошибка Supabase. HTTP ${response.status}. ${text}`
    );

  }


  if (!text.trim()) {

    return undefined as T;

  }


  return JSON.parse(
    text
  ) as T;

}


// ============================================================
// ФОТО ИЗ OZON
// Основной метод: /v3/product/info/list (items).
// Резервный метод: /v2/product/pictures/info (по product_id).
// ============================================================

function firstImageUrl(value: unknown): string | null {
  const values = Array.isArray(value) ? value : [value];

  for (const candidate of values) {
    if (typeof candidate !== "string") continue;
    const url = candidate.trim();

    // Never save a data: or javascript: URL in the products table.
    if (/^https?:\/\//i.test(url)) return url;
  }

  return null;
}

async function ozonPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const { ozonClientId, ozonApiKey } = getConfig();
  let lastError: Error | null = null;

  // Small, bounded retry for Ozon's transient 429/5xx responses.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`https://api-seller.ozon.ru${path}`, {
        method: "POST",
        headers: {
          "Client-Id": ozonClientId,
          "Api-Key": ozonApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });

      const responseText = await response.text();

      if (!response.ok) {
        const error = new Error(
          `Ozon photo API ${path}: HTTP ${response.status}. ${responseText.slice(0, 400)}`
        );

        if (response.status !== 429 && response.status < 500) {
          throw error;
        }

        lastError = error;
      } else {
        return JSON.parse(responseText) as T;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (
        lastError.message.includes("HTTP 400") ||
        lastError.message.includes("HTTP 401") ||
        lastError.message.includes("HTTP 403")
      ) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1200));
    }
  }

  throw lastError ?? new Error("Ozon не вернул фотографии");
}

async function getOzonPhotos(offerIds: string[]): Promise<OzonLookupResult> {
  const photos = new Map<string, string>();
  const recognized = new Set<string>();
  let fallbackError: string | null = null;

  // Ozon supports up to 1,000 IDs per call; smaller batches are gentler.
  for (let start = 0; start < offerIds.length; start += 100) {
    const batch = offerIds.slice(start, start + 100);
    const batchSet = new Set(batch);
    const productIds = new Map<string, string>();

    // /v3/product/info/list returns { items: [...] }.
    const data = await ozonPost<OzonResponse>("/v3/product/info/list", {
      offer_id: batch,
    });

    if (!Array.isArray(data.items)) {
      throw new Error("Ozon /v3/product/info/list: отсутствует массив items");
    }

    for (const item of data.items) {
      const offerId = item.offer_id?.trim();
      if (!offerId || !batchSet.has(offerId)) continue;

      recognized.add(offerId);

      const image =
        firstImageUrl(item.primary_image) ??
        firstImageUrl(item.images);

      if (image) {
        photos.set(offerId, image);
      } else if (item.id != null) {
        productIds.set(String(item.id), offerId);
      }
    }

    // Catalog lookup is essential when info/list returns no matching item.
    // Our products.ozon_product_id is empty, so we cannot rely on that column.
    const notReturned = batch.filter((id) => !recognized.has(id));

    if (notReturned.length > 0) {
      try {
        const catalog = await ozonPost<OzonCatalogResponse>("/v3/product/list", {
          filter: { offer_id: notReturned },
          last_id: "",
          limit: Math.min(notReturned.length, 1000),
        });

        if (!Array.isArray(catalog.result?.items)) {
          throw new Error("Ozon /v3/product/list: отсутствует result.items");
        }

        for (const item of catalog.result.items) {
          const offerId = item.offer_id?.trim();
          if (!offerId || !batchSet.has(offerId)) continue;
          recognized.add(offerId);
          if (item.product_id != null && !photos.has(offerId)) {
            productIds.set(String(item.product_id), offerId);
          }
        }
      } catch (error) {
        fallbackError = error instanceof Error ? error.message : String(error);
        console.error("VED Ozon catalog lookup failed:", fallbackError);
      }
    }

    if (productIds.size > 0) {
      try {
        const pictures = await ozonPost<OzonPicturesResponse>(
          "/v2/product/pictures/info",
          { product_id: Array.from(productIds.keys()) }
        );

        if (!Array.isArray(pictures.items)) {
          throw new Error("Ozon /v2/product/pictures/info: отсутствует items");
        }

        for (const item of pictures.items) {
          const offerId = productIds.get(String(item.product_id));
          if (!offerId || photos.has(offerId)) continue;

          const image =
            firstImageUrl(item.primary_photo) ??
            firstImageUrl(item.photo);

          if (image) photos.set(offerId, image);
        }
      } catch (error) {
        fallbackError = error instanceof Error ? error.message : String(error);
        console.error("VED Ozon picture lookup failed:", fallbackError);
      }
    }
  }

  return { photos, recognized, fallbackError };
}


// ============================================================
// АУДИТ
// ============================================================

async function saveAudit(
  orderId: string,
  itemId: string,
  offerId: string,
  photoUrl: string,
  source:
    "product_card"
    |
    "ozon"
) {

  await supabaseRequest<void>(
    "ved_order_audit_log",
    {
      method:
        "POST",

      headers: {
        Prefer:
          "return=minimal",
      },

      body:
        JSON.stringify(
          {
            ved_order_id:
              orderId,

            ved_order_item_id:
              itemId,

            event_type:
              "photo_auto_loaded",

            old_value:
              {
                photo_url:
                  null,
              },

            new_value:
              {
                photo_url:
                  photoUrl,
              },

            actor_name:
              "System",

            actor_role:
              "system",

            metadata:
              {
                source,

                offer_id:
                  offerId,
              },
          }
        ),
    }
  );

}


// ============================================================
// СИНХРОНИЗАЦИЯ ФОТОГРАФИЙ ЗАКАЗА
// ============================================================

export async function syncVedOrderPhotos(
  orderId: string
):
  Promise<VedPhotoSyncResult> {

  const normalizedOrderId =
    orderId.trim();


  if (!normalizedOrderId) {

    throw new Error(
      "Не указан ID заказа"
    );

  }


  // ==========================================================
  // 1. ПОЗИЦИИ ЗАКАЗА
  //
  // Новые товары специально не обрабатываем.
  // ==========================================================

  const orderItems =
    await supabaseRequest<
      VedOrderItemRow[]
    >(
      "ved_order_items"
      +
      `?ved_order_id=eq.${encodeURIComponent(normalizedOrderId)}`
      +
      "&item_kind=eq.existing"
      +
      "&select=id,product_id,our_article_snapshot,photo_url,item_kind"
    );


  if (
    !orderItems
    ||
    orderItems.length === 0
  ) {

    return {
      ok:
        true,

      order_id:
        normalizedOrderId,

      existing_items:
        0,

      already_had_photo:
        0,

      copied_from_product:
        0,

      loaded_from_ozon:
        0,

      missing_in_ozon:
        0,

      missing_offer_id:
        0,
    };

  }


  // ==========================================================
  // 2. PRODUCT IDS
  // ==========================================================

  const productIds =
    Array.from(
      new Set(
        orderItems
          .map(
            (
              item
            ) =>
              item.product_id
          )
          .filter(
            (
              value
            ):
              value is string =>
                Boolean(value)
          )
      )
    );


  if (
    productIds.length === 0
  ) {

    return {
      ok:
        true,

      order_id:
        normalizedOrderId,

      existing_items:
        orderItems.length,

      already_had_photo:
        orderItems.filter(
          (
            item
          ) =>
            Boolean(
              item.photo_url
                ?.trim()
            )
        ).length,

      copied_from_product:
        0,

      loaded_from_ozon:
        0,

      missing_in_ozon:
        0,

      missing_offer_id:
        orderItems.length,
    };

  }


  // ==========================================================
  // 3. ТОВАРЫ
  // ==========================================================

  const productFilter =
    productIds
      .map(
        (
          id
        ) =>
          `"${id}"`
      )
      .join(
        ","
      );


  const products =
    await supabaseRequest<
      ProductRow[]
    >(
      "products"
      +
      `?id=in.(${encodeURIComponent(productFilter)})`
      +
      "&select=id,offer_id,main_photo_url"
    );


  const productById =
    new Map<
      string,
      ProductRow
    >();


  for (
    const product
    of products ?? []
  ) {

    productById.set(
      product.id,
      product
    );

  }


  // ==========================================================
  // 4. СЧЁТЧИКИ
  // ==========================================================

  let alreadyHadPhoto =
    0;


  let copiedFromProduct =
    0;


  let loadedFromOzon =
    0;


  let missingInOzon =
    0;


  let missingOfferId =
    0;


  const needsOzon:
    Array<{
      item: VedOrderItemRow;
      product: ProductRow;
    }> =
    [];


  // ==========================================================
  // 5. СНАЧАЛА ИСПОЛЬЗУЕМ ФОТО ИЗ PRODUCTS
  // ==========================================================

  for (
    const item
    of orderItems
  ) {

    if (
      item.photo_url
        ?.trim()
    ) {

      alreadyHadPhoto +=
        1;

      continue;

    }


    if (!item.product_id) {

      missingOfferId +=
        1;

      continue;

    }


    const product =
      productById.get(
        item.product_id
      );


    if (
      !product
      ||
      !product.offer_id
        ?.trim()
    ) {

      missingOfferId +=
        1;

      continue;

    }


    const existingProductPhoto =
      product
        .main_photo_url
        ?.trim();


    if (
      existingProductPhoto
    ) {

      await supabaseRequest<void>(
        "ved_order_items"
        +
        `?id=eq.${encodeURIComponent(item.id)}`,
        {
          method:
            "PATCH",

          headers: {
            Prefer:
              "return=minimal",
          },

          body:
            JSON.stringify(
              {
                photo_url:
                  existingProductPhoto,
              }
            ),
        }
      );


      await saveAudit(
        normalizedOrderId,
        item.id,
        product.offer_id,
        existingProductPhoto,
        "product_card"
      );


      copiedFromProduct +=
        1;


      continue;

    }


    needsOzon.push(
      {
        item,
        product,
      }
    );

  }


  // ==========================================================
  // 6. OFFER IDS ДЛЯ OZON
  // ==========================================================

  const offerIds =
    Array.from(
      new Set(
        needsOzon
          .map(
            (
              row
            ) =>
              row
                .product
                .offer_id
                .trim()
          )
          .filter(
            Boolean
          )
      )
    );


  // ==========================================================
  // 7. ПОЛУЧАЕМ ФОТО ИЗ OZON
  // ==========================================================

  const ozonLookup = await getOzonPhotos(offerIds);
  const ozonPhotos = ozonLookup.photos;

  // ==========================================================
  // 8. СОХРАНЯЕМ ФОТО
  // ==========================================================

  for (
    const row
    of needsOzon
  ) {

    const offerId =
      row
        .product
        .offer_id
        .trim();


    const photoUrl =
      ozonPhotos.get(
        offerId
      );


    if (!photoUrl) {

      missingInOzon +=
        1;

      continue;

    }


    // --------------------------------------------------------
    // КАРТОЧКА ТОВАРА
    // --------------------------------------------------------

    await supabaseRequest<void>(
      "products"
      +
      `?id=eq.${encodeURIComponent(row.product.id)}`,
      {
        method:
          "PATCH",

        headers: {
          Prefer:
            "return=minimal",
        },

        body:
          JSON.stringify(
            {
              main_photo_url:
                photoUrl,
            }
          ),
      }
    );


    // --------------------------------------------------------
    // SNAPSHOT В ТЕКУЩЕМ ЗАКАЗЕ
    // --------------------------------------------------------

    await supabaseRequest<void>(
      "ved_order_items"
      +
      `?id=eq.${encodeURIComponent(row.item.id)}`,
      {
        method:
          "PATCH",

        headers: {
          Prefer:
            "return=minimal",
        },

        body:
          JSON.stringify(
            {
              photo_url:
                photoUrl,
            }
          ),
      }
    );


    // --------------------------------------------------------
    // АУДИТ
    // --------------------------------------------------------

    await saveAudit(
      normalizedOrderId,
      row.item.id,
      offerId,
      photoUrl,
      "ozon"
    );


    loadedFromOzon +=
      1;

  }


  // ==========================================================
  // 9. РЕЗУЛЬТАТ
  // ==========================================================

  return {
    ok:
      true,

    order_id:
      normalizedOrderId,

    existing_items:
      orderItems.length,

    already_had_photo:
      alreadyHadPhoto,

    copied_from_product:
      copiedFromProduct,

    loaded_from_ozon:
      loadedFromOzon,

    missing_in_ozon:
      missingInOzon,

    missing_offer_id:
      missingOfferId,

    requested_from_ozon:
      offerIds.length,

    recognized_in_ozon:
      ozonLookup.recognized.size,

    missing_articles:
      offerIds.filter((article) => !ozonPhotos.has(article)),

    ozon_fallback_error:
      ozonLookup.fallbackError,
  };

}
