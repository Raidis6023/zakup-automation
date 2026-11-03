"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const categories=JSON.parse(read("data/wb-commission-categories.json"));
test("Справочник WB: реальные комиссии FBW и FBS по 7424 предметам",()=>{
 assert.equal(categories.records.length,7424);
 assert.ok(categories.records.every(x=>typeof x.name==="string"&&x.name&&x.fbw>=0&&x.fbw<=1&&x.fbs>=0&&x.fbs<=1));
 const matches=categories.records.filter(x=>x.name==="Ватные палочки");
 assert.ok(matches.length>0);
 for(const c of matches){assert.ok(c.fbw>0);assert.ok(c.fbs>0)}
});
test("Полноценная карточка новых товаров: сводка, детали, редактор",()=>{
 const ui=read("app/unit-economics/VedUnitEconomicsLive.tsx");
 for(const part of ["unit-pilot-metrics","unit-pilot-columns","unit-ved-facts",
  "Сводка","Все расчёты","Исходные данные","Подтвердить категорию и получить MPStats",
  "costGrossRub","unitWeightKg","input_data","details"]){
  assert.ok(ui.includes(part),"Отсутствует компонент "+part);
 }
});
test("Норма для целой вложимости и MOQ: min=1 step=1",()=>{
 const ui=read("app/unit-economics/VedUnitEconomicsLive.tsx");
 assert.match(ui,/min=\{f\.integer\?"1":"0\.000001"\}/);
 assert.match(ui,/step=\{f\.integer\?"1":"any"\}/);
 const inputs=ui.match(/\{key:"(?:unitsPerCarton|moqUnits)"[^}]+\}/g)||[];
 assert.equal(inputs.length,2);
 assert.ok(inputs.every(x=>x.includes("integer:true")));
});
test("MPStats: нет токена — не записываем фиктивные показатели; выкуп переносится в Ozon",()=>{
 const auth=read("app/api/unit-economics/mpstats-wb/route.ts");
 const parser=read("lib/unit-economics/mpstats-wb.ts");
 assert.match(auth,/if\(!process\.env\.MPSTATS_TOKEN\)/);
 for(const model of ["wb-fbw","wb-fbs","ozon-fbo","ozon-fbs"])assert.ok(auth.includes('"'+model+'"'));
 assert.match(parser,/buyoutRate:number\\|null=null/);
 assert.match(parser,/client_sale/);
 assert.ok(parser.includes("purchase_after_return"));
});
test("Цена и исходные данные ВЭД редактируются без отдельного второго блока",()=>{
 const v=read("app/unit-economics/UnitEconomicsVersions.tsx");
 assert.ok(!v.includes("<VedUnitEconomicsLive/>"));
 const pilot=read("app/unit-economics/UnitEconomicsPilotClient.tsx");
 assert.ok(pilot.includes("modalProductId={vedSelected}"));
 assert.ok(pilot.includes("visibilityState"));
});
