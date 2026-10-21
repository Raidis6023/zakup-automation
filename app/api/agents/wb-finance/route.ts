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
    const op=String(l.supplierOperName ?? l.docTypeName ?? "Неизвестная операция");
    const transfer=num(l.ppvzForPay),sale=num(l.retailAmount), delivery=num(l.deliveryRub);
    x.realization+=sale; x.to_transfer+=transfer; x.delivery+=delivery;
    if(l.storageFee!==undefined && l.storageFee!==null) x.storage_in_report=round((x.storage_in_report??0)+num(l.storageFee));x.acceptance+=num(l.acceptance);x.penalty+=num(l.penalty);x.deduction+=num(l.deduction);
    const prev=x.operations[op]??{amount:0,count:0,realization:0,delivery:0,storage:0,penalty:0,deduction:0};
    x.operations[op]={amount:round(prev.amount+transfer),count:prev.count+1,realization:round(prev.realization+sale),delivery:round(prev.delivery+delivery),storage:round(prev.storage+num(l.storageFee)),penalty:round(prev.penalty+num(l.penalty)),deduction:round(prev.deduction+num(l.deduction))};
  }
  return [...byId.values()].map(x=>({...x,realization:round(x.realization),to_transfer:round(x.to_transfer),delivery:round(x.delivery),storage_in_report:x.storage_in_report==null?null:round(x.storage_in_report),acceptance:round(x.acceptance),penalty:round(x.penalty),deduction:round(x.deduction)}));
}
async function finance(from:string,to:string,token:string){
  // One request per minute per seller. Never paginate synchronously without a shared persistent queue.
  const response=await fetch("https://finance-api.wildberries.ru/api/finance/v1/sales-reports/detailed",{
    method:"POST",headers:{Authorization:token,"Content-Type":"application/json"},cache:"no-store",
    body:JSON.stringify({dateFrom:from+"T00:00:00",dateTo:to+"T23:59:59",limit:100000,offset:0}),
    signal:AbortSignal.timeout(50000)
  });
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
    const from=request.nextUrl.searchParams.get("from")??"",to=request.nextUrl.searchParams.get("to")??"";
    if(!dateOK(from)||!dateOK(to)||from>to||Date.parse(to)-Date.parse(from)>30*86400000) return NextResponse.json({ok:false,error:"Выберите корректный период до 31 дня"},{status:400});
    const token=process.env.WB_FINANCE_TOKEN?.trim();
    if(!token) throw new Error("В Vercel не настроен WB_FINANCE_TOKEN");
    const report=await finance(from,to,token);
    let ads:Awaited<ReturnType<typeof adStats>>={items:[],campaigns:0,coverage:"not_configured",warning:"Не настроен WB_PROMOTION_TOKEN"};
    if(process.env.WB_PROMOTION_TOKEN?.trim()){
      try {ads=await adStats(from,to,process.env.WB_PROMOTION_TOKEN.trim());}
      catch(e){ads={items:[],campaigns:0,coverage:"error",warning:e instanceof Error?e.message:String(e)};}
    }
    return NextResponse.json({ok:true,from,to,financial_rows:report.length,rows:groupFinancial(report),ads,coverage:{finance:"loaded",advertising:ads.coverage,paid_storage:"not_loaded",advertising_actual_charges:"not_loaded"},notice:"Платное хранение по отдельному отчёту WB пока не загружено. Не считать отчёт полным финансовым результатом."});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
