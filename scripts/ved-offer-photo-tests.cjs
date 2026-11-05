"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const ExcelJS=require("exceljs");
const code=fs.readFileSync(path.join(__dirname,"../lib/ved-calculation/offer-photos.ts"),"utf8");
const m={exports:{}};
new Function("require","exports","module",ts.transpileModule(code,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
}}).outputText)(require,m.exports,m);
const {findSupplierPhotos}=m.exports;
const pixel=Buffer.from(
 "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==","base64"
);
(async()=>{
 const workbook=new ExcelJS.Workbook();
 const sheet=workbook.addWorksheet("Лист1");
 sheet.getCell("B4").value="KL-R655L";
 sheet.getCell("B5").value="KL-R655L";
 const imageId=workbook.addImage({buffer:pixel,extension:"png"});
 sheet.addImage(imageId,{tl:{col:0,row:3},br:{col:1,row:4},editAs:"oneCell"});
 sheet.addImage(imageId,{tl:{col:4,row:3},br:{col:5,row:4},editAs:"oneCell"});
 sheet.addImage(imageId,{tl:{col:0,row:4},br:{col:1,row:5},editAs:"oneCell"});
 const bytes=Buffer.from(await workbook.xlsx.writeBuffer());
 const {photos,warnings}=await findSupplierPhotos(bytes,[
  {id:"item-4",source_sheet:"Лист1",source_row:4},
  {id:"item-5",source_sheet:"Лист1",source_row:5}
 ]);
 assert.equal(warnings.length,0);
 assert.ok(photos.get("item-4")?.productPhoto?.buffer.length>20);
 assert.ok(photos.get("item-4")?.packagingPhoto?.buffer.length>20);
 assert.ok(photos.get("item-5")?.productPhoto?.buffer.length>20);
 assert.equal(photos.get("item-5")?.packagingPhoto,null);
 const corrupted=await findSupplierPhotos(Buffer.from("not an xlsx"),[
  {id:"item-4",source_sheet:"Лист1",source_row:4}
 ]);
 assert.equal(corrupted.photos.get("item-4")?.productPhoto,null);
 assert.ok(corrupted.warnings.length>0);
 console.log("PASS VED photos: embedded Excel drawings match sheet and row, not duplicated supplier codes");
})().catch(e=>{console.error(e);process.exitCode=1});
