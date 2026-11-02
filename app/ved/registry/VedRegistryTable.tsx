"use client";

import {useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import type {VedRegistryHistory,VedRegistryRow} from "@/lib/ved-calculation/registry";

type Status="all"|"calculated"|"review"|"new";
const money=(n:number|null|undefined)=>typeof n==="number"&&Number.isFinite(n)?
 new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+" ₽":"—";
const state=(row:VedRegistryRow):Exclude<Status,"all">=>{
 if(!row.history.length)return "new";
 return row.history[0].cost?"calculated":"review";
};
const linkTo=(row:VedRegistryRow,version?:VedRegistryHistory)=>{
 if(version?.type==="single")
  return "/ved/registry/calculator?snapshotId="+encodeURIComponent(version.id);
 const params=new URLSearchParams({offerId:row.offerId,offerItem:row.id});
 if(version)params.set("versionId",version.id);
 return "/ved/registry/calculator?"+params.toString();
};
export default function VedRegistryTable({rows,limited}:{
 rows:VedRegistryRow[];limited:boolean;
}){
 const router=useRouter();
 const [search,setSearch]=useState("");
 const [status,setStatus]=useState<Status>("all");
 const [supplier,setSupplier]=useState("all");
 const suppliers=useMemo(()=>[...new Set(rows.map(r=>r.supplier))].sort(),[rows]);
 const filtered=useMemo(()=>rows.filter(row=>{
  const term=search.trim().toLocaleLowerCase("ru");
  const matches=!term||[row.article,row.title,row.quoteCode,row.supplier,row.sourceSheet,
   ...row.history.map(v=>v.tnVedCode)].some(x=>x.toLocaleLowerCase("ru").includes(term));
  return matches&&(status==="all"||state(row)===status)&&
   (supplier==="all"||supplier===row.supplier);
 }),[rows,search,status,supplier]);
 const calculated=rows.filter(r=>state(r)==="calculated").length;
 const needsReview=rows.filter(r=>state(r)==="review").length;
 const newCount=rows.filter(r=>state(r)==="new").length;
 const offers=new Set(rows.map(x=>x.offerId)).size;
 return <article className="ved-module-panel ved-registry-panel">
  <div className="ved-registry-heading">
   <div><h2>Реестр товаров и сохранённых расчётов</h2>
    <p>Данные из загруженных КП, общих и отдельных сохранённых расчётов. Сценарии 40HQ, MOQ и средняя себестоимость.</p></div>
   <div className="ved-registry-actions">
    <button type="button" onClick={()=>router.refresh()}>Обновить</button>
    <Link href="/ved/registry/calculator">Черновой калькулятор</Link>
   </div>
  </div>
  <div className="ved-registry-kpis">
   <div><small>Товаров</small><strong>{rows.length}</strong></div>
   <div><small>Рассчитано</small><strong>{calculated}</strong></div>
   <div><small>Требуют доработки</small><strong>{needsReview}</strong></div>
   <div><small>Ещё не рассчитано</small><strong>{newCount}</strong></div>
   <div><small>КП в реестре</small><strong>{offers}</strong></div>
  </div>
  <div className="ved-registry-filters">
   <label><span>Поиск по артикулу, товару, КП и коду ТН ВЭД</span>
    <input value={search} onChange={event=>setSearch(event.target.value)}
     placeholder="Например, RCAB-AVD26828-1" type="search"/>
   </label>
   <label><span>Состояние</span><select value={status} onChange={e=>setStatus(e.target.value as Status)}>
    <option value="all">Все товары</option>
    <option value="calculated">Рассчитаны</option>
    <option value="review">Требуют доработки</option>
    <option value="new">Без расчёта</option>
   </select></label>
   <label><span>Поставщик</span><select value={supplier} onChange={e=>setSupplier(e.target.value)}>
    <option value="all">Все поставщики</option>
    {suppliers.map(s=><option value={s} key={s}>{s}</option>)}
   </select></label>
  </div>
  {limited&&<p className="ved-registry-warning">Отображена ограниченная выборка последних КП и версий. Старые расчёты не удалены.</p>}
  {!rows.length?<div className="ved-registry-empty">
   Пока нет импортированных товаров. Загрузите КП в разделе <Link href="/ved/commercial-offers">«Коммерческие предложения»</Link>.
  </div>:!filtered.length?<p className="ved-registry-empty">По заданным фильтрам ничего не найдено.</p>:
  <div className="ved-registry-scroll">
   <table className="ved-registry-table">
    <thead><tr>
     <th>Артикул / наименование</th>
     <th>КП и поставщик</th>
     <th>40HQ, ₽/шт.</th>
     <th>MOQ, ₽/шт.</th>
     <th>Средняя, ₽/шт.</th>
     <th>Состояние</th>
     <th>Дата / версии</th>
     <th>Действия</th>
    </tr></thead>
    <tbody>{filtered.map(row=>{
     const latest=row.history[0];
     const computed=row.history.find(v=>v.cost)||null;
     const isFallback=Boolean(latest&&!latest.cost&&computed);
     const displayed=computed?.cost;
     const rowState=state(row);
     return <tr key={row.offerId+":"+row.id}>
      <td className="ved-registry-product">
       <strong>{row.article||"Без артикула"}</strong>
       <span title={row.title}>{row.title||"Без наименования"}</span>
       {row.sourceSheet&&<small>Лист: {row.sourceSheet}</small>}
      </td>
      <td><strong>{row.quoteCode}</strong><small>{row.supplier} · КП от {row.quoteDate||"—"}</small></td>
      <td className="ved-registry-number">{money(displayed?.container)}</td>
      <td className="ved-registry-number">{money(displayed?.moq)}</td>
      <td className="ved-registry-number ved-registry-average">
       {money(displayed?.average)}
       {isFallback&&<small>из версии {computed?.number}</small>}
      </td>
      <td><span className={"ved-registry-state ved-registry-state--"+rowState}>
       {rowState==="calculated"?"Рассчитан":rowState==="review"?"Нужны данные":"Без расчёта"}
      </span></td>
      <td className="ved-registry-version-cell">
       <strong>{latest?latest.date:"—"}</strong>
       {latest&&<details className="ved-registry-history">
        <summary>История · {row.history.length} верс.</summary>
        <div className="ved-registry-history-list">
         {row.history.map(v=><Link href={linkTo(row,v)} key={v.id}>
          <strong>{v.type==="single"?"Отдельный расчёт":"КП"} · версия {v.number}</strong>
          <span>{v.date}</span>
          <span>{v.cost?money(v.cost.average):"Не завершена"}</span>
         </Link>)}
        </div>
       </details>}
      </td>
      <td><Link className="ved-registry-open" href={linkTo(row,computed||latest)}>
       {latest?"Открыть расчёт":"Рассчитать"}
      </Link></td>
     </tr>;
    })}</tbody>
   </table>
  </div>}
  <p className="ved-registry-footnote">Каждая строка соответствует товару из КП или самостоятельному расчёту. Версии не перезаписываются. При незавершённой последней версии показывается последняя успешно рассчитанная себестоимость с указанием версии.</p>
 </article>;
}
