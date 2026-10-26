import "server-only";
import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "../../../../../lib/supabase/server";
import {createAdminClient} from "../../../../../lib/supabase/admin";
import {calculateNeed} from "../../../../../lib/wb/procurement";
import {wbFbw} from "../../../../../lib/wb/fbw-api";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
type Item={sku:string;barcode:string;quantity:number;boxes:number;unitsPerBox:number};
type Input={items?:Item[];point?:{id:number;name:string};type?:"box"|"mono"};
type Row={nmId:number;masterCode:string|null;sales28Days:number;fbwStock:number};
const respond=(data:object,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
const hash=(str:string)=>createHash("sha256").update(str).digest("hex");
const sellerUrl="https://seller.wildberries.ru/";
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export async function POST(req:NextRequest){
  const auth=await createClient();
  const {data:{user},error:authError}=await auth.auth.getUser();
  if(!user||authError)return respond({ok:false,error:"Авторизуйтесь на сайте"},401);
  let body:Input;
  try{body=await req.json();}catch{return respond({ok:false,error:"Неверный формат запроса"},400);}
  const items=body.items;
  if(!Array.isArray(items)||items.length<1||items.length>300||
     (body.type!=="box"&&body.type!=="mono")||!body.point||
     !Number.isSafeInteger(body.point.id)||!body.point.name?.trim())
    return respond({ok:false,error:"Укажите состав, тип поставки и точку сдачи"},400);
  if(body.type==="mono"&&items.length>3)
    return respond({ok:false,error:"Для монопаллеты максимум три баркода"},400);
  const unique=new Set<string>();
  for(const x of items){
    if(!/^[0-9]{5,20}$/.test(x.barcode)||!/^[0-9]{1,20}$/.test(x.sku)||
       !Number.isSafeInteger(x.quantity)||x.quantity<=0||!Number.isSafeInteger(x.boxes)||
       x.boxes<1||!Number.isSafeInteger(x.unitsPerBox)||x.unitsPerBox<1||
       x.quantity!==x.unitsPerBox*x.boxes||unique.has(x.barcode))
      return respond({ok:false,error:"Проверка баркодов, коробов и кратности не прошла"},400);
    unique.add(x.barcode);
  }
  const db=createAdminClient();
  // Validate against live demand, not browser-supplied values.
  const {data:dash,error:dashError}=await db.rpc("get_wb_sync_dashboard");
  if(dashError||!dash?.ok)return respond({ok:false,error:"Расчёт WB недоступен: "+(dashError?.message??"нет данных")},503);
  const syncTime=String(dash.status?.stocksAndSalesLastSuccessAt??dash.status?.stocksLastSuccessAt??"");
  const stamp=Date.parse(syncTime);
  if(!Number.isFinite(stamp)||Date.now()-stamp>86400000||stamp>Date.now()+300000)
    return respond({ok:false,error:"Остатки и продажи WB устарели. Сначала обновите синхронизацию."},409);

  const products=new Map<string,Row>();
  for(const row of (dash.products??[]) as Row[])products.set(String(row.nmId),row);
  const masters=Array.from(new Set(items.map(x=>products.get(x.sku)?.masterCode).filter((x):x is string=>Boolean(x))));
  const {data:packRows,error:packError}=await db.from("products")
    .select("master_code,units_per_carton").in("master_code",masters.length?masters:["__empty__"]).range(0,9999);
  if(packError)return respond({ok:false,error:"Нет справочника коробов: "+packError.message},500);
  const packs=new Map<string,Set<number>>();
  for(const p of packRows??[]){
    const k=String(p.master_code??""),n=Number(p.units_per_carton);
    if(!k||!Number.isSafeInteger(n)||n<=0)continue;
    const set=packs.get(k)??new Set<number>();set.add(n);packs.set(k,set);
  }
  const [stockCodes,orderCodes]=await Promise.all([
    db.from("wb_stock_snapshots").select("nm_id,barcode").in("barcode",items.map(x=>x.barcode)).range(0,9999),
    db.from("wb_orders").select("nm_id,barcode").in("barcode",items.map(x=>x.barcode)).range(0,9999),
  ]);
  if(stockCodes.error||orderCodes.error)return respond({ok:false,error:"Не удалось проверить принадлежность баркодов"},500);
  const barcodePairs=new Set<string>();
  for(const v of [...(stockCodes.data??[]),...(orderCodes.data??[])])
    barcodePairs.add(String(v.nm_id)+"|"+String(v.barcode));

  for(const item of items){
    const product=products.get(item.sku);
    if(!product?.masterCode)return respond({ok:false,error:"Артикул "+item.sku+" отсутствует в свежем расчёте"},409);
    const sales=Number(product.sales28Days),stock=Number(product.fbwStock);
    if(!Number.isFinite(sales)||sales<0||!Number.isFinite(stock)||stock<0)return respond({ok:false,error:"Некорректные продажи/остаток "+item.sku},409);
    const need=calculateNeed(stock,sales/28).need;
    const validPacks=packs.get(product.masterCode);
    if(validPacks?.size!==1||!validPacks.has(item.unitsPerBox))return respond({ok:false,error:"Вложимость изменилась: "+item.sku},409);
    const calculated=need>item.unitsPerBox*.5?Math.round(need/item.unitsPerBox):0;
    if(calculated!==item.boxes)return respond({ok:false,error:"Пересчитайте потребность для "+item.sku},409);
    if(!barcodePairs.has(item.sku+"|"+item.barcode))return respond({ok:false,error:"Баркод не принадлежит артикулу "+item.sku},409);
  }

  const sorted=[...items].sort((a,b)=>a.barcode.localeCompare(b.barcode));
  const fingerprint=hash(JSON.stringify([sorted,body.type,body.point.id,syncTime]));
  const requestKey=hash(user.id+"|"+fingerprint);
  const {data:prior}=await db.from("wb_fbw_draft_runs").select("status,draft_id,error_message")
    .eq("request_key",requestKey).maybeSingle();
  if(prior)return respond({
    ok:prior.status==="ready",reused:true,status:prior.status,draftId:prior.draft_id,
    error:prior.status==="ready"?undefined:"Эта попытка уже зафиксирована. Не создаём дубль. "+(prior.error_message??"Проверьте черновики WB."),
    url:sellerUrl,
  },prior.status==="ready"?200:409);

  const payload={
    request_key:requestKey,fingerprint,period_end:new Date(stamp).toISOString().slice(0,10),
    status:"creating",created_by:user.id,sku_count:sorted.length,
    units:sorted.reduce((a,b)=>a+b.quantity,0),
    cartons:sorted.reduce((a,b)=>a+b.boxes,0),
    items:sorted.map(x=>({...x,pointId:body.point!.id,type:body.type})),
  };
  const inserted=await db.from("wb_fbw_draft_runs").insert(payload).select("id").single();
  if(inserted.error){
    if(inserted.error.code==="23505")return respond({ok:false,error:"Создание уже запущено в другой вкладке. Проверьте состояние черновика."},409);
    return respond({ok:false,error:"Не удалось зафиксировать создание: "+inserted.error.message},500);
  }
  let draftId:string|null=null;
  try{
    const draft=await wbFbw.createEmptyDraft() as {draftId?:string};
    draftId=String(draft?.draftId??"");
    if(!/^[0-9a-f-]{32,36}$/i.test(draftId))throw new Error("WB создал черновик, но не вернул корректный draftId");
    await db.from("wb_fbw_draft_runs").update({draft_id:draftId,status:"draft_created",updated_at:new Date().toISOString()}).eq("id",inserted.data.id);
    await pause(2100); // official WB minimum interval for draft operations
    const add=await wbFbw.addDraftItems(draftId,sorted.map(x=>({sku:x.barcode,quantity:x.quantity}))) as {results?:Array<{sku:string;error?:unknown}>};
    if(!add||!Array.isArray(add.results)||add.results.length>0)
      throw new Error("WB не принял весь состав черновика: "+JSON.stringify(add?.results??add).slice(0,400));
    await pause(2100);
    const verified=await wbFbw.listDraftItems(draftId) as {items?:Array<{sku:string;quantity:number}>};
    if(!verified||!Array.isArray(verified.items))throw new Error("WB не подтвердил товарный состав черновика");
    const actual=new Map(verified.items.map(x=>[String(x.sku),Number(x.quantity)]));
    if(sorted.length!==actual.size||sorted.some(x=>actual.get(x.barcode)!==x.quantity))
      throw new Error("Товары в черновике WB не совпадают с рассчитанной потребностью");
    const saved=await db.from("wb_fbw_draft_runs").update({status:"ready",error_message:null,updated_at:new Date().toISOString()}).eq("id",inserted.data.id);
    if(saved.error)throw new Error("Черновик WB проверен, но не сохранился статус сайта: "+saved.error.message);
    return respond({ok:true,draftId,status:"ready",url:sellerUrl,
      message:"Черновик FBW создан, товары и количества проверены. Выбор точки, типа и таймслота нужно завершить в кабинете WB."});
  }catch(error){
    const message=error instanceof Error?error.message:"Сбой WB";
    await db.from("wb_fbw_draft_runs").update({
      status:"failed",draft_id:draftId||null,error_message:message.slice(0,600),
      updated_at:new Date().toISOString(),
    }).eq("id",inserted.data.id);
    return respond({ok:false,status:"failed",draftId,
      error:(draftId?"Черновик "+draftId+" уже мог быть создан. ":"")+message+
        ". Повторное создание автоматически заблокировано, чтобы не плодить дубликаты.",
      url:sellerUrl},502);
  }
}
