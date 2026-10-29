"use client";

import { useFormStatus } from "react-dom";
import Button from "../ui/Button";

export default function CreateVedDraftSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="primary-button"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? "Создаём черновик…" : "Сформировать заказ"}
    </Button>
  );
}
