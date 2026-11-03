import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {retryPendingUnitVedEvents,syncUnitFromVedVersion} from "@/lib/unit-economics/prospective-sync";
import {mergeProductOverrides,applyProductOverrides,type ProductOverrides} from "@/lib/unit-economics/product-overrides";
import {calculatePreliminary,type PreliminarySource} from "@/lib/unit-economics/prospective-engine";
import {PRELIMINARY_MODELS} from "@/lib/unit-economics/prospective-engine";
import {findWbCategory} from "@/lib/unit-economics/wb-category-registry";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
async function access(){
 const session=await createClient();
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user)return {error:"Необходим вход в WorkSpace",status:401} as const;
 const admin=createAdminClient();
 const {data:profile,error:accessErr}=await admin.from("app_user_access")
  .select("system_role,admin_level,is_blocked").eq("user_id",user.id).maybeSingle();
 if(accessErr||!profile||profile.is_blocked)return {error:"Нет доступа к расчётам",status:403} as const;
 const isAdmin=["admin","senior_admin"].includes(profile.admin_level??"");
 const role=profile.system_role??"";
 if(!isAdmin&&!["analyst","ved","head","manager"].includes(role))
  return {error:"Нет доступа к расчётной юнит-экономике",status:403} as const;
 return {admin,canRetry:isAdmin||role==="analyst"||role==="ved"} as const;
}
export async function GET(req:NextRequest){
 const auth=await access();
 if("error" in auth)return NextResponse.json({ok:false,error:auth.error},{status:auth.status,headers});
 const limit=Math.min(150,Math.max(1,Number(req.nextUrl.searchParams.get("limit")||100)||100));
 const requestedArticles=(req.nextUrl.searchParams.get("articles")||"").split(",")
  .map(v=>v.trim().toUpperCase()).filter(v=>/^[A-Z0-9_-]{1,120}$/.test(v)).slice(0,25);
 let productQuery=auth.admin.from("unit_ved_products")
  .select("id,article,name,source_type,source_version_id,ved_created_at,cost_gross_rub,purchase_vat_credit_rub,volume_liters,volume_source,unit_weight_kg,overrides,input_data,edit_revision");
 const requestedId=req.nextUrl.searchParams.get("productId");
 if(requestedId&&/^[a-f0-9-]{36}$/i.test(requestedId))productQuery=productQuery.eq("id",requestedId);
 else if(requestedArticles.length)productQuery=productQuery.in("article",requestedArticles);
 const {data:products,error:pErr}=await productQuery
  .order("ved_created_at",{ascending:false}).limit(limit);
 if(pErr)return NextResponse.json({ok:false,error:"База расчётов ВЭД не готова: "+pErr.message},
  {status:503,headers});
 const ids=(products||[]).map(p=>p.id);
 if(!ids.length)return NextResponse.json({ok:true,products:[],models:PRELIMINARY_MODELS},{headers});
 const {data:calculations,error:cErr}=await auth.admin.from("unit_ved_calculations")
  .select("product_id,model,status,missing,result_data,source_version_id,computed_at")
  .in("product_id",ids).limit(limit*6);
 if(cErr)return NextResponse.json({ok:false,error:cErr.message},{status:500,headers});
 const {data:configs,error:settingsErr}=await auth.admin.from("unit_ved_settings")
  .select("product_id,model,data,revision").in("product_id",ids);
 if(settingsErr)return NextResponse.json({ok:false,error:settingsErr.message},{status:500,headers});
 const configMap=new Map((configs||[]).map(x=>[x.product_id+":"+x.model,x.data as Record<string,unknown>]));
 const byProduct=new Map<string,Record<string,unknown>>();
 for(const item of calculations||[]){
  const value=item.result_data as Record<string,unknown>;
  const detail={
   model:item.model,status:item.status,missing:item.missing,
   costGrossRub:value.costGrossRub??null,volumeLiters:value.volumeLiters??null,
   unitWeightKg:value.unitWeightKg??null,unitWeightFormula:value.unitWeightFormula??null,
   unitWeightSource:value.unitWeightSource??null,unitWeightWarning:value.unitWeightWarning??null,
   priceRub:value.priceRub??null,priceAfterSppRub:value.priceAfterSppRub??null,
   targetPriceRub:value.targetPriceRub??null,profitRub:value.profitRub??null,
   margin:value.margin??null,roi:value.roi??null,
   outputVatRub:value.outputVatRub??null,inputVatRub:value.inputVatRub??null,
   purchaseVatCreditRub:value.purchaseVatCreditRub??null,costNetRub:value.costNetRub??null,
   commissionRate:value.commissionRate??null,
   expenses:Array.isArray(value.expenses)?value.expenses:[],
   logistics:value.logistics??null,
   volumeSource:value.volumeSource??null,volumeFormula:value.volumeFormula??null,
   assumptions:Array.isArray(value.assumptions)?value.assumptions:[],
   settings:configMap.get(item.product_id+":"+item.model)||{},
   sourceVersionId:item.source_version_id,
   computedAt:item.computed_at
  };
  const existing=byProduct.get(item.product_id)||{};
  existing[item.model]=detail;byProduct.set(item.product_id,existing);
 }
 return NextResponse.json({ok:true,models:PRELIMINARY_MODELS,
  products:(products||[]).map(p=>({...p,schemes:byProduct.get(p.id)||{}}))},{headers});
}
export async function POST(request:NextRequest){
 const auth=await access();
 if("error" in auth)return NextResponse.json({ok:false,error:auth.error},{status:auth.status,headers});
 if(!auth.canRetry)return NextResponse.json({ok:false,error:"Недостаточно прав для повторного расчёта"},
  {status:403,headers});
 const body=await request.json().catch(()=>null) as {action?:string}|null;
 if(body?.action!=="retry-pending")return NextResponse.json({ok:false,error:"Неизвестная операция"},
  {status:400,headers});
 const results=await retryPendingUnitVedEvents(auth.admin,10).catch(e=>null);
 if(!results)return NextResponse.json({ok:false,error:"Не удалось обработать очередь"},{status:500,headers});
 return NextResponse.json({ok:true,attempted:results.length,processed:results.reduce((a,r)=>a+r.processed,0),
  failures:results.filter(r=>!r.ok).map(r=>r.error||"Ошибка обработки")},{headers});
}

