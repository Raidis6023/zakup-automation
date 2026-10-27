
import type {
  Metadata,
} from "next";

import WorkspaceRouteFrame from "./WorkspaceRouteFrame";

import "./globals.css";
import "./ui/tokens.css";

// ============================================================
// МЕТАДАННЫЕ
// ============================================================

export const metadata: Metadata = {
  title: "Система закупа",
  description:
    "Автоматизация отдела закупа",
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ ТЕМЫ
// ============================================================

const themeScript = `
(function () {
  try {
    var savedTheme =
      localStorage.getItem("zakup-theme");

    var theme =
      savedTheme === "dark"
        ? "dark"
        : savedTheme === "light"
        ? "light"
        : window.matchMedia(
            "(prefers-color-scheme: dark)"
          ).matches
        ? "dark"
        : "light";

    document.documentElement
      .setAttribute(
        "data-theme",
        theme
      );
  } catch (e) {
    document.documentElement
      .setAttribute(
        "data-theme",
        "light"
      );
  }
})();
`;

// ============================================================
// ГЛАВНЫЙ LAYOUT ПРИЛОЖЕНИЯ
// ============================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeScript,
          }}
        />
      </head>

      <body>
        <WorkspaceRouteFrame>
          {children}
        </WorkspaceRouteFrame>
      </body>
    </html>
  );
}
