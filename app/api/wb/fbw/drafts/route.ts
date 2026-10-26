import "server-only";
import {NextResponse} from "next/server";
import {createClient} from "../../../../../lib/supabase/server";
import {createAdminClient} from "../../../../../lib/supabase/admin";
import {wbFbw,WbFbwApiError} from "../../../../../lib/wb/fbw-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";
type Draft={
  draftId?:unknown;createdAt?:unknown;updatedAt?:unknown;
  skuQuantity?:unknown;itemQuantity?:unknown;
};
const response=(data:object,status=200)=>NextResponse.json(data,{
  status,headers:{"Cache-Control":"private, no-store"},
});

export async function GET(){
  const auth=await createClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user)return response({ok:false,error:"Требуется авторизация"},401);
  const db=createAdminClient();
  const {data:access,error:accessError}=await db.from("app_user_access")
    .select("admin_level,is_blocked").eq("user_id",user.id).maybeSingle();
  if(accessError||!access||access.is_blocked||
     !["admin","senior_admin"].includes(access.admin_level??"")){
    return response({ok:false,error:"Недостаточно прав для просмотра черновиков WB"},403);
  }
  try{
    const list=await wbFbw.listDrafts(30,0) as {total?:unknown;drafts?:Draft[]};
    if(!list||!Array.isArray(list.drafts))throw new Error("WB вернул неожиданный формат списка черновиков");
    // Do not expose the creator's phone from WB's response.
    const drafts=list.drafts.map(x=>({
      draftId:String(x.draftId??""),
      createdAt:typeof x.createdAt==="string"?x.createdAt:null,
      updatedAt:typeof x.updatedAt==="string"?x.updatedAt:null,
      skuQuantity:Number(x.skuQuantity??0),
      itemQuantity:Number(x.itemQuantity??0),
    })).filter(x=>x.draftId);
    return response({ok:true,total:Number(list.total??drafts.length),drafts,
      fetchedAt:new Date().toISOString()});
  }catch(e){
    const status=e instanceof WbFbwApiError?e.status:502;
    return response({ok:false,error:e instanceof Error?e.message:"Ошибка WB",
      retryAfter:e instanceof WbFbwApiError?e.retryAfter:null},status);
  }
}
