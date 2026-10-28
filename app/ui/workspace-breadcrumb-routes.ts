import type { BreadcrumbItem } from "./Breadcrumbs";

type RouteSpec = {
  label: string;
  shortLabel?: string;
  parent?: string;
};

/**
 * Explicit display names and true parent links for existing Workspace pages.
 * New routes automatically receive a breadcrumb through the fallback below.
 */
const routes: Record<string, RouteSpec> = {
  "/sku-list": { label: "Список артикулов" },
  "/zakup": { label: "Закуп" },
  "/stocks": { label: "Остатки", parent: "/zakup" },
  "/stock-import": { label: "Загрузка АВЕДЭКС", parent: "/stocks" },
  "/responsible-storage-import": {
    label: "Ответственное хранение", shortLabel: "ОХ", parent: "/stocks",
  },
  "/logistics-import": {
    label: "Импорт логистики", shortLabel: "Габариты", parent: "/zakup",
  },
  "/ved": { label: "ВЭД" },
  "/unit-economics": { label: "Юнит-экономика" },
  "/unit-economics/commissions": { label: "Комиссии", parent: "/unit-economics" },
  "/unit-economics/logistics": { label: "Логистика и тарифы", parent: "/unit-economics" },
  "/ozon": { label: "Ozon" },
  "/ozon/financier": { label: "ИИ-финансист", parent: "/ozon" },
  "/ozon/financier/settings": {
    label: "Настройки финансиста", parent: "/ozon/financier",
  },
  "/wildberries": { label: "Wildberries", shortLabel: "WB" },
  "/wildberries/fbw-supplies": {
    label: "Формирование поставок", parent: "/wildberries",
  },
  "/wildberries/financier": { label: "ИИ-финансист", parent: "/wildberries" },
  "/yandex-market": { label: "Яндекс Маркет", shortLabel: "ЯМ" },
  "/yandex-market/financier": {
    label: "ИИ-финансист", parent: "/yandex-market",
  },
  "/tasks": { label: "Задачи" },
  "/profile": { label: "Профиль" },
  "/admin": { label: "Администрирование" },
  "/admin/users": { label: "Сотрудники", parent: "/admin" },
  "/admin/tasks": { label: "Задачи", parent: "/admin" },
  "/admin/logs": { label: "История логов", parent: "/admin" },
};

function displaySegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Keep a readable fallback for malformed URLs.
  }
  return decoded.replace(/[-_]+/g, " ").replace(/^./, letter => letter.toUpperCase());
}

function getFallback(pathname: string): RouteSpec {
  const parts = pathname.split("/").filter(Boolean);
  // Link only to an explicitly registered parent; never invent a broken route.
  for (let i = parts.length - 1; i > 0; i -= 1) {
    const candidate = "/" + parts.slice(0, i).join("/");
    if (routes[candidate]) {
      return { label: displaySegment(parts.at(-1) ?? "Раздел"), parent: candidate };
    }
  }
  const label = parts.length === 1
    ? displaySegment(parts[0])
    : parts.map(displaySegment).join(" / ");
  return { label };
}

export function workspaceBreadcrumbs(
  pathname: string,
  vedOrderSource: "zakup" | "ved" | null = null,
): BreadcrumbItem[] {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return [];

  // Dynamic VED order IDs must never become a fabricated parent route.
  if (path.startsWith("/ved-orders/")) {
    const parent = vedOrderSource === "zakup" ? "/zakup" : "/ved";
    return [
      { label: "Главная", href: "/" },
      { label: routes[parent].label, href: parent },
      { label: "Заказ в Китай", href: path },
    ];
  }

  const chain: BreadcrumbItem[] = [{ label: "Главная", href: "/" }];
  let current = path;
  const seen = new Set<string>();
  const parents: BreadcrumbItem[] = [];
  while (current !== "/" && !seen.has(current)) {
    seen.add(current);
    const entry = routes[current] ?? getFallback(current);
    parents.unshift({
      label: entry.label,
      href: current,
      ...(entry.shortLabel ? { shortLabel: entry.shortLabel } : {}),
    });
    current = entry.parent ?? "/";
  }
  return [...chain, ...parents];
}
