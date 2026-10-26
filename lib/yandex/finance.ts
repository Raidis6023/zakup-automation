export const RULE_VERSION = 'yandex-finance-2026-10-26-v1';
export type Line = {source:'income'|'expense';sheet:string;row:number;article:string;name:string;orderId:string;orderDate:string;serviceDate:string;status:string;quantity:number|null;price:number;amount:number;allocation:'sku'|'common'|'subscription'};
export const rules = [
 ['Размещение товаров и услуг','AJ','Стоимость услуги без скидок','J','H','I','AH','sku'],
 ['Программа лояльности и отзывы','P','Тариф за шт.','I','H','','U','sku'],
 ['Буст продаж, оплата за показы','T','Стоимость услуги','','','','R','common'],
 ['Товарные баннеры','S','Стоимость услуги','','','','Q','common'],
 ['Буст продаж, оплата за продажи','Q','Постоплата','I','H','','T','sku'],
 ['Доставка покупателю','AK','Стоимость услуги','J','H','I','AI','sku'],
 ['Доставка (средняя миля)','Z','Тариф за шт.','J','H','I','AG','sku'],
 ['Приём платежа','P','Стоимость услуги','I','H','','N','sku'],
 ['Перевод платежа','R','Стоимость услуги','J','H','I','P','sku'],
 ['Платное хранение с 01.09.26','Z','Стоимость платного хранения','I','','','X','sku'],
 ['Поставка через транзитный склад','AB','Стоимость услуги','','','','Z','common'],
 ['Приём излишков на складе','O','Стоимость услуги','J','','','M','sku'],
 ['Обработка заказов на складе','O','Стоимость услуги','','H','I','M','common'],
 ['Подписки','L','Стоимость услуги','','','','J','subscription'],
] as const;
export function validDate(x:string){return /^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;}
export function date(x:unknown):string {
 const s=String(x??'').trim(); if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 const m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';
}
export function numeric(x:unknown):number|null {if(x==null||String(x).trim()==='')return null;const n=Number(String(x).replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:null;}
export function cents(x:unknown){const n=numeric(x);if(n===null)throw new Error(`Не числовая сумма: ${String(x).slice(0,60)}`);return Math.round(n*100);}
export type Product = {article:string;name:string;delivered:number;cancelled:number;returned:number;unredeemed:number;deliveredQty:number;cancelledQty:number;returnedQty:number;unredeemedQty:number;buyouts:number;income:number;expenses:Record<string,number>;expense:number;result:number};
export function calculate(lines:Line[],from:string,to:string){
 if(!validDate(from)||!validDate(to)||from>to)throw new Error('Некорректный период');
 const within=(d:string)=>validDate(d)&&d>=from&&d<=to;
 const products=new Map<string,Product>();
 function product(l:Line){let p=products.get(l.article);if(!p){p={article:l.article,name:l.name,delivered:0,cancelled:0,returned:0,unredeemed:0,deliveredQty:0,cancelledQty:0,returnedQty:0,unredeemedQty:0,buyouts:0,income:0,expenses:{},expense:0,result:0};products.set(l.article,p);}return p;}
 const excluded:Array<{sheet:string;row:number;article:string;orderId:string;reason:string;amount:number}>=[];
 const warnings:Array<{sheet:string;row:number;article:string;orderId:string;reason:string}>=[];
 const articleTotals:Record<string,number>={};const common:Record<string,number>={};let subscription=0;let includedIncomeRows=0;let includedExpenseRows=0;
 function reject(l:Line,reason:string){excluded.push({sheet:l.sheet,row:l.row,article:l.article,orderId:l.orderId,reason,amount:l.amount});}
 for(const l of lines){
  if(l.source==='income'){
   if(!within(l.orderDate)){reject(l,l.orderDate?'Заказ создан вне периода':'Не установлена дата создания заказа');continue;}
   let kind:'delivered'|'cancelled'|'returned'|'unredeemed'|null=null;
   const s=l.status.toLowerCase().replace(/ё/g,'е');
   if(s.includes('возврат'))kind='returned';else if(s.includes('невыкуп'))kind='unredeemed';else if(s.includes('отменен'))kind='cancelled';else if(s==='доставлен покупателю')kind='delivered';
   if(!kind)continue;
   if(!l.article){reject(l,'Нет артикула');continue;}
   const p=product(l);includedIncomeRows++;
   if(l.quantity===null){warnings.push({sheet:l.sheet,row:l.row,article:l.article,orderId:l.orderId,reason:'Пусто в V «Передано в доставку». Сумма N × V не рассчитана'});continue;}
   const qty=l.quantity;const amount=Math.round(l.price*qty);
   p[kind]+=amount;p[`${kind}Qty`]+=qty;
  } else {
   if(!within(l.serviceDate)){reject(l,l.serviceDate?'Дата услуги вне периода':'Не установлена дата услуги');continue;}
   if(l.orderId&&!within(l.orderDate)){reject(l,l.orderDate?'Заказ создан вне периода':'Не установлена дата создания заказа');continue;}
   includedExpenseRows++;articleTotals[l.sheet]=(articleTotals[l.sheet]??0)+l.amount;
   if(l.allocation==='subscription'){subscription+=l.amount;continue;}
   if(l.allocation==='common'||!l.article){common[l.sheet]=(common[l.sheet]??0)+l.amount;continue;}
   const p=product(l);p.expenses[l.sheet]=(p.expenses[l.sheet]??0)+l.amount;
  }
 }
 for(const p of products.values()){p.income=p.delivered-p.cancelled-p.returned-p.unredeemed;p.buyouts=p.deliveredQty-p.cancelledQty-p.returnedQty-p.unredeemedQty;}
 const weights=[...products.values()].filter(p=>p.buyouts>0).sort((a,b)=>a.article.localeCompare(b.article));
 const denominator=weights.reduce((s,p)=>s+p.buyouts,0);
 if(subscription&&denominator){
  const total=Math.abs(subscription);const allocations=weights.map(p=>{const exact=total*p.buyouts/denominator;return {p,n:Math.floor(exact),remainder:exact-Math.floor(exact)}});
  let residual=total-allocations.reduce((s,a)=>s+a.n,0);allocations.sort((a,b)=>b.remainder-a.remainder||a.p.article.localeCompare(b.p.article));
  for(const a of allocations){if(residual>0){a.n++;residual--;}a.p.expenses['Подписки']=a.n*Math.sign(subscription);}
 }else if(subscription)common['Подписки']=subscription;
 const rows=[...products.values()].map(p=>{p.expense=Object.values(p.expenses).reduce((s,v)=>s+v,0);p.result=p.income-p.expense;return p;}).sort((a,b)=>b.result-a.result);
 const totals={income:rows.reduce((s,p)=>s+p.income,0),allocated:rows.reduce((s,p)=>s+p.expense,0),common:Object.values(common).reduce((s,v)=>s+v,0),expenses:Object.values(articleTotals).reduce((s,v)=>s+v,0),result:0,buyouts:rows.reduce((s,p)=>s+p.buyouts,0),subscription,subscriptionDenominator:denominator};
 totals.result=totals.income-totals.expenses;
 if(totals.expenses!==totals.allocated+totals.common)throw new Error('Не сошлась сверка распределённых расходов');
 return {ruleVersion:RULE_VERSION,from,to,rows,totals,articleTotals,common,excluded,warnings,includedIncomeRows,includedExpenseRows};
}
