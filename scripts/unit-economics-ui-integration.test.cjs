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
test("MPStats: ключ читается из защищённого хранилища; без ключа показатели не записываются",()=>{
 const auth=read("app/api/unit-economics/mpstats-wb/route.ts");
 const parser=read("lib/unit-economics/mpstats-wb.ts");
 const credentials=read("lib/integrations/secrets.ts");
 const api=read("app/api/admin/integrations/route.ts");
 const page=read("app/admin/api/ApiConnectionsClient.tsx");
 assert.ok(auth.includes("getMpStatsToken"));
 assert.match(auth,/const token=await getMpStatsToken\(\)/);
 assert.match(auth,/if\(!token\)/);
 assert.doesNotMatch(auth,/process\.env\.MPSTATS_TOKEN/);
 assert.ok(parser.includes("getWbSubjectMpstats(subject:string,fbs:boolean,token:string,subjectGroup?:string,confirmed?:MpstatsSelection)"));
 assert.ok(parser.includes("if(!token?.trim())"));
 assert.ok(credentials.includes("workspace_get_integration_secrets"));
 assert.ok(api.includes("workspace_upsert_integration_secrets"));
 assert.ok(page.includes("API-ключ MPStats"));
 for(const model of ["wb-fbw","wb-fbs","ozon-fbo","ozon-fbs"])assert.ok(auth.includes('"'+model+'"'));
 assert.ok(parser.includes("readSubjectBuyout(info)"));
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

test("MPStats: manual category confirmation triggers automatic request even with stale UI status",()=>{
 const ui=read("app/unit-economics/VedUnitEconomicsLive.tsx");
 const provider=read("app/api/unit-economics/mpstats-wb/route.ts");
 const patch=read("app/api/unit-economics/prospective/route.ts");
 assert.ok(ui.includes("await refreshMpstats(product)"));
 assert.ok(!ui.includes('if(providerStatus!=="connected")'));
 assert.ok(provider.includes("const metrics=await getWbSubjectMpstatsMacro("));
 for(const model of ["wb-fbw","wb-fbs","ozon-fbo","ozon-fbs"])
  assert.ok(provider.includes('"'+model+'"'));
 assert.ok(patch.includes("wbSppSampledProducts"));
 assert.ok(patch.includes("buyoutSource"));
 assert.ok(provider.includes("Категория WB изменена во время загрузки"));
});

test("MPStats: explicit category mapping is controlled, shared and never exposes the token",()=>{
 const route=read("app/api/unit-economics/mpstats-wb/route.ts");
 const search=read("app/api/unit-economics/mpstats-wb/categories/route.ts");
 const page=read("app/unit-economics/VedUnitEconomicsLive.tsx");
 const migration=read("supabase/migrations/20261105_wb_mpstats_taxonomy_mappings.sql");
 assert.ok(route.includes("unit_wb_mpstats_mappings"));
 assert.ok(route.includes("validateMpstatsSelection"));
 assert.ok(route.includes("mpstatsSelection"));
 assert.ok(search.includes("getMpStatsToken"));
 assert.ok(!search.includes("token:token"));
 assert.ok(page.includes("Привязать категорию и получить показатели"));
 assert.ok(page.includes("mpstats-wb/categories"));
 assert.ok(migration.includes("PRIMARY KEY (wb_category,wb_group)"));
 assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"));
});

test("Карточка сохраняет все шесть схем продаж и порядок выбора",()=>{
 const ui=read("app/unit-economics/VedUnitEconomicsLive.tsx");
 assert.match(ui,/ozon:\["ozon-fbo","ozon-fbs"\]/);
 assert.match(ui,/wb:\["wb-fbw","wb-fbs"\]/);
 assert.match(ui,/ym:\["ym-fby","ym-fbs"\]/);
 assert.ok(!ui.includes('activeModel==="ym-fbs"?"ym-fby"'));
});
