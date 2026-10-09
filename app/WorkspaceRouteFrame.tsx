
"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import WorkspaceShell from "./WorkspaceShell";

// ============================================================
// ТИПЫ
// ============================================================

type Props = {
  children: ReactNode;
};

// ============================================================
// СЛУЖЕБНЫЕ СТРАНИЦЫ БЕЗ ОБОЛОЧКИ WORKSPACE
// ============================================================

const standalonePaths = [
  "/login",
  "/signin",
  "/sign-in",
  "/register",
  "/auth",
  "/reset-password",
  "/forgot-password",
  "/access-denied",
];

function isStandalonePage(
  pathname: string
): boolean {
  return standalonePaths.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  );
}

// ============================================================
// ЕДИНЫЙ МАРШРУТИЗАТОР WORKSPACE
// ============================================================

export default function WorkspaceRouteFrame({
  children,
}: Props) {
  const pathname = usePathname() ?? "/";

  // Страницы входа и восстановления доступа
  // не оборачиваются рабочим интерфейсом.

  if (isStandalonePage(pathname)) {
    return <>{children}</>;
  }

  // Главная имеет собственный заголовок
  // и декоративные полосы.
  //
  // Все остальные рабочие страницы
  // получают общую оболочку WorkSpace
  // и полосы в правом верхнем углу.

  return (
    <WorkspaceShell
      module={pathname !== "/"}
    >
      {children}
    </WorkspaceShell>
  );
}
