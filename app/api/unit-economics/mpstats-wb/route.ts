import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {getWbSubjectMpstats,MpStatsError} from "@/lib/unit-economics/mpstats-wb";
import {syncUnitFromVedVersion} from "@/lib/unit-economics/prospective-sync";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
async function access(){
 const {data:{user}}=await (await createClient()).auth.getUser();
 if(!user)return {error:"Требуется вход",status:401} as const;
 const admin=createAdminClient();
 const {data:p}=await admin.from("app_user_access").select("is_blocked,system_role,admin_level").eq("user_id",user.id).maybeSingle();
 if(!p||p.is_blocked)return{error:"Нет доступа",status:403} as const;
 if(!["analyst","ved"].includes(p.system_role??"")&&!["admin","senior_admin"].includes(p.admin_level??""))
  return{error:"Нет прав на настройки калькулятора",status:403} as const;
 return{admin} as const;
}
export async function GET(){
 const auth=await access();
 if("error" in auth)return NextResponse.json({ok:false,error:auth.error},{status:auth.status,headers});
 return NextResponse.json({ok:true,configured:!!process.env.MPSTATS_TOKEN,
  note:process.env.MPSTATS_TOKEN?"Готов к запросу после подтверждения предмета":"Требуется MPSTATS_TOKEN в настройках Vercel"},{headers});
}
export async function POST(req:NextRequest){
 const auth=await access();
 if("error" in auth)return NextResponse.json({ok:false,error:auth.error},{status:auth.status,headers});
 if(!process.env.MPSTATS_TOKEN)return NextResponse.json({ok:false,configured:false,
  error:"MPStats пока не подключён: у сайта отсутствует MPSTATS_TOKEN"},{status:503,headers});
 const body=await req.json().catch(()=>null) as {productId?:string}|null;
 if(!body?.productId||!/^[\da-f-]{36}$/i.test(body.productId))
  return NextResponse.json({ok:false,error:"Не указан товар"},{status:400,headers});
 const {data:product,error:perr}=await auth.admin.from("unit_ved_products")
  .select("id,source_type,source_version_id").eq("id",body.productId).single();
 if(perr||!product)return NextResponse.json({ok:false,error:"Товар не найден"},{status:404,headers});
 const {data:settings,error:serr}=await auth.admin.from("unit_ved_settings")
  .select("model,data,revision").eq("product_id",product.id).in("model",["wb-fbw","wb-fbs","ozon-fbo","ozon-fbs"]);
 if(serr)return NextResponse.json({ok:false,error:serr.message},{status:500,headers});
 const current=new Map((settings||[]).map(x=>[x.model,x]));
 const wbName=(current.get("wb-fbw")?.data as Record<string,unknown>|undefined)?.categoryId;
 const fbName=(current.get("wb-fbs")?.data as Record<string,unknown>|undefined)?.categoryId;
 if(typeof wbName!=="string"||!wbName||wbName!==fbName)
  return NextResponse.json({ok:false,error:"Сначала подтвердите одну категорию WB для FBW и FBS"},{status:409,headers});
 try{
  const fbw=await getWbSubjectMpstats(wbName,false);
  const fbs=await getWbSubjectMpstats(wbName,true);
  const buyout=fbw.buyoutRate??fbs.buyoutRate;
  const toWrite:Record<string,unknown>[]=[];
  const updates=[
   ["wb-fbw",fbw.wbSppRate,buyout],
   ["wb-fbs",fbs.wbSppRate,buyout],
   ["ozon-fbo",null,buyout],
   ["ozon-fbs",null,buyout]
  ] as const;
  for(const [model,spp,buyoutRate] of updates){
   if(spp===null&&buyoutRate===null)continue;
   const previous=current.get(model);
   const data={...((previous?.data||{}) as Record<string,unknown>)};
   if(spp!==null){data.wbSppRate=spp;data.wbSppSource="mpstats-sample"; }
   if(buyoutRate!==null){data.buyoutRate=buyoutRate;data.buyoutSource="wb-mpstats-subject-proxy";}
   data.mpstatsUpdatedAt=new Date().toISOString();
   toWrite.push({product_id:product.id,model,data,revision:Number(previous?.revision||0)+1,updated_at:new Date().toISOString()});
  }
  if(toWrite.length){
   const {error}=await auth.admin.from("unit_ved_settings").upsert(toWrite,{onConflict:"product_id,model"});
   if(error)throw Error("Ошибка сохранения параметров: "+error.message);
   const refreshed=await syncUnitFromVedVersion(auth.admin,product.source_type as "single"|"whole",product.source_version_id,{force:true});
   if(!refreshed.ok)throw Error("Параметры сохранены, но пересчёт не завершён: "+refreshed.error);
  }
  return NextResponse.json({ok:true,saved:toWrite.length>0,buyoutRate:buyout,
   fbwSpp:fbw.wbSppRate,fbsSpp:fbs.wbSppRate,details:[...fbw.comments,...fbs.comments],
   partial:buyout===null||fbw.wbSppRate===null||fbs.wbSppRate===null},{headers});
 }catch(e){
  if(e instanceof MpStatsError)return NextResponse.json({ok:false,error:e.message,kind:e.kind},
   {status:e.kind==="rate-limited"?429:e.kind==="invalid"?401:502,headers});
  return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Ошибка MPStats"},{status:500,headers});
 }
}
