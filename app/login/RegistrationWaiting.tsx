"use client";

import { useEffect, useState } from "react";

export default function RegistrationWaiting({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<"pending" | "rejected" | "expired" | "checking">("checking");

  useEffect(() => {
    let mounted = true;
    let busy = false;
    async function check() {
      if (busy) return;
      busy = true;
      try {
        const res = await fetch("/api/registration/status", { cache: "no-store" });
        const data = await res.json();
        if (!mounted) return;
        if (data.status === "approved") {
          window.location.assign("/set-password");
          return;
        }
        if (data.status === "pending") setStatus("pending");
        else if (data.status === "rejected") setStatus("rejected");
        else setStatus("expired");
      } catch {
        if (mounted) setStatus(current => current === "checking" ? "pending" : current);
      } finally { busy = false; }
    }
    void check();
    const timer = window.setInterval(() => void check(), 7000);
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const waiting = status === "pending" || status === "checking";
  return (
    <div className="access-screen access-success" role="status" aria-live="polite">
      {waiting ? (
        <>
          <div className="registration-loading-icon" aria-hidden="true" />
          <h2>Ожидаем подтверждения Администраторов</h2>
          <p>Заявка отправлена. Когда Администратор назначит рабочую роль, вы автоматически перейдёте к созданию пароля.</p>
          <p className="registration-waiting-hint">Необязательно держать вкладку открытой. Ожидание можно продолжить в этом браузере в течение 30 дней.</p>
        </>
      ) : (
        <>
          <h2>{status === "rejected" ? "Заявка отклонена" : "Срок ожидания истёк"}</h2>
          <p>{status === "rejected"
            ? "Администратор отклонил заявку. Обратитесь к нему за подробностями."
            : "Для продолжения регистрации обратитесь к Администратору."}</p>
          <button type="button" className="access-primary-button access-success-button" onClick={onBack}>Вернуться ко входу</button>
        </>
      )}
    </div>
  );
}
