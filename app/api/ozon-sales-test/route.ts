import {
  NextResponse,
} from "next/server";


// ============================================================
// OZON SALES TEST
//
// НИЧЕГО НЕ ЗАПИСЫВАЕТ В SUPABASE.
//
// Проверяем:
// 1. FBO-заказы.
// 2. Статусы.
// 3. Товары и количества.
// 4. warehouse_id.
// 5. Связь warehouse → cluster.
// 6. Исключение cancelled.
// ============================================================


// ============================================================
// ТИПЫ КЛАСТЕРОВ
// ============================================================

type OzonWarehouse = {
  warehouse_id?: number | string;
  name?: string;
};


type OzonLogisticCluster = {
  warehouses?: OzonWarehouse[];
};


type OzonCluster = {
  id?: number | string;
  name?: string;

  logistic_clusters?:
    OzonLogisticCluster[];
};


type OzonClusterResponse = {
  clusters?: OzonCluster[];
};


// ============================================================
// ТИПЫ FBO POSTINGS
// ============================================================

type OzonPostingProduct = {
  sku?: number | string;

  name?: string;

  quantity?: number;

  offer_id?: string;
};


type OzonPostingAnalytics = {
  warehouse_id?:
    number | string;

  warehouse_name?:
    string;

  city?: string;
};


type OzonFboPosting = {
  posting_number?: string;

  order_number?: string;

  status?: string;

  created_at?: string;

  analytics_data?:
    OzonPostingAnalytics;

  products?:
    OzonPostingProduct[];
};


type OzonFboResponse = {
  postings?:
    OzonFboPosting[];

  cursor?: string;

  has_next?: boolean;
};


// ============================================================
// ТИП КАРТЫ СКЛАДА
// ============================================================

type WarehouseClusterInfo = {
  cluster_id: string;

  cluster_name: string;

  warehouse_name:
    string | null;
};


// ============================================================
// HEADERS OZON
// ============================================================

function getOzonHeaders() {

  const clientId =
    process.env.OZON_CLIENT_ID;

  const apiKey =
    process.env.OZON_API_KEY;


  if (!clientId) {

    throw new Error(
      "Vercel не видит OZON_CLIENT_ID"
    );

  }


  if (!apiKey) {

    throw new Error(
      "Vercel не видит OZON_API_KEY"
    );

  }


  return {

    "Client-Id":
      clientId,

    "Api-Key":
      apiKey,

    "Content-Type":
      "application/json",

    Accept:
      "application/json",

  };
}


// ============================================================
// POST В OZON
// ============================================================

