import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
function amount(value:unknown):number{
 const v=Number(value);
 if(!Number.isFinite(v) || v<0)throw new Error("Invalid Performance expense");
 return v;
}
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret || request.headers.get("authorization")!=="Bearer "+secret)
  return reply({ok:false,error:"Unauthorized"},401);
 const db=createAdminClient();
 const {data:job,error:jobError}=await db.from("ozon_finance_ad_sync_jobs")
  .select("id,date_from,date_to,status").eq("account_key","main")
  .in("status",["pending","failed"]).order("date_from",{ascending:true})
  .limit(1).maybeSingle();
 if(jobError)return reply({ok:false,error:jobError.message},503);
 if(!job)return reply({ok:true,status:"idle"});
 // Do not retry invalid credentials endlessly: record the diagnostic.
 const mark=async(status:string,last_error:string|null)=>
  db.from("ozon_finance_ad_sync_jobs")
   .update({status,last_error,updated_at:new Date().toISOString()})
   .eq("id",job.id);
 await mark("running",null);
 try {
  const clientId=process.env.OZON_PERFORMANCE_CLIENT_ID;
  const clientSecret=process.env.OZON_PERFORMANCE_CLIENT_SECRET;
  if(!clientId||!clientSecret)throw new Error("Performance API credentials are missing");
  const auth=await fetch("https://api-performance.ozon.ru/api/client/token",{
   method:"POST",cache:"no-store",
   headers:{"Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify({client_id:clientId,client_secret:clientSecret,grant_type:"client_credentials"}),
   signal:AbortSignal.timeout(19000)
  });
  if(!auth.ok)throw new Error("Performance token HTTP "+auth.status);
  const token=(await auth.json() as {access_token?:string}).access_token;
  if(!token)throw new Error("Performance token response lacks access_token");
  // The SKU statistics API is immediate, unlike the asynchronous report API.
  const response=await fetch("https://api-performance.ozon.ru/api/client/statistics/products/sku",{
   method:"POST",cache:"no-store",
   headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,"Accept":"application/json"},
   body:JSON.stringify({dateFrom:job.date_from,dateTo:job.date_to}),
   signal:AbortSignal.timeout(35000)
  });
  if(!response.ok){
   const msg=(await response.text()).slice(0,260);
   throw new Error("Performance SKU report HTTP "+response.status+": "+msg);
  }
  const payload=await response.json() as {rows?:Array<{
   date?:string;sku?:string|number;campaignId?:string|number;expense?:string|number
  }>};
  if(!Array.isArray(payload.rows))throw new Error("Unexpected Performance SKU report schema");
  const grouped=new Map<string,{account_key:string;day:string;sku:string;campaign_id:string;expense_rub:number}>();
  for(const row of payload.rows){
   const day=String(row.date??"").slice(0,10);
   const sku=String(row.sku??"").trim();
   const campaign=String(row.campaignId??"").trim();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<job.date_from||day>job.date_to||
      !sku||!campaign)throw new Error("Incomplete date, SKU or campaign in Performance response");
   const expense=amount(row.expense);
   const key=day+"|"+sku+"|"+campaign;
   const prev=grouped.get(key);
   grouped.set(key,{account_key:"main",day,sku,campaign_id:campaign,
     expense_rub:(prev?.expense_rub??0)+expense});
  }
  const data=[...grouped.values()];
  for(let i=0;i<data.length;i+=300){
   const {error}=await db.from("ozon_finance_ad_sku_daily")
     .upsert(data.slice(i,i+300),{onConflict:"account_key,day,sku,campaign_id"});
   if(error)throw new Error("Ad SKU cache: "+error.message);
  }
  const coverage=[] as Array<{account_key:string;day:string}>;
  for(let d=Date.parse(job.date_from+"T00:00:00Z"),end=Date.parse(job.date_to+"T00:00:00Z");
   d<=end;d+=86400000)coverage.push({account_key:"main",day:new Date(d).toISOString().slice(0,10)});
  const {error:covError}=await db.from("ozon_finance_ad_coverage")
    .upsert(coverage,{onConflict:"account_key,day"});
  if(covError)throw covError;
  await mark("complete",null);
  return reply({ok:true,status:"complete",days:coverage.length,rows:data.length,
    expense_rub:data.reduce((s,r)=>s+r.expense_rub,0)});
 }catch(error){
  const message=(error instanceof Error?error.message:String(error)).slice(0,400);
  await mark("failed",message);
  console.warn("Ozon Performance SKU allocation:",message);
  // Optional analytic data must never make Seller finance sync fail.
  return reply({ok:false,status:"failed",error:message},502);
 }
}
