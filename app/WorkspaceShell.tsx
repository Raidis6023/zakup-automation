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

import WorkspaceCompanyLogo
  from "./WorkspaceCompanyLogo";

import WorkspaceMarketplaceLogo
  from "./WorkspaceMarketplaceLogos";

import {
  EmployeesIcon,
  ProcurementIcon,
  VedIcon,
} from "./WorkspaceNavIcons";

import "./home.css";
import "./workspace-shell.css";
import "./sidebar-collapse.css";
import "./sidebar-visuals.css";
import "./workspace-reference-shell.css";
import "./workspace-reference-components.css";
import "./workspace-theme-polish.css";


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


type WorkspaceNavKey =
  | "admin-home"
  | "admin-users"
  | "procurement"
  | "ved"
  | "ozon"
  | "wildberries"
  | "yandex-market";


// ============================================================
// ОБОЛОЧКА WORKSPACE
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
  // ДЕТАЛЬНАЯ СТРАНИЦА ЗАКАЗА
  //
  // /ved-orders/[id]
  //
  // Несмотря на техническое имя ved-orders,
  // эта детальная страница создаётся из раздела "Закуп"
  // после формирования заказа.
  //
  // Поэтому в боковом меню она относится к "Закуп".
  //
  // Сам список /ved-orders без ID оставляем за ВЭД.
  // ==========================================================

  const isProcurementOrderDetail =
    pathname.startsWith(
      "/ved-orders/"
    );


  // ==========================================================
  // АКТИВНЫЙ ПУНКТ МЕНЮ
  // ==========================================================

  function isNavActive(
    key: WorkspaceNavKey
  ) {

    switch (key) {

      case "admin-home":

        return (
          pathname ===
          "/admin"
        );


      case "admin-users":

        return (
          pathname ===
            "/admin/users"
          ||
          pathname.startsWith(
            "/admin/users/"
          )
        );


      case "procurement":

        return (
          pathname ===
            "/zakup"
          ||
          pathname.startsWith(
            "/zakup/"
          )
          ||
          pathname ===
            "/stock-import"
          ||
          pathname.startsWith(
            "/stock-import/"
          )
          ||
          isProcurementOrderDetail
        );


      case "ved":

        return (
          pathname ===
            "/ved"
          ||
          pathname.startsWith(
            "/ved/"
          )
          ||
          pathname ===
            "/ved-orders"
        );


      case "ozon":

        return (
          pathname ===
            "/ozon"
          ||
          pathname.startsWith(
            "/ozon/"
          )
        );


      case "wildberries":

        return (
          pathname ===
            "/wildberries"
          ||
          pathname.startsWith(
            "/wildberries/"
          )
        );


      case "yandex-market":

        return (
          pathname ===
            "/yandex-market"
          ||
          pathname.startsWith(
            "/yandex-market/"
          )
        );


      default:

        return false;

    }

  }


  function navClass(
    key: WorkspaceNavKey
  ) {

    return (
      isNavActive(
        key
      )

        ? "home-workspace-link home-workspace-link--active"

        : "home-workspace-link"
    );

  }


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
         * Если localStorage недоступен,
         * меню просто останется раскрытым.
         */

      }

    },
    []
  );


  // ==========================================================
  // СВОРАЧИВАНИЕ
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
           * На работу меню это не влияет.
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

          <WorkspaceCompanyLogo />

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
            РЕЖИМ АДМИНИСТРАТОРА
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

                  className={
                    navClass(
                      "admin-home"
                    )
                  }

                  aria-current={
                    isNavActive(
                      "admin-home"
                    )

                      ? "page"

                      : undefined
                  }

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

                  className={
                    navClass(
                      "admin-users"
                    )
                  }

                  aria-current={
                    isNavActive(
                      "admin-users"
                    )

                      ? "page"

                      : undefined
                  }

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
                 РАБОЧИЙ РЕЖИМ
                 ================================== */

              <nav
                className=
                  "home-workspaces"

                aria-label=
                  "Рабочие пространства"
              >

                <Link
                  href="/zakup"

                  className={
                    navClass(
                      "procurement"
                    )
                  }

                  aria-current={
                    isNavActive(
                      "procurement"
                    )

                      ? "page"

                      : undefined
                  }

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

                  className={
                    navClass(
                      "ved"
                    )
                  }

                  aria-current={
                    isNavActive(
                      "ved"
                    )

                      ? "page"

                      : undefined
                  }

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

                  className={
                    navClass(
                      "ozon"
                    )
                  }

                  aria-current={
                    isNavActive(
                      "ozon"
                    )

                      ? "page"

                      : undefined
                  }

                  aria-label=
                    "Ozon"

                  title=
                    "Ozon"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >

                    <WorkspaceMarketplaceLogo kind="ozon" />

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

                  className={
                    navClass(
                      "wildberries"
                    )
                  }

                  aria-current={
                    isNavActive(
                      "wildberries"
                    )

                      ? "page"

                      : undefined
                  }

                  aria-label=
                    "Wildberries"

                  title=
                    "Wildberries"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >

                    <WorkspaceMarketplaceLogo kind="wildberries" />

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

                  className={
                    navClass(
                      "yandex-market"
                    )
                  }

                  aria-current={
                    isNavActive(
                      "yandex-market"
                    )

                      ? "page"

                      : undefined
                  }

                  aria-label=
                    "Яндекс Маркет"

                  title=
                    "Яндекс Маркет"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >

                    <WorkspaceMarketplaceLogo kind="yandex-market" />

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
