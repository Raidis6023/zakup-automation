import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type FinanceLine = Record<string, unknown>;
type AdItem = { nm_id: number; date: string; campaign_id: number; spend: number; views: number; clicks: number; orders: number; sum_price: number };
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

function groupFinancial(lines:FinanceLine[]) {
  const byId=new Map<string,{nm_id:string;article:string;name:string;realization:number;to_transfer:number;delivery:number;storage_in_report:number|null;acceptance:number;penalty:number;deduction:number;rows:number;operations:Record<string,{amount:number;count:number;realization:number;delivery:number;storage:number;penalty:number;deduction:number}>}>();
  for(const l of lines){
    const id=String(l.nmId ?? "0"), article=String(l.vendorCode ?? ""), name=String(l.title ?? l.subjectName ?? "");
    const key=id!=="0" ? id : "unallocated";
    let x=byId.get(key);
    if(!x){x={nm_id:key,article,name,realization:0,to_transfer:0,delivery:0,storage_in_report:null,acceptance:0,penalty:0,deduction:0,rows:0,operations:{}};byId.set(key,x);}
    x.rows++;
    const op=String(l.sellerOperName ?? l.docTypeName ?? "Неизвестная операция");
    const transfer=num(l.forPay),sale=num(l.retailAmount), delivery=num(l.deliveryAmount);
    x.realization+=sale; x.to_transfer+=transfer; x.delivery+=delivery;
    if(l.paidStorage!==undefined && l.paidStorage!==null) x.storage_in_report=round((x.storage_in_report??0)+num(l.paidStorage));x.acceptance+=num(l.paidAcceptance);x.penalty+=num(l.penalty);x.deduction+=num(l.deduction);
    const prev=x.operations[op]??{amount:0,count:0,realization:0,delivery:0,storage:0,penalty:0,deduction:0};
    x.operations[op]={amount:round(prev.amount+transfer),count:prev.count+1,realization:round(prev.realization+sale),delivery:round(prev.delivery+delivery),storage:round(prev.storage+num(l.paidStorage)),penalty:round(prev.penalty+num(l.penalty)),deduction:round(prev.deduction+num(l.deduction))};
  }
  return [...byId.values()].map(x=>({...x,realization:round(x.realization),to_transfer:round(x.to_transfer),delivery:round(x.delivery),storage_in_report:x.storage_in_report==null?null:round(x.storage_in_report),acceptance:round(x.acceptance),penalty:round(x.penalty),deduction:round(x.deduction)}));
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
          items.push({nm_id,date,campaign_id,spend:num(product.sum),views:num(product.views),clicks:num(product.clicks),orders:num(product.orders),sum_price:num(product.sum_price)});
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
  if(!dateOK(from)||!dateOK(to)||from>to||Date.parse(to)-Date.parse(from)>30*86400000)
    return NextResponse.json({ok:false,error:"Выберите корректный период до 31 дня"},{status:400});
  const {data:latest,error:latestError}=await db.from("wb_finance_cache_jobs")
   .select("run_day,date_from,date_to,status,rows_saved,completed_at")
   .lte("date_from",from).gte("date_to",to).eq("status","complete")
   .order("run_day",{ascending:false}).limit(1).maybeSingle();
  if(latestError)throw latestError;
  if(!latest){
    const {data:progress}=await db.from("wb_finance_cache_jobs")
      .select("run_day,date_from,date_to,status,rows_saved,retry_at,last_error")
      .order("run_day",{ascending:false}).limit(1).maybeSingle();
    return NextResponse.json({ok:false,cache_pending:true,progress,
      error:"За выбранный период нет завершённого кэша WB. Дождитесь фоновой загрузки. Изменение фильтров не отправляет запросы в WB."},{status:503});
  }
  const lines:FinanceLine[]=[];let readCount=0;
  // Read only Supabase. Paginate because PostgREST defaults to 1000 records.
  for(let offset=0;offset<latest.rows_saved;offset+=1000){
    const {data,error}=await db.from("wb_finance_cache_lines").select("payload")
      .eq("run_day",latest.run_day).order("line_index",{ascending:true}).range(offset,offset+999);
    if(error)throw error;
    if(!data?.length)break;
    readCount+=data.length;
    for(const rec of data){
      const line=rec.payload as FinanceLine;
      const reportDate=String(line.rrDate??line.rrdDt??line.rrdDate??line.saleDt??"").slice(0,10);
      if(reportDate>=from&&reportDate<=to)lines.push(line);
    }
  }
  if(readCount!==latest.rows_saved)throw Error("Кэш WB прочитан не полностью. Повторите загрузку отчёта.");
  const daily=Array.from({length:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1},(_,i)=>{
    const day=new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10);
    return {day,rows:groupFinancial(lines.filter(line=>String(line.rrDate??line.rrdDt??line.rrdDate??line.saleDt??'').slice(0,10)===day)).map(r=>({nm_id:r.nm_id,revenue:r.realization}))};
  });
  return NextResponse.json({ok:true,from,to,financial_rows:lines.length,daily,
    rows:groupFinancial(lines),
    ads:{items:[],campaigns:0,coverage:"not_loaded",warning:"Рекламная статистика пока не загружена в кэш. Новые запросы к WB при смене фильтра не отправляются."},
    coverage:{finance:latest.status==="complete"?"cached_complete":"cached_partial",advertising:"not_loaded",paid_storage:"not_loaded",advertising_actual_charges:"not_loaded"},
    cache:{status:latest.status,runDay:latest.run_day,from:latest.date_from,to:latest.date_to,completedAt:latest.completed_at,rowsSaved:latest.rows_saved},
    notice:latest.status==="complete"?"Отчёт загружен из Supabase. Хранение и реклама требуют отдельной фоновой синхронизации.":"ВНИМАНИЕ: финансовый кэш НЕПОЛНЫЙ, итоговые суммы непригодны для решений. Показаны только уже сохранённые строки. Реклама ещё не загружена."});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
