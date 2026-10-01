"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import * as XLSX from "xlsx";

import {
  createStockImportPreview,
} from "./actions";


// ============================================
// ТИП СТРОКИ ДЛЯ SUPABASE
// ============================================

type ParsedRow = {
  source_row_number: number;

  warehouse_name:
    string | null;

  product_name:
    string | null;

  offer_id_raw:
    string | null;

  free_stock:
    number | null;

  barcode:
    string | null;

  parse_error:
    string | null;
};


// ============================================
// НОРМАЛИЗАЦИЯ ТЕКСТА
// ============================================

function normalizeText(
  value: unknown
): string {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }


  return String(value)

    // Неразрывный пробел
    .replace(/\u00A0/g, " ")

    // Несколько пробелов / переносов
    .replace(/\s+/g, " ")

    .trim();
}


// ============================================
// ПАРСИНГ СВОБОДНОГО ОСТАТКА
// ============================================

function parseNumber(
  value: unknown
):
  number | null {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }


  if (
    typeof value === "number"
  ) {

    return Number.isFinite(value)
      ? Math.round(value)
      : null;

  }


  const normalized =
    normalizeText(value)

      .replace(/\s/g, "")

      .replace(",", ".");


  if (!normalized) {
    return null;
  }


  const result =
    Number(normalized);


  if (
    !Number.isFinite(result)
  ) {
    return null;
  }


  return Math.round(result);
}


// ============================================
// ДАТА → YYYY-MM-DD
// ============================================

function toIsoDate(
  value: unknown
):
  string | null {

  // SheetJS может вернуть Date
  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {

    const year =
      value.getFullYear();

    const month =
      String(
        value.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        value.getDate()
      ).padStart(
        2,
        "0"
      );


    return `${year}-${month}-${day}`;
  }


  // Иногда дата Excel приходит
  // числовым serial value
  if (
    typeof value === "number"
  ) {

    const parsed =
      XLSX.SSF.parse_date_code(
        value
      );


    if (parsed) {

      const year =
        String(parsed.y);

      const month =
        String(parsed.m)
          .padStart(
            2,
            "0"
          );

      const day =
        String(parsed.d)
          .padStart(
            2,
            "0"
          );


      return `${year}-${month}-${day}`;

    }

  }


  const text =
    normalizeText(value);


  // Например:
  // 02.10.2026
  // 02/10/2026
  // 02-10-2026
  const match =
    text.match(
      /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/
    );


  if (!match) {
    return null;
  }


  const day =
    match[1]
      .padStart(
        2,
        "0"
      );


  const month =
    match[2]
      .padStart(
        2,
        "0"
      );


  const year =
    match[3];


  return `${year}-${month}-${day}`;
}


// ============================================
// ПОЛУЧЕНИЕ ЯЧЕЙКИ ИЗ МАССИВА
//
// columnIndex начинается с 0:
//
// A = 0
// B = 1
// C = 2
// ...
// ============================================

function getCell(
  row: unknown[],
  columnIndex: number
): unknown {

  return row[
    columnIndex
  ];
}


// ============================================
// КОМПОНЕНТ
// ============================================

