"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.join(__dirname,"..");
const read=pathName=>fs.readFileSync(path.join(root,pathName),"utf8");
const sql=read("supabase/migrations/20261112_ved_two_preparation_confirmations.sql");
const noIncoterm=read("supabase/migrations/20261112_ved_draft_incoterm_selected_by_ved.sql");
const api=read("app/api/ved-orders/items/[id]/preparation-block/route.ts");
const page=read("app/VedOrderDetailClient.tsx");
const block=read("app/VedOrderPreparationBlocks.tsx");
const readRoute=read("app/api/ved-orders/[id]/route.ts");
const photo=read("app/api/ved-orders/[id]/excel-photo/[itemId]/route.ts");
const css=read("app/ved-preparation-blocks.css");
const dialog=read("app/VedOrderAddItemsDialog.tsx");
const upload=read("app/api/ved-orders/[id]/import-excel/route.ts");

assert.match(sql,/ADD COLUMN IF NOT EXISTS characteristics_confirmed_at/);
assert.match(sql,/ADD COLUMN IF NOT EXISTS order_terms_confirmed_at/);
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.ved_confirm_preparation_block/);
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.get_ved_order_handoff_readiness/);
assert.match(sql,/p_block='characteristics'/);
assert.match(sql,/v_item\.photo_url/);
assert.match(sql,/v_item\.units_per_carton_snapshot IS DISTINCT FROM v_units/);
assert.match(sql,/order_terms_confirmed_at=CASE/);
assert.match(sql,/v_quantity<v_moq/);
assert.match(sql,/order_quantity=v_quantity::integer/);
assert.match(sql,/moq_review_status='not_required'/);
assert.match(sql,/characteristics_confirmed_at IS NULL/);
assert.match(sql,/order_terms_confirmed_at IS NULL/);
assert.match(sql,/missing_incoterm',0/);
assert.doesNotMatch(sql,/DROP NOT NULL|DROP CONSTRAINT/);
assert.match(sql,/REVOKE ALL ON FUNCTION public\.ved_confirm_preparation_block/);
assert.match(sql,/TO service_role/);
assert.match(noIncoterm,/create_ved_order_draft_original_20261015/);
assert.match(noIncoterm,/null::text/);
assert.match(api,/auth\.getUser/);
assert.match(api,/app_get_my_profile/);
assert.match(api,/profile\.has_admin_access === true/);
assert.match(api,/order\.preparation_department === "procurement"/);
assert.match(api,/order\.preparation_department === "analytics"/);
assert.match(api,/new URL\(origin\)\.host !== host/);
assert.match(api,/admin\.rpc\("ved_confirm_preparation_block"/);
assert.match(api,/p_actor_id: user\.id/);
assert.match(page,/import VedOrderPreparationBlocks from "\.\/VedOrderPreparationBlocks"/);
assert.match(page,/<VedOrderPreparationBlocks[\s\S]*?item=\{selectedItem\}[\s\S]*?onSaved=\{refreshAll\}/);
assert.doesNotMatch(page,/Подтвердить MOQ и цену/);
assert.match(page,/Готовность к передаче в ВЭД/);
assert.match(block,/Подтвердить характеристики/);
assert.match(block,/Подтвердить условия заказа/);
assert.match(block,/Готовность к передаче в ВЭД/);
assert.match(block,/characteristics_confirmed_at/);
assert.match(block,/order_terms_confirmed_at/);
assert.match(block,/cartonVolumeM3/);
assert.match(block,/cartonLengthCm/);
assert.match(block,/individualLengthCm/);
assert.match(block,/chineseArticle/);
assert.match(block,/name: item\.product_name_snapshot/);
assert.match(block,/Math\.ceil\(target \/ units\)/);
assert.match(block,/Нет.*фото|загрузите выше/);
assert.match(block,/наш артикул|Наш артикул/);
assert.match(block,/FOB\/FCA и порт/);
assert.match(readRoute,/"characteristics_confirmed_at"/);
assert.match(readRoute,/"order_terms_confirmed_at"/);
assert.match(readRoute,/"import_carton_length_cm"/);
assert.match(readRoute,/characteristics_confirmed: characteristicsConfirmedCount/);
assert.match(readRoute,/order_block_confirmed: orderBlockConfirmedCount/);
assert.match(photo,/characteristics_confirmed_at:null/);
assert.match(photo,/if\(!item\)return/);
assert.match(dialog,/Из каталога ЕНОТ/);
assert.doesNotMatch(dialog,/\["our_article", "Наш артикул"/);
assert.match(upload,/name:item\.name,our_article:""/);
assert.match(block,/ved-confirm-groups/);
assert.match(block,/Основные данные/);
assert.match(block,/Транспортный короб/);
assert.match(block,/Индивидуальная упаковка/);
assert.match(block,/ved-confirm-grid--terms/);
assert.ok(css.includes("grid-template-columns:repeat(3,minmax(0,1fr))"));
assert.ok(css.includes("@media(max-width:560px)"));
assert.match(css,/--panda-table-background/);
assert.match(css,/--panda-table-fg/);
assert.doesNotMatch(css,/@media\s*\(\s*prefers-color-scheme/);
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
for(const file of [
 "app/VedOrderPreparationBlocks.tsx",
 "app/VedOrderDetailClient.tsx",
 "app/api/ved-orders/[id]/route.ts",
 "app/api/ved-orders/items/[id]/preparation-block/route.ts",
 "app/api/ved-orders/[id]/excel-photo/[itemId]/route.ts",
 "app/VedOrderAddItemsDialog.tsx",
 "app/VedOrderExcelImport.tsx"
]){
 const compiled=ts.transpileModule(read(file),{
  fileName:file,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}
 });
 const errs=(compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 assert.equal(errs.length,0,file+": "+errs.map(x=>x.messageText).join("; "));
}
console.log("PASS VED: two independently confirmed blocks; both product kinds editable; MOQ, cartons and source snapshot; VED-only FOB/port/our article; theme and auth");
