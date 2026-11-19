import PageHeader from "../../ui/PageHeader";
import VedTakeInWorkPanel
  from "../../VedTakeInWorkPanel";

import VedProductionPanel
  from "../../VedProductionPanel";

import VedOrderDetailClient
  from "../../VedOrderDetailClient";

import AutoVedOrderPhotos from "./AutoVedOrderPhotos";


// ============================================================
// TYPES
// ============================================================

type OrderState = {
  workflow_status: string;
};


type HandoffReadiness = {
  ready?: boolean;
};


// ============================================================
// EXCEL AVAILABILITY
// ============================================================

async function isExcelExportAvailable(
  orderId: string
):
Promise<boolean> {

  try {

    const supabaseUrl =
      (process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);


    const supabaseSecretKey =
      process.env
        .SUPABASE_SECRET_KEY;


    if (
      !supabaseUrl ||
      !supabaseSecretKey
    ) {

      console.error(
        "Не настроены переменные Supabase для проверки Excel"
      );

      return false;

    }


    const headers = {
      apikey:
        supabaseSecretKey,

      Authorization:
        `Bearer ${supabaseSecretKey}`,

      Accept:
        "application/json",

      "Content-Type":
        "application/json",
    };


    const orderResponse =
      await fetch(
        `${supabaseUrl}` +
        `/rest/v1/ved_orders` +
        `?id=eq.${encodeURIComponent(orderId)}` +
        `&select=workflow_status`,
        {
          method:
            "GET",

          headers,

          cache:
            "no-store",
        }
      );


    if (
      !orderResponse.ok
    ) {

      console.error(
        "Не удалось получить статус заказа для Excel:",
        await orderResponse.text()
      );

      return false;

    }


    const orders:
      OrderState[] =
        await orderResponse.json();


    const order =
      orders[0];


    if (
      !order
    ) {

      return false;

    }


    if (
      order.workflow_status !==
      "draft"
    ) {

      return true;

    }


    const readinessResponse =
      await fetch(
        `${supabaseUrl}` +
        `/rest/v1/rpc/get_ved_order_handoff_readiness`,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify({
              p_order_id:
                orderId,
            }),

          cache:
            "no-store",
        }
      );


    if (
      !readinessResponse.ok
    ) {

      console.error(
        "Не удалось проверить готовность заказа для Excel:",
        await readinessResponse.text()
      );

      return false;

    }


    const readinessData:
      | HandoffReadiness
      | HandoffReadiness[] =
        await readinessResponse.json();


    const readiness =
      Array.isArray(
        readinessData
      )

        ? readinessData[0]

        : readinessData;


    return (
      readiness?.ready ===
      true
    );

  } catch (
    error
  ) {

    console.error(
      "Ошибка проверки доступности Excel:",
      error
    );


    return false;

  }

}


// ============================================================
// CHECK FOR MISSING OZON PHOTOS
// Only existing-product order items without saved photos need API requests.
// ============================================================

async function hasMissingVedOrderPhotos(orderId: string): Promise<boolean> {
  const supabaseUrl = (process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("Supabase не настроен для проверки фотографий ВЭД");
    return false;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/ved_order_items` +
        `?ved_order_id=eq.${encodeURIComponent(orderId)}` +
        "&item_kind=eq.existing" +
        "&photo_url=is.null" +
        "&select=id&limit=1",
      {
        headers: {
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "Ошибка проверки отсутствующих фотографий ВЭД",
        response.status
      );
      return false;
    }

    const missing: Array<{ id: string }> = await response.json();
    return missing.length > 0;
  } catch (error) {
    console.error("Не удалось проверить фотографии заказа ВЭД", error);
    return false;
  }
}


// ============================================================
// PAGE
// ============================================================

export default async function VedOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {

  const {
    id,
  } =
    await params;


  const [excelExportAvailable, needsOzonPhotos] = await Promise.all([
    isExcelExportAvailable(id),
    hasMissingVedOrderPhotos(id),
  ]);


  const excelExportUrl =
    `/api/ved-orders/` +
    `${encodeURIComponent(id)}` +
    `/excel`;


  return (

    <main
      className="page"
    >

      <div
        className="container"
      >

        {/* ====================================================
            ШАПКА С КОНТЕКСТНОЙ НАВИГАЦИЕЙ
            ==================================================== */}

        <PageHeader
          title="Заказ в Китай"
          eyebrow="СИСТЕМА ЗАКУПА"
          description="Формирование и контроль заказа ВЭД."
          actions={needsOzonPhotos ? <AutoVedOrderPhotos orderId={id} /> : null}
        />


        {/* ====================================================
            ВЗЯТЬ В РАБОТУ
            ==================================================== */}

        <VedTakeInWorkPanel
          orderId={
            id
          }
        />


        {/* ====================================================
            ПРОИЗВОДСТВО
            ==================================================== */}

        <VedProductionPanel
          orderId={
            id
          }
        />


        {/* ====================================================
            ДЕТАЛИЗАЦИЯ ЗАКАЗА И ЭКСПОРТ EXCEL
            ==================================================== */}

        <VedOrderDetailClient
          orderId={
            id
          }

          excelExportUrl={
            excelExportUrl
          }

          excelExportAvailable={
            excelExportAvailable
          }
        />

      </div>

    </main>

  );

}
