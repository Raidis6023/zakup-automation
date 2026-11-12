"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const ExcelJS=require("exceljs");
const JSZip=require("jszip");
const {SaxesParser}=require("saxes");
const root=path.resolve(__dirname,"..");
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const module_={exports:{}};
const js=ts.transpileModule(read("lib/marketplace-products-excel.ts"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  esModuleInterop:true}
}).outputText;
const unmergeModule={exports:{}};
const unmergeJs=ts.transpileModule(read("lib/excel/unmerge.ts"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText;
new Function("require","module","exports",unmergeJs)(require,unmergeModule,unmergeModule.exports);
const projectRequire=id=>id==="./excel/unmerge"?unmergeModule.exports:require(id);
new Function("require","module","exports",js)(projectRequire,module_,module_.exports);
const {buildProductsWorkbook}=module_.exports;
const {removeMergedCellsFromWorkbook}=unmergeModule.exports;
const sample={
 masterCode:"EN0001",sku:"0012300",article:"OZ-COT-123",name:"Товар 1",
 sales:70,average:2.5,cancellations:3,stock:180,stockDays:72,
 details:[
  {sku:"0012300",article:"OZ-COT-123",cluster:"Центр",
   sales:50,average:50/28,cancellations:2,stock:130,stockDays:72.8},
  {sku:"0012300",article:"OZ-COT-123",cluster:"Юг",
   sales:20,average:20/28,cancellations:1,stock:50,stockDays:70},
 ],
};
test("Ozon: separate .xlsx with total row and collapsible real clusters",async()=>{
 const book=buildProductsWorkbook("ozon",[sample],28,new Date("2026-11-06T03:00:00Z"));
 const sh=book.getWorksheet("Данные по товарам");
 assert.ok(sh);
 assert.equal(sh.getCell("A8").value,"ИТОГО ТОВАРА");
 assert.equal(sh.getCell("B8").value,"EN0001");
 assert.equal(sh.getCell("C8").value,"0012300");
 assert.equal(sh.getCell("H8").value,70);
 assert.equal(sh.getCell("I8").value,2.5);
 assert.equal(sh.getCell("A9").value,"КЛАСТЕР / СКЛАД");
 assert.equal(sh.getCell("F9").value,"Центр");
 assert.equal(sh.getCell("F10").value,"Юг");
 assert.equal(sh.getRow(9).outlineLevel,1);
 assert.equal(sh.getRow(9).hidden,true);
 assert.equal(sh.getRow(10).hidden,true);
 assert.match(sh.getCell("M9").value.formula,/H9\/H8/);
 removeMergedCellsFromWorkbook(book);
 assert.equal(book.worksheets[0].model.merges.length,0);
 const bytes=await book.xlsx.writeBuffer();
 const again=new ExcelJS.Workbook();
 await again.xlsx.load(bytes);
 const sheet=again.getWorksheet("Данные по товарам");
 assert.equal(sheet.model.merges.length,0,"no merged ranges in downloadable XLSX");
 assert.equal(sheet.getRow(9).outlineLevel,1);
 assert.equal(sheet.getRow(9).hidden,true);
 assert.equal(sheet.getCell("C8").value,"0012300");
 assert.equal(sheet.getCell("H8").value,70);
});
test("Wildberries: export only existing product data; no fabricated clusters or labels",()=>{
 const p={masterCode:"EN0002",sku:93445566,article:"WB-101",
  name:"Миска для животных",sales:30,average:30/28,
  cancellations:4,stock:55,stockDays:51.3};
 const sh=buildProductsWorkbook("wildberries",[p],28).getWorksheet("Данные по товарам");
 assert.equal(sh.rowCount,8);
 assert.equal(sh.getCell("A8").value,"ИТОГО ТОВАРА");
 assert.equal(sh.getCell("C8").value,"93445566");
 assert.equal(sh.getCell("H8").value,30);
 for(const row of sh._rows.filter(Boolean))for(const cell of row._cells.filter(Boolean)){
  assert.ok(!String(cell.value??"").includes("отсутствует"),"no placeholder or note");
  assert.ok(!String(cell.value??"").includes("не получена"),"no placeholder or note");
 }
});
test("Yandex: expand real warehouse data, not imaginary cluster names",()=>{
 const sh=buildProductsWorkbook("yandex",[{
  ...sample,details:[{warehouse:"Склад Томилино",sales:70,average:2.5,
   cancellations:3,stock:180,stockDays:72}]
 }],28).getWorksheet("Данные по товарам");
 assert.equal(sh.getCell("F9").value,null);
 assert.equal(sh.getCell("G9").value,"Склад Томилино");
 assert.equal(sh.getCell("H9").value,70);
 assert.equal(sh.getRow(9).hidden,true);
});
test("Marketplace exports have independent buttons and no nested interactive controls",()=>{
 for(const file of [
  "app/ozon/OzonProductsTableClient.tsx",
  "app/wildberries/WbProductsTableClient.tsx",
  "app/yandex-market/YandexProductsSectionClient.tsx"
 ]){
  const code=read(file);
  assert.ok(code.includes("mp-products-export-button"),file);
  assert.ok(code.includes("mp-products-header"),file);
  assert.ok(code.includes("downloadProductsExcel"),file);
  assert.ok(code.includes("excelBusy"),file);
  assert.ok(code.includes("excelError"),file);
  const a=code.indexOf('<div className="mp-products-header">');
  const b=code.indexOf('className="mp-products-export-button"',a);
  assert.ok(a>=0&&b>a,file);
 }
 assert.ok(read("app/yandex-market/page.tsx").includes(
  "<YandexProductsSectionClient items={productTableItems} periodDays={salesPeriodDays}>"
 ));
});

test("Office-compatible XLSX: all 3 marketplaces have well-formed worksheet and style XML",async()=>{
 for(const market of ["ozon","wildberries","yandex"]){
  const product={...sample,
   name:"Набор\u0000 с контрольным символом \u0007 и кириллицей",
   details:market==="wildberries"?[]:sample.details};
  const book=buildProductsWorkbook(market,[product],28);
  removeMergedCellsFromWorkbook(book);
  assert.equal(book.worksheets[0].model.merges.length,0);
  const buffer=await book.xlsx.writeBuffer();
  const zip=await JSZip.loadAsync(buffer);
  for(const location of [
   "xl/worksheets/sheet1.xml",
   "xl/styles.xml",
   "xl/workbook.xml",
   "xl/sharedStrings.xml",
  ]){
   const item=zip.file(location);
   if(!item)continue;
   const xml=await item.async("string");
   let roots=0;
   const parser=new SaxesParser({xmlns:true});
   parser.on("opentag",()=>{roots++});
   parser.on("error",error=>{throw new Error(
    market+" "+location+": malformed XML: "+error.message
   )});
   parser.write(xml).close();
   assert.ok(roots>0,market+" "+location+" must have XML elements");
   assert.ok(!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(xml),
    market+" "+location+" contains illegal XML 1.0 control characters");
  }
  const sheet=await zip.file("xl/worksheets/sheet1.xml").async("string");
  assert.ok(/<outlinePr\b/.test(sheet),
   market+" must keep collapsible row outline settings");
  // ExcelJS bug #1348 corrupts sheet1.xml when both are active.
  assert.ok(!/<pageSetUpPr[^>]*fitToPage="1"/.test(sheet),
   market+" must never use fit-to-page print scaling with row outlines");
  assert.ok(!sheet.includes("контрольным символом \u0007"),
   "Bad control character must be removed, not serialized");
 }
});


test("Excel unmerge keeps source values, formula results and unrelated cells", () => {
 const book = new ExcelJS.Workbook();
 const ws = book.addWorksheet("Без потери данных");
 ws.getCell("A1").value = {formula:"D2*2",result:42};
 ws.getCell("D2").value = 21;
 ws.getCell("F5").value = "Проверка сохранности";
 ws.mergeCells("A1:C2");
 assert.equal(ws.model.merges.length,1);
 removeMergedCellsFromWorkbook(book);
 assert.equal(ws.model.merges.length,0);
 assert.equal(ws.getCell("A1").formula,"D2*2");
 assert.equal(ws.getCell("A1").result,42);
 assert.equal(ws.getCell("D2").value,21);
 assert.equal(ws.getCell("F5").value,"Проверка сохранности");
 assert.equal(ws.getCell("B1").value,null);
 removeMergedCellsFromWorkbook(book);
 assert.equal(ws.model.merges.length,0);
});
