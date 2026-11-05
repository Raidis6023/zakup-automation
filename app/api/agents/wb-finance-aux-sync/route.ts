import { getIntegrationSecret } from "@/lib/integrations/secrets";
import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createAdminClient} from '../../../../lib/supabase/admin';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=180;

type Json=Record<string,unknown>;
const date=(value:Date)=>value.toISOString().slice(0,10);
const shift=(day:string,offset:number)=>date(new Date(Date.parse(day+'T00:00:00Z')+offset*86400000));
const num=(value:unknown)=>{const n=Number(value??0);return Number.isFinite(n)?n:0;};
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const days=(from:string,to:string)=>Array.from({length:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1},(_,i)=>shift(from,i));
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});

async function adminAccess(){
 const session=await createClient();const {data:{user}}=await session.auth.getUser();
 if(!user)throw Error('Требуется авторизация');
 const db=createAdminClient();const {data,error}=await db.from('app_user_access').select('admin_level,is_blocked').eq('user_id',user.id).maybeSingle();
 if(error||!data||data.is_blocked||!['admin','senior_admin'].includes(data.admin_level??''))throw Error('Недостаточно прав для финансовой аналитики');
}

async function request(url:string,token:string,init?:RequestInit){
 const response=await fetch(url,{...init,cache:'no-store',headers:{Authorization:token,...(init?.headers??{})},signal:AbortSignal.timeout(45000)});
 if(response.status===204)return null;
 const text=await response.text();let body:unknown=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,500)};}
 if(!response.ok)throw Error('WB HTTP '+response.status+' ('+new URL(url).pathname+'): '+text.slice(0,260));
 return body;
}

async function upsertBatches(table:string,rows:Json[],onConflict:string){
 const db=createAdminClient();for(let i=0;i<rows.length;i+=300){const {error}=await db.from(table).upsert(rows.slice(i,i+300),{onConflict});if(error)throw error;}
}

async function syncOrders(from:string,to:string){
 const token=((await getIntegrationSecret("wb_read_token"))||process.env.WB_TEST_TOKEN||'').trim();if(!token)throw Error('Не найден WB_READ_TOKEN');
 const url=new URL('https://statistics-api.wildberries.ru/api/v1/supplier/orders');url.searchParams.set('dateFrom',from+'T00:00:00');url.searchParams.set('flag','0');
 const body=await request(url.toString(),token);if(!Array.isArray(body))throw Error('WB orders: неожиданный формат ответа');
 const selected=(body as Json[]).filter(row=>{const d=String(row.date??row.orderDate??'').slice(0,10);return d>=from&&d<=to&&row.srid;});
 const rows=selected.map(row=>({srid:String(row.srid),order_date:String(row.date??row.orderDate),last_change_date:String(row.lastChangeDate??row.date??row.orderDate),nm_id:num(row.nmId),supplier_article:String(row.supplierArticle??''),barcode:String(row.barcode??''),warehouse_name:String(row.warehouseName??''),warehouse_type:String(row.warehouseType??''),is_cancel:Boolean(row.isCancel),cancel_date:row.cancelDate?String(row.cancelDate):null,income_id:num(row.incomeID),raw:row,synced_at:new Date().toISOString()}));
 await upsertBatches('wb_orders',rows,'srid');
 return {ok:true,rows:rows.length,received:body.length,complete:body.length<80000,warning:body.length>=80000?'Достигнут условный лимит 80 000 строк заказов':null};
}


