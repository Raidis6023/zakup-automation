"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const base = path.join(__dirname,"..");
const read = p => fs.readFileSync(path.join(base,p),"utf8");

const dialog=read("app/VedOrderAddItemsDialog.tsx");
const page=read("app/VedOrderDetailClient.tsx");
const route=read("app/api/ved-orders/[id]/add-items/route.ts");
const style=read("app/ved-add-items.css");
const migration=read("supabase/migrations/20261112_ved_add_catalog_and_new_items_to_draft.sql");
const patch=read("supabase/migrations/20261112_ved_add_items_use_generated_totals.sql");
const removal=read("supabase/migrations/20261112_ved_manual_draft_items_removal.sql");
const getOrder=read("app/api/ved-orders/[id]/route.ts");

assert.match(page,/import VedOrderAddItemsDialog from "\.\/VedOrderAddItemsDialog"/);
assert.match(page,/<VedOrderAddItemsDialog[\s\S]*?orderId=\{orderId\}[\s\S]*?onAdded=\{refreshAll\}/);
assert.match(page,/\["draft", "returned_for_edit"\]/);
assert.match(dialog,/\+ Добавить товар/);
assert.match(dialog,/Из каталога ЕНОТ/);
assert.match(dialog,/Новый товар/);
assert.match(dialog,/aria-modal="true"/);
assert.match(dialog,/aria-pressed=\{mode === "catalog"\}/);
assert.match(dialog,/aria-pressed=\{mode === "new"\}/);
assert.match(dialog,/existing\.has\(product\.id\)/);
assert.match(dialog,/selectedCount/);
assert.match(dialog,/onAdded\(\)/);
assert.match(dialog,/units_per_carton/);
assert.match(dialog,/carton_volume_m3/);
assert.match(dialog,/carton_weight_kg/);
assert.match(dialog,/unit_price_cny/);
assert.match(route,/session\.auth\.getUser\(\)/);
assert.match(route,/app_get_my_profile/);
assert.match(route,/profile\.has_admin_access === true/);
assert.match(route,/order\.preparation_department === "procurement"/);
assert.match(route,/order\.preparation_department === "analytics"/);
assert.match(route,/new URL\(origin\)\.host !== host/);
assert.match(route,/rpc\("ved_add_draft_items"/);
assert.match(route,/p_actor_id: access\.userId/);
assert.match(route,/!Array\.isArray\(body\.items\)/);
assert.match(route,/max.*50|body\.items\.length > 50/);
assert.match(migration,/CREATE OR REPLACE FUNCTION public\.ved_add_draft_items/);
assert.match(migration,/FOR UPDATE/);
assert.match(migration,/v_mode='catalog'/);
assert.match(migration,/v_mode='new'/);
assert.match(migration,/already.*present|уже присутствует в заказе/);
assert.match(migration,/ved_order_audit_log/);
assert.match(migration,/REVOKE ALL ON FUNCTION public\.ved_add_draft_items/);
assert.match(migration,/TO service_role/);
assert.match(patch,/total_price_cny,total_volume_m3,total_weight_tons/);
assert.match(page,/item\.added_manually/);
assert.match(page,/void removeManualItem\(item\.id\)/);
assert.match(page,/method: "DELETE"/);
assert.match(route,/export async function DELETE/);
assert.match(route,/rpc\("ved_remove_manual_draft_item"/);
assert.match(getOrder,/"added_manually"/);
assert.match(removal,/ADD COLUMN IF NOT EXISTS added_manually/);
assert.match(removal,/CREATE OR REPLACE FUNCTION public\.ved_remove_manual_draft_item/);
assert.match(removal,/v_item\.added_manually IS DISTINCT FROM true/);
assert.match(removal,/item_removed/);
assert.match(removal,/TO service_role/);
assert.match(style,/--panda-table-background/);
assert.match(style,/--panda-table-fg/);
assert.doesNotMatch(style,/@media\s*\(\s*prefers-color-scheme/);
const count=(str,c)=>[...str].filter(x=>x===c).length;
assert.equal(count(style,"{"),count(style,"}"));
for (const file of [
 "app/VedOrderAddItemsDialog.tsx",
 "app/VedOrderDetailClient.tsx",
 "app/api/ved-orders/[id]/add-items/route.ts"
]) {
 const content=read(file);
 const compiled=ts.transpileModule(content,{
  fileName:file,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}
 });
 const errors=(compiled.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,file+": "+errors.map(x=>x.messageText).join("; "));
}
console.log("PASS ВЭД: безопасное добавление из ЕНОТ и новых товаров, массовый выбор, проверка прав, защита от дублей, автосуммы, палитра");
