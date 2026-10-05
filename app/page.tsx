import Link from "next/link";

import HomeThemeToggle from "./HomeThemeToggle";

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


function BellIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
      />

      <path
        d="M10 21h4"
      />
    </svg>
  );

}


function CalendarIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
      />

      <path
        d="M16 3v4M8 3v4M3 10h18"
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
        d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L20 8H7"
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
        d="M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21"
      />

      <path
        d="M12 3C9.6 5.5 8.4 8.5 8.4 12S9.6 18.5 12 21"
      />
    </svg>
  );

}


function ChevronIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="m7 9 5 5 5-5"
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

            <span className="home-workspace-icon">
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

            <span className="home-workspace-icon">
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
                alt=""
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
                alt=""
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
                alt=""
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


          {/* RIGHT SIDE */}

          <div className="home-topbar-right">


            {/* NOTIFICATIONS */}

            <button
              type="button"
              className="home-icon-button"
              aria-label="Уведомления"
            >

              <BellIcon />

              <span className="home-notification-badge">
                3
              </span>

            </button>


            {/* CALENDAR */}

            <button
              type="button"
              className="home-icon-button"
              aria-label="Календарь"
            >
              <CalendarIcon />
            </button>


            <div className="home-topbar-divider" />


            {/* THEME */}

            <HomeThemeToggle />


            <div className="home-topbar-divider" />


            {/* PROFILE */}

            <button
              type="button"
              className="home-profile"
            >

              <span className="home-avatar">
                ИП
              </span>


              <span className="home-profile-text">

                <strong>
                  Иван Петров
                </strong>

                <span>
                  Аналитик
                </span>

              </span>


              <span className="home-profile-chevron">
                <ChevronIcon />
              </span>

            </button>

          </div>

        </header>


        {/* ====================================================
            CONTENT
        ==================================================== */}

        <section className="home-content">


          {/* TITLE */}

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


          {/* PLACEHOLDERS */}

          <div className="home-placeholder-grid">

            <div className="home-placeholder-card">

              <div className="home-placeholder-head">

                <span className="home-placeholder-circle" />

                <div>
                  <span className="home-placeholder-line short" />
                  <span className="home-placeholder-line tiny" />
                </div>

              </div>

              <span className="home-placeholder-line" />
              <span className="home-placeholder-line" />

            </div>


            <div className="home-placeholder-card">

              <div className="home-placeholder-head">

                <span className="home-placeholder-circle" />

                <div>
                  <span className="home-placeholder-line short" />
                  <span className="home-placeholder-line tiny" />
                </div>

              </div>

              <span className="home-placeholder-line" />
              <span className="home-placeholder-line" />

            </div>


            <div className="home-placeholder-card">

              <div className="home-placeholder-head">

                <span className="home-placeholder-circle" />

                <div>
                  <span className="home-placeholder-line short" />
                  <span className="home-placeholder-line tiny" />
                </div>

              </div>

              <span className="home-placeholder-line" />
              <span className="home-placeholder-line" />

            </div>

          </div>


          <div className="home-placeholder-wide">

            <div className="home-placeholder-head">

              <span className="home-placeholder-circle" />

              <div>
                <span className="home-placeholder-line short" />
                <span className="home-placeholder-line tiny" />
              </div>

            </div>

            <span className="home-placeholder-line" />
            <span className="home-placeholder-line" />
            <span className="home-placeholder-line" />

          </div>

        </section>

      </div>

    </main>

  );

}
