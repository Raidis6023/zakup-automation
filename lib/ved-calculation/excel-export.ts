import ExcelJS from "exceljs";
import sharp from "sharp";
import {brotliDecompressSync} from "node:zlib";
import {VED_TEMPLATE_BLUEPRINT_BROTLI_BASE64} from "./template-blueprint";
import type {VedCalculationInput,VedCalculationResult,VedScenarioResult} from "./engine";

type Blueprint={
 version:number;styles:Partial<ExcelJS.Style>[];grid:string;
 cells:Array<[string,string|number]>;merged:string[];
 cols:Array<[number,number,number]>;rows:Array<[number,number]>;
};
export type ImageAttachment={buffer:Buffer;extension:"png"|"jpeg"|"gif"};
export type VedExportItem={
 id:string;title:string;article:string;version_no:number;
 calculation_date:string;input_data:VedCalculationInput;
 result_data:VedCalculationResult|null;
 source?:{quoteCode?:string;sheet?:string;row?:number;material?:string;
  packaging?:string;unit?:string;cargoCny?:number|null;leadTime?:number|null};
 productPhoto?:ImageAttachment|null;packagingPhoto?:ImageAttachment|null;
 errors?:string[];
 tariffs_data?:Record<string,unknown>;
};
const blueprint=JSON.parse(
 brotliDecompressSync(Buffer.from(VED_TEMPLATE_BLUEPRINT_BROTLI_BASE64,"base64")).toString("utf8"),
) as Blueprint;
if(blueprint.version!==1||blueprint.grid.length!==24*18*2)throw Error("Шаблон Excel ВЭД повреждён");
const fmt="#,##0.00;[Red](#,##0.00);–";
const clean=(str:string)=>str.replace(/[\\/?*[\]:\x00-\x1F]/g," ").trim();
function uniqueName(s:string,used:Set<string>){
 const base=clean(s).slice(0,31)||"Товар";let name=base,i=2;
 while(used.has(name.toLowerCase())){
  const suffix=" ("+i++ +")";
  name=base.slice(0,31-suffix.length)+suffix;
 }
 used.add(name.toLowerCase());return name;
}
function createSheet(wb:ExcelJS.Workbook,name:string){
 const sheet=wb.addWorksheet(name);
 for(const [a,b,width] of blueprint.cols)for(let c=a;c<=b;c++)sheet.getColumn(c).width=width;
 for(const [row,height] of blueprint.rows)sheet.getRow(row).height=height;
 for(let n=0;n<432;n++){
  const style=parseInt(blueprint.grid.slice(n*2,n*2+2),36);
  if(style)sheet.getCell(Math.floor(n/18)+1,n%18+1).style=structuredClone(blueprint.styles[style]);
 }
 for(const [ref,value] of blueprint.cells){
  sheet.getCell(ref).value=typeof value==="string"&&value.startsWith("=")?
   {formula:value.slice(1)}:value;
 }
 for(const range of blueprint.merged)sheet.mergeCells(range);
 sheet.views=[{state:"normal",showGridLines:false}];
 sheet.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};
 sheet.getColumn(19).width=3;
 for(let c=20;c<=28;c++)sheet.getColumn(c).width=15;
 return sheet;
}
const num=(x:unknown):number|null=>typeof x==="number"&&Number.isFinite(x)?x:null;
function set(sh:ExcelJS.Worksheet,ref:string,value:unknown){
 const cell=sh.getCell(ref);
 cell.value=typeof value==="number"&&!Number.isFinite(value)?null:
  value===undefined?null:value as ExcelJS.CellValue;
}
function formula(sh:ExcelJS.Worksheet,ref:string,f:string,cached?:number|null){
 sh.getCell(ref).value={formula:f, ...(cached!==undefined&&cached!==null?{result:cached}:{})};
}
function side(sh:ExcelJS.Worksheet,labelCell:string,valueCell:string,label:string,value:unknown){
 sh.getCell(labelCell).value=label;
 sh.getCell(valueCell).value=typeof value==="number"&&!Number.isFinite(value)?null:
  value===undefined?null:value as ExcelJS.CellValue;
 sh.getCell(labelCell).font={name:"Aptos",size:10,color:{argb:"FF667A72"}};
 sh.getCell(valueCell).font={name:"Aptos",size:10,bold:true,color:{argb:"FF176F50"}};
 sh.getCell(labelCell).alignment={vertical:"middle",wrapText:true};
 sh.getCell(valueCell).alignment={vertical:"middle",wrapText:true};
 sh.getCell(valueCell).border={bottom:{style:"hair",color:{argb:"FFB7D8C8"}}};
 if(typeof value==="number")sh.getCell(valueCell).numFmt=fmt;
}
function feeFor(base:string,year:string,manual:string){
 const f=(limits:number[],rates:number[])=>{
  let inner=String(rates[rates.length-1]);
  for(let i=limits.length-1;i>=0;i--)inner="IF("+base+"<="+limits[i]+","+rates[i]+","+inner+")";
  return inner;
 };
 const a=f([200000,450000,1200000,2700000,4200000,5500000,7000000],
  [1067,2134,4269,11746,16524,21344,27540,30000]);
 const b=f([200000,450000,1200000,2700000,4200000,5500000,10000000],
  [1231,2462,4924,13541,18465,21344,49240,73860]);
 return "IF("+manual+"=1,$AF$38,IF("+year+"=2025,"+a+","+b+"))";
}
function fillCore(sh:ExcelJS.Worksheet,item:VedExportItem){
 const t=item.input_data,p=t.product,s=item.result_data;
 const saved=(scenario:"40hq"|"moq"|"one-cbm")=>s?.scenarios[scenario]??null;
 const cs=[{col:"B",row:22,result:saved("40hq")},{col:"C",row:23,result:saved("moq")},{col:"D",row:24,result:saved("one-cbm")}];
 set(sh,"A1","40 HQ");
 set(sh,"B1",p.incoterm||"");
 set(sh,"C1",p.departurePort||"");
 set(sh,"A22",p.tnVedCode||null);
 sh.getCell("A22").numFmt="@";
 for(const row of [22,23,24])set(sh,"B"+row,p.productName||item.title);
 set(sh,"F8",t.customs.vatPercent/100);
 set(sh,"F9",t.currency.cnyRub);
 set(sh,"F10",t.currency.eurRub);
 set(sh,"F11",t.customs.adValoremPercent>=0?t.customs.adValoremPercent/100:null);
 set(sh,"F12",t.customs.specificEurPerUnit||null);
 set(sh,"F13",Boolean(t.expenses.dangerousCargo));
 set(sh,"F14",p.markingCnyPerUnit??0);
 set(sh,"F15",p.unitPriceCny||null);
 // E16:F16 is a merged cell in the approved template.
 // ExcelJS writes through F16 to the master E16, so every formula MUST read E16.
 set(sh,"E16",p.moqUnits||null);
 for(const [ref,value] of [
  ["G5",p.cartonLengthCm],["H5",p.cartonWidthCm],["I5",p.cartonHeightCm],
  ["G7",p.individualLengthCm],["H7",p.individualWidthCm],["I7",p.individualHeightCm],
 ] as const)set(sh,ref,num(value));
 if(p.cartonLengthCm&&p.cartonWidthCm&&p.cartonHeightCm)
  formula(sh,"F19","G5*H5*I5/1000000",p.cartonVolumeM3);
 else set(sh,"F19",p.cartonVolumeM3||null);
 formula(sh,"F4","F15",p.unitPriceCny);
 formula(sh,"F5","F9",t.currency.cnyRub);
 formula(sh,"F6","F4*F5",p.unitPriceCny*t.currency.cnyRub);
 formula(sh,"F17","E16",p.moqUnits);
 formula(sh,"F18","IFERROR(F17/D22,0)",p.unitsPerCarton?p.moqUnits/p.unitsPerCarton:0);
 if(p.individualLengthCm&&p.individualWidthCm&&p.individualHeightCm)
  formula(sh,"G9","G7*H7*I7/1000",p.individualLengthCm*p.individualWidthCm*p.individualHeightCm/1000);
 else set(sh,"G9",null);
 set(sh,"C22","40HQ");set(sh,"C23","MOQ");set(sh,"C24","1 м³");
 set(sh,"D22",p.unitsPerCarton||null);
 set(sh,"E22",p.cartonGrossKg||null);
 set(sh,"O22",0);
 formula(sh,"B19","AF22",t.container.usableVolumeM3);
 formula(sh,"C19","IFERROR(E16/D22*F19,0)",saved("moq")?.volumeM3);
 set(sh,"D19",1);
 const refs:Record<string,number|null>={
  AF22:t.container.usableVolumeM3,AF23:t.container.maxPayloadKg??null,
  AF24:t.expenses.freightBeforeBorderRub,AF25:t.expenses.freightAfterBorderRub,
  AF26:t.expenses.bankCommissionRub,AF27:t.expenses.brokerServicesRub,
  AF28:t.expenses.otherSharedRub,AF29:t.expenses.otherRubPerUnit,
  AF30:t.expenses.certificationRub??0,AF31:t.expenses.moldingRub??0,
  AF32:t.expenses.indirectPaymentsRub??0,AF33:t.expenses.additionalRub??0,
  AF34:t.expenses.dangerSurchargeBeforeRub??60000,
  AF35:t.expenses.dangerSurchargeAfterRub??60000,
  AF36:t.expenses.refundableSecurityRub,
  AF37:t.customs.feeMode==="manual"?1:0,
  AF38:t.expenses.customsOperationsFeeRub,
  AF39:t.customs.includeFreightBeforeBorderInCustomsBase?1:0,
  AF40:t.customs.importVatRecoverable?1:0,
  AF43:t.product.cartonNetKg??null,
  AF46:Number(t.customs.feeDate?.slice(0,4)||item.calculation_date.slice(0,4))===2025?2025:2026,
  AF47:p.cartonVolumeM3||null,
 };
 for(const [ref,value] of Object.entries(refs))set(sh,ref,value);
 set(sh,"AF41",t.customs.dutyMode);
 set(sh,"AF42",t.customs.specificUnit);
 for(const {col,row,result:r} of cs){
  const exp=col,rr=String(row),volume=exp+"19";
  if(col==="B")formula(sh,"F"+rr,"IFERROR(B19/F19*D22,0)",r?.units);
  else if(col==="C")formula(sh,"F"+rr,"E16",r?.units);
  else formula(sh,"F"+rr,"IFERROR(D19/F19*D22,0)",r?.units);
  if(row!==22){
   formula(sh,"D"+rr,"$D$22",p.unitsPerCarton);
   formula(sh,"E"+rr,"$E$22",p.cartonGrossKg);
   formula(sh,"O"+rr,"$O$22",0);
  }
  formula(sh,"G"+rr,"IFERROR(F"+rr+"/D"+rr+",0)",r?.theoreticalCartons);
  formula(sh,"H"+rr,"G"+rr+"*E"+rr,r?.grossKg);
  formula(sh,"I"+rr,"F"+rr+"*($F$15+$F$14)",r? (r.goodsRub/t.currency.cnyRub):null);
  formula(sh,"J"+rr,"I"+rr+"*$F$9",r?.goodsRub);
  const before=col+"9",base="(J"+rr+"+IF($AF$39=1,"+before+",0))";
  const adv=base+"*$F$11";
  const weight="IF($AF$42=\"item\",F"+rr+",IF($AF$42=\"net-kg\",G"+rr+"*$AF$43,H"+rr+"))";
  const specific="("+weight+"*$F$12*$F$10)";
  const duty="IF($AF$41=\"ad-valorem\","+adv+",IF($AF$41=\"specific\","+specific+
    ",IF($AF$41=\"combined-max\",MAX("+adv+","+specific+"),"+adv+"+"+specific+")))";
  formula(sh,"K"+rr,"IFERROR("+duty+",0)",r?.dutyRub);
  formula(sh,"L"+rr,"("+base+"+K"+rr+")*$F$8",r?.importVatRub);
  const cost=col+"16-IF($AF$40=1,"+col+"6,0)";
  formula(sh,"M"+rr,"IFERROR(("+cost+")/F"+rr+",0)",r?.managementCostPerUnitRub);
  formula(sh,"N"+rr,"M"+rr+"*F"+rr,r?.managementCostRub);
  formula(sh,"P"+rr,"M"+rr+"*(1+O"+rr+")",r?.managementCostPerUnitRub);
  const ratio="("+volume+"/$B$19)";
  const cells:Record<number,[string,number|null|undefined]>={
   4:["J"+rr,r?.goodsRub],
   5:["K"+rr,r?.dutyRub],
   6:["L"+rr,r?.importVatRub],
   7:[feeFor(base,"$AF$46","$AF$37"),r?.customsOperationsFeeRub],
   8:["$AF$27",r?.brokerServicesRub],
   9:["($AF$24+IF($F$13,$AF$34,0))*"+ratio,r?.freightBeforeBorderRub],
   10:["($AF$25+IF($F$13,$AF$35,0))*"+ratio,r?.freightAfterBorderRub],
   11:["$AF$30",r?.certificationRub],
   12:["$AF$32",r?.indirectPaymentsRub],
   13:["$AF$33+$AF$28*"+ratio+"+$AF$29*F"+rr,
    r? r.additionalRub+r.otherSharedRub+r.otherPerUnitRub:null],
   14:["IFERROR($AF$31/$E$16*F"+rr+",0)",r?.moldingRub],
   15:["$AF$26*"+ratio,r?.bankCommissionRub],
   16:["SUM("+col+"4:"+col+"15)",r?.totalCostIncludingVatRub],
   17:["IFERROR("+col+"9/H"+rr+",0)",r&&r.grossKg>0?r.freightBeforeBorderRub/r.grossKg:0],
   18:["IFERROR(SUM("+col+"7:"+col+"15)/H"+rr+",0)",
    r&&r.grossKg>0?(r.totalCostIncludingVatRub-r.goodsRub-r.dutyRub-r.importVatRub)/r.grossKg:0],
  };
  for(const [rowNum,[f,val]] of Object.entries(cells))formula(sh,col+rowNum,f,val);
 }
 formula(sh,"Q22","AVERAGE(P22:P23)",s?.averageCostPerUnitRub);
 sh.getCell("F9").note="Сохранённый расчётный курс CNY для ВЭД, надбавка ЦБ + 1 ₽ уже учтена. Меняйте это значение для пересчёта Excel.";
 sh.getCell("Q22").note="Среднее только 40HQ и MOQ. Результат пересчитывается при изменении исходных данных Excel.";
 if(!s)sh.getCell("Q22").note="Данные КП неполные, уточните отмеченные поля. Excel пересчитает формулы после заполнения.";
}
function fillDetails(sh:ExcelJS.Worksheet,item:VedExportItem){
 const p=item.input_data.product,source=item.source||{};
 // The main 24-row visual is intentionally untouched: source product photo
 // goes in J3:Q19, packaging photo in G11:I19. Extra supplier text starts
 // BELOW row 24, not in a second competing photo panel at T/X.
 const header=sh.getCell("A26");
 sh.mergeCells("A26:Q26");
 header.value="СВЕДЕНИЯ О ТОВАРЕ И УПАКОВКЕ ИЗ КОММЕРЧЕСКОГО ПРЕДЛОЖЕНИЯ";
 header.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF103B30"}};
 header.font={name:"Aptos",bold:true,color:{argb:"FFFFFFFF"},size:11};
 header.alignment={vertical:"middle"};
 sh.getRow(26).height=27;
 const size=[p.individualLengthCm,p.individualWidthCm,p.individualHeightCm]
  .filter(x=>typeof x==="number"&&x>0).join(" × ");
 const description=String(p.productName||item.title);
 const fields:Array<[number,string,unknown]>=[
  [27,"Номер КП",source.quoteCode||""],
  [28,"Артикул поставщика",item.article],
  [29,"Наименование",description],
  [30,"Материал",source.material||""],
  [31,"Вид и состав упаковки",source.packaging||""],
  [32,"Единица поставки",source.unit||""],
  [33,"Условие поставки",p.incoterm||""],
  [34,"Порт / место отправления",p.departurePort||""],
  [35,"Размеры индивидуальной упаковки, см",size],
  [36,"Цена карго CNY (справочно)",source.cargoCny??null],
  [37,"Срок производства, дней",source.leadTime??null],
  [38,"Дата расчёта",item.calculation_date],
  [39,"Версия расчёта КП",item.version_no],
 ];
 for(const [row,label,value] of fields){
  sh.mergeCells("A"+row+":D"+row);
  sh.mergeCells("E"+row+":Q"+row);
  const l=sh.getCell("A"+row),v=sh.getCell("E"+row);
  l.value=label;
  v.value=value===undefined?null:value as ExcelJS.CellValue;
  l.font={name:"Aptos",size:10,bold:true,color:{argb:"FF456659"}};
  v.font={name:"Aptos",size:10,color:{argb:"FF24463A"}};
  l.alignment={vertical:"middle",wrapText:true};
  v.alignment={vertical:"middle",wrapText:true};
  l.border={bottom:{style:"hair",color:{argb:"FFB7D8C8"}}};
  v.border={bottom:{style:"hair",color:{argb:"FFB7D8C8"}}};
  if(typeof value==="number")v.numFmt=fmt;
  sh.getRow(row).height=row===29||row===31?36:21;
 }
 const info=sh.getCell("A41");
 sh.mergeCells("A41:Q41");
 info.value=item.errors?.length?"НЕОБХОДИМО УТОЧНИТЬ: "+item.errors.join("; "):
  "Фотографии товара и упаковки размещены в штатных полях исходного шаблона.";
 info.font={name:"Aptos",size:10,bold:true,color:{argb:item.errors?.length?"FFD35C42":"FF198258"}};
 info.alignment={wrapText:true};
 sh.getRow(41).height=32;

 // Keep adjustable model assumptions to the right of the ORIGINAL template.
 // They remain editable and visible rather than hardcoded in formulas.
 const settings:Array<[number,string]>= [
  [22,"Рабочий объём контейнера, м³"],[23,"Допустимая масса контейнера, кг"],
  [24,"Перевозка до границы, ₽"],[25,"Перевозка после границы, ₽"],
  [26,"Банковская комиссия, ₽"],[27,"Брокер, ₽"],
  [28,"Общие расходы на контейнер, ₽"],[29,"Прочие на 1 шт., ₽"],
  [30,"Сертификация, ₽"],[31,"Молдинг на MOQ, ₽"],
  [32,"Косвенные платежи, ₽"],[33,"Дополнительные платежи, ₽"],
  [34,"Опасный груз: до границы, ₽"],[35,"Опасный груз: после границы, ₽"],
  [36,"Возвратное обеспечение, ₽"],[37,"Ручной таможенный сбор (1/0)"],
  [38,"Ручной таможенный сбор, ₽"],[39,"Включать доставку до границы в ТС (1/0)"],
  [40,"Возмещаемый НДС (1/0)"],[41,"Тип пошлины"],
  [42,"Единица специфической ставки"],[43,"Вес нетто коробки, кг"],
  [46,"Год шкалы таможенного сбора"],[47,"Объём коробки (резерв), м³"]
 ];
 sh.mergeCells("AC20:AF20");
 sh.getCell("AC20").value="НАСТРОЙКИ И ФОРМУЛЫ РАСЧЁТА";
 sh.getCell("AC20").font={bold:true,color:{argb:"FF13704A"},size:11};
 sh.getColumn("AF").width=17;
 sh.getColumn("AC").width=34;
 for(const [row,label] of settings){
  sh.getCell("AC"+row).value=label;
  sh.getCell("AC"+row).font={size:9,color:{argb:"FF566F63"}};
  const value=sh.getCell("AF"+row);
  if(typeof value.value==="number")value.numFmt=fmt;
  value.font={size:10,bold:true,color:{argb:"FF1966BE"}};
  value.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE9F4EF"}};
 }
 sh.getCell("AC44").value="Синие параметры и E16 (MOQ), F8:F15, D22:E22 редактируются; формулы Excel пересчитывают расчёт.";
 sh.getCell("AC44").alignment={wrapText:true};
 sh.getRow(44).height=32;
}
type PhotoSlot="product"|"packaging";
async function drawPhoto(wb:ExcelJS.Workbook,sh:ExcelJS.Worksheet,
 image:ImageAttachment|null|undefined,slot:PhotoSlot){
 const product=slot==="product";
 const topLeft=product?{col:9.15,row:2.3}:{col:6.1,row:10.2};
 const width=product?760:300;
 const height=product?300:220;
 if(!image){
  sh.getCell(product?"J5":"G12").note="В исходном КП фотография отсутствует.";
  return;
 }
 // Fit photo proportionally inside the exact merged region. No cropping,
 // stretching or overlays on calculation cells.
 const normalized=await sharp(image.buffer,{failOn:"none"})
  .rotate()
  .resize(width,height,{fit:"contain",background:{r:255,g:255,b:255,alpha:1}})
  .png().toBuffer();
 const id=wb.addImage({base64:"data:image/png;base64,"+normalized.toString("base64"),extension:"png"});
 sh.addImage(id,{tl:topLeft,ext:{width,height},editAs:"oneCell"});
}
export async function buildVedExport(items:VedExportItem[]):Promise<Buffer>{
 if(!items.length||items.length>100)throw Error("Можно выгрузить от 1 до 100 товаров");
 const wb=new ExcelJS.Workbook();
 wb.creator="КПК МИА · WorkSpace";wb.created=new Date();
 wb.calcProperties.fullCalcOnLoad=true;
 const used=new Set<string>();
 for(const item of items){
  const sh=createSheet(wb,uniqueName(item.article||item.title,used));
  fillCore(sh,item);fillDetails(sh,item);
  await drawPhoto(wb,sh,item.productPhoto,"product");
  await drawPhoto(wb,sh,item.packagingPhoto,"packaging");
 }
 return Buffer.from(await wb.xlsx.writeBuffer());
}
