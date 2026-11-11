"use client";

import { useActionState } from "react";
import {
  runChinaCalculation,
  type ChinaCalculationSubmitState,
} from "../actions";

const initialState: ChinaCalculationSubmitState = {
  ok: null,
  message: "",
};

export default function ZakupCalculateButton() {
  const [state, formAction, pending] = useActionState(
    runChinaCalculation,
    initialState,
  );

  return (
    <form action={formAction} className="zakup-calculate-form">
      <button
        type="submit"
        className="primary-button"
        disabled={pending}
        aria-disabled={pending}
      >
        {pending ? "Считаем потребность и объём…" : "Рассчитать потребность"}
      </button>
      {state.ok === false ? (
        <div role="alert" className="zakup-calculate-message zakup-calculate-message--error">
          {state.message}
        </div>
      ) : state.ok === true ? (
        <div role="status" className="zakup-calculate-message zakup-calculate-message--success">
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
