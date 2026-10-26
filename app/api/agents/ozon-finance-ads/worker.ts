import { NextRequest, NextResponse } from "next/server";
import { inflateRawSync } from "node:zlib";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

type Job={id:number;date_from:string;date_to:string;status:string;last_error:string|null};
type Task={id:number;job_id:number;campaign_id:string;day:string;date_to:string;
 status:string;report_uuid:string|null;last_error:string|null};
type Db=ReturnType<typeof createAdminClient>;
type Parsed={sku:string;day:string;expense:number};
const BASE="https://api-performance.ozon.ru";
const json=(body:object,status=200)=>NextResponse.json(body,{status,
 headers:{"Cache-Control":"no-store"}});
const message=(error:unknown)=>error instanceof Error?error.message:String(error);
const following=(day:string)=>new Date(Date.parse(day+"T00:00:00Z")+86400000).toISOString().slice(0,10);
const numeric=(s:string)=>{
 const compact=s.trim().replace(/[₽\s\u00a0]/g,"").replace(",",".");
 if(!/^-?\d+(?:\.\d+)?$/.test(compact))throw new Error("Unknown expense format: "+s.slice(0,32));
 const value=Number(compact);
 if(!Number.isFinite(value)||value<0)throw new Error("Invalid or negative advertising expense");
 return value;
};
function delimited(value:string):string[][] {
 const out:string[][]=[];let row:string[]=[],cell="",quoted=false;
 const input=value.replace(/^\uFEFF/,"");
 for(let i=0;i<input.length;i++){
  const char=input[i];
  if(char==='"'){
   if(quoted&&input[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
  }else if(char===';'&&!quoted){row.push(cell.trim());cell="";}
  else if((char==='\n'||char==='\r')&&!quoted){
    if(char==='\r'&&input[i+1]==='\n')i++;
    row.push(cell.trim());cell="";if(row.some(Boolean))out.push(row);row=[];
  }else cell+=char;
 }
 if(quoted)throw new Error("Unterminated CSV quoted cell");
 row.push(cell.trim());if(row.some(Boolean))out.push(row);
 return out;
}
const norm=(value:string)=>value.toLocaleLowerCase("ru")
 .replace(/[ё]/g,"е").replace(/[^\p{L}\p{N}]+/gu," ").trim();
function parsedDay(value:string):string|null {
 const v=value.trim();
 if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
 const ru=v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
 if(ru)return ru[3]+"-"+ru[2]+"-"+ru[1];
 return null;
}
/** Do not silently assign a month of costs to one arbitrary date. */
export function parseHistoricCSV(text:string,from:string,to:string):Parsed[] {
 if(text.startsWith("PK"))throw new Error("Historical report is ZIP, not one-campaign CSV");
 const lines=delimited(text),max=Math.min(40,lines.length);
 let head=-1,skuCol=-1,costCol=-1,dateCol=-1;
 for(let i=0;i<max;i++){
  const headers=lines[i].map(norm);
  const sku=headers.findIndex(s=>s==="sku"||s==="озон sku"||s==="код sku");
  const expense=headers.findIndex(s=>s.startsWith("расход")||
    s==="spend"||s==="expense");
  if(sku<0||expense<0)continue;
  head=i;skuCol=sku;costCol=expense;
  dateCol=headers.findIndex(s=>(s==="дата"||s==="день"||s==="date"||
    s==="дата отчета"||s==="report date"));
  break;
 }
 if(head<0)throw new Error("CSV does not contain SKU and advertising expense columns");
 const sums=new Map<string,number>();
 let paidRows=0;
 for(const row of lines.slice(head+1)){
  const sku=String(row[skuCol]??"").trim();
  if(!sku||/^(?:всего|итого|total|bcero)$/i.test(sku))continue;
  const raw=String(row[costCol]??"").trim();
  if(!raw||raw==="—"||raw==="-")continue;
  const amount=numeric(raw);
  if(!/^\d{5,25}$/.test(sku)){
    if(amount>0)throw new Error("Non-SKU advertising row with positive expense");
    continue;
  }
  if(amount===0)continue;
  paidRows++;
  let day=dateCol>=0?parsedDay(String(row[dateCol]??"")):null;
  if(!day&&from!==to)throw new Error("CSV_NO_DAILY_DATE: report must be split by day");
  day=day??from;
  if(day<from||day>to)throw new Error("Advertising CSV contains date outside requested window");
  const key=day+"|"+sku;
  sums.set(key,(sums.get(key)??0)+amount);
 }
 if(paidRows>0&&!sums.size)throw new Error("Campaign CSV had spend but no SKU attribution");
 return [...sums].map(([key,expense])=>({
   day:key.slice(0,10),sku:key.slice(11),expense:Math.round(expense*10000)/10000
 }));
}
/** Ozon returns a ZIP with one campaignId.csv per campaign when
 * requesting 2-10 campaigns. Decode central directory, verify CRC and
 * require all expected CSVs before marking any campaign complete.
 * Never extract ZIP filenames to disk or trust paths from the archive. */
function reportCsvFiles(binary:Buffer,expectedCampaigns:string[]):Map<string,string>{
 if(expectedCampaigns.length<1||expectedCampaigns.length>10)
   throw new Error("Invalid Ozon campaign batch size");
 if(expectedCampaigns.length===1 && binary.subarray(0,2).toString("utf8")!=="PK")
   return new Map([[expectedCampaigns[0],binary.toString("utf8")]]);
 if(binary.length<22||binary.readUInt32LE(0)!==0x04034b50)
   throw new Error("Ozon returned no ZIP for multiple campaigns");
 let end=-1;
 for(let i=binary.length-22;i>=Math.max(0,binary.length-65557);i--){
   if(binary.readUInt32LE(i)===0x06054b50){end=i;break}
 }
 if(end<0)throw new Error("ZIP end-of-directory not found");
 const total=binary.readUInt16LE(end+10),centralSize=binary.readUInt32LE(end+12);
 const centralOffset=binary.readUInt32LE(end+16);
 if(total<expectedCampaigns.length||total>20 ||
   centralOffset+centralSize>binary.length)throw new Error("Invalid ZIP central directory");
 const expected=new Set(expectedCampaigns),out=new Map<string,string>();
 let p=centralOffset,totalBytes=0;
 const crcTable=new Uint32Array(256);
 for(let i=0;i<256;i++){
   let x=i;for(let j=0;j<8;j++)x=(x&1)?(0xedb88320^(x>>>1)):(x>>>1);
   crcTable[i]=x>>>0;
 }
 const crc32=(bytes:Buffer)=>{
   let crc=0xffffffff;
   for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);
   return (crc^0xffffffff)>>>0;
 };
 for(let i=0;i<total;i++){
   if(p+46>binary.length||binary.readUInt32LE(p)!==0x02014b50)
     throw new Error("Invalid ZIP file directory entry");
   const flags=binary.readUInt16LE(p+8),method=binary.readUInt16LE(p+10);
   const checksum=binary.readUInt32LE(p+16),compressed=binary.readUInt32LE(p+20);
   const uncompressed=binary.readUInt32LE(p+24),nameLength=binary.readUInt16LE(p+28);
   const extra=binary.readUInt16LE(p+30),comment=binary.readUInt16LE(p+32);
   const localOffset=binary.readUInt32LE(p+42);
   if(p+46+nameLength+extra+comment>binary.length)
     throw new Error("Truncated ZIP directory entry");
   const filename=binary.subarray(p+46,p+46+nameLength).toString("utf8");
   p+=46+nameLength+extra+comment;
   const campaignId=filename.match(/(?:^|\/)(\d{4,20})\.csv$/i)?.[1];
   if(!campaignId||!expected.has(campaignId))continue;
   if(out.has(campaignId))throw new Error("Duplicate campaign in ZIP: "+campaignId);
   if(flags&1||![0,8].includes(method)||compressed>20*1024*1024||
      uncompressed>25*1024*1024||totalBytes+uncompressed>80*1024*1024)
      throw new Error("Unsafe or oversized ZIP campaign report");
   if(localOffset+30>binary.length||binary.readUInt32LE(localOffset)!==0x04034b50)
      throw new Error("Invalid local ZIP file header");
   const start=localOffset+30+binary.readUInt16LE(localOffset+26)+
     binary.readUInt16LE(localOffset+28);
   if(start+compressed>binary.length)throw new Error("Truncated ZIP CSV");
   const compressedData=binary.subarray(start,start+compressed);
   const data=method===8?inflateRawSync(compressedData):compressedData;
   if(data.length!==uncompressed||crc32(data)!==checksum)
      throw new Error("ZIP CRC or uncompressed length mismatch for "+campaignId);
   totalBytes+=data.length;out.set(campaignId,data.toString("utf8"));
 }
 if(out.size!==expectedCampaigns.length)
   throw new Error("ZIP missing "+(expectedCampaigns.length-out.size)+
     " campaign CSVs; refusing partial save");
 return out;
}
async function token():Promise<string>{
 const id=process.env.OZON_PERFORMANCE_CLIENT_ID;
 const secret=process.env.OZON_PERFORMANCE_CLIENT_SECRET;
 if(!id||!secret)throw new Error("Performance OAuth credentials missing");
 const r=await fetch(BASE+"/api/client/token",{method:"POST",cache:"no-store",
   headers:{"Content-Type":"application/json","Accept":"application/json"},
   body:JSON.stringify({client_id:id,client_secret:secret,
     grant_type:"client_credentials"}),signal:AbortSignal.timeout(18000)});
 if(!r.ok)throw new Error("Performance token: HTTP "+r.status);
 const payload=await r.json() as {access_token?:string};
 if(!payload.access_token)throw new Error("No token in Performance authorization");
 return payload.access_token;
}
async function api(tokenValue:string,path:string,init?:RequestInit):Promise<Response>{
 const r=await fetch(BASE+path,{...init,cache:"no-store",
  headers:{Authorization:"Bearer "+tokenValue,Accept:"application/json",...(init?.headers??{})},
  signal:AbortSignal.timeout(26000)});
 if(!r.ok){
  const body=(await r.text()).slice(0,200);
  throw new Error("Performance "+path.split("?")[0]+" HTTP "+r.status+": "+body);
 }
 return r;
}
function campaignIds(input:unknown):string[]{
 const ids=new Set<string>();
 function inspect(v:unknown,depth:number){
   if(depth>5||!v)return;
   if(Array.isArray(v)){for(const x of v.slice(0,10000))inspect(x,depth+1);return}
   if(typeof v!=="object")return;
   const o=v as Record<string,unknown>;
   const raw=o.campaignId??o.campaign_id??o.campaignID??
     (o.title!==undefined||o.name!==undefined||o.expense!==undefined?o.id:undefined);
   if((typeof raw==="number"||typeof raw==="string")&&/^\d{4,20}$/.test(String(raw)))
      ids.add(String(raw));
   for(const key of ["report","rows","list","data","items","campaigns","result","statistics"]){
     if(o[key]!==undefined)inspect(o[key],depth+1);
   }
 }
 inspect(input,0);
 return [...ids];
}
async function discoverCampaigns(auth:string,job:Job):Promise<string[]>{
 let fromExpense:string[]=[];
 // This lightweight, synchronous method does NOT request an async slot and
 // returns a daily campaign expense ledger. It is the primary discovery path.
 try {
  const endpoint="/api/client/statistics/expense/json?dateFrom="+
   encodeURIComponent(job.date_from)+"&dateTo="+encodeURIComponent(job.date_to);
  const r=await api(auth,endpoint);
  fromExpense=campaignIds(await r.json());
 }catch(error){
  console.warn("Ozon advertising expense discovery unavailable:",message(error).slice(0,180));
 }
 if(fromExpense.length)return fromExpense;
 const ids=new Set<string>();
 for(let page=1;page<=30;page++){
  const path="/api/client/campaign?page="+page+"&pageSize=100";
  const response=await api(auth,path);
  const data=await response.json() as {list?:unknown;campaigns?:unknown};
  const list=Array.isArray(data.list)?data.list:
    Array.isArray(data.campaigns)?data.campaigns:undefined;
  if(!list)throw new Error("Campaign list structure is unknown, cannot mark coverage complete");
  for(const raw of list){
    if(!raw||typeof raw!=="object")continue;
    const c=raw as Record<string,unknown>;
    const id=c.id;
    if(!/^\d{4,20}$/.test(String(id??"")))continue;
    if(typeof c.fromDate==="string" && c.fromDate>job.date_to)continue;
    if(typeof c.toDate==="string" && c.toDate<job.date_from)continue;
    const type=String(c.advObjectType??"");
    if(/MEDIA|BANNER|VIDEO/.test(type))continue;
    ids.add(String(id));
  }
  if(list.length<100)return [...ids];
 }
 throw new Error("Campaign list has more than 3000 entries; incomplete");
}
async function storeTasks(db:Db,job:Job,auth:string){
 const campaigns=await discoverCampaigns(auth,job);
 if(!campaigns.length)throw new Error("No campaigns detected: cannot publish zero advertising");
 if(campaigns.length>3000)throw new Error("Unexpected number of campaigns");
 const rows=campaigns.map(campaign_id=>({
  job_id:job.id,campaign_id,day:job.date_from,date_to:job.date_to,status:"pending"
 }));
 for(let i=0;i<rows.length;i+=200){
  const {error}=await db.from("ozon_finance_ad_campaign_tasks")
    .upsert(rows.slice(i,i+200),{onConflict:"job_id,campaign_id,day",ignoreDuplicates:true});
  if(error)throw new Error("Campaign queue: "+error.message);
 }
 return campaigns.length;
}
async function markTask(db:Db,id:number,change:Record<string,unknown>){
 const {error}=await db.from("ozon_finance_ad_campaign_tasks")
  .update({...change,updated_at:new Date().toISOString()}).eq("id",id);
 if(error)throw error;
}
async function splitTask(db:Db,task:Task){
 // Some Ozon account types return an aggregate CSV without a daily column,
 // even when groupBy=DATE. In that case rerun each day, never invent dates.
 if(task.day===task.date_to)throw new Error("Single-day report has no valid SKU/date");
 const single=task.day;
 const dates:string[]=[];
 for(let date=following(single);date<=task.date_to;date=following(date))dates.push(date);
 for(let i=0;i<dates.length;i+=100){
  const {error}=await db.from("ozon_finance_ad_campaign_tasks")
    .upsert(dates.slice(i,i+100).map(day=>({
      job_id:task.job_id,campaign_id:task.campaign_id,day,date_to:day,
      status:"pending",report_uuid:null
    })),{onConflict:"job_id,campaign_id,day",ignoreDuplicates:true});
  if(error)throw error;
 }
 await markTask(db,task.id,{date_to:single,status:"pending",report_uuid:null,last_error:null});
}
async function finishedJob(db:Db,job:Job):Promise<object>{
 const {data:ledger,error:ledgerError}=await db.rpc("ozon_finance_unallocated_v3",{
  p_from:job.date_from,p_to:job.date_to,p_account:"main"
 });
 if(ledgerError)throw ledgerError;
 const charged=(ledger??[]).filter((x:{type_id:string})=>x.type_id==="41")
   .reduce((sum:number,x:{amount:number|string})=>sum+Math.max(0,-Number(x.amount)),0);
 const {data:rows,error:rowsError}=await db.from("ozon_finance_ad_sku_daily")
  .select("expense_rub").eq("account_key","main")
  .gte("day",job.date_from).lte("day",job.date_to);
 if(rowsError)throw rowsError;
 const spend=(rows??[]).reduce((sum,x)=>sum+Number(x.expense_rub),0);
 if(charged>0&&spend===0)
   throw new Error("Seller has PPC expense but Performance reported zero SKU spend");
 const days=[];for(let day=job.date_from;day<=job.date_to;day=following(day))
   days.push({account_key:"main",day});
 const {error:coverageError}=await db.from("ozon_finance_ad_coverage")
   .upsert(days,{onConflict:"account_key,day"});
 if(coverageError)throw coverageError;
 const {error:updateError}=await db.from("ozon_finance_ad_sync_jobs")
  .update({status:"complete",last_error:null,updated_at:new Date().toISOString()})
  .eq("id",job.id);
 if(updateError)throw updateError;
 return {phase:"complete",days:days.length,sku_spend_rub:Math.round(spend*100)/100,
  seller_ppc_reference_rub:Math.round(charged*100)/100,
  note:"Performance is an allocation weight, Seller PPC is charged only once."};
}
export async function runHistoricalAdvertising(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get("authorization")!=="Bearer "+secret)
   return json({ok:false,error:"Unauthorized"},401);
 const db=createAdminClient(),now=new Date(),started=Date.now();
 const leaseUntil=new Date(started+180000).toISOString();
 const claim=await db.from("ozon_finance_ad_worker_control")
  .update({lease_until:leaseUntil,updated_at:now.toISOString()})
  .eq("account_key","main").lte("lease_until",now.toISOString())
  .lte("retry_after",now.toISOString()).select("account_key").maybeSingle();
 if(claim.error)return json({ok:false,error:claim.error.message},503);
 if(!claim.data)return json({ok:true,phase:"lease_or_cooldown",message:
   "Account-level Performance report is already running or rate-limited"});
 let phase="starting",failure:string|null=null,delay=0;
 try{
  const {data:job,error:jobError}=await db.from("ozon_finance_ad_sync_jobs")
   .select("id,date_from,date_to,status,last_error").eq("account_key","main")
   .in("status",["pending","running","failed"])
   .order("date_to",{ascending:false}).order("date_from",{ascending:true})
   .limit(1).maybeSingle();
  if(jobError)throw jobError;
  if(!job){phase="idle";return json({ok:true,phase})}
  const selected=job as Job;
  const covered=await db.from("ozon_finance_ad_coverage").select("day")
   .eq("account_key","main").gte("day",selected.date_from).lte("day",selected.date_to);
  if(covered.error)throw covered.error;
  const requiredDays=(Date.parse(selected.date_to)-Date.parse(selected.date_from))/86400000+1;
  if((covered.data?.length??0)>=requiredDays){
    await db.from("ozon_finance_ad_sync_jobs")
      .update({status:"complete",last_error:null,updated_at:new Date().toISOString()})
      .eq("id",selected.id);
    phase="already_cached";return json({ok:true,phase,period:selected.date_from+".."+selected.date_to});
  }
  const access=await token();
  const {count,error:countError}=await db.from("ozon_finance_ad_campaign_tasks")
   .select("id",{head:true,count:"exact"}).eq("job_id",selected.id);
  if(countError)throw countError;
  if(!count){
    const countCampaigns=await storeTasks(db,selected,access);
    await db.from("ozon_finance_ad_sync_jobs")
      .update({status:"running",last_error:null,updated_at:new Date().toISOString()})
      .eq("id",selected.id);
    phase="campaigns_queued";
    return json({ok:true,phase,campaigns:countCampaigns,
      reports:countCampaigns,period:selected.date_from+".."+selected.date_to});
  }
  // Only one UUID may be live for this account. Poll it before creating
  // another request, including after a Vercel function restart.
  const q=await db.from("ozon_finance_ad_campaign_tasks")
   .select("id,job_id,campaign_id,day,date_to,status,report_uuid,last_error")
   .eq("job_id",selected.id).in("status",["requested","pending"])
   .order("status",{ascending:false})
   .order("day",{ascending:true}).order("campaign_id",{ascending:true})
   .limit(1);
  if(q.error)throw q.error;
  if(!q.data?.length){
    phase="checking_coverage";return json({ok:true,...await finishedJob(db,selected)});
  }
  const task=q.data[0] as Task;
  if(task.status==="pending"){
    const created=await api(access,"/api/client/statistics",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({campaigns:[task.campaign_id],
        dateFrom:task.day,dateTo:task.date_to,groupBy:"DATE"})});
    const raw=await created.json() as {UUID?:string;uuid?:string};
    const uuid=String(raw.UUID??raw.uuid??"");
    if(!/^[A-Fa-f0-9-]{36}$/.test(uuid))throw new Error("Statistics returned no report UUID");
    await markTask(db,task.id,{status:"requested",report_uuid:uuid,last_error:null});
    phase="report_requested";delay=2*60*1000;
    return json({ok:true,phase,task_id:task.id,period:task.day+".."+task.date_to});
  }
  if(!task.report_uuid)throw new Error("Missing UUID for pending report");
  const ready=await api(access,"/api/client/statistics/"+encodeURIComponent(task.report_uuid));
  const report=await ready.json() as {state?:string;error?:string};
  if(report.state!=="OK"){
    if(report.state==="ERROR"||report.state==="FAILED")
      throw new Error("Campaign report failed: "+String(report.error??report.state).slice(0,170));
    if(!["IN_PROGRESS","PENDING","RUNNING","WAITING"].includes(String(report.state)))
      throw new Error("Unexpected campaign report state: "+String(report.state));
    phase="report_processing";delay=3*60*1000;
    return json({ok:true,phase,task_id:task.id,state:report.state});
  }
  const csvResponse=await api(access,"/api/client/statistics/report?UUID="+
   encodeURIComponent(task.report_uuid));
  const csv=await csvResponse.text();
  let parsed:Parsed[];
  try{
    parsed=parseHistoricCSV(csv,task.day,task.date_to);
  }catch(error){
    if(message(error).startsWith("CSV_NO_DAILY_DATE")&&task.day!==task.date_to){
      await splitTask(db,task);
      phase="split_into_daily_reports";
      return json({ok:true,phase,campaign_id:task.campaign_id,
        period:task.day+".."+task.date_to});
    }
    throw error;
  }
  const lines=parsed.map(x=>({account_key:"main",day:x.day,sku:x.sku,
    campaign_id:task.campaign_id,expense_rub:x.expense}));
  for(let i=0;i<lines.length;i+=200){
    const {error}=await db.from("ozon_finance_ad_sku_daily")
      .upsert(lines.slice(i,i+200),{onConflict:"account_key,day,sku,campaign_id"});
    if(error)throw new Error("Advertising SKU cache error: "+error.message);
  }
  await markTask(db,task.id,{status:"complete",rows_saved:lines.length,last_error:null});
  await db.from("ozon_finance_ad_sync_jobs")
    .update({status:"running",last_error:null,updated_at:new Date().toISOString()})
    .eq("id",selected.id);
  phase="report_saved";
  return json({ok:true,phase,task_id:task.id,sku_day_rows:lines.length,
    spend_rub:Math.round(lines.reduce((s,r)=>s+r.expense_rub,0)*100)/100});
 }catch(error){
  failure=message(error).slice(0,350);
  delay=/HTTP 429/.test(failure)?60*60*1000:15*60*1000;
  if(/HTTP 429/.test(failure))phase="ozon_global_quota";
  else phase="sync_error";
  console.warn("Ozon Performance finance worker",phase,failure);
  // Preserve pending tasks and UUID across failures. No parallel resend.
  return json({ok:false,phase,retry_minutes:delay/60000,error:failure},502);
 }finally{
  await db.from("ozon_finance_ad_worker_control").update({
    lease_until:new Date().toISOString(),
    retry_after:new Date(Date.now()+delay).toISOString(),
    last_phase:phase,last_error:failure,updated_at:new Date().toISOString()
  }).eq("account_key","main").eq("lease_until",leaseUntil);
 }
}
