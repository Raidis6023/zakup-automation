"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const originalResolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,isMain,options){
 if(request.startsWith("@/"))request=path.join(root,request.slice(2));
 return originalResolve.call(this,request,parent,isMain,options);
};
require.extensions[".ts"]=(mod,filename)=>{
 const output=ts.transpileModule(fs.readFileSync(filename,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
 }).outputText;
 mod._compile(output,filename);
};
const {PRELIMINARY_MODELS,calculatePreliminary,suggestPreliminaryTargetPrice}=require("../lib/unit-economics/prospective-engine.ts");
const {calculateUnitWeight}=require("../lib/unit-economics/unit-weight.ts");
const {mergeProductOverrides,applyProductOverrides}=require("../lib/unit-economics/product-overrides.ts");
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,"Ожидается "+b+", получено "+a);
const source=()=>({
 article:"RCAB-TEST-1",name:"Тестовый товар (RCAB-TEST-1)",
 input:{
  product:{productName:"Тестовый товар",unitPriceCny:1,unitsPerCarton:120,cartonVolumeM3:.101384,
   cartonLengthCm:58,cartonWidthCm:46,cartonHeightCm:38,cartonGrossKg:19,moqUnits:100},
  currency:{cnyRub:13,eurRub:90},container:{usableVolumeM3:68},
  expenses:{},customs:{vatPercent:22,importVatRecoverable:false}
 },
 result:{averageCostPerUnitRub:125,scenarios:{
  "40hq":{units:1000,totalCostIncludingVatRub:120000,importVatRub:15000},
  "moq":{units:100,totalCostIncludingVatRub:13000,importVatRub:1600}
 }}
});
const full={
 priceRub:1000,categoryId:"selected-category",categoryCommissionRate:.3,
 buyoutRate:.9,wbSppRate:.2,advertisingRate:.1,saleVatRate:.22,
 insuranceFactor:.4,mayakRub:10,fbsPickupRub:0,fbsTravelRub:0,fbsPackingRub:0
};
test("Новые товары из ВЭД: без ЕНОТ и без вымышленных категорий",()=>{
 const s=source();
 for(const model of PRELIMINARY_MODELS){
  const r=calculatePreliminary(s,model,{});
  assert.equal(r.status,"needs_input");
  assert.equal(r.priceRub,null);
  assert.equal(r.profitRub,null);
  assert.ok(r.missing.some(x=>x.includes("Категория")));
  close(r.volumeLiters,.101384*1000/120);
  assert.equal(r.volumeSource,"transport-carton");
  close(r.costGrossRub,125);
  close(r.purchaseVatCreditRub,0);
 }
});
test("Импортный НДС ВЭД: возвратный вычет применяется только один раз",()=>{
 const s=source();
 s.input.customs.importVatRecoverable=true;
 for(const model of PRELIMINARY_MODELS){
  const r=calculatePreliminary(s,model,{});
  close(r.costGrossRub,125);
  close(r.purchaseVatCreditRub,15.5);
  close(r.costNetRub,109.5);
 }
});
test("Все шесть схем после заполнения обязательных полей дают независимый расчёт",()=>{
 for(const model of PRELIMINARY_MODELS){
  const r=calculatePreliminary(source(),model,full);
  assert.equal(r.status,"calculated",model+":"+r.missing.join(", "));
  assert.ok(Number.isFinite(r.profitRub),model);
  assert.ok(Number.isFinite(r.roi),model);
  assert.ok(Number.isFinite(r.margin),model);
  assert.ok(r.expenses.length>=5,model);
  const expenses=r.expenses.reduce((a,c)=>a+c.amount,0);
  close(r.profitRub,1000-125-expenses-(r.outputVatRub-r.inputVatRub));
  assert.equal(new Set(r.expenses.map(x=>x.code)).size,r.expenses.length);
 }
});
test("Норматив ДРР 10/15% помечается как допущение, не как проверенный результат",()=>{
 const settings={...full};delete settings.advertisingRate;
 const r=calculatePreliminary(source(),"wb-fbw",settings);
 assert.equal(r.status,"estimated");
 assert.ok(r.assumptions.some(x=>x.includes("ДРР")));
});
test("Озон СПП автоматический, WB СПП обязателен",()=>{
 const s=source();
 const oz=calculatePreliminary(s,"ozon-fbo",full);
 close(oz.priceAfterSppRub,580); // 1000 ₽ относится к ступени СПП 42%, не 46%
 const wb=calculatePreliminary(s,"wb-fbw",full);
 close(wb.priceAfterSppRub,800);
 const missing=calculatePreliminary(s,"wb-fbw",{...full,wbSppRate:null});
 assert.equal(missing.status,"needs_input");
 assert.ok(missing.missing.some(x=>x.includes("СПП WB")));
});
test("Целевая цена не выдумывается без категории, выкупа и WB СПП",()=>{
 const s=source();
 assert.equal(suggestPreliminaryTargetPrice(s,"wb-fbw",{}).priceRub,null);
 for(const model of PRELIMINARY_MODELS){
  const price=suggestPreliminaryTargetPrice(s,model,{...full,priceRub:null});
  assert.ok(price.priceRub>0,model+":"+price.missing.join("; "));
  const r=calculatePreliminary(s,model,{...full,priceRub:price.priceRub});
  assert.ok(r.roi>=.15001-1e-8,model+": "+r.roi);
 }
});
test("Габариты ИУ перекрывают готовый литраж и коробку",()=>{
 const s=source();
 Object.assign(s.input.product,{individualLengthCm:25,individualWidthCm:8,individualHeightCm:3,individualVolumeLiters:55});
 const r=calculatePreliminary(s,"ym-fby",{});
 close(r.volumeLiters,.6);
 assert.equal(r.volumeSource,"dimensions");
});

