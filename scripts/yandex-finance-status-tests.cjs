const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('app/api/agents/yandex-finance-status/route.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
async function run({existing=null,listing=true,authorized=true,race=false,body={master_code:'000AAA',discontinued:true}}={}){
 const writes=[];const db={from(table){let op='read',patch;const query={select(){return query},eq(){return query},limit(){return query},update(value){op='write';patch=value;return query},insert(value){op='write';patch=value;return query},async single(){return query.maybeSingle()},async maybeSingle(){if(op==='write'){writes.push(patch);return {data:race?null:patch,error:null}}return {data:table==='yandex_products'?(listing?{id:1}:null):existing,error:null}}};return query}};
 const module={exports:{}};new Function('require','module','exports',js)(name=>name==='next/server'?{NextResponse:{json:(data,options)=>({data,status:options?.status??200})}}:{financeAccess:async()=>{if(!authorized)throw Error('Требуется авторизация');return db}},module,module.exports);
 const response=await module.exports.POST({json:async()=>body});return {response,writes};
}
(async()=>{
 let r=await run();assert.equal(r.response.status,200);assert.equal(r.writes[0].status,'Выводится из продажи');
 r=await run({existing:{status:'Выводится из продажи'},body:{master_code:'000AAA',discontinued:false}});assert.equal(r.writes[0].status,'Активный');
 for(const options of [{authorized:false},{listing:false},{existing:{status:'Сезонный'}},{body:{master_code:'000AAA',discontinued:'true'}}]){r=await run(options);assert.notEqual(r.response.status,200);assert.equal(r.writes.length,0)}
 r=await run({race:true,existing:{status:'Активный'}});assert.equal(r.response.status,409);
 console.log('PASS: authenticated status edits, persistence, special-status protection, validation and conflict response');
})().catch(e=>{console.error(e);process.exitCode=1});
