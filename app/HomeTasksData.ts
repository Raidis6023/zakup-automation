export type TaskUrgency = "current" | "urgent" | "critical";
export type TaskDotColor = "gray" | "yellow" | "orange" | "red";
export type TaskStatus = "not_started" | "in_progress" | "completed";
export type TaskItem = { id: string; title: string; creator: string; assignee: string; dotColor: TaskDotColor; };
export type PersonalNote = { id: string; title: string; urgency: TaskUrgency; remind_at: string | null; status: TaskStatus; created_at: string; };
export type WorkspaceTaskRecord = {
  id: string; title: string; urgency: TaskUrgency; created_by: string;
  created_department: string; target_department: string; assignee_id: string | null;
  taken_by: string | null; status: TaskStatus; created_at: string;
  creator_name: string; assignee_name: string | null;
};
export type WorkspaceTaskSnapshot = {
  user_id: string; department: string; tasks: WorkspaceTaskRecord[]; notes: PersonalNote[];
};
export function getUrgencyDotColor(urgency: TaskUrgency): TaskDotColor {
  if (urgency === "critical") return "red";
  if (urgency === "urgent") return "orange";
  return "yellow";
}
function toTaskItem(task: WorkspaceTaskRecord, accepted: boolean): TaskItem {
  return {
    id: task.id, title: task.title, creator: task.creator_name || "Сотрудник",
    assignee: task.assignee_name || (accepted ? "Исполнитель" : "Ожидает исполнителя"),
    dotColor: accepted ? getUrgencyDotColor(task.urgency) : "gray",
  };
}
export function buildMyWorkspaceTasks(snapshot: WorkspaceTaskSnapshot | null): TaskItem[] {
  if (!snapshot) return [];
  return snapshot.tasks
    .filter(task => task.status === "in_progress"
      && (task.taken_by === snapshot.user_id || task.assignee_id === snapshot.user_id))
    .map(task => toTaskItem(task, true));
}
export function buildUnacceptedWorkspaceTasks(snapshot: WorkspaceTaskSnapshot | null): TaskItem[] {
  if (!snapshot) return [];
  return snapshot.tasks
    .filter(task =>
      (
        task.target_department === snapshot.department
        || (
          snapshot.department.startsWith("category_manager:")
          && task.target_department === "category_manager"
        )
      )
      && task.status === "not_started"
      && task.taken_by === null
    )
    .map(task => toTaskItem(task, false));
}
export function buildCreatedByMeWorkspaceTasks(snapshot: WorkspaceTaskSnapshot | null): TaskItem[] {
  if (!snapshot) return [];
  return snapshot.tasks
    .filter(task => task.created_by === snapshot.user_id
      && task.created_department !== task.target_department
      && task.status !== "completed")
    .map(task => toTaskItem(task,
      task.status === "in_progress" && (task.taken_by !== null || task.assignee_id !== null)));
}
export function buildPersonalNotes(snapshot: WorkspaceTaskSnapshot | null): PersonalNote[] {
  return snapshot?.notes ?? [];
}
