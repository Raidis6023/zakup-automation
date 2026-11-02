"use client";

import { useEffect, useState } from "react";
import styles from "./HeaderCurrencyRates.module.css";

type Currency = "USD" | "EUR" | "CNY";
type Rate = {
  official: number;
  previous: number | null;
  effectiveDate: string;
  previousDate: string | null;
  trend: "up" | "down" | "flat" | "unknown";
};
type Reply = { ok: boolean; rates?: Record<Currency, Rate>; error?: string };

const fmt = (n: number) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export default function HeaderCurrencyRates() {
  const [reply, setReply] = useState<Reply | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/cbr-rates", { cache: "no-store" });
        const data = await response.json() as Reply;
        if (!response.ok || !data.ok || !data.rates) {
          throw Error(data.error || "Курсы не получены");
        }
        if (active) setReply(data);
      } catch {
        if (active) setReply({ ok: false, error: "Курсы ЦБ временно недоступны" });
      }
    };

    void load();
    const id = window.setInterval(() => void load(), 3600000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className={styles.rates} aria-label="Курсы Банка России без надбавок">
      {(["USD", "EUR", "CNY"] as const).map(code => {
        const rate = reply?.rates?.[code];
        const indicator =
          rate?.trend === "up" ? "↑" :
          rate?.trend === "down" ? "↓" :
          rate?.trend === "flat" ? "=" : null;

        const tooltip = rate
          ? `Сегодня: ${fmt(rate.official)} ₽, вчера: ${rate.previous !== null ? fmt(rate.previous) + " ₽" : "нет данных"}`
          : reply?.error || "Загрузка курса ЦБ";

        return (
          <span
            key={code}
            className={styles.item}
            data-tooltip={tooltip}
            tabIndex={0}
            aria-label={`${code}. ${tooltip}`}
          >
            <span className={styles.code}>{code}</span>
            <span className={styles.value}>{rate ? fmt(rate.official) : "—"}</span>
            {indicator && (
              <span
                className={
                  rate?.trend === "up" ? styles.up :
                  rate?.trend === "down" ? styles.down : styles.flat
                }
                aria-label={
                  rate?.trend === "up" ? "Курс вырос" :
                  rate?.trend === "down" ? "Курс снизился" : "Курс не изменился"
                }
              >
                {indicator}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