async function ozonPost<T>(
  endpoint: string,
  body: Record<string, unknown>
):
  Promise<T> {

  const response =
    await fetch(
      `https://api-seller.ozon.ru${endpoint}`,
      {
        method: "POST",

        headers:
          getOzonHeaders(),

        body:
          JSON.stringify(
            body
          ),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Ozon ${endpoint}: HTTP ${response.status}. ${text}`
    );

  }


  try {

    return JSON.parse(
      text
    ) as T;

  } catch {

    throw new Error(
      `Ozon ${endpoint} вернул некорректный JSON`
    );

  }
}


// ============================================================
// ДАТА YYYY-MM-DD
// ============================================================

function formatDateUtc(
  date: Date
) {

  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


// ============================================================
// ПОСЛЕДНИЕ ЗАВЕРШЁННЫЕ ДНИ
//
// Для теста используем 3 завершённых дня.
//
// Время считаем по Москве UTC+3.
// Для рабочего расчёта потом будет 28 дней.
// ============================================================

function getCompletedMoscowRange(
  numberOfDays: number
) {

  const moscowNow =
    new Date(
      Date.now()
      +
      3 * 60 * 60 * 1000
    );


  const endDate =
    new Date(
      Date.UTC(
        moscowNow
          .getUTCFullYear(),

        moscowNow
          .getUTCMonth(),

        moscowNow
          .getUTCDate()
      )
    );


  // Сегодня ещё не завершён,
  // поэтому берём вчера.
  endDate.setUTCDate(
    endDate.getUTCDate() - 1
  );


  const startDate =
    new Date(
      endDate.getTime()
    );


  startDate.setUTCDate(
    startDate.getUTCDate()
    -
    (numberOfDays - 1)
  );


  const dateFrom =
    formatDateUtc(
      startDate
    );


  const dateTo =
    formatDateUtc(
      endDate
    );


  return {

    dateFrom,

    dateTo,

    since:
      `${dateFrom}T00:00:00+03:00`,

    to:
      `${dateTo}T23:59:59+03:00`,

  };
}


// ============================================================
// GET — ТЕСТ
// ============================================================

export async function GET() {

  try {

    // ========================================================
    // 1. ПОЛУЧАЕМ СПИСОК КЛАСТЕРОВ OZON
    // ========================================================

    const clusterResponse =
      await ozonPost<
        OzonClusterResponse
      >(
        "/v1/cluster/list",
        {
          cluster_type:
            "CLUSTER_TYPE_OZON",
        }
      );


    const clusters =
      Array.isArray(
        clusterResponse.clusters
      )
        ? clusterResponse.clusters
        : [];


    if (
      clusters.length === 0
    ) {

      throw new Error(
        "Ozon не вернул список кластеров"
      );

    }


    // ========================================================
    // 2. СТРОИМ КАРТУ:
    //
    // warehouse_id
    //     ↓
    // cluster_id + cluster_name
    // ========================================================

    const warehouseMap =
      new Map<
        string,
        WarehouseClusterInfo
      >();


    for (
      const cluster
      of clusters
    ) {

      const clusterId =
        String(
          cluster.id ?? ""
        ).trim();


      const clusterName =
        String(
          cluster.name ?? ""
        ).trim();


      if (!clusterId) {
        continue;
      }


      for (
        const logisticCluster
        of cluster.logistic_clusters
          ?? []
      ) {

        for (
          const warehouse
          of logisticCluster.warehouses
            ?? []
        ) {

          const warehouseId =
            String(
              warehouse.warehouse_id
              ?? ""
            ).trim();


          if (!warehouseId) {
            continue;
          }


          warehouseMap.set(
            warehouseId,
            {
              cluster_id:
                clusterId,

              cluster_name:
                clusterName
                || `Кластер ${clusterId}`,

              warehouse_name:
                String(
                  warehouse.name
                  ?? ""
                ).trim()
                || null,
            }
          );

        }

      }

    }


    // ========================================================
    // 3. ДИАПАЗОН ТЕСТА
    //
    // Сейчас 3 завершённых дня.
    // ========================================================

    const range =
      getCompletedMoscowRange(
        3
      );


    // ========================================================
    // 4. БЕРЁМ ПЕРВЫЕ 100 FBO-ОТПРАВЛЕНИЙ
    //
    // Статус специально НЕ фильтруем.
    // Нам нужны в том числе cancelled.
    // ========================================================

    const postingsResponse =
      await ozonPost<
        OzonFboResponse
      >(
        "/v3/posting/fbo/list",
        {
          cursor: "",

          filter: {

            since:
              range.since,

            to:
              range.to,

          },

          limit:
            100,

          sort_dir:
            "asc",

          translit:
            false,

          with: {

            analytics_data:
              true,

            financial_data:
              false,

            legal_info:
              false,

          },
        }
      );


    const postings =
      Array.isArray(
        postingsResponse.postings
      )
        ? postingsResponse.postings
        : [];


    // ========================================================
    // 5. СЧИТАЕМ СТАТУСЫ
    // ========================================================

    const statusCounts:
      Record<
        string,
        number
      > = {};


    for (
      const posting
      of postings
    ) {

      const status =
        String(
          posting.status
          ?? "unknown"
        );


      statusCounts[
        status
      ] =
        (
          statusCounts[
            status
          ]
          ?? 0
        )
        + 1;

    }


    // ========================================================
    // 6. ИЩЕМ СКЛАДЫ,
    // КОТОРЫЕ НЕ СМОГЛИ ПРИВЯЗАТЬ
    // К КЛАСТЕРУ
    // ========================================================

    const unmappedWarehouses =
      new Map<
        string,
        string
      >();


    // ========================================================
    // 7. ТЕСТОВАЯ АГРЕГАЦИЯ ПРОДАЖ
    //
    // Ключ:
    // offer_id + cluster_id
    //
    // cancelled:
    // в продажи НЕ включаем.
    // ========================================================

    const salesAggregate =
      new Map<
        string,
        {
          offer_id: string;

          cluster_id:
            string | null;

          cluster_name:
            string | null;

          sales_quantity:
            number;

          cancelled_quantity:
            number;
        }
      >();


    for (
      const posting
      of postings
    ) {

      const status =
        String(
          posting.status
          ?? ""
        ).toLowerCase();


      const isCancelled =
        status ===
          "cancelled";


      const warehouseId =
        String(
          posting
            .analytics_data
            ?.warehouse_id
          ?? ""
        ).trim();


      const apiWarehouseName =
        String(
          posting
            .analytics_data
            ?.warehouse_name
          ?? ""
        ).trim();


      const clusterInfo =
        warehouseId
          ? warehouseMap.get(
              warehouseId
            )
          : undefined;


      if (
        warehouseId
        &&
        !clusterInfo
      ) {

        unmappedWarehouses.set(
          warehouseId,

          apiWarehouseName
          || "Без названия"
        );

      }


      for (
        const product
        of posting.products
          ?? []
      ) {

        const offerId =
          String(
            product.offer_id
            ?? ""
          ).trim();


        if (!offerId) {
          continue;
        }


        const rawQuantity =
          Number(
            product.quantity
            ?? 0
          );


        const quantity =
          Number.isFinite(
            rawQuantity
          )
            ? Math.max(
                0,
                Math.round(
                  rawQuantity
                )
              )
            : 0;


        const clusterId =
          clusterInfo
            ?.cluster_id
          ?? null;


        const clusterName =
          clusterInfo
            ?.cluster_name
          ?? null;


        const key =
          `${offerId}::${
            clusterId
            ?? "UNMAPPED"
          }`;


        const existing =
          salesAggregate.get(
            key
          )
          ?? {
            offer_id:
              offerId,

            cluster_id:
              clusterId,

            cluster_name:
              clusterName,

            sales_quantity:
              0,

            cancelled_quantity:
              0,
          };


        if (isCancelled) {

          existing
            .cancelled_quantity
            += quantity;

        } else {

          existing
            .sales_quantity
            += quantity;

        }


        salesAggregate.set(
          key,
          existing
        );

      }

    }


    // ========================================================
    // 8. УПРОЩЁННЫЕ ПРИМЕРЫ ОТПРАВЛЕНИЙ
    // ========================================================

    const samplePostings =
      postings
        .slice(
          0,
          20
        )
        .map(
          (
            posting
          ) => {

            const warehouseId =
              String(
                posting
                  .analytics_data
                  ?.warehouse_id
                ?? ""
              ).trim();


            const clusterInfo =
              warehouseId
                ? warehouseMap.get(
                    warehouseId
                  )
                : undefined;


            return {

              posting_number:
                posting
                  .posting_number
                ?? null,

              created_at:
                posting
                  .created_at
                ?? null,

              status:
                posting.status
                ?? null,

              warehouse_id:
                warehouseId
                || null,

              warehouse_name:
                posting
                  .analytics_data
                  ?.warehouse_name
                ?? null,

              cluster_id:
                clusterInfo
                  ?.cluster_id
                ?? null,

              cluster_name:
                clusterInfo
                  ?.cluster_name
                ?? null,

              products:
                (
                  posting.products
                  ?? []
                )
                  .map(
                    (
                      product
                    ) => ({
                      offer_id:
                        product
                          .offer_id
                        ?? null,

                      sku:
                        product.sku
                        ?? null,

                      quantity:
                        product
                          .quantity
                        ?? 0,

                      name:
                        product.name
                        ?? null,
                    })
                  ),

            };

          }
        );


    // ========================================================
    // 9. РЕЗУЛЬТАТ
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        message:
          "Продажи Ozon FBO успешно получены",

        testPeriod: {

          completedDays:
            3,

          timezone:
            "Europe/Moscow",

          dateFrom:
            range.dateFrom,

          dateTo:
            range.dateTo,

        },

        clusters: {

          clusterCount:
            clusters.length,

          warehousesMapped:
            warehouseMap.size,

        },

        postings: {

          received:
            postings.length,

          hasNext:
            Boolean(
              postingsResponse.has_next
            ),

          statusCounts,

        },

        unmappedWarehouses:
          Array.from(
            unmappedWarehouses
              .entries()
          )
            .map(
              (
                [
                  warehouse_id,
                  warehouse_name,
                ]
              ) => ({
                warehouse_id,
                warehouse_name,
              })
            ),

        sampleSalesByProductAndCluster:
          Array.from(
            salesAggregate
              .values()
          )
            .slice(
              0,
              30
            ),

        samplePostings,
      },
      {
        status: 200,
      }
    );


  } catch (error) {

    console.error(
      "Ozon sales test error:",
      error
    );


    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка получения продаж Ozon",
      },
      {
        status: 500,
      }
    );

  }

}
