import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {validDate} from '../../../../lib/yandex/finance';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
type Item={article:string;orders:number;cancelled:number|null;amount:number|null};
type Group={orders:number;cancelled:number|null;amount:number|null;knownAmount:number;articles:Item[]};
type Bucket={orders:number;cancelled:number;amount:number;knownAmount:number;articles:Map<string,Item>};
const empty=():Bucket=>({orders:0,cancelled:0,amount:0,knownAmount:0,articles:new Map()});
function add(b:Bucket,article:string,amount:number|null,cancelled:boolean|null,quantity=1){
 b.orders+=quantity;if(cancelled)b.cancelled+=quantity;
 if(amount!==null){b.amount+=amount;b.knownAmount+=quantity;}
 const item=b.articles.get(article)??{article,orders:0,cancelled:cancelled===null?null:0,amount:amount===null?null:0};
 item.orders+=quantity;if(cancelled&&item.cancelled!==null)item.cancelled+=quantity;
 if(amount!==null)item.amount=(item.amount??0)+amount;
 b.articles.set(article,item);
}
function result(b:Bucket,noCancellationData=false):Group{
 return {orders:b.orders,cancelled:noCancellationData?null:b.cancelled,amount:b.knownAmount?Math.round(b.amount*100)/100:null,
  knownAmount:b.knownAmount,articles:[...b.articles.values()].map(x=>noCancellationData?{...x,cancelled:null}:x).sort((a,c)=>c.orders-a.orders).slice(0,500)};
}
async function pages<T>(query:(a:number,b:number)=>Promise<{data:T[]|null;error:unknown}>){
 const out:T[]=[];for(let offset=0;;offset+=1000){const {data,error}=await query(offset,offset+999);if(error)throw error;out.push(...(data??[]));if((data?.length??0)<1000)break;}return out;
}
export async function GET(req:NextRequest){
 try{
  await financeAccess();
  const market=req.nextUrl.searchParams.get('market')??'',from=req.nextUrl.searchParams.get('from')??'',to=req.nextUrl.searchParams.get('to')??'';
  if(!['wb','ozon','yandex'].includes(market)||!validDate(from)||!validDate(to)||from>to||Date.parse(to)-Date.parse(from)>90*86400000)
   return NextResponse.json({error:'Выберите корректный период до 91 дня'},{status:400});
  const db=createAdminClient(),b={fbo:empty(),fbs:empty()};let note='',source='';
  if(market==='wb'){
   type Order={supplier_article:string;nm_id:number;warehouse_type:string;is_cancel:boolean;raw:Record<string,unknown>};
   const orders=await pages<Order>(async(a,c)=>{const r=await db.from('wb_orders').select('supplier_article,nm_id,warehouse_type,is_cancel,raw').gte('order_date',from+'T00:00:00Z').lte('order_date',to+'T23:59:59Z').order('order_date').range(a,c);return r;});
   for(const o of orders){const kind=o.warehouse_type==='Склад продавца'?'fbs':o.warehouse_type==='Склад WB'?'fbo':null;if(!kind)continue;
    const rawPrice=o.raw?.finishedPrice,price=Number(rawPrice);
    add(b[kind],o.supplier_article||String(o.nm_id),!o.is_cancel&&rawPrice!==null&&rawPrice!==undefined&&Number.isFinite(price)?price:null,o.is_cancel);
   }
   note='WB: заказы из оперативной статистики, сумма по цене покупателя finishedPrice без отмен. Это не итоговая выручка по реализации.';source='wb_orders';
  }else if(market==='yandex'){
   type Order={order_id:string;status:string};
   const orders=await pages<Order>(async(a,c)=>{const r=await db.from('yandex_orders').select('order_id,status').gte('creation_date',from).lte('creation_date',to).order('order_id').range(a,c);return r;});
   const statusById=new Map(orders.map(x=>[x.order_id,x.status])),ids=orders.map(x=>x.order_id);
   type Line={order_id:string;shop_sku:string;quantity:number;warehouse_name:string;buyer_price:number|null};
   for(let i=0;i<ids.length;i+=150){
    const lines=await pages<Line>(async(a,c)=>{const r=await db.from('yandex_order_items').select('order_id,shop_sku,quantity,warehouse_name,buyer_price').in('order_id',ids.slice(i,i+150)).order('order_id').range(a,c);return r;});
    for(const x of lines){const kind=/яндекс.?маркет/i.test(x.warehouse_name)?'fbo':/продавц/i.test(x.warehouse_name)?'fbs':null;if(!kind)continue;
     const quantity=Math.max(0,Number(x.quantity)||0),cancelled=/CANCELLED|отмен/i.test(statusById.get(x.order_id)??'');
     const price=x.buyer_price===null?null:Number(x.buyer_price);
     add(b[kind],x.shop_sku,price!==null&&Number.isFinite(price)&&!cancelled?price*quantity:null,cancelled,quantity);
    }
   }
   note='ЯМ: оперативные заказы, стоимость по цене покупателя без отмен. Схема определена по имени склада; непроверенные схемы не распределены.';source='yandex_orders';
  }else{
   type Accrual={day:string;unit_number:string;sku:string;amount:number;raw:{accrual_id?:number|string;posting?:{delivery_schema?:string}}};
   const mappings=await pages<{sku:string;offer_id:string}>(async(a,c)=>{const r=await db.from('ozon_finance_sku_map').select('sku,offer_id').eq('account_key','main').order('sku').range(a,c);return r;});
   const offerBySku=new Map(mappings.map(x=>[String(x.sku),x.offer_id]));
   const rows=await pages<Accrual>(async(a,c)=>{const r=await db.from('ozon_finance_accruals').select('day,unit_number,sku,amount,raw').eq('account_key','main').eq('accrued_category','POSTING').gte('day',from).lte('day',to).order('day').order('row_index').range(a,c);return r;});
   const postings=new Map<string,{kind:'fbo'|'fbs';article:string;amount:number;accruals:Set<string>}>();
   for(const r of rows){const schema=String(r.raw?.posting?.delivery_schema??'').toLowerCase(),kind=schema==='fbo'?'fbo':schema==='fbs'?'fbs':null;if(!kind)continue;
    const sku=String(r.sku),article=offerBySku.get(sku)??('SKU:'+sku),unit=String(r.unit_number);
    const key=kind+'|'+unit+'|'+article,entry=postings.get(key)??{kind,article,amount:0,accruals:new Set<string>()};
    const accrual=String(r.raw?.accrual_id??r.day+'|'+r.unit_number+'|'+r.amount);
    if(!entry.accruals.has(accrual)){entry.accruals.add(accrual);entry.amount+=Number(r.amount)||0;}
    postings.set(key,entry);
   }
   for(const p of postings.values())add(b[p.kind],p.article,p.amount,null);
   note='Ozon: количество уникальных отправлений из начислений; сумма включает только POSTING-начисления, не стоимость заказов. Сведения об отменах в этом источнике отсутствуют.';source='ozon_finance_accruals';
  }
  const fbo=result(b.fbo,market==='ozon'),fbs=result(b.fbs,market==='ozon');
  return NextResponse.json({ok:true,source,note,schemes:{fbo,fbw:fbo,fbs}},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){const error=e instanceof Error?e.message:'Ошибка статистики заказов';return NextResponse.json({ok:false,error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:500});}
}
