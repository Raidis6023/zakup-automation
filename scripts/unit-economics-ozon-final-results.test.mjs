import assert from "node:assert/strict";
import test from "node:test";
import {calculateOzonFinalResults} from "../lib/unit-economics/ozon/final-results.ts";
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,"Получено "+a+", ожидалось "+b);
const fbo={
 model:"FBO",sellingPriceGross:6000,costGross:1669.82,
 outputVat:1081.967213114754,inputVatTotal:1064.1057560222969,purchaseInputVat:301.1150819672131,
 expenses:[
  {code:"commission",label:"Комиссия",group:"commission",amount:3060},
  {code:"delivery",label:"Логистика с возвратами",group:"logistics",amount:404.6360780487806},
  {code:"last-mile",label:"Последняя миля",group:"logistics",amount:25},
  {code:"ads",label:"Реклама",group:"advertising",amount:600},
  {code:"acquiring",label:"Эквайринг",group:"other",amount:90},
  {code:"receiving",label:"Приёмка",group:"other",amount:111.49402352941178},
  {code:"mayak",label:"ТК Маяк",group:"other",amount:44.18802540204678},
  {code:"handling",label:"Обработка",group:"other",amount:30},
  {code:"packing",label:"Упаковка",group:"other",amount:17.67521016081871},
  {code:"defects",label:"Брак",group:"other",amount:34.21762295081967},
  {code:"insurance",label:"Страхование",group:"other",amount:48.46662295081967}
 ]};
test("FBO: Google Sheets, строка 146",()=>{
 const r=calculateOzonFinalResults(fbo);
 near(r.profit,-153.3590401351537);
 near(r.roiPercent,-11.204682478643657);
 near(r.marginPercent,-3.1183004827481254);
 near(r.logistics,429.6360780487806);
 near(r.otherExpensesAndTaxes,393.90296208637375);
});
test("FBS: контрольный скриншот пилота",()=>{
 const r=calculateOzonFinalResults({model:"FBS",sellingPriceGross:6000,costGross:1669.82,outputVat:1081.967213114754,inputVatTotal:1058.697213114754,purchaseInputVat:301.1150819672131,expenses:[
  {code:"commission",label:"Комиссия",group:"commission",amount:3060},
  {code:"logistics",label:"Логистика",group:"logistics",amount:473.82},
  {code:"ads",label:"Реклама",group:"advertising",amount:600},
  {code:"other",label:"Прочие",group:"other",amount:273.24}]});
 near(r.profit,-100.15);
 near(r.roiPercent,-100.15/1368.7049180327867*100);
 near(r.marginPercent,-100.15/(6000-1081.967213114754)*100);
 near(r.otherExpensesAndTaxes,296.51);
});
test("Повторный расход запрещён",()=>assert.throws(()=>calculateOzonFinalResults({...fbo,expenses:[fbo.expenses[0],fbo.expenses[0]]}),/повторно/));
test("Деление на ноль не превращается в ROI 0%",()=>{
 const r=calculateOzonFinalResults({model:"FBO",sellingPriceGross:0,costGross:0,outputVat:0,inputVatTotal:0,purchaseInputVat:0,expenses:[]});
 assert.equal(r.roiPercent,null);assert.equal(r.marginPercent,null);assert.equal(r.warnings.length,2);
});
