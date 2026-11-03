"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
function importTs(rel){
 const file=path.resolve(__dirname,"..",rel);
 const compiled=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
 mod._compile(compiled.outputText,file);return mod.exports;
}
const {calculateUnitFinancials,formatUnitNumber,formatUnitPercent}=importTs("lib/unit-economics/financial-results.ts");
const {calculateOzonVolume,calculateOzonSppPrice}=importTs("lib/unit-economics/ozon/price-and-volume.ts");
const ref=require("../data/unit-economics-pilot.json");
function close(actual,expected,label,tolerance=1e-7){
 assert.ok(Number.isFinite(actual),label+": returned non-finite "+actual);
 assert.ok(Math.abs(actual-expected)<=tolerance,label+": got "+actual+" expected "+expected);
}
const schemas={
 "ozon-fbo":{profit:48,margin:49,roi:50,output:39,input:40,purchase:41,expenses:{
  commission:[17],logistics:[22,25],advertising:[36],other:[18,24,26,27,32,33,34]}},
 "wb-fbw":{profit:42,margin:43,roi:44,output:32,input:33,purchase:34,expenses:{
  commission:[17],logistics:[23],advertising:[29],other:[18,19,25,26,27]}},
 "wb-fbs":{profit:42,margin:43,roi:44,output:32,input:33,purchase:34,expenses:{
  commission:[17],logistics:[23],advertising:[29],other:[18,19,25,26,27,45]}}
};
let checked=0;
for(const product of ref.products){
 for(const [model,s] of Object.entries(schemas)){
  const r=product.models[model];
  const v=r.values;
  const required=[13,11,s.output,s.input,s.purchase,s.profit,s.margin,s.roi,...Object.values(s.expenses).flat()];
  const missing=required.filter(i=>typeof v[i]!=="number");
  if(missing.length){
   test.skip(`${model} ${product.sku}: missing source inputs at ${missing.join(",")}`,()=>{});
   continue;
  }
  test(`${model} · ${product.sku} · financial result equals Google Sheets`,()=>{
   const expenses=Object.entries(s.expenses).flatMap(([group,indices])=>indices.map(i=>({code:model+"-cell-"+i,name:"Исходная статья "+i,group,amount:v[i]})));
   const out=calculateUnitFinancials({model,sellingPriceGross:v[13],costGross:v[11],outputVat:v[s.output],inputVatTotal:v[s.input],purchaseInputVat:v[s.purchase],expenses});
   close(out.netProfit,v[s.profit],"Чистая прибыль");
   close(out.marginRatio,v[s.margin],"Маржинальность");
   close(out.roiRatio,v[s.roi],"ROI");
   close(out.costNetVat,v[11]-v[s.purchase],"Себестоимость без НДС");
   assert.equal(out.expenseItems.length,required.length-8);
  });
  checked++;
 }
}
// Тест Ozon FBS по действующим строкам источника. Это не новые FBS-расчёты пяти пилотных товаров.
const fbsRows=[
 {row:4,price:290,cost:113.31,out:18.97196261682243,inside:0,purchase:0,
  lines:[["commission",66.7],["acquiring",4.35],["delivery",22.561722923287384],["receiving",2.722288705882353],["last-mile",4.35],["fulfillment",0],["fuel",0],["mayak",1.99],["handling",5],["packing",0],["defects",2.83275],["advertising",29]],
  profit:18.21127575400785,margin:0.06719332778202897,roi:0.1607208168211795},
 {row:7,price:1719,cost:432,out:309.9836065573771,inside:290.5373213114754,purchase:77.9016393442623,
  lines:[["commission",852.624],["acquiring",25.785],["delivery",119.63750909090909],["receiving",0],["last-mile",25],["fulfillment",10],["fuel",20],["mayak",0],["handling",0],["packing",0],["defects",10.8],["advertising",171.9]],
  profit:31.807205663189052,margin:0.02257404939446809,roi:0.08982590488215428}
];
for(const f of fbsRows)test(`ozon-fbs · source row ${f.row}`,()=>{
 const expenseGroups={commission:"commission",delivery:"logistics","last-mile":"logistics",advertising:"advertising"};
 const out=calculateUnitFinancials({model:"ozon-fbs",sellingPriceGross:f.price,costGross:f.cost,outputVat:f.out,inputVatTotal:f.inside,purchaseInputVat:f.purchase,
 expenses:f.lines.map(([code,amount])=>({code,name:code,amount,group:expenseGroups[code]||"other"}))});
 close(out.netProfit,f.profit,"FBS profit");
 close(out.marginRatio,f.margin,"FBS margin");
 close(out.roiRatio,f.roi,"FBS ROI");
});
test("Ozon FBO: исходные размеры 32×28×28 см, а не коробка",()=>{
 const volume=calculateOzonVolume({
  individualDimensions:{length:32,width:28,height:28,unit:"cm"},
  individualVolumeLiters:25.088,
  carton:{volume:.3095,unit:"m3",unitsPerCarton:12}});
 close(volume.liters,25.088,"FBO liters");
 assert.equal(volume.source,"dimensions");
 assert.equal(volume.roundedTariffLiters,26);
 assert.equal(volume.candidates.length,3);
 assert.equal(volume.comparisons.length,2);
});
test("Ozon FBS: габариты в миллиметрах",()=>{
 const volume=calculateOzonVolume({individualDimensions:{length:298,width:133,height:50,unit:"mm"}});
 close(volume.liters,1.9817,"FBS liters");
 assert.equal(volume.source,"dimensions");
 assert.equal(volume.roundedTariffLiters,2);
});
test("Fallback 2: при нулевых габаритах берётся готовый литраж ИУ",()=>{
 const volume=calculateOzonVolume({individualDimensions:{length:0,width:0,height:0,unit:"cm"},
  individualVolumeLiters:0.8448666666666667,carton:{volume:.101384,unit:"m3",unitsPerCarton:120}});
 assert.equal(volume.source,"individual-liters");
 close(volume.liters,0.8448666666666667,"individual liters");
 assert.equal(volume.candidates.length,2);
});
test("Fallback 3: объём транспортировочной коробки / количество",()=>{
 const volume=calculateOzonVolume({carton:{volume:.3095,unit:"m3",unitsPerCarton:12}});
 assert.equal(volume.source,"transport-carton");
 close(volume.liters,.3095*1000/12,"carton liters");
});
test("Неполные габариты не блокируют fallback",()=>{
 const volume=calculateOzonVolume({individualDimensions:{length:32,width:0,height:28,unit:"cm"},individualVolumeLiters:15});
 assert.equal(volume.source,"individual-liters");
 assert.ok(volume.warnings.some(s=>s.includes("Не все габариты")));
});
test("Неизвестный объём не становится 0 литров",()=>{
 const volume=calculateOzonVolume({});
 assert.equal(volume.liters,null);
 assert.equal(volume.source,null);
 assert.ok(volume.warnings.length);
});
test("Пороги СПП Ozon и цена со скидкой",()=>{
 const expected=[[100,.18],[100.01,.25],[300,.25],[300.01,.42],[1000,.42],[1000.01,.46]];
 for(const [price,spp] of expected)close(calculateOzonSppPrice({priceGross:price}).sppRate,spp,"SPP tier");
 close(calculateOzonSppPrice({priceGross:6000}).priceAfterSpp,3240,"Ozon reference price");
 close(calculateOzonSppPrice({priceGross:6000,additionalDiscountRate:.05}).priceAfterSpp,3078,"Additional discount");
});
test("Визуальное округление: ненулевое не скрывается как ноль",()=>{
 for(const [a,b] of [[1669.82,"1 670"],[-153.36,"−153"],[.49,"0,5"],[.05,"0,1"],[.04,"0,04"],[.005,"0,01"],[.004,"0,004"],[-.003,"−0,003"],[0,"0"]]){
  // Intl may use standard non-breaking or narrow non-breaking spaces: compare normalized.
  const value=formatUnitNumber(a).replace(/[\u00a0\u202f]/g," ");
  assert.equal(value,b.replace(/[\u00a0\u202f]/g," "),a+" formatting");
 }
 assert.equal(formatUnitPercent(.0004),"0,04 %");
});
test("Дубли расходов запрещены",()=>{
 assert.throws(()=>calculateUnitFinancials({model:"wb-fbw",sellingPriceGross:100,costGross:30,outputVat:0,inputVatTotal:0,purchaseInputVat:0,expenses:[
  {code:"twice",name:"X",group:"other",amount:1},{code:"twice",name:"Y",group:"other",amount:2}]}),/Повторно/);
});
test("ROI не выдумывается при нулевой базе",()=>{
 const o=calculateUnitFinancials({model:"ozon-fbo",sellingPriceGross:0,costGross:0,outputVat:0,inputVatTotal:0,purchaseInputVat:0,expenses:[]});
 assert.equal(o.roiRatio,null);assert.equal(o.marginRatio,null);
});
test("Единый финансовый движок допускает обе схемы Яндекса",()=>{
 for(const model of ["ym-fby","ym-fbs"]){
  const out=calculateUnitFinancials({model,sellingPriceGross:122,costGross:22,outputVat:22,inputVatTotal:4,purchaseInputVat:3,expenses:[]});
  close(out.netProfit,82,"model "+model);
  close(out.roiRatio,82/19,"ROI "+model);
 }
});

