"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  flushSync,
} from "react-dom";


// ============================================================
// ТИПЫ
// ============================================================

type Theme = "light" | "dark";

type ThemeViewTransition = {
  finished: Promise<void>;
  skipTransition: () => void;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (
    update: () => void
  ) => ThemeViewTransition;
};


// ============================================================
// ИКОНКИ
// ============================================================

function SunIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <circle
        cx="12"
        cy="12"
        r="4"
      />

      <path
        d="
          M12 2v2
          M12 20v2
          M4.93 4.93l1.41 1.41
          M17.66 17.66l1.41 1.41
          M2 12h2
          M20 12h2
          M4.93 19.07l1.41-1.41
          M17.66 6.34l1.41-1.41
        "
      />

    </svg>

  );

}


function MoonIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="
          M20.5 14.5
          A8.5 8.5 0 0 1
          9.5 3.5
          A8.5 8.5 0 1 0
          20.5 14.5
        "
      />

    </svg>

  );

}


// ============================================================
// ПЕРЕКЛЮЧАТЕЛЬ ТЕМЫ
// ============================================================

export default function HomeThemeToggle() {

  const [
    theme,
    setTheme,
  ] =
    useState<Theme>(
      "light"
    );


  const activeTransitionRef =
    useRef<
      ThemeViewTransition | null
    >(
      null
    );


  // ==========================================================
  // ВОССТАНАВЛИВАЕМ ТЕКУЩУЮ ТЕМУ
  // ==========================================================

  useEffect(
    () => {

      const documentTheme =
        document
          .documentElement
          .dataset
          .theme;


      if (
        documentTheme === "light"
        ||
        documentTheme === "dark"
      ) {

        setTheme(
          documentTheme
        );

        return;

      }


      try {

        const savedTheme =
          window.localStorage.getItem(
            "theme"
          )
          ??
          window.localStorage.getItem(
            "zakup-theme"
          );


        setTheme(
          savedTheme === "dark"
            ? "dark"
            : "light"
        );

      } catch {

        setTheme(
          "light"
        );

      }

    },
    []
  );


  // ==========================================================
  // ПЕРЕКЛЮЧЕНИЕ ТЕМЫ
  // ==========================================================

  function applyTheme(
    nextTheme: Theme
  ) {

    const root =
      document.documentElement;


    if (
      root.dataset.theme === nextTheme
    ) {

      setTheme(
        nextTheme
      );

      return;

    }


    // ========================================================
    // МЕНЯЕМ ТЕМУ ВСЕГО ДОКУМЕНТА
    // ========================================================

    const updateDocumentTheme =
      () => {

        root.dataset.theme =
          nextTheme;

        root.classList.toggle(
          "dark",
          nextTheme === "dark"
        );


        try {

          window.localStorage.setItem(
            "theme",
            nextTheme
          );

          window.localStorage.setItem(
            "zakup-theme",
            nextTheme
          );

        } catch {

          // localStorage может быть недоступен.
          // Переключению темы это не мешает.

        }


        flushSync(
          () => {

            setTheme(
              nextTheme
            );

          }
        );

      };


    // ========================================================
    // ПРОВЕРЯЕМ НАСТРОЙКУ АНИМАЦИИ
    // ========================================================

    const reducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;


    const viewDocument =
      document as
        DocumentWithViewTransition;


    // ========================================================
    // ЕДИНЫЙ ПЕРЕХОД ВСЕЙ СТРАНИЦЫ
    // ========================================================

    if (
      !reducedMotion
      &&
      viewDocument.startViewTransition
    ) {

      activeTransitionRef.current
        ?.skipTransition();


      root.classList.add(
        "workspace-theme-changing"
      );


      const transition =
        viewDocument.startViewTransition(
          updateDocumentTheme
        );


      activeTransitionRef.current =
        transition;


      const finish =
        () => {

          if (
            activeTransitionRef.current ===
              transition
          ) {

            activeTransitionRef.current =
              null;


            root.classList.remove(
              "workspace-theme-changing"
            );

          }

        };


      void transition.finished.then(
        finish,
        finish
      );


      return;

    }


    // ========================================================
    // ЗАПАСНОЙ ВАРИАНТ ДЛЯ СТАРЫХ БРАУЗЕРОВ
    // ========================================================

    root.classList.add(
      "workspace-theme-changing"
    );


    updateDocumentTheme();


    window.requestAnimationFrame(
      () => {

        window.requestAnimationFrame(
          () => {

            root.classList.remove(
              "workspace-theme-changing"
            );

          }
        );

      }
    );

  }


  // ==========================================================
  // ИНТЕРФЕЙС
  // ==========================================================

  return (

    <div
      className=
        "home-theme-toggle"

      aria-label=
        "Переключение темы"
    >

      <button
        type="button"

        className={
          theme === "light"
            ? "active"
            : ""
        }

        aria-label=
          "Светлая тема"

        aria-pressed={
          theme === "light"
        }

        onClick={
          () =>
            applyTheme(
              "light"
            )
        }
      >

        <SunIcon />

      </button>


      <button
        type="button"

        className={
          theme === "dark"
            ? "active"
            : ""
        }

        aria-label=
          "Тёмная тема"

        aria-pressed={
          theme === "dark"
        }

        onClick={
          () =>
            applyTheme(
              "dark"
            )
        }
      >

        <MoonIcon />

      </button>

    </div>

  );

}
