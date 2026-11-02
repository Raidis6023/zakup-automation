import ExcelJS from "exceljs";
import {brotliDecompressSync} from "node:zlib";
import {VED_TEMPLATE_BLUEPRINT_BROTLI_BASE64} from "./template-blueprint";
import type {VedCalculationInput,VedCalculationResult,VedScenarioResult} from "./engine";

/** Stored visual blueprint captured from the user-supplied, macro-free workbook.
 * The original 24-row layout, colors, borders, fonts, widths, merges and labels
 * are reproduced. Approved server results replace contradictory source formulas.
 * Formula inputs can be edited on the site, not in this immutable exported snapshot.
 */
type Blueprint={
 version:number;
 styles:Partial<ExcelJS.Style>[];
 grid:string;
 cells:Array<[string,string|number]>;
 merged:string[];
 cols:Array<[number,number,number]>;
 rows:Array<[number,number]>;
};
type ExportItem={
 id:string;title:string;article:string;version_no:number;
 calculation_date:string;input_data:VedCalculationInput;
 result_data:VedCalculationResult;
 tariffs_data?:Record<string,unknown>;
};
const source=JSON.parse(
 brotliDecompressSync(Buffer.from(VED_TEMPLATE_BLUEPRINT_BROTLI_BASE64,"base64")).toString("utf8"),
) as Blueprint;
if(source.version!==1||source.grid.length!==24*18*2||source.styles.length<100)
 throw Error("Повреждён шаблон Excel расчёта ВЭД");
