

import ThemeToggle
  from "../ThemeToggle";

import LogisticsImportClient
  from "../LogisticsImportClient";


// ============================================================
// ИМПОРТ ЛОГИСТИЧЕСКИХ ДАННЫХ
// ============================================================

export default function LogisticsImportPage() {

  return (

    <main className="page">

      <div className="container">


        <header className="header">

          <div>

            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>


            <h1 className="title">
              Импорт логистики
            </h1>


            <p className="subtitle">

              Вложимость и объём
              транспортных коробок.

            </p>

          </div>


          <div className="header-actions">
            <ThemeToggle />
            
          </div>

        </header>


        <section className="summary-grid">


          <div className="card">

            <div className="card-label">
              Сопоставление
            </div>

            <div className="big-number">
              Артикул
            </div>

            <div className="muted">
              Точное совпадение
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Вложимость
            </div>

            <div className="big-number">
              шт./короб
            </div>

            <div className="muted">
              Целое число
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Объём
            </div>

            <div className="big-number">
              м³
            </div>

            <div className="muted">
              Одна транспортная коробка
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Источник
            </div>

            <div className="big-number">
              Packing list
            </div>

            <div className="muted">
              Упаковочные листы
            </div>

          </div>

        </section>


        <LogisticsImportClient />


      </div>

    </main>

  );

}
