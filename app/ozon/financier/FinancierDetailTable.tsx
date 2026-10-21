"use client";
import { Fragment, useMemo, useState } from "react";

export type FinancialRow = {
  offer_id:string;master_code:string|null;manager:string;name:string|null;
  estimated_result:number|null;revenue:number|null;advertising_amount:number;
  performance_ad_expense:number|null;allocated_seller_ppc?:number;ozon_amount:number;
  order_count:number|null;cancelled_units:number|null;buyout_units:number|null;
  ozon_stock:number|null;main_stock:number|null;ox_stock:number|null;
  in_china:number|null;in_crossdock:number|null;in_transit:number|null;
  transit_revenue:number|null;transit_drr:number|null;mayak_expense:number|null;
  cogs:number|null;unit_cost:number|null;mayak_unit:number|null;
  discontinued:boolean;
  details:Array<{type_id:string;name:string;amount:number;count:number;is_advertising?:boolean}>;
};
type Data = {
  from:string;to:string;missing_days:string[];unallocated_amount:number;
  stock_as_of?:{ozon_at:string|null;main_at:string|null;ox_at:string|null}|null;
  unallocated_details?:Array<{name:string;amount:number}>;
  ads_covered?:boolean;ads_covered_days?:number;ads_performance_total?:number|null;
  ads_jobs?:Array<{status:string;last_error:string|null;date_from:string;date_to:string}>;
  advertising?:{finance_total:number;finance_unallocated:number};
};
type SortKey =
  "master_code"|"manager"|"offer_id"|"estimated_result"|"revenue"|"ad"|"drr"|
  "storage"|"orders"|"cancelled"|"buyout"|"roas"|"transit"|"transit_revenue"|
  "transit_drr"|"ozon_stock"|"crossdock"|"main"|"ox"|"stock"|"margin"|
  "price"|"mayak"|"china"|"abc"|"discontinued";
