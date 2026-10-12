
import Link from "next/link";

import VedTakeInWorkPanel
  from "../../VedTakeInWorkPanel";

import VedProductionPanel
  from "../../VedProductionPanel";

import VedOrderDetailClient
  from "../../VedOrderDetailClient";

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
//
// draft -> разрешён только для полностью готового заказа
// прочие статусы -> экспорт разрешён
// ============================================================

async function isExcelExportAvailable(
  orderId: string
): Promise<boolean> {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error(
        "Не настроены переменные Supabase для проверки Excel"
      );
      return false;
    }

    const headers = {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // 1. Получаем статус заказа.
    const orderResponse = await fetch(
      `${supabaseUrl}` +
        `/rest/v1/ved_orders` +
        `?id=eq.${encodeURIComponent(orderId)}` +
        `&select=workflow_status`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    );

    if (!orderResponse.ok) {
      console.error(
        "Не удалось получить статус заказа для Excel:",
        await orderResponse.text()
      );
      return false;
    }

    const orders: OrderState[] =
      await orderResponse.json();

    const order = orders[0];

    if (!order) {
      return false;
    }

    // 2. После статуса draft экспорт доступен всегда.
    if (order.workflow_status !== "draft") {
      return true;
    }

    // 3. Для draft проверяем готовность.
    const readinessResponse = await fetch(
      `${supabaseUrl}` +
        `/rest/v1/rpc/get_ved_order_handoff_readiness`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_order_id: orderId,
        }),
        cache: "no-store",
      }
    );

    if (!readinessResponse.ok) {
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

    const readiness = Array.isArray(readinessData)
      ? readinessData[0]
      : readinessData;

    return readiness?.ready === true;
  } catch (error) {
    console.error(
      "Ошибка проверки доступности Excel:",
      error
    );
    return false;
  }
}

// ============================================================
// СТИЛИ НАВИГАЦИОННЫХ КНОПОК
// ============================================================

const headerButtonStyle = {
  display: "inline-flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  textAlign: "center" as const,
  textDecoration: "none" as const,
  whiteSpace: "nowrap" as const,
};

// ============================================================
// PAGE
// ============================================================

export default async function VedOrderPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const excelExportAvailable =
    await isExcelExportAvailable(id);

  const excelExportUrl =
    `/api/ved-orders/` +
    `${encodeURIComponent(id)}` +
    `/excel`;

  return (
    <main className="page">
      <div className="container">
        {/* ШАПКА С НАВИГАЦИЕЙ */}
        <header className="header">
          <div>
            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>

            <h1 className="title">
              Заказ в Китай
            </h1>

            <div className="subtitle">
              Формирование и контроль заказа ВЭД.
            </div>
          </div>

          <div className="header-actions">
            <Link
              href="/"
              className="secondary-button"
              style={headerButtonStyle}
              title="Перейти на главную страницу"
            >
              Главная
            </Link>

            <Link
              href="/ved"
              className="secondary-button"
              style={headerButtonStyle}
              title="Вернуться в раздел ВЭД"
            >
              ВЭД
            </Link>
          </div>
        </header>

        {/* ВЗЯТЬ В РАБОТУ */}
        <VedTakeInWorkPanel orderId={id} />

        {/* ПРОИЗВОДСТВО */}
        <VedProductionPanel orderId={id} />

        {/* ДЕТАЛИЗАЦИЯ ЗАКАЗА И ЭКСПОРТ EXCEL */}
        <VedOrderDetailClient
          orderId={id}
          excelExportUrl={excelExportUrl}
          excelExportAvailable={excelExportAvailable}
        />
      </div>
    </main>
  );
}
