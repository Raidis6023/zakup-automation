import PageHeader from "../../ui/PageHeader";
import AdminUsersPanel
  from "./AdminUsersPanel";

import "./admin-users.css";


// ============================================================
// СОТРУДНИКИ
// ============================================================

export default function AdminUsersPage() {

  return (

    <section
      aria-label=
        "Сотрудники"
    >

      <PageHeader variant="admin-users" title="Сотрудники" description="Пользователи WorkSpace, их рабочие роли и административные права" />


      <AdminUsersPanel />

    </section>

  );

}
