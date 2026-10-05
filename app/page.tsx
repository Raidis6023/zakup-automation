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
// DECORATION
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


          {/* ================================================
              FIRST
          ================================================= */}

          <linearGradient
            id="homeRibbonFirst"
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
          >
            <stop
              offset="0%"
              stopColor="#0789f3"
            />

            <stop
              offset="55%"
              stopColor="#119af2"
            />

            <stop
              offset="100%"
              stopColor="#39aff4"
            />
          </linearGradient>


          {/* ================================================
              SECOND
          ================================================= */}

          <linearGradient
            id="homeRibbonSecond"
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
          >
            <stop
              offset="0%"
              stopColor="#47b2f4"
              stopOpacity="0.98"
            />

            <stop
              offset="45%"
              stopColor="#74c4f5"
              stopOpacity="0.94"
            />

            <stop
              offset="100%"
              stopColor="#a6dcf9"
              stopOpacity="0.82"
            />
          </linearGradient>


          {/* ================================================
              THIRD
          ================================================= */}

          <linearGradient
            id="homeRibbonThird"
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
          >
            <stop
              offset="0%"
              stopColor="#8ccff4"
              stopOpacity="0.9"
            />

            <stop
              offset="42%"
              stopColor="#acdff8"
              stopOpacity="0.82"
            />

            <stop
              offset="78%"
              stopColor="#d0ebfb"
              stopOpacity="0.63"
            />

            <stop
              offset="100%"
              stopColor="#e4f3fc"
              stopOpacity="0.4"
            />
          </linearGradient>


          {/* ================================================
              FOURTH
          ================================================= */}

          <linearGradient
            id="homeRibbonFourth"
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
          >
            <stop
              offset="0%"
              stopColor="#cbe9fa"
              stopOpacity="0.52"
            />

            <stop
              offset="36%"
              stopColor="#d9effb"
              stopOpacity="0.4"
            />

            <stop
              offset="72%"
              stopColor="#e8f6fd"
              stopOpacity="0.18"
            />

            <stop
              offset="100%"
              stopColor="#ffffff"
              stopOpacity="0"
            />
          </linearGradient>


          {/* ================================================
              LIGHT SOFTNESS
          ================================================= */}

          <filter
            id="homeRibbonSoftGlow"
            x="-20%"
            y="-60%"
            width="140%"
            height="220%"
          >
            <feGaussianBlur
              stdDeviation="7"
            />
          </filter>


          <linearGradient
            id="homeRibbonGlow"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor="#149cf1"
              stopOpacity="0.12"
            />

            <stop
              offset="45%"
              stopColor="#83cdf6"
              stopOpacity="0.12"
            />

            <stop
              offset="100%"
              stopColor="#dff2fc"
              stopOpacity="0"
            />
          </linearGradient>

        </defs>


        {/* ==================================================
            SOFT BACKGROUND GLOW
        =================================================== */}

        <path
          d="
            M 20 55
            L 55 15
            L 535 15
            L 498 55
            Z
          "
          fill="url(#homeRibbonGlow)"
          filter="url(#homeRibbonSoftGlow)"
        />


        {/* ==================================================
            FIRST SHORT RIBBON
        =================================================== */}

        <path
          d="
            M 14 54

            L 43 17

            Q 46 13
              51 13

            L 91 13

            Q 95 13
              92 17

            L 63 54

            Q 60 58
              55 58

            L 18 58

            Q 11 58
              14 54

            Z
          "
          fill="url(#homeRibbonFirst)"
        />


        {/* ==================================================
            SECOND RIBBON
        =================================================== */}

        <path
          d="
            M 63 54

            L 95 14

            Q 98 10
              104 10

            L 211 10

            Q 217 10
              213 15

            L 182 54

            Q 179 58
              173 58

            L 67 58

            Q 60 58
              63 54

            Z
          "
          fill="url(#homeRibbonSecond)"
        />


        {/* ==================================================
            THIRD LARGE RIBBON
        =================================================== */}

        <path
          d="
            M 165 54

            L 198 14

            Q 202 9
              209 9

            L 397 9

            Q 404 9
              400 14

            L 370 53

            Q 366 58
              358 58

            L 170 58

            Q 162 58
              165 54

            Z
          "
          fill="url(#homeRibbonThird)"
        />


        {/* ==================================================
            FOURTH FADING RIBBON
        =================================================== */}

        <path
          d="
            M 350 54

            L 383 15

            Q 387 10
              394 10

            L 546 10

            Q 552 10
              548 15

            L 518 53

            Q 514 58
              506 58

            L 355 58

            Q 347 58
              350 54

            Z
          "
          fill="url(#homeRibbonFourth)"
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


          {/* SEARCH */}

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


          {/* ACTIONS */}

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
