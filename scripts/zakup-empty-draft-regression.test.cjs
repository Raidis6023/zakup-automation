"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const button = read("app/zakup/CreateVedDraftSubmitButton.tsx");
const page = read("app/zakup/page.tsx");
const action = read("app/actions.ts");
const migration = read("supabase/migrations/20261111_allow_empty_ved_order_draft.sql");

assert.doesNotMatch(button, /confirmedCount|Подтвердите хотя бы один товар/);
assert.match(button, /disabled=\{pending\}/);
assert.match(page, /Будет создан пустой черновик ВЭД/);
assert.doesNotMatch(page, /confirmedCount=\{/);
assert.match(action, /Number\(result\.items_created \?\? 0\) > 0/);
assert.match(migration, /v_has_selected_items AND NOT EXISTS/);
assert.match(migration, /ПУСТОЙ ЧЕРНОВИК РАЗРЕШЁН/);
assert.match(migration, /explicit_positive_manual_quantity_only_or_empty/);

console.log("PASS Закуп: ноль подтверждений создаёт пустой черновик, товары не добавляются автоматически");
