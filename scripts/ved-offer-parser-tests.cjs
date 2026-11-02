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