export default function StockImportClient() {

  const router =
    useRouter();


  const [
    fileName,
    setFileName,
  ] =
    useState("");


  const [
    message,
    setMessage,
  ] =
    useState(
      "Выберите Excel-файл с остатками."
    );


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  // ==========================================
  // ЧТЕНИЕ EXCEL
  // ==========================================

  async function handleFile(
    file: File
  ) {

    setLoading(true);

    setFileName(
      file.name
    );

    setMessage(
      "Читаем Excel..."
    );


    try {

      // ======================================
      // 1. ПОЛУЧАЕМ ARRAYBUFFER
      // ======================================

      const buffer =
        await file.arrayBuffer();


      // ======================================
      // 2. ЧИТАЕМ EXCEL ЧЕРЕЗ SHEETJS
      //
      // В отличие от ExcelJS эта библиотека
      // не требует разбора drawing anchors
      // для нашей задачи.
      // ======================================

      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array",

            cellDates: true,

            cellFormula: false,

            cellHTML: false,

            cellStyles: false,

            cellNF: false,
          }
        );


      // ======================================
      // 3. ВЫБИРАЕМ ЛИСТ
      // ======================================

      const sheetName =
        workbook.SheetNames
          .includes("Лист_1")

          ? "Лист_1"

          : workbook
              .SheetNames[0];


      if (!sheetName) {

        throw new Error(
          "В Excel не найден ни один лист"
        );

      }


      const worksheet =
        workbook.Sheets[
          sheetName
        ];


      if (!worksheet) {

        throw new Error(
          "Не удалось открыть лист Excel"
        );

      }


      // ======================================
      // 4. ПРЕВРАЩАЕМ ЛИСТ
      // В МАССИВ СТРОК
      //
      // Каждая строка:
      // [
      //   колонка A,
      //   колонка B,
      //   колонка C,
      //   ...
      // ]
      // ======================================

      const rows =
        XLSX.utils.sheet_to_json<
          unknown[]
        >(
          worksheet,
          {
            header: 1,

            raw: true,

            defval: null,

            blankrows: true,
          }
        );


      if (
        rows.length === 0
      ) {

        throw new Error(
          "Лист Excel пуст"
        );

      }


      // ======================================
      // 5. ДАТА ОТЧЁТА
      //
      // C2:
      // row index 1
      // column index 2
      // ======================================

      const reportDateValue =
        rows[1]
          ? getCell(
              rows[1],
              2
            )
          : null;


      const reportDate =
        toIsoDate(
          reportDateValue
        );


      if (!reportDate) {

        console.log(
          "Значение C2:",
          reportDateValue
        );


        throw new Error(
          "Не удалось определить дату отчёта из ячейки C2"
        );

      }


      // ======================================
      // 6. ЧИТАЕМ ТОВАРЫ
      // ======================================

      const parsedRows:
        ParsedRow[] = [];


      let currentWarehouse:
        string | null = null;


      rows.forEach(
        (
          row,
          rowIndex
        ) => {

          const rowNumber =
            rowIndex + 1;


          if (
            !Array.isArray(row)
          ) {
            return;
          }


          // ==================================
          // КОЛОНКИ ТЕКУЩЕГО ОТЧЁТА
          //
          // A = Номенклатура
          // E = Артикул
          // G = Свободный остаток
          // J = Штрихкод
          // ==================================

          const columnA =
            normalizeText(
              getCell(
                row,
                0
              )
            );


          const columnE =
            normalizeText(
              getCell(
                row,
                4
              )
            );


          const columnGRaw =
            getCell(
              row,
              6
            );


          const columnGText =
            normalizeText(
              columnGRaw
            );


          const columnJ =
            normalizeText(
              getCell(
                row,
                9
              )
            );


          // ==================================
          // 7. ОПРЕДЕЛЯЕМ СКЛАД
          // ==================================

          const possibleWarehouse =
            columnA
              .toLowerCase();


          if (
            possibleWarehouse
              .includes(
                "склад"
              )

            &&
            !columnE

            &&
            !columnGText
          ) {

            currentWarehouse =
              columnA;

            return;
          }


          // ==================================
          // 8. ПУСТЫЕ СТРОКИ
          // ==================================

          if (
            !columnA &&
            !columnE &&
            !columnGText
          ) {
            return;
          }


          // ==================================
          // 9. СТРОКА "ИТОГО"
          // ==================================

          if (
            columnA
              .toLowerCase()
              .startsWith(
                "итого"
              )
          ) {
            return;
          }


          // ==================================
          // 10. ЗАГОЛОВКИ
          // ==================================

          if (
            columnA
              .toLowerCase()
              .includes(
                "номенклатура"
              )
          ) {
            return;
          }


          if (
            columnE
              .toLowerCase()
              === "артикул"
          ) {
            return;
          }


          // ==================================
          // 11. СВОБОДНЫЙ ОСТАТОК
          // ==================================

          const freeStock =
            parseNumber(
              columnGRaw
            );


          // ==================================
          // 12. ОПРЕДЕЛЯЕМ,
          // ПОХОЖА ЛИ СТРОКА НА ТОВАР
          // ==================================

          if (
            !columnA &&
            !columnE &&
            freeStock === null
          ) {
            return;
          }


          // ==================================
          // 13. ОШИБКА ПАРСИНГА
          // ==================================

          let parseError:
            string | null = null;


          if (
            columnGText &&
            freeStock === null
          ) {

            parseError =
              "Не удалось прочитать свободный остаток";

          }


          // ==================================
          // 14. ДОБАВЛЯЕМ СТРОКУ
          // ==================================

          parsedRows.push({

            source_row_number:
              rowNumber,


            warehouse_name:
              currentWarehouse,


            product_name:
              columnA || null,


            offer_id_raw:
              columnE || null,


            free_stock:
              freeStock,


            barcode:
              columnJ || null,


            parse_error:
              parseError,

          });

        }
      );


      // ======================================
      // 15. ПРОВЕРКА
      // ======================================

      if (
        parsedRows.length === 0
      ) {

        throw new Error(
          "В Excel не найдено товарных строк"
        );

      }


      setMessage(
        `Найдено товарных строк: ${parsedRows.length}. Создаём предварительную проверку...`
      );


      // ======================================
      // 16. СОЗДАЁМ PREVIEW В SUPABASE
      // ======================================

      const batchId =
        await createStockImportPreview(
          {

            fileName:
              file.name,


            reportDate,


            rows:
              parsedRows,

          }
        );


      if (!batchId) {

        throw new Error(
          "Не удалось создать предварительный импорт"
        );

      }


      // ======================================
      // 17. ПЕРЕХОДИМ К PREVIEW
      // ======================================

      setMessage(
        "Excel прочитан. Загружаем предварительный просмотр..."
      );


      router.push(
        `/stock-import?batch=${batchId}`
      );


      router.refresh();

    } catch (error) {

      console.error(
        "Ошибка импорта Excel:",
        error
      );


      setMessage(

        error instanceof Error
          ? error.message
          : "Неизвестная ошибка чтения Excel"

      );

    } finally {

      setLoading(false);

    }

  }


  // ==========================================
  // ИНТЕРФЕЙС
  // ==========================================

  return (

    <div className="stock-upload-box">

      <div>

        <div className="input-label">
          Файл остатков
        </div>


        <div className="muted">

          {fileName

            ? `Выбран: ${fileName}`

            : "Файл пока не выбран"}

        </div>

      </div>


      <label
        className=
          "primary-button stock-file-button"
      >

        {loading
          ? "Обрабатываем..."
          : "Выбрать Excel"}


        <input
          type="file"

          accept=".xlsx,.xls"

          disabled={
            loading
          }

          onChange={
            (event) => {

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

          hidden
        />

      </label>


      <div className="stock-upload-message">

        {message}

      </div>

    </div>

  );
}
