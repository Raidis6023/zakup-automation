import PageHeader from "../../ui/PageHeader";
import ApiConnectionsClient from "./ApiConnectionsClient";
import "./api-settings.css";

export const dynamic = "force-dynamic";

export default function AdminApiPage() {
  return (
    <main className="api-settings-page workspace-ui">
      <PageHeader
        variant="admin"
        title="API"
        description="Подключения внешних сервисов и управление ключами доступа."
      />
      <ApiConnectionsClient />
    </main>
  );
}
