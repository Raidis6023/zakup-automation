import Link from "next/link";

import HomeHeaderActions
  from "./HomeHeaderActions";

import "./home.css";


// ============================================================
// ICONS
// ============================================================

function SearchIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
      />

      <path
        d="m20 20-4.2-4.2"
      />
    </svg>
  );

}


function CartIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="
          M3 4h2
          l2.1 10.1
          a2 2 0 0 0 2 1.6
          h7.7
          a2 2 0 0 0 2-1.5
          L20 8H7
        "
      />

      <circle
        cx="10"
        cy="20"
        r="1.3"
      />

      <circle
        cx="17"
        cy="20"
        r="1.3"
      />
    </svg>
  );

}


function GlobeIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path
        d="M3 12h18"
      />

      <path
        d="
          M12 3
          c2.4 2.5
          3.6 5.5
          3.6 9
          S14.4 18.5
          12 21
        "
      />

      <path
        d="
          M12 3
          C9.6 5.5
          8.4 8.5
          8.4 12
          S9.6 18.5
          12 21
        "
      />
    </svg>
  );

}


// ============================================================
// HOME
// ============================================================

export default function Home() {

  return (

    <main className="home-shell">


      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside className="home-sidebar">

        <nav
          className="home-workspaces"
          aria-label="Рабочие пространства"
        >

          <Link
            href="/zakup"
            className="home-workspace-link"
          >

            <span
              className="
                home-workspace-icon
              "
            >
              <CartIcon />
            </span>

            <span>
              Закуп
            </span>

          </Link>


          <Link
            href="/ved"
            className="home-workspace-link"
          >

            <span
              className="
                home-workspace-icon
              "
            >
              <GlobeIcon />
            </span>

            <span>
              ВЭД
            </span>

          </Link>


          <Link
            href="/ozon"
            className="home-workspace-link"
          >

            <span className="home-brand-icon">

              <img
                src="/logos/ozon.png"
                alt="Ozon"

                className="
                  home-brand-image
                "
              />

            </span>

            <span>
              Ozon
            </span>

          </Link>


          <Link
            href="/wildberries"
            className="home-workspace-link"
          >

            <span className="home-brand-icon">

              <img
                src="/logos/wildberries.png"
                alt="Wildberries"

                className="
                  home-brand-image
                "
              />

            </span>

            <span>
              Wildberries
            </span>

          </Link>


          <Link
            href="/yandex-market"
            className="home-workspace-link"
          >

            <span className="home-brand-icon">

              <img
                src="/logos/yandex-market.png"
                alt="Яндекс Маркет"

                className="
                  home-brand-image
                "
              />

            </span>

            <span>
              Яндекс Маркет
            </span>

          </Link>

        </nav>

      </aside>


      {/* ======================================================
          MAIN
      ====================================================== */}

      <div className="home-main">


        {/* ====================================================
            TOP BAR
        ==================================================== */}

        <header className="home-topbar">


          <div className="home-search">

            <span className="home-search-icon">
              <SearchIcon />
            </span>


            <input
              type="text"

              placeholder="
                Поиск по товарам, SKU,
                документам, разделам...
              "

              aria-label="Поиск"
            />


            <span
              className="
                home-search-shortcut
              "
            >
              Ctrl + K
            </span>

          </div>


          <HomeHeaderActions />

        </header>


        {/* ====================================================
            CONTENT
        ==================================================== */}

        <section className="home-content">


          <div className="home-title-row">

            <div>

              <h1>
                Главная страница
              </h1>


              <p>
                Основные рабочие пространства
                и быстрый доступ
                к разделам системы
              </p>

            </div>


            <div
              className="home-decoration"
              aria-hidden="true"
            >

              <span />
              <span />
              <span />
              <span />

            </div>

          </div>


          <div
            className="home-empty-space"
          />

        </section>

      </div>

    </main>

  );

}
