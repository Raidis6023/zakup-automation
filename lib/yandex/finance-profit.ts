import {calculate,netDeliveredEntries,type ConfirmedReturn,type Line,type Product} from './finance';
export type Rate={master_code:string|null;article?:string;valid_from:string;cost_cents:number|null;mayak_cents:number|null;version:number};
export type Listing={offer_id:string;master_code:string|null;name:string|null};
export type OrderQuantity={order_id:string;item_id:string;article:string;name:string;order_date:string;quantity:number;status:string;fulfillment?:'fby'|'fbs'|'unknown';in_transit_quantity?:number|null;realization_total_cents?:number|null};
export type Detail={name:string;category:string;count:number|null;amount:number|null};
export type FinancialProduct=Omit<Product,'result'>&{master_code:string|null;orders:number|null;cancelledTotal:number;unitCost:number|null;mayakUnit:number|null;cogs:number|null;mayak:number|null;result:number|null;advertising:number;storage:number;drr:number|null;roas:number|null;profitPerUnit:number|null;inTransit:number|null;transitRevenue:number|null;transitDrr:number|null;dataGaps:string[];details:Detail[];rateHistory:Rate[]};
export function financialReport(lines:Line[],from:string,to:string,rates:Rate[],listings:Listing[],orders:OrderQuantity[],ordersComplete:boolean,returns:ConfirmedReturn[]=[]){
 const base=calculate(lines,from,to,returns);const mappings=new Map(listings.map(x=>[x.offer_id,x]));
 const histories=new Map<string,Rate[]>();for(const r of rates){const key=r.master_code??'article:'+r.article;const list=histories.get(key)??[];list.push(r);histories.set(key,list);}for(const list of histories.values())list.sort((a,b)=>b.valid_from.localeCompare(a.valid_from));
 const rateAt=(master:string|null,day:string,article:string)=>((master?histories.get(master):null)?.find(r=>r.valid_from<=day)??(histories.get('article:'+article)??[]).find(r=>r.valid_from<=day));
 const within=(d:string)=>d>=from&&d<=to;
 const orderByArticle=new Map<string,OrderQuantity[]>();
 if(ordersComplete)for(const o of orders){if(!within(o.order_date))continue;const list=orderByArticle.get(o.article)??[];list.push(o);orderByArticle.set(o.article,list);}
 const products=new Map(base.rows.map(p=>[p.article,p]));
 for(const [article,os] of orderByArticle)if(!products.has(article))products.set(article,{article,name:os[0].name,delivered:0,cancelled:0,returned:0,unredeemed:0,deliveredQty:0,cancelledQty:0,returnedQty:0,unredeemedQty:0,buyouts:0,income:0,expenses:{},expense:0,result:0});
 const reportPrices=new Map<string,number>();
 for(const l of lines)if(l.source==='income'&&within(l.orderDate)&&l.orderId)reportPrices.set(l.orderId+'\0'+l.article,l.price);
 const dailyBuyouts=new Map<string,Map<string,number>>(),feeCounts=new Map<string,Record<string,number>>();
 for(const item of netDeliveredEntries(lines.filter(l=>within(l.orderDate)),returns)){
  const days=dailyBuyouts.get(item.article)??new Map<string,number>();
  days.set(item.orderDate,(days.get(item.orderDate)??0)+item.netQuantity);dailyBuyouts.set(item.article,days);
 }
 for(const l of lines)if(l.source==='expense'&&within(l.serviceDate)&&(!l.orderId||within(l.orderDate))&&l.article){const c=feeCounts.get(l.article)??{};c[l.sheet]=(c[l.sheet]??0)+1;feeCounts.set(l.article,c);}
 const rows:FinancialProduct[]=[];
 for(const p of products.values()){
  const mapping=mappings.get(p.article),master=mapping?.master_code??null,current=rateAt(master,to,p.article),gaps:string[]=[];
  let cogs:number|null=0,mayak:number|null=ordersComplete?0:null;
  for(const [day,qty] of dailyBuyouts.get(p.article)??[]){if(!qty)continue;const cost=rateAt(master,day,p.article)?.cost_cents;if(cost==null){cogs=null;gaps.push('Нет себестоимости на '+day);}else if(cogs!==null)cogs+=Math.round(qty*cost);}
  const ownOrders=orderByArticle.get(p.article)??[];
  // Some recent orders exist in the authoritative finance order report, but
  // their warehouse sync is delayed. Reuse a fulfillment model only when all
  // other orders of THIS article have the same confirmed model. If FBY/FBS
  // are mixed, never guess or fabricate a transport expense.
  const observedSchemes=new Set(ownOrders.map(o=>o.fulfillment).filter(
   (mode):mode is 'fby'|'fbs'=>mode==='fby'||mode==='fbs'));
  const inferredScheme=observedSchemes.size===1?[...observedSchemes][0]:null;
  let inferredOrders=0;
  if(!ordersComplete)gaps.push('Нет полного количества заказанных единиц');
  for(const o of ownOrders){
   if(!o.quantity)continue;
   const missingScheme=o.fulfillment==='unknown'||!o.fulfillment;
   const fulfillment=missingScheme?inferredScheme:o.fulfillment;
   if(fulfillment==='fbs')continue;
   if(fulfillment!=='fby'){mayak=null;gaps.push('Не определена схема доставки для ТК Маяк: '+o.order_id);continue;}
   if(missingScheme)inferredOrders+=o.quantity;
   const cost=rateAt(master,o.order_date,p.article)?.mayak_cents;
   if(cost==null){mayak=null;gaps.push('Нет ТК Маяк на '+o.order_date);}
   else if(mayak!==null)mayak+=Math.round(o.quantity*cost);
  }
  if(inferredOrders)gaps.push('Схема доставки '+inferredOrders+' заказанных ед. уточнена по другим подтверждённым заказам этого артикула (предварительно)');
  const orderCount=ordersComplete?ownOrders.reduce((s,o)=>s+o.quantity,0):null;
  const result=cogs===null||mayak===null?null:p.income-p.expense-cogs-mayak;
  let inTransit:number|null=ordersComplete?0:null,openValue:number|null=ordersComplete?0:null;
  for(const o of ownOrders){
   const count=o.in_transit_quantity??(['DELIVERY','PICKUP'].includes(o.status)?o.quantity:0);
   if(inTransit!==null)inTransit+=count;if(!count)continue;
   const reportPrice=reportPrices.get(o.order_id+'\0'+o.article);
   const price=reportPrice??(o.realization_total_cents!=null&&o.quantity>0?o.realization_total_cents/o.quantity:null);
   if(price===null)openValue=null;else if(openValue!==null)openValue+=Math.round(price*count);
  }
  const transitRevenue=openValue===null?null:p.income+openValue;
  const advertising=p.expenses['Буст продаж, оплата за продажи']??0,storage=p.expenses['Платное хранение с 01.09.26']??0;
  const details:Detail[]=[{name:'Доставленные товары',category:'Доход',count:p.deliveredQty,amount:p.delivered},{name:'Отмены (другие заказы)',category:'Справочно · уже исключены',count:p.cancelledQty,amount:0},{name:'Подтверждённые возвраты доставленного',category:'Корректировка выручки',count:p.deliveredQty-p.buyouts,amount:p.income-p.delivered},{name:'Невыкупы (другие заказы)',category:'Справочно · уже исключены',count:p.unredeemedQty,amount:0},...Object.entries(p.expenses).map(([name,amount])=>({name,category:name==='Подписки'?'Распределение по выкупам':'Услуга ЯМ',count:feeCounts.get(p.article)?.[name]??null,amount:-amount})),{name:'Цена закупа × расчётные выкупы',category:'Цена закупа',count:p.buyouts,amount:cogs===null?null:-cogs},{name:'ТК Маяк × заказы FBY',category:'Внешний расход',count:ownOrders.filter(x=>x.fulfillment==='fby').reduce((s,x)=>s+x.quantity,0),amount:mayak===null?null:-mayak}];
  if(result!==null&&details.reduce((s,d)=>s+(d.amount??0),0)!==result)throw new Error('Не сошлась детализация '+p.article);
  rows.push({...p,master_code:master,orders:orderCount,cancelledTotal:p.cancelledQty+p.unredeemedQty,unitCost:current?.cost_cents??null,mayakUnit:current?.mayak_cents??null,cogs,mayak,result,advertising,storage,drr:p.income>0?advertising/p.income:null,roas:advertising!==0&&result!==null?result/Math.abs(advertising):null,profitPerUnit:p.buyouts>0&&result!==null?result/p.buyouts:null,inTransit,transitRevenue,transitDrr:transitRevenue!==null&&transitRevenue>0?Math.abs(advertising)/transitRevenue:null,dataGaps:[...new Set(gaps)],details,rateHistory:histories.get(master??'article:'+p.article)??[]});
 }
 rows.sort((a,b)=>a.result===null?b.result===null?0:1:b.result===null?-1:b.result-a.result);
 const complete=rows.every(r=>r.result!==null),knownResult=rows.reduce((s,r)=>s+(r.result??0),0)-base.totals.common;
 const cogs=rows.reduce((s,r)=>s+(r.cogs??0),0),mayak=rows.reduce((s,r)=>s+(r.mayak??0),0);
 return {...base,rows,totals:{...base.totals,cogs,mayak,knownResult,result:complete?knownResult:null,expenses:base.totals.expenses+cogs+mayak,marketplaceExpenses:base.totals.expenses,orders:ordersComplete?rows.reduce((s,r)=>s+(r.orders??0),0):null,advertising:rows.reduce((s,r)=>s+r.advertising,0)+['Буст продаж, оплата за показы','Товарные баннеры','Реклама на Маркете'].reduce((s,name)=>s+(base.common[name]??0),0),storage:rows.reduce((s,r)=>s+r.storage,0),positive:rows.filter(r=>r.result!==null&&r.result>0).length,negative:rows.filter(r=>r.result!==null&&r.result<0).length,profitability:complete&&base.totals.income>0?knownResult/base.totals.income:null},complete,ordersComplete};
}
