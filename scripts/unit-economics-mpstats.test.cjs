"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
const savedTs=require.extensions[".ts"];
require.extensions[".ts"]=(mod,path)=>mod._compile(ts.transpileModule(
 fs.readFileSync(path,"utf8"),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText,path);
const {readSubjectBuyout,averageSubjectSpp,getWbSubjectMpstats,MpStatsError}=
 require("../lib/unit-economics/mpstats-wb.ts");
if(savedTs)require.extensions[".ts"]=savedTs;
const close=(a,b)=>assert.ok(typeof a==="number"&&Math.abs(a-b)<1e-9,
 "Expected "+b+", got "+a);

test("MPStats: only explicitly identified buyout percent accepted",()=>{
 close(readSubjectBuyout({buyout_percent:87.5}).ratio,.875);
 close(readSubjectBuyout({data:{buyoutPercent:82}}).ratio,.82);
 close(readSubjectBuyout({metrics:{buyout_rate:.62}}).ratio,.62);
 for(const unsafe of [
  {purchase:100},{purchase_percent:67},{purchase_after_return:54},
  {buyout_percent:200},{buyout_percent:"78"},{sales:80},
 ]){
  assert.equal(readSubjectBuyout(unsafe).ratio,null,JSON.stringify(unsafe));
 }
});

test("MPStats: sample SPP is weighted by actual sales, no speculative zeros",()=>{
 const x=averageSubjectSpp([
  {client_sale:20,sales:100},{client_sale:40,sales:50},
  {client_sale:99,sales:0},{client_sale:null,sales:999},
 ]);
 close(x.rate,(.2*100+.4*50)/150);
 assert.equal(x.sampled,2);
 assert.equal(averageSubjectSpp([]).rate,null);
 close(averageSubjectSpp([{client_sale:0,sales:100}]).rate,0);
});

function providerMock(options={}){
 const calls=[];
 const data={
  list:{data:[{id:34,name:"Ватные палочки",subject_group:"Гигиена"}]},
  info:{data:{buyout_percent:79.4,purchase_percent:99}},
  items:{data:[{client_sale:29,sales:40},{client_sale:32,sales:60}]},
  ...options,
 };
 return {calls,fetch:async(input,request)=>{
  const url=new URL(String(input));
  calls.push({pathname:url.pathname,method:request.method,query:url.searchParams,
   authorization:request.headers["X-Mpstats-TOKEN"]==="test-secret"});
  const body=url.pathname.endsWith("/subject/list")?data.list:
    url.pathname.endsWith("/subject/34")?data.info:
    url.pathname.endsWith("/subject/items")?data.items:{};
  return {ok:true,status:200,json:async()=>body};
 }};
}

test("MPStats: after category confirmation fetch and normalize subject averages",async()=>{
 const previous=global.fetch,provider=providerMock();
 global.fetch=provider.fetch;
 try{
  const output=await getWbSubjectMpstats("Ватные палочки",true,"test-secret","Гигиена");
  close(output.buyoutRate,.794);
  close(output.wbSppRate,.308);
  assert.equal(output.subjectId,"34");
  assert.equal(output.sampledProducts,2);
  assert.equal(provider.calls.length,3);
  assert.deepEqual(provider.calls.map(x=>x.method),["POST","GET","POST"]);
  assert.equal(provider.calls[2].query.get("fbs"),"1");
  assert.ok(provider.calls.every(x=>x.authorization));
 }finally{global.fetch=previous}
});

test("MPStats: no fake buyout when source only provides purchase rate",async()=>{
 const previous=global.fetch,provider=providerMock({info:{data:{purchase_percent:97,purchase:115}}});
 global.fetch=provider.fetch;
 try{
  const output=await getWbSubjectMpstats("Ватные палочки",true,"test-secret","Гигиена");
  assert.equal(output.buyoutRate,null);
  close(output.wbSppRate,.308);
  assert.ok(output.comments.some(x=>x.includes("выкупа")));
 }finally{global.fetch=previous}
});

test("MPStats: duplicated WB names require category group to disambiguate",async()=>{
 const previous=global.fetch;
 const p=providerMock({list:{data:[
  {id:35,name:"Ватные палочки",subject_group:"Дети"},
  {id:34,name:"Ватные палочки",subject_group:"Гигиена"}
 ]}});
 global.fetch=p.fetch;
 try{
  const result=await getWbSubjectMpstats("Ватные палочки",true,"test-secret","Гигиена");
  assert.equal(result.subjectId,"34");
  await assert.rejects(
   getWbSubjectMpstats("Ватные палочки",true,"test-secret"),
   error=>error instanceof MpStatsError&&error.kind==="data-missing"
  );
 }finally{global.fetch=previous}
});

test("MPStats: token is required; never send a request without it",async()=>{
 await assert.rejects(getWbSubjectMpstats("Ватные палочки",true,""),error=>
  error instanceof MpStatsError&&error.kind==="unconfigured");
});
