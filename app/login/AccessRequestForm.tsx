"use client";
import { useState, type FormEvent } from "react";
import { createClient } from "../../lib/supabase/client";

type Props = { initialEmail: string; onBack: () => void };

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

export default function AccessRequestForm({ initialEmail, onBack }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [department, setDepartment] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    const name = firstName.trim();
    const surname = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const dept = department.trim();
    const note = comment.trim();
    if (!name) { setError("Введите имя"); return; }
    if (!surname) { setError("Введите фамилию"); return; }
    if (!normalizedEmail) { setError("Введите email"); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: requestError } = await supabase.rpc("app_submit_access_request", {
        p_first_name: name,
        p_last_name: surname,
        p_email: normalizedEmail,
        p_department: dept || null,
        p_comment: note || null,
      });
      if (requestError) {
        const message = requestError.message.toLowerCase();
        if (message.includes("уже существует")) setError("Для этого email уже существует учётная запись или активный запрос доступа");
        else if (message.includes("корректный email")) setError("Введите корректный email");
        else if (message.includes("корректное имя")) setError("Введите корректное имя");
        else if (message.includes("корректную фамилию")) setError("Введите корректную фамилию");
        else if (message.includes("название отдела слишком длинное")) setError("Название отдела слишком длинное");
        else if (message.includes("комментарий слишком длинный")) setError("Комментарий слишком длинный");
        else setError("Не удалось отправить запрос. Попробуйте ещё раз");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="access-screen">
      <button className="access-modal-close" type="button" aria-label="Вернуться ко входу" title="Вернуться ко входу" onClick={onBack} disabled={loading}>
        <CloseIcon />
      </button>
      {success ? (
        <div className="access-success" role="status">
          <div className="access-success-icon" aria-hidden="true">✓</div>
          <h2>Запрос отправлен</h2>
          <p>Администратор рассмотрит заявку и назначит вам доступ к WorkSpace.</p>
          <button type="button" className="access-primary-button access-success-button" onClick={onBack}>Готово</button>
        </div>
      ) : (
        <>
          <div className="access-modal-heading">
            <h1>Запрос доступа</h1>
            <p>Оставьте свои данные. Администратор назначит роль и предоставит доступ к WorkSpace.</p>
          </div>
          <form className="access-request-form" onSubmit={handleSubmit}>
            <div className="access-name-grid">
              <label className="login-field">
                <span>Имя *</span>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name" maxLength={100} required disabled={loading} />
              </label>
              <label className="login-field">
                <span>Фамилия *</span>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name" maxLength={100} required disabled={loading} />
              </label>
            </div>
            <label className="login-field">
              <span>Email *</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" maxLength={254} placeholder="name@company.ru" required disabled={loading} />
            </label>
            <label className="login-field">
              <span>Отдел</span>
              <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                maxLength={150} placeholder="Например: Закуп" disabled={loading} />
            </label>
            <label className="login-field access-comment-field">
              <span>Комментарий</span>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                maxLength={2000} placeholder="При необходимости" disabled={loading} />
            </label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <div className="access-modal-actions">
              <button type="button" className="access-secondary-button" onClick={onBack} disabled={loading}>Отмена</button>
              <button type="submit" className="access-primary-button" disabled={loading}>
                {loading ? "Отправляем..." : "Отправить запрос"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
