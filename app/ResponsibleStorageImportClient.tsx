"use client";

import {
  useState,
} from "react";

import * as XLSX
  from "xlsx";


// ============================================================
// СТРОКА ДЛЯ SUPABASE
// ============================================================

type ImportRow = {

  source_row:
    number;

  owner_name:
    string | null;

  warehouse_name:
    string | null;

  offer_id:
    string | null;

  name:
    string | null;

  quantity:
    number | null;

  article_source:
    string | null;

};


// ============================================================
// PREVIEW ROW
// ============================================================

type PreviewRow = {

  source_row:
    number;

  owner_name:
    string | null;

  warehouse_name:
    string | null;

  offer_id:
    string | null;

  item_name:
    string | null;

  database_name:
    string | null;

  quantity:
    number | null;

  article_source:
    string | null;

  status:
    | "existing"
    | "new_product"
    | "unmatched"
    | "invalid";

  message:
    string | null;

};


// ============================================================
// PREVIEW RESULT
// ============================================================

type PreviewResult = {

  ok:
    boolean;

  snapshot_date:
    string;

  total_rows:
    number;

  existing_rows:
    number;

  new_product_rows:
    number;

  unmatched_rows:
    number;

  invalid_rows:
    number;

  ready_rows:
    number;

  total_quantity:
    number;

  ready_quantity:
    number;

  unmatched_quantity:
    number;

  rows:
    PreviewRow[];

  error?:
    string;

};


// ============================================================
// APPLY RESULT
// ============================================================

type ApplyResult = {

  ok:
    boolean;

  sync_run_id?:
    string;

  snapshot_date?:
    string;

  source_rows?:
    number;

  existing_products?:
    number;

  new_products_created?:
    number;

  matched_rows?:
    number;

  unmatched_rows?:
    number;

  saved_rows?:
    number;

  matched_quantity?:
    number;

  unmatched_quantity?:
    number;

  error?:
    string;

};


// ============================================================
// TEXT
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
// NUMBER
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


  const number =
    Number(
      normalized
    );


  return Number.isFinite(
    number
  )
    ? number
    : null;

}


// ============================================================
// DATE
// DD.MM.YYYY → YYYY-MM-DD
// ============================================================

function convertRussianDate(
  value: string
) {

  const match =
    value.match(
      /^(\d{2})\.(\d{2})\.(\d{4})$/
    );


  if (!match) {

    return null;

  }


  return `${match[3]}-${match[2]}-${match[1]}`;

}


// ============================================================
// ДАТА СНИМКА ИЗ "ПЕРИОД ОТЧЕТА"
// ============================================================

function findSnapshotDate(
  rows: unknown[][]
) {

  const rowsToCheck =
    Math.min(
      rows.length,
      20
    );


  for (
    let rowIndex = 0;
    rowIndex <
      rowsToCheck;
    rowIndex++
  ) {

    const row =
      rows[
        rowIndex
      ];


    for (
      const cell
      of row
    ) {

      const text =
        normalizeText(
          cell
        );


      const match =
        text.match(
          /Период\s+отч[её]та\s*:\s*\d{2}\.\d{2}\.\d{4}\s*-\s*(\d{2}\.\d{2}\.\d{4})/i
        );


      if (match) {

        return convertRussianDate(
          match[1]
        );

      }

    }

  }


  return null;

}


// ============================================================
// ПОИСК КОЛОНКИ
// ============================================================

function findColumn(
  rows: unknown[][],
  searchText: string
) {

  const target =
    searchText
      .toLowerCase();


  const rowsToCheck =
    Math.min(
      rows.length,
      20
    );


  for (
    let rowIndex = 0;
    rowIndex <
      rowsToCheck;
    rowIndex++
  ) {

    const row =
      rows[
        rowIndex
      ];


    for (
      let columnIndex = 0;
      columnIndex <
        row.length;
      columnIndex++
    ) {

      const text =
        normalizeText(
          row[
            columnIndex
          ]
        )
          .toLowerCase();


      if (
        text ===
          target
      ) {

        return {
          rowIndex,
          columnIndex,
        };

      }

    }

  }


  return null;

}


