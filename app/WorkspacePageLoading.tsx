import "./workspace-page-loading.css";

export default function WorkspacePageLoading() {

  return (

    <main
      className="workspace-page-loading"
      aria-label="Загрузка раздела"
      aria-busy="true"
    >

      <div className="workspace-page-loading__container">

        <div className="workspace-page-loading__header">

          <div className="workspace-page-loading__heading">

            <div className="workspace-page-loading__line workspace-page-loading__line--eyebrow" />

            <div className="workspace-page-loading__line workspace-page-loading__line--title" />

            <div className="workspace-page-loading__line workspace-page-loading__line--subtitle" />

          </div>


          <div className="workspace-page-loading__actions">

            <div className="workspace-page-loading__button" />

            <div className="workspace-page-loading__button" />

          </div>

        </div>


        <div className="workspace-page-loading__cards">

          {
            Array.from(
              {
                length: 5,
              }
            ).map(
              (
                _,
                index
              ) => (

                <div
                  key={index}
                  className="workspace-page-loading__card"
                >

                  <div className="workspace-page-loading__icon" />

                  <div className="workspace-page-loading__card-copy">

                    <div className="workspace-page-loading__line workspace-page-loading__line--label" />

                    <div className="workspace-page-loading__line workspace-page-loading__line--number" />

                    <div className="workspace-page-loading__line workspace-page-loading__line--hint" />

                  </div>

                </div>

              )
            )
          }

        </div>


        <div className="workspace-page-loading__panel">

          <div className="workspace-page-loading__panel-top">

            <div className="workspace-page-loading__line workspace-page-loading__line--section-title" />

            <div className="workspace-page-loading__button workspace-page-loading__button--small" />

          </div>


          <div className="workspace-page-loading__table">

            <div className="workspace-page-loading__table-head" />

            {
              Array.from(
                {
                  length: 8,
                }
              ).map(
                (
                  _,
                  index
                ) => (

                  <div
                    key={index}
                    className="workspace-page-loading__table-row"
                  >

                    <div className="workspace-page-loading__line workspace-page-loading__line--cell-wide" />

                    <div className="workspace-page-loading__line workspace-page-loading__line--cell" />

                    <div className="workspace-page-loading__line workspace-page-loading__line--cell" />

                    <div className="workspace-page-loading__line workspace-page-loading__line--cell-short" />

                  </div>

                )
              )
            }

          </div>

        </div>

      </div>

    </main>

  );

}
