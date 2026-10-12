"use client";

import Link
  from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import HomeHeaderActions
  from "./HomeHeaderActions";

import WorkspaceDecoration
  from "./WorkspaceDecoration";

import {
  EmployeesIcon,
  ProcurementIcon,
  VedIcon,
} from "./WorkspaceNavIcons";

import "./home.css";
import "./workspace-shell.css";
import "./sidebar-collapse.css";


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


function AdminHomeIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="
          M12 3
          19 6
          v5
          c0 4.8-2.8 8-7 10
          -4.2-2-7-5.2-7-10V6z
        "
      />


      <path
        d="m9.5 12 1.7 1.7 3.5-3.7"
      />

    </svg>

  );

}


function SidebarToggleIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="m14 6-6 6 6 6"
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

  const pathname =
    usePathname()
    ??
    "/";


  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] =
    useState(
      false
    );


  const adminMode =
    pathname ===
      "/admin"
    ||
    pathname.startsWith(
      "/admin/"
    );


  const homeHref =
    adminMode
      ? "/admin"
      : "/";


  // ==========================================================
  // ВОССТАНАВЛИВАЕМ СОСТОЯНИЕ САЙДБАРА
  // ==========================================================

  useEffect(
    () => {

      try {

        const savedState =
          window
            .localStorage
            .getItem(
              "workspace-sidebar-collapsed"
            );


        setSidebarCollapsed(
          savedState === "1"
        );

      } catch {

        /*
         * Если браузер запретил localStorage,
         * меню просто останется раскрытым.
         */

      }

    },
    []
  );


  // ==========================================================
  // СВОРАЧИВАНИЕ / РАЗВОРАЧИВАНИЕ
  // ==========================================================

  function toggleSidebar() {

    setSidebarCollapsed(
      current => {

        const next =
          !current;


        try {

          window
            .localStorage
            .setItem(
              "workspace-sidebar-collapsed",
              next
                ? "1"
                : "0"
            );

        } catch {

          /*
           * На сам переключатель
           * ошибка localStorage не влияет.
           */

        }


        return next;

      }
    );

  }


  return (

    <div
      className={
        sidebarCollapsed

          ? "home-shell home-shell--sidebar-collapsed"

          : "home-shell"
      }
    >

      {/* ==========================================
          ЛЕВОЕ МЕНЮ
          ========================================== */}

      <aside
        className=
          "home-sidebar"
      >

        {/* ========================================
            ЛОГОТИП
            ======================================== */}

        <Link
          href={
            homeHref
          }

          className=
            "home-company-logo"

          aria-label={
            adminMode

              ? "Перейти на главную страницу администрирования"

              : "Перейти на главную страницу"
          }
        >

          <img
            src=
              "/logos/babushkina-marketplace.png"

            alt=
              "ИП Бабушкина Маркетплейс"

            className=
              "home-company-logo-image"
          />

        </Link>


        {/* ========================================
            КНОПКА СВОРАЧИВАНИЯ
            ======================================== */}

        <button
          type="button"

          className=
            "home-sidebar-toggle"

          onClick={
            toggleSidebar
          }

          aria-label={
            sidebarCollapsed

              ? "Развернуть левое меню"

              : "Свернуть левое меню"
          }

          title={
            sidebarCollapsed

              ? "Развернуть меню"

              : "Свернуть меню"
          }
        >

          <SidebarToggleIcon />

        </button>


        {/* ========================================
            АДМИНИСТРАТИВНЫЕ РАЗДЕЛЫ
            ======================================== */}

        {
          adminMode

            ? (

              <nav
                className=
                  "home-workspaces"

                aria-label=
                  "Администрирование"
              >

                <Link
                  href="/admin"

                  className=
                    "home-workspace-link"

                  aria-label=
                    "Главная"

                  title=
                    "Главная"
                >

                  <span
                    className=
                      "home-workspace-icon"
                  >

                    <AdminHomeIcon />

                  </span>


                  <span
                    className=
                      "home-workspace-label"
                  >
                    Главная
                  </span>

                </Link>


                <Link
                  href="/admin/users"

                  className=
                    "home-workspace-link"

                  aria-label=
                    "Сотрудники"

                  title=
                    "Сотрудники"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >

                    <EmployeesIcon />

                  </span>


                  <span
                    className=
                      "home-workspace-label"
                  >
                    Сотрудники
                  </span>

                </Link>

              </nav>

            )

            : (

              /* ==================================
                 РАБОЧИЕ РАЗДЕЛЫ
                 ================================== */

              <nav
                className=
                  "home-workspaces"

                aria-label=
                  "Рабочие пространства"
              >

                <Link
                  href="/zakup"

                  className=
                    "home-workspace-link"

                  aria-label=
                    "Закуп"

                  title=
                    "Закуп"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >

                    <ProcurementIcon />

                  </span>


                  <span
                    className=
                      "home-workspace-label"
                  >
                    Закуп
                  </span>

                </Link>


                <Link
                  href="/ved"

                  className=
                    "home-workspace-link"

                  aria-label=
                    "ВЭД"

                  title=
                    "ВЭД"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >

                    <VedIcon />

                  </span>


                  <span
                    className=
                      "home-workspace-label"
                  >
                    ВЭД
                  </span>

                </Link>


                <Link
                  href="/ozon"

                  className=
                    "home-workspace-link"

                  aria-label=
                    "Ozon"

                  title=
                    "Ozon"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >

                    <img
                      src=
                        "/logos/ozon.png"

                      alt=""

                      className=
                        "home-brand-image"
                    />

                  </span>


                  <span
                    className=
                      "home-workspace-label"
                  >
                    Ozon
                  </span>

                </Link>


                <Link
                  href="/wildberries"

                  className=
                    "home-workspace-link"

                  aria-label=
                    "Wildberries"

                  title=
                    "Wildberries"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >

                    <img
                      src=
                        "/logos/wildberries.png"

                      alt=""

                      className=
                        "home-brand-image"
                    />

                  </span>


                  <span
                    className=
                      "home-workspace-label"
                  >
                    Wildberries
                  </span>

                </Link>


                <Link
                  href="/yandex-market"

                  className=
                    "home-workspace-link"

                  aria-label=
                    "Яндекс Маркет"

                  title=
                    "Яндекс Маркет"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >

                    <img
                      src=
                        "/logos/yandex-market.png"

                      alt=""

                      className=
                        "home-brand-image"
                    />

                  </span>


                  <span
                    className=
                      "home-workspace-label"
                  >
                    Яндекс Маркет
                  </span>

                </Link>

              </nav>

            )
        }

      </aside>


      {/* ==========================================
          ОСНОВНАЯ ЧАСТЬ
          ========================================== */}

      <div
        className=
          "home-main"
      >

        <header
          className=
            "home-topbar"
        >

          <div
            className=
              "home-search"
          >

            <span
              className=
                "home-search-icon"
            >

              <SearchIcon />

            </span>


            <input
              type="text"

              placeholder={
                adminMode

                  ? "Поиск по сотрудникам, доступам, настройкам..."

                  : "Поиск по товарам, SKU, документам, разделам..."
              }

              aria-label=
                "Поиск"
            />


            <span
              className=
                "home-search-shortcut"
            >
              Ctrl + K
            </span>

          </div>


          <HomeHeaderActions />

        </header>


        <div
          className={
            `home-content workspace-content${
              module
                ? " workspace-content--module"
                : ""
            }`
          }
        >

          {
            module

              ? (

                <div
                  className=
                    "workspace-corner-decoration"
                >

                  <WorkspaceDecoration />

                </div>

              )

              : null
          }


          {
            children
          }

        </div>

      </div>

    </div>

  );

}
