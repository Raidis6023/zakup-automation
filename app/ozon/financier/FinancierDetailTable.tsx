"use client";
import { useState } from "react";

type FinancialRow = {
 offer_id:string;master_code:string|null;manager:string;
 estimated_result:number|null;revenue:number|null;advertising_amount:number;
 order_count:number|null;cancelled_units:number|null;buyout_units:number|null;
 ozon_stock:number|null;main_stock:number|null;ox_stock:number|null;
 in_china:number|null;in_crossdock:number|null;in_transit:number|null;
 transit_revenue:number|null;transit_drr:number|null;mayak_expense:number|null;
 discontinued:boolean;
 details:Array<{name:string;amount:number}>;
};
type FinanceData = {
 from:string;to:string;stock_as_of?:{
  ozon_at:string|null;main_at:string|null;ox_at:string|null
 }|null;
 missing_days:string[];
};
const money=(v:number|null|undefined)=>v==null?"—":v.toLocaleString("ru-RU",{style:"currency",currency:"RUB"});
const count=(v:number|null|undefined)=>v==null?"—":v.toLocaleString("ru-RU");
const share=(v:number|null|undefined)=>v==null||!Number.isFinite(v)?"—":(v*100).toLocaleString("ru-RU",{maximumFractionDigits:1})+"%";
export default function FinancierDetailTable(props:{
 data:FinanceData|null;rows:FinancialRow[];
 onToggle:(r:FinancialRow,checked:boolean)=>void|Promise<void>;
}) {
 const {data,rows,onToggle}=props;
 const [search,setSearch]=useState("");
 const shown=rows.filter(r=>(r.offer_id+" "+(r.master_code??"")+" "+r.manager)
  .toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")));
 return <div className="ozf-panel ozf-financial-summary">
  <div className="ozf-toolbar">
   <div><h2>Финансовые результаты · детализация</h2>
    <p>По структуре Excel с 16-й строки. Без дублирующего столбца «Товары в пути».</p></div>
   <input aria-label="Поиск артикула в детализации" placeholder="Найти артикул"
    value={search} onChange={e=>setSearch(e.target.value)}/>
  </div>
  <p className="ozf-footnote">
   С {data?.from??"—"} по {data?.to??"—"} включительно.
   Снимки складов: Ozon {data?.stock_as_of?.ozon_at??"не найден"};
   Аведэкс основной {data?.stock_as_of?.main_at??"не найден"};
   ОХ {data?.stock_as_of?.ox_at??"не найден"}.
   Значок «—» означает отсутствие достоверных данных, а не ноль.
  </p>
  {data?.missing_days.length ? <p className="ozf-notice">
   Недостающие даты в финансовом кэше: {data.missing_days.join(", ")}.
   Они поставлены в очередь при нажатии «Сформировать».
  </p>:null}
  <div className="ozf-table-scroll ozf-financial-scroll">
   <table className="ozf-table ozf-financial-table">
    <thead><tr>
      <th>Код товара</th><th>КМ</th><th>Артикул</th><th>Фин. результат</th>
      <th>Выручка</th><th>Реклама, ₽</th><th>ДРР</th><th>Хранение, ₽</th>
      <th>Заказы</th><th>Отмены</th><th>Выкупы</th>
      <th>Товары в пути</th><th>Выручка с товарами в пути</th>
      <th>ДРР с товарами в пути</th><th>Остатки Ozon</th>
      <th>В пути на склады</th><th>Аведэкс основной</th>
      <th>Аведэкс ОХ</th><th>Итого остатки</th>
      <th>Опер. прибыль на ед.</th><th>Цена реализации</th>
      <th>ТК Маяк</th><th>В пути из Китая</th>
      <th>Выведено из продажи</th><th>ABC</th>
    </tr></thead>
    <tbody>{shown.map(r=>{
     const ads=r.advertising_amount<0?-r.advertising_amount:0;
     const storage=r.details.filter(d=>/хранени|размещени/i.test(d.name))
      .reduce((acc,d)=>acc+d.amount,0);
     const stocks=[r.ozon_stock,r.main_stock,r.ox_stock];
     const combined=stocks.every(x=>x!=null)
      ?Number(r.ozon_stock)+Number(r.main_stock)+Number(r.ox_stock):null;
     const aov=r.buyout_units&&r.revenue!=null?r.revenue/r.buyout_units:null;
     const resultPer=r.buyout_units&&r.estimated_result!=null
       ?r.estimated_result/r.buyout_units:null;
     const abc=r.revenue==null?"—":r.revenue>10000?"A":r.revenue<0?"C":"B";
     return <tr key={r.offer_id} className={r.discontinued?"ozf-discontinued":""}>
       <td>{r.master_code??"—"}</td><td>{r.manager}</td><td>{r.offer_id}</td>
       <td>{money(r.estimated_result)}</td><td>{money(r.revenue)}</td>
       <td>{money(r.advertising_amount)}</td>
       <td>{r.revenue&&ads?share(ads/r.revenue):"—"}</td>
       <td>{money(storage)}</td><td>{count(r.order_count)}</td>
       <td>{count(r.cancelled_units)}</td><td>{count(r.buyout_units)}</td>
       <td>{count(r.in_transit)}</td><td>{money(r.transit_revenue)}</td>
       <td>{share(r.transit_drr)}</td><td>{count(r.ozon_stock)}</td>
       <td>{count(r.in_crossdock)}</td><td>{count(r.main_stock)}</td>
       <td>{count(r.ox_stock)}</td><td>{count(combined)}</td>
       <td>{money(resultPer)}</td><td>{money(aov)}</td>
       <td>{money(r.mayak_expense)}</td><td>{count(r.in_china)}</td>
       <td><input type="checkbox" checked={r.discontinued} disabled={!r.master_code}
        aria-label={"Выведено из продажи "+r.offer_id}
        onChange={e=>void onToggle(r,e.target.checked)}/></td>
       <td>{abc}</td>
     </tr>
    })}
    {!shown.length?<tr><td colSpan={25} className="ozf-empty">Нет товаров с начислениями для выбранного периода и КМ.</td></tr>:null}
    </tbody>
   </table>
  </div>
  <p className="ozf-footnote">
   Выкупы = заказы − отмены по согласованной расчётной модели.
   Доход по товарам в пути требует подтверждённых незавершённых заказов,
   кросс-докинг требует реального статуса поставки, а Китай требует статуса отправки ВЭД.
   Пока их нет, выводим «—», а не выдуманные нули.
   Рекламные расходы не списываются повторно сверх начислений Ozon.
  </p>
 </div>;
}
