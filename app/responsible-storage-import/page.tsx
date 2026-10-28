import Breadcrumbs from "../ui/Breadcrumbs";

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
            <Breadcrumbs
              items={[
                { label: "Главная", href: "/" },
                { label: "Закуп", href: "/zakup" },
                { label: "Остатки", href: "/stocks" },
                { label: "Ответственное хранение", shortLabel: "ОХ", href: "/responsible-storage-import" },
              ]}
            />
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
