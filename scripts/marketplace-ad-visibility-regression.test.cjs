const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync('lib/ozon/advertising-presentation.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const obj={exports:{}};
new Function('module','exports',code)(obj,obj.exports);
const {advertisingDisplay}=obj.exports;
assert.deepEqual(advertisingDisplay(0,430,false),{amount:-430,kind:'performance_partial'});
assert.deepEqual(advertisingDisplay(0,null,false),{amount:null,kind:'unknown'});
assert.deepEqual(advertisingDisplay(0,0,true),{amount:0,kind:'confirmed_zero'});
assert.deepEqual(advertisingDisplay(-300,430,false),{amount:-300,kind:'seller'});
assert.deepEqual(advertisingDisplay(null,430,false),{amount:-430,kind:'performance_partial'});
assert.deepEqual(advertisingDisplay(null,null,false),{amount:null,kind:'unknown'});
const worker=fs.readFileSync('app/api/agents/yandex-finance-campaigns/worker.ts','utf8');
assert(worker.includes(".eq('status','requested')"));
assert(worker.indexOf(".eq('status','requested')")<worker.indexOf(".eq('status','pending')"));
assert(worker.includes("scope?.priority==='oldest'"));
assert(worker.includes("if(financeBusy)return"));
const finance=fs.readFileSync('app/api/agents/ozon-finance/route.ts','utf8');
assert(finance.includes("const observed=new Set(row.details.filter(x=>!x.is_reference).map(x=>x.type_id))"));
assert(finance.indexOf("const observed=new Set(row.details.filter")>
 finance.indexOf("for(const [offer,map] of drillByOffer)"));
assert(!finance.includes("const saleWithoutFees="));
console.log('PASS Ozon KPI Seller vs Performance; Ozon fee completeness after itemization; Yandex queue safety');
