import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readRegistrationSession } from "@/lib/registration/session";
import SetPasswordForm from "./SetPasswordForm";
import "./set-password.css";

export default async function SetPasswordPage() {
  const onboarding = await readRegistrationSession();
  const registration = onboarding?.request.status === "approved"
    && !onboarding.request.approved_user_id;

  if (!registration) {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) redirect("/login");
    const { data: mustChangePassword, error: flagError } =
      await supabase.rpc("app_get_must_change_password");
    if (flagError || !mustChangePassword) redirect("/");
  }

  return (
    <main className="set-password-page">
      <section className="set-password-card">
        <div className="set-password-logo">
          <img src="/logos/babushkina-marketplace.png" alt="ИП Бабушкина Маркетплейсы" />
        </div>
        <div className="set-password-heading">
          <h1>Создайте свой пароль</h1>
          <p>Придумайте постоянный пароль для входа в вашу учётную запись WorkSpace.</p>
        </div>
        <SetPasswordForm mode={registration ? "registration" : "change"} />
      </section>
    </main>
  );
}
