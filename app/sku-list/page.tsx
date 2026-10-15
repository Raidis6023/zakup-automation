import Link
  from "next/link";

import {
  ArticleListIcon,
} from "../WorkspaceNavIcons";

import "./sku-list.css";


// ============================================================
// СТРАНИЦА
// ============================================================

export default function SkuListPage() {

  return (

    <main
      className=
        "page sku-list-page"
    >

      <div
        className=
          "container sku-list-container"
      >

        <header
          className=
            "header sku-list-header"
        >

          <div>

            <div
              className=
                "sku-list-eyebrow"
            >
              КАТАЛОГ / ОБЩИЙ СПИСОК
            </div>


            <h1>
              Список артикулов
            </h1>


            <p>
              Раздел создан.
              Содержимое и рабочую логику
              добавим следующим этапом.
            </p>

          </div>


          <div
            className=
              "header-actions sku-list-header-actions"
          >

            <Link
              href="/"

              className=
                "secondary-button sku-list-home-button"
            >
              Главная
            </Link>

          </div>

        </header>


        <section
          className=
            "sku-list-placeholder"
        >

          <div
            className=
              "sku-list-placeholder-icon"
          >
            <ArticleListIcon />
          </div>


          <div>

            <h2>
              Раздел подготовлен
            </h2>


            <p>
              Таблицы, данные и действия
              здесь пока намеренно не добавлены.
            </p>

          </div>

        </section>

      </div>

    </main>

  );

}