async function syncAds(from:string,to:string,deadline:number){
 const db=createAdminClient(),token=((await getIntegrationSecret("wb_promotion_token"))||'').trim(),key='wb_ad_fullstats_progress';
 const save=async(stage:string,info:Json,http:number|null=null)=>{
  const q=await db.from('wb_sync_state').upsert({sync_key:key,stage,last_message:JSON.stringify(info),last_http_status:http,updated_at:new Date().toISOString()},{onConflict:'sync_key'});if(q.error)throw q.error;};
 if(!token){await save('failed',{error:'Не найден WB_PROMOTION_TOKEN'});return {ok:false,error:'Не найден WB_PROMOTION_TOKEN'};}
 try{
  const listing=await request('https://advert-api.wildberries.ru/adv/v1/promotion/count',token) as {adverts?:Array<{status:number;advert_list?:Array<{advertId:number}>}>}|null;
  const groups=listing?.adverts??[],allIds=[...new Set(groups.flatMap(g=>(g.advert_list??[]).map(x=>Number(x.advertId))).filter(Boolean))];
  const ids=[...new Set(groups.filter(g=>[7,9,11].includes(Number(g.status))).flatMap(g=>(g.advert_list??[]).map(x=>Number(x.advertId))).filter(Boolean))].sort((a,b)=>a-b);
  if(!ids.length){await save('no_eligible',{from,to,campaigns_all:allIds.length,error:'Нет кампаний в статусах 7/9/11'});return {ok:false,error:'Нет доступных для fullstats кампаний со статусом 7/9/11',campaigns_all:allIds.length};}
  const current=await db.from('wb_sync_state').select('stage,last_message').eq('sync_key',key).maybeSingle();if(current.error)throw current.error;
  let previous:{from?:string;to?:string;ids?:number[];next?:number}={};
  try{previous=JSON.parse(current.data?.last_message??'{}');}catch{}
  const continuing=previous.from===from&&previous.to===to&&JSON.stringify(previous.ids)===JSON.stringify(ids)&&current.data?.stage==='partial';
  let next=continuing?Math.max(0,Math.min(ids.length,Number(previous.next)||0)):0;
  let pages=0,recordsSaved=0;
  for(;next<ids.length;){
   if(Date.now()>deadline-53000)break;
   if(pages)await sleep(21000);
   if(Date.now()>deadline-47000)break;
   const batch=ids.slice(next,next+50),url=new URL('https://advert-api.wildberries.ru/adv/v3/fullstats');
   url.searchParams.set('ids',batch.join(','));url.searchParams.set('beginDate',from);url.searchParams.set('endDate',to);
   const response=await request(url.toString(),token);
   if(!Array.isArray(response))throw Error('fullstats: ответ не является массивом');
   const grouped=new Map<string,{snapshot_day:string;campaign_id:number;nm_id:number;spend:number;views:number;clicks:number;orders:number;sum_price:number;payload:Json;captured_at:string}>();
   for(const campaign of response as Json[]){
    const campaign_id=num(campaign.advertId);
    for(const day of Array.isArray(campaign.days)?campaign.days as Json[]:[]){
     const d=String(day.date??'').slice(0,10);if(d<from||d>to)continue;
     for(const app of Array.isArray(day.apps)?day.apps as Json[]:[])
      for(const item of Array.isArray(app.nms)?app.nms as Json[]:[]){
       const nm_id=num(item.nmId);if(!nm_id)continue;
       const k=d+'|'+campaign_id+'|'+nm_id,p=grouped.get(k);
       grouped.set(k,{snapshot_day:d,campaign_id,nm_id,
        spend:(p?.spend??0)+num(item.sum),views:(p?.views??0)+num(item.views),
        clicks:(p?.clicks??0)+num(item.clicks),orders:(p?.orders??0)+num(item.orders),
        sum_price:(p?.sum_price??0)+num(item.sum_price),
        payload:{atbs:num(p?.payload.atbs)+num(item.atbs),shks:num(p?.payload.shks)+num(item.shks),source:'fullstats'},
        captured_at:new Date().toISOString()});
      }
    }
   }
   // Persist each successful batch; retries only replace the same campaign IDs.
   const deleted=await db.from('wb_finance_ad_daily').delete().gte('snapshot_day',from).lte('snapshot_day',to).in('campaign_id',batch);
   if(deleted.error)throw deleted.error;
   await upsertBatches('wb_finance_ad_daily',[...grouped.values()],'snapshot_day,campaign_id,nm_id');
   next+=batch.length;pages++;recordsSaved+=grouped.size;
   await save('partial',{from,to,ids,next,campaigns_all:allIds.length,rows_saved:recordsSaved});
  }
  if(next<ids.length)return {ok:true,status:'partial',processed:next,total:ids.length,rows_saved:recordsSaved,warning:'Продолжите загрузку рекламы той же кнопкой'};
  const counter=new Map<string,number>();
  for(let offset=0;;offset+=1000){
   const r=await db.from('wb_finance_ad_daily').select('snapshot_day').gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day').range(offset,offset+999);
   if(r.error)throw r.error;for(const v of r.data??[])counter.set(v.snapshot_day,(counter.get(v.snapshot_day)??0)+1);
   if((r.data?.length??0)<1000)break;
  }
  await upsertBatches('wb_finance_ad_snapshots',days(from,to).map(snapshot_day=>({snapshot_day,row_count:counter.get(snapshot_day)??0,captured_at:new Date().toISOString()})),'snapshot_day');
  await save('complete',{from,to,ids,next,campaigns_all:allIds.length,rows_saved:recordsSaved});
  return {ok:true,status:'complete',campaigns:ids.length,records_saved:recordsSaved,coverage:from+' — '+to};
 }catch(e){
  const error=e instanceof Error?e.message:String(e),r=await db.from('wb_sync_state').select('last_message').eq('sync_key',key).maybeSingle();
  let state:Json={from,to};try{state=JSON.parse(r.data?.last_message??'{}')}catch{}
  await save('partial',{...state,last_error:error,failed_at:new Date().toISOString()},error.includes('429')?429:null);
  return {ok:false,error,progress:state};
 }
}
const storageDay=(row:Json)=>String(row.date??row.dt??row.originalDate??'').slice(0,10);
async function saveStorage(localId:string,from:string,to:string,remoteId:string,body:unknown){
 const list=Array.isArray(body)?body:Array.isArray((body as {data?:unknown})?.data)?(body as {data:Json[]}).data:[];
 const now=new Date().toISOString(),records=(list as Json[]).filter(row=>storageDay(row)>=from&&storageDay(row)<=to).map((row,index)=>{const raw=JSON.stringify(row),day=storageDay(row);return {snapshot_day:day,row_key:createHash('sha1').update(raw+'|'+index).digest('hex'),nm_id:num(row.nmId)||null,article:String(row.vendorCode??row.supplierArticle??''),warehouse:String(row.warehouse??row.warehouseName??''),amount:num(row.warehousePrice??row.storageFee??row.amount??row.calcAmount),payload:row,captured_at:now};});
 const db=createAdminClient();const deleted=await db.from('wb_finance_storage_daily').delete().gte('snapshot_day',from).lte('snapshot_day',to);if(deleted.error)throw deleted.error;
 await upsertBatches('wb_finance_storage_daily',records,'snapshot_day,row_key');
 const byDay=new Map<string,number>();for(const row of records)byDay.set(row.snapshot_day,(byDay.get(row.snapshot_day)??0)+1);
 await upsertBatches('wb_finance_storage_snapshots',days(from,to).map(snapshot_day=>({snapshot_day,source_task_id:localId,row_count:byDay.get(snapshot_day)??0,captured_at:now})),'snapshot_day');
 const done=await db.from('wb_finance_storage_tasks').update({status:'complete',completed_at:now,updated_at:now,retry_at:null,last_error:null}).eq('id',localId);if(done.error)throw done.error;
 return {ok:true,from,to,rows:records.length,remote_task_id:remoteId};
}

