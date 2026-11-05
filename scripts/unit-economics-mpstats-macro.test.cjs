"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const ts=require("typescript"),fs=require("node:fs");
const old=require.extensions[".ts"];
require.extensions[".ts"]=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,p);
const {parseMacroSubjectStats,matchMacroSubject,getWbSubjectMpstatsMacro,MpStatsError}=
 require("../lib/unit-economics/mpstats-wb.ts");
if(old)require.extensions[".ts"]=old;
const entries=[
 {id:99,name:"Ватные палочки",category:"Красота"},
 {id:101,name:"Ватные палочки",category:"Детям"},
 {id:102,name:"Миски",category:"Для дома"}
];
test("macro WB exact subject + category, not an approximate product guess",()=>{
 assert.equal(matchMacroSubject(entries," Ватные  палочки ","Красота").id,"99");
 assert.equal(matchMacroSubject(entries,"Ватные палочки","Детям").id,"101");
 assert.equal(matchMacroSubject(entries,"Ватные палочки","Бытовая химия"),null);
 assert.equal(matchMacroSubject([...entries,entries[0]],"Ватные палочки","Красота"),null);
});
test("macro subject report: rounded buyout and mean(FBO,FBS) SPP",()=>{
 const x=parseMacroSubjectStats({purchase:{purchase:34.51},spp:{fbo:31.25,fbs:38.49}});
 assert.equal(x.buyoutRate,.35);
 assert.equal(x.wbSppRate,.35);
 assert.deepEqual(x.warnings,[]);
 const y=parseMacroSubjectStats({purchase:{purchase:34.27},spp:{fbo:20,fbs:25}});
 assert.equal(y.buyoutRate,.34);
 assert.equal(y.wbSppRate,.23);
});
test("macro missing metrics are null; a genuine 0 remains zero",()=>{
 const missing=parseMacroSubjectStats({purchase:{},spp:{fbo:0}});
 assert.equal(missing.buyoutRate,null);
 assert.equal(missing.wbSppRate,null);
 const zero=parseMacroSubjectStats({purchase:{purchase:0},spp:{fbo:0,fbs:0}});
 assert.equal(zero.buyoutRate,0);
 assert.equal(zero.wbSppRate,0);
 const wrong=parseMacroSubjectStats({purchase:50,spp:{fbo:102,fbs:-1}});
 assert.equal(wrong.buyoutRate,null);
 assert.equal(wrong.wbSppRate,null);
});
test("macro integration uses two authenticated GET calls and exact dated report",async()=>{
 const before=global.fetch;
 const calls=[];
 global.fetch=async(input,args)=>{
  const u=new URL(String(input));
  calls.push({url:u,method:args.method,authed:args.headers["X-Mpstats-TOKEN"]==="fake-test-token"});
  const body=u.pathname.endsWith("/get/subjects")?entries:
   u.pathname.endsWith("/subject/99")?{purchase:{purchase:82.6},spp:{fbo:22.8,fbs:31.6}}:{};
  return{ok:true,status:200,json:async()=>body};
 };
 try{
  const result=await getWbSubjectMpstatsMacro("Ватные палочки","fake-test-token","Красота");
  assert.equal(result.subjectId,"99");
  assert.equal(result.buyoutRate,.83);
  assert.equal(result.wbSppRate,.27);
  assert.equal(result.sampledProducts,0);
  assert.equal(calls.length,2);
  assert.ok(calls.every(x=>x.method==="GET"&&x.authed));
  assert.equal(calls[0].url.pathname,"/api/wb/get/subjects");
  assert.equal(calls[1].url.pathname,"/api/analytics/v1/wb/subject/99");
  assert.match(calls[1].url.searchParams.get("d1"),/^\d{4}-\d{2}-\d{2}$/);
  assert.match(calls[1].url.searchParams.get("d2"),/^\d{4}-\d{2}-\d{2}$/);
 }finally{global.fetch=before}
});
test("macro incomplete subject report returns partial metrics, no fabricated percent",async()=>{
 const before=global.fetch;
 global.fetch=async(input,args)=>({
  ok:true,status:200,json:async()=>String(input).endsWith("/subjects")?entries:{
   purchase:{},spp:{fbo:18.5,fbs:22.5}
  }
 });
 try{
  const r=await getWbSubjectMpstatsMacro("Ватные палочки","fake-test-token","Красота");
  assert.equal(r.buyoutRate,null);
  assert.equal(r.wbSppRate,.21);
  assert.ok(r.comments.some(x=>x.includes("purchase.purchase")));
  await assert.rejects(getWbSubjectMpstatsMacro("Ватные палочки","","Красота"),
   e=>e instanceof MpStatsError&&e.kind==="unconfigured");
 }finally{global.fetch=before}
});
