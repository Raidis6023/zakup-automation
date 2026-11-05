import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {getMpStatsToken} from "@/lib/integrations/secrets";
import {searchMpstatsTaxonomy,MpStatsError} from "@/lib/unit-economics/mpstats-wb";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(req:NextRequest){
 const {data:{user}}=await (await createClient()).auth.getUser();
 if(!user)return NextResponse.json({ok:false,error:"Необходим вход"},{status:401,headers});
 const admin=createAdminClient();
 const {data:p}=await admin.from("app_user_access")
  .select("system_role,admin_level,is_blocked").eq("user_id",user.id).maybeSingle();
 if(!p||p.is_blocked||
  (!["analyst","ved"].includes(p.system_role??"")&&
   !["admin","senior_admin"].includes(p.admin_level??"")))
  return NextResponse.json({ok:false,error:"Нет прав на настройки юнитки"},{status:403,headers});
 const query=(req.nextUrl.searchParams.get("q")||"").slice(0,120).trim();
 const group=(req.nextUrl.searchParams.get("group")||"").slice(0,120).trim();
 if(query.length<2)return NextResponse.json({ok:true,items:[],total:0,matched:0},{headers});
 try{
  const token=await getMpStatsToken();
  if(!token)return NextResponse.json({ok:false,error:"Ключ MPStats не подключён"},
   {status:503,headers});
  const results=await searchMpstatsTaxonomy(token,query,group,40);
  return NextResponse.json({ok:true,...results},{headers});
 }catch(error){
  const message=error instanceof Error?error.message:"Ошибка справочника MPStats";
  return NextResponse.json({ok:false,error:message},{status:error instanceof MpStatsError&&error.kind==="rate-limited"?429:502,headers});
 }
}