async function syncStorage(from:string,to:string,deadline:number){
 const token=(process.env.WB_READ_TOKEN||process.env.WB_TEST_TOKEN||'').trim();if(!token)throw Error('Не найден WB_READ_TOKEN');const db=createAdminClient();
 let {data:task,error}=await db.from('wb_finance_storage_tasks').select('*').in('status',['pending','generating']).order('created_at').limit(1).maybeSingle();if(error)throw error;
 if(!task){
  const covered=await db.from('wb_finance_storage_snapshots').select('snapshot_day').gte('snapshot_day',from).lte('snapshot_day',to);if(covered.error)throw covered.error;const set=new Set((covered.data??[]).map(x=>x.snapshot_day)),missing=days(from,to).filter(d=>!set.has(d));
  const dateFrom=missing[0]??shift(to,-6),dateTo=missing.length?missing.slice(0,8).at(-1)!:to;
  const created=await db.from('wb_finance_storage_tasks').upsert({date_from:dateFrom,date_to:dateTo,status:'pending',remote_task_id:null,retry_at:null,last_error:null,updated_at:new Date().toISOString()},{onConflict:'date_from,date_to'}).select('*').single();if(created.error)throw created.error;task=created.data;
 }
 let remote=task.remote_task_id as string|null;
 if(!remote){const url=new URL('https://seller-analytics-api.wildberries.ru/api/v1/paid_storage');url.searchParams.set('dateFrom',task.date_from);url.searchParams.set('dateTo',task.date_to);const created=await request(url.toString(),token) as Json|null;remote=String((created?.data as Json|undefined)?.taskId??created?.taskId??'');if(!remote)throw Error('WB storage: taskId отсутствует в ответе');const saved=await db.from('wb_finance_storage_tasks').update({remote_task_id:remote,status:'generating',updated_at:new Date().toISOString()}).eq('id',task.id);if(saved.error)throw saved.error;}
 while(Date.now()<deadline-47000){const status=await request('https://seller-analytics-api.wildberries.ru/api/v1/paid_storage/tasks/'+encodeURIComponent(remote)+'/status',token) as Json|null;const value=String((status?.data as Json|undefined)?.status??status?.status??'').toLowerCase();if(['done','completed','ready','success'].includes(value)){const downloaded=await request('https://seller-analytics-api.wildberries.ru/api/v1/paid_storage/tasks/'+encodeURIComponent(remote)+'/download',token);return saveStorage(task.id,task.date_from,task.date_to,remote,downloaded);}await sleep(5500);}
 await db.from('wb_finance_storage_tasks').update({status:'generating',retry_at:new Date(Date.now()+60000).toISOString(),updated_at:new Date().toISOString()}).eq('id',task.id);
 return {ok:true,status:'generating',from:task.date_from,to:task.date_to,remote_task_id:remote};
}

