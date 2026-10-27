const assert=require('node:assert/strict');
const {financialReport}=require('../.profit-build/lib/yandex/finance-profit');
const {orderQuantities}=require('../.profit-build/lib/yandex/finance-orders');
const inc=(article,day,qty=1)=>({source:'income',sheet:'orders',row:1,article,name:article,orderId:article+day,orderDate:day,serviceDate:'',status:'Доставлен покупателю',quantity:qty,price:10000,amount:10000*qty,allocation:'sku'});
const exp={...inc('A','2026-10-01'),source:'expense',sheet:'Буст продаж, оплата за продажи',serviceDate:'2026-10-02',amount:1000};
const order=(article,day,qty)=>({order_id:article+day,item_id:'1',article,name:article,order_date:day,quantity:qty,status:'DELIVERED'});
const listing=[{offer_id:'A',master_code:'000AAA',name:'A'},{offer_id:'B',master_code:'000AAA',name:'B'}];
const rates=[{master_code:'000AAA',valid_from:'2026-10-01',cost_cents:2000,mayak_cents:300,version:1},{master_code:'000AAA',valid_from:'2026-10-15',cost_cents:4000,mayak_cents:500,version:1}];
let r=financialReport([inc('A','2026-10-01'),inc('A','2026-10-16'),exp],'2026-10-01','2026-10-26',rates,listing,[order('A','2026-10-01',2),order('A','2026-10-16',3)],true);
assert.equal(r.rows[0].cogs,6000);assert.equal(r.rows[0].mayak,2100);assert.equal(r.rows[0].orders,5);assert.equal(r.rows[0].result,10900);assert.equal(r.rows[0].drr,.05);assert.equal(r.rows[0].roas,10.9);assert.equal(r.rows[0].profitPerUnit,5450);
assert.equal(r.rows[0].details.reduce((s,d)=>s+d.amount,0),r.rows[0].result);
// In-transit value uses each order's actual realization price, not catalogue prices.
const pending={...order('A','2026-10-02',3),status:'DELIVERY',in_transit_quantity:2,realization_total_cents:45000};
let transit=financialReport([inc('A','2026-10-01'),exp],'2026-10-01','2026-10-26',rates,listing,[pending],true).rows[0];
assert.equal(transit.inTransit,2);assert.equal(transit.transitRevenue,40000);assert.equal(transit.transitDrr,.025);
const invoicePrice={...inc('A','2026-10-02'),status:'В пути',price:12000};
transit=financialReport([inc('A','2026-10-01'),invoicePrice,exp],'2026-10-01','2026-10-26',rates,listing,[pending],true).rows[0];
assert.equal(transit.transitRevenue,34000); // N takes priority over the raw total.
transit=financialReport([inc('A','2026-10-01')],'2026-10-01','2026-10-26',rates,listing,[{...pending,realization_total_cents:null}],true).rows[0];
assert.equal(transit.transitRevenue,null);assert.equal(transit.transitDrr,null);
transit=financialReport([inc('A','2026-10-01')],'2026-10-01','2026-10-26',rates,listing,[],true).rows[0];
assert.equal(transit.transitRevenue,10000);assert.equal(transit.transitDrr,0);
const parsed=orderQuantities({orders:[{orderId:7,creationDate:'2026-10-02',status:'PICKUP',items:[{id:1,offerId:'A',count:3,prices:{payment:{value:200,currencyId:'RUR'},cashback:{value:20,currencyId:'RUR'},subsidy:{value:80,currencyId:'RUR'}},itemStatuses:[{status:'SHIPPED',count:1},{status:'DELIVERED_TO_BUYER',count:1},{status:'REJECTED',count:1}]}]}]})[0];
assert.equal(parsed.in_transit_quantity,1);assert.equal(parsed.realization_total_cents,30000);
// Prices are already a total for three units, so one pending unit is 100 RUB.
assert.equal(financialReport([],'2026-10-01','2026-10-26',rates,listing,[parsed],true).rows[0].transitRevenue,10000);
r=financialReport([inc('A','2026-10-01')],'2026-10-01','2026-10-10',rates,listing,[order('A','2026-10-01',2)],true);assert.equal(r.rows[0].cogs,2000);assert.equal(r.rows[0].mayak,600);
r=financialReport([inc('A','2026-10-01'),inc('B','2026-10-01')],'2026-10-01','2026-10-26',rates,listing,[order('A','2026-10-01',1),order('B','2026-10-01',2)],true);assert.equal(r.totals.cogs,4000);assert.equal(r.totals.mayak,900);
r=financialReport([inc('C','2026-10-01')],'2026-10-01','2026-10-26',rates,listing,[order('C','2026-10-01',1)],true);assert.equal(r.rows[0].result,null);assert.equal(r.totals.result,null);
r=financialReport([inc('C','2026-10-01')],'2026-10-01','2026-10-26',[{master_code:null,article:'C',valid_from:'2026-10-01',cost_cents:0,mayak_cents:0,version:1}],[],[order('C','2026-10-01',1)],true);assert.equal(r.rows[0].result,10000);
r=financialReport([inc('A','2026-10-01')],'2026-10-01','2026-10-26',rates,listing,[],false);assert.equal(r.rows[0].orders,null);assert.equal(r.rows[0].mayak,null);
r=financialReport([{...inc('A','2026-10-01'),status:'Отменён',quantity:null}],'2026-10-01','2026-10-26',rates,listing,[order('A','2026-10-01',3)],true);assert.equal(r.rows[0].mayak,900);assert.equal(r.rows[0].cogs,0);
const raw={orders:[{orderId:1,creationDate:'2026-10-01T01:00:00+03:00',status:'CANCELLED',items:[{id:11,offerId:'A',offerName:'A',count:3}]}]};assert.equal(orderQuantities(raw)[0].quantity,3);assert.throws(()=>orderQuantities({orders:[{...raw.orders[0],items:[{id:1,offerId:'A',count:-1}]}]}));
console.log('PASS: date-versioned tariffs, COGS, ordered-unit Mayak, shared ENOT, missing/zero rates, article fallback, DRR/ROAS, detail reconciliation, raw quantities and transit value/DRR');
