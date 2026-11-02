import PageHeader from "../ui/PageHeader";
import TasksBoard from "./TasksBoard";

export default function TasksPage() {
  return (
    <main className="page tasks-page">
      <PageHeader
        title="Задачи"
        description="Задачи вашего отдела, поручения другим отделам и личные заметки."
      />
      <TasksBoard />
    </main>
  );
}