const oldTsHandler=require.extensions[".ts"];
require.extensions[".ts"]=(mod,filename)=>{
 const compiled=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 mod._compile(compiled.outputText,filename);
};
const {recalculateFinancialReference,recalculateOzonReferenceInputs,recalculateMarketplaceVolume,calculateYandexReferenceVat}=require("../lib/unit-economics/financial-reference.ts");
const {calculateUnitVat}=require("../lib/unit-economics/vat.ts");
test("Адаптер сверяет все полные строки Ozon и WB без обращения к Google",()=>{
 let matched=0,missing=0;
 for(const product of ref.products){
  for(const model of ["ozon-fbo","wb-fbw","wb-fbs"]){
   const check=recalculateFinancialReference(model,product.models[model].values);
   if(check.status==="missing-input"){missing++;assert.equal(product.sku,"RCAB-AVD26828-1");assert.ok(model.startsWith("wb-"));continue;}
   assert.equal(check.status,"matched",product.sku+" "+model);
   matched++;
  }
 }
 assert.equal(matched,13);
 assert.equal(missing,2);
});
test("Адаптер Ozon применяет приоритет источников к 5 артикулам",()=>{
 for(const product of ref.products){
  const fbo=product.models["ozon-fbo"].values;
  const check=recalculateOzonReferenceInputs("ozon-fbo",fbo,fbo);
  assert.ok(check.volume.liters!==null,product.sku);
  const completeDimensions=[6,7,8].every(i=>Number(fbo[i])>0);
  assert.equal(check.volume.source,completeDimensions?"dimensions":"individual-liters");
  close(check.spp.priceAfterSpp,Number(fbo[15]),product.sku+" Ozon price with SPP",1e-7);
  close(check.volume.liters,Number(fbo[9]),product.sku+" Ozon liters",1e-7);
 }
});

