import {NextRequest,NextResponse} from "next/server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
const allowed=["ved_in_work","production_confirmed","in_transit","cancelled"];
export async function POST(request:NextRequest){
 const auth=await createClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return NextResponse.json({ok:false,error:"Требуется авторизация"},{status:401});
 const input=await request.json().catch(()=>null);
 if(!input||typeof input.id!=="string"||!/^[0-9a-f-]{36}$/i.test(input.id)
 ||!allowed.includes(input.status))
 return NextResponse.json({ok:false,error:"Некорректный заказ или статус"},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(!url||!secret)return NextResponse.json({ok:false,error:"Нет подключения к Supabase"},{status:500});
 const response=await fetch(url+"/rest/v1/rpc/set_external_ved_order_status",{
  method:"POST",
  headers:{apikey:secret,Authorization:"Bearer "+secret,"Content-Type":"application/json"},
  body:JSON.stringify({p_order_id:input.id,p_status:input.status,p_actor_id:user.id}),
  cache:"no-store",
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok)return NextResponse.json({ok:false,error:data?.message||"Не удалось изменить статус"},{status:422});
 revalidatePath("/ved");
 revalidatePath("/zakup");
 revalidatePath("/ved-orders/"+input.id);
 return NextResponse.json({ok:true});
}
