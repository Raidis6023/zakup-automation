"use client";
import FinanceDynamics,{type FinanceMetric} from '../../components/finance/FinanceDynamics';
import CostPerUnitComparison from '../../components/finance/CostPerUnitComparison';
import CopyArticle from '../../components/finance/CopyArticle';
import { Fragment, useMemo, useState } from "react";
import dynamic from 'next/dynamic';
import {knownSum,ratioTotal,uniqueStock} from '../../../lib/finance-totals';
import {advertisingDisplay} from '../../../lib/ozon/advertising-presentation';
import OzonRowRates from './OzonRowRates';
import {downloadFinanceWorkbook} from '../../components/finance/export-xlsx';
const CampaignCharts=dynamic(()=>import('./CampaignCharts'),{ssr:false});

export type FinancialRow = {
  offer_id:string;master_code:string|null;manager:string;name:string|null;
  estimated_result:number|null;revenue:number|null;advertising_amount:number;
  performance_ad_expense:number|null;allocated_seller_ppc?:number;ozon_amount:number;
  order_count:number|null;cancelled_units:number|null;buyout_units:number|null;
  ozon_stock:number|null;main_stock:number|null;ox_stock:number|null;
  in_china:number|null;in_crossdock:number|null;in_transit:number|null;
  transit_revenue:number|null;transit_drr:number|null;mayak_expense:number|null;
  cogs:number|null;unit_cost:number|null;mayak_unit:number|null;
  discontinued:boolean; data_gaps:string[];
  details:Array<{type_id:string;name:string;amount:number;count:number;is_advertising?:boolean;is_reference?:boolean}>;
};
type Data = {
  from:string;to:string;missing_days:string[];unallocated_amount:number;
  stock_as_of?:{ozon_at:string|null;main_at:string|null;ox_at:string|null}|null;
  crossdock_as_of?:string|null;
  unallocated_details?:Array<{name:string;amount:number}>;
  ads_covered?:boolean;ads_covered_days?:number;ads_performance_total?:number|null;
  ads_campaigns_total?:number;ads_campaigns_complete?:number;
  ads_partial_spend?:number;ads_partial_skus?:number;
  ads_jobs?:Array<{status:string;last_error:string|null;date_from:string;date_to:string}>;
  cache_updated_at?:string|null;
  advertising?:{finance_total:number;finance_unallocated:number;partial_performance_total?:number;performance_complete?:boolean};
};
type SortKey =
  "master_code"|"manager"|"offer_id"|"estimated_result"|"revenue"|"ad"|"drr"|
  "storage"|"orders"|"cancelled"|"buyout"|"roas"|"transit"|"transit_revenue"|
  "transit_drr"|"ozon_stock"|"crossdock"|"main"|"ox"|"stock"|"margin"|
  "mayak"|"china"|"abc"|"discontinued";
const money=(v:number|null|undefined)=>v==null?"—":(Math.sign(v)*Math.round(Math.abs(v))||0).toLocaleString("ru-RU",{style:"currency",currency:"RUB",minimumFractionDigits:0,maximumFractionDigits:0});
const qty=(v:number|null|undefined)=>v==null?"—":v.toLocaleString("ru-RU");
const pct=(v:number|null|undefined)=>v==null||!Number.isFinite(v)?"—":
  (v*100).toLocaleString("ru-RU",{maximumFractionDigits:2})+"%";
