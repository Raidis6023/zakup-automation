import Link
from "next/link";

import ThemeToggle
from "../../ThemeToggle";

import VedTakeInWorkPanel
from "../../VedTakeInWorkPanel";

import VedProductionPanel
from "../../VedProductionPanel";

import VedOrderDetailClient
from "../../VedOrderDetailClient";


// ============================================================
// PAGE
// ============================================================

export default async function VedOrderPage(
  {
    params,
  }:
  {
    params:
      Promise<{
        id: string;
      }>;
  }
) {

  const {
    id,
  } =
    await params;


  return (

    <main className="page">

      <div className="container">


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

            <ThemeToggle />


            <Link
              href="/china-transport"
              className="navigation-button"
            >
              ← Китай — транспорт
            </Link>

          </div>

        </header>


        {/* ====================================================
            VED TAKES ORDER
            ==================================================== */}

        <VedTakeInWorkPanel
          orderId={
            id
          }
        />


        {/* ====================================================
            PRODUCTION
            ==================================================== */}

        <VedProductionPanel
          orderId={
            id
          }
        />


        {/* ====================================================
            ORDER DETAILS
            ==================================================== */}

        <VedOrderDetailClient
          orderId={
            id
          }
        />


      </div>

    </main>

  );

}
