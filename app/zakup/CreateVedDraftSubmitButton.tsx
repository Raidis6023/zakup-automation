"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import Button from "../ui/Button";

type Props = {
  hasCalculation: boolean;
  scenario: "container" | "truck" | null;
  confirmedCount: number;
};

export default function CreateVedDraftSubmitButton({
  hasCalculation,
  scenario,
  confirmedCount,
}: Props) {
  const { pending } = useFormStatus();
  const [warning, setWarning] = useState("");

  useEffect(() => {
    setWarning("");
  }, [hasCalculation, scenario, confirmedCount]);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!hasCalculation) {
      event.preventDefault();
      setWarning("Сначала выполните расчёт потребности и транспорта.");
      return;
    }

    if (!scenario) {
      event.preventDefault();
      setWarning("Транспортный сценарий требует ручного решения перед созданием заказа.");
      return;
    }

    if (confirmedCount <= 0) {
      event.preventDefault();
      setWarning("Подтвердите хотя бы один товар кнопкой «В заказ» в таблице «Потребность в закупке».");
      return;
    }

    setWarning("");
  }

  return (
    <div className="zakup-v2-order-submit">
      <Button
        type="submit"
        className="primary-button"
        disabled={pending}
        aria-disabled={pending}
        onClick={handleClick}
      >
        {pending ? "Создаём черновик…" : "Сформировать заказ"}
      </Button>
      {warning && (
        <div className="zakup-v2-order-warning" role="alert">
          {warning}
        </div>
      )}
    </div>
  );
}
