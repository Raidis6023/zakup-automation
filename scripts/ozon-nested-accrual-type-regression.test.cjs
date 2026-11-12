const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync('lib/ozon/accrual-type.ts','utf8');
const generated=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const mod={exports:{}};
new Function('module','exports',generated)(mod,mod.exports);
const {accrualTypeId}=mod.exports;
assert.equal(accrualTypeId({accrued_category:'NON_ITEM',non_item_fee:{type_id:41}}),'41');
assert.equal(accrualTypeId({accrued_category:'NON_ITEM',non_item_fee:{type_id:12}}),'12');
assert.equal(accrualTypeId({accrued_category:'ITEM',item_fees:{fees:[{fees:[{type_id:1}]}]}}),'1');
assert.equal(accrualTypeId({accrued_category:'ITEM',item_fees:{fees:[{fees:[{type_id:29},{type_id:29}]}]}}),'29');
assert.equal(accrualTypeId({accrued_category:'ITEM',item_fees:{fees:[{fees:[{type_id:29},{type_id:32}]}]}}),null);
assert.equal(accrualTypeId({accrued_category:'POSTING',posting:{products:[{delivery:{services:[{type_id:32}]}}]}}),null);
assert.equal(accrualTypeId({accrued_category:'NON_ITEM',non_item_fee:{}}),null);
const seller=fs.readFileSync('app/api/agents/ozon-finance-sync/route.ts','utf8');
assert(seller.includes('type_id: accrualTypeId(entry)'));
const worker=fs.readFileSync('app/api/agents/ozon-finance-ads/worker.ts','utf8');
assert(worker.includes("const lastHistorical=new Date(Date.parse(krasnoyarskToday+'T00:00:00Z')-86400000)"));
assert(worker.includes('o.moneySpent!==undefined'));
const ui=fs.readFileSync('app/ozon/financier/FinancierDetailTable.tsx','utf8');
assert(ui.includes('{name:"Реклама",'));
assert(ui.includes('sellerAdvertisingUnconfirmed'));
console.log('PASS Ozon nested accrual types, yesterday priority, honest ad KPI');
