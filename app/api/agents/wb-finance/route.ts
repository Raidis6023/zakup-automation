import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type FinanceLine = Record<string, unknown>;
type AdItem = { nm_id: number; date: string; campaign_id: number; spend: number; views: number; clicks: number; orders: number; sum_price: number; atbs:number };
const num = (v: unknown): number => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };
const dateOK = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+"T00:00:00Z")) && new Date(v+"T00:00:00Z").toISOString().slice(0,10) === v;
const round = (v: number) => Math.round((v+Number.EPSILON)*100)/100;

async function access() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) throw new Error("Требуется авторизация");
  const db = createAdminClient();
  const { data, error } = await db.from("app_user_access").select("admin_level,is_blocked").eq("user_id",user.id).maybeSingle();
  if (error || !data || data.is_blocked || !["admin","senior_admin"].includes(data.admin_level ?? "")) throw new Error("Недостаточно прав для финансовой аналитики");
}

async function wb(url: string, token: string) {
  const r=await fetch(url,{headers:{Authorization:token},cache:"no-store",signal:AbortSignal.timeout(50000)});
  if (r.status===204) return null;
  if (!r.ok) throw new Error("WB HTTP "+r.status+" ("+new URL(url).pathname+"): "+(await r.text()).slice(0,180));
  return await r.json() as unknown;
}

async function readPages<T>(load:(from:number,to:number)=>Promise<{data:T[]|null;error:unknown}>){
 const rows:T[]=[];for(let offset=0;;offset+=1000){const {data,error}=await load(offset,offset+999);if(error)throw error;rows.push(...(data??[]));if((data?.length??0)<1000)break;}return rows;
}

