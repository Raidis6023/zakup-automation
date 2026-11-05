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
  close(r.costGrossRub,143.75);
  close(r.purchaseVatCreditRub,0);
 }
});
test("Импортный НДС ВЭД: возвратный вычет применяется только один раз",()=>{
 const s=source();
 s.input.customs.importVatRecoverable=true;
 for(const model of PRELIMINARY_MODELS){
  const r=calculatePreliminary(s,model,{});
  close(r.costGrossRub,143.75);
  close(r.purchaseVatCreditRub,15.5);
  close(r.costNetRub,128.25);
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
  close(r.profitRub,1000-143.75-expenses-(r.outputVatRub-r.inputVatRub));
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

test("Ozon FBS и обе схемы Яндекса подбирают цену автоматически без ручного ТК Маяк",()=>{
 const s=source();
 const rates={categoryId:"Ватные палочки",categoryCommissionRate:.47,buyoutRate:.93};
 for(const model of ["ozon-fbs","ym-fby","ym-fbs"]){
  const settings=model==="ozon-fbs"?{
   ...rates,ozonCommissionRates:{upTo100:.17,upTo300:.23,above300:.52},
   categoryCommissionRate:.52
  }:rates;
  const target=suggestPreliminaryTargetPrice(s,model,settings);
  assert.ok(target.priceRub>0,model+": "+JSON.stringify(target.missing));
  const calculated=calculatePreliminary(s,model,{...settings,priceRub:target.priceRub});
  assert.ok(calculated.roi>=.15001-1e-8,model+": "+JSON.stringify(calculated.missing));
  assert.ok(!calculated.missing.some(x=>x.includes("ТК Маяк")),model);
 }
});

test("15% прибавляется к 40HQ и MOQ отдельно, затем считается среднее на всех шести схемах",()=>{
 const input=source();
 input.result.scenarios["40hq"].totalCostIncludingVatRub=100000; // 100 ₽/шт.
 input.result.scenarios.moq.totalCostIncludingVatRub=14000; // 140 ₽/шт.
 input.result.averageCostPerUnitRub=120; // исходная средняя из ВЭД
 for(const model of PRELIMINARY_MODELS){
  const result=calculatePreliminary(input,model,{});
  close(result.costGrossRub,(100*1.15+140*1.15)/2);
  assert.equal(result.costPolicyVersion,2);
  assert.match(result.sourceCost,/1,15/);
 }
 close(input.result.averageCostPerUnitRub,120);
 close(input.result.scenarios["40hq"].totalCostIncludingVatRub,100000);
 close(input.result.scenarios.moq.totalCostIncludingVatRub,14000);
 close(calculatePreliminary(input,"ozon-fbo",{}).costGrossRub,138);
});
test("15% надбавка не начисляется снова на ручную себестоимость",()=>{
 const input=source();
 const manual=applyProductOverrides(input,{costGrossRub:130});
 for(const model of PRELIMINARY_MODELS)close(calculatePreliminary(manual,model,{}).costGrossRub,130);
 close(calculatePreliminary(input,"ozon-fbo",{}).costGrossRub,143.75);
});
test("Целевая цена под ROI должна учитывать себестоимость с надбавкой",()=>{
 const original=source();
 const newPrice=suggestPreliminaryTargetPrice(original,"ym-fby",{...full,priceRub:null});
 assert.ok(newPrice.priceRub>0,JSON.stringify(newPrice.missing));
 const calculation=calculatePreliminary(original,"ym-fby",{...full,priceRub:newPrice.priceRub});
 close(calculation.costGrossRub,143.75);
 assert.ok(calculation.roi>=.15001-1e-8);
 const before={...original,result:structuredClone(original.result)};
 before.result.scenarios["40hq"].totalCostIncludingVatRub/=1.15;
 before.result.scenarios.moq.totalCostIncludingVatRub/=1.15;
 const earlier=suggestPreliminaryTargetPrice(before,"ym-fby",{...full,priceRub:null});
 assert.ok(newPrice.priceRub>earlier.priceRub);
});

test("Ozon: минимальная цена до 300 рублей важнее дорогой третьей комиссии",()=>{
 const item=source();
 item.result.scenarios["40hq"].totalCostIncludingVatRub=40000;
 item.result.scenarios.moq.totalCostIncludingVatRub=4000;
 const options={...full,priceRub:949,buyoutRate:1,
  ozonCommissionRates:{upTo100:.17,upTo300:.23,above300:.75},
  ozonInsuranceFactors:{upTo300:.25,above300:.6}};
 for(const model of ["ozon-fbo","ozon-fbs"]){
  const at100=calculatePreliminary(item,model,{...options,priceRub:100});
  const at300=calculatePreliminary(item,model,{...options,priceRub:300});
  assert.ok(at100.roi<.15001,model+": price 100 should not pass");
  assert.ok(at300.roi>=.15001,model+": price 300 should pass");
  close(at100.commissionRate,.17);
  close(at300.commissionRate,.23);
  const chosen=suggestPreliminaryTargetPrice(item,model,options);
  assert.ok(chosen.priceRub>100&&chosen.priceRub<=300,model+": "+JSON.stringify(chosen));
  const actual=calculatePreliminary(item,model,{...options,priceRub:chosen.priceRub});
  assert.ok(actual.roi>=.15001-1e-8,model);
  close(actual.commissionRate,.23);
  const before=calculatePreliminary(item,model,{...options,priceRub:Math.round((chosen.priceRub-.01)*100)/100});
  assert.ok(before.roi<.15001,model+": lower price should fail target ROI");
  const withoutManual=suggestPreliminaryTargetPrice(item,model,{...options,priceRub:null});
  close(withoutManual.priceRub,chosen.priceRub);
 }
});
test("Ozon: цена 300 рублей проверяется отдельно из-за смены страхового коэффициента",()=>{
 const item=source(),options={...full,buyoutRate:1,
  ozonCommissionRates:{upTo100:.17,upTo300:.23,above300:.52},
  ozonInsuranceFactors:{upTo300:0,above300:1}};
 item.result.scenarios["40hq"].totalCostIncludingVatRub=20000;
 item.result.scenarios.moq.totalCostIncludingVatRub=2000;
 const below=calculatePreliminary(item,"ozon-fbo",{...options,priceRub:299.99});
 const exactly=calculatePreliminary(item,"ozon-fbo",{...options,priceRub:300});
 close(below.commissionRate,.23);close(exactly.commissionRate,.23);
 assert.ok(below.roi>exactly.roi,"Страхование меняется на цене 300");
 const goal=(below.roi+exactly.roi)/2;
 assert.ok(goal>0&&goal<10);
 const result=suggestPreliminaryTargetPrice(item,"ozon-fbo",options,goal);
 assert.ok(result.priceRub<300&&result.priceRub>100,JSON.stringify(result));
 const validated=calculatePreliminary(item,"ozon-fbo",{...options,priceRub:result.priceRub});
 assert.ok(validated.roi>=goal-1e-8);
});
test("Ozon: от 301 ₽ выбираем только если весь диапазон до 300 не проходит ROI",()=>{
 const item=source(),options={...full,buyoutRate:1,
  ozonCommissionRates:{upTo100:.3,upTo300:.43,above300:.52},
  ozonInsuranceFactors:{upTo300:.58,above300:.3}};
 for(const model of ["ozon-fbo","ozon-fbs"]){
  const at300=calculatePreliminary(item,model,{...options,priceRub:300});
  assert.ok(at300.roi<.15001,model);
  const suggested=suggestPreliminaryTargetPrice(item,model,options);
  assert.ok(suggested.priceRub>=301,model+": "+JSON.stringify(suggested));
  const result=calculatePreliminary(item,model,{...options,priceRub:suggested.priceRub});
  assert.ok(result.roi>=.15001-1e-8);
  close(result.commissionRate,.52);
 }
});
test("Ozon: ручная цена меняет процент комиссии, рекомендация остаётся независимой",()=>{
 const item=source(),options={...full,ozonCommissionRates:{upTo100:.17,upTo300:.23,above300:.52},
  ozonInsuranceFactors:{upTo300:.25,above300:.6}};
 for(const model of ["ozon-fbo","ozon-fbs"]){
  const base=suggestPreliminaryTargetPrice(item,model,options);
  const low=calculatePreliminary(item,model,{...options,priceRub:299});
  const high=calculatePreliminary(item,model,{...options,priceRub:301});
  close(low.commissionRate,.23);close(high.commissionRate,.52);
  assert.notEqual(low.profitRub,high.profitRub);
  close(suggestPreliminaryTargetPrice(item,model,{...options,priceRub:299}).priceRub,base.priceRub);
  close(suggestPreliminaryTargetPrice(item,model,{...options,priceRub:1500}).priceRub,base.priceRub);
 }
 assert.equal(calculatePreliminary(item,"ozon-fbo",options).pricePolicyVersion,2);
});

const {buildNewProductNaming}=require("../lib/products/new-product-naming.ts");
test("Краткие названия: пять реальных примеров КП с главными характеристиками",()=>{
 const examples=[
  ["Автоматический рулетка-поводок для домашних животных\nРазмер: 13 * 9 * 3,2 см, длина троса: 3 м/",
   "Рулетка-поводок автоматическая для животных, 3 м, 13×9×3,2 см"],
  ["Кормушка и поилка 2 в 1 для домашних животных\nРазмер: 32 * 28,5 * 26 см\nОбъем: для корма 1,5 л, для воды 1,3 л",
   "Кормушка-поилка 2 в 1 для животных, корм 1,5 л, вода 1,3 л"],
  ["Миска для домашних животных (керамическая), средний размер (M)\nРазмер: 15 * 15 * 7 см, вес: около 570 г",
   "Миска керамическая для животных, размер M, 15×15×7 см"],
  ["Подставка для охлаждения ноутбука\nКоличество вентиляторов: 2 шт.\nСкорость вращения: 1000 ± 10% об/мин\nРазмер вентиляторов: 125 * 125 * 15 мм\nДлина кабеля: 540 мм\nВход: 5 В\nВыходной ток: 0,6 А ± 10%\nМощность: 3 Вт\nС 4 синими светодиодами (LED)\nРазмер изделия: 360 * 255 * 30 мм\nВес изделия: 0,57 кг (включая упаковку)\nКабель питания: USB – USB",
   "Подставка охлаждающая для ноутбука, 2 вентилятора 125 мм, 1000 об/мин, LED, 360×255×30 мм"],
  ["Подставка для охлаждения ноутбука , USB-USB\nМодель: XF-785\nНапряжение: 5 В, номинальный ток: 0,85 А, мощность: 4,25 Вт\nКоличество вентиляторов: 5 шт., размер вентилятора: 10 см\nСкорость вращения: 1600 ± 10% об/мин\nРазмер изделия: 45,5 * 32 * 3 см\nВес нетто: 1041 г, вес брутто: 1135 г",
   "Подставка охлаждающая для ноутбука XF-785, 5 вентиляторов 100 мм, 1600 об/мин, 45,5×32×3 см"]
 ];
 for(const [description,expected] of examples){
  const result=buildNewProductNaming(description,"TEST");
  assert.equal(result.shortName,expected);
  assert.ok(result.shortName.length<=300);
  assert.ok(result.fullName.length>=result.shortName.length-12);
  assert.ok(Object.keys(result.attributes).length>=1);
 }
 const laptop=buildNewProductNaming(examples[3][0],"TEST");
 assert.match(laptop.fullName,/Длина кабеля: 540 мм/);
 assert.match(laptop.fullName,/Выходной ток: 0,6 А ± 10%/);
 assert.match(laptop.fullName,/Вес изделия: 0,57 кг/);
 assert.equal(laptop.attributes["Количество вентиляторов"],"2 шт.");
 assert.equal(laptop.attributes["Мощность"],"3 Вт");
 assert.ok(!laptop.shortName.includes("Длина кабеля"));
});
test("Бритвы: не смешиваем кассеты, лезвия и количество в упаковке",()=>{
 const a=buildNewProductNaming("Бритвенный набор\nРучка + 3 сменные кассеты (6 лезвий)\nРазмер: 4 * 13 см","KL-B608LO");
 assert.equal(a.shortName,"Бритвенный набор, ручка + 3 сменные кассеты, 6 лезвий, 4×13 см");
 const b=buildNewProductNaming("Бритвенный набор\nУпаковка 8 шт.\nРазмер: 4 * 11 см\n5 лезвий","KL-R551L_4");
 assert.equal(b.shortName,"Бритвенный набор, 8 шт. в упаковке, 5 лезвий, 4×11 см");
 const c=buildNewProductNaming("Бритвенный набор\n3 сменные кассеты","TEST");
 assert.ok(!c.shortName.includes("лезвий"),"Не выводить лезвия из числа кассет");
 assert.ok(!c.shortName.includes("ручка"),"Не выдумывать ручку");
});
test("Ручные короткое и полное названия не затираются",()=>{
 const edited=mergeProductOverrides({},{name:"Моё название",fullName:"Моё подробное название, 5 лезвий"});
 const result=applyProductOverrides(source(),edited);
 assert.equal(result.name,"Моё название");
 assert.equal(edited.fullName,"Моё подробное название, 5 лезвий");
 assert.throws(()=>mergeProductOverrides({},{fullName:""}),/Недопустимое/);
});

test("Существующие КП: правильные падежи, кассеты и состав упаковки",()=>{
 const two=buildNewProductNaming("Бритвенный набор\nУпаковка 5 шт.\n2 лезвия\nРазмер: 4 * 11 см","KL-2003_1");
 assert.match(two.shortName,/2 лезвия/);
 assert.doesNotMatch(two.shortName,/2 лезвий/);
 const six=buildNewProductNaming("Бритвенный набор\nРучка + 3 сменные кассеты (6 лезвий)\nРазмер: 4 * 13 см","KL-B608LO");
 assert.match(six.shortName,/3 сменные кассеты, 6 лезвий/);
 assert.equal(six.attributes["Сменные кассеты"],"3 шт.");
 const cotton=buildNewProductNaming("Набор ватных палочек\n1000 штук (5зип лок по 200 штук в общей ПЭ упаковке)","RCAB-AVD26828-3");
 assert.equal(cotton.shortName,"Набор ватных палочек, 1000 шт., 5 зип-лок по 200 шт.");
 assert.equal(cotton.attributes["Количество палочек"],"1000 шт.");
 assert.match(cotton.fullName,/в общей ПЭ упаковке/);
});
