"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const get = file => fs.readFileSync(path.join(root, file), "utf8");
const shared = get("app/ui/WorkspaceDateFields.tsx");
const css = get("app/ui/WorkspaceDateFields.module.css");
for (const component of ["DateField", "TimeField", "DateTimeField", "ChoiceField"]) {
  assert.ok(shared.includes("export function " + component), "Missing shared " + component);
}
assert.ok(shared.includes("Asia/Krasnoyarsk"), "Today and time must use Krasnoyarsk");
assert.ok(shared.includes("createPortal"), "Date popup must avoid table clipping");
assert.ok(shared.includes('aria-label="Предыдущий месяц"'), "Calendar must navigate backward");
assert.ok(shared.includes('aria-label="Следующий месяц"'), "Calendar must navigate forward");
assert.ok(shared.includes('role="listbox"'), "Year/month must expose listbox");
assert.ok(css.includes("background: var(--picker-accent)"), "Selected dates use shared accent");
assert.ok(css.includes("var(--ws-surface"), "Calendar follows theme tokens");
const targets = [
  "app/ozon/financier/OzonRowRates.tsx",
  "app/ved/references/VedTariffEditor.tsx",
  "app/components/finance/KeywordAnalyticsClient.tsx",
  "app/VedProductionPanel.tsx",
  "app/ozon/financier/RatesEditorClient.tsx",
  "app/ozon/financier/FinancierClient.tsx",
  "app/yandex-market/financier/YandexFinancierClient.tsx",
  "app/wildberries/financier/WbFinancierClient.tsx",
  "app/ved/commercial-offers/VedOfferUploadDialog.tsx",
  "app/ved/registry/calculator/VedCalculator.tsx",
  "app/yandex-market/financier/YandexFinanceTable.tsx",
  "app/ved/registry/calculator/VedCalculatorWorkspace.tsx",
  "app/ved/registry/calculator/VedWholeOfferCalculator.tsx",
];
for (const file of targets) {
  const content = get(file);
  assert.ok(content.includes("DateField"), file + " must use shared calendar");
  assert.ok(!content.includes('type="date"'), file + " must not open native browser calendar");
}
const notes = get("app/tasks/TasksBoard.tsx");
assert.ok(notes.includes("<DateTimeField"), "Notes must use shared date/time");
assert.ok(!notes.includes('type="datetime-local"'), "Native date/time control remains");
const quick = get("app/HomeQuickNoteModal.tsx");
assert.ok(quick.includes("<TimeField"), "Header notes must use shared time picker");
assert.ok(!quick.includes('type="time"'), "Native time picker remains");
const sku = get("app/sku-list/SkuListTabsClient.tsx");
assert.ok(sku.includes("<ChoiceField"), "SKU period must use shared popup");
assert.ok(sku.includes('label: "Сентябрь"') && sku.includes('label: "Октябрь"'),
  "Both available months must remain selectable");
const header = get("app/HomeHeaderActions.tsx");
assert.ok(header.includes('target.closest("[data-workspace-picker-popup]")'),
  "Header note modal must stay open when using the portaled time picker");
console.log("PASS Unified calendars/time: theme, navigation, 13 date modules, notes and SKU month/year");
