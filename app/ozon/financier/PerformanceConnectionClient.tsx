"use client";

import { useState } from "react";

type CheckResult = {
  ok?: boolean;
  error?: string;
  first_page_count?: number;
  truncated?: boolean;
  sample?: Array<{ id: string | null; title: string; state: string | null; type: string | null }>;
  info?: string;
};

export default function PerformanceConnectionClient() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  async function verifyConnection() {
    setChecking(true);
    setResult(null);
    try {
      const response = await fetch("/api/agents/ozon-performance-check", {
        method: "GET", cache: "no-store",
      });
      const json = await response.json() as CheckResult;
      setResult(json);
      if (!response.ok && !json.error) {
        setResult({ ok: false, error: "Проверка подключения: HTTP " + response.status });
      }
    } catch {
      setResult({
        ok: false,
        error: "Не удалось выполнить запрос. Убедитесь, что тестовая ветка успешно развёрнута.",
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="ozf-panel ozf-performance" aria-label="Ozon Performance API">
      <div className="ozf-toolbar">
        <div>
          <h2>Ozon Performance API · подключение</h2>
          
        </div>
        <button className="ozf-btn ozf-primary" disabled={checking} onClick={() => void verifyConnection()}>
          {checking ? "Проверяем…" : "Проверить подключение"}
        </button>
      </div>
      {result && (
        <div role="status" className={result.ok ? "ozf-performance-success" : "ozf-error"}>
          {result.ok ? (
            <>
              <strong>Авторизация работает. Рекламные кампании доступны.</strong>
              <p>На первой странице: {result.first_page_count ?? 0} кампаний
                {result.truncated ? " (список может содержать больше 100)" : ""}.</p>
              {result.sample?.length ? (
                <ul>
                  {result.sample.map((campaign, index) => (
                    <li key={(campaign.id ?? "campaign") + index}>
                      {campaign.title} · {campaign.id} · {campaign.state || "статус не указан"}
                    </li>
                  ))}
                </ul>
              ) : <p>Кампаний в ответе пока нет.</p>}
              <p><small>Здесь проверяется только доступ к кампаниям. Импорт расходов по SKU выполняется отдельным фоновым обработчиком; при ошибке 429 Ozon блокирует получение статистики, хотя авторизация успешна. До завершения импорта расходы по КМ остаются предварительными.</small></p>
            </>
          ) : (
            <><strong>Подключение не подтверждено.</strong><p>{result.error}</p></>
          )}
        </div>
      )}
    </section>
  );
}
