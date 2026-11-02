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
  "/ved/commercial-offers": { label: "Коммерческие предложения", parent: "/ved" },
  "/ved/registry": { label: "Реестр товаров и расчётов", parent: "/ved" },
  "/ved/registry/calculator": { label: "Калькулятор ВЭД", parent: "/ved/registry" },
  "/ved/documents": { label: "Документы", parent: "/ved" },
  "/ved/references": { label: "Справочники ВЭД", parent: "/ved" },
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

const segmentLabels: Record<string, string> = {
  "calculator": "Калькулятор ВЭД",
  "financier": "ИИ-финансист",
  "settings": "Настройки",
  "fbw-supplies": "Формирование поставок",
  "commissions": "Комиссии",
  "logistics": "Логистика и тарифы",
  "stock-import": "Загрузка АВЕДЭКС",
  "responsible-storage-import": "Ответственное хранение",
  "logistics-import": "Импорт логистики",
  "commercial-offers": "Коммерческие предложения",
  "registry": "Реестр товаров и расчётов",
  "references": "Справочники ВЭД",
  "documents": "Документы",
  "orders": "Заказы",
  "sku-list": "Список артикулов",
  "unit-economics": "Юнит-экономика",
  "wildberries": "Wildberries",
  "yandex-market": "Яндекс Маркет",
  "ozon": "Ozon",
  "admin": "Администрирование",
  "users": "Сотрудники",
  "tasks": "Задачи",
  "logs": "История логов",
  "profile": "Профиль",
  "stocks": "Остатки",
  "zakup": "Закуп",
  "ved": "ВЭД",
};

function displaySegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Keep a readable fallback for malformed URLs.
  }
  const normalized = decoded.toLowerCase();
  if (segmentLabels[normalized]) return segmentLabels[normalized];

  const readable = decoded.replace(/[-_]+/g, " ").replace(/^./, letter => letter.toUpperCase());
  // New Latin route slugs must be registered above instead of leaking English
  // technical names into the Russian navigation.
  if (/^[a-z0-9_-]+$/i.test(decoded) && /[a-z]/i.test(decoded)) return "Раздел";
  return readable;
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

  // Administrative breadcrumbs have their own home destination. The generic
  // Workspace home ("/") belongs to role-based work mode and must not leak
  // into the administrator's navigation.
  if (path === "/admin") {
    return [{ label: "Главная", href: "/admin" }];
  }
  if (path.startsWith("/admin/")) {
    const chain: BreadcrumbItem[] = [{ label: "Главная", href: "/admin" }];
    let current = path;
    const seen = new Set<string>();
    const parents: BreadcrumbItem[] = [];
    while (current !== "/admin" && current !== "/" && !seen.has(current)) {
      seen.add(current);
      const entry = routes[current] ?? getFallback(current);
      parents.unshift({
        label: entry.label,
        href: current,
        ...(entry.shortLabel ? { shortLabel: entry.shortLabel } : {}),
      });
      current = entry.parent ?? "/admin";
    }
    return [...chain, ...parents];
  }

  // /ved displays the Orders page, while the VED section entry is
  // /ved/commercial-offers. Keep both levels visible in the breadcrumb.
  if (path === "/ved") {
    return [
      { label: "Главная", href: "/" },
      { label: "ВЭД", href: "/ved/commercial-offers" },
      { label: "Заказы", href: "/ved" },
    ];
  }

  // Dynamic VED order IDs must never become a fabricated parent route.
  if (path.startsWith("/ved-orders/")) {
    const parent = vedOrderSource === "zakup" ? "/zakup" : "/ved";
    return [
      { label: "Главная", href: "/" },
      {
        label: routes[parent].label,
        href: parent === "/ved" ? "/ved/commercial-offers" : parent,
      },
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
      href: current === "/ved" ? "/ved/commercial-offers" : current,
      ...(entry.shortLabel ? { shortLabel: entry.shortLabel } : {}),
    });
    current = entry.parent ?? "/";
  }
  return [...chain, ...parents];
}
