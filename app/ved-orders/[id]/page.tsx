import Link
from "next/link";

import ThemeToggle
from "../../ThemeToggle";

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
            ORDER
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
