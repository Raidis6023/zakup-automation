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

test("Фото товаров из ВЭД не должны оставаться жёсткой заглушкой",()=>{
 const pilot=read("app/unit-economics/UnitEconomicsPilotClient.tsx");
 const modal=read("app/unit-economics/VedUnitEconomicsLive.tsx");
 const route=read("app/api/unit-economics/photos/route.ts");
 const prospective=read("app/api/unit-economics/prospective/route.ts");
 assert.ok(pilot.includes("vedPhotoUrls[p.source_item_id]"));
 assert.ok(pilot.includes('fetch("/api/unit-economics/photos"'));
 assert.ok(pilot.includes("photoUrl={activeVedPhoto}"));
 assert.ok(modal.includes("photoUrl?<Image"));
 assert.ok(prospective.includes("source_offer_id:sourceOfferIds"));
 assert.ok(route.includes("findSupplierPhotos(file,items)"));
 assert.ok(route.includes('BUCKET="ved-product-photos"'));
 assert.ok(route.includes("createSignedUrls"));
 assert.ok(route.includes("await (await createClient()).auth.getUser()"));
 assert.ok(!route.includes("getPublicUrl"));
});

test("15% себестоимости: старые ВЭД версии пересчитываются автоматически и однократно",()=>{
 const engine=read("lib/unit-economics/prospective-engine.ts");
 const route=read("app/api/unit-economics/prospective/route.ts");
 const client=read("app/unit-economics/UnitEconomicsPilotClient.tsx");
 const sync=read("lib/unit-economics/prospective-sync.ts");
 assert.match(engine,/UNIT_COST_UPLIFT_RATE=0\.15/);
 assert.match(engine,/costPolicyVersion:UNIT_COST_POLICY_VERSION/);
 assert.ok(engine.includes("container+moq"));
 assert.ok(route.includes('body?.action==="recalculate-cost-policy"'));
 assert.ok(route.includes('costPolicyVersion:value.costPolicyVersion??1'));
 assert.ok(route.includes("current?.result_data"));
 assert.ok(client.includes('action:"recalculate-cost-policy"'));
 assert.ok(client.includes('attemptedCostSources.current'));
 assert.ok(sync.includes("extractInputs(type,saved"));
 assert.ok(!sync.includes("cost_gross_rub*1.15"));
});

test("Ozon: три ценовые ступени и ручная цена доступны в сводке",()=>{
 const engine=read("lib/unit-economics/prospective-engine.ts");
 const ui=read("app/unit-economics/VedUnitEconomicsLive.tsx");
 const route=read("app/api/unit-economics/prospective/route.ts");
 const pilot=read("app/unit-economics/UnitEconomicsPilotClient.tsx");
 assert.ok(engine.includes("[[1,10000],[10001,29999],[30000,30000],[30100,ceiling]]"));
 assert.ok(engine.includes("UNIT_PRICE_POLICY_VERSION=2"));
 assert.ok(engine.includes("settingsWithoutManualPrice"));
 assert.ok(route.includes("pricePolicyVersion:value.pricePolicyVersion??1"));
 assert.ok(pilot.includes("c.pricePolicyVersion===2"));
 assert.ok(ui.includes("unit-ved-summary-price-input"));
 assert.ok(ui.includes('aria-label="Цена продажи"'));
 assert.ok(ui.includes("submitSellingPrice"));
 assert.ok(ui.includes("applySellingPrice(null)"));
 assert.ok(ui.includes("Вернуть автоподбор"));
 assert.ok(ui.includes("unit-ved-ozon-tiers"));
 assert.ok(route.includes("A price-only edit updates just the selected scheme"));
 assert.ok(route.includes("suggestPreliminaryTargetPrice(effective"));
});

