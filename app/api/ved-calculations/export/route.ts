import {NextResponse} from "next/server";
import {requireVedAccess,VedAccessError} from "@/lib/ved-calculation/server-access";
import {buildVedExport} from "@/lib/ved-calculation/excel-export";
import type {VedCalculationInput,VedCalculationResult} from "@/lib/ved-calculation/engine";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Stored={
 id:string;calculation_id:string;title:string;article:string;version_no:number;
 calculation_date:string;input_data:VedCalculationInput;result_data:VedCalculationResult;
 tariffs_data?:Record<string,unknown>;
};
export async function POST(request:Request){
 try{
  const {admin}=await requireVedAccess();
  const body=await request.json() as {ids?:unknown};
  if(!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>30||
   body.ids.some(id=>typeof id!=="string"||!UUID.test(id))||
   new Set(body.ids).size!==body.ids.length){
   return NextResponse.json({ok:false,error:"Укажите от 1 до 30 уникальных идентификаторов сохранённых расчётов"},{status:400});
  }
  const {data,error}=await admin.from("ved_calculation_snapshots")
   .select("id,calculation_id,title,article,version_no,calculation_date,input_data,result_data,tariffs_data")
   .in("id",body.ids);
  if(error)throw error;
  const byId=new Map(((data||[]) as Stored[]).map(row=>[row.id,row]));
  if(byId.size!==body.ids.length)return NextResponse.json({ok:false,error:"Один или несколько расчётов не найдены"},{status:404});
  // Each calculation/product must occupy one sheet; explicit snapshot versions
  // retain their stored prices and input values.
  const uniq=new Set<string>();
  const rows:Stored[]=[];
  for(const id of body.ids as string[]){
   const row=byId.get(id);
   if(!row)continue;
   if(!uniq.has(row.calculation_id)){uniq.add(row.calculation_id);rows.push(row);}
  }
  const buffer=await buildVedExport(rows);
  const date=new Date().toISOString().slice(0,10);
  return new Response(new Uint8Array(buffer),{status:200,headers:{
   "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
   "Content-Disposition":'attachment; filename="VED-calculations-'+date+'.xlsx"',
   "Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff",
  }});
 }catch(e){
  if(e instanceof VedAccessError)return NextResponse.json({ok:false,error:e.message},{status:e.status});
  console.error("VED export failed",e);
  return NextResponse.json({ok:false,error:"Не удалось сформировать Excel. Проверьте сохранённые расчёты."},{status:500});
 }
}
