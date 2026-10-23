import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Product={nmId:number;sellerArticle:string|null;productName:string|null;masterCode:string|null;sales28Days:number;fbwStock:number};
export async function GET(){
 const session=await createClient();const {data:{user}}=await session.auth.getUser();
 if(!user)return NextResponse.json({ok:false,error:"Требуется авторизация"},{status:401});
 try{
 const db=createAdminClient();
 const {data:dash,error:e}=await db.rpc("get_wb_sync_dashboard");if(e)throw e;
 const products=(dash?.products??[]) as Product[];
 const {data:pack,error:pe}=await db.from("products").select("master_code,units_per_carton").not("master_code","is",null).range(0,9999);
 if(pe)throw pe;
 const byCode=new Map<string,Set<number>>();
 for(const p of pack??[]){const code=String(p.master_code??"").trim();const units=Number(p.units_per_carton);if(!code||!Number.isSafeInteger(units)||units<=0)continue;
 const set=byCode.get(code)??new Set<number>();set.add(units);byCode.set(code,set);}
 const rows=products.map(p=>{
 const daily=Math.max(0,Number(p.sales28Days)||0)/28;
 const stock=Math.max(0,Number(p.fbwStock)||0);
 const days=daily>0?stock/daily:null;
 const raw=daily===0?0:days! > 30?0:days! < 10?daily*30:Math.max(0,40*daily-stock);
 const values=byCode.get(String(p.masterCode??""))??new Set<number>();
 const packValue=values.size===1?[...values][0]:null;
 const boxes=raw>0&&packValue?Math.ceil(raw/packValue):0;
 return {sku:String(p.nmId),name:p.productName??p.sellerArticle??String(p.nmId),masterCode:p.masterCode,sales28Days:p.sales28Days,stock,days,rawNeed:raw,unitsPerBox:packValue,boxes,quantity:boxes*(packValue??0),status:raw===0?"no_need":!p.masterCode?"missing_master":values.size>1?"pack_conflict":!packValue?"missing_pack":"ready"};
 }).filter(x=>x.rawNeed>0);
 return NextResponse.json({ok:true,source:"get_wb_sync_dashboard",syncedAt:dash?.status?.stocksLastSuccessAt??null,rows,summary:{skus:rows.length,ready:rows.filter(x=>x.status==="ready").length,blocked:rows.filter(x=>x.status!=="ready").length,quantity:rows.reduce((n,x)=>n+x.quantity,0),boxes:rows.reduce((n,x)=>n+x.boxes,0)}},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Ошибка расчёта"},{status:500});}
}
