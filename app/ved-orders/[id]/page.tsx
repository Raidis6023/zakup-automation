import Link
from "next/link";

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


type PageSearchParams = {
  from?:
    string
    |
    string[];
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
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;


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
// Only draft order items without saved photos need API requests.
// ============================================================

async function hasMissingVedOrderPhotos(orderId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
// СТИЛИ НАВИГАЦИОННЫХ КНОПОК
// ============================================================

const headerButtonStyle = {
  display:
    "inline-flex" as const,

  alignItems:
    "center" as const,

  justifyContent:
    "center" as const,

  textAlign:
    "center" as const,

  textDecoration:
    "none" as const,

  whiteSpace:
    "nowrap" as const,
};


// ============================================================
// PAGE
// ============================================================

export default async function VedOrderPage({
  params,
  searchParams,
}: {
  params:
    Promise<{
      id: string;
    }>;

  searchParams:
    Promise<PageSearchParams>;
}) {

  const {
    id,
  } =
    await params;


  const resolvedSearchParams =
    await searchParams;


  const rawSource =
    Array.isArray(
      resolvedSearchParams.from
    )

      ? resolvedSearchParams.from[0]

      : resolvedSearchParams.from;


  const openedFromZakup =
    rawSource ===
    "zakup";


  const sectionHref =
    openedFromZakup
      ? "/zakup"
      : "/ved";


  const sectionLabel =
    openedFromZakup
      ? "Закуп"
      : "ВЭД";


  const sectionTitle =
    openedFromZakup
      ? "Вернуться в раздел Закуп"
      : "Вернуться в раздел ВЭД";


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

        <header
          className="header"
        >

          <div>

            <div
              className="small-label"
            >
              СИСТЕМА ЗАКУПА
            </div>


            <h1
              className="title"
            >
              Заказ в Китай
            </h1>


            <div
              className="subtitle"
            >
              Формирование и контроль заказа ВЭД.
            </div>

          </div>


          <div
            className="header-actions"
          >

            {needsOzonPhotos ? <AutoVedOrderPhotos orderId={id} /> : null}

            <Link
              href="/"
              className="secondary-button"
              style={
                headerButtonStyle
              }
              title="Перейти на главную страницу"
            >
              Главная
            </Link>


            <Link
              href={
                sectionHref
              }
              className="secondary-button"
              style={
                headerButtonStyle
              }
              title={
                sectionTitle
              }
            >
              {
                sectionLabel
              }
            </Link>

          </div>

        </header>


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
