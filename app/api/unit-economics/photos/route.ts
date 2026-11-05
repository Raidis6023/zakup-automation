import {NextRequest,NextResponse} from "next/server";
import sharp from "sharp";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {findSupplierPhotos} from "@/lib/ved-calculation/offer-photos";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const BUCKET="ved-product-photos";
const ORIGINAL_BUCKET="ved-commercial-offers";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"private, no-store"};

async function access(){
 const {data:{user}}=await (await createClient()).auth.getUser();
 if(!user)return {error:"Необходим вход в WorkSpace",status:401} as const;
 const admin=createAdminClient();
 const {data:profile,error}=await admin.from("app_user_access")
  .select("system_role,admin_level,is_blocked").eq("user_id",user.id).maybeSingle();
 if(error||!profile||profile.is_blocked||
  !["analyst","ved","head","manager"].includes(profile.system_role??"")&&
  !["admin","senior_admin"].includes(profile.admin_level??""))
  return {error:"Недостаточно прав для просмотра фотографий КП",status:403} as const;
 return {admin} as const;
}

export async function GET(request:NextRequest){
 const auth=await access();
 if("error" in auth)return NextResponse.json({ok:false,error:auth.error},{status:auth.status,headers});
 const offerIds=[...new Set((request.nextUrl.searchParams.get("offers")||"")
  .split(",").filter(x=>UUID.test(x)))].slice(0,35);
 if(!offerIds.length)return NextResponse.json({ok:true,photos:{},packaging:{},missingOfferIds:[]},{headers});
 const {data:offers,error:offerError}=await auth.admin.from("ved_commercial_offers")
  .select("id,photos_indexed_at").in("id",offerIds);
 if(offerError)return NextResponse.json({ok:false,error:offerError.message},{status:503,headers});
 const allowed=(offers||[]).map(o=>o.id);
 if(!allowed.length)return NextResponse.json({ok:true,photos:{},packaging:{},missingOfferIds:[]},{headers});
 const {data:items,error:itemError}=await auth.admin.from("ved_commercial_offer_items")
  .select("id,product_photo_path,packaging_photo_path").in("offer_id",allowed).limit(1600);
 if(itemError)return NextResponse.json({ok:false,error:itemError.message},{status:503,headers});
 const paths=[...new Set((items||[])
  .flatMap(x=>[x.product_photo_path,x.packaging_photo_path])
  .filter((x):x is string=>typeof x==="string"&&x.length>0))];
 const signed=new Map<string,string>();
 for(let i=0;i<paths.length;i+=80){
  const portion=paths.slice(i,i+80);
  const {data,error}=await auth.admin.storage.from(BUCKET).createSignedUrls(portion,3600);
  if(error)return NextResponse.json({ok:false,error:"Не удалось получить ссылки на фото"},{status:503,headers});
  (data||[]).forEach((entry,j)=>{
   if(entry.signedUrl&&!entry.error)signed.set(portion[j],entry.signedUrl);
  });
 }
 const photos:Record<string,string>={},packaging:Record<string,string>={};
 for(const item of items||[]){
  if(item.product_photo_path&&signed.has(item.product_photo_path))
   photos[item.id]=signed.get(item.product_photo_path)!;
  if(item.packaging_photo_path&&signed.has(item.packaging_photo_path))
   packaging[item.id]=signed.get(item.packaging_photo_path)!;
 }
 return NextResponse.json({ok:true,photos,packaging,
  missingOfferIds:(offers||[]).filter(o=>!o.photos_indexed_at).map(o=>o.id)
 },{headers});
}

/** One request processes the entire original Excel offer. No per-SKU XLSX downloads. */
export async function POST(request:NextRequest){
 const auth=await access();
 if("error" in auth)return NextResponse.json({ok:false,error:auth.error},{status:auth.status,headers});
 const body=await request.json().catch(()=>null) as {offerId?:unknown}|null;
 const offerId=body?.offerId;
 if(typeof offerId!=="string"||!UUID.test(offerId))
  return NextResponse.json({ok:false,error:"Неизвестное КП"},{status:400,headers});
 const {data:offer,error:offerError}=await auth.admin.from("ved_commercial_offers")
  .select("id,storage_path,photos_indexed_at").eq("id",offerId).maybeSingle();
 if(offerError||!offer)return NextResponse.json({ok:false,error:"КП не найдено"},{status:404,headers});
 if(offer.photos_indexed_at)return NextResponse.json({ok:true,alreadyIndexed:true},{headers});
 const {data:items,error:itemError}=await auth.admin.from("ved_commercial_offer_items")
  .select("id,source_sheet,source_row,product_photo_path,packaging_photo_path")
  .eq("offer_id",offerId).order("source_row",{ascending:true}).limit(450);
 if(itemError)return NextResponse.json({ok:false,error:itemError.message},{status:503,headers});
 if(!items?.length)return NextResponse.json({ok:false,error:"В КП ещё нет распознанных строк"},{status:422,headers});
 try{
  const {data:original,error:downloadError}=await auth.admin.storage.from(ORIGINAL_BUCKET)
   .download(offer.storage_path);
  if(downloadError||!original)throw Error("Не удалось прочитать исходный Excel КП");
  const file=Buffer.from(await original.arrayBuffer());
  if(file.byteLength>50_000_000)throw Error("Исходный КП превышает разрешённые 50 МБ");
  const {photos,warnings}=await findSupplierPhotos(file,items);
  if(warnings.some(w=>w.includes("не поддерживает извлечение")))
   return NextResponse.json({ok:false,error:warnings.join("; ")},{status:422,headers});
  let savedProducts=0,savedPackages=0;
  // Sequential writes avoid exhausting the Hobby instance on large offers.
  for(const item of items){
   const found=photos.get(item.id);
   if(!found)continue;
   const update:Record<string,string>={};
   for(const [field,photo,kind] of [
    ["product_photo_path",found.productPhoto,"product"],
    ["packaging_photo_path",found.packagingPhoto,"packaging"]
   ] as const){
    if(!photo)continue;
    const path="offers/"+offerId+"/"+item.id+"-"+kind+".webp";
    const contents=await sharp(photo.buffer,{failOn:"none",animated:false})
     .rotate().resize({width:560,height:560,fit:"inside",withoutEnlargement:true})
     .webp({quality:76,effort:3}).toBuffer();
    if(contents.byteLength>2_097_152)throw Error("Слишком большое изображение в строке "+item.source_row);
    const {error:uploadError}=await auth.admin.storage.from(BUCKET).upload(path,contents,{
     upsert:true,contentType:"image/webp",cacheControl:"3600"
    });
    if(uploadError)throw Error("Не удалось сохранить фото строки "+item.source_row+": "+uploadError.message);
    update[field]=path;
    if(kind==="product")savedProducts++;else savedPackages++;
   }
   if(Object.keys(update).length){
    const {error:updateError}=await auth.admin.from("ved_commercial_offer_items")
     .update(update).eq("id",item.id).eq("offer_id",offerId);
    if(updateError)throw Error("Не удалось привязать фото к строке "+item.source_row+": "+updateError.message);
   }
  }
  const {error:doneError}=await auth.admin.from("ved_commercial_offers")
   .update({photos_indexed_at:new Date().toISOString()}).eq("id",offerId);
  if(doneError)throw Error(doneError.message);
  return NextResponse.json({ok:true,alreadyIndexed:false,products:savedProducts,
   packaging:savedPackages,warnings},{headers});
 }catch(error){
  console.error("VED Excel photo extraction failed:",error);
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Ошибка обработки фотографий КП"},
   {status:503,headers});
 }
}
