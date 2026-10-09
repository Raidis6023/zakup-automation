
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
// Логика:
//
// draft
//   → кнопка только если заказ полностью готов
//
// любой следующий статус
//   → кнопка доступна постоянно
//
// В том числе:
// sent_to_ved
// ved_in_work
// production_confirmed
// in_transit
// arrived
// ============================================================

async function isExcelExportAvailable(
  orderId: string
) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

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
      apikey: supabaseSecretKey,
      Authorization:
        `Bearer ${supabaseSecretKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // ========================================================
    // 1. ПОЛУЧАЕМ СТАТУС ЗАКАЗА
    // ========================================================

    const orderResponse =
      await fetch(
        `${supabaseUrl}` +
          `/rest/v1/ved_orders` +
          `?id=eq.${encodeURIComponent(
            orderId
          )}` +
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

    // ========================================================
    // 2. ПОСЛЕ ЧЕРНОВИКА ЭКСПОРТ ДОСТУПЕН ВСЕГДА
    // ========================================================

    if (
      order.workflow_status !== "draft"
    ) {
      return true;
    }

    // ========================================================
    // 3. ДЛЯ ЧЕРНОВИКА ПРОВЕРЯЕМ ГОТОВНОСТЬ
    // ========================================================

    const readinessResponse =
      await fetch(
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

    const readiness =
      Array.isArray(readinessData)
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
// СТИЛЬ КНОПОК НАВИГАЦИИ
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

  // ==========================================================
  // EXCEL BUTTON
  // ==========================================================

  const excelExportAvailable =
    await isExcelExportAvailable(id);

  const excelExportUrl =
    `/api/ved-orders/` +
    `${encodeURIComponent(id)}` +
    `/excel`;

  return (
    <main className="page">
      <div className="container">

        {/* ====================================================
            HEADER
            ==================================================== */}

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

          {/* ==================================================
              КНОПКИ В ПРАВОЙ ЧАСТИ ШАПКИ

              1. Экспорт Excel
              2. ВЭД
              3. Главная

              Декоративные полосы отображаются
              общей оболочкой WorkSpace.
              ================================================== */}

          <div className="header-actions">

            {/* ================================================
                ЭКСПОРТ EXCEL

                В готовом draft появляется кнопка.

                После передачи заказа дальше
                остаётся доступной постоянно,
                включая статус arrived.
                ================================================ */}

            {excelExportAvailable && (
              <a
                href={excelExportUrl}
                className="secondary-button"
                style={headerButtonStyle}
                title="Экспортировать актуальный заказ в Excel"
              >
                Экспорт Excel
              </a>
            )}

            {/* ================================================
                ВОЗВРАТ В РАЗДЕЛ ВЭД
                ================================================ */}

            <Link
              href="/ved"
              className="secondary-button"
              style={headerButtonStyle}
              title="Вернуться в раздел ВЭД"
            >
              ВЭД
            </Link>

            {/* ================================================
                ВОЗВРАТ НА ГЛАВНУЮ WORKSPACE
                ================================================ */}

            <Link
              href="/"
              className="secondary-button"
              style={headerButtonStyle}
              title="Перейти на главную страницу"
            >
              Главная
            </Link>

          </div>
        </header>

        {/* ====================================================
            TAKE IN WORK
            ==================================================== */}

        <VedTakeInWorkPanel
          orderId={id}
        />

        {/* ====================================================
            PRODUCTION
            ==================================================== */}

        <VedProductionPanel
          orderId={id}
        />

        {/* ====================================================
            ORDER DETAILS
            ==================================================== */}

        <VedOrderDetailClient
          orderId={id}
        />

      </div>
    </main>
  );
}
