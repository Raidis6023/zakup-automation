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
// HEADER DECORATION
// ============================================================

function HeaderDecoration() {

  return (

    <div
      className="home-decoration"
      aria-hidden="true"
    >

      <svg
        viewBox="0 0 560 72"
        role="presentation"
      >

        <defs>

          {/* ПЕРВЫЙ БЛОК */}

          <linearGradient
            id="homeDecor1"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor="#078bf2"
            />

            <stop
              offset="100%"
              stopColor="#159bf0"
            />
          </linearGradient>


          {/* ВТОРОЙ БЛОК */}

          <linearGradient
            id="homeDecor2"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor="#4cb2ef"
            />

            <stop
              offset="100%"
              stopColor="#82c9f3"
            />
          </linearGradient>


          {/* ТРЕТИЙ БЛОК */}

          <linearGradient
            id="homeDecor3"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor="#92d2f4"
            />

            <stop
              offset="100%"
              stopColor="#c7e7f8"
            />
          </linearGradient>


          {/* ЧЕТВЁРТЫЙ БЛОК */}

          <linearGradient
            id="homeDecor4"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor="#9cb8cc"
            />

            <stop
              offset="55%"
              stopColor="#8099ad"
            />

            <stop
              offset="100%"
              stopColor="#657b8d"
            />
          </linearGradient>

        </defs>


        {/* ==================================================
            1 — КОРОТКИЙ
        =================================================== */}

        <path
          d="
            M 15 53

            L 38 18

            Q 41 14
              47 14

            L 97 14

            Q 102 14
              99 18

            L 76 53

            Q 73 58
              67 58

            L 19 58

            Q 12 58
              15 53

            Z
          "
          fill="url(#homeDecor1)"
        />


        {/* ==================================================
            2
        =================================================== */}

        <path
          d="
            M 108 53

            L 131 18

            Q 134 14
              140 14

            L 229 14

            Q 234 14
              231 18

            L 208 53

            Q 205 58
              199 58

            L 112 58

            Q 105 58
              108 53

            Z
          "
          fill="url(#homeDecor2)"
        />


        {/* ==================================================
            3
        =================================================== */}

        <path
          d="
            M 240 53

            L 263 18

            Q 266 14
              272 14

            L 405 14

            Q 410 14
              407 18

            L 384 53

            Q 381 58
              375 58

            L 244 58

            Q 237 58
              240 53

            Z
          "
          fill="url(#homeDecor3)"
        />


        {/* ==================================================
            4
        =================================================== */}

        <path
          d="
            M 416 53

            L 439 18

            Q 442 14
              448 14

            L 549 14

            Q 554 14
              551 18

            L 528 53

            Q 525 58
              519 58

            L 420 58

            Q 413 58
              416 53

            Z
          "
          fill="url(#homeDecor4)"
        />

      </svg>

    </div>

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
              className="home-workspace-icon"
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
              className="home-workspace-icon"
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
                className="home-brand-image"
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
                className="home-brand-image"
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
                className="home-brand-image"
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
              placeholder="Поиск по товарам, SKU, документам, разделам..."
              aria-label="Поиск"
            />


            <span className="home-search-shortcut">
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
                и быстрый доступ к разделам системы
              </p>

            </div>


            <HeaderDecoration />

          </div>


          <div className="home-empty-space" />

        </section>

      </div>

    </main>

  );

}
