"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const base=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(base,p),"utf8");
const sql=read("supabase/migrations/20261112_ved_manual_terms_without_demand.sql");
const fallback=read("supabase/migrations/20261112_ved_preview_manual_item_fallback.sql");
const route=read("app/api/ved-orders/items/[id]/terms/route.ts");
const client=read("app/VedOrderDetailClient.tsx");

assert.ok(sql.includes("CREATE OR REPLACE FUNCTION public.ved_manual_item_terms("));
assert.ok(sql.includes("SECURITY INVOKER"));
assert.ok(sql.includes("selected_demand_units IS NOT NULL"));
assert.ok(sql.includes("v_quantity := p_cartons::numeric * v_item.units_per_carton_snapshot::numeric"));
assert.ok(sql.includes("order_quantity=v_quantity::integer"));
assert.ok(sql.includes("IF p_cartons>0 AND v_quantity < p_moq_quantity THEN"));
assert.ok(sql.includes("IF NOT p_confirm THEN RETURN v_result; END IF;"));
assert.ok(sql.includes("v_item.incoterm IS NOT NULL"));
assert.ok(sql.includes("REVOKE ALL ON FUNCTION public.ved_manual_item_terms"));
assert.ok(sql.includes("TO service_role"));
assert.ok(!sql.includes("DROP NOT NULL"),"Must not weaken DB constraint");

assert.ok(fallback.includes("preview_ved_order_item_terms"));
assert.ok(fallback.includes("if v_item.added_manually and v_item.selected_demand_units is null then"));
assert.ok(fallback.includes("public.ved_manual_item_terms("));

assert.ok(route.includes('import { createClient } from "@/lib/supabase/server";'));
assert.ok(route.includes('import { createAdminClient } from "@/lib/supabase/admin";'));
assert.ok(route.includes('session.auth.getUser()'));
assert.ok(route.includes('session.rpc("app_get_my_profile")'));
assert.ok(route.includes('item.added_manually !== true'));
assert.ok(route.includes('profile.has_admin_access === true'));
assert.ok(route.includes('new URL(origin).host !== host'));
assert.ok(route.includes('admin.rpc("ved_manual_item_terms"'));
assert.ok(route.includes('body.manualCartons !== undefined'));
assert.ok(route.includes('action === "confirm"'));
assert.ok(route.includes('if ('));
assert.ok(route.includes('manualCartons?: number'));
assert.ok(route.includes('"preview_ved_order_item_terms"'),"Normal preview must remain");
assert.ok(route.includes('"confirm_ved_order_item_terms"'),"Normal confirm must remain");

assert.ok(client.includes('manualCartons: item.cartons === null ? "0" : String(item.cartons)'));
assert.ok(client.includes('manualCartons: "0"'));
assert.ok(client.includes('manualCartons: string;'));
assert.ok(client.includes('item.added_manually && item.selected_demand_units === null'));
assert.ok(client.includes('... (manualCartons !== undefined') || client.includes('...(manualCartons !== undefined'));
assert.ok(client.includes('Количество коробов вручную'));
assert.ok(client.includes('0 = подтвердить MOQ и цену'));
assert.ok(client.includes('item.added_manually ? "" :'));
assert.ok(client.includes('selectedItem.added_manually &&'));
assert.ok(client.includes('selectedItem.selected_demand_units === null'));

for(const filename of ["app/api/ved-orders/items/[id]/terms/route.ts","app/VedOrderDetailClient.tsx"]){
 const source=read(filename);
 const compiled=ts.transpileModule(source,{
  fileName:filename,reportDiagnostics:true,compilerOptions:{
   target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
   jsx:ts.JsxEmit.ReactJSX
  }
 });
 const errors=(compiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,filename+": "+errors.map(e=>e.messageText).join("; "));
}
console.log("PASS VED manual terms: no NULL quantity, existing procurement untouched, manual cartons & MOQ validation, actor authorization and FOB/FCA manual");
