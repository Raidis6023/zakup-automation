const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const source=fs.readFileSync('app/ozon/financier/CampaignCharts.tsx','utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};new Function('require','module','exports',code)(name=>name.includes('campaign-metrics')?require('../.campaign-build/ozon/campaign-metrics'):require(name),m,m.exports);
const points=[0,1,2].map((_,i)=>({day:'2026-10-0'+(i+1),drr:i===1?null:.1+i/10,available:i!==1}));
const html=renderToStaticMarkup(React.createElement(m.exports.Trend,{metric:{key:'drr',name:'ДРР',unit:'%',color:'#A99BFF'},points,total:.2}));
assert.ok(/20\s*%/.test(html));assert.ok(html.includes('01.10'));assert.ok(html.includes('03.10'));assert.ok(!html.includes('NaN'));assert.equal((html.match(/stroke-linejoin="round"/g)||[]).length,2);assert.ok(html.includes('tabindex="0"'));
console.log('PASS: chart SSR, correct percentage scale, keyboard focus and disconnected missing days');
let active=null,hook=0;const hookReact={...React,useId:()=>':test:',useState:initial=>{const index=hook++;return [index===0?active:initial,value=>{if(index===0)active=typeof value==='function'?value(active):value;}];}};
const interactive={exports:{}};new Function('require','module','exports',code)(name=>name==='react'?hookReact:name.includes('campaign-metrics')?require('../.campaign-build/ozon/campaign-metrics'):require(name),interactive,interactive.exports);
const metric={key:'drr',name:'ДРР',unit:'%',color:'#A99BFF'};
const create=()=>{hook=0;return interactive.exports.Trend({metric,points,total:.2});};
function find(node,type){if(!node||typeof node!=='object')return null;if(node.type===type)return node;const kids=React.Children.toArray(node.props?.children);for(const child of kids){const found=find(child,type);if(found)return found;}return null;}
const svg=find(create(),'svg');svg.props.onPointerMove({clientX:820,currentTarget:{getBoundingClientRect:()=>({left:0,width:840})}});assert.equal(active,2);
const tooltipHTML=renderToStaticMarkup(create());assert.ok(tooltipHTML.includes('ozf-chart-tooltip'));assert.ok(tooltipHTML.includes('03.10.2026'));assert.ok(/30\s*%/.test(tooltipHTML));
svg.props.onPointerMove({clientX:446,currentTarget:{getBoundingClientRect:()=>({left:0,width:840})}});assert.equal(active,1);assert.ok(renderToStaticMarkup(create()).includes('02.10.2026'));
assert.ok(!html.includes('Динамика по дням'));assert.ok(!html.includes('к первому дню'));
console.log('PASS: pointer selects date/value tooltip, missing-day tooltip and removed chart captions');

assert.equal(m.exports.dailyAverage([{available:true,clicks:4},{available:true,clicks:0},{available:false,clicks:null}], 'clicks'),2);
assert.equal(m.exports.dailyAverage([{available:false,clicks:null}], 'clicks'),null);
assert.equal(m.exports.dailyAverage([{available:true,clicks:1},{available:true,clicks:2}], 'clicks'),1.5);
console.log('PASS: daily average includes confirmed zero, excludes missing days, keeps fractions');
