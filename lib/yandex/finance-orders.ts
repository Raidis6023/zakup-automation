import {validDate} from './finance';
import type {OrderQuantity} from './finance-profit';
export function orderQuantities(payload:unknown):OrderQuantity[]{
 if(!payload||typeof payload!=='object'||!Array.isArray((payload as {orders?:unknown}).orders))throw new Error('ЯМ не вернул список заказов');
 const out:OrderQuantity[]=[];
 for(const o of (payload as {orders:Array<{orderId:number;creationDate:string;status:string;fake?:boolean;items:Array<{id:number;offerId:string;offerName:string;count:number}>}>}).orders){
  if(o.fake)continue;const day=String(o.creationDate).slice(0,10);if(!validDate(day)||!o.orderId||!Array.isArray(o.items))throw new Error('Некорректная запись заказа');
  for(const i of o.items){if(i.id==null||!i.offerId||!Number.isInteger(i.count)||i.count<0)throw new Error('Некорректное количество в заказе '+o.orderId);out.push({order_id:String(o.orderId),item_id:String(i.id),article:i.offerId,name:i.offerName??'',order_date:day,quantity:i.count,status:o.status});}
 }return out;
}
