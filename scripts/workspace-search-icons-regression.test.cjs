"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const searchFiles = [
  "app/sku-list/SkuListTabsClient.tsx",
  "app/ved/registry/VedRegistryTable.tsx",
  "app/stocks/StocksClient.tsx",
  "app/VedOrderAddItemsDialog.tsx",
  "app/admin/logs/LogsClient.tsx",
  "app/wildberries/financier/WbFinancierClient.tsx",
  "app/yandex-market/financier/YandexFinanceTable.tsx",
  "app/ozon/financier/FinancierDetailTable.tsx",
  "app/ozon/financier/RatesEditorClient.tsx",
  "app/unit-economics/UnitEconomicsClient.tsx",
  "app/unit-economics/UnitEconomicsPilotClient.tsx",
  "app/unit-economics/TariffTablesClient.tsx",
  "app/ved/references/VedTariffEditor.tsx",
  "app/unit-economics/VedUnitEconomicsLive.tsx",
  "app/wildberries/fbw-supplies/FbwSupplyWizard.tsx"
];
for (const file of searchFiles) {
  const source = read(file);
  assert.ok(source.includes("workspace-search-field"), file+": shared search icon class missing");
}
const sku = read("app/sku-list/SkuListTabsClient.tsx");
assert.ok(!sku.includes("sku-list-search-heading"), "SKU search caption should be removed");
assert.ok(!sku.includes('placeholder="Например, артикул'), "SKU search must not show placeholder prose");
assert.ok(sku.includes("aria-label=\"Поиск товара в списке артикулов\""), "Search remains accessible");
assert.ok(sku.includes("onChange={event => setSearchQuery(event.target.value)}"), "SKU search stays functional");
const page = read("app/sku-list/page.tsx");
assert.ok(!page.includes("Финансовые показатели по артикулам маркетплейсов с привязкой к ЕНОТ."), "Remove redundant SKU subtitle");
const registry = read("app/ved/registry/VedRegistryTable.tsx");
assert.ok(!registry.includes("Например, RCAB-AVD26828-1"), "Registry must have an icon, not an example");
assert.ok(registry.includes("onChange={event=>setSearch(event.target.value)}"), "Registry search stays functional");
const header = read("app/WorkspaceShell.tsx");
assert.ok(header.includes('"home-search-icon"') && header.includes("<SearchIcon />"), "Existing header magnifier remains");
assert.ok(!header.includes("Поиск по сотрудникам, доступам, настройкам..."), "Admin header placeholder removed");
assert.ok(!header.includes("Поиск по товарам, SKU, документам, разделам..."), "Work header placeholder removed");
const theme = read("app/workspace-unified-champagne.css");
assert.ok(theme.includes(".home-shell input.workspace-search-field"), "Search icon shared across pages");
assert.ok(theme.includes('html[data-theme="dark"] .home-shell input.workspace-search-field'), "Search icon respects dark theme");
assert.ok(theme.includes("stroke='%23101820'") && theme.includes("stroke='%23d9b27c'"), "Use the brand icon colors");
const pilotStyles = read("app/unit-economics/unit-economics-pilot.css");
assert.match(pilotStyles, /\.unit-version-root \.unit-pilot \.unit-table-toolbar input\s*\{[\s\S]*?background:var\(--ws-surface\)/,
  "Pilot stylesheet resets background subproperties through shorthand");
const searchIconRule = theme.match(/\.home-shell input\.workspace-search-field\s*\{([^}]+)\}/)?.[1] ?? "";
for (const [property, expected] of [
  ["background-image", /url\([^)]+\)\s*!important/],
  ["background-repeat", /no-repeat\s*!important/],
  ["background-position", /12px center\s*!important/],
  ["background-size", /18px 18px\s*!important/],
]) {
  assert.match(searchIconRule, new RegExp(property + ":\\s*" + expected.source),
    property + " must override the pilot toolbar background shorthand");
}
for (const file of ["app/login/LoginForm.tsx", "app/tasks/TasksBoard.tsx"]) {
  assert.ok(read(file).includes("placeholder="), "Non-search form hints must stay untouched: "+file);
}
console.log("PASS Global search icons: 15 search modules, two themes, preserved handlers, clean SKU header");
