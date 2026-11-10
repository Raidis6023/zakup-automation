"use client";

import { useFormStatus } from "react-dom";

export default function ZakupCalculateButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="primary-button"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? "Считаем потребность и объём…" : "Рассчитать потребность"}
    </button>
  );
}
