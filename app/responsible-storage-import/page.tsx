import PageHeader from "../ui/PageHeader";


import ResponsibleStorageImportClient
  from "../ResponsibleStorageImportClient";


export default function ResponsibleStorageImportPage() {

  return (

    <main className="page">

      <div className="container">


        <PageHeader
          title="Ответственное хранение"
          eyebrow="СИСТЕМА ЗАКУПА"
          description="Импорт остатков ОХ с сохранением владельца товара."
          showThemeToggle
        />


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