test("Цена товара: PATCH возвращает финансовые показатели; окно не исчезает при пересчёте",()=>{
 const modal=read("app/unit-economics/VedUnitEconomicsLive.tsx");
 const list=read("app/unit-economics/UnitEconomicsPilotClient.tsx");
 const api=read("app/api/unit-economics/prospective/route.ts");
 const start=modal.indexOf("async function applySellingPrice(");
 const end=modal.indexOf("function submitSellingPrice(",start);
 assert.ok(start>=0&&end>start,"Не найдена обработка сохранения цены");
 const apply=modal.slice(start,end);
 assert.ok(api.includes("calculation:{...next,settings:newSettings,computedAt"));
 assert.ok(modal.includes("onPriceUpdated?:(productId:string,model:Model,scheme:Scheme)=>void"));
 assert.ok(apply.includes("onPriceUpdated?.(savedId,savedModel,updated)"));
 assert.ok(apply.includes("setProduct(current=>current?.id===savedId"));
 assert.ok(!apply.includes("setRevision("),"PATCH не должен повторно загружать карточку");
 assert.ok(!apply.includes("onSaved?.()"),"PATCH не должен запрашивать всю таблицу");
 assert.ok(list.includes("setVedProducts(current=>current.map(p=>p.id===productId"));
 assert.ok(list.includes("if(vedSelected)return"),"Отключаем таймер обновления при открытой карточке");
 assert.ok(modal.includes("loadedProductId.current===modalProductId"));
 assert.ok(modal.includes("refreshing&&<p"),"При обновлении тело карточки остаётся видимым");
});

test("Фото КП в предпросмотре: рамка подстраивается под реальный размер без пустых полей",()=>{
 const css=read("app/unit-economics/unit-economics-pilot.css");
 const ui=read("app/unit-economics/UnitEconomicsPilotClient.tsx");
 assert.match(css,/\.unit-pilot-photo-popover\{[^}]*width:max-content;height:max-content;/);
 assert.match(css,/\.unit-pilot-photo-popover img\{[^}]*width:auto;height:auto;/);
 assert.doesNotMatch(css,/\.unit-pilot-photo-popover\{[^}]*width:300px;height:350px;/);
 assert.match(ui,/fitImagePreview\(image:HTMLImageElement\)/);
 assert.match(ui,/onLoad=\{e=>fitImagePreview\(e\.currentTarget\)\}/);
 assert.ok(ui.includes("image.parentElement?.getBoundingClientRect()"));
});

test("Система хранит краткое название, полное название и исходное КП раздельно",()=>{
 const migration=read("supabase/migrations/20261105_unit_ved_product_full_names.sql");
 const sync=read("lib/unit-economics/prospective-sync.ts");
 const route=read("app/api/unit-economics/prospective/route.ts");
 const editor=read("app/unit-economics/VedUnitEconomicsLive.tsx");
 const pilot=read("app/unit-economics/UnitEconomicsPilotClient.tsx");
 const overrides=read("lib/unit-economics/product-overrides.ts");
 assert.match(migration,/ADD COLUMN IF NOT EXISTS full_name text/);
 assert.match(migration,/attributes jsonb NOT NULL DEFAULT/);
 assert.ok(sync.includes("buildNewProductNaming(originalDescription,sku)"));
 assert.ok(sync.includes("name:naming.shortName"));
 assert.ok(sync.includes("item.naming?.fullName"));
 assert.ok(sync.includes("item.naming?.attributes"));
 assert.ok(sync.includes("?.overrides as ProductOverrides"));
 assert.ok(route.includes("full_name,attributes"));
 assert.ok(route.includes("source_description:requestedId?"));
 assert.ok(route.includes("description_original"));
 assert.ok(route.includes('field==="name"||field==="fullName"'));
 assert.ok(route.includes("if(onlyNames)"));
 assert.ok(editor.includes("<details className=\"unit-ved-full-description\">"));
 assert.ok(!editor.includes('<details open className="unit-ved-full-description">'));
 assert.ok(editor.includes("Полное наименование и характеристики"));
 assert.ok(editor.includes("source_description"));
 assert.ok(editor.includes("textarea className=\"unit-ved-full-name-input\""));
 assert.ok(pilot.includes("x.full_name||"));
 assert.ok(overrides.includes('key==="fullName"'));
});
