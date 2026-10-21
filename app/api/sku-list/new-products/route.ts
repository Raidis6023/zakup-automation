import {NextRequest,NextResponse} from "next/server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
function config(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error("Не настроен Supabase");
 return {url,key};
}
async function rpc(name:string,data:Record<string,unknown>){
 const {url,key}=config();
 const response=await fetch(url+"/rest/v1/rpc/"+name,{
  method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},
  body:JSON.stringify(data),cache:"no-store",
 });
 const value=await response.json().catch(()=>null);
 if(!response.ok)throw Error(value?.message||"Ошибка Supabase "+response.status);
 return value;
}
async function getUser(){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 return error?null:user;
}
export async function GET(){
 if(!await getUser())return NextResponse.json({ok:false,error:"Требуется вход"},{status:401});
 try{
  const rows=await rpc("get_ved_product_intake",{});
  return NextResponse.json({ok:true,rows:Array.isArray(rows)?rows:[]});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Ошибка загрузки"},{status:500});}
}
export async function POST(request:NextRequest){
 const user=await getUser();
 if(!user)return NextResponse.json({ok:false,error:"Требуется вход"},{status:401});
 const body=await request.json().catch(()=>null);
 const article=typeof body?.article==="string"?body.article.trim().toUpperCase():"";
 if(!article||article.length>120||!/^[A-Z0-9._\/-]+$/.test(article))
  return NextResponse.json({ok:false,error:"Некорректный артикул"},{status:400});
 try{
  let result:Record<string,unknown>;
  if(body.action==="classify"){
   result=await rpc("set_ved_product_intake_classification",{p_article:article,p_classification:"new",p_actor_id:user.id});
  }else if(body.action==="link"||body.action==="generate"){
   const masterCode=typeof body.masterCode==="string"?body.masterCode.trim().toUpperCase():"";
   if(body.action==="link"&&!/^[A-Z0-9]{6}$/.test(masterCode))
    return NextResponse.json({ok:false,error:"ЕНОТ должен содержать ровно 6 латинских букв или цифр"},{status:400});
   result=await rpc("link_ved_product_intake",{
    p_article:article,p_master_code:body.action==="link"?masterCode:"",
    p_generate_new:body.action==="generate",p_actor_id:user.id
   });
  }else return NextResponse.json({ok:false,error:"Неизвестная операция"},{status:400});
  revalidatePath("/sku-list");revalidatePath("/ved");revalidatePath("/zakup");
  return NextResponse.json({ok:true,...result});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Не удалось сохранить"},{status:422});}
}
