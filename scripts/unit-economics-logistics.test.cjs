"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const oldHandler=require.extensions[".ts"];
require.extensions[".ts"]=(mod,file)=>{
 const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 mod._compile(js,file);
};
const {calculateLogistics}=require("../lib/unit-economics/logistics/engine.ts");
const {compareLogisticsReference}=require("../lib/unit-economics/logistics/reference.ts");
const {recalculateMarketplaceVolume,recalculateFinancialReference}=require("../lib/unit-economics/financial-reference.ts");
const data=require("../data/unit-economics-pilot.json");
const close=(a,b,label,tolerance=1e-7)=>assert.ok(typeof a==="number"&&Math.abs(a-b)<=tolerance,label+": "+a+" != "+b);
const num=v=>typeof v==="number"?v:Number(String(v).replace(",",".")); 
function checkProduct(p,model){
 const v=p.models[model].values,box=p.models["ozon-fbo"].values;
 const check=recalculateMarketplaceVolume(model,v,box);
 assert.ok(check.audit.liters>0,p.sku+": missing liters");
 const carton={cartonVolumeM3:num(box[28]),unitsPerCarton:num(box[29])};
 return compareLogisticsReference(model,v,check.audit.liters,carton);
}
test("Ozon FBO: 5 артикулов и все статьи логистики совпадают с Google",()=>{
 let checked=0;
 for(const p of data.products){
  const check=checkProduct(p,"ozon-fbo");
  assert.equal(check.status,"complete",p.sku+" "+JSON.stringify(check.comparison.filter(x=>x.status!=="match")));
  for(const c of check.comparison){assert.equal(c.status,"match",p.sku+" "+c.code);checked++;}
 }
 assert.equal(checked,30);
});
test("WB FBW и FBS: четыре полностью заполненных артикула по каждой модели",()=>{
 let checked=0;
 for(const p of data.products){
  for(const model of ["wb-fbw","wb-fbs"]){
   const check=checkProduct(p,model);
   if(p.sku==="RCAB-AVD26828-1"){
    assert.equal(check.status,"missing-input");continue;
   }
   assert.equal(check.status,"complete",p.sku+" "+model+" "+JSON.stringify(check.comparison.filter(x=>x.status!=="match")));
   for(const c of check.comparison){assert.equal(c.status,"match",p.sku+" "+model+" "+c.code);checked++;}
  }
 }
 assert.equal(checked,28);
});
test("Яндекс FBY: пять реальных артикулов и все расходы по схеме",()=>{
 let checked=0;
 for(const p of data.products){
  const check=checkProduct(p,"ym-fby");
  assert.equal(check.status,"complete",p.sku+" "+JSON.stringify(check.comparison.filter(x=>x.status!=="match")));
  for(const c of check.comparison){assert.equal(c.status,"match",p.sku+" "+c.code);checked++;}
 }
 assert.equal(checked,25);
});
test("Ozon FBS: тариф и возвраты сверены с реальными строками 4 и 7",()=>{
 for(const v of [
  {price:290,liters:.61256,buyout:.9503,delivery:22.561722923287384,last:4.35,receiving:2.722288705882353},
  {price:1719,liters:1.9817,buyout:.88,delivery:119.63750909090909,last:25,receiving:0}
 ]){
  const out=calculateLogistics({model:"ozon-fbs",price:v.price,volumeLiters:v.liters,buyoutRatio:v.buyout,
   receivingRub:v.receiving,handlingRub:0,pickupProcessingRub:0,pickupTravelRub:0,mayakRub:0,packingRub:0});
  const find=code=>out.lines.find(x=>x.code===code)?.amount;
  close(find("delivery"),v.delivery,"Ozon FBS доставка");
  close(find("last-mile"),v.last,"Ozon FBS последняя миля");
  close(find("receiving"),v.receiving,"Ozon FBS приёмка");
 }
});
test("Яндекс FBS: два товара из исходного FBS, без подмены FBY",()=>{
 for(const x of [
  {price:995,volume:3,middle:108,last:49.75,process:25,mayak:0},
  {price:3900,volume:10,middle:164,last:195,process:25,mayak:50}
 ]){
  const out=calculateLogistics({model:"ym-fbs",price:x.price,volumeLiters:x.volume,receivingRub:x.process,mayakRub:x.mayak,orderAcceptanceRub:.12});
  const val=code=>out.lines.find(v=>v.code===code)?.amount;
  close(val("middle-mile"),x.middle,"YM FBS middle");
  close(val("last-mile"),x.last,"YM FBS last");
  close(val("processing"),x.process,"YM FBS processing");
  close(val("mayak"),x.mayak,"YM FBS Mayak");
 }
});
test("Яндекс FBS: акционная цена пересчитывается отдельно без двойного расхода",()=>{
 const out=calculateLogistics({model:"ym-fbs",price:995,volumeLiters:3,receivingRub:25,mayakRub:0,promoPrice:250});
 assert.equal(out.alternativePromo.price,250);
 assert.equal(out.alternativePromo.middleMile,0);
 assert.equal(out.alternativePromo.lastMile,0);
 const base=out.lines.filter(v=>v.code==="middle-mile")[0].amount;
 assert.equal(base,108);
});
test("Граничные тарифы Ozon: таблица по цене и литражу",()=>{
 const testAt=(price,liters)=>{
  const out=calculateLogistics({model:"ozon-fbo",price,volumeLiters:liters,buyoutRatio:1,
   cartonVolumeM3:.0353,unitsPerCarton:50});
  return out.deliveryToBuyer;
 };
 close(testAt(301,.2),66.5,"High .2");
 close(testAt(301,.4),77.01,"High .4");
 close(testAt(300,.4),19.32,"Low .4");
 close(testAt(300,.6),21.35,"Low .6");
 close(testAt(6000,25.088),320.91,"high 25.088");
});
test("WB: дробные дополнительные литры, без округления вверх",()=>{
 const x=calculateLogistics({model:"wb-fbw",price:6250,volumeLiters:25.088,buyoutRatio:.8,shipmentRub:15});
 const item=code=>x.lines.find(v=>v.code===code).amount;
 close(item("storage"),(.08+24.088*.08)*1.7*45,"storage 25.088");
 const base=46+24.088*14;
 close(x.deliveryToBuyer,base*1.7,"WB shipping frac");
});
test("Нельзя скрывать отсутствие объёма или нулевой процент выкупа",()=>{
 assert.throws(()=>calculateLogistics({model:"wb-fbw",price:500,volumeLiters:0,buyoutRatio:.8}),/Литраж/);
 const partial=calculateLogistics({model:"ozon-fbo",price:500,volumeLiters:1,buyoutRatio:0});
 assert.ok(partial.warnings.some(x=>x.includes("выкупа")));
 assert.ok(!partial.lines.some(x=>x.code==="delivery"));
});
if(oldHandler)require.extensions[".ts"]=oldHandler;
