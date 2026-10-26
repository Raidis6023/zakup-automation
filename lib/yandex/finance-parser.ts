import * as XLSX from 'xlsx';
import {rules,date,numeric,cents,type Line} from './finance';
type Cells=Record<string,unknown>;
function rows(w:XLSX.WorkBook,name:string):Cells[]{const s=w.Sheets[name];if(!s)throw new Error(`Отсутствует лист «${name}»`);const a=XLSX.utils.sheet_to_json<unknown[]>(s,{header:1,raw:true,defval:null,range:0});return a.map((r,i)=>Object.fromEntries([['__row',i+1],...r.map((v,j)=>[XLSX.utils.encode_col(j),v]) ]));}
const text=(x:unknown)=>String(x??'').trim();
function header(rs:Cells[],col:string,expected:string){const n=rs.findIndex(r=>text(r[col]).startsWith(expected));if(n<0)throw new Error(`Изменена структура: столбец ${col}, ожидается «${expected}»`);return n;}
export function parseWorkbooks(services:XLSX.WorkBook,orders:XLSX.WorkBook):Line[]{
 const result:Line[]=[];const rs=rows(orders,'Транзакции по заказам и товарам');const h=header(rs,'Y','Статус товара');
 if(!text(rs[h].N).startsWith('Ваша цена')||!text(rs[h].V).startsWith('Передано в доставку')||!text(rs[h].J).startsWith('Дата оформления'))throw new Error('Изменена структура сводки заказов');
 const orderDates=new Map<string,string>();
 for(const r of rs.slice(h+1)){
  const orderId=text(r.H),article=text(r.L);if(!orderId||!article)continue;
  const d=date(r.J);const prev=orderDates.get(orderId);if(prev&&d&&prev!==d)throw new Error('Противоречивые даты заказа '+orderId);if(d)orderDates.set(orderId,d);
  const price=cents(r.N),quantity=numeric(r.V);if(quantity!==null&&quantity<0)throw new Error('Отрицательное количество в V');
  result.push({source:'income',sheet:'Транзакции по заказам и товарам',row:Number(r.__row),article,name:text(r.M),orderId,orderDate:d,serviceDate:'',status:text(r.Y),quantity,price,amount:quantity===null?0:Math.round(price*quantity),allocation:'sku'});
 }
 for(const [sheet,col,label,sku,order,created,service,allocation] of rules){
  const sr=rows(services,sheet);const start=header(sr,col,label);
  for(const r of sr.slice(start+1)){
   if(!numeric(r.A)||r[col]===null||r[col]===undefined||r[col]==='')continue;
   const orderId=order?text(r[order]):'';
   const orderDate=orderDates.get(orderId)||(created?date(r[created]):'');
   const article=sku?text(r[sku]):'';
   const name=sku?text(r[XLSX.utils.encode_col(XLSX.utils.decode_col(sku)+1)]):'';
   result.push({source:'expense',sheet,row:Number(r.__row),article,name,orderId,orderDate,serviceDate:date(r[service]),status:'',quantity:null,price:0,amount:cents(r[col]),allocation});
  }
 }
 return result;
}
