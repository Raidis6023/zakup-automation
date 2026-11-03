import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {validDate} from '../../../../lib/yandex/finance';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
type Raw=Record<string,unknown>;
const msg=(v:unknown)=>v instanceof Error?v.message:'Не удалось получить поисковую аналитику';
async function request(url:string,headers:Record<string,string>,payload:Raw){
 const r=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(48000)});
 const body=await r.text();let value:unknown;try{value=JSON.parse(body)}catch{value={message:body.slice(0,240)}}
 if(!r.ok){const hint=r.status===429?'Лимит запросов маркетплейса':r.status===403?'Нет доступа или платной аналитики':r.status===401?'Неверный ключ доступа':'Ошибка провайдера';throw Error(hint+' (HTTP '+r.status+'): '+JSON.stringify(value).slice(0,220));}
 return value as Raw;
}
const n=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:typeof x==='string'&&x.trim()&&Number.isFinite(Number(x))?Number(x):null;
export async function GET(req:NextRequest){try{
 await financeAccess();
 const p=req.nextUrl.searchParams,market=p.get('market')??'',article=p.get('article')?.trim()??'',from=p.get('from')??'',to=p.get('to')??'';
 if(!['wb','ozon','yandex'].includes(market)||!article||article.length>170||!validDate(from)||!validDate(to)||to<from||Date.parse(to)-Date.parse(from)>30*86400000)
  return NextResponse.json({error:'Укажите маркетплейс, артикул и период до 31 дня'},{status:400});
 if(market==='yandex')return NextResponse.json({ok:true,market,items:[],note:'Яндекс Маркет предоставляет в Seller API товарную воронку (показы, клики, корзины, заказы), но в доступных отчётах не гарантирует привязку всех показателей к тексту конкретного поискового запроса. Запросы, стоимость и выкупы на уровне фразы нельзя достоверно восстановить из общей статистики.',limitations:['search_text','keyword_cost','keyword_buyouts'],source:'Yandex Market seller reporting',coverage:'not_available'});
 const db=createAdminClient();
 if(market==='wb'){
  if(!/^\d{5,15}$/.test(article))return NextResponse.json({error:'Для WB нужен числовой Артикул WB (nmId)'},{status:400});
  const key=(process.env.WB_ANALYTICS_TOKEN||process.env.WB_READ_TOKEN||process.env.WB_TEST_TOKEN||'').trim();
  if(!key)return NextResponse.json({error:'Не настроен токен аналитики WB'},{status:503});
  const value=await request('https://seller-analytics-api.wildberries.ru/api/v2/search-report/product/search-texts',{Authorization:key},{
   currentPeriod:{start:from,end:to},nmIds:[Number(article)],topOrderBy:'openCard',includeSubstitutedSKUs:true,includeSearchTexts:true,
   orderBy:{field:'openCard',mode:'desc'},limit:30
  });
  const outer=value.data as Raw|undefined;
  const raw=Array.isArray(outer?.items)?outer.items:Array.isArray(value.items)?value.items:[];
  const items=(raw as unknown[]).filter(x=>x&&typeof x==='object').map(x=>{
   const r=x as Raw;
   const period=r.currentPeriod as Raw|undefined;
   const d=period??r,values:{[key:string]:number|null}={
    frequency:n(r.frequency??d.frequency),openCard:n(d.openCard),addToCart:n(d.addToCart),
    openToCart:n(d.openToCart),orders:n(d.orders),cartToOrder:n(d.cartToOrder),
    avgPosition:n(d.avgPosition)
   };
   return {query:String(r.text??r.searchText??''),values,raw:r};
  });
  return NextResponse.json({ok:true,market,items,source:'WB search-report/product/search-texts',coverage:'provider_response',note:'Топ поисковых фраз по артикулу WB. Состав и доступность метрик зависят от тарифа WB Джем и прав токена. Частота, открытия карточки, корзины, заказы и конверсии показываются только если они реально пришли. Расход и выкупы по отдельной фразе этот метод не подтверждает. Лимит может составлять 1 запрос в час на базовом тарифе.',limitations:['keyword_cost','keyword_buyouts']},{headers:{'Cache-Control':'private,no-store'}});
 }
 const client=process.env.OZON_CLIENT_ID,key=process.env.OZON_API_KEY;
 if(!client||!key)return NextResponse.json({error:'Не настроены ключи Ozon'},{status:503});
 let sku=article.replace(/^SKU:/,'');
 if(!/^\d+$/.test(sku)){
  const r=await db.from('ozon_finance_sku_map').select('sku').eq('account_key','main').eq('offer_id',article).limit(1).maybeSingle();
  if(r.error)throw r.error;if(!r.data?.sku)return NextResponse.json({error:'Не найден SKU Ozon для '+article},{status:404});sku=String(r.data.sku);
 }
 const value=await request('https://api-seller.ozon.ru/v1/analytics/product-queries/details',{'Client-Id':client,'Api-Key':key},{
  date_from:from+'T00:00:00Z',date_to:to+'T23:59:59Z',limit_by_sku:100,page:0,page_size:100,skus:[sku],sort_by:'BY_SEARCHES',sort_dir:'DESCENDING'
 });
 const raw=Array.isArray(value.queries)?value.queries:[];
 const items=(raw as unknown[]).filter(x=>x&&typeof x==='object').map(x=>{
  const r=x as Raw;return {query:String(r.query??''),values:{
   searches:n(r.unique_search_users),views:n(r.unique_view_users),viewConversion:n(r.view_conversion),
   orders:n(r.order_count),revenue:n(r.gmv),position:n(r.position),queryIndex:n(r.query_index)
  },raw:r};
 });
 return NextResponse.json({ok:true,market,items,source:'Ozon /v1/analytics/product-queries/details',coverage:'provider_response',note:'Показатели Ozon по каждому поисковому запросу (число пользователей, увидевших товар, конверсия в просмотр, заказы и GMV). Доступ зависит от Premium. У этого метода нет достоверной стоимости рекламной фразы, добавлений в корзину или выкупов по запросу.',limitations:['keyword_cost','keyword_cart','keyword_buyouts']},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){const message=msg(e);return NextResponse.json({error:message},{status:/Авторизац/i.test(message)?401:/Недостаточно прав/.test(message)?403:/Лимит запросов/.test(message)?429:502,headers:{'Cache-Control':'private,no-store'}});}
}
