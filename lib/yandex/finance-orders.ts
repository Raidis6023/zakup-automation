import {validDate} from './finance';
import type {OrderQuantity} from './finance-profit';
type Money={value:number;currencyId:string};
type Item={id:number;offerId:string;offerName:string;count:number;prices?:{payment?:Money|null;subsidy?:Money|null;cashback?:Money|null};itemStatuses?:Array<{status:string;count:number}>|null};
function realizationTotal(i:Item):number|null{
 if(!i.prices?.payment)return null;let total=0;
 for(const part of [i.prices.payment,i.prices.cashback,i.prices.subsidy]){
  if(!part)continue;if(!['RUR','RUB'].includes(part.currencyId)||!Number.isFinite(part.value)||part.value<0)return null;
  total+=Math.round(part.value*100);
 }return total;
}
export function orderQuantities(payload:unknown):OrderQuantity[]{
 if(!payload||typeof payload!=='object'||!Array.isArray((payload as {orders?:unknown}).orders))throw new Error('ЯМ не вернул список заказов');
 const out:OrderQuantity[]=[];
 for(const o of (payload as {orders:Array<{orderId:number;creationDate:string;status:string;fake?:boolean;items:Item[]}>}).orders){
  if(o.fake)continue;const day=String(o.creationDate).slice(0,10);if(!validDate(day)||!o.orderId||!Array.isArray(o.items))throw new Error('Некорректная запись заказа');
  for(const i of o.items){if(i.id==null||!i.offerId||!Number.isInteger(i.count)||i.count<0)throw new Error('Некорректное количество в заказе '+o.orderId);
   if(i.itemStatuses?.some(s=>!Number.isInteger(s.count)||s.count<0)||i.itemStatuses&&i.itemStatuses.reduce((s,x)=>s+x.count,0)>i.count)throw new Error('Некорректные статусы товара '+o.orderId);
   const transit=['DELIVERY','PICKUP'].includes(o.status)?(i.itemStatuses?.length?i.itemStatuses.filter(s=>s.status==='SHIPPED').reduce((s,x)=>s+x.count,0):i.count):0;
   out.push({order_id:String(o.orderId),item_id:String(i.id),article:i.offerId,name:i.offerName??'',order_date:day,quantity:i.count,status:o.status,in_transit_quantity:transit,realization_total_cents:realizationTotal(i)});
  }
 }return out;
}
