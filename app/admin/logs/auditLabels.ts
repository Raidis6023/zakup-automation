/**
 * Human-readable, structured captions for the administrative event feed.
 * Storage keeps immutable machine codes; UI owns localisation and wording.
 */
export type AuditCaptionSource = {
  module: string;
  action: string;
  title: string;
  result: string;
  object_type: string;
  object_id: string | null;
  new_data: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
};

type Caption = { title: string; subtitle: string };
const textOf = (v: unknown) => typeof v === "string" ? v : "";
const numOf = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
const countLabel = (count: unknown, unit: string): string => {
  const value = numOf(count);
  return value === null ? "" : value.toLocaleString("ru-RU") + " " + unit;
};
function readableDate(value: unknown): string {
  const text = textOf(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text + "T12:00:00Z");
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
function period(data: Record<string, unknown>): string {
  const from = readableDate(data.from);
  const to = readableDate(data.to);
  return from && to ? "Период: " + from + " – " + to : from || to;
}
function detail(parts: Array<string | null | undefined>): string {
  return parts.filter((x): x is string => Boolean(x)).join(" · ");
}
const resultText = (status: string) =>
  status === "error" ? "Ошибка загрузки"
  : status === "warning" ? "Загрузка завершена с предупреждением"
  : status === "pending" ? "Обработка ещё не завершена"
  : "Данные загружены";
const vedActions: Record<string,string> = {
  photo_auto_loaded: "Автоматически загружены фотографии товаров",
  order_created: "Создан заказ ВЭД",
  commercial_terms_confirmed: "Согласованы коммерческие условия",
  ved_item_updated: "Изменена позиция заказа ВЭД",
  preparation_data_updated: "Обновлены сведения для подготовки заказа",
  ved_order_taken_in_work: "Заказ ВЭД принят в работу",
  transit_started: "Заказ отправлен в пути",
  arrival_confirmed: "Подтверждено прибытие заказа",
  moq_review_resolved: "Согласовано количество в партии",
  production_confirmed: "Подтверждено производство",
  order_sent_to_ved: "Заказ передан в ВЭД",
  ved_moq_updated: "Изменено минимальное количество заказа",
};
export function formatAuditEvent(e: AuditCaptionSource): Caption {
  const data = e.new_data ?? {};
  if (e.module === "sync") {
    const completed = resultText(e.result);
    const rows = countLabel(data.rows, "строк");
    switch (e.action) {
      case "ozon_sales":
        return { title: "Ozon · продажи", subtitle: detail([completed, period(data), rows]) };
      case "ozon_stocks":
        return { title: "Ozon · остатки на складах", subtitle: detail(["Сохранён снимок", readableDate(data.date), rows]) };
      case "wb_sales":
        return { title: "Wildberries · продажи", subtitle: detail([completed, period(data), rows]) };
      case "wb_stocks":
        return { title: "Wildberries · остатки на складах", subtitle: detail(["Сохранён снимок", readableDate(data.date), countLabel(data.products, "товаров")]) };
      case "wb_finance":
        return { title: "Wildberries · финансовый отчёт", subtitle: detail([completed, readableDate(data.date), rows]) };
      case "ozon_finance":
        return { title: "Ozon · начисления и расходы", subtitle: detail([completed, readableDate(data.day), rows]) };
      case "ozon_ads":
        return { title: "Ozon · рекламная статистика", subtitle: detail([completed, period(data)]) };
      case "marketplace_sync": {
        const name = e.title.includes("yandex_market") ? "Яндекс Маркет"
          : e.title.includes("wildberries") ? "Wildberries"
          : e.title.includes("ozon") ? "Ozon" : "Маркетплейсы";
        return { title: name + " · общая синхронизация", subtitle: completed };
      }
      default:
        return { title: "Синхронизация данных", subtitle: completed };
    }
  }
  if (e.module === "ved") {
    if (e.action === "tariff_changed") {
      return { title: "ВЭД · изменён тариф", subtitle: detail([e.object_id ? "Тариф: " + e.object_id : "", readableDate(data.effective_from)]) };
    }
    const title = vedActions[e.action] || "Изменены сведения о заказе ВЭД";
    const field = textOf(e.details?.field);
    return { title, subtitle: detail(["ВЭД", field ? "Поле: " + field : "Заказы и документы"]) };
  }
  if (e.module === "calculations") {
    return { title: "Юнит-экономика · сохранён результат расчёта",
      subtitle: detail([textOf(data.model) ? "Модель: " + textOf(data.model) : "", numOf(data.revision) !== null ? "Версия настроек: " + String(data.revision) : ""]) };
  }
  if (e.module === "finance") {
    return { title: "Яндекс Маркет · изменены финансовые ставки",
      subtitle: e.object_id ? "ЕНОТ: " + e.object_id : "Изменения в финансовых параметрах" };
  }
  if (e.module === "admin") {
    if (e.action === "integration_settings_updated")
      return { title: "Обновлены настройки подключения", subtitle: "Администрирование · Интеграции" };
    if (e.action.startsWith("access_request_"))
      return { title: "Изменён статус заявки на доступ", subtitle: "Администрирование · Сотрудники" };
    return { title: e.title, subtitle: "Администрирование · Права и сотрудники" };
  }
  if (e.module === "tasks") {
    return { title: e.title, subtitle: "Задачи · Изменение состояния или содержания" };
  }
  return { title: e.title, subtitle: e.action.replaceAll("_", " ") };
}
