"use client";

import { useEffect, useRef } from "react";
import { refreshVedOrderPhotos } from "../../actions";

// Keep background photo retrieval, without placing loading/error messages in the header.
const RETRY_COOLDOWN_MS = 10 * 60 * 1000;

export default function AutoVedOrderPhotos({ orderId }: { orderId: string }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const storageKey = `ved-order-ozon-photos-attempt:${orderId}`;
    const now = Date.now();

    try {
      const previous = Number(sessionStorage.getItem(storageKey) ?? 0);
      if (Number.isFinite(previous) && now - previous < RETRY_COOLDOWN_MS) return;
      sessionStorage.setItem(storageKey, String(now));
    } catch {
      // Browser storage may be unavailable, so keep the ref guard.
    }

    void (async () => {
      try {
        const result = await refreshVedOrderPhotos(orderId);
        if (result.loaded_from_ozon + result.copied_from_product > 0) {
          window.location.reload();
        }
        // Missing photos remain visible in the order's own product rows;
        // no technical status text is injected beside navigation links.
      } catch (cause) {
        console.error("Не удалось автоматически загрузить фотографии заказа ВЭД:", cause);
      }
    })();
  }, [orderId]);

  return null;
}