test("Яндекс FBY: 5 товаров, общий ROI и НДС по статьям, без изменения прибыли",()=>{
 for(const p of ref.products){
  const v=p.models["ym-fby"].values;
  const check=recalculateFinancialReference("ym-fby",v);
  assert.equal(check.status,"roi-method-changed",p.sku);
  assert.ok(check.output&&check.vatAudit,p.sku);
  close(check.output.netProfit,v[36],"FBY profit "+p.sku);
  close(check.output.marginRatio,v[37],"FBY margin "+p.sku);
  close(check.previousRoiRatio,v[38],"FBY old ROI "+p.sku);
  close(check.output.roiRatio,v[36]/(v[11]-v[31]),"FBY new ROI "+p.sku);
  close(check.vatAudit.calculated.outputVat,v[29],"FBY output VAT "+p.sku);
  close(check.vatAudit.calculated.inputVatTotal,v[30],"FBY input VAT "+p.sku);
  close(check.vatAudit.maxDifference,0,"FBY VAT comparison "+p.sku);
 }
});

test("Яндекс FBS: две реальные строки Google Таблицы, та же прибыль и новый ROI",()=>{
 const refs=[
  {row:4,fields:{11:304,13:995,16:462.675,17:15.92,18:25,20:108,21:49.75,22:0,23:0.12,32:2.4918032786885247,34:0,35:0.22,37:179.42622950819674,38:171.2294262295082,39:54.81967213114754,44:18.84639344262291,45:0.02310814070351754,46:0.057283870646270246}},
  {row:5,fields:{11:1140,13:3900,16:1891.5,17:62.4,18:25,20:164,21:195,22:50,23:0.12,32:9.344262295081966,34:0,35:0.22,37:703.2786885245902,38:615.9314754098361,39:205.5737704918033,44:275.288524590164,45:0.08611589743589745,46:0.22657491735815968}}
 ];
 for(const fixture of refs){
  const v=Array(47).fill(null);
  for(const [key,val] of Object.entries(fixture.fields))v[Number(key)]=val;
  const check=recalculateFinancialReference("ym-fbs",v);
  assert.equal(check.status,"roi-method-changed","ЯМ FBS row "+fixture.row);
  close(check.output.netProfit,v[44],"FBS profit row "+fixture.row);
  close(check.output.marginRatio,v[45],"FBS margin row "+fixture.row);
  close(check.previousRoiRatio,v[46],"FBS old ROI row "+fixture.row);
  close(check.output.roiRatio,v[44]/(v[11]-v[39]),"FBS new ROI row "+fixture.row);
  close(check.vatAudit.maxDifference,0,"FBS VAT row "+fixture.row);
 }
});

