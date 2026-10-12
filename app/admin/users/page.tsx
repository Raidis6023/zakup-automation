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

      <div
        className=
          "admin-users-header"
      >

        <div>

          <h1>
            Сотрудники
          </h1>


          <p>
            Пользователи WorkSpace,
            их рабочие роли и
            административные права
          </p>

        </div>

      </div>


      <AdminUsersPanel />

    </section>

  );

}
