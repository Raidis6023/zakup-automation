"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { isTaskIssuedToAnotherDepartment } from "../HomeTasksData";
import { usePathname } from "next/navigation";
import "./tasks.css";

type Urgency = "current" | "urgent" | "critical";
type TaskStatus = "not_started" | "in_progress" | "completed";
type Tab = "my" | "other" | "notes";
type WorkTask = {
  id: string; title: string; urgency: Urgency; created_by: string;
  created_department: string; target_department: string; assignee_id: string | null;
  taken_by: string | null; status: TaskStatus; created_at: string;
  started_at: string | null; finished_at: string | null; comment: string;
  creator_name: string; assignee_name: string | null;
};
type PersonalNote = {
  id: string; title: string; urgency: Urgency; remind_at: string | null;
  status: TaskStatus; created_at: string;
};
type Snapshot = {
  user_id: string; department: string;
  tasks: WorkTask[]; notes: PersonalNote[];
};
type Action = (name: string, payload: Record<string, unknown>) => Promise<boolean>;

const DEPARTMENTS = [
  ["admin", "Администрирование"],
  ["analyst", "Аналитика"], ["procurement", "Закуп"],
  ["ved", "ВЭД"], ["category_manager:ozon", "КМ Ozon"],
  ["category_manager:wildberries", "КМ Wildberries"],
  ["category_manager:yandex_market", "КМ Яндекс Маркет"],
  ["marketing", "Маркетинг"], ["manager", "Руководство"],
  ["category_manager", "Все КМ"],
] as const;
const URGENCIES: { value: Urgency; label: string }[] = [
  { value: "current", label: "Текущая" },
  { value: "urgent", label: "Срочная" },
  { value: "critical", label: "Очень срочная" },
];
const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "Не начато" },
  { value: "in_progress", label: "Выполняется" },
  { value: "completed", label: "Выполнено" },
];
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Krasnoyarsk", day: "2-digit", month: "2-digit", year: "numeric",
});
const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Krasnoyarsk", day: "2-digit", month: "2-digit", year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Krasnoyarsk", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function deptLabel(code: string) {
  return DEPARTMENTS.find(([key]) => key === code)?.[1] ?? code;
}
function dateOf(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}
function krDay(value: string) {
  const parts = dayFormatter.format(new Date(value)).split("/");
  return Date.UTC(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) / 86400000;
}
function workDays(task: WorkTask) {
  if (!task.started_at || !task.finished_at) return "—";
  return String(Math.max(0, krDay(task.finished_at) - krDay(task.started_at)));
}
function urgencyLabel(value: Urgency) {
  return URGENCIES.find(item => item.value === value)?.label ?? value;
}
function statusLabel(value: TaskStatus) {
  return STATUSES.find(item => item.value === value)?.label ?? value;
}
function localInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const dd = dayFormatter.format(date).split("/");
  return dd[2] + "-" + dd[1] + "-" + dd[0] + "T" + timeFormatter.format(date);
}
function inputIso(value: string) {
  return value ? new Date(value + ":00+07:00").toISOString() : null;
}

