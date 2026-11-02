import { NextResponse } from "next/server";
import {getCbrRates,type CbrRates} from "@/lib/cbr/rates";
import { requireVedAccess, VedAccessError } from "@/lib/ved-calculation/server-access";
import { isValidTariffDate, resolveTariffs, VED_TARIFF_KEYS, type TariffRow } from "@/lib/ved-calculation/tariffs";
export const dynamic="force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof VedAccessError) return NextResponse.json({ok:false,error:error.message},{status:error.status});
  console.error("VED tariff request failed", error);
  return NextResponse.json({ok:false,error:"Ошибка получения справочника ВЭД"},{status:500});
}
export async function GET(request: Request) {
  try {
    const {admin,canEdit}=await requireVedAccess();
    const url=new URL(request.url);
    const asOf=url.searchParams.get("asOf")||new Date().toISOString().slice(0,10);
    if (!isValidTariffDate(asOf)) return NextResponse.json({ok:false,error:"Неверная дата"},{status:400});
    const {data,error}=await admin.from("ved_tariff_history")
      .select("id,tariff_key,effective_from,amount,reason,created_at")
      .lte("effective_from",asOf).order("id",{ascending:false}).limit(1000);
    if(error)throw error;
    const rows=(data||[]) as unknown as TariffRow[];
    const selected=resolveTariffs(rows,asOf);
    let cbrRates:CbrRates|null=null,fxError:string|null=null;
    try{
      cbrRates=await getCbrRates(asOf);
      for(const [key,code,markup] of [
        ["usdRub","USD",0],["eurRub","EUR",0],["cnyRub","CNY",1],
      ] as const){
        const r=cbrRates.rates[code];
        selected[key]={id:0,tariff_key:key,effective_from:r.effectiveDate,
          amount:r.official+markup,reason:"Банк России "+r.official+" ₽, надбавка "+markup+" ₽",created_at:""};
      }
    }catch(e){
      fxError=e instanceof Error?e.message:"Курсы ЦБ недоступны";
      delete selected.usdRub;delete selected.eurRub;delete selected.cnyRub;
    }
    // Whole audit history can include future revisions, but only for authorised editors.
    let history: TariffRow[]=[];
    if (url.searchParams.get("history")==="1" && canEdit) {
      const {data:events,error:histError}=await admin.from("ved_tariff_history")
       .select("id,tariff_key,effective_from,amount,reason,created_at")
       .order("id",{ascending:false}).limit(200);
      if(histError)throw histError;
      history=(events||[]) as unknown as TariffRow[];
    }
    return NextResponse.json({ok:true,asOf,selected,history,canEdit,cbrRates,fxError},{headers:{"Cache-Control":"private,no-store"}});
  }catch(e){return errorResponse(e);}
}
export async function POST(request: Request) {
  try{
    const {admin,user}=await requireVedAccess(true);
    const body=await request.json() as Record<string,unknown>;
    const key=String(body.key||"");
    const date=String(body.effectiveFrom||"");
    const amount=body.amount;
    const reason=typeof body.reason==="string"?body.reason.trim():"";
    if(["usdRub","eurRub","cnyRub"].includes(key))return NextResponse.json({ok:false,error:"Валюты подгружаются автоматически из ЦБ"},{status:400});
    if(!VED_TARIFF_KEYS.has(key)||!isValidTariffDate(date)||
       typeof amount!=="number"||!Number.isFinite(amount)||amount<0||amount>1e12||
       reason.length>1000){
      return NextResponse.json({ok:false,error:"Проверьте параметр, дату, значение и комментарий"},{status:400});
    }
    const {data,error}=await admin.from("ved_tariff_history").insert({
      tariff_key:key,effective_from:date,amount,reason,actor_user_id:user.id
    }).select("id,tariff_key,effective_from,amount,reason,created_at").single();
    if(error)throw error;
    return NextResponse.json({ok:true,revision:data},{status:201,headers:{"Cache-Control":"no-store"}});
  }catch(e){return errorResponse(e);}
}