import type ExcelJS from "exceljs";

/**
 * Every XLSX produced by the workspace must be completely unmerged.
 * Unmerge before serializing, including ranges inherited from VED templates.
 * ExcelJS keeps the original top-left cell value and formatting.
 */
export function removeMergedCellsFromWorkbook(workbook: ExcelJS.Workbook): void {
  for (const worksheet of workbook.worksheets) {
    const ranges = [...(worksheet.model.merges ?? [])];
    // Merged children are aliases of the top-left master in ExcelJS. Check
    // each master's data, including cached formulas, before and after unmerge.
    // If the library ever changes behavior, abort instead of exporting data loss.
    const masters = ranges.map(range => {
      const master = range.split(":")[0];
      return { master, value: JSON.stringify(worksheet.getCell(master).value) };
    });
    for (const range of ranges) {
      worksheet.unMergeCells(range);
    }
    for (const { master, value } of masters) {
      if (JSON.stringify(worksheet.getCell(master).value) !== value) {
        throw new Error("Данные ячейки " + master + " изменились при разъединении Excel");
      }
    }
    if ((worksheet.model.merges ?? []).length > 0) {
      throw new Error("Не удалось удалить объединённые ячейки из Excel");
    }
  }
}
