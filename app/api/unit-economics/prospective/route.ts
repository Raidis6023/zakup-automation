import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {retryPendingUnitVedEvents,syncUnitFromVedVersion} from "@/lib/unit-economics/prospective-sync";
import {mergeProductOverrides,applyProductOverrides,type ProductOverrides} from "@/lib/unit-economics/product-overrides";
import {calculatePreliminary,type PreliminarySource} from "@/lib/unit-economics/prospective-engine";
import {PRELIMINARY_MODELS} from "@/lib/unit-economics/prospective-engine";
import {findWbCategory} from "@/lib/unit-economics/wb-category-registry";
import {findMarketplaceCategory,type CategoryMarket} from "@/lib/unit-economics/marketplace-category-registry";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
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
  .select("id,article,name,source_type,source_version_id,source_item_id,ved_created_at,cost_gross_rub,purchase_vat_credit_rub,volume_liters,volume_source,unit_weight_kg,overrides,input_data,edit_revision");
 const requestedId=req.nextUrl.searchParams.get("productId");
 if(requestedId&&/^[a-f0-9-]{36}$/i.test(requestedId))productQuery=productQuery.eq("id",requestedId);
 else if(requestedArticles.length)productQuery=productQuery.in("article",requestedArticles);
 const {data:products,error:pErr}=await productQuery
  .order("ved_created_at",{ascending:false}).limit(limit);
 if(pErr)return NextResponse.json({ok:false,error:"База расчётов ВЭД не готова: "+pErr.message},
  {status:503,headers});
 const ids=(products||[]).map(p=>p.id);
 const sourceItemIds=[...new Set((products||[]).map(p=>p.source_item_id).filter((x):x is string=>!!x))];
 const sourceOfferIds=new Map<string,string>();
 if(sourceItemIds.length){
  const {data:sourceItems,error:sourceError}=await auth.admin.from("ved_commercial_offer_items")
   .select("id,offer_id").in("id",sourceItemIds).limit(500);
  if(sourceError)return NextResponse.json({ok:false,error:sourceError.message},{status:503,headers});
  (sourceItems||[]).forEach(x=>sourceOfferIds.set(x.id,x.offer_id));
 }
 if(!ids.length)return NextResponse.json({ok:true,products:[],models:PRELIMINARY_MODELS},{headers});
 const {data:calculations,error:cErr}=await auth.admin.from("unit_ved_calculations")
  .select("product_id,model,status,missing,result_data,source_version_id,computed_at")
  .in("product_id",ids).limit(limit*6);
 if(cErr)return NextResponse.json({ok:false,error:cErr.message},{status:500,headers});
 const {data:configs,error:settingsErr}=await auth.admin.from("unit_ved_settings")
  .select("product_id,model,data,revision").in("product_id",ids);
 if(settingsErr)return NextResponse.json({ok:false,error:settingsErr.message},{status:500,headers});
 const configMap=new Map((configs||[]).map(x=>[x.product_id+":"+x.model,x.data as Record<string,unknown>]));
 // Repair previously cached price-less calculations once when their remaining inputs are present.
 // Only on an individual product request: do not trigger large-scale writes from a list view.
 let resolvedCalculations=calculations||[];
 if(requestedId&&/^[a-f0-9-]{36}$/i.test(requestedId)&&products?.length===1){
  const p=products[0];
  const stuck=resolvedCalculations.some(c=>c.product_id===p.id&&
   c.missing?.length===1&&c.missing[0]==="Цена продажи или рассчитанная целевая цена"&&
   !!(configMap.get(p.id+":"+c.model)?.categoryId));
  if(stuck&&(p.source_type==="single"||p.source_type==="whole")&&p.source_version_id){
   const refreshed=await syncUnitFromVedVersion(auth.admin,p.source_type,
    p.source_version_id,{force:true});
   if(refreshed.ok){
    const {data:newRows,error:refreshErr}=await auth.admin.from("unit_ved_calculations")
     .select("product_id,model,status,missing,result_data,source_version_id,computed_at")
     .eq("product_id",p.id).limit(6);
    if(!refreshErr&&newRows)resolvedCalculations=newRows;
   }
  }
 }
 const byProduct=new Map<string,Record<string,unknown>>();
 for(const item of resolvedCalculations){
  const value=item.result_data as Record<string,unknown>;
  const detail={
   model:item.model,status:item.status,missing:item.missing,
   costPolicyVersion:value.costPolicyVersion??1,sourceCost:value.sourceCost??null,
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
  products:(products||[]).map(p=>({...p,source_offer_id:sourceOfferIds.get(p.source_item_id||"")||null,schemes:byProduct.get(p.id)||{}}))},{headers});
}
export async function POST(request:NextRequest){
 const auth=await access();
 if("error" in auth)return NextResponse.json({ok:false,error:auth.error},{status:auth.status,headers});
 if(!auth.canRetry)return NextResponse.json({ok:false,error:"Недостаточно прав для повторного расчёта"},
  {status:403,headers});
 const body=await request.json().catch(()=>null) as {
  action?:string;sourceType?:string;sourceVersionId?:string
 }|null;
 if(body?.action==="recalculate-cost-policy"){
  const sourceType=body.sourceType,versionId=body.sourceVersionId;
  if((sourceType!=="whole"&&sourceType!=="single")||
   typeof versionId!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(versionId))
   return NextResponse.json({ok:false,error:"Некорректная версия расчёта ВЭД"},{status:400,headers});
  const {data:linked,error:linkedError}=await auth.admin.from("unit_ved_products")
   .select("id").eq("source_type",sourceType).eq("source_version_id",versionId).limit(1);
  if(linkedError)return NextResponse.json({ok:false,error:linkedError.message},{status:503,headers});
  if(!linked?.length)return NextResponse.json({ok:false,error:"Товары версии ВЭД не найдены"},{status:404,headers});
  const {data:current,error:calcError}=await auth.admin.from("unit_ved_calculations")
   .select("result_data").eq("product_id",linked[0].id).eq("model","ozon-fbo").maybeSingle();
  if(calcError)return NextResponse.json({ok:false,error:calcError.message},{status:503,headers});
  if(Number((current?.result_data as Record<string,unknown>|null)?.costPolicyVersion)===2)
   return NextResponse.json({ok:true,alreadyCurrent:true,processed:0},{headers});
  const result=await syncUnitFromVedVersion(auth.admin,sourceType,versionId,{force:true});
  return NextResponse.json({ok:result.ok,processed:result.processed,skipped:result.skipped,
   ...(!result.ok?{error:result.error}:{}),
   ...(result.ok?{recalculated:true}:{})},{status:result.ok?200:503,headers});
 }
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
  marketCategories?:{market:CategoryMarket;key:string}[];
 }|null;
 if(!body||typeof body.productId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.productId))
  return NextResponse.json({ok:false,error:"Не указан товар"},{status:400,headers});
 const hasShared=body.productPatch&&Object.keys(body.productPatch).length>0;
 const hasPrice=Object.prototype.hasOwnProperty.call(body,"priceRub");
 const hasWbCategory=!!body.wbCategory;
 const choices=body.marketCategories;
 const hasOther=Array.isArray(choices)&&choices.length>0;
 if(choices!==undefined&&(!Array.isArray(choices)||choices.length>2||
  new Set(choices.map(x=>x?.market)).size!==choices.length||
  choices.some(x=>!x||(x.market!=="ozon"&&x.market!=="ym")||typeof x.key!=="string"||x.key.length>450)))
  return NextResponse.json({ok:false,error:"Некорректные категории"},{status:400,headers});
 const model=body.model||"";
 const confirmedCategory=hasWbCategory?findWbCategory(body.wbCategory!.name,body.wbCategory!.group):null;
 if(hasWbCategory&&!confirmedCategory)
  return NextResponse.json({ok:false,error:"Категория не найдена в справочнике комиссий WB"},
   {status:400,headers});
 if(!hasShared&&!hasPrice&&!hasWbCategory&&!hasOther)return NextResponse.json({ok:false,error:"Нет изменений"},{status:400,headers});
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
  if(hasShared&&Object.prototype.hasOwnProperty.call(body.productPatch,"productType")&&
   String(((product.overrides||{}) as Record<string,unknown>).productType||"").trim()!==
   String(overrides.productType||"").trim()){
   for(const oldModel of ["ozon-fbo","ozon-fbs","ym-fby","ym-fbs"]){
    const {data:old,error:oldErr}=await auth.admin.from("unit_ved_settings")
     .select("data,revision").eq("product_id",product.id).eq("model",oldModel).maybeSingle();
    if(oldErr)throw oldErr;
    if(!old)continue;
    const data={...((old.data||{}) as Record<string,unknown>)};
    for(const field of ["categoryId","categoryType","categoryGroup","categoryPath",
     "categoryCommissionRate","ozonCommissionRates","ozonInsuranceFactors",
     "insuranceFactor","categorySource","categoryConfirmedAt"])delete data[field];
    const {error}=await auth.admin.from("unit_ved_settings").update({
     data,revision:Number(old.revision||0)+1,updated_at:new Date().toISOString()
    }).eq("product_id",product.id).eq("model",oldModel);
    if(error)throw error;
   }
  }
  if(hasOther){
   for(const choice of choices!){
    const category=await findMarketplaceCategory(choice.market,choice.key);
    if(!category)throw Error("Категория отсутствует в справочнике "+choice.market);
    const modelRates=category.market==="ozon"
     ?[["ozon-fbo",category.rates.fbo],["ozon-fbs",category.rates.fbs]] as const
     :[["ym-fby",category.rates.fby],["ym-fbs",category.rates.ymFbs]] as const;
    for(const [modelName,commission] of modelRates){
     const {data:old,error:oldErr}=await auth.admin.from("unit_ved_settings")
      .select("data,revision").eq("product_id",product.id).eq("model",modelName).maybeSingle();
     if(oldErr)throw oldErr;
     const data={...((old?.data||{}) as Record<string,unknown>)};
     Object.assign(data,{categoryId:category.category,categoryType:category.name,
      categoryGroup:category.group,categoryPath:category.path,
      categorySource:category.live?"google-live":"tariff-snapshot",
      categoryConfirmedAt:new Date().toISOString()});
     if(category.market==="ozon"){
      if(!Array.isArray(commission)||commission.length!==3)throw Error("Нет комиссии Ozon");
      data.ozonCommissionRates={upTo100:commission[0],upTo300:commission[1],above300:commission[2]};
      data.categoryCommissionRate=commission[2];
      if(category.insuranceFactors)data.ozonInsuranceFactors=category.insuranceFactors;
      else delete data.ozonInsuranceFactors;
     }else{
      if(typeof commission!=="number")throw Error("Нет комиссии Яндекс Маркета");
      data.categoryCommissionRate=commission;
     }
     const {error}=await auth.admin.from("unit_ved_settings").upsert({
      product_id:product.id,model:modelName,data,revision:Number(old?.revision||0)+1,
      updated_at:new Date().toISOString()
     },{onConflict:"product_id,model"});
     if(error)throw error;
    }
   }
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
   // Категория относится к обеим схемам WB. При замене категории запрещено
   // оставлять старые выкуп и СПП: они относятся к другому предмету.
   let changed=false;
   for(const [wbModel,rate] of [["wb-fbw",confirmedCategory.fbw],["wb-fbs",confirmedCategory.fbs]] as const){
    const {data:before,error:beforeErr}=await auth.admin.from("unit_ved_settings")
     .select("data,revision").eq("product_id",product.id).eq("model",wbModel).maybeSingle();
    if(beforeErr)throw Error(beforeErr.message);
    const data={...((before?.data||{}) as Record<string,unknown>)};
    const categoryChanged=data.categoryId!==confirmedCategory.name||
     data.categoryGroup!==confirmedCategory.group;
    if(categoryChanged){
     changed=true;
     for(const field of ["buyoutRate","buyoutSource","buyoutSourceSubject",
      "wbSppRate","wbSppSource","wbSppSampledProducts","mpstatsUpdatedAt"]){
      delete data[field];
     }
    }
    Object.assign(data,{
     categoryId:confirmedCategory.name,categoryGroup:confirmedCategory.group,
     categoryCommissionRate:rate,wbCategoryConfirmedAt:new Date().toISOString()
    });
    const {error}=await auth.admin.from("unit_ved_settings").upsert({
      product_id:product.id,model:wbModel,data,
      revision:Number(before?.revision||0)+1,updated_at:new Date().toISOString()
    },{onConflict:"product_id,model"});
    if(error)throw Error(error.message);
   }
   if(changed){
    // Оzоn использует именно прогноз выкупа WB, а не собственный показатель.
    // Сброс возможен только когда значение ранее скопировано из MPStats.
    for(const ozonModel of ["ozon-fbo","ozon-fbs"]){
     const {data:before,error:beforeErr}=await auth.admin.from("unit_ved_settings")
      .select("data,revision").eq("product_id",product.id)
      .eq("model",ozonModel).maybeSingle();
     if(beforeErr)throw Error(beforeErr.message);
     if(!before)continue;
     const data={...(before.data as Record<string,unknown>)};
     if(data.buyoutSource!=="wb-mpstats-subject-proxy")continue;
     for(const field of ["buyoutRate","buyoutSource","buyoutSourceSubject","mpstatsUpdatedAt"]){
      delete data[field];
     }
     const {error}=await auth.admin.from("unit_ved_settings").update({
      data,revision:Number(before.revision||0)+1,updated_at:new Date().toISOString()
     }).eq("product_id",product.id).eq("model",ozonModel);
     if(error)throw Error(error.message);
    }
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
