import {NextResponse} from "next/server";
import {getCbrRates,moscowToday} from "@/lib/cbr/rates";
import {isValidTariffDate} from "@/lib/ved-calculation/tariffs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const asOf=new URL(request.url).searchParams.get("asOf")||moscowToday();
 if(!isValidTariffDate(asOf)||asOf>moscowToday())
  return NextResponse.json({ok:false,error:"Недопустимая дата"},{status:400});
 try{
  return NextResponse.json({ok:true,...await getCbrRates(asOf)},{headers:{"Cache-Control":"public, max-age=0, s-maxage=3600, stale-while-revalidate=3600"}});
 }catch(error){
  console.error("CBR sync failed",error);
  return NextResponse.json({ok:false,error:"Курсы Банка России временно недоступны"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
