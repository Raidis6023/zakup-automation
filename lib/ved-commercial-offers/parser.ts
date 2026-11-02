/**
 * Conservative importer for the two supplier layouts actually seen in КП.
 * Never fills unknown MOQ, customs codes, duty rates or prices by guessing.
 * Original row is stored as provenance, images stay in archived source XLSX.
 */
export type VedSupplier = "ROY" | "MU";
export type ImportProduct = {
  source_sheet:string;
  source_row:number;
  supplier_article:string;
  description_original:string;
  detected_data:Record<string,string|number|null>;
  missing_fields:string[];
  warnings:string[];
  raw_row:unknown[];
};
type ParseResult={items:ImportProduct[];warnings:string[];sheets:string[]};
const cell=(row:unknown[],i:number):string=>String(row[i]??"").trim();
const number=(value:unknown):number|null=>{
  if(typeof value==="number")return Number.isFinite(value)?value:null;
  const s=String(value??"").trim().replace(/\s+/g,"").replace(",",".");
  if(!s)return null;
  const m=s.match(/^(-?\d+(?:\.\d+)?)(?:KG|KGS|PCS|SETS|PC|шт\.?)?$/i);
  if(!m)return null;
  const n=Number(m[1]);return Number.isFinite(n)?n:null;
};
const positive=(n:number|null):n is number=>n!==null&&Number.isFinite(n)&&n>0;
function getRow(
  row:unknown[],r:number,sheet:string,supplier_article:string,description_original:string,
  data:Record<string,string|number|null>,
  notes:string[]=[]
):ImportProduct{
  const missing_fields:string[]=[];
  for(const [field,title] of [
    ["unitPriceCny","Цена за штуку (CNY)"],
    ["unitsPerCarton","Штук в коробке"],
    ["cartonVolumeM3","Объём транспортной коробки"],
    ["cartonGrossKg","Вес брутто коробки"],
    ["moqUnits","MOQ (штук)"],
  ]){
    if(!positive(typeof data[field]==="number"?data[field] as number:null))missing_fields.push(title);
  }
  return {source_sheet:sheet,source_row:r,supplier_article,description_original,
    detected_data:data,missing_fields,warnings:notes,raw_row:row.slice(0,28)};
}
const txt=(row:unknown[],patterns:RegExp[]):number=>{
  return row.findIndex(x=>patterns.some(pattern=>pattern.test(String(x??""))));
};
export function parseVedOfferRows(
  rows:unknown[][],supplier:VedSupplier,sheetName:string
):ImportProduct[]{
  const parsed:ImportProduct[]=[];
  const scan=rows.slice(0,45);
  if(supplier==="ROY"){
    const header=scan.findIndex(row=>txt(row,[/^(артикул|item\s*no)$/i])>=0&&
      txt(row,[/цена\s*\(?фоб\)?|price\s*\(?fob\)?/i])>=0);
    if(header<0)return parsed;
    for(let i=header+1;i<rows.length&&parsed.length<400;i++){
      const row=rows[i]||[],sku=cell(row,1),desc=cell(row,2);
      const price=number(row[9]),pcs=number(row[11]),gross=number(row[16]);
      if(!sku||!desc||!/[\p{L}\p{N}]/u.test(sku)||!positive(price))continue;
      const dims=[number(row[12]),number(row[13]),number(row[14])];
      const measured=dims.every(positive)?dims[0]!*dims[1]!*dims[2]!/1e6:null;
      const stated=number(row[15]);
      const vol=measured??stated;
      const warnings:string[]=[];
      if(positive(stated)&&positive(measured)&&Math.abs(stated-measured)/stated>.025){
        warnings.push("Объём коробки не совпадает с длиной × шириной × высотой. Использован расчёт по габаритам, требуется проверка");
      }
      if(rows.length>400)warnings.push("Проверьте, что все товары данного КП импортированы");
      const datum:Record<string,string|number|null>={
        unitPriceCny:price,unitsPerCarton:pcs,cartonGrossKg:gross,
        cartonVolumeM3:vol,moqUnits:number(row[17]),
        cartonLengthCm:dims[0],cartonWidthCm:dims[1],cartonHeightCm:dims[2],
        individualLengthCm:number(row[6]),individualWidthCm:number(row[7]),individualHeightCm:number(row[8]),
        incoterm:"FOB",departurePort:cell(row,19),productName:desc,
        packaging:cell(row,4),material:cell(row,3),supplierArticle:sku,
        cargoEstimateCny:number(row[10]),leadTimeDays:number(row[18])
      };
      parsed.push(getRow(row,i+1,sheetName,sku,desc,datum,warnings));
    }
  }else{
    const header=scan.findIndex(row=>txt(row,[/^ITEM\s*NO\.?$/i])>=0&&
      txt(row,[/^PCS\s*\/\s*CTN$/i])>=0);
    if(header<0)return parsed;
    const h=rows[header],col=(p:RegExp[])=>txt(h,p);
    const c={
      sku:col([/^ITEM\s*NO\.?$/i]),desc:col([/^DESC\.?$/i,/^DESCRIPTION$/i]),
      fob:col([/price.*fob.*cny/i]),exw:col([/price.*exw.*cny/i]),
      pcs:col([/^PCS\s*\/\s*CTN$/i]),len:col([/carton\s*length/i]),
      wid:col([/carton\s*width/i]),hei:col([/carton\s*height/i]),
      cbm:col([/^CBM$/i]),gross:col([/^G\.?W\.?$/i,/gross.*weight/i]),
      moq:col([/^MOQ$/i]),qty20:col([/Quantity\s*\/\s*20\s*GP/i]),
      qty40:col([/Quantity\s*\/\s*40\s*HQ/i])
    };
    const value=(row:unknown[],index:number)=>index>=0?row[index]:null;
    for(let i=header+1;i<rows.length&&parsed.length<400;i++){
      const row=rows[i]||[],sku=cell(row,c.sku),desc=cell(row,c.desc);
      const fob=number(value(row,c.fob)),exw=number(value(row,c.exw));
      const price=positive(fob)?fob:exw;
      if(!sku||!desc||!positive(price))continue;
      const l=number(value(row,c.len)),w=number(value(row,c.wid)),hgt=number(value(row,c.hei));
      const calc=l&&w&&hgt?l*w*hgt/1e6:null,vol=calc??number(value(row,c.cbm));
      const warnings:string[]=[];
      const declaredVol=number(value(row,c.cbm));
      if(positive(declaredVol)&&positive(calc)&&Math.abs(declaredVol-calc)/declaredVol>.025)
        warnings.push("Заявленный CBM не совпадает с произведением габаритов коробки");
      let moq=number(value(row,c.moq));
      const moqText=String(value(row,c.moq)??"").toUpperCase().replace(/\s/g,"");
      if(!positive(moq)&&/^\d+\*20GP$/.test(moqText)){
        const qty20=number(value(row,c.qty20));
        if(positive(qty20))moq=Number(moqText.split("*")[0])*qty20;
      }else if(!positive(moq)&&/^\d+\*40HQ$/.test(moqText)){
        const qty40=number(value(row,c.qty40));
        if(positive(qty40))moq=Number(moqText.split("*")[0])*qty40;
      }
      if(!positive(moq)&&moqText)warnings.push("MOQ задан нестандартным выражением: "+moqText);
      const datum:Record<string,string|number|null>={
        unitPriceCny:price,unitsPerCarton:number(value(row,c.pcs)),
        cartonGrossKg:number(value(row,c.gross)),cartonVolumeM3:vol,moqUnits:moq,
        cartonLengthCm:l,cartonWidthCm:w,cartonHeightCm:hgt,
        incoterm:positive(fob)?"FOB":"EXW",departurePort:"",productName:desc,
        supplierArticle:sku,quotedFobCny:fob,quotedExwCny:exw
      };
      parsed.push(getRow(row,i+1,sheetName,sku,desc,datum,warnings));
    }
  }
  return parsed;
}
export function summariseParsedSheets(
  sheets:Array<{name:string;rows:unknown[][]}>,supplier:VedSupplier
):ParseResult{
  const items:ImportProduct[]=[],warnings:string[]=[];
  for(const sheet of sheets){
    const extracted=parseVedOfferRows(sheet.rows,supplier,sheet.name);
    if(!extracted.length)warnings.push("Лист «"+sheet.name+"»: товары по известному шаблону не найдены");
    items.push(...extracted);
    if(items.length>=400){warnings.push("За один импорт обрабатываются максимум 400 товаров");break;}
  }
  return {items:items.slice(0,400),warnings,sheets:sheets.map(s=>s.name)};
}
