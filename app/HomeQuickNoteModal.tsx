"use client";

import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import styles from "./HomeHeaderActions.module.css";
import { TimeField } from "@/app/ui/WorkspaceDateFields";

type Urgency = "current" | "urgent" | "critical";

type Props = {
  date: string;
  onClose: () => void;
};

const URGENCIES: { value: Urgency; label: string }[] = [
  { value: "current", label: "Текущая" },
  { value: "urgent", label: "Срочная" },
  { value: "critical", label: "Очень срочная" },
];

function formatSelectedDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function reminderIso(date: string, time: string) {
  const value = new Date(date + "T" + time + ":00+07:00");
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

export default function HomeQuickNoteModal({ date, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("current");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveNote() {
    if (!title.trim() || !time || saving) return;

    const remindAt = reminderIso(date, time);
    if (!remindAt) {
      setError("Проверьте выбранные дату и время.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error: actionError } = await supabase.rpc("workspace_task_action", {
        p_action: "note_add",
        p_payload: {
          title: title.trim(),
          urgency,
          status: "not_started",
          remind_at: remindAt,
        },
      });

      if (actionError) throw actionError;

      window.dispatchEvent(new CustomEvent("workspace-tasks-updated"));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить заметку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="home-popup home-calendar-note-popup"
      role="dialog"
      aria-labelledby="calendar-note-title"
    >
      <div className="home-popup-header home-calendar-note-header">
        <div>
          <strong id="calendar-note-title">Новая заметка</strong>
          <span>Напоминание на {formatSelectedDate(date)}</span>
        </div>
        <button
          type="button"
          className="home-calendar-note-close"
          aria-label="Закрыть"
          onClick={onClose}
          disabled={saving}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="home-calendar-note-body">
          <form
            className={styles.noteForm}
            onSubmit={event => {
              event.preventDefault();
              void saveNote();
            }}
          >
            <label className={styles.noteField}>
              <span>Текст заметки</span>
              <textarea
                className={styles.noteControl + " " + styles.noteTextarea}
                value={title}
                maxLength={500}
                autoFocus
                required
                disabled={saving}
                placeholder="Введите текст заметки"
                onChange={event => setTitle(event.target.value)}
              />
            </label>
  
            <label className={styles.noteField}>
              <span>Срочность</span>
              <select
                className={styles.noteControl}
                value={urgency}
                disabled={saving}
                onChange={event => setUrgency(event.target.value as Urgency)}
              >
                {URGENCIES.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
  
            <div className={styles.noteDateGrid}>
              <label className={styles.noteField}>
                <span>Дата напоминания</span>
                <input
                  className={styles.noteControl + " " + styles.noteDateControl}
                  type="text"
                  value={formatSelectedDate(date)}
                  readOnly
                  aria-label="Выбранная дата напоминания"
                />
              </label>
  
              <label className={styles.noteField}>
                <span>Время напоминания</span>
                <TimeField
                  className={styles.noteControl}
                  step={60}
                  value={time}
                  required
                  disabled={saving}
                  aria-label="Время напоминания по Красноярску"
                  onChange={event => setTime(event.target.value)}
                />
                <small className={styles.noteHint}>Красноярск (UTC+7). Время можно выбрать или ввести с клавиатуры.</small>
              </label>
            </div>
  
            {error && <div className={styles.actionError} role="alert">{error}</div>}
  
            <div className={styles.noteFooter}>
              <span className={styles.footerHint}>Новая заметка будет доступна только вам в разделе «Задачи → Заметки».</span>
              <div className={styles.noteFooterActions}>
                <button
                  type="button"
                  className={styles.closeFooterButton}
                  onClick={onClose}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={styles.approveButton}
                  disabled={!title.trim() || !time || saving}
                >
                  {saving ? "Сохраняем..." : "Добавить"}
                </button>
              </div>
            </div>
          </form>
      </div>
    </div>
  );
}