export async function runAuxiliarySync(scope:'all'|'ads'='all'){
 const today=date(new Date(Date.now()+7*3600000)),to=shift(today,-1),from=shift(to,-27),deadline=Date.now()+155000;
 if(scope==='ads'){const advertising=await syncAds(from,to,deadline);return {ok:advertising.ok,from,to,advertising};}
 const orders=await Promise.resolve().then(()=>syncOrders(from,to)).catch(e=>({ok:false,error:e instanceof Error?e.message:String(e)}));
 const [advertising,storage]=await Promise.all([
  Promise.resolve().then(()=>syncAds(from,to,deadline)).catch(e=>({ok:false,error:e instanceof Error?e.message:String(e)})),
  Promise.resolve().then(()=>syncStorage(from,to,deadline)).catch(e=>({ok:false,error:e instanceof Error?e.message:String(e)}))
 ]);
 return {ok:Boolean(orders.ok||advertising.ok||storage.ok),from,to,orders,advertising,storage};
}

export async function GET(req:NextRequest){if(!process.env.CRON_SECRET||req.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return json({ok:false,error:'Unauthorized'},401);const result=await runAuxiliarySync();return json(result,result.ok?200:503);}
export async function POST(req:NextRequest){try{await adminAccess();const scope=req.nextUrl.searchParams.get('scope')==='ads'?'ads':'all';const result=await runAuxiliarySync(scope);return json(result,result.ok?200:503);}catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},403);}}
