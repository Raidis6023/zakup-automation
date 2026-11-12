const fs=require("node:fs");
const path=require("node:path");
const {brotliDecompressSync}=require("node:zlib");
const ExcelJS=require("exceljs");
const assert=require("node:assert/strict");
const ts=require("typescript");
const helperCode=fs.readFileSync(path.join(__dirname,"../lib/excel/unmerge.ts"),"utf8");
const helperModule={exports:{}};
new Function("require","exports","module",ts.transpileModule(helperCode,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText)(require,helperModule.exports,helperModule);
const {removeMergedCellsFromWorkbook}=helperModule.exports;
async function main(){
 const content=fs.readFileSync(path.join(__dirname,"../lib/ved-calculation/template-blueprint.ts"),"utf8");
 const base64=content.match(/VED_TEMPLATE_BLUEPRINT_BROTLI_BASE64\s*=\s*"([^"]+)"/)?.[1];
 assert(base64,"Missing stored VED template");
 const b=JSON.parse(brotliDecompressSync(Buffer.from(base64,"base64")).toString("utf8"));
 assert.equal(b.version,1);
 assert.equal(b.grid.length,864);
 assert.equal(b.styles.length,115);
 assert.equal(b.merged.length,15);
 assert(b.cells.some(([c,v])=>c==="A3"&&v==="Наименование расходов"));
 const wb=new ExcelJS.Workbook();
 const sh=wb.addWorksheet("Товар 1");
 for(const [x,y,width] of b.cols)for(let c=x;c<=y;c++)sh.getColumn(c).width=width;
 for(const [r,h] of b.rows)sh.getRow(r).height=h;
 for(let i=0;i<432;i++){
  const id=parseInt(b.grid.slice(i*2,i*2+2),36);
  if(id)sh.getCell(Math.floor(i/18)+1,i%18+1).style=structuredClone(b.styles[id]);
 }
 for(const [cell,value] of b.cells)sh.getCell(cell).value=typeof value==="string"&&value.startsWith("=")?{formula:value.slice(1)}:value;
 for(const m of b.merged)sh.mergeCells(m);
 sh.getCell("A22").value=null;sh.getCell("B22").value="Проверка нового товара";
 sh.getCell("B4").value=12345.67;
 assert.equal(sh.model.merges.length,b.merged.length,"template must preserve input merge blueprint");
 removeMergedCellsFromWorkbook(wb);
 assert.equal(sh.model.merges.length,0,"no merged cells before Excel download");
 const out=Buffer.from(await wb.xlsx.writeBuffer());
 const copy=new ExcelJS.Workbook();await copy.xlsx.load(out);
 const s=copy.getWorksheet("Товар 1");
 assert(s,"Missing exported sheet");
 assert.equal(s.getCell("A3").value,"Наименование расходов");
 assert.equal(s.getCell("B22").value,"Проверка нового товара");
 assert.equal(s.getCell("B4").value,12345.67);
 assert.equal(s.model.merges.length,0,"exported XLSX must contain no merged ranges");
 console.log("PASS VED export: original blueprint, 115 styles, no output merges, valid XLSX");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
