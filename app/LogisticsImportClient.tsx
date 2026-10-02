"use client";

import {
  useState,
} from "react";

import * as XLSX
  from "xlsx";


// ============================================================
// ТИП СТРОКИ EXCEL
// ============================================================

type ImportRow = {

  offer_id:
    string | null;

  name:
    string | null;

  units_per_carton:
    number | null;

  transport_carton_volume_m3:
    number | null;

};


// ============================================================
// ТИП СТРОКИ PREVIEW
// ============================================================

type PreviewRow = {

  source_row:
    number;

  offer_id:
    string | null;

  imported_name:
    string | null;

  database_name:
    string | null;

  units_per_carton:
    number | null;

  transport_carton_volume_m3:
    number | null;

  current_units_per_carton:
    number | null;

  current_transport_carton_volume_m3:
    number | null;

  status:
    "matched"
    | "not_found"
    | "invalid";

  error:
    string | null;

};


// ============================================================
// ТИП PREVIEW
// ============================================================

type PreviewResult = {

  ok:
    boolean;

  total_rows:
    number;

  matched_rows:
    number;

  not_found_rows:
    number;

  invalid_rows:
    number;

  rows:
    PreviewRow[];

  error?:
    string;

};


// ============================================================
// ТИП РЕЗУЛЬТАТА ИМПОРТА
// ============================================================

type ApplyResult = {

  ok:
    boolean;

  total_rows?:
    number;

  imported_rows?:
    number;

  not_found_rows?:
    number;

  invalid_rows?:
    number;

  source?:
    string;

  updated_at?:
    string;

  error?:
    string;

};


// ============================================================
// НОРМАЛИЗАЦИЯ ТЕКСТА
// ============================================================

