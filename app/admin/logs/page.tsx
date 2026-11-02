import PageHeader from "../../ui/PageHeader";
export default function AdminLogsPage() {

  return (

    <section
      aria-label=
        "История логов"
    >

      <PageHeader variant="admin" title="История логов" description="Журнал административных действий в WorkSpace." />


      <section
        className=
          "section"
      >

        <h2
          className=
            "section-title"
        >
          История действий
        </h2>


        <div
          className=
            "muted"
        >
          Здесь будет отображаться история изменений,
          выполненных администраторами.
        </div>

      </section>

    </section>

  );

}
