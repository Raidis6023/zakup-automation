"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
const root = path.join(__dirname, "..");
function read(name) { return fs.readFileSync(path.join(root,name), "utf8"); }

const route = read("app/api/china/wb-operational-sales-sync/route.ts");
const button = read("app/zakup/WbSalesRefreshButton.tsx");
const page = read("app/zakup/page.tsx");
const config = JSON.parse(read("vercel.json"));
const sql = read("supabase/migrations/20261112_china_wb_operational_sales_live.sql");
const priority = read("supabase/migrations/20261112_china_wb_finance_precedence.sql");

assert.equal((config.crons||[]).filter(x => x.path.startsWith("/api/china/wb-order-feed-sync")).length,0);
assert.equal((config.crons||[]).filter(x => x.path === "/api/china/wb-operational-sales-sync").length,1);
assert.equal((route.match(/await fetch\(url,/g)??[]).length,1,"one request per run");
assert.match(route,/const RATE_LIMIT_MS = 2 \* 60 \* 60 \* 1000/);
assert.match(route,/response.status === 429/);
assert.match(route,/const PAGE_LIMIT = 80_000/);
assert.match(route,/\.not\("cursor", "is", null\)/);
assert.match(route,/nextCursor/);
assert.match(route,/onConflict: "sale_id"/);
assert.match(route,/moscowDate\(value\.date\)/);
assert.match(route,/warehouseType !== "Склад WB"/);
assert.match(route,/saleId\.startsWith\("R"\)/);
assert.match(route,/china_finish_wb_operational_import/);
assert.match(route,/request\.headers\.get\("authorization"\) === "Bearer " \+ secret/);
assert.match(route,/app_user_access/);
assert.match(route,/function isAuthorized/);
assert.match(button,/api\/china\/wb-operational-sales-sync/);
assert.match(page,/WbSalesRefreshButton/);
assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.china_wb_operational_sales/);
assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.china_wb_operational_days/);
assert.match(sql,/wb_operational_verified AS/);
assert.match(sql,/wb_finance_fallback AS/);
assert.match(priority,/v_wb_finance_days/);
for(const [name,source] of [
  ["app/api/china/wb-operational-sales-sync/route.ts",route],
  ["app/zakup/WbSalesRefreshButton.tsx",button],
  ["app/zakup/page.tsx",page],
]){
  const transpiled=ts.transpileModule(source,{
    fileName:name,
    reportDiagnostics:true,
    compilerOptions:{
      target:ts.ScriptTarget.ES2022,
      module:ts.ModuleKind.ESNext,
      jsx:ts.JsxEmit.ReactJSX
    }
  });
  const errors=(transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,name+": "+errors.map(e=>e.messageText).join("; "));
}
console.log("PASS China WB supplier/sales: FBW-only, S/R returns, 2-hour lock, 80k checkpoint, finance precedence, one cron, authenticated manual action, TSX");
