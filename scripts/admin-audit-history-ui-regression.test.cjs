"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
const migration = read("supabase/migrations/20261112_audit_marketplace_sources.sql");
const labels = read("app/admin/logs/auditLabels.ts");
const client = read("app/admin/logs/LogsClient.tsx");
const css = read("app/admin/logs/logs.css");
const nav = read("app/workspace-unified-champagne.css");
for (const table of [
  "ozon_sales_sync_runs", "ozon_stock_snapshots", "wb_sales_import_runs",
  "wb_stock_product_snapshots", "wb_finance_cache_jobs",
  "ozon_finance_page_jobs", "ozon_finance_ad_sync_jobs",
]) {
  assert.ok(migration.includes("from public." + table), table + " absent from audit feed");
}
assert.ok(migration.includes("group by s.snapshot_date"), "Ozon stock rows must be grouped by daily snapshots");
assert.ok(migration.includes("group by s.snapshot_id"), "WB stock rows must be grouped by snapshot");
assert.ok(migration.includes("where s.status in ('complete','failed','error')"),
  "Incomplete Ozon finance jobs must not be presented as success");
for (const action of [
  "ozon_sales", "ozon_stocks", "wb_sales", "wb_stocks", "wb_finance",
  "ozon_finance", "ozon_ads", "marketplace_sync", "photo_auto_loaded",
]) {
  assert.ok(labels.includes(action), "Untranslated action " + action);
}
assert.ok(labels.includes('Яндекс Маркет') && labels.includes(' · общая синхронизация'), "Yandex code must become human label");
assert.ok(labels.includes('Автоматически загружены фотографии товаров'), "VED event must be readable");
assert.ok(labels.includes('сохранён результат расчёта'), "Unit event must be readable");
assert.ok(client.includes("formatAuditEvent(event)"), "Audit rows must use readable captions");
assert.ok(client.includes("<colgroup>"), "Table needs stable explicit column widths");
assert.ok(client.includes("logs-expanded-row"), "Details open as their own full-width table row");
assert.ok(client.includes("colSpan={6}"), "Details span all six columns");
assert.ok(client.includes('expanded ? "Скрыть" : "Открыть"'), "Action button must change its label");
assert.ok(!client.includes("<details>"), "Old cell-internal details must not remain");
assert.ok(css.includes("table-layout: fixed"), "No resizing when opening audit details");
assert.ok(css.includes(".logs-details-button"), "Details must look like the rest of the site");
assert.ok(nav.includes("every unselected navigation glyph inherits"), "Both modes use common themed navigation");
assert.ok(nav.includes("var(--ws-utility-icon)"), "Icon tint must track selected workspace theme");
assert.ok(nav.includes('html[data-theme="dark"] .home-shell[data-accent-area]'), "Dark theme icon color must be supported");
console.log("PASS PANDA audit UI: readable events, fixed 6-column details, Ozon/WB sources, themed sidebar icons");