// ============================================================
// ЯВНЫЙ АРТИКУЛ ИЗ НАЗВАНИЯ
//
// Например:
// "Сучкорез,60см.,артикул RMCA-0631"
// ============================================================

function extractExplicitArticle(
  itemName: string
) {

  const match =
    itemName.match(
      /(?:артикул|арт\.?)\s*[:№#-]?\s*([A-Za-z0-9][A-Za-z0-9._/-]*)/iu
    );


  if (!match) {

    return null;

  }


  return normalizeText(
    match[1]
  )
    .replace(
      /[),.;:]+$/g,
      ""
    )
    ||
    null;

}


// ============================================================
// WAREHOUSE
// ============================================================

function isWarehouseRow(
  value: string
) {

  return value
    .toUpperCase()
    .startsWith(
      "СКЛАД"
    );

}


// ============================================================
// ЗАЯВКА
// ============================================================

function isRequestRow(
  value: string
) {

  return value
    .toLowerCase()
    .startsWith(
      "заявка"
    );

}


// ============================================================
// СЛУЖЕБНЫЕ ИТОГОВЫЕ СТРОКИ
// ============================================================

function isSummaryRow(
  value: string
) {

  const normalized =
    value
      .toLowerCase();


  return (
    normalized ===
      "итого"
    ||
    normalized ===
      "всего"
    ||
    normalized.startsWith(
      "итого "
    )
  );

}


// ============================================================
// СЛЕДУЮЩАЯ НЕПУСТАЯ A
// ============================================================

function findNextText(
  rows: unknown[][],
  startIndex: number,
  nameColumn: number
) {

  for (
    let index =
      startIndex + 1;

    index <
      rows.length;

    index++
  ) {

    const row =
      rows[
        index
      ];


    const text =
      normalizeText(
        row[
          nameColumn
        ]
      );


    if (text) {

      return text;

    }

  }


  return "";

}


// ============================================================
// STATUS
// ============================================================

function statusText(
  row: PreviewRow
) {

  if (
    row.status ===
      "existing"
  ) {

    return "Есть в products";

  }


  if (
    row.status ===
      "new_product"
  ) {

    return "Новый товар — будет создан";

  }


  if (
    row.status ===
      "unmatched"
  ) {

    return "Нет артикула — сохранится отдельно";

  }


  return row.message
    ? `Ошибка — ${row.message}`
    : "Ошибка";

}


// ============================================================
// FORMAT
// ============================================================

function formatNumber(
  value:
    | number
    | null
    | undefined
) {

  if (
    value === null
    ||
    value === undefined
  ) {

    return "—";

  }


  return value
    .toLocaleString(
      "ru-RU"
    );

}


// ============================================================
// COMPONENT
// ============================================================

