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
  MouseEvent,
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


type VedOrderSource =
  | "zakup"
  | "ved"
  | null;


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

  // Accent palette is scoped to the current workspace.
  // Marketplace pages preserve their existing brand styles.
  const accentArea =
    pathname === "/ozon" || pathname.startsWith("/ozon/") ||
    pathname === "/wildberries" || pathname.startsWith("/wildberries/") ||
    pathname === "/yandex-market" || pathname.startsWith("/yandex-market/")
      ? "marketplace"
      : "general";


  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] =
    useState(
      false
    );


  const [
    pendingNavKey,
    setPendingNavKey,
  ] =
    useState<WorkspaceNavKey | null>(
      null
    );


  const [
    vedOrderSource,
    setVedOrderSource,
  ] =
    useState<VedOrderSource>(
      null
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


  const isVedOrderDetail =
    pathname.startsWith(
      "/ved-orders/"
    );


  // ==========================================================
  // ИСТОЧНИК ОТКРЫТИЯ ДЕТАЛЬНОЙ СТРАНИЦЫ ЗАКАЗА
  //
  // ?from=zakup -> заказ открыт из Закупа
  // ?from=ved   -> заказ открыт из ВЭД
  //
  // Если параметра нет, считаем страницу частью ВЭД.
  // Это безопасное поведение для старых ссылок.
  // ==========================================================

  useEffect(
    () => {

      if (
        !isVedOrderDetail
      ) {

        setVedOrderSource(
          null
        );

        return;

      }


      try {

        const params =
          new URLSearchParams(
            window.location.search
          );


        const source =
          params.get(
            "from"
          );


        setVedOrderSource(
          source === "zakup"
            ? "zakup"
            : "ved"
        );

      } catch {

        setVedOrderSource(
          "ved"
        );

      }

    },
    [
      pathname,
      isVedOrderDetail,
    ]
  );


  // ==========================================================
  // МГНОВЕННЫЙ ВИЗУАЛЬНЫЙ ОТКЛИК НА ПЕРЕХОД
  // ==========================================================

  useEffect(
    () => {

      setPendingNavKey(
        null
      );

    },
    [
      pathname,
    ]
  );


  function handleNavClick(
    event: MouseEvent<HTMLAnchorElement>,
    key: WorkspaceNavKey
  ) {

    if (
      event.defaultPrevented
      ||
      event.button !== 0
      ||
      event.metaKey
      ||
      event.ctrlKey
      ||
      event.shiftKey
      ||
      event.altKey
    ) {

      return;

    }


    setPendingNavKey(
      key
    );

  }


  // ==========================================================
  // АКТИВНЫЙ ПУНКТ МЕНЮ
  // ==========================================================

  function isNavActive(
    key: WorkspaceNavKey
  ) {

    if (
      pendingNavKey !== null
    ) {

      return (
        key === pendingNavKey
      );

    }


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
          (
            isVedOrderDetail
            &&
            vedOrderSource ===
              "zakup"
          )
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
          ||
          (
            isVedOrderDetail
            &&
            vedOrderSource ===
              "ved"
          )
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
      data-accent-area={accentArea}
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

                  onClick={
                    event =>
                      handleNavClick(
                        event,
                        "admin-home"
                      )
                  }

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

                  aria-label="Главная"
                  title="Главная"
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

                  onClick={
                    event =>
                      handleNavClick(
                        event,
                        "admin-users"
                      )
                  }

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

                  aria-label="Сотрудники"
                  title="Сотрудники"
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

              <nav
                className=
                  "home-workspaces"

                aria-label=
                  "Рабочие пространства"
              >

                <Link
                  href="/zakup"

                  onClick={
                    event =>
                      handleNavClick(
                        event,
                        "procurement"
                      )
                  }

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

                  aria-label="Закуп"
                  title="Закуп"
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

                  onClick={
                    event =>
                      handleNavClick(
                        event,
                        "ved"
                      )
                  }

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

                  aria-label="ВЭД"
                  title="ВЭД"
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
                  data-marketplace="ozon"

                  onClick={
                    event =>
                      handleNavClick(
                        event,
                        "ozon"
                      )
                  }

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

                  aria-label="Ozon"
                  title="Ozon"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >
                    <WorkspaceMarketplaceLogo
                      kind="ozon"
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
                  data-marketplace="wildberries"

                  onClick={
                    event =>
                      handleNavClick(
                        event,
                        "wildberries"
                      )
                  }

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

                  aria-label="Wildberries"
                  title="Wildberries"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >
                    <WorkspaceMarketplaceLogo
                      kind="wildberries"
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
                  data-marketplace="yandex-market"

                  onClick={
                    event =>
                      handleNavClick(
                        event,
                        "yandex-market"
                      )
                  }

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

                  aria-label="Яндекс Маркет"
                  title="Яндекс Маркет"
                >

                  <span
                    className=
                      "home-brand-icon"
                  >
                    <WorkspaceMarketplaceLogo
                      kind="yandex-market"
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

              aria-label="Поиск"
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
