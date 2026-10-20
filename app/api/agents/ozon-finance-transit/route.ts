import { NextRequest,NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
type PostingProduct={sku?:number|string;quantity?:number;price?:number|string|{amount?:string}};
type Posting={posting_number?:string;status?:string;products?:PostingProduct[]};
type Reply={postings?:Posting[];cursor?:string;has_next?:boolean};
const reply=(value:object,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});
function priceOf(v:PostingProduct["price"]):number|null {
 const val=typeof v==="object" && v!==null?v.amount:v;
 if(val===undefined||val===null)return null;
 const n=Number(val);
 return Number.isFinite(n)&&n>=0?n:null;
}
export async function GET(request:NextRequest) {
 const secret=process.env.CRON_SECRET;
 if(!secret || request.headers.get("authorization")!=="Bearer "+secret)
   return reply({ok:false,error:"Unauthorized"},401);
 const sellerId=process.env.OZON_CLIENT_ID,key=process.env.OZON_API_KEY;
 if(!sellerId||!key)return reply({ok:false,error:"Seller API credentials missing"},503);
 const db=createAdminClient();
 const {data:active}=await db.from("ozon_finance_transit_current")
  .select("run_id,published_at").eq("account_key","main").maybeSingle();
 if(active && Date.now()-Date.parse(active.published_at)<2*3600000)
   return reply({ok:true,status:"fresh",as_of:active.published_at});
 let {data:run,error:runError}=await db.from("ozon_finance_transit_runs")
  .select("run_id,status,cursor,pages,updated_at")
  .in("status",["running","failed"]).order("started_at",{ascending:false}).limit(1).maybeSingle();
 if(runError)return reply({ok:false,error:runError.message},503);
 if(!run) {
   const r=await db.from("ozon_finance_transit_runs")
     .insert({status:"running"}).select("run_id,status,cursor,pages,updated_at").single();
   if(r.error||!r.data)return reply({ok:false,error:r.error?.message||"Cannot create run"},503);
   run=r.data;
 }
 const runId=run.run_id;
 try {
  const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10)+"T00:00:00+03:00";
  const to=new Date().toISOString().slice(0,10)+"T23:59:59+03:00";
  const started=Date.now();
  let pages=0,complete=false,total=0,cursor=run.cursor??"";
  while(pages<12 && Date.now()-started<100000) {
   const resp=await fetch("https://api-seller.ozon.ru/v3/posting/fbo/list",{
     method:"POST",cache:"no-store",
     headers:{"Client-Id":sellerId,"Api-Key":key,"Content-Type":"application/json"},
     body:JSON.stringify({cursor,
       filter:{since,to},
       limit:100,sort_dir:"asc",translit:false,
       with:{analytics_data:true,financial_data:true,legal_info:false}}),
     signal:AbortSignal.timeout(22000)
   });
   if(!resp.ok) {
     const body=(await resp.text()).slice(0,360);
     throw new Error("FBO postings HTTP "+resp.status+": "+body);
   }
   const response=await resp.json() as Reply;
   if(!Array.isArray(response.postings)||typeof response.has_next!=="boolean")
     throw new Error("Ozon FBO postings: unexpected schema");
   const saved:Array<{run_id:string;posting_number:string;sku:string;posting_status:string;
     quantity:number;unit_price_rub:number|null}>=[];
   for(const posting of response.postings) {
    // Match the known-working Ozon FBO list request, then filter locally;
    // the extra API-side status filter caused HTTP 400 in Production.
    if(!["awaiting_packaging","awaiting_deliver","delivering"].includes(posting.status??""))
      continue;
    if(!posting.posting_number)continue;
    const within=new Map<string,{quantity:number;unit_price_rub:number|null}>();
    for(const p of posting.products??[]){
      const sku=String(p.sku??"");
      const quantity=Number(p.quantity??0);
      if(!sku||!Number.isSafeInteger(quantity)||quantity<0)continue;
      const price=priceOf(p.price);
      const prev=within.get(sku);
      if(!prev) within.set(sku,{quantity,unit_price_rub:price});
      else if(prev.unit_price_rub===price)prev.quantity+=quantity;
      else {prev.quantity+=quantity;prev.unit_price_rub=null;}
    }
    for(const [sku,item] of within)
      saved.push({run_id:runId,posting_number:posting.posting_number,
        sku,posting_status:posting.status??"unknown",
        quantity:item.quantity,unit_price_rub:item.unit_price_rub});
   }
   for(let i=0;i<saved.length;i+=200){
     const put=await db.from("ozon_finance_transit_entries")
       .upsert(saved.slice(i,i+200),{onConflict:"run_id,posting_number,sku"});
     if(put.error)throw new Error("Transit save: "+put.error.message);
   }
   total+=saved.length;pages++;
   const next=String(response.cursor??"");
   if(response.has_next && (!next || next===cursor))
     throw new Error("FBO postings cursor has not advanced");
   cursor=next;
   const update=await db.from("ozon_finance_transit_runs").update({
      status:response.has_next?"running":"complete",
      cursor,pages:run.pages+pages,updated_at:new Date().toISOString(),
      completed_at:response.has_next?null:new Date().toISOString(),last_error:null
   }).eq("run_id",runId);
   if(update.error)throw update.error;
   if(!response.has_next){complete=true;break}
  }
  if(complete){
    const publish=await db.from("ozon_finance_transit_current").upsert({
      account_key:"main",run_id:runId,published_at:new Date().toISOString()
    },{onConflict:"account_key"});
    if(publish.error)throw publish.error;
  }
  return reply({ok:true,status:complete?"complete":"running",pages_processed:pages,
    rows_processed:total,run_id:runId});
 }catch(error) {
   const errorMessage=error instanceof Error?error.message:"Unexpected error";
   await db.from("ozon_finance_transit_runs").update({
     status:"failed",last_error:errorMessage.slice(0,250),updated_at:new Date().toISOString()
   }).eq("run_id",runId);
   return reply({ok:false,status:"failed",error:errorMessage.slice(0,250)},502);
 }
}
