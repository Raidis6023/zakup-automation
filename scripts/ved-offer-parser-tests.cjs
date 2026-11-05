const fs=require("node:fs");
const assert=require("node:assert/strict");
const ts=require("typescript");
const Module=require("module");
const source=fs.readFileSync(require("node:path").join(__dirname,"../lib/ved-commercial-offers/parser.ts"),"utf8");
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function("require","exports","module",transpiled)(require,mod.exports,mod);
const parse=mod.exports.parseVedOfferRows;
const roy=[
 ["ROY"],["Фото","Артикул","Наименование","Материал","Упаковка","Единица","Размер","", "", "Цена(ФОБ)","","Штук(набор)/коробке","Размер коробки", "", "", "Объём", "Вес брутто", "Минимальное количество","Срок","Порт"],
 ["Photo","Item No","Description"],
 [null,"F2","Подставка для охлаждения ноутбука","Пластик","коробка","шт",37.5,26,3.3,23.23,53.17,20,54,35,39.5,.074655,17.2,2000,45,"Шэньчжэнь"]
];
const found=parse(roy,"ROY","Лист1");
assert.equal(found.length,1);assert.equal(found[0].source_row,4);
assert.equal(found[0].detected_data.unitPriceCny,23.23);
assert.equal(found[0].detected_data.cartonVolumeM3,.074655);
assert.equal(found[0].detected_data.moqUnits,2000);assert.equal(found[0].missing_fields.length,0);
const mu=[
 ["MARKET UNION"],["QUOTATION LIST"],
 ["PHOTO","ITEM NO","DESC.","PACKING","Price FOB CNY (20GP)","Price EXW CNY (20GP)","UNIT","PCS/CTN","carton length/cm","carton width/cm","carton height/cm","CBM","G.W.","MOQ","Quantity/20 GP","Quantity/40HQ"],
 [null,"YB25101001-1","Removable shower curtain","opp+paper card",40.5,39.8,"pc",20,50,40,30,.06,"19KG","1*20GP","8660PCS","21600PCS"]
];
const m=parse(mu,"MU","Sheet1");
assert.equal(m.length,1);assert.equal(m[0].detected_data.moqUnits,8660);
assert.equal(m[0].detected_data.cartonGrossKg,19);
assert.equal(m[0].detected_data.incoterm,"FOB");
assert.equal(m[0].missing_fields.length,0);
console.log("PASS VED КП: ROYAUMANN 2026 and MARKET UNION 2025 supplier rows, MOQ 1*20GP, volume, weight");

const identityCode=fs.readFileSync(require("node:path").join(__dirname,
 "../lib/ved-commercial-offers/article-identities.ts"),"utf8");