const round=(v:number)=>Math.round(v*100)/100;
function moneyTone(value:number|null|undefined):string{
  if(value==null)return "";
  if(value<0)return "ozf-bad";
  if(value>0)return "ozf-good";
  return "";
}
function advertising(r:FinancialRow):number|null {
  if(r.advertising_amount!==0)return r.advertising_amount;
  if(r.performance_ad_expense!=null)return -Math.abs(r.performance_ad_expense);
  return null;
}
function adShare(r:FinancialRow):number|null{
  const expense=advertising(r);
  return expense!=null && r.revenue!=null && r.revenue>0 ? Math.abs(expense)/r.revenue : null;
}
function adTone(share:number|null):string{
  if(share==null)return "";
  if(share>0.11)return "ozf-bad";
  if(share>=0.10)return "ozf-caution";
  return "";
}
function storage(r:FinancialRow):number|null{
  const types=r.details.filter(d=>/хранени|размещени/i.test(d.name));
  return types.length?round(types.reduce((s,d)=>s+d.amount,0)):null;
}
function storageTone(v:number|null):string{return v==null?"":v<0?"ozf-bad":"ozf-good";}
function numericSum<T>(values:T[],value:(row:T)=>number|null):number|null{
  const known=values.map(value).filter((v):v is number=>v!=null);
  return known.length?round(known.reduce((a,b)=>a+b,0)):null;
}
function valueFor(r:FinancialRow,key:SortKey):number|string|null{
  const ad=advertising(r), dr=adShare(r), st=storage(r);
  const balance=[r.ozon_stock,r.main_stock,r.ox_stock];
  const stock=balance.every(v=>v!=null)?balance.reduce<number>((s,v)=>s+Number(v),0):null;
  switch(key){
    case "master_code":return r.master_code;case "manager":return r.manager;case "offer_id":return r.offer_id;
    case "estimated_result":return r.estimated_result;case "revenue":return r.revenue;
    case "ad":return ad;case "drr":return dr;case "storage":return st;
    case "orders":return r.order_count;case "cancelled":return r.cancelled_units;
    case "buyout":return r.buyout_units;case "roas":return ad&&r.estimated_result!=null?r.estimated_result/Math.abs(ad):null;
    case "transit":return r.in_transit;case "transit_revenue":return r.transit_revenue;
    case "transit_drr":return r.transit_drr;case "ozon_stock":return r.ozon_stock;
    case "crossdock":return r.in_crossdock;case "main":return r.main_stock;
    case "ox":return r.ox_stock;case "stock":return stock;
    case "margin":return r.buyout_units&&r.estimated_result!=null?r.estimated_result/r.buyout_units:null;
    case "mayak":return r.mayak_expense==null?null:-Math.abs(r.mayak_expense);
    case "china":return r.in_china;case "abc":return null;
    case "discontinued":return r.discontinued?1:0;
  }
}
type FinanceBreakdownLine={id:string;name:string;category:string;amount:number;count:number|null;reference?:boolean};
function ozonExpenseAndAdCount(r:FinancialRow){
 const linked=r.details.filter(x=>x.is_advertising&&!x.is_reference&&x.amount<0);
 const directlyCharged=linked.reduce((sum,x)=>sum+Math.abs(x.amount),0);
 const allocated=Math.max(0,-Number(r.allocated_seller_ppc??0));
 const actual=round(directlyCharged+allocated);
 const operations=linked.reduce((sum,x)=>sum+Math.max(0,x.count),0);
 return {actual,operations:operations||null,fromPerformance:r.performance_ad_expense===null?null:Math.abs(r.performance_ad_expense)};
}
function ozonBreakdownLines(r:FinancialRow):FinanceBreakdownLine[]{
 const entries:FinanceBreakdownLine[]=r.details.map((item,i)=>({
  id:item.type_id+'-'+i,
  name:item.name==='ITEM'?'Товарное начисление Ozon (ITEM)':item.name,
  category:item.is_reference?'Начисление Ozon':item.type_id==='SALES'?'Выручка':
   item.type_id==='COMMISSION'?'Комиссия':item.type_id==='REMAINDER'?'Прочее':
   item.type_id==='SERVICE'?'Услуга Ozon':'Начисление Ozon',
  amount:item.amount,count:item.count,reference:!!item.is_reference
 }));
 if(r.cogs!==null)entries.push({id:'cogs',name:'Цена закупа × расчётные выкупы',category:'Цена закупа',amount:-Math.abs(r.cogs),count:r.buyout_units});
 if(r.mayak_expense!==null)entries.push({id:'mayak',name:'ТК Маяк × заказанные единицы',category:'Внешний расход',amount:-Math.abs(r.mayak_expense),count:r.order_count});
 if(r.performance_ad_expense!==null){
  const {operations}=ozonExpenseAndAdCount(r);
  entries.push({id:'performance-reference',name:'Реклама по SKU (Performance, справочно)',
   category:'Распределение рекламы',amount:-Math.abs(r.performance_ad_expense),
   count:operations,reference:true});
 }
 return entries.sort((a,b)=>{
  const incomeA=a.amount>0,incomeB=b.amount>0;
  if(incomeA!==incomeB)return incomeA?-1:1;
  if(incomeA)return b.amount-a.amount;
  // For outflows largest debit first, independent of the negative sign.
  return Math.abs(b.amount)-Math.abs(a.amount);
 });
}
function ozonPerUnitItems(r:FinancialRow){
 const ad=ozonExpenseAndAdCount(r);
 const advertisingAmount=ad.actual>0?ad.actual:ad.fromPerformance;
 return [
  ...r.details.filter(item=>!item.is_reference&&!item.is_advertising&&item.amount<0)
    .map(item=>({name:item.name,amount:-item.amount})),
  {name:ad.actual>0?'Реклама (по финансовым списаниям)':ad.fromPerformance!==null?'Реклама (доступная статистика, справочно)':'Реклама (нет подтверждённой детализации)',
   amount:advertisingAmount},
  {name:'Себестоимость',amount:r.cogs},{name:'ТК Маяк',amount:r.mayak_expense}
 ];
}
export default function FinancierDetailTable({
  data,rows,includeUnallocated,onToggle,onSaved
}:{
  data:Data|null;rows:FinancialRow[];includeUnallocated:boolean;
  onSaved:()=>void|Promise<void>;
  onToggle:(masterCode:string|null,offerId:string,checked:boolean)=>void|Promise<void>;
}) {
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<{key:SortKey;dir:1|-1}>({key:"estimated_result",dir:-1});
 const [graphMetric,setGraphMetric]=useState<FinanceMetric>('orders');
  const [expanded,setExpanded]=useState<string|null>(null);
  const [abcMetric]=useState("revenue");

  const abc=useMemo(()=>{
    const sorted=rows.filter(r=>(r.revenue??0)>0).slice().sort((a,b)=>(b.revenue??0)-(a.revenue??0));
    const total=sorted.reduce((sum,r)=>sum+(r.revenue??0),0);
    const labels=new Map<string,string>();let running=0;
    for(const r of sorted){const share=total>0?running/total:0;
      labels.set(r.offer_id,share<0.8?"A":share<0.95?"B":"C");
      running+=r.revenue??0;}
    return labels;
  },[rows,abcMetric]);
  const display=useMemo(()=>rows.filter(r=>(r.offer_id+" "+(r.master_code??"")+" "+r.manager+" "+(r.name??""))
     .toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")))
    .sort((a,b)=>{
      const av=sort.key==="abc"?abc.get(a.offer_id)??null:valueFor(a,sort.key);
      const bv=sort.key==="abc"?abc.get(b.offer_id)??null:valueFor(b,sort.key);
      if(av==null)return bv==null?0:1;
      if(bv==null)return -1;
      return (typeof av==="string"||typeof bv==="string"
        ?String(av).localeCompare(String(bv),"ru")
        :Number(av)-Number(bv))*sort.dir;
    }),[rows,search,sort,abc]);

  // The summary is scoped to the selected KM, not the free-text search.
  const sumProfit=numericSum(rows,r=>r.estimated_result);
  const missingProfitCount=rows.filter(r=>r.estimated_result===null).length;
  const profitIsPartial=missingProfitCount>0;
  const globalAdjustment=includeUnallocated?Number(data?.unallocated_amount??0):0;
  // This is the known subtotal, never a confirmed whole-company P&L when
  // any SKU has missing order coverage or acquisition cost.
  const operatingProfit=sumProfit==null?null:round(sumProfit+globalAdjustment);
  const sumRevenue=numericSum(rows,r=>r.revenue);
  const marketingBySku=numericSum(rows,advertising);
  const sellerAdGlobal=includeUnallocated && data?.advertising
    ?Number(data.advertising.finance_total):null;
  const referenceBySku=includeUnallocated?
    (data?.advertising?.partial_performance_total??data?.ads_partial_spend??null):
    numericSum(rows,r=>r.performance_ad_expense===null?null:Math.abs(r.performance_ad_expense));
  const globalAdvertising=advertisingDisplay(sellerAdGlobal,referenceBySku,!!data?.ads_covered);
  const hasLocalReference=rows.some(r=>r.performance_ad_expense!==null&&r.advertising_amount===0);
  const adAmount=includeUnallocated?globalAdvertising.amount:marketingBySku;
  const adReferenceOnly=includeUnallocated
    ?globalAdvertising.kind==='performance_partial':hasLocalReference;
  const adUnknown=includeUnallocated?globalAdvertising.kind==='unknown':adAmount===null;
  const directStorage=numericSum(rows,storage);
  const unallocatedStorage=includeUnallocated?
    (data?.unallocated_details??[]).filter(x=>/хранени|размещени/i.test(x.name))
      .reduce((sum,x)=>sum+Number(x.amount),0):0;
  const storageAmount=directStorage==null && unallocatedStorage===0?null:
    round((directStorage??0)+unallocatedStorage);
  const missingData=rows.filter(r=>
    !r.master_code||r.manager==="Не назначен"||
    r.data_gaps.some(g=>/master_code|км|себестоим|цена закуп|тк маяк/i.test(g)));
  function exportFinancialResult(){
    return downloadFinanceWorkbook(`Ozon_финрез_${data?.from??"период"}_${data?.to??""}.xlsx`,[
      {name:"Финансовый результат",rows:rows.map(r=>{
        const ad=advertising(r),hold=storage(r),share=adShare(r);
        return {"Код товара":r.master_code,"КМ":r.manager,"Артикул":r.offer_id,"Товар":r.name,
          "Операционная прибыль, ₽":r.estimated_result,"Выручка, ₽":r.revenue,"Начисления Ozon, ₽":r.ozon_amount,
          "Реклама, ₽":ad,"ДРР, %":share===null?null:Number((share*100).toFixed(4)),
          "Хранение, ₽":hold,"Заказы, шт":r.order_count,"Отмены, шт":r.cancelled_units,"Выкупы, шт":r.buyout_units,
          "Себестоимость, ₽":r.cogs,"Себестоимость, ₽/шт":r.unit_cost,"ТК Маяк, ₽":r.mayak_expense,
          "ТК Маяк, ₽/шт":r.mayak_unit,"Чего не хватает":r.data_gaps.join("; ")};
      })},
      {name:"Итоги",rows:[{"Период с":data?.from,"Период по":data?.to,"Операционная прибыль, ₽":operatingProfit,
        "Выручка, ₽":sumRevenue,"Статус прибыли":profitIsPartial?"Неполный расчёт":"Расчёт по всем артикулам","Артикулов без прибыли":missingProfitCount,"Реклама по начислениям Seller, ₽":sellerAdGlobal??numericSum(rows,r=>r.advertising_amount),"Реклама по SKU Performance (справочно), ₽":referenceBySku,"Хранение, ₽":storageAmount,"Артикулов":rows.length}]}
    ]);
  }
  function exportMissingData(){
    return downloadFinanceWorkbook(`Ozon_недостающие_данные_${data?.from??"период"}_${data?.to??""}.xlsx`,[
      {name:"Недостающие данные",rows:missingData.map(r=>({"Код товара":r.master_code,"Артикул":r.offer_id,
        "Товар":r.name,"КМ":r.manager==="Не назначен"?"":r.manager,"Себестоимость, ₽/шт":r.unit_cost,
        "ТК Маяк, ₽/шт":r.mayak_unit,"Чего не хватает":r.data_gaps.join("; "),"Период с":data?.from,"Период по":data?.to}))}
    ]);
  }
  const positionsPositive=rows.filter(r=>r.estimated_result!=null&&r.estimated_result>0).length;
  const positionsNegative=rows.filter(r=>r.estimated_result!=null&&r.estimated_result<0).length;
  const profitability=!profitIsPartial&&operatingProfit!=null&&sumRevenue!=null&&sumRevenue>0
    ?operatingProfit/sumRevenue:null;
  const totalRoas=ratioTotal(rows,r=>advertising(r)===null?null:r.estimated_result,r=>{const ad=advertising(r);return ad===null?null:Math.abs(ad)});
  const transitDrr=ratioTotal(rows,r=>{const ad=advertising(r);return ad===null?null:Math.abs(ad)},r=>r.transit_revenue);
  const profitPerUnit=ratioTotal(rows,r=>r.estimated_result,r=>r.buyout_units);
  const stockKey=(r:FinancialRow)=>r.master_code??r.offer_id;
  const totalMain=uniqueStock(rows,stockKey,r=>r.main_stock),totalOx=uniqueStock(rows,stockKey,r=>r.ox_stock),totalChina=uniqueStock(rows,stockKey,r=>r.in_china);
  const totalOzon=knownSum(rows,r=>r.ozon_stock),totalBalance=[totalMain,totalOx,totalOzon].every(x=>x!==null)?Number(totalMain)+Number(totalOx)+Number(totalOzon):null;
  const kpis=[
    {name:profitIsPartial?"Операционная прибыль (известная часть)":"Операционная прибыль",
      value:money(operatingProfit),tone:moneyTone(operatingProfit)},
    {name:"Выручка",value:money(sumRevenue),tone:moneyTone(sumRevenue)},
    {name:"Рентабельность",value:pct(profitability),tone:moneyTone(profitability)},
    {name:adReferenceOnly?"Реклама по SKU (неполная)":adUnknown?"Реклама (нет данных)":data?.ads_covered?"Реклама":"Реклама"+(includeUnallocated?"":" (часть)"),
      value:money(adAmount),tone:adAmount==null?"":Math.abs(adAmount)>0?"ozf-bad":"ozf-good"},
    {name:"Платное хранение",value:money(storageAmount),tone:storageAmount==null?"":Math.abs(storageAmount)>0?"ozf-bad":"ozf-good"},
    {name:"Положительные позиции",value:qty(positionsPositive),tone:positionsPositive>0?"ozf-good":"ozf-bad"},
    {name:"Отрицательные позиции",value:qty(positionsNegative),tone:positionsNegative>0?"ozf-bad":"ozf-good"}
  ];
  const defs:Array<[SortKey,string]>=[
    ["master_code","Код товара"],["manager","КМ"],["offer_id","Артикул"],
    ["estimated_result","Операционная прибыль"],["revenue","Выручка"],
    ["ad","Реклама, ₽"],["drr","ДРР"],["storage","Хранение, ₽"],
    ["orders","Заказы"],["cancelled","Отмены"],["buyout","Расч. выкупы*"],
    ["roas","ROAS"],["transit","Товары в пути"],["transit_revenue","Выручка с товарами в пути"],
    ["transit_drr","ДРР с товарами в пути"],["ozon_stock","Остатки Ozon"],
    ["crossdock","В пути на склады"],["main","Аведэкс основной"],
    ["ox","Аведэкс ОХ"],["stock","Итого остатки"],
    ["margin","Прибыль/ед."],
    ["mayak","ТК Маяк, ₽"],["china","В пути из Китая"],["abc","ABC"],
    ["discontinued","Выведено из продажи"]
  ];
  function toggleSort(key:SortKey){
    setSort(s=>({key,dir:s.key===key?(s.dir===1?-1:1):-1}));
  }
  function rowFigures(r:FinancialRow){
    const ad=advertising(r),drr=adShare(r),hold=storage(r);
    return {ad,drr,hold,roas:ad&&r.estimated_result!=null?r.estimated_result/Math.abs(ad):null};
  }
  return <div className="ozf-panel ozf-financial-summary" id="ozf-items">
    <div className="ozf-section-heading"><div>
      <h2>Результаты по артикулам</h2>
      
    </div><div className="ozf-toolbar"><button type="button" className="ozf-btn" onClick={()=>void exportFinancialResult()}>Скачать финрез XLSX</button><button type="button" className="ozf-btn" onClick={()=>void exportMissingData()}>Недостающие данные XLSX · {missingData.length}</button><a href="#ozf-unallocated" className="ozf-btn ozf-jump">Нераспределённые расходы ↓</a></div></div>
    <div className="ozf-kpi-grid">{kpis.map(k=>
      <div key={k.name} className={"ozf-kpi "+k.tone}>
        {['Выручка','Операционная прибыль'].includes(k.name)?<button type="button" className="ozf-kpi-link" onClick={()=>setGraphMetric(k.name==='Выручка'?'revenue':'profit')}>{k.name}</button>:<span>{k.name}</span>}<strong>{k.value}</strong>
      </div>)}
    </div>
    {profitIsPartial&&<p className="ozf-notice" role="status" style={{marginTop:8}}>
      Общий финансовый результат предварительный: прибыль не рассчитана для {missingProfitCount} из {rows.length} артикулов.
      Показана только известная часть с нераспределёнными начислениями.
      Для оставшихся позиций проверь себестоимость, ТК Маяк и полноту заказов.
    </p>}
    {adReferenceOnly&&<p className="ozf-notice" role="status" style={{marginTop:8}}>
      В рекламной карточке показаны доступные расходы Performance по SKU, справочно.
      В финансовых начислениях Seller за этот период реклама ещё не подтверждена.
      Эти расходы не списываются из прибыли второй раз; сумма может увеличиться после завершения истории РК.
    </p>}
    {adUnknown&&<p className="ozf-notice" role="status" style={{marginTop:8}}>
      Расходы на рекламу пока не подтверждены, ноль не означает отсутствие кампаний.
    </p>}
    {data?.stock_as_of?.main_at&&<p className="ozf-notice" style={{marginTop:8}}>
      Аведэкс основной: снимок от {data.stock_as_of.main_at.split('-').reverse().join('.')}.
      {data.stock_as_of.ox_at&&<> Аведэкс ОХ: снимок от {data.stock_as_of.ox_at.split('-').reverse().join('.')}.</>}
      {' '}Остатки собственных складов не обновляются вместе с остатками маркетплейса.
    </p>}
    <FinanceDynamics key={graphMetric} marketplace="ozon" revision={data?.cache_updated_at??''} from={data?.from??''} to={data?.to??''} offers={includeUnallocated?undefined:rows.map(r=>r.offer_id)} selected={graphMetric} expectedProfit={profitIsPartial?null:operatingProfit}/><div className="ozf-section-tools">
      <input placeholder="Поиск по артикулу, коду или КМ" aria-label="Поиск товаров" value={search}
        onChange={e=>setSearch(e.target.value)} />
      <span>Сортировка: {defs.find(d=>d[0]===sort.key)?.[1]} {sort.dir===-1?"↓":"↑"}</span>
    </div>
    <div className="ozf-financial-scroll" role="region" aria-label="Финансовые результаты">
      <table className="ozf-table ozf-financial-table">
        <thead><tr>{defs.map(([key,label])=>
          <th key={key}><button type="button" className="ozf-sort-control" onClick={()=>toggleSort(key)}
            aria-label={"Сортировать "+label}>{label}{sort.key===key?(sort.dir===-1?" ↓":" ↑"):<span className="ozf-sort-hint"> ↕</span>}</button>
          </th>)}
        </tr></thead>
        <tbody>{display.map(r=>{
          const fig=rowFigures(r),stockValues=[r.ozon_stock,r.main_stock,r.ox_stock];
          const stockTotal=stockValues.every(v=>v!=null)?stockValues.reduce<number>((s,v)=>s+Number(v),0):null;
          const margin=r.buyout_units&&r.estimated_result!=null?r.estimated_result/r.buyout_units:null;
          const roasClass=fig.roas==null?"":fig.roas<1?"ozf-bad":"ozf-good";
          return <Fragment key={r.offer_id}><tr className={r.discontinued?"ozf-discontinued":""}>
            <td>{r.master_code??"—"}</td><td>{r.manager}</td>
            <td><button type="button" className="ozf-article-btn" aria-expanded={expanded===r.offer_id}
              onClick={()=>setExpanded(expanded===r.offer_id?null:r.offer_id)}>
              <span>{expanded===r.offer_id?"▾":"▸"}</span> {r.offer_id}</button><CopyArticle article={r.offer_id}/></td>
            <td className={moneyTone(r.estimated_result)}
              title={r.estimated_result===null
                ?(r.data_gaps?.length?r.data_gaps.join("; "):"Недостаточно данных для полного расчёта")
                :undefined}>
              {r.estimated_result===null?"Нет расчёта":money(r.estimated_result)}
            </td>
            <td>{money(r.revenue)}</td>
            <td className={adTone(fig.drr)}>{money(fig.ad)}</td>
            <td className={adTone(fig.drr)}>{pct(fig.drr)}</td>
            <td className={storageTone(fig.hold)}>{money(fig.hold)}</td>
            <td>{qty(r.order_count)}</td><td>{qty(r.cancelled_units)}</td><td>{qty(r.buyout_units)}</td>
            <td className={roasClass}>{pct(fig.roas)}</td>
            <td>{qty(r.in_transit)}</td><td>{money(r.transit_revenue)}</td>
            <td>{pct(r.transit_drr)}</td><td>{qty(r.ozon_stock)}</td><td>{qty(r.in_crossdock)}</td>
            <td>{qty(r.main_stock)}</td><td>{qty(r.ox_stock)}</td><td>{qty(stockTotal)}</td>
            <td className={moneyTone(margin)}>{money(margin)}</td>
            <td>
              {r.mayak_expense==null?"—":money(-Math.abs(r.mayak_expense))}</td>
            <td>{qty(r.in_china)}</td><td>{abc.get(r.offer_id)??"—"}</td>
            <td className="ozf-checkbox-cell"><label className="ozf-inline-checkbox">
              <input type="checkbox" checked={r.discontinued} disabled={!r.master_code}
                aria-label={"Выводится из продажи: "+r.offer_id}
                onChange={e=>void onToggle(r.master_code,r.offer_id,e.target.checked)}/>
              <span className="ozf-checkbox-caption">{r.discontinued?"Да":"Нет"}</span>
            </label></td>
          </tr>
          {expanded===r.offer_id&&<tr key={r.offer_id+"-detail"} className="ozf-expanded-row">
            <td colSpan={25}>
              <div className="ozf-expanded-content"><div className="ozf-pinned-article"><strong>{r.offer_id}</strong><CopyArticle article={r.offer_id}/></div>{r.offer_id.startsWith('SKU:')&&<p className="ozf-error">Нет подтверждённой связки SKU {r.offer_id.slice(4)} с артикулом продавца. Скопируй SKU и найди его в кабинете Ozon в списке товаров. Автоматическое сопоставление с чужой карточкой отключено.</p>}
                <div className="ozf-income-unit-grid"><div><table className="ozf-breakdown-table"><thead><tr>
                  <th>Статья</th><th>Категория</th><th>Операций</th><th>Сумма, ₽</th>
                </tr></thead><tbody>
                  {r.estimated_result===null&&<tr className="ozf-missing-explainer">
                    <td colSpan={4}><strong>Почему не рассчитана прибыль:</strong>{" "}
                      {(r.data_gaps?.length?r.data_gaps:[
                        "Нет подтверждённой себестоимости или данных заказов"
                      ]).join("; ")}. Исправь сведения в настройках финансиста.</td>
                  </tr>}
                  {ozonBreakdownLines(r).map(item=>
                    <tr key={item.id} className={item.reference?'ozf-item-reference':''}>
                      <td>{item.name}</td><td>{item.category}</td>
                      <td title={item.count===null?'Число отдельных списаний по SKU не подтверждено':undefined}>{item.count??'—'}</td>
                      <td className={moneyTone(item.amount)}>{money(item.amount)}</td>
                    </tr>
                  )}
                  <tr className="ozf-breakdown-total"><td>Операционная прибыль</td>
                    <td>Итог</td><td>—</td><td className={moneyTone(r.estimated_result)}>
                    {money(r.estimated_result)}</td>
                  </tr>
                </tbody></table></div><CostPerUnitComparison market="Ozon" units={r.buyout_units} items={ozonPerUnitItems(r)}/></div>
                <details><summary>{r.offer_id} · КМ, себестоимость и ТК Маяк</summary><OzonRowRates master={r.master_code} onSaved={onSaved}/></details><FinanceDynamics marketplace="ozon" revision={data?.cache_updated_at??''} from={data?.from??''} to={data?.to??''} offer={r.offer_id}/>
                <CampaignCharts offer={r.offer_id} from={data?.from??''} to={data?.to??''}/>
              </div>
            </td>
          </tr>}
          </Fragment>;
        })}
        {!display.length&&<tr><td colSpan={25} className="ozf-empty">Нет артикулов для выбранного фильтра.</td></tr>}
        </tbody>
        <tfoot><tr title="Итоги по известным значениям. Проценты взвешены по соответствующим суммам; собственные остатки учтены один раз на ЕНОТ.">
          <td title={profitIsPartial?'Прибыль известна не для всех артикулов: это промежуточная сумма':'Сверка по всем выбранным артикулам'}>{profitIsPartial?'Итого (неполное)':'Итого за период'}</td><td colSpan={2}>{qty(rows.length)} артикулов</td>
          <td className={moneyTone(operatingProfit)}>{money(operatingProfit)}</td>
          <td>{money(sumRevenue)}</td>
          <td>{money(marketingBySku)}</td>
          <td>{sumRevenue&&marketingBySku!=null?pct(Math.abs(marketingBySku)/sumRevenue):"—"}</td>
          <td>{money(storageAmount)}</td>
          <td>{qty(numericSum(rows,r=>r.order_count))}</td>
          <td>{qty(numericSum(rows,r=>r.cancelled_units))}</td>
          <td>{qty(numericSum(rows,r=>r.buyout_units))}</td>
          <td title="Взвешенный ROAS по строкам с известной прибылью и рекламой">{pct(totalRoas)}</td>
          <td>{qty(numericSum(rows,r=>r.in_transit))}</td>
          <td>{money(numericSum(rows,r=>r.transit_revenue))}</td><td title="Реклама / выручка с товарами в пути по строкам с известными значениями">{pct(transitDrr)}</td>
          <td>{qty(numericSum(rows,r=>r.ozon_stock))}</td>
          <td>{qty(numericSum(rows,r=>r.in_crossdock))}</td>
          <td>{qty(totalMain)}</td>
          <td>{qty(totalOx)}</td>
          <td>{qty(totalBalance)}</td><td>{money(profitPerUnit)}</td>
          <td>{money(numericSum(rows,r=>r.mayak_expense==null?null:-Math.abs(r.mayak_expense)))}</td>
          <td>{qty(totalChina)}</td><td>—</td><td>{qty(rows.filter(r=>r.discontinued).length)}</td>
        </tr></tfoot>
      </table>
    </div>
    <div className="ozf-reconcile-line">
      <b>Итого за период:</b> результат по артикулам {money(sumProfit)}
      {includeUnallocated?<>
        {" "}+ нераспределённые начисления {money(globalAdjustment)}
        {" "} = <strong className={moneyTone(operatingProfit)}>{money(operatingProfit)}</strong>.
      </>:<>. Общие начисления без привязки к КМ не включены в результат конкретного менеджера.</>}
    </div>

  </div>;
}
