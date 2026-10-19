"use client";
import { useState, type ReactNode } from "react";
import LoginForm from "./LoginForm";
import LoginPanda from "./LoginPanda";
import AccessRequestForm from "./AccessRequestForm";

export default function LoginExperience({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<"login" | "access">("login");
  const [initialEmail, setInitialEmail] = useState("");
  const [accessKey, setAccessKey] = useState(0);

  const openAccess = (email: string) => {
    setInitialEmail(email.trim());
    setAccessKey(key => key + 1);
    setScreen("access");
  };

  const backToLogin = () => setScreen("login");

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
      ) : (
        <section className="login-card login-access-card">
          <AccessRequestForm key={accessKey} initialEmail={initialEmail} onBack={backToLogin} />
        </section>
      )}
      <LoginPanda key={screen + (screen === "access" ? accessKey : "")} mode={screen} />
    </div>
  );
}