type Rate={nm_id:string;valid_from:string;cost_cents:number|null;mayak_cents:number|null;version:number};
function groupFinancial(lines:FinanceLine[],rates:Rate[]=[],sharedRates:Map<string,Rate[]>=new Map()) {
 const rateMap=new Map<string,Rate[]>();for(const r of rates){const a=rateMap.get(r.nm_id)??[];a.push(r);rateMap.set(r.nm_id,a);}for(const a of rateMap.values())a.sort((x,y)=>y.valid_from.localeCompare(x.valid_from));
  const byId=new Map<string,{nm_id:string;article:string;name:string;realization:number;gross_retail:number;to_transfer:number;delivery:number;storage_in_report:number|null;acceptance:number;penalty:number;deduction:number;rows:number;sales_units:number;return_units:number;net_transfer:number;cogs_estimate:number;mayak_estimate:number;cost_missing:boolean;mayak_missing:boolean;cost_rub:number|null;mayak_rub:number|null;operations:Record<string,{amount:number;count:number;realization:number;delivery:number;storage:number;penalty:number;deduction:number}>}>();
  for(const l of lines){
    const id=String(l.nmId ?? "0"), article=String(l.vendorCode ?? ""), name=String(l.title ?? l.subjectName ?? "");
    const key=id!=="0" ? id : "unallocated";
    let x=byId.get(key);
    if(!x){x={nm_id:key,article,name,realization:0,gross_retail:0,to_transfer:0,delivery:0,storage_in_report:null,acceptance:0,penalty:0,deduction:0,rows:0,sales_units:0,return_units:0,net_transfer:0,cogs_estimate:0,mayak_estimate:0,cost_missing:false,mayak_missing:false,cost_rub:null,mayak_rub:null,operations:{}};byId.set(key,x);}
    x.rows++;
    const op=String(l.sellerOperName ?? l.docTypeName ?? "Неизвестная операция");
    const transfer=num(l.forPay),sale=num(l.retailAmount),delivery=num(l.deliveryAmount);
    const doc=String(l.docTypeName??'').toLowerCase(),opName=op.toLowerCase();
    const sold=doc==='продажа'&&opName==='продажа',returned=doc==='возврат'&&opName==='возврат';
    // WB realization is the final buyer price. Return operations are negative,
    // regardless of the positive source absolute amounts.
    const sign=sold?1:returned?-1:0;
    x.realization+=sign*Math.abs(sale);
    x.gross_retail+=sign*Math.abs(num(l.retailPrice));
    x.to_transfer+=returned?-Math.abs(transfer):transfer;
    x.delivery+=delivery;
    const quantity=Math.max(0,num(l.quantity));
    if(sold)x.sales_units+=quantity;if(returned)x.return_units+=quantity;
    x.net_transfer+=returned?-Math.abs(transfer):transfer;
    if(quantity&&(sold||returned)){
      const d=String(l.rrDate??l.rrdDt??l.rrdDate??l.saleDt??'').slice(0,10);
      const rate=(rateMap.get(key)??[]).find(r=>r.valid_from<=d);
       const shared=(sharedRates.get(key)??[]).find(r=>r.valid_from<=d);
      const costCents=rate?.cost_cents??shared?.cost_cents??null;
       const cost=costCents===null?null:Number(costCents)/100;
      const mayakCents=rate?.mayak_cents??shared?.mayak_cents??null;
       const mayak=mayakCents===null?null:Number(mayakCents)/100;
      if(cost===null)x.cost_missing=true;else{x.cogs_estimate+=(sold?1:-1)*quantity*cost;x.cost_rub=cost;}
      if(sold){if(mayak===null)x.mayak_missing=true;else{x.mayak_estimate+=quantity*mayak;x.mayak_rub=mayak;}}
    }
    if(l.paidStorage!==undefined && l.paidStorage!==null) x.storage_in_report=round((x.storage_in_report??0)+num(l.paidStorage));x.acceptance+=num(l.paidAcceptance);x.penalty+=num(l.penalty);x.deduction+=num(l.deduction);
    const prev=x.operations[op]??{amount:0,count:0,realization:0,delivery:0,storage:0,penalty:0,deduction:0};
    x.operations[op]={amount:round(prev.amount+transfer),count:prev.count+1,realization:round(prev.realization+sale),delivery:round(prev.delivery+delivery),storage:round(prev.storage+num(l.paidStorage)),penalty:round(prev.penalty+num(l.penalty)),deduction:round(prev.deduction+num(l.deduction))};
  }
  return [...byId.values()].map(x=>{
   const cogs=x.cost_missing?null:round(x.cogs_estimate),mayak_expense=x.mayak_missing?null:round(x.mayak_estimate);
   const preliminary_result=cogs===null||mayak_expense===null?null:round(x.net_transfer-x.delivery-(x.storage_in_report??0)-x.acceptance-x.penalty-x.deduction-cogs-mayak_expense);
   return {...x,realization:round(x.realization),gross_retail:round(x.gross_retail),to_transfer:round(x.to_transfer),delivery:round(x.delivery),storage_in_report:x.storage_in_report==null?null:round(x.storage_in_report),acceptance:round(x.acceptance),penalty:round(x.penalty),deduction:round(x.deduction),buyouts:x.sales_units-x.return_units,cogs,mayak_expense,preliminary_result,missing_rates:[...(x.cost_missing?['Себестоимость']:[]),...(x.mayak_missing?['ТК Маяк']:[])]};
  });
}