function normalizeText(
  value: unknown
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "";

  }


  return String(
    value
  )
    .replace(
      /\u00A0/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


// ============================================================
// ЧИСЛО
// ============================================================

function parseNumber(
  value: unknown
):
  number | null {

  if (
    value === null
    ||
    value === undefined
    ||
    value === ""
  ) {

    return null;

  }


  if (
    typeof value ===
      "number"
  ) {

    return Number.isFinite(
      value
    )
      ? value
      : null;

  }


  const normalized =
    normalizeText(
      value
    )
      .replace(
        /\s/g,
        ""
      )
      .replace(
        ",",
        "."
      );


  const result =
    Number(
      normalized
    );


  return Number.isFinite(
    result
  )
    ? result
    : null;

}


// ============================================================
// СТАТУС
// ============================================================

function statusText(
  status:
    PreviewRow["status"]
) {

  if (
    status ===
      "matched"
  ) {

    return "Найден";

  }


  if (
    status ===
      "not_found"
  ) {

    return "Не найден";

  }


  return "Ошибка";

}


// ============================================================
// КОМПОНЕНТ
// ============================================================

export default function LogisticsImportClient() {

  const [
    fileName,
    setFileName,
  ] =
    useState("");


  const [
    rows,
    setRows,
  ] =
    useState<
      ImportRow[]
    >([]);


  const [
    preview,
    setPreview,
  ] =
    useState<
      PreviewResult | null
    >(null);


  const [
    result,
    setResult,
  ] =
    useState<
      ApplyResult | null
    >(null);


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    applying,
    setApplying,
  ] =
    useState(false);


  const [
    message,
    setMessage,
  ] =
    useState(
      "Выберите Excel с логистическими данными."
    );


  // ==========================================================
  // ЧТЕНИЕ EXCEL
  // ==========================================================

  async function handleFile(
    file: File
  ) {

    setLoading(
      true
    );

    setPreview(
      null
    );

    setResult(
      null
    );

    setRows(
      []
    );

    setFileName(
      file.name
    );

    setMessage(
      "Читаем Excel..."
    );


    try {

      const buffer =
        await file
          .arrayBuffer();


      const workbook =
        XLSX.read(
          buffer,
          {
            type:
              "array",

            cellDates:
              true,
          }
        );


      const sheetName =
        workbook
          .SheetNames
          .includes(
            "Товары"
          )

          ? "Товары"

          : workbook
              .SheetNames[0];


      if (!sheetName) {

        throw new Error(
          "В Excel нет листов"
        );

      }


      const worksheet =
        workbook
          .Sheets[
            sheetName
          ];


      if (!worksheet) {

        throw new Error(
          "Не удалось открыть лист Excel"
        );

      }


      const excelRows =
        XLSX.utils
          .sheet_to_json<
            unknown[]
          >(
            worksheet,
            {
              header:
                1,

              raw:
                true,

              defval:
                null,

              blankrows:
                false,
            }
          );


      if (
        excelRows.length <
          2
      ) {

        throw new Error(
          "Excel не содержит товарных данных"
        );

      }


      // ======================================================
      // ИЩЕМ СТРОКУ ЗАГОЛОВКОВ
      // ======================================================

      let headerRowIndex =
        -1;


      let offerColumn =
        -1;


      let nameColumn =
        -1;


      let unitsColumn =
        -1;


      let volumeColumn =
        -1;


      const rowsToCheck =
        Math.min(
          excelRows.length,
          15
        );


      for (
        let rowIndex = 0;
        rowIndex <
          rowsToCheck;
        rowIndex++
      ) {

        const row =
          excelRows[
            rowIndex
          ];


        if (
          !Array.isArray(
            row
          )
        ) {
          continue;
        }


        const headers =
          row.map(
            (
              value
            ) =>
              normalizeText(
                value
              )
                .toLowerCase()
          );


        const foundOffer =
          headers.findIndex(
            (
              value
            ) =>
              value ===
                "артикул"
          );


        const foundName =
          headers.findIndex(
            (
              value
            ) =>
              value.includes(
                "наименование"
              )
          );


        const foundUnits =
          headers.findIndex(
            (
              value
            ) =>
              value.includes(
                "вложимость"
              )
              &&
              value.includes(
                "короб"
              )
          );


        const foundVolume =
          headers.findIndex(
            (
              value
            ) =>
              (
                value.includes(
                  "объём"
                )
                ||
                value.includes(
                  "объем"
                )
              )
              &&
              value.includes(
                "короб"
              )
          );


        if (
          foundOffer >= 0
          &&
          foundName >= 0
          &&
          foundUnits >= 0
          &&
          foundVolume >= 0
        ) {

          headerRowIndex =
            rowIndex;

          offerColumn =
            foundOffer;

          nameColumn =
            foundName;

          unitsColumn =
            foundUnits;

          volumeColumn =
            foundVolume;

          break;

        }

      }


      if (
        headerRowIndex < 0
      ) {

        throw new Error(
          "Не удалось найти колонки: Артикул, Наименование, Вложимость и Объём коробки"
        );

      }


      // ======================================================
      // ЧИТАЕМ ТОВАРЫ
      // ======================================================

      const parsedRows:
        ImportRow[] = [];


      for (
        let rowIndex =
          headerRowIndex + 1;

        rowIndex <
          excelRows.length;

        rowIndex++
      ) {

        const row =
          excelRows[
            rowIndex
          ];


        if (
          !Array.isArray(
            row
          )
        ) {
          continue;
        }


        const offerId =
          normalizeText(
            row[
              offerColumn
            ]
          );


        const name =
          normalizeText(
            row[
              nameColumn
            ]
          );


        const units =
          parseNumber(
            row[
              unitsColumn
            ]
          );


        const volume =
          parseNumber(
            row[
              volumeColumn
            ]
          );


        // Полностью пустую строку
        // пропускаем.
        if (
          !offerId
          &&
          !name
          &&
          units === null
          &&
          volume === null
        ) {

          continue;

        }


        parsedRows.push(
          {
            offer_id:
              offerId
              || null,

            name:
              name
              || null,

            units_per_carton:
              units,

            transport_carton_volume_m3:
              volume,
          }
        );

      }


      if (
        parsedRows.length ===
          0
      ) {

        throw new Error(
          "Товарные строки не найдены"
        );

      }


      // ======================================================
      // ПРОВЕРЯЕМ ДУБЛИ АРТИКУЛОВ
      // ======================================================

      const articleCounts =
        new Map<
          string,
          number
        >();


      for (
        const row
        of parsedRows
      ) {

        if (
          !row.offer_id
        ) {
          continue;
        }


        articleCounts.set(
          row.offer_id,

          (
            articleCounts.get(
              row.offer_id
            )
            ?? 0
          )
          + 1
        );

      }


      const duplicates =
        Array.from(
          articleCounts
            .entries()
        )
          .filter(
            (
              [
                ,
                count,
              ]
            ) =>
              count > 1
          )
          .map(
            (
              [
                article,
              ]
            ) =>
              article
          );


      if (
        duplicates.length >
          0
      ) {

        throw new Error(
          `В Excel есть повторяющиеся артикулы: ${duplicates.slice(0, 10).join(", ")}`
        );

      }


      setRows(
        parsedRows
      );


      setMessage(
        `Найдено строк: ${parsedRows.length}. Проверяем соответствие с базой...`
      );


      // ======================================================
      // PREVIEW
      // ======================================================

      const response =
        await fetch(
          "/api/logistics-import-preview",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  rows:
                    parsedRows,
                }
              ),
          }
        );


      const data =
        await response
          .json() as
          PreviewResult;


      if (
        !response.ok
        ||
        !data.ok
      ) {

        throw new Error(
          data.error
          ||
          "Ошибка предварительной проверки"
        );

      }


      setPreview(
        data
      );


      setMessage(
        "Предварительная проверка завершена."
      );


    } catch (error) {

      console.error(
        "Logistics Excel error:",
        error
      );


      setMessage(

        error instanceof Error
          ? error.message
          : "Неизвестная ошибка Excel"

      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // ==========================================================
  // ПОДТВЕРЖДЕНИЕ
  // ==========================================================

  async function applyImport() {

    if (
      rows.length === 0
    ) {
      return;
    }


    setApplying(
      true
    );

    setResult(
      null
    );


    try {

      const response =
        await fetch(
          "/api/logistics-import-apply",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  rows,
                }
              ),
          }
        );


      const data =
        await response
          .json() as
          ApplyResult;


      if (
        !response.ok
        ||
        !data.ok
      ) {

        throw new Error(
          data.error
          ||
          "Ошибка импорта логистических данных"
        );

      }


      setResult(
        data
      );


      setMessage(
        "Логистические данные успешно импортированы."
      );


    } catch (error) {

      setResult(
        {
          ok:
            false,

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка импорта",
        }
      );

    } finally {

      setApplying(
        false
      );

    }

  }


  return (

    <>


      {/* ======================================================
          ЗАГРУЗКА
          ====================================================== */}

      <section className="controls">

        <div>

          <h2 className="controls-title">
            Загрузить Excel
          </h2>


          <div className="muted">

            Импортируются только
            вложимость и объём
            транспортной коробки.

          </div>


          <div className="muted">

            {fileName
              ? `Выбран: ${fileName}`
              : "Файл пока не выбран"}

          </div>

        </div>


        <label
          className=
            "primary-button"
        >

          {loading
            ? "Проверяем..."
            : "Выбрать Excel"}


          <input
            type="file"

            accept=
              ".xlsx,.xls"

            disabled={
              loading
              ||
              applying
            }

            hidden

            onChange={
              (
                event
              ) => {

                const file =
                  event
                    .target
                    .files?.[0];


                if (file) {

                  void handleFile(
                    file
                  );

                }

              }
            }
          />

        </label>

      </section>


      <section className="section">

        <div className="reason-text">
          {message}
        </div>

      </section>


      {/* ======================================================
          PREVIEW
          ====================================================== */}

      {preview && (

        <>

          <section className="summary-grid">


            <div className="card">

              <div className="card-label">
                Всего строк
              </div>

              <div className="big-number">
                {preview.total_rows}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Найдено товаров
              </div>

              <div className="big-number">
                {preview.matched_rows}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Не найдено
              </div>

              <div className="big-number">
                {preview.not_found_rows}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Ошибки
              </div>

              <div className="big-number">
                {preview.invalid_rows}
              </div>

            </div>

          </section>


          <section className="section">

            <h2 className="section-title">
              Предварительный просмотр
            </h2>


            <div
              style={{
                overflowX:
                  "auto",
              }}
            >

              <table
                style={{
                  width:
                    "100%",

                  borderCollapse:
                    "collapse",

                  fontSize:
                    "14px",
                }}
              >

                <thead>

                  <tr>

                    <th
                      style={{
                        textAlign:
                          "left",
                        padding:
                          "10px",
                      }}
                    >
                      Артикул
                    </th>


                    <th
                      style={{
                        textAlign:
                          "left",
                        padding:
                          "10px",
                      }}
                    >
                      Товар
                    </th>


                    <th
                      style={{
                        textAlign:
                          "right",
                        padding:
                          "10px",
                      }}
                    >
                      Вложимость
                    </th>


                    <th
                      style={{
                        textAlign:
                          "right",
                        padding:
                          "10px",
                      }}
                    >
                      Объём, м³
                    </th>


                    <th
                      style={{
                        textAlign:
                          "left",
                        padding:
                          "10px",
                      }}
                    >
                      Статус
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {preview.rows.map(
                    (
                      row,
                      index
                    ) => (

                      <tr
                        key={
                          `${row.offer_id}-${index}`
                        }
                      >

                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >
                          {row.offer_id
                            ?? "—"}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >
                          {row.database_name
                            ??
                            row.imported_name
                            ??
                            "—"}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {row.units_per_carton
                            ?? "—"}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            textAlign:
                              "right",
                          }}
                        >
                          {row.transport_carton_volume_m3
                            ?? "—"}
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",
                          }}
                        >

                          {statusText(
                            row.status
                          )}

                          {row.error
                            ? ` — ${row.error}`
                            : ""}

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          </section>


          <section className="controls">

            <div>

              <h2 className="controls-title">
                Подтверждение
              </h2>


              <div className="muted">

                Будут обновлены только
                товары, найденные по
                точному артикулу.

              </div>

            </div>


            <button
              type="button"

              className=
                "primary-button"

              disabled={
                applying
                ||
                preview.matched_rows ===
                  0
              }

              onClick={
                () => {
                  void applyImport();
                }
              }
            >

              {applying
                ? "Записываем..."
                : `Подтвердить импорт (${preview.matched_rows})`}

            </button>

          </section>

        </>

      )}


      {/* ======================================================
          РЕЗУЛЬТАТ
          ====================================================== */}

      {result && (

        <section className="section">

          <h2 className="section-title">

            {result.ok
              ? "Импорт завершён"
              : "Ошибка импорта"}

          </h2>


          <div className="reason-box">

            {result.ok ? (

              <>

                <strong>
                  Логистические данные
                  записаны в Supabase
                </strong>


                <div className="reason-text">

                  Обновлено товаров:{" "}

                  {result.imported_rows
                    ?? 0}

                </div>


                <div className="reason-text">

                  Не найдено:{" "}

                  {result.not_found_rows
                    ?? 0}

                </div>


                <div className="reason-text">

                  Ошибок:{" "}

                  {result.invalid_rows
                    ?? 0}

                </div>

              </>

            ) : (

              <div className="reason-text">

                {result.error
                  ?? "Неизвестная ошибка"}

              </div>

            )}

          </div>

        </section>

      )}

    </>

  );

}
