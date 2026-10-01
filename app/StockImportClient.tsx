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
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ============================================
// ПАРСИНГ ЧИСЛА
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

    if (
      !Number.isFinite(value)
    ) {
      return null;
    }

    return Math.round(value);
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
// ПРЕОБРАЗОВАНИЕ ДАТЫ
// ============================================

function toIsoDate(
  value: unknown
):
  string | null {

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
// ПОЛУЧЕНИЕ ЯЧЕЙКИ
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
  // ОБРАБОТКА EXCEL
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
      // 1. ЧИТАЕМ ФАЙЛ
      // ======================================

      const buffer =
        await file.arrayBuffer();


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
      // 2. ВЫБИРАЕМ ЛИСТ
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
      // 3. ПРЕОБРАЗУЕМ ЛИСТ В МАССИВ
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
      // 4. ОПРЕДЕЛЯЕМ ДАТУ ОТЧЁТА
      //
      // Сначала читаем физическую C2.
      // Затем используем резервный поиск.
      // ======================================

      let reportDateValue:
        unknown =
        worksheet["C2"]?.v;


      let reportDate =
        toIsoDate(
          reportDateValue
        );


      if (!reportDate) {

        for (
          let rowIndex = 0;
          rowIndex <
            Math.min(
              rows.length,
              15
            );
          rowIndex++
        ) {

          const row =
            rows[rowIndex];


          if (
            !Array.isArray(row)
          ) {
            continue;
          }


          for (
            const cellValue
            of row
          ) {

            const text =
              normalizeText(
                cellValue
              )
                .toLowerCase();


            if (
              text.includes(
                "дата отчета"
              )
              ||
              text.includes(
                "дата отчёта"
              )
            ) {

              const foundDate =
                toIsoDate(
                  cellValue
                );


              if (foundDate) {

                reportDate =
                  foundDate;

                break;

              }

            }

          }


          if (reportDate) {
            break;
          }

        }

      }


      if (!reportDate) {

        console.log(
          "C2:",
          reportDateValue
        );


        throw new Error(
          "Не удалось определить дату отчёта"
        );

      }


      // ======================================
      // 5. РАЗБИРАЕМ ТОВАРЫ
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
          // КОЛОНКИ ТЕКУЩЕГО ФАЙЛА
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
          // 6. ОПРЕДЕЛЯЕМ СКЛАД
          // ==================================

          const possibleWarehouse =
            columnA
              .toLowerCase();


          if (
            possibleWarehouse
              .includes("склад")

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
          // 7. ПРОПУСКАЕМ ПУСТЫЕ СТРОКИ
          // ==================================

          if (
            !columnA &&
            !columnE &&
            !columnGText
          ) {
            return;
          }


          // ==================================
          // 8. ПРОПУСКАЕМ "ИТОГО"
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
          // 9. ПРОПУСКАЕМ ЗАГОЛОВКИ
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
          // 10. ЧИТАЕМ СВОБОДНЫЙ ОСТАТОК
          // ==================================

          const freeStock =
            parseNumber(
              columnGRaw
            );


          // ==================================
          // 11. ПРОВЕРКА,
          // ЧТО ЭТО ПОХОЖЕ НА ТОВАР
          // ==================================

          if (
            !columnA &&
            !columnE &&
            freeStock === null
          ) {
            return;
          }


          // ==================================
          // 12. ОШИБКА ПАРСИНГА
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
          // 13. ДОБАВЛЯЕМ СТРОКУ
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
      // 14. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
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
      // 15. СОЗДАЁМ PREVIEW В SUPABASE
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
      // 16. ПЕРЕХОДИМ НА PREVIEW
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
