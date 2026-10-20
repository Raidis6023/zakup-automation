"use client";
import { useEffect, useState, type ReactNode } from "react";
import LoginForm from "./LoginForm";
import LoginPanda from "./LoginPanda";
import AccessRequestForm from "./AccessRequestForm";
import RegistrationWaiting from "./RegistrationWaiting";

export default function LoginExperience({ children, blocked = false }: { children: ReactNode; blocked?: boolean }) {
  const [screen, setScreen] = useState<"login" | "access" | "waiting">("login");
  const [initialEmail, setInitialEmail] = useState("");
  const [accessKey, setAccessKey] = useState(0);

  useEffect(() => {
    if (blocked) return;
    let alive = true;
    void fetch("/api/registration/status", { cache: "no-store" })
      .then(r => r.json())
      .then(result => {
        if (alive && result.ok && ["pending", "approved"].includes(result.status)) {
          setScreen("waiting");
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [blocked]);

  const openAccess = (email: string) => {
    setInitialEmail(email.trim());
    setAccessKey(key => key + 1);
    setScreen("access");
  };

  const backToLogin = () => setScreen("login");
  const mode = screen === "waiting" ? "waiting" :
    screen === "access" ? "access" : blocked ? "blocked" : "login";

  return (
    <div className="login-layout">
      {screen === "login" ? (
        <section className="login-card">
          <div className="login-logo">
            <img src="/logos/babushkina-marketplace.png" alt="ИП Бабушкина Маркетплейсы" />
          </div>
          <div className="login-heading">
            <h1>Вход в WorkSpace</h1>
            <p>Введите данные вашей учётной записи</p>
          </div>
          {children}
          <LoginForm onRequestAccess={openAccess} />
        </section>
      ) : screen === "access" ? (
        <section className="login-card login-access-card">
          <AccessRequestForm key={accessKey} initialEmail={initialEmail}
            onBack={backToLogin} onSubmitted={() => setScreen("waiting")} />
        </section>
      ) : (
        <section className="login-card login-access-card">
          <RegistrationWaiting onBack={backToLogin} />
        </section>
      )}
      <LoginPanda key={mode + (mode === "access" ? accessKey : "")} mode={mode} />
    </div>
  );
}
