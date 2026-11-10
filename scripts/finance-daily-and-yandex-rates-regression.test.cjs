const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(
 fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,
 target:ts.ScriptTarget.ES2022,esModuleInterop:true}}
).outputText,file);
const {financialReport}=require('../lib/yandex/finance-profit.ts');
const {compositionAmounts,amounts,percentageComposition}=require('../app/components/finance/finance-series.ts');
const article='Люстра 6 рожков L25092401-B',from='2026-11-01',to='2026-11-04';
const rates=[{master_code:null,article,valid_from:'2026-10-01',cost_cents:38000,mayak_cents:1500,version:3}];
const lines=[{source:'income',sheet:'Транзакции по заказам и товарам',row:1,
 article,name:'Люстра',orderId:'A',orderDate:'2026-11-03',serviceDate:'',
 status:'Доставлен покупателю',quantity:1,price:100000,amount:100000,allocation:'sku'}];
const orders=[
 {order_id:'A',item_id:'1',article,name:'Люстра',order_date:'2026-11-03',quantity:1,status:'DELIVERY',fulfillment:'fby'},
 {order_id:'B',item_id:'2',article,name:'Люстра',order_date:'2026-11-04',quantity:1,status:'DELIVERY',fulfillment:'unknown'}
];
let result=financialReport(lines,from,to,rates,[{offer_id:article,master_code:null,name:'Люстра'}],orders,true);
assert.equal(result.rows[0].mayak,3000);
assert.equal(result.rows[0].cogs,38000);
assert.equal(result.rows[0].result,59000);
assert(result.rows[0].dataGaps.some(x=>x.includes('схема')||x.includes('Схема')));
const mixed=[...orders,{...orders[0],item_id:'3',order_id:'C',fulfillment:'fbs'}];
result=financialReport(lines,from,to,rates,[{offer_id:article,master_code:null,name:'Люстра'}],mixed,true);
assert.equal(result.rows[0].mayak,null);
assert.equal(result.rows[0].result,null);
const clean=financialReport(lines,from,to,rates,[],orders,false);
assert.equal(clean.rows[0].result,null);
const report={rows:[{offer_id:'known',revenue:1000,cogs:200,mayak_expense:30,estimated_result:500,advertising_amount:0,order_count:4,buyout_units:3},
 {offer_id:'missing',revenue:250,cogs:null,mayak_expense:null,estimated_result:null,advertising_amount:0,order_count:1,buyout_units:1}],
 advertising:{finance_total:0},ads_covered:false,unallocated_amount:0,missing_days:[]};
const whole=amounts(report,'ozon');assert.ok(whole.advertising===0);
assert.equal(whole.profit,null);
const view=compositionAmounts(report,'ozon');
assert.equal(view.provisional,true);
assert.equal(view.adUnconfirmed,true);
assert.equal(view.v.revenue,1000);
assert.equal(view.v.profit,500);
assert.equal(view.v.marketplace,270);
assert.equal(Math.round(Object.values(percentageComposition(view.v)).reduce((x,y)=>x+(y??0),0)),100);
console.log('PASS finance structure: booked Seller zero vs missing campaign reports, partial SKUs excluded; Yandex inference only when scheme homogeneous');
