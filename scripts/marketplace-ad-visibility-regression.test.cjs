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
assert.deepEqual(advertisingDisplay(-300,430,false),{amount:-430,kind:'performance_partial'});
assert.deepEqual(advertisingDisplay(-165373,1156627.44,true),{amount:-1156627.44,kind:'performance_complete'});
assert.deepEqual(advertisingDisplay(-300,null,false),{amount:-300,kind:'seller'});
assert.deepEqual(advertisingDisplay(null,430,false),{amount:-430,kind:'performance_partial'});
assert.deepEqual(advertisingDisplay(null,null,false),{amount:null,kind:'unknown'});
const worker=fs.readFileSync('app/api/agents/yandex-finance-campaigns/worker.ts','utf8');
assert(worker.includes(".eq('status','requested')"));
assert(worker.indexOf(".eq('status','requested')")<worker.indexOf(".eq('status','pending')"));
assert(worker.includes("scope?.priority==='oldest'"));
assert(worker.includes("if(financeBusy)return"));
const finance=fs.readFileSync('app/api/agents/ozon-finance/route.ts','utf8');
assert(finance.includes("g.estimated_result=calculateProvisionalSkuProfit("));
assert(!finance.includes("missingSettlement"));
assert(!finance.includes("row.estimated_result=null;"));
console.log('PASS Ozon KPI Seller vs Performance; Ozon profit not gated by optional fees; Yandex queue safety');
