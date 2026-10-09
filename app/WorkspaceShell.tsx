
"use client";

import Link from "next/link";

import type { ReactNode } from "react";

import HomeHeaderActions from "./HomeHeaderActions";

import WorkspaceDecoration from "./WorkspaceDecoration";

import "./home.css";
import "./workspace-shell.css";

// ============================================================
// ИКОНКИ
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

      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
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

      <path d="M3 12h18" />

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
// ТИПЫ
// ============================================================

type WorkspaceShellProps = {
  children: ReactNode;
  module?: boolean;
};

// ============================================================
// ОБЩАЯ ОБОЛОЧКА WORKSPACE
// ============================================================

export default function WorkspaceShell({
  children,
  module = false,
}: WorkspaceShellProps) {
  return (
    <div className="home-shell">

      {/* ==========================================
          ЛЕВОЕ МЕНЮ
          ========================================== */}

      <aside className="home-sidebar">

        {/* ЛОГОТИП */}

        <div className="home-company-logo">
          <img
            src="/logos/babushkina-marketplace.png"
            alt="ИП Бабушкина Маркетплейс"
            className="home-company-logo-image"
          />
        </div>

        {/* РАЗДЕЛЫ */}

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

      {/* ==========================================
          ОСНОВНАЯ ЧАСТЬ WORKSPACE
          ========================================== */}

      <div className="home-main">

        {/* ВЕРХНЯЯ ПАНЕЛЬ */}

        <header className="home-topbar">

          {/* ПОИСК */}

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

          {/* УВЕДОМЛЕНИЯ, КАЛЕНДАРЬ,
              ТЕМА И ПРОФИЛЬ */}

          <HomeHeaderActions />

        </header>

        {/* ======================================
            РАБОЧАЯ ОБЛАСТЬ
            ====================================== */}

        <div
          className={
            `home-content workspace-content${
              module
                ? " workspace-content--module"
                : ""
            }`
          }
        >

          {/* ДЕКОРАТИВНЫЕ ПОЛОСЫ
              ВО ВНУТРЕННИХ РАЗДЕЛАХ */}

          {module ? (
            <div className="workspace-corner-decoration">
              <WorkspaceDecoration />
            </div>
          ) : null}

          {/* СОДЕРЖИМОЕ ВЫБРАННОЙ СТРАНИЦЫ */}

          {children}

        </div>

      </div>

    </div>
  );
}
