"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import ExcelJS
  from "exceljs";

import {
  createStockImportPreview,
} from "./actions";


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


function cellText(
  value: unknown
) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }


  if (
    typeof value === "object"
  ) {

    const objectValue =
      value as {
        text?: string;

        result?: unknown;

        richText?: Array<{
          text?: string;
        }>;
      };


    if (
      typeof objectValue.text
      === "string"
    ) {
      return objectValue.text;
    }


    if (
      objectValue.result !==
      undefined
    ) {
      return String(
        objectValue.result
      );
    }


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


function normalizeText(
  value: unknown
) {

  return cellText(value)
    .replace(/\s+/g, " ")
    .trim();
}


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
      ).padStart(2, "0");

    const day =
      String(
        value.getDate()
      ).padStart(2, "0");


    return `${year}-${month}-${day}`;
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
      .padStart(2, "0");

  const month =
    match[2]
      .padStart(2, "0");

  const year =
    match[3];


  return `${year}-${month}-${day}`;
}


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

      const buffer =
        await file.arrayBuffer();


      const workbook =
        new ExcelJS.Workbook();


      await workbook.xlsx.load(
        buffer
      );


      const worksheet =
        workbook.getWorksheet(
          "Лист_1"
        )
        ??
        workbook.worksheets[0];


      if (!worksheet) {

        throw new Error(
          "В Excel не найден лист"
        );

      }


      // ======================================
      // ДАТА ОТЧЁТА
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
      // РАЗБОР СТРОК
      // ======================================

      const parsedRows:
        ParsedRow[] = [];


      let currentWarehouse:
        string | null = null;


      worksheet.eachRow(
        {
          includeEmpty: false,
        },

        (row, rowNumber) => {

          const columnA =
            normalizeText(
              row.getCell(1).value
            );

          const columnE =
            normalizeText(
              row.getCell(5).value
            );

          const columnGValue =
            row.getCell(7).value;

          const columnGText =
            normalizeText(
              columnGValue
            );

          const columnJ =
            normalizeText(
              row.getCell(10).value
            );


          // ==================================
          // СТРОКА С НАЗВАНИЕМ СКЛАДА
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
          // СЛУЖЕБНЫЕ СТРОКИ
          // ==================================

          if (
            !columnA &&
            !columnE &&
            !columnGText
          ) {
            return;
          }


          if (
            columnA
              .toLowerCase()
              .startsWith("итого")
          ) {
            return;
          }


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
          // ТОВАРНАЯ СТРОКА
          // ==================================

          const freeStock =
            parseNumber(
              columnGValue
            );


          // Если это вообще не похоже
          // на товарную строку —
          // пропускаем.
          if (
            !columnA &&
            !columnE &&
            freeStock === null
          ) {
            return;
          }


          let parseError:
            string | null = null;


          if (
            columnGText &&
            freeStock === null
          ) {

            parseError =
              "Не удалось прочитать свободный остаток";

          }


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


      if (
        parsedRows.length === 0
      ) {

        throw new Error(
          "В файле не найдено товарных строк"
        );

      }


      setMessage(
        `Найдено строк: ${parsedRows.length}. Создаём предварительную проверку...`
      );


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


      router.push(
        `/stock-import?batch=${batchId}`
      );


      router.refresh();


    } catch (error) {

      setMessage(

        error instanceof Error
          ? error.message
          : "Ошибка чтения Excel"

      );

    } finally {

      setLoading(false);

    }
  }


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


      <label className="primary-button stock-file-button">

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
                handleFile(
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
