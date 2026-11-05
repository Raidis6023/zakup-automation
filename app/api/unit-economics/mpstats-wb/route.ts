import { getMpStatsToken } from "../../../../lib/integrations/secrets";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {getWbSubjectMpstats,validateMpstatsSelection,MpStatsError,type MpstatsSelection} from "@/lib/unit-economics/mpstats-wb";
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
 const token=await getMpStatsToken();
 return NextResponse.json({ok:true,configured:!!token,
  note:token?"Готов к запросу после подтверждения предмета":"Добавьте ключ MPStats в разделе «Администрирование → API»"},{headers});
}
export async function POST(req:NextRequest){
 const auth=await access();
 if("error" in auth)return NextResponse.json({ok:false,error:auth.error},{status:auth.status,headers});
 const token=await getMpStatsToken();
 if(!token)return NextResponse.json({ok:false,configured:false,
  error:"MPStats пока не подключён: добавьте API-ключ в разделе «Администрирование → API»"},{status:503,headers});
 const body=await req.json().catch(()=>null) as {
  productId?:string;
  mpstatsSelection?:{scope?:string;path?:string};
 }|null;
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
 const wbGroup=(current.get("wb-fbw")?.data as Record<string,unknown>|undefined)?.categoryGroup;
 const fbsGroup=(current.get("wb-fbs")?.data as Record<string,unknown>|undefined)?.categoryGroup;
 if(typeof wbName!=="string"||!wbName||wbName!==fbName||wbGroup!==fbsGroup)
  return NextResponse.json({ok:false,error:"Сначала подтвердите одну категорию WB для FBW и FBS"},{status:409,headers});
 try{
  const categoryGroup=typeof wbGroup==="string"?wbGroup:"";
  const {data:existingLink,error:linkError}=await auth.admin.from("unit_wb_mpstats_mappings")
   .select("mpstats_scope,mpstats_path,mpstats_label").eq("wb_category",wbName)
   .eq("wb_group",categoryGroup).maybeSingle();
  if(linkError)throw Error("Не удалось прочитать привязку категорий MPStats: "+linkError.message);
  let verifiedSelection:MpstatsSelection|null=existingLink?{
   scope:existingLink.mpstats_scope as "subject"|"category",
   path:existingLink.mpstats_path,label:existingLink.mpstats_label
  }:null;
  const requested=body.mpstatsSelection;
  if(requested){
   if(!["category","subject"].includes(requested.scope||"")||
    typeof requested.path!=="string"||!requested.path||requested.path.length>500)
    return NextResponse.json({ok:false,error:"Недопустимая категория MPStats"},{status:400,headers});
   const confirmed=await validateMpstatsSelection(token,{
    scope:requested.scope!,path:requested.path
   });
   if(!confirmed)return NextResponse.json({ok:false,error:
    "Категория отсутствует в справочнике MPStats. Обновите результаты поиска."
   },{status:409,headers});
   verifiedSelection=confirmed;
  }
  // fbs=1 includes FBS in the subject selection; not an FBS-only tariff.
  const metrics=await getWbSubjectMpstats(wbName,true,token,categoryGroup,verifiedSelection||undefined);
  // Store the reviewed correspondence independently of the product.
  // Future items with the same commission category will reuse it automatically.
  if(requested&&verifiedSelection){
   const {error:saveMappingError}=await auth.admin.from("unit_wb_mpstats_mappings").upsert({
    wb_category:wbName,wb_group:categoryGroup,
    mpstats_scope:verifiedSelection.scope,mpstats_path:verifiedSelection.path,
    mpstats_label:verifiedSelection.label,confirmed_by:(await (await createClient()).auth.getUser()).data.user?.id,
    confirmed_at:new Date().toISOString(),updated_at:new Date().toISOString()
   },{onConflict:"wb_category,wb_group"});
   if(saveMappingError)throw Error("Не удалось сохранить привязку MPStats: "+saveMappingError.message);
  }
  const mappingChanged=!!(requested&&verifiedSelection&&
   (verifiedSelection.scope!==existingLink?.mpstats_scope||
    verifiedSelection.path!==existingLink?.mpstats_path));
  const buyout=metrics.buyoutRate;
  const spp=metrics.wbSppRate;
  if(buyout===null&&spp===null){
   return NextResponse.json({ok:true,saved:false,partial:true,
    buyoutRate:null,fbwSpp:null,fbsSpp:null,
    details:metrics.comments,
    error:"MPStats ответил, но в ответах нет достоверных процентов для сохранения"},{headers});
  }
  // Category can be changed while provider request is running. Never write metrics
  // from an earlier confirmed subject into a newly selected category.
  const {data:fresh,error:freshError}=await auth.admin.from("unit_ved_settings")
   .select("model,data,revision").eq("product_id",product.id)
   .in("model",["wb-fbw","wb-fbs","ozon-fbo","ozon-fbs"]);
  if(freshError)throw Error("Не удалось проверить актуальную категорию WB: "+freshError.message);
  const latest=new Map((fresh||[]).map(x=>[x.model,x]));
  for(const model of ["wb-fbw","wb-fbs"]){
   const selected=(latest.get(model)?.data as Record<string,unknown>|undefined)?.categoryId;
   const selectedGroup=(latest.get(model)?.data as Record<string,unknown>|undefined)?.categoryGroup;
   if(selected!==wbName||selectedGroup!==wbGroup)return NextResponse.json({
    ok:false,error:"Категория WB изменена во время загрузки MPStats. Повторите получение показателей."},
    {status:409,headers});
  }
  const rows:Record<string,unknown>[]=[];
  const now=new Date().toISOString();
  for(const model of ["wb-fbw","wb-fbs","ozon-fbo","ozon-fbs"]){
   const previous=latest.get(model);
   const data={...((previous?.data||{}) as Record<string,unknown>)};
   if(mappingChanged){
    // Changing the mapping invalidates previous percentages for this category.
    if(data.buyoutSource==="wb-mpstats-subject-proxy")
     for(const field of ["buyoutRate","buyoutSource","buyoutSourceSubject"])
      delete data[field];
    if(model.startsWith("wb"))
     for(const field of ["wbSppRate","wbSppSource","wbSppSampledProducts"])
      delete data[field];
   }
   if(buyout!==null){
    data.buyoutRate=buyout;
    data.buyoutSource="wb-mpstats-subject-proxy";
    data.buyoutSourceSubject=metrics.subjectId;
   }
   if(model.startsWith("wb")&&spp!==null){
    data.wbSppRate=spp;
    data.wbSppSource="mpstats-subject-sales-weighted-sample";
    data.wbSppSampledProducts=metrics.sampledProducts;
   }
   data.mpstatsUpdatedAt=now;
   rows.push({product_id:product.id,model,data,
    revision:Number(previous?.revision||0)+1,updated_at:now});
  }
  const {error}=await auth.admin.from("unit_ved_settings")
   .upsert(rows,{onConflict:"product_id,model"});
  if(error)throw Error("Ошибка сохранения MPStats: "+error.message);
  const refreshed=await syncUnitFromVedVersion(auth.admin,
   product.source_type as "single"|"whole",product.source_version_id,{force:true});
  if(!refreshed.ok)throw Error("Показатели сохранены, но пересчёт не завершён: "+refreshed.error);
  return NextResponse.json({ok:true,saved:true,
   buyoutRate:buyout,fbwSpp:spp,fbsSpp:spp,
   source:"mpstats",subject:metrics.subject,subjectId:metrics.subjectId,
   resolvedScope:metrics.scope,resolvedPath:metrics.categoryPath||metrics.subjectId,
   mappingSaved:!!(requested&&verifiedSelection),
   sampledProducts:metrics.sampledProducts,sampledAt:metrics.sampledAt,
   details:metrics.comments,partial:buyout===null||spp===null},{headers});
 }catch(e){
  if(e instanceof MpStatsError)return NextResponse.json({ok:false,error:e.message,kind:e.kind},
   {status:e.kind==="rate-limited"?429:e.kind==="invalid"?401:502,headers});
  return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Ошибка MPStats"},{status:500,headers});
 }
}
