import { NextRequest,NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Params={params:Promise<{id:string;itemId:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_request:NextRequest,ctx:Params){
 const {id,itemId}=await ctx.params;
 if(!uuid.test(id)||!uuid.test(itemId))return new NextResponse(null,{status:404});
 const session=await createClient();
 const {data:{user},error:authError}=await session.auth.getUser();
 if(!user||authError)return new NextResponse(null,{status:401});
 const {data:raw,error:profileError}=await session.rpc("app_get_my_profile");
 const profile=(Array.isArray(raw)?raw[0]:raw) as {
   user_id?:string;role_name?:string;has_admin_access?:boolean
 }|null;
 if(profileError||!profile||profile.user_id!==user.id)return new NextResponse(null,{status:403});
 const admin=createAdminClient();
 const {data:order}=await admin.from("ved_orders").select("id,preparation_department")
  .eq("id",id).maybeSingle();
 if(!order)return new NextResponse(null,{status:404});
 const allowed=profile.has_admin_access===true || profile.role_name==="Руководитель" ||
   (profile.role_name==="Закуп"&&order.preparation_department==="procurement") ||
   (profile.role_name==="Аналитик"&&order.preparation_department==="analytics");
 if(!allowed)return new NextResponse(null,{status:403});
 const {data:item}=await admin.from("ved_order_items")
  .select("import_product_photo_path").eq("ved_order_id",id).eq("id",itemId).maybeSingle();
 const path=item?.import_product_photo_path;
 if(!path || !new RegExp("^ved-orders/"+id+"/[a-f0-9-]{36}/[0-9]{1,3}[.]webp$","i").test(path)){
  return new NextResponse(null,{status:404});
 }
 const {data,error}=await admin.storage.from("ved-product-photos").createSignedUrl(path,90);
 if(error||!data)return new NextResponse(null,{status:404});
 const response=NextResponse.redirect(data.signedUrl,302);
 response.headers.set("Cache-Control","private,max-age=40");
 return response;
}


export async function POST(request:NextRequest,ctx:Params){
 const {id,itemId}=await ctx.params;
 if(!uuid.test(id)||!uuid.test(itemId))return NextResponse.json({ok:false,error:"Неверная позиция"},{status:400});
 const origin=request.headers.get("origin"),host=request.headers.get("host");
 if(!origin||!host||new URL(origin).host!==host)return NextResponse.json({ok:false,error:"Недопустимый источник"},{status:403});
 const session=await createClient();
 const {data:{user},error:authError}=await session.auth.getUser();
 if(!user||authError)return NextResponse.json({ok:false,error:"Нет авторизации"},{status:401});
 const {data:raw,error:profileError}=await session.rpc("app_get_my_profile");
 const profile=(Array.isArray(raw)?raw[0]:raw) as {
   user_id?:string;role_name?:string;has_admin_access?:boolean;
   first_name?:string;last_name?:string;
 }|null;
 if(profileError||!profile||profile.user_id!==user.id)return NextResponse.json({ok:false,error:"Нет прав"},{status:403});
 const admin=createAdminClient();
 const {data:order}=await admin.from("ved_orders").select("workflow_status,preparation_department").eq("id",id).maybeSingle();
 if(!order)return NextResponse.json({ok:false,error:"Заказ не найден"},{status:404});
 const allowed=profile.has_admin_access===true||
  (profile.role_name==="Закуп"&&order.preparation_department==="procurement")||
  (profile.role_name==="Аналитик"&&order.preparation_department==="analytics");
 if(!allowed||!["draft","returned_for_edit"].includes(order.workflow_status)){
  return NextResponse.json({ok:false,error:"Нельзя изменить фото этого заказа"},{status:403});
 }
 const {data:item}=await admin.from("ved_order_items").select("added_manually,photo_url,import_product_photo_path")
  .eq("ved_order_id",id).eq("id",itemId).maybeSingle();
 if(!item?.added_manually)return NextResponse.json({ok:false,error:"Можно изменить только вручную добавленную позицию"},{status:409});

 let uploadPath="";
 try{
  const form=await request.formData();
  const file=form.get("photo");
  if(!(file instanceof File) || file.size<=0 || file.size>3*1024*1024){
   return NextResponse.json({ok:false,error:"Выберите фото JPEG, PNG или WebP до 3 МБ"},{status:400});
  }
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){
   return NextResponse.json({ok:false,error:"Допустимы JPG, PNG и WebP"},{status:400});
  }
  const buffer=Buffer.from(await file.arrayBuffer());
  const converted=await sharp(buffer,{failOn:"none",limitInputPixels:18_000_000})
   .rotate().resize(1200,1200,{fit:"inside",withoutEnlargement:true})
   .webp({quality:78}).toBuffer();
  if(converted.byteLength>2097152)throw new Error("Фото превышает 2 МБ после обработки");
  uploadPath="ved-orders/"+id+"/"+randomUUID()+"/1.webp";
  const {error:storeError}=await admin.storage.from("ved-product-photos").upload(
   uploadPath,converted,{contentType:"image/webp",upsert:false});
  if(storeError)throw new Error("Не удалось сохранить фото: "+storeError.message);

  const link="/api/ved-orders/"+id+"/excel-photo/"+itemId;
  const {error:saveError}=await admin.from("ved_order_items").update({
   import_product_photo_path:uploadPath,photo_url:link
  }).eq("ved_order_id",id).eq("id",itemId);
  if(saveError)throw new Error("Не удалось привязать фотографию к позиции");
  const {error:auditError}=await admin.from("ved_order_audit_log").insert({
   ved_order_id:id,ved_order_item_id:itemId,event_type:"photo_manual_uploaded",
   field_name:"photo_url",old_value:{photo_url:item.photo_url},
   new_value:{photo_url:link},actor_user_id:user.id,
   actor_name:[profile.first_name,profile.last_name].filter(Boolean).join(" ")||user.email||"Сотрудник",
   actor_role:profile.role_name||"Администратор",
   metadata:{source:"ved_order_manual_photo",storage_path:uploadPath}
  });
  if(auditError)console.error("[VED EXCEL] audit photo",auditError.message);
  if(item.import_product_photo_path &&
    item.import_product_photo_path.startsWith("ved-orders/"+id+"/")){
   await admin.storage.from("ved-product-photos").remove([item.import_product_photo_path]);
  }
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  if(uploadPath)await admin.storage.from("ved-product-photos").remove([uploadPath]);
  const message=e instanceof Error?e.message:"Ошибка фотографии";
  console.error("[VED EXCEL] manual photo upload",message);
  return NextResponse.json({ok:false,error:message},{status:400});
 }
}
