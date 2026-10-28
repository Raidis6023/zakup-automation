import { redirect } from "next/navigation";

import ThemeToggle
  from "../ThemeToggle";

import StockImportClient
  from "../StockImportClient";

import {
  confirmStockImport,
  getStockImportPreview,
} from "../actions";


type PreviewRow = {
  id: number;

  source_row_number:
    number;

  warehouse_name:
    string;

  product_name:
    string | null;

  offer_id:
    string | null;

  free_stock:
    number | null;

  barcode:
    string | null;

  match_status:
    "matched"
    | "new_product"
    | "error";

  error_message:
    string | null;
};


type PreviewData = {

  batch: {
    id: string;

    source_file_name:
      string;

    report_date:
      string;

    status:
      string;

    total_rows:
      number;

    matched_rows:
      number;

    new_product_rows:
      number;

    error_rows:
      number;

    imported_rows:
      number;

    created_products:
      number;
  } | null;


  rows:
    PreviewRow[];
};


function statusName(
  status:
    PreviewRow["match_status"]
) {

  switch (status) {

    case "matched":
      return "Найден";


    case "new_product":
      return "Новый товар";


    case "error":
      return "Ошибка";

  }
}


export default async function StockImportPage({
  searchParams,
}: {
  searchParams:
    Promise<{
      batch?: string;
    }>;
}) {

  const params =
    await searchParams;


  const batchId =
    params.batch;


  let preview:
    PreviewData | null = null;


  let loadError =
    "";


  if (batchId) {

    try {

      preview =
        await getStockImportPreview(
          batchId
        ) as PreviewData;

    } catch (error) {

      loadError =
        error instanceof Error
          ? error.message
          : "Ошибка загрузки preview";

    }

  }


  return (

    <main className="page">

      <div className="container">


        <header className="header">

          <div>

            <div className="small-label">
              СИСТЕМА ЗАКУПА
            </div>


            <h1 className="title">
              Загрузка остатков АВЕДЭКС
            </h1>


            <p className="subtitle">
              Предварительная проверка
              Excel перед записью
              в Supabase.
            </p>

          </div>


          <div className="header-actions">

            <ThemeToggle />




          </div>

        </header>


        <section className="section">

          <div className="section-header">

            <div>

              <h2 className="section-title">
                Загрузить Excel
              </h2>


              <div className="muted">
                Для расчёта используется
                колонка «Свободный остаток».
              </div>

            </div>

          </div>


          <StockImportClient />

        </section>


        {loadError && (

          <section className="section">

            <strong>
              Ошибка
            </strong>

            <div className="reason-text">
              {loadError}
            </div>

          </section>

        )}


        {preview?.batch && (

          <>

            <section className="summary-grid">


              <div className="card">

                <div className="card-label">
                  Всего строк
                </div>

                <div className="big-number">
                  {
                    preview
                      .batch
                      .total_rows
                  }
                </div>

              </div>


              <div className="card">

                <div className="card-label">
                  Уже есть в базе
                </div>

                <div className="big-number">
                  {
                    preview
                      .batch
                      .matched_rows
                  }
                </div>

              </div>


              <div className="card">

                <div className="card-label">
                  Новые товары
                </div>

                <div className="big-number">
                  {
                    preview
                      .batch
                      .new_product_rows
                  }
                </div>

              </div>


              <div className="card">

                <div className="card-label">
                  Ошибки
                </div>

                <div className="big-number">
                  {
                    preview
                      .batch
                      .error_rows
                  }
                </div>

              </div>

            </section>


            <section className="section">

              <div className="section-header">

                <div>

                  <h2 className="section-title">
                    Предварительный просмотр
                  </h2>


                  <div className="muted">

                    {
                      preview
                        .batch
                        .source_file_name
                    }

                    {" • "}

                    дата остатков:{" "}

                    {
                      preview
                        .batch
                        .report_date
                    }

                  </div>

                </div>

              </div>


              <div className="table-wrapper">

                <table className="table stock-import-table">

                  <thead>

                    <tr>

                      <th className="right">
                        Строка
                      </th>

                      <th className="left">
                        Склад
                      </th>

                      <th className="left">
                        Артикул
                      </th>

                      <th className="left">
                        Товар
                      </th>

                      <th className="right">
                        Свободный остаток
                      </th>

                      <th className="left">
                        Статус
                      </th>

                      <th className="left">
                        Ошибка
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {preview.rows.map(
                      (row) => (

                        <tr
                          key={row.id}
                        >

                          <td className="right">
                            {
                              row
                                .source_row_number
                            }
                          </td>


                          <td className="left">
                            {
                              row
                                .warehouse_name
                            }
                          </td>


                          <td className="left">

                            <strong>

                              {
                                row
                                  .offer_id
                                ?? "—"
                              }

                            </strong>

                          </td>


                          <td className="left">
                            {
                              row
                                .product_name
                              ?? "—"
                            }
                          </td>


                          <td className="right">

                            {
                              row
                                .free_stock
                              ?? "—"
                            }

                          </td>


                          <td className="left">

                            <span
                              className={
                                `import-status import-status-${row.match_status}`
                              }
                            >

                              {
                                statusName(
                                  row
                                    .match_status
                                )
                              }

                            </span>

                          </td>


                          <td className="left">

                            {
                              row
                                .error_message
                              ?? "—"
                            }

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            </section>


            {preview.batch.status ===
              "preview" && (

              <section className="controls">

                <div>

                  <h2 className="controls-title">
                    Подтверждение
                  </h2>


                  <div className="muted">

                    Новые товары будут
                    созданы в базе.

                    {" "}

                    Строки с ошибками
                    будут пропущены.

                  </div>

                </div>


                <form
                  action={
                    async () => {
                      "use server";

                      const result = await confirmStockImport(preview!.batch!.id);
                      redirect("/stocks?import=avedex&calc=" + (result.chinaRecalculation.ok ? "ok" : "failed"));
                    }
                  }
                >

                  <button
                    type="submit"
                    className="primary-button"
                  >
                    Подтвердить импорт
                  </button>

                </form>

              </section>

            )}


            {preview.batch.status ===
              "imported" && (

              <section className="reason-box">

                <strong>
                  Импорт завершён
                </strong>


                <div className="reason-text">

                  Загружено строк:{" "}

                  {
                    preview
                      .batch
                      .imported_rows
                  }

                  .

                  {" "}

                  Создано новых товаров:{" "}

                  {
                    preview
                      .batch
                      .created_products
                  }

                  .

                </div>

              </section>

            )}

          </>

        )}

      </div>

    </main>

  );
}
