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
 const unmerge=compile("lib/excel/unmerge.ts");
 const excel=compile("lib/ved-calculation/excel-export.ts",{
  "./template-blueprint":template,
  "../excel/unmerge":unmerge,
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
 const pixel=await require("sharp")({create:{width:25,height:25,channels:3,background:"#D7F3E5"}}).png().toBuffer();
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
 for(const sheet of loaded.worksheets) assert.equal(sheet.model.merges.length,0,"no merged cells in generated VED XLSX");
 const tab=loaded.worksheets[0];
 assert.equal(tab.getCell("A31").value,"Вид и состав упаковки");
 assert.equal(tab.getCell("E31").value,"Зип-пакет, стикер, Честный знак");
 assert.equal(tab.getCell("A30").value,"Материал");
 assert.equal(tab.getCell("E30").value,"Бамбук + хлопок");
 assert.equal(tab.getCell("B22").value,"Набор ватных палочек 600 шт");
 assert.equal(tab.getCell("G5").value,58);
 assert.equal(tab.getCell("H5").value,46);
 assert.equal(tab.getCell("I5").value,38);
 assert.equal(tab.getImages().length,2,"photos were not embedded");
 const imgs=tab.getImages();
 assert(Math.abs(imgs[0].range.tl.col-9.15)<0.15,"Product photo must start inside J3:Q19, not column T");
 assert(Math.abs(imgs[0].range.tl.row-2.3)<0.15,"Product photo must start within row 3");
 assert(Math.abs(imgs[1].range.tl.col-6.1)<0.15,"Package photo must start inside G11:I19, not column X");
 assert(Math.abs(imgs[1].range.tl.row-10.2)<0.15,"Package photo must start within row 11");
 assert.equal(tab.getCell("E16").value,10000,"MOQ must survive XLSX unmerge in the master cell E16");
 for(const ref of ["F17","F23"]){
  assert.equal(tab.getCell(ref).formula,"E16",ref+" must refer to MOQ master E16");
 }
 assert.equal(tab.getCell("C19").formula,"IFERROR(E16/D22*F19,0)",
  "MOQ volume must refer to the source E16, not F16");
 assert(Math.abs(tab.getCell("C19").result-result.scenarios.moq.volumeM3)<1e-8,
  "MOQ volume formula cached result is inconsistent with the calculation engine");
 tab.eachRow(row=>row.eachCell(cell=>{
  if(cell.type===ExcelJS.ValueType.Formula){
   assert(!/\$?F\$?16\b/.test(cell.formula),cell.address+" references merged-cell slave F16");
  }
 }));
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
 console.log("PASS VED Excel: product and packaging photos, 2 unmerged sheets, retained MOQ E16 formulas and cached results");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
