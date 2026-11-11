const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('lib/ozon/advertising-presentation.ts','utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleHolder={exports:{}};new Function('module','exports',transpiled)(moduleHolder,moduleHolder.exports);
const {advertisingDisplay}=moduleHolder.exports;
assert.deepEqual(advertisingDisplay(-165373,1156627.44,true),
 {amount:-1156627.44,kind:'performance_complete'});
assert.deepEqual(advertisingDisplay(-165373,83000,false),
 {amount:-83000,kind:'performance_partial'});
assert.deepEqual(advertisingDisplay(-165373,null,false),
 {amount:-165373,kind:'seller'});
assert.deepEqual(advertisingDisplay(-165373,0,true),
 {amount:0,kind:'confirmed_zero'});
const ui=fs.readFileSync('app/ozon/financier/FinancierDetailTable.tsx','utf8');
assert(ui.indexOf('if(r.performance_ad_expense!=null)')<ui.indexOf('if(r.advertising_amount!==0)'));
assert(ui.includes('Реклама Performance'));
assert(ui.includes('Финансовые начисления Seller за тот же период'));
const ymRoute=fs.readFileSync('app/api/agents/yandex-finance/route.ts','utf8');
assert(ymRoute.includes('partial_coverage:true'));
assert(ymRoute.includes('availableTo'));
assert(ymRoute.includes('failedIsNew'));
const ymClient=fs.readFileSync('app/yandex-market/financier/YandexFinancierClient.tsx','utf8');
assert(ymClient.includes('coverage_warning'));
assert(ymClient.includes('sourceAudit'));
const ymCache=fs.readFileSync('lib/yandex/finance-cache.ts','utf8');
assert(ymCache.includes('status:audit.has(name)'));
assert(ymCache.includes('amount:audit.get(name)?.amount??null'));
const cron=fs.readFileSync('app/api/agents/yandex-finance-cron/route.ts','utf8');
assert(cron.includes('YANDEX_FINANCE_CRON_SECRET'));
assert(cron.includes('advancePromotion'));
assert(cron.includes('promotionPolled'));
assert(cron.includes('Date.parse(ctl.data.next_request_at)>Date.now()'));
console.log('PASS finance: Ozon Performance 14-day campaign KPI separate from Seller P&L; YM ready historical partial, missing service sheets not zero, live report priority');