test("Ozon: комиссия и страхование используют соответствующую ценовую ступень",()=>{
 const q={...full,ozonCommissionRates:{upTo100:.2,upTo300:.3,above300:.4},
  ozonInsuranceFactors:{upTo300:.25,above300:.5}};
 const x=calculatePreliminary(source(),"ozon-fbo",q);
 close(x.commissionRate,.4);
 const insurance=x.expenses.find(i=>i.code==="insurance");
 close(insurance.amount,1000*.000838*28*.5/1.22);
 const low=calculatePreliminary(source(),"ozon-fbo",{...q,priceRub:290});
 close(low.commissionRate,.3);
 close(low.expenses.find(i=>i.code==="insurance").amount,290*.000838*28*.25/1.22);
});
test("Яндекс FBS: акционную доставку считаем отдельно от базовой",()=>{
 const x=calculatePreliminary(source(),"ym-fbs",{...full,promoPriceRub:250});
 assert.equal(x.logistics.alternativePromo.price,250);
 assert.equal(x.logistics.alternativePromo.middleMile,0);
 assert.equal(x.logistics.alternativePromo.lastMile,0);
});

test("Расчётный вес товара один для всех маркетплейсов: брутто коробки / вложимость",()=>{
 const item=source();
 for(const model of PRELIMINARY_MODELS){
  const result=calculatePreliminary(item,model,{});
  close(result.unitWeightKg,19/120);
  assert.equal(result.unitWeightSource,"carton-gross");
  assert.match(result.unitWeightFormula,/19 кг \/ 120 шт\./);
  assert.equal(result.unitWeightWarning,null);
 }
});
test("Вес пересчитывается при обновлении данных ВЭД; исходная точность не теряется",()=>{
 const item=source();
 close(calculatePreliminary(item,"ozon-fbo",{}).unitWeightKg,19/120);
 item.input.product.cartonGrossKg=21;
 item.input.product.unitsPerCarton=60;
 close(calculatePreliminary(item,"ozon-fbo",{}).unitWeightKg,.35);
 const result=calculateUnitWeight(.019,100);
 close(result.kilograms,.00019);
 assert.match(result.formula,/0\.00019 кг\/шт\./);
});
test("При неизвестном весе коробки или нецелой вложимости вес не выдумывается",()=>{
 for(const [gross,units] of [[0,120],[undefined,120],[19,0],[19,2.5],[19,NaN],[NaN,120],[-5,100]]){
  const value=calculateUnitWeight(gross,units);
  assert.equal(value.kilograms,null);
  assert.equal(value.formula,null);
  assert.ok(value.warning);
 }
 const item=source();
 delete item.input.product.cartonGrossKg;
 const result=calculatePreliminary(item,"ym-fby",{});
 assert.equal(result.unitWeightKg,null);
 assert.match(result.unitWeightWarning,/вес брутто/);
 assert.equal(result.status,"needs_input"); // Воздействия на прибыль из-за веса нет.
});

test("Редактирование ВЭД: меняем исходные поля, не мутируем сохранённый расчёт",()=>{
 const base=source();
 const overrides=mergeProductOverrides({},{
  name:"Набор ватных палочек",productType:"Ватные палочки",
  cartonGrossKg:21,unitsPerCarton:70,individualLengthCm:5,costGrossRub:130
 });
 const copy=applyProductOverrides(base,overrides);
 assert.equal(base.input.product.cartonGrossKg,19);
 assert.equal(base.input.product.unitsPerCarton,120);
 assert.equal(copy.input.product.cartonGrossKg,21);
 assert.equal(copy.input.product.unitsPerCarton,70);
 assert.equal(copy.name,"Набор ватных палочек");
 for(const model of PRELIMINARY_MODELS){
  const r=calculatePreliminary(copy,model,{});
  close(r.unitWeightKg,.3);
  close(r.costGrossRub,130);
  assert.equal(r.status,"needs_input");
 }
});
test("Редактирование: нельзя установить вес напрямую, запрещены нецелая вложимость и неизвестные поля",()=>{
 assert.throws(()=>mergeProductOverrides({},{unitWeightKg:0.33}),/не допускает/);
 assert.throws(()=>mergeProductOverrides({},{unitsPerCarton:2.3}),/целым/);
 assert.throws(()=>mergeProductOverrides({},{cartonGrossKg:-3}),/Некорректное/);
 const src=mergeProductOverrides({product:{unitsPerCarton:90}},{unitsPerCarton:null});
 assert.equal(src.product,undefined);
});
test("Редактирование: корректировка себестоимости ниже входящего НДС отклоняется",()=>{
 const x=source();
 x.input.customs.importVatRecoverable=true;
 const over=mergeProductOverrides({}, {costGrossRub:5});
 assert.throws(()=>calculatePreliminary(applyProductOverrides(x,over),"ozon-fbo",{}),/ниже входящего НДС/);
});
