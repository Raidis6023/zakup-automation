import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

const BASE="https://api-performance.ozon.ru";
const response=(body:object,status=200)=>NextResponse.json(body,{
 status,headers:{"Cache-Control":"no-store"}
});
type Task={id:number;job_id:number;campaign_id:string;day:string;
 status:string;report_uuid:string|null;last_error:string|null};
type Job={id:number;date_from:string;date_to:string;status:string;last_error:string|null};
type Campaign={id:string|number;advObjectType?:string;fromDate?:string;toDate?:string};
type Db=ReturnType<typeof createAdminClient>;
function failString(e:unknown) {return e instanceof Error?e.message:String(e)}
function numeric(raw:string):number{
 const cleaned=raw.trim().replace(/[\u00a0\s₽]/g,"").replace(",",".");
 if(!/^-?\d+(\.\d+)?$/.test(cleaned))throw new Error("Invalid report expense");
 const n=Number(cleaned);
 if(!Number.isFinite(n)||n<0)throw new Error("Negative or invalid report expense");
 return n;
}
function parseDelimited(text:string):string[][]{
 const out:string[][]=[];let row:string[]=[],cell="",quoted=false;
 const value=text.replace(/^\uFEFF/,"");
 for(let i=0;i<value.length;i++){
  const ch=value[i];
  if(ch==='"'){
   if(quoted && value[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
  }else if(ch===';'&&!quoted){row.push(cell.trim());cell="";}
  else if((ch==='\n'||ch==='\r')&&!quoted){
   if(ch==='\r'&&value[i+1]==='\n')i++;
   row.push(cell.trim());cell="";
   if(row.some(v=>v))out.push(row);
   row=[];
  }else cell+=ch;
 }
 if(quoted)throw new Error("Unclosed quoted CSV cell");
 if(row.length||cell){row.push(cell.trim());if(row.some(v=>v))out.push(row)}
 return out;
}
function parseSkuExpenses(text:string):Map<string,number>{
 if(text.startsWith("PK"))throw new Error("Ozon returned ZIP for one campaign; expected CSV");
 const rows=parseDelimited(text);
 const normalized=(s:string)=>s.toLocaleLowerCase("ru").replace(/[\s_]+/g," ").trim();
 let header=-1,skuIndex=-1,expenseIndex=-1;
 for(let i=0;i<Math.min(rows.length,15);i++){
  const cols=rows[i].map(normalized);
  const sku=cols.findIndex(h=>h==="sku"||h==="озон sku"||h==="код sku");
  const expense=cols.findIndex(h=>/^расход/.test(h)&&(/ндс|р\b|₽/.test(h)));
  const expenseFallback=cols.findIndex(h=>/^расход/.test(h));
  if(sku>=0&&(expense>=0||expenseFallback>=0)){
    header=i;skuIndex=sku;expenseIndex=expense>=0?expense:expenseFallback;break;
  }
 }
 if(header<0)throw new Error("SKU/expense columns not found in historical CSV");
 const totals=new Map<string,number>();
 for(const row of rows.slice(header+1)){
  const sku=(row[skuIndex]??"").trim();
  if(!sku || /всего|итого|total/i.test(sku))continue;
  if(!/^\d{5,20}$/.test(sku)){
    if(row[expenseIndex] && Number.parseFloat(row[expenseIndex].replace(",","."))>0)
      throw new Error("Non-numeric SKU in a paid row");
    continue;
  }
  const raw=(row[expenseIndex]??"").trim();
  if(!raw)continue;
  const spent=numeric(raw);
  totals.set(sku,(totals.get(sku)??0)+spent);
 }
 return totals;
}
async function api(token:string,path:string,init?:RequestInit):Promise<Response>{
 const r=await fetch(BASE+path,{...init,cache:"no-store",headers:{
  "Authorization":"Bearer "+token,"Accept":"application/json",
  ...(init?.headers??{})
 },signal:AbortSignal.timeout(28000)});
 if(!r.ok){
  const body=(await r.text()).slice(0,250);
  throw new Error("Performance "+path.split("?")[0]+" HTTP "+r.status+": "+body);
 }
 return r;
}
async function token():Promise<string>{
 const clientId=process.env.OZON_PERFORMANCE_CLIENT_ID;
 const clientSecret=process.env.OZON_PERFORMANCE_CLIENT_SECRET;
 if(!clientId||!clientSecret)throw new Error("Performance client ID or secret is absent");
 const auth=await fetch(BASE+"/api/client/token",{
  method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Accept":"application/json"},
  body:JSON.stringify({client_id:clientId,client_secret:clientSecret,
    grant_type:"client_credentials"}),signal:AbortSignal.timeout(16000)
 });
 if(!auth.ok)throw new Error("Performance token HTTP "+auth.status);
 const value=(await auth.json() as {access_token?:string}).access_token;
 if(!value)throw new Error("Performance token response has no access_token");
 return value;
}
async function campaigns(tokenValue:string,job:Job):Promise<string[]>{
 const selected=new Set<string>();
 for(let page=1;page<=20;page++){
  const url="/api/client/campaign?advObjectType=SKU&page="+page+"&pageSize=100";
  const r=await api(tokenValue,url);
  const raw=await r.json() as {list?:Campaign[]|Campaign;campaigns?:Campaign[]};
  const list=Array.isArray(raw.list)?raw.list:
   raw.list && typeof raw.list==="object"?[raw.list]:raw.campaigns;
  if(!Array.isArray(list))throw new Error("Unexpected Ozon campaigns pagination response");
  for(const c of list){
   if(c.id==null)continue;
   if(c.advObjectType&&c.advObjectType!=="SKU")continue;
   if(c.fromDate && c.fromDate>job.date_to)continue;
   if(c.toDate && c.toDate<job.date_from)continue;
   selected.add(String(c.id));
  }
  if(list.length<100)return [...selected];
 }
 throw new Error("Campaign list exceeded 20 pages, not safely complete");
}
async function initializeTasks(db:Db,job:Job,tokenValue:string){
 const ids=await campaigns(tokenValue,job);
 if(ids.length===0)throw new Error("No SKU campaigns returned for the selected dates");
 const dates:string[]=[];
 for(let d=Date.parse(job.date_from+"T00:00:00Z"),
    until=Date.parse(job.date_to+"T00:00:00Z");
    d<=until&&dates.length<=63;d+=86400000)
    dates.push(new Date(d).toISOString().slice(0,10));
 if(!dates.length||dates.length>62)throw new Error("Historical report range exceeds 62 days");
 const newTasks=ids.flatMap(campaign_id=>dates.map(day=>({
   job_id:job.id,campaign_id,day,status:"pending"
 })));
 for(let i=0;i<newTasks.length;i+=250){
  const {error}=await db.from("ozon_finance_ad_campaign_tasks")
    .upsert(newTasks.slice(i,i+250),{
      onConflict:"job_id,campaign_id,day",ignoreDuplicates:true
    });
  if(error)throw new Error("Report campaign queue: "+error.message);
 }
 return {campaigns:ids.length,dates:dates.length,tasks:newTasks.length};
}
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get("authorization")!=="Bearer "+secret)
   return response({ok:false,error:"Unauthorized"},401);
 const db=createAdminClient();
 const {data:job,error}=await db.from("ozon_finance_ad_sync_jobs")
  .select("id,date_from,date_to,status,last_error")
  .eq("account_key","main")
  .in("status",["pending","running","failed"])
  .order("date_from",{ascending:true}).limit(1).maybeSingle();
 if(error)return response({ok:false,error:error.message},503);
 if(!job)return response({ok:true,status:"idle"});
 const taskJob=job as Job;
 const markJob=async(status:string,last_error:string|null)=>
  db.from("ozon_finance_ad_sync_jobs")
   .update({status,last_error,updated_at:new Date().toISOString()}).eq("id",job.id);
 try {
  const authToken=await token();
  const {count,error:countError}=await db.from("ozon_finance_ad_campaign_tasks")
    .select("id",{head:true,count:"exact"}).eq("job_id",job.id);
  if(countError)throw countError;
  if(!count){
   const initial=await initializeTasks(db,taskJob,authToken);
   await markJob("running",null);
   return response({ok:true,phase:"historical_campaigns_queued",...initial});
  }
  const {data:failure,error:failedError}=await db.from("ozon_finance_ad_campaign_tasks")
    .select("id,day,campaign_id,last_error").eq("job_id",job.id)
    .eq("status","failed").limit(1).maybeSingle();
  if(failedError)throw failedError;
  if(failure){
   await markJob("failed","Campaign "+failure.campaign_id+" on "+failure.day+
    ": "+failure.last_error);
   return response({ok:false,status:"failed",
      error:"Исторический отчёт: "+failure.last_error,
      campaign_id:failure.campaign_id,day:failure.day},409);
  }
  const {data:tasks,error:taskError}=await db.from("ozon_finance_ad_campaign_tasks")
   .select("id,job_id,campaign_id,day,status,report_uuid,last_error")
   .eq("job_id",job.id).in("status",["requested","pending"])
   .order("status",{ascending:false}).order("day",{ascending:true})
   .order("campaign_id",{ascending:true}).limit(1);
  if(taskError)throw taskError;
  if(!tasks?.length){
   // All campaign-days are finished; zero spend must not silently contradict
   // positive Seller API PPC charges. Marketing data never changes profit.
   const {data:charges,error:costError}=await db.rpc(
      "ozon_finance_unallocated_breakdown",
      {p_from:job.date_from,p_to:job.date_to,p_account:"main"}
   );
   if(costError)throw costError;
   const sellerPpc=(charges??[]).filter((c:{type_id:string})=>c.type_id==="41")
    .reduce((s:number,c:{amount:string|number})=>s+Math.abs(Number(c.amount)),0);
   const {data:adExpenses,error:adError}=await db.from("ozon_finance_ad_sku_daily")
    .select("expense_rub").eq("account_key","main")
    .gte("day",job.date_from).lte("day",job.date_to);
   if(adError)throw adError;
   const total=(adExpenses??[]).reduce((s,r)=>s+Number(r.expense_rub),0);
   if(sellerPpc>0 && total<=0)
      throw new Error("Historical reports have zero SKU spend but Seller has PPC charges");
   const days=[];
   for(let d=Date.parse(job.date_from+"T00:00:00Z"),
     end=Date.parse(job.date_to+"T00:00:00Z");d<=end;d+=86400000)
     days.push({account_key:"main",day:new Date(d).toISOString().slice(0,10)});
   const put=await db.from("ozon_finance_ad_coverage")
    .upsert(days,{onConflict:"account_key,day"});
   if(put.error)throw put.error;
   await markJob("complete",null);
   return response({ok:true,status:"complete",covered_days:days.length,
     sku_expense:Math.round(total*100)/100,seller_ppc_reference:sellerPpc,
     finance_ledger_unchanged:true});
  }
  const task=tasks[0] as Task;
  const updateTask=async(obj:Record<string,unknown>)=>
    db.from("ozon_finance_ad_campaign_tasks").update({
      ...obj,updated_at:new Date().toISOString()
    }).eq("id",task.id);
  if(task.status==="pending"){
   const from=task.day+"T00:00:00.000Z",to=task.day+"T23:59:59.000Z";
   const r=await api(authToken,"/api/client/statistics",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({campaigns:[task.campaign_id],from,to,
        dateFrom:task.day,dateTo:task.day,groupBy:"DATE"})
   });
   const created=await r.json() as {UUID?:string;uuid?:string};
   const uuid=String(created.UUID??created.uuid??"");
   if(!/^[A-Fa-f0-9-]{36}$/.test(uuid))
     throw new Error("Historical report generation returned no UUID");
   const up=await updateTask({status:"requested",report_uuid:uuid,last_error:null});
   if(up.error)throw up.error;
   await markJob("running",null);
   return response({ok:true,phase:"report_requested",
     campaign_id:task.campaign_id,day:task.day});
  }
  if(!task.report_uuid)throw new Error("Requested report task has no UUID");
  const check=await api(authToken,
    "/api/client/statistics/"+encodeURIComponent(task.report_uuid));
  const state=await check.json() as {state?:string};
  if(!state.state||!["OK","ERROR","FAILED","IN_PROGRESS","PENDING","RUNNING","WAITING"].includes(state.state))
    throw new Error("Unknown historical report state "+String(state.state));
  if(state.state!=="OK"){
    if(state.state==="ERROR"||state.state==="FAILED")
      throw new Error("Historical report rejected: "+state.state);
    return response({ok:true,phase:"report_processing",
      campaign_id:task.campaign_id,day:task.day,report_state:state.state});
  }
  const download=await api(authToken,
    "/api/client/statistics/report?UUID="+encodeURIComponent(task.report_uuid));
  const csv=await download.text();
  const parsed=parseSkuExpenses(csv);
  const values=[...parsed].map(([sku,expense])=>({
    account_key:"main",day:task.day,sku,campaign_id:task.campaign_id,
    expense_rub:Math.round(expense*10000)/10000
  }));
  for(let i=0;i<values.length;i+=250){
    const put=await db.from("ozon_finance_ad_sku_daily")
      .upsert(values.slice(i,i+250),{onConflict:"account_key,day,sku,campaign_id"});
    if(put.error)throw new Error("Ad SKU save: "+put.error.message);
  }
  const updated=await updateTask({
    status:"complete",rows_saved:values.length,last_error:null
  });
  if(updated.error)throw updated.error;
  await markJob("running",null);
  return response({ok:true,phase:"report_saved",
    campaign_id:task.campaign_id,day:task.day,sku_rows:values.length,
    spend_rub:Math.round(values.reduce((s,r)=>s+r.expense_rub,0)*100)/100});
 }catch(error){
   const message=failString(error).slice(0,380);
   await markJob("failed",message);
   console.warn("Ozon historical advertising cache:",message);
   return response({ok:false,status:"failed",error:message},502);
 }
}
