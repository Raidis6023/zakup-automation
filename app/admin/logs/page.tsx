import PageHeader from "../../ui/PageHeader";
import LogsClient from "./LogsClient";
import "./logs.css";

export const dynamic = "force-dynamic";

export default function AdminLogsPage() {
  return (
    <section aria-label="История логов">
      <PageHeader variant="admin" title="История логов"
        description="Действия сотрудников, изменения данных и состояние системных процессов." />
      <LogsClient />
    </section>
  );
}
