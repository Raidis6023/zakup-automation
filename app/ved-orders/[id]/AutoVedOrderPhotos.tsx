"use client";

import { useEffect, useRef, useState } from "react";
import { refreshVedOrderPhotos } from "../../actions";

// Avoid repeatedly calling Ozon if a card has no usable photo.
// The next attempt happens when the order is revisited after this interval.
const RETRY_COOLDOWN_MS = 10 * 60 * 1000;

export default function AutoVedOrderPhotos({
  orderId,
}: {
  orderId: string;
}) {
  const started = useRef(false);
  const [status, setStatus] = useState<"loading" | "idle" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Protect against duplicate effect execution in React Strict Mode.
    if (started.current) return;
    started.current = true;

    const storageKey = `ved-order-ozon-photos-attempt:${orderId}`;
    const now = Date.now();

    try {
      const previous = Number(sessionStorage.getItem(storageKey) ?? 0);
      if (Number.isFinite(previous) && now - previous < RETRY_COOLDOWN_MS) {
        return;
      }
      sessionStorage.setItem(storageKey, String(now));
    } catch {
      // Session storage may be disabled; the in-memory guard still applies.
    }

    setStatus("loading");
    setMessage("Загружаем недостающие фотографии Ozon…");

    void (async () => {
      try {
        const result = await refreshVedOrderPhotos(orderId);
        const newlyLoaded =
          result.loaded_from_ozon + result.copied_from_product;

        if (newlyLoaded > 0) {
          // Refresh the order detail and the server-side missing-photo check.
          window.location.reload();
          return;
        }

        setStatus("idle");

        if (result.missing_in_ozon > 0) {
          const details = result.ozon_fallback_error
            ? ` Причина дополнительного запроса: ${result.ozon_fallback_error}`
            : "";

          setMessage(
            `Ozon пока не предоставил фото для ${result.missing_in_ozon} позиций. ` +
              "Повторная попытка при следующем открытии заказа, не чаще раза в 10 минут." +
              details
          );
        } else {
          setMessage(null);
        }
      } catch (cause) {
        setStatus("error");
        setMessage(
          "Не удалось автоматически загрузить фотографии Ozon: " +
            (cause instanceof Error ? cause.message : "неизвестная ошибка")
        );
      }
    })();
  }, [orderId]);

  if (!message) return null;

  return (
    <span
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      style={{
        display: "inline-block",
        fontSize: "12px",
        maxWidth: "400px",
        opacity: 0.9,
      }}
    >
      {message}
    </span>
  );
}
