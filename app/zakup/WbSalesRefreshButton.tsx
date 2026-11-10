"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WbSalesRefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRefresh() {
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/wb/sync-sales", { method: "POST", cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Ошибка загрузки продаж WB");
      }
      setMessage("WB: " + result.fbwSales + " продаж, " +
        result.fbwReturns + " возвратов; период " +
        result.dateFrom + " – " + result.dateTo +
        ". Источник: ежедневный финансовый отчёт. Можно пересчитать закуп.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка синхронизации WB");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className="secondary-button" onClick={handleRefresh} disabled={loading}>
        {loading ? "Загружаем продажи WB…" : "Обновить продажи WB"}
      </button>
      {message ? <p className="muted" role="status">{message}</p> : null}
    </div>
  );
}
