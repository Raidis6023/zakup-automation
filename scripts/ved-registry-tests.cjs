const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const ts=require("typescript");
const code=fs.readFileSync(path.join(__dirname,"../lib/ved-calculation/registry.ts"),"utf8");
const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function("exports","module",compiled)(mod.exports,mod);
const {buildVedRegistry}=mod.exports;
const offers=[{id:"offer1",quote_code:"КП-26-ROY-0001",supplier_code:"ROY",quote_date:"2026-11-02"}];
const items=[
 {id:"item1",offer_id:"offer1",supplier_article:"RCAB-AVD26828-1",description_original:"Ватные палочки 600\nОписание",source_sheet:"Sheet1"},
 {id:"item2",offer_id:"offer1",supplier_article:"RCAB-AVD26828-2",description_original:"Ватные палочки 800",source_sheet:"Sheet1"},
 {id:"item3",offer_id:"offer1",supplier_article:"RCAB-AVD26828-3",description_original:"Ватные палочки 1000",source_sheet:"Sheet1"},
 {id:"item4",offer_id:"offer1",supplier_article:"RCAB-AVD26828-4",description_original:"Ватные палочки 1200",source_sheet:"Sheet1"},
];
const result=(n)=>({averageCostPerUnitRub:n,scenarios:{"40hq":{managementCostPerUnitRub:n-5},moq:{managementCostPerUnitRub:n+5}}});
const entry=(id,r)=>({itemId:id,article:"article"+id,title:"Title",result:r,errors:!r?["Пошлина не задана"]:[]});
const versions=[
 {id:"v2",offer_id:"offer1",version_no:2,calculation_date:"2026-11-02",created_at:"2026-11-02T09:00:00Z",
  items_data:items.map(i=>entry(i.id,null))},
 {id:"v1",offer_id:"offer1",version_no:1,calculation_date:"2026-11-02",created_at:"2026-11-02T08:00:00Z",
  items_data:items.map((i,j)=>entry(i.id,result([59.29,86.17,101.45,116.08][j])))},
 {id:"v3",offer_id:"offer1",version_no:3,calculation_date:"2026-11-02",created_at:"2026-11-02T10:00:00Z",
  items_data:items.map((i,j)=>entry(i.id,result([59.29,86.17,101.45,116.08][j])))},
];
const rows=buildVedRegistry(offers,items,versions);
assert.equal(rows.length,4,"Four products must appear once, not three version duplicates");
for(const item of items){
 const row=rows.find(r=>r.id===item.id);
 assert(row,"Missing saved SKU "+item.id);
 assert.equal(row.history.length,3);
 assert.deepEqual(row.history.map(x=>x.number),[3,2,1]);
 assert.equal(row.quoteCode,"КП-26-ROY-0001");
 assert(row.history[0].cost,"latest real calculation must survive");
 assert.equal(row.history[1].cost,null,"draft must not be presented as calculated");
}
const fallback=buildVedRegistry(offers,items,versions.filter(v=>v.id!=="v3"));
assert.equal(fallback[0].history[0].cost,null);
assert(fallback[0].history.find(h=>h.cost)?.cost.average>0,"Older calculated version must remain accessible");
const uncalculated=buildVedRegistry(offers,items,[]);
assert.equal(uncalculated.length,4);
assert(uncalculated.every(r=>r.history.length===0),"Uncalculated imported goods must still appear");
const one=buildVedRegistry(offers,items.slice(0,1),versions.filter(v=>v.id==="v1"));
assert.equal(one.length,4,"Saved products must still appear even if source record is temporarily missing");
const snapshots=[
 {id:"snapshot1",calculation_id:"calc1",title:"Расчёт первого артикула",article:"RCAB-AVD26828-1",
  version_no:1,calculation_date:"2026-11-02",created_at:"2026-11-02T07:00:00Z",
  offer_item_id:"item1",result_data:result(49.63),input_data:{product:{tnVedCode:""}}},
 {id:"snapshot2",calculation_id:"calc2",title:"Отдельный новый товар",article:"STANDALONE",
  version_no:1,calculation_date:"2026-11-02",created_at:"2026-11-02T06:00:00Z",
  offer_item_id:null,result_data:result(72.5),input_data:{product:{tnVedCode:""}}}
];
const combined=buildVedRegistry(offers,items,versions,snapshots);
assert.equal(combined.length,5,"Linked standalone calculation must not duplicate its KP SKU");
assert.equal(combined.find(x=>x.id==="item1").history.length,4);
assert(combined.find(x=>x.id==="item1").history.some(v=>v.id==="snapshot1"&&v.type==="single"));
assert(combined.some(x=>x.id==="calc2"&&x.history[0].cost.average===72.5),
 "Unlinked independent calculation must appear");
console.log("PASS VED registry: four saved cotton-bud SKUs, three versions, standalone snapshots, historical fallback and uncalculated goods");
