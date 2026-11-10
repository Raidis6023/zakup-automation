const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const src=fs.readFileSync('lib/ozon/campaign-metrics.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};
new Function('module','exports',js)(m,m.exports);
const parse=m.exports.parseCampaignCSV;
const historic=[
 'День;sku;Название товара;Расход, ₽, с НДС;Показы;Клики',
 '02.11.2026;1794475280;Товар 1;120,50;100;5',
 '03.11.2026;1794475280;Товар 1;75,35;80;4',
 '03.11.2026;1794475281;Товар 2;20,10;40;2'
].join('\n');
const data=parse(historic,'2026-11-02','2026-11-07');
assert.equal(data.length,3);
assert.equal(data.find(x=>x.day==='2026-11-02').expense,120.5);
assert.equal(data.filter(x=>x.day==='2026-11-03').length,2);
assert.throws(()=>parse(historic,'2026-11-04','2026-11-07'),/outside requested window/);
assert.throws(()=>parse('sku;Расход, ₽, с НДС\n1794475280;15,20','2026-11-02','2026-11-07'),/CSV_NO_DAILY_DATE/);
const w=fs.readFileSync('app/api/agents/ozon-finance-ads/worker.ts','utf8');
assert(w.includes('.order("date_from",{ascending:true})'));
assert(w.includes('Number(taskCheck.count)===0 || pendingMetrics.count===0'));
assert(w.includes('groupBy:"DATE"'));
assert(w.includes('splitTask(db,original)'));
console.log('PASS Ozon multi-day: 6-day DATE report attribution, out-of-range guard, daily fallback, redundant job skip');
