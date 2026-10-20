import { NextRequest,NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=240;
const HOST="https://api-performance.ozon.ru";
const reply=(value:object,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

function parseCsv(csv:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],field="",quoted=false;
  const clean=csv.replace(/^\uFEFF/,"");
  for(let i=0;i<clean.length;i++){
    const ch=clean[i];
    if(ch==='"'){
      if(quoted && clean[i+1]==='"'){field+='"';i++}
      else quoted=!quoted;
    }else if(ch===';'&&!quoted){row.push(field);field=""}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&clean[i+1]==='\n')i++;
      row.push(field);field="";
      if(row.some(s=>s.trim()))rows.push(row);
      row=[];
    }else field+=ch;
  }
  row.push(field);if(row.some(s=>s.trim()))rows.push(row);
  return rows;
}
function parseMoney(value:string):number{
  const cleaned=value.replace(/[\s\u00A0\u202F₽]/g,"").replace(",",".").replace(/[^\d.\-]/g,"");
  if(!cleaned)return 0;
  const n=Number(cleaned);
  if(!Number.isFinite(n) || n<0)throw new Error("Performance returned invalid spend: "+value.slice(0,35));
  return n;
}
function parseReport(csv:string,from:string,to:string):Array<{day:string;sku:string;spend:number}>{
  const records=parseCsv(csv);
  const headerIndex=records.findIndex(row=>row.some(cell=>
    cell.trim().toLowerCase()==="sku"));
  if(headerIndex<0)throw new Error("Performance CSV has no SKU column");
  const columns=records[headerIndex].map(x=>x.toLocaleLowerCase("ru").replace(/\s/g,""));
  const skuIndex=columns.findIndex(x=>x==="sku");
  const dayIndex=columns.findIndex(x=>x==="дата"||x==="date"||
    x==="датаотчёта"||x==="датаотчета");
  const expenseIndex=columns.findIndex(x=>x.startsWith("расход")||x==="expense"||x.startsWith("затраты"));
  if(expenseIndex<0)throw new Error("Performance CSV has no spending column");
  if(dayIndex<0&&from!==to)
    throw new Error("Performance historical report has no daily Date column; cannot allocate to days.");
  const result:Array<{day:string;sku:string;spend:number}>=[];
  for(const row of records.slice(headerIndex+1)){
    const sku=String(row[skuIndex]??"").trim();
    if(!/^\d+$/.test(sku))continue; // Skip 'Итого' and roll-up rows.
    let day=dayIndex<0?from:String(row[dayIndex]??"").trim();
    if(/^\d{2}\.\d{2}\.\d{4}$/.test(day)){
      const [d,m,y]=day.split(".");day=y+"-"+m+"-"+d;
    }else day=day.slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<from||day>to)
      throw new Error("Unknown date in Performance CSV: "+day.slice(0,30));
    const spend=parseMoney(row[expenseIndex]??"");
    if(spend>0)result.push({day,sku,spend});
  }
  return result;
}
async function api<T>(path:string,token:string,init?:{method?:string;body?:object}):Promise<T>{
  const r=await fetch(HOST+path,{method:init?.method??"GET",cache:"no-store",
    headers:{Authorization:"Bearer "+token,Accept:"application/json",
      ...(init?.body?{"Content-Type":"application/json"}:{})},
    ...(init?.body?{body:JSON.stringify(init.body)}:{}),
    signal:AbortSignal.timeout(29000)});
  if(!r.ok)throw new Error("Performance "+path.split("?")[0]+" HTTP "+r.status+
    ": "+(await r.text()).slice(0,150));
  return await r.json() as T;
}
async function token():Promise<string>{
  const id=process.env.OZON_PERFORMANCE_CLIENT_ID;
  const secret=process.env.OZON_PERFORMANCE_CLIENT_SECRET;
  if(!id||!secret)throw new Error("Ozon Performance API credentials absent in Production");
  const r=await fetch(HOST+"/api/client/token",{method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({client_id:id,client_secret:secret,grant_type:"client_credentials"}),
    signal:AbortSignal.timeout(19000)});
  if(!r.ok)throw new Error("Performance authentication HTTP "+r.status);
  const v=await r.json() as {access_token?:string};
  if(!v.access_token)throw new Error("Performance token missing");
  return v.access_token;
}
export async function GET(request:NextRequest){
  const cronSecret=process.env.CRON_SECRET;
  if(!cronSecret||request.headers.get("authorization")!=="Bearer "+cronSecret)
    return reply({ok:false,error:"Unauthorized"},401);
  const db=createAdminClient();
  const {data:job,error:jobError}=await db.from("ozon_finance_ad_sync_jobs")
    .select("id,date_from,date_to").eq("account_key","main")
    .eq("status","pending").order("date_from",{ascending:true}).limit(1).maybeSingle();
  if(jobError)return reply({ok:false,error:jobError.message},503);
  if(!job)return reply({ok:true,status:"idle"});
  const markJob=async(status:string,error:string|null)=>db.from("ozon_finance_ad_sync_jobs")
    .update({status,last_error:error,updated_at:new Date().toISOString()}).eq("id",job.id);
  try{
    const auth=await token();
    const {count}=await db.from("ozon_finance_ad_campaign_reports")
      .select("id",{head:true,count:"exact"}).eq("job_id",job.id);
    if(!count){
      const all=new Set<string>();
      // Campaigns stopped today can still have expenses in selected history.
      for(let page=1;page<=10;page++){
        const v=await api<{list?:Array<{id?:string|number}>}>(
          "/api/client/campaign?page="+page+"&pageSize=100",auth);
        if(!Array.isArray(v.list))throw new Error("Performance campaign list: unexpected schema");
        for(const cmp of v.list)if(cmp.id!=null)all.add(String(cmp.id));
        if(v.list.length<100)break;
        if(page===10)throw new Error("Too many campaigns; cannot guarantee complete ad allocation");
      }
      if(!all.size)throw new Error("Performance returned no campaigns");
      const campaigns=[...all].map(campaign_id=>({job_id:job.id,campaign_id,status:"pending"}));
      for(let i=0;i<campaigns.length;i+=200){
        const {error}=await db.from("ozon_finance_ad_campaign_reports")
          .upsert(campaigns.slice(i,i+200),{onConflict:"job_id,campaign_id"});
        if(error)throw error;
      }
    }
    const start=Date.now();
    let processed=0,started=0;
    while(Date.now()-start<165000 && processed<12){
      const {data:batches,error:batchesError}=await db.from("ozon_finance_ad_campaign_reports")
        .select("id,campaign_id,report_uuid,status").eq("job_id",job.id)
        .in("status",["pending","awaiting"]).order("id",{ascending:true}).limit(1);
      if(batchesError)throw batchesError;
      const batch=batches?.[0];
      if(!batch){
        const {data:failed}=await db.from("ozon_finance_ad_campaign_reports")
         .select("last_error").eq("job_id",job.id).eq("status","failed").limit(1);
        if(failed?.length)throw new Error("Ad campaign report failed: "+failed[0].last_error);
        const {data:seller}=await db.rpc("ozon_finance_unallocated_breakdown",
          {p_from:job.date_from,p_to:job.date_to,p_account:"main"});
        const finance=(seller??[]).filter((r:{type_id:string})=>r.type_id==="41")
          .reduce((s:number,r:{amount:string|number})=>s+Math.abs(Number(r.amount)),0);
        const {data:current,error:currentError}=await db.from("ozon_finance_ad_sku_daily")
          .select("expense_rub").eq("account_key","main")
          .gte("day",job.date_from).lte("day",job.date_to);
        if(currentError)throw currentError;
        const sum=(current??[]).reduce((s,r)=>s+Number(r.expense_rub),0);
        if(finance>0 && sum===0)throw new Error("Seller PPC expenses exist but generated ad reports contain zero spend");
        const dates:Array<{account_key:string;day:string}>=[];
        for(let d=Date.parse(job.date_from+"T00:00:00Z"),end=Date.parse(job.date_to+"T00:00:00Z");
           d<=end;d+=86400000)
          dates.push({account_key:"main",day:new Date(d).toISOString().slice(0,10)});
        const {error:coverageError}=await db.from("ozon_finance_ad_coverage")
          .upsert(dates,{onConflict:"account_key,day"});
        if(coverageError)throw coverageError;
        await markJob("complete",null);
        return reply({ok:true,status:"complete",campaigns:processed,sku_spend:sum,finance_ppc:finance});
      }
      if(batch.status==="pending"){
        const res=await api<{UUID?:string}>("/api/client/statistics",auth,{
          method:"POST",body:{campaigns:[batch.campaign_id],
            dateFrom:job.date_from,dateTo:job.date_to,groupBy:"DATE"}});
        if(!res.UUID)throw new Error("No UUID from historical report request");
        const {error}=await db.from("ozon_finance_ad_campaign_reports")
          .update({report_uuid:res.UUID,status:"awaiting",updated_at:new Date().toISOString()})
          .eq("id",batch.id);
        if(error)throw error;
        started++;
        await sleep(1600);
        continue;
      }
      const id=String(batch.report_uuid??"");
      if(!/^[\da-fA-F-]{30,50}$/.test(id))throw new Error("Invalid Performance UUID");
      const status=await api<{state?:string;error?:string}>(
        "/api/client/statistics/"+encodeURIComponent(id),auth);
      if(status.state==="ERROR")throw new Error(status.error||"Ozon report generator returned ERROR");
      if(status.state!=="OK"){
        if(Date.now()-start>115000)break;
        await sleep(4900);
        continue;
      }
      const download=await fetch(HOST+"/api/client/statistics/report?UUID="+encodeURIComponent(id),{
        headers:{Authorization:"Bearer "+auth,Accept:"text/csv"},
        cache:"no-store",signal:AbortSignal.timeout(29000)});
      if(!download.ok)throw new Error("Performance report CSV HTTP "+download.status);
      const format=download.headers.get("content-type")??"";
      if(/zip|octet-stream/i.test(format))throw new Error("Unexpected ZIP for single-campaign report");
      const content=await download.text();
      const extracted=parseReport(content,job.date_from,job.date_to);
      const grouped=new Map<string,{account_key:string;day:string;sku:string;campaign_id:string;expense_rub:number}>();
      for(const item of extracted){
        const key=item.day+"|"+item.sku;
        const prev=grouped.get(key);
        grouped.set(key,{account_key:"main",day:item.day,sku:item.sku,campaign_id:batch.campaign_id,
          expense_rub:Math.round(((prev?.expense_rub??0)+item.spend)*10000)/10000});
      }
      const values=[...grouped.values()];
      for(let i=0;i<values.length;i+=250){
        const {error}=await db.from("ozon_finance_ad_sku_daily")
          .upsert(values.slice(i,i+250),{onConflict:"account_key,day,sku,campaign_id"});
        if(error)throw error;
      }
      const {error:doneError}=await db.from("ozon_finance_ad_campaign_reports")
        .update({status:"complete",row_count:values.length,
          updated_at:new Date().toISOString()}).eq("id",batch.id);
      if(doneError)throw doneError;
      processed++;
    }
    return reply({ok:true,status:"processing",reports_completed_this_run:processed,
      requested_this_run:started,phase:"campaign_reports"});
  }catch(error){
    const message=(error instanceof Error?error.message:String(error)).slice(0,400);
    await markJob("failed",message);
    console.warn("Ozon historical Performance export:",message);
    return reply({ok:false,status:"failed",error:message},502);
  }
}
