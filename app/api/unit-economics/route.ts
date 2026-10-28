import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {MODEL_KEYS,MODELS,googleEnabled,getModelData,getTariffData,writeConstant,type ModelKey} from "@/lib/unit-economics/source";
export const dynamic="force-dynamic";
export const runtime="nodejs";
async function getAccess(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return null;
 const {data}=await createAdminClient().from("app_user_access")
  .select("system_role,is_blocked").eq("user_id",user.id).maybeSingle();
 return {userId:user.id,analyst:data?.system_role==="analyst"&&data.is_blocked!==true};
}
const noStore={"Cache-Control":"private, no-store"};
export async function GET(req:NextRequest){
 const access=await getAccess();
 if(!access)return NextResponse.json({error:"Требуется авторизация"},{status:401,headers:noStore});
 const kind=req.nextUrl.searchParams.get("kind")??"meta";
 if(kind==="meta")return NextResponse.json({analyst:access.analyst,googleConnected:googleEnabled()},{headers:noStore});
 if(kind==="model"){
  const key=req.nextUrl.searchParams.get("model");
  if(!MODEL_KEYS.includes(key as ModelKey))return NextResponse.json({error:"Неверная модель"},{status:400});
  return NextResponse.json(await getModelData(key as ModelKey),{headers:noStore});
 }
 if(kind==="rates"){
  const key=req.nextUrl.searchParams.get("table")??"";
  if(!["ozon-fbo","ozon-fbs","wb","ym-fby","ym-fbs","ozon-logistics","wb-logistics","ym-logistics"].includes(key))return NextResponse.json({error:"Неверный справочник"},{status:400});
  const data=await getTariffData(key);return NextResponse.json(data,{headers:noStore});
 }
 return NextResponse.json({error:"Неверный запрос"},{status:400});
}
export async function POST(req:NextRequest){
 const access=await getAccess();
 if(!access)return NextResponse.json({error:"Требуется авторизация"},{status:401,headers:noStore});
 if(!access.analyst)return NextResponse.json({error:"Изменять тарифы может только Аналитик"},{status:403,headers:noStore});
 let body:{action?:string;model?:string;cell?:string;value?:number};
 try{body=await req.json()}catch{return NextResponse.json({error:"Неверный JSON"},{status:400})}
 if(body.action!=="constant"||!MODEL_KEYS.includes(body.model as ModelKey)||typeof body.cell!=="string"||typeof body.value!=="number")return NextResponse.json({error:"Недопустимая операция"},{status:400});
 try{await writeConstant(body.model as ModelKey,body.cell,body.value);return NextResponse.json({ok:true},{headers:noStore})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Ошибка изменения"},{status:422,headers:noStore})}
}
