import ExcelJS from "exceljs";

export type MarketName="ozon"|"wildberries"|"yandex";
export type ProductDetail={
 sku?:string|number|null;article?:string|null;cluster?:string|null;
 warehouse?:string|null;sales?:number|null;average?:number|null;
 cancellations?:number|null;stock?:number|null;stockDays?:number|null;
};
export type ProductExportRow={
 masterCode?:string|null;sku?:string|number|null;article?:string|null;
 name:string;sales:number;average:number;cancellations:number;
 stock:number;stockDays:number|null;details?:ProductDetail[];
};

const META={
 ozon:{title:"Ozon",file:"Ozon",color:"1476D4",light:"EAF3FC"},
 wildberries:{title:"Wildberries",file:"Wildberries",color:"873EB4",light:"F1EAF8"},
 yandex:{title:"Яндекс Маркет",file:"Yandex_Market",color:"CC9B25",light:"FFF5DF"},
} as const;
const HEADER=[
 "Уровень","ЕНОТ","SKU / артикул МП","Артикул продавца",
 "Наименование товара","Кластер","Склад","Продажи за период",
 "Среднее / день","Отмены","Остаток","Дней запаса","Доля продаж",
] as const;
const numeric=(value:number|null|undefined):number|null=>
 typeof value==="number"&&Number.isFinite(value)?value:null;
const text=(value:string|number|null|undefined):string|null=>{
 if(value===null||value===undefined)return null;
 const s=String(value).trim();
 // Keep supplier-controlled names as literal strings (not formulas).
 return s ? (/^[=+\-@]/.test(s)?"'"+s:s) : null;
};

