const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const source=fs.readFileSync('app/ozon/financier/CampaignCharts.tsx','utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};new Function('require','module','exports',code)(name=>name.includes('campaign-metrics')?require('../.campaign-build/ozon/campaign-metrics'):require(name),m,m.exports);
const points=[0,1,2].map((_,i)=>({day:'2026-10-0'+(i+1),drr:i===1?null:.1+i/10,available:i!==1}));
const html=renderToStaticMarkup(React.createElement(m.exports.Trend,{metric:{key:'drr',name:'ДРР',unit:'%',color:'#A99BFF'},points,total:.2}));
assert.ok(/20\s*%/.test(html));assert.ok(html.includes('01.10'));assert.ok(html.includes('03.10'));assert.ok(!html.includes('NaN'));assert.equal((html.match(/stroke-linejoin="round"/g)||[]).length,2);assert.ok(html.includes('tabindex="0"'));
console.log('PASS: chart SSR, correct percentage scale, keyboard focus and disconnected missing days');
