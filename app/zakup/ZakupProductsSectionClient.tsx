"use client";

import { useWorkspaceDisclosure } from "../ui/useWorkspaceDisclosure";

import ButtonLink from "../ui/ButtonLink";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";




// ============================================================
// ИКОНКА ТАБЛИЦЫ
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

export default function ZakupProductsSectionClient({
  skuCount,
  children,
  title = "Товары",
  subtitle = "Итоговые значения текущего расчёта",
  sectionId = "zakup-products-table",
  showLinks = true,
}: {
  skuCount: number;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  sectionId?: string;
  showLinks?: boolean;
}) {

  const { expanded, toggle: toggleExpanded } = useWorkspaceDisclosure();


  const [
    storageLoaded,
    setStorageLoaded,
  ] =
    useState(
      false
    );


  // ==========================================================
  // ВОССТАНАВЛИВАЕМ СОСТОЯНИЕ
  // ==========================================================

  // Always closed at page entry. No remembered expanded sections.
  useEffect(() => {
    setStorageLoaded(true);
  }, []);

  // ==========================================================
  // ПЕРЕКЛЮЧЕНИЕ
  // ==========================================================



  return (

    <section
      className=
        "section zakup-products-section zakup-products-collapsible"
    >

      <div className="zakup-products-header">
        <button
          type="button"
  
          className=
            "zakup-products-toggle"
  
          onClick={
            toggleExpanded
          }
  
          aria-expanded={
            expanded
          }
  
          aria-controls={sectionId}
        >
  
          <span
            className=
              "zakup-products-icon"
          >
  
            <ProductsTableIcon />
  
          </span>
  
  
          <span
            className=
              "zakup-products-toggle-copy"
          >
  
            <strong
              className=
                "zakup-products-toggle-title"
            >
              {title} ({skuCount})
            </strong>
  
  
            <span
              className=
                "muted zakup-products-toggle-subtitle"
            >
              {subtitle}
            </span>
  
          </span>
  
        </button>

        {showLinks && (
        <nav className="zakup-products-header-links" aria-label="Связанные разделы товаров">
          <ButtonLink href="/stocks" variant="secondary" className="navigation-button">
            Остатки
          </ButtonLink>
          <ButtonLink href="/logistics-import" variant="secondary" className="navigation-button">
            Габариты
          </ButtonLink>
        </nav>
        )}
      </div>


      {
        storageLoaded
        &&
        expanded

          ? (

            <div
              id={sectionId}

              className=
                "zakup-products-table-content"
            >
              {
                children
              }
            </div>

          )

          : null
      }

    </section>

  );

}
