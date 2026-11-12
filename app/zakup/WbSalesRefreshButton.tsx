"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WbSyncResponse = {
  ok?: boolean;
  complete?: boolean;
  reused?: boolean;
  waiting?: boolean;
  savedFbw?: number;
  unmappedNmIds?: number;
  dateFrom?: string;
  dateTo?: string;
  retryAt?: string;
  error?: string;
  message?: string;
};

export default function WbSalesRefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleRefresh() {
    if (loading) return;
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/china/wb-operational-sales-sync", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json()) as WbSyncResponse;
      if (!response.ok || data.ok !== true) {
        const retry = data.retryAt
          ? " Следующая попытка не раньше " +
            new Date(data.retryAt).toLocaleString("ru-RU", {
              timeZone: "Asia/Krasnoyarsk",
            }) + " (Красноярск)."
          : "";
        throw new Error((data.error || "Не удалось загрузить продажи WB") + retry);
      }

      if (data.complete === false) {
        setMessage("WB: часть данных сохранена. Ожидается следующая страница; " +
          "потребность пока не пересчитываем.");
        return;
      }

      const unmatched = Number(data.unmappedNmIds ?? 0);
      const missingMessage = unmatched > 0
        ? " Есть " + unmatched + " nmId без привязки к ЕНОТ. Проверьте их."
        : "";
      setMessage("WB FBW: сохранено " +
        Number(data.savedFbw ?? 0).toLocaleString("ru-RU") +
        " событий за период " + (data.dateFrom || "?") + " – " +
        (data.dateTo || "?") + ". " +
        (data.reused ? "Загрузка уже завершена. " :
          "Оперативные данные предварительные. ") +
        "Нажмите «Рассчитать потребность» для обновления закупки." +
        missingMessage);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Ошибка WB");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="zakup-wb-live-sync">
      <button
        type="button"
        className="secondary-button"
        onClick={handleRefresh}
        disabled={loading}
        aria-disabled={loading}
      >
        {loading ? "Загружаем WB…" : "Обновить продажи WB"}
      </button>
      {message && <p className="muted" role="status">{message}</p>}
      {errorMessage && <p className="zakup-wb-live-error" role="alert">{errorMessage}</p>}
    </div>
  );
}