export function buildProductsWorkbook(
 market:MarketName,products:readonly ProductExportRow[],periodDays=28,
 date=new Date()
):ExcelJS.Workbook{
 if(!META[market])throw Error("Неизвестный маркетплейс");
 if(!Number.isInteger(periodDays)||periodDays<1||periodDays>366)
  throw Error("Недопустимый период продаж");
 if(products.length>20000)throw Error("Слишком много товаров для одной выгрузки");
 const c=META[market];
 const book=new ExcelJS.Workbook();
 book.creator="WorkSpace КПК МИА";
 book.title="Данные по товарам — "+c.title;
 book.created=date;
 const sh=book.addWorksheet("Данные по товарам",{
  properties:{outlineLevelRow:1,outlineProperties:{summaryBelow:false,summaryRight:false}},
  views:[{state:"frozen",ySplit:7}],
  pageSetup:{orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0}
 });
 sh.columns=[16,15,23,25,55,24,24,19,17,17,17,18,17].map(width=>({width}));
 sh.mergeCells("A1:M2");
 const title=sh.getCell("A1");
 title.value="ДАННЫЕ ПО ТОВАРАМ  /  "+c.title.toUpperCase();
 title.font={name:"Aptos Display",bold:true,size:19,color:{argb:"FFFFFFFF"}};
 title.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF15283B"}};
 title.alignment={vertical:"middle"};
 sh.getRow(1).height=28;sh.getRow(2).height=18;
 sh.mergeCells("A3:M3");
 const stamp=date.toLocaleString("ru-RU",{
  timeZone:"Asia/Krasnoyarsk",day:"2-digit",month:"2-digit",
  year:"numeric",hour:"2-digit",minute:"2-digit"
 });
 const meta=sh.getCell("A3");
 meta.value="Выгрузка WorkSpace  •  "+stamp+" (Красноярск)  •  Период: "+
  periodDays+" дн.  •  Товаров: "+products.length;
 meta.font={size:10,bold:true,color:{argb:"FF36495B"}};
 meta.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFEAF1F7"}};
 sh.getRow(3).height=26;
 sh.mergeCells("A4:M4");
 sh.getCell("A4").value="Одна строка — один товар. Для раскрытия деталей нажмите «+» слева от строки товара.";
 sh.getCell("A4").font={size:10,color:{argb:"FF40576C"}};
 sh.getRow(4).height=25;
 sh.mergeCells("A5:M5");
 sh.getCell("A5").value="Итоги взяты из таблицы сайта. Не суммируйте общие строки повторно с детализацией.";
 sh.getCell("A5").font={size:10,italic:true,color:{argb:"FF64748B"}};
 sh.getRow(5).height=24;
 sh.getRow(6).height=10;
 const head=sh.getRow(7);head.values=[undefined,...HEADER];head.height=42;
 head.eachCell(cell=>{
  cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF"+c.color}};
  cell.font={name:"Aptos",size:10,bold:true,color:{argb:"FFFFFFFF"}};
  cell.alignment={vertical:"middle",horizontal:"center",wrapText:true};
 });
 for(const item of products){
  const summary=sh.addRow([
   "ИТОГО ТОВАРА",text(item.masterCode),text(item.sku),text(item.article),
   text(item.name),null,null,
   numeric(item.sales),numeric(item.average),numeric(item.cancellations),
   numeric(item.stock),numeric(item.stockDays),item.sales>0?1:null
  ]);
  summary.height=31;
  summary.font={name:"Aptos",bold:true,size:10,color:{argb:"FF1E3346"}};
  summary.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF"+c.light}};
  summary.eachCell({includeEmpty:true},cell=>{
   cell.alignment={vertical:"middle",wrapText:true};
   cell.border={bottom:{style:"hair",color:{argb:"FFCBD6E2"}}};
  });
  for(const detail of item.details||[]){
   const child=sh.addRow([
    "КЛАСТЕР / СКЛАД",text(item.masterCode),
    text(detail.sku??item.sku),text(detail.article??item.article),
    text(item.name),text(detail.cluster),text(detail.warehouse),
    numeric(detail.sales),numeric(detail.average),
    numeric(detail.cancellations),numeric(detail.stock),numeric(detail.stockDays),
    null
   ]);
   child.height=27;child.outlineLevel=1;child.hidden=true;
   child.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF6F9FC"}};
   child.font={name:"Aptos",size:10,color:{argb:"FF556C80"}};
   child.eachCell({includeEmpty:true},cell=>{
    cell.alignment={vertical:"middle",wrapText:true};
    cell.border={bottom:{style:"hair",color:{argb:"FFE0E8F0"}}};
   });
   if(numeric(detail.sales)!==null){
    child.getCell(13).value={
     formula:"IF(H"+summary.number+"=0,0,H"+child.number+"/H"+summary.number+")",
     result:item.sales>0?(detail.sales||0)/item.sales:0,
    };
   }
  }
 }
 if(market==="wildberries"){
  // Only general item data on WB: no empty cluster/warehouse/cluster-share columns.
  for(const n of [6,7,13])sh.getColumn(n).hidden=true;
 }
 for(const n of [2,3,4])sh.getColumn(n).numFmt="@";
 for(const n of [8,10,11])sh.getColumn(n).numFmt="#,##0;[Red](#,##0);–";
 for(const n of [9,12])sh.getColumn(n).numFmt="#,##0.0;[Red](#,##0.0);–";
 sh.getColumn(13).numFmt="0.0%";
 for(let i=8;i<=sh.rowCount;i++){
  for(const n of [8,9,10,11,12,13]){
   sh.getRow(i).getCell(n).alignment={vertical:"middle",horizontal:"center"};
  }
 }
 book.calcProperties.fullCalcOnLoad=true;
 return book;
}
export async function downloadProductsExcel(
 market:MarketName,products:readonly ProductExportRow[],periodDays=28
):Promise<void>{
 const date=new Date();
 const book=buildProductsWorkbook(market,products,periodDays,date);
 const data=await book.xlsx.writeBuffer();
 const bytes=new Uint8Array(data.byteLength);
 bytes.set(new Uint8Array(data));
 const blob=new Blob([bytes],{
  type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
 });
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");
 link.href=url;
 link.download="Данные_по_товарам_"+META[market].file+"_"+date.toISOString().slice(0,10)+".xlsx";
 document.body.appendChild(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
