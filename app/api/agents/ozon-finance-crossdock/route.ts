import {NextRequest,NextResponse} from "next/server";
import {createAdminClient} from "../../../../lib/supabase/admin";
export const dynamic="force-dynamic";export const runtime="nodejs";export const maxDuration=180;
const result=(value:object,status=200)=>NextResponse.json(value,{status});
type SupplyList={order_ids?:Array<string|number>;last_id?:string};
type Supply={supply_id?:string|number;state?:string;is_crossdock?:boolean;
 bundle_id?:string;storage_warehouse?:{name?:string;warehouse_id?:string|number}};
type Order={order_id?:string|number;state?:string;supplies?:Supply[]};
async function ozon<T>(path:string,body:unknown,client:string,key:string):Promise<T>{
 const response=await fetch("https://api-seller.ozon.ru"+path,{
  method:"POST",cache:"no-store",
  headers:{"Client-Id":client,"Api-Key":key,"Content-Type":"application/json"},
  body:JSON.stringify(body),signal:AbortSignal.timeout(24000)
 });
 if(!response.ok)throw new Error(path+" HTTP "+response.status+": "+(await response.text()).slice(0,220));
 return await response.json() as T;
}
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET,client=process.env.OZON_CLIENT_ID,key=process.env.OZON_API_KEY;
 if(!secret||request.headers.get("authorization")!=="Bearer "+secret)
  return result({ok:false,error:"Unauthorized"},401);
 if(!client||!key)return result({ok:false,error:"Ozon Seller API not configured"},503);
 const db=createAdminClient();
 const {data:current,error:curError}=await db.from("ozon_finance_crossdock_current")
  .select("published_at").eq("account_key","main").maybeSingle();
 if(curError)return result({ok:false,error:curError.message},503);
 if(current && Date.now()-Date.parse(current.published_at)<3*3600000)
  return result({ok:true,state:"fresh",as_of:current.published_at});
 let {data:run,error:runError}=await db.from("ozon_finance_crossdock_runs")
  .select("run_id,status,last_id,pages").in("status",["running","failed"])
  .order("started_at",{ascending:false}).limit(1).maybeSingle();
 if(runError)return result({ok:false,error:runError.message},503);
 if(!run){
  const x=await db.from("ozon_finance_crossdock_runs").insert({status:"running"})
   .select("run_id,status,last_id,pages").single();
  if(x.error||!x.data)return result({ok:false,error:x.error?.message??"Cannot create run"},503);
  run=x.data;
 }
 try{
  // Include both states where the supply has left the seller's hands, but
  // has not completed receiving at the destination storage warehouse.
  const list=await ozon<SupplyList>("/v3/supply-order/list",{
    filter:{states:["ORDER_STATE_IN_TRANSIT","ORDER_STATE_ACCEPTED_AT_SUPPLY_WAREHOUSE"]},
    last_id:run.last_id||"",limit:20,sort_by:"ORDER_STATE_UPDATED_AT",sort_dir:"DESC"
  },client,key);
  if(!Array.isArray(list.order_ids))throw new Error("Unexpected supply-order/list shape");
  const ids=list.order_ids.map(String);
  const entries=new Map<string,{run_id:string;supply_id:string;sku:string;
    destination_warehouse:string|null;quantity:number}>();
  if(ids.length){
   const details=await ozon<{orders?:Order[]}>("/v3/supply-order/get",{
     order_ids:ids
   },client,key);
   if(!Array.isArray(details.orders))throw new Error("Unexpected supply-order/get response");
   if(details.orders.length!==ids.length)
     throw new Error("Supply-order/get returned incomplete list, not publishing");
   for(const order of details.orders){
    for(const supply of order.supplies??[]){
     if(!supply.is_crossdock || !supply.bundle_id)continue;
     const status=String(supply.state??"").replace(/^ORDER_STATE_/,"");
     if(!["IN_TRANSIT","ACCEPTED_AT_SUPPLY_WAREHOUSE"].includes(status))
       continue;
     const supplyId=String(supply.supply_id??"");
     if(!supplyId)throw new Error("Crossdock supply has no supply_id");
     let lastId="";
     for(let page=0;page<100;page++){
      const bundle=await ozon<{items?:Array<{sku?:string|number;quantity?:number}>;
        has_next?:boolean;last_id?:string}>("/v1/supply-order/bundle",{
          bundle_ids:[supply.bundle_id],last_id:lastId,limit:100
        },client,key);
      if(!Array.isArray(bundle.items)||typeof bundle.has_next!=="boolean")
       throw new Error("Invalid crossdock bundle format");
      for(const item of bundle.items){
       const sku=String(item.sku??""),quantity=Number(item.quantity??0);
       if(!sku||!Number.isSafeInteger(quantity)||quantity<0)
        throw new Error("Invalid SKU/quantity in crossdock bundle");
       const k=supplyId+"|"+sku;
       const prev=entries.get(k);
       entries.set(k,{run_id:run.run_id,supply_id:supplyId,sku,
        quantity:(prev?.quantity??0)+quantity,
        destination_warehouse:supply.storage_warehouse?.name??null});
      }
      if(!bundle.has_next)break;
      if(!bundle.last_id||bundle.last_id===lastId)
       throw new Error("Crossdock bundle pagination cursor did not advance");
      lastId=bundle.last_id;
      if(page===99)throw new Error("Bundle exceeded 100 pages");
     }
    }
   }
  }
  const rows=[...entries.values()];
  for(let i=0;i<rows.length;i+=200){
   const put=await db.from("ozon_finance_crossdock_items")
    .upsert(rows.slice(i,i+200),{onConflict:"run_id,supply_id,sku"});
   if(put.error)throw put.error;
  }
  const next=String(list.last_id??"");
  const complete=ids.length===0||!next;
  if(!complete&&next===run.last_id)throw new Error("Supply order cursor did not advance");
  const put=await db.from("ozon_finance_crossdock_runs").update({
    status:complete?"complete":"running",
    last_id:next,pages:run.pages+1,
    updated_at:new Date().toISOString(),completed_at:complete?new Date().toISOString():null,
    last_error:null
  }).eq("run_id",run.run_id);
  if(put.error)throw put.error;
  if(complete){
   const published=await db.from("ozon_finance_crossdock_current").upsert({
     account_key:"main",run_id:run.run_id,published_at:new Date().toISOString()
   },{onConflict:"account_key"});
   if(published.error)throw published.error;
  }
  return result({ok:true,status:complete?"complete":"running",
    processed_orders:ids.length,crossdock_skus:rows.length,pages:run.pages+1});
 }catch(error){
  const msg=(error instanceof Error?error.message:String(error)).slice(0,310);
  await db.from("ozon_finance_crossdock_runs").update({
    status:"failed",last_error:msg,updated_at:new Date().toISOString()
  }).eq("run_id",run.run_id);
  return result({ok:false,status:"failed",error:msg},502);
 }
}