function UrgencyCell({ value, editable, onChange }: {
  value: Urgency; editable?: boolean; onChange?: (next: Urgency) => void;
}) {
  if (!editable) return <span className={"tasks-pill tasks-urgency-" + value}>{urgencyLabel(value)}</span>;
  return <select aria-label="Срочность" className={"tasks-pill tasks-urgency-" + value}
    value={value} onChange={event => onChange?.(event.target.value as Urgency)}>
    {URGENCIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
  </select>;
}
function StatusCell({ value, editable, onChange }: {
  value: TaskStatus; editable?: boolean; onChange?: (next: TaskStatus) => void;
}) {
  if (!editable) return <span className={"tasks-pill tasks-status-" + value}>{statusLabel(value)}</span>;
  return <select aria-label="Статус" className={"tasks-pill tasks-status-" + value}
    value={value} onChange={event => onChange?.(event.target.value as TaskStatus)}>
    {STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
  </select>;
}


function TaskTrashIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 7h14" /><path d="M9 7V5h6v2" />
    <path d="M7 7l1 13h8l1-13" /><path d="M10 11v5" /><path d="M14 11v5" />
  </svg>;
}
function TaskRow({ task, tab, snapshot, busy, adminMode, onAction }: {
  task: WorkTask; tab: "my" | "other"; snapshot: Snapshot;
  busy: boolean; adminMode: boolean; onAction: Action;
}) {
  const [title, setTitle] = useState(task.title);
  const [urgency, setUrgency] = useState<Urgency>(task.urgency);
  const [comment, setComment] = useState(task.comment);
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setUrgency(task.urgency), [task.urgency]);
  useEffect(() => setComment(task.comment), [task.comment]);

  const canEdit = tab === "other" && task.created_by === snapshot.user_id && task.status === "not_started";
  const canComment = task.created_by === snapshot.user_id || (!adminMode && tab === "my");
  const saveDetails = () => {
    if (!canEdit || busy || (!title.trim() && task.title)) return;
    if (title.trim() !== task.title || urgency !== task.urgency) {
      void onAction("edit", { id: task.id, title: title.trim(), urgency });
    }
  };
  const saveComment = () => {
    if (canComment && !busy && comment !== task.comment) {
      void onAction("comment", { id: task.id, comment });
    }
  };
  return <tr className="tasks-data-row">
    <td>{canEdit ?
      <input className="tasks-inline-input tasks-task-title" aria-label="Задача"
        value={title} maxLength={500} disabled={busy} onChange={e => setTitle(e.target.value)}
        onBlur={saveDetails} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /> :
      <div className="tasks-task-text">{task.title}</div>}</td>
    <td><UrgencyCell value={urgency} editable={canEdit && !busy}
      onChange={next => { setUrgency(next); void onAction("edit", { id: task.id, title: title.trim(), urgency: next }); }} /></td>
    <td><span>{task.creator_name}</span></td>
    <td><div><span>{task.target_department === "admin" ? "Администраторы" : (task.assignee_name || "Не назначен")}</span>
      {tab === "other" && <span className="tasks-subtext">{deptLabel(task.target_department)}</span>}
    </div></td>
    <td><StatusCell value={task.status} /></td>
    <td className="tasks-number">{dateOf(task.created_at)}</td>
    <td className="tasks-number">{dateOf(task.started_at)}</td>
    <td className="tasks-number">{dateOf(task.finished_at)}</td>
    <td className="tasks-number tasks-days">{workDays(task)}</td>
    <td>{canComment ? <textarea className="tasks-inline-input tasks-comment"
      aria-label="Комментарий" maxLength={4000} value={comment} disabled={busy}
      rows={1} onChange={e => setComment(e.target.value)} onBlur={saveComment} /> :
      <span className={task.comment ? "tasks-comment-text" : "tasks-comment-text tasks-dash"}>{task.comment || "—"}</span>}</td>
    <td className="tasks-actions-cell">{tab === "my" && task.status === "not_started" ?
      <button className="tasks-action-button" type="button" disabled={busy}
        onClick={() => void onAction("take", { id: task.id })}>Взять в работу</button> :
      tab === "my" && task.status === "in_progress" && (adminMode || task.taken_by === snapshot.user_id) ?
        <button className="tasks-action-button tasks-finish-button" type="button" disabled={busy}
          onClick={() => void onAction("finish", { id: task.id })}>Завершить</button> : null}
      {task.created_by === snapshot.user_id && (
        <button type="button" className="tasks-delete-task"
          title="Удалить задачу" aria-label="Удалить задачу"
          disabled={busy}
          onClick={() => void onAction("delete", { id: task.id })}>
          <TaskTrashIcon />
        </button>
      )}
    </td>
  </tr>;
}

function NotesRow({ note, busy, onAction }: {
  note: PersonalNote; busy: boolean; onAction: Action;
}) {
  const [title, setTitle] = useState(note.title);
  useEffect(() => setTitle(note.title), [note.title]);
  const due = note.remind_at && note.status !== "completed" && new Date(note.remind_at).getTime() <= Date.now();
  return <tr className={due ? "tasks-note-due" : ""}>
    <td><div className="tasks-note-title">
      <input className="tasks-inline-input" value={title} disabled={busy} maxLength={500}
        aria-label="Заметка" onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
        onBlur={() => { if (title.trim() && title.trim() !== note.title) {
          void onAction("note_update", { id: note.id, title: title.trim() });
        } }} />

    </div></td>
    <td><UrgencyCell value={note.urgency} editable={!busy} onChange={value =>
      void onAction("note_update", { id: note.id, urgency: value })} /></td>
    <td><div className="tasks-note-date">
      <input type="datetime-local" className="tasks-inline-input tasks-note-date-input" aria-label="Когда напомнить (Красноярск)"
        disabled={busy} value={localInput(note.remind_at)}
        onChange={e => void onAction("note_update", {
          id: note.id, remind_at: inputIso(e.target.value),
        })} />
      {due && <span className="tasks-overdue">Время напоминания наступило</span>}
    </div></td>
    <td><StatusCell value={note.status} editable={!busy}
      onChange={value => void onAction("note_update", { id: note.id, status: value })} /></td>
    <td className="tasks-actions-cell">
      <button className="tasks-delete-task" type="button"
        title="Удалить заметку" aria-label="Удалить заметку" disabled={busy}
        onClick={() => void onAction("note_delete", { id: note.id })}>
        <TaskTrashIcon />
      </button>
    </td>
  </tr>;
}

