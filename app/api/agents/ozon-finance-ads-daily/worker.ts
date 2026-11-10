import {createAdminClient} from '../../../../lib/supabase/admin';
import {getOzonCredentials} from '../../../../lib/integrations/secrets';

type SourceRow={sku?:string|number;campaignId?:string|number;date?:string;
 expense?:string|number;views?:string|number;clicks?:string|number;
 toCart?:string|number;orders?:string|number;sales?:string|number};
type StoredRow={account_key:string;day:string;sku:string;campaign_id:string;
 expense_rub:number;views:number|null;clicks:number|null;carts:number|null;
 orders:number|null;revenue_rub:number|null;metrics_version:number};
type Discovery={ids:string[];authoritative:boolean;note:string};
const money=(v:unknown):number|null=>{
 if(v===null||v===undefined||v==='')return null;
 const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null;
};
const integer=(v:unknown)=>{const x=money(v);return x===null?null:Math.round(x)};
const dayShift=(day:string,delta:number)=>new Date(Date.parse(day+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10);
const isId=(s:string)=>/^\d{4,24}$/.test(s);
const MAX_QUERIES=65;

/** Extract campaign IDs from the Ozon campaign/product JSON report, without
 * making up IDs or mistaking ordinary SKU and product IDs for campaign IDs.
 */
export function campaignIdsFromReport(data:unknown):string[]{
 const ids=new Set<string>();
 function walk(node:unknown,depth=0){
  if(depth>8||!node)return;
  if(Array.isArray(node)){for(const item of node.slice(0,1500))walk(item,depth+1);return;}
  if(typeof node!=='object')return;
  const object=node as Record<string,unknown>;
  const mode=String(object.advObjectType??object.objectType??'').toUpperCase();
  const payment=String(object.paymentType??'').toUpperCase();
  const state=String(object.state??object.campaignState??'').toUpperCase();
  if(mode&&mode!=='SKU')return;
  if(payment&&payment!=='CPC')return;
  if(state.includes('ARCHIVED'))return;
  const candidate=object.campaignId??object.campaign_id??object.campaignID;
  // Some campaign-list responses use id instead of campaignId.
  const derived=candidate??(object.title!==undefined||object.campaignName!==undefined?object.id:undefined);
  if((typeof derived==='string'||typeof derived==='number')&&isId(String(derived)))ids.add(String(derived));
  for(const key of ['list','rows','result','data','report','campaigns','items','statistics','content']){
   if(object[key]!==undefined)walk(object[key],depth+1);
  }
 }
 walk(data);return [...ids];
}
async function knownCampaignIds(db:ReturnType<typeof createAdminClient>):Promise<string[]>{
 const ids=new Set<string>();
 const recent=await db.from('ozon_finance_ad_campaign_tasks').select('campaign_id')
  .gte('day','2026-10-01').order('day',{ascending:false}).limit(2500);
 if(recent.error)throw recent.error;
 for(const row of recent.data??[])if(isId(String(row.campaign_id)))ids.add(String(row.campaign_id));
 const earlier=await db.from('ozon_finance_ad_sku_daily').select('campaign_id')
  .gte('day','2026-10-01').order('day',{ascending:false}).limit(1500);
 if(earlier.error)throw earlier.error;
 for(const row of earlier.data??[])if(isId(String(row.campaign_id)))ids.add(String(row.campaign_id));
 return [...ids];
}
async function discoverCampaigns(db:ReturnType<typeof createAdminClient>,access:string,day:string):Promise<Discovery>{
 // This method does not consume Ozon Performance's asynchronous report quota,
 // unlike GET /api/client/campaign, which has recently returned HTTP 429.
 const url='https://api-performance.ozon.ru/api/client/statistics/campaign/product/json?dateFrom='+
  encodeURIComponent(day)+'&dateTo='+encodeURIComponent(day);
 try{
  const res=await fetch(url,{cache:'no-store',headers:{Authorization:'Bearer '+access,Accept:'application/json'},
   signal:AbortSignal.timeout(22000)});
  if(!res.ok)throw Error('campaign/product HTTP '+res.status+' '+(await res.text()).slice(0,130));
  const raw=await res.json() as unknown;
  const ids=campaignIdsFromReport(raw);
  if(ids.length)return {ids,authoritative:true,note:'Статистика кампаний Ozon за '+day};
  const backup=await knownCampaignIds(db);
  return {ids:backup,authoritative:false,note:'Отчёт кампаний не вернул ID; используем исторический список ('+backup.length+')'};
 }catch(e){
  const backup=await knownCampaignIds(db);
  return {ids:backup,authoritative:false,note:'Не удалось получить актуальные ID: '+
   (e instanceof Error?e.message:'неизвестно')+'; исторических: '+backup.length};
 }
}
function normalize(entry:SourceRow,day:string):StoredRow{
 if(!entry||typeof entry!=='object')throw Error('Ozon CPC: некорректная строка');
 const sku=String(entry.sku??''),campaign=String(entry.campaignId??''),date=String(entry.date??'').slice(0,10);
 if(!isId(sku)||!isId(campaign)||date!==day)throw Error('Ozon CPC: некорректный SKU/кампания/дата');
 const cost=money(entry.expense);
 if(cost===null||cost<0)throw Error('Ozon CPC: в строке отсутствует подтверждённый расход');
 return {account_key:'main',day,sku,campaign_id:campaign,
  expense_rub:cost,views:integer(entry.views),clicks:integer(entry.clicks),
  carts:integer(entry.toCart),orders:integer(entry.orders),
  revenue_rub:money(entry.sales),metrics_version:2};
}
/** Daily CPC is a weight for distributing ledger advertising charges, never
 * an extra profit-and-loss debit. Dates earlier than yesterday require the
 * independent historical-CSV import.
 */
export async function runDailySkuAdvertising(requestedDay?:string){
 const db=createAdminClient();
 const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const yesterday=dayShift(today,-1);
 const day=requestedDay??yesterday,start=Date.now();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||
  new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day||
  day>yesterday||day<dayShift(today,-31))
  return {ok:false,day,error:'Ozon CPC: дата должна быть в пределах последних 31 суток до вчера',rows_saved:0};
 const log=async(status:'complete'|'empty'|'failed',n:number,expense:number,error?:string)=>{
  const q=await db.from('ozon_finance_ad_sku_sync_status').upsert({
   account_key:'main',day,source:'cpc_sku_current',status,rows_saved:n,
   expense_rub:Math.round(expense*100)/100,last_error:error??null,checked_at:new Date().toISOString()
  },{onConflict:'account_key,day,source'});
  if(q.error)throw Error('Ozon CPC audit: '+q.error.message);
 };
 let saved=0,cost=0;
 try{
  const {performanceClientId:id,performanceClientSecret:secret}=await getOzonCredentials();
  if(!id||!secret)throw Error('Не заданы Performance Client ID/Secret');
  const auth=await fetch('https://api-performance.ozon.ru/api/client/token',{
   method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({client_id:id,client_secret:secret,grant_type:'client_credentials'}),
   signal:AbortSignal.timeout(20000)});
  if(!auth.ok)throw Error('Ozon Performance auth HTTP '+auth.status);
  const access=(await auth.json() as {access_token?:string}).access_token;
  if(!access)throw Error('Ozon Performance: access_token отсутствует');
  const discovery=await discoverCampaigns(db,access,day);
  if(!discovery.ids.length)throw Error('Ozon CPC: не удалось определить ни одной кампании. '+discovery.note);
  const rows=new Map<string,StoredRow>(),invalidIds=new Set<string>();
  let requests=0,exhausted=false;
  const fetchBatch=async(batch:string[]):Promise<void>=>{
   if(!batch.length)return;
   if(requests>=MAX_QUERIES||Date.now()-start>165000){
    exhausted=true;throw Error('Лимит времени/запросов Ozon CPC, осталось кампаний: '+batch.length);
   }
   requests++;
   const result=await fetch('https://api-performance.ozon.ru/api/client/statistics/products/sku',{
    method:'POST',cache:'no-store',
    headers:{Authorization:'Bearer '+access,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({dateFrom:day,dateTo:day,campaignIds:batch}),signal:AbortSignal.timeout(26000)});
   if(!result.ok){
    const raw=(await result.text()).slice(0,230);
    // A batch may contain campaigns of a different advertising type.
    // Isolate rejected IDs without ever treating them as zero spending.
    if(result.status===400&&/empty campaigns/i.test(raw)){
     if(batch.length===1){invalidIds.add(batch[0]);return}
     const mid=Math.floor(batch.length/2);
     await fetchBatch(batch.slice(0,mid));await fetchBatch(batch.slice(mid));return;
    }
    throw Error('Ozon CPC HTTP '+result.status+' '+raw);
   }
   const parsed=await result.json() as {rows?:unknown};
   if(!Array.isArray(parsed.rows))throw Error('Ozon CPC: нет массива rows в ответе');
   for(const raw of parsed.rows){
    const line=normalize(raw as SourceRow,day),key=line.campaign_id+'|'+line.sku;
    // Different batches never overwrite each other; duplicate identical lines
    // are a provider fault, not permission to double count advertising.
    if(rows.has(key))throw Error('Ozon CPC: дублируются кампания и SKU '+key);
    rows.set(key,line);
   }
  };
  // Explicit campaignIds is REQUIRED in practice: Ozon responds
  // with HTTP 400 "empty campaigns" if omitted.
  const batchErrors:string[]=[];
  for(let i=0;i<discovery.ids.length;i+=30){
   try{await fetchBatch(discovery.ids.slice(i,i+30));}
   catch(e){
    const m=e instanceof Error?e.message:'Ошибка рекламного пакета';
    batchErrors.push(m);
    // Throttling or a time limit must not discard the successful batches.
    if(/HTTP 429|HTTP 503|Лимит времени|timeout/i.test(m))break;
   }
  }
  for(const part of Array.from(rows.values()).reduce<StoredRow[][]>((out,row,i)=>{
   if(i%150===0)out.push([]);out[out.length-1].push(row);return out;
  },[])){
   const insert=await db.from('ozon_finance_ad_sku_daily').upsert(part,{
    onConflict:'account_key,day,sku,campaign_id'
   });
   if(insert.error)throw Error('Ozon CPC: запись в Supabase: '+insert.error.message);
  }
  saved=rows.size;cost=[...rows.values()].reduce((v,row)=>v+row.expense_rub,0);
  const partial=!discovery.authoritative||invalidIds.size>0||exhausted||batchErrors.length>0;
  const reason=partial?discovery.note+(invalidIds.size?'; Ozon отклонил кампаний: '+invalidIds.size:'')+(batchErrors.length?'; ошибки: '+batchErrors.slice(0,2).join(' / '):''):'';
  await log(partial?'failed':saved?'complete':'empty',saved,cost,reason||undefined);
  return {ok:!partial,day,rows_saved:saved,expense_rub:Math.round(cost*100)/100,
   campaign_ids:discovery.ids.length,rejected_campaign_ids:invalidIds.size,
   state:partial?'partial':saved?'complete':'empty',source:discovery.note,
   ...(partial?{error:'Данные неполные: '+reason}:{})};
 }catch(error){
  const message=error instanceof Error?error.message:'Неизвестная ошибка Ozon CPC';
  // We may have inserted data during an earlier successful attempt. Never
  // delete the prior day or label an error as zero advertising.
  await log('failed',saved,cost,message.slice(0,250));
  return {ok:false,day,error:message.slice(0,300),rows_saved:saved};
 }
}