function uniqueSheetName(name:string,used:Set<string>){
 const clean=name.replace(/[\\/?*[\]:]/g," ").replace(/[\x00-\x1F]/g,"").trim()||"Товар";
 const base=clean.slice(0,31),taken=(n:string)=>used.has(n.toLowerCase());
 let next=base,i=2;
 while(taken(next)){
  const suffix=" ("+(i++)+")";
  next=base.slice(0,31-suffix.length)+suffix;
 }
 used.add(next.toLowerCase());return next;
}
function addTemplate(wb:ExcelJS.Workbook,name:string){
 const sheet=wb.addWorksheet(name);
 for(const [from,to,width] of source.cols)for(let col=from;col<=to;col++)sheet.getColumn(col).width=width;
 for(const [row,height] of source.rows)sheet.getRow(row).height=height;
 const styleCells=new Array<number>(24*18);
 for(let n=0;n<styleCells.length;n++){
  const id=parseInt(source.grid.slice(n*2,n*2+2),36);
  styleCells[n]=id;
  if(id){const cell=sheet.getCell(Math.floor(n/18)+1,n%18+1);cell.style=structuredClone(source.styles[id]);}
 }
 for(const [ref,val] of source.cells){
  const cell=sheet.getCell(ref);
  if(typeof val==="string"&&val.startsWith("="))cell.value={formula:val.slice(1)};
  else cell.value=val;
 }
 for(const range of source.merged)sheet.mergeCells(range);
 sheet.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:1};
 sheet.views=[{state:"normal",showGridLines:false}];
 return sheet;
}
function set(sheet:ExcelJS.Worksheet,ref:string,value:string|number|boolean|null|undefined){
 sheet.getCell(ref).value=value===undefined?null:value;
}
function numeric(x:unknown):number|null{return typeof x==="number"&&Number.isFinite(x)?x:null;}
function annotate(sheet:ExcelJS.Worksheet,ref:string,text:string){
 sheet.getCell(ref).note=text;
}
const resultRows=[
 ["40hq","B",22] as const,["moq","C",23] as const,["one-cbm","D",24] as const,
];
function fillScenario(sheet:ExcelJS.Worksheet,
 col:string,row:number,s:VedScenarioResult,t:VedCalculationInput){
 const indirect=s.indirectPaymentsRub;
 const extras=s.additionalRub+s.otherSharedRub+s.otherPerUnitRub;
 const rows:Record<number,number>={
  4:s.goodsRub,5:s.dutyRub,6:s.importVatRub,7:s.customsOperationsFeeRub,
  8:s.brokerServicesRub,9:s.freightBeforeBorderRub,10:s.freightAfterBorderRub,
  11:s.certificationRub,12:indirect,13:extras,14:s.moldingRub,15:s.bankCommissionRub,
  16:s.totalCostIncludingVatRub,
  17:s.grossKg>0?s.freightBeforeBorderRub/s.grossKg:0,
  18:s.grossKg>0?(
    s.customsOperationsFeeRub+s.brokerServicesRub+s.freightBeforeBorderRub+
    s.freightAfterBorderRub+s.certificationRub+indirect+extras+s.moldingRub+
    s.bankCommissionRub
   )/s.grossKg:0,
  19:s.volumeM3,
 };
 for(const [r,value] of Object.entries(rows))set(sheet,col+r,value);
 const price=s.goodsRub/t.currency.cnyRub;
 const cost=s.managementCostPerUnitRub;
 const details:Record<string,number|string>={
  ["C"+row]:row===22?"40HQ":row===23?"MOQ":"CBM",
  ["D"+row]:t.product.unitsPerCarton,["E"+row]:t.product.cartonGrossKg,
  ["F"+row]:s.units,["G"+row]:s.theoreticalCartons,["H"+row]:s.grossKg,
  ["I"+row]:price,["J"+row]:s.goodsRub,["K"+row]:s.dutyRub,
  ["L"+row]:s.importVatRub,["M"+row]:cost,["N"+row]:s.managementCostRub,
  ["O"+row]:0,["P"+row]:cost,
 };
 for(const [ref,val] of Object.entries(details))set(sheet,ref,val);
}
function fillProduct(sheet:ExcelJS.Worksheet,item:ExportItem){
 const {input_data:t,result_data:output}=item,p=t.product;
 // Clear every example-specific cell from the uploaded demonstration workbook.
 set(sheet,"A1","40 HQ");
 set(sheet,"B1",p.incoterm||"");
 set(sheet,"C1",p.departurePort||"");
 set(sheet,"A22",p.tnVedCode||null);
 for(const row of [22,23,24])set(sheet,"B"+row,p.productName||item.title);
 // Show the exact saved financial parameters, not today's changing CBR rate.
 set(sheet,"F4",p.unitPriceCny);
 set(sheet,"F5",t.currency.cnyRub);
 set(sheet,"F6",p.unitPriceCny*t.currency.cnyRub);
 set(sheet,"F8",t.customs.vatPercent/100);
 set(sheet,"F9",t.currency.cnyRub);
 set(sheet,"F10",t.currency.eurRub);
 set(sheet,"F11",t.customs.adValoremPercent/100);
 set(sheet,"F12",t.customs.specificEurPerUnit||null);
 set(sheet,"F13",Boolean(t.expenses.dangerousCargo));
 set(sheet,"F14",p.markingCnyPerUnit||0);
 set(sheet,"F15",p.unitPriceCny);
 set(sheet,"F16",p.moqUnits);
 set(sheet,"F17",p.moqUnits);
 set(sheet,"F18",p.moqUnits/p.unitsPerCarton);
 set(sheet,"F19",p.cartonVolumeM3);
 for(const [cell,value] of [
  ["G5",p.cartonLengthCm],["H5",p.cartonWidthCm],["I5",p.cartonHeightCm],
  ["G7",p.individualLengthCm],["H7",p.individualWidthCm],["I7",p.individualHeightCm],
 ] as const)set(sheet,cell,numeric(value));
 const individualVolume=p.individualLengthCm&&p.individualWidthCm&&p.individualHeightCm
  ? p.individualLengthCm*p.individualWidthCm*p.individualHeightCm/1000 : null;
 set(sheet,"G9",individualVolume);
 for(const [key,col,row] of resultRows)fillScenario(sheet,col,row,output.scenarios[key],t);
 set(sheet,"B19",t.container.usableVolumeM3);
 set(sheet,"D19",1);
 set(sheet,"Q22",output.averageCostPerUnitRub);
 // Numbers in the export are authoritative snapshots, not the uncorrected
 // formulas from the illustrative source workbook.
 annotate(sheet,"F9","Курс юаня для ВЭД сохранён в версии расчёта. Это официальный курс ЦБ + 1 ₽ (если применён автоматический тариф). Дата расчёта: "+item.calculation_date);
 annotate(sheet,"Q22","Средняя управленческая себестоимость 40HQ и MOQ из сохранённой версии расчёта. Сценарий 1 м³ исключён.");
 annotate(sheet,"B16","Итого включая ввозной НДС. Если НДС возмещаемый, итог может отличаться от управленческой себестоимости ниже.");
 if(p.tnVedCode)sheet.getCell("A22").numFmt="@";
 if(item.article)annotate(sheet,"B22","Артикул: "+item.article+"; версия "+item.version_no+"; дата расчёта "+item.calculation_date);
 // The template has no slots for extra source fields; document non-tabulated
 // cash needs without shifting its printed grid.
 if(t.expenses.refundableSecurityRub>0)annotate(sheet,"D16",
  "Возвратное обеспечение за пределами себестоимости: "+t.expenses.refundableSecurityRub+" ₽ на 40HQ; см. денежную потребность расчёта.");
}
export async function buildVedExport(items:ExportItem[]):Promise<Buffer>{
 if(!items.length||items.length>30)throw Error("Выберите от 1 до 30 расчётов");
 const wb=new ExcelJS.Workbook();
 wb.creator="КПК МИА · WorkSpace";
 wb.created=new Date();
 wb.calcProperties.fullCalcOnLoad=false;
 const used=new Set<string>();
 for(const item of items){
  const title=item.article||item.input_data.product.productName||item.title;
  const sheet=addTemplate(wb,uniqueSheetName(title,used));
  fillProduct(sheet,item);
 }
 return Buffer.from(await wb.xlsx.writeBuffer());
}
