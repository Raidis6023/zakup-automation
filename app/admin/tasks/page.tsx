import PageHeader from "../../ui/PageHeader";
export default function AdminTasksPage() {

  return (

    <section
      aria-label=
        "Задачи администрирования"
    >

      <PageHeader variant="admin" title="Задачи" description="Задачи администраторов и всех рабочих отделов." />


      <section
        className=
          "section"
      >

        <h2
          className=
            "section-title"
        >
          Административные задачи
        </h2>


        <div
          className=
            "muted"
        >
          Отдельное распределение задач между администраторами
          будет добавлено на следующем этапе.
        </div>

      </section>

    </section>

  );

}