const identities={exports:{}};
new Function("require","exports","module",ts.transpileModule(identityCode,
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)
 (require,identities.exports,identities);
const {offerArticleAliases,withUniqueOfferArticles}=identities.exports;
const raw=(id,code,source_row,offer_id="offer1")=>({
 id,supplier_article:code,source_sheet:"Лист1",source_row,offer_id
});
const duplicates=[
 ...Array.from({length:7},(_,i)=>raw("655-"+i,"KL-R655L",[5,6,7,8,9,24,25][i])),
 ...Array.from({length:5},(_,i)=>raw("551-"+i,"KL-R551L",i+10)),
 ...Array.from({length:5},(_,i)=>raw("308-"+i,"KL-R308L",i+15)),
 raw("other","KL-B608LO",4),raw("different-offer","KL-R308L",4,"offer2")
];
const ids=offerArticleAliases(duplicates);
assert.deepEqual(Array.from({length:7},(_,i)=>ids.get("655-"+i)),
 Array.from({length:7},(_,i)=>"KL-R655L_"+(i+1)));
assert.deepEqual(Array.from({length:5},(_,i)=>ids.get("308-"+i)),
 Array.from({length:5},(_,i)=>"KL-R308L_"+(i+1)));
assert.deepEqual(Array.from({length:5},(_,i)=>ids.get("551-"+i)),
 Array.from({length:5},(_,i)=>"KL-R551L_"+(i+1)));
assert.equal(ids.get("other"),"KL-B608LO");
assert.equal(ids.get("different-offer"),"KL-R308L");
assert.deepEqual([...offerArticleAliases([...duplicates].reverse())].sort(),
 [...ids].sort(),"Database row order must not alter aliases");
assert.equal(duplicates[0].supplier_article,"KL-R655L","Supplier article is immutable");
const reserved=[raw("a","KL-X",1),raw("b","KL-X",2),raw("c","KL-X_1",3),raw("d","kl-x",4)];
const collisionMap=offerArticleAliases(reserved);
assert.deepEqual(["a","b","c","d"].map(x=>collisionMap.get(x)),
 ["KL-X_2","KL-X_3","KL-X_1","KL-X_4"]);
assert.deepEqual(withUniqueOfferArticles(duplicates).slice(0,7).map(x=>x.supplier_article),
 Array.from({length:7},(_,i)=>"KL-R655L_"+(i+1)));
console.log("PASS VED КП: duplicate supplier SKUs numbered _1/_2 by sheet row, no source mutations");


// Full КП product descriptions must survive the VED -> unit economics transfer.
const fullNamesCode=fs.readFileSync(require("node:path").join(__dirname,
 "../lib/products/new-product-identity.ts"),"utf8");
const fullNames={exports:{}};
new Function("require","exports","module",ts.transpileModule(fullNamesCode,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText)(require,fullNames.exports,fullNames);
const nice=fullNames.exports.informativeNewProductName;
const examples=[
 ["Бритвенный набор\nРучка + 3 сменные кассеты (6 лезвий)\nРазмер: 4 * 13 см",
  "KL-B608LO","Бритвенный набор, Ручка + 3 сменные кассеты (6 лезвий), размер 4×13 см"],
 ["Бритвенный набор\nУпаковка 2 шт.\nРазмер: 4 * 11 см\n5 лезвий",
  "KL-R551L_1","Бритвенный набор, 2 шт. в упаковке, 5 лезвий, размер 4×11 см"],
 ["Бритвенный набор\nУпаковка 8 шт.\nРазмер: 4 * 11 см\n5 лезвий",
  "KL-R551L_4","Бритвенный набор, 8 шт. в упаковке, 5 лезвий, размер 4×11 см"],
 ["Бритвенный набор\nУпаковка 2 шт.\nРазмер: 4 * 12 см\n5 лезвий",
  "KL-R655L_6","Бритвенный набор, 2 шт. в упаковке, 5 лезвий, размер 4×12 см"],
 ["Набор ватных палочек\n600 штук (2 зип лок по 300 шт. в общей ПЭ упаковке)",
  "RCAB-AVD26828-1","Набор ватных палочек, 600 шт. (2 зип-лок по 300 шт. в общей ПЭ упаковке)"],
 ["Подставка для ноутбука","F2","Подставка для ноутбука"]
];
for(const [raw,article,expected] of examples)
 assert.equal(nice(raw,article),expected,article+" should retain all distinguishing characteristics");
assert.ok(!nice("Бритвенный набор\n3 сменные кассеты","R").includes("6 лезвий"),
 "Never invent blade count from cartridge count");
const syncCode=fs.readFileSync(require("node:path").join(__dirname,
 "../lib/unit-economics/prospective-sync.ts"),"utf8");
assert.ok(syncCode.includes('select("id,description_original")'));
assert.ok(syncCode.includes("sourceDescriptions.get(row.itemId)"));
assert.ok(syncCode.includes("applyProductOverrides(item,"));
assert.ok(syncCode.includes("overrides:before.get(item.article)?.overrides||{}"));
console.log("PASS VED -> unit economics: full descriptive names from source, manual overrides preserved");
