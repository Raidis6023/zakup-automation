"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {VED_TARIFFS, type VedTariffKey, type TariffRow} from "@/lib/ved-calculation/tariffs";
import "./ved-tariffs.css";
const TODAY="2026-10-30";
type TariffResponse={ok:boolean;error?:string;canEdit?:boolean;selected?:Record<string,TariffRow>;history?:TariffRow[]};
const groups=["Курсы","Контейнер","Логистика","Разовые расходы","Налоги"] as const;
const money=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:6}).format(n);
export default function VedTariffEditor(){
 const [date,setDate]=useState(TODAY);
 const [data,setData]=useState<TariffResponse|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 const [key,setKey]=useState<VedTariffKey>("cnyRub");
 const [amount,setAmount]=useState("");
 const [effectiveFrom,setEffectiveFrom]=useState(TODAY);
 const [reason,setReason]=useState("");
 const [filter,setFilter]=useState("");
 useEffect(()=>{const today=new Date().toLocaleDateString("sv-SE");setDate(today);setEffectiveFrom(today);},[]);
 const fetchRates=useCallback(async(d:string)=>{
   setLoading(true);setError("");
   try{
    const response=await fetch("/api/ved-tariffs?asOf="+encodeURIComponent(d)+"&history=1",{cache:"no-store"});
    const result=await response.json() as TariffResponse;
    if(!response.ok||!result.ok)throw Error(result.error||"Не удалось загрузить тарифы");
    setData(result);
   }catch(e){setError(e instanceof Error?e.message:"Неизвестная ошибка");setData(null);}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void fetchRates(date)},[fetchRates,date]);
 const current=useMemo(()=>VED_TARIFFS.find(v=>v.key===key)!,[key]);
 const save=async()=>{
  const n=Number(amount);
  if(!amount.trim()||!Number.isFinite(n)||n<0){setError("Введите корректное неотрицательное значение");return;}
  setSaving(true);setError("");
  try{
   const response=await fetch("/api/ved-tariffs",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({key,amount:n,effectiveFrom,reason})});
   const json=await response.json() as TariffResponse;
   if(!response.ok||!json.ok)throw Error(json.error||"Ошибка записи тарифа");
   setAmount("");setReason("");setDate(effectiveFrom);
   await fetchRates(effectiveFrom);
  }catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}
  finally{setSaving(false);}
 };
 return <article className="ved-module-panel ved-tariffs">
  <div className="ved-tariffs-top">
   <div><h2>Единые справочники тарифов</h2><p>История ставок не перезаписывается: каждая правка создаёт новую запись с датой действия.</p></div>
   <label className="ved-tariffs-control"><span>Показать тарифы на дату</span>
    <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
  </div>
  {error&&<p role="alert" className="ved-tariffs-error">{error}</p>}
  {loading&&<p className="ved-tariffs-muted">Загрузка значений…</p>}
  <div className="ved-tariffs-groups">
   {groups.map(group=><section key={group} className="ved-tariffs-group">
    <h3>{group}</h3>
    <div className="ved-tariffs-rows">
     {VED_TARIFFS.filter(item=>item.section===group).map(item=>{
       const row=data?.selected?.[item.key];
       return <div className="ved-tariffs-line" key={item.key}>
        <span>{item.title}</span>
        <strong>{row?money(Number(row.amount)):"Не установлено"} <small>{row?item.unit:""}</small></strong>
        <span className="ved-tariffs-valid">{row?"с "+row.effective_from:"потребуется подтверждение"}</span>
       </div>;
     })}
    </div>
   </section>)}
  </div>
  {data?.canEdit&&<details className="ved-tariffs-editor">
   <summary>Добавить новую редакцию тарифа</summary>
   <div className="ved-tariffs-form">
    <label className="ved-tariffs-control"><span>Параметр</span>
     <select value={key} onChange={e=>setKey(e.target.value as VedTariffKey)}>
      {VED_TARIFFS.map(t=><option value={t.key} key={t.key}>{t.title}</option>)}
     </select></label>
    <label className="ved-tariffs-control"><span>Значение ({current.unit})</span>
     <input inputMode="decimal" type="number" min="0" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label className="ved-tariffs-control"><span>Действует с даты</span>
     <input type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}/></label>
    <label className="ved-tariffs-control"><span>Причина изменения / источник</span>
     <input type="text" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Счёт перевозчика, курс, решение ВЭД…"/></label>
    <button type="button" disabled={saving||!effectiveFrom} onClick={()=>void save()}>{saving?"Сохранение…":"Сохранить новую редакцию"}</button>
   </div>
   <p className="ved-tariffs-muted">Ставки ТН ВЭД и валютные курсы автоматически из внешних источников пока не подгружаются. Вводимые значения подтверждает сотрудник ВЭД.</p>
  </details>}
  {data?.canEdit&&<details className="ved-tariffs-editor">
   <summary>История изменений ({data.history?.length??0} последних записей)</summary>
   <label className="ved-tariffs-control"><span>Фильтр истории</span>
    <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Название параметра"/></label>
   <div className="ved-tariffs-history">
    {(data.history||[]).filter(row=>!filter||VED_TARIFFS.find(t=>t.key===row.tariff_key)?.title.toLowerCase().includes(filter.toLowerCase())).map(row=><div className="ved-tariffs-line" key={row.id}>
      <span>{VED_TARIFFS.find(t=>t.key===row.tariff_key)?.title||row.tariff_key}</span>
      <strong>{money(Number(row.amount))}</strong>
      <span className="ved-tariffs-valid">{row.effective_from} · {row.reason||"Без комментария"}</span>
     </div>)}
   </div>
  </details>}
  <p className="ved-tariffs-muted">Исторические расчёты сохраняют применённые значения в отдельных версиях. Редактирование справочника само по себе их не пересчитывает.</p>
 </article>;
}
