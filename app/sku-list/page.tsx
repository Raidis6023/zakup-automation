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
        "sku-list-page"
    >

      <div
        className=
          "sku-list-container"
      >

        <header
          className=
            "sku-list-header"
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
