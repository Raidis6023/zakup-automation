import Link from "next/link";

import ThemeToggle
  from "../ThemeToggle";

import OzonStockSyncClient
  from "../OzonStockSyncClient";


// ============================================================
// СТРАНИЦА OZON
// ============================================================

export default function OzonPage() {

  return (

    <main className="page">

      <div className="container">


        {/* ===================================
            HEADER
            =================================== */}

        <header className="header">

          <div>

            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>


            <h1 className="title">
              Ozon — синхронизация
            </h1>


            <p className="subtitle">

              Получение реальных данных
              кабинета Ozon и запись
              снимков в Supabase.

            </p>

          </div>


          <div className="header-actions">

            <ThemeToggle />


            <Link
              href="/stock-import"

              className=
                "secondary-button navigation-button"
            >
              Остатки склада
            </Link>


            <Link
              href="/"

              className=
                "secondary-button navigation-button"
            >
              ← Расчёт Китая
            </Link>

          </div>

        </header>


        {/* ===================================
            ИНФОРМАЦИЯ
            =================================== */}

        <section className="summary-grid">


          <div className="card">

            <div className="card-label">
              Источник
            </div>

            <div className="big-number">
              Ozon API
            </div>

            <div className="muted">
              Seller API
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Режим
            </div>

            <div className="big-number">
              FBO
            </div>

            <div className="muted">
              Остатки по кластерам
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Товаров
            </div>

            <div className="big-number">
              ~363
            </div>

            <div className="muted">
              Фактическое число
              берём из API
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Запись
            </div>

            <div className="big-number">
              Снимок
            </div>

            <div className="muted">
              По дате синхронизации
            </div>

          </div>

        </section>


        {/* ===================================
            ПРЕДУПРЕЖДЕНИЕ
            =================================== */}

        <section className="section">

          <h2 className="section-title">
            Безопасный режим
          </h2>


          <div className="reason-text">

            Сначала система должна
            полностью получить данные
            из Ozon.

          </div>


          <div className="reason-text">

            Только после успешного
            завершения всех запросов
            новый снимок записывается
            в Supabase.

          </div>


          <div className="reason-text">

            Ошибка API не считается
            нулевым остатком.

          </div>

        </section>


        {/* ===================================
            СИНХРОНИЗАЦИЯ
            =================================== */}

        <OzonStockSyncClient />


      </div>

    </main>

  );
}
