const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const source=p=>fs.readFileSync(p,'utf8');
const transpiled=ts.transpileModule(source('app/components/finance/BiChart.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const moduleRef={exports:{}};
new Function('require','module','exports',transpiled)(id=>id.endsWith('.css')?{}:require(id),moduleRef,moduleRef.exports);
const html=renderToStaticMarkup(React.createElement(moduleRef.exports.default,{
 points:[{day:'2026-11-03',values:{drr:null}},{day:'2026-11-04',values:{drr:16.55}},{day:'2026-11-05',values:{drr:null}}],
 series:[{key:'drr',label:'ДРР',color:'#A99BFF'}],unit:'%',label:'ДРР'
}));
assert(html.includes('r="3"'),'an isolated day with known DRR must be visible');
assert(!html.includes('NaN'));
const css=source('app/ozon/financier/financier.css');
assert(css.includes('.ozf-page table.ozf-financial-table thead tr > th'));
assert(css.includes('justify-content: center !important;'));
for(const path of ['app/ozon/financier/page.tsx','app/wildberries/financier/page.tsx','app/yandex-market/financier/page.tsx']){
 assert(source(path).includes('financier.css'),'shared header stylesheet absent in '+path);
}
const ym=source('app/yandex-market/financier/YandexFinanceTable.tsx');
assert(ym.includes('profit:d.result===null?(d.composition===null?null:d.composition.profit/100):d.result/100'));
assert(ym.includes('Операций» показывает количество событий'));
assert(ym.includes('r.details.filter(d=>d.amount===null||d.amount!==0||(d.count??0)>0)'));
const trend=source('app/ozon/financier/CampaignCharts.tsx');
assert(trend.includes("metric.key==='drr'&&points.some(p=>p.available&&p.drr===null)"));
console.log('PASS shared 3-market header centering, isolated campaign point, Yandex provisional graph and zero-charge explanations');
