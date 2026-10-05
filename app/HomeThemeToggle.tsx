"use client";

import {
  useEffect,
  useState,
} from "react";


// ============================================================
// ICONS
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
// COMPONENT
// ============================================================

export default function HomeThemeToggle() {

  const [
    theme,
    setTheme,
  ] =
    useState<
      "light"
      |
      "dark"
    >(
      "light"
    );


  useEffect(
    () => {

      const savedTheme =
        localStorage.getItem(
          "theme"
        );


      const currentTheme =
        document
          .documentElement
          .dataset
          .theme;


      if (
        savedTheme === "dark"
        ||
        currentTheme === "dark"
      ) {

        setTheme(
          "dark"
        );

      } else {

        setTheme(
          "light"
        );

      }

    },
    []
  );


  function applyTheme(
    nextTheme:
      "light"
      |
      "dark"
  ) {

    document
      .documentElement
      .dataset
      .theme =
        nextTheme;


    localStorage.setItem(
      "theme",
      nextTheme
    );


    setTheme(
      nextTheme
    );

  }


  return (

    <div
      className="home-theme-toggle"
      aria-label="Переключение темы"
    >

      <button
        type="button"

        className={
          theme === "light"
            ? "active"
            : ""
        }

        aria-label="Светлая тема"

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

        aria-label="Тёмная тема"

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
