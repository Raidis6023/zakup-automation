"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const file = path.join(__dirname, "..", "app", "zakup", "ZakupProductsTableClient.tsx");
const source = fs.readFileSync(file, "utf8");

function columnKeys(from, until) {
  const first = source.indexOf(from);
  const last = source.indexOf(until, first);
  assert.ok(first >= 0 && last > first, "Missing column definition");
  return Array.from(source.slice(first, last).matchAll(/\bkey: "([^"]+)"/g), item => item[1]);
}

assert.deepEqual(columnKeys("const SUMMARY_COLUMNS:", "const BREAKDOWN_COLUMNS:"), ["master_code","offer_id","name","avg_sales_per_day","marketplace_stock","own_stock_quantity","responsible_storage_quantity","active_ved_quantity","overall_stock","coverage_days"]);
assert.deepEqual(columnKeys("const BREAKDOWN_COLUMNS:", "function quantity("), ["master_code","offer_id","ozon_name","ozon_sales_28_days","ozon_daily_sales","ozon_stock_quantity","wb_sales_28_days","wb_daily_sales","wb_stock_quantity","yandex_sales_28_days","yandex_daily_sales","yandex_stock_quantity","own_stock_quantity","responsible_storage_quantity","active_ved_quantity","overall_stock","coverage_days"]);

assert.match(source, /function marketplaceStock\(/);
assert.match(source, /function overallStock\(/);
assert.match(source, /quantity\(item\.ozon_stock_quantity\)/);
assert.match(source, /quantity\(item\.wb_stock_quantity\)/);
assert.match(source, /quantity\(item\.yandex_stock_quantity\)/);
assert.match(source, /quantity\(item\.own_stock_quantity\)/);
assert.match(source, /quantity\(item\.responsible_storage_quantity\)/);
assert.match(source, /quantity\(item\.active_ved_quantity\)/);
assert.match(source, /item\.ozon_name \?\? item\.name/);
assert.match(source, /item\.sales_28_days\) \/ 28/);

const groupHeadings = Array.from(source.matchAll(/scope="colgroup">([^<]+)<\/th>/g), item => item[1]);
assert.deepEqual(groupHeadings, ["Ozon", "Wildberries", "Яндекс Маркет"]);
assert.ok(source.includes("BREAKDOWN_COLUMNS.slice(0, 3)"));
assert.ok(source.includes("BREAKDOWN_COLUMNS.slice(3, 12)"));
assert.ok(source.includes("BREAKDOWN_COLUMNS.slice(12)"));

const parsed = ts.transpileModule(source, {
  fileName: "ZakupProductsTableClient.tsx",
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  reportDiagnostics: true,
});
const errors = (parsed.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, "Invalid TSX: " + errors.map(x => x.messageText).join("; "));
console.log("PASS Закуп: 10 сводных, 17 подробных столбцов, три МП, сумма запасов и TSX");
