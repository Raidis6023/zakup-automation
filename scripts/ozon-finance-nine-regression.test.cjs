const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const read=path=>fs.readFileSync(path,'utf8');
const cjs=ts.transpileModule(read('app/components/finance/finance-series.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleRef={exports:{}};new Function('module','exports',cjs)(moduleRef,moduleRef.exports);
const {percentageComposition,compositionAmounts,amounts}=moduleRef.exports;
const partial={orders:1,buyouts:1,revenue:1700,profit:null,marketplace:null,inbound:null,advertising:212.96};
const pct=percentageComposition(partial);
assert.equal(pct.advertising,100,'show known campaign costs without inventing missing seller entries');
assert.equal(pct.profit,null);
assert.equal(pct.inbound,null);
const report={
 rows:[{offer_id:'one',revenue:1700,estimated_result:600,cogs:500,mayak_expense:10,packing_expense:0,advertising_amount:0,performance_ad_expense:212.96,order_count:1,buyout_units:1},
       {offer_id:'two',revenue:100,estimated_result:50,cogs:20,mayak_expense:2,packing_expense:0,advertising_amount:0,performance_ad_expense:40,order_count:1,buyout_units:1}],
 advertising:{finance_total:0,partial_performance_total:252.96},ads_covered:false,unallocated_amount:0,missing_days:[]
};
assert.equal(amounts(report,'ozon','one').advertising,212.96);
assert.equal(amounts(report,'ozon','two').advertising,40);
assert.equal(compositionAmounts(report,'ozon','one').v.advertising,212.96,'do not copy company campaign spend into one SKU');
const breakdown=read('app/api/agents/finance-unallocated-operations/route.ts');
assert(breakdown.includes("category=q.get('category')??'NON_ITEM'"));
assert(breakdown.includes(".eq('run_id',active.data.active_run_id)"));
assert(breakdown.includes(".eq('accrued_category',category)"));
assert(breakdown.includes("typeId==='UNSPECIFIED'"));
const picker=read('app/components/finance/AccrualBreakdownList.tsx');
assert(picker.includes('category={item.category}'));
assert(read('app/ozon/financier/FinancierClient.tsx').includes("category:String(x.category??'NON_ITEM')"));
const cost=read('app/components/finance/CostPerUnitComparison.tsx');
assert(!cost.includes('<th>За период</th>'));
const table=read('app/ozon/financier/FinancierDetailTable.tsx');
assert(table.includes('Скрыть детализацию'));
assert(table.includes('name:profitIsPartial?"Рентабельность (предв.)"'));
assert(table.includes("name:'Реклама'"));
assert(table.includes("item.type_id==='BONUS_COMPONENT'?'Баллы за скидки'"));
assert(table.includes("item.type_id==='SALE_COMPONENT'||item.type_id==='SALES'?'Выручка от продажи'"));
const chart=read('app/components/finance/BiChart.tsx');
assert(chart.includes('const unavailable=series.every('));
assert(chart.includes('const partial=!unavailable&&series.some('));
const source=read('app/components/finance/finance-series-cache.ts');
assert(source.includes("'performance_ad_expense'"));
console.log('PASS Ozon nine-point finance review: drilldown, category, revenue, preliminary profitability, known chart parts and SKU ads');
