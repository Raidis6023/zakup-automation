"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const Module=require("node:module");
const ExcelJS=require("exceljs");
const root=path.join(__dirname,"..");
const read=(f)=>fs.readFileSync(path.join(root,f),"utf8");
const source=read("lib/ved-order-excel-import.ts");
const compiled=ts.transpileModule(source,{fileName:"ved-order-excel-import.ts",
 reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
 esModuleInterop:true}}).outputText;
const mod=new Module(path.join(root,"lib/ved-order-excel-import.js"),module);
mod.filename=path.join(root,"lib/ved-order-excel-import.js");
mod.paths=Module._nodeModulePaths(path.join(root,"lib"));
mod._compile(compiled,mod.filename);
const {parseVedExcel,convertProductPhoto}=mod.exports;
const route=read("app/api/ved-orders/[id]/import-excel/route.ts");
const photo=read("app/api/ved-orders/[id]/excel-photo/[itemId]/route.ts");
const dialog=read("app/VedOrderAddItemsDialog.tsx");
const excel=read("app/VedOrderExcelImport.tsx");
const sql=read("supabase/migrations/20261112_ved_import_calculation_excel.sql");
const css=read("app/ved-add-items.css");
const pkg=JSON.parse(read("package.json"));
const sharp=require("sharp");
async function test(){
 const tinyPng=await sharp({
  create:{width:10,height:10,channels:4,background:{r:250,g:100,b:80,alpha:1}}
 }).png().toBuffer();
 const wb=new ExcelJS.Workbook();
 for(let i=0;i<10;i++){
  const sh=wb.addWorksheet("RCAB-TEST-"+(i+1));
  sh.getCell("A1").value="40 HQ";
  sh.getCell("B1").value="FOB";sh.getCell("C1").value="NINGBO";
  sh.getCell("B22").value="Короб для хранения "+(i+1);
  sh.getCell("E4").value="Цена, юань";
  sh.getCell("F4").value=65+i;
  sh.getCell("F15").value=i===0?33.5:null;
  sh.mergeCells("E16:F16");sh.getCell("E16").value="MOQ";
  sh.getCell("D22").value=20;
  sh.getCell("E22").value=4.5;
  sh.getCell("G5").value=40;
  sh.getCell("H5").value=30;
  sh.getCell("I5").value=25;
  sh.getCell("G7").value=10;
  sh.getCell("H7").value=12;
  sh.getCell("I7").value=5;
  sh.getCell("A22").value="3924900000";
  if(i===0){
    const id=wb.addImage({buffer:tinyPng,extension:"png"});
    sh.addImage(id,{tl:{col:9,row:2},ext:{width:120,height:120}});
    // Packaging photo must be ignored.
    const pkgId=wb.addImage({buffer:tinyPng,extension:"png"});
    sh.addImage(pkgId,{tl:{col:6,row:10},ext:{width:44,height:44}});
  }else if(i===1){
    const pkgId=wb.addImage({buffer:tinyPng,extension:"png"});
    sh.addImage(pkgId,{tl:{col:6,row:10},ext:{width:50,height:50}});
  }
 }
 const bytes=Buffer.from(await wb.xlsx.writeBuffer());
 const parsed=await parseVedExcel(bytes,true);
 assert.equal(parsed.rows.length,10,"10 worksheets must yield 10 products");
 assert.equal(parsed.photos.size,1,"packaging photos must never be imported");
 assert.equal(parsed.rows[0].has_photo,true);
 assert.equal(parsed.rows[1].has_photo,false);
 assert.ok(parsed.rows[0].photo_preview?.startsWith("data:image/webp;base64,"));
 assert.equal(parsed.rows[0].unit_price_cny,"33.5","F15 overrides F4 when populated");
 assert.equal(parsed.rows[1].unit_price_cny,"66","legacy F4 fallback");
 assert.equal(parsed.rows[0].moq_quantity,"","merged E16:F16 is a label");
 assert.equal(parsed.rows[0].carton_volume_m3,"0.03");
 assert.equal(parsed.rows[0].units_per_carton,"20");
 assert.equal(parsed.rows[0].carton_weight_kg,"4.5");
 assert.equal(parsed.rows[0].hs_code,"3924900000");
 assert.equal(parsed.rows[0].chinese_article,"RCAB-TEST-1");
 assert.equal(parsed.rows[0].our_article,"","no fabricated ENOT or our article");
 assert.ok(!("incoterm" in parsed.rows[0]),"FOB must not be copied");
 assert.ok(!("port" in parsed.rows[0]),"port must stay manual");
 const webp=await convertProductPhoto(parsed.photos.get("RCAB-TEST-1"));
 assert.ok(webp.byteLength>0&&webp.byteLength<=2097152);
 await assert.rejects(()=>parseVedExcel(Buffer.from("fake")),/Excel|формат/);

 assert.match(route,/createSignedUploadUrl/);
 assert.match(route,/\.upload\(/);
 assert.match(route,/parseVedExcel\(bytes,true\)/);
 assert.match(route,/parseVedExcel\(bytes,false\)/);
 assert.match(route,/ved_import_excel_draft_items/);
 assert.match(route,/action==="preview"/);
 assert.match(route,/action==="confirm"/);
 assert.match(route,/new URL\(origin\)\.host!==host/);
 assert.match(route,/const batch=randomUUID\(\),uploaded:string\[\]=\[\]/);
 assert.match(photo,/createSignedUrl\(path,90\)/);
 assert.match(photo,/export async function POST/);
 assert.match(photo,/import_product_photo_path/);
 assert.match(dialog,/onStateChange=\{setExcelActive\}/);
 assert.match(photo,/import_product_photo_path/);
 assert.doesNotMatch(sql,/SET\s+incoterm\s*=/i);
 assert.match(sql,/import_excel_source_path/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.ved_import_excel_draft_items/);
 assert.match(dialog,/<VedOrderExcelImport/);
 const detail=read("app/VedOrderDetailClient.tsx");
 assert.match(detail,/void uploadManualPhoto\(selectedItem\.id, file\)/);
 assert.match(detail,/Фото не должно превышать 3 МБ/);
 assert.match(dialog,/onStateChange=\{setExcelActive\}/);
 assert.match(excel,/onDrop=\{event/);
 assert.match(excel,/uploadToSignedUrl/);
 assert.match(excel,/selectedSheets:selected.map/);
 assert.match(excel,/Другой файл/);
 assert.match(css,/\.ved-excel-drop--active/);
 assert.match(css,/--panda-table-background/);
 assert.doesNotMatch(css,/@media\s*\(\s*prefers-color-scheme/);
 assert.equal([...css].filter(x=>x==="{").length,[...css].filter(x=>x==="}").length);
 for(const file of [
  "lib/ved-order-excel-import.ts","app/VedOrderExcelImport.tsx",
  "app/VedOrderAddItemsDialog.tsx",
  "app/api/ved-orders/[id]/import-excel/route.ts",
  "app/api/ved-orders/[id]/excel-photo/[itemId]/route.ts"
 ]) {
  const compiled=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
    jsx:ts.JsxEmit.ReactJSX}});
  const errors=(compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,file+": "+errors.map(x=>x.messageText).join("; "));
 }
 console.log("PASS VED Excel 10 sheets, 1 product image, packaging excluded, 2 price templates, merged MOQ, signed drop upload and private photo");
}
test().catch(e=>{console.error(e);process.exitCode=1;});
