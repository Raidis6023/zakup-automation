"use client";

import {
  useEffect,
  useState,
} from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] =
    useState<Theme>("light");

  const [mounted, setMounted] =
    useState(false);

  useEffect(() => {
    const currentTheme =
      document.documentElement
        .dataset.theme as Theme | undefined;

    setTheme(
      currentTheme === "dark"
        ? "dark"
        : "light"
    );

    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme =
      theme === "dark"
        ? "light"
        : "dark";

    document.documentElement.dataset.theme =
      nextTheme;

    localStorage.setItem(
      "zakup-theme",
      nextTheme
    );

    setTheme(nextTheme);
  }

  if (!mounted) {
    return (
      <button
        className="theme-toggle"
        type="button"
      >
        Тема
      </button>
    );
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Переключить тему"
    >
      {theme === "dark"
        ? "☀ Светлая"
        : "☾ Тёмная"}
    </button>
  );
}