export default function TasksBoard() {
  const adminMode = (usePathname() ?? "").startsWith("/admin");
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("my");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newUrgency, setNewUrgency] = useState<Urgency | "">("");
  const [newComment, setNewComment] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newNoteUrgency, setNewNoteUrgency] = useState<Urgency>("current");
  const [newNoteDate, setNewNoteDate] = useState("");

  const refresh = useCallback(async () => {
    const { data: result, error: fetchError } = await supabase.rpc("workspace_tasks_snapshot_v2", { p_mode: adminMode ? "admin" : "work" });
    if (fetchError) throw fetchError;
    if (!result || !Array.isArray((result as Snapshot).tasks))
      throw new Error("Сервер вернул некорректный список задач");
    setData(result as Snapshot);
  }, [supabase, adminMode]);

  useEffect(() => {
    let active = true;

    const channel = supabase
      .channel(`workspace-task-board-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workspace_task_events",
        },
        () => {
          void refresh().catch(err => {
            if (active) setError(err instanceof Error ? err.message : "Не удалось обновить задачи");
          });
        }
      )
      .subscribe();

    function handleTasksUpdated() {
      void refresh().catch(err => {
        if (active) setError(err instanceof Error ? err.message : "Не удалось обновить задачи");
      });
    }

    window.addEventListener("workspace-tasks-updated", handleTasksUpdated);
    setLoading(true);
    void refresh().catch(err => {
      if (active) setError(err instanceof Error ? err.message : "Не удалось получить задачи");
    }).finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      window.removeEventListener("workspace-tasks-updated", handleTasksUpdated);
      void supabase.removeChannel(channel);
    };
  }, [refresh, supabase]);

  const onAction = useCallback<Action>(async (name, payload) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const { error: actionError } = await supabase.rpc("workspace_task_action_v2", {
        p_mode: adminMode ? "admin" : "work", p_action: name, p_payload: payload,
      });
      if (actionError) throw actionError;
      await refresh();
      if ([
        "create",
        "take",
        "finish",
        "edit",
        "note_add",
        "note_update",
        "note_delete",
        "delete",
        "cancel",
        "comment",
      ].includes(name)) {
        window.dispatchEvent(new CustomEvent("workspace-tasks-updated"));
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения");
      await refresh().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, supabase, adminMode]);

  const myTasks = useMemo(() => data?.tasks.filter(row =>
    row.target_department === data.department ||
    (data.department.startsWith("category_manager:") &&
      row.target_department === "category_manager")) ?? [], [data]);
  const otherTasks = useMemo(() => data?.tasks.filter(row =>
    isTaskIssuedToAnotherDepartment(row, data.user_id, data.department)
  ) ?? [], [data]);
  const visible = tab === "my" ? myTasks : otherTasks;
  const canCreate = newTitle.trim().length > 0 && !!newUrgency && !!target && !busy;

  async function submitTask() {
    if (!canCreate) return;
    if (await onAction("create", {
      title: newTitle.trim(), urgency: newUrgency, target_department: target, comment: newComment,
    })) {
      setNewTitle(""); setNewUrgency(""); setNewComment(""); setTarget("");
    }
  }
  async function submitNote() {
    if (!newNote.trim() || busy) return;
    if (await onAction("note_add", {
      title: newNote.trim(), urgency: newNoteUrgency, remind_at: inputIso(newNoteDate),
    })) { setNewNote(""); setNewNoteDate(""); setNewNoteUrgency("current"); }
  }

  return <div className="tasks-board">
    <div className={"tasks-toolbar" + (tab === "other" ? " tasks-toolbar-other" : "")}>
      <div className="tasks-tabs" role="tablist" aria-label="Разделы задач">
        {([
          ["my", "Мой отдел", myTasks.length],
          ["other", "Другие отделы", otherTasks.length],
          ["notes", "Заметки", data?.notes.length ?? 0],
        ] as const).map(([key, label, count]) => <button
          type="button" key={key} className={"tasks-tab" + (tab === key ? " tasks-tab-active" : "")}
          role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
          {label} <span className="tasks-tab-count">{count}</span>
        </button>)}
      </div>
      {tab === "other" && <label className="tasks-department-picker">Отдел-получатель
        <select value={target} disabled={busy} onChange={e => setTarget(e.target.value)}>
          <option value="">Выберите отдел</option>
          {DEPARTMENTS.filter(([key]) => key !== data?.department).map(([key, label]) =>
            <option key={key} value={key}>{label}</option>)}
        </select>
      </label>}
      {tab === "notes" && <span className="tasks-timezone">Время напоминаний: Красноярск (UTC+7)</span>}
    </div>
    {error && <div className="tasks-error" role="alert">{error}
      <button type="button" onClick={() => setError("")} aria-label="Закрыть ошибку">×</button>
    </div>}
    {loading && <div className="tasks-loading">Загружаем задачи…</div>}
    {data && <section className="tasks-table-frame" aria-label={tab === "notes" ? "Заметки" : "Таблица задач"}>
      <div className="tasks-table-scroll">
        {tab !== "notes" ? <table className="tasks-table">
          <colgroup>
            <col style={{ width: 365 }} /><col style={{ width: 126 }} /><col style={{ width: 130 }} />
            <col style={{ width: 166 }} /><col style={{ width: 125 }} />
            <col style={{ width: 115 }} /><col style={{ width: 115 }} /><col style={{ width: 115 }} />
            <col style={{ width: 92 }} /><col style={{ width: 220 }} /><col style={{ width: 202 }} />
          </colgroup>
          <thead><tr>
            {["Задача", "Срочность", "Кто поставил", "Кто выполняет", "Статус",
              "Дата постановки", "Дата начала", "Дата окончания", "Дней в работе", "Комментарий", "Действие"]
              .map(label => <th key={label}>{label}</th>)}
          </tr></thead>
          <tbody>
            {tab === "other" && <tr className="tasks-draft-row">
              <td><input className="tasks-inline-input" placeholder="Введите новую задачу"
                aria-label="Новая задача" maxLength={500} value={newTitle} disabled={busy}
                onChange={e => setNewTitle(e.target.value)} /></td>
              <td><select className={"tasks-pill tasks-urgency-" + (newUrgency || "empty")}
                aria-label="Срочность новой задачи" disabled={busy} value={newUrgency}
                onChange={e => setNewUrgency(e.target.value as Urgency)}>
                <option value="">Выберите</option>
                {URGENCIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select></td>
              <td className="tasks-placeholder">Автоматически</td>
              <td className="tasks-placeholder">{target === "admin" ? "Администраторы" : "Назначит отдел"}</td>
              <td><StatusCell value="not_started" /></td>
              <td className="tasks-placeholder tasks-center">Автоматически</td>
              <td className="tasks-placeholder tasks-dash">—</td>
              <td className="tasks-placeholder tasks-dash">—</td>
              <td className="tasks-placeholder tasks-dash">—</td>
              <td><textarea className="tasks-inline-input tasks-comment" rows={1} maxLength={4000}
                aria-label="Комментарий к новой задаче" placeholder="Комментарий"
                disabled={busy} value={newComment}
                onChange={e => setNewComment(e.target.value)} /></td>
              <td className="tasks-actions-cell"><button type="button"
                className="tasks-action-button" disabled={!canCreate} onClick={() => void submitTask()}>
                Поставить задачу
              </button></td>
            </tr>}
            {visible.map(task => <TaskRow key={task.id} task={task}
              tab={tab as "my" | "other"} snapshot={data} busy={busy}
              adminMode={adminMode} onAction={onAction} />)}
            {visible.length === 0 && <tr><td colSpan={11} className="tasks-empty">
              {tab === "my" ? "Вашему отделу пока не поставлено задач." : "Задач другим отделам пока нет."}
            </td></tr>}
          </tbody>
        </table> : <table className="tasks-table tasks-notes-table">
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead><tr><th>Заметка</th><th>Срочность</th><th>Когда напомнить</th><th>Статус</th><th>Действие</th></tr></thead>
          <tbody>
            <tr className="tasks-draft-row">
              <td><div className="tasks-note-title">
                <input className="tasks-inline-input" maxLength={500} value={newNote} disabled={busy}
                  placeholder="Новая заметка" aria-label="Новая заметка"
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void submitNote(); }} />
              </div></td>
              <td><UrgencyCell value={newNoteUrgency} editable={!busy} onChange={setNewNoteUrgency} /></td>
              <td><div className="tasks-note-date">
                <input className="tasks-inline-input tasks-note-date-input" type="datetime-local"
                  aria-label="Дата и время новой заметки (Красноярск)" value={newNoteDate}
                  disabled={busy} onChange={e => setNewNoteDate(e.target.value)} />
              </div></td>
              <td><StatusCell value="not_started" /></td>
              <td className="tasks-actions-cell">
                <button type="button" className="tasks-action-button" disabled={busy || !newNote.trim()}
                  onClick={() => void submitNote()}>Добавить</button>
              </td>
            </tr>
            {data.notes.map(note => <NotesRow key={note.id} note={note} busy={busy} onAction={onAction} />)}
            {data.notes.length === 0 && <tr><td colSpan={5} className="tasks-empty">
              Здесь будут ваши личные заметки. Их не видят другие сотрудники.
            </td></tr>}
          </tbody>
        </table>}
      </div>
    </section>}
  </div>;
}
