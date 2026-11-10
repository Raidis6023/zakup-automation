const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('lib/ozon/financeAdvertising.ts','utf8');
const transformed=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const mod={exports:{}};
new Function('module','exports',transformed)(mod,mod.exports);
const {calculateProvisionalSkuProfit}=mod.exports;
// Real Seller net (already includes commission and advertising), cost, Mayak.
assert.equal(calculateProvisionalSkuProfit(1400,500,100,true),800);
assert.equal(calculateProvisionalSkuProfit(-200,50,10,true),-260);
// Fee type SALES / COMMISSION / acquiring is intentionally NOT required:
// these are nested descriptive lines with a different accounting date.
assert.equal(calculateProvisionalSkuProfit(0,200,50,true),-250);
assert.equal(calculateProvisionalSkuProfit(1400,null,100,true),null);
assert.equal(calculateProvisionalSkuProfit(1400,500,null,true),null);
assert.equal(calculateProvisionalSkuProfit(1400,500,100,false),null);
assert.equal(calculateProvisionalSkuProfit(Infinity,500,100,true),null);
const handler=fs.readFileSync('app/api/agents/ozon-finance/route.ts','utf8');
assert(handler.includes('g.estimated_result=calculateProvisionalSkuProfit('));
assert(!handler.includes("row.estimated_result=null;"));
assert(!handler.includes("missingSettlement"));
const ui=fs.readFileSync('app/ozon/financier/FinancierDetailTable.tsx','utf8');
assert(ui.includes('profitIsPartial'));
assert(ui.includes("Итого (неполное)"));
assert(ui.includes('profitIsPartial?null:operatingProfit'));
const migration=fs.readFileSync('supabase/migrations/20261110_ozon_finance_active_run_income_reference.sql','utf8');
assert(migration.includes('d.active_run_id=a.run_id'));
console.log('PASS Ozon profit: Seller net only, optional fees do not block, unknown actual costs remain null, partial totals identified');
