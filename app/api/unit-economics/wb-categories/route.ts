import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {searchWbCategory,WB_COMMISSION_REFERENCE_DATE} from "@/lib/unit-economics/wb-category-registry";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(req:NextRequest){
 const {data:{user}}=await (await createClient()).auth.getUser();
 if(!user)return NextResponse.json({ok:false,error:"Требуется авторизация"},{status:401,headers});
 const admin=createAdminClient();
 const {data:profile}=await admin.from("app_user_access").select("is_blocked,system_role,admin_level").eq("user_id",user.id).maybeSingle();
 if(!profile||profile.is_blocked)return NextResponse.json({ok:false,error:"Нет доступа"},{status:403,headers});
 const q=(req.nextUrl.searchParams.get("q")||"").slice(0,150);
 const {items,total}=searchWbCategory(q);
 return NextResponse.json({ok:true,items,total,snapshotDate:WB_COMMISSION_REFERENCE_DATE},{headers});
}
