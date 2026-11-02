import {NextResponse} from "next/server";
import * as XLSX from "xlsx";
import {requireVedAccess,VedAccessError} from "@/lib/ved-calculation/server-access";
import {isValidTariffDate} from "@/lib/ved-calculation/tariffs";
import {summariseParsedSheets,type VedSupplier} from "@/lib/ved-commercial-offers/parser";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const BUCKET="ved-commercial-offers";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const limit=50_000_000;
const goodSupplier=(v:unknown):v is VedSupplier=>v==="ROY"||v==="MU";
const fail=(message:string,status=400)=>NextResponse.json({ok:false,error:message},{status});
function handleError(err:unknown){
 if(err instanceof VedAccessError)return fail(err.message,err.status);
 console.error("VED commercial-offer import failed",err);
 return fail("Ошибка обработки КП на сервере. Исходный файл не удалён.",500);
}
function validSignature(bytes:Uint8Array,ext:string){
 const zip=bytes.length>4&&bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4;
 const ole=bytes.length>7&&[208,207,17,224,161,177,26,225].every((n,i)=>bytes[i]===n);
 return ext==="xls"?ole:zip;
}
export async function GET(request:Request){
 try{
  const {admin}=await requireVedAccess();
  const url=new URL(request.url),itemId=url.searchParams.get("item"),download=url.searchParams.get("download");
  const wholeOfferId=url.searchParams.get("offerId");
  if(wholeOfferId){
   if(!UUID.test(wholeOfferId))return fail("Неверный идентификатор КП");
   const {data:offer,error:offerError}=await admin.from("ved_commercial_offers")
    .select("id,quote_code,quote_date,supplier_code,item_count,status").eq("id",wholeOfferId).maybeSingle();
   if(offerError)throw offerError;
   if(!offer)return fail("КП не найдено",404);
   const {data:items,error:itemsError}=await admin.from("ved_commercial_offer_items")
    .select("id,offer_id,source_sheet,source_row,supplier_article,description_original,detected_data,missing_fields,warnings")
    .eq("offer_id",wholeOfferId).order("source_row",{ascending:true}).limit(450);
   if(itemsError)throw itemsError;
   return NextResponse.json({ok:true,offer,items:items||[]},{headers:{"Cache-Control":"private,no-store"}});
  }
  if(itemId){
   if(!UUID.test(itemId))return fail("Неверный код товара");
   const {data:item,error}=await admin.from("ved_commercial_offer_items").select("*").eq("id",itemId).maybeSingle();
   if(error)throw error;
   if(!item)return fail("Товар КП не найден",404);
   const {data:offer,error:offerError}=await admin.from("ved_commercial_offers")
    .select("id,quote_code,quote_date,supplier_code").eq("id",item.offer_id).single();
   if(offerError)throw offerError;
   return NextResponse.json({ok:true,item,offer},{headers:{"Cache-Control":"private,no-store"}});
  }
  if(download){
   if(!UUID.test(download))return fail("Неверный номер КП");
   const {data:offer,error}=await admin.from("ved_commercial_offers")
    .select("storage_path,original_file_name").eq("id",download).single();
   if(error||!offer)return fail("КП не найден",404);
   const {data:signed,error:signError}=await admin.storage.from(BUCKET).createSignedUrl(offer.storage_path,120);
   if(signError||!signed)return fail("Не удалось подготовить ссылку на исходный КП",500);
   return NextResponse.json({ok:true,url:signed.signedUrl,filename:offer.original_file_name},{headers:{"Cache-Control":"no-store"}});
  }
  const {data:offers,error}=await admin.from("ved_commercial_offers")
   .select("id,quote_code,supplier_code,quote_date,original_file_name,file_size_bytes,status,item_count,import_notes,created_at")
   .order("created_at",{ascending:false}).limit(20);
  if(error)throw error;
  const ids=(offers||[]).map(x=>x.id);
  if(!ids.length)return NextResponse.json({ok:true,offers:[],items:[]});
  const {data:items,error:itemsError}=await admin.from("ved_commercial_offer_items")
   .select("id,offer_id,source_sheet,source_row,supplier_article,description_original,detected_data,missing_fields,warnings")
   .in("offer_id",ids).order("source_row",{ascending:true}).limit(450);
  if(itemsError)throw itemsError;
  return NextResponse.json({ok:true,offers,items:items||[]},{headers:{"Cache-Control":"private,no-store"}});
 }catch(e){return handleError(e);}
}
export async function POST(request:Request){
 try{
  const {admin,user}=await requireVedAccess(true);
  const url=new URL(request.url);
  const action=url.searchParams.get("action");
  const payload=await request.json() as Record<string,unknown>;
  if(action==="init"){
   const supplier=payload.supplier,quoteDate=payload.quoteDate;
   const rawName=typeof payload.filename==="string"?payload.filename.split(/[\\/]/).pop()?.trim():"";
   const size=payload.size;
   if(!goodSupplier(supplier)||typeof quoteDate!=="string"||!isValidTariffDate(quoteDate)||
      typeof rawName!=="string"||!rawName||rawName.length>180||
      typeof size!=="number"||!Number.isInteger(size)||size<1||size>limit){
    return fail("Укажите поставщика, дату КП и Excel-файл до 50 МБ");
   }
   const ext=rawName.match(/\.(xlsx|xls|xlsm)$/i)?.[1].toLowerCase();
   if(!ext)return fail("Поддерживаются только Excel .xlsx, .xls и .xlsm");
   const year=quoteDate.slice(2,4);
   const prefix="КП-"+year+"-"+supplier+"-";
   const {data:latest,error:lookupError}=await admin.from("ved_commercial_offers")
     .select("quote_code").like("quote_code",prefix+"%")
     .order("quote_code",{ascending:false}).limit(1);
   if(lookupError)throw lookupError;
   const n=Number(latest?.[0]?.quote_code.slice(prefix.length).split("-")[0]||0);
   let code=prefix+String(n+1).padStart(4,"0");
   const id=crypto.randomUUID();
   const path=quoteDate.slice(0,4)+"/"+supplier+"/"+id+"/original."+ext;
   let data:null|{id:string;quote_code:string}=null;
   for(let attempts=0;attempts<4;attempts++){
    const result=await admin.from("ved_commercial_offers").insert({
      id,quote_code:code,supplier_code:supplier,quote_date:quoteDate,
      original_file_name:rawName,storage_path:path,file_size_bytes:size,created_by:user.id,
    }).select("id,quote_code").single();
    if(!result.error){data=result.data;break;}
    if(result.error.code!=="23505")throw result.error;
    code=prefix+String(n+attempts+2).padStart(4,"0");
   }
   if(!data)return fail("Не удалось выделить номер КП, повторите загрузку",409);
   const {data:ticket,error:ticketError}=await admin.storage.from(BUCKET).createSignedUploadUrl(path);
   if(ticketError||!ticket)throw ticketError||Error("Не удалось выдать ссылку загрузки");
   return NextResponse.json({ok:true,offerId:data.id,quoteCode:data.quote_code,
    storagePath:ticket.path,token:ticket.token,bucket:BUCKET},{headers:{"Cache-Control":"no-store"}});
  }
  if(action==="complete"){
   const offerId=payload.offerId;
   if(typeof offerId!=="string"||!UUID.test(offerId))return fail("Неверный идентификатор КП");
   const {data:offer,error}=await admin.from("ved_commercial_offers")
     .select("*").eq("id",offerId).eq("created_by",user.id).maybeSingle();
   if(error)throw error;
   if(!offer)return fail("КП не найден",404);
   if(offer.status!=="uploading"){
    return NextResponse.json({ok:offer.status!=="failed",quoteCode:offer.quote_code,
      status:offer.status,count:offer.item_count,notes:offer.import_notes});
   }
   const {data:file,error:storageError}=await admin.storage.from(BUCKET).download(offer.storage_path);
   if(storageError||!file)return fail("Файл ещё не загружен в хранилище",409);
   const bytes=new Uint8Array(await file.arrayBuffer());
   const ext=offer.original_file_name.split(".").pop()?.toLowerCase()||"";
   if(bytes.byteLength!==Number(offer.file_size_bytes)||!validSignature(bytes,ext))
      return fail("Размер или формат исходного Excel не совпал с заявленным. Импорт остановлен",400);
   let parsed;
   try{
    const workbook=XLSX.read(bytes,{type:"array",bookVBA:false,cellDates:false,cellFormula:false});
    const sheets=workbook.SheetNames.slice(0,100).map(name=>({
      name,
      rows:XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name],{
        header:1,defval:null,blankrows:true,raw:true
      }).slice(0,1200) as unknown[][],
    }));
    parsed=summariseParsedSheets(sheets,offer.supplier_code as VedSupplier);
   }catch(caught){
    const note="Excel сохранён, но не удалось разобрать содержимое: "+
      (caught instanceof Error?caught.message:"неизвестный формат");
    await admin.from("ved_commercial_offers").update({status:"needs_review",import_notes:note})
      .eq("id",offerId);
    return fail(note,422);
   }
   const inserts=parsed.items.map(p=>({
    offer_id:offer.id,source_sheet:p.source_sheet,source_row:p.source_row,
    supplier_article:p.supplier_article.slice(0,180),description_original:p.description_original.slice(0,6000),
    detected_data:p.detected_data,missing_fields:p.missing_fields,
    warnings:p.warnings,raw_row:p.raw_row,
   }));
   // Upsert by original sheet + row makes retry safe even if prior insert succeeded.
   for(let i=0;i<inserts.length;i+=100){
    const {error:insertError}=await admin.from("ved_commercial_offer_items")
      .upsert(inserts.slice(i,i+100),{onConflict:"offer_id,source_sheet,source_row"});
    if(insertError)throw insertError;
   }
   const notes=parsed.warnings.join("; ").slice(0,3000);
   const state=inserts.length?"imported":"needs_review";
   const {error:updateError}=await admin.from("ved_commercial_offers")
     .update({status:state,item_count:inserts.length,import_notes:notes}).eq("id",offerId);
   if(updateError)throw updateError;
   return NextResponse.json({ok:true,quoteCode:offer.quote_code,status:state,
     count:inserts.length,readyCount:parsed.items.filter(i=>!i.missing_fields.length).length,notes,
   },{headers:{"Cache-Control":"no-store"}});
  }
  return fail("Неизвестная операция загрузки КП");
 }catch(e){return handleError(e);}
}
