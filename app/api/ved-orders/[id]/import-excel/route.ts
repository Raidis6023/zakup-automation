import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMPORT_BUCKET, IMPORT_PHOTOS_BUCKET, IMPORT_MAX_BYTES,
  parseVedExcel,convertProductPhoto
} from "@/lib/ved-order-excel-import";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

type Context={params:Promise<{id:string}>};
type Profile={user_id?:string;role_name?:string;has_admin_access?:boolean;first_name?:string;last_name?:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const errorReply=(message:string,status=400)=>NextResponse.json(
  {ok:false,error:message},{status,headers:{"Cache-Control":"no-store"}}
);

async function authorize(orderId:string){
 if(!uuid.test(orderId))return {error:errorReply("Неверный заказ",400)};
 const supabase=await createClient();
 const {data:{user},error:sessionError}=await supabase.auth.getUser();
 if(!user || sessionError)return {error:errorReply("Требуется авторизация",401)};
 const {data:raw,error:profError}=await supabase.rpc("app_get_my_profile");
 const profile=(Array.isArray(raw)?raw[0]:raw) as Profile|null;
 if(profError||!profile||profile.user_id!==user.id)return {error:errorReply("Нет доступа",403)};
 const admin=createAdminClient();
 const {data:order,error:orderError}=await admin.from("ved_orders")
  .select("id,workflow_status,preparation_department").eq("id",orderId).maybeSingle();
 if(orderError)return {error:errorReply("Не удалось проверить заказ",500)};
 if(!order)return {error:errorReply("Заказ не найден",404)};
 const allowed=profile.has_admin_access===true ||
  (profile.role_name==="Закуп"&&order.preparation_department==="procurement") ||
  (profile.role_name==="Аналитик"&&order.preparation_department==="analytics");
 if(!allowed)return {error:errorReply("Нет прав на изменение заказа",403)};
 if(!["draft","returned_for_edit"].includes(order.workflow_status)){
  return {error:errorReply("Добавление доступно только в черновике",409)};
 }
 const actorName=[profile.first_name,profile.last_name].map(x=>String(x??"").trim())
  .filter(Boolean).join(" ")||user.email||"Сотрудник";
 return {admin,actorId:user.id,actorName,actorRole:profile.role_name||"Администратор"};
}

function validSource(orderId:string,sourcePath:string):boolean{
 return new RegExp(
  "^ved-order-imports/"+orderId+"/[a-f0-9-]{36}/source[.]xlsx$","i"
 ).test(sourcePath);
}
async function readSource(admin:ReturnType<typeof createAdminClient>,orderId:string,path:string){
 if(!validSource(orderId,path))throw new Error("Неверный путь загруженного файла");
 const {data,error}=await admin.storage.from(IMPORT_BUCKET).download(path);
 if(error||!data)throw new Error("Исходный Excel не найден в хранилище");
 if(data.size>IMPORT_MAX_BYTES)throw new Error("Размер Excel превышает 30 МБ");
 return Buffer.from(await data.arrayBuffer());
}
function clean(v:unknown,max=250):string {
 return typeof v==="string"?v.trim().slice(0,max):"";
}

export async function POST(request:NextRequest,ctx:Context){
 try{
  const origin=request.headers.get("origin"),host=request.headers.get("host");
  if(!origin||!host||new URL(origin).host!==host)return errorReply("Недопустимый источник запроса",403);
  const {id}=await ctx.params;
  const access=await authorize(id);
  if(access.error)return access.error;
  const db=access.admin!;
  const body=await request.json() as Record<string,unknown>;
  const action=clean(body.action,40);
  if(action==="begin"){
   const filename=clean(body.filename,200);
   const size=Number(body.size);
   if(!/\.xlsx$/i.test(filename)||!Number.isFinite(size)||size<100||size>IMPORT_MAX_BYTES){
    return errorReply("Нужен файл .xlsx размером до 30 МБ");
   }
   const sourcePath="ved-order-imports/"+id+"/"+randomUUID()+"/source.xlsx";
   const {data,error}=await db.storage.from(IMPORT_BUCKET).createSignedUploadUrl(sourcePath);
   if(error||!data)return errorReply("Не удалось подготовить загрузку Excel",500);
   return NextResponse.json({ok:true,path:sourcePath,token:data.token,bucket:IMPORT_BUCKET},{
    headers:{"Cache-Control":"no-store"}
   });
  }
  const sourcePath=clean(body.path,280);
  if(!validSource(id,sourcePath))return errorReply("Некорректный файл Excel");
  if(action==="preview"){
   const bytes=await readSource(db,id,sourcePath);
   const parsed=await parseVedExcel(bytes,true);
   return NextResponse.json({ok:true,path:sourcePath,items:parsed.rows,skipped:parsed.skipped},{
    headers:{"Cache-Control":"no-store"}
   });
  }
  if(action!=="confirm")return errorReply("Неизвестное действие");
  const rawSelected=body.selectedSheets;
  if(!Array.isArray(rawSelected)||rawSelected.length<1||rawSelected.length>50 ||
      rawSelected.some(x=>typeof x!=="string") ||
      new Set(rawSelected).size!==rawSelected.length){
   return errorReply("Выберите от 1 до 50 уникальных листов для импорта");
  }
  const bytes=await readSource(db,id,sourcePath);
  const parsed=await parseVedExcel(bytes,false);
  const bySheet=new Map(parsed.rows.map(row=>[row.sheet,row]));
  const overrides=(body.overrides && typeof body.overrides==="object" && !Array.isArray(body.overrides))
   ?body.overrides as Record<string,Record<string,unknown>>:{};
  const selected=rawSelected.map((sheet,i)=>{
    const item=bySheet.get(sheet as string);
    if(!item)throw new Error("Лист не найден в исходном файле: "+sheet);
    const custom=overrides[sheet as string]||{};
    if(custom && (typeof custom!=="object" || Array.isArray(custom))){
     throw new Error("Ошибка изменений листа "+sheet);
    }
    const adjusted={...item};
    for(const field of [
      "name","our_article","chinese_article","cartons","units_per_carton",
      "unit_price_cny","moq_quantity","carton_volume_m3","carton_weight_kg",
      "carton_length_cm","carton_width_cm","carton_height_cm",
      "individual_length_cm","individual_width_cm","individual_height_cm"
    ] as const){
      if(Object.prototype.hasOwnProperty.call(custom,field)) {
       const next=custom[field];
       if(typeof next!=="string" && typeof next!=="number"){
         throw new Error("Некорректное поле "+field+" на листе "+sheet);
       }
       const rawValue=clean(String(next),field==="name"?250:120);
       adjusted[field]=["name","our_article","chinese_article"].includes(field)
         ?rawValue:rawValue.replace(/\s/g,"").replace(",",".");
      }
    }
    if(adjusted.name.length<2)throw new Error("На листе "+sheet+" отсутствует название товара");
    return adjusted;
  });
  const batch=randomUUID(),uploaded:string[]=[];
  try{
   const payload:Record<string,string>[]=[];
   for(let i=0;i<selected.length;i++){
    const item=selected[i],photo=parsed.photos.get(item.sheet);
    let photoPath="";
    if(photo){
     const converted=await convertProductPhoto(photo);
     photoPath="ved-orders/"+id+"/"+batch+"/"+(i+1)+".webp";
     const {error:uploadError}=await db.storage.from(IMPORT_PHOTOS_BUCKET).upload(
       photoPath,converted,{contentType:"image/webp",upsert:false}
     );
     if(uploadError)throw new Error("Не удалось сохранить фото листа "+item.sheet+": "+uploadError.message);
     uploaded.push(photoPath);
    }
    payload.push({
     mode:"new",sheet:item.sheet,name:item.name,our_article:"",
     chinese_article:item.chinese_article,cartons:item.cartons||"0",
     units_per_carton:item.units_per_carton,unit_price_cny:item.unit_price_cny,
     moq_quantity:item.moq_quantity,
     carton_length_cm:item.carton_length_cm,carton_width_cm:item.carton_width_cm,
     carton_height_cm:item.carton_height_cm,
     carton_volume_m3:item.carton_volume_m3,carton_weight_kg:item.carton_weight_kg,
     individual_length_cm:item.individual_length_cm,
     individual_width_cm:item.individual_width_cm,
     individual_height_cm:item.individual_height_cm,
     hs_code:item.hs_code,photo_storage_path:photoPath
    });
   }
   const {data,error}=await db.rpc("ved_import_excel_draft_items",{
    p_order_id:id,p_source_path:sourcePath,p_items:payload,
    p_actor_id:access.actorId,p_actor_name:access.actorName,p_actor_role:access.actorRole
   });
   if(error || !data?.ok)throw new Error(error?.message || "Сервер не подтвердил импорт");
   return NextResponse.json({
    ok:true,added:data.added,
    photosAdded:uploaded.length,
    missingPhotos:selected.length-uploaded.length,
    sheets:selected.map(item=>item.sheet)
   },{headers:{"Cache-Control":"no-store"}});
  }catch(e){
    if(uploaded.length) {
      const {error:cleanupError}=await db.storage.from(IMPORT_PHOTOS_BUCKET).remove(uploaded);
      if(cleanupError)console.error("[VED EXCEL] photo rollback error",cleanupError.message);
    }
    throw e;
  }
 }catch(e){
   const msg=e instanceof Error?e.message:"Не удалось обработать Excel";
   console.error("[VED EXCEL]",msg);
   return errorReply(msg.slice(0,350),400);
 }
}