export default function ResponsibleStorageImportClient() {

  const [
    fileName,
    setFileName,
  ] =
    useState("");


  const [
    snapshotDate,
    setSnapshotDate,
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
      "Выберите Excel-отчёт ответственного хранения."
    );


  // ==========================================================
  // FILE
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

    setSnapshotDate(
      ""
    );

    setFileName(
      file.name
    );

    setMessage(
      "Читаем отчёт ОХ..."
    );


    try {

      // ======================================================
      // 1. XLSX
      // ======================================================

      const buffer =
        await file
          .arrayBuffer();


      const workbook =
        XLSX.read(
          buffer,
          {
            type:
              "array",

            raw:
              true,
          }
        );


      const sheetName =
        workbook
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
        excelRows.length ===
          0
      ) {

        throw new Error(
          "Excel пуст"
        );

      }


      // ======================================================
      // 2. DATE
      // ======================================================

      const detectedDate =
        findSnapshotDate(
          excelRows
        );


      if (!detectedDate) {

        throw new Error(
          "Не удалось определить дату отчёта из строки «Период отчета»"
        );

      }


      // ======================================================
      // 3. COLUMNS
      // ======================================================

      const nomenclatureHeader =
        findColumn(
          excelRows,
          "Номенклатура"
        );


      const articleHeader =
        findColumn(
          excelRows,
          "Артикул"
        );


      const finalStockHeader =
        findColumn(
          excelRows,
          "Количество Конечный остаток"
        );


      const registrarHeader =
        findColumn(
          excelRows,
          "Регистратор"
        );


      if (
        !nomenclatureHeader
      ) {

        throw new Error(
          "Не найдена колонка «Номенклатура»"
        );

      }


      if (
        !articleHeader
      ) {

        throw new Error(
          "Не найдена колонка «Артикул»"
        );

      }


      if (
        !finalStockHeader
      ) {

        throw new Error(
          "Не найдена колонка «Количество Конечный остаток»"
        );

      }


      const nameColumn =
        nomenclatureHeader
          .columnIndex;


      const articleColumn =
        articleHeader
          .columnIndex;


      const quantityColumn =
        finalStockHeader
          .columnIndex;


      const dataStartRow =
        registrarHeader
          ? registrarHeader
              .rowIndex + 1
          : Math.max(
              nomenclatureHeader
                .rowIndex,
              articleHeader
                .rowIndex,
              finalStockHeader
                .rowIndex
            )
            + 1;


      // ======================================================
      // 4. PARSER
      // ======================================================

      let currentOwner =
        "";


      let currentWarehouse =
        "";


      const parsedRows:
        ImportRow[] = [];


      for (
        let rowIndex =
          dataStartRow;

        rowIndex <
          excelRows.length;

        rowIndex++
      ) {

        const row =
          excelRows[
            rowIndex
          ];


        const itemName =
          normalizeText(
            row[
              nameColumn
            ]
          );


        const articleFromCell =
          normalizeText(
            row[
              articleColumn
            ]
          );


        const quantity =
          parseNumber(
            row[
              quantityColumn
            ]
          );


        if (
          !itemName
          &&
          !articleFromCell
          &&
          quantity === null
        ) {

          continue;

        }


        // =================================
        // ЗАЯВКА — НЕ ТОВАР.
        // =================================

        if (
          isRequestRow(
            itemName
          )
        ) {

          continue;

        }


        // =================================
        // СКЛАД.
        // =================================

        if (
          isWarehouseRow(
            itemName
          )
        ) {

          currentWarehouse =
            itemName;

          continue;

        }


        // =================================
        // ИТОГ.
        // =================================

        if (
          isSummaryRow(
            itemName
          )
        ) {

          continue;

        }


        // =================================
        // ПОСТАВЩИК.
        //
        // В иерархическом отчёте после
        // поставщика идёт строка склада.
        // =================================

        const nextText =
          findNextText(
            excelRows,
            rowIndex,
            nameColumn
          );


        if (
          !articleFromCell
          &&
          isWarehouseRow(
            nextText
          )
        ) {

          currentOwner =
            itemName;

          currentWarehouse =
            "";

          continue;

        }


        // =================================
        // ТОВАР.
        // =================================

        let offerId =
          articleFromCell;


        let articleSource:
          string | null =
            null;


        if (offerId) {

          articleSource =
            "column";

        } else {

          const extracted =
            extractExplicitArticle(
              itemName
            );


          if (extracted) {

            offerId =
              extracted;

            articleSource =
              "name_explicit";

          } else {

            articleSource =
              "none";

          }

        }


        parsedRows.push(
          {
            source_row:
              rowIndex + 1,

            owner_name:
              currentOwner
              || null,

            warehouse_name:
              currentWarehouse
              || null,

            offer_id:
              offerId
              || null,

            name:
              itemName
              || null,

            quantity,

            article_source:
              articleSource,
          }
        );

      }


      if (
        parsedRows.length ===
          0
      ) {

        throw new Error(
          "В отчёте не найдено товарных строк"
        );

      }


      setRows(
        parsedRows
      );


      setSnapshotDate(
        detectedDate
      );


      setMessage(
        `Найдено товарных строк: ${parsedRows.length}. Проверяем базу...`
      );


      // ======================================================
      // 5. PREVIEW
      // ======================================================

      const response =
        await fetch(
          "/api/responsible-storage-preview",
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
                  snapshotDate:
                    detectedDate,

                  sourceFileName:
                    file.name,

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
          "Ошибка предварительной проверки ОХ"
        );

      }


      setPreview(
        data
      );


      setMessage(
        "Предварительная проверка ОХ завершена."
      );


    } catch (error) {

      console.error(
        "Responsible storage Excel error:",
        error
      );


      setMessage(
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка обработки Excel"
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  // ==========================================================
  // APPLY
  // ==========================================================

  async function applyImport() {

    if (
      !preview
      ||
      rows.length === 0
      ||
      !snapshotDate
    ) {

      return;

    }


    if (
      preview.invalid_rows >
        0
    ) {

      setResult(
        {
          ok: false,

          error:
            "Импорт заблокирован: в отчёте есть некорректные строки.",
        }
      );

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
          "/api/responsible-storage-apply",
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
                  snapshotDate,

                  sourceFileName:
                    fileName,

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
          "Ошибка импорта ОХ"
        );

      }


      setResult(
        data
      );


      setMessage(
        "Ответственное хранение успешно импортировано."
      );


    } catch (error) {

      setResult(
        {
          ok: false,

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка импорта ОХ",
        }
      );

    } finally {

      setApplying(
        false
      );

    }

  }


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <>


      {/* ======================================================
          FILE
          ====================================================== */}

      <section className="controls">

        <div>

          <h2 className="controls-title">
            Загрузить отчёт ОХ
          </h2>


          <div className="muted">

            Используется конечный остаток
            товара на дату отчёта.

          </div>


          <div className="muted">

            Заявки на хранение
            автоматически пропускаются.

          </div>


          <div className="muted">

            {fileName
              ? `Выбран: ${fileName}`
              : "Файл пока не выбран"}

          </div>

        </div>


        <label
          className="primary-button"
        >

          {loading
            ? "Проверяем..."
            : "Выбрать Excel"}


          <input
            type="file"

            accept=".xlsx,.xls"

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


        {snapshotDate && (

          <div className="reason-text">

            Дата снимка:{" "}
            <strong>
              {snapshotDate}
            </strong>

          </div>

        )}

      </section>


      {/* ======================================================
          SUMMARY
          ====================================================== */}

      {preview && (

        <>

          <section className="summary-grid">


            <div className="card">

              <div className="card-label">
                Товарных строк
              </div>

              <div className="big-number">
                {preview.total_rows}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Уже есть в products
              </div>

              <div className="big-number">
                {preview.existing_rows}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Новые товары
              </div>

              <div className="big-number">
                {preview.new_product_rows}
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Без артикула
              </div>

              <div className="big-number">
                {preview.unmatched_rows}
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


            <div className="card">

              <div className="card-label">
                Остаток всего
              </div>

              <div className="big-number">
                {formatNumber(
                  preview.total_quantity
                )}
              </div>

              <div className="muted">
                шт.
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Сопоставленный остаток
              </div>

              <div className="big-number">
                {formatNumber(
                  preview.ready_quantity
                )}
              </div>

              <div className="muted">
                попадёт в расчёты
              </div>

            </div>


            <div className="card">

              <div className="card-label">
                Не сопоставлено
              </div>

              <div className="big-number">
                {formatNumber(
                  preview.unmatched_quantity
                )}
              </div>

              <div className="muted">
                шт.
              </div>

            </div>

          </section>


          {/* ==================================================
              WARNING
              ================================================== */}

          {preview.unmatched_rows >
            0 && (

            <section className="section">

              <h2 className="section-title">
                Есть товары без артикула
              </h2>


              <div className="reason-box">

                <strong>

                  Они не потеряются,
                  но пока не будут участвовать
                  в расчёте Китая и пополнении
                  маркетплейсов.

                </strong>


                <div className="reason-text">

                  Строк:{" "}
                  {preview.unmatched_rows}

                </div>


                <div className="reason-text">

                  Остаток:{" "}
                  {formatNumber(
                    preview.unmatched_quantity
                  )} шт.

                </div>

              </div>

            </section>

          )}


          {/* ==================================================
              TABLE
              ================================================== */}

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
                    "13px",
                }}
              >

                <thead>

                  <tr>

                    <th style={{
                      textAlign: "left",
                      padding: "10px",
                    }}>
                      Строка
                    </th>

                    <th style={{
                      textAlign: "left",
                      padding: "10px",
                    }}>
                      Владелец
                    </th>

                    <th style={{
                      textAlign: "left",
                      padding: "10px",
                    }}>
                      Артикул
                    </th>

                    <th style={{
                      textAlign: "left",
                      padding: "10px",
                    }}>
                      Товар
                    </th>

                    <th style={{
                      textAlign: "right",
                      padding: "10px",
                    }}>
                      Остаток
                    </th>

                    <th style={{
                      textAlign: "left",
                      padding: "10px",
                    }}>
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
                          `${row.source_row}-${index}`
                        }
                      >

                        <td style={{
                          padding: "10px",
                        }}>
                          {row.source_row}
                        </td>


                        <td style={{
                          padding: "10px",
                        }}>
                          {row.owner_name
                            ?? "—"}
                        </td>


                        <td style={{
                          padding: "10px",
                        }}>

                          {row.offer_id
                            ?? "—"}

                          {row.article_source ===
                            "name_explicit" && (
                            <div className="muted">
                              из наименования
                            </div>
                          )}

                        </td>


                        <td style={{
                          padding: "10px",
                        }}>
                          {row.database_name
                            ??
                            row.item_name
                            ??
                            "—"}
                        </td>


                        <td style={{
                          padding: "10px",
                          textAlign: "right",
                        }}>
                          {formatNumber(
                            row.quantity
                          )}
                        </td>


                        <td style={{
                          padding: "10px",
                        }}>
                          {statusText(
                            row
                          )}
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          </section>


          {/* ==================================================
              CONFIRM
              ================================================== */}

          <section className="controls">

            <div>

              <h2 className="controls-title">
                Подтверждение импорта
              </h2>


              <div className="muted">

                Сопоставленные строки
                попадут в остаток ОХ.

              </div>


              <div className="muted">

                Несопоставленные строки
                сохранятся отдельно
                для дальнейшего исправления.

              </div>


              {preview.invalid_rows >
                0 && (

                <div className="muted">

                  Импорт заблокирован:
                  есть настоящие ошибки.

                </div>

              )}

            </div>


            <button
              type="button"

              className="primary-button"

              disabled={
                applying
                ||
                preview.invalid_rows >
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
                : `Подтвердить импорт (${preview.total_rows})`}

            </button>

          </section>

        </>

      )}


      {/* ======================================================
          RESULT
          ====================================================== */}

      {result && (

        <section className="section">

          <h2 className="section-title">

            {result.ok
              ? "Импорт ОХ завершён"
              : "Ошибка импорта ОХ"}

          </h2>


          <div className="reason-box">

            {result.ok ? (

              <>

                <strong>
                  Снимок ответственного
                  хранения записан
                </strong>


                <div className="reason-text">

                  Дата:{" "}
                  {result.snapshot_date
                    ?? "—"}

                </div>


                <div className="reason-text">

                  Товарных строк:{" "}
                  {result.source_rows
                    ?? 0}

                </div>


                <div className="reason-text">

                  Сопоставлено:{" "}
                  {result.matched_rows
                    ?? 0}

                </div>


                <div className="reason-text">

                  Новых products создано:{" "}

                  {result.new_products_created
                    ?? 0}

                </div>


                <div className="reason-text">

                  Итоговых строк
                  владелец + товар:{" "}

                  {result.saved_rows
                    ?? 0}

                </div>


                <div className="reason-text">

                  Сопоставленный остаток:{" "}

                  {formatNumber(
                    result.matched_quantity
                  )} шт.

                </div>


                <div className="reason-text">

                  Без артикула:{" "}

                  {formatNumber(
                    result.unmatched_quantity
                  )} шт.

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
