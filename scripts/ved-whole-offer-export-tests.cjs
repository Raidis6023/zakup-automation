const fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),assert=require("node:assert/strict");
const ExcelJS=require("exceljs"),{brotliDecompressSync}=require("node:zlib");
function compile(rel,imports={}){
 const source=fs.readFileSync(path.join(__dirname,"..",rel),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
 }}).outputText;
 const mod={exports:{}};
 function moduleRequire(name){return imports[name]||require(name);}
 new Function("require","exports","module",compiled)(moduleRequire,mod.exports,mod);
 return mod.exports;
}
async function main(){
 const template=compile("lib/ved-calculation/template-blueprint.ts");
 const engine=compile("lib/ved-calculation/engine.ts");
 const excel=compile("lib/ved-calculation/excel-export.ts",{
  "./template-blueprint":template,
 });
 const photos=compile("lib/ved-calculation/offer-photos.ts",{});
 const input={
  product:{productName:"Набор ватных палочек 600 шт",tnVedCode:"",
   unitPriceCny:2.62,unitsPerCarton:120,moqUnits:10000,
   cartonVolumeM3:.101384,cartonGrossKg:19,markingCnyPerUnit:0,
   cartonLengthCm:58,cartonWidthCm:46,cartonHeightCm:38},
  currency:{cnyRub:13.0816,eurRub:90.166},
  container:{usableVolumeM3:68,maxPayloadKg:22000},
  expenses:{freightBeforeBorderRub:500000,freightAfterBorderRub:500000,
   bankCommissionRub:10000,brokerServicesRub:15000,customsOperationsFeeRub:0,
   otherSharedRub:0,otherRubPerUnit:0,refundableSecurityRub:0,
   certificationRub:0,moldingRub:0,indirectPaymentsRub:0,additionalRub:0,
   dangerousCargo:false,dangerSurchargeBeforeRub:60000,dangerSurchargeAfterRub:60000},
  customs:{dutyMode:"ad-valorem",adValoremPercent:10,specificEurPerUnit:0,
   specificUnit:"gross-kg",vatPercent:22,includeFreightBeforeBorderInCustomsBase:true,
   importVatRecoverable:false,feeMode:"schedule",feeDate:"2026-11-02"},
 };
 const result=engine.calculateVed(input);
 const pixel=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X9kAAAAASUVORK5CYII=","base64");
 const original=new ExcelJS.Workbook(),sheet=original.addWorksheet("КП");
 const photoId=original.addImage({buffer:pixel,extension:"png"});
 const packId=original.addImage({buffer:pixel,extension:"png"});
 sheet.addImage(photoId,{tl:{col:0,row:3.2},ext:{width:100,height:90}});
 sheet.addImage(packId,{tl:{col:4,row:3.2},ext:{width:100,height:90}});
 const found=await photos.findSupplierPhotos(Buffer.from(await original.xlsx.writeBuffer()),[
  {id:"row4",source_sheet:"КП",source_row:4}
 ]);
 assert(found.photos.get("row4").productPhoto,"source product photo not found");
 assert(found.photos.get("row4").packagingPhoto,"source packaging photo not found");
 const product={id:"1",title:"Набор ватных палочек",article:"RCAB-AVD26828-1",
  version_no:1,calculation_date:"2026-11-02",input_data:input,result_data:result,
  source:{quoteCode:"КП-26-ROY-0001",material:"Бамбук + хлопок",packaging:"Зип-пакет, стикер, Честный знак",
    unit:"набор",sheet:"КП",row:4},
  ...found.photos.get("row4"),
 };
 const buffer=await excel.buildVedExport([product,{...product,id:"2",article:"RCAB-AVD26828-2"}]);
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(buffer);
 assert.equal(loaded.worksheets.length,2);
 const tab=loaded.worksheets[0];
 assert.equal(tab.getCell("T19").value,"Упаковка");
 assert.equal(tab.getCell("W19").value,"Зип-пакет, стикер, Честный знак");
 assert.equal(tab.getCell("T18").value,"Материал");
 assert.equal(tab.getCell("W18").value,"Бамбук + хлопок");
 assert.equal(tab.getImages().length,2,"photos were not embedded");
 for(const ref of ["B4","B7","B9","B15","C16","J22","K22","M22","P22","Q22"]){
  assert.equal(tab.getCell(ref).type,ExcelJS.ValueType.Formula,ref+" is hardcoded, not editable formula");
 }
 assert(tab.getCell("B9").formula.includes("$AF$24"),"freight doesn't refer to editable input");
 assert(tab.getCell("Q22").formula.includes("AVERAGE"),"average is not a formula");
 assert.equal(tab.getCell("Q22").result,result.averageCostPerUnitRub);
 assert.equal(tab.getCell("F15").value,2.62);
 assert.equal(tab.getCell("F9").value,13.0816);
 assert.equal(tab.getCell("AF24").value,500000);
 const exportZip=Buffer.from(buffer);
 assert(exportZip.length>10000,"export is too small");
 console.log("PASS VED whole-KP editable XLSX: 2 sheets, source product+pack photos, packaging info, live formulas, cached engine results");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
