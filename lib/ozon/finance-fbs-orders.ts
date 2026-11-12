import {getOzonCredentials} from '../integrations/secrets';
import {createAdminClient} from '../supabase/admin';

/** Sanitized shipment snapshots only. Buyer addresses and phone numbers are
 * never persisted. This is the provider's order-date ledger, not Seller P&L. */
export type FbsOrderUnit={
 posting_number:string;order_day:string;sku:string;article:string;
 quantity:number;status:string;cancelled:boolean;shipped:boolean;packing_units:number;
};
type FbsProduct={sku?:string|number;offer_id?:string;quantity?:number};
type FbsPosting={
 posting_number?:string;in_process_at?:string;created_at?:string;
 status?:string;delivering_date?:string|null;
 products?:FbsProduct[];
};
const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
export function fbsPackingUnits(statusValue:string,quantity:number,deliveringDate?:string|null):number{
 const status=statusValue.toLowerCase(),qty=Math.max(0,Math.floor(quantity));
 if(!qty)return 0;
 // A cancelled order that never left the warehouse must not be charged.
 if(status==='cancelled'||status==='canceled')return deliveringDate?qty:0;
 if(['awaiting_registration','unpaid'].includes(status))return 0;
 return qty;
}
const localDay=(value:string):string=>{
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))throw Error('Некорректная дата FBS отправления Ozon');
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Krasnoyarsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
};
function sanitize(posting:FbsPosting,from:string,to:string):FbsOrderUnit[]{
 const num=String(posting.posting_number??'').trim();
 const status=String(posting.status??'').trim().toLowerCase();
 const created=posting.in_process_at??posting.created_at;
 if(!num||!status||!created)throw Error('Ozon прислал отправление FBS без номера, даты или статуса');
 const day=localDay(created);if(day<from||day>to)return [];
 if(!Array.isArray(posting.products))throw Error('Ozon не передал состав FBS отправления '+num);
 const cancelled=status==='cancelled'||status==='canceled';
 const shipped=!!posting.delivering_date||['delivering','delivered','driver_pickup','sent_by_seller','not_accepted','returning_to_seller'].includes(status);
 return posting.products.filter(p=>Number(p.quantity)>0).map(p=>({
  posting_number:num,order_day:day,sku:String(p.sku??''),article:String(p.offer_id??''),
  quantity:Math.floor(Number(p.quantity)),status,cancelled,shipped,
  packing_units:fbsPackingUnits(status,Number(p.quantity),posting.delivering_date)
 })).filter(p=>!!p.sku||!!p.article);
}
export async function readOzonFbsOrders(from:string,to:string):Promise<FbsOrderUnit[]>{
 if(!valid(from)||!valid(to)||from>to||Date.parse(to)-Date.parse(from)>90*86400000)
  throw Error('Выберите период заказов FBS не длиннее 91 дня');
 const db=createAdminClient();
 const {data:cached,error:cacheError}=await db.from('ozon_finance_fbs_order_cache')
  .select('synced_at,rows').eq('account_key','main').eq('date_from',from).eq('date_to',to).maybeSingle();
 if(cacheError)throw cacheError;
 if(cached&&Date.now()-Date.parse(cached.synced_at)<10*60*1000)
  return cached.rows as FbsOrderUnit[];
 const {sellerClientId:client,sellerApiKey:key}=await getOzonCredentials();
 if(!client||!key)throw Error('Не настроены ключи Seller Ozon для заказов FBS');
 const all:FbsOrderUnit[]=[],seen=new Set<string>();let cursor='';
 for(let page=0;page<150;page++){
  const response=await fetch('https://api-seller.ozon.ru/v4/posting/fbs/list',{
   method:'POST',cache:'no-store',headers:{
    'Client-Id':client,'Api-Key':key,'Content-Type':'application/json'
   },
   body:JSON.stringify({
    cursor,limit:100,sort_dir:'ASC',filter:{
     since:from+'T00:00:00+07:00',to:to+'T23:59:59+07:00'
    },with:{analytics_data:false,financial_data:false}
   }),signal:AbortSignal.timeout(22000)
  });
  if(!response.ok){
   const snippet=(await response.text()).slice(0,180);
   throw Error('Ozon FBS v4 HTTP '+response.status+': '+snippet);
  }
  const data=await response.json() as {postings?:FbsPosting[];has_next?:boolean;cursor?:string;result?:{postings?:FbsPosting[];has_next?:boolean;cursor?:string}};
  const packet=Array.isArray(data.postings)?data:data.result;
  if(!packet||!Array.isArray(packet.postings))throw Error('Ozon FBS v4 вернул неизвестную структуру, заказы не подтверждены');
  for(const posting of packet.postings){
   for(const unit of sanitize(posting,from,to)){
    const id=unit.posting_number+'|'+unit.sku+'|'+unit.article;
    if(seen.has(id))continue;seen.add(id);all.push(unit);
   }
  }
  if(!packet.has_next){
   const saved=await db.from('ozon_finance_fbs_order_cache').upsert({
    account_key:'main',date_from:from,date_to:to,
    rows:all,synced_at:new Date().toISOString()
   },{onConflict:'account_key,date_from,date_to'});
   if(saved.error)throw saved.error;
   return all;
  }
  const next=String(packet.cursor??'');
  if(!next||cursor===next)throw Error('Ozon FBS v4 не передал следующий курсор; неполная выборка не опубликована');
  cursor=next;
 }
 throw Error('FBS за период содержит более 150 страниц. Выберите меньший период; неполные заказы не опубликованы');
}