/**
 * Изменяемые исходные параметры хранятся поверх неизменяемой версии ВЭД.
 * Вес единицы нельзя передать: он каждый раз вычисляется из cartonGrossKg / unitsPerCarton.
 * После сохранения заново рассчитываем все шесть схем, включая историю.
 */
export async function PATCH(request:NextRequest){
 const auth=await access();
 if("error" in auth)return NextResponse.json({ok:false,error:auth.error},{status:auth.status,headers});
 if(!auth.canRetry)return NextResponse.json({ok:false,error:"Недостаточно прав на редактирование"},
  {status:403,headers});
 const body=await request.json().catch(()=>null) as {
  productId?:string;model?:string;productPatch?:Record<string,unknown>;
  priceRub?:number|null;wbCategory?:{name:string;group:string};
 }|null;
 if(!body||typeof body.productId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.productId))
  return NextResponse.json({ok:false,error:"Не указан товар"},{status:400,headers});
 const hasShared=body.productPatch&&Object.keys(body.productPatch).length>0;
 const hasPrice=Object.prototype.hasOwnProperty.call(body,"priceRub");
 const hasWbCategory=!!body.wbCategory;
 const model=body.model||"";
 const confirmedCategory=hasWbCategory?findWbCategory(body.wbCategory!.name,body.wbCategory!.group):null;
 if(hasWbCategory&&!confirmedCategory)
  return NextResponse.json({ok:false,error:"Категория не найдена в справочнике комиссий WB"},
   {status:400,headers});
 if(!hasShared&&!hasPrice&&!hasWbCategory)return NextResponse.json({ok:false,error:"Нет изменений"},{status:400,headers});
 if(hasPrice&&!PRELIMINARY_MODELS.includes(model as typeof PRELIMINARY_MODELS[number]))
  return NextResponse.json({ok:false,error:"Неизвестная схема продаж"},{status:400,headers});
 if(hasPrice&&body.priceRub!==null&&(
  typeof body.priceRub!=="number"||!Number.isFinite(body.priceRub)||body.priceRub<=0||body.priceRub>1e9
 ))return NextResponse.json({ok:false,error:"Некорректная цена продажи"},{status:400,headers});
 const {data:product,error:readErr}=await auth.admin.from("unit_ved_products")
  .select("id,article,name,overrides,edit_revision,source_type,source_version_id,input_data,result_data")
  .eq("id",body.productId).single();
 if(readErr||!product)return NextResponse.json({ok:false,error:"Товар не найден"},{status:404,headers});
 try{
  const overrides=hasShared?mergeProductOverrides(
   (product.overrides||{}) as ProductOverrides,body.productPatch!
  ):(product.overrides||{}) as ProductOverrides;
  const original:PreliminarySource={
   article:product.article,
   name:(product.input_data as PreliminarySource["input"])?.product?.productName||product.name,
   input:product.input_data as PreliminarySource["input"],
   result:product.result_data as PreliminarySource["result"]
  };
  const effective=applyProductOverrides(original,overrides);
  // Проверка допустимости себестоимости/упаковки ДО записи в БД.
  for(const m of PRELIMINARY_MODELS)calculatePreliminary(effective,m,{});
  if(hasShared){
   const {data:updated,error:updateErr}=await auth.admin.from("unit_ved_products")
    .update({overrides,edit_revision:product.edit_revision+1,name:effective.name,
      updated_at:new Date().toISOString()})
    .eq("id",product.id).eq("edit_revision",product.edit_revision)
    .select("id").maybeSingle();
   if(updateErr)throw Error(updateErr.message);
   if(!updated)return NextResponse.json({ok:false,error:"Карточка была изменена другим пользователем. Обновите данные."},
    {status:409,headers});
  }
  if(hasPrice){
   const {data:before,error:beforeErr}=await auth.admin.from("unit_ved_settings")
    .select("data,revision").eq("product_id",product.id).eq("model",model).maybeSingle();
   if(beforeErr)throw Error(beforeErr.message);
   const settings={...((before?.data||{}) as Record<string,unknown>)};
   if(body.priceRub===null)delete settings.priceRub;
   else settings.priceRub=body.priceRub;
   const {error:writeErr}=await auth.admin.from("unit_ved_settings").upsert({
    product_id:product.id,model,data:settings,revision:Number(before?.revision||0)+1,
    updated_at:new Date().toISOString()
   },{onConflict:"product_id,model"});
   if(writeErr)throw Error(writeErr.message);
  }
  if(hasWbCategory&&confirmedCategory){
   // One confirmed WB subject, different commissions for FBW/FBS.
   for(const [wbModel,rate] of [["wb-fbw",confirmedCategory.fbw],["wb-fbs",confirmedCategory.fbs]] as const){
    const {data:before,error:beforeErr}=await auth.admin.from("unit_ved_settings")
     .select("data,revision").eq("product_id",product.id).eq("model",wbModel).maybeSingle();
    if(beforeErr)throw Error(beforeErr.message);
    const settings={...((before?.data||{}) as Record<string,unknown>),
      categoryId:confirmedCategory.name,categoryGroup:confirmedCategory.group,
      categoryCommissionRate:rate,wbCategoryConfirmedAt:new Date().toISOString()};
    const {error}=await auth.admin.from("unit_ved_settings").upsert({
      product_id:product.id,model:wbModel,data:settings,
      revision:Number(before?.revision||0)+1,updated_at:new Date().toISOString()
    },{onConflict:"product_id,model"});
    if(error)throw Error(error.message);
   }
  }
  const synced=await syncUnitFromVedVersion(
   auth.admin,product.source_type as "single"|"whole",product.source_version_id,{force:true}
  );
  return NextResponse.json({
   ok:synced.ok,
   saved:true,
   processed:synced.processed,
   warning:synced.ok?null:"Корректировка сохранена, но пересчёт ожидает повторной обработки: "+synced.error
  },{status:synced.ok?200:202,headers});
 }catch(e){
  const detail=e instanceof Error?e.message:String(e);
  return NextResponse.json({ok:false,error:detail},{status:400,headers});
 }
}
