"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshAllOzonData, type OzonManualSyncResult } from "./actions";

type RateLimit = { nextAllowedAt?: string | null; lastHttpStatus?: number | null };
type SyncStateResponse = { ok?: boolean; stocks?: RateLimit; sales?: RateLimit };

function dailyWindow(now: number) {
  const d = new Date(now);
  const minute = d.getUTCHours() * 60 + d.getUTCMinutes();
  return minute >= 21 * 60 + 55 && minute < 22 * 60 + 10;
}

export default function OzonUnifiedSyncClient() {
  const router = useRouter();
  const [now, setNow] = useState(0);
  const [loadingStates, setLoadingStates] = useState(true);
  const [states, setStates] = useState<SyncStateResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OzonManualSyncResult | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/ozon-sync-state", { cache: "no-store" });
        const json = await response.json() as SyncStateResponse;
        if (active) setStates(response.ok && json.ok ? json : null);
      } catch {
        if (active) setStates(null);
      } finally {
        if (active) setLoadingStates(false);
      }
    }
    void load();
    const interval = window.setInterval(() => void load(), 60000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const limited = (["stocks", "sales"] as const).map(key => {
    const row = states?.[key];
    const until = row?.nextAllowedAt ? Date.parse(row.nextAllowedAt) : NaN;
    return { key, until, unknown: row?.lastHttpStatus === 429 && !row?.nextAllowedAt };
  });
  const nextAllowed = limited.filter(x => Number.isFinite(x.until) && x.until > now)
    .sort((a, b) => b.until - a.until)[0];
  const unknownLimit = limited.some(x => x.unknown);
  const cronWindow = now > 0 && dailyWindow(now);
  const disabled = running || loadingStates || !states || Boolean(nextAllowed) || unknownLimit || cronWindow;

  const blockedReason = cronWindow
    ? "Ежедневная синхронизация Ozon: дождитесь окончания окна после 05:10 (Красноярск)."
    : nextAllowed
      ? `Лимит ${nextAllowed.key === "stocks" ? "остатков" : "продаж"}: доступно через ${Math.max(1, Math.ceil((nextAllowed.until - now) / 60000))} мин.`
      : unknownLimit
        ? "Лимит Ozon: время снятия ограничения неизвестно."
        : !loadingStates && !states ? "Не удалось проверить лимиты API Ozon." : "";

  async function run() {
    if (disabled) return;
    setRunning(true);
    setResult(null);
    try {
      const response = await refreshAllOzonData();
      setResult(response);
      if (response.ok) router.refresh();
      // Refresh preflight states after every attempt, including rate limits.
      const stateResponse = await fetch("/api/ozon-sync-state", { cache: "no-store" });
      const state = await stateResponse.json() as SyncStateResponse;
      setStates(stateResponse.ok && state.ok ? state : null);
    } catch (error) {
      setResult({
        ok: false,
        message: "Ошибка обращения к серверу. Проверьте текущие данные, прежде чем повторять обновление.",
        warning: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="ozon-unified-sync">
      <button type="button" className="ozon-sync-hero-action" onClick={() => void run()}
        disabled={disabled} aria-busy={running}>
        <span aria-hidden="true" className={running ? "ozon-unified-sync-icon ozon-unified-sync-icon--loading" : "ozon-unified-sync-icon"}>⟳</span>
        {running ? "Обновляем продажи и остатки..." : "Обновить данные"}
      </button>
      <div
        className={result
          ? result.ok
            ? "ozon-unified-sync-note ozon-unified-sync-note--success"
            : "ozon-unified-sync-note ozon-unified-sync-note--error"
          : "ozon-unified-sync-note"
        }
        title={result
          ? [result.message, result.warning].filter(Boolean).join(" ")
          : blockedReason
        }
        role="status"
      >
        {result
          ? [result.message, result.warning].filter(Boolean).join(" ")
          : !running ? blockedReason : ""}
      </div>
    </div>
  );
}
