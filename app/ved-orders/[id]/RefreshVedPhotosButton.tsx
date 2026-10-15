"use client";

import { useState } from "react";
import { refreshVedOrderPhotos } from "../../actions";

export default function RefreshVedPhotosButton({
  orderId,
}: {
  orderId: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function refreshPhotos() {
    if (pending) return;

    setPending(true);
    setMessage(null);
    setError(false);

    try {
      const result = await refreshVedOrderPhotos(orderId);
      const loaded = result.loaded_from_ozon + result.copied_from_product;

      if (loaded > 0) {
        // Order details are fetched by the existing client component on mount.
        // Reloading ensures that all refreshed photo URLs are immediately shown.
        window.location.reload();
        return;
      }

      setMessage(
        result.missing_in_ozon > 0
          ? `Ozon не вернул фото для ${result.missing_in_ozon} позиций. Проверьте, есть ли изображения в карточках Ozon.`
          : "Все доступные фотографии уже загружены."
      );
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Не удалось получить фотографии из Ozon."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="secondary-button"
        disabled={pending}
        aria-disabled={pending}
        onClick={refreshPhotos}
        title="Повторно загрузить отсутствующие фотографии из Ozon API"
      >
        {pending ? "Получаем фото…" : "Обновить фото Ozon"}
      </button>

      {message && (
        <span
          role={error ? "alert" : "status"}
          style={{ fontSize: "12px", maxWidth: "400px" }}
        >
          {message}
        </span>
      )}
    </>
  );
}
