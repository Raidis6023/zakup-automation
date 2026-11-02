import {NextResponse} from "next/server";
import {requireVedAccess,VedAccessError} from "@/lib/ved-calculation/server-access";
import {buildVedExport,type VedExportItem} from "@/lib/ved-calculation/excel-export";
import {findSupplierPhotos} from "@/lib/ved-calculation/offer-photos";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
 try{
  const {admin}=await requireVedAccess();
  const payload=await request.json() as {versionId?:unknown};
  if(typeof payload.versionId!=="string"||!uuid.test(payload.versionId))
   return NextResponse.json({ok:false,error:"Укажите сохранённую версию КП"},{status:400});
  const {data:version,error}=await admin.from("ved_offer_calculation_versions")
   .select("id,offer_id,version_no,calculation_date,items_data")
   .eq("id",payload.versionId).maybeSingle();
  if(error)throw error;
  if(!version)return NextResponse.json({ok:false,error:"Версия КП не найдена"},{status:404});
  const {data:offer,error:offerError}=await admin.from("ved_commercial_offers")
   .select("id,quote_code,storage_path").eq("id",version.offer_id).single();
  if(offerError)throw offerError;
  const entries=version.items_data as Array<{itemId:string;title:string;article:string;
   input:VedExportItem["input_data"];result:VedExportItem["result_data"];errors:string[]}>;
  if(!entries.length||entries.length>100)
   return NextResponse.json({ok:false,error:"Для экспорта поддерживается до 100 товаров в одном КП"},{status:422});
  const {data:originalItems,error:itemError}=await admin.from("ved_commercial_offer_items")
   .select("id,source_sheet,source_row,detected_data,raw_row").eq("offer_id",offer.id).limit(450);
  if(itemError)throw itemError;
  const itemIndex=new Map((originalItems||[]).map(item=>[item.id,item]));
  const {data:file,error:storageError}=await admin.storage.from("ved-commercial-offers").download(offer.storage_path);
  if(storageError||!file)
   return NextResponse.json({ok:false,error:"Исходный Excel КП недоступен в архиве"},{status:424});
  const source=Buffer.from(await file.arrayBuffer());
  const matching=entries.map(x=>{
   const original=itemIndex.get(x.itemId);
   return {id:x.itemId,source_sheet:String(original?.source_sheet||""),source_row:Number(original?.source_row||0)};
  });
  const {photos,warnings}=await findSupplierPhotos(source,matching);
  if(warnings.length)console.warn("VED photo export warnings:",warnings);
  const items:VedExportItem[]=entries.map(e=>{
   const original=itemIndex.get(e.itemId);
   const fields=original?.detected_data as Record<string,unknown>|undefined;
   const pair=photos.get(e.itemId);
   const raw=(original?.raw_row||[]) as unknown[];
   const getText=(x:unknown)=>typeof x==="string"?x:"";
   return {
    id:e.itemId,title:e.title,article:e.article,version_no:version.version_no,
    calculation_date:version.calculation_date,input_data:e.input,result_data:e.result,errors:e.errors,
    source:{
     quoteCode:offer.quote_code,sheet:original?.source_sheet,row:original?.source_row,
     material:getText(fields?.material),packaging:getText(fields?.packaging),
     unit:getText(raw[5]),cargoCny:typeof fields?.cargoEstimateCny==="number"?fields.cargoEstimateCny:null,
     leadTime:typeof fields?.leadTimeDays==="number"?fields.leadTimeDays:null,
    },
    productPhoto:pair?.productPhoto,packagingPhoto:pair?.packagingPhoto,
   };
  });
  const content=await buildVedExport(items);
  return new Response(new Uint8Array(content),{status:200,headers:{
   "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
   "Content-Disposition":'attachment; filename="VED-'+offer.quote_code+'-v'+version.version_no+'.xlsx"',
   "Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff",
  }});
 }catch(error){
  if(error instanceof VedAccessError)return NextResponse.json({ok:false,error:error.message},{status:error.status});
  console.error("VED whole-offer export",error);
  return NextResponse.json({ok:false,error:"Не удалось экспортировать КП. Проверьте исходный Excel и сохранённую версию."},{status:500});
 }
}
