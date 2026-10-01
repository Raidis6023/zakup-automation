"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";

import {
  createStockImportPreview,
} from "./actions";


// ============================================
// ТИП СТРОКИ ПОСЛЕ РАЗБОРА EXCEL
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
// ПОЛУЧЕНИЕ ТЕКСТА ИЗ ЯЧЕЙКИ EXCEL
// ============================================

function cellText(
  value: unknown
): string {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }


  // Обычный текст
  if (
    typeof value === "string"
  ) {
    return value;
  }


  // Число
  if (
    typeof value === "number"
  ) {
    return String(value);
  }


  // Дата
  if (
    value instanceof Date
  ) {
    return value.toLocaleDateString(
      "ru-RU"
    );
  }


  // Сложные значения ExcelJS
  if (
    typeof value === "object"
  ) {

    const objectValue =
      value as {
        text?: string;

        result?: unknown;

        hyperlink?: string;

        richText?: Array<{
          text?: string;
        }>;
      };


    // Формат:
    // { text: "..." }
    if (
      typeof objectValue.text ===
      "string"
    ) {
      return objectValue.text;
    }


    // Формула:
    // { formula: "...", result: ... }
    if (
      objectValue.result !==
      undefined &&
      objectValue.result !==
      null
    ) {

      return String(
        objectValue.result
      );
    }


    // Rich text
    if (
      Array.isArray(
        objectValue.richText
      )
    ) {

      return objectValue
        .richText
        .map(
          (part) =>
            part.text ?? ""
        )
        .join("");
    }

  }


  return String(value);
}


// ============================================
// НОРМАЛИЗАЦИЯ ТЕКСТА
// ============================================

function normalizeText(
  value: unknown
): string {

  return cellText(value)

    // Неразрывные пробелы
    .replace(/\u00A0/g, " ")

    // Несколько пробелов подряд
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

      // удаляем обычные и неразрывные пробелы
      .replace(/\s/g, "")

      // российская десятичная запятая
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
// ПРЕОБРАЗОВАНИЕ ДАТЫ В YYYY-MM-DD
// ============================================

function toIsoDate(
  value: unknown
):
  string | null {

  // ExcelJS уже распознал дату
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
// КОМПОНЕНТ ИМПОРТА
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
  // ОБРАБОТКА ВЫБРАННОГО EXCEL
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
        new ExcelJS.Workbook();


      // ======================================
      // ВАЖНО:
      // игнорируем графические элементы Excel.
      //
      // В исходном файле есть drawing,
      // который ExcelJS пытается разобрать
      // через anchors и падает.
      //
      // Для остатков нам рисунки не нужны.
      // ======================================

      await workbook.xlsx.load(
        buffer,
        {
          ignoreNodes: [
            "drawing",
            "legacyDrawing",
            "legacyDrawingHF",
          ],
        }
      );


      // ======================================
      // 2. ВЫБИРАЕМ ЛИСТ
      // ======================================

      const worksheet =
        workbook.getWorksheet(
          "Лист_1"
        )
        ??
        workbook.worksheets[0];


      if (!worksheet) {

        throw new Error(
          "В Excel не найден ни один лист"
        );

      }


      // ======================================
      // 3. ДАТА ОТЧЁТА
      // ======================================

      const reportDate =
        toIsoDate(
          worksheet.getCell(
            "C2"
          ).value
        );


      if (!reportDate) {

        throw new Error(
          "Не удалось определить дату отчёта из ячейки C2"
        );

      }


      // ======================================
      // 4. РАЗБОР ТОВАРНЫХ СТРОК
      // ======================================

      const parsedRows:
        ParsedRow[] = [];


      let currentWarehouse:
        string | null = null;


      worksheet.eachRow(
        {
          includeEmpty: false,
        },

        (
          row,
          rowNumber
        ) => {

          // ==================================
          // КОЛОНКИ ТЕКУЩЕГО ФОРМАТА
          // ==================================

          // A — Номенклатура
          const columnA =
            normalizeText(
              row.getCell(1).value
            );


          // E — Артикул
          const columnE =
            normalizeText(
              row.getCell(5).value
            );


          // G — Свободный остаток
          const columnGValue =
            row.getCell(7).value;


          const columnGText =
            normalizeText(
              columnGValue
            );


          // J — Штрихкод
          const columnJ =
            normalizeText(
              row.getCell(10).value
            );


          // ==================================
          // ОПРЕДЕЛЯЕМ СКЛАД
          // ==================================

          const possibleWarehouse =
            columnA.toLowerCase();


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
          // ПУСТАЯ СТРОКА
          // ==================================

          if (
            !columnA &&
            !columnE &&
            !columnGText
          ) {
            return;
          }


          // ==================================
          // ИТОГИ
          // ==================================

          if (
            columnA
              .toLowerCase()
              .startsWith("итого")
          ) {
            return;
          }


          // ==================================
          // ЗАГОЛОВОК НОМЕНКЛАТУРЫ
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


          // ==================================
          // ЗАГОЛОВОК АРТИКУЛА
          // ==================================

          if (
            columnE
              .toLowerCase()
              === "артикул"
          ) {
            return;
          }


          // ==================================
          // ЧИТАЕМ СВОБОДНЫЙ ОСТАТОК
          // ==================================

          const freeStock =
            parseNumber(
              columnGValue
            );


          // ==================================
          // ЕСЛИ ЭТО НЕ ПОХОЖЕ НА ТОВАР —
          // НЕ ДОБАВЛЯЕМ В PREVIEW
          // ==================================

          if (
            !columnA &&
            !columnE &&
            freeStock === null
          ) {
            return;
          }


          // ==================================
          // ПРОВЕРКА ОШИБКИ ПАРСИНГА
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
          // ДОБАВЛЯЕМ ТОВАРНУЮ СТРОКУ
          // ==================================

          parsedRows.push({

            source_row_number:
              rowNumber,


            warehouse_name:
              currentWarehouse,


            product_name:
              columnA || null,


            // Пока передаём исходное значение.
            // В Supabase будет выполнен trim().
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
      // 5. ПРОВЕРЯЕМ, ЧТО ТОВАРЫ НАШЛИСЬ
      // ======================================

      if (
        parsedRows.length === 0
      ) {

        throw new Error(
          "В файле не найдено товарных строк"
        );

      }


      setMessage(
        `Найдено товарных строк: ${parsedRows.length}. Создаём предварительную проверку...`
      );


      // ======================================
      // 6. СОЗДАЁМ PREVIEW В SUPABASE
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


      // ======================================
      // 7. ПЕРЕХОДИМ НА PREVIEW
      // ======================================

      setMessage(
        "Файл обработан. Загружаем предварительный просмотр..."
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

          accept=".xlsx"

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
