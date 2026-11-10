const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('app/components/finance/finance-series.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
const moduleRef={exports:{}};
new Function('require','module','exports',code)(require,moduleRef,moduleRef.exports);
const {amounts,percentageComposition}=moduleRef.exports;
const initial={rows:[{offer_id:'sample',revenue:100,cogs:10,mayak_expense:5,
 estimated_result:20,advertising_amount:0,order_count:1,buyout_units:1}],
 advertising:{finance_total:0},ads_covered:false,unallocated_amount:0,missing_days:[]};
const missing=amounts(initial,'ozon');
// The chart represents booked Seller charges, not total campaign spending.
// Seller's zero is valid; incomplete Performance is warned about separately.
assert.ok(missing.advertising===0);
assert.ok(percentageComposition(missing).advertising===0);
const billed=amounts({...initial,advertising:{finance_total:-12}},'ozon');
assert.equal(billed.advertising,12);
const confirmed=amounts({...initial,ads_covered:true},'ozon');
assert.ok(confirmed.advertising===0);
console.log('PASS Ozon finance: booked Seller zero remains visible, campaign coverage separate; posted charges preserved');
