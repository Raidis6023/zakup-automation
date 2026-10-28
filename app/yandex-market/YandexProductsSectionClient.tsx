"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";




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

  // The section is collapsed at page entry; a focused product can be
  // revealed by opening the table explicitly.
  useEffect(() => {
    setStorageLoaded(true);
  }, []);

  // ==========================================================
  // TOGGLE
  // ==========================================================

  function toggleExpanded() {
    setExpanded(previous => !previous);
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