const money=(v:number|null|undefined)=>v==null?"—":v.toLocaleString("ru-RU",{style:"currency",currency:"RUB"});
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
  return "ozf-good";
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
    case "price":return r.buyout_units&&r.revenue!=null?r.revenue/r.buyout_units:null;
    case "mayak":return r.mayak_expense==null?null:-Math.abs(r.mayak_expense);
    case "china":return r.in_china;case "abc":return null;
    case "discontinued":return r.discontinued?1:0;
  }
}
export default function FinancierDetailTable({
  data,rows,includeUnallocated,onToggle
}:{
  data:Data|null;rows:FinancialRow[];includeUnallocated:boolean;
  onToggle:(masterCode:string|null,offerId:string,checked:boolean)=>void|Promise<void>;
}) {
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<{key:SortKey;dir:1|-1}>({key:"estimated_result",dir:-1});
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
  const complete=rows.every(r=>r.estimated_result!=null);
  const sumProfit=numericSum(rows,r=>r.estimated_result);
  const globalAdjustment=includeUnallocated?Number(data?.unallocated_amount??0):0;
  const operatingProfit=sumProfit==null?null:round(sumProfit+globalAdjustment);
  const sumRevenue=numericSum(rows,r=>r.revenue);
  const marketingBySku=numericSum(rows,advertising);
  const sellerAdGlobal=includeUnallocated && data?.advertising
    ?Number(data.advertising.finance_total):null;
  const adAmount=sellerAdGlobal!=null?sellerAdGlobal:marketingBySku;
  const directStorage=numericSum(rows,storage);
  const unallocatedStorage=includeUnallocated?
    (data?.unallocated_details??[]).filter(x=>/хранени|размещени/i.test(x.name))
      .reduce((sum,x)=>sum+Number(x.amount),0):0;
  const storageAmount=directStorage==null && unallocatedStorage===0?null:
    round((directStorage??0)+unallocatedStorage);
  const positionsPositive=rows.filter(r=>r.estimated_result!=null&&r.estimated_result>0).length;
  const positionsNegative=rows.filter(r=>r.estimated_result!=null&&r.estimated_result<0).length;
  const profitability=operatingProfit!=null&&sumRevenue!=null&&sumRevenue>0
    ?operatingProfit/sumRevenue:null;
  const kpis=[
    {name:"Операционная прибыль",value:money(operatingProfit),tone:moneyTone(operatingProfit),
     note:includeUnallocated?"Включает общий нераспределённый результат":"Без нераспределённых статей других КМ"},
    {name:"Выручка",value:money(sumRevenue),tone:moneyTone(sumRevenue)},
    {name:"Рентабельность",value:pct(profitability),tone:moneyTone(profitability)},
    {name:"Реклама",value:money(adAmount),tone:adAmount==null?"":Math.abs(adAmount)>0?"ozf-bad":"ozf-good",
     note:includeUnallocated?"Общие списания Seller API":"По КМ: сумма Seller API после распределения по артикулам"},
    {name:"Платное хранение",value:money(storageAmount),tone:storageAmount==null?"":Math.abs(storageAmount)>0?"ozf-bad":"ozf-good",
     note:"Только суммы, привязанные к SKU"},
    {name:"Положительные позиции",value:qty(positionsPositive),tone:positionsPositive>0?"ozf-good":"ozf-bad"},
    {name:"Отрицательные позиции",value:qty(positionsNegative),tone:positionsNegative>0?"ozf-bad":"ozf-good"}
  ];
  const defs:Array<[SortKey,string]>=[
    ["master_code","Код товара"],["manager","КМ"],["offer_id","Артикул"],
    ["estimated_result","Операционная прибыль"],["revenue","Выручка"],
    ["ad","Реклама, ₽"],["drr","ДРР"],["storage","Хранение, ₽"],
    ["orders","Заказы"],["cancelled","Отмены"],["buyout","Выкупы"],
    ["roas","ROAS"],["transit","Товары в пути"],["transit_revenue","Выручка с товарами в пути"],
    ["transit_drr","ДРР с товарами в пути"],["ozon_stock","Остатки Ozon"],
    ["crossdock","В пути на склады"],["main","Аведэкс основной"],
    ["ox","Аведэкс ОХ"],["stock","Итого остатки"],
    ["margin","Прибыль/ед."],["price","Цена реализации"],
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
      <p>Данные на {data?.to??"—"} включительно. Нажми на артикул, чтобы раскрыть статьи доходов и расходов.</p>
    </div><a href="#ozf-unallocated" className="ozf-btn ozf-jump">Нераспределённые расходы ↓</a></div>
    <div className="ozf-kpi-grid">{kpis.map(k=>
      <div key={k.name} className={"ozf-kpi "+k.tone}>
        <span>{k.name}</span><strong>{k.value}</strong>{k.note?<small>{k.note}</small>:null}
      </div>)}
    </div>
    {!complete&&<p className="ozf-footnote">Часть артикулов без полной цены закупа или ТК Маяк. Прибыль по ним не рассчитана; итоги предварительные.</p>}
    {!data?.ads_covered&&<p className="ozf-footnote ozf-ad-warning">
      Рекламные начисления Seller API учтены в общих результатах, но пока не распределены по КМ.
      При выборе отдельного менеджера его прибыль предварительная до завершения рекламной детализации.
      Расходы на рекламу по SKU пока не подтверждены Performance API за весь период.
      ДРР отмечается прочерком, а не нулём. Исторический запрос через
      /statistics/products/sku отклонён Ozon: этот метод принимает только сегодня или вчера.
      Для выбранных дат нужен исторический отчёт с отдельным созданием и получением результата.
      Покрыто {data?.ads_covered_days??0} дней.
      {data?.ads_jobs?.some(x=>x.status==="failed")?<strong className="ozf-bad">
        Ошибка Performance API: {data.ads_jobs.find(x=>x.status==="failed")?.last_error}
      </strong>:null}
      {data?.ads_jobs?.some(x=>x.status==="pending"||x.status==="running")?
        " Загрузка рекламной детализации ожидает выполнения." : null}
    </p>}
    <div className="ozf-section-tools">
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
          const price=r.buyout_units&&r.revenue!=null?r.revenue/r.buyout_units:null;
          const roasClass=fig.roas==null?"":fig.roas<1?"ozf-bad":"ozf-good";
          return <Fragment key={r.offer_id}><tr className={r.discontinued?"ozf-discontinued":""}>
            <td>{r.master_code??"—"}</td><td>{r.manager}</td>
            <td><button type="button" className="ozf-article-btn" aria-expanded={expanded===r.offer_id}
              onClick={()=>setExpanded(expanded===r.offer_id?null:r.offer_id)}>
              <span>{expanded===r.offer_id?"▾":"▸"}</span> {r.offer_id}</button></td>
            <td className={moneyTone(r.estimated_result)}>{money(r.estimated_result)}</td>
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
            <td>{money(price)}</td>
            <td className={r.mayak_expense&&r.mayak_expense>0?"ozf-bad":""}>
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
            <td colSpan={26}>
              <div className="ozf-expanded-content"><h3>{r.offer_id} · доходы и расходы Ozon</h3>
                <table className="ozf-breakdown-table"><thead><tr>
                  <th>Статья</th><th>Категория</th><th>Операций</th><th>Сумма, ₽</th>
                </tr></thead><tbody>
                  {r.details.map((item,i)=>{
                    const category=item.type_id==="SALES"?"Выручка":
                      item.type_id==="COMMISSION"?"Комиссия":
                      item.type_id==="REMAINDER"?"Прочее":
                      item.type_id==="SERVICE"?"Услуга Ozon":"Начисление Ozon";
                    return <tr key={item.type_id+"-"+i}>
                      <td>{item.name}</td><td title={"Код Ozon: "+item.type_id}>{category}</td>
                      <td>{item.count}</td><td className={moneyTone(item.amount)}>{money(item.amount)}</td>
                    </tr>;
                  })}
                  {r.cogs!=null&&<tr>
                    <td>Цена закупа × расчётные выкупы</td><td>Цена закупа</td>
                    <td>{qty(r.buyout_units)}</td><td className="ozf-bad">{money(-Math.abs(r.cogs))}</td>
                  </tr>}
                  {r.mayak_expense!=null&&<tr>
                    <td>ТК Маяк × заказанные единицы</td><td>Внешний расход</td>
                    <td>{qty(r.order_count)}</td>
                    <td className="ozf-bad">{money(-Math.abs(r.mayak_expense))}</td>
                  </tr>}
                  {r.performance_ad_expense!=null&&<tr className="ozf-info-only">
                    <td>Реклама по SKU (Performance API, справочно)</td>
                    <td>Распределение рекламы</td><td>—</td>
                    <td>{money(-Math.abs(r.performance_ad_expense))}</td>
                  </tr>}
                  <tr className="ozf-breakdown-total"><td>Операционная прибыль</td>
                    <td>Итог</td><td>—</td><td className={moneyTone(r.estimated_result)}>
                    {money(r.estimated_result)}</td>
                  </tr>
                </tbody></table>
              </div>
            </td>
          </tr>}
          </Fragment>;
        })}
        {!display.length&&<tr><td colSpan={26} className="ozf-empty">Нет артикулов для выбранного фильтра.</td></tr>}
        </tbody>
        <tfoot><tr>
          <td>Итого за период</td><td colSpan={2}>{qty(rows.length)} артикулов</td>
          <td className={moneyTone(operatingProfit)}>{money(operatingProfit)}</td>
          <td>{money(sumRevenue)}</td>
          <td>{money(marketingBySku)}</td>
          <td>{sumRevenue&&marketingBySku!=null?pct(Math.abs(marketingBySku)/sumRevenue):"—"}</td>
          <td>{money(storageAmount)}</td>
          <td>{qty(numericSum(rows,r=>r.order_count))}</td>
          <td>{qty(numericSum(rows,r=>r.cancelled_units))}</td>
          <td>{qty(numericSum(rows,r=>r.buyout_units))}</td>
          <td>—</td>
          <td>{qty(numericSum(rows,r=>r.in_transit))}</td>
          <td>{money(numericSum(rows,r=>r.transit_revenue))}</td><td>—</td>
          <td>{qty(numericSum(rows,r=>r.ozon_stock))}</td>
          <td>{qty(numericSum(rows,r=>r.in_crossdock))}</td>
          <td>{qty(numericSum(rows,r=>r.main_stock))}</td>
          <td>{qty(numericSum(rows,r=>r.ox_stock))}</td>
          <td>—</td><td>—</td><td>—</td>
          <td>{money(numericSum(rows,r=>r.mayak_expense==null?null:-Math.abs(r.mayak_expense)))}</td>
          <td>{qty(numericSum(rows,r=>r.in_china))}</td><td>—</td><td>—</td>
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
    <p className="ozf-footnote">ДРР и реклама по SKU поступают из Performance API только для аналитики.
      В прибыль списания рекламы уже включены в начисления Ozon Seller. Выкупы = заказы − отмены.
      Складские остатки берутся по последним подтверждённым снимкам, а не на дату финансового периода.
      Неучтённые значения отмечены прочерком. Маркетплейсы WB и ЯМ финансово не объединены с Ozon.</p>
  </div>;
}
