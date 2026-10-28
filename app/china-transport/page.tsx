import Link
  from "next/link";
import Breadcrumbs from "../ui/Breadcrumbs";

import ThemeToggle
  from "../ThemeToggle";

import ChinaTransportClient
  from "../ChinaTransportClient";


export default function ChinaTransportPage() {

  return (

    <main className="page">

      <div className="container">


        <header className="header">

          <div>

            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>


            <h1 className="title">
              Китай — транспорт
            </h1>


            <p className="subtitle">

              Выбор контейнера или фуры
              по рассчитанной потребности.

            </p>

          </div>


          <div className="header-actions">

            <ThemeToggle />


            <Link
              href="/logistics-import"

              className=
                "secondary-button navigation-button"
            >
              Логистика
            </Link>


            <Link
              href="/responsible-storage-import"

              className=
                "secondary-button navigation-button"
            >
              ОХ
            </Link>


            <Breadcrumbs
              items={[
                { label: "Главная", href: "/" },
                { label: "Закуп", href: "/zakup" },
                { label: "Китай — транспорт", shortLabel: "Транспорт", href: "/china-transport" },
              ]}
            />

          </div>

        </header>


        <section className="summary-grid">


          <div className="card">

            <div className="card-label">
              Контейнер
            </div>

            <div className="big-number">
              68 м³
            </div>

            <div className="muted">
              Приоритетный транспорт
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Ручная зона
            </div>

            <div className="big-number">
              68–68,5
            </div>

            <div className="muted">
              Требует проверки
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Фура
            </div>

            <div className="big-number">
              90 / 100 м³
            </div>

            <div className="muted">
              После пересчёта на 70 дней
            </div>

          </div>


          <div className="card">

            <div className="card-label">
              Новинки
            </div>

            <div className="big-number">
              вручную
            </div>

            <div className="muted">
              Пока задаём объём в м³
            </div>

          </div>

        </section>


        <ChinaTransportClient />


      </div>

    </main>

  );

}