test("Все 5 товаров WB/ЯМ считают литраж по трём источникам",()=>{
 for(const p of ref.products){
  const ozon=p.models["ozon-fbo"].values;
  for(const m of ["wb-fbw","wb-fbs","ym-fby"]){
   const check=recalculateMarketplaceVolume(m,p.models[m].values,ozon);
   assert.ok(check.audit.liters>0,p.sku+" "+m);
   assert.equal(check.audit.source,p.sku==="RCAB-AVD26828-1"?
       (m.startsWith("wb-")?"transport-carton":"individual-liters"):"dimensions",p.sku+" "+m);
   if(p.sku==="RCAB-AVD26828-1"){
    close(check.audit.liters,0.101384*1000/120,"fallback source "+m);
   }
  }
 }
});
test("Литраж Яндекс FBS использует тот же общий алгоритм",()=>{
 const p=ref.products[0];
 const values=p.models["ym-fby"].values;
 const check=recalculateMarketplaceVolume("ym-fbs",values,p.models["ozon-fbo"].values);
 close(check.audit.liters,25.088,"dimensions FBS");
});
test("НДС: отрицательная налоговая разница не обнуляется",()=>{
 const r=calculateUnitVat({sellingPriceGross:100,salesVatRate:.22,purchaseInputVat:80,expenses:[
  {code:"commission",amountGross:10,vatRate:.22,deductibleShare:1}
 ]});
 assert.ok(r.vatPayable<0);
 close(r.vatPayable,100*.22/1.22-80-10*.22/1.22,"negative VAT");
});
test("НДС 5/7%: нет автоматических вычетов",()=>{
 for(const rate of [.05,.07]){
  const r=calculateUnitVat({sellingPriceGross:100,salesVatRate:rate,purchaseInputVat:10,expenses:[
   {code:"service",amountGross:30,vatRate:.22,deductibleShare:1}
  ]});
  close(r.inputVatTotal,0,"no deduction");
 }
});
if(oldTsHandler)require.extensions[".ts"]=oldTsHandler;