const FINANCE_KEY="finance_detailed";
class FinanceCooldown extends Error {
  constructor(public retryAt:string) {super("Лимит WB. Повторный запрос разрешён после "+new Date(retryAt).toLocaleString("ru-RU",{timeZone:"Asia/Krasnoyarsk"})+" (Красноярск).");}
}
async function saveFinanceState(next:string,status:number|null,message:string){
 const db=createAdminClient();
 const {error}=await db.from("wb_sync_state").upsert({sync_key:FINANCE_KEY,next_allowed_at:next,last_http_status:status,last_message:message,updated_at:new Date().toISOString()},{onConflict:"sync_key"});
 if(error)throw new Error("Не удалось сохранить лимит WB: "+error.message);
}
async function beforeFinanceRequest(){
 const db=createAdminClient();
 const {data,error}=await db.from("wb_sync_state").select("next_allowed_at").eq("sync_key",FINANCE_KEY).maybeSingle();
 if(error)throw new Error("Не удалось проверить лимит WB: "+error.message);
 if(data?.next_allowed_at && Date.parse(data.next_allowed_at)>Date.now()) throw new FinanceCooldown(data.next_allowed_at);
 await saveFinanceState(new Date(Date.now()+75000).toISOString(),null,"Финансовый запрос отправлен; ограничение 75 секунд");
}
async function finance(from:string,to:string,token:string){
  await beforeFinanceRequest();
  // Avoid repeated calls until the cooldown expires.
  const response=await fetch("https://finance-api.wildberries.ru/api/finance/v1/sales-reports/detailed",{
    method:"POST",headers:{Authorization:token,"Content-Type":"application/json"},cache:"no-store",
    body:JSON.stringify({dateFrom:from+"T00:00:00",dateTo:to+"T23:59:59",limit:100000,offset:0}),
    signal:AbortSignal.timeout(50000)
  });
  if(response.status===429){
    const raw=response.headers.get("X-RateLimit-Retry")??response.headers.get("Retry-After")??"";
    const sec=Number(raw);
    const next=new Date(Date.now()+(Number.isFinite(sec)&&sec>0?Math.ceil(sec)*1000+5000:75000)).toISOString();
    await saveFinanceState(next,429,"Wildberries вернул 429");
    throw new FinanceCooldown(next);
  }
  if(response.status===204) return [];
  if(!response.ok) throw new Error("WB Finance HTTP "+response.status+": "+(await response.text()).slice(0,350));
  const payload=await response.json() as unknown;
  if(!Array.isArray(payload))throw new Error("Неверный формат нового Finance API. Сверьте fields, limit и offset с актуальной схемой.");
  if(payload.length>=100000)throw new Error("Получено 100000 строк. Для полного отчёта нужна фоновая пагинация с лимитом 1 запрос/мин. Частичные суммы не показываются.");
  return payload as FinanceLine[];
}
async function adStats(from:string,to:string,token:string):Promise<{items:AdItem[];campaigns:number;coverage:string;warning:string|null}>{
  const base="https://advert-api.wildberries.ru";
  const list=await wb(base+"/adv/v1/promotion/count",token) as {adverts?:Array<{status:number;advert_list?:Array<{advertId:number}>}>} | null;
  const ids=[...new Set((list?.adverts??[]).flatMap(g=>(g.advert_list??[]).map(c=>c.advertId)).filter(Boolean))];
  if(!ids.length) return {items:[],campaigns:0,coverage:"incomplete",warning:"Не обнаружены кампании в /adv/v1/promotion/count. Это не означает, что расходов не было. Проверить /adv/v1/adverts и рекламные списания."};
  // Fullstats has a strict rate limit; this initial route intentionally performs one request.
  if(ids.length>50) return {items:[],campaigns:ids.length,coverage:"incomplete",warning:"Найдено более 50 рекламных кампаний. Нужна очередь фоновой загрузки; нули по рекламе не показываем."};
  const u=new URL(base+"/adv/v3/fullstats");
  u.searchParams.set("ids",ids.join(","));u.searchParams.set("beginDate",from);u.searchParams.set("endDate",to);
  const result=await wb(u.toString(),token);
  if(result!==null&&!Array.isArray(result))throw new Error("Неизвестный формат fullstats");
  const resultRows=Array.isArray(result)?result as Array<Record<string,unknown>>:[];
  const items:AdItem[]=[];
  for(const campaign of resultRows){
    const campaign_id=num(campaign.advertId);
    const days=Array.isArray(campaign.days)?campaign.days as Array<Record<string,unknown>>:[];
    for(const day of days){
      const date=String(day.date??"").slice(0,10);
      const apps=Array.isArray(day.apps)?day.apps as Array<Record<string,unknown>>:[];
      for(const app of apps){
        const products=Array.isArray(app.nms)?app.nms as Array<Record<string,unknown>>:[];
        for(const product of products){
          const nm_id=num(product.nmId);
          if(!nm_id||date<from||date>to) continue;
          items.push({nm_id,date,campaign_id,spend:num(product.sum),views:num(product.views),clicks:num(product.clicks),orders:num(product.orders),sum_price:num(product.sum_price),atbs:num(product.atbs)});
        }
      }
    }
  }
  return {items,campaigns:ids.length,coverage:"stats_only",warning:"fullstats показывает статистику расхода, не подтверждённые списания. Сверка с рекламными актами /adv/v1/upd ещё не выполнена."};
}
export async function GET(request:NextRequest){
 try{
  await access();
  const db=createAdminClient();
  const from=request.nextUrl.searchParams.get("from")??"";
  const to=request.nextUrl.searchParams.get("to")??"";
  if(!dateOK(from)||!dateOK(to)||from>to||Date.parse(to)-Date.parse(from)>90*86400000)
    return NextResponse.json({ok:false,error:"Выберите корректный период до 91 дня"},{status:400});
  let {data:latest,error:latestError}=await db.from("wb_finance_cache_jobs")
   .select("run_day,date_from,date_to,status,rows_saved,completed_at")
   .lte("date_from",from).gte("date_to",to).eq("status","complete")
   .order("run_day",{ascending:false}).limit(1).maybeSingle();
  if(latestError)throw latestError;

  const lines:FinanceLine[]=[];let readCount=0;
  if(latest){
   for(let offset=0;offset<latest.rows_saved;offset+=1000){
    const {data,error}=await db.from('wb_finance_cache_lines').select('payload')
     .eq('run_day',latest.run_day).order('line_index',{ascending:true}).range(offset,offset+999);
    if(error)throw error;if(!data?.length)break;
    readCount+=data.length;
    for(const rec of data){
     const line=rec.payload as FinanceLine;
     const dt=String(line.rrDate??line.rrdDt??line.rrdDate??line.saleDt??'').slice(0,10);
     if(dt>=from&&dt<=to)lines.push(line);
    }
   }
   if(readCount!==latest.rows_saved)throw Error('Кэш WB прочитан не полностью');
  }else{
   const n=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
   const {data:snapshots,error:snapshotError}=await db.from('wb_finance_daily_snapshots')
    .select('snapshot_day,line_count,captured_at').gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day');
   if(snapshotError)throw snapshotError;
   const missing:string[]=[];
   for(let i=0;i<n;i++){
    const day=new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10);
    const rec=snapshots?.[i];
    if(!rec||rec.snapshot_day!==day){missing.push(day);continue;}
    const before=lines.length;
    for(let offset=0;offset<rec.line_count;offset+=1000){
     const {data,error}=await db.from('wb_finance_daily_lines').select('payload')
      .eq('snapshot_day',day).order('line_index').range(offset,offset+999);
     if(error)throw error;lines.push(...(data??[]).map(x=>x.payload as FinanceLine));
    }
    if(lines.length-before!==rec.line_count)throw Error('Неполные дневные данные WB '+day);
   }
   if(missing.length){
    const progress=await db.from('wb_finance_cache_jobs').select('run_day,date_from,date_to,status,rows_saved,retry_at,last_error')
      .in('status',['pending','waiting','running','failed']).order('run_day',{ascending:false}).limit(1).maybeSingle();
    return NextResponse.json({ok:false,cache_pending:true,progress:progress.data,
      error:'Нет завершённых данных WB за '+missing.length+' дней. Первые пропуски: '+missing.slice(0,4).join(', ')},{status:503});
   }
   latest={run_day:to,date_from:from,date_to:to,status:'complete',rows_saved:lines.length,completed_at:snapshots?.[snapshots.length-1]?.captured_at??null};
  }
  const {data:rates,error:rateError}=await db.from('wb_finance_unit_rates').select('nm_id,valid_from,cost_cents,mayak_cents,version').order('valid_from',{ascending:false});
  if(rateError)throw rateError;

  // ENOT tariffs are shared across marketplaces; WB-specific tariffs take precedence.
  const [listings,managers]=await Promise.all([
    readPages<{external_id:string;seller_article:string;master_code:string|null}>(async(a,b)=>{const q=await db.from('marketplace_listings').select('external_id,seller_article,master_code').eq('marketplace','wildberries').eq('is_active',true).order('id').range(a,b);return {data:q.data,error:q.error};}),
    readPages<{master_code:string;manager_name:string}>(async(a,b)=>{const q=await db.from('ozon_finance_managers').select('master_code,manager_name').order('master_code').range(a,b);return {data:q.data,error:q.error};})
  ]);
  const [ymRates,ozonCosts,ozonMayak]=await Promise.all([
    readPages<{master_code:string;valid_from:string;cost_cents:number|null;mayak_cents:number|null}>(async(a,b)=>{const q=await db.from('yandex_finance_rates').select('master_code,valid_from,cost_cents,mayak_cents').order('master_code').range(a,b);return {data:q.data,error:q.error};}),
    readPages<{master_code:string;valid_from:string;unit_cost_rub:number}>(async(a,b)=>{const q=await db.from('ozon_finance_costs').select('master_code,valid_from,unit_cost_rub').order('master_code').range(a,b);return {data:q.data,error:q.error};}),
    readPages<{master_code:string;valid_from:string;unit_cost_rub:number}>(async(a,b)=>{const q=await db.from('ozon_finance_mayak').select('master_code,valid_from,unit_cost_rub').order('master_code').range(a,b);return {data:q.data,error:q.error};})
  ]);
  const ymByMaster=new Map<string,typeof ymRates>(),costByMaster=new Map<string,typeof ozonCosts>(),mayakByMaster=new Map<string,typeof ozonMayak>();
  for(const x of ymRates){const arr=ymByMaster.get(x.master_code)??[];arr.push(x);ymByMaster.set(x.master_code,arr);}
  for(const x of ozonCosts){const arr=costByMaster.get(x.master_code)??[];arr.push(x);costByMaster.set(x.master_code,arr);}
  for(const x of ozonMayak){const arr=mayakByMaster.get(x.master_code)??[];arr.push(x);mayakByMaster.set(x.master_code,arr);}
  const sharedByMaster=new Map<string,Rate[]>();
  for(const master of new Set([...ymByMaster.keys(),...costByMaster.keys(),...mayakByMaster.keys()])){
    const ys=ymByMaster.get(master)??[],cs=costByMaster.get(master)??[],ms=mayakByMaster.get(master)??[];
    const dates=[...new Set([...ys,...cs,...ms].map(x=>x.valid_from))].sort().reverse();
    sharedByMaster.set(master,dates.map(d=>{
      const y=ys.filter(x=>x.valid_from<=d).sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0];
      const c=cs.filter(x=>x.valid_from<=d).sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0];
      const mayak=ms.filter(x=>x.valid_from<=d).sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0];
      return {nm_id:'',valid_from:d,cost_cents:y?.cost_cents??(c?Math.round(Number(c.unit_cost_rub)*100):null),mayak_cents:y?.mayak_cents??(mayak?Math.round(Number(mayak.unit_cost_rub)*100):null),version:0};
    }));
  }
  const masterById=new Map(listings.map(x=>[String(x.external_id),x.master_code]));
  const masterByArticle=new Map(listings.map(x=>[String(x.seller_article),x.master_code]));
  const sharedByNm=new Map<string,Rate[]>();
  for(const line of lines){const id=String(line.nmId??'0'),master=masterById.get(id)??masterByArticle.get(String(line.vendorCode??''));if(master&&!sharedByNm.has(id))sharedByNm.set(id,sharedByMaster.get(master)??[]);}
  const scheme=request.nextUrl.searchParams.get('scheme');
  if(scheme!==null&&!['fbw','fbs'].includes(scheme))return NextResponse.json({ok:false,error:'Неверная схема'},{status:400});
  let financialLines=lines;
  if(scheme){
   const refFrom=new Date(Date.parse(from+'T00:00:00Z')-45*86400000).toISOString().slice(0,10);
   const sourceOrders=await readPages<{srid:string;warehouse_type:string}>(async(a,b)=>{const q=await db.from('wb_orders').select('srid,warehouse_type').gte('order_date',refFrom+'T00:00:00Z').lte('order_date',to+'T23:59:59Z').order('srid').range(a,b);return {data:q.data,error:q.error};});
   const srids=new Set(sourceOrders.filter(o=>(o.warehouse_type==='Склад WB'?'fbw':o.warehouse_type==='Склад продавца'?'fbs':null)===scheme).map(o=>o.srid));
   financialLines=lines.filter(l=>{
    const office=String(l.officeName??'').toLowerCase();
    const kind=office==='склад wb'?'fbw':office.includes('склад поставщика')||office.includes('склад продавца')?'fbs':null;
    return kind?kind===scheme:srids.has(String(l.srid??''));
   });
  }
  const allGrouped=groupFinancial(financialLines,(rates??[]) as Rate[],sharedByNm);
  const unallocatedFinancial=allGrouped.find(x=>x.nm_id==='unallocated');
  const grouped=allGrouped.filter(x=>x.nm_id!=='unallocated');
  const daily=Array.from({length:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1},(_,i)=>{
    const day=new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10);
    return {day,rows:groupFinancial(financialLines.filter(line=>String(line.rrDate??line.rrdDt??line.rrdDate??line.saleDt??'').slice(0,10)===day),(rates??[]) as Rate[],sharedByNm).map(r=>({nm_id:r.nm_id,revenue:r.gross_retail,profit:r.preliminary_result,orders:r.sales_units,buyouts:r.buyouts}))};
  });
  const ads=await readPages<{snapshot_day:string;campaign_id:number;nm_id:number;spend:number;views:number;clicks:number;orders:number;sum_price:number;payload:Record<string,unknown>|null}>(async(a,b)=>{const q=await db.from('wb_finance_ad_daily').select('snapshot_day,campaign_id,nm_id,spend,views,clicks,orders,sum_price,payload').gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day').range(a,b);return {data:q.data,error:q.error};});
  const storage=await readPages<{snapshot_day:string;nm_id:number|null;amount:number}>(async(a,b)=>{const q=await db.from('wb_finance_storage_daily').select('snapshot_day,nm_id,amount').gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day').range(a,b);return {data:q.data,error:q.error};});
  const orders=await readPages<{nm_id:number;is_cancel:boolean;warehouse_type:string}>(async(a,b)=>{const q=await db.from('wb_orders').select('nm_id,is_cancel,warehouse_type').gte('order_date',from+'T00:00:00Z').lte('order_date',to+'T23:59:59Z').order('order_date').range(a,b);return {data:q.data,error:q.error};});
  const [adSnapshots,storageSnapshots,advertisingJob]=await Promise.all([db.from('wb_finance_ad_snapshots').select('snapshot_day').gte('snapshot_day',from).lte('snapshot_day',to),db.from('wb_finance_storage_snapshots').select('snapshot_day').gte('snapshot_day',from).lte('snapshot_day',to),db.from('wb_sync_state').select('stage,last_message,last_http_status,updated_at').eq('sync_key','wb_ad_fullstats_progress').maybeSingle()]);if(adSnapshots.error)throw adSnapshots.error;if(storageSnapshots.error)throw storageSnapshots.error;if(advertisingJob.error)throw advertisingJob.error;
  const orderByNm=new Map<string,{orders:number;cancelled:number}>();for(const row of orders.filter(o=>!scheme||(scheme==='fbw'?o.warehouse_type==='Склад WB':o.warehouse_type==='Склад продавца'))){const key=String(row.nm_id),v=orderByNm.get(key)??{orders:0,cancelled:0};v.orders++;if(row.is_cancel)v.cancelled++;orderByNm.set(key,v);}
  const storageByNm=new Map<string,number>();for(const row of storage)if(row.nm_id)storageByNm.set(String(row.nm_id),(storageByNm.get(String(row.nm_id))??0)+num(row.amount));
  const expectedDays=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;

  const listingByNm=new Map(listings.map(x=>[String(x.external_id),x]));
  const listingByArticle=new Map(listings.map(x=>[String(x.seller_article),x]));
  const managerByMaster=new Map(managers.map(x=>[String(x.master_code),String(x.manager_name)]));
  const enriched=grouped.map(row=>{
    const listing=listingByNm.get(row.nm_id)??listingByArticle.get(row.article),master=listing?.master_code??null;
    const manager=master?managerByMaster.get(master):null;
    return {...row,master_code:master,manager:manager??'Не назначен',
      missing_rates:[...row.missing_rates,...(!master?['Код товара (ЕНОТ)']:[]),...(!manager?['КМ']:[])],
      order_count:orderByNm.get(row.nm_id)?.orders??0,cancel_count:orderByNm.get(row.nm_id)?.cancelled??0,
      external_storage:scheme?null:storageByNm.has(row.nm_id)?round(storageByNm.get(row.nm_id)!):null};
  });

  // Financial reports book storage and WB Promotion without nmId. Product-level
  // snapshots supply only allocation weights, NOT an additional cash expense.
  const promotionLine=(l:FinanceLine)=>String(l.sellerOperName??'').toLowerCase()==='удержание'&&/wb\s*продвижение/i.test(String(l.bonusTypeName??''));
  const storageLine=(l:FinanceLine)=>num(l.paidStorage)!==0||/^хранение$/i.test(String(l.sellerOperName??''));
  const bookedPromo=financialLines.filter(promotionLine).reduce((total,l)=>total+Math.abs(num(l.deduction)),0);
  const bookedPromoCommon=financialLines.filter(l=>num(l.nmId)===0&&promotionLine(l)).reduce((total,l)=>total+Math.abs(num(l.deduction)),0);
  const bookedStorageCommon=financialLines.filter(l=>num(l.nmId)===0).reduce((total,l)=>total+Math.abs(num(l.paidStorage)),0);
  const otherDeductions=financialLines.filter(l=>num(l.deduction)!==0&&!promotionLine(l))
   .reduce((total,l)=>total+Math.abs(num(l.deduction)),0);
  const adItems:AdItem[]=scheme?[]:ads.map(row=>({nm_id:Number(row.nm_id),date:row.snapshot_day,campaign_id:Number(row.campaign_id),spend:Number(row.spend),views:Number(row.views),clicks:Number(row.clicks),orders:Number(row.orders),sum_price:Number(row.sum_price),atbs:num((row.payload as Record<string,unknown>|null)?.atbs)}));
  const adsComplete=!scheme&&(adSnapshots.data?.length??0)===expectedDays;
  const storageComplete=!scheme&&(storageSnapshots.data?.length??0)===expectedDays;
  const ordersComplete=orders.length>0;
  const adWeights=new Map<string,number>();
  if(adsComplete)for(const a of adItems)adWeights.set(String(a.nm_id),(adWeights.get(String(a.nm_id))??0)+Math.max(0,a.spend));
  const storageWeights=new Map<string,number>();
  if(storageComplete)for(const a of storage){if(!a.nm_id)continue;const nm=String(a.nm_id);storageWeights.set(nm,(storageWeights.get(nm)??0)+Math.max(0,num(a.amount)));}
  // Deterministic largest-remainder split, exactly matches booked invoice cents.
  const allocate=(rub:number,weights:Map<string,number>)=>{
   const result=new Map<string,number>(),total=[...weights.values()].reduce((a,b)=>a+b,0),cents=Math.round(rub*100);
   if(!cents||total<=0)return result;
   const parts=[...weights].filter(([,n])=>n>0).map(([nm,n])=>{
    const exact=cents*n/total;return {nm,whole:Math.floor(exact),frac:exact-Math.floor(exact)};
   });const leftover=cents-parts.reduce((a,x)=>a+x.whole,0);
   parts.sort((a,b)=>b.frac-a.frac||a.nm.localeCompare(b.nm));
   parts.forEach((p,i)=>result.set(p.nm,(p.whole+(i<leftover?1:0))/100));
   return result;
  };
  const adSplit=adsComplete?allocate(bookedPromoCommon,adWeights):new Map<string,number>();
  const storageSplit=storageComplete?allocate(bookedStorageCommon,storageWeights):new Map<string,number>();
  const recorded=new Set(enriched.map(r=>r.nm_id));
  // Include products that have storage/advertising fees but no sales this month.
  for(const nm of new Set([...adSplit.keys(),...storageSplit.keys()])){
   if(recorded.has(nm))continue;
   const listing=listingByNm.get(nm);
   const synthetic=groupFinancial([{nmId:Number(nm),vendorCode:listing?.seller_article??'',subjectName:'',quantity:0}],(rates??[]) as Rate[],sharedByNm)[0];
   const master=listing?.master_code??null,manager=master?managerByMaster.get(master)??null:null;
   enriched.push({...synthetic,rows:0,operations:{},master_code:master,manager:manager??'Не назначен',
    order_count:orderByNm.get(nm)?.orders??0,cancel_count:orderByNm.get(nm)?.cancelled??0,
    missing_rates:[...(!master?['Код товара (ЕНОТ)']:[]),...(!manager?['КМ']:[])],
    external_storage:storageByNm.get(nm)??null});
  }
  const allocatedRows=enriched.map(row=>{
   const bookAd=adSplit.get(row.nm_id)??0,bookStorage=storageSplit.get(row.nm_id)??0;
   const directStorage=row.storage_in_report??0;
   const financialStorage=storageComplete?bookStorage+directStorage:directStorage;
   return {...row,allocated_ad:adsComplete?round(bookAd):null,
    allocated_storage:storageComplete?round(financialStorage):null,
    external_storage:storageComplete?round(financialStorage):row.external_storage,
    preliminary_result:row.preliminary_result===null?null:round(row.preliminary_result-bookAd-bookStorage)};
  });
  const attributedAd=[...adSplit.values()].reduce((a,b)=>a+b,0),attributedStorage=[...storageSplit.values()].reduce((a,b)=>a+b,0);
  // Only genuine 'other' fees belong to the unallocated register.
  // Advertising and storage are accounted for above or explicitly pending.
  const commonMap=new Map<string,{name:string;amount:number;days:Map<string,{date:string;amount:number;count:number}>}>();
  for(const l of financialLines){
   if(num(l.nmId)!==0||promotionLine(l)||storageLine(l))continue;
   const name=String(l.sellerOperName??l.docTypeName??'Прочие операции'),day=String(l.rrDate??l.rrdDt??l.rrdDate??l.saleDt??'').slice(0,10);
   const amount=num(l.forPay)-num(l.deliveryAmount)-num(l.paidStorage)-num(l.paidAcceptance)-num(l.penalty)-num(l.deduction);
   if(Math.abs(amount)<.005)continue;
   const entry=commonMap.get(name)??{name,amount:0,days:new Map<string,{date:string;amount:number;count:number}>()};
   entry.amount+=amount;const item=entry.days.get(day)??{date:day,amount:0,count:0};item.amount+=amount;item.count++;entry.days.set(day,item);commonMap.set(name,entry);
  }
  const unallocated=[...commonMap.values()].filter(v=>Math.abs(v.amount)>.005).map(v=>({name:v.name,amount:round(v.amount),daily:[...v.days.values()].sort((a,b)=>a.date.localeCompare(b.date))}));
  const pendingAd=round(Math.max(0,bookedPromoCommon-attributedAd)),pendingStorage=round(Math.max(0,bookedStorageCommon-attributedStorage));
  let adProgress:Record<string,unknown>={};try{adProgress=JSON.parse(advertisingJob.data?.last_message??'{}');}catch{}
   return NextResponse.json({ok:true,from,to,scheme:scheme??null,unallocated,unallocated_financial:round((unallocatedFinancial?.preliminary_result??0)+attributedAd+attributedStorage),pending_allocation:{advertising:pendingAd,storage:pendingStorage},attributed:{advertising:round(attributedAd),storage:round(attributedStorage),storage_method:'invoice_weighted_by_paid_storage_nm_id'},ad_sync:{stage:advertisingJob.data?.stage??'not_started',last_error:adProgress.last_error??null,processed:adProgress.next??0,total:Array.isArray(adProgress.ids)?adProgress.ids.length:0,updated_at:advertisingJob.data?.updated_at??null},promotion_actual:round(bookedPromo),other_deductions:round(otherDeductions),financial_rows:financialLines.length,daily,rows:allocatedRows,
    ads:{items:adItems,campaigns:new Set(ads.map(x=>x.campaign_id)).size,coverage:scheme?'not_attributed':adsComplete?'cached_complete':adItems.length?'cached_partial':'not_loaded',warning:scheme?'Не связанные с SRID рекламные списания исключены.':adsComplete?null:'Реклама загружена не за все дни выбранного периода.'},
    orders:{rows:orders.length,coverage:ordersComplete?'cached_partial':'not_loaded'},storage:{rows:storage.length,coverage:storageComplete?'cached_complete':storage.length?'cached_partial':'not_loaded'},
    coverage:{finance:latest.status==='complete'?'cached_complete':'cached_partial',advertising:adsComplete?'cached_complete':adItems.length?'cached_partial':'not_loaded',paid_storage:storageComplete?'cached_complete':storage.length?'cached_partial':'not_loaded',orders:ordersComplete?'cached_partial':'not_loaded',advertising_actual_charges:'not_loaded'},
    cache:{status:latest.status,runDay:latest.run_day,from:latest.date_from,to:latest.date_to,completedAt:latest.completed_at,rowsSaved:latest.rows_saved},
    notice:'Розничный оборот отражает продажи по полной цене минус возвраты. Рекламные и складские списания из финансового отчёта распределяются по nmId на основе полной статистики, но не списываются дважды. При отсутствии покрытия остаются учтёнными в общем результате со статусом «ожидает распределения».'});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
