import PageHeader from "../../ui/PageHeader";
import TasksBoard from "../../tasks/TasksBoard";

export default function AdminTasksPage() {
  return (
    <main className="page tasks-page">
      <PageHeader
        variant="admin"
        title="Задачи"
        description="Задачи вашего отдела, поручения другим отделам и личные заметки."
      />
      <TasksBoard />
    </main>
  );
}
