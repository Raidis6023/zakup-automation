import { NextResponse } from "next/server";
import { calculateVed, VedInputError, type VedCalculationInput } from "@/lib/ved-calculation/engine";
import { requireVedAccess, VedAccessError } from "@/lib/ved-calculation/server-access";
import { applyTariffValues, isValidTariffDate, resolveTariffs, VED_TARIFFS, type TariffRow } from "@/lib/ved-calculation/tariffs";
export const dynamic="force-dynamic";

function respondError(error: unknown) {
  if(error instanceof VedAccessError)return NextResponse.json({ok:false,error:error.message},{status:error.status});
  if(error instanceof VedInputError)return NextResponse.json({ok:false,error:error.issues.join("; ")},{status:400});
  console.error("VED snapshot error",error);
  return NextResponse.json({ok:false,error:"Ошибка сохранения расчёта ВЭД"},{status:500});
}
const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET() {
  try{
    const {admin}=await requireVedAccess();
    const {data,error}=await admin.from("ved_calculation_snapshots")
     .select("id,calculation_id,title,article,version_no,calculation_date,input_data,result_data,tariffs_data,created_at")
     .order("created_at",{ascending:false}).limit(60);
    if(error)throw error;
    return NextResponse.json({ok:true,items:data??[]},{headers:{"Cache-Control":"private,no-store"}});
  }catch(e){return respondError(e);}
}
export async function POST(request: Request) {
  try{
    const {user,admin}=await requireVedAccess(true);
    const body=await request.json() as Record<string,unknown>;
    const title=typeof body.title==="string"?body.title.trim():"";
    const article=typeof body.article==="string"?body.article.trim():"";
    const calculationDate=typeof body.calculationDate==="string"?body.calculationDate:"";
    if(!title||title.length>180||article.length>120||!isValidTariffDate(calculationDate)||
      !body.input||typeof body.input!=="object"||Array.isArray(body.input)){
      return NextResponse.json({ok:false,error:"Укажите название, дату и корректные параметры"},{status:400});
    }
    if (JSON.stringify(body).length>100000)
      return NextResponse.json({ok:false,error:"Слишком большой расчёт"},{status:413});
    const input=body.input as VedCalculationInput;
    // Recalculate on the server. Browser-submitted results are never trusted.
    const result=calculateVed(input);
    const {data:history,error:rateError}=await admin.from("ved_tariff_history")
      .select("id,tariff_key,effective_from,amount,reason,created_at")
      .lte("effective_from",calculationDate).order("id",{ascending:false}).limit(1000);
    if(rateError)throw rateError;
    const selected=resolveTariffs((history??[]) as unknown as TariffRow[],calculationDate);
    const tariffSnapshot:Record<string,unknown>={};
    for(const item of VED_TARIFFS) {
      const row=selected[item.key];
      const actual=(input[item.group] as unknown as Record<string,unknown>)[item.key];
      tariffSnapshot[item.key]={
        actual:typeof actual==="number"?actual:null,
        reference:row?Number(row.amount):null,
        referenceId:row?.id??null,
        effectiveFrom:row?.effective_from??null,
        isOverride:row?typeof actual==="number"&&actual!==Number(row.amount):true,
      };
    }
    const rawId=body.calculationId;
    let calculationId: string;
    let version=1;
    if (rawId !== undefined && rawId!==null && rawId!==""){
      calculationId=String(rawId);
      if(!uuidRe.test(calculationId))
        return NextResponse.json({ok:false,error:"Неверная ссылка на расчёт"},{status:400});
      const {data:latest,error:latestError}=await admin.from("ved_calculation_snapshots")
       .select("version_no").eq("calculation_id",calculationId).order("version_no",{ascending:false}).limit(1).maybeSingle();
      if(latestError)throw latestError;
      if(!latest)return NextResponse.json({ok:false,error:"Исходный расчёт не найден"},{status:404});
      version=latest.version_no+1;
    } else calculationId=crypto.randomUUID();
    const {data,error}=await admin.from("ved_calculation_snapshots")
      .insert({calculation_id:calculationId,title,article,version_no:version,calculation_date:calculationDate,
        input_data:input,result_data:result,tariffs_data:tariffSnapshot,created_by:user.id})
      .select("id,calculation_id,version_no,created_at").single();
    if(error){
      if(error.code==="23505")return NextResponse.json({ok:false,error:"Версия уже сохранена другим сотрудником. Обновите список."},{status:409});
      throw error;
    }
    return NextResponse.json({ok:true,snapshot:data},{status:201,headers:{"Cache-Control":"no-store"}});
  }catch(e){return respondError(e);}
}