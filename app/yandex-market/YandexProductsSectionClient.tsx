"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";


const STORAGE_KEY =
  "yandex-products-expanded";


// ============================================================
// ICON
// ============================================================

function ProductsTableIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
      />


      <path
        d="M3 9h18"
      />


      <path
        d="M3 14h18"
      />


      <path
        d="M9 4v16"
      />


      <path
        d="M15 4v16"
      />

    </svg>
  );

}


// ============================================================
// COMPONENT
// ============================================================

export default function YandexProductsSectionClient({
  children,
}: {
  children:
    ReactNode;
}) {

  const [
    expanded,
    setExpanded,
  ] =
    useState(
      false
    );


  const [
    storageLoaded,
    setStorageLoaded,
  ] =
    useState(
      false
    );


  // ==========================================================
  // RESTORE STATE
  // ==========================================================

  useEffect(
    () => {

      try {

        const stored =
          window.localStorage.getItem(
            STORAGE_KEY
          );


        if (
          stored ===
          "1"
        ) {

          setExpanded(
            true
          );

        }


        if (
          stored ===
          "0"
        ) {

          setExpanded(
            false
          );

        }

      } catch {

        // Если localStorage недоступен,
        // таблица просто останется свёрнутой.

      } finally {

        setStorageLoaded(
          true
        );

      }

    },
    []
  );


  // ==========================================================
  // TOGGLE
  // ==========================================================

  function toggleExpanded() {

    setExpanded(
      previous => {

        const next =
          !previous;


        try {

          window.localStorage.setItem(
            STORAGE_KEY,

            next
              ? "1"
              : "0"
          );

        } catch {

          // Сама таблица продолжит работать
          // даже без localStorage.

        }


        return next;

      }
    );

  }


  return (
    <section
      className=
        "section ym-products-section ym-products-collapsible"
    >

      <button
        type="button"

        className=
          "ym-products-toggle"

        onClick={
          toggleExpanded
        }

        aria-expanded={
          expanded
        }

        aria-controls=
          "yandex-products-table"
      >

        <span
          className=
            "ym-products-section-icon"
        >
          <ProductsTableIcon />
        </span>


        <span
          className=
            "ym-products-toggle-copy"
        >

          <strong
            className=
              "ym-products-toggle-title"
          >
            Данные по товарам
          </strong>


          <span
            className=
              "muted ym-products-toggle-subtitle"
          >
            Основная строка показывает общие показатели
            артикула. При раскрытии — показатели
            по конкретным складам.
          </span>

        </span>

      </button>


      {
        storageLoaded
        &&
        expanded

          ? (
            <div
              id=
                "yandex-products-table"

              className=
                "ym-products-table-content"
            >
              {children}
            </div>
          )

          : null
      }

    </section>
  );

}
