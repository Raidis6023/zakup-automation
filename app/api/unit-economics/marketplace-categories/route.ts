import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {searchMarketplaceCategories} from "@/lib/unit-economics/marketplace-category-registry";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(req:NextRequest){
 const {data:{user}}=await (await createClient()).auth.getUser();
 if(!user)return NextResponse.json({ok:false,error:"Нужна авторизация"},{status:401,headers});
 const {data:profile}=await createAdminClient().from("app_user_access")
  .select("system_role,admin_level,is_blocked").eq("user_id",user.id).maybeSingle();
 if(!profile||profile.is_blocked||
  !["analyst","ved","head","manager"].includes(profile.system_role??"")&&
  !["admin","senior_admin"].includes(profile.admin_level??""))
  return NextResponse.json({ok:false,error:"Нет доступа"},{status:403,headers});
 const market=req.nextUrl.searchParams.get("market");
 if(market!=="ozon"&&market!=="ym")
  return NextResponse.json({ok:false,error:"Неизвестный маркетплейс"},{status:400,headers});
 const q=(req.nextUrl.searchParams.get("q")||"").slice(0,150);
 try{return NextResponse.json({ok:true,...await searchMarketplaceCategories(market,q)},{headers})}
 catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:503,headers})}
}
