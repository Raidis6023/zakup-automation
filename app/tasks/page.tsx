import PageHeader from "../ui/PageHeader";
import "./tasks.css";


export default function TasksPage() {

  return (

    <section
      aria-label=
        "Задачи"
    >

      <PageHeader variant="home" title="Задачи" description="Задачи вашей рабочей роли и личные заметки." />


      <section
        className=
          "section tasks-page-intro"
      >

        <h2
          className=
            "section-title"
        >
          Рабочие задачи
        </h2>


        <div
          className=
            "muted"
        >
          Полноценный реестр задач подключим следующим этапом.
          Пока актуальные задачи доступны через иконку
          «Задачи» в верхней панели.
        </div>

      </section>

    </section>

  );

}
