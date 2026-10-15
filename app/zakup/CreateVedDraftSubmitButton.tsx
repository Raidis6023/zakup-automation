"use client";

import { useFormStatus } from "react-dom";

export default function CreateVedDraftSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="primary-button"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? "Создаём черновик…" : "Сформировать заказ"}
    </button>
  );
}
