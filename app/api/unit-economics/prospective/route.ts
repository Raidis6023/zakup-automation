import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {retryPendingUnitVedEvents} from "@/lib/unit-economics/prospective-sync";
import {PRELIMINARY_MODELS} from "@/lib/unit-economics/prospective-engine";
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
 const {data:products,error:pErr}=await auth.admin.from("unit_ved_products")
  .select("id,article,name,source_type,source_version_id,ved_created_at,cost_gross_rub,purchase_vat_credit_rub,volume_liters,volume_source")
  .order("ved_created_at",{ascending:false}).limit(limit);
 if(pErr)return NextResponse.json({ok:false,error:"База расчётов ВЭД не готова: "+pErr.message},
  {status:503,headers});
 const ids=(products||[]).map(p=>p.id);
 if(!ids.length)return NextResponse.json({ok:true,products:[],models:PRELIMINARY_MODELS},{headers});
 const {data:calculations,error:cErr}=await auth.admin.from("unit_ved_calculations")
  .select("product_id,model,status,missing,result_data,source_version_id,computed_at")
  .in("product_id",ids).limit(limit*6);
 if(cErr)return NextResponse.json({ok:false,error:cErr.message},{status:500,headers});
 const byProduct=new Map<string,Record<string,unknown>>();
 for(const item of calculations||[]){
  const value=item.result_data as Record<string,unknown>;
  const detail={
   model:item.model,status:item.status,missing:item.missing,
   costGrossRub:value.costGrossRub??null,volumeLiters:value.volumeLiters??null,
   priceRub:value.priceRub??null,priceAfterSppRub:value.priceAfterSppRub??null,
   targetPriceRub:value.targetPriceRub??null,profitRub:value.profitRub??null,
   margin:value.margin??null,roi:value.roi??null,
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
