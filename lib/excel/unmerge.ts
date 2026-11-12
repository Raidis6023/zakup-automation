import type ExcelJS from "exceljs";

/**
 * Every XLSX produced by the workspace must be completely unmerged.
 * Unmerge before serializing, including ranges inherited from VED templates.
 * ExcelJS keeps the original top-left cell value and formatting.
 */
export function removeMergedCellsFromWorkbook(workbook: ExcelJS.Workbook): void {
  for (const worksheet of workbook.worksheets) {
    const ranges = [...(worksheet.model.merges ?? [])];
    for (const range of ranges) {
      worksheet.unMergeCells(range);
    }
    if ((worksheet.model.merges ?? []).length > 0) {
      throw new Error("Не удалось удалить объединённые ячейки из Excel");
    }
  }
}
