"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root,file),"utf8");
const page = read("app/zakup/page.tsx");
const info = read("app/zakup/ZakupCalculationInfo.tsx");
assert.match(page, /title="Китай — расчёт потребности"/);
assert.doesNotMatch(page, /description="Тестовый режим/);
assert.doesNotMatch(page, /orderDescription|zakup-v2-order-description/);
assert.doesNotMatch(page, /decisionDescription|zakup-v2-decision-description/);
assert.doesNotMatch(page, /className="card-label">Решение по транспорту/);
assert.match(page, /className="zakup-v2-decision-title">\{decisionTitle\}/);
assert.match(page, /<CreateVedDraftSubmitButton/);
assert.match(page, /<ZakupCalculateButton/);
assert.match(page, /<h2 className="controls-title">Расчёт закупки<\/h2>/);
assert.doesNotMatch(page, /Потребность по товарам и кубатура транспорта рассчитываются вместе/);
assert.doesNotMatch(page, /Подтверждённые продажи|zakup-confirmed-period/);

const section = read("app/zakup/ZakupProductsSectionClient.tsx");
const products = read("app/zakup/ZakupProductsTableClient.tsx");
const style = read("app/zakup/zakup-layout-v2.css");
assert.doesNotMatch(section, /zakup-products-toggle-subtitle|\{subtitle\}/);
assert.doesNotMatch(page, /subtitle="Отдельный список/);
assert.doesNotMatch(products, /Продажи за 28 дней, остатки в штуках/);
assert.match(style, /\.zakup-products-header:hover[\s\S]*?background: var\(--panda-table-hover/);
assert.match(style, /\.zakup-products-header \.zakup-products-toggle:hover\s*\{\s*background: transparent/);
assert.match(style, /\.zakup-products-view-toolbar\s*\{[\s\S]*?justify-content: flex-start/);
assert.match(products, /className="zakup-products-view-tabs" role="group"/);
assert.match(products, /aria-label="Отображение товаров"/);
assert.match(products, /Без разбивки/);
assert.match(products, /По маркетплейсам/);
assert.match(products, /aria-pressed=\{!showBreakdown\}/);
assert.match(products, /aria-pressed=\{showBreakdown\}/);
assert.match(products, /useState\(false\)/);
assert.match(products, /function changeView\(next: boolean\)/);
assert.doesNotMatch(products, /toggleBreakdown|Скрыть разбивку по маркетплейсам|Показать разбивку по маркетплейсам/);
assert.match(style, /\.zakup-products-view-tab\[aria-pressed="true"\]/);
assert.match(style, /--panda-table-selected/);
assert.match(info, /<dl>[\s\S]*?<\/dl>/);
assert.doesNotMatch(info, /<p>/);
for (const [name,content] of [["app/zakup/page.tsx",page],["app/zakup/ZakupCalculationInfo.tsx",info],["app/zakup/ZakupProductsSectionClient.tsx",section],["app/zakup/ZakupProductsTableClient.tsx",products]]) {
  const compiled = ts.transpileModule(content,{fileName:name,reportDiagnostics:true,compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX
  }});
  const errors=(compiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,name+": "+errors.map(e=>e.messageText).join("; "));
}
console.log("PASS Закуп UI: справка без подвала, без серых описаний, расчёт и кнопка заказа сохранены");
