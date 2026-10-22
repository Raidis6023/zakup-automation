"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";


const STORAGE_KEY =
  "zakup-products-expanded";


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
}: {
  skuCount:
    number;

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
  // ВОССТАНАВЛИВАЕМ СОСТОЯНИЕ
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

        // localStorage может быть недоступен,
        // например в жёстком приватном режиме.
        // Тогда просто оставляем таблицу свёрнутой.

      } finally {

        setStorageLoaded(
          true
        );

      }

    },
    []
  );


  // ==========================================================
  // ПЕРЕКЛЮЧЕНИЕ
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

          // Ничего страшного.
          // Сама таблица всё равно продолжит работать.

        }


        return next;

      }
    );

  }


  return (

    <section
      className=
        "section zakup-products-section zakup-products-collapsible"
    >

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

        aria-controls=
          "zakup-products-table"
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
            Товары ({
              skuCount
            })
          </strong>


          <span
            className=
              "muted zakup-products-toggle-subtitle"
          >
            Итоговые значения текущего расчёта
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
                "zakup-products-table"

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
