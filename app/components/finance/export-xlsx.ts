'use client';

export type ExcelCell=string|number|boolean|null|undefined;
export type ExcelSheet={name:string;rows:Array<Record<string,ExcelCell>>};

const safe=(value:ExcelCell):ExcelCell=>{
 if(typeof value!=='string')return value;
 return /^[=+@-]/.test(value)?"'"+value:value;
};
const sheetName=(value:string)=>value.replace(/[\\/?*\[\]:]/g,' ').trim().slice(0,31)||'Лист';

export async function downloadFinanceWorkbook(filename:string,sheets:ExcelSheet[]){
 const XLSX=await import('xlsx');
 const book=XLSX.utils.book_new();
 for(const source of sheets){
  const rows=source.rows.length?source.rows:[{Статус:'Нет строк для выгрузки'}];
  const normalized=rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,safe(value)])));
  const sheet=XLSX.utils.json_to_sheet(normalized,{cellDates:false});
  const headers=Object.keys(normalized[0]??{});
  sheet['!cols']=headers.map(header=>({
   wch:Math.min(42,Math.max(12,header.length+2,...normalized.map(row=>String(row[header]??'').length+2)))
  }));
  sheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,normalized.length),c:Math.max(0,headers.length-1)}})};
  delete sheet['!merges'];
  XLSX.utils.book_append_sheet(book,sheet,sheetName(source.name));
 }
 XLSX.writeFile(book,filename,{compression:true});
}
