import Link
  from "next/link";

import ThemeToggle
  from "../ThemeToggle";

import ResponsibleStorageImportClient
  from "../ResponsibleStorageImportClient";


export default function ResponsibleStorageImportPage() {

  return (

    <main className="page">

      <div className="container">


        <header className="header">

          <div>

            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>


            <h1 className="title">
              Ответственное хранение
            </h1>


            <p className="subtitle">

              Импорт остатков ОХ
              с сохранением владельца товара.

            </p>

          </div>


          <div className="header-actions">

            <ThemeToggle />


            <Link
              href="/stock-import"

              className=
                "secondary-button navigation-button"
            >
              Основной склад
            </Link>


            <Link
              href="/logistics-import"

              className=
                "secondary-button navigation-button"
            >
              Логистика
            </Link>


            <Link
              href="/ozon"

              className=
                "secondary-button navigation-button"
            >
              Ozon
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


        <section className="summary-grid">


          <div className="card">

            <div className="card-label">
              Источник
            </div>

            <div className="big-number">
              ОХ
            </div>

            <div className="muted">
              Excel-отчёт
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Остаток
            </div>

            <div className="big-number">
              Конечный
            </div>

            <div className="muted">
              На дату отчёта
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Детализация
            </div>

            <div className="big-number">
              Владелец
            </div>

            <div className="muted">
              Не теряем источник товара
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Пополнение МП
            </div>

            <div className="big-number">
              Приоритет
            </div>

            <div className="muted">
              ОХ расходуем первым
            </div>

          </div>

        </section>


        <section className="section">

          <h2 className="section-title">
            Правило будущего пополнения
          </h2>


          <div className="reason-text">

            Если товар одновременно есть
            на ответственном хранении
            и на основном складе,
            сначала используем остаток ОХ.

          </div>


          <div className="reason-text">

            После исчерпания ОХ
            недостающее количество
            берём с основного склада.

          </div>

        </section>


        <ResponsibleStorageImportClient />


      </div>

    </main>

  );

}
