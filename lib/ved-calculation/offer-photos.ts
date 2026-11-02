import ExcelJS from "exceljs";
import type {ImageAttachment} from "@/lib/ved-calculation/excel-export";
export type PhotoPair={productPhoto:ImageAttachment|null;packagingPhoto:ImageAttachment|null};
type Position={sheet:string;row:number;product:string;};
function imageBytes(media:ExcelJS.Media):ImageAttachment|null{
 const ext=String(media.extension||"").toLowerCase();
 if(!["png","jpg","jpeg","gif"].includes(ext))return null;
 const image=media as ExcelJS.Media & {base64?:string};
 const buffer=media.buffer?Buffer.from(media.buffer):
  image.base64?Buffer.from(image.base64.replace(/^data:[^,]+,/,""),"base64"):null;
 return buffer?{buffer,extension:ext==="jpg"?"jpeg":ext as "png"|"jpeg"|"gif"}:null;
}
/** Images are kept in the original supplier workbook in private storage.
 * Match embedded Excel drawing anchors with source sheet and source row.
 * Does not rely on filename heuristics or image ordering.
 */
export async function findSupplierPhotos(
 bytes:Buffer,items:Array<{source_sheet:string;source_row:number;id:string}>
):Promise<{photos:Map<string,PhotoPair>;warnings:string[]}>{
 const photos=new Map<string,PhotoPair>();
 const warnings:string[]=[];
 for(const item of items)photos.set(item.id,{productPhoto:null,packagingPhoto:null});
 let workbook:ExcelJS.Workbook;
 try{workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);}
 catch{
  return {photos,warnings:["Этот формат Excel не поддерживает извлечение встроенных изображений; исходник сохранён"]};
 }
 const index=new Map<string,Array<{id:string;row:number}>>();
 for(const item of items){
  const name=item.source_sheet;
  const list=index.get(name)||[];
  list.push({id:item.id,row:item.source_row});index.set(name,list);
 }
 for(const [name,requested] of index){
  const sheet=workbook.getWorksheet(name);
  if(!sheet){warnings.push("Лист оригинала не найден: "+name);continue;}
  const drawings=sheet.getImages();
  for(const img of drawings){
   const media=workbook.getImage(Number(img.imageId));
   if(!media)continue;
   const value=imageBytes(media);
   if(!value)continue;
   const raw=img.range?.tl;
   if(!raw)continue;
   const startRow=Number(raw.nativeRow??Math.floor(raw.row))+1;
   const startCol=Number(raw.nativeCol??Math.floor(raw.col))+1;
   // ROY supplier photographs are in column A; packaging pictures in E.
   // Other suppliers may shift these to the first/second image columns.
   const kind=startCol<=2?"productPhoto":startCol>=4&&startCol<=8?"packagingPhoto":null;
   if(!kind)continue;
   const target=requested.find(x=>x.row===startRow);
   if(!target)continue;
   const previous=photos.get(target.id)!;
   if(!previous[kind])previous[kind]=value;
  }
 }
 return {photos,warnings};
}
